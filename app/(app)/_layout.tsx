// The signed-in group: every screen here opens only through the gate (src/app-state/AppGate.tsx,
// its decision in gate.ts): connected nowhere → /welcome; a paired server without a token, or one
// that refused it → /connect with that server; signed in → discovery (an own server that does not
// answer: Not running) → a supported sign-in → the workspace bootstrap → these screens. The API
// client is rebuilt whenever the current server changes (src/app-state/use-launch.ts).
// While the server is http, the unencrypted home network line sits above every screen (US-006h,
// D-HTTPS): the bar takes the top safe area, and the screens get their own safe-area provider
// below it, so a screen's top inset starts under the bar and the bar never covers its header.
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppGate } from '../../src/app-state/AppGate';
import { useAppSession } from '../../src/app-state/session';
import { InsecureNetworkBanner } from '../../src/connect/components/InsecureNetworkBanner';

function SignedInScreens() {
  const { server } = useAppSession();
  return (
    <View style={styles.fill}>
      <InsecureNetworkBanner origin={server.apiUrl} placement="top" />
      <SafeAreaProvider style={styles.fill}>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </View>
  );
}

export default function SignedInLayout() {
  return (
    <AppGate>
      <SignedInScreens />
    </AppGate>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
