// Settings → Licences (routes.licences: /settings/licences; docs/app-standard.md rule 8.3): every
// package the app is built from, a row each with its version and licence id, in a list the screen
// owns (rule 4.1: Screen's scroll is off and the list is virtualised, for nine hundred rows). A row
// opens that package's licence on a sheet (LicenceSheet.tsx). The head is drawn as the other
// settings screens draw theirs (back, then the eyebrow, the title and a lede) and scrolls with the
// rows. Back returns to Settings, or opens it when this screen was opened first.
//
// Of rule 6.1's four states only the loaded one can occur. The list is part of the app's own
// bundle and is read synchronously as the screen first draws, so there is nothing to wait for (no
// loading state); the licence audit holds it to every package the app ships, never none (no empty
// state); and it is generated, checked in CI and compiled into the bundle, so a malformed file fails
// the build, never this screen (no failed state).

import { useCallback, useMemo, useState } from 'react';
import { FlatList, View, type ListRenderItem } from 'react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import { routes } from '../navigation/routes';
import { useGoBack } from '../navigation/use-go-back';
import { useTokens } from '../styles/theme';
import { Divider, IconButton, ListRow, Screen, Text } from '../ui';
import {
  licenceRows,
  licenceSheetView,
  type LicenceRowView,
  type LicenceSheetView,
} from './licences';
import { LicenceSheet } from './LicenceSheet';
import { loadLicences } from './load-licences';
import { LICENCES_COPY } from './strings';

const TITLE_LEVEL = 2;
const LEDE_LEVEL = 3;

function Head({ count, onBack }: { readonly count: number; readonly onBack: () => void }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space6, paddingBottom: spacing.space6 }}>
      <IconButton icon={ChevronLeft} accessibilityLabel={LICENCES_COPY.back} onPress={onBack} />
      <View style={{ gap: spacing.space3 }}>
        <Text variant="eyebrow">{LICENCES_COPY.eyebrow}</Text>
        <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
          {LICENCES_COPY.title}
        </Text>
        <Text level={LEDE_LEVEL} tone="muted">
          {LICENCES_COPY.lede(count)}
        </Text>
      </View>
    </View>
  );
}

const keyOf = (row: LicenceRowView) => row.id;

/** The sheet's package: kept while it closes, so its words stay until the fade ends. */
type Open = { readonly view: LicenceSheetView | null; readonly visible: boolean };
const CLOSED: Open = { view: null, visible: false };

export function LicencesScreen() {
  const goBack = useGoBack(routes.settings);
  const { spacing } = useTokens();
  const data = useMemo(loadLicences, []);
  const rows = useMemo(() => licenceRows(data), [data]);
  const [open, setOpen] = useState<Open>(CLOSED);
  const close = useCallback(() => setOpen((now) => ({ ...now, visible: false })), []);
  const renderItem = useCallback<ListRenderItem<LicenceRowView>>(
    ({ item }) => (
      <ListRow
        title={item.title}
        summary={item.summary}
        accessibilityHint={LICENCES_COPY.packageHint}
        onPress={() => setOpen({ view: licenceSheetView(data, item.entry), visible: true })}
      />
    ),
    [data],
  );
  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={<Head count={rows.length} onBack={goBack} />}
        contentContainerStyle={{ padding: spacing.space9 }}
      />
      <LicenceSheet visible={open.visible} view={open.view} onClose={close} />
    </Screen>
  );
}
