// The needs strip (the handoff's 2a) between the header and the thread: 'NEEDS YOU · N' in mono
// accent and 'Command Centre →', over a sideways row of 214 pt cards (8 pt radius): the status as
// a dot and a word, the serif title clamped to two lines, the mono meta. needsStrip (pure) decides
// every word and target from the foundation's useNeedsYou(), the same cached answer the header's
// button counts; nothing here counts. Hidden when the server's total is zero.

import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useNeedsYou } from '../../api/needs-you';
import { useTokens } from '../../styles/theme';
import { Button, Card, StatusPip, Text } from '../../ui';
import { useFollowLink, type FollowLink } from '../components/follow-link';
import { NEEDS_COPY } from '../strings';
import { needsStrip, type StripCard } from './needs-strip';

const CARD_WIDTH = 214;
const TITLE_LEVEL = 6;
const TITLE_LINES = 2;

function NeedCardBody({ card }: { readonly card: StripCard }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space1 }}>
      <StatusPip status={card.pip} word={card.word} />
      <Text variant="title" level={TITLE_LEVEL} numberOfLines={TITLE_LINES}>
        {card.title}
      </Text>
      <Text variant="mono" tone="muted" numberOfLines={1}>
        {card.meta}
      </Text>
    </View>
  );
}

function NeedCard({ card, onOpen }: { readonly card: StripCard; readonly onOpen: FollowLink }) {
  const { target } = card;
  if (!target) {
    return (
      <Card padding="space4" style={styles.card} accessibilityLabel={card.accessibilityLabel}>
        <NeedCardBody card={card} />
      </Card>
    );
  }
  return (
    <Card
      padding="space4"
      style={styles.card}
      onPress={() => onOpen(target)}
      accessibilityLabel={card.accessibilityLabel}
      accessibilityHint={card.accessibilityHint}
    >
      <NeedCardBody card={card} />
    </Card>
  );
}

export function NeedsStrip() {
  const { colours, spacing } = useTokens();
  const { total, rows } = useNeedsYou();
  const follow = useFollowLink();
  const strip = useMemo(() => needsStrip({ total, rows }), [total, rows]);
  if (!strip) return null;
  return (
    <View
      style={[
        styles.strip,
        { borderBottomColor: colours.border, paddingVertical: spacing.space5, gap: spacing.space3 },
      ]}
    >
      <View style={[styles.head, { paddingHorizontal: spacing.space7, gap: spacing.space3 }]}>
        <Text variant="mono" tone="accent" accessibilityRole="header">
          {strip.heading}
        </Text>
        <Button
          label={NEEDS_COPY.commandCentre}
          accessibilityLabel={NEEDS_COPY.commandCentreLabel}
          onPress={() => follow(strip.more)}
          variant="ghost"
          size="sm"
        />
      </View>
      {strip.cards.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.space3, paddingHorizontal: spacing.space7 }}
        >
          {strip.cards.map((card) => (
            <NeedCard key={card.key} card={card} onOpen={follow} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { borderBottomWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { width: CARD_WIDTH },
});
