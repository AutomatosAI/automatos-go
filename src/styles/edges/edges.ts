// The edge screens (PRD-001 §4.7 Edges, Ember 06-09, US-017f), pure: which edge an error is, and
// what each screen says, so the components in this folder only lay the words out per style.
//
//   edgeFor        an error → 'not-running' (no answer: the network kind, or a gateway that cannot
//                  reach the server, src/connect/server-support.ts isNotRunning), 'something-wrong'
//                  (server, stream, invalid_response) or null (auth, forbidden, not_found and
//                  conflict stay with the gate and the screens that raised them)
//   Not running    the hosted server by its host; a self-hosted one ('own') as Automatos asleep
//                  with the command that starts it (the connect kit's SELF_HOSTED_START_COMMAND,
//                  so the app shows one command), selectable because there is no clipboard (KS7)
//   Something went wrong   the taxonomy's words for the error (userMessage), never internals
//   First open, Lost       their fixed words; a Play starter fills the composer, never sends (KS13);
//                  Arcade says its own greeting, its own 404 lines and its own wordmark (US-022i)

import { isApiError, userMessage, type ApiErrorKind } from '../../api/errors';
import type { Server } from '../../api/server';
import { serverLabel } from '../../app-state/account';
import { SELF_HOSTED_START_COMMAND } from '../../connect/config';
import { isNotRunning } from '../../connect/server-support';
import { GLYPHS } from '../dress/status-glyphs';
import type { Layout } from '../registry/style-id';
import { EDGE_COPY, HUD_STATE_WORDS, PLAY_STATUS } from '../strings';
import { NOT_RUNNING_RECHECK_MS } from './recheck';

export type EdgeKind = 'not-running' | 'something-wrong';

const SNAG_KINDS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'server',
  'stream',
  'invalid_response',
]);

/** Which edge screen an error shows; null when it is not an edge's (the gate keeps it). */
export function edgeFor(error: unknown): EdgeKind | null {
  if (isNotRunning(error)) return 'not-running';
  if (isApiError(error) && SNAG_KINDS.has(error.kind)) return 'something-wrong';
  return null;
}

// ── Not running ─────────────────────────────────────────────────────────────────────────────

/** The server Not running names: its address, and whether it is the build's hosted one. */
export type EdgeServer = Pick<Server, 'apiUrl' | 'source'>;

export type NotRunningEdge = {
  /** The state in words beside the dimmed light: 'Not connected'. */
  readonly status: string;
  readonly title: string;
  readonly message: string;
  /** The command that starts a self-hosted server; null for the hosted one. */
  readonly command: string | null;
  /** The command, read out. */
  readonly commandLabel: string | null;
  readonly checkAgain: string;
  /** 'Automatos Go also checks every 5 seconds.' (the quiet re-check, recheck.ts). */
  readonly recheck: string;
  /** HUD's panel line: '— Not answering' (its label face sets the capitals). */
  readonly panel: string;
  readonly panelLabel: string;
};

const MS_PER_SECOND = 1000;

/** What Not running says for this server. */
export function notRunningEdge(server: EdgeServer): NotRunningEdge {
  const copy = EDGE_COPY.notRunning;
  const own = server.source !== 'hosted';
  return Object.freeze({
    status: copy.status,
    title: own ? copy.ownTitle : copy.hostedTitle(serverLabel(server)),
    message: own ? copy.ownMessage : copy.hostedMessage,
    command: own ? SELF_HOSTED_START_COMMAND : null,
    commandLabel: own ? copy.command(SELF_HOSTED_START_COMMAND) : null,
    checkAgain: copy.checkAgain,
    recheck: copy.recheck(Math.round(NOT_RUNNING_RECHECK_MS / MS_PER_SECOND)),
    panel: `${GLYPHS.stopped} ${copy.panel}`,
    panelLabel: copy.panel,
  });
}

// ── Something went wrong ────────────────────────────────────────────────────────────────────

export type SomethingWrongEdge = {
  readonly title: string;
  /** The taxonomy's words for the error: never a status, a URL or the server's internals. */
  readonly message: string;
  readonly retry: string;
  /** Play's word beside Auto: 'Hm.' */
  readonly autoWord: string;
  /** HUD's panel line: '✕ Snag' (its label face sets the capitals). */
  readonly panel: string;
  readonly panelLabel: string;
};

export function somethingWrongEdge(error: unknown): SomethingWrongEdge {
  const copy = EDGE_COPY.somethingWrong;
  return Object.freeze({
    title: copy.title,
    message: userMessage(error),
    retry: copy.retry,
    autoWord: PLAY_STATUS.oops,
    panel: `${GLYPHS.failed} ${HUD_STATE_WORDS.oops}`,
    panelLabel: HUD_STATE_WORDS.oops,
  });
}

// ── First open and Lost ─────────────────────────────────────────────────────────────────────

export type Starter = {
  readonly key: string;
  readonly text: string;
  readonly hint: string;
};

/** Play's three starter chips (KS13): a tap puts the words in the message box. */
export const STARTERS: readonly Starter[] = Object.freeze(
  EDGE_COPY.firstOpen.starters.map((text, index) =>
    Object.freeze({ key: `starter-${index}`, text, hint: EDGE_COPY.firstOpen.starterHint }),
  ),
);

export const LOST_EDGE = EDGE_COPY.lost;

/** Lost's words: the '404', the title, the line and the way back. */
export type LostEdge = {
  readonly number: string;
  readonly title: string;
  readonly message: string;
  readonly back: string;
};

/** Lost's words in a style: Arcade's own title and line (the kit's 404), the shared ones elsewhere. */
export function lostEdge(layout: Layout): LostEdge {
  if (layout !== 'arcade') return LOST_EDGE;
  const { lostTitle, lostMessage } = EDGE_COPY.arcade;
  return Object.freeze({ ...LOST_EDGE, title: lostTitle, message: lostMessage });
}

// ── The brand line ──────────────────────────────────────────────────────────────────────────

export type BrandWords = (typeof EDGE_COPY.brand)[keyof typeof EDGE_COPY.brand];

/** The brand line's words: HUD's and Arcade's own; Play's otherwise (Studio draws none). */
export function brandWords(layout: Layout): BrandWords {
  if (layout === 'hud') return EDGE_COPY.brand.hud;
  if (layout === 'arcade') return EDGE_COPY.brand.arcade;
  return EDGE_COPY.brand.play;
}
