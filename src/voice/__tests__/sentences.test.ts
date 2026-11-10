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
