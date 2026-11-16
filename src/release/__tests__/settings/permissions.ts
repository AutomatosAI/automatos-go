// The permission audit's allowed list (permissions.test.ts, R08): the files allowed to import the
// photo picker as a value.

import { reasoned } from './types';

export const PICKER_CALLERS = reasoned(
  'The one file that calls expo-image-picker; picked.ts builds its options (type-only import).',
  ['src/chat/attachments/pickers.ts'],
);
