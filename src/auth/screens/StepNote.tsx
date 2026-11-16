// A step's note under its controls: a refusal in the server's own words (server-words.ts) or the
// machine's copy, never a code or a status. An alert to TalkBack; read out by VoiceOver when it
// appears or changes (iOS ignores live regions: useAnnounce).

import { Text, useAnnounce } from '../../ui';
import type { SignInNote } from '../sign-in-machine';
import { noteTone } from './sign-in-view';

const NOTE_LEVEL = 3;

export type StepNoteProps = { readonly note?: SignInNote };

export function StepNote({ note }: StepNoteProps) {
  useAnnounce(note?.text);
  if (!note) return null;
  return (
    <Text
      level={NOTE_LEVEL}
      tone={noteTone(note)}
      accessibilityRole={note.tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      {note.text}
    </Text>
  );
}
