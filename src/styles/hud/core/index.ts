// HUD's phone core (US-018b, D54): the rings, the waveform, the state chip, the transcript, the top
// bar and the buttons, and HudCore that composes them. Props only; phase 2 (US-016k) feeds HudCore
// A2's newest turn, and A6 reuses RingCore, Waveform, StateChip and Transcript as the voice screen
// in every style (D-ONE-VOICE, D60): their colours come from the resolved style.

export { HudButtons, type HudButtonsProps } from './HudButtons';
export { HudCore, type HudCoreProps } from './HudCore';
export { HudTopBar, type HudTopBarProps } from './HudTopBar';
export { RingCore, type RingCoreProps } from './RingCore';
export { StateChip, type StateChipProps } from './StateChip';
export { Transcript, type TranscriptProps } from './Transcript';
export { Waveform, type WaveformProps } from './WaveformView';
export * from './model';
export * from './ring-specs';
export * from './waveform';
