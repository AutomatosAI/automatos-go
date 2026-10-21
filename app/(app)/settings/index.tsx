// Settings → Account, the stub (PRD-001 §4.5, §4.7): the server, edition, workspace, role and app
// version, and Sign out. Nothing deletes an account or a workspace (D63); nothing about plans
// (D8). Remove this phone, the policies and the other Settings pages arrive with their stories.
import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import { accountRows, type AccountRow } from '../../../src/app-state/account';
import { useAppSession } from '../../../src/app-state/session';
import { ACCOUNT_COPY, SHELL_COPY } from '../../../src/app-state/strings';
import { useSignOut } from '../../../src/app-state/use-sign-out';
import { useGoBack } from '../../../src/navigation/use-go-back';
import { useTokens } from '../../../src/styles/theme';
import { Button, Card, Divider, IconButton, Screen, Text } from '../../../src/ui';

const TITLE_LEVEL = 2;
const VALUE_LEVEL = 2;

function InfoRow({ row }: { readonly row: AccountRow }) {
  const { spacing } = useTokens();
  return (
    <View
      style={{ gap: spacing.space1, paddingVertical: spacing.space3 }}
      accessible
      accessibilityLabel={`${row.label}: ${row.value}`}
    >
      <Text variant="eyebrow">{row.label}</Text>
      <Text level={VALUE_LEVEL}>{row.value}</Text>
    </View>
  );
}

export default function AccountSettings() {
  const { server, discovery, workspace } = useAppSession();
  const { signOut, busy } = useSignOut();
  const goBack = useGoBack();
  const { spacing } = useTokens();
  const rows = accountRows({
    server,
    discovery,
    workspace,
    appVersion: Constants.expoConfig?.version,
  });
  return (
    <Screen scroll padding="space9">
      <View style={[styles.column, { gap: spacing.space6 }]}>
        <IconButton icon={ChevronLeft} accessibilityLabel={ACCOUNT_COPY.back} onPress={goBack} />
        <View style={{ gap: spacing.space3 }}>
          <Text variant="eyebrow">{ACCOUNT_COPY.eyebrow}</Text>
          <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
            {ACCOUNT_COPY.title}
          </Text>
        </View>
        <Card>
          {rows.map((row, index) => (
            <View key={row.label}>
              {index > 0 ? <Divider /> : null}
              <InfoRow row={row} />
            </View>
          ))}
        </Card>
        <Button label={SHELL_COPY.signOut} variant="outline" onPress={signOut} busy={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'stretch' },
});
