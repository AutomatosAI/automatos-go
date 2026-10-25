// Not running's quiet re-check on the gate (US-016j), pure. The gate's Retry refetches its own
// query, and a refetch shows the gate's loading state while it runs, so a re-check every 5 s
// through it would flash 'Connecting' over Not running. This one asks the server aside (the probe:
// its discovery document) and leaves the gate alone until there is something new: an answer, or a
// failure that is no longer Not running's (isNotRunning: the server answered, with an error),
// tries the gate's step again, so the gate moves on or shows what the server now says. No answer
// is the state the screen already shows: it stays, and the next check runs 5 s later (recheck.ts).

import { isNotRunning } from '../../connect/server-support';
import type { RecheckRun } from './recheck';

/** Asks the server, resolving when it answers. */
export type ServerProbe = () => Promise<unknown>;

/** Not running's re-check that runs the gate's Retry only once the server has something to say. */
export function quietRecheck(probe: ServerProbe, onRetry: () => void): RecheckRun {
  return () =>
    probe().then(
      () => onRetry(),
      (error: unknown) => {
        // still not answering: what the screen says already
        if (!isNotRunning(error)) onRetry();
      },
    );
}
