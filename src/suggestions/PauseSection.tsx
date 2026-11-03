// Settings → Suggestions → "Pause suggestions" (PRD-268 §6.9, FR-13): the person's own switch in
// this workspace, with the line under it that says what a pause stops (suggestions and their
// notifications) and what it leaves alone (the daily brief, unless Daily digest is off), then the
// failure line when there is one ('Your suggestions weren't paused. Can't reach Automatos…'),
// never a crash. Shown only when discovery lists `suggestions`: an older server's Settings are
// unchanged. The switch row is the one Settings → Notifications built (src/ui has no switch
// primitive), so VoiceOver hears one switch named "Pause suggestions" with the line as its hint;
// the card and the text are src/ui's, so every style dresses them.

import { View } from 'react-native';

import { Section } from '../push/settings/components/Section';
import { SwitchRow } from '../push/settings/components/Switch';
import { useTokens } from '../styles/theme';
import { Card, Text } from '../ui';
import type { TextLevel } from '../ui/variants';
import type { PauseView } from './pause';
import { PAUSE_COPY } from './strings';
import { usePauseSwitch } from './use-pause';

const LINE_LEVEL: TextLevel = 6;

export type PauseCardProps = {
  readonly view: PauseView;
  readonly onChange: (paused: boolean) => void;
};

export function PauseCard({ view, onChange }: PauseCardProps) {
  const { spacing } = useTokens();
  return (
    <Section title={PAUSE_COPY.section}>
      <Card>
        <SwitchRow
          title={PAUSE_COPY.title}
          detail={PAUSE_COPY.detail}
          value={view.value}
          disabled={view.disabled}
          onChange={onChange}
        />
        {view.line ? (
          <View style={{ paddingBottom: spacing.space3 }}>
            <Text level={LINE_LEVEL} tone="muted" accessibilityLiveRegion="polite">
              {view.line}
            </Text>
          </View>
        ) : null}
      </Card>
    </Section>
  );
}

export function PauseSection() {
  const pause = usePauseSwitch();
  if (!pause.shown) return null;
  return <PauseCard view={pause.view} onChange={pause.setPaused} />;
}
