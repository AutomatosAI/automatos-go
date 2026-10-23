// /connect/scan — the QR scanner (US-006g), opened from Connect. A valid scan goes back to Connect
// prefilled with the server and the code (dismissTo: the Connect under it gets them, or replaces
// this screen when there is none), which stops at the confirm card (KC8); the scanner itself never
// pairs. Type the code and Back return to Connect's fields.
import { useRouter } from 'expo-router';

import { QrScanner } from '../../src/connect/scanner/QrScanner';
import { connectRouteFor } from '../../src/connect/scanner/scan-state';
import type { PairLink } from '../../src/connect/pair-link';
import { routes } from '../../src/navigation/routes';
import { useGoBack } from '../../src/navigation/use-go-back';

export default function ScanRoute() {
  const router = useRouter();
  const back = useGoBack(routes.connect);
  const onPairLink = (link: PairLink) => router.dismissTo(connectRouteFor(link));
  return <QrScanner onPairLink={onPairLink} onTypeCode={back} onBack={back} />;
}
