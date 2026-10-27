// Root layout — the app shell's providers around the router's Stack: the gesture and safe-area
// roots, the reinstall check (InstallGate: nothing that reads the keychain or the encrypted store
// mounts before it is done, KC9), the theme, the one toast, the one query cache and the sign-in
// root. The sign-in root mounts the current server's tree (US-006d): a paired own server's device
// session with no ClerkProvider, or the hosted server's Clerk, and remounts the Stack when the
// server changes. The cache's persister attaches in the signed-in gate (app/(app)/_layout.tsx),
// keyed to the person signed in, because the saved cache belongs to one person
// (src/app-state/query-root.tsx). StyleSyncSlot hands StyleSync to the signed-in layout, which
// mounts it once inside the gate (src/styles/sync/ShellStyleSync.tsx, US-016j), and EdgeScreenSlot
// holds GateEdge, the style's edge screens for the gate's error and Not running, for the signed-in
// layout to give the gate (src/styles/edges/ShellEdgeScreen.tsx). At start, the server voice's
// cache folder is swept of any MP3 a crash left (src/voice/server/speech-files.ts; never throws).
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryRoot } from '../src/app-state/query-root';
import { AuthRoot } from '../src/auth/AuthRoot';
import { initCrashReporting } from '../src/observability';
import { InstallGate } from '../src/session/InstallGate';
import { GateEdge } from '../src/styles/edges/GateEdge';
import { EdgeScreenSlot } from '../src/styles/edges/ShellEdgeScreen';
import { StyleSyncSlot } from '../src/styles/sync/ShellStyleSync';
import { StyleSync } from '../src/styles/sync/StyleSync';
import { ThemeProvider } from '../src/styles/theme';
import { ToastProvider } from '../src/ui';
import { sweepSpeechFiles } from '../src/voice/server/speech-files';

initCrashReporting();
sweepSpeechFiles();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <InstallGate>
          <ThemeProvider>
            <ToastProvider>
              <QueryRoot>
                <AuthRoot>
                  <StyleSyncSlot sync={StyleSync}>
                    <EdgeScreenSlot edge={GateEdge}>
                      <Stack screenOptions={{ headerShown: false }} />
                    </EdgeScreenSlot>
                  </StyleSyncSlot>
                </AuthRoot>
              </QueryRoot>
            </ToastProvider>
          </ThemeProvider>
        </InstallGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
