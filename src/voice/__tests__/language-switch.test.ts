// The EN/PT switch beside HOLD TO TALK (27 Oct 2026): always there for someone who may talk, so
// one tap flips it from the default state (Automatic); it shows the listening language's letters,
// says what it does to VoiceOver ('Speaking English. Switch to Portuguese'), toggles between
// English and the chosen Portuguese (Portugal's until Brazil's is picked), and is 44 pt to touch.

import { describe, expect, it, vi } from 'vitest';

import { DRESS_MIN_HEIGHT, PLAY_PILL_HEIGHT } from '../../styles/dress/dress';
import { HUD_CORE } from '../../styles/hud/core/model';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { MIN_TOUCH, hitSlopFor } from '../../ui/paint';
import { PILL_HEIGHT } from '../../ui/variants';
import {
  languageSwitch,
  listeningLocale,
  switchedChoice,
  withSpeakChoice,
} from '../language/speak-language';
import { DEFAULT_VOICE_SETTING, type VoiceSetting } from '../settings/voice-setting';
import { createVoiceSettingStore } from '../settings/voice-setting-store';

const ENGLISH_PHONE = 'en-GB';

function memoryStore() {
  const items = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: vi.fn(),
  };
  return createVoiceSettingStore(() => storage);
}

/** A tap, as use-language-switch.ts saves it. */
function tap(store: ReturnType<typeof memoryStore>, phone = ENGLISH_PHONE): void {
  const saved = store.get();
  store.set(withSpeakChoice(saved, switchedChoice(saved, phone)));
}

describe('what the switch shows and says', () => {
  it('from the default (Automatic) on an English phone: EN, switching to Portuguese', () => {
    expect(languageSwitch(DEFAULT_VOICE_SETTING, ENGLISH_PHONE)).toEqual({
      text: 'EN',
      label: 'Speaking English. Switch to Portuguese',
      hint: 'Changes the language hold to talk listens in and Auto answers in',
      next: 'pt-PT',
    });
  });

  it('in Portuguese: PT, switching to English', () => {
    const portugal: VoiceSetting = { ...DEFAULT_VOICE_SETTING, language: 'pt-PT' };
    expect(languageSwitch(portugal, ENGLISH_PHONE)).toMatchObject({
      text: 'PT',
      label: 'Speaking Portuguese. Switch to English',
      next: 'en',
    });
  });

  it('goes to the Portuguese last chosen: Brazil’s once picked', () => {
    const brazil = withSpeakChoice(withSpeakChoice(DEFAULT_VOICE_SETTING, 'pt-BR'), 'en');
    expect(languageSwitch(brazil, ENGLISH_PHONE).next).toBe('pt-BR');
  });

  it('Automatic on a Portuguese phone shows PT and switches to English', () => {
    expect(languageSwitch(DEFAULT_VOICE_SETTING, 'pt-PT')).toMatchObject({
      text: 'PT',
      next: 'en',
    });
  });

  it('Automatic on a phone in neither shows its language and switches to English', () => {
    expect(languageSwitch(DEFAULT_VOICE_SETTING, 'fr-FR')).toMatchObject({
      text: 'FR',
      label: 'Speaking French. Switch to English',
      next: 'en',
    });
  });
});

describe('a tap', () => {
  it('flips English and Portuguese, saved where every reader hears it', () => {
    const store = memoryStore();
    const heard = vi.fn();
    store.subscribe(heard);
    tap(store);
    expect(listeningLocale(store.get(), ENGLISH_PHONE)).toBe('pt-PT');
    tap(store);
    expect(listeningLocale(store.get(), ENGLISH_PHONE)).toBe('en-GB');
    tap(store);
    expect(listeningLocale(store.get(), ENGLISH_PHONE)).toBe('pt-PT');
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('keeps the voice, speed and pitch as they were', () => {
    const store = memoryStore();
    store.set({ ...DEFAULT_VOICE_SETTING, serverVoice: 'bm_george', rate: 1.1 });
    tap(store);
    expect(store.get()).toMatchObject({ serverVoice: 'bm_george', rate: 1.1, language: 'pt-PT' });
  });
});

describe('a 44 pt target', () => {
  it('HUD’s square is 44 pt', () => {
    expect(HUD_CORE.buttons.language.size).toBe(MIN_TOUCH);
    expect(MIN_TOUCH).toBe(44);
  });

  it('the pill is 44 pt wide and, with its slop, 44 pt tall in every style', () => {
    // Studio's, Play's and HUD's pill heights (styles/dress/dress.ts).
    for (const minHeight of [PILL_HEIGHT, PLAY_PILL_HEIGHT, DRESS_MIN_HEIGHT]) {
      const slop = hitSlopFor(minHeight);
      expect(minHeight + slop.top + slop.bottom, String(minHeight)).toBeGreaterThanOrEqual(
        MIN_TOUCH,
      );
    }
  });
});
