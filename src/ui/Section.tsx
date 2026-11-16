// A titled group of rows (Settings' parts): its name as an eyebrow header, then its card and the
// lines under it. A section that counts its rows passes the count as `aside`, a muted eyebrow
// beside the title that wraps under it at the largest sizes. VoiceOver hears the title as a
// header. The gaps are section-model.ts's.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import { SECTION_ASIDE_GAP, SECTION_GAP, sectionHead } from './section-model';

export type SectionProps = {
  readonly title: string;
  /** A word beside the title: how many of the rows are ready. */
  readonly aside?: string;
  readonly children: ReactNode;
};

function Head({ title, aside }: Pick<SectionProps, 'title' | 'aside'>) {
  const { spacing } = useTokens();
  const beside = sectionHead(aside) === 'title-and-aside';
  const heading = (
    <Text
      variant="eyebrow"
      accessibilityRole="header"
      style={beside ? styles.titleBesideAside : undefined}
    >
      {title}
    </Text>
  );
  if (!beside) return heading;
  return (
    <View
      style={[
        styles.head,
        {
          columnGap: spacing[SECTION_ASIDE_GAP.column],
          rowGap: spacing[SECTION_ASIDE_GAP.row],
        },
      ]}
    >
      {heading}
      <Text variant="eyebrow" tone="muted">
        {aside}
      </Text>
    </View>
  );
}

export function Section({ title, aside, children }: SectionProps) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing[SECTION_GAP] }}>
      <Head title={title} aside={aside} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  titleBesideAside: { flexShrink: 1 },
});
