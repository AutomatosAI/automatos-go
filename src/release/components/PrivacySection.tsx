// Settings → Privacy & legal (US-021d; R03, R04): the privacy policy, the Terms and support in the
// system browser, the 'Send crash reports' switch (src/observability, KR7), the test report while
// it is on (confirmed in a toast) and the version with the code the app runs. The rows are
// privacy-section.ts's; the row, card and divider are src/ui's, so every style dresses them. src/ui
// has no switch primitive: the switch row is the one Settings → Notifications built (src/push), so
// the app has one. Nothing deletes an account or a workspace (D63); nothing commercial (D8).

import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { View } from 'react-native';
import ExternalLink from 'lucide-react-native/icons/external-link';

import { logger } from '../../lib/logger';
import { crashReportsEnabled, sendTestReport, setCrashReportsEnabled } from '../../observability';
import { Section } from '../../push/settings/components/Section';
import { SwitchRow } from '../../push/settings/components/Switch';
import { useTokens } from '../../styles/theme';
import { Button, Card, Divider, ListRow, useToast } from '../../ui';
import { ICON_STROKE } from '../../ui/paint';
import { privacySectionRows, type PrivacyRow } from '../privacy-section';
import { PRIVACY_COPY } from '../strings';
import { useOpenPage } from './use-open-page';

const OUT_ICON_SIZE = 16;

/**
 * The binary's facts: app.json's version (as the crash reports name the release), the iOS
 * CFBundleVersion (Android reports none) and the downloaded update it runs, if any.
 */
const BUILD = Object.freeze({
  appVersion: Constants.expoConfig?.version ?? null,
  buildNumber: Constants.platform?.ios?.buildNumber ?? null,
  updateId: Updates.isEmbeddedLaunch ? null : Updates.updateId,
});

type RowActions = {
  readonly openPage: (url: string) => void;
  readonly setCrashOn: (on: boolean) => void;
  readonly sendTest: () => void;
};

/** The arrow that says a row leaves the app. */
function OpensOut() {
  const { colours } = useTokens();
  return (
    <ExternalLink size={OUT_ICON_SIZE} color={colours.mutedForeground} strokeWidth={ICON_STROKE} />
  );
}

function TestReportRow({
  title,
  onPress,
}: {
  readonly title: string;
  readonly onPress: () => void;
}) {
  const { spacing } = useTokens();
  return (
    <View style={{ paddingVertical: spacing.space3, alignItems: 'flex-start' }}>
      <Button
        label={title}
        onPress={onPress}
        variant="outline"
        size="sm"
        accessibilityHint={PRIVACY_COPY.testReportHint}
      />
    </View>
  );
}

function PrivacyRowView({
  row,
  actions,
}: {
  readonly row: PrivacyRow;
  readonly actions: RowActions;
}) {
  switch (row.kind) {
    case 'link':
      return (
        <ListRow
          title={row.title}
          trailing={<OpensOut />}
          accessibilityHint={PRIVACY_COPY.opensInBrowser}
          onPress={() => actions.openPage(row.url)}
        />
      );
    case 'switch':
      return (
        <SwitchRow
          title={row.title}
          detail={row.detail}
          note={row.note}
          value={row.on}
          onChange={actions.setCrashOn}
        />
      );
    case 'action':
      return <TestReportRow title={row.title} onPress={actions.sendTest} />;
    case 'info':
      return <ListRow title={row.title} summary={row.value} />;
  }
}

export function PrivacySection() {
  const toast = useToast();
  const openPage = useOpenPage();
  const [crashOn, setCrashOnState] = useState(crashReportsEnabled);
  const rows = privacySectionRows({ crashOn, ...BUILD });
  const actions: RowActions = {
    openPage,
    setCrashOn: (on) => {
      setCrashOnState(on);
      setCrashReportsEnabled(on).catch((error: unknown) => {
        logger.warn('[crash-reports] the switch did not apply', error);
      });
    },
    sendTest: () =>
      toast.show(sendTestReport() ? PRIVACY_COPY.testReportSent : PRIVACY_COPY.testReportNotSent),
  };
  return (
    <Section title={PRIVACY_COPY.title}>
      <Card>
        {rows.map((row, index) => (
          <View key={row.id}>
            {index > 0 ? <Divider /> : null}
            <PrivacyRowView row={row} actions={actions} />
          </View>
        ))}
      </Card>
    </Section>
  );
}
