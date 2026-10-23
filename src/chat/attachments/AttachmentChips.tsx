// The files attached to the message, as removable chips above the pill until it is sent (US-009b):
// a 12 pt pill per file with its kind's icon, its name on one line, 'Uploading…' while it uploads
// (every status has a word, §4.6) and a remove button that names the file. They scroll sideways
// when they outgrow the row. The list and its words are attachment-list.ts's.

import FileText from 'lucide-react-native/icons/file-text';
import ImageIcon from 'lucide-react-native/icons/image';
import X from 'lucide-react-native/icons/x';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { IconButton, Text } from '../../ui';
import { ICON_STROKE } from '../../ui/paint';
import { ATTACH_COPY } from '../strings';
import type { AttachmentChip } from './attachment-list';

const NAME_LEVEL = 5;
const WORD_LEVEL = 6;
const ICON_SIZE = 14;
/** A long name is cut at the end so a chip stays readable beside the others. */
const NAME_MAX_WIDTH = 180;

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
      <IconButton icon={X} accessibilityLabel={chip.removeLabel} onPress={onRemove} size="sm" />
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
      contentContainerStyle={{ gap: spacing.space3 }}
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
