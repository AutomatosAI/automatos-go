// The named-state audit's lists (named-states.test.ts, rule 6.4): each named state this app can be
// in, with its words and the file that shows them, and every screen and sheet that keeps what it
// read after a failed refresh and draws the out-of-date line. None is owed the line, so there is no
// list of owed screens: a screen that keeps what it read is in OUT_OF_DATE_LINES, or the audit is
// wrong about it.

import { APP_ERROR_COPY } from '../../../api/strings';
import { AUTH_COPY } from '../../../auth/strings';
import { HISTORY_COPY } from '../../../chat/strings';
import { NOT_RUNNING_COPY } from '../../../connect/strings';
import { SHELL_COPY, SOCIAL_COPY, TICKET_COPY } from '../../../cc/strings';
import {
  PUSH_DIGEST_NOW_COPY,
  PUSH_INBOX_COPY,
  PUSH_PHONE_COPY,
  PUSH_SETTINGS_COPY,
} from '../../../push/strings';
import { READINESS_COPY, READINESS_WORDS } from '../../../readiness/strings';
import { CANDY_TEAM_COPY } from '../../../styles/candy/strings';
import { EDGE_COPY, LOOK_SYNC_COPY } from '../../../styles/strings';
import { SUGGESTION_COPY } from '../../../suggestions/strings';
import { RECOGNITION_COPY } from '../../../voice/strings';
import { frozen } from './types';

/** The five states rule 6.4 names: the audit requires each of them to be shown. */
export type NamedState =
  'out of date' | 'offline' | 'not set up' | 'waiting to send' | 'not downloaded';

export type Shown = Readonly<{
  state: NamedState;
  /** The words, from the feature's strings.ts. */
  words: string;
  /** The file that shows them, and what it reads them by. */
  file: string;
  reads: string;
}>;

const SAMPLE_LANGUAGE = 'Portuguese';

export const SHOWN: readonly Shown[] = frozen([
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
    state: 'out of date',
    words: HISTORY_COPY.outOfDate,
    file: 'src/chat/history/ChatsScreen.tsx',
    reads: 'HISTORY_COPY.outOfDate',
  },
  {
    state: 'out of date',
    words: READINESS_COPY.outOfDate,
    file: 'src/readiness/ReadinessSection.tsx',
    reads: 'READINESS_COPY.outOfDate',
  },
  {
    state: 'out of date',
    words: TICKET_COPY.outOfDate,
    file: 'src/cc/ticket/TicketSheet.tsx',
    reads: 'TICKET_COPY.outOfDate',
  },
  {
    state: 'out of date',
    words: SOCIAL_COPY.outOfDate,
    file: 'src/cc/social/SocialSheet.tsx',
    reads: 'SOCIAL_COPY.outOfDate',
  },
  {
    state: 'out of date',
    words: CANDY_TEAM_COPY.outOfDate,
    file: 'src/styles/candy/home/TeamView.tsx',
    reads: 'CANDY_TEAM_COPY.outOfDate',
  },
  {
    state: 'out of date',
    words: PUSH_SETTINGS_COPY.outOfDate,
    file: 'src/push/settings/PreferenceSections.tsx',
    reads: 'PUSH_SETTINGS_COPY.outOfDate',
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
]);

/**
 * Every screen and sheet that keeps what it read after a failed refresh, and the line it draws
 * over it. None is owed: the eight T27 named (the conversations in Studio and Play, what Auto
 * depends on, a Deliverable, a ticket, a post, Candy's team, the notification settings) draw it.
 */
export const OUT_OF_DATE_LINES: readonly Pick<Shown, 'file' | 'reads'>[] = frozen([
  { file: 'src/cc/board/BoardTab.tsx', reads: 'SHELL_COPY.outOfDate' },
  { file: 'src/cc/calendar/CalendarTab.tsx', reads: 'SHELL_COPY.outOfDate' },
  { file: 'src/cc/questions/QuestionsTab.tsx', reads: 'SHELL_COPY.outOfDate' },
  { file: 'src/cc/deliverables/DeliverablesTab.tsx', reads: 'SHELL_COPY.outOfDate' },
  { file: 'src/push/inbox/InboxScreen.tsx', reads: 'PUSH_INBOX_COPY.outOfDate' },
  { file: 'src/chat/history/ChatsScreen.tsx', reads: 'HISTORY_COPY.outOfDate' },
  { file: 'src/styles/homes/PlayConversationsScreen.tsx', reads: 'HISTORY_COPY.outOfDate' },
  { file: 'src/readiness/ReadinessSection.tsx', reads: 'READINESS_COPY.outOfDate' },
  { file: 'src/cc/deliverables/DeliverableDetail.tsx', reads: 'SHELL_COPY.outOfDate' },
  { file: 'src/cc/ticket/TicketSheet.tsx', reads: 'TICKET_COPY.outOfDate' },
  { file: 'src/cc/social/SocialSheet.tsx', reads: 'SOCIAL_COPY.outOfDate' },
  { file: 'src/styles/candy/home/TeamView.tsx', reads: 'CANDY_TEAM_COPY.outOfDate' },
  { file: 'src/push/settings/PreferenceSections.tsx', reads: 'PUSH_SETTINGS_COPY.outOfDate' },
]);
