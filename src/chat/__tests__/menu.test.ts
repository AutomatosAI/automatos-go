// The header's menu (D73, Gerard 23 Oct on build 7: "have a normal burger menu that we will add
// to"): the four items from ONE list, the needs-you number on the Command Centre row and on the
// menu button (what VoiceOver hears for each), a new row as one line (in the hint too), where a
// tapped row goes (once, and never the screen already showing), the workspace heading, the slim
// header's sizes, and the header's source (vitest runs no React Native renderer): one menu button
// with its badge beside the glyph, no mono line, list button, Command Centre pill or user icon.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MIN_TEXT_SIZE, TYPE_SPECS } from '../../styles/type';
import { MIN_TOUCH } from '../../ui/paint';
import { textRole } from '../../ui/variants';
import { createThread, threadReducer } from '../controller/thread';
import {
  HEADER,
  MENU_HINT,
  MENU_ITEMS,
  menuButtonView,
  menuHeading,
  menuHere,
  menuHint,
  menuRows,
  menuSheetShown,
  menuTrip,
  type MenuIcon,
  type MenuItem,
} from '../home/menu';

const ICONS: readonly MenuIcon[] = [
  'square-pen',
  'messages-square',
  'layout-dashboard',
  'settings',
];

const rowOf = (needsYou: number, id: string) =>
  menuRows(MENU_ITEMS, { needsYou }).find((row) => row.id === id);

const HELP: MenuItem = { id: 'help', label: 'Help', icon: 'settings', route: '/settings' };

describe('the menu’s items (one list)', () => {
  it('is New chat, Chats, Command Centre and Settings, each with its route', () => {
    expect(MENU_ITEMS.map((item) => [item.id, item.label, item.route])).toEqual([
      ['newChat', 'New chat', '/chat/new'],
      ['chats', 'Chats', '/chats'],
      ['commandCentre', 'Command Centre', '/cc'],
      ['settings', 'Settings', '/settings'],
    ]);
  });

  it('has unique ids, a known icon on each, and is frozen', () => {
    const ids = MENU_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of MENU_ITEMS) expect(ICONS).toContain(item.icon);
    expect(Object.isFrozen(MENU_ITEMS)).toBe(true);
  });
});

describe('menuRows', () => {
  it('puts the needs-you number on the Command Centre row only, and says it', () => {
    const rows = menuRows(MENU_ITEMS, { needsYou: 13 });
    const cc = rows.find((row) => row.id === 'commandCentre');
    expect(cc).toMatchObject({ badge: 13, accessibilityLabel: 'Command Centre, 13 need you' });
    for (const row of rows.filter((each) => each.id !== 'commandCentre')) {
      expect(row.badge).toBeNull();
      expect(row.accessibilityLabel).toBe(row.label);
    }
  });

  it('shows no number for nothing, a negative or not a number; a whole one otherwise', () => {
    for (const none of [0, -1, Number.NaN]) {
      expect(rowOf(none, 'commandCentre')).toMatchObject({
        badge: null,
        accessibilityLabel: 'Command Centre',
      });
    }
    expect(rowOf(1, 'commandCentre')?.accessibilityLabel).toBe('Command Centre, 1 needs you');
    expect(rowOf(2.7, 'commandCentre')?.badge).toBe(2);
  });

  it('takes a new row as one line', () => {
    const rows = menuRows([...MENU_ITEMS, HELP], { needsYou: 0 });
    expect(rows).toHaveLength(5);
    expect(rows.at(-1)).toEqual({
      id: 'help',
      label: 'Help',
      icon: 'settings',
      route: '/settings',
      badge: null,
      accessibilityLabel: 'Help',
    });
  });

  it('builds new rows and leaves the items alone', () => {
    const before = JSON.stringify(MENU_ITEMS);
    const frozen = Object.freeze(MENU_ITEMS.map((item) => Object.freeze({ ...item })));
    const rows = menuRows(frozen, { needsYou: 4 });
    rows.forEach((row, index) => expect(row).not.toBe(frozen[index]));
    expect(JSON.stringify(MENU_ITEMS)).toBe(before);
    expect(frozen[2]).toHaveProperty('badge', 'needsYou');
  });
});

describe('menuButtonView', () => {
  it('is Menu alone with nothing waiting', () => {
    expect(menuButtonView(0)).toEqual({ badge: null, accessibilityLabel: 'Menu' });
  });

  it('carries and says the needs-you number', () => {
    expect(menuButtonView(13)).toEqual({ badge: 13, accessibilityLabel: 'Menu, 13 need you' });
    expect(menuButtonView(1).accessibilityLabel).toBe('Menu, 1 needs you');
  });

  it('hands CountBadge the whole number; the badge draws 99+ itself', () => {
    expect(menuButtonView(150).badge).toBe(150);
  });
});

describe('menuHint (what the menu button says it opens)', () => {
  it('names every row, from the rows’ own labels', () => {
    expect(MENU_HINT).toBe('Opens New chat, Chats, Command Centre and Settings');
    expect(MENU_HINT).toBe(menuHint(MENU_ITEMS));
  });

  it('names a new row too, so the hint never goes stale', () => {
    expect(menuHint([...MENU_ITEMS, HELP])).toBe(
      'Opens New chat, Chats, Command Centre, Settings and Help',
    );
    expect(menuHint([HELP])).toBe('Opens Help');
  });
});

describe('menuTrip and menuSheetShown (where a tapped row goes)', () => {
  it('goes to the tapped row’s route', () => {
    expect(menuTrip(null, '/chats', null)).toBe('/chats');
    expect(menuTrip(null, '/chats', '/chat/new')).toBe('/chats');
  });

  it('keeps the route already on its way: a second tap pushes nothing more', () => {
    expect(menuTrip('/chats', '/settings', null)).toBe('/chats');
    expect(menuTrip('/chats', '/chats', null)).toBe('/chats');
  });

  it('pushes nothing for the screen the header already sits on: the row only closes', () => {
    expect(menuTrip(null, '/chat/new', '/chat/new')).toBeNull();
  });

  it('shows the sheet only while open with nothing on its way', () => {
    expect(menuSheetShown(true, null)).toBe(true);
    expect(menuSheetShown(true, '/chats')).toBe(false);
    expect(menuSheetShown(false, null)).toBe(false);
  });
});

describe('menuHere (a blank draft is New chat)', () => {
  const draft = createThread(null);
  const sent = threadReducer(draft, {
    type: 'send',
    draft: { text: 'Hello', files: [], sentAt: null },
  });

  it('is New chat’s route for a draft with nothing in it, about no ticket', () => {
    expect(menuHere(draft, null)).toBe('/chat/new');
    const newChat = MENU_ITEMS.find((item) => item.id === 'newChat');
    expect(menuTrip(null, newChat?.route ?? '', menuHere(draft, null))).toBeNull();
  });

  it('is nothing once the draft is written in (its route stays /chat/new), a chat, or a ticket', () => {
    expect(sent.live).not.toBeNull();
    expect(menuHere(sent, null)).toBeNull();
    expect(menuHere(createThread('chat-1'), null)).toBeNull();
    expect(menuHere({ ...draft, failure: { kind: 'turn', code: 'turn_failed' } }, null)).toBeNull();
    expect(menuHere(draft, 'ticket-7')).toBeNull();
  });
});

describe('menuHeading', () => {
  it('names the workspace in full, and the role in words', () => {
    expect(
      menuHeading({ name: '  Automatos Prime Workspace for Northwind Ltd  ', role: 'owner' }),
    ).toEqual({ title: 'Automatos Prime Workspace for Northwind Ltd', summary: 'Owner' });
    expect(menuHeading({ name: '  ', role: 'editor' }).title).toBe('Your workspace');
    expect(menuHeading({ name: 'Northwind', role: 'viewer' }).summary).toBe('Viewer');
  });
});

describe('HEADER: one slim row', () => {
  it('is Apple’s 44 pt bar with a 44 pt menu button and a 22 pt glyph', () => {
    expect(HEADER.rowHeight).toBe(MIN_TOUCH);
    expect(MIN_TOUCH).toBe(44);
    expect(HEADER.menu.box).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(HEADER.menu.icon).toBe(22);
  });

  it('sets the wordmark in the 17 pt serif, readable', () => {
    const role = textRole(HEADER.wordmark.variant, HEADER.wordmark.level);
    expect(role).toBe('threadTitle2');
    expect(TYPE_SPECS[role].family).toBe('serif');
    expect(TYPE_SPECS[role].size).toBe(17);
    expect(TYPE_SPECS[role].size).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
  });
});

describe('the header’s source', () => {
  const read = (...parts: string[]) =>
    readFileSync(path.resolve(__dirname, '..', ...parts), 'utf8');
  const header = read('home', 'HomeHeader.tsx');

  it('mounts one menu button and the menu, with the needs-you number', () => {
    expect(header).toContain('<MenuButton');
    expect(header).toContain('<HomeMenu');
    expect(header).toContain('useNeedsYou()');
  });

  it('has no mono line, list button, Command Centre pill or user icon', () => {
    expect(header).not.toMatch(
      /CommandCentreButton|icons\/list'|icons\/user-round|headerLine|useAgentCount|variant="mono"|working/,
    );
  });

  it('draws the menu button with lucide’s menu and the count badge, and says the count', () => {
    const button = read('home', 'MenuButton.tsx');
    expect(button).toContain('lucide-react-native/icons/menu');
    expect(button).toContain('menuButtonView(');
    expect(button).toContain('accessibilityLabel={view.accessibilityLabel}');
    expect(button).toContain('accessibilityHint={MENU_HINT}');
    expect(button).toContain('<CountBadge');
  });

  it('sets the badge beside the glyph, in a button that grows, never over the bars', () => {
    const button = read('home', 'MenuButton.tsx');
    expect(button).not.toMatch(/position: 'absolute'|\bheight: box|\bwidth: box/);
    expect(button).toContain('minWidth: box');
    expect(button).toContain('minHeight: box');
    expect(button).toContain("flexDirection: 'row'");
  });

  it('builds the menu from MENU_ITEMS in the foundation Sheet, and leaves it before navigating', () => {
    const menu = read('home', 'HomeMenu.tsx');
    expect(menu).toContain('menuRows(MENU_ITEMS');
    expect(menu).toContain('menuHeading(');
    expect(menu).toContain('<Sheet');
    const hook = read('home', 'use-home-menu.ts');
    expect(hook).toContain('SHEET_DURATION_MS');
    expect(hook).toContain('menuTrip(pending, route, here)');
    expect(hook).toContain('menuSheetShown(shown, next)');
  });

  it('gives each row its own VoiceOver words (the count on the Command Centre row)', () => {
    expect(read('home', 'HomeMenu.tsx')).toContain('accessibilityLabel={row.accessibilityLabel}');
  });

  it('is the same header on home and the chat route', () => {
    expect(read('screens', 'ChatScreen.tsx')).toContain(
      '<HomeHeader onBack={onBack} here={menuHere(state, ticketId)} />',
    );
    expect(read('screens', 'HomeScreen.tsx')).toContain('<HomeHeader />');
  });

  it('is the same slim bar on home, the chat route and Older chats', () => {
    const bar = read('home', 'HeaderBar.tsx');
    expect(bar).toContain('minHeight: HEADER.rowHeight');
    expect(bar).toContain('paddingTop: insets.top,');
    expect(header).toContain('<HeaderBar');
    expect(read('history', 'ChatsHeader.tsx')).toContain('<HeaderBar');
  });
});
