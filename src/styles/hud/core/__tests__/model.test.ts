// HUD's phone core in words (US-018b): the chip, the transcript (and First open's hint, US-017f),
// the top bar's mic, status row, clock, command row and menu square, the buttons (HOLD TO TALK
// inert), and where the core and Auto sit (Arcade's sprite on the core's disc, US-022i).

import { describe, expect, it } from 'vitest';

import { REPORT_TARGET_ID_MAX_CHARS } from '../../../../api/reports';
import { MENU_HINT } from '../../../../chat/home/menu';
import { captionFor } from '../../../../core/frozen/lib/mascot/media';
import { MASCOT_STATES } from '../../../../core/frozen/lib/mascot/types';
import { spriteSide } from '../../../arcade/sprite/paint';
import { mascotGeometry } from '../../../mascot/geometry';
import { HUD_CORE_COPY, HUD_STATE_WORDS } from '../../../strings';
import {
  EMPTY_TURN,
  HUD_CORE,
  agentName,
  chipView,
  commandView,
  coreDiscRadius,
  coreSizeFor,
  coreSizeIn,
  coreSpritePlace,
  elapsedText,
  hudButtons,
  mascotPlace,
  menuSquareView,
  micView,
  statusRow,
  transcriptAtEnd,
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
        label:
          'Auto, still answering: On it. Five sources, then a shortlist in about thirty seconds',
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

  it("never offers an id the server's target_id would refuse (as the thread's reportTarget)", () => {
    const longest = 'm'.repeat(REPORT_TARGET_ID_MAX_CHARS);
    const rowFor = (id: string) =>
      transcriptRows({ ...turn, streaming: false, autoMessageId: id })[1];
    expect(transcriptReport(rowFor(longest), true)).toEqual({
      target_type: 'message',
      target_id: longest,
    });
    expect(transcriptReport(rowFor(`${longest}m`), true)).toBeNull();
    expect(transcriptReport(rowFor('   '), true)).toBeNull();
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

  it('follows new words while the person reads its end, within 24 pt of it', () => {
    expect(HUD_CORE.transcript.followSlack).toBe(24);
    // it fits: the end is always in view
    expect(transcriptAtEnd(0, 200, 120)).toBe(true);
    // scrolled to the end of 600 pt of words in a 200 pt box
    expect(transcriptAtEnd(400, 200, 600)).toBe(true);
    expect(transcriptAtEnd(376, 200, 600)).toBe(true);
  });

  it('stays put once the person scrolls up to read the start', () => {
    expect(transcriptAtEnd(375, 200, 600)).toBe(false);
    expect(transcriptAtEnd(0, 200, 600)).toBe(false);
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
  it('says MIC LIVE whenever the mic is open, else MIC OFF', () => {
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
    const turn: HudTurn = {
      ...EMPTY_TURN,
      agent: { name: 'Researcher' },
      startedAt: 0,
      endedAt: 134_000,
    };
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

  it("names the menu square as Studio's menu button on home, and as a screen names it", () => {
    expect(menuSquareView()).toEqual({ label: 'Menu', hint: MENU_HINT });
    expect(MENU_HINT).toBe('Opens New chat, Chats, Notifications, Command Centre and Settings');
    expect(menuSquareView('Close voice')).toEqual({ label: 'Close voice', hint: undefined });
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

  it('keeps its drawn size where the room under the top bar holds it and three lines of words', () => {
    expect(HUD_CORE.transcript.minHeight).toBe(84);
    // the drawn phone: 484 pt between the top bar and the waveform, less the chip
    expect(coreSizeIn(484, 844)).toBe(290);
    expect(coreSizeIn(14 + 290 + 84, 844)).toBe(290);
    expect(coreSizeIn(334, 667)).toBe(coreSizeFor(667));
  });

  it('gives up its size to keep the transcript and the buttons on a short screen', () => {
    // 375 x 667 with a two-line voice line and its button under the chip
    expect(coreSizeIn(236, 667)).toBe(236 - 14 - 84);
    expect(coreSizeIn(14 + 200 + 84 + 0.6, 844)).toBe(200);
  });

  it('never shrinks under 120, and draws its share until the column is measured', () => {
    expect(HUD_CORE.core.minSize).toBe(120);
    expect(coreSizeIn(150, 667)).toBe(120);
    expect(coreSizeIn(-40, 667)).toBe(120);
    expect(coreSizeIn(Number.NaN, 667)).toBe(coreSizeFor(667));
    expect(coreSizeIn(Number.POSITIVE_INFINITY, 844)).toBe(290);
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

describe("Arcade's sprite in the core (US-022i)", () => {
  const SCALE_2 = { pixelScale: '2' } as const;
  const SCALE_3 = { pixelScale: '3' } as const;

  it("fills the pulse's circle: 116 across in the 290 core", () => {
    expect(coreDiscRadius(290)).toBeCloseTo(58, 9);
    expect(coreDiscRadius(120)).toBeCloseTo(24, 9);
  });

  it("stands at the look's pixel scale, centred on whole points, in the drawn core", () => {
    expect(coreSpritePlace(290, SCALE_3)).toEqual({ view: 'sprite', left: 97, top: 97 });
    expect(coreSpritePlace(290, SCALE_2)).toEqual({ view: 'sprite', left: 113, top: 113 });
    expect(spriteSide(SCALE_3, 'sprite')).toBeLessThanOrEqual(2 * coreDiscRadius(290));
  });

  it('falls back to the 32 pt mark when the shrunk core cannot hold the sprite', () => {
    expect(coreSpritePlace(200, SCALE_3).view).toBe('mark');
    expect(coreSpritePlace(200, SCALE_2).view).toBe('sprite');
    expect(coreSpritePlace(120, SCALE_2)).toEqual({ view: 'mark', left: 44, top: 44 });
  });

  it('always fits the disc down to the least core, every pixel on a whole point', () => {
    for (const look of [SCALE_2, SCALE_3]) {
      for (let size = HUD_CORE.core.minSize; size <= 290; size += 1) {
        const place = coreSpritePlace(size, look);
        expect(spriteSide(look, place.view)).toBeLessThanOrEqual(2 * coreDiscRadius(size));
        expect(Number.isInteger(place.left) && place.left === place.top).toBe(true);
      }
    }
  });
});
