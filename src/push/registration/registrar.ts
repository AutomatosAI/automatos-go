// The session's one registrar (KP10): PushRoot (US-014g) runs it at launch, on resume, after a
// permission change and when the OS hands over a new token. Runs never overlap — two at once could
// both find no key and revoke the row twice — and the triggers that arrive while one runs share ONE
// run after it, so a token that changed mid-run is still sent. A person's tap (force) always gets a
// run of its own. Each outcome's row and 409 are kept for this launch only: the next launch starts
// fresh, so an admin who adds the phone back is seen then. close() ends it for the session (sign-out,
// Forget this server, US-014i, before the push record is wiped): no run starts after it, a run under
// way sends nothing more and keeps no record, and it resolves once that run has ended — so a late
// answer never writes a key back after the wipe.

import type { ListenerHandle } from '../platform/port';
import type { NotificationsPort } from '../platform/expo';
import {
  NO_MEMORY,
  register,
  type RegisterDeps,
  type RegisterOptions,
  type RegistrationMemory,
  type RegistrationOutcome,
} from './register';

export type Registrar = Readonly<{
  /** Runs now, or once after the run under way; never rejects. After close(): the latest, no run. */
  run: (options?: RegisterOptions) => Promise<RegistrationOutcome | null>;
  /** The last outcome this launch, or null before the first run ends. */
  latest: () => RegistrationOutcome | null;
  /** Ends the registrar; resolves once the run under way has ended. */
  close: () => Promise<void>;
}>;

/** Runs tasks one at a time, each after the last has settled. */
function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

export function createRegistrar(deps: RegisterDeps): Registrar {
  const serial = serialQueue();
  let closed = false;
  let memory: RegistrationMemory = NO_MEMORY;
  let latest: RegistrationOutcome | null = null;
  let queued: Promise<RegistrationOutcome | null> | null = null;
  const guarded: RegisterDeps = { ...deps, active: () => !closed };

  const once = async (options: RegisterOptions): Promise<RegistrationOutcome | null> => {
    if (closed) return latest;
    const outcome = await register(guarded, memory, options);
    memory = Object.freeze({
      serverRow: outcome.facts.serverRow,
      lastConflict: outcome.facts.lastConflict,
    });
    latest = outcome;
    return outcome;
  };

  return Object.freeze({
    run: (options: RegisterOptions = {}) => {
      if (options.force) return serial(() => once(options));
      queued ??= serial(() => {
        queued = null; // a trigger from now on is after this run's reads: it queues the next one
        return once(options);
      });
      return queued;
    },
    latest: () => latest,
    close: () => {
      closed = true;
      return serial(async () => undefined);
    },
  });
}

/** A new device token from the OS: the Expo token is read again, and sent if it changed. */
export function watchPushToken(
  port: Pick<NotificationsPort, 'addPushTokenListener'>,
  registrar: Pick<Registrar, 'run'>,
): ListenerHandle {
  return port.addPushTokenListener(() => {
    void registrar.run();
  });
}
