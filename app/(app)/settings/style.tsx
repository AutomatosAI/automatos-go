// Settings → Style and look (PRD-001 §4.7, US-016h): the style picker. The shell's StyleSync keeps
// the looks and the workspace's theme in step (US-016j); this one reads only if no other is mounted
// (sync/reader-guard.ts), and the picker asks for a theme read as it opens. The screen is
// src/styles/picker/StylePicker.
import { StylePicker } from '../../../src/styles/picker/StylePicker';
import { SyncedPage } from '../../../src/styles/sync/SyncedPage';

export default function StyleSettings() {
  return <SyncedPage page={StylePicker} />;
}
