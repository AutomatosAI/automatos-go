// Settings → Account (PRD-001 §4.5, §4.7): the server section (src/connect/components/ServerSection:
// the server's name, address and edition, the unencrypted home network line, and Sign out or Forget
// this server, US-006h), then the workspace, role and app version, then Style and look (the style
// picker, US-016j). Nothing deletes an account or a workspace (D63); nothing about plans (D8).
// After them, Notifications (src/push, US-014h), Voice (Auto's voice, speed and pitch on this
// phone, src/voice/settings) and, on a hosted phone with a push record, Remove this phone (KP16; an
// own server's way out stays the server section's). The policies and the other Settings pages
// arrive with their stories.
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import AudioLines from 'lucide-react-native/icons/audio-lines';
import Bell from 'lucide-react-native/icons/bell';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import { accountRows, type AccountRow } from '../../../src/app-state/account';
import { useAppSession } from '../../../src/app-state/session';
import { ACCOUNT_COPY } from '../../../src/app-state/strings';
import { ServerSection } from '../../../src/connect/components/ServerSection';
import { useGoBack } from '../../../src/navigation/use-go-back';
import { STYLE_SCREENS } from '../../../src/styles/nav';
import { PICKER_COPY } from '../../../src/styles/strings';
import { RemovePhone } from '../../../src/push/bind/RemovePhone';
import { pushScreens } from '../../../src/push/nav';
import { PUSH_ACCOUNT_COPY } from '../../../src/push/strings';
import { PrivacySection } from '../../../src/release/components/PrivacySection';
import { useTokens } from '../../../src/styles/theme';
import { Card, Divider, IconButton, ListRow, Screen, Text } from '../../../src/ui';
import { VOICE_SCREENS } from '../../../src/voice/nav';
import { VOICE_SETTINGS_COPY } from '../../../src/voice/strings';

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
  const goBack = useGoBack();
  const router = useRouter();
  const { spacing } = useTokens();
  const rows = accountRows({ workspace, appVersion: Constants.expoConfig?.version });
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
        <ServerSection server={server} edition={discovery.edition} />
        <Card>
          {rows.map((row, index) => (
            <View key={row.label}>
              {index > 0 ? <Divider /> : null}
              <InfoRow row={row} />
            </View>
          ))}
        </Card>
        <Card>
          <ListRow
            title={PICKER_COPY.title}
            accessibilityHint={PICKER_COPY.settingsHint}
            onPress={() => router.push(STYLE_SCREENS.settingsStyle)}
          />
        </Card>
        <Card>
          <ListRow
            icon={Bell}
            title={PUSH_ACCOUNT_COPY.notifications}
            onPress={() => router.push(pushScreens.notifications)}
          />
        </Card>
        <Card>
          <ListRow
            icon={AudioLines}
            title={VOICE_SETTINGS_COPY.row}
            accessibilityHint={VOICE_SETTINGS_COPY.rowHint}
            onPress={() => router.push(VOICE_SCREENS.settings)}
          />
        </Card>
        <PrivacySection />
        <RemovePhone />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'stretch' },
});
