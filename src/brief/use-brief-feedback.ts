// The thumbs on a brief card, wired (the rules are feedback.ts's): the session's client and role,
// one send at a time, the choice kept for the launch per brief state. A refusal is logged by kind
// and says one line; it never throws.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppSession } from '../app-state/session';
import { logger } from '../lib/logger';
import {
  createFeedbackMemory,
  feedbackOffered,
  feedbackRefused,
  feedbackSent,
  feedbackStart,
  pressFeedback,
  sendBriefFeedback,
  shownRating,
  type BriefRating,
  type FeedbackState,
} from './feedback';
import type { Brief } from './schema';

/** The launch's choices, shared by every card of the same brief. */
const feedbackMemory = createFeedbackMemory();

export type BriefFeedback = {
  readonly offered: boolean;
  /** The thumb drawn as chosen; null for neither. */
  readonly chosen: BriefRating | null;
  /** A choice was just agreed to: the thanks line. */
  readonly thanked: boolean;
  /** The last send was refused: the failure line. */
  readonly failed: boolean;
  readonly choose: (rating: BriefRating) => void;
};

export function useBriefFeedback(brief: Pick<Brief, 'state_hash'>): BriefFeedback {
  const { client, workspace } = useAppSession();
  const hash = brief.state_hash.trim();
  const [state, setState] = useState<FeedbackState>(() => feedbackStart(feedbackMemory.get(hash)));
  const [thanked, setThanked] = useState(false);
  // read inside the callback: a second press before the re-render still sees the first send
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const choose = useCallback(
    (rating: BriefRating) => {
      const press = pressFeedback(latest.current, rating);
      if (!press.send) return;
      latest.current = press.state;
      setState(press.state);
      sendBriefFeedback(client, hash, rating).then(
        () => {
          feedbackMemory.set(hash, rating);
          setState((now) => feedbackSent(now, rating));
          setThanked(true);
        },
        (error: unknown) => {
          logger.warn('[brief] the thumbs were not saved', error);
          setState((now) => feedbackRefused(now));
          setThanked(false);
        },
      );
    },
    [client, hash],
  );
  return {
    offered: feedbackOffered(brief, workspace.role),
    chosen: shownRating(state),
    thanked: thanked && !state.failed,
    failed: state.failed,
    choose,
  };
}
