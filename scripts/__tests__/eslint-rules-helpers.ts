// Shared by the guard suites (eslint-rules*.test.ts): snippets linted with ESLint's Node API under
// the repo's real config. The snippets never touch disk; filePath only places them.
import path from 'node:path';

import { ESLint, type Linter } from 'eslint';

const REPO = path.resolve(__dirname, '../..');
const eslint = new ESLint({ cwd: REPO });

export async function messages(code: string, file: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(REPO, file) });
  return result?.messages ?? [];
}

/** The rule behind each message ('parse-error' for a snippet that does not parse). */
export async function rules(code: string, file: string): Promise<string[]> {
  return (await messages(code, file)).map((m) => m.ruleId ?? 'parse-error');
}

/** The messages one rule gave, word for word. */
export async function said(code: string, file: string, rule: string): Promise<string[]> {
  return (await messages(code, file)).filter((m) => m.ruleId === rule).map((m) => m.message);
}

export const lines = (count: number, line: (n: number) => string) =>
  Array.from({ length: count }, (_, n) => line(n)).join('\n');

/** Loads the expo config's plugins once, before the first timed test. */
export async function warm(): Promise<void> {
  await rules('export const warm = 1;\n', 'src/warm.ts');
}

export const WARM_TIMEOUT = 60_000;
