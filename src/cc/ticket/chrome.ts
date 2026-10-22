// The ticket sheet's paints and sizes, pure (handoff §2 'ticket sheet', D-ONE-SET): every value the
// sheet draws with is a token key or a named size here, so TicketSheet only wires and A5 can dress
// it for Play and HUD in one place. The sheet's frame (grabber, radius, 12 pt between blocks) is
// the foundation's Sheet; the handoff's 9.5 px mono runs are the 11 pt label (D38).

import type { ColourName, RadiusName, SpaceName } from '../../styles/tokens';
import type { TextLevel, TextTone, Tone } from '../../ui/variants';

/** The head: the serif 23 title, the agent line at Body 5 (12), 500, muted. */
export const TICKET_HEAD = Object.freeze({
  titleLevel: 2 as TextLevel,
  bylineLevel: 5 as TextLevel,
  bylineWeight: 500 as const,
  bylineTone: 'muted' as TextTone,
  bylineGap: 'space2' as SpaceName,
  /** Between the kind row, the title and the agent line. */
  gap: 'space3' as SpaceName,
});

/** Running text: the description at Body 2 (13.5); a section's label in the mono label. */
export const TICKET_TEXT = Object.freeze({
  level: 2 as TextLevel,
  labelTone: 'muted' as TextTone,
  gap: 'space2' as SpaceName,
});

/** Why it sits in Review or Blocked: the card's reason chip and its sentence, muted. */
export const TICKET_REASON = Object.freeze({
  level: 3 as TextLevel,
  tone: 'muted' as TextTone,
  gap: 'space2' as SpaceName,
});

/** 'Waiting for your answer': the warning box, 12 × 14 in, 8 pt radius, the warn-ink label. */
export const QUESTION_BOX = Object.freeze({
  ground: 'warning' as Tone,
  border: 'warning' as ColourName,
  borderWidth: 1,
  radius: 'card' as RadiusName,
  paddingX: 'space6' as SpaceName,
  paddingY: 'space5' as SpaceName,
  gap: 'space3' as SpaceName,
  labelTone: 'warning' as TextTone,
  level: 3 as TextLevel,
  linkWeight: 500 as const,
});

/** A Deliverable row: 11 × 13 in, the package icon, the serif title, the type and Open. */
export const LINKED_ROW = Object.freeze({
  paddingY: 11,
  paddingX: 13,
  gap: 'space4' as SpaceName,
  iconSize: 15,
  iconColour: 'foreground' as ColourName,
  titleLevel: 4 as TextLevel,
  metaLevel: 5 as TextLevel,
  metaTone: 'muted' as TextTone,
  listGap: 'space3' as SpaceName,
});

/** The verdict: the effect line, the note, two buttons side by side; refusals in the accent ink. */
export const VERDICT = Object.freeze({
  effectLevel: 5 as TextLevel,
  effectTone: 'muted' as TextTone,
  refusalLevel: 3 as TextLevel,
  refusalTone: 'accent' as TextTone,
  gap: 'space4' as SpaceName,
  buttonGap: 'space5' as SpaceName,
});

/** Ask Auto about: the full-width outline button with the chat icon; the discuss hint above it. */
export const ASK_AUTO = Object.freeze({
  hintLevel: 5 as TextLevel,
  hintTone: 'muted' as TextTone,
  gap: 'space3' as SpaceName,
});
