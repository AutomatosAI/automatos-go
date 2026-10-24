// The signed-in group: every screen here opens only through the gate (src/app-state/AppGate.tsx,
// its decision in gate.ts): connected nowhere → /welcome; a paired server without a token, or one
// that refused it → /connect with that server; signed in → discovery (an own server that does not
// answer: Not running) → a supported sign-in → the workspace bootstrap → these screens. The API
// client is rebuilt whenever the current server changes (src/app-state/use-launch.ts).
// While an own server is http, the unencrypted home network line sits above every state the gate
// shows a signed-in phone (US-006h, D-HTTPS): this layout hands the bar to the gate, which draws
// it once above its own states (Not running, paused, …), the consent sheet and these screens, each
// under a safe-area provider of its own below the bar, so the bar never covers a header.
// The role stays the server's (US-007a, KC12): useSessionRefresh reads the workspace again on
// resume and after a refusal, beside the gate, so a paused or lost workspace is re-read too.
// Before any of these screens, the gate's consent step shows the AI-provider consent sheet to a
// person who can send and has not agreed to the bootstrap's providers (US-007c, KC11): the home
// thread, older chats and every Command Centre surface wait for the yes, and a list that changes
// on a later bootstrap takes the screens away until it is agreed to.
// Beside the screens, after the bootstrap and the consent step, the StyleSync the root layout hands
// in (src/styles/sync/ShellStyleSync) keeps the phone's looks and the workspace's theme in step with
// the server from launch, once for the app (US-016j).
import { Stack } from 'expo-router';

import type { Server } from '../../src/api/server';
import { AppGate } from '../../src/app-state/AppGate';
import { InsecureNetworkBanner } from '../../src/connect/components/InsecureNetworkBanner';
import { shellNetworkLine } from '../../src/connect/edges';
import { ConsentSheet } from '../../src/consent/ConsentSheet';
import { useSessionRefresh } from '../../src/session/use-session-refresh';
import { ShellStyleSync } from '../../src/styles/sync/ShellStyleSync';

/** The gate's bar: the line for an own server while it is http, never the hosted server's. */
function NetworkBar({ server }: { readonly server: Server }) {
  if (shellNetworkLine(server) === null) return null;
  return <InsecureNetworkBanner origin={server.apiUrl} placement="top" />;
}

export default function SignedInLayout() {
  useSessionRefresh();
  return (
    <AppGate consent={<ConsentSheet />} bar={NetworkBar}>
      <ShellStyleSync />
      <Stack screenOptions={{ headerShown: false }} />
    </AppGate>
  );
}
