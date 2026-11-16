// One package's licence, read on top of the list (docs/app-standard.md rule 5.5): its name, its
// version and licence id, then the text of its licence file, or, for a package that ships none, the
// line that says so with the licence it declares. The sheet's own body scrolls a long text; a tap
// on the backdrop, the close button, Android's back and VoiceOver's escape gesture close it.

import { StyleSheet, View } from 'react-native';
import X from 'lucide-react-native/icons/x';

import { useTokens } from '../styles/theme';
import { Divider, IconButton, Sheet, Text } from '../ui';
import type { LicenceSheetView } from './licences';
import { LICENCES_COPY } from './strings';

const TITLE_LEVEL = 4;
const META_LEVEL = 6;
const TEXT_LEVEL = 3;

function SheetHead({
  view,
  onClose,
}: {
  readonly view: LicenceSheetView;
  readonly onClose: () => void;
}) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.head, { gap: spacing.space3 }]}>
      <View style={[styles.words, { gap: spacing.space1 }]}>
        <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
          {view.title}
        </Text>
        <Text level={META_LEVEL} tone="muted">
          {view.meta}
        </Text>
      </View>
      <IconButton icon={X} accessibilityLabel={LICENCES_COPY.close} onPress={onClose} />
    </View>
  );
}

export type LicenceSheetProps = {
  readonly visible: boolean;
  /** The package shown; kept while the sheet closes, so its words do not vanish mid-fade. */
  readonly view: LicenceSheetView | null;
  readonly onClose: () => void;
};

export function LicenceSheet({ visible, view, onClose }: LicenceSheetProps) {
  return (
    <Sheet visible={visible && view !== null} onClose={onClose}>
      {view ? (
        <>
          <SheetHead view={view} onClose={onClose} />
          <Divider />
          <Text level={TEXT_LEVEL} tone={view.text === null ? 'muted' : undefined}>
            {view.text ?? view.note}
          </Text>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  words: { flex: 1, minWidth: 0 },
});
