// HUD's phone core in words (US-018b): the chip, the transcript (and First open's hint, US-017f),
// the top bar's mic, status row, clock and command row, the buttons (HOLD TO TALK inert), and
// where the core and Auto sit.

import { describe, expect, it } from 'vitest';

import { captionFor } from '../../../../core/web/lib/mascot/media';
import { MASCOT_STATES } from '../../../../core/web/lib/mascot/types';
import { mascotGeometry } from '../../../mascot/geometry';
import { HUD_CORE_COPY, HUD_STATE_WORDS } from '../../../strings';
import {
  EMPTY_TURN,
  HUD_CORE,
  agentName,
  chipView,
  commandView,
  coreSizeFor,
  elapsedText,
  hudButtons,
  mascotPlace,
  micView,
  statusRow,
  transcriptAlign,
  transcriptHint,
  transcriptReport,
  transcriptRows,
  turnElapsedMs,
  type HudTurn,
} from '../model';

describe('the state chip', () => {
  it('says the vendored caption in capitals', () => {
    expect(chipView('searching')).toEqual({
      text: 'SEARCHING THE WEB',
      label: 'Searching the web',
    });
    expect(chipView('idle').text).toBe('READY WHEN YOU ARE');
  });

  it.each(MASCOT_STATES)('%s: captionFor in capitals, read as written', (state) => {
    expect(chipView(state)).toEqual({
      text: captionFor(state).toUpperCase(),
      label: captionFor(state),
    });
  });

  it('names the Deliverable that just landed while Auto celebrates', () => {
    expect(chipView('celebrate', 'blog_post').text).toBe('YOUR BLOG POST IS READY');
  });
});

describe('the transcript', () => {
  const turn: HudTurn = {
    you: '  Find me a laptop for uni under seven hundred quid and write it up. ',
    auto: 'On it. Five sources, then a shortlist in about thirty seconds',
    streaming: true,
  };

  it("puts the user's words in quotes, then Auto's with the cursor while he streams", () => {
    expect(transcriptRows(turn)).toEqual([
      {
        who: 'you',
        text: '"Find me a laptop for uni under seven hundred quid and write it up."',
        label: 'You said: Find me a laptop for uni under seven hundred quid and write it up.',
      },
      {
        who: 'auto',
        text: 'On it. Five sources, then a shortlist in about thirty seconds',
        label: 'Auto, still answering: On it. Five sources, then a shortlist in about thirty seconds',
        cursor: true,
        messageId: null,
      },
    ]);
  });

  it('drops the cursor once the reply is done, and names a picked agent', () => {
    const [, auto] = transcriptRows({ ...turn, streaming: false, agent: { name: 'Researcher' } });
    expect(auto).toMatchObject({ cursor: false, label: `Researcher: ${turn.auto}` });
  });

  it("names Auto's saved reply once he is done: Report this on AUTO's line alone (P001R-AF-1)", () => {
    const done: HudTurn = { ...turn, streaming: false, autoMessageId: 'm2' };
    const [you, auto] = transcriptRows(done);
    expect(auto).toMatchObject({ who: 'auto', messageId: 'm2' });
    expect(transcriptReport(auto, true)).toEqual({ target_type: 'message', target_id: 'm2' });
    expect(transcriptReport(you, true)).toBeNull();
    expect(transcriptReport(auto, false)).toBeNull();
    const streaming = transcriptRows({ ...done, streaming: true })[1];
    expect(streaming).toMatchObject({ messageId: null });
    expect(transcriptReport(streaming, true)).toBeNull();
    expect(transcriptRows({ ...done, autoMessageId: undefined })[1]).toMatchObject({
      messageId: null,
    });
  });

  it('shows the cursor alone while the reply has not started', () => {
    expect(transcriptRows({ you: 'Hi', auto: null, streaming: true })[1]).toMatchObject({
      who: 'auto',
      text: '',
      cursor: true,
    });
  });

  it('has no rows before anything is said', () => {
    expect(transcriptRows(EMPTY_TURN)).toEqual([]);
    expect(transcriptRows({ you: '   ', auto: '', streaming: false })).toEqual([]);
  });

  it('is centred while it fits and shows the newest lines past that', () => {
    expect(transcriptAlign(120, 200)).toBe('center');
    expect(transcriptAlign(200, 200)).toBe('center');
    expect(transcriptAlign(260, 200)).toBe('end');
  });

  it('is drawn in 15/1.5 and 19/1.45 with a 9 x 18 cursor blinking each second', () => {
    expect(HUD_CORE.transcript.you).toEqual({ size: 15, leading: 1.5 });
    expect(HUD_CORE.transcript.auto).toEqual({ size: 19, leading: 1.45 });
    expect(HUD_CORE.transcript.cursor).toMatchObject({ width: 9, height: 18, blinkMs: 1000 });
  });
});

describe("First open's hint (US-017f)", () => {
  it("says 'Say or type what you need.' while the transcript is empty, and only then", () => {
    expect(transcriptHint(EMPTY_TURN)).toBe('Say or type what you need.');
    expect(transcriptHint({ you: '  ', auto: null, streaming: false })).toBe(
      'Say or type what you need.',
    );
    expect(transcriptHint({ you: 'Plan my week', auto: null, streaming: false })).toBeNull();
    expect(transcriptHint({ you: null, auto: 'Hello.', streaming: false })).toBeNull();
    expect(transcriptHint({ you: null, auto: null, streaming: true })).toBeNull();
  });
});

describe('the top bar', () => {
  it("says MIC LIVE whenever the mic is open, else MIC OFF", () => {
    expect(micView(true)).toEqual({ text: '● MIC LIVE', live: true, label: 'Microphone on' });
    expect(micView(false)).toEqual({ text: '○ MIC OFF', live: false, label: 'Microphone off' });
  });

  it('counts mm:ss', () => {
    expect(elapsedText(0)).toBe('00:00');
    expect(elapsedText(134_900)).toBe('02:14');
    expect(elapsedText(6_000_000)).toBe('100:00');
    expect(elapsedText(-5)).toBe('00:00');
    expect(elapsedText(Number.NaN)).toBe('00:00');
  });

  it('runs the clock to now while the turn streams, and stops it at its end', () => {
    const started = { ...EMPTY_TURN, startedAt: 1_000 };
    expect(turnElapsedMs(EMPTY_TURN, 50_000)).toBe(0);
    expect(turnElapsedMs({ ...started, streaming: true }, 135_000)).toBe(134_000);
    expect(turnElapsedMs({ ...started, endedAt: 31_000 }, 135_000)).toBe(30_000);
    expect(turnElapsedMs({ ...started, streaming: false }, 135_000)).toBe(0);
  });

  it("reads '<AGENT> · <STATE>' and the clock", () => {
    const turn: HudTurn = { ...EMPTY_TURN, agent: { name: 'Researcher' }, startedAt: 0, endedAt: 134_000 };
    expect(statusRow(turn, 'searching', 0)).toEqual({
      text: 'RESEARCHER · SEARCHING',
      clock: '02:14',
      label: 'Researcher, searching, 02:14',
    });
    expect(statusRow(EMPTY_TURN, 'idle', 0).text).toBe('AUTO · READY');
  });

  it('has a word for every state', () => {
    MASCOT_STATES.forEach((state) => expect(HUD_STATE_WORDS[state]).toMatch(/^[A-Z][a-z]+$/));
  });

  it('names who answers: Auto, the picked agent, or Agent while it has no name', () => {
    expect(agentName(undefined)).toBe('Auto');
    expect(agentName(null)).toBe('Auto');
    expect(agentName({ name: ' Scribe ' })).toBe('Scribe');
    expect(agentName({ name: '' })).toBe('Agent');
  });

  it("shows 'COMMAND · N' with the server's number, and the button's words to VoiceOver", () => {
    expect(commandView(6)).toEqual({ text: 'COMMAND · 6', label: 'Command Centre, 6 need you' });
    expect(commandView(0)).toEqual({ text: 'COMMAND', label: 'Command Centre' });
    expect(commandView(140).text).toBe('COMMAND · 99+');
  });

  it('draws the command row 34 high in 1 pt lines', () => {
    expect(HUD_CORE.commandRow).toMatchObject({ height: 34, border: 1, padItem: 14 });
  });
});

describe('the buttons', () => {
  it('keeps HOLD TO TALK inert until the voice update, and says why', () => {
    const { talk } = hudButtons(true);
    expect(talk).toEqual({
      text: 'HOLD\nTO TALK',
      label: 'Hold to talk',
      hint: 'Voice comes with the voice update',
      disabled: true,
    });
    expect(hudButtons(false).talk.disabled).toBe(true);
  });

  it('enables STOP only while a turn streams; TYPE always', () => {
    expect(hudButtons(true).stop).toMatchObject({ text: 'STOP', disabled: false });
    expect(hudButtons(false).stop.disabled).toBe(true);
    expect(hudButtons(false).type).toEqual({
      text: 'TYPE',
      label: HUD_CORE_COPY.typeLabel,
      disabled: false,
    });
  });

  it('is sized as drawn: 64 x 44 at the sides, an 84 pt circle with a 30 pt glow', () => {
    expect(HUD_CORE.buttons).toMatchObject({
      padTop: 14,
      padX: 24,
      padBottom: 34,
      side: { width: 64, height: 44, border: 1 },
      talk: { size: 84, border: 2, glow: 30 },
    });
  });
});

describe('the core and Auto', () => {
  it('is 290 on the drawn phone and keeps its share of a shorter one', () => {
    expect(coreSizeFor(844)).toBe(290);
    expect(coreSizeFor(932)).toBe(290);
    expect(coreSizeFor(667)).toBe(Math.floor((667 * 290) / 844));
    expect(coreSizeFor(0)).toBe(290);
  });

  it('puts Auto 104 in the 290 core, centred across and lifted 46 % of his height', () => {
    const place = mascotPlace(290);
    const { stage } = mascotGeometry(104);
    expect(place.size).toBe(104);
    expect(place.left).toBeCloseTo(145 - stage.width / 2, 9);
    expect(place.top).toBeCloseTo(145 - 104 * 0.46, 9);
    expect(mascotPlace(229).size).toBe(Math.round((104 * 229) / 290));
  });
});
