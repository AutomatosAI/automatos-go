// The gate's 'error' and 'not_running' states as the style's edge screens (US-016j): the component
// the root layout hands the signed-in gate through EdgeScreenSlot (ShellEdgeScreen.tsx). An own
// server that does not answer is Not running; an error is EdgeScreen's (edgeFor: Not running for no
// answer, Something went wrong for the server or the stream), and an error that is not an edge's
// (auth, forbidden) keeps the gate's own state (`fallback`). Each gets the gate's Retry and, under
// the action, its way out as the gate's own screens draw it: Sign out on the hosted server, Forget
// this server, asked first, on an own one. Not running's quiet re-check asks the server's discovery
// document aside (gate-recheck.ts), so the gate does not show loading every 5 s.

import { fetchDiscovery } from '../../api/discovery';
import { expoTransport } from '../../api/transport';
import type { GateEdgeProps } from '../../app-state/AppGate';
import { ForgetServer } from '../../connect/components/ForgetServer';
import { FORGET_SERVER_COPY } from '../../connect/strings';
import { Button } from '../../ui';
import { EdgeScreen } from './EdgeScreen';
import { quietRecheck } from './gate-recheck';
import { NotRunning } from './NotRunning';

type EdgeLeaveProps = Pick<GateEdgeProps, 'server' | 'serverName' | 'leave'>;

/** The gate's way out: its Sign out, or Forget this server behind its question. */
function EdgeLeave({ server, serverName, leave: Leave }: EdgeLeaveProps) {
  if (server.source !== 'hosted') {
    return <ForgetServer question={FORGET_SERVER_COPY.question(serverName)} variant="ghost" />;
  }
  return (
    <Leave>
      {({ signOut, busy, label }) => (
        <Button label={label} onPress={signOut} busy={busy} variant="ghost" />
      )}
    </Leave>
  );
}

export function GateEdge({ view, server, serverName, onRetry, leave, fallback }: GateEdgeProps) {
  const secondary = <EdgeLeave server={server} serverName={serverName} leave={leave} />;
  const onRecheck = quietRecheck(
    () => fetchDiscovery(server, { transport: expoTransport }),
    onRetry,
  );
  if (view.kind === 'not_running') {
    return (
      <NotRunning
        server={view.server}
        onRetry={onRetry}
        onRecheck={onRecheck}
        secondary={secondary}
      />
    );
  }
  return (
    <EdgeScreen
      error={view.error}
      server={server}
      onRetry={onRetry}
      onRecheck={onRecheck}
      secondary={secondary}
      otherwise={fallback}
    />
  );
}
