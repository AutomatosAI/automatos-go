// A social post's calls, through the foundation's one client (D-ONE-CLIENT) and the route table
// (src/cc/routes.ts), under the foundation's key (query-keys.ts socialPost, never persisted). A
// decision is sent at once and never queued (the client's mutations run networkMode 'always'); the
// server's compare-and-set is the truth (D-WRITES). Approve carries the hash of the post on screen;
// a 409 reloads the post and says whether it changed (approval.ts conflictWords).

import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import { queryKeys } from '../../api/query-keys';
import type { RouteParams } from '../../navigation/routes';
import { CC_ROUTES } from '../routes';
import {
  approveBody,
  CommentInputError,
  conflictWords,
  isConflict,
  requestChangesBody,
} from './approval';
import { DecidedPostSchema, SocialPostSchema, type DecidedPost, type SocialPost } from './schemas';

/** The route's own parameter: app/(app)/cc/social/[postId].tsx (routes.cc.social). */
export const POST_ID_PARAM = 'postId';
/** A post id is a UUID (api/socials.py takes `post_id: UUID`). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The post id from the route, or null when it is missing or not a UUID. */
export function postIdParam(params: RouteParams): string | null {
  const value = params[POST_ID_PARAM];
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text && UUID.test(text) ? text : null;
}

export function fetchSocialPost(
  client: ApiClient,
  postId: string,
  signal?: AbortSignal,
): Promise<SocialPost> {
  return client.request(CC_ROUTES.social.post, {
    params: { post_id: postId },
    schema: SocialPostSchema,
    signal,
  });
}

/** One post's query (never persisted: query-keys.ts 'socialPost'). */
export function socialPostQuery(client: ApiClient, workspaceId: string | null, postId: string) {
  return queryOptions({
    queryKey: queryKeys.socialPost(workspaceId, postId),
    queryFn: ({ signal }) => fetchSocialPost(client, postId, signal),
  });
}

export function approvePost(client: ApiClient, shown: SocialPost): Promise<DecidedPost> {
  return client.request(CC_ROUTES.social.approve, {
    params: { post_id: shown.id },
    body: approveBody(shown),
    schema: DecidedPostSchema,
  });
}

/** Request changes; a blank or overlong comment is refused unsent. */
export async function requestChanges(
  client: ApiClient,
  postId: string,
  comment: string,
): Promise<DecidedPost> {
  const checked = requestChangesBody(comment);
  if (!checked.ok) throw new CommentInputError(checked.reason, checked.message);
  return client.request(CC_ROUTES.social.requestChanges, {
    params: { post_id: postId },
    body: checked.body,
    schema: DecidedPostSchema,
  });
}

export type ApproveOutcome =
  | { readonly kind: 'approved'; readonly result: DecidedPost }
  /** 409: the post was reloaded; the words say whether it changed. */
  | { readonly kind: 'reloaded'; readonly words: string };

/** Approve the version shown; on a 409, reload it (the new version goes on screen) and say why. */
export async function approveShown(
  client: ApiClient,
  shown: SocialPost,
  reload: () => Promise<SocialPost | null | undefined>,
): Promise<ApproveOutcome> {
  try {
    return { kind: 'approved', result: await approvePost(client, shown) };
  } catch (error) {
    if (!isConflict(error)) throw error;
    return { kind: 'reloaded', words: conflictWords(shown, await reload(), error) };
  }
}
