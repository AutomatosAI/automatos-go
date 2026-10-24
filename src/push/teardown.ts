// Push on this phone, cleared (PRD-001 §4.8, KP16, KP18): sign-out, Forget this server and a
// revoked phone (US-014i, bind/leave.ts) call teardownLocal after the registrar is closed. It deletes
// the push record (the keychain item and its entry in the key registry, registration/key-store.ts),
// sets the badge to 0, dismisses every delivered notification, and forgets the handled responses and
// the in-context ask's counters. For a hosted Clerk session that merely expired push keeps the
// record (the same person signing in again keeps the same row and key; the shell's expiry sign-out
// still wipes the keychain on its own): clearShown takes away only what the phone shows, the badge
// and the delivered notifications. Each step runs even when an earlier one failed, and neither
// ever throws: the outcome names the steps that failed, and the log says only which.

import { logger } from '../lib/logger';
import type { HandledStore } from './inbound/handled-store';
import type { NotificationsPort } from './platform/expo';
import type { PromptMemory } from './prompt/memory';
import type { PushKeyStore } from './registration/key-store';

export type TeardownDeps = Readonly<{
  store: Pick<PushKeyStore, 'clear'>;
  port: Pick<NotificationsPort, 'setBadgeCountAsync' | 'dismissAllNotificationsAsync'>;
  handled: Pick<HandledStore, 'clear'>;
  prompt: Pick<PromptMemory, 'clear'>;
}>;

export type TeardownStep = 'push_record' | 'badge' | 'delivered' | 'handled' | 'prompt_counts';

export type TeardownOutcome = Readonly<{ failed: readonly TeardownStep[] }>;

type Step = readonly [TeardownStep, () => unknown];

const NO_BADGE = 0;

function shownSteps(port: TeardownDeps['port']): readonly Step[] {
  return [
    ['badge', () => port.setBadgeCountAsync(NO_BADGE)],
    ['delivered', () => port.dismissAllNotificationsAsync()],
  ];
}

function stepsOf(deps: TeardownDeps): readonly Step[] {
  return [
    ['push_record', () => deps.store.clear()],
    ...shownSteps(deps.port),
    ['handled', () => deps.handled.clear()],
    ['prompt_counts', () => deps.prompt.clear()],
  ];
}

/** true when the step settled; a throw or a rejection is false. */
async function ran(step: () => unknown): Promise<boolean> {
  try {
    await step();
    return true;
  } catch {
    return false;
  }
}

/** Every step in turn, past a failing one; never rejects. */
async function runAll(steps: readonly Step[], what: string): Promise<TeardownOutcome> {
  let failed: readonly TeardownStep[] = [];
  for (const [name, step] of steps) {
    if (!(await ran(step))) failed = [...failed, name];
  }
  if (failed.length > 0) logger.warn(`[push] ${what} left steps undone`, failed);
  return Object.freeze({ failed });
}

/** Clears push on this phone, every step in turn; never rejects. */
export function teardownLocal(deps: TeardownDeps): Promise<TeardownOutcome> {
  return runAll(stepsOf(deps), 'local teardown');
}

/** The badge to 0 and the delivered notifications dismissed; the push record stays. Never rejects. */
export function clearShown(deps: Pick<TeardownDeps, 'port'>): Promise<TeardownOutcome> {
  return runAll(shownSteps(deps.port), 'clearing the badge and notifications');
}
