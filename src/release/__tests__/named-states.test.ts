// Rule 6.4 (docs/app-standard.md, T11 of the record): a screen says what it is showing. Data that
// is out of date stays on screen under a line that says so; not set up, offline, waiting to send
// and not downloaded are named states with words of their own. This walks each named state the app
// can be in: its words come from its feature's strings.ts and are read where it is shown, they are
// not empty, they are not any loading words and not the failed words (UI_COPY's title, the error
// kinds' own), and every screen that keeps what it read after a failed refresh draws its line or is
// listed as still owed it, with its reason, never both.
//
// What cannot occur here, said rather than pretended:
// - Waiting to send, held on the phone: the app keeps no queue of what a person sends while
//   offline (the record's 'Raised, not adopted'). A message, an answer or an approval is sent at
//   once, or fails where it was made in its error kind's words with Try again. The one wait is the
//   server's: today's brief, which it takes now and delivers later, and its words say so.
// - Not downloaded, for a Deliverable: the phone keeps no files. Opening one fetches it then
//   ('Loading the file…', a load like any other). The speech model hold to talk needs on Android
//   is the one thing the phone downloads and keeps, and it has its own words and a Download button.
// - Offline as a state the phone detects: the app reads no network state of its own. It is offline
//   when a request cannot reach the server, and where that leaves a state on screen it is named:
//   the Command Centre's stream, a suggestion that could not start, a server that does not answer.
// Which states this app shows, where, which screens draw the line and which still owe it, are the
// app's (settings/named-states.ts).

import { describe, expect, it } from 'vitest';

import { API_ERROR_COPY } from '../../api/strings';
import { UI_COPY } from '../../ui/strings';
import { OUT_OF_DATE_LINES, OWED, SHOWN, type NamedState } from './settings/named-states';
import {
  HOLDS_OLDER_DATA,
  outOfDateFaults,
  screensHoldingOlderData,
  type Sources,
} from './support/out-of-date';
import { copyModules, productFiles, readRepoFile } from './support/tree';

/** Every loading word in every copy module: a key that names loading, checking or uploading. */
const LOADING_WORDS = new Set(
  copyModules().flatMap((file) =>
    [
      ...readRepoFile(file).matchAll(/\b\w*(?:loading|checking|uploading)\w*\s*:\s*'([^']+)'/gi),
    ].map((match) => match[1]),
  ),
);
const FAILED_WORDS = new Set<string>([UI_COPY.errorTitle, ...Object.values(API_ERROR_COPY)]);
/** Every product file's source: where the audit finds the screens that can hold older data. */
const SOURCES: Sources = new Map(productFiles().map((file) => [file, readRepoFile(file)]));

describe('the named states have words of their own (rule 6.4)', () => {
  it('names every state the rule names that the app can be in', () => {
    expect(new Set(SHOWN.map((each) => each.state))).toEqual(
      new Set<NamedState>([
        'out of date',
        'offline',
        'not set up',
        'waiting to send',
        'not downloaded',
      ]),
    );
    expect(LOADING_WORDS).toContain(UI_COPY.loading);
    expect(LOADING_WORDS.size).toBeGreaterThan(10);
  });

  it.each(SHOWN)('$state: "$words" is said where it is shown ($file)', ({ words, file, reads }) => {
    expect(words.trim()).not.toBe('');
    expect(LOADING_WORDS.has(words), 'a loading word').toBe(false);
    expect(FAILED_WORDS.has(words), 'the failed words').toBe(false);
    expect(readRepoFile(file)).toContain(reads);
  });

  it("gives a state's words to it alone: no two named states share words", () => {
    const owners = new Map<string, NamedState>();
    for (const { state, words } of SHOWN) {
      expect(owners.get(words) ?? state, words).toBe(state);
      owners.set(words, state);
    }
  });
});

describe('data that is out of date stays on screen under a line that says so (rule 6.4)', () => {
  it.each(OUT_OF_DATE_LINES)('$file keeps its list and draws the line', ({ file, reads }) => {
    const source = readRepoFile(file);
    expect(source).toMatch(HOLDS_OLDER_DATA);
    expect(source).toMatch(new RegExp(`<OutOfDateNote words=\\{${reads.replace('.', '\\.')}\\}`));
  });
});

describe('a screen that can hold older data draws the line or is owed it, never both (rule 6.4)', () => {
  it('finds every screen listed as drawing the line among those that can hold older data', () => {
    expect(screensHoldingOlderData(SOURCES)).toEqual(
      expect.arrayContaining(OUT_OF_DATE_LINES.map((each) => each.file)),
    );
  });

  it('lists each of them once, and each owed one by a product file with its reason', () => {
    expect(outOfDateFaults({ lines: OUT_OF_DATE_LINES, owed: OWED }, SOURCES)).toEqual([]);
  });
});

describe('the checker, on made-up lists', () => {
  const sources: Sources = new Map([
    [
      'src/a/Drawn.tsx',
      'return q.isRefetchError ? <OutOfDateNote words={A_COPY.outOfDate} /> : null;',
    ],
    ['src/a/Waiting.tsx', 'return <List items={q.data} outOfDate={q.isRefetchError} />;'],
    ['src/a/use-a.ts', 'return { items: q.data, isRefetchError: q.isRefetchError };'],
    ['src/a/Plain.tsx', 'return <Text>{q.data}</Text>;'],
  ]);
  const lines = [{ file: 'src/a/Drawn.tsx' }];
  const waiting = {
    file: 'src/a/Waiting.tsx',
    reason: 'its list footer changes in another branch',
  };

  it('passes lists that hold: a hook that passes the flag on is no screen', () => {
    expect(outOfDateFaults({ lines, owed: [waiting] }, sources)).toEqual([]);
  });

  it('names an owed entry that is no product file, or that gives no reason', () => {
    const gone = { file: 'src/a/Gone.tsx', reason: 'renamed since it was listed' };
    const bare = { ...waiting, reason: '  ' };
    expect(outOfDateFaults({ lines, owed: [waiting, gone, bare] }, sources)).toEqual([
      'src/a/Gone.tsx is owed the line but is no product file',
      'src/a/Waiting.tsx is owed the line and gives no reason',
    ]);
  });

  it('names a screen owed the line that is listed as drawing it, or draws it', () => {
    const drawn = { file: 'src/a/Drawn.tsx', reason: 'listed again by mistake' };
    expect(outOfDateFaults({ lines, owed: [waiting, drawn] }, sources)).toEqual([
      'src/a/Drawn.tsx is owed the line and listed as drawing it',
      'src/a/Drawn.tsx is owed the line but draws it: move it to OUT_OF_DATE_LINES',
    ]);
    expect(outOfDateFaults({ lines: [], owed: [waiting, drawn] }, sources)).toEqual([
      'src/a/Drawn.tsx is owed the line but draws it: move it to OUT_OF_DATE_LINES',
    ]);
    const both = [...lines, { file: waiting.file }];
    expect(outOfDateFaults({ lines: both, owed: [waiting] }, sources)).toEqual([
      'src/a/Waiting.tsx is owed the line and listed as drawing it',
    ]);
  });

  it('names a screen that can hold older data and is in neither list', () => {
    const neither = (file: string) =>
      `${file} can hold older data and is neither drawing the line nor owed it`;
    expect(outOfDateFaults({ lines, owed: [] }, sources)).toEqual([neither('src/a/Waiting.tsx')]);
    expect(outOfDateFaults({ lines: [], owed: [] }, sources)).toEqual([
      neither('src/a/Drawn.tsx'),
      neither('src/a/Waiting.tsx'),
    ]);
  });
});
