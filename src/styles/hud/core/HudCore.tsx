// HUD's phone core (D54, 'Automatos Command HUD.dc.html' 390 x 844): the screen HUD's home is, from
// props only. On HUD's ground (HudOverlay: the glow behind the core and the grid) and under its
// scanlines: the top bar (8 x 20) with the command row and the status row; the 290 core centred 14
// below with Auto 104 inside it when the look's auto is on (the Mascot decides); the state chip 10
// below; the transcript (24 at the sides) taking the room left; the waveform (20 at the sides); the
// buttons (14 / 24 / 34). Phase 2 (US-016k) feeds it A2's newest turn, Auto's state and the
// needs-you number; A6 opens the mic and gives HOLD TO TALK its voice. Outside HUD it draws nothing.

import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MascotName } from '../../../core/web/lib/mascot/types';
import { hudGroundPlan } from '../../ground/hud-ground';
import { HudOverlay } from '../../ground/HudOverlay';
import { Mascot } from '../../mascot/Mascot';
import type { MascotController } from '../../mascot/use-mascot';
import { HudButtons } from './HudButtons';
import { HudTopBar } from './HudTopBar';
import { HUD_CORE, coreSizeFor, mascotPlace, type HudTurn } from './model';
import { RingCore } from './RingCore';
import { StateChip } from './StateChip';
import { Transcript } from './Transcript';
import { useVoiceCore } from './use-voice-core';
import { Waveform } from './WaveformView';

export type HudCoreProps = {
  /** The newest turn (US-016k maps it from A2's thread). */
  readonly turn: HudTurn;
  /** A state to hold, or useMascot()'s controller: Auto in the core, the chip and the status row. */
  readonly mascotState: MascotName | MascotController;
  /** A6: the mic is open ('MIC LIVE'). */
  readonly micOpen: boolean;
  /** TYPE: phase 2 opens A2's composer. */
  readonly onType: () => void;
  /** STOP: A2's Stop, while the turn streams. */
  readonly onStop: () => void;
  /** The server's needs-you number (useNeedsYou's total): 'COMMAND · N'. */
  readonly needsYou: number;
  /** LOOK: the Looks drawer (US-018c). */
  readonly onLook: () => void;
  /** The menu square: Settings. */
  readonly onMenu: () => void;
  /** A6's live mic levels for the waveform, 0 to 1. */
  readonly levels?: readonly number[] | null;
};

/** The state Auto should show: the one held, or the controller's target. */
function stateOf(state: MascotName | MascotController): MascotName {
  return typeof state === 'string' ? state : state.driver.mascot.mascot;
}

function Core({ size, mascotState }: Pick<HudCoreProps, 'mascotState'> & { readonly size: number }) {
  const { paint } = useVoiceCore();
  const place = useMemo(() => mascotPlace(size), [size]);
  return (
    <View style={[styles.core, { width: size, height: size, marginTop: HUD_CORE.core.marginTop }]}>
      <RingCore size={size} colour={paint.accent} />
      <View pointerEvents="none" style={[styles.mascot, { left: place.left, top: place.top }]}>
        <Mascot size={place.size} state={mascotState} />
      </View>
    </View>
  );
}

export function HudCore(props: HudCoreProps) {
  const { turn, mascotState, micOpen, onType, onStop, needsYou, onLook, onMenu, levels } = props;
  const { style, paint } = useVoiceCore();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { hud, hudLook } = style;
  const plan = useMemo(() => (hud && hudLook ? hudGroundPlan(hudLook, hud) : null), [hud, hudLook]);
  if (!plan || !hud) return null;
  const state = stateOf(mascotState);
  return (
    <View style={[styles.screen, { backgroundColor: hud.bg }]}>
      <HudOverlay plan={plan} layer="ground" />
      <View style={[styles.column, { paddingTop: insets.top }]}>
        <HudTopBar
          turn={turn}
          state={state}
          micOpen={micOpen}
          needsYou={needsYou}
          onLook={onLook}
          onMenu={onMenu}
        />
        <Core size={coreSizeFor(height)} mascotState={mascotState} />
        <View style={{ marginTop: HUD_CORE.chip.marginTop }}>
          <StateChip state={state} />
        </View>
        <Transcript turn={turn} />
        <View style={{ paddingHorizontal: HUD_CORE.wave.padX }}>
          <Waveform colour={paint.accent} levels={levels} />
        </View>
        <HudButtons
          streaming={turn.streaming}
          onType={onType}
          onStop={onStop}
          bottomInset={insets.bottom}
        />
      </View>
      <HudOverlay plan={plan} layer="scanlines" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { flex: 1 },
  core: { alignSelf: 'center' },
  mascot: { position: 'absolute' },
});
