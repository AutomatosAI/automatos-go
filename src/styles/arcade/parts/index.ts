// Arcade's handheld parts (US-022f, D-ARC-6): the window and its scanlines, the status bar, the
// D-pad, the voice surround, the dialogue window and the buttons. Props only; the home (US-022g)
// feeds them its thread, counters and routes, and the edge screens and sheets use the window.
// Their colours and type come from the resolved style (use-arcade-paint.ts).

export { ArcadeButton, type ArcadeButtonProps } from './ArcadeButton';
export { ArcadeWindow, type ArcadeWindowProps } from './ArcadeWindow';
export { DialogueWindow, type DialogueWindowProps } from './DialogueWindow';
export { DPad, type DPadProps } from './DPad';
export { Scanlines, type ScanlinesProps } from './Scanlines';
export { StatusBar, type StatusBarProps } from './StatusBar';
export { VoiceSurround, type VoiceSurroundProps, SURROUND } from './VoiceSurround';
export * from './counters';
export * from './dialogue';
export * from './pad-grid';
export * from './window-frame';
