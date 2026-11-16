// The voice screen as app/(app)/voice.tsx mounts it (US-019j, KV17): '/voice', or
// '/voice?chat=<id>' for a conversation (src/voice/nav.ts voiceRoute, parseVoiceParams); without one
// it talks into A2's home thread (KC4). Full screen with no header: the (app) stack hides headers
// already, and the screen sets its own options too, so it stays so. The screen is VoiceScreen.tsx.
import { Stack } from 'expo-router';

import { VOICE_ROUTE_OPTIONS } from '../nav';
import { VoiceScreen, type VoiceScreenProps } from './VoiceScreen';

export function VoiceRouteScreen({ chatId }: VoiceScreenProps) {
  return (
    <>
      <Stack.Screen options={VOICE_ROUTE_OPTIONS} />
      <VoiceScreen chatId={chatId} />
    </>
  );
}
