// How long a voice turn took, measured on this phone (voice latency A-5). Pure: no React, React
// Native or Expo; timing.ts makes the app's one instance over the real clocks.
//   A listen's own moments (the recognizer opened, the last words, the release, the final) are kept
//   until a turn begins; begin() takes them, stamps 'sent' and returns the turn's reference. Every
//   later mark is keyed by that reference, never by "whatever turn is open", so speech that is not
//   the reply's own (the AI notice, a brief, a sample) carries no reference and marks nothing. The
//   first call for a mark wins; a turn that was closed takes no more marks or notes.
//   The reference is `vt-<the wall time the turn was sent, ms, base 36>-<a count of voice turns
//   since the app was opened, base 36>`. It is not random and names no person or device. It is the
//   only thing of all this that leaves the phone, and only to a server that lists 'turn_timing'.
//   Everything else stays in memory: the last `keep` turns, newest first. Nothing is stored and
//   nothing here ever holds what a person said or what Auto answered: moments and two flags only.
//   Every value handed out is frozen, and state is replaced whole on every change.

import { VOICE_TIMING_COPY } from '../strings';

export type TimingMark =
  /** The recognizer was started for this listen. */
  | 'opened'
  /** The last partial result: the last moment words were heard. */
  | 'words'
  /** The hold was let go. */
  | 'released'
  /** The recognizer said its final. */
  | 'final'
  /** The turn was handed to the thread. */
  | 'sent'
  /** The first text frame was read (not taken by this app: the engine sees 'reply_text'). */
  | 'stream_text'
  /** The stream ended (not taken by this app). */
  | 'stream_done'
  /** The engine first saw reply text. */
  | 'reply_text'
  /** The reply's first sentence was handed to the speaker. */
  | 'sentence'
  /** The first speech request for a sentence of the reply went out. */
  | 'tts_sent'
  /** Its whole MP3 was in. */
  | 'tts_received'
  /** The player was asked to play it. */
  | 'play_called'
  /** That sentence's audio started (the server voice only). */
  | 'reply_audio'
  /** speak_start: the run's first sound, in whichever voice (the AI notice when there is one). */
  | 'audio';

export type TurnTiming = {
  readonly ref: string;
  /** Whole milliseconds on the recorder's clock; a moment that did not happen is absent. */
  readonly marks: Readonly<Partial<Record<TimingMark, number>>>;
  /** The AI notice was spoken before the reply's first sentence. */
  readonly notice: boolean;
  /** The server voice failed and the phone's voice spoke. */
  readonly fellBack: boolean;
};

export type VoiceTimingPorts = {
  /** A clock for intervals; its values are rounded to whole milliseconds. */
  readonly now: () => number;
  /** Wall time in ms (Date.now): only for the reference. */
  readonly wall: () => number;
  readonly log: (line: string) => void;
  /** How many turns are kept (TIMING_KEEP). */
  readonly keep: number;
};

export type ListenMoment = 'opened' | 'words' | 'released' | 'final';
export type TimingFacts = { readonly notice?: boolean; readonly fellBack?: boolean };

export type VoiceTiming = {
  /**
   * The listen's own moments, before a turn exists. 'opened' forgets the listen before it; 'words'
   * keeps the latest; 'released' and 'final' the first of this listen.
   */
  readonly heard: (moment: ListenMoment) => void;
  /** A new turn: takes the listen's moments (and forgets them), stamps 'sent', returns its ref. */
  readonly begin: () => string;
  /** The first call for a mark wins. A ref that is null, undefined, closed or unknown: nothing. */
  readonly mark: (ref: string | null | undefined, mark: TimingMark) => void;
  readonly note: (ref: string | null | undefined, facts: TimingFacts) => void;
  /** The turn is over: later marks and notes for it do nothing; logs its line, once. */
  readonly close: (ref: string | null | undefined) => void;
  /** The ref of the turn begun last, while it is not closed; else null. */
  readonly open: () => string | null;
  /** The last `keep` turns, newest first. In memory only. */
  readonly recent: () => readonly TurnTiming[];
  readonly subscribe: (listener: () => void) => () => void;
};

/** One reading of a turn; null when either of its two moments did not happen. */
export type TimingRow = { readonly label: string; readonly ms: number | null };

type Marks = TurnTiming['marks'];
type Listen = Readonly<Partial<Record<ListenMoment, number>>>;

type State = {
  readonly listen: Listen;
  /** Voice turns begun since the app was opened. */
  readonly count: number;
  readonly turns: readonly TurnTiming[];
  /** The refs that still take marks. */
  readonly live: ReadonlySet<string>;
  readonly last: string | null;
};

type Ctx = {
  readonly ports: VoiceTimingPorts;
  readonly cell: { state: State };
  readonly listeners: Set<() => void>;
};

const BASE = 36;
const NO_LISTEN: Listen = Object.freeze({});
const NO_TURNS: readonly TurnTiming[] = Object.freeze([]);
const MISSING = '-';

const whole = (ctx: Ctx): number => Math.round(ctx.ports.now());

function frozenTurn(turn: TurnTiming): TurnTiming {
  return Object.freeze({ ...turn, marks: Object.freeze({ ...turn.marks }) });
}

/** The state replaced; the listeners hear of it only when the turns shown changed. */
function set(ctx: Ctx, changes: Partial<State>): void {
  const before = ctx.cell.state.turns;
  ctx.cell.state = { ...ctx.cell.state, ...changes };
  if (ctx.cell.state.turns !== before) ctx.listeners.forEach((listener) => listener());
}

function heard(ctx: Ctx, moment: ListenMoment): void {
  const { listen } = ctx.cell.state;
  const at = whole(ctx);
  if (moment === 'opened') return set(ctx, { listen: Object.freeze({ opened: at }) });
  if (moment !== 'words' && listen[moment] !== undefined) return;
  set(ctx, { listen: Object.freeze({ ...listen, [moment]: at }) });
}

/** A floored wall time and a counter: a fraction's base-36 form holds a '.', which no ref may. */
function refOf(ctx: Ctx, count: number): string {
  return `vt-${Math.floor(ctx.ports.wall()).toString(BASE)}-${count.toString(BASE)}`;
}

function begin(ctx: Ctx): string {
  const { listen, count, turns, live } = ctx.cell.state;
  const next = count + 1;
  const ref = refOf(ctx, next);
  const turn = frozenTurn({
    ref,
    marks: { ...listen, sent: whole(ctx) },
    notice: false,
    fellBack: false,
  });
  const kept = Object.freeze([turn, ...turns].slice(0, Math.max(ctx.ports.keep, 0)));
  const shown = new Set(kept.map((each) => each.ref));
  set(ctx, {
    listen: NO_LISTEN,
    count: next,
    turns: kept,
    live: new Set([...live, ref].filter((each) => shown.has(each))),
    last: ref,
  });
  return ref;
}

/** The turn that still takes marks, by its ref; undefined for any other. */
function liveTurn(ctx: Ctx, ref: string | null | undefined): TurnTiming | undefined {
  if (typeof ref !== 'string' || !ctx.cell.state.live.has(ref)) return undefined;
  return ctx.cell.state.turns.find((turn) => turn.ref === ref);
}

function replace(ctx: Ctx, next: TurnTiming): void {
  const turns = ctx.cell.state.turns.map((turn) => (turn.ref === next.ref ? next : turn));
  set(ctx, { turns: Object.freeze(turns) });
}

function mark(ctx: Ctx, ref: string | null | undefined, name: TimingMark): void {
  const turn = liveTurn(ctx, ref);
  if (turn === undefined || turn.marks[name] !== undefined) return;
  replace(ctx, frozenTurn({ ...turn, marks: { ...turn.marks, [name]: whole(ctx) } }));
}

function note(ctx: Ctx, ref: string | null | undefined, facts: TimingFacts): void {
  const turn = liveTurn(ctx, ref);
  if (turn === undefined) return;
  const notice = turn.notice || facts.notice === true;
  const fellBack = turn.fellBack || facts.fellBack === true;
  if (notice === turn.notice && fellBack === turn.fellBack) return;
  replace(ctx, frozenTurn({ ...turn, notice, fellBack }));
}

function close(ctx: Ctx, ref: string | null | undefined): void {
  const turn = liveTurn(ctx, ref);
  if (turn === undefined) return;
  set(ctx, { live: new Set([...ctx.cell.state.live].filter((each) => each !== turn.ref)) });
  ctx.ports.log(timingLine(turn));
}

function open(ctx: Ctx): string | null {
  const { last, live } = ctx.cell.state;
  return last !== null && live.has(last) ? last : null;
}

export function createVoiceTiming(ports: VoiceTimingPorts): VoiceTiming {
  const ctx: Ctx = {
    ports,
    cell: { state: { listen: NO_LISTEN, count: 0, turns: NO_TURNS, live: new Set(), last: null } },
    listeners: new Set(),
  };
  return Object.freeze({
    heard: (moment: ListenMoment) => heard(ctx, moment),
    begin: () => begin(ctx),
    mark: (ref: string | null | undefined, name: TimingMark) => mark(ctx, ref, name),
    note: (ref: string | null | undefined, facts: TimingFacts) => note(ctx, ref, facts),
    close: (ref: string | null | undefined) => close(ctx, ref),
    open: () => open(ctx),
    recent: () => ctx.cell.state.turns,
    subscribe: (listener: () => void) => {
      ctx.listeners.add(listener);
      return () => {
        ctx.listeners.delete(listener);
      };
    },
  });
}

/** From one moment to a later one; null when either did not happen. */
function between(marks: Marks, from: TimingMark, to: TimingMark): number | null {
  const start = marks[from];
  const end = marks[to];
  return start === undefined || end === undefined ? null : end - start;
}

/** When the reply was heard: its own first sentence's audio, else the run's first sound. */
function heardMark(marks: Marks): 'reply_audio' | 'audio' {
  return marks.reply_audio === undefined ? 'audio' : 'reply_audio';
}

/** The turn's readings for the Timing block, in the order a turn runs; the two headlines last. */
export function timingRows(turn: TurnTiming): readonly TimingRow[] {
  const { marks } = turn;
  const rows = VOICE_TIMING_COPY.rows;
  const end = heardMark(marks);
  return Object.freeze(
    [
      { label: rows.heardToRecognised, ms: between(marks, 'words', 'final') },
      { label: rows.recognisedToSent, ms: between(marks, 'final', 'sent') },
      { label: rows.sentToFirstWords, ms: between(marks, 'sent', 'reply_text') },
      { label: rows.firstWordsToSentence, ms: between(marks, 'reply_text', 'sentence') },
      { label: rows.voiceRequestedToReceived, ms: between(marks, 'tts_sent', 'tts_received') },
      { label: rows.receivedToHeard, ms: between(marks, 'tts_received', 'reply_audio') },
      { label: rows.stoppedTalkingToHeard, ms: between(marks, 'words', end) },
      { label: rows.sentToHeard, ms: between(marks, 'sent', end) },
    ].map((row) => Object.freeze(row)),
  );
}

const STAGES: readonly (readonly [TimingMark, TimingMark])[] = [
  ['words', 'final'],
  ['final', 'sent'],
  ['sent', 'reply_text'],
  ['reply_text', 'sentence'],
  ['sentence', 'tts_sent'],
  ['tts_sent', 'tts_received'],
  ['tts_received', 'reply_audio'],
];

function part(marks: Marks, from: TimingMark, to: TimingMark): string {
  return `${from}>${to}=${between(marks, from, to) ?? MISSING}`;
}

/** One line for the log and for Share: the ref, numbers and two flags; never any words. */
export function timingLine(turn: TurnTiming): string {
  const { marks } = turn;
  const end = heardMark(marks);
  const stages = STAGES.map(([from, to]) => part(marks, from, to)).join(' ');
  const headline = `${part(marks, 'words', end)} ${part(marks, 'sent', end)}`;
  const flags = `notice=${turn.notice} fell_back=${turn.fellBack}`;
  return `[voice] timing ref=${turn.ref} ${stages} | ${headline} ${flags}`;
}
