// Push on this phone, cleared (PRD-001 §4.8, KP16, KP18): sign-out, Forget this server and a
// revoked phone (US-014i) call teardownLocal after the registrar is closed. It deletes the push
// record (the keychain item and its entry in the key registry, registration/key-store.ts), sets the
// badge to 0, dismisses every delivered notification, and forgets the handled responses and the
// in-context ask's counters. Each step runs even when an earlier one failed, and it never throws:
// the outcome names the steps that failed, and the log says only which.

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

const NO_BADGE = 0;

function stepsOf(deps: TeardownDeps): readonly (readonly [TeardownStep, () => unknown])[] {
  return [
    ['push_record', () => deps.store.clear()],
    ['badge', () => deps.port.setBadgeCountAsync(NO_BADGE)],
    ['delivered', () => deps.port.dismissAllNotificationsAsync()],
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

/** Clears push on this phone, every step in turn; never rejects. */
export async function teardownLocal(deps: TeardownDeps): Promise<TeardownOutcome> {
  let failed: readonly TeardownStep[] = [];
  for (const [name, step] of stepsOf(deps)) {
    if (!(await ran(step))) failed = [...failed, name];
  }
  if (failed.length > 0) logger.warn('[push] local teardown left steps undone', failed);
  return Object.freeze({ failed });
}
