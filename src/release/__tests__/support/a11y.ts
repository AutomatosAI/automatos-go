// What a product file does for Dynamic Type and VoiceOver, read from its syntax tree, for the
// accessibility audit (a11y-audit.test.ts, R17): every pressable it draws (a raw Pressable or
// Touchable*, and a local component that forwards its children into one, at each place it is
// used) with what it shows (words, an icon) and whether it carries an accessibility label; every
// place it turns text scaling off or caps it; every font size it writes as a number. Test-only
// (it lives under __tests__/ and never reaches the bundle).

import ts from 'typescript';

const RAW_PRESSABLE = /^(?:Animated\.)?(?:Pressable|Touchable(?:Opacity|Highlight|WithoutFeedback|NativeFeedback)?)$/;
const LUCIDE = /^lucide-react-native(?:\/|$)/;
const ICON_TAG = /Icon$/;
const TEXT_TAG = /(?:^|\.|Native)Text$/;

export type PressableKind = 'raw' | 'forwarding';

/** One pressable a file draws, at the place it is drawn. */
export type FoundPressable = Readonly<{
  file: string;
  line: number;
  /** The JSX tag: Pressable, TouchableOpacity, or a local component that forwards into one. */
  tag: string;
  kind: PressableKind;
  /** The named function that draws it ('' at the top level). */
  where: string;
  /** False only for accessible={false}: a long-press wrapper whose parts stay their own elements. */
  accessible: boolean;
  /** An accessibilityLabel that is not empty (a forwarding component's: where it draws the raw one). */
  labelled: boolean;
  /** An accessibilityLabel of '', undefined or null. */
  emptyLabel: boolean;
  /** It shows words: JSX text or a Text element, in any branch. */
  words: boolean;
  /** It draws an icon: a lucide import, or a tag named …Icon. */
  icon: boolean;
}>;

export type ScalingKind = 'allowFontScaling' | 'maxFontSizeMultiplier';

/** A place that turns Dynamic Type off or caps it, with its value and the line above it. */
export type FoundScaling = Readonly<{
  file: string;
  line: number;
  kind: ScalingKind;
  /** The value's source text: 'false', '1.5', 'SOME_CONSTANT'. */
  value: string;
  /** The line directly above, trimmed. */
  above: string;
}>;

/** A fontSize written as a number in the source. */
export type FoundFontSize = Readonly<{ file: string; line: number; size: number }>;

function parse(file: string, source: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
}

function eachNode(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => eachNode(child, visit));
}

function lineOf(tree: ts.SourceFile, node: ts.Node): number {
  return tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
}

/** The names a file imports from lucide-react-native (default or named, never `import type`). */
function lucideNames(tree: ts.SourceFile): Set<string> {
  const names = tree.statements.filter(ts.isImportDeclaration).flatMap((node) => {
    const clause = node.importClause;
    const from = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
    if (!clause || clause.isTypeOnly || !LUCIDE.test(from)) return [];
    const bindings = clause.namedBindings;
    const named = bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
    const values = named.filter((each) => !each.isTypeOnly).map((each) => each.name.text);
    return clause.name ? [clause.name.text, ...values] : values;
  });
  return new Set(names);
}

type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function openingOf(node: ts.Node): Opening | null {
  if (ts.isJsxElement(node)) return node.openingElement;
  return ts.isJsxSelfClosingElement(node) ? node : null;
}

function attribute(opening: Opening, name: string): ts.JsxAttribute | undefined {
  return opening.attributes.properties
    .filter(ts.isJsxAttribute)
    .find((each) => each.name.getText() === name);
}

/** The attribute's value as source text: 'true' for a bare attribute, "''" for an empty string. */
function valueText(attr: ts.JsxAttribute): string {
  const value = attr.initializer;
  if (!value) return 'true';
  if (ts.isStringLiteral(value)) return value.text === '' ? "''" : value.getText();
  if (ts.isJsxExpression(value)) return value.expression ? value.expression.getText() : '';
  return value.getText();
}

const EMPTY_VALUES = new Set(["''", '""', '``', 'undefined', 'null', '']);

/** What the element's content (its children, render functions included) shows. */
function contentOf(node: ts.Node, icons: ReadonlySet<string>) {
  const found = { words: false, icon: false, children: false };
  if (!ts.isJsxElement(node)) return found;
  node.children.forEach((child) =>
    eachNode(child, (each) => {
      if (ts.isJsxText(each) && each.text.trim() !== '') found.words = true;
      if (ts.isIdentifier(each) && each.text === 'children') found.children = true;
      const opening = openingOf(each);
      if (!opening) return;
      const tag = opening.tagName.getText();
      if (TEXT_TAG.test(tag)) found.words = true;
      if (icons.has(tag) || ICON_TAG.test(tag)) found.icon = true;
    }),
  );
  return found;
}

/** The name of the function that draws a node: a declaration's, or the variable an arrow is. */
function enclosingName(node: ts.Node): string {
  for (let at = node.parent; at; at = at.parent) {
    if (ts.isFunctionDeclaration(at) && at.name) return at.name.text;
    if (ts.isVariableDeclaration(at) && ts.isIdentifier(at.name)) return at.name.text;
  }
  return '';
}

type Forwarded = Pick<FoundPressable, 'accessible' | 'labelled' | 'emptyLabel'>;

function labelFacts(opening: Opening): Forwarded {
  const label = attribute(opening, 'accessibilityLabel');
  const empty = label !== undefined && EMPTY_VALUES.has(valueText(label));
  const accessible = attribute(opening, 'accessible');
  return {
    accessible: !accessible || valueText(accessible) !== 'false',
    labelled: label !== undefined && !empty,
    emptyLabel: empty,
  };
}

/**
 * Local components whose raw pressable forwards {children}, with that pressable's label facts:
 * each use of one is a pressable, labelled (or not) where the component draws it.
 */
function forwardingComponents(tree: ts.SourceFile, icons: ReadonlySet<string>) {
  const found = new Map<string, Forwarded>();
  eachNode(tree, (node) => {
    const opening = openingOf(node);
    if (!opening || !RAW_PRESSABLE.test(opening.tagName.getText())) return;
    const name = enclosingName(node);
    if (name && contentOf(node, icons).children) found.set(name, labelFacts(opening));
  });
  return found;
}

function describePressable(
  tree: ts.SourceFile,
  node: ts.Node,
  opening: Opening,
  facts: Forwarded,
  icons: ReadonlySet<string>,
): FoundPressable {
  const tag = opening.tagName.getText();
  const content = contentOf(node, icons);
  return Object.freeze({
    file: tree.fileName,
    line: lineOf(tree, opening),
    tag,
    kind: RAW_PRESSABLE.test(tag) ? 'raw' : 'forwarding',
    where: enclosingName(node),
    ...facts,
    words: content.words,
    icon: content.icon,
  });
}

/** Every pressable a file draws: raw ones, and each use of a local component forwarding into one. */
export function pressablesOf(file: string, source: string): FoundPressable[] {
  const tree = parse(file, source);
  const icons = lucideNames(tree);
  const forwarding = forwardingComponents(tree, icons);
  const found: FoundPressable[] = [];
  eachNode(tree, (node) => {
    const opening = openingOf(node);
    if (!opening) return;
    const tag = opening.tagName.getText();
    const facts = RAW_PRESSABLE.test(tag) ? labelFacts(opening) : forwarding.get(tag);
    if (facts) found.push(describePressable(tree, node, opening, facts, icons));
  });
  return found;
}

/** True for a pressable that draws an icon and shows no words: one for the IconButton primitive. */
export function isIconOnly(pressable: FoundPressable): boolean {
  return pressable.icon && !pressable.words;
}

/** Where a found pressable sits, for an ALLOWED entry: 'Pressable in MenuButton'. */
export function placeOf(pressable: Pick<FoundPressable, 'tag' | 'where'>): string {
  return `${pressable.tag} in ${pressable.where || '(top level)'}`;
}

/** Every element that draws one tag, with the value of one attribute ('' when it has none). */
export function usesOf(file: string, source: string, tag: string, name: string) {
  const tree = parse(file, source);
  const uses: { line: number; value: string | null }[] = [];
  eachNode(tree, (node) => {
    const opening = openingOf(node);
    if (!opening || opening.tagName.getText() !== tag) return;
    const attr = attribute(opening, name);
    uses.push({ line: lineOf(tree, opening), value: attr ? valueText(attr) : null });
  });
  return uses;
}

function scalingName(node: ts.Node): ScalingKind | null {
  const name =
    ts.isJsxAttribute(node) || ts.isPropertyAssignment(node) ? node.name.getText() : null;
  return name === 'allowFontScaling' || name === 'maxFontSizeMultiplier' ? name : null;
}

function scalingValue(node: ts.Node): string {
  if (ts.isJsxAttribute(node)) return valueText(node);
  return ts.isPropertyAssignment(node) ? node.initializer.getText() : '';
}

/** Every allowFontScaling and maxFontSizeMultiplier a file sets, as a JSX prop or an object key. */
export function scalingOf(file: string, source: string): FoundScaling[] {
  const tree = parse(file, source);
  const lines = source.split('\n');
  const found: FoundScaling[] = [];
  eachNode(tree, (node) => {
    const kind = scalingName(node);
    if (!kind) return;
    const line = lineOf(tree, node);
    const above = (lines[line - 2] ?? '').trim();
    found.push(Object.freeze({ file, line, kind, value: scalingValue(node), above }));
  });
  return found;
}

/** True for a scaling setting that turns Dynamic Type off: allowFontScaling anything but true. */
export function turnsScalingOff(found: FoundScaling): boolean {
  return found.kind === 'allowFontScaling' && found.value !== 'true';
}

/** True for a cap D38 accepts: a number of at least 2, with a one-line // reason directly above. */
export function isReasonedCap(found: FoundScaling, least: number): boolean {
  const value = Number(found.value);
  return Number.isFinite(value) && value >= least && /^\/\/\s*\S/.test(found.above);
}

function numberOf(node: ts.Expression): number | null {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isParenthesizedExpression(node)) return numberOf(node.expression);
  return null;
}

/** Every fontSize a file writes as a number literal (fontSize: 10), in any object. */
export function fontSizesOf(file: string, source: string): FoundFontSize[] {
  const tree = parse(file, source);
  const found: FoundFontSize[] = [];
  eachNode(tree, (node) => {
    if (!ts.isPropertyAssignment(node) || node.name.getText() !== 'fontSize') return;
    const size = numberOf(node.initializer);
    if (size !== null) found.push(Object.freeze({ file, line: lineOf(tree, node), size }));
  });
  return found;
}
