import { describe, expect, it } from 'vitest';

import { sentenceChunker } from '../speech/sentences';
import { toSpeakable } from '../speech/speakable';

// Each case: Auto's markdown → what the voice says. Every input is also checked for idempotence.
const CASES: readonly (readonly [string, string, string])[] = [
  [
    'bold, italics and inline code',
    'This is **bold**, _italic_, *also italic* and `npm test`.',
    'This is bold, italic, also italic and npm test.',
  ],
  ['underscore bold and strikethrough', '__Note__: ~~old~~ new.', 'Note: old new.'],
  [
    'an identifier keeps its underscores',
    'Edit file_name.ts and my_var.',
    'Edit file_name.ts and my_var.',
  ],
  [
    'a heading is a sentence',
    '# Your day\nThree things are due.',
    'Your day. Three things are due.',
  ],
  ['closing hashes', '## Done ##\nNext up.', 'Done. Next up.'],
  ['a heading underlined', 'Summary\n===\nAll good.', 'Summary. All good.'],
  [
    'bullets, each item a sentence',
    'Your day:\n- Standup at 9\n- Lunch with Sam\n* Review the PR\n• Call Ana,\n',
    'Your day: Standup at 9. Lunch with Sam. Review the PR. Call Ana.',
  ],
  [
    'a numbered list, each item a sentence',
    '1. First\n2) Second.\n3. Third:\n',
    'First. Second. Third.',
  ],
  ['a task list', '- [ ] Write tests\n- [x] Ship it\n', 'Write tests. Ship it.'],
  ['a nested item and bold inside', '  - **Apples** and pears\n', 'Apples and pears.'],
  ['an item still streaming gets no full stop yet', '- Apples\n- Pea', 'Apples. Pea'],
  ['an item made bold', '**1. First**\n', 'First.'],
  [
    'a link says its label',
    'Read [the docs](https://docs.automatos.app/start) first.',
    'Read the docs first.',
  ],
  [
    'an image says its alt text',
    'Look: ![Weekly chart](https://x.test/chart.png)',
    'Look: Weekly chart',
  ],
  ['a reference link', 'See [the guide][1] for more.', 'See the guide for more.'],
  [
    'a bare URL is a link',
    'Open https://automatos.app/settings?tab=voice. Then sign in.',
    'Open a link. Then sign in.',
  ],
  [
    'www and angle-bracket links',
    'Try www.example.com or <https://x.test/a>.',
    'Try a link or a link.',
  ],
  ['a URL in a list item', '- see https://x.test/a_b\n', 'see a link.'],
  [
    'a code fence',
    'Run this:\n```bash\nnpm test -- **all**\n```\nThen check the output.',
    "Run this. There's code in the chat. Then check the output.",
  ],
  [
    'an unclosed code fence is code to the end',
    'Here it is\n```ts\nconst a = 1;\n# not a heading',
    "Here it is. There's code in the chat.",
  ],
  ['two fences in a row, one sentence', '~~~\na\n~~~\n\n```\nb\n```', "There's code in the chat."],
  [
    'a table',
    'Results:\n| Name | Score |\n|---|---|\n| Ana | 3 |\n| Sam | 5 |\nThat is all.',
    "Results. There's a table in the chat. That is all.",
  ],
  [
    'a table without outer pipes',
    'Name | Score\n--- | ---\nAna | 3\n\nDone.',
    "There's a table in the chat. Done.",
  ],
  ['a horizontal rule', 'Above.\n\n---\n\nBelow.', 'Above. Below.'],
  ['a quote', '> Quoted **text**\n> - and an item\n', 'Quoted text and an item.'],
  ['whitespace collapsed', 'Hello  \n\n \t world.  ', 'Hello world.'],
  ['a pair still streaming', 'This is **very', 'This is very'],
  ['a stray marker at a word edge', '*start and end_ here', 'start and end here'],
  ['a lone star is left alone', '5 * 3 is 15.', '5 * 3 is 15.'],
  ['nothing but markdown', '**\n---\n', ''],
  ['empty', '', ''],
];

describe('toSpeakable', () => {
  it.each(CASES)('%s', (_name, markdown, spoken) => {
    expect(toSpeakable(markdown)).toBe(spoken);
  });

  it.each(CASES)('is idempotent: %s', (_name, markdown) => {
    const once = toSpeakable(markdown);
    expect(toSpeakable(once)).toBe(once);
  });

  it('is idempotent on its own copy and on text that is already plain', () => {
    for (const text of [
      "There's code in the chat. There's a table in the chat.",
      'You have two meetings: standup at 9.30 and a review at 2.',
    ])
      expect(toSpeakable(text)).toBe(text);
  });

  it('leaves no markdown character for the voice to read', () => {
    const spoken = CASES.map(([, markdown]) => toSpeakable(markdown))
      .filter((text) => text !== '5 * 3 is 15.')
      .join(' ');
    expect(spoken).not.toMatch(/[*`#|[\]~]|https?:|www\./);
  });

  it("keeps a '**' split across two pushes out of the spoken sentences", () => {
    const chunker = sentenceChunker();
    const first = chunker.push(toSpeakable('Your **next mee'));
    const second = chunker.push(toSpeakable('Your **next meeting** is at 10. It is with Sam'));
    const rest = chunker.flush();
    expect(first).toEqual([]);
    expect(second).toEqual(['Your next meeting is at 10.']);
    expect(rest).toEqual(['It is with Sam']);
  });

  it.each(CASES)(
    'streamed character by character, says the final text once: %s',
    (_n, markdown) => {
      const chunker = sentenceChunker();
      const spoken = [...markdown].flatMap((_char, index) =>
        chunker.push(toSpeakable(markdown.slice(0, index + 1))),
      );
      expect([...spoken, ...chunker.flush()].join(' ')).toBe(toSpeakable(markdown));
    },
  );

  it('speaks a streamed list item by item, each once', () => {
    const reply = 'Today:\n- Standup at 9\n- Lunch with **Sam**\n- Review the PR';
    const chunker = sentenceChunker();
    const spoken = [...reply].flatMap((_char, index) =>
      chunker.push(toSpeakable(reply.slice(0, index + 1))),
    );
    expect([...spoken, ...chunker.flush()]).toEqual([
      'Today: Standup at 9.',
      'Lunch with Sam.',
      'Review the PR',
    ]);
  });
});
