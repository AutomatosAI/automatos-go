// The Board's status filters (handoff §2 'Board', D26): All and every column with its dot, word
// and count, Failed and Cancelled included, in one row that scrolls sideways; the active pill is
// solid ink (the foundation's Pill). The pills are view-model.ts's.

import { ScrollView } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Pill } from '../../ui';
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={BOARD_COPY.filtersLabel}
      contentContainerStyle={{
        gap: spacing[BOARD_LAYOUT.pillGap],
        paddingHorizontal: spacing[BOARD_LAYOUT.paddingX],
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
