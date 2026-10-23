// /go/pair — a pairing link opened on this phone (US-006g, KC13): https://<host>/go/pair?api=…&code=…
// (Studio's QR, or a link the OS hands over) and automatos://go/pair?…. Outside the signed-in
// group, so a phone connected nowhere can open it. The params are untrusted text; PairLinkScreen
// reads them with parsePairLink and opens Connect prefilled, asking first when this phone already
// uses another server. Nothing pairs from a link: Connect stops at the confirm card (KC8).
import { useLocalSearchParams } from 'expo-router';

import { PairLinkScreen } from '../../src/connect/scanner/PairLinkScreen';

export default function PairLinkRoute() {
  return <PairLinkScreen params={useLocalSearchParams()} />;
}
