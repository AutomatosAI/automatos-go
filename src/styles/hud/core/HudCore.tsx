// HUD's phone core (D54, 'Automatos Command HUD.dc.html' 390 x 844): the screen HUD's home is, from
// props only. On HUD's ground (HudOverlay: the glow behind the core and the grid) and under its
// scanlines: the top bar (8 x 20) with the command row and the status row; the 290 core centred 14
// below with Auto 104 inside it when the look's auto is on (the Mascot decides); the state chip 10
// below; the transcript (24 at the sides) taking the room left; the waveform (20 at the sides); the
// buttons (14 / 24 / 34). LOOK opens the Looks drawer over it all (US-018c), the same drawer
// Settings hosts. Phase 2 (US-016k) feeds it A2's newest turn, Auto's state and the needs-you
// number; A6 opens the mic and gives HOLD TO TALK its voice. Outside HUD it draws nothing.
//   A6's voice screen (US-019j, D-ONE-VOICE) passes `voice`: the core then draws in every style,
// painted by voiceDress — on the style's own background, with HUD's ground and scanlines only where
// the dress says, the rings' structure in its line colour, Auto in the core only where the dress
// puts him — with the voice view-model's chip and status words, its line under the chip, HOLD TO
// TALK's hold, STOP and TYPE as the voice says, the menu square named for closing the screen, and
// LOOK going to the style's look page (onLook) instead of opening HUD's drawer here.
//   A6's quick-ask on HUD's home (US-019k) passes `quickAsk` instead: HUD's home as A5 built it, with
// HOLD TO TALK's hold, STOP on while the voice works, and, while it does or has a line, the voice's
// chip and status word and its line under the chip. Under `voice` it is not read.

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import { hudGroundPlan, type HudGroundPlan } from '../../ground/hud-ground';
import { HudOverlay } from '../../ground/HudOverlay';
import { Mascot } from '../../mascot/Mascot';
import type { MascotController } from '../../mascot/use-mascot';
import { LooksDrawer } from '../LooksDrawer';
import { HudButtons } from './HudButtons';
import { HudTopBar } from './HudTopBar';
import {
  HUD_CORE,
  coreSizeFor,
  mascotPlace,
  type ChipView,
  type HudTalk,
  type HudTurn,
} from './model';
import { RingCore } from './RingCore';
import { StateChip } from './StateChip';
import { Transcript } from './Transcript';
import { useVoiceCore } from './use-voice-core';
import { Waveform } from './WaveformView';

/** A6's voice screen: the core in every style, with the voice's words and HOLD TO TALK live. */
export type HudCoreVoice = {
  /** The rings' structure (Studio's ink); their motion keeps the accent. */
  readonly ringLine: string;
  /** HUD's ground and scanlines; otherwise the style's own background alone. */
  readonly overlay: boolean;
  /** Auto (the Mascot) in the centre of the rings. */
  readonly mascotInCore: boolean;
  /** The chip's words, and the status row's word (chip.label). */
  readonly chip: ChipView;
  readonly talk: HudTalk;
  /** STOP is on: the mic is held or Auto has the voice's turn. */
  readonly stopEnabled: boolean;
  readonly typeEnabled: boolean;
  /** What the menu square says ('Close voice'); onMenu closes the screen. */
  readonly menuLabel: string;
  /** LOOK's hint: it opens the style's look page (onLook). */
  readonly lookHint: string;
  /** Drawn under the state chip: the voice's line and its button. */
  readonly line?: ReactNode;
};

/** A6's quick-ask on HUD's home: HOLD TO TALK live in place; the rest is HUD's home's own. */
export type HudCoreQuickAsk = {
  readonly talk: HudTalk;
  /** STOP is on: the mic is held, Auto has the voice's turn, or a typed turn streams. */
  readonly stopEnabled: boolean;
  /** The voice's chip and status word; absent, Auto's state's (HUD's home's own). */
  readonly chip?: ChipView;
  /** Drawn under the state chip: the voice's line and its button. */
  readonly line?: ReactNode;
};

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
  /** LOOK opens the Looks drawer over the core (US-018c); this hears it too. */
  readonly onLook?: () => void;
  /** The menu square: Settings. */
  readonly onMenu: () => void;
  /** A6's live mic levels for the waveform, 0 to 1. */
  readonly levels?: readonly number[] | null;
  /** A6's voice screen; absent, HUD's home exactly as A5 built it. */
  readonly voice?: HudCoreVoice;
  /** A6's quick-ask on HUD's home; absent, HOLD TO TALK inert as A5 built it. */
  readonly quickAsk?: HudCoreQuickAsk;
};

/** The state Auto should show: the one held, or the controller's target. */
function stateOf(state: MascotName | MascotController): MascotName {
  return typeof state === 'string' ? state : state.driver.mascot.mascot;
}

type CoreProps = Pick<HudCoreProps, 'mascotState' | 'voice'> & { readonly size: number };

function Core({ size, mascotState, voice }: CoreProps) {
  const { paint } = useVoiceCore();
  const place = useMemo(() => mascotPlace(size), [size]);
  return (
    <View style={[styles.core, { width: size, height: size, marginTop: HUD_CORE.core.marginTop }]}>
      <RingCore size={size} colour={paint.accent} lineColour={voice?.ringLine} />
      {voice && !voice.mascotInCore ? null : (
        <View pointerEvents="none" style={[styles.mascot, { left: place.left, top: place.top }]}>
          <Mascot size={place.size} state={mascotState} />
        </View>
      )}
    </View>
  );
}

type Frame = { readonly background: string; readonly plan: HudGroundPlan | null };

/**
 * What the core stands on: HUD's background, ground and scanlines (nothing outside HUD); the voice
 * screen's in every style, the style's background with HUD's overlay where the dress says.
 */
function useFrame(voice: HudCoreVoice | undefined): Frame | null {
  const { style } = useVoiceCore();
  const { hud, hudLook } = style;
  const plan = useMemo(() => (hud && hudLook ? hudGroundPlan(hudLook, hud) : null), [hud, hudLook]);
  if (voice)
    return { background: style.tokens.colours.background, plan: voice.overlay ? plan : null };
  return plan && hud ? { background: hud.bg, plan } : null;
}

type OverlayProps = {
  readonly plan: HudGroundPlan | null;
  readonly layer: 'ground' | 'scanlines';
};

/** HUD's ground or scanlines, where the frame has them. */
function Overlay({ plan, layer }: OverlayProps) {
  return plan ? <HudOverlay plan={plan} layer={layer} /> : null;
}

/** What quick-ask changes on HUD's home: HOLD TO TALK, STOP, and the voice's words while given. */
function quickAskParts(quick: HudCoreQuickAsk) {
  return {
    bar: quick.chip ? { stateWord: quick.chip.label } : {},
    chip: quick.chip,
    line: quick.line ?? null,
    buttons: { streaming: quick.stopEnabled, talk: quick.talk },
  };
}

/** What the voice group (or quick-ask) changes in the column; HUD's home's own values without. */
function columnParts(voice: HudCoreVoice | undefined, turn: HudTurn, quick?: HudCoreQuickAsk) {
  if (!voice && quick) return quickAskParts(quick);
  if (!voice)
    return { bar: {}, chip: undefined, line: null, buttons: { streaming: turn.streaming } };
  return {
    bar: { menuLabel: voice.menuLabel, lookHint: voice.lookHint, stateWord: voice.chip.label },
    chip: voice.chip,
    line: voice.line ?? null,
    buttons: { streaming: voice.stopEnabled, talk: voice.talk, typeEnabled: voice.typeEnabled },
  };
}

/** LOOK: HUD's drawer over the core on HUD's home; the voice screen's onLook alone. */
function useLooks(onLook: (() => void) | undefined, inPlace: boolean) {
  const [looking, setLooking] = useState(false);
  const openLooks = useCallback(() => {
    if (inPlace) setLooking(true);
    onLook?.();
  }, [onLook, inPlace]);
  const closeLooks = useCallback(() => setLooking(false), []);
  return { looking, openLooks, closeLooks };
}

export function HudCore(props: HudCoreProps) {
  const { turn, mascotState, micOpen, onType, onStop, needsYou, onLook, onMenu, levels } = props;
  const { voice } = props;
  const { paint } = useVoiceCore();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { looking, openLooks, closeLooks } = useLooks(onLook, voice === undefined);
  const frame = useFrame(voice);
  if (!frame) return null;
  const state = stateOf(mascotState);
  const parts = columnParts(voice, turn, props.quickAsk);
  return (
    <View style={[styles.screen, { backgroundColor: frame.background }]}>
      <Overlay plan={frame.plan} layer="ground" />
      <View style={[styles.column, { paddingTop: insets.top }]}>
        <HudTopBar
          turn={turn}
          state={state}
          micOpen={micOpen}
          needsYou={needsYou}
          onLook={openLooks}
          onMenu={onMenu}
          {...parts.bar}
        />
        <Core size={coreSizeFor(height)} mascotState={mascotState} voice={voice} />
        <View style={{ marginTop: HUD_CORE.chip.marginTop }}>
          <StateChip state={state} words={parts.chip} />
        </View>
        {parts.line}
        <Transcript turn={turn} />
        <View style={{ paddingHorizontal: HUD_CORE.wave.padX }}>
          <Waveform colour={paint.accent} levels={levels} />
        </View>
        <HudButtons
          onType={onType}
          onStop={onStop}
          bottomInset={insets.bottom}
          {...parts.buttons}
        />
      </View>
      <Overlay plan={frame.plan} layer="scanlines" />
      {looking ? <LooksDrawer overlay onClose={closeLooks} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { flex: 1 },
  core: { alignSelf: 'center' },
  mascot: { position: 'absolute' },
});
