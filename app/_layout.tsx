// Root layout — the gesture and safe-area roots, the theme and the sign-in root around the router's
// Stack. The rest of the shell (toasts, the query cache, the signed-in gate) arrives with FND-4.
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthRoot } from '../src/auth/AuthRoot';
import { ThemeProvider } from '../src/styles/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthRoot>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthRoot>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
