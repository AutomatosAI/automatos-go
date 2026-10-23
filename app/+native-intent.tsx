// Links the OS hands the app (iOS universal links, Android App Links: app.json K9) before
// expo-router resolves them (P001N-SEAM-3). The mapping is src/navigation/web-links.ts's; this
// file only delegates.
import type { NativeIntent } from 'expo-router';

import { appPathForSystemLink } from '../src/navigation/web-links';

export const redirectSystemPath: NonNullable<NativeIntent['redirectSystemPath']> = ({ path }) =>
  appPathForSystemLink(path);
