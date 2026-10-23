// The header's menu (D73, Gerard 23 Oct on build 7: "a normal burger menu that we will add to"),
// pure: the header's sizes, the menu's rows as ONE list, what VoiceOver hears, and where a tapped
// row goes. A new row is one line in MENU_ITEMS (a new icon also needs its entry in HomeMenu.tsx
// MENU_ICONS; TypeScript enforces it), and the button's hint names it too. The number is the
// server's one needs-you number (D26, useNeedsYou): the menu button carries it, and so does the
// row it belongs to.

import type { Workspace } from '../../api/workspace';
import { ROLE_LABELS } from '../../app-state/strings';
import { routes } from '../../navigation/routes';
import type { SpaceName } from '../../styles/tokens';
import { MIN_TOUCH, joinLabel } from '../../ui/paint';
import { UI_COPY } from '../../ui/strings';
import {
  badgeText,
  countPhrase,
  type PluralForms,
  type TextLevel,
  type TextVariant,
} from '../../ui/variants';
import type { ThreadState } from '../controller/thread';
import { NEW_CHAT_ID } from '../screens/chat-route';
import { HOME_COPY, MENU_COPY } from '../strings';

/**
 * One slim row under the status bar: Apple's 44 pt bar, a 1 pt rule under it. The brand sits 16 pt
 * from the edge; a control (Back, the menu button) 6 pt, so its glyph lands near 16 too. Older
 * chats' bordered 'New chat' button keeps the brand's 16.
 */
export const HEADER = Object.freeze({
  rowHeight: MIN_TOUCH,
  rule: 1,
  edge: Object.freeze({ text: 'space7', control: 'space2', bordered: 'space7' } as const),
  gap: 'space2' as SpaceName,
  /** 'automatos' in Newsreader 500 at 17 pt (the scale's threadTitle2, the handoff's 17 px). */
  wordmark: Object.freeze({ variant: 'thread' as TextVariant, level: 2 as TextLevel }),
  /**
   * The menu button: at least a 44 pt box, a 22 pt glyph, and the badge BESIDE the glyph, 4 pt
   * after it (as iOS Messages puts its count beside Back): a badge on the glyph's corner hid most
   * of the top bar at "13", all of it at "99+", and all three bars at the larger Dynamic Type
   * sizes. With a badge the button grows to hold both (6 pt sides), so a longer count or a larger
   * text size widens it instead of covering the glyph.
   */
  menu: Object.freeze({
    box: MIN_TOUCH,
    icon: 22,
    side: 'space2' as SpaceName,
    badgeGap: 'space1' as SpaceName,
  }),
});

export type MenuIcon = 'square-pen' | 'messages-square' | 'layout-dashboard' | 'settings';
/** A number a row can carry, by name: today only the needs-you number. */
export type MenuBadge = 'needsYou';

export type MenuItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: MenuIcon;
  readonly route: string;
  readonly badge?: MenuBadge;
};

export const MENU_ITEMS: readonly MenuItem[] = Object.freeze([
  { id: 'newChat', label: MENU_COPY.newChat, icon: 'square-pen', route: routes.chat(NEW_CHAT_ID) },
  { id: 'chats', label: MENU_COPY.chats, icon: 'messages-square', route: routes.chats },
  {
    id: 'commandCentre',
    label: MENU_COPY.commandCentre,
    icon: 'layout-dashboard',
    route: routes.cc.board,
    badge: 'needsYou',
  },
  { id: 'settings', label: MENU_COPY.settings, icon: 'settings', route: routes.settings },
]);

export type MenuCounts = Readonly<Record<MenuBadge, number>>;

/** What each number counts, for VoiceOver: '13 need you'. */
const BADGE_NOUNS: Readonly<Record<MenuBadge, PluralForms>> = Object.freeze({
  needsYou: UI_COPY.needYou,
});

export type MenuRow = Omit<MenuItem, 'badge'> & {
  /** The whole number to draw, or null when there is none to show (0, negative, not a number). */
  readonly badge: number | null;
  readonly accessibilityLabel: string;
};

const shown = (count: number): number | null =>
  badgeText(count) === null ? null : Math.floor(count);

const counted = (label: string, count: number | null, noun: PluralForms): string =>
  joinLabel(label, count === null ? null : countPhrase(count, noun));

/** The menu's rows: each item with its number resolved and the words VoiceOver hears. */
export function menuRows(items: readonly MenuItem[], counts: MenuCounts): readonly MenuRow[] {
  return items.map(({ badge, ...item }) => {
    const count = badge ? shown(counts[badge]) : null;
    const accessibilityLabel = badge ? counted(item.label, count, BADGE_NOUNS[badge]) : item.label;
    return { ...item, badge: count, accessibilityLabel };
  });
}

export type MenuButtonView = { readonly badge: number | null; readonly accessibilityLabel: string };

/** The header's menu button: 'Menu', or 'Menu, 13 need you' with the badge. */
export function menuButtonView(needsYou: number): MenuButtonView {
  const badge = shown(needsYou);
  return { badge, accessibilityLabel: counted(HOME_COPY.menu, badge, UI_COPY.needYou) };
}

/** What the menu button says it opens, from the rows' own labels: a new row is named too. */
export function menuHint(items: readonly MenuItem[]): string {
  const labels = items.map((item) => item.label);
  const last = labels.at(-1) ?? '';
  const rest = joinLabel(...labels.slice(0, -1));
  return HOME_COPY.menuHint(rest === '' ? last : `${rest}${HOME_COPY.listAnd}${last}`);
}

/** 'Opens New chat, Chats, Command Centre and Settings'. */
export const MENU_HINT = menuHint(MENU_ITEMS);

/**
 * The route a tapped row goes to once the sheet has slid away, or null for none. A route already
 * on its way stays (a second tap pushes nothing more); the screen the header sits on (`here`) is
 * not pushed again, the row only closes the menu.
 */
export function menuTrip(
  pending: string | null,
  route: string,
  here: string | null,
): string | null {
  if (pending !== null) return pending;
  return route === here ? null : route;
}

/** The sheet shows while it is open and no row's screen is on its way. */
export function menuSheetShown(open: boolean, pending: string | null): boolean {
  return open && pending === null;
}

type ThreadOnScreen = Pick<ThreadState, 'chatId' | 'messages' | 'live' | 'failure'>;

/**
 * The menu route a chat screen already is: a draft with nothing in it, about no ticket, IS a new
 * chat, so New chat there pushes no second blank draft. A draft that has been written in keeps the
 * route '/chat/new' (the first message names the chat inside the thread, not in the route), which
 * is why this reads the thread, not the path.
 */
export function menuHere(thread: ThreadOnScreen, ticketId: string | null): string | null {
  const blank =
    thread.chatId === null &&
    thread.messages.length === 0 &&
    thread.live === null &&
    thread.failure === null;
  return blank && ticketId === null ? routes.chat(NEW_CHAT_ID) : null;
}

export type MenuHeading = { readonly title: string; readonly summary: string };

/** The menu's top: the workspace's full name (or 'Your workspace'), and the role in words. */
export function menuHeading(workspace: Pick<Workspace, 'name' | 'role'>): MenuHeading {
  return {
    title: workspace.name.trim() || MENU_COPY.unnamedWorkspace,
    summary: ROLE_LABELS[workspace.role],
  };
}
