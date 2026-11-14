import { describe, expect, it } from 'vitest';

import { sentenceChunker } from '../speech/sentences';

/** Streams the text in the given tokens: each push carries the whole text so far. */
function stream(tokens: readonly string[]): { pushed: string[][]; flushed: readonly string[] } {
  const chunker = sentenceChunker();
  const pushed = tokens.map((_token, index) => [
    ...chunker.push(tokens.slice(0, index + 1).join('')),
  ]);
  return { pushed, flushed: chunker.flush() };
}

/** Word by word, the way a model streams: each token after the first carries its leading space. */
function words(text: string): readonly string[] {
  return text.split(/(?= )/);
}

describe('sentenceChunker', () => {
  it('hands over each sentence once, as soon as the next word begins', () => {
    const { pushed, flushed } = stream(
      words('Hello there. How are you today? I am fine! Thanks for asking.'),
    );
    expect(pushed.flat()).toEqual(['Hello there.', 'How are you today?', 'I am fine!']);
    expect(flushed).toEqual(['Thanks for asking.']);
    // 'Hello there.' is handed over with ' How', the push after the word that ended it.
    expect(pushed[1]).toEqual([]);
    expect(pushed[2]).toEqual(['Hello there.']);
  });

  it('never ends a sentence at the end of the text so far', () => {
    const chunker = sentenceChunker();
    expect(chunker.push('It is 3.')).toEqual([]);
    expect(chunker.push('It is 3.5 degrees. ')).toEqual(['It is 3.5 degrees.']);
  });

  it('keeps decimals, versions and ticket numbers whole, token by token', () => {
    const { pushed, flushed } = stream([
      'Version 2',
      '.',
      '0',
      '.',
      '8 fixes ticket #0419',
      '.',
      ' It takes 3',
      '.',
      '5 seconds',
      '.',
    ]);
    expect(pushed.flat()).toEqual(['Version 2.0.8 fixes ticket #0419.']);
    expect(flushed).toEqual(['It takes 3.5 seconds.']);
  });

  it('does not split after e.g., i.e., Mr., Dr., a.m. or an initial', () => {
    const text =
      'Dr. Lee and Mr. Brown meet at 9 a.m. tomorrow, e.g. in room four. Bring notes, i.e. the draft. J. R. R. Tolkien wrote it. Ms. Kay agrees. ';
    expect(sentenceChunker().push(text)).toEqual([
      'Dr. Lee and Mr. Brown meet at 9 a.m. tomorrow, e.g. in room four.',
      'Bring notes, i.e. the draft.',
      'J. R. R. Tolkien wrote it.',
      'Ms. Kay agrees.',
    ]);
  });

  it('ends at ?, !, an ellipsis and a run of them, with closing quotes and brackets', () => {
    const chunker = sentenceChunker();
    expect(chunker.push('Wait… really?! He said "go." (Then left.) Yes... ok. ')).toEqual([
      'Wait…',
      'really?!',
      'He said "go."',
      '(Then left.)',
      'Yes...',
      'ok.',
    ]);
  });

  it('emits nothing twice when the same text comes again', () => {
    const chunker = sentenceChunker();
    expect(chunker.push('One. Two. ')).toEqual(['One.', 'Two.']);
    expect(chunker.push('One. Two. ')).toEqual([]);
    expect(chunker.push('One. Two. Three')).toEqual([]);
    expect(chunker.flush()).toEqual(['Three']);
    expect(chunker.push('One. Two. Three')).toEqual([]);
    expect(chunker.flush()).toEqual([]);
  });

  it('restarts from the common prefix when narration is retracted', () => {
    const chunker = sentenceChunker();
    expect(chunker.push('Let me check your calendar. ')).toEqual(['Let me check your calendar.']);
    expect(chunker.push('')).toEqual([]);
    expect(chunker.push('You have two meetings. ')).toEqual(['You have two meetings.']);
  });

  it('keeps what still stands in the common prefix', () => {
    const chunker = sentenceChunker();
    expect(chunker.push('Sure. Let me look. ')).toEqual(['Sure.', 'Let me look.']);
    expect(chunker.push('Sure. Your meeting is at 3. ')).toEqual(['Your meeting is at 3.']);
  });

  it('carries on when the text shrinks before what was handed over', () => {
    const chunker = sentenceChunker();
    expect(chunker.push('One. Two thr')).toEqual(['One.']);
    expect(chunker.push('One. Tw')).toEqual([]);
    expect(chunker.push('One. Two three. ')).toEqual(['Two three.']);
  });

  it('skips what has nothing to say', () => {
    const chunker = sentenceChunker();
    expect(chunker.push('... Hello. ')).toEqual(['Hello.']);
    expect(chunker.push('... Hello. !')).toEqual([]);
    expect(chunker.flush()).toEqual([]);
    expect(sentenceChunker().flush()).toEqual([]);
  });

  it('flushes the rest once the turn finishes', () => {
    const chunker = sentenceChunker();
    expect(chunker.push('Done. And one more thing')).toEqual(['Done.']);
    expect(chunker.flush()).toEqual(['And one more thing']);
  });
});

// Voice latency E-11: text that arrives in whole units (a spokenMode turn from a server that lists
// 'spoken_unit_ends'). A terminator at the end of the text so far is an end the server committed to.
describe('with endsAtTextEnd', () => {
  const unitEnds = () => sentenceChunker({ endsAtTextEnd: true });

  it('hands over a sentence that ends the text so far at once, and never twice', () => {
    const chunker = unitEnds();
    expect(chunker.push('Sentence one.')).toEqual(['Sentence one.']);
    expect(chunker.push('Sentence one.')).toEqual([]);
    expect(chunker.push('Sentence one. Sentence two.')).toEqual(['Sentence two.']);
    expect(chunker.push('Sentence one. Sentence two.')).toEqual([]);
    expect(chunker.flush()).toEqual([]);
  });

  it('hands over every unit of one frame, the last one too', () => {
    expect(unitEnds().push('Sure thing! Is that all? Yes…')).toEqual([
      'Sure thing!',
      'Is that all?',
      'Yes…',
    ]);
    expect(unitEnds().push('He said "go."')).toEqual(['He said "go."']);
  });

  it('does not end at an abbreviation or an initial that ends the text so far', () => {
    for (const held of ['Talk to Dr.', 'It was written by J.', 'Bring something, e.g.']) {
      const chunker = unitEnds();
      expect(chunker.push(held)).toEqual([]);
      expect(chunker.flush()).toEqual([held]);
    }
    const chunker = unitEnds();
    expect(chunker.push('Talk to Dr.')).toEqual([]);
    expect(chunker.push('Talk to Dr. Lee today.')).toEqual(['Talk to Dr. Lee today.']);
  });

  it('holds text that ends without a terminator until flush', () => {
    const chunker = unitEnds();
    expect(chunker.push('One. And then a unit the server cut at a space')).toEqual(['One.']);
    expect(chunker.push('One. And then a unit the server cut at a space')).toEqual([]);
    expect(chunker.flush()).toEqual(['And then a unit the server cut at a space']);
  });

  it('skips what has nothing to say', () => {
    const chunker = unitEnds();
    expect(chunker.push('...')).toEqual([]);
    expect(chunker.push('... Hello.')).toEqual(['Hello.']);
    expect(chunker.flush()).toEqual([]);
  });

  it('restarts from the common prefix when narration is retracted', () => {
    const chunker = unitEnds();
    expect(chunker.push('Let me check your calendar.')).toEqual(['Let me check your calendar.']);
    expect(chunker.push('')).toEqual([]);
    expect(chunker.push('You have two meetings.')).toEqual(['You have two meetings.']);
  });

  it('keeps what still stands in the common prefix', () => {
    const chunker = unitEnds();
    expect(chunker.push('Sure. Let me look.')).toEqual(['Sure.', 'Let me look.']);
    expect(chunker.push('Sure. Your meeting is at 3.')).toEqual(['Your meeting is at 3.']);
  });

  it('carries on when the text shrinks before an end found at the end of the text', () => {
    const chunker = unitEnds();
    expect(chunker.push('One. Two.')).toEqual(['One.', 'Two.']);
    expect(chunker.push('One. Tw')).toEqual([]);
    expect(chunker.push('One. Two three.')).toEqual(['Two three.']);
  });

  it('still cuts word by word as without it, only one push sooner', () => {
    const chunker = unitEnds();
    const text = 'Hello there. How are you today?';
    const pushed = words(text).map((_word, index, all) => [
      ...chunker.push(all.slice(0, index + 1).join('')),
    ]);
    expect(pushed.flat()).toEqual(['Hello there.', 'How are you today?']);
    expect(pushed[1]).toEqual(['Hello there.']);
    expect(chunker.flush()).toEqual([]);
  });
});

describe('without endsAtTextEnd', () => {
  it.each([undefined, {}, { endsAtTextEnd: false }])(
    'never ends a sentence at the end of the text so far (options: %j)',
    (options) => {
      const chunker = sentenceChunker(options);
      expect(chunker.push('Sentence one.')).toEqual([]);
      expect(chunker.push('It is 3.')).toEqual([]);
      expect(chunker.push('It is 3.5 degrees. ')).toEqual(['It is 3.5 degrees.']);
      expect(chunker.push('It is 3.5 degrees. Done.')).toEqual([]);
      expect(chunker.flush()).toEqual(['Done.']);
    },
  );
});

// Voice latency E-5: the reply's first unit may be a lead, the start of a first sentence known to be
// over 80 characters, cut at a clause mark 32 to 64 characters in. For Auto's server voice only.
const FIRST_UNIT = { firstUnitMinChars: 32, firstUnitWholeMaxChars: 80, firstUnitMinRestChars: 16 };

/** `length` characters of plain words: no clause mark, no terminator, no space at either edge. */
function filler(length: number): string {
  const text = 'word '.repeat(Math.ceil(length / 5)).slice(0, length);
  return text.endsWith(' ') ? `${text.slice(0, -1)}s` : text;
}

/** One sentence of `total` characters whose only clause mark, a comma, ends `leadLength` in. */
function sentenceWithComma(leadLength: number, total: number): string {
  return `${filler(leadLength - 1)}, ${filler(total - leadLength - 2)}.`;
}

describe.each([false, true])('the first unit (endsAtTextEnd: %j)', (endsAtTextEnd) => {
  const chunker = () => sentenceChunker({ ...FIRST_UNIT, endsAtTextEnd });
  /** Word by word: what each push hands over, then the flush. */
  const wordByWord = (text: string) => {
    const fed = chunker();
    const tokens = words(text);
    const soFar = tokens.map((_token, index) => tokens.slice(0, index + 1).join(''));
    return { soFar, pushed: soFar.map((seen) => [...fed.push(seen)]), flushed: fed.flush() };
  };
  const SHORT = sentenceWithComma(35, 60);
  const LONG = sentenceWithComma(40, 120);
  const FRAME = sentenceWithComma(40, 140);

  it('builds fixtures of the lengths the cases name', () => {
    expect([SHORT.length, LONG.length, FRAME.length]).toEqual([60, 120, 140]);
    expect(LONG.indexOf(',')).toBe(39);
    expect(LONG.match(/[,;:.!?…]/g)).toEqual([',', '.']);
  });

  it('never cuts a short sentence that arrives whole, with no whitespace after it', () => {
    const fed = chunker();
    expect(fed.push(SHORT)).toEqual(endsAtTextEnd ? [SHORT] : []);
    expect(fed.flush()).toEqual(endsAtTextEnd ? [] : [SHORT]);
  });

  it('hands over a short sentence streamed word by word as one unit, at its end', () => {
    const { pushed, flushed } = wordByWord(SHORT);
    expect([...pushed.flat(), ...flushed]).toEqual([SHORT]);
    expect(pushed.slice(0, -1).flat()).toEqual([]);
  });

  it('cuts a long sentence streamed word by word only once it is known to be over 80', () => {
    const { soFar, pushed, flushed } = wordByWord(LONG);
    const lead = LONG.slice(0, 40);
    const rest = LONG.slice(41);
    soFar.forEach((seen, index) => {
      if (seen.length <= 80) expect(pushed[index]).toEqual([]);
    });
    const cutAt = pushed.findIndex((handed) => handed.length > 0);
    expect(soFar[cutAt - 1]?.length).toBeLessThanOrEqual(80);
    expect(soFar[cutAt]?.length).toBeGreaterThan(80);
    expect(pushed[cutAt]).toEqual([lead]);
    expect([...pushed.flat(), ...flushed]).toEqual([lead, rest]);
    expect(endsAtTextEnd ? pushed.at(-1) : flushed).toEqual([rest]);
    expect(`${lead} ${rest}`).toBe(LONG);
  });

  it('cuts a long sentence that arrives whole at once', () => {
    const fed = chunker();
    const lead = FRAME.slice(0, 40);
    const rest = FRAME.slice(41);
    expect(fed.push(FRAME)).toEqual(endsAtTextEnd ? [lead, rest] : [lead]);
    expect(fed.push(FRAME)).toEqual([]);
    expect(fed.flush()).toEqual(endsAtTextEnd ? [] : [rest]);
  });

  it('passes a clause mark before 32 and uses the first one at or after it', () => {
    const text = `Hi Gerard, ${filler(20)}; ${filler(18)}, ${filler(60)}. `;
    const lead = text.slice(0, text.indexOf(';') + 1);
    expect(lead).toHaveLength(32);
    expect(chunker().push(text)).toEqual([lead, text.slice(33).trim()]);
    const early = `Hi Gerard, ${filler(19)}; ${filler(100)}. `;
    expect(early.indexOf(';') + 1).toBe(31);
    expect(chunker().push(early)).toEqual([early.trim()]);
  });

  it('does not cut a long sentence whose only clause mark is past 64', () => {
    const late = sentenceWithComma(65, 120);
    expect(chunker().push(`${late} `)).toEqual([late]);
    const last = sentenceWithComma(64, 120);
    expect(chunker().push(`${last} `)).toEqual([last.slice(0, 64), last.slice(65)]);
  });

  it('never cuts a sentence of 80 or fewer, and leaves a rest of at least 16', () => {
    const whole = sentenceWithComma(40, 80);
    expect(chunker().push(`${whole} `)).toEqual([whole]);
    const ninety = sentenceWithComma(40, 90);
    const [lead, rest] = chunker().push(`${ninety} `);
    expect(lead).toBe(ninety.slice(0, 40));
    expect(rest?.length).toBeGreaterThan(16);
    const tight = chunker().push(`${sentenceWithComma(64, 81)} `);
    expect(tight).toHaveLength(2);
    expect(tight[1]?.length).toBeGreaterThanOrEqual(16);
  });

  it('cuts only the first unit: a later long sentence is one unit', () => {
    expect(chunker().push(`Short one. ${LONG} `)).toEqual(['Short one.', LONG]);
    const fed = chunker();
    expect(fed.push(`${LONG} `)).toEqual([LONG.slice(0, 40), LONG.slice(41)]);
    expect(fed.push(`${LONG} ${FRAME} `)).toEqual([FRAME]);
  });

  it('never cuts inside a number or at a comma that ends the text so far', () => {
    const number = `${filler(34)} 3,500 ${filler(60)}`;
    const fed = chunker();
    expect(number.indexOf(',')).toBe(36);
    expect(fed.push(number)).toEqual([]);
    expect(fed.flush()).toEqual([number]);
    const open = chunker();
    expect(open.push(`${filler(39)},`)).toEqual([]);
    const growing = `${filler(63)},`;
    expect(open.push(`${growing}${filler(40)}`)).toEqual([]);
    expect(chunker().push(growing)).toEqual([]);
  });

  it('starts again from the common prefix when the text is retracted before the lead', () => {
    const fed = chunker();
    expect(fed.push(FRAME)).toContain(FRAME.slice(0, 40));
    expect(fed.push('')).toEqual([]);
    const other = `Another answer ${sentenceWithComma(36, 100)}`;
    expect(fed.push(`${other} `)).toEqual([other.slice(0, 51), other.slice(52)]);
  });

  it('keeps a lead that still stands when the text after it changes', () => {
    const fed = chunker();
    const lead = FRAME.slice(0, 40);
    expect(fed.push(FRAME.slice(0, 100))).toEqual([lead]);
    expect(fed.push(`${lead} and then something else. `)).toEqual(['and then something else.']);
  });
});

describe('the first unit, a candidate end that goes away', () => {
  it('makes no cut while the sentence looks short, and follows the normal rule after', () => {
    const fed = sentenceChunker(FIRST_UNIT);
    expect(fed.push('It costs 3.')).toEqual([]);
    const grown = `It costs 3.5 dollars for all of it, which ${filler(60)}. `;
    const lead = 'It costs 3.5 dollars for all of it,';
    expect(lead).toHaveLength(35);
    expect(fed.push(grown)).toEqual([lead, grown.slice(36).trim()]);
  });
});

describe('the first unit, not asked for', () => {
  const fixtures = [
    sentenceWithComma(35, 60),
    sentenceWithComma(40, 120),
    sentenceWithComma(40, 140),
    sentenceWithComma(64, 81),
    `Hi Gerard, ${filler(20)}; ${filler(18)}, ${filler(60)}.`,
  ];

  it.each([undefined, {}, { firstUnitMinChars: 0 }, { ...FIRST_UNIT, firstUnitMinChars: 0 }])(
    'hands over whole sentences only (options: %j)',
    (options) => {
      for (const fixture of fixtures) {
        const whole = sentenceChunker(options);
        expect(whole.push(fixture)).toEqual([]);
        expect(whole.push(`${fixture} Next`)).toEqual([fixture]);
        expect(whole.flush()).toEqual(['Next']);
        const streamed = sentenceChunker(options);
        const tokens = words(fixture);
        const pushed = tokens.map((_token, index) =>
          streamed.push(tokens.slice(0, index + 1).join('')),
        );
        expect(pushed.flat()).toEqual([]);
        expect(streamed.flush()).toEqual([fixture]);
      }
    },
  );
});
