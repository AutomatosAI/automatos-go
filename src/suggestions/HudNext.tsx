// HUD's NEXT line (PRD-268 §6.12.5, US-G01): the newest open suggestion in the top bar's status row,
// '▸ NEXT' in the accent, its title in text (wrapped to two lines, then cut) and START and HIDE in
// HUD's 1 pt accent lines; never above TYPE · HOLD TO TALK (no room there on a 375 × 667 phone).
// One element to VoiceOver ('Next: <title>') with Start and Hide as its actions, as the card is.
// 'Started. Auto is on it.' takes its place for 4 s. Never spoken. Nothing where discovery does not
// list `suggestions`, or when none is open.

import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { HUD_CORE } from '../styles/hud/core/model';
import { useVoiceCore, type VoiceCore } from '../styles/hud/core/use-voice-core';
import { Text } from '../ui';
import { hitSlopFor } from '../ui/paint';
import { suggestionView, type SuggestionView } from './model';
import { suggestionAccessibility } from './SuggestionCard';
import { SUGGESTION_COPY } from './strings';
import {
  useOpenSuggestions,
  useSuggestionActions,
  type SuggestionActions,
} from './use-suggestions';

const { statusRow, commandRow, tracking } = HUD_CORE;
const TITLE_LINES = 2;

type HudButtonProps = {
  readonly core: VoiceCore;
  readonly text: string;
  readonly onPress: () => void;
  /** Starting (Face ID, then the call): dimmed and not pressable (§6.12.3 'starting'). */
  readonly busy?: boolean;
};

/** A busy button's opacity, as the foundation's Button dims one. */
const BUSY_OPACITY = 0.5;

function HudButton({ core, text, onPress, busy = false }: HudButtonProps): ReactNode {
  const face = core.style.type.mono(HUD_CORE.monoSize, 600, { trackingEm: tracking.row });
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityState={{ busy, disabled: busy }}
      hitSlop={hitSlopFor(commandRow.height)}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: commandRow.height,
          paddingHorizontal: commandRow.padItem,
          borderWidth: commandRow.border,
          borderColor: core.paint.accent,
          backgroundColor: pressed ? core.paint.accentFill : undefined,
          opacity: busy ? BUSY_OPACITY : 1,
        },
      ]}
    >
      <Text style={[face, { color: core.paint.accent }]}>{text}</Text>
    </Pressable>
  );
}

const PAD = Object.freeze({ paddingVertical: statusRow.padY, paddingHorizontal: statusRow.padX });

function monoFace(core: VoiceCore) {
  return core.style.type.mono(HUD_CORE.monoSize, 500, { trackingEm: tracking.mono });
}

type LineProps = {
  readonly core: VoiceCore;
  readonly view: SuggestionView;
  readonly actions: SuggestionActions;
};

/** '▸ NEXT', the title, START and HIDE; the refusal's one line under it. */
function NextLine({ core, view, actions }: LineProps) {
  const mono = monoFace(core);
  const refused = actions.refusal?.id === view.id ? actions.refusal.text : null;
  const a11y = suggestionAccessibility({ view, actions });
  return (
    <View style={PAD}>
      <View
        style={[styles.row, { gap: commandRow.gap }]}
        {...a11y}
        accessibilityLabel={
          refused
            ? `${SUGGESTION_COPY.hud.nextLabel(view.title)}. ${refused}`
            : SUGGESTION_COPY.hud.nextLabel(view.title)
        }
      >
        <Text style={[mono, { color: core.paint.accent }]}>{SUGGESTION_COPY.hud.next}</Text>
        <Text
          numberOfLines={TITLE_LINES}
          style={[
            core.style.type.body(HUD_CORE.rowSize, 400),
            styles.title,
            { color: core.paint.text },
          ]}
        >
          {view.title}
        </Text>
        {actions.allowed ? (
          <>
            <HudButton
              core={core}
              text={SUGGESTION_COPY.hud.start}
              onPress={() => actions.start(view)}
              busy={actions.busyId === view.id}
            />
            <HudButton
              core={core}
              text={SUGGESTION_COPY.hud.hide}
              onPress={() => actions.hide(view)}
            />
          </>
        ) : null}
      </View>
      {refused ? <Text style={[mono, { color: core.paint.text2 }]}>{refused}</Text> : null}
    </View>
  );
}

export function HudNext() {
  const core = useVoiceCore();
  const { offered, open } = useOpenSuggestions();
  const actions = useSuggestionActions();
  const { started } = actions;
  useEffect(() => {
    if (started) AccessibilityInfo.announceForAccessibility(SUGGESTION_COPY.started);
  }, [started]);
  const newest = open[0];
  if (!offered) return null;
  if (started) {
    return (
      <View style={PAD}>
        <Text style={[monoFace(core), { color: core.paint.accent }]}>
          {SUGGESTION_COPY.started}
        </Text>
      </View>
    );
  }
  return newest ? <NextLine core={core} view={suggestionView(newest)} actions={actions} /> : null;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, minWidth: 0 },
  button: { alignItems: 'center', justifyContent: 'center' },
});
