// The thread's layout and boxes (D72), pure: where each row sits and the gap above it, which rows
// carry Auto's avatar and draw their own box, when the avatar moves above Auto's box, what Auto's
// box holds (a turn's notice folded into the reply it ends), which rows move in, and the boxes'
// geometry in Studio Light and Dark.

import { describe, expect, it } from 'vitest';

import { tokensFor, type Tokens } from '../../styles/tokens';
import { STUDIO_TYPE } from '../../styles/type';
import { textRole } from '../../ui/variants';
import {
  THINKING_LABEL,
  THREAD,
  avatarPlacement,
  bubbleHolds,
  bubbleStyle,
  columnLayout,
  entranceFor,
  foldNotices,
  noticeStyle,
  ownBox,
  thinkingStyle,
  threadPlaces,
  type RowPlace,
} from '../components/thread-look';
import {
  LIVE_AUTO_KEY,
  LIVE_USER_KEY,
  TURN_NOTICE_KEY,
  WORKING_KEY,
  type AutoRow,
  type ChatRow,
  type Notice,
  type ReceiptsView,
  type ToolLineRow,
} from '../view-model';

type RowType = ChatRow['type'];

const places = (...types: RowType[]): readonly RowPlace[] =>
  threadPlaces(types.map((type) => ({ type })));

const SCHEMES: readonly Tokens[] = [tokensFor('studio', 'light'), tokensFor('studio', 'dark')];

describe('threadPlaces', () => {
  it('puts the first row flush, and Auto’s answer a turn below, under its head', () => {
    expect(places('user', 'auto')).toEqual([
      { side: 'user', avatar: 'none', gapAbove: null },
      { side: 'auto', avatar: 'header', gapAbove: 'space9' },
    ]);
  });

  it('draws the thinking pill boxed in Auto’s slot, or bare under Auto’s tool lines', () => {
    expect(places('user', 'working')[1]).toEqual({
      side: 'auto',
      avatar: 'decorative',
      gapAbove: 'space9',
    });
    expect(places('user', 'auto', 'working')[2]).toEqual({
      side: 'auto',
      avatar: 'none',
      gapAbove: 'space3',
    });
  });

  it('keeps loose cards and a notice in Auto’s run after its message', () => {
    expect(places('auto', 'cards')[1]).toEqual({
      side: 'auto',
      avatar: 'none',
      gapAbove: 'space3',
    });
    expect(places('auto', 'notice')[1]).toEqual({
      side: 'auto',
      avatar: 'none',
      gapAbove: 'space3',
    });
  });

  it('gives a notice that starts Auto’s run the sail (a failed turn with no answer)', () => {
    expect(places('user', 'notice')[1]).toEqual({
      side: 'auto',
      avatar: 'decorative',
      gapAbove: 'space9',
    });
  });

  it('heads every Auto message, a turn apart; the user’s messages run 8 pt apart', () => {
    expect(places('auto', 'auto')[1]).toEqual({
      side: 'auto',
      avatar: 'header',
      gapAbove: 'space9',
    });
    expect(places('user', 'user')[1]).toEqual({ side: 'user', avatar: 'none', gapAbove: 'space3' });
  });

  it('is empty for no rows', () => {
    expect(threadPlaces([])).toEqual([]);
  });
});

describe('ownBox', () => {
  it('boxes the thinking pill or a notice only where it starts Auto’s run', () => {
    expect(ownBox(places('user', 'working')[1])).toBe(true);
    expect(ownBox(places('user', 'notice')[1])).toBe(true);
    expect(ownBox(places('user', 'auto', 'working')[2])).toBe(false);
    expect(ownBox(places('user', 'working', 'notice')[2])).toBe(false);
    expect(ownBox(places('auto', 'cards', 'notice')[2])).toBe(false);
  });
});

describe('foldNotices', () => {
  const turnNotice = { key: TURN_NOTICE_KEY } as unknown as Notice;
  const limit = { key: 'limit' } as unknown as Notice;
  const user: ChatRow = {
    type: 'user',
    key: LIVE_USER_KEY,
    text: 'What needs me today?',
    files: [],
    accessibilityLabel: 'You said, What needs me today?',
  };
  const reply = (overrides: Partial<AutoRow> = {}): AutoRow => ({
    type: 'auto',
    key: LIVE_AUTO_KEY,
    messageId: null,
    answer: 'Three things',
    toolLines: [],
    receipts: null,
    notices: [],
    tickets: [],
    cards: [],
    ...overrides,
  });
  const noticeRow: ChatRow = { type: 'notice', key: TURN_NOTICE_KEY, notice: turnNotice };

  it('puts a stop or failure inside the box of the live reply it ends, after its own notices', () => {
    const live = reply({ notices: [limit] });
    const rows: readonly ChatRow[] = [user, live, noticeRow];
    const shown = foldNotices(rows);
    expect(shown).toHaveLength(2);
    expect(shown[0]).toBe(user);
    expect(shown[1]).toEqual({ ...live, notices: [limit, turnNotice] });
    // the rows themselves are not changed
    expect(live.notices).toEqual([limit]);
    expect(rows).toHaveLength(3);
  });

  it('keeps the notice its own row where there is no live box to take it', () => {
    const cardsOnly = reply({
      answer: '',
      cards: [{ key: 'card' }] as unknown as AutoRow['cards'],
    });
    expect(foldNotices([user, cardsOnly, noticeRow])).toEqual([user, cardsOnly, noticeRow]);
    const saved = reply({ key: 'msg-0f3a', messageId: 'msg-0f3a' });
    expect(foldNotices([saved, user, noticeRow])).toEqual([saved, user, noticeRow]);
    expect(foldNotices([saved, noticeRow])).toEqual([saved, noticeRow]);
    const working: ChatRow = { type: 'working', key: WORKING_KEY };
    expect(foldNotices([user, working, noticeRow])).toEqual([user, working, noticeRow]);
  });

  it('leaves a thread with no notice as it is, the same list', () => {
    const rows: readonly ChatRow[] = [user, reply()];
    expect(foldNotices(rows)).toBe(rows);
    expect(foldNotices([])).toEqual([]);
  });
});

describe('avatarPlacement', () => {
  it('sits beside Auto’s box up to XXXL (1.353), above it from AX1 (1.786), beside for nonsense', () => {
    // React Native's iOS multipliers: Large 1, XXXL 1.353, AX1 1.786, AX5 3.571
    expect([1, 1.353, 1.786, 3.571].map(avatarPlacement)).toEqual([
      'beside',
      'beside',
      'above',
      'above',
    ]);
    expect(avatarPlacement(Number.NaN)).toBe('beside');
  });

  it('indents rows with no avatar only beside; above, the column takes the full width', () => {
    expect(columnLayout('beside')).toMatchObject({ indent: true, gap: 'space3' });
    expect(columnLayout('beside').row).toEqual({ flexDirection: 'row', alignItems: 'flex-start' });
    expect(columnLayout('above')).toMatchObject({ indent: false, gap: 'space2' });
    expect(columnLayout('above').content).toEqual({ alignSelf: 'stretch' });
    expect(Object.isFrozen(columnLayout('beside'))).toBe(true);
  });
});

describe('bubbleHolds', () => {
  const empty: Pick<AutoRow, 'answer' | 'toolLines' | 'receipts' | 'notices'> = {
    answer: '',
    toolLines: [],
    receipts: null,
    notices: [],
  };
  const toolLine = { key: 'tool-1' } as unknown as ToolLineRow;
  const receipts = { lines: [], note: null } as unknown as ReceiptsView;
  const notice = { key: 'notice-1' } as unknown as Notice;

  it('holds the answer, tool lines, ‘What Auto did’ and notices', () => {
    expect(bubbleHolds({ ...empty, answer: 'Three things need you.' })).toBe(true);
    expect(bubbleHolds({ ...empty, toolLines: [toolLine] })).toBe(true);
    expect(bubbleHolds({ ...empty, receipts })).toBe(true);
    expect(bubbleHolds({ ...empty, notices: [notice] })).toBe(true);
  });

  it('draws no empty box when the reply is only tickets or cards (they sit below the box)', () => {
    const cardsOnly = { ...empty, tickets: [{ key: 'ticket' }], cards: [{ key: 'card' }] };
    expect(bubbleHolds(cardsOnly)).toBe(false);
  });
});

describe('entranceFor', () => {
  it('moves only the live rows: the message just sent rises, the thinking pill fades', () => {
    expect(entranceFor(LIVE_USER_KEY)).toBe('rise');
    expect(entranceFor(WORKING_KEY)).toBe('fade');
    expect(entranceFor(LIVE_AUTO_KEY)).toBeNull();
    expect(entranceFor('msg-0f3a')).toBeNull();
  });

  it('rises 8 pt in 180 ms and fades in over 200 ms', () => {
    expect(THREAD.motion).toEqual({ riseMs: 180, risePt: 8, fadeMs: 200 });
  });
});

describe.each(SCHEMES)('bubbleStyle in Studio $scheme', (tokens) => {
  const { colours, thread, shadows } = tokens;

  it('paints the user’s box grey, never the primary, on the right, clear of Auto’s column', () => {
    const user = bubbleStyle(tokens, 'user');
    expect(user.backgroundColor).toBe(thread.userFill);
    expect(user.backgroundColor).not.toBe(colours.primary);
    expect(user.borderColor).toBe(thread.userBorder);
    expect(user).toMatchObject({
      borderWidth: 1,
      borderRadius: 10,
      alignSelf: 'flex-end',
      marginLeft: 48,
      paddingVertical: 10,
      paddingHorizontal: 14,
    });
    // a grey box with an edge, no shadow, as the web draws it
    expect(user.boxShadow).toBeUndefined();
  });

  it('paints Auto’s box as a card the full width of its column', () => {
    const auto = bubbleStyle(tokens, 'auto');
    expect(auto).toMatchObject({
      backgroundColor: thread.autoFill,
      borderColor: thread.autoBorder,
      borderWidth: 1,
      borderRadius: 10,
      alignSelf: 'stretch',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
    });
    expect(auto.marginLeft).toBeUndefined();
    // the cards' hairline, so it matches the ticket and approval cards under it
    expect(auto.boxShadow).toBe(shadows.hairline);
  });

  it('paints the thinking pill like Auto’s box, 36 pt high, hugging its dots and word', () => {
    const pill = bubbleStyle(tokens, 'thinking');
    expect(pill).toMatchObject({
      backgroundColor: thread.autoFill,
      borderColor: thread.autoBorder,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
    });
    expect(pill.boxShadow).toBe(shadows.hairline);
    const border = Number(pill.borderWidth);
    const padding = Number(pill.paddingVertical);
    // the word the pill draws: Body 5 at 500
    expect(THINKING_LABEL).toEqual({ level: 5, weight: 500 });
    const label = STUDIO_TYPE[textRole('body', THINKING_LABEL.level)];
    expect(2 * border + 2 * padding + label.lineHeight).toBe(36);
    expect(thinkingStyle(tokens, true)).toEqual(pill);
  });

  it('draws the bare thinking line lined up with the words in Auto’s box above it', () => {
    const bare = thinkingStyle(tokens, false);
    expect(bare).toEqual({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 15 });
    expect(bare.paddingLeft).toBe(
      Number(bubbleStyle(tokens, 'auto').paddingHorizontal) + THREAD.border,
    );
  });

  it('boxes a notice that starts Auto’s run as Auto’s box, else a bare line under it', () => {
    expect(noticeStyle(tokens, true)).toEqual(bubbleStyle(tokens, 'auto'));
    const bare = noticeStyle(tokens, false);
    expect(bare).toEqual({ paddingLeft: 15 });
    expect(bare.paddingLeft).toBe(thinkingStyle(tokens, false).paddingLeft);
  });
});

describe('THREAD geometry', () => {
  it('keeps the user’s box clear of Auto’s column: avatar + its 8 pt gap + 12', () => {
    expect(THREAD.userInset).toBe(THREAD.avatar + 8 + 12);
  });

  it('pins the sail to splash.png’s shape (321 × 394), well inside the 28 pt disc', () => {
    expect(Math.abs(THREAD.sail.width / THREAD.sail.height - 321 / 394)).toBeLessThan(0.02);
    expect(THREAD.sail.height).toBeLessThanOrEqual(THREAD.avatar * 0.6);
  });

  it('pulses three 6 pt dots one after another', () => {
    expect(THREAD.dots).toEqual({ count: 3, size: 6, staggerMs: 150 });
  });
});
