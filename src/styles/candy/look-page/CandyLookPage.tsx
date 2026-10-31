// Settings → Style and look → Make it sweet (US-023m, D-CAN-3; CANDY-LAYOUT §5 and the kit's
// looks/look-editor.tsx at 3920359d5): the page is Candy in the look being edited (StyleScope),
// whatever style the phone is on — the way back and the pause control, 'Make it sweet' and its
// line; what the look sync says while Candy is not installed in the workspace (the looks stay on
// the phone) or a read or save failed; the three presets, then the saved looks; the six knob rows;
// the live preview; Save look and Reset with what they did; and the sheet a long press on a saved
// look opens (Rename, Delete). Every change goes to the style store at once, so Candy repaints
// everywhere, and the look sync sends it (US-023c; the route mounts StyleSync). The preview's Auto
// floats and blinks, so the pause control sits beside the way back, inside the page's StyleScope so
// it reads the one stored pause (D-CAN-5, WCAG 2.2.2): a person on another style has no Candy home
// to pause from.

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
import { LOOK_SYNC_COPY } from '../../strings';
import { useLookSyncNotice, useLookSyncStatus } from '../../sync/LookSync';
import { CandyPauseButton } from '../CandyPauseButton';
import { PAGE_GUTTER } from '../parts/orb-model';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_SWEET_COPY } from '../strings';
import { KnobRows } from './KnobRows';
import { LookCards } from './LookCards';
import { LookFoot } from './LookFoot';
import { SweetPreview } from './SweetPreview';
import { CANDY_SHEET_COPY, SWEET_PAGE } from './sweet';
import { useHeldCandyLook, useSweetPage } from './use-sweet-page';

export const CANDY_CHOICE = builtinChoice('candy');

const said = CANDY_SWEET_COPY;
const LEAD_SIZE = 15;
const NOTICE_SIZE = 14;

function Heading() {
  const goBack = useGoBack(STYLE_SCREENS.settingsStyle);
  const { vars, type } = useCandyPaint();
  return (
    <View style={styles.head}>
      <View style={styles.top}>
        <IconButton icon={ChevronLeft} accessibilityLabel={said.back} onPress={goBack} />
        <CandyPauseButton />
      </View>
      <Text accessibilityRole="header" style={[type.display('screen'), { color: vars.text }]}>
        {said.heading}
      </Text>
      <Text style={[type.body(LEAD_SIZE), { color: vars.quiet }]}>{said.lead}</Text>
    </View>
  );
}

/** 'Kept on this phone only' and why while Candy is not installed; a failed sync's own words. */
function SyncNotice() {
  const line = syncLine(
    useLookSyncStatus('candy'),
    useLookSyncNotice('candy'),
    LOOK_SYNC_COPY.localOnly,
  );
  const { vars, type } = useCandyPaint();
  if (line === null) return null;
  return (
    <View accessible style={styles.notice}>
      {line.title === null ? null : (
        <Text style={[type.body(NOTICE_SIZE, 700), { color: vars.text }]}>{line.title}</Text>
      )}
      <Text style={[type.body(NOTICE_SIZE), { color: vars.quiet }]}>{line.reason}</Text>
    </View>
  );
}

export function CandyLookPage() {
  const page = useSweetPage();
  const { looks } = page;
  const [holding, setHolding] = useState<string | null>(null);
  const held = useHeldCandyLook(looks, holding);
  const sheet = { activeId: looks.active.id, rename: page.rename, remove: page.remove };
  return (
    <StyleScope choice={CANDY_CHOICE} look={looks.active}>
      <Screen scroll>
        <View style={styles.page}>
          <Heading />
          <SyncNotice />
          <LookCards looks={looks} onPick={page.pick} onHold={setHolding} />
          <KnobRows look={looks.active} page={page} />
          <SweetPreview celebrating={page.celebrating} />
          <LookFoot said={page.said} onSave={page.saveLook} onReset={page.reset} />
        </View>
      </Screen>
      <LookSheet
        look={held}
        onClose={() => setHolding(null)}
        actions={sheet}
        copy={CANDY_SHEET_COPY}
      />
    </StyleScope>
  );
}

const styles = StyleSheet.create({
  page: { gap: SWEET_PAGE.pageGap, paddingHorizontal: PAGE_GUTTER, paddingVertical: PAGE_GUTTER },
  head: { gap: SWEET_PAGE.headGap, alignItems: 'flex-start' },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  notice: { gap: SWEET_PAGE.headGap },
});
