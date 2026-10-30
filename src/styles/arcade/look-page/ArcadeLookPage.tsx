// Settings → Style and look → Arcade's Options (US-022j, D-ARC-3; the design kit's
// looks/look-editor.tsx at 034fa629c and the handoff's Options): the page is Arcade in the look being
// edited (StyleScope), whatever style the phone is on — the way back, 'OPTIONS' and its line;
// what the look sync says while Arcade is not installed in the workspace (the looks stay on the
// phone) or a read or save failed; the knob rows with SAVE LOOK and RESET; the live preview; the
// save slots; and the sheet a long press on a saved look opens (Rename, Delete). Every change goes
// to the style store at once, so Arcade repaints everywhere, and the look sync sends it (US-022c;
// the route mounts StyleSync).

import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useGoBack } from '../../../navigation/use-go-back';
import { IconButton, Screen, Text } from '../../../ui';
import { STYLE_SCREENS } from '../../nav';
import { syncLine } from '../../play/look-page';
import { LookSheet } from '../../play/look-page/LookSheet';
import { StyleScope } from '../../provider/StyleScope';
import { builtinChoice } from '../../registry/style-id';
import { ARCADE_OPTIONS_COPY, LOOK_SYNC_COPY } from '../../strings';
import { useLookSyncNotice, useLookSyncStatus } from '../../sync/LookSync';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { ARCADE_SHEET_COPY, OPTIONS_PAGE, optionRows, optionsLead, saveSlots } from './options';
import { OptionsPreview } from './OptionsPreview';
import { OptionsWindow } from './OptionsWindow';
import { SaveSlots } from './SaveSlots';
import { useHeldArcadeLook, useOptionsPage } from './use-options-page';

export const ARCADE_CHOICE = builtinChoice('arcade');

const said = ARCADE_OPTIONS_COPY;

function Heading() {
  const goBack = useGoBack(STYLE_SCREENS.settingsStyle);
  const { vars, type } = useArcadePaint();
  const lead = optionsLead(useLookSyncStatus('arcade'));
  return (
    <View style={styles.head}>
      <IconButton icon={ChevronLeft} accessibilityLabel={said.back} onPress={goBack} />
      <Text accessibilityRole="header" style={[type.display('screen'), { color: vars.tx }]}>
        {said.heading}
      </Text>
      {lead === null ? null : (
        <Text style={[type.body(OPTIONS_PAGE.noticeSize), { color: vars.tx2 }]}>{lead}</Text>
      )}
    </View>
  );
}

/** 'Kept on this phone only' and why while Arcade is not installed; a failed sync's own words. */
function SyncNotice() {
  const line = syncLine(
    useLookSyncStatus('arcade'),
    useLookSyncNotice('arcade'),
    LOOK_SYNC_COPY.localOnly,
  );
  const { vars, type } = useArcadePaint();
  if (line === null) return null;
  const size = OPTIONS_PAGE.noticeSize;
  return (
    <View accessible style={styles.notice}>
      {line.title === null ? null : (
        <Text style={[type.body(size, 600), { color: vars.tx }]}>{line.title}</Text>
      )}
      <Text style={[type.body(size), { color: vars.tx2 }]}>{line.reason}</Text>
    </View>
  );
}

export function ArcadeLookPage() {
  const page = useOptionsPage();
  const { looks } = page;
  const [holding, setHolding] = useState<string | null>(null);
  const held = useHeldArcadeLook(looks, holding);
  const sheet = { activeId: looks.active.id, rename: page.rename, remove: page.remove };
  return (
    <StyleScope choice={ARCADE_CHOICE} look={looks.active}>
      <Screen scroll padding="space7">
        <View style={styles.page}>
          <Heading />
          <SyncNotice />
          <OptionsWindow
            rows={optionRows(looks.active)}
            cursor={page.cursor}
            said={page.said}
            onChange={page.change}
            onSave={page.saveLook}
            onReset={page.reset}
          />
          <OptionsPreview />
          <SaveSlots slots={saveSlots(looks)} onPick={page.pick} onHold={setHolding} />
        </View>
      </Screen>
      <LookSheet
        look={held}
        onClose={() => setHolding(null)}
        actions={sheet}
        copy={ARCADE_SHEET_COPY}
      />
    </StyleScope>
  );
}

const styles = StyleSheet.create({
  page: { gap: OPTIONS_PAGE.pageGap },
  head: { gap: OPTIONS_PAGE.headGap, alignItems: 'flex-start' },
  notice: { gap: OPTIONS_PAGE.headGap },
});
