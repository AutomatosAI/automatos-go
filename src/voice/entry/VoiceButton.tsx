// The voice button (US-019k): a 42 pt round IconButton with lucide's mic, beside a composer's send
// (A2's Composer through its accessory slot, from ChatScreen; Play's PlayComposer). A tap opens the
// voice screen on the open conversation and nothing else: the microphone opens only on HOLD TO TALK
// there (KV5). Not there for viewers (D-ROLES); never held by the AI label (D73). It imports nothing
// from src/chat or src/styles, so the composers that carry it make no import cycle.

import { useRouter } from 'expo-router';
import Mic from 'lucide-react-native/icons/mic';

import { IconButton } from '../../ui';
import { voiceEntry, type VoiceEntryInput } from './voice-entry';

export type VoiceButtonProps = VoiceEntryInput;

export function VoiceButton({ roleCanChat, chatId }: VoiceButtonProps) {
  const router = useRouter();
  const entry = voiceEntry({ roleCanChat, chatId });
  if (!entry.visible) return null;
  return (
    <IconButton
      icon={Mic}
      accessibilityLabel={entry.label}
      accessibilityHint={entry.hint}
      onPress={() => router.push(entry.route)}
      variant="outline"
      size="lg"
      round
      disabled={!entry.enabled}
    />
  );
}
