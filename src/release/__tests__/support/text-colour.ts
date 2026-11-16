// Where a product file hands Text a colour, read from its syntax tree, for the text tone audit
// (text-tones.test.ts, rules 2.1 and 1.4): every Text element (the primitive, or React Native's)
// given a `color` prop, or a `style` that sets `color`, whether written in place, in a style object
// the file declares (`const ink = { color }`), or in an entry of its StyleSheet. A style the file
// builds by calling something it does not declare is not read: the audit sees what is plainly
// there. Test-only (it lives under __tests__/ and never reaches the bundle).

import ts from 'typescript';

/** src/ui, its index or its Text file, as a relative import names them ('./Text' inside src/ui). */
const PRIMITIVE_HOME = /\/(?:ui|ui\/index|Text)$/;
const NATIVE = 'react-native';
const TEXT_NAME = 'Text';
const MAX_DEPTH = 6;

/** One colour a file hands a Text element. */
export type FoundColour = Readonly<{
  file: string;
  line: number;
  /** How it reaches Text: the `color` prop, or a `color` in its style. */
  through: 'prop' | 'style';
  /** The colour's own source text, one line: 'color: colours.olive', 'color={ink}'. */
  text: string;
}>;

function parse(file: string, source: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
}

function eachNode(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => eachNode(child, visit));
}

const oneLine = (node: ts.Node, tree: ts.SourceFile) =>
  node.getText(tree).replace(/\s+/g, ' ').trim();

function lineOf(tree: ts.SourceFile, node: ts.Node): number {
  return tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
}

function isTextHome(specifier: string): boolean {
  return specifier === NATIVE || (specifier.startsWith('.') && PRIMITIVE_HOME.test(specifier));
}

/** The local names a file draws Text under: `Text` from src/ui or React Native, as imported. */
export function textTagsOf(tree: ts.SourceFile): Set<string> {
  const names = tree.statements.filter(ts.isImportDeclaration).flatMap((node) => {
    const clause = node.importClause;
    const from = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
    const bindings = clause?.namedBindings;
    if (!clause || clause.isTypeOnly || !bindings || !ts.isNamedImports(bindings)) return [];
    if (!isTextHome(from)) return [];
    return bindings.elements
      .filter((each) => !each.isTypeOnly && (each.propertyName ?? each.name).text === TEXT_NAME)
      .map((each) => each.name.text);
  });
  return new Set(names);
}

/** The statements a node sees its names declared in: its own block's, then each one around it. */
function scopesAround(node: ts.Node): readonly (readonly ts.Statement[])[] {
  const scopes: (readonly ts.Statement[])[] = [];
  for (let at: ts.Node | undefined = node; at; at = at.parent) {
    if (ts.isBlock(at) || ts.isSourceFile(at)) scopes.push(at.statements);
  }
  return scopes;
}

/** What the nearest `const name = …` in scope of `from` holds, or undefined (a parameter, an import). */
function declaredValue(name: string, from: ts.Node): ts.Expression | undefined {
  for (const statements of scopesAround(from)) {
    const declaration = statements
      .filter(ts.isVariableStatement)
      .flatMap((each) => [...each.declarationList.declarations])
      .find((each) => ts.isIdentifier(each.name) && each.name.text === name);
    if (declaration) return declaration.initializer;
  }
  return undefined;
}

/** The entries of a StyleSheet.create({...}) declared as `name`, or null. */
function sheetEntries(value: ts.Expression | undefined): ts.ObjectLiteralExpression | null {
  if (!value || !ts.isCallExpression(value)) return null;
  if (value.expression.getText() !== 'StyleSheet.create') return null;
  const first = value.arguments[0];
  return first && ts.isObjectLiteralExpression(first) ? first : null;
}

function propertyNamed(object: ts.ObjectLiteralExpression, name: string) {
  return object.properties.find((each) => each.name?.getText() === name);
}

type Reader = { readonly tree: ts.SourceFile; readonly found: ts.Node[] };

function readObject(object: ts.ObjectLiteralExpression, reader: Reader, depth: number): void {
  const colour = propertyNamed(object, 'color');
  if (colour) reader.found.push(colour);
  object.properties
    .filter(ts.isSpreadAssignment)
    .forEach((each) => readStyle(each.expression, reader, depth + 1));
}

function readName(name: ts.Identifier, reader: Reader, depth: number): void {
  const value = declaredValue(name.text, name);
  if (value && !sheetEntries(value)) readStyle(value, reader, depth + 1);
}

function readEntry(access: ts.PropertyAccessExpression, reader: Reader, depth: number): void {
  if (!ts.isIdentifier(access.expression)) return;
  const sheet = sheetEntries(declaredValue(access.expression.text, access));
  const entry = sheet ? propertyNamed(sheet, access.name.text) : undefined;
  if (entry && ts.isPropertyAssignment(entry)) readStyle(entry.initializer, reader, depth + 1);
}

/** The colours a style expression sets: in place, through a name, a branch or a sheet entry. */
function readStyle(node: ts.Expression, reader: Reader, depth: number): void {
  if (depth > MAX_DEPTH) return;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    readStyle(node.expression, reader, depth);
  } else if (ts.isObjectLiteralExpression(node)) {
    readObject(node, reader, depth);
  } else if (ts.isArrayLiteralExpression(node)) {
    node.elements.forEach((each) => readStyle(each, reader, depth));
  } else if (ts.isConditionalExpression(node)) {
    [node.whenTrue, node.whenFalse].forEach((each) => readStyle(each, reader, depth));
  } else if (ts.isBinaryExpression(node)) {
    [node.left, node.right].forEach((each) => readStyle(each, reader, depth));
  } else if (ts.isIdentifier(node)) {
    readName(node, reader, depth);
  } else if (ts.isPropertyAccessExpression(node)) {
    readEntry(node, reader, depth);
  }
}

type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function attributeValue(opening: Opening, name: string): ts.JsxAttribute | undefined {
  return opening.attributes.properties
    .filter(ts.isJsxAttribute)
    .find((each) => each.name.getText() === name);
}

function coloursOf(opening: Opening, reader: Reader): FoundColour[] {
  const file = reader.tree.fileName;
  const prop = attributeValue(opening, 'color');
  const props: FoundColour[] = prop
    ? [{ file, line: lineOf(reader.tree, prop), through: 'prop', text: oneLine(prop, reader.tree) }]
    : [];
  const style = attributeValue(opening, 'style')?.initializer;
  if (!style || !ts.isJsxExpression(style) || !style.expression) return props;
  const found: ts.Node[] = [];
  readStyle(style.expression, { ...reader, found }, 0);
  return props.concat(
    found.map((node) => ({
      file,
      line: lineOf(reader.tree, node),
      through: 'style' as const,
      text: oneLine(node, reader.tree),
    })),
  );
}

/** Every colour `file` hands a Text element, in source order. */
export function textColoursOf(file: string, source: string): FoundColour[] {
  const tree = parse(file, source);
  const tags = textTagsOf(tree);
  if (tags.size === 0) return [];
  const reader: Reader = { tree, found: [] };
  const colours: FoundColour[] = [];
  eachNode(tree, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
    if (tags.has(node.tagName.getText(tree))) colours.push(...coloursOf(node, reader));
  });
  return colours;
}
