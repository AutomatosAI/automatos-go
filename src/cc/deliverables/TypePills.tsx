// The gallery's type filters (D-DELIVERABLES): All, then each type the gallery has shown, in one row
// that scrolls sideways; the active pill is solid ink (the foundation's Pill). No count: the phone
// has loaded only some pages, and a part count would mislead. The pills are gallery.ts's.

import { ScrollView } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Pill } from '../../ui';
import { DELIVERABLES_COPY } from '../strings';
import { GALLERY_LAYOUT } from './chrome';
import type { GalleryFilter, TypePillView } from './gallery';

export type TypePillsProps = {
  readonly pills: readonly TypePillView[];
  readonly onChoose: (filter: GalleryFilter) => void;
};

export function TypePills({ pills, onChoose }: TypePillsProps) {
  const { spacing } = useTokens();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={DELIVERABLES_COPY.filtersLabel}
      contentContainerStyle={{
        gap: spacing[GALLERY_LAYOUT.pillGap],
        paddingHorizontal: spacing[GALLERY_LAYOUT.paddingX],
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
