// Settings → Notifications (PRD-001 §4.7; the handoff §3 with D19, D21, D22 and D24 over it): the
// head, this phone's state in plain words with its one button, then what notifies you and the
// daily digest (where the server pushes), question text (likewise), Face ID before approve or
// answer (always), and Recent notification taps (what became of the last taps, from the phone's
// own tap log). Every section reads and writes through its own hooks; the words are view-model.ts's
// and taps-view.ts's. Back returns to Settings, or opens it when this screen was opened first.

import { StyleSheet, View } from 'react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import { useAppSession } from '../../app-state/session';
import { routes } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { useTokens } from '../../styles/theme';
import { IconButton, Screen, Text } from '../../ui';
import { PUSH_SETTINGS_COPY } from '../strings';
import { Section } from './components/Section';
import { PhoneStatus } from './PhoneStatus';
import { PreferenceSections } from './PreferenceSections';
import { FaceIdSection, QuestionTextSection } from './PrivacySections';
import { TapLogSection } from './TapLogSection';
import { usePhone } from './use-phone';
import { screenHead, sectionsShown } from './view-model';

const TITLE_LEVEL = 2;
const LEDE_LEVEL = 3;

function Head({ workspaceName }: { readonly workspaceName: string }) {
  const { spacing } = useTokens();
  const head = screenHead(workspaceName);
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="eyebrow">{head.eyebrow}</Text>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {head.title}
      </Text>
      <Text level={LEDE_LEVEL} tone="muted">
        {head.lede}
      </Text>
    </View>
  );
}

export function NotificationsScreen() {
  const { discovery, workspace } = useAppSession();
  const goBack = useGoBack(routes.settings);
  const { spacing } = useTokens();
  const shown = sectionsShown(discovery);
  const phone = usePhone();
  return (
    <Screen scroll padding="space9">
      <View style={[styles.column, { gap: spacing.space6 }]}>
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel={PUSH_SETTINGS_COPY.back}
          onPress={goBack}
        />
        <Head workspaceName={workspace.name} />
        <Section title={PUSH_SETTINGS_COPY.phoneSection}>
          <PhoneStatus view={phone.view} busy={phone.busy} onAction={(a) => void phone.act(a)} />
        </Section>
        {shown.pushTypes ? (
          <PreferenceSections
            workspaceName={workspace.name}
            digest={shown.digest}
            digestNow={shown.digestNow}
            row={phone.row}
            timeZone={phone.timeZone}
          />
        ) : null}
        {shown.redact ? <QuestionTextSection /> : null}
        <FaceIdSection />
        <TapLogSection />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'stretch' },
});
