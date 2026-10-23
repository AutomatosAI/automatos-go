// /connect — connect to your own server (PRD-001 §4.5). The route's prefill (src/navigation/routes.ts
// connectWith: the server and the code a scan, a link or the gate handed over) is untrusted text,
// kept only when it could be one; Connect validates both and stops at the confirm card (KC8).
import { useLocalSearchParams } from 'expo-router';

import { ConnectScreen } from '../../src/connect/screens/ConnectScreen';
import { connectPrefillFromParams } from '../../src/navigation/routes';

export default function ConnectRoute() {
  const prefill = connectPrefillFromParams(useLocalSearchParams());
  return <ConnectScreen prefill={prefill} />;
}
