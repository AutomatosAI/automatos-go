// Partial vendoring: the manifest's typeOnly, extract and drop entries. typeOnly and extract
// keep only the named declarations plus everything they reference in the same file (resolved
// through the checker's scopes, not by name matching); drop keeps everything but the named
// declarations. Imports are narrowed to the bindings the kept code still uses, so an impure
// import that only a removed declaration needed goes with it.
import ts from 'typescript';

import {
  declaredNames,
  forEachIdentifier,
  isMemberName,
  isTypeDeclaration,
  symbolOf,
  topLevelStatement,
  type FileModel,
} from './ast';

export type SelectMode = 'typeOnly' | 'extract' | 'drop';

export type SelectRequest = {
  readonly mode: SelectMode;
  readonly names: readonly string[];
  /** the names a module exports, for `export * from` (spec as written in this file) */
  readonly exportsOf: (spec: string) => ReadonlySet<string>;
};

export type SelectResult = { readonly text: string; readonly problems: readonly string[] };

type Plan = {
  readonly keep: Set<ts.Statement>;
  readonly imports: Map<ts.ImportDeclaration, Set<string>>;
  readonly exports: Map<ts.ExportDeclaration, Set<string>>;
  readonly problems: string[];
};

function newPlan(): Plan {
  return { keep: new Set(), imports: new Map(), exports: new Map(), problems: [] };
}

function addTo<K>(map: Map<K, Set<string>>, key: K, name: string): void {
  const names = map.get(key) ?? new Set<string>();
  map.set(key, names.add(name));
}

function declarationIndex(sf: ts.SourceFile): Map<string, ts.Statement[]> {
  const index = new Map<string, ts.Statement[]>();
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) continue;
    for (const name of declaredNames(statement)) {
      index.set(name, [...(index.get(name) ?? []), statement]);
    }
  }
  return index;
}

/** The top-level statements an identifier's symbol is declared by (other than `self`). */
function dependencies(model: FileModel, id: ts.Identifier, self: ts.Statement): ts.Node[] {
  if (isMemberName(id)) return [];
  const declarations = symbolOf(model, id)?.declarations ?? [];
  return declarations.filter((decl) => {
    const top = topLevelStatement(decl);
    return top !== undefined && top !== self;
  });
}

/** Keeps `statement` and, transitively, every local statement and import binding it uses. */
function keepWithDependencies(model: FileModel, plan: Plan, statement: ts.Statement): void {
  const stack = [statement];
  while (stack.length > 0) {
    const current = stack.pop() as ts.Statement;
    if (plan.keep.has(current)) continue;
    plan.keep.add(current);
    forEachIdentifier(current, (id) => {
      for (const decl of dependencies(model, id, current)) {
        const top = topLevelStatement(decl) as ts.Statement;
        if (ts.isImportDeclaration(top)) addTo(plan.imports, top, localName(decl));
        else stack.push(top);
      }
    });
  }
}

function localName(decl: ts.Node): string {
  const name = (decl as ts.NamedDeclaration).name;
  return name && ts.isIdentifier(name) ? name.text : '';
}

function namedReexport(sf: ts.SourceFile, name: string): ts.ExportDeclaration | undefined {
  return sf.statements.find(
    (s): s is ts.ExportDeclaration =>
      ts.isExportDeclaration(s) &&
      s.exportClause !== undefined &&
      ts.isNamedExports(s.exportClause) &&
      s.exportClause.elements.some((el) => el.name.text === name),
  );
}

function starReexport(
  sf: ts.SourceFile,
  name: string,
  exportsOf: SelectRequest['exportsOf'],
): ts.ExportDeclaration | undefined {
  return sf.statements.find(
    (s): s is ts.ExportDeclaration =>
      ts.isExportDeclaration(s) &&
      s.exportClause === undefined &&
      s.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(s.moduleSpecifier) &&
      exportsOf(s.moduleSpecifier.text).has(name),
  );
}

/** A name the file exports without declaring it: `export { X } from`, `export { a as X }`, `export *`. */
function keepReexport(model: FileModel, plan: Plan, name: string, req: SelectRequest): boolean {
  const named = namedReexport(model.sf, name);
  if (named) {
    addTo(plan.exports, named, name);
    if (named.moduleSpecifier === undefined) keepLocalExportTarget(model, plan, named, name);
    return true;
  }
  const star = starReexport(model.sf, name, req.exportsOf);
  if (star) addTo(plan.exports, star, name);
  return star !== undefined;
}

function keepLocalExportTarget(
  model: FileModel,
  plan: Plan,
  decl: ts.ExportDeclaration,
  name: string,
): void {
  const clause = decl.exportClause as ts.NamedExports;
  const element = clause.elements.find((el) => el.name.text === name) as ts.ExportSpecifier;
  const local = (element.propertyName ?? element.name).text;
  const targets = declarationIndex(model.sf).get(local) ?? [];
  for (const target of targets) keepWithDependencies(model, plan, target);
}

function planKeep(model: FileModel, req: SelectRequest): Plan {
  const plan = newPlan();
  const index = declarationIndex(model.sf);
  for (const name of req.names) {
    const statements = index.get(name);
    if (statements) {
      if (req.mode === 'typeOnly' && !statements.every(isTypeDeclaration)) {
        plan.problems.push(
          `${name} in ${model.path} is a value, not a type: list it under extract`,
        );
      }
      for (const statement of statements) keepWithDependencies(model, plan, statement);
    } else if (!keepReexport(model, plan, name, req)) {
      plan.problems.push(`${name} is not declared or exported by ${model.path}`);
    }
  }
  return plan;
}

function planDrop(model: FileModel, req: SelectRequest): Plan {
  const plan = newPlan();
  const dropped = new Set(req.names);
  const index = declarationIndex(model.sf);
  const removed = new Set(req.names.flatMap((name) => index.get(name) ?? []));
  for (const name of req.names.filter((n) => !index.has(n))) {
    plan.problems.push(`${name} is not declared by ${model.path}, so it cannot be dropped`);
  }
  for (const statement of removed) {
    if (!declaredNames(statement).every((n) => dropped.has(n))) {
      plan.problems.push(
        `${model.path}: a statement declares ${namesOf(statement)} and more; drop all`,
      );
    }
  }
  for (const statement of model.sf.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!statement.importClause) plan.keep.add(statement);
    } else if (!removed.has(statement)) {
      keepUsedImports(model, plan, statement, removed);
    }
  }
  return plan;
}

function namesOf(statement: ts.Statement): string {
  return declaredNames(statement).join(', ');
}

/** Keeps a statement as written, noting the import bindings it uses; fails if it uses a dropped one. */
function keepUsedImports(
  model: FileModel,
  plan: Plan,
  statement: ts.Statement,
  removed: ReadonlySet<ts.Statement>,
): void {
  plan.keep.add(statement);
  forEachIdentifier(statement, (id) => {
    for (const decl of dependencies(model, id, statement)) {
      const top = topLevelStatement(decl) as ts.Statement;
      if (ts.isImportDeclaration(top)) addTo(plan.imports, top, localName(decl));
      if (removed.has(top)) {
        plan.problems.push(
          `${model.path}: ${id.text} is dropped but still used by ${namesOf(statement)}`,
        );
      }
    }
  });
}

export function select(model: FileModel, req: SelectRequest): SelectResult {
  const plan = req.mode === 'drop' ? planDrop(model, req) : planKeep(model, req);
  return { text: emit(model.sf, plan, req.mode === 'typeOnly'), problems: plan.problems };
}

function emit(sf: ts.SourceFile, plan: Plan, typeOnly: boolean): string {
  const text = sf.getFullText();
  const verbatim = (statement: ts.Statement) =>
    text.slice(statement.getFullStart(), statement.getEnd());
  const parts = sf.statements.map((statement) => {
    if (plan.keep.has(statement)) return verbatim(statement);
    const imported = ts.isImportDeclaration(statement) && plan.imports.get(statement);
    if (imported) {
      const decl = statement as ts.ImportDeclaration;
      if (!typeOnly && importBindings(decl).every((n) => imported.has(n))) return verbatim(decl);
      return `\n${importText(decl, imported, typeOnly)}`;
    }
    const exported = ts.isExportDeclaration(statement) && plan.exports.get(statement);
    if (exported) return `\n${exportText(statement as ts.ExportDeclaration, exported, typeOnly)}`;
    return '';
  });
  return `${parts.join('').trimStart()}\n`;
}

function importBindings(decl: ts.ImportDeclaration): string[] {
  const clause = decl.importClause;
  const bindings = clause?.namedBindings;
  const named = !bindings
    ? []
    : ts.isNamespaceImport(bindings)
      ? [bindings.name.text]
      : bindings.elements.map((el) => el.name.text);
  return clause?.name ? [clause.name.text, ...named] : named;
}

function specifierText(el: ts.ImportSpecifier | ts.ExportSpecifier, typeOnly: boolean): string {
  const type = !typeOnly && el.isTypeOnly ? 'type ' : '';
  const alias = el.propertyName ? `${el.propertyName.text} as ` : '';
  return `${type}${alias}${el.name.text}`;
}

function importGroups(clause: ts.ImportClause, used: ReadonlySet<string>, asType: boolean) {
  const groups = clause.name && used.has(clause.name.text) ? [clause.name.text] : [];
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) {
    return used.has(bindings.name.text) ? [...groups, `* as ${bindings.name.text}`] : groups;
  }
  const named = (bindings?.elements ?? []).filter((el) => used.has(el.name.text));
  if (named.length === 0) return groups;
  return [...groups, `{ ${named.map((el) => specifierText(el, asType)).join(', ')} }`];
}

function importText(decl: ts.ImportDeclaration, used: ReadonlySet<string>, typeOnly: boolean) {
  const clause = decl.importClause as ts.ImportClause;
  const from = decl.moduleSpecifier.getText();
  const asType = typeOnly || clause.phaseModifier === ts.SyntaxKind.TypeKeyword;
  const groups = importGroups(clause, used, asType);
  // `import type A, { B }` is not valid TypeScript, so a type-only import gets one per group
  if (asType) return groups.map((group) => `import type ${group} from ${from}`).join('\n');
  return `import ${groups.join(', ')} from ${from}`;
}

function exportText(decl: ts.ExportDeclaration, names: ReadonlySet<string>, typeOnly: boolean) {
  const from = decl.moduleSpecifier ? ` from ${decl.moduleSpecifier.getText()}` : '';
  const type = typeOnly || decl.isTypeOnly ? 'type ' : '';
  const clause = decl.exportClause;
  if (!clause || !ts.isNamedExports(clause)) {
    return `export ${type}{ ${[...names].sort().join(', ')} }${from}`;
  }
  const kept = clause.elements.filter((el) => names.has(el.name.text));
  return `export ${type}{ ${kept.map((el) => specifierText(el, type !== '')).join(', ')} }${from}`;
}
