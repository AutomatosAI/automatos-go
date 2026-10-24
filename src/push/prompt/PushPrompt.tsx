// The in-context ask (PRD-001 §4.8, KP11): the foundation's Sheet, offered by policy.ts once
// something waits for the person or from the second session on — never the OS prompt by itself.
// 'Turn on' is the person's tap: the OS asks (askPermission), then the phone registers. 'Not now'
// (or closing the sheet) is a decline: it holds the ask back a week, and after two only Settings →
// Notifications offers it. Shown at most once a session. The counters are memory.ts's (MMKV:
// numbers and dates only).

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useNeedsYou } from '../../api/needs-you';
import { logger } from '../../lib/logger';
import { useTokens } from '../../styles/theme';
import { Button, Sheet, Text } from '../../ui';
import type { PushStatus } from '../registration/state';
import { PUSH_TYPE_SWITCHES } from '../settings/prefs';
import { PUSH_PROMPT_COPY, PUSH_TYPE_COPY } from '../strings';
import type { PromptCounts } from './memory';
import { offerPrompt } from './policy';

const TITLE_LEVEL = 4;
const LINE_LEVEL = 3;
const DETAIL_LEVEL = 5;
const LABEL_WEIGHT = 500;

export type PushPromptProps = {
  /** This phone's status (the registrar's last answer); null before the first run ends. */
  readonly status: PushStatus | null;
  /** This session's counters, counted once (PushRoot). */
  readonly counts: PromptCounts;
  /** 'Not now': PushRoot notes the decline (memory.ts) and hands back the new counters. */
  readonly onDecline: () => void;
  /** Asks the OS, then registers; the status that follows closes the ask. */
  readonly onTurnOn: () => Promise<void>;
};

function PushTypeLines() {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      {PUSH_TYPE_SWITCHES.map((key) => (
        <View key={key}>
          <Text level={LINE_LEVEL} weight={LABEL_WEIGHT}>
            {PUSH_TYPE_COPY[key].label}
          </Text>
          <Text level={DETAIL_LEVEL} tone="muted">
            {PUSH_TYPE_COPY[key].detail}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function PushPrompt({ status, counts, onDecline, onTurnOn }: PushPromptProps) {
  const { spacing } = useTokens();
  const { total } = useNeedsYou();
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const offered = offerPrompt({
    status,
    sessionCount: counts.sessions,
    needsYouTotal: total,
    lastDeclinedAt: counts.lastDeclinedAt,
    declines: counts.declines,
    now: Date.now(),
  });
  const decline = () => {
    if (busy) return;
    setClosed(true);
    onDecline();
  };
  const turnOn = async () => {
    setBusy(true);
    try {
      await onTurnOn();
    } catch {
      logger.warn('[push] turning notifications on from the ask failed');
    } finally {
      setBusy(false);
      setClosed(true);
    }
  };
  return (
    <Sheet visible={offered && !closed} onClose={decline}>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {PUSH_PROMPT_COPY.title}
      </Text>
      <PushTypeLines />
      <View style={[styles.actions, { gap: spacing.space3 }]}>
        <Button
          label={PUSH_PROMPT_COPY.notNow}
          onPress={decline}
          variant="outline"
          disabled={busy}
        />
        <Button label={PUSH_PROMPT_COPY.turnOn} onPress={() => void turnOn()} busy={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
