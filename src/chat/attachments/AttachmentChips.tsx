// The files attached to the message, as removable chips above the pill until it is sent (US-009b):
// a 12 pt pill per file with its kind's icon, its name on one line, 'Uploading…' while it uploads
// (every status has a word, §4.6) and a remove button that names the file. They scroll sideways
// when they outgrow the row. The list and its words are attachment-list.ts's. The 30 pt remove button
// keeps the chip's look and still takes a 44 pt touch: the chip passes the button's slop above,
// below and after it (a touch outside a view's box never reaches its children), the row is padded to
// 44 and takes the padding back (touchRoom), and the end of the row leaves the last button's slop.

import FileText from 'lucide-react-native/icons/file-text';
import ImageIcon from 'lucide-react-native/icons/image';
import X from 'lucide-react-native/icons/x';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { IconButton, Text } from '../../ui';
import { ICON_STROKE, hitSlopFor, touchRoom } from '../../ui/paint';
import { ICON_BUTTON_SIZES } from '../../ui/variants';
import { ATTACH_COPY } from '../strings';
import type { AttachmentChip } from './attachment-list';

const NAME_LEVEL = 5;
const WORD_LEVEL = 6;
const ICON_SIZE = 14;
/** A long name is cut at the end so a chip stays readable beside the others. */
const NAME_MAX_WIDTH = 180;
const REMOVE_SIZE = 'sm';
const REMOVE_BOX = ICON_BUTTON_SIZES[REMOVE_SIZE].box;
const REMOVE_SLOP = hitSlopFor(REMOVE_BOX, REMOVE_BOX);
/** The chip lets the remove button's slop through above, below and after it; never before it. */
const CHIP_SLOP = Object.freeze({ ...REMOVE_SLOP, left: 0 });
const ROW_ROOM = touchRoom(REMOVE_BOX);

export type AttachmentChipsProps = {
  readonly chips: readonly AttachmentChip[];
  readonly onRemove: (key: string) => void;
};

function Chip({
  chip,
  onRemove,
}: {
  readonly chip: AttachmentChip;
  readonly onRemove: () => void;
}) {
  const { colours, radii, spacing } = useTokens();
  const Icon = chip.image ? ImageIcon : FileText;
  return (
    <View
      hitSlop={CHIP_SLOP}
      style={[
        styles.chip,
        {
          borderColor: colours.border,
          backgroundColor: colours.background,
          borderRadius: radii.pill,
          paddingLeft: spacing.space4,
          gap: spacing.space2,
        },
      ]}
    >
      <View
        accessible
        accessibilityLabel={chip.accessibilityLabel}
        style={[styles.label, { gap: spacing.space2 }]}
      >
        <Icon size={ICON_SIZE} color={colours.mutedForeground} strokeWidth={ICON_STROKE} />
        <Text level={NAME_LEVEL} numberOfLines={1} style={styles.name}>
          {chip.name}
        </Text>
        {chip.word ? (
          <Text level={WORD_LEVEL} tone="muted">
            {chip.word}
          </Text>
        ) : null}
      </View>
      <IconButton
        icon={X}
        accessibilityLabel={chip.removeLabel}
        onPress={onRemove}
        size={REMOVE_SIZE}
      />
    </View>
  );
}

export function AttachmentChips({ chips, onRemove }: AttachmentChipsProps) {
  const { spacing } = useTokens();
  if (chips.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel={ATTACH_COPY.chips}
      style={{ marginVertical: ROW_ROOM.marginVertical }}
      contentContainerStyle={{
        gap: spacing.space3,
        paddingVertical: ROW_ROOM.paddingVertical,
        paddingRight: REMOVE_SLOP.right,
      }}
    >
      {chips.map((chip) => (
        <Chip key={chip.key} chip={chip} onRemove={() => onRemove(chip.key)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  label: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  name: { maxWidth: NAME_MAX_WIDTH },
});
