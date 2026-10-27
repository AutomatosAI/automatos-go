// "I speak" and the EN/PT switch, wired (27 Oct 2026), read from source (vitest runs in node with no
// React renderer, and these files load React Native): Settings → Voice draws "I speak" first, each
// language a ListRow that says whether it is chosen, and a tap saves the choice.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..', '..');
const read = (file: string) => readFileSync(path.resolve(SRC, file), 'utf8');
/** The code alone: comments stripped. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Settings → Voice: "I speak"', () => {
  const screen = code(read('voice/settings/VoiceSettingsScreen.tsx'));
  const sections = code(read('voice/settings/VoiceSections.tsx'));
  const hook = code(read('voice/settings/use-voice-settings.ts'));

  it('comes first, under the title, before the voices', () => {
    const head = screen.indexOf('<Head lede={view.lede} />');
    const languages = screen.indexOf('<LanguageList');
    expect(head).toBeGreaterThan(-1);
    expect(languages).toBeGreaterThan(head);
    expect(screen.indexOf('<ServerVoiceList')).toBeGreaterThan(languages);
  });

  it('is a list of rows that say whether they are chosen, each saving its choice', () => {
    expect(sections).toMatch(/<Titled title=\{LANGUAGE_COPY\.section\}>/);
    expect(sections).toMatch(
      /hint=\{LANGUAGE_COPY\.rowHint\} onPress=\{\(row\) => onChoose\(row\.key\)\}/,
    );
    expect(sections).toMatch(/selected=\{row\.selected\}/);
    expect(hook).toMatch(/languages: languageRows\(setting, phone\)/);
    expect(hook).toMatch(
      /chooseLanguage: \(choice\) => save\(withSpeakChoice\(voiceSetting\.get\(\), choice\)\)/,
    );
  });
});
