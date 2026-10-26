// The gallery's type filters (D-DELIVERABLES): All, then each type the gallery has shown, in one row
// that scrolls sideways; the active pill is solid ink (the foundation's Pill). No count: the phone
// has loaded only some pages, and a part count would mislead. The pills are gallery.ts's. The row is
// padded to the 44 pt touch and takes the padding back (touchRoom): the scroll view clips, and would
// cut a 28 pt pill's slop off at 28.

import { ScrollView } from 'react-native';

import { useDress } from '../../styles/dress/use-dress';
import { useTokens } from '../../styles/theme';
import { Pill } from '../../ui';
import { touchRoom } from '../../ui/paint';
import { DELIVERABLES_COPY } from '../strings';
import { GALLERY_LAYOUT } from './chrome';
import type { GalleryFilter, TypePillView } from './gallery';

export type TypePillsProps = {
  readonly pills: readonly TypePillView[];
  readonly onChoose: (filter: GalleryFilter) => void;
};

export function TypePills({ pills, onChoose }: TypePillsProps) {
  const { spacing } = useTokens();
  const room = touchRoom(useDress().pill.minHeight);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginVertical: room.marginVertical }}
      accessibilityLabel={DELIVERABLES_COPY.filtersLabel}
      contentContainerStyle={{
        gap: spacing[GALLERY_LAYOUT.pillGap],
        paddingHorizontal: spacing[GALLERY_LAYOUT.paddingX],
        paddingVertical: room.paddingVertical,
      }}
    >
      {pills.map((pill) => (
        <Pill
          key={pill.key}
          label={pill.label}
          selected={pill.selected}
          onPress={() => onChoose(pill.filter)}
        />
      ))}
    </ScrollView>
  );
}
