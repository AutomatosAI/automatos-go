// Auto's suggestions under Arcade's status bar (PRD-268 §6.12.5, US-G01; D-ARC-7), the counterpart
// of HUD's IDEAS · N and NEXT ▸ (next.ts decides each): the 'IDEAS · N' chip, an ArcadeButton that
// opens the sheet of them all (useIdeas().sheet, mounted by the home), then the NEXT line: '▶ NEXT'
// in the label face, the newest open suggestion's title in Pixelify Sans (two lines, then cut) and
// START and HIDE as ArcadeButtons, START dimmed while Face ID asks. The line is one element to
// VoiceOver ('Next: <title>') with Start and Hide as its actions, as the card and HUD's line are.
// 'Started. Auto is on it.' takes its place for 4 s, said aloud to VoiceOver, with the story's ★ for
// what was done; never a status colour, never the accent for one. Nothing where discovery does not
// list `suggestions`, or when none is open.

import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { suggestionAccessibility } from '../../../suggestions/SuggestionCard';
import { SUGGESTION_COPY } from '../../../suggestions/strings';
import {
  useOpenSuggestions,
  useSuggestionActions,
  type SuggestionActions,
} from '../../../suggestions/use-suggestions';
import type { SuggestionView } from '../../../suggestions/model';
import { Text } from '../../../ui';
import { ARCADE_HOME_COPY } from '../../strings';
import { ArcadeButton } from '../parts/ArcadeButton';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { arcadeNext, ideasChip, nextLabel, nextWord, refusalFor, type IdeasButton } from './next';

/** The strip under the status bar: the console's sides, 8 between its pieces; the title's room. */
const NEXT = Object.freeze({ padH: 12, padTop: 8, gap: 8, size: 15, titleLines: 2, title: 120 });

type LineProps = { readonly view: SuggestionView; readonly actions: SuggestionActions };

/** '▶ NEXT', the title, START and HIDE; a refused Start's one line under it. */
function NextLine({ view, actions }: LineProps) {
  const { vars, type } = useArcadePaint();
  const refused = refusalFor(actions.refusal, view.id);
  const words = type.body(NEXT.size);
  return (
    <View style={styles.piece}>
      <View
        style={styles.row}
        {...suggestionAccessibility({ view, actions })}
        accessibilityLabel={nextLabel(view, refused)}
      >
        <Text style={[type.label, { color: vars.ac }]}>{nextWord()}</Text>
        <Text numberOfLines={NEXT.titleLines} style={[words, styles.title, { color: vars.tx }]}>
          {view.title}
        </Text>
        {actions.allowed ? (
          <>
            <ArcadeButton
              kind="primary"
              label={SUGGESTION_COPY.start}
              accessibilityLabel={view.startLabel}
              hint={SUGGESTION_COPY.startHint}
              busy={actions.busyId === view.id}
              onPress={() => actions.start(view)}
            />
            <ArcadeButton
              label={SUGGESTION_COPY.hide}
              accessibilityLabel={view.hideLabel}
              onPress={() => actions.hide(view)}
            />
          </>
        ) : null}
      </View>
      {refused ? <Text style={[words, { color: vars.tx2 }]}>{refused}</Text> : null}
    </View>
  );
}

/** 'Started. Auto is on it.' in the line's place, after the story's ★ (hidden from VoiceOver). */
function StartedLine() {
  const { vars, type } = useArcadePaint();
  return (
    <View style={[styles.piece, styles.row]}>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[type.label, { color: vars.mp }]}
      >
        {ARCADE_HOME_COPY.event}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        accessibilityRole="text"
        style={[type.body(NEXT.size), styles.title, { color: vars.tx }]}
      >
        {SUGGESTION_COPY.started}
      </Text>
    </View>
  );
}

/** HUD's NEXT ▸ in Arcade's dress: the newest open suggestion, START and HIDE. */
export function ArcadeNext() {
  const { offered, open } = useOpenSuggestions();
  const actions = useSuggestionActions();
  const { started } = actions;
  useEffect(() => {
    if (started) AccessibilityInfo.announceForAccessibility(SUGGESTION_COPY.started);
  }, [started]);
  const shown = arcadeNext({ offered, open, started: started !== null });
  if (shown.kind === 'none') return null;
  if (shown.kind === 'started') return <StartedLine />;
  return <NextLine view={shown.view} actions={actions} />;
}

export type ArcadeIdeasProps = {
  /** useIdeas().button: the chip shows while it is there. */
  readonly button: IdeasButton;
};

/** Under the status bar: 'IDEAS · N' (opening the sheet the home mounts), then the NEXT line. */
export function ArcadeIdeas({ button }: ArcadeIdeasProps) {
  const chip = ideasChip(button);
  return (
    <View style={styles.strip}>
      {chip ? (
        <View style={styles.piece}>
          <ArcadeButton label={chip.text} accessibilityLabel={chip.label} onPress={chip.onPress} />
        </View>
      ) : null}
      <ArcadeNext />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: NEXT.padH },
  piece: { paddingTop: NEXT.padTop, gap: NEXT.gap },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: NEXT.gap },
  title: { flexGrow: 1, flexShrink: 1, flexBasis: NEXT.title },
});
