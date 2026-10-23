// The app's consent records (store.ts) over the app's encrypted MMKV store, opened on first use, so
// importing this costs nothing until a record is read. Tests use store.ts over memoryStorage().

import { appStorage } from '../storage/mmkv';
import { createConsentStore, type ConsentStore } from './store';

export const consentStore: ConsentStore = createConsentStore({ storage: appStorage });
