// What notifies you and the daily digest (D22, D24): the person's own preference rows, read once for
// both. The three push types are switches for the person in this workspace on every phone; the
// digest is a switch for the person and a time for THIS phone (its device row), chosen from 07:00,
// 08:00 and 09:00 in the phone's time zone — not while the digest is off or the phone has no row —
// and, under the time where the server lists digest_now, "Send today's brief now" (DigestNowButton).
// The rows are read with the screen and every state has its words: reading, a failure with Try
// again, then the switches.

import { View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Card, Divider, ErrorState, LoadingState, SegmentedControl, Text } from '../../ui';
import type { Device, Preferences } from '../schemas/server';
import { PUSH_SETTINGS_COPY } from '../strings';
import { Section, SectionNote } from './components/Section';
import { SwitchRow } from './components/Switch';
import { DigestNowButton } from './DigestNowButton';
import { useDigestTime, usePreferences, usePushSwitches } from './use-notification-settings';
import { digestView, pushTypeRows } from './view-model';

const LINE_LEVEL = 6;
const LABEL_LEVEL = 6;

type Switches = ReturnType<typeof usePushSwitches>;

type PushTypesProps = {
  readonly preferences: Preferences;
  readonly switches: Switches;
  readonly workspaceName: string;
};

function PushTypesSection({ preferences, switches, workspaceName }: PushTypesProps) {
  const rows = pushTypeRows(preferences, switches.overrides);
  return (
    <Section title={PUSH_SETTINGS_COPY.typesSection}>
      <Card>
        {rows.map((row, index) => (
          <View key={row.key}>
            {index > 0 ? <Divider /> : null}
            <SwitchRow
              title={row.label}
              detail={row.detail}
              value={row.on}
              disabled={row.saving}
              onChange={(on) => switches.set(preferences, row.key, on)}
            />
          </View>
        ))}
      </Card>
      <SectionNote>{PUSH_SETTINGS_COPY.typesScope(workspaceName)}</SectionNote>
    </Section>
  );
}

type DigestProps = {
  readonly preferences: Preferences;
  readonly switches: Switches;
  readonly row: Device | null;
  readonly timeZone: string | null;
  readonly digestNow: boolean;
};

function DigestSection({ preferences, switches, row, timeZone, digestNow }: DigestProps) {
  const { spacing } = useTokens();
  const digestTime = useDigestTime();
  const view = digestView({
    preferences,
    row,
    timeZone,
    overrides: switches.overrides,
    pendingTime: digestTime.pendingTime,
  });
  const options = view.times.map((time) => ({ value: time, label: time }));
  return (
    <Section title={PUSH_SETTINGS_COPY.digestSection}>
      <Card>
        <SwitchRow
          title={PUSH_SETTINGS_COPY.digestLabel}
          detail={PUSH_SETTINGS_COPY.digestDetail}
          value={view.on}
          disabled={view.saving}
          onChange={(on) => switches.set(preferences, 'digest', on)}
        />
        <Divider />
        <View style={{ gap: spacing.space2, paddingVertical: spacing.space3 }}>
          <Text variant="title" level={LABEL_LEVEL}>
            {PUSH_SETTINGS_COPY.digestTimeLabel}
          </Text>
          <SegmentedControl
            options={options}
            value={view.time}
            onChange={(time) => {
              if (row) digestTime.set(row.id, time);
            }}
            accessibilityLabel={PUSH_SETTINGS_COPY.digestTimeLabel}
            disabled={view.timeDisabled}
          />
          <Text level={LINE_LEVEL} tone="muted">
            {view.zoneLine}
          </Text>
          {view.note ? (
            <Text level={LINE_LEVEL} tone="muted">
              {view.note}
            </Text>
          ) : null}
        </View>
        {digestNow ? (
          <>
            <Divider />
            <DigestNowButton />
          </>
        ) : null}
      </Card>
      <SectionNote>{view.phoneLine}</SectionNote>
    </Section>
  );
}

export type PreferenceSectionsProps = {
  readonly workspaceName: string;
  /** The digest needs the 'digest' capability as well as push. */
  readonly digest: boolean;
  /** "Send today's brief now" needs 'digest_now' as well (digestNowShown). */
  readonly digestNow: boolean;
  /** This phone's device row and time zone (usePhone). */
  readonly row: Device | null;
  readonly timeZone: string | null;
};

export function PreferenceSections({
  workspaceName,
  digest,
  digestNow,
  row,
  timeZone,
}: PreferenceSectionsProps) {
  const query = usePreferences();
  const switches = usePushSwitches();
  const preferences = query.data;
  if (!preferences) {
    if (query.isError)
      return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    return <LoadingState label={PUSH_SETTINGS_COPY.loading} inline />;
  }
  return (
    <>
      <PushTypesSection
        preferences={preferences}
        switches={switches}
        workspaceName={workspaceName}
      />
      {digest ? (
        <DigestSection
          preferences={preferences}
          switches={switches}
          row={row}
          timeZone={timeZone}
          digestNow={digestNow}
        />
      ) : null}
    </>
  );
}
