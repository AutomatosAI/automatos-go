// The Board's status filters (handoff §2 'Board', D26): All and every column with its dot, word
// and count, Failed and Cancelled included, in one row that scrolls sideways; the active pill is
// solid ink (the foundation's Pill). The pills are view-model.ts's. The row is padded to the 44 pt
// touch and takes the padding back (touchRoom): the scroll view clips, and would cut a 28 pt pill's
// slop off at 28.

import { ScrollView } from 'react-native';

import { useDress } from '../../styles/dress/use-dress';
import { useTokens } from '../../styles/theme';
import { Pill } from '../../ui';
import { touchRoom } from '../../ui/paint';
import { BOARD_COPY } from '../strings';
import type { BoardFilter } from './board';
import { BOARD_LAYOUT } from './chrome';
import type { FilterPillView } from './view-model';

export type FilterPillsProps = {
  readonly pills: readonly FilterPillView[];
  readonly onChoose: (filter: BoardFilter) => void;
};

export function FilterPills({ pills, onChoose }: FilterPillsProps) {
  const { spacing } = useTokens();
  const room = touchRoom(useDress().pill.minHeight);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginVertical: room.marginVertical }}
      accessibilityLabel={BOARD_COPY.filtersLabel}
      contentContainerStyle={{
        gap: spacing[BOARD_LAYOUT.pillGap],
        paddingHorizontal: spacing[BOARD_LAYOUT.paddingX],
        paddingVertical: room.paddingVertical,
      }}
    >
      {pills.map((pill) => (
        <Pill
          key={pill.filter}
          label={pill.label}
          count={pill.count}
          dot={pill.dot}
          selected={pill.selected}
          onPress={() => onChoose(pill.filter)}
        />
      ))}
    </ScrollView>
  );
}
