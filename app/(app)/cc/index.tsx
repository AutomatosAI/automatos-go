// Command Centre placeholder (K5) — A3 replaces it with the Board (routes.cc.board, US-010).
import { StyleSheet, View } from 'react-native';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';

import { PLACEHOLDER_COPY } from '../../../src/app-state/strings';
import { useGoBack } from '../../../src/navigation/use-go-back';
import { useTokens } from '../../../src/styles/theme';
import { Button, EmptyState, Screen } from '../../../src/ui';

export default function CommandCentrePlaceholder() {
  const goBack = useGoBack();
  const { spacing } = useTokens();
  return (
    <Screen scroll>
      <View style={[styles.centre, { gap: spacing.space3, padding: spacing.space9 }]}>
        <EmptyState
          icon={LayoutDashboard}
          title={PLACEHOLDER_COPY.ccTitle}
          message={PLACEHOLDER_COPY.ccMessage}
        />
        <Button label={PLACEHOLDER_COPY.back} variant="outline" onPress={goBack} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
});
