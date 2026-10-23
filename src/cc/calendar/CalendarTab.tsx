// The Calendar tab (handoff §2 'Calendar', D-PAUSE): the seven-day strip over the chosen day (the
// always-on band, then its rows), all in the phone's timezone. It reads the week's one query (the
// shell's Calendar figure shares the cache entry); a pull reads it again, and a pause reads it
// again once the server has answered. A load that fails with nothing to show is the foundation's
// ErrorState. A row or a band line opens the item sheet over the tab.

import { RefreshControl, ScrollView } from 'react-native';

import { useTokens } from '../../styles/theme';
import { ErrorState, LoadingState } from '../../ui';
import { CALENDAR_COPY } from '../strings';
import { CALENDAR_LAYOUT } from './chrome';
import { DayStrip } from './DayStrip';
import { DayView } from './DayView';
import { ItemSheet } from './ItemSheet';
import { sheetTarget } from './sheet';
import { useCalendarTab, useItemSheet } from './use-calendar';

export function CalendarTab() {
  const { colours, spacing } = useTokens();
  const { query, items, model, view, pull, choose } = useCalendarTab();
  const sheet = useItemSheet();

  if (!model || !view) {
    return query.error ? (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    ) : (
      <LoadingState label={CALENDAR_COPY.loading} />
    );
  }
  const target = sheet.opened ? sheetTarget(items, model, view.selectedDay, sheet.opened) : null;
  return (
    <>
      <ScrollView
        contentContainerStyle={{
          gap: spacing[CALENDAR_LAYOUT.gap],
          paddingTop: spacing[CALENDAR_LAYOUT.paddingTop],
          paddingHorizontal: spacing[CALENDAR_LAYOUT.paddingX],
          paddingBottom: spacing[CALENDAR_LAYOUT.paddingBottom],
        }}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={colours[CALENDAR_LAYOUT.spinner]}
            colors={[colours[CALENDAR_LAYOUT.spinner]]}
          />
        }
      >
        <DayStrip cells={view.strip} onChoose={choose} />
        <DayView
          view={view}
          onOpenRow={(row) => sheet.open({ itemId: row.itemId, rowKey: row.key })}
          onOpenBand={(line) => sheet.open({ itemId: line.itemId, rowKey: null })}
        />
      </ScrollView>
      <ItemSheet
        visible={sheet.visible}
        target={target}
        onClose={sheet.close}
        onOpenBoard={sheet.openOnBoard}
      />
    </>
  );
}
