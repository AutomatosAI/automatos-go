// PRD-268 in Candy (D-CAN-8, US-023n): the day's brief on the Chat view's rows (threadRows' briefs,
// as Play's and Arcade's homes read it), a suggestion Auto posted as its card in the thread
// (threadRows' suggestions, §6.5.1), the thread opened at its focus message (US-G03, as Play's
// thread opens), 'Ideas · N' in Today's header (today.ts ideasPill over
// use-ideas.tsx's button), and what Candy draws while a feature is not offered: no brief where
// discovery does not list `brief`, no pill without an open suggestion, no approval line while no
// card waits with an ApprovalView. The components load React Native, so how they are wired is read
// from the product files as the release audits read them (codeOf: comments removed).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canBrief, canSuggestions, type GateInput } from '../../../api/capabilities';
import { VIEW } from '../../../approvals/__tests__/fixtures';
import { waitingSheetCard } from '../../../approvals/waiting';
import { PROSE, WIRE_BRIEF, briefMessage } from '../../../brief/__tests__/fixtures';
import { saved } from '../../../chat/__tests__/thread-fixtures';
import { StoredMessageSchema, type StoredMessage } from '../../../chat/schemas';
import { opened, streaming } from '../../../chat/__tests__/view-model-fixtures';
import { reportTarget } from '../../../chat/report/report';
import { threadRows } from '../../../chat/view-model';
import { parseLine, type Frame } from '../../../core/ai-sdk-stream';
import { codeOf } from '../../../release/__tests__/support/code';
import { countText } from '../../../suggestions/model';
import { SUGGESTION_COPY } from '../../../suggestions/strings';
import { chatEntries, type ChatEntry } from '../../candy/home/chat';
import { COMPOSER } from '../../candy/home/composer';
import { ideasPill } from '../../candy/home/today';
import { STUDIO_SPACING } from '../../tokens/studio';
import { TOOL_APPROVAL } from './fixtures';

const ASKED = saved('u1', 'user', 'Brief me');
const REPLY = saved('a1', 'assistant', 'Here it is.');
const OFFERED: GateInput = { capabilities: ['brief'], push: { expo: true } };
const NOT_OFFERED: GateInput = { capabilities: ['suggestions'], push: { expo: true } };
const NO_PLACES = new Map();

const HOME = 'src/styles/homes/CandyHome.tsx';
const CHAT = 'src/styles/homes/use-candy-chat.ts';
const ENTRY = 'src/styles/candy/home/ChatEntry.tsx';
const STAGE = 'src/styles/candy/home/ChatStage.tsx';
const VIEW_FILE = 'src/styles/candy/home/ChatView.tsx';
const STYLE_HOME = 'src/styles/homes/StyleHome.tsx';
const TODAY = 'src/styles/candy/home/TodayView.tsx';

/** The Chat view's entries over these messages, gated as useCandyChat gates them. */
function entriesOf(discovery: GateInput, messages: readonly StoredMessage[] = [briefMessage()]) {
  const state = opened([ASKED, REPLY, ...messages]);
  const gates = { briefs: canBrief(discovery), suggestions: canSuggestions(discovery) };
  return chatEntries(threadRows(state, gates), NO_PLACES);
}

const SUGGESTION_ID = '5b0c3f7e-8a51-4c1f-9d2e-0f6a7b8c9d10';
const SUGGESTED = 'Auto suggests: “Lisbon flights”. Fares drop on Tuesdays.';

/** Auto's post of a suggestion: its words and the suggestion@1 part (suggestion-row.test.ts's). */
function suggestionPost(): StoredMessage {
  return StoredMessageSchema.parse({
    id: 'm-idea',
    role: 'assistant',
    parts: [
      { type: 'text', text: SUGGESTED },
      { type: 'suggestion@1', suggestion_id: SUGGESTION_ID },
    ],
    attachments: [],
    source: { origin: 'suggestion', suggestion_id: SUGGESTION_ID, label: null },
    createdAt: '2026-10-28T08:00:00.000Z',
  });
}

function briefEntry(entries: readonly ChatEntry[]) {
  const entry = entries.find((each) => each.key === 'm-brief');
  if (entry?.kind !== 'auto') throw new Error('no reply entry for the brief’s message');
  return entry;
}

describe('the day’s brief on the Chat view', () => {
  it('keeps the brief on its reply where discovery lists `brief`, its words still the text', () => {
    const { row } = briefEntry(entriesOf(OFFERED));
    expect(row.brief?.greeting).toBe(WIRE_BRIEF.greeting);
    expect(row.answer).toBe(PROSE);
  });

  it('keeps Report this on the brief’s message', () => {
    const { row } = briefEntry(entriesOf(OFFERED));
    expect(reportTarget(row, true)).toEqual({ target_type: 'message', target_id: 'm-brief' });
  });

  it('draws the text alone where discovery does not list `brief`', () => {
    expect(canBrief(NOT_OFFERED)).toBe(false);
    expect(canBrief(null)).toBe(false);
    const { row } = briefEntry(entriesOf(NOT_OFFERED));
    expect(row.brief).toBeNull();
    expect(row.answer).toBe(PROSE);
  });

  it('leaves the other replies as they were', () => {
    const other = entriesOf(OFFERED).find((entry) => entry.key === 'a1');
    expect(other?.kind === 'auto' ? [other.row.answer, other.row.brief] : null).toEqual([
      'Here it is.',
      null,
    ]);
  });
});

describe('a suggestion Auto posted, on the Chat view', () => {
  it('is its own entry where discovery lists `suggestions`: the card’s id, and his words as the fallback', () => {
    const [entry] = entriesOf(NOT_OFFERED, [suggestionPost()]).slice(-1);
    if (entry?.kind !== 'suggestion') throw new Error('expected the suggestion’s entry');
    expect(entry.key).toBe('m-idea');
    expect(entry.suggestionId).toBe(SUGGESTION_ID);
    expect(entry.text.kind).toBe('auto');
    expect(entry.text.row.answer).toBe(SUGGESTED);
  });

  it('is Auto’s reply, never a card, where discovery does not list `suggestions`', () => {
    const [entry] = entriesOf(OFFERED, [suggestionPost()]).slice(-1);
    expect(entry?.kind).toBe('auto');
    if (entry?.kind !== 'auto') throw new Error('expected Auto’s entry');
    expect(entry.row.answer).toBe(SUGGESTED);
  });
});

describe("'Ideas · N' in Today's header", () => {
  const onPress = () => undefined;

  it('shows the count every header shows, with its own label for VoiceOver', () => {
    const text = countText(3) ?? '';
    const label = SUGGESTION_COPY.countLabel(3);
    expect(ideasPill({ text, label, onPress })).toEqual({ text, label, onPress });
    expect(text).toBe('Ideas · 3');
  });

  it('shows nothing when the header count shows nothing', () => {
    expect(ideasPill(null)).toBeNull();
  });
});

/** A tool approval raised live, as the stream reads it; with `view`, it carries ApprovalView@1. */
function raised(view: boolean): Frame {
  const card = { grant_id: 41, action: 'send_email', ...(view ? { approval_view: VIEW } : {}) };
  return parseLine(`d:${JSON.stringify({ type: 'tool-data', data: { tool_approval: card } })}`);
}

describe('the approval line', () => {
  it('has nothing to show while no card waits with an ApprovalView', () => {
    expect(waitingSheetCard(threadRows(opened([ASKED, REPLY])))).toBeNull();
    expect(waitingSheetCard(threadRows(streaming(TOOL_APPROVAL)))).toBeNull();
    expect(waitingSheetCard(threadRows(streaming(raised(false))))).toBeNull();
    expect(waitingSheetCard(threadRows(streaming(raised(true))))?.kind).toBe('tool');
  });
});

describe('how the home wires them', () => {
  it('runs useIdeas and useHudApproval on the home’s one thread, and mounts the ideas sheet once', () => {
    const home = codeOf(HOME);
    expect(home).toMatch(/const ideas = useIdeas\(\);/);
    expect(home).toMatch(
      /const approval = useHudApproval\(home\.thread\.state, home\.thread\.settleCard\);/,
    );
    expect(home.match(/\{ideas\.sheet\}/g)).toHaveLength(1);
    expect(home).toMatch(/<TodayView\b[^>]*ideas=\{ideasPill\(ideas\.button\)\}/);
    expect(home).toMatch(/<ChatPane\b[^>]*approval=\{approval\.line\}/);
  });

  it('pins the newest suggestion directly above the message box, lined up with it', () => {
    const home = codeOf(HOME);
    expect(home).toMatch(/<PinnedSuggestion inset=\{COMPOSER_INSET\}\s*\/>\s*<ChatComposer\b/);
    expect(home).toMatch(/const COMPOSER_INSET: SpaceName = 'space6';/);
    expect(STUDIO_SPACING.space6).toBe(COMPOSER.side);
  });

  it('gates the Chat view’s rows on `brief`, and draws a brief in Auto’s bubble with its entrance', () => {
    expect(codeOf(CHAT)).toMatch(/const \{ discovery \} = useAppSession\(\);\s*const briefs = canBrief\(discovery\);/);
    expect(codeOf(CHAT)).toMatch(/threadRows\(state, \{ briefs, suggestions \}\)/);
    expect(codeOf(ENTRY)).toMatch(
      /row\.brief \? \(<BriefEntrance brief=\{row\.brief\}>\s*<AutoBubble>\s*<BriefBody brief=\{row\.brief\} onLink=\{onLink\}\s*\/>/,
    );
  });

  it('gates suggestion rows on `suggestions` and draws the card, else Auto’s entry, through ThreadSuggestion', () => {
    expect(codeOf(CHAT)).toMatch(/const suggestions = canSuggestions\(discovery\);/);
    expect(codeOf(ENTRY)).toMatch(
      /case 'suggestion':\s*return \(\s*<ThreadSuggestion\s*suggestionId=\{entry\.suggestionId\}\s*fallback=\{<AutoEntry \{\.\.\.props\} entry=\{entry\.text\}\s*\/>\}/,
    );
  });

  it('opens the thread at its focus message: the route’s, else the brief on open’s, scrolled to once', () => {
    expect(codeOf(CHAT)).toMatch(/useThreadFocus\(state\.chatId, routeFocus\)/);
    expect(codeOf(VIEW_FILE)).toMatch(/useFocusScroll\(list, entries, focusMessageId, onFocused\)/);
    expect(codeOf(VIEW_FILE)).toMatch(/scrollOnAdd\(\);\s*focusRun\(\);/);
    expect(codeOf(VIEW_FILE)).toMatch(/onScrollToIndexFailed=\{focus\.onScrollToIndexFailed\}/);
    expect(codeOf(HOME)).toMatch(/useCandyChat\(home, focusMessageId\)/);
    expect(codeOf(HOME)).toMatch(/focusMessageId=\{chat\.focus\}\s*onFocused=\{chat\.onFocused\}/);
    expect(codeOf(STYLE_HOME)).toMatch(/<CandyHome[^>]*view="chat"\s*focusMessageId=\{focusMessageId\}/);
  });

  it('puts the approval line under the stage’s state pill, and Ideas beside Today’s pause', () => {
    expect(codeOf(STAGE)).toMatch(
      /<StatePill stage=\{stage\}\s*\/>[\s\S]*?<\/View>\s*<ApprovalLine approval=\{approval\}\s*\/>/,
    );
    expect(codeOf(TODAY)).toMatch(
      /\{ideas \? <HeaderPill \{\.\.\.ideas\}\s*\/> : null\}\s*<CandyPauseButton\s*\/>/,
    );
  });
});

describe('the pure module', () => {
  it('today.ts imports no React, React Native, Expo or Skia (D-SHAPE)', () => {
    const source = readFileSync(path.resolve(__dirname, '../../candy/home/today.ts'), 'utf8');
    expect(source).not.toMatch(/from '(react|react-native[^']*|expo[^']*|@shopify\/[^']*)'/);
  });
});
