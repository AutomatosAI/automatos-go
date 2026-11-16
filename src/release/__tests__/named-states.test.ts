// Rule 6.4 (docs/app-standard.md, T11 of the record): a screen says what it is showing. Data that
// is out of date stays on screen under a line that says so; not set up, offline, waiting to send
// and not downloaded are named states with words of their own. This walks each named state the app
// can be in: its words come from its feature's strings.ts and are read where it is shown, they are
// not empty, they are not any loading words and not the failed words (UI_COPY's title, the error
// kinds' own), and every screen that keeps a list after a failed refresh draws its line.
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

import { describe, expect, it } from 'vitest';

import { API_ERROR_COPY, APP_ERROR_COPY } from '../../api/strings';
import { AUTH_COPY } from '../../auth/strings';
import { NOT_RUNNING_COPY } from '../../connect/strings';
import { SHELL_COPY } from '../../cc/strings';
import { PUSH_DIGEST_NOW_COPY, PUSH_INBOX_COPY, PUSH_PHONE_COPY } from '../../push/strings';
import { READINESS_WORDS } from '../../readiness/strings';
import { EDGE_COPY, LOOK_SYNC_COPY } from '../../styles/strings';
import { SUGGESTION_COPY } from '../../suggestions/strings';
import { UI_COPY } from '../../ui/strings';
import { RECOGNITION_COPY } from '../../voice/strings';
import { copyModules, readRepoFile } from './support/tree';

type NamedState = 'out of date' | 'offline' | 'not set up' | 'waiting to send' | 'not downloaded';

type Shown = Readonly<{
  state: NamedState;
  /** The words, from the feature's strings.ts. */
  words: string;
  /** The file that shows them, and what it reads them by. */
  file: string;
  reads: string;
}>;

const SAMPLE_LANGUAGE = 'Portuguese';

const SHOWN: readonly Shown[] = [
  {
    state: 'out of date',
    words: SHELL_COPY.outOfDate,
    file: 'src/cc/board/BoardTab.tsx',
    reads: 'SHELL_COPY.outOfDate',
  },
  {
    state: 'out of date',
    words: PUSH_INBOX_COPY.outOfDate,
    file: 'src/push/inbox/InboxScreen.tsx',
    reads: 'PUSH_INBOX_COPY.outOfDate',
  },
  {
    state: 'offline',
    words: SHELL_COPY.live.offline,
    file: 'src/cc/shell/chrome.ts',
    reads: 'SHELL_COPY.live.offline',
  },
  {
    state: 'offline',
    words: SUGGESTION_COPY.refused.offline,
    file: 'src/suggestions/model.ts',
    reads: 'SUGGESTION_COPY.refused.offline',
  },
  {
    state: 'offline',
    words: NOT_RUNNING_COPY.status,
    file: 'src/connect/edges.ts',
    reads: 'NOT_RUNNING_COPY.status',
  },
  {
    state: 'offline',
    words: EDGE_COPY.notRunning.status,
    file: 'src/styles/edges/edges.ts',
    reads: 'EDGE_COPY.notRunning',
  },
  {
    state: 'not set up',
    words: READINESS_WORDS.needs_setup,
    file: 'src/readiness/view-model.ts',
    reads: 'READINESS_WORDS[state]',
  },
  {
    state: 'not set up',
    words: PUSH_PHONE_COPY.notConfigured,
    file: 'src/push/settings/view-model.ts',
    reads: 'PUSH_PHONE_COPY.notConfigured',
  },
  {
    state: 'not set up',
    words: AUTH_COPY.notConfiguredMessage,
    file: 'src/auth/AuthRoot.tsx',
    reads: 'AUTH_COPY.notConfiguredMessage',
  },
  {
    state: 'not set up',
    words: APP_ERROR_COPY.signInNotSetUp,
    file: 'src/api/errors.ts',
    reads: 'APP_ERROR_COPY.signInNotSetUp',
  },
  {
    state: 'not set up',
    words: LOOK_SYNC_COPY.playNotInstalled,
    file: 'src/styles/sync/look-themes.ts',
    reads: 'LOOK_SYNC_COPY.playNotInstalled',
  },
  {
    state: 'not set up',
    words: LOOK_SYNC_COPY.arcadeNotInstalled,
    file: 'src/styles/sync/look-themes.ts',
    reads: 'LOOK_SYNC_COPY.arcadeNotInstalled',
  },
  {
    state: 'not set up',
    words: LOOK_SYNC_COPY.candyNotInstalled,
    file: 'src/styles/sync/look-themes.ts',
    reads: 'LOOK_SYNC_COPY.candyNotInstalled',
  },
  {
    state: 'waiting to send',
    words: PUSH_DIGEST_NOW_COPY.queued,
    file: 'src/push/settings/use-digest-now.ts',
    reads: 'PUSH_DIGEST_NOW_COPY.queued',
  },
  {
    state: 'not downloaded',
    words: RECOGNITION_COPY.download(SAMPLE_LANGUAGE),
    file: 'src/voice/screen/voice-view-model.ts',
    reads: 'RECOGNITION_COPY.download',
  },
];

/** Every screen that keeps its list after a failed refresh, and the line it draws over it. */
const OUT_OF_DATE_LINES: readonly Pick<Shown, 'file' | 'reads'>[] = [
  { file: 'src/cc/board/BoardTab.tsx', reads: 'SHELL_COPY.outOfDate' },
  { file: 'src/cc/calendar/CalendarTab.tsx', reads: 'SHELL_COPY.outOfDate' },
  { file: 'src/cc/questions/QuestionsTab.tsx', reads: 'SHELL_COPY.outOfDate' },
  { file: 'src/cc/deliverables/DeliverablesTab.tsx', reads: 'SHELL_COPY.outOfDate' },
  { file: 'src/push/inbox/InboxScreen.tsx', reads: 'PUSH_INBOX_COPY.outOfDate' },
];

/**
 * Screens that keep what they read after a failed refresh with no line yet: owed (rule 6.4), each
 * a branch and its feature's words. A fixed one leaves this list, or the test fails.
 */
const OWED: readonly { readonly file: string; readonly why: string }[] = [
  {
    file: 'src/chat/history/ChatsScreen.tsx',
    why: 'the conversations stay listed after a failed refresh (historyState: a list is loaded)',
  },
  {
    file: 'src/styles/homes/PlayConversationsScreen.tsx',
    why: "Play's conversations, from the same history",
  },
  {
    file: 'src/readiness/ReadinessSection.tsx',
    why: 'what Auto depends on stays listed when Check again or a refresh fails',
  },
  {
    file: 'src/cc/deliverables/DeliverableDetail.tsx',
    why: 'a Deliverable stays open after a failed refresh',
  },
  { file: 'src/cc/ticket/TicketSheet.tsx', why: 'a ticket stays open after a failed refresh' },
  { file: 'src/cc/social/SocialSheet.tsx', why: 'a post stays open after a failed refresh' },
  {
    file: 'src/styles/candy/home/TeamView.tsx',
    why: "Candy's team stays listed after a failed refresh",
  },
  {
    file: 'src/push/settings/PreferenceSections.tsx',
    why: 'the opposite: a failed refresh replaces the settings it holds with the failed state',
  },
];

/** Every loading word in every copy module: a key that names loading, checking or uploading. */
const LOADING_WORDS = new Set(
  copyModules().flatMap((file) =>
    [
      ...readRepoFile(file).matchAll(/\b\w*(?:loading|checking|uploading)\w*\s*:\s*'([^']+)'/gi),
    ].map((match) => match[1]),
  ),
);
const FAILED_WORDS = new Set<string>([UI_COPY.errorTitle, ...Object.values(API_ERROR_COPY)]);

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
    expect(source).toMatch(/\.isRefetchError\b/);
    expect(source).toMatch(new RegExp(`<OutOfDateNote words=\\{${reads.replace('.', '\\.')}\\}`));
  });

  it.each(OWED)('$file is owed its line: $why', ({ file, why }) => {
    expect(why).not.toBe('');
    expect(readRepoFile(file)).not.toContain('<OutOfDateNote');
  });
});
