// Root layout — the app shell's providers around the router's Stack: the gesture and safe-area
// roots, the reinstall check (InstallGate: nothing that reads the keychain or the encrypted store
// mounts before it is done, KC9), the theme, the one toast, the one query cache and the sign-in
// root. The sign-in root mounts the current server's tree (US-006d): a paired own server's device
// session with no ClerkProvider, or the hosted server's Clerk, and remounts the Stack when the
// server changes. The cache's persister attaches in the signed-in gate (app/(app)/_layout.tsx),
// keyed to the person signed in, because the saved cache belongs to one person
// (src/app-state/query-root.tsx).
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryRoot } from '../src/app-state/query-root';
import { AuthRoot } from '../src/auth/AuthRoot';
import { InstallGate } from '../src/session/InstallGate';
import { ThemeProvider } from '../src/styles/theme';
import { ToastProvider } from '../src/ui';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <InstallGate>
          <ThemeProvider>
            <ToastProvider>
              <QueryRoot>
                <AuthRoot>
                  <Stack screenOptions={{ headerShown: false }} />
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
