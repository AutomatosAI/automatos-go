// The voice timing (voice latency A-5) over a test clock: a listen's moments carried into the turn
// that begins after it; a reference that fits the server's pattern even on fractional clocks; marks
// keyed by reference, first call wins, nothing for a null, unknown or closed one; the last `keep`
// turns newest first; one log line per turn, at its close; and the readings and line of a turn.

import { describe, expect, it } from 'vitest';

import { turnRefOf } from '../../chat/request';
import { TIMING_KEEP } from '../config';
import { VOICE_TIMING_COPY } from '../strings';
import { createVoiceTiming, timingLine, timingRows, type TurnTiming } from '../timing/voice-timing';

const REF_PATTERN = /^[A-Za-z0-9_-]{6,40}$/;
const WALL = 1_762_732_800_123;

function timingOver(keep = TIMING_KEEP) {
  const clock = { now: 1_000, wall: WALL };
  const lines: string[] = [];
  const timing = createVoiceTiming({
    now: () => clock.now,
    wall: () => clock.wall,
    log: (line) => lines.push(line),
    keep,
  });
  const at = (now: number) => {
    clock.now = now;
  };
  return { timing, clock, lines, at };
}

describe('a listen, then its turn', () => {
  it("begin carries the listen's moments, stamps sent and returns a ref", () => {
    const h = timingOver();
    h.timing.heard('opened');
    h.at(1_400);
    h.timing.heard('words');
    h.at(1_500);
    h.timing.heard('released');
    h.at(1_810);
    h.timing.heard('final');
    h.at(1_814);
    const ref = h.timing.begin();
    expect(ref).toBe(`vt-${WALL.toString(36)}-1`);
    expect(h.timing.recent()).toEqual([
      {
        ref,
        marks: { opened: 1_000, words: 1_400, released: 1_500, final: 1_810, sent: 1_814 },
        notice: false,
        fellBack: false,
      },
    ]);
  });

  it("heard('words') twice keeps the later; released and final keep the first", () => {
    const h = timingOver();
    h.timing.heard('opened');
    h.at(1_100);
    h.timing.heard('words');
    h.timing.heard('released');
    h.timing.heard('final');
    h.at(1_300);
    h.timing.heard('words');
    h.timing.heard('released');
    h.timing.heard('final');
    h.timing.begin();
    expect(h.timing.recent()[0]?.marks).toMatchObject({
      words: 1_300,
      released: 1_100,
      final: 1_100,
    });
  });

  it("heard('opened') forgets the listen before it, and begin forgets the listen it took", () => {
    const h = timingOver();
    h.timing.heard('opened');
    h.timing.heard('words');
    h.timing.heard('final');
    h.at(5_000);
    h.timing.heard('opened');
    const first = h.timing.begin();
    expect(h.timing.recent()[0]?.marks).toEqual({ opened: 5_000, sent: 5_000 });
    h.at(6_000);
    const second = h.timing.begin();
    expect(second).not.toBe(first);
    expect(second).toBe(`vt-${WALL.toString(36)}-2`);
    expect(h.timing.recent()[0]?.marks).toEqual({ sent: 6_000 });
  });

  it('with fractional clocks the ref still fits the pattern and every mark is an integer', () => {
    const lines: string[] = [];
    const timing = createVoiceTiming({
      now: () => 123456.789,
      wall: () => 1762732800123.456,
      log: (line) => lines.push(line),
      keep: TIMING_KEEP,
    });
    (['opened', 'words', 'released', 'final'] as const).forEach((moment) => timing.heard(moment));
    const ref = timing.begin();
    expect(ref).toMatch(REF_PATTERN);
    expect(ref).not.toContain('.');
    expect(turnRefOf(ref)).toBe(ref);
    timing.mark(ref, 'reply_text');
    timing.mark(ref, 'audio');
    const marks = Object.values(timing.recent()[0]?.marks ?? {});
    expect(marks).toHaveLength(7);
    marks.forEach((value) => expect(Number.isInteger(value)).toBe(true));
    expect(marks[0]).toBe(123457);
  });
});

describe('marks and notes are keyed by the ref', () => {
  it('the first call for a mark wins', () => {
    const h = timingOver();
    const ref = h.timing.begin();
    h.at(2_000);
    h.timing.mark(ref, 'audio');
    const after = h.timing.recent();
    h.at(3_000);
    h.timing.mark(ref, 'audio');
    expect(h.timing.recent()).toBe(after);
    expect(after[0]?.marks.audio).toBe(2_000);
  });

  it('a null, undefined, unknown or closed ref does nothing: recent() is unchanged', () => {
    const h = timingOver();
    const ref = h.timing.begin();
    const before = h.timing.recent();
    h.timing.mark(null, 'audio');
    h.timing.mark(undefined, 'audio');
    h.timing.mark('vt-nobody-9', 'audio');
    h.timing.note(null, { notice: true });
    h.timing.note('vt-nobody-9', { fellBack: true });
    h.timing.close(null);
    h.timing.close('vt-nobody-9');
    expect(h.timing.recent()).toBe(before);
    expect(h.lines).toEqual([]);
    h.timing.close(ref);
    h.timing.mark(ref, 'audio');
    h.timing.note(ref, { fellBack: true });
    expect(h.timing.recent()).toBe(before);
    expect(h.timing.recent()[0]).toMatchObject({ fellBack: false, marks: { sent: 1_000 } });
  });

  it('a note sets its flag once and never clears it', () => {
    const h = timingOver();
    const ref = h.timing.begin();
    h.timing.note(ref, { notice: true });
    h.timing.note(ref, { fellBack: true });
    h.timing.note(ref, { notice: false, fellBack: false });
    expect(h.timing.recent()[0]).toMatchObject({ notice: true, fellBack: true });
  });

  it('open() is the last begun ref until it is closed', () => {
    const h = timingOver();
    expect(h.timing.open()).toBeNull();
    const first = h.timing.begin();
    expect(h.timing.open()).toBe(first);
    const second = h.timing.begin();
    expect(h.timing.open()).toBe(second);
    h.timing.close(first);
    expect(h.timing.open()).toBe(second);
    h.timing.close(second);
    expect(h.timing.open()).toBeNull();
  });
});

describe('what is kept and told', () => {
  it('recent() is newest first and never longer than keep; a dropped turn takes no marks', () => {
    const h = timingOver(3);
    const refs = [1, 2, 3, 4, 5].map(() => h.timing.begin());
    expect(h.timing.recent().map((turn) => turn.ref)).toEqual([refs[4], refs[3], refs[2]]);
    const before = h.timing.recent();
    h.timing.mark(refs[0], 'audio');
    h.timing.close(refs[0]);
    expect(h.timing.recent()).toBe(before);
    expect(h.lines).toEqual([]);
  });

  it('the log port gets one line per turn, at its close', () => {
    const h = timingOver();
    const ref = h.timing.begin();
    h.timing.mark(ref, 'reply_text');
    expect(h.lines).toEqual([]);
    h.timing.close(ref);
    h.timing.close(ref);
    expect(h.lines).toHaveLength(1);
    expect(h.lines[0]).toContain(`ref=${ref}`);
  });

  it('a turn with no audio (stopped) still lists', () => {
    const h = timingOver();
    const ref = h.timing.begin();
    h.timing.close(ref);
    expect(h.timing.recent().map((turn) => turn.ref)).toEqual([ref]);
    expect(h.timing.recent()[0]?.marks).not.toHaveProperty('audio');
  });

  it('subscribers hear a change to the turns, and nothing after they leave', () => {
    const h = timingOver();
    const heard = { count: 0 };
    const leave = h.timing.subscribe(() => {
      heard.count += 1;
    });
    h.timing.heard('opened');
    expect(heard.count).toBe(0);
    const ref = h.timing.begin();
    h.timing.mark(ref, 'audio');
    h.timing.mark(ref, 'audio');
    h.timing.note(ref, { notice: true });
    expect(heard.count).toBe(3);
    leave();
    h.timing.mark(ref, 'sentence');
    expect(heard.count).toBe(3);
  });

  it('every value returned is frozen', () => {
    const h = timingOver();
    const ref = h.timing.begin();
    h.timing.mark(ref, 'audio');
    const turns = h.timing.recent();
    expect(Object.isFrozen(h.timing)).toBe(true);
    expect(Object.isFrozen(turns)).toBe(true);
    expect(Object.isFrozen(turns[0])).toBe(true);
    expect(Object.isFrozen(turns[0]?.marks)).toBe(true);
    const rows = timingRows(turns[0] as TurnTiming);
    expect(Object.isFrozen(rows)).toBe(true);
    rows.forEach((row) => expect(Object.isFrozen(row)).toBe(true));
  });
});

const TURN: TurnTiming = Object.freeze({
  ref: 'vt-mhq2k1ab-3',
  marks: Object.freeze({
    opened: 100,
    words: 1_000,
    released: 1_050,
    final: 1_310,
    sent: 1_314,
    reply_text: 3_419,
    sentence: 3_431,
    tts_sent: 3_434,
    tts_received: 4_274,
    play_called: 4_280,
    reply_audio: 4_434,
    audio: 4_434,
  }),
  notice: false,
  fellBack: false,
});

describe('a turn read back', () => {
  const ROWS = VOICE_TIMING_COPY.rows;

  it('timingRows gives each reading in whole milliseconds, the two headlines last', () => {
    expect(timingRows(TURN)).toEqual([
      { label: ROWS.heardToRecognised, ms: 310 },
      { label: ROWS.recognisedToSent, ms: 4 },
      { label: ROWS.sentToFirstWords, ms: 2_105 },
      { label: ROWS.firstWordsToSentence, ms: 12 },
      { label: ROWS.voiceRequestedToReceived, ms: 840 },
      { label: ROWS.receivedToHeard, ms: 160 },
      { label: ROWS.stoppedTalkingToHeard, ms: 3_434 },
      { label: ROWS.sentToHeard, ms: 3_120 },
    ]);
  });

  it('timingLine is the ref, numbers and two flags', () => {
    expect(timingLine(TURN)).toBe(
      '[voice] timing ref=vt-mhq2k1ab-3 words>final=310 final>sent=4 sent>reply_text=2105 ' +
        'reply_text>sentence=12 sentence>tts_sent=3 tts_sent>tts_received=840 ' +
        'tts_received>reply_audio=160 | words>reply_audio=3434 sent>reply_audio=3120 ' +
        'notice=false fell_back=false',
    );
  });

  it("a missing mark is null in the rows and '-' in the line", () => {
    const stopped: TurnTiming = { ...TURN, marks: { final: 1_310, sent: 1_314 } };
    expect(timingRows(stopped).map((row) => row.ms)).toEqual([
      null,
      4,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(timingLine(stopped)).toContain('words>final=- final>sent=4 sent>reply_text=-');
    expect(timingLine(stopped)).toContain('| words>audio=- sent>audio=-');
  });

  it("the headline uses reply_audio, else audio (the phone's voice spoke)", () => {
    const phone: TurnTiming = {
      ...TURN,
      marks: { words: 1_000, sent: 1_314, audio: 3_500 },
      notice: true,
      fellBack: true,
    };
    const rows = timingRows(phone);
    expect(rows.at(-2)).toEqual({ label: ROWS.stoppedTalkingToHeard, ms: 2_500 });
    expect(rows.at(-1)).toEqual({ label: ROWS.sentToHeard, ms: 2_186 });
    expect(timingLine(phone)).toContain(
      '| words>audio=2500 sent>audio=2186 notice=true fell_back=true',
    );
    const both: TurnTiming = { ...TURN, marks: { ...TURN.marks, audio: 2_000 } };
    expect(timingRows(both).at(-1)?.ms).toBe(3_120);
  });
});
