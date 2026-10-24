// Settings → Style and look (PRD-001 §4.7, US-016h): the style picker. StyleSync is mounted so the
// looks and the workspace's theme are read when the screen opens (its readers arrive with US-017d
// and US-016i); the screen is src/styles/picker/StylePicker.
import { StylePicker } from '../../../src/styles/picker/StylePicker';
import { StyleSync } from '../../../src/styles/sync/StyleSync';

export default function StyleSettings() {
  return (
    <>
      <StyleSync />
      <StylePicker />
    </>
  );
}
