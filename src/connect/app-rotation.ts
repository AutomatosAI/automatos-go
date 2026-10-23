// The app's one token rotation (rotation.ts) over the app's device store and the real transport, so
// launch and resume share one call in flight (src/session/use-session-refresh.ts runs it). Tests use
// rotation.ts over a fake keychain and a fake transport.

import { expoTransport } from '../api/transport';
import { deviceStore } from './device-store';
import { createTokenRotation, type TokenRotation } from './rotation';

export const tokenRotation: TokenRotation = createTokenRotation({
  store: deviceStore,
  transport: expoTransport,
  now: () => new Date(),
});
