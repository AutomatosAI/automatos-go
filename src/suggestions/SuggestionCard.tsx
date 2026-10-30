// One of Auto's suggestions (PRD-268 §6.12.3 'Suggestion', §6.12.5): the card ('Auto suggests', the
// title in Auto's words, the detail, 'Start does: …', Start and Hide) and its one-line form while
// the keyboard is up ('Idea', the title wrapped to two lines then cut, Start). Both are one element
// to VoiceOver that names the suggestion, with Start and Hide as its actions (Start's hint says Face
// ID comes first); the visible buttons do the same for a tap. Start refused leaves the card in place
// with one line under it; 'Started. Auto is on it.' takes its place for 4 s. Dressed by the
// primitives (Card: Studio 8–10 pt corners, Play 14 on the ground's surface, HUD a square panel).
// No cost or credit is shown (D8).

import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { useTokens } from '../styles/theme';
import { Button, Card, Text } from '../ui';
import type { SuggestionView } from './model';
import { SUGGESTION_COPY } from './strings';
import type { SuggestionActions } from './use-suggestions';

const START_ACTION = 'start';
const HIDE_ACTION = 'hide';
const TITLE_LINES_KEYBOARD = 2;

export type SuggestionPartProps = {
  readonly view: SuggestionView;
  readonly actions: SuggestionActions;
};

/** The suggestion as one element: its words, and Start and Hide as its actions. */
export function suggestionAccessibility({ view, actions }: SuggestionPartProps) {
  const refused = actions.refusal?.id === view.id ? actions.refusal.text : null;
  const label = refused ? `${view.cardLabel}. ${refused}` : view.cardLabel;
  if (!actions.allowed) return { accessible: true, accessibilityLabel: label };
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: SUGGESTION_COPY.startHint,
    accessibilityActions: [
      { name: START_ACTION, label: view.startLabel },
      { name: HIDE_ACTION, label: view.hideLabel },
    ],
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === START_ACTION) actions.start(view);
      if (event.nativeEvent.actionName === HIDE_ACTION) actions.hide(view);
    },
  };
}

function Buttons({ view, actions }: SuggestionPartProps) {
  const { spacing } = useTokens();
  if (!actions.allowed) return null;
  return (
    <View style={[styles.row, { gap: spacing.space3 }]}>
      <Button
        label={SUGGESTION_COPY.start}
        size="sm"
        busy={actions.busyId === view.id}
        onPress={() => actions.start(view)}
        accessibilityLabel={view.startLabel}
        accessibilityHint={SUGGESTION_COPY.startHint}
      />
      <Button
        label={SUGGESTION_COPY.hide}
        size="sm"
        variant="ghost"
        onPress={() => actions.hide(view)}
        accessibilityLabel={view.hideLabel}
      />
    </View>
  );
}

function Refusal({ view, actions }: SuggestionPartProps) {
  if (actions.refusal?.id !== view.id) return null;
  return (
    <Text level={5} tone="warning">
      {actions.refusal.text}
    </Text>
  );
}

export function SuggestionCard({ view, actions }: SuggestionPartProps) {
  const { spacing } = useTokens();
  return (
    <Card padding="space5" radius="panel">
      <View style={{ gap: spacing.space2 }} {...suggestionAccessibility({ view, actions })}>
        <Text variant="eyebrow">{SUGGESTION_COPY.eyebrow}</Text>
        <Text variant="title" level={6}>
          {view.title}
        </Text>
        {view.detail ? (
          <Text level={5} tone="muted">
            {view.detail}
          </Text>
        ) : null}
        {view.does ? (
          <Text level={6} tone="muted">
            {view.does}
          </Text>
        ) : null}
        <Buttons view={view} actions={actions} />
        <Refusal view={view} actions={actions} />
      </View>
    </Card>
  );
}

/** The keyboard-up form: 'Idea', the title (two lines, then cut) and Start. */
export function SuggestionLine({ view, actions }: SuggestionPartProps) {
  const { spacing } = useTokens();
  return (
    <Card padding="space3" radius="panel">
      <View
        style={[styles.row, { gap: spacing.space3 }]}
        {...suggestionAccessibility({ view, actions })}
      >
        <Text variant="eyebrow">{SUGGESTION_COPY.lineLabel}</Text>
        <Text level={5} numberOfLines={TITLE_LINES_KEYBOARD} style={styles.fill}>
          {view.title}
        </Text>
        {actions.allowed ? (
          <Button
            label={SUGGESTION_COPY.start}
            size="sm"
            busy={actions.busyId === view.id}
            onPress={() => actions.start(view)}
            accessibilityLabel={view.startLabel}
          />
        ) : null}
      </View>
      <Refusal view={view} actions={actions} />
    </Card>
  );
}

/** §6.12.3 'started': in the suggestion's place for 4 s. */
export function StartedLine() {
  return (
    <Card padding="space4" radius="panel">
      <Text level={5} tone="success" accessibilityLiveRegion="polite" accessibilityRole="text">
        {SUGGESTION_COPY.started}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  fill: { flex: 1, minWidth: 0 },
});
