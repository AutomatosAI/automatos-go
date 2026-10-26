// HUD's menu square (D73; Gerard 26 Oct: "I don't see anywhere to start a new chat in HUD?"), read
// from source (vitest runs in node with no React renderer, and these files load React Native): on
// HUD's home the square opens Studio's header menu itself (HomeMenu over menu.ts MENU_ITEMS, New
// chat first, with useHomeMenu's slide-away and menuHere's blank draft), never Settings directly;
// on A6's voice screen it stays 'Close voice' and closes the screen. The square's words are
// model.test.ts's (menuSquareView); the menu's own rules are src/chat/__tests__/menu.test.ts's.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MENU_ITEMS, menuRows } from '../../../chat/home/menu';
import { NEW_CHAT_ID } from '../../../chat/screens/chat-route';
import { routes } from '../../../navigation/routes';
import { VOICE_SCREEN_COPY } from '../../../voice/strings';

const SRC = path.resolve(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.resolve(SRC, file), 'utf8');
/** The code alone (A2's idiom): comments stripped. */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const hudHome = code('styles/homes/HudHome.tsx');
const topBar = code('styles/hud/core/HudTopBar.tsx');
const hudCore = code('styles/hud/core/HudCore.tsx');
const voiceScreen = code('voice/screen/VoiceScreen.tsx');

describe("HUD's home: the menu square opens the header menu", () => {
  it('mounts HomeMenu on useHomeMenu, as Studio’s header does, with the needs-you number', () => {
    expect(hudHome).toMatch(/import \{ HomeMenu \} from '\.\.\/\.\.\/chat\/home\/HomeMenu';/);
    expect(hudHome).toMatch(
      /import \{ useHomeMenu \} from '\.\.\/\.\.\/chat\/home\/use-home-menu';/,
    );
    expect(hudHome).toMatch(/const menu = useHomeMenu\(menuHere\(state, ticketId\)\);/);
    expect(hudHome).toMatch(/<HudCore[\s\S]*?onMenu=\{menu\.open\}[\s\S]*?\/>/);
    expect(hudHome).toMatch(/const \{ total \} = useNeedsYou\(\);/);
    expect(hudHome).toMatch(/<HomeMenu menu=\{menu\} needsYou=\{total\} \/>/);
  });

  it('never goes to Settings itself, and keeps no list of its own', () => {
    expect(hudHome).not.toMatch(/routes\.settings|router\.push|useRouter/);
    expect(hudHome).not.toMatch(/MENU_ITEMS|NEW_CHAT_ID|routes\.chat/);
  });

  it("names the square as Studio's menu button, and the voice screen's name wins there", () => {
    expect(topBar).toMatch(/const menu = menuSquareView\(menuLabel\);/);
    expect(topBar).toMatch(
      /<RowButton core=\{core\} label=\{menu\.label\} hint=\{menu\.hint\} square onPress=\{onMenu\}>/,
    );
    expect(topBar).not.toMatch(/routes\.settings/);
  });
});

describe("A6's voice screen keeps its square: 'Close voice'", () => {
  it('closes the screen, and is named for it', () => {
    expect(voiceScreen).toMatch(/<HudCore[\s\S]*?onMenu=\{on\.close\}[\s\S]*?\/>/);
    expect(voiceScreen).not.toMatch(/HomeMenu|useHomeMenu/);
    expect(hudCore).toMatch(/bar: \{ menuLabel: voice\.menuLabel,/);
    expect(VOICE_SCREEN_COPY.close).toBe('Close voice');
  });
});

describe('the menu it opens', () => {
  it('is MENU_ITEMS, New chat first, the Command Centre carrying the needs-you number', () => {
    expect(read('chat/home/HomeMenu.tsx')).toContain('menuRows(MENU_ITEMS, { needsYou })');
    expect(MENU_ITEMS[0]).toMatchObject({
      id: 'newChat',
      label: 'New chat',
      route: routes.chat(NEW_CHAT_ID),
    });
    expect(MENU_ITEMS.map((item) => item.id)).toEqual([
      'newChat',
      'chats',
      'commandCentre',
      'settings',
    ]);
    const rows = menuRows(MENU_ITEMS, { needsYou: 4 });
    expect(rows.find((row) => row.id === 'commandCentre')?.badge).toBe(4);
  });
});
