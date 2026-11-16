// A muted line under a section's card (whose switches these are, which time zone, a voice's help).
// Nothing is drawn without words.

import { Text } from './Text';
import { SECTION_NOTE_LEVEL, sectionNote } from './section-model';

export type SectionNoteProps = { readonly children: string | null | undefined };

export function SectionNote({ children }: SectionNoteProps) {
  const text = sectionNote(children);
  if (text === null) return null;
  return (
    <Text level={SECTION_NOTE_LEVEL} tone="muted">
      {text}
    </Text>
  );
}
