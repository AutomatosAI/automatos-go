// Settings → Voice's two parts: the voices (Automatic, then the phone's, each a button that says
// whether it is the chosen one, with a check beside it) and the help line under them; then Speed
// and Pitch (src/ui's Slider, named, its value read out in words) and Reset to default. The primitives
// carry the style's dress (Studio, Play, HUD); the rows and words are view-model.ts's.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';

import { useTokens } from '../../styles/theme';
import { Button, Card, Divider, ListRow, Slider, Text } from '../../ui';
import { ICON_STROKE } from '../../ui/paint';
import { VOICE_SETTINGS_COPY } from '../strings';
import type { SoundKey, SoundSlider, VoiceRow } from './view-model';

const COPY = VOICE_SETTINGS_COPY;
const MARK_SIZE = 18;
const NOTE_LEVEL = 6;
const SLIDER_LABEL_LEVEL = 4;

function Titled({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="eyebrow" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** The chosen row's check; the same room on the others, so no row shows a chevron. */
function Mark({ selected }: { readonly selected: boolean }) {
  const { colours } = useTokens();
  if (!selected) return <View style={styles.mark} />;
  return <Check size={MARK_SIZE} color={colours.primary} strokeWidth={ICON_STROKE} />;
}

export type VoiceListProps = {
  readonly rows: readonly VoiceRow[];
  readonly help: string;
  readonly onChoose: (voice: string | null) => void;
};

export function VoiceList({ rows, help, onChoose }: VoiceListProps) {
  return (
    <Titled title={COPY.voiceSection}>
      <Card>
        {rows.map((row, index) => (
          <View key={row.key}>
            {index > 0 ? <Divider /> : null}
            <ListRow
              title={row.title}
              summary={row.summary}
              selected={row.selected}
              trailing={<Mark selected={row.selected} />}
              accessibilityHint={COPY.voiceHint}
              onPress={() => onChoose(row.voice)}
            />
          </View>
        ))}
      </Card>
      <Text level={NOTE_LEVEL} tone="muted">
        {help}
      </Text>
    </Titled>
  );
}

type SoundProps = {
  readonly onSlide: (key: SoundKey, value: number) => void;
  readonly onRelease: (key: SoundKey, value: number) => void;
};

function Sound({ slider, onSlide, onRelease }: SoundProps & { readonly slider: SoundSlider }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space2 }}>
      <View style={styles.between}>
        <Text level={SLIDER_LABEL_LEVEL}>{slider.label}</Text>
        {/* VoiceOver hears the value from the slider, in words */}
        <Text
          level={SLIDER_LABEL_LEVEL}
          tone="muted"
          accessible={false}
          importantForAccessibility="no"
        >
          {slider.shown}
        </Text>
      </View>
      <Slider
        value={slider.value}
        min={slider.min}
        max={slider.max}
        step={slider.step}
        onChange={(value) => onSlide(slider.key, value)}
        onChangeEnd={(value) => onRelease(slider.key, value)}
        accessibilityLabel={slider.label}
        valueText={slider.words}
      />
    </View>
  );
}

export type SoundSectionProps = SoundProps & {
  readonly sliders: readonly SoundSlider[];
  readonly onReset: () => void;
};

export function SoundSection({ sliders, onSlide, onRelease, onReset }: SoundSectionProps) {
  const { spacing } = useTokens();
  return (
    <Titled title={COPY.soundSection}>
      <Card>
        <View style={{ gap: spacing.space5 }}>
          {sliders.map((slider) => (
            <Sound key={slider.key} slider={slider} onSlide={onSlide} onRelease={onRelease} />
          ))}
        </View>
      </Card>
      <Button
        label={COPY.reset}
        variant="outline"
        onPress={onReset}
        accessibilityHint={COPY.resetHint}
      />
    </Titled>
  );
}

const styles = StyleSheet.create({
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
