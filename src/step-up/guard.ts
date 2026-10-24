// The gate in front of a write (D19, KP13): guard(action, run) calls run() at once after the check
// passes (or needs nothing), and never otherwise. A cancel, a miss, a lockout or a phone that
// cannot check sends NOTHING and shows that outcome's line; the gate never queues the write for
// later (D-WRITES), so a later pass never sends an earlier tap. A check that throws counts as
// 'unavailable', never as a pass. Pure over its ports: use-step-up.ts wires stepUp and the Toast.

import { lets, type Refusal, type StepUpAction, type StepUpVerdict } from './policy';
import { STEP_UP_OUTCOME_COPY } from './strings';

/** ran: run() was called and settled with value; otherwise nothing was sent. */
export type GuardResult<T> = Readonly<
  { ran: true; verdict: StepUpVerdict; value: T } | { ran: false; verdict: Refusal }
>;

export type Guard = <T>(action: StepUpAction, run: () => Promise<T> | T) => Promise<GuardResult<T>>;

export type GuardDeps = Readonly<{
  check: (action: StepUpAction) => Promise<StepUpVerdict>;
  /** Shows a line to the person (the foundation's Toast). */
  notify: (message: string) => void;
}>;

async function verdictOf(check: GuardDeps['check'], action: StepUpAction) {
  try {
    return await check(action);
  } catch {
    return 'unavailable' as const;
  }
}

export function createGuard({ check, notify }: GuardDeps): Guard {
  return async <T>(action: StepUpAction, run: () => Promise<T> | T): Promise<GuardResult<T>> => {
    const verdict = await verdictOf(check, action);
    if (lets(verdict)) return { ran: true, verdict, value: await run() };
    notify(STEP_UP_OUTCOME_COPY[verdict]);
    return { ran: false, verdict };
  };
}
