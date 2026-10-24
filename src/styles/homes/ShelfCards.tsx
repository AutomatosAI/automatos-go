// The Shelf's pieces (Ember 04, US-017g): the newest Deliverable lit and the tiles in the grid. The
// newest is a 200 pt panel on a 160° gradient from the accent at 28 % to 4 % with the look's accent
// line, the 'NEWEST' badge in the accent with its ink, and a 124 x 164 printed sheet with its title
// and a little chart; its title (card slot) and eyebrow ('REPORT · TODAY', the accent text) under
// it. A tile is a 130 pt panel on the ground's surface with a 1 pt line, a smaller sheet with its
// title and rules; its title (small card slot) and eyebrow in text2 under it. The sheets are the
// vendored sheetOf colours and only decoration (hidden from VoiceOver): each card is one button
// that says A3's sentence for it, opening the Deliverable. A failed run's report says so in words.

import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { DELIVERABLES_COPY } from '../../cc/strings';
import { StatusPip, Text } from '../../ui';
import { COMPANION } from '../play/companion';
import { useCompanionPaint, type CompanionPaint } from '../play/companion/use-companion';
import { PLAY_SHELF_COPY } from '../strings';
import { SHELF, gradientPoints, newestLabel, type ShelfCard } from './play-shelf';

const { hero, badge, heroPaper, heroChart, tile, tilePaper, tileRules, rule } = SHELF;
const HERO_GRADIENT = gradientPoints(hero.angle);
const HERO_STOPS = [0, hero.fadeAt] as const;
const LAST_BAR = heroChart.bars.length - 1;

type PaperProps = { readonly title: string; readonly size: 'hero' | 'tile' };

function Paper({ title, size }: PaperProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  const sheet = size === 'hero' ? heroPaper : tilePaper;
  const face = { ...style.type.display('cardSm'), fontSize: sheet.title, lineHeight: sheet.title };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: sheet.width,
        height: sheet.height,
        padding: sheet.pad,
        gap: sheet.gap,
        borderTopLeftRadius: sheet.radius,
        borderTopRightRadius: sheet.radius,
        backgroundColor: vars.sheetBg,
      }}
    >
      <Text numberOfLines={size === 'hero' ? 2 : 1} style={[face, { color: vars.sheetText }]}>
        {title}
      </Text>
      {size === 'hero' ? <HeroChart paint={paint} /> : <TileRules paint={paint} />}
    </View>
  );
}

function HeroChart({ paint }: { readonly paint: CompanionPaint }) {
  const { vars, lines } = paint;
  return (
    <>
      <View style={{ height: rule, backgroundColor: lines.paperRule }} />
      <View style={{ height: rule, width: '80%', backgroundColor: lines.paperRule }} />
      <View style={[styles.chart, { height: heroChart.height, gap: heroChart.gap }]}>
        {heroChart.bars.map((share, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: heroChart.height * share,
                backgroundColor: index === LAST_BAR ? vars.sheetAccent : lines.paperBar,
              },
            ]}
          />
        ))}
      </View>
    </>
  );
}

function TileRules({ paint }: { readonly paint: CompanionPaint }) {
  const { vars, lines } = paint;
  return tileRules.map((share, index) => (
    <View
      key={index}
      style={{
        height: rule,
        width: `${share * 100}%` as const,
        backgroundColor: share < 1 ? vars.sheetAccent : lines.paperRule,
      }}
    />
  ));
}

/** The title and eyebrow: side by side under the newest (wrapping when the type is large). */
function Caption({ card, lit }: { readonly card: ShelfCard; readonly lit: boolean }) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  return (
    <View style={[lit ? styles.litCaption : null, { gap: style.tokens.spacing.space2 }]}>
      <Text
        numberOfLines={tile.titleLines}
        style={[
          style.type.display(lit ? 'card' : 'cardSm'),
          lit ? styles.litTitle : null,
          { color: vars.groundText },
        ]}
      >
        {card.title}
      </Text>
      <Text style={[style.type.eyebrow, { color: lit ? vars.accentText : vars.groundText2 }]}>
        {card.eyebrow}
      </Text>
      {card.failed ? <StatusPip status="failed" word={card.failed} /> : null}
    </View>
  );
}

function useOpen(card: ShelfCard) {
  const router = useRouter();
  return () => router.push(card.href);
}

function NewestBadge({ paint }: { readonly paint: CompanionPaint }) {
  const { vars, style } = paint;
  return (
    <View
      style={[
        styles.badge,
        {
          top: badge.inset,
          left: badge.inset,
          paddingHorizontal: badge.paddingX,
          paddingVertical: badge.paddingY,
          borderRadius: badge.radius,
          backgroundColor: vars.accent,
        },
      ]}
    >
      <Text style={[style.type.label, { color: vars.accentInk }]}>{PLAY_SHELF_COPY.newest}</Text>
    </View>
  );
}

/** The newest piece, lit. */
export function ShelfHero({ card }: { readonly card: ShelfCard }) {
  const paint = useCompanionPaint();
  const open = useOpen(card);
  if (!paint) return null;
  const { vars, lines } = paint;
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={newestLabel(card)}
      accessibilityHint={DELIVERABLES_COPY.openHint}
      style={({ pressed }) => [
        { gap: hero.captionGap, opacity: pressed ? COMPANION.pressedOpacity : 1 },
      ]}
    >
      <View
        style={[
          styles.frame,
          { height: hero.height, borderRadius: hero.radius, borderColor: vars.accentLine },
        ]}
      >
        <LinearGradient
          colors={lines.shelfGradient}
          locations={HERO_STOPS}
          start={HERO_GRADIENT.start}
          end={HERO_GRADIENT.end}
          style={StyleSheet.absoluteFill}
        />
        <NewestBadge paint={paint} />
        <Paper title={card.title} size="hero" />
      </View>
      <Caption card={card} lit />
    </Pressable>
  );
}

/** One of the rest, in the grid. */
export function ShelfTile({ card }: { readonly card: ShelfCard }) {
  const paint = useCompanionPaint();
  const open = useOpen(card);
  if (!paint) return null;
  const { vars, lines } = paint;
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={card.accessibilityLabel}
      accessibilityHint={DELIVERABLES_COPY.openHint}
      style={({ pressed }) => [
        styles.tile,
        { gap: tile.gap, opacity: pressed ? COMPANION.pressedOpacity : 1 },
      ]}
    >
      <View
        style={[
          styles.frame,
          {
            height: tile.height,
            borderRadius: tile.radius,
            backgroundColor: vars.groundSurface,
            borderColor: lines.tileLine,
          },
        ]}
      >
        <Paper title={card.title} size="tile" />
      </View>
      <Caption card={card} lit={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  badge: { position: 'absolute', zIndex: 1 },
  chart: { marginTop: 'auto', flexDirection: 'row', alignItems: 'flex-end' },
  bar: { flex: 1 },
  tile: { flex: 1, minWidth: 0 },
  litCaption: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  litTitle: { flexShrink: 1 },
});
