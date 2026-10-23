// The signed-out group: loading while Clerk reads its stored client, home once a session is active
// (a returning user, or a sign-in that just completed), otherwise the sign-in screens. Mounted only
// under AuthRoot with a key configured, so useAuthSession() always has a session to read.
import { Redirect, Stack } from 'expo-router';

import { useAuthSession } from '../../src/auth/AuthRoot';
import { routes } from '../../src/navigation/routes';
import { LoadingState, Screen } from '../../src/ui';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuthSession();
  if (!isLoaded) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (isSignedIn) return <Redirect href={routes.home} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
