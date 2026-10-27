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
    expect(hook).toMatch(/languages: languageRows\(saved, phone\)/);
    expect(hook).toMatch(
      /chooseLanguage: \(choice\) => save\(withSpeakChoice\(voiceSetting\.get\(\), choice\)\)/,
    );
  });
});

describe('hold to talk in the chosen language (source)', () => {
  const quickAsk = code(read('voice/quick-ask/use-quick-ask.ts'));
  const recognizer = code(read('voice/quick-ask/recognizer.ts'));
  const hold = code(read('voice/quick-ask/quick-ask-hold.ts'));

  it('listens and speaks in "I speak"’s locale, and tells the engine when it changes', () => {
    expect(quickAsk).toMatch(/return spokenLanguage\(setting, phone, voices\);/);
    expect(quickAsk).toMatch(/const \{ language, voices, setting \} = useSpokenLanguage\(\);/);
    expect(quickAsk).toMatch(
      /useEffect\(\(\) => engine\.languageChanged\(\), \[engine, language\]\);/,
    );
  });

  it('asks the policy for the speech’s language, with the phone’s own locale beside it', () => {
    expect(hold).toMatch(
      /engine\.deps\.recognizer\.policy\(engine\.deps\.context\(\)\.speech\.language\)/,
    );
    expect(recognizer).toMatch(
      /return \{ \.\.\.\(await core\.probe\(device\(\), locale\)\), phoneLocale: phoneLocale\(\) \};/,
    );
  });

  it('names the chosen and the phone’s language on the voice screen and HUD’s home', () => {
    for (const file of ['voice/screen/use-voice-screen.ts', 'voice/home/use-hud-home-voice.ts']) {
      const hook = code(read(file));
      expect(hook, file).toMatch(/const \{ listening, phone \} = useListening\(\);/);
      expect(hook, file).toMatch(/locale: listening,\s*phoneLocale: phone,/);
    }
  });
});

describe('Settings → Voice: the chosen language’s voice (source)', () => {
  const hook = code(read('voice/settings/use-voice-settings.ts'));
  const screen = code(read('voice/settings/VoiceSettingsScreen.tsx'));

  it('lists the language’s voices, and saves a tap for that language alone', () => {
    expect(hook).toMatch(
      /const \{ language, voices, setting \} = spokenLanguage\(saved, phone, all\);/,
    );
    expect(hook).toMatch(
      /server: serverVoiceRows\(voices, setting, hasServerDefault\(language\)\)/,
    );
    expect(hook).toMatch(
      /chooseServer: \(choice\) => keep\(withServerChoice\(mine\(\), choice\)\)/,
    );
    expect(hook).toMatch(/choose: \(voice\) => keep\(\{ \.\.\.mine\(\), voice \}\)/);
    expect(hook).toMatch(/save\(withLanguageVoice\(voiceSetting\.get\(\), language, chosen\)\)/);
    expect(hook).toMatch(/reset: \(\) => save\(resetLanguage\(voiceSetting\.get\(\), language\)\)/);
    expect(screen).toMatch(/<ServerVoiceList rows=\{view\.server\} note=\{view\.serverNote\}/);
  });

  it('plays the sample in the saved language, as quick-ask would speak it', () => {
    expect(hook).toMatch(
      /const \{ language, voices, setting \} = spokenLanguage\(saved, phone, all\);\s*const server = serverSpeechFor/,
    );
    expect(hook).toMatch(/void player\.play\(language, setting, server\);/);
  });
});
