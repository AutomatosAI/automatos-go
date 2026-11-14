// Settings → Voice's Timing block (voice latency A-5): the last voice reply's readings as this phone
// measured them (voice-timing.ts timingRows), its reference, and Share timings, which hands the
// kept turns' lines (numbers and references, never words) to the phone's share sheet: the person's
// own act. VoiceSettingsScreen.tsx mounts it only where use-timing.ts timingShown() says so.

import { Share, StyleSheet, View } from 'react-native';

import { logger } from '../../lib/logger';
import { useTokens } from '../../styles/theme';
import { Button, Card, Text } from '../../ui';
import { VOICE_TIMING_COPY } from '../strings';
import { useTimings } from './use-timing';
import { timingLine, timingRows, type TurnTiming } from './voice-timing';

const COPY = VOICE_TIMING_COPY;
const NOTE_LEVEL = 6;
const ROW_LEVEL = 4;

function share(turns: readonly TurnTiming[]): void {
  Share.share({ message: turns.map(timingLine).join('\n') }).catch((error: unknown) =>
    logger.warn('[voice] the timings were not shared', error),
  );
}

/** One reading: its label and its value, read out as one line. */
function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.between} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text level={ROW_LEVEL} style={styles.label}>
        {label}
      </Text>
      <Text level={ROW_LEVEL} tone="muted">
        {value}
      </Text>
    </View>
  );
}

function Readings({ turn }: { readonly turn: TurnTiming }) {
  const { spacing } = useTokens();
  return (
    <Card>
      <View style={{ gap: spacing.space3 }}>
        {timingRows(turn).map((row) => (
          <Row
            key={row.label}
            label={row.label}
            value={row.ms === null ? COPY.missing : COPY.milliseconds(row.ms)}
          />
        ))}
        <Row label={COPY.reference} value={turn.ref} />
      </View>
    </Card>
  );
}

export function TimingBlock() {
  const { spacing } = useTokens();
  const turns = useTimings();
  const last = turns[0];
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="eyebrow" accessibilityRole="header">
        {COPY.title}
      </Text>
      <Text level={NOTE_LEVEL} tone="muted">
        {last === undefined ? COPY.empty : COPY.hint}
      </Text>
      {last === undefined ? null : <Readings turn={last} />}
      {last === undefined ? null : (
        <Button label={COPY.share} variant="outline" onPress={() => share(turns)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { flexShrink: 1 },
});
