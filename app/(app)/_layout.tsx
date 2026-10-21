// The signed-in group: every screen here opens only through the gate (src/app-state/AppGate.tsx,
// its decision in gate.ts): not configured → the honest state; signed out → /sign-in; signed in →
// discovery → a supported sign-in → the workspace bootstrap → these screens.
import { Stack } from 'expo-router';

import { AppGate } from '../../src/app-state/AppGate';

export default function SignedInLayout() {
  return (
    <AppGate>
      <Stack screenOptions={{ headerShown: false }} />
    </AppGate>
  );
}
