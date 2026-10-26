// Not running's quiet re-check on the gate (US-016j), pure. The gate's Retry refetches its own
// query, and a refetch shows the gate's loading state while it runs, so a re-check every 5 s
// through it would flash 'Connecting' over Not running. This one asks the server aside (the probe:
// its discovery document) and leaves the gate alone until there is something new: an answer, or a
// failure that is no longer Not running's (isNotRunning: the server answered, with an error),
// tries the gate's step again, so the gate moves on or shows what the server now says. No answer
// is the state the screen already shows: it stays, and the next check runs 5 s later (recheck.ts).
// An answer that lands after the chain stopped (the screen went: Sign out, Forget this server, the
// gate's own Retry) is dropped, so a gate that no longer exists never refetches.

import { isNotRunning } from '../../connect/server-support';
import type { RecheckRun, StillRunning } from './recheck';

/** Asks the server, resolving when it answers. */
export type ServerProbe = () => Promise<unknown>;

/** A RecheckRun also callable on its own (no chain): then it always acts on its answer. */
export type QuietRecheck = RecheckRun & ((running?: StillRunning) => Promise<void>);

const ALWAYS_RUNNING: StillRunning = () => true;

/** Not running's re-check that runs the gate's Retry only once the server has something to say. */
export function quietRecheck(probe: ServerProbe, onRetry: () => void): QuietRecheck {
  return (running = ALWAYS_RUNNING) =>
    probe().then(
      () => {
        if (running()) onRetry();
      },
      (error: unknown) => {
        // still not answering: what the screen says already
        if (running() && !isNotRunning(error)) onRetry();
      },
    );
}
