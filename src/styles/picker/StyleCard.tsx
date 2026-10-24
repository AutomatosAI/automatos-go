// One style's card on the Style and look screen, painted in that style (StyleScope): the live
// preview and the name, tagline and 'Selected' are ONE button ('Studio style', its selected
// state); under it, still inside the frame, the style's look controls — Studio's Light / Dark /
// System, 'Same as Studio' and the installed theme rows, Play's 'Make it yours →', HUD's 'Looks →'.
// The chosen card's frame is a 2 pt ring in its style's accent (cards.ts cardFrame).

import Check from 'lucide-react-native/icons/check';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, ListRow, SegmentedControl, Text } from '../../ui';
import { ICON_STROKE } from '../../ui/paint';
import type { StyleScreenPath } from '../nav';
import { StyleScope } from '../provider/StyleScope';
import type { PhoneChoice } from '../registry/style-id';
import { useStyle, useTokens } from '../theme';
import type { ThemeChoice } from '../theme-choice';
import { cardFrame, previewAnimates, type PickerCard } from './cards';
import { StylePreview } from './previews/StylePreview';

const NAME_LEVEL = 4;
const TAGLINE_LEVEL = 5;
const CHECK_SIZE = 14;

export type StyleCardProps = {
  readonly card: PickerCard;
  /** The screen is on top: the preview may move (with the style's own motion rule). */
  readonly focused: boolean;
  readonly onSelect: (choice: PhoneChoice) => void;
  readonly onScheme: (scheme: ThemeChoice) => void;
  readonly onOpen: (href: StyleScreenPath) => void;
};

function SelectedWord({ word }: { readonly word: string }) {
  const { colours, spacing } = useTokens();
  return (
    <View style={[styles.row, { gap: spacing.space1 }]}>
      <Check size={CHECK_SIZE} color={colours.accent} strokeWidth={ICON_STROKE} />
      <Text variant="mono" tone="accent">
        {word}
      </Text>
    </View>
  );
}

function CardFooter({ card }: { readonly card: PickerCard }) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.row, { padding: spacing.space7, gap: spacing.space5 }]}>
      <View style={[styles.grow, { gap: spacing.space1 }]}>
        <Text variant="title" level={NAME_LEVEL}>
          {card.name}
        </Text>
        <Text level={TAGLINE_LEVEL} tone="muted">
          {card.tagline}
        </Text>
      </View>
      {card.selectedWord ? <SelectedWord word={card.selectedWord} /> : null}
    </View>
  );
}

type ControlsProps = Pick<StyleCardProps, 'card' | 'onSelect' | 'onScheme' | 'onOpen'>;

function CardControls({ card, onSelect, onScheme, onOpen }: ControlsProps) {
  const { spacing } = useTokens();
  const scheme = card.schemes.find((option) => option.selected);
  const { lookLink, follow } = card;
  if (!scheme && !follow && card.themes.length === 0 && !lookLink) return null;
  return (
    <View style={{ paddingHorizontal: spacing.space7, paddingBottom: spacing.space7 }}>
      {scheme ? (
        <SegmentedControl
          options={card.schemes}
          value={scheme.value}
          onChange={onScheme}
          accessibilityLabel={card.schemeGroup}
        />
      ) : null}
      {follow ? (
        <ListRow
          title={follow.title}
          summary={follow.summary}
          onPress={() => onSelect(follow.choice)}
          accessibilityLabel={follow.accessibilityLabel}
          accessibilityHint={follow.accessibilityHint}
          trailing={follow.selectedWord ? <SelectedWord word={follow.selectedWord} /> : undefined}
        />
      ) : null}
      {card.themes.map((row) => (
        <ListRow
          key={row.installId}
          title={row.title}
          onPress={() => onSelect(row.choice)}
          accessibilityLabel={row.accessibilityLabel}
          trailing={row.selectedWord ? <SelectedWord word={row.selectedWord} /> : undefined}
        />
      ))}
      {lookLink ? (
        <View style={styles.start}>
          <Button
            variant="ghost"
            label={lookLink.label}
            accessibilityLabel={lookLink.accessibilityLabel}
            accessibilityHint={lookLink.accessibilityHint}
            onPress={() => onOpen(lookLink.href)}
          />
        </View>
      ) : null}
    </View>
  );
}

function CardBody(props: StyleCardProps) {
  const { card, focused, onSelect } = props;
  const { tokens, motion } = useStyle();
  const { colours, radii } = tokens;
  const frame = cardFrame(card.selected);
  return (
    <View
      style={[
        styles.frame,
        {
          borderRadius: radii.panel,
          borderWidth: frame.borderWidth,
          borderColor: colours[frame.colour],
          margin: frame.margin,
          backgroundColor: colours.card,
        },
      ]}
    >
      <Pressable
        onPress={() => onSelect(card.choice)}
        accessibilityRole="button"
        accessibilityLabel={card.accessibilityLabel}
        accessibilityHint={card.accessibilityHint}
        accessibilityState={{ selected: card.selected }}
      >
        <StylePreview id={card.id} animate={previewAnimates(focused, motion)} />
        <CardFooter card={card} />
      </Pressable>
      <CardControls {...props} />
    </View>
  );
}

export function StyleCard(props: StyleCardProps) {
  return (
    <StyleScope choice={props.card.choice}>
      <CardBody {...props} />
    </StyleScope>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
});
