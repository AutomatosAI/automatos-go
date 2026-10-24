// Studio's preview: the home's top in miniature — the brand header ('automatos' in Newsreader on
// the cream or Studio Dark ground, its 1 pt rule) over the needs strip's line and one needs card —
// in the scheme Light / Dark / System paints, so flipping the scheme on the card repaints it.
// Studio does not move: it has no loop to stop.

import { StyleSheet, View } from 'react-native';

import { Card, StatusPip, Text } from '../../../ui';
import { useTokens } from '../../theme';
import { PREVIEW_COPY } from '../../strings';
import { PREVIEW } from '../cards';

const NEED_TITLE_LEVEL = 6;
const RULE = 1;

export function StudioPreview() {
  const { colours, spacing } = useTokens();
  const copy = PREVIEW_COPY.studio;
  return (
    <View style={[styles.ground, { backgroundColor: colours.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing.space7,
            paddingVertical: spacing.space5,
            borderBottomWidth: RULE,
            borderBottomColor: colours.border,
          },
        ]}
      >
        <Text variant="thread" level={2} numberOfLines={1}>
          {copy.wordmark}
        </Text>
      </View>
      <View style={{ padding: spacing.space7, gap: spacing.space3 }}>
        <Text variant="mono" tone="accent">
          {copy.needs}
        </Text>
        <Card padding="space4">
          <View style={{ gap: spacing.space1 }}>
            <StatusPip status="review" />
            <Text variant="title" level={NEED_TITLE_LEVEL} numberOfLines={2}>
              {copy.needTitle}
            </Text>
            <Text variant="mono" tone="muted" numberOfLines={1}>
              {copy.needMeta}
            </Text>
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { minHeight: PREVIEW.minHeight },
  header: { flexDirection: 'row', alignItems: 'center' },
});
