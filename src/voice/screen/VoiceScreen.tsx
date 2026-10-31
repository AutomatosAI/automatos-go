// The voice screen (US-019j, D60, D-ONE-VOICE, PRD-001 §4.7): A5's HUD core
// (src/styles/hud/core/HudCore.tsx), never a copy of it, in every style, painted by voiceDress —
// the rings and Auto in the core, the state in words (the chip and the status row), MIC LIVE, the
// transcript, the waveform, TYPE · HOLD TO TALK · STOP — with every word from the voice view-model
// (KV8). The foundation's AiLabel, the one small muted caption (D73), is the first row of A5's
// Transcript inside the core: nothing on this screen is disabled on it, nothing waits for it.
// Reduce Motion (the style's motion) stills the rings, the waveform and the cursor; the chip, MIC
// LIVE and the transcript say what they showed. TYPE opens A2's Composer in the foundation's Sheet.
// Until A2's home thread is chosen (KC4) the screen waits, and opens no thread.
// Report this (D15, P001R-AF-1): a long-press or the accessible action on Auto's saved reply in the
// transcript opens the foundation's one ReportSheet (A2's useMessageReport), beside TYPE's Sheet.
// In Arcade (the dress's sprite) the core draws Arcade's one pause control under its top bar
// (P001A-RVW-1, WCAG 2.2.2): the sprite, the rings and the waveform loop for the whole session. In
// Candy (the dress's candy) it draws Candy's there instead (US-023l, D-CAN-5): Candy's Auto, the
// orb's arc, the rings and the waveform loop as long. Never both; no control in any other style.

import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';

import { Composer } from '../../chat/composer/Composer';
import { canStop } from '../../chat/controller/thread';
import { useMessageReport } from '../../chat/report/use-message-report';
import { PauseButton } from '../../styles/arcade/PauseButton';
import { CandyPauseButton } from '../../styles/candy/CandyPauseButton';
import { statusBarStyle } from '../../styles/ground/ground';
import { HudCore } from '../../styles/hud/core/HudCore';
import { useStyle } from '../../styles/theme';
import { ErrorState, LoadingState, ReportSheet, Screen, Sheet } from '../../ui';
import { useVoiceChat } from '../quick-ask/use-voice-chat';
import type { VoiceCoreProps } from './core-props';
import { useVoiceScreen, type VoiceScreenModel } from './use-voice-screen';
import { VoiceLine } from './VoiceLine';

const DRAFT_KEY = 'draft';

export type VoiceScreenProps = {
  /** The route's conversation ('/voice?chat=<id>'); null for A2's home thread. */
  readonly chatId: string | null;
};

/** The home thread is being chosen, or could not be: loading, or the error with Retry. */
function Waiting({ error, onRetry }: { readonly error: unknown; readonly onRetry: () => void }) {
  return (
    <Screen ground="chat">
      {error ? <ErrorState error={error} onRetry={onRetry} /> : <LoadingState />}
    </Screen>
  );
}

/** TYPE: A2's Composer in the foundation's Sheet, on the voice screen's thread (never spoken). */
function TypeSheet({ model }: { readonly model: VoiceScreenModel }) {
  const { thread, role, typing, on } = model;
  const { state } = thread;
  return (
    <Sheet visible={typing} onClose={on.closeType}>
      <Composer
        role={role}
        streaming={canStop(state)}
        loading={state.status === 'loading' || state.settling}
        onSend={on.sendTyped}
        onStop={thread.stop}
      />
    </Sheet>
  );
}

/** The core's slot under its top bar: Arcade's pause or Candy's, never both; none elsewhere. */
function pauseControl({ sprite, candy }: Pick<VoiceCoreProps, 'sprite' | 'candy'>): ReactNode {
  if (sprite) return <PauseButton />;
  return candy ? <CandyPauseButton /> : undefined;
}

function VoiceThread({ chatId }: { readonly chatId: string | null }) {
  const model = useVoiceScreen(chatId);
  const { tone } = useStyle();
  const { report, sheet } = useMessageReport();
  const { thread, view, on } = model;
  if (thread.loadError) return <Waiting error={thread.loadError} onRetry={thread.retry} />;
  return (
    <>
      <StatusBar style={statusBarStyle(tone)} />
      <HudCore
        turn={model.turn}
        mascotState={model.mascot}
        micOpen={view.mic === 'live'}
        onType={on.type}
        onStop={on.stop}
        needsYou={model.needsYou}
        onLook={on.look}
        onMenu={on.close}
        levels={model.levels}
        voice={{ ...model.core, line: <VoiceLine line={model.line} onAction={on.lineAction} /> }}
        report={report}
        controls={pauseControl(model.core)}
      />
      <TypeSheet model={model} />
      <ReportSheet {...sheet} />
    </>
  );
}

export function VoiceScreen({ chatId }: VoiceScreenProps) {
  const chat = useVoiceChat(chatId);
  if (chat.chatId === undefined) return <Waiting error={chat.error} onRetry={chat.retry} />;
  // another conversation is another voice session: a fresh engine and AI-notice session (KV7)
  return <VoiceThread key={chat.chatId ?? DRAFT_KEY} chatId={chat.chatId} />;
}
