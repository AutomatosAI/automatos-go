// The voice screen (US-019j, KV17): '/voice', or '/voice?chat=<id>' for a conversation (src/voice/nav.ts
// voiceRoute); without one it talks into A2's home thread (KC4). Full screen with no header: the
// (app) stack hides headers already, and the screen sets its own options too, so it stays so.
import { Stack, useLocalSearchParams } from 'expo-router';

import { VOICE_ROUTE_OPTIONS, parseVoiceParams } from '../../src/voice/nav';
import { VoiceScreen } from '../../src/voice/screen/VoiceScreen';

export default function VoiceRoute() {
  const { chatId } = parseVoiceParams(useLocalSearchParams());
  return (
    <>
      <Stack.Screen options={VOICE_ROUTE_OPTIONS} />
      <VoiceScreen chatId={chatId} />
    </>
  );
}
