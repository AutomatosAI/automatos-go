// HUD's top bar on the phone ('Automatos Command HUD.dc.html', KS10): 'AUTOMATOS //' in the look's
// display face (16, .18em; '//' in the accent) with the mic right (Geist Mono 500 11 .1em: '● MIC
// LIVE' in the accent whenever the mic is open, A6, else '○ MIC OFF' in text2); the command row the
// phone adds, 34 high in 1 pt accent lines — 'COMMAND · N' to the Board with the server's needs-you
// number (the caller's useNeedsYou), 'LOOK' and a menu square to Settings; and the status row,
// '<AGENT> · <STATE>' and the turn's mm:ss (Geist Mono 11 .1em, text2), ticking while it streams.
// A6's voice screen (US-019j) names the menu square for what it does there ('Close voice'), LOOK's
// hint and the status row's state word; without them the bar is HUD's home's.

import { useRouter } from 'expo-router';
import Menu from 'lucide-react-native/icons/menu';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MascotName } from '../../../core/web/lib/mascot/types';
import { routes } from '../../../navigation/routes';
import { Text } from '../../../ui';
import { ICON_STROKE, hitSlopFor } from '../../../ui/paint';
import { HUD_CORE_COPY } from '../../strings';
import { HUD_CORE, commandView, micView, statusRow, type HudTurn } from './model';
import { useVoiceCore, type VoiceCore } from './use-voice-core';

const { topBar, statusRow: statusPad, commandRow, tracking } = HUD_CORE;
const TICK_MS = 1000;
/** The menu square's glyph, inside its 34 pt square. */
const ICON_SIZE = 18;

/** Now, once a second while running (the status row's clock); still otherwise. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}

function BrandRow({ core, micOpen }: { readonly core: VoiceCore; readonly micOpen: boolean }) {
  const { paint, style } = core;
  const mic = micView(micOpen);
  const said = HUD_CORE_COPY;
  const monoFace = style.type.mono(HUD_CORE.monoSize, 500, { trackingEm: tracking.mono });
  return (
    <View style={[styles.row, { paddingVertical: topBar.padY, paddingHorizontal: topBar.padX }]}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={said.brandLabel}
        style={[style.type.display('brand'), { color: paint.text }]}
      >
        {`${said.brand} `}
        <Text style={{ color: paint.accent }}>{said.brandMark}</Text>
      </Text>
      <Text
        accessibilityLabel={mic.label}
        style={[monoFace, { color: mic.live ? paint.accent : paint.text2 }]}
      >
        {mic.text}
      </Text>
    </View>
  );
}

type RowButtonProps = {
  readonly core: VoiceCore;
  readonly label: string;
  readonly hint?: string;
  readonly square?: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
};

function RowButton({ core, label, hint, square = false, onPress, children }: RowButtonProps) {
  const { height, padItem, border } = commandRow;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlopFor(height, square ? height : undefined)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.rowButton,
        {
          minHeight: height,
          minWidth: height,
          paddingHorizontal: square ? 0 : padItem,
          borderWidth: border,
          borderColor: core.paint.accent,
          backgroundColor: pressed ? core.paint.accentFill : undefined,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

type CommandRowProps = {
  readonly core: VoiceCore;
  readonly needsYou: number;
  readonly onLook: () => void;
  readonly onMenu: () => void;
  readonly menuLabel?: string;
  readonly lookHint?: string;
};

function CommandRow({ core, needsYou, onLook, onMenu, menuLabel, lookHint }: CommandRowProps) {
  const router = useRouter();
  const { paint, style } = core;
  const command = commandView(needsYou);
  const said = HUD_CORE_COPY;
  const face = [
    style.type.mono(HUD_CORE.rowSize, 600, { trackingEm: tracking.row }),
    { color: paint.accent },
  ];
  return (
    <View
      style={[
        styles.row,
        {
          paddingVertical: commandRow.padY,
          paddingHorizontal: commandRow.padX,
          gap: commandRow.gap,
        },
      ]}
    >
      <RowButton core={core} label={command.label} onPress={() => router.push(routes.cc.board)}>
        <Text style={face}>{command.text}</Text>
      </RowButton>
      <View style={[styles.end, { gap: commandRow.gap }]}>
        <RowButton
          core={core}
          label={said.lookLabel}
          hint={lookHint ?? said.lookHint}
          onPress={onLook}
        >
          <Text style={face}>{said.look}</Text>
        </RowButton>
        <RowButton core={core} label={menuLabel ?? said.menuLabel} square onPress={onMenu}>
          <Menu size={ICON_SIZE} color={paint.accent} strokeWidth={ICON_STROKE} />
        </RowButton>
      </View>
    </View>
  );
}

type StatusRowProps = {
  readonly core: VoiceCore;
  readonly turn: HudTurn;
  readonly state: MascotName;
  readonly stateWord?: string;
};

function StatusRow({ core, turn, state, stateWord }: StatusRowProps) {
  const now = useNow(turn.streaming);
  const view = statusRow(turn, state, now, stateWord);
  const face = [
    core.style.type.mono(HUD_CORE.monoSize, 400, { trackingEm: tracking.mono }),
    { color: core.paint.text2 },
  ];
  return (
    <View
      accessible
      accessibilityLabel={view.label}
      style={[styles.row, { paddingVertical: statusPad.padY, paddingHorizontal: statusPad.padX }]}
    >
      <Text style={[face, styles.status]}>{view.text}</Text>
      <Text style={face}>{view.clock}</Text>
    </View>
  );
}

export type HudTopBarProps = {
  readonly turn: HudTurn;
  /** Auto's state: the status row's word. */
  readonly state: MascotName;
  /** A6: the mic is open ('MIC LIVE'). */
  readonly micOpen: boolean;
  /** The server's needs-you number (useNeedsYou's total). */
  readonly needsYou: number;
  readonly onLook: () => void;
  readonly onMenu: () => void;
  /** A6: what the menu square says to a screen reader ('Close voice'); else 'Settings'. */
  readonly menuLabel?: string;
  /** A6: LOOK's hint where it opens a style's look page; else HUD's. */
  readonly lookHint?: string;
  /** A6: the status row's state word (the voice screen's, 'Speaking'); else Auto's state's. */
  readonly stateWord?: string;
};

export function HudTopBar(props: HudTopBarProps) {
  const { turn, state, micOpen, needsYou, onLook, onMenu, menuLabel, lookHint, stateWord } = props;
  const core = useVoiceCore();
  return (
    <View>
      <BrandRow core={core} micOpen={micOpen} />
      <CommandRow
        core={core}
        needsYou={needsYou}
        onLook={onLook}
        onMenu={onMenu}
        menuLabel={menuLabel}
        lookHint={lookHint}
      />
      <StatusRow core={core} turn={turn} state={state} stateWord={stateWord} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  end: { flexDirection: 'row', alignItems: 'center' },
  rowButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  status: { flexShrink: 1 },
});
