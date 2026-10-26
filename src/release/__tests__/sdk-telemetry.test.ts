// R11 and KR10 for an SDK the app does ship: Clerk's own telemetry stays off. On a development
// publishable key (pk_test_), clerk-js builds a telemetry collector that posts SDK usage events
// (which hooks and components ran) to clerk-telemetry.com unless the provider is given
// telemetry={false} (@clerk/shared's TelemetryCollector isEnabled; clerk-js load() builds it when
// `false !== options.telemetry`). The App Privacy Report check (websummit-checklist.md) expects no
// such host. Every ClerkProvider in the product tree must pass it, read from the syntax tree, so a
// second provider or a dropped prop fails CI.

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { treeOf } from './support/jsx';
import { productFiles } from './support/tree';

const CLERK_PROVIDER = 'ClerkProvider';
const HOSTED_ROOT = 'src/auth/AuthRoot.tsx';

type Finding = Readonly<{ file: string; line: number; problem: string }>;

/** Why this element's telemetry is not off, or null when it passes telemetry={false}. */
function telemetryProblem(element: ts.JsxOpeningLikeElement): string | null {
  const { properties } = element.attributes;
  if (properties.some(ts.isJsxSpreadAttribute)) return 'spreads props, so telemetry is unknown';
  const telemetry = properties
    .filter(ts.isJsxAttribute)
    .find((attribute) => attribute.name.getText() === 'telemetry');
  if (!telemetry) return 'no telemetry={false}';
  const value = telemetry.initializer;
  const off =
    value !== undefined &&
    ts.isJsxExpression(value) &&
    value.expression?.kind === ts.SyntaxKind.FalseKeyword;
  return off ? null : `telemetry is ${value?.getText() ?? 'true'}, not {false}`;
}

/** Every ClerkProvider element in a source, each with what is wrong (none: telemetry is off). */
function clerkProviders(file: string, source: ts.SourceFile): (Finding & { ok: boolean })[] {
  const found: (Finding & { ok: boolean })[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText() === CLERK_PROVIDER
    ) {
      const problem = telemetryProblem(node);
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      found.push({ file, line, problem: problem ?? '', ok: problem === null });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function describeFindings(found: readonly (Finding & { ok: boolean })[]): string[] {
  return found.filter((each) => !each.ok).map((each) => `${each.file}:${each.line} ${each.problem}`);
}

function fake(code: string): ts.SourceFile {
  return ts.createSourceFile('fake.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

const providers = productFiles()
  .filter((file) => file.endsWith('.tsx'))
  .flatMap((file) => clerkProviders(file, treeOf(file)));

describe("Clerk's SDK telemetry is off (R11, KR10)", () => {
  it('finds the hosted sign-in ClerkProvider', () => {
    expect(providers.map((each) => each.file)).toContain(HOSTED_ROOT);
  });

  it('every ClerkProvider in the product tree passes telemetry={false}', () => {
    expect(describeFindings(providers)).toEqual([]);
  });

  it('the check fires on a missing, true, object or spread telemetry, and passes false', () => {
    const read = (code: string) => describeFindings(clerkProviders('fake.tsx', fake(code)));
    expect(read('const a = <ClerkProvider publishableKey={k}>{c}</ClerkProvider>;')).toEqual([
      'fake.tsx:1 no telemetry={false}',
    ]);
    expect(read('const a = <ClerkProvider telemetry />;')).toEqual([
      'fake.tsx:1 telemetry is true, not {false}',
    ]);
    expect(read('const a = <ClerkProvider telemetry={{ debug: true }} />;')).toEqual([
      'fake.tsx:1 telemetry is {{ debug: true }}, not {false}',
    ]);
    expect(read('const a = <ClerkProvider {...props} telemetry={false} />;')).toEqual([
      'fake.tsx:1 spreads props, so telemetry is unknown',
    ]);
    expect(read('const a = <ClerkProvider publishableKey={k} telemetry={false} />;')).toEqual([]);
    expect(read('const a = <Other telemetry={true} />;')).toEqual([]);
  });
});
