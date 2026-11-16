// An app's record, TEMPLATE.md, as app-record.test.ts reads it (docs/app-standard.md 'The app's
// record'): its line naming the template commit and the commit the standard was read at, its
// 'Kept, removed, changed' table, and its 'Differences from the app standard' table, whose first
// column cites a rule. Pure over strings (text in, a list of faults out); the test reads the files.
// The standard's rule numbers come from standard-rules.json, which the template writes from its
// docs/app-standard.md (scripts/generate-standard-rules.mjs) and every copy keeps.

import { z } from 'zod';

import { sectionStartingWith, tableWithColumns, type MarkdownTable } from './markdown';

/** The record's one name, beside package.json. */
export const RECORD_FILE = 'TEMPLATE.md';
export const RULES_PATH = 'src/release/__tests__/support/standard-rules.json';
export const KEPT_HEADING = 'Kept, removed, changed';
export const KEPT_COLUMNS = ['Part', 'Kept, removed or changed', 'Why'] as const;
export const DIFFERENCES_HEADING = 'Differences from the app standard';
export const DIFFERENCE_COLUMNS = [
  'Rule',
  'What this app does',
  'Why',
  'Stays, or closes with',
] as const;
/** The cells a difference may never leave blank. */
const FILLED_COLUMNS = ['What this app does', 'Stays, or closes with'] as const;

/** How many of the record's first lines (blank ones not counted) may hold the lineage line. */
const LINEAGE_WITHIN = 3;
const LINEAGE = /^Template commit: (.+?)\. Standard read at: (.+?)\.$/;
const FULL_SHA = /^[0-9a-f]{40}$/;
const SOME_SHA = /^[0-9a-f]{7,40}$/;
const PLACEHOLDER = /^<[^<>]+>$/;
const CITATION_MARKS = /[`*]/g;

const rulesSchema = z.object({
  note: z.string().min(1),
  sections: z.array(
    z.object({
      id: z.string().regex(/^\d+$/),
      title: z.string().min(1),
      rules: z.array(z.string().regex(/^\d+\.\d+[a-z]?$/)),
    }),
  ),
});

export type StandardRules = z.infer<typeof rulesSchema>;

/** standard-rules.json's text, parsed: throws with zod's issues when it does not fit. */
export function parseStandardRules(text: string): StandardRules {
  return rulesSchema.parse(JSON.parse(text));
}

/** Every number a record may cite: each rule's id, and each numbered section's. */
export function citableIds(rules: StandardRules): ReadonlySet<string> {
  return new Set(rules.sections.flatMap((section) => [section.id, ...section.rules]));
}

export type RecordOptions = Readonly<{
  /** The standard's own example: a '<…>' stands where a commit goes. */
  placeholders?: boolean;
}>;

function shaFault(what: string, value: string, shape: RegExp, options: RecordOptions): string[] {
  if (shape.test(value) || (options.placeholders === true && PLACEHOLDER.test(value))) return [];
  return [`${what} '${value}' is not ${shape === FULL_SHA ? 'a 40-character sha' : 'a sha'}`];
}

function lineageFaults(text: string, options: RecordOptions): string[] {
  const first = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('# '))
    .slice(0, LINEAGE_WITHIN);
  const match = first.map((line) => LINEAGE.exec(line)).find((found) => found !== null);
  if (!match) {
    return ["its first lines do not say 'Template commit: <sha>. Standard read at: <sha>.'"];
  }
  return [
    ...shaFault('the template commit', match[1], FULL_SHA, options),
    ...shaFault('the commit the standard was read at', match[2], SOME_SHA, options),
  ];
}

type Found = Readonly<{ table: MarkdownTable | null; faults: readonly string[] }>;

/** The one table under a '## ' heading with every named column, or why there is none. */
function tableUnder(text: string, heading: string, columns: readonly string[]): Found {
  try {
    return { table: tableWithColumns(sectionStartingWith(text, heading), columns), faults: [] };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return {
      table: null,
      faults: [`'## ${heading}' has no table of ${columns.join(', ')}: ${why}`],
    };
  }
}

/** The rule numbers one Rule cell cites: '5.4', or several, '4.1, 4.5'. */
function citations(cell: string): string[] {
  return cell
    .replace(CITATION_MARKS, '')
    .split(',')
    .map((each) => each.trim());
}

function differenceFaults(table: MarkdownTable, cited: ReadonlySet<string>): string[] {
  return table.rows.flatMap((row, index) => {
    const where = `difference ${index + 1}`;
    const rules = citations(row.Rule ?? '');
    const unknown = rules.filter((rule) => !cited.has(rule));
    const blank = FILLED_COLUMNS.filter((column) => (row[column] ?? '').trim() === '');
    return [
      ...unknown.map((rule) =>
        rule === '' ? `${where} cites no rule` : `${where} cites '${rule}', which is no rule`,
      ),
      ...blank.map((column) => `${where} leaves '${column}' blank`),
    ];
  });
}

/** What is wrong with a record, one sentence each; empty when it is whole. */
export function recordFaults(
  text: string,
  cited: ReadonlySet<string>,
  options: RecordOptions = {},
): string[] {
  const kept = tableUnder(text, KEPT_HEADING, KEPT_COLUMNS);
  const differences = tableUnder(text, DIFFERENCES_HEADING, DIFFERENCE_COLUMNS);
  return [
    ...lineageFaults(text, options),
    ...kept.faults,
    ...differences.faults,
    ...(differences.table ? differenceFaults(differences.table, cited) : []),
  ];
}

/** The example record in the standard's 'The app's record' section: its ```markdown block. */
export function recordExample(standard: string): string {
  const lines = standard.split('\n');
  const heading = lines.indexOf("## The app's record");
  const open = lines.findIndex((line, index) => index > heading && line === '```markdown');
  const close = lines.findIndex((line, index) => index > open && line === '```');
  if (heading === -1 || open === -1 || close === -1) {
    throw new Error("the standard has no ```markdown example under '## The app's record'");
  }
  return lines.slice(open + 1, close).join('\n');
}
