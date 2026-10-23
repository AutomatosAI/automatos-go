// The signed-in group: every screen here opens only through the gate (src/app-state/AppGate.tsx,
// its decision in gate.ts): connected nowhere → /welcome; a paired server without a token, or one
// that refused it → /connect with that server; signed in → discovery (an own server that does not
// answer: Not running) → a supported sign-in → the workspace bootstrap → these screens. The API
// client is rebuilt whenever the current server changes (src/app-state/use-launch.ts).
import { Stack } from 'expo-router';

import { AppGate } from '../../src/app-state/AppGate';

export default function SignedInLayout() {
  return (
    <AppGate>
      <Stack screenOptions={{ headerShown: false }} />
    </AppGate>
  );
}
