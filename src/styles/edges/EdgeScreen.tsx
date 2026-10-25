// An error as its edge screen (US-017f): edgeFor picks Not running (no answer) or Something went
// wrong (the server or the stream failed); any other error is not an edge's and shows `otherwise`
// (the caller's own state: the gate keeps auth and forbidden). US-016j switches the gate's error
// branch to this, with the gate's Retry and its way out as `secondary`.

import type { ReactNode } from 'react';

import { edgeFor, type EdgeServer } from './edges';
import { NotRunning } from './NotRunning';
import type { RecheckRun } from './recheck';
import { SomethingWrong } from './SomethingWrong';

export type EdgeScreenProps = {
  readonly error: unknown;
  /** The server the step called: Not running names it. */
  readonly server: EdgeServer;
  /** Check again or Try again: the step tried again. */
  readonly onRetry: () => void;
  /** Not running's quiet re-check every 5 s; onRetry when omitted. */
  readonly onRecheck?: RecheckRun;
  /** A second way forward under the action (the gate's Sign out or Forget this server). */
  readonly secondary?: ReactNode;
  /** What shows for an error that is not an edge's; nothing when omitted. */
  readonly otherwise?: ReactNode;
};

export function EdgeScreen({
  error,
  server,
  onRetry,
  onRecheck,
  secondary,
  otherwise = null,
}: EdgeScreenProps) {
  const edge = edgeFor(error);
  if (edge === 'not-running') {
    return (
      <NotRunning server={server} onRetry={onRetry} onRecheck={onRecheck} secondary={secondary} />
    );
  }
  if (edge === 'something-wrong') {
    return <SomethingWrong error={error} onRetry={onRetry} secondary={secondary} />;
  }
  return <>{otherwise}</>;
}
