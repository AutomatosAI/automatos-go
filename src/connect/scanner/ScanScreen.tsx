// /connect/scan as app/connect/scan.tsx mounts it (US-006g), opened from Connect. A valid scan goes
// back to Connect prefilled with the server and the code (dismissTo: the Connect under it gets them,
// or replaces this screen when there is none), which stops at the confirm card (KC8); the scanner
// itself never pairs. Type the code and Back return to Connect's fields (useGoBack, Connect when
// nothing is behind). The scanner is QrScanner.tsx; where a scan goes, scan-state.ts.
import { useRouter } from 'expo-router';

import { routes } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import type { PairLink } from '../pair-link';
import { QrScanner } from './QrScanner';
import { connectRouteFor } from './scan-state';

export function ScanScreen() {
  const router = useRouter();
  const back = useGoBack(routes.connect);
  const onPairLink = (link: PairLink) => {
    router.dismissTo(connectRouteFor(link));
  };
  return <QrScanner onPairLink={onPairLink} onTypeCode={back} onBack={back} />;
}
