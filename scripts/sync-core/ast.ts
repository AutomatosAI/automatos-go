// The TypeScript AST helpers sync-core is built on. Each file is analysed on its own: a
// one-file program with no lib and no module resolution, so the checker binds the file's own
// scopes (a parameter named `document` resolves to the parameter) while every global and
// every import target stays unresolved. That is what makes the purity and selection rules
// precise without reading any other file.
import ts from 'typescript';

export type FileModel = {
  readonly path: string;
  readonly sf: ts.SourceFile;
  readonly checker: ts.TypeChecker;
};

const ANALYSIS_OPTIONS: ts.CompilerOptions = {
  noLib: true,
  noResolve: true,
  types: [],
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.Preserve,
};

function singleFileHost(sf: ts.SourceFile): ts.CompilerHost {
  return {
    getSourceFile: (name) => (name === sf.fileName ? sf : undefined),
    getDefaultLibFileName: () => '/lib.d.ts',
    writeFile: () => undefined,
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (name) => name === sf.fileName,
    readFile: () => undefined,
  };
}

export function analyse(path: string, text: string): FileModel {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(`/${path}`, text, ts.ScriptTarget.Latest, true, kind);
  const program = ts.createProgram({
    rootNames: [sf.fileName],
    options: ANALYSIS_OPTIONS,
    host: singleFileHost(sf),
  });
  return { path, sf, checker: program.getTypeChecker() };
}

/** One module specifier in a file: an import, a re-export, an import type or a require. */
export type ModuleRef = {
  readonly spec: string;
  /** offsets of the specifier's text inside its quotes */
  readonly start: number;
  readonly end: number;
  /** erased at runtime: `import type`, every specifier `type`, or `import('x').T` */
  readonly typeOnly: boolean;
  /** the names taken from the module; '*' for a namespace, `export *` or a dynamic import */
  readonly names: readonly string[] | '*';
};

function literalRef(
  literal: ts.StringLiteralLike,
  typeOnly: boolean,
  names: ModuleRef['names'],
): ModuleRef {
  return {
    spec: literal.text,
    start: literal.getStart() + 1,
    end: literal.getEnd() - 1,
    typeOnly,
    names,
  };
}

function importNames(clause: ts.ImportClause | undefined): ModuleRef['names'] {
  if (!clause) return [];
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) return '*';
  const named = bindings ? bindings.elements.map((el) => (el.propertyName ?? el.name).text) : [];
  return clause.name ? ['default', ...named] : named;
}

function importIsTypeOnly(clause: ts.ImportClause | undefined): boolean {
  if (!clause) return false;
  if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return true;
  const bindings = clause.namedBindings;
  if (clause.name || !bindings || !ts.isNamedImports(bindings)) return false;
  return bindings.elements.length > 0 && bindings.elements.every((el) => el.isTypeOnly);
}

function exportRef(node: ts.ExportDeclaration, literal: ts.StringLiteralLike): ModuleRef {
  const clause = node.exportClause;
  if (!clause || !ts.isNamedExports(clause)) return literalRef(literal, node.isTypeOnly, '*');
  const names = clause.elements.map((el) => (el.propertyName ?? el.name).text);
  const typeOnly =
    node.isTypeOnly || (clause.elements.length > 0 && clause.elements.every((el) => el.isTypeOnly));
  return literalRef(literal, typeOnly, names);
}

function refOf(node: ts.Node): ModuleRef | undefined {
  if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
    const clause = node.importClause;
    return literalRef(node.moduleSpecifier, importIsTypeOnly(clause), importNames(clause));
  }
  if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
    const literal = node.moduleSpecifier;
    return ts.isStringLiteralLike(literal) ? exportRef(node, literal) : undefined;
  }
  if (ts.isImportTypeNode(node)) {
    const arg = node.argument;
    if (ts.isLiteralTypeNode(arg) && ts.isStringLiteralLike(arg.literal)) {
      return literalRef(arg.literal, true, '*');
    }
  }
  return callRef(node);
}

function callRef(node: ts.Node): ModuleRef | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
  const [arg] = node.arguments;
  if ((isImport || isRequire) && arg && ts.isStringLiteralLike(arg)) {
    return literalRef(arg, false, '*');
  }
  return undefined;
}

export function moduleRefs(sf: ts.SourceFile): ModuleRef[] {
  const refs: ModuleRef[] = [];
  const visit = (node: ts.Node): void => {
    const ref = refOf(node);
    if (ref) refs.push(ref);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return refs;
}

const MEMBER_NAME_PARENTS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.EnumMember,
]);

/**
 * True when the identifier names a member or another module's export rather than a binding
 * in scope: `x.window`, `{ document: 1 }`, `A.B`, `import { fetch as f }`, `{ fetch: f } = o`.
 */
export function isMemberName(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (ts.isPropertyAccessExpression(parent)) return parent.name === id;
  if (ts.isQualifiedName(parent)) return parent.right === id;
  if (MEMBER_NAME_PARENTS.has(parent.kind)) return (parent as ts.NamedDeclaration).name === id;
  if (ts.isImportSpecifier(parent) || ts.isBindingElement(parent)) {
    return parent.propertyName === id;
  }
  if (ts.isExportSpecifier(parent)) return isExportedName(parent, id);
  return ts.isImportTypeNode(parent) || ts.isLabeledStatement(parent);
}

/** `export { a as b }`: b is the exported name; with `from`, both name the other module's export. */
function isExportedName(specifier: ts.ExportSpecifier, id: ts.Identifier): boolean {
  if (specifier.parent.parent.moduleSpecifier !== undefined) return true;
  return specifier.propertyName !== undefined && specifier.name === id;
}

/** The symbol an identifier refers to; for `{ x }` shorthand, the value `x`, not the key. */
export function symbolOf(model: FileModel, id: ts.Identifier): ts.Symbol | undefined {
  const parent = id.parent;
  if (ts.isShorthandPropertyAssignment(parent)) {
    return model.checker.getShorthandAssignmentValueSymbol(parent);
  }
  if (ts.isExportSpecifier(parent) && parent.parent.parent.moduleSpecifier === undefined) {
    return model.checker.getExportSpecifierLocalTargetSymbol(parent);
  }
  return model.checker.getSymbolAtLocation(id);
}

export function forEachIdentifier(node: ts.Node, fn: (id: ts.Identifier) => void): void {
  const visit = (child: ts.Node): void => {
    if (ts.isIdentifier(child)) fn(child);
    ts.forEachChild(child, visit);
  };
  visit(node);
}

/** The statement directly under the source file that contains `node`. */
export function topLevelStatement(node: ts.Node): ts.Statement | undefined {
  let current: ts.Node = node;
  while (current.parent && !ts.isSourceFile(current.parent)) current = current.parent;
  return current.parent ? (current as ts.Statement) : undefined;
}

/** The names a top-level statement declares (a variable statement may declare several). */
export function declaredNames(statement: ts.Statement): string[] {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((decl) => bindingNames(decl.name));
  }
  const name = isNamedStatement(statement) ? statement.name : undefined;
  return name && ts.isIdentifier(name) ? [name.text] : [];
}

function isNamedStatement(statement: ts.Statement): statement is ts.DeclarationStatement {
  return (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  );
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : bindingNames(el.name)));
}

export function isTypeDeclaration(statement: ts.Statement): boolean {
  return ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
}

export function hasExportModifier(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}
