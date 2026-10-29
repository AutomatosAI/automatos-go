// The brief as the phone draws it (PRD-268 §6.11.2, §6.12.3 'Brief card', US-G06), pure. A brief
// arrives as a `brief@1` part of a message in the Auto thread; briefOf reads it from a saved
// message. briefView turns it into the card's sections in §6.11.2's order, each with its label and
// count, folded at 5 and never at 6 (a section only one row over shows whole), and the empty
// sentence when no section has a row. The needs-you count is the strip's (the foundation's
// useNeedsYou total, the one the header badge reads, D26), so the card, the strip and the badge
// never disagree; the brief's own counts.needs_you stands in only until that number has loaded.
// A row's action is drawn only where it goes somewhere (briefTarget), and VoiceOver hears it with
// the row: "Start: Lisbon flights". HUD numbers the rows that ask for something (needs you, then
// suggestions) so "start two" is a sentence a person can say (§6.12.6).

import { missionHref } from '../core/web/lib/ticket-links';
import { isTaskId, isUsableId, routes } from '../navigation/routes';
import { appRouteForWebLink, type WebLinkTarget } from '../navigation/web-links';
import type { StoredMessage } from '../chat/schemas';
import {
  BRIEF_SECTIONS,
  type Brief,
  type BriefOpensType,
  type BriefRow,
  type BriefSectionName,
} from './schema';
import { BRIEF_COPY } from './strings';

/** A section shows this many rows and folds the rest (§6.11.2). */
export const BRIEF_FOLD_AT = 5;

export type BriefRowView = {
  readonly key: string;
  readonly row: BriefRow;
  /** Where the row's action goes; null draws no action and no chevron. */
  readonly target: WebLinkTarget | null;
  /** The action's words ('Start'), shown with an arrow; null when there is no action to draw. */
  readonly actionLabel: string | null;
  /** VoiceOver's name for the action: 'Start: Lisbon flights'. */
  readonly actionAccessibilityLabel: string | null;
  /** HUD's number ('01'); null for the rows it does not number. */
  readonly number: string | null;
};

export type BriefSectionView = {
  readonly name: BriefSectionName;
  readonly label: string;
  /** The section's exact count (counts.*), the strip's for needs_you; null where none is kept. */
  readonly count: number | null;
  readonly shown: readonly BriefRowView[];
  /** Rows behind 'Show N more'. */
  readonly folded: readonly BriefRowView[];
};

export type BriefView = {
  /** 'Tuesday, 28 October', from the brief's local date. */
  readonly dateLabel: string;
  readonly greeting: string;
  readonly prose: string;
  readonly sections: readonly BriefSectionView[];
  /** The empty sentence when no section has a row; null otherwise. */
  readonly empty: string | null;
  /** The needs-you number the card says: the strip's. */
  readonly needsYou: number;
};

/** The brief@1 part of a saved message (its structured parts), or null. */
export function briefOf(message: Pick<StoredMessage, 'structured'>): Brief | null {
  return message.structured?.find((part) => part.type === 'brief@1')?.brief ?? null;
}

/** The one needs-you number: the strip's once it has loaded, else the brief's own. */
export function briefNeedsCount(brief: Pick<Brief, 'counts'>, stripTotal: number | null): number {
  return stripTotal !== null && Number.isFinite(stripTotal) && stripTotal >= 0
    ? stripTotal
    : brief.counts.needs_you;
}

type TargetOf = (id: string, webUrl: string | undefined) => WebLinkTarget | null;

/** Each opens.type's place: an app screen, or Studio in the browser where the phone has none. */
const TARGETS: Readonly<Record<BriefOpensType, TargetOf>> = Object.freeze({
  ticket: (id) => (isTaskId(id) ? { app: routes.cc.ticket(id) } : null),
  mission: (id, webUrl) => appRouteForWebLink(missionHref(id), webUrl),
  question: () => ({ app: routes.cc.questions }),
  chat: (id) => ({ app: routes.chat(id) }),
  deliverable: (id) => ({ app: routes.cc.deliverable(id) }),
  settings: () => ({ app: routes.settings }),
  // Start and Hide on a suggestion are US-G01's (POST …/start behind Face ID), not a link
  suggestion: () => null,
});

/** Where a row goes (Start and Answer route by opens.type; a question opens Questions). */
export function briefTarget(row: BriefRow, webUrl?: string): WebLinkTarget | null {
  const opens = row.opens;
  if (!opens || !isUsableId(opens.id)) return null;
  return TARGETS[opens.type](opens.id.trim(), webUrl);
}

/** The row's action as the card draws it: only where it goes somewhere. */
function actionOf(row: BriefRow, target: WebLinkTarget | null) {
  const label = row.action?.label ?? null;
  if (label === null || target === null) return { label: null, accessible: null };
  return { label, accessible: `${label}: ${row.title}` };
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

type RowPlace = {
  readonly section: BriefSectionName;
  readonly index: number;
  readonly number: number | null;
};

/** A row's key is its section and place: the brief may list one id in two sections. */
function rowView(row: BriefRow, place: RowPlace, webUrl?: string): BriefRowView {
  const target = briefTarget(row, webUrl);
  const action = actionOf(row, target);
  const { number } = place;
  return {
    key: `${place.section}:${place.index}:${row.id}`,
    row,
    target,
    actionLabel: action.label,
    actionAccessibilityLabel: action.accessible,
    number: number === null ? null : twoDigits(number),
  };
}

/** Fold at 5, never at 6: a section only one row over shows whole. */
export function foldRows<T>(rows: readonly T[]): { shown: readonly T[]; folded: readonly T[] } {
  if (rows.length <= BRIEF_FOLD_AT + 1) return { shown: rows, folded: [] };
  return { shown: rows.slice(0, BRIEF_FOLD_AT), folded: rows.slice(BRIEF_FOLD_AT) };
}

/** The sections HUD numbers: what asks the person for something. */
const NUMBERED: ReadonlySet<BriefSectionName> = new Set(['needs_you', 'suggestions']);

function sectionCount(brief: Brief, name: BriefSectionName, needsYou: number): number | null {
  if (name === 'needs_you') return needsYou;
  return name === 'unchecked' ? null : brief.counts[name];
}

export type BriefViewOptions = {
  /** The strip's needs-you total; null before it has loaded. */
  readonly needsYou: number | null;
  readonly webUrl?: string;
};

/** HUD's first number in a section: needs you from 1, suggestions after them; null unnumbered. */
function firstNumber(brief: Brief, name: BriefSectionName): number | null {
  if (!NUMBERED.has(name)) return null;
  return name === 'needs_you' ? 1 : brief.sections.needs_you.length + 1;
}

/** The card for one brief: its sections in order, each folded, numbered for HUD. */
export function briefView(brief: Brief, { needsYou, webUrl }: BriefViewOptions): BriefView {
  const total = briefNeedsCount(brief, needsYou);
  const sections = BRIEF_SECTIONS.flatMap((name): BriefSectionView[] => {
    const rows = brief.sections[name];
    if (rows.length === 0) return [];
    const first = firstNumber(brief, name);
    const views = rows.map((row, index) =>
      rowView(row, { section: name, index, number: first === null ? null : first + index }, webUrl),
    );
    const { shown, folded } = foldRows(views);
    const count = sectionCount(brief, name, total);
    return [{ name, label: BRIEF_COPY.sections[name], count, shown, folded }];
  });
  return {
    dateLabel: briefDateLabel(brief.date),
    greeting: brief.greeting.trim(),
    prose: brief.prose.trim(),
    sections,
    // never "Nothing new needs you" beside a strip that still counts something
    empty: sections.length === 0 && total === 0 ? BRIEF_COPY.empty : null,
    needsYou: total,
  };
}

/** 'Needs you · 2'; a section without a count says only its label. */
export function sectionHeading(section: Pick<BriefSectionView, 'label' | 'count'>): string {
  return section.count === null ? section.label : `${section.label} · ${section.count}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'Tuesday, 28 October' for '2026-10-28'; the date as given when it is not one. */
export function briefDateLabel(date: string): string {
  const match = ISO_DATE.exec(date.trim());
  if (!match) return date.trim();
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const at = new Date(Date.UTC(year, month - 1, day));
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return date.trim();
  return BRIEF_COPY.dateLabel(
    BRIEF_COPY.weekdays[at.getUTCDay()],
    day,
    BRIEF_COPY.months[month - 1],
  );
}

/** A thread row as the on-screen check reads it: Auto's row, with the brief it carries. */
type SeenRow = { readonly type: string; readonly brief?: Brief | null };

/** Any of the rows on screen carries the day's brief (Studio's strip then shrinks to its count). */
export function briefOnScreen(onScreen: readonly { readonly item: SeenRow }[]): boolean {
  return onScreen.some(
    ({ item }) => item.type === 'auto' && item.brief !== null && item.brief !== undefined,
  );
}
