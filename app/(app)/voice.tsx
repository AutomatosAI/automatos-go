// The voice screen (US-019j, KV17): '/voice', or '/voice?chat=<id>' for a conversation (src/voice/nav.ts
// voiceRoute); without one it talks into A2's home thread (KC4). Full screen with no header. The
// screen only wires the route's params; it is src/voice/screen/VoiceRouteScreen.tsx.
import { useLocalSearchParams } from 'expo-router';

import { parseVoiceParams } from '../../src/voice/nav';
import { VoiceRouteScreen } from '../../src/voice/screen/VoiceRouteScreen';

export default function VoiceRoute() {
  const { chatId } = parseVoiceParams(useLocalSearchParams());
  return <VoiceRouteScreen chatId={chatId} />;
}
