// A step's note under its controls: a refusal in the server's own words (server-words.ts) or the
// machine's copy, never a code or a status. An alert to TalkBack; read out by VoiceOver when it
// changes (iOS ignores live regions, as in ToastProvider).

import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { Text } from '../../ui';
import type { SignInNote } from '../sign-in-machine';
import { noteTone } from './sign-in-view';

const NOTE_LEVEL = 3;

export type StepNoteProps = { readonly note?: SignInNote };

export function StepNote({ note }: StepNoteProps) {
  const text = note?.text;
  useEffect(() => {
    if (text && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
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
