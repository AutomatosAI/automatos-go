// The social post sheet's paints and sizes, pure (D-ONE-SET): every value the sheet draws with is a
// token key or a named size, here or in the ticket sheet's chrome it shares (the head, a run of text
// and the verdict look the same on both), so the screens only wire and A5 dresses them in one place.

import type { ColourName, RadiusName, SpaceName } from '../../styles/tokens';
import type { TextLevel, TextTone } from '../../ui/variants';

/** The head: status chip and format on one row, the serif title, then when it publishes. */
export const SOCIAL_HEAD = Object.freeze({
  rowGap: 'space3' as SpaceName,
  formatLevel: 5 as TextLevel,
  formatTone: 'muted' as TextTone,
  whenLevel: 5 as TextLevel,
  whenWeight: 500 as const,
  whenTone: 'muted' as TextTone,
});

/** A channel: its name and post kinds in the mono label, then the copy it publishes. */
export const SOCIAL_CHANNEL = Object.freeze({
  labelTone: 'muted' as TextTone,
  textLevel: 2 as TextLevel,
  gap: 'space2' as SpaceName,
  listGap: 'space6' as SpaceName,
});

/** The media: each file in its own shape on the muted ground, no taller than 420 pt. */
export const SOCIAL_MEDIA = Object.freeze({
  maxHeight: 420,
  gap: 'space4' as SpaceName,
  radius: 'card' as RadiusName,
  ground: 'muted' as ColourName,
  border: 'border' as ColourName,
  borderWidth: 1,
  noteLevel: 5 as TextLevel,
  noteTone: 'muted' as TextTone,
  spinner: 'mutedForeground' as ColourName,
});

/** Notes under the post: who decides, nothing to decide, no channel. */
export const SOCIAL_NOTE = Object.freeze({
  level: 5 as TextLevel,
  tone: 'muted' as TextTone,
});
