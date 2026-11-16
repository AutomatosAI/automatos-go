// Whether this app is the template or a copy of it (docs/app-standard.md 'The app's record'), as
// app-record.test.ts reads it. The template keeps no TEMPLATE.md: the test proves its checker on
// the standard's own example. A copy sets 'copy', and the test then requires its TEMPLATE.md,
// beside package.json, to name its template commit and the standard's, to carry both tables, and
// to cite only rules that exist (support/standard-rules.json, which the copy keeps as it took it).

import { frozen } from './types';

export type AppRole = 'template' | 'copy';

export const APP_RECORD: Readonly<{ role: AppRole }> = frozen({ role: 'template' });
