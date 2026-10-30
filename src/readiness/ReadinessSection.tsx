// Settings → "What Auto depends on" (PRD-268 §6.12.3 'Readiness list', §6.12.5, US-G07): the title
// and how many are ready, then one Card of ListRows, each the label, the detail and the state as a
// glyph AND a word (✓ Ready · ○ Not checked · ◆ Needs setup; never colour alone, D-A11Y), a fix
// where the phone has the screen for it, then the line (Checking…, a refused Check again) and Check
// again. Shown only when discovery lists readiness: an older server's Settings are unchanged. The
// card, rows, divider and button are src/ui's, so Studio, Play and HUD dress them; text grows with
// Dynamic Type and wraps, the mark included. VoiceOver reads each row as one element ('Calendar:
// needs setup. Connect calendar.'); a row with a fix is that fix's button, with the detail as its
// hint, and the visible fix button beside it is the same action, so it is kept out of the tree.

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useDress } from '../styles/dress/use-dress';
import { useTokens } from '../styles/theme';
import { Button, Card, Divider, ListRow, Text } from '../ui';
import type { TextLevel } from '../ui/variants';
import type { ReadinessState } from './schema';
import { READINESS_COPY } from './strings';
import { useReadiness } from './use-readiness';
import { readinessMark, type ReadinessRow, type ReadinessView } from './view-model';

const LINE_LEVEL: TextLevel = 6;
/** The mark never takes more than this share of a row: at the largest sizes its word wraps. */
const MARK_MAX_WIDTH = '45%';

function ReadinessMark({ state }: { readonly state: ReadinessState }) {
  const { colours, scheme, spacing } = useTokens();
  const mark = readinessMark(state, useDress().status === 'glyph', scheme);
  return (
    <View style={[styles.mark, { gap: spacing.space1 }]}>
      <Text variant="mono" style={{ color: colours[mark.glyphToken] }}>
        {mark.glyph}
      </Text>
      <Text variant="mono" style={[styles.word, { color: colours[mark.wordToken] }]}>
        {mark.word}
      </Text>
    </View>
  );
}

type RowProps = { readonly row: ReadinessRow; readonly onFix: (route: string) => void };

function ReadinessRowView({ row, onFix }: RowProps) {
  const { spacing } = useTokens();
  const mark = <ReadinessMark state={row.state} />;
  const { fix } = row;
  if (!fix) {
    return (
      <View accessible accessibilityRole="text" accessibilityLabel={row.accessibilityLabel}>
        <ListRow title={row.label} summary={row.detail || undefined} trailing={mark} />
      </View>
    );
  }
  return (
    <View style={{ paddingBottom: spacing.space3 }}>
      <ListRow
        title={row.label}
        summary={row.detail || undefined}
        trailing={mark}
        onPress={() => onFix(fix.route)}
        accessibilityLabel={row.accessibilityLabel}
        accessibilityHint={row.detail || undefined}
      />
      <View
        style={styles.start}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Button label={fix.label} variant="outline" size="sm" onPress={() => onFix(fix.route)} />
      </View>
    </View>
  );
}

function Head({ count }: { readonly count: string }) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.head, { columnGap: spacing.space3, rowGap: spacing.space1 }]}>
      <Text variant="eyebrow" accessibilityRole="header" style={styles.title}>
        {READINESS_COPY.title}
      </Text>
      <Text variant="eyebrow" tone="muted">
        {count}
      </Text>
    </View>
  );
}

export type ReadinessCardProps = {
  readonly view: ReadinessView;
  readonly onFix: (route: string) => void;
  readonly onCheckAgain: () => void;
};

export function ReadinessCard({ view, onFix, onCheckAgain }: ReadinessCardProps) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      <Head count={view.count} />
      <Card>
        {view.rows.map((row, index) => (
          <View key={row.id}>
            {index > 0 ? <Divider /> : null}
            <ReadinessRowView row={row} onFix={onFix} />
          </View>
        ))}
        <View style={[styles.start, { gap: spacing.space3, paddingTop: spacing.space4 }]}>
          {view.line ? (
            <Text level={LINE_LEVEL} tone="muted" accessibilityLiveRegion="polite">
              {view.line}
            </Text>
          ) : null}
          <Button
            label={READINESS_COPY.checkAgain}
            variant="outline"
            size="sm"
            busy={view.checking}
            onPress={onCheckAgain}
            accessibilityHint={READINESS_COPY.checkAgainHint}
          />
        </View>
      </Card>
    </View>
  );
}

export function ReadinessSection() {
  const router = useRouter();
  const readiness = useReadiness();
  if (!readiness.shown) return null;
  return (
    <ReadinessCard
      view={readiness.view}
      onFix={(route) => router.push(route)}
      onCheckAgain={readiness.checkAgain}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  title: { flexShrink: 1 },
  mark: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, maxWidth: MARK_MAX_WIDTH },
  word: { flexShrink: 1 },
  start: { alignItems: 'flex-start' },
});
