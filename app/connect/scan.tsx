// /connect/scan — the QR scanner (US-006g), opened from Connect. A valid scan goes back to Connect
// prefilled, which stops at the confirm card (KC8); the scanner itself never pairs. The screen only
// wires; it is src/connect/scanner/ScanScreen.tsx.
import { ScanScreen } from '../../src/connect/scanner/ScanScreen';

export default function ScanRoute() {
  return <ScanScreen />;
}
