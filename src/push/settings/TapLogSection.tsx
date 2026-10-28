// Settings → Notifications → Recent notification taps: the tap log (inbound/tap-log.ts), read again
// each time the screen comes into view, as one line per tap (taps-view.ts) — what happened, what it
// was about and when — so a tap that went nowhere leaves its reason on the phone. Kept on this
// phone only; never what a notification said.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { appStorage } from '../../storage/mmkv';
import { useTokens } from '../../styles/theme';
import { Card, Text } from '../../ui';
import { tapLogOver, type TapEntry } from '../inbound/tap-log';
import { PUSH_TAPS_COPY } from '../strings';
import { Section, SectionNote } from './components/Section';
import { tapRows } from './taps-view';

const LINE_LEVEL = 6;

function readTaps(): readonly TapEntry[] {
  try {
    return tapLogOver(appStorage()).read();
  } catch {
    return [];
  }
}

/** The log, read again whenever the screen is in view (a tap may have just been handled). */
function useTaps(): readonly TapEntry[] {
  const [taps, setTaps] = useState<readonly TapEntry[]>([]);
  useFocusEffect(useCallback(() => setTaps(readTaps()), []));
  return taps;
}

export function TapLogSection() {
  const { spacing } = useTokens();
  const rows = tapRows(useTaps(), new Date());
  return (
    <Section title={PUSH_TAPS_COPY.section}>
      <Card>
        {rows.length === 0 ? (
          <Text level={LINE_LEVEL} tone="muted">
            {PUSH_TAPS_COPY.empty}
          </Text>
        ) : (
          rows.map((row) => (
            <View
              key={row.key}
              accessible
              accessibilityLabel={row.accessibilityLabel}
              style={{ gap: spacing.space1, paddingVertical: spacing.space2 }}
            >
              <Text level={LINE_LEVEL}>{row.title}</Text>
              <Text variant="mono" tone="muted">
                {row.meta}
              </Text>
            </View>
          ))
        )}
      </Card>
      <SectionNote>{PUSH_TAPS_COPY.note}</SectionNote>
    </Section>
  );
}
