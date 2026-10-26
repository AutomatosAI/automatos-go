// What a product file does with the keychain, read from its syntax tree (TypeScript's parser, no
// type checker), for the secure-storage audit (US-021j): its expo-secure-store imports, every call
// that reaches the keychain, every keychainAccessible value, every keychain class it names and
// every string literal. A call reaches the keychain when it is one of expo-secure-store's async
// methods (on the module or the AsyncSecureStore port, src/lib/secure-keys.ts), its sync pair on
// the module itself or on the SecureKeyStore port (src/storage/encrypted-storage.ts, a receiver
// named secureStore), or the key registry's read / write / remove in a file that imports the
// registry. Test-only (it lives under __tests__/ and never reaches the bundle).

import ts from 'typescript';

import { readRepoFile } from './tree';

export const SECURE_STORE_MODULE = 'expo-secure-store';

const ASYNC_METHODS: readonly string[] = ['getItemAsync', 'setItemAsync', 'deleteItemAsync'];
const SYNC_METHODS: readonly string[] = ['getItem', 'setItem'];
const REGISTRY_METHODS: readonly string[] = ['read', 'write', 'remove'];
const REGISTRY_RECEIVERS: readonly string[] = ['keys', 'registry', 'secureKeys'];
const PORT_RECEIVER = 'secureStore';
/** The registry's modules, by path: src/lib/secure-keys.ts, secure-store.ts, secure-registry.ts. */
const REGISTRY_MODULE = /(?:^|\/)(?:secure-keys|secure-store|secure-registry)$/;
/** expo-secure-store's keychainAccessible classes. */
const KEYCHAIN_CLASS =
  /^(?:AFTER_FIRST_UNLOCK|ALWAYS|WHEN_UNLOCKED|WHEN_PASSCODE_SET)(?:_THIS_DEVICE_ONLY)?$/;

export type Located = Readonly<{ file: string; line: number }>;

export type SecureStoreImport = Located &
  Readonly<{
    typeOnly: boolean;
    namespace: string | null;
    /** The named imports that are values, not types. */
    values: readonly string[];
  }>;

export type KeychainCall = Located &
  Readonly<{
    /** 'native': expo-secure-store's API; 'port': SecureKeyStore; 'registry': the key registry. */
    kind: 'native' | 'port' | 'registry';
    method: string;
    receiver: string;
    args: readonly string[];
  }>;

export type KeychainScan = Readonly<{
  file: string;
  imports: readonly SecureStoreImport[];
  calls: readonly KeychainCall[];
  accessible: readonly (Located & { value: string })[];
  classes: readonly (Located & { name: string })[];
  literals: readonly (Located & { value: string })[];
}>;

function parse(file: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, readRepoFile(file), ts.ScriptTarget.Latest, true, kind);
}

function importOf(file: string, source: ts.SourceFile, node: ts.ImportDeclaration) {
  const clause = node.importClause;
  const bindings = clause?.namedBindings;
  const namespace = bindings && ts.isNamespaceImport(bindings) ? bindings.name.text : null;
  const named = bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
  return Object.freeze({
    file,
    line: lineOf(source, node),
    typeOnly: clause?.isTypeOnly ?? false,
    namespace,
    values: named.filter((element) => !element.isTypeOnly).map((element) => element.name.text),
  });
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function moduleOf(node: ts.ImportDeclaration): string {
  return ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
}

type FileFacts = Readonly<{ namespaces: readonly string[]; holdsRegistry: boolean }>;

function callKind(method: string, receiver: string, facts: FileFacts): KeychainCall['kind'] | null {
  const last = receiver.split('.').pop() ?? '';
  if (ASYNC_METHODS.includes(method)) return 'native';
  if (SYNC_METHODS.includes(method) && facts.namespaces.includes(receiver)) return 'native';
  if (SYNC_METHODS.includes(method) && last === PORT_RECEIVER) return 'port';
  const registry = REGISTRY_METHODS.includes(method) && REGISTRY_RECEIVERS.includes(last);
  return registry && facts.holdsRegistry ? 'registry' : null;
}

function callOf(file: string, source: ts.SourceFile, node: ts.CallExpression, facts: FileFacts) {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  const method = node.expression.name.text;
  const receiver = node.expression.expression.getText(source);
  const kind = callKind(method, receiver, facts);
  if (kind === null) return null;
  const args = node.arguments.map((arg) => arg.getText(source));
  return Object.freeze({ file, line: lineOf(source, node), kind, method, receiver, args });
}

function factsOf(file: string, source: ts.SourceFile) {
  const imports = source.statements
    .filter(ts.isImportDeclaration)
    .filter((node) => moduleOf(node) === SECURE_STORE_MODULE)
    .map((node) => importOf(file, source, node));
  const holdsRegistry = source.statements
    .filter(ts.isImportDeclaration)
    .some((node) => REGISTRY_MODULE.test(moduleOf(node)));
  const namespaces = imports.flatMap((found) => (found.namespace ? [found.namespace] : []));
  return { imports, facts: Object.freeze({ namespaces, holdsRegistry }) };
}

/** One product file's keychain facts. */
export function scanKeychain(file: string): KeychainScan {
  const source = parse(file);
  const { imports, facts } = factsOf(file, source);
  const scan = {
    calls: [] as KeychainCall[],
    accessible: [] as (Located & { value: string })[],
    classes: [] as (Located & { name: string })[],
    literals: [] as (Located & { value: string })[],
  };
  const visit = (node: ts.Node): void => {
    const at = { file, line: lineOf(source, node) };
    const call = ts.isCallExpression(node) ? callOf(file, source, node, facts) : null;
    if (call) scan.calls.push(call);
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'keychainAccessible') {
      scan.accessible.push({ ...at, value: node.initializer.getText(source) });
    }
    if (ts.isIdentifier(node) && KEYCHAIN_CLASS.test(node.text)) {
      scan.classes.push({ ...at, name: node.text });
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      scan.literals.push({ ...at, value: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return Object.freeze({ file, imports, ...scan });
}

/** The file's `export const NAME = '<text>'` constants, as NAME → text. */
export function exportedStrings(file: string): ReadonlyMap<string, string> {
  const source = parse(file);
  const exported = source.statements
    .filter(ts.isVariableStatement)
    .filter((node) => node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword));
  const pairs = exported.flatMap((node) =>
    node.declarationList.declarations.flatMap((declaration) =>
      declaration.initializer && ts.isStringLiteral(declaration.initializer)
        ? [[declaration.name.getText(source), declaration.initializer.text] as const]
        : [],
    ),
  );
  return new Map(pairs);
}
