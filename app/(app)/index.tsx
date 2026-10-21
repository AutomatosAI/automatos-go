// Home placeholder (K5) — the Auto thread with the needs strip replaces it (A2, US-008). Until then
// it opens the Command Centre and Settings so the shell can be walked on a device.
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Settings from 'lucide-react-native/icons/settings';

import { PLACEHOLDER_COPY } from '../../src/app-state/strings';
import { routes } from '../../src/navigation/routes';
import { useTokens } from '../../src/styles/theme';
import { Button, EmptyState, Screen } from '../../src/ui';

export default function HomePlaceholder() {
  const router = useRouter();
  const { spacing } = useTokens();
  return (
    <Screen scroll>
      <View style={[styles.centre, { gap: spacing.space3, padding: spacing.space9 }]}>
        <EmptyState
          icon={MessageCircle}
          title={PLACEHOLDER_COPY.homeTitle}
          message={PLACEHOLDER_COPY.homeMessage}
        />
        <Button
          label={PLACEHOLDER_COPY.openCommandCentre}
          icon={LayoutDashboard}
          onPress={() => router.push(routes.cc.board)}
        />
        <Button
          label={PLACEHOLDER_COPY.openSettings}
          icon={Settings}
          variant="outline"
          onPress={() => router.push(routes.settings)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
});
