// The handoff's Mission card (AutomatosApp.dc.html, the thread's mission draft): a 10 pt panel on
// --card with a 1 pt border; the head (12 × 14) holds the mono eyebrow, an optional chip and the
// serif 15 title; the body rows sit between hairlines; the foot (10 × 14) holds the actions, the
// outcome or the read-only note. Feature-local (KC2): src/ui has no sectioned card.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Chip, Text } from '../../ui';

const TITLE_LEVEL = 4;
const META_LEVEL = 6;

export type MissionFrameProps = {
  readonly eyebrow: string;
  readonly title: string;
  /** The complexity chip beside the eyebrow. */
  readonly chip?: string | null;
  /** A line under the title ('3 tasks'). */
  readonly meta?: string | null;
  readonly children?: ReactNode;
  readonly footer: ReactNode;
};

export function MissionFrame({ eyebrow, title, chip, meta, children, footer }: MissionFrameProps) {
  const { colours, radii, spacing, shadows } = useTokens();
  const rule = { borderColor: colours.border };
  const inset = { paddingHorizontal: spacing.space6 };
  return (
    <View
      style={[
        styles.frame,
        rule,
        { borderRadius: radii.panel, backgroundColor: colours.card, boxShadow: shadows.hairline },
      ]}
    >
      <View style={[inset, { paddingVertical: spacing.space5, gap: spacing.space1 }]}>
        <View style={[styles.row, { gap: spacing.space3 }]}>
          <Text variant="mono" tone="muted" accessibilityRole="header">
            {eyebrow}
          </Text>
          {chip ? <Chip label={chip} /> : null}
        </View>
        <Text variant="title" level={TITLE_LEVEL} selectable>
          {title}
        </Text>
        {meta ? (
          <Text level={META_LEVEL} tone="muted">
            {meta}
          </Text>
        ) : null}
      </View>
      {children}
      <View
        style={[styles.foot, rule, inset, { paddingVertical: spacing.space4, gap: spacing.space3 }]}
      >
        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  foot: { borderTopWidth: 1 },
});
