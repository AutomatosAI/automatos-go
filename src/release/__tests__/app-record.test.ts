// The app's record (docs/app-standard.md 'The app's record', T10 of the standard's record): each
// copy of the template keeps one TEMPLATE.md beside its package.json that names the template commit
// it came from and the commit of the standard it was read at, carries the 'Kept, removed, changed'
// and 'Differences from the app standard' tables, and cites only rules that exist. The rules that
// exist are support/standard-rules.json, which travels with the audits because a copy has no
// docs/app-standard.md. The template keeps no TEMPLATE.md (settings/record.ts says which this app
// is): here the list is held to the standard's own headings, and the checker is proved on the
// standard's example and on records made up below. In a copy, the copy's own TEMPLATE.md is held.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GENERATED_NOTE,
  OUTPUT_PATH,
  SOURCE_PATH,
  StandardError,
  serialise,
  standardRules,
} from '../../../scripts/generate-standard-rules.mjs';
import { APP_RECORD } from './settings/record';
import {
  RECORD_FILE,
  RULES_PATH,
  citableIds,
  parseStandardRules,
  recordExample,
  recordFaults,
} from './support/app-record';
import { readRepoFile, repoRoot } from './support/tree';

const COMMAND = 'node scripts/generate-standard-rules.mjs';
const rules = parseStandardRules(readRepoFile(RULES_PATH));
const CITABLE = citableIds(rules);
const SHA = '0123456789abcdef0123456789abcdef01234567';

/** A record in the standard's shape, with its lineage line and its difference rows given. */
function record(lineage: string, differences: readonly string[]): string {
  return [
    '# Where this app came from, and where it differs',
    '',
    lineage,
    '',
    '## Kept, removed, changed',
    '',
    '| Part | Kept, removed or changed | Why |',
    '|---|---|---|',
    '| The Tabs shell | Kept, mounted | Four places of equal weight |',
    '',
    '## Differences from the app standard',
    '',
    '| Rule | What this app does | Why | Stays, or closes with |',
    '|---|---|---|---|',
    ...differences,
    '',
  ].join('\n');
}

const LINEAGE = `Template commit: ${SHA}. Standard read at: 894c0ba.`;
const GOOD_ROWS = [
  '| 5.4 | Tabs, docked | Four places of equal weight | Stays |',
  '| 9.4 | Does not apply | The app has no voice | Stays |',
  '| 13.2a, 14.3 | No downloads yet | Nothing is fetched as a file | Closes with the file viewer |',
];

describe("the standard's rule numbers (support/standard-rules.json)", () => {
  it('lists the numbered sections and their rules, each once, each under its own section', () => {
    expect(rules.note).toBe(GENERATED_NOTE);
    expect(rules.sections.length).toBeGreaterThanOrEqual(17);
    const ids = rules.sections.flatMap((section) => [section.id, ...section.rules]);
    expect(new Set(ids).size).toBe(ids.length);
    rules.sections.forEach((section) =>
      section.rules.forEach((rule) => expect(rule.split('.')[0], rule).toBe(section.id)),
    );
    ['1.1', '4.2', '13.2a', '14.2', '16.2'].forEach((rule) => expect(CITABLE).toContain(rule));
  });
});

describe('the checker, on made-up records', () => {
  it('passes a whole record', () => {
    expect(recordFaults(record(LINEAGE, GOOD_ROWS), CITABLE)).toEqual([]);
  });

  it('names a cited rule the standard does not have, and a row that cites none', () => {
    const rows = [...GOOD_ROWS, '| 18.1 | Its own | Why | Stays |', '| 4.9, 7.2 | x | y | Stays |'];
    expect(recordFaults(record(LINEAGE, [...rows, '|  | x | y | Stays |']), CITABLE)).toEqual([
      "difference 4 cites '18.1', which is no rule",
      "difference 5 cites '4.9', which is no rule",
      'difference 6 cites no rule',
    ]);
  });

  it('names a record that names no commit, or a short template commit', () => {
    expect(
      recordFaults(record('Copied from the template a while ago.', GOOD_ROWS), CITABLE),
    ).toEqual(["its first lines do not say 'Template commit: <sha>. Standard read at: <sha>.'"]);
    const short = record('Template commit: 894c0ba. Standard read at: main.', GOOD_ROWS);
    expect(recordFaults(short, CITABLE)).toEqual([
      "the template commit '894c0ba' is not a 40-character sha",
      "the commit the standard was read at 'main' is not a sha",
    ]);
  });

  it("names a blank 'what this app does' or 'stays, or closes with'", () => {
    const rows = ['| 5.4 |  | Four places | Stays |', '| 9.4 | Does not apply | No voice |  |'];
    expect(recordFaults(record(LINEAGE, rows), CITABLE)).toEqual([
      "difference 1 leaves 'What this app does' blank",
      "difference 2 leaves 'Stays, or closes with' blank",
    ]);
  });

  it('names a table that is missing or broken', () => {
    const noKept = record(LINEAGE, GOOD_ROWS).replace('## Kept, removed, changed', '## Kept');
    expect(recordFaults(noKept, CITABLE)).toEqual([
      expect.stringContaining("'## Kept, removed, changed' has no table"),
    ]);
    const broken = record(LINEAGE, ['| 5.4 | Tabs | Stays |']);
    expect(recordFaults(broken, CITABLE)).toEqual([
      expect.stringContaining("'## Differences from the app standard' has no table"),
    ]);
  });
});

if (APP_RECORD.role === 'template') {
  describe("in the template: the list is the standard's own, and its example is a whole record", () => {
    const standard = readRepoFile(SOURCE_PATH);

    it(`is what ${COMMAND} writes from ${SOURCE_PATH}`, () => {
      expect(readRepoFile(OUTPUT_PATH), `Run ${COMMAND} and commit the file.`).toBe(
        serialise(standardRules(standard)),
      );
      expect(OUTPUT_PATH).toBe(RULES_PATH);
    });

    it('keeps no TEMPLATE.md of its own: a copy says so in settings/record.ts', () => {
      expect(existsSync(path.join(repoRoot(), RECORD_FILE))).toBe(false);
    });

    it("passes the standard's example, its '<…>' read as the commits they stand for", () => {
      const example = recordExample(standard);
      expect(example).toContain('Template commit: <40-character sha>.');
      expect(recordFaults(example, CITABLE, { placeholders: true })).toEqual([]);
    });

    it('refuses those placeholders in a real record', () => {
      expect(recordFaults(recordExample(standard), CITABLE)).toEqual([
        "the template commit '<40-character sha>' is not a 40-character sha",
        "the commit the standard was read at '<sha>' is not a sha",
      ]);
    });

    it('refuses a rule out of place, a number used twice and a heading inside a fence', () => {
      const page = (...lines: string[]) => ['# The app standard', '', ...lines].join('\n');
      expect(() => standardRules(page('**1.1 Before any section. (Must)**'))).toThrow(
        StandardError,
      );
      expect(() => standardRules(page('## 1. Tokens', '**2.1 Wrong section. (Must)**'))).toThrow(
        /rule 2\.1 is under section 1/,
      );
      expect(() => standardRules(page('## 1. A', '**1.1 x**', '**1.1 y**'))).toThrow(/twice/);
      expect(() => standardRules(page('## 1. A', '## 1. B'))).toThrow(/section 1 twice/);
      expect(() => standardRules(page('## 1. A', '## Notes', '**1.2 After. (Must)**'))).toThrow(
        /outside a numbered section/,
      );
      const fenced = standardRules(page('## 1. A', '**1.1 x**', '```', '## 2. B', '```'));
      const read = parseStandardRules(serialise(fenced));
      expect(read.sections.map((section) => section.id)).toEqual(['1']);
    });
  });
} else {
  describe(`this app's ${RECORD_FILE} (docs/app-standard.md 'The app's record')`, () => {
    it('is beside package.json', () => {
      expect(existsSync(path.join(repoRoot(), RECORD_FILE))).toBe(true);
    });

    it('names its commits, carries both tables, cites only rules that exist, leaves no row blank', () => {
      expect(recordFaults(readRepoFile(RECORD_FILE), CITABLE)).toEqual([]);
    });
  });
}
