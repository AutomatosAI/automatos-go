// "What Auto depends on" as it is drawn (PRD-268 §6.12.3 'Readiness list', US-G07), pure: the
// server's items with this phone's rows, each row's glyph and word and the tokens they paint in,
// what VoiceOver says, the count, and the line under the rows (checking, a refused Check again, a
// failed read). Every answer is a new, frozen value.
//   Rows: the server's items in its order (the first of a repeated id wins), then the phone's. The
//   phone answers for push, the microphone, speech recognition and the server voice: where the
//   server lists one of those ids (core lists 'push': whether the install may send through Expo,
//   which the phone's push status already reads from discovery's push.expo) the phone's row stands
//   in its place, so no id shows twice.
//   A server fix is followed only to a screen the phone has (src/navigation/web-links.ts: the
//   Command Centre, Deliverables, chat); any other path (Studio's settings) shows no fix, and
//   nothing ever opens an outside URL or the browser.
//   The mark: ✓ Ready · ○ Not checked · ◆ Needs setup. HUD paints the glyph in its role
//   (status-glyphs.ts GLYPH_ROLE_TOKENS); Arcade in the state's role (its dress's glyphPaint, never
//   the accent); Studio, a theme and Play by the state's colour role for the ground
//   (src/ui/state-tokens.ts). The word is the same in every layout.

import { isApiError, userMessage } from '../api/errors';
import { appRouteForWebLink } from '../navigation/web-links';
import { statusGlyph, type GlyphPaint } from '../styles/dress/status-glyphs';
import type { ColourName, ColourScheme } from '../styles/tokens/types';
import { STATE_WORD_TOKEN, glyphToken, statePaint } from '../ui/state-tokens';
import { CLIENT_ROW_IDS, type AppFix, type RowInput } from './client-rows';
import type { ReadinessFix, ReadinessItem, ReadinessState } from './schema';
import { READINESS_COPY, READINESS_WORDS } from './strings';

/** The status a refused Check again carries (the server's limit), and its code. */
export const TOO_MANY_REQUESTS_STATUS = 429;
export const CHECKED_RECENTLY_CODE = 'checked_recently';

/** No Studio address: a path the phone has no screen for is never sent to the browser from here. */
const NO_STUDIO = '';

export type ReadinessRow = RowInput &
  Readonly<{
    word: string;
    /** 'Calendar: needs setup. Connect calendar.' (with a fix) or '…: ready. <detail>' (without). */
    accessibilityLabel: string;
  }>;

/** The screen route a server fix opens, when the phone has that screen; else null. */
export function appFixOf(fix: ReadinessFix | null | undefined): AppFix | null {
  if (!fix) return null;
  const target = appRouteForWebLink(fix.href, NO_STUDIO);
  return target && 'app' in target ? Object.freeze({ label: fix.label, route: target.app }) : null;
}

export function serverRowOf(item: ReadinessItem): RowInput {
  return Object.freeze({
    id: item.id,
    label: item.label,
    detail: item.detail,
    state: item.state,
    fix: appFixOf(item.fix),
  });
}

const ENDED = /[.!?…]$/;

function sentence(text: string): string {
  const trimmed = text.trim();
  return ENDED.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** What VoiceOver says for a row: the label and word, then the fix, else the detail. */
export function rowLabel(row: RowInput): string {
  const head = sentence(`${row.label}: ${READINESS_WORDS[row.state].toLowerCase()}`);
  const tail = row.fix ? row.fix.label : row.detail;
  return tail.trim() ? `${head} ${sentence(tail)}` : head;
}

function drawn(row: RowInput): ReadinessRow {
  return Object.freeze({
    ...row,
    word: READINESS_WORDS[row.state],
    accessibilityLabel: rowLabel(row),
  });
}

const CLIENT_IDS: ReadonlySet<string> = new Set(CLIENT_ROW_IDS);

/** The server's items, each id once, with the phone's row in place of an id the phone answers. */
export function mergeRows(
  items: readonly ReadinessItem[] | null,
  client: readonly RowInput[],
): readonly ReadinessRow[] {
  const phone = new Map(client.map((each) => [each.id, each]));
  const listed = items ?? [];
  const firsts = listed.filter(
    (item, at) => listed.findIndex((other) => other.id === item.id) === at,
  );
  const server = firsts.map((item) =>
    CLIENT_IDS.has(item.id) ? (phone.get(item.id) ?? serverRowOf(item)) : serverRowOf(item),
  );
  const named = new Set(firsts.map((item) => item.id));
  const rest = client.filter((each) => !named.has(each.id));
  return Object.freeze([...server, ...rest].map(drawn));
}

export type MarkSpec = Readonly<{
  glyph: string;
  word: string;
  glyphToken: ColourName;
  wordToken: ColourName;
}>;

/**
 * A state's glyph, word and tokens: in glyphs, the glyph in its glyph's role (HUD) or its state's
 * (Arcade, `glyphPaint` 'state-role'); else the state's colour role for the ground.
 */
export function readinessMark(
  state: ReadinessState,
  glyphs: boolean,
  scheme: ColourScheme,
  glyphPaint: GlyphPaint = 'glyph-role',
): MarkSpec {
  const glyph = statusGlyph(state);
  const word = READINESS_WORDS[state];
  if (glyphs) {
    return Object.freeze({
      glyph: glyph.glyph,
      word,
      glyphToken: glyphToken(state, glyphPaint),
      wordToken: STATE_WORD_TOKEN,
    });
  }
  const paint = statePaint(state, scheme);
  return Object.freeze({
    glyph: glyph.glyph,
    word,
    glyphToken: paint.glyph,
    wordToken: paint.word,
  });
}

/** The line a refused Check again shows: the server's words for its limit, else the client's. */
export function refusalLine(error: unknown): string {
  const limited =
    isApiError(error) &&
    (error.status === TOO_MANY_REQUESTS_STATUS || error.code === CHECKED_RECENTLY_CODE);
  if (!limited) return userMessage(error);
  return error.serverMessage?.trim() || READINESS_COPY.checkedRecently;
}

export type ReadinessInput = Readonly<{
  items: readonly ReadinessItem[] | null;
  client: readonly RowInput[];
  /** The server's items are being read (the first read, or Check again). */
  checking: boolean;
  /** The last read failed (null when it answered, or while none has finished). */
  readError: unknown;
  /** A refused Check again's line, shown until the next press. */
  refusal: string | null;
}>;

export type ReadinessView = Readonly<{
  rows: readonly ReadinessRow[];
  count: string;
  /** Under the rows: Checking…, a refusal or a failed read; null when there is nothing to say. */
  line: string | null;
  checking: boolean;
}>;

function lineOf(input: ReadinessInput): string | null {
  if (input.checking) return READINESS_COPY.checking;
  if (input.refusal) return input.refusal;
  return input.readError ? userMessage(input.readError) : null;
}

export function readinessView(input: ReadinessInput): ReadinessView {
  const rows = mergeRows(input.items, input.client);
  const ready = rows.filter((row) => row.state === 'ready').length;
  return Object.freeze({
    rows,
    count: READINESS_COPY.readyCount(ready, rows.length),
    line: lineOf(input),
    checking: input.checking,
  });
}
