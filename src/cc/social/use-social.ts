// The social post sheet's hooks: they read the post, the clock, the phone's zone and the role, run a
// decision through api.ts, and hand media loads the bearer (the client's authHeaders, for native
// loads outside its fetch). The decisions are approval.ts's and the view view.ts's. After a decision,
// right or refused, the post and the week's calendar (which lists social posts) read the server again;
// after a 409 the post has already been reloaded, so it is not fetched twice. Approve asks for Face
// ID first (gated.ts, A4): a refused check sends and reads nothing, and the sheet stays as it was.
// Request changes never asks (KP13).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { AuthHeaders } from '../../api/auth-headers';
import { queryKeys } from '../../api/query-keys';
import { useApiClient, useAppSession } from '../../app-state/session';
import { logger } from '../../lib/logger';
import type { GuardResult } from '../../step-up/guard';
import { useStepUp } from '../../step-up/use-step-up';
import { useToast } from '../../ui';
import { SCHEDULE_RANGE } from '../calendar/api';
import { useMinuteClock, usePhoneTimeZone } from '../shell/use-shell';
import { SOCIAL_COPY } from '../strings';
import { approvedMessage, refusalMessage, socialActions, type SocialVerdictMode } from './approval';
import { requestChanges, socialPostQuery, type ApproveOutcome } from './api';
import { approvePostGated } from './gated';
import type { SocialPost } from './schemas';
import { socialPostView } from './view';

/** The post, its view and what this role may do on it. */
export function useSocialPost(postId: string) {
  const { client, workspace } = useAppSession();
  const post = useQuery(socialPostQuery(client, workspace.id, postId));
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  const data = post.data;
  const view = useMemo(
    () => (data ? socialPostView(data, { now, timeZone }) : null),
    [data, now, timeZone],
  );
  const actions = data ? socialActions(data, workspace.role) : null;
  return { post, view, actions, role: workspace.role, webUrl: client.server.webUrl };
}

function useRefresh(post: SocialPost) {
  const { workspace } = useAppSession();
  const queryClient = useQueryClient();
  return (withPost: boolean) => {
    const keys = [queryKeys.schedule(SCHEDULE_RANGE)];
    const all = withPost ? [...keys, queryKeys.socialPost(workspace.id, post.id)] : keys;
    return Promise.all(all.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  };
}

type Decided = {
  readonly post: SocialPost;
  readonly reload: () => Promise<SocialPost | undefined>;
  readonly onDecided: () => void;
  readonly setRefusal: (words: string) => void;
};

/** The two calls: a success closes the sheet with a toast; a refusal or a reload says why. */
function useDecisionCalls({ post, reload, onDecided, setRefusal }: Decided) {
  const client = useApiClient();
  const { guard } = useStepUp();
  const toast = useToast();
  const refresh = useRefresh(post);
  const approve = useMutation({
    mutationFn: (shown: SocialPost) => approvePostGated(guard, client, shown, reload),
    onSuccess: (sent: GuardResult<ApproveOutcome>) => {
      if (!sent.ran) return;
      const outcome = sent.value;
      if (outcome.kind === 'reloaded') {
        setRefusal(outcome.words);
      } else {
        toast.show(approvedMessage(outcome.result));
        onDecided();
      }
    },
    onError: (error: unknown) => setRefusal(refusalMessage(error)),
    onSettled: (sent?: GuardResult<ApproveOutcome>) =>
      sent?.ran === false ? undefined : refresh(sent?.value.kind !== 'reloaded'),
  });
  const askChanges = useMutation({
    mutationFn: (words: string) => requestChanges(client, post.id, words),
    onSuccess: () => {
      toast.show(SOCIAL_COPY.changesRequested);
      onDecided();
    },
    onError: (error: unknown) => setRefusal(refusalMessage(error)),
    onSettled: () => refresh(true),
  });
  return { approve, askChanges };
}

/** Approve and Request changes on the post on screen: the mode, the comment, the refusal, the calls. */
export function useSocialVerdict(
  post: SocialPost,
  reload: () => Promise<SocialPost | undefined>,
  onDecided: () => void,
) {
  const [mode, setMode] = useState<SocialVerdictMode>('idle');
  const [comment, setComment] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const { approve, askChanges } = useDecisionCalls({ post, reload, onDecided, setRefusal });
  const choose = (next: SocialVerdictMode) => {
    setComment('');
    setRefusal(null);
    setMode(next);
  };
  return {
    mode,
    comment,
    refusal,
    busy: approve.isPending || askChanges.isPending,
    setComment,
    choose,
    /** Approves exactly this post: the version the sheet is showing. */
    approve: (shown: SocialPost) => {
      setRefusal(null);
      approve.mutate(shown);
    },
    requestChanges: () => {
      setRefusal(null);
      askChanges.mutate(comment);
    },
  };
}

export type MediaHeaders = {
  /** The bearer and workspace headers; null until read, or when they could not be. */
  readonly headers: AuthHeaders | null;
  readonly failed: boolean;
};

/** The headers a native media load sends (the post's media route needs the bearer). */
export function useMediaHeaders(): MediaHeaders {
  const client = useApiClient();
  const [state, setState] = useState<MediaHeaders>({ headers: null, failed: false });
  useEffect(() => {
    let live = true;
    client.authHeaders().then(
      (headers) => {
        if (live) setState({ headers, failed: false });
      },
      (error: unknown) => {
        logger.warn('[cc/social] the media headers could not be read', error);
        if (live) setState({ headers: null, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, [client]);
  return state;
}
