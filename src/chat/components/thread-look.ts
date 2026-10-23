// How the thread is laid out and boxed (D72, Gerard 23 Oct: "be like web ui, auto is mascot or
// sail, light grey box around us both"), pure: the web's chat on a phone. The user's words sit in a
// grey box on the right (primary at 10 %, tokens.thread), never closer than 48 pt to the left edge;
// Auto's sit in a Studio card the full width of its column, beside its sail avatar (above it at the
// accessibility text sizes). Rows are grouped: 24 pt between turns, 8 pt within Auto's run (its
// thinking pill under its tool lines, loose cards under its message). Only the live rows move: the
// user's bubble rises in and the thinking pill fades in; history never replays. A turn's notice (a
// stop, a failure) lands inside the box of the reply it ends, as the web draws it; one that starts
// Auto's run gets its own box, and one under the thinking pill or loose cards is a bare line (one
// box per thing). Auto's box and the pill are Studio cards (the cards' hairline shadow too), so they
// match the ticket and approval cards under them. Every number here is a token or a measured
// geometry, and MessageList, AutoColumn, AutoMessage, UserBubble and WorkingIndicator only wire
// what this decides (__tests__/thread-look.test.ts).

import type { ViewStyle } from 'react-native';

import { aiLabelWords } from '../../styles/ai-label-state';
import type { FontWeight } from '../../styles/fonts';
import type { SpaceName, Spacing, Tokens } from '../../styles/tokens';
import { joinLabel } from '../../ui/paint';
import type { TextLevel } from '../../ui/variants';
import { CHAT_COPY } from '../strings';
import {
  LIVE_AUTO_KEY,
  LIVE_USER_KEY,
  WORKING_KEY,
  type AutoRow,
  type ChatRow,
} from '../view-model';

export const THREAD = Object.freeze({
  /** Auto's avatar disc, points. */
  avatar: 28,
  /** The sail inside it: splash.png is 321 × 394, both sides pinned (image-size.test.ts). */
  sail: Object.freeze({ width: 12, height: 15 }),
  /** The user's box keeps clear of the left edge: avatar + its 8 pt gap + 12. */
  userInset: 48,
  /**
   * From here the avatar moves above Auto's box: iOS's largest default text size is 1.353 and AX1
   * (Accessibility Medium) 1.786 (React Native's RCTAccessibilityManager.mm multipliers).
   */
  stackAtFontScale: 1.6,
  /** Both boxes' edge. */
  border: 1,
  /** The user's bubble rises 8 pt in 180 ms; the thinking pill fades in over 200 ms. */
  motion: Object.freeze({ riseMs: 180, risePt: 8, fadeMs: 200 }),
  /** The thinking pill's dots, pulsing one after another. */
  dots: Object.freeze({ count: 3, size: 6, staggerMs: 150 }),
});

/** VoiceOver's name for the avatar heading Auto's message: who said it, and that Auto is an AI. */
export const AUTO_AVATAR_LABEL = joinLabel(CHAT_COPY.autoSaid, aiLabelWords(null));

/** Above a row: a new turn or an Auto message, or the next part of Auto's run. */
export const THREAD_GAPS = Object.freeze({ turn: 'space9', run: 'space3' } as const);

export type ThreadSide = 'user' | 'auto';
/** header: heads Auto's message (VoiceOver's 'Auto said'); decorative: hidden; none: no disc. */
export type AvatarRole = 'header' | 'decorative' | 'none';
export type RowPlace = {
  readonly side: ThreadSide;
  readonly avatar: AvatarRole;
  readonly gapAbove: SpaceName | null;
};

type Typed = Pick<ChatRow, 'type'>;

export function sideOf(row: Typed): ThreadSide {
  return row.type === 'user' ? 'user' : 'auto';
}

function avatarOf(row: Typed, continues: boolean): AvatarRole {
  if (row.type === 'user') return 'none';
  // every Auto message keeps its 'Auto said' head
  if (row.type === 'auto') return 'header';
  // the thinking pill, a notice, loose cards: a disc only where they start Auto's run
  return continues ? 'none' : 'decorative';
}

/** Where a row sits: its side, its avatar and the gap above it (none for the first row). */
export function rowPlace(previous: Typed | undefined, row: Typed): RowPlace {
  const side = sideOf(row);
  const continues = previous !== undefined && sideOf(previous) === side;
  const avatar = avatarOf(row, continues);
  if (previous === undefined) return { side, avatar, gapAbove: null };
  const run = continues && avatar !== 'header';
  return { side, avatar, gapAbove: run ? THREAD_GAPS.run : THREAD_GAPS.turn };
}

export function threadPlaces(rows: readonly Typed[]): readonly RowPlace[] {
  return rows.map((row, index) => rowPlace(index === 0 ? undefined : rows[index - 1], row));
}

/**
 * The thinking pill and a notice draw their own box only where they start Auto's run (the sail
 * beside them); under Auto's box they are a bare line.
 */
export function ownBox(place: Pick<RowPlace, 'avatar'>): boolean {
  return place.avatar !== 'none';
}

export type Entrance = 'rise' | 'fade' | null;

/** Only the live rows move in: the message just sent rises, the thinking pill fades. */
export function entranceFor(key: string): Entrance {
  if (key === LIVE_USER_KEY) return 'rise';
  if (key === WORKING_KEY) return 'fade';
  return null;
}

/**
 * Auto's box holds the answer, tool lines, 'What Auto did' and notices; cards sit below it. An
 * answer that is only a link definition or a lone '<br>' lexes to nothing, so its box is drawn
 * empty: rare, and telling it apart would lex every answer twice.
 */
export function bubbleHolds(
  row: Pick<AutoRow, 'answer' | 'toolLines' | 'receipts' | 'notices'>,
): boolean {
  return (
    row.answer !== '' || row.toolLines.length > 0 || row.receipts !== null || row.notices.length > 0
  );
}

/**
 * The turn's notice (a stop, a stop the server never heard, a failure) goes inside the box of the
 * reply it ends, as the web puts the error in the same bubble: never a second box under the first.
 * It is always the thread's last row (view-model threadRows), so only the last two rows are read.
 * Only the live reply takes it, and only when it has a box (a reply of cards alone keeps the
 * notice as its own row). The rows are not changed: with nothing to fold they come back as they
 * are, else a new list with a new reply.
 */
export function foldNotices(rows: readonly ChatRow[]): readonly ChatRow[] {
  const notice = rows.at(-1);
  const reply = rows.at(-2);
  if (notice?.type !== 'notice' || reply?.type !== 'auto') return rows;
  if (reply.key !== LIVE_AUTO_KEY || !bubbleHolds(reply)) return rows;
  return [...rows.slice(0, -2), { ...reply, notices: [...reply.notices, notice.notice] }];
}

export type AvatarPlacement = 'beside' | 'above';

/** Beside Auto's box, or above it at the accessibility text sizes (the width goes to the words). */
export function avatarPlacement(fontScale: number): AvatarPlacement {
  return Number.isFinite(fontScale) && fontScale >= THREAD.stackAtFontScale ? 'above' : 'beside';
}

export type ColumnLayout = {
  readonly row: ViewStyle;
  /** Between the avatar and the column. */
  readonly gap: SpaceName;
  readonly content: ViewStyle;
  /** Rows with no avatar keep its width, so Auto's run lines up. */
  readonly indent: boolean;
};

const COLUMN_LAYOUTS: Readonly<Record<AvatarPlacement, ColumnLayout>> = Object.freeze({
  beside: Object.freeze({
    row: Object.freeze({ flexDirection: 'row', alignItems: 'flex-start' }),
    gap: 'space3',
    content: Object.freeze({ flex: 1, minWidth: 0 }),
    indent: true,
  }),
  above: Object.freeze({
    row: Object.freeze({ flexDirection: 'column', alignItems: 'stretch' }),
    gap: 'space2',
    content: Object.freeze({ alignSelf: 'stretch' }),
    indent: false,
  }),
});

export function columnLayout(placement: AvatarPlacement): ColumnLayout {
  return COLUMN_LAYOUTS[placement];
}

export type BubbleKind = 'auto' | 'user' | 'thinking';

type BubbleTokens = Pick<Tokens, 'thread' | 'radii' | 'spacing' | 'shadows'>;

type BubbleShape = {
  readonly paddingVertical: SpaceName;
  readonly paddingHorizontal: SpaceName;
  readonly gap: SpaceName;
  readonly alignSelf: 'stretch' | 'flex-end' | 'flex-start';
};

/** Auto's box spans its column; the user's shrink-wraps; the thinking pill hugs its dots. */
const BUBBLE_SHAPES: Readonly<Record<BubbleKind, BubbleShape>> = Object.freeze({
  auto: Object.freeze({
    paddingVertical: 'space5',
    paddingHorizontal: 'space6',
    gap: 'space5',
    alignSelf: 'stretch',
  }),
  user: Object.freeze({
    paddingVertical: 'space4',
    paddingHorizontal: 'space6',
    gap: 'space1',
    alignSelf: 'flex-end',
  }),
  thinking: Object.freeze({
    paddingVertical: 'space3',
    paddingHorizontal: 'space5',
    gap: 'space3',
    alignSelf: 'flex-start',
  }),
});

const KIND_EXTRAS: Readonly<Record<BubbleKind, ViewStyle>> = Object.freeze({
  auto: Object.freeze({}),
  user: Object.freeze({ marginLeft: THREAD.userInset }),
  thinking: Object.freeze({ flexDirection: 'row', alignItems: 'center' }),
});

/**
 * A box as the web draws it: its fill and 1 pt edge, the panel's 10 pt radius, no tail. Auto's box
 * and the thinking pill are Studio cards, so they also take the cards' hairline shadow and match
 * the ticket and approval cards under them; the user's box has none, as on the web.
 */
export function bubbleStyle(
  { thread, radii, spacing, shadows }: BubbleTokens,
  kind: BubbleKind,
): ViewStyle {
  const shape = BUBBLE_SHAPES[kind];
  const user = kind === 'user';
  return {
    backgroundColor: user ? thread.userFill : thread.autoFill,
    borderColor: user ? thread.userBorder : thread.autoBorder,
    borderWidth: THREAD.border,
    borderRadius: radii.panel,
    ...(user ? {} : { boxShadow: shadows.hairline }),
    paddingVertical: spacing[shape.paddingVertical],
    paddingHorizontal: spacing[shape.paddingHorizontal],
    gap: spacing[shape.gap],
    alignSelf: shape.alignSelf,
    ...KIND_EXTRAS[kind],
  };
}

/** A bare line under Auto's box starts where the words inside the box start. */
function bareIndent(spacing: Spacing): number {
  return spacing.space6 + THREAD.border;
}

/** The thinking pill's word: Body 5 (12/18) at 500; with the 8 pt padding the pill is 36 pt high. */
export const THINKING_LABEL: Readonly<{ level: TextLevel; weight: FontWeight }> = Object.freeze({
  level: 5,
  weight: 500,
});

/**
 * The thinking pill: boxed like Auto's box where it starts Auto's run; under Auto's tool lines it
 * is the dots and the word alone, lined up with the words in the box above.
 */
export function thinkingStyle(tokens: BubbleTokens, boxed: boolean): ViewStyle {
  if (boxed) return bubbleStyle(tokens, 'thinking');
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.space3,
    paddingLeft: bareIndent(tokens.spacing),
  };
}

/**
 * A notice row: in Auto's box where it starts Auto's run (a failed turn with no answer, beside the
 * sail); under the thinking pill or loose cards a bare line, lined up like the bare thinking line.
 */
export function noticeStyle(tokens: BubbleTokens, boxed: boolean): ViewStyle {
  if (boxed) return bubbleStyle(tokens, 'auto');
  return { paddingLeft: bareIndent(tokens.spacing) };
}
