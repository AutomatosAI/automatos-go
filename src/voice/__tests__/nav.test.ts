// The voice screen's app path (US-019j, KV17): voiceRoute builds '/voice' or '/voice?chat=<id>' for
// an id routes.ts's isUsableId takes (never a space or a slash), parseVoiceParams reads it back the way
// expo-router hands it over (decoded, possibly an array), and LOOK's destination is the style's
// look page. src/navigation/routes.ts is not this kit's; nothing here edits it.

import { describe, expect, it } from 'vitest';

import { routes } from '../../navigation/routes';
import { STYLE_SCREENS } from '../../styles/nav';
import {
  VOICE_CHAT_PARAM,
  VOICE_ROUTE_OPTIONS,
  VOICE_SCREENS,
  parseVoiceParams,
  voiceLookPath,
  voiceRoute,
} from '../nav';

/** What expo-router hands the screen for a built route: the query, decoded. */
function paramsOf(route: string): Record<string, string> {
  const query = route.split('?')[1] ?? '';
  return Object.fromEntries(new URLSearchParams(query).entries());
}

describe('voiceRoute', () => {
  it("is '/voice' with no id: the home thread (KC4)", () => {
    expect(VOICE_SCREENS.voice).toBe('/voice');
    expect(voiceRoute()).toBe('/voice');
    expect(voiceRoute(null)).toBe('/voice');
    expect(voiceRoute(undefined)).toBe('/voice');
  });

  it("is '/voice' for an id that cannot be one: blank, spaces, a dot segment", () => {
    ['', '   ', '.', '..', ' .. '].forEach((id) => expect(voiceRoute(id)).toBe('/voice'));
  });

  it("names the conversation in the query: '/voice?chat=<id>'", () => {
    expect(voiceRoute('c-123')).toBe('/voice?chat=c-123');
    expect(VOICE_CHAT_PARAM).toBe('chat');
  });

  it('names no conversation by an id with spaces, slashes or the query’s own characters', () => {
    // the id goes on into a request path (routes.ts isUsableId): the home thread instead
    ['a b/c', 'x&y=z?#', 'é/ü', 'a%2Fb', '../c-1'].forEach((id) =>
      expect(voiceRoute(id)).toBe('/voice'),
    );
  });

  it('trims the id it is given', () => {
    expect(voiceRoute('  c-123  ')).toBe('/voice?chat=c-123');
  });

  it('never writes into the foundation’s route table (KV17)', () => {
    expect(Object.values(routes)).not.toContain(VOICE_SCREENS.voice);
  });
});

describe('parseVoiceParams', () => {
  it('reads no id as the home thread', () => {
    expect(parseVoiceParams({})).toEqual({ chatId: null });
    expect(parseVoiceParams({ [VOICE_CHAT_PARAM]: undefined })).toEqual({ chatId: null });
  });

  it('reads a plain id', () => {
    expect(parseVoiceParams({ chat: 'c-123' })).toEqual({ chatId: 'c-123' });
  });

  it('round-trips a conversation id through the built route', () => {
    ['c-123', '9b1c2a54-0000-4000-8000-0000000000d1', 'chat_1.v2'].forEach((id) =>
      expect(parseVoiceParams(paramsOf(voiceRoute(id)))).toEqual({ chatId: id }),
    );
  });

  it('reads no id with spaces, slashes or the query’s own characters from untrusted params', () => {
    ['a b/c', 'one two', 'x/y/z', 'x&y=z?#', 'é/ü'].forEach((chat) =>
      expect(parseVoiceParams({ chat })).toEqual({ chatId: null }),
    );
  });

  it('takes the first of a repeated key', () => {
    expect(parseVoiceParams({ chat: ['first', 'second'] })).toEqual({ chatId: 'first' });
  });

  it('drops what cannot be an id: blank, spaces, dot segments, an empty array', () => {
    [' ', '', '.', '..'].forEach((chat) =>
      expect(parseVoiceParams({ chat })).toEqual({ chatId: null }),
    );
    expect(parseVoiceParams({ chat: [] })).toEqual({ chatId: null });
  });

  it('trims what it keeps and ignores other params', () => {
    expect(parseVoiceParams({ chat: '  c-9 ', ticket: '12' })).toEqual({ chatId: 'c-9' });
  });

  it('returns a frozen value', () => {
    expect(Object.isFrozen(parseVoiceParams({ chat: 'c-1' }))).toBe(true);
  });
});

describe('the route itself', () => {
  it('hides the header: the screen is full screen', () => {
    expect(VOICE_ROUTE_OPTIONS).toEqual({ headerShown: false });
  });
});

describe('voiceLookPath (LOOK)', () => {
  it("opens Play's 'Make it yours' and HUD's Looks drawer", () => {
    expect(voiceLookPath('play')).toBe(STYLE_SCREENS.lookPlay);
    expect(voiceLookPath('hud')).toBe(STYLE_SCREENS.lookHud);
  });

  it("opens Arcade's Options at '/settings/look/arcade' (its registry entry's look page)", () => {
    expect(voiceLookPath('arcade')).toBe(STYLE_SCREENS.lookArcade);
    expect(voiceLookPath('arcade')).toBe('/settings/look/arcade');
  });

  it("opens Candy's Make it sweet at '/settings/look/candy' (its registry entry's look page)", () => {
    expect(voiceLookPath('candy')).toBe(STYLE_SCREENS.lookCandy);
    expect(voiceLookPath('candy')).toBe('/settings/look/candy');
  });

  it('opens the style picker for Studio (and a theme, on the Studio layout)', () => {
    expect(voiceLookPath('studio')).toBe(STYLE_SCREENS.settingsStyle);
  });
});
