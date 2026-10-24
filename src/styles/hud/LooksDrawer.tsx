// HUD's Looks drawer (US-018c, D55, 'Automatos Command HUD.dc.html'), full height on the phone: the
// drawing's 372 pt drawer at the right edge (the whole width of a narrower phone), in hudVars'
// drawer colour with a 1 pt accent line on its left and no blur (KS7). 'LOOK' in the look's display
// face (22, .2em) with the status line (Geist Mono 11, .1em, text2) and Close; a failed sync's
// words; the looks row; Accent, Background and Type; Grid and Glow; SCAN · AUTO · MOTION; SAVE AS
// NEW LOOK and RESET; and the sheet a long press on a saved look opens (RENAME / DELETE). Every
// change goes to the style store at once: HUD repaints behind the drawer, the phone keeps it, and
// the look sync sends it where HUD is installed (US-017d). Settings → HUD's look hosts it as a
// page; HudCore's LOOK opens it over the core (overlay: VoiceOver stays in it, Android's back
// closes it).

import X from 'lucide-react-native/icons/x';
import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Text } from '../../ui';
import { LookSheet } from '../play/look-page/LookSheet';
import { HUD_DRAWER_COPY } from '../strings';
import { useLookSyncNotice } from '../sync/LookSync';
import { HUD_DRAWER, drawerFace } from './drawer-model';
import { HUD_DEFAULT_LOOK } from './look-schema';
import { DrawerActions } from './drawer/DrawerActions';
import { DrawerControls } from './drawer/DrawerControls';
import { DrawerLooksRow } from './drawer/DrawerLooksRow';
import { DrawerOptions } from './drawer/DrawerOptions';
import {
  HUD_SHEET_COPY,
  useDrawerPaint,
  useHeldHudLook,
  useLooksDrawer,
} from './drawer/use-drawer';

const said = HUD_DRAWER_COPY;
const NOTICE_SIZE = 13;

/** Android's back closes the drawer while it is over the core. */
function useBackToClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [active, onClose]);
}

function Header({ status, onClose }: { readonly status: string; readonly onClose: () => void }) {
  const paint = useDrawerPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  const { title, status: line } = HUD_DRAWER;
  const font = style.hudLook?.font ?? HUD_DEFAULT_LOOK.font;
  const statusFace = style.type.mono(line.size, 400, { trackingEm: line.tracking });
  return (
    <View style={styles.header}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={said.titleLabel}
        style={[drawerFace(font, title.size, title.tracking), { color: vars.text }]}
      >
        {said.title}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[statusFace, styles.status, { color: vars.text2 }]}
      >
        {status}
      </Text>
      <IconButton icon={X} accessibilityLabel={said.close} onPress={onClose} />
    </View>
  );
}

/** A failed read or save in the taxonomy's words; a 404 keeps the looks on the phone, unsaid. */
function SyncNotice() {
  const notice = useLookSyncNotice('hud');
  const paint = useDrawerPaint();
  if (!paint || notice === null) return null;
  return (
    <Text style={[paint.style.type.body(NOTICE_SIZE), { color: paint.vars.text2 }]}>
      {notice}
    </Text>
  );
}

export type LooksDrawerProps = {
  readonly onClose: () => void;
  /** Over HudCore: VoiceOver stays inside the drawer and Android's back closes it. */
  readonly overlay?: boolean;
};

export function LooksDrawer({ onClose, overlay = false }: LooksDrawerProps) {
  const paint = useDrawerPaint();
  const state = useLooksDrawer();
  const [holding, setHolding] = useState<string | null>(null);
  const held = useHeldHudLook(state.looks, holding);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  useBackToClose(overlay, onClose);
  if (!paint) return null;
  const { vars } = paint;
  const { drawer } = state;
  const sheet = { activeId: state.looks.active.id, rename: state.rename, remove: state.remove };
  const frame = {
    width: Math.min(HUD_DRAWER.width, width),
    backgroundColor: vars.drawer,
    borderLeftColor: vars.accentLine,
  };
  const pad = {
    paddingTop: HUD_DRAWER.pad + insets.top,
    paddingBottom: HUD_DRAWER.pad + insets.bottom,
  };
  return (
    <>
      <View accessibilityViewIsModal={overlay} style={[styles.drawer, frame]}>
        <ScrollView
          contentContainerStyle={[styles.content, pad]}
          keyboardShouldPersistTaps="handled"
        >
          <Header status={drawer.status} onClose={onClose} />
          <SyncNotice />
          <DrawerLooksRow items={drawer.looks} onPick={state.pick} onHold={setHolding} />
          <DrawerOptions drawer={drawer} onChoose={state.choose} />
          <DrawerControls drawer={drawer} onSlide={state.slide} onFlip={state.flip} />
          <DrawerActions
            onSaveAs={state.saveAsNew}
            onReset={state.reset}
            canReset={drawer.canReset}
            problem={state.problem}
          />
        </ScrollView>
      </View>
      <LookSheet
        look={held}
        onClose={() => setHolding(null)}
        actions={sheet}
        copy={HUD_SHEET_COPY}
      />
    </>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: HUD_DRAWER.edge,
  },
  content: { flexGrow: 1, gap: HUD_DRAWER.gap, paddingHorizontal: HUD_DRAWER.pad },
  header: { flexDirection: 'row', alignItems: 'center', gap: HUD_DRAWER.heading.gap },
  status: { flex: 1, textAlign: 'right' },
});
