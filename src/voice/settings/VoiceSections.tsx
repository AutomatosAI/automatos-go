// Settings → Voice's parts: "I speak" first (the language rows, each a button that says whether it
// is the chosen one, and a note under them when there is one); with Auto's server voice, its voices (each a button that says
// whether it is the chosen one, with a check beside it) and "Use this phone's voice instead"; the
// phone's voices (Automatic, then the phone's) and the help line under them; then Speed and Pitch
// (src/ui's Slider, named, its value read out in words; Pitch gives way to a one-line reason with
// the server voice) and Reset to default. The primitives carry the style's dress (Studio, Play,
// HUD); the rows and words are view-model.ts's and server-view-model.ts's.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';

import { useTokens } from '../../styles/theme';
import { Button, Card, Divider, ListRow, Slider, Text } from '../../ui';
import { ICON_STROKE } from '../../ui/paint';
import type { LanguageRow } from '../language/language-rows';
import { LANGUAGE_COPY, VOICE_SETTINGS_COPY } from '../strings';
import type { ServerChoice, ServerVoiceRow, SoundPart } from './server-view-model';
import type { SoundKey, SoundSlider, VoiceRow } from './view-model';
import type { SpeakChoice } from './voice-setting';

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

type ChoiceRow = Pick<VoiceRow, 'key' | 'title' | 'summary' | 'selected'>;

/** The rows of a list of choices, one chosen (its check), each a button. */
function Rows<R extends ChoiceRow>(props: {
  readonly rows: readonly R[];
  readonly onPress: (row: R) => void;
  readonly hint?: string;
}) {
  return (
    <Card>
      {props.rows.map((row, index) => (
        <View key={row.key}>
          {index > 0 ? <Divider /> : null}
          <ListRow
            title={row.title}
            summary={row.summary}
            selected={row.selected}
            trailing={<Mark selected={row.selected} />}
            accessibilityHint={props.hint ?? COPY.voiceHint}
            onPress={() => props.onPress(row)}
          />
        </View>
      ))}
    </Card>
  );
}

/** A muted line under a section's rows; nothing without words. */
function Note({ text }: { readonly text: string | null | undefined }) {
  if (!text) return null;
  return (
    <Text level={NOTE_LEVEL} tone="muted">
      {text}
    </Text>
  );
}

export type LanguageListProps = {
  readonly rows: readonly LanguageRow[];
  readonly note?: string | null;
  readonly onChoose: (choice: SpeakChoice) => void;
};

/** "I speak": Automatic, English and the two Portuguese, one chosen. */
export function LanguageList({ rows, note, onChoose }: LanguageListProps) {
  return (
    <Titled title={LANGUAGE_COPY.section}>
      <Rows rows={rows} hint={LANGUAGE_COPY.rowHint} onPress={(row) => onChoose(row.key)} />
      <Note text={note} />
    </Titled>
  );
}

export type ServerVoiceListProps = {
  readonly rows: readonly ServerVoiceRow[];
  /** Above the rows: why the language's voice is what it is (Portuguese (Portugal)); or none. */
  readonly note?: string | null;
  readonly onChoose: (choice: ServerChoice) => void;
};

/** "Auto's voice" with the server voice: the server's voices, then this phone's. */
export function ServerVoiceList({ rows, note, onChoose }: ServerVoiceListProps) {
  return (
    <Titled title={COPY.voiceSection}>
      <Note text={note} />
      <Rows rows={rows} onPress={(row) => onChoose(row.choice)} />
    </Titled>
  );
}

export type VoiceListProps = {
  readonly title: string;
  readonly rows: readonly VoiceRow[];
  readonly help: string;
  readonly onChoose: (voice: string | null) => void;
};

export function VoiceList({ title, rows, help, onChoose }: VoiceListProps) {
  return (
    <Titled title={title}>
      <Rows rows={rows} onPress={(row) => onChoose(row.voice)} />
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
  readonly sound: SoundPart;
  readonly resetHint: string;
  readonly onReset: () => void;
};

export function SoundSection({ sound, resetHint, onSlide, onRelease, onReset }: SoundSectionProps) {
  const { spacing } = useTokens();
  return (
    <Titled title={sound.title}>
      <Card>
        <View style={{ gap: spacing.space5 }}>
          {sound.sliders.map((slider) => (
            <Sound key={slider.key} slider={slider} onSlide={onSlide} onRelease={onRelease} />
          ))}
          {sound.note === null ? null : (
            <Text level={NOTE_LEVEL} tone="muted">
              {sound.note}
            </Text>
          )}
        </View>
      </Card>
      <Button
        label={COPY.reset}
        variant="outline"
        onPress={onReset}
        accessibilityHint={resetHint}
      />
    </Titled>
  );
}

const styles = StyleSheet.create({
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
