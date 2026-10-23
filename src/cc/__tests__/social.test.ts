import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { WORKSPACE_ROLES, type WorkspaceRole } from '../../api/workspace';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../api/transport-types';
import { routes } from '../../navigation/routes';
import {
  approveBody,
  approvedMessage,
  approveEffect,
  CommentInputError,
  conflictWords,
  noChannelNote,
  readOnlyNote,
  refusalMessage,
  requestChangesBody,
  settledNote,
  SOCIAL_COMMENT_MAX_CHARS,
  socialActions,
  socialVerdictView,
} from '../social/approval';
import {
  approvePost,
  approveShown,
  fetchSocialPost,
  postIdParam,
  requestChanges,
} from '../social/api';
import type { SocialPost } from '../social/schemas';
import { SOCIAL_COPY } from '../strings';

const WS = '7f1c2a54-0000-4000-8000-000000000001';
const POST_ID = '5b0c3f7e-8a51-4c1f-9d2e-0f6a7b8c9d10';
const HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const NEW_HASH = '60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752';
const WRITERS: readonly WorkspaceRole[] = ['owner', 'admin', 'editor'];
const API = `${SERVER.apiUrl}/api/socials/posts/${POST_ID}`;

// GET /api/socials/posts/{post_id} at the pinned SHA: SocialPost.to_dict (core/models/socials.py).
const POST = {
  id: POST_ID,
  workspace_id: WS,
  created_by: 'user_2x',
  campaign_id: null,
  title: 'Q4 launch teaser',
  brief: 'Tease Monday’s launch',
  copy: { base: 'We ship on Monday.', channels: { twitter: 'Monday.' } },
  format: 'video',
  template_id: '0c1d2e3f-0000-4000-8000-000000000009',
  variables: {},
  sources: {},
  media: {
    '9:16': [
      {
        deliverable_id: '1a2b3c4d-0000-4000-8000-000000000007',
        name: 'teaser-9x16.mp4',
        sha256: HASH,
        bytes: 4_200_000,
        content_type: 'video/mp4',
      },
    ],
  },
  voice: null,
  footage: null,
  preview: null,
  status: 'needs_approval',
  content_hash: HASH,
  approved_hash: null,
  approved_by: null,
  approved_at: null,
  override_unsourced: false,
  review_log: [],
  scheduled_for: null,
  timezone: 'Europe/London',
  planned_for: '2026-10-27T09:00:00+00:00',
  length_seconds: 20,
  slot_key: null,
  music: null,
  batch_key: null,
  targets: [
    { id: 't-1', toolkit: 'linkedin', post_kind: 'video', options: {}, status: 'pending' },
    { id: 't-2', toolkit: 'twitter', post_kind: 'post', options: {}, status: 'pending' },
  ],
  created_at: '2026-10-22T08:00:00+00:00',
  updated_at: '2026-10-22T08:05:00+00:00',
};

type Responder = (request: TransportRequest) => ReturnType<typeof jsonReply>;

function clientWith(responder: Responder) {
  const transport = fakeTransport(responder);
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'token',
    getWorkspaceId: () => WS,
    transport,
  });
  return { client, transport };
}

/** GET answers this post; a POST answers `post`'s status and body. */
function serverWith(postReply: { status: number; body: unknown }, current: unknown = POST) {
  return clientWith((request) =>
    request.method === 'GET'
      ? jsonReply(200, current)
      : jsonReply(postReply.status, postReply.body),
  );
}

async function shownPost(): Promise<SocialPost> {
  return fetchSocialPost(serverWith({ status: 200, body: {} }).client, POST_ID);
}

describe('the approve payload', () => {
  it('carries exactly the content_hash of the version on screen, and nothing else', async () => {
    const shown = await shownPost();
    expect(approveBody(shown)).toEqual({ content_hash: HASH });
    const { client, transport } = serverWith({
      status: 200,
      body: { ...POST, status: 'approved' },
    });
    await approvePost(client, shown);
    expect(transport.calls.map((call) => [call.method, call.url, call.body])).toEqual([
      ['POST', `${API}/approve`, JSON.stringify({ content_hash: HASH })],
    ]);
  });

  it('sends the hash as the server sent it, never one recomputed from the copy', async () => {
    const shown = await shownPost();
    const edited = { ...shown, copy: { ...shown.copy, base: 'Edited on the phone?' } };
    expect(approveBody(edited)).toEqual({ content_hash: HASH });
  });

  it('a post with no hash is not readable, so Approve is never offered without one', async () => {
    const { client } = clientWith(() => jsonReply(200, { ...POST, content_hash: undefined }));
    await expect(fetchSocialPost(client, POST_ID)).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('says a post that the approval scheduled was scheduled', () => {
    expect(approvedMessage({ status: 'scheduled' })).toBe(SOCIAL_COPY.approvedScheduled);
    expect(approvedMessage({ status: 'approved' })).toBe(SOCIAL_COPY.approved);
    expect(approvedMessage(undefined)).toBe(SOCIAL_COPY.approved);
  });

  it('says what approving does: the slot ahead, or a lock until it is scheduled', () => {
    expect(approveEffect('Tue 27 Oct · 09:00 London')).toBe(
      'Approving schedules this exact version for Tue 27 Oct · 09:00 London.',
    );
    expect(approveEffect(null)).toBe(SOCIAL_COPY.effect.noSlot);
  });
});

describe('request changes', () => {
  it('requires a comment with words, trimmed, within the server limit', () => {
    expect(requestChangesBody('')).toMatchObject({ ok: false, reason: 'empty' });
    expect(requestChangesBody('   \n ')).toMatchObject({ ok: false, reason: 'empty' });
    expect(requestChangesBody(null)).toMatchObject({ ok: false, reason: 'empty' });
    expect(requestChangesBody('x'.repeat(SOCIAL_COMMENT_MAX_CHARS + 1))).toMatchObject({
      ok: false,
      reason: 'too_long',
      message: SOCIAL_COPY.commentTooLong(SOCIAL_COMMENT_MAX_CHARS),
    });
    expect(requestChangesBody('  Shorter hook, please. ')).toEqual({
      ok: true,
      body: { comment: 'Shorter hook, please.' },
    });
  });

  it('refuses a blank comment without sending anything', async () => {
    const { client, transport } = serverWith({ status: 200, body: POST });
    await expect(requestChanges(client, POST_ID, '  ')).rejects.toBeInstanceOf(CommentInputError);
    expect(transport.calls).toHaveLength(0);
  });

  it('posts {comment} to request-changes', async () => {
    const reply = { ...POST, status: 'changes_requested' };
    const { client, transport } = serverWith({ status: 200, body: reply });
    await expect(requestChanges(client, POST_ID, 'Use the new logo')).resolves.toEqual({
      status: 'changes_requested',
    });
    expect(transport.calls.map((call) => [call.method, call.url, call.body])).toEqual([
      ['POST', `${API}/request-changes`, JSON.stringify({ comment: 'Use the new logo' })],
    ]);
  });
});

describe('a 409 on Approve reloads the post', () => {
  const stale = {
    status: 409,
    body: {
      detail: {
        message: 'the post changed since you opened it: review the current version, then try again',
        content_hash: NEW_HASH,
      },
    },
  };

  it('says it changed when the reloaded version differs, and approves nothing twice', async () => {
    const shown = await shownPost();
    const { client, transport } = serverWith(stale, { ...POST, content_hash: NEW_HASH });
    const reload = () => fetchSocialPost(client, POST_ID);
    await expect(approveShown(client, shown, reload)).resolves.toEqual({
      kind: 'reloaded',
      words: SOCIAL_COPY.changed,
    });
    expect(transport.calls.map((call) => call.method)).toEqual(['POST', 'GET']);
  });

  it('says it changed when another reviewer moved it on (the status differs)', async () => {
    const shown = await shownPost();
    expect(conflictWords(shown, { content_hash: HASH, status: 'approved' }, new Error())).toBe(
      SOCIAL_COPY.changed,
    );
  });

  it('shows the server’s words when the reload is the very version approved', async () => {
    const shown = await shownPost();
    const refused = { status: 409, body: { detail: 'The AI-generated label does not match.' } };
    const { client } = serverWith(refused);
    const outcome = await approveShown(client, shown, () => fetchSocialPost(client, POST_ID));
    expect(outcome).toEqual({ kind: 'reloaded', words: 'The AI-generated label does not match.' });
  });

  it('says it changed when the reload brought nothing back', async () => {
    const shown = await shownPost();
    const { client } = serverWith(stale);
    const outcome = await approveShown(client, shown, async () => undefined);
    expect(outcome).toEqual({ kind: 'reloaded', words: SOCIAL_COPY.changed });
  });

  it('leaves every other refusal to the caller, in its words', async () => {
    const shown = await shownPost();
    const unsourced = { detail: { message: 'these claims have no source: revenue', claims: [] } };
    const { client: refusing } = serverWith({ status: 422, body: unsourced });
    const error = await approveShown(refusing, shown, async () => undefined).catch((e) => e);
    expect(refusalMessage(error)).toBe('these claims have no source: revenue');
    const { client: forbidding } = serverWith({ status: 403, body: { detail: 'Forbidden' } });
    const denied = await approveShown(forbidding, shown, async () => undefined).catch((e) => e);
    expect(denied).toBeInstanceOf(ApiError);
    expect(refusalMessage(denied)).toBe(API_ERROR_COPY.forbidden);
    expect(refusalMessage(new CommentInputError('empty', SOCIAL_COPY.commentRequired))).toBe(
      SOCIAL_COPY.commentRequired,
    );
  });
});

describe('who decides (D-ROLES, D45)', () => {
  const waiting = { status: 'needs_approval', targets: POST.targets };

  it('offers Approve and Request changes to owners, admins and editors', () => {
    for (const role of WRITERS) {
      expect(socialActions(waiting, role)).toEqual({ approve: true, requestChanges: true });
      expect(readOnlyNote(waiting, role)).toBeNull();
    }
  });

  it('keeps a viewer read-only, and says who decides', () => {
    expect(socialActions(waiting, 'viewer')).toEqual({ approve: false, requestChanges: false });
    expect(readOnlyNote(waiting, 'viewer')).toBe(SOCIAL_COPY.readOnly);
    expect(noChannelNote(waiting, 'viewer')).toBeNull();
  });

  it('offers nothing while the role is unknown, and says nothing yet', () => {
    expect(socialActions(waiting, null)).toEqual({ approve: false, requestChanges: false });
    expect(readOnlyNote(waiting, null)).toBeNull();
  });

  it('offers nothing on a post that is not waiting, and says so in words', () => {
    for (const role of WORKSPACE_ROLES) {
      const approved = { status: 'approved', targets: POST.targets };
      expect(socialActions(approved, role)).toEqual({ approve: false, requestChanges: false });
      expect(readOnlyNote(approved, role)).toBeNull();
    }
    expect(settledNote({ status: 'approved' })).toBe(
      'This post is approved: nothing waits on you.',
    );
    expect(settledNote({ status: 'queued_somewhere' })).toBe(
      'This post is queued somewhere: nothing waits on you.',
    );
    expect(settledNote({ status: 'needs_approval' })).toBeNull();
  });

  it('holds Approve back on a post with no channel (F256), and says why', () => {
    const nowhere = { status: 'needs_approval', targets: [] };
    expect(socialActions(nowhere, 'editor')).toEqual({ approve: false, requestChanges: true });
    expect(noChannelNote(nowhere, 'editor')).toBe(SOCIAL_COPY.noChannel);
  });
});

describe('the verdict panel', () => {
  const both = { approve: true, requestChanges: true };

  it('shows Request changes and Approve while idle', () => {
    expect(socialVerdictView(both, 'idle', '', false)).toEqual({
      comment: { open: false, error: null },
      secondary: { label: SOCIAL_COPY.requestChanges, disabled: false },
      primary: { label: SOCIAL_COPY.approve, disabled: false },
    });
  });

  it('opens the comment; Send request waits for words, and a long one says why', () => {
    expect(socialVerdictView(both, 'comment', ' ', false)).toEqual({
      comment: { open: true, error: null },
      secondary: { label: SOCIAL_COPY.cancel, disabled: false },
      primary: { label: SOCIAL_COPY.send, disabled: true },
    });
    expect(socialVerdictView(both, 'comment', 'Fix the hook', false).primary?.disabled).toBe(false);
    const long = socialVerdictView(
      both,
      'comment',
      'x'.repeat(SOCIAL_COMMENT_MAX_CHARS + 1),
      false,
    );
    expect(long.comment.error).toBe(SOCIAL_COPY.commentTooLong(SOCIAL_COMMENT_MAX_CHARS));
  });

  it('disables everything while a call is out, and shows nothing to a viewer', () => {
    const busy = socialVerdictView(both, 'idle', '', true);
    expect([busy.primary?.disabled, busy.secondary?.disabled]).toEqual([true, true]);
    const none = { approve: false, requestChanges: false };
    expect(socialVerdictView(none, 'comment', 'words', false)).toEqual({
      comment: { open: false, error: null },
      secondary: null,
      primary: null,
    });
  });
});

describe('the route (D18: approvals open the app)', () => {
  it('opens through the foundation’s builder with the post id, at this screen file', () => {
    const href = routes.cc.social(POST_ID);
    expect(href).toBe(`/cc/social/${POST_ID}`);
    expect(existsSync(resolve(__dirname, '../../../app/(app)/cc/social/[postId].tsx'))).toBe(true);
    expect(postIdParam({ postId: href.split('/').pop() })).toBe(POST_ID);
  });

  it('reads only a post id from the route', () => {
    expect(postIdParam({ postId: [POST_ID, 'other'] })).toBe(POST_ID);
    expect(postIdParam({ postId: ' 42 ' })).toBeNull();
    expect(postIdParam({ postId: '..' })).toBeNull();
    expect(postIdParam({})).toBeNull();
  });
});
