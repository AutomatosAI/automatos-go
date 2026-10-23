// The app's consent records (store.ts) over the app's encrypted MMKV store, opened on first use, so
// importing this costs nothing until a record is read. Tests use store.ts over memoryStorage().
// consentMemory (memory.ts) is the one the gate, the sheet and the switch share (US-007c).

import { appStorage } from '../storage/mmkv';
import { createConsentMemory, type ConsentMemory } from './memory';
import { createConsentStore, type ConsentStore } from './store';

export const consentStore: ConsentStore = createConsentStore({ storage: appStorage });

export const consentMemory: ConsentMemory = createConsentMemory({ store: consentStore });
