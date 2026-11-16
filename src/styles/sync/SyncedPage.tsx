// A5's own screens (the Style and look picker and each style's look page, US-016h, US-017e,
// US-018c, US-022j, US-023m) with their StyleSync beside them: it reads the looks and sends each
// change as it is made where the style is installed in the workspace (US-017d), and reads only if
// no other is mounted (reader-guard.ts), so under the shell's own it is quiet. The routes under
// app/(app)/settings only mount it with their page (rule 4.4).
import type { ComponentType } from 'react';

import { StyleSync } from './StyleSync';

export function SyncedPage({ page: Page }: { readonly page: ComponentType }) {
  return (
    <>
      <StyleSync />
      <Page />
    </>
  );
}
