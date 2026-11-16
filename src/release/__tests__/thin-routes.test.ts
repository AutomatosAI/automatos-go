// The app standard's rule 4.4: a file under app/ mounts a screen that lives under src/ and holds
// nothing else, so what a person sees, and what every audit reads, is in src/. Thin is
// support/route-files.ts: imports from src/ (and from expo-router only the params and Redirect),
// one default-exported function that may name what it reads from the params and returns one
// element with no children, no other hook, no function inside, no styles.
//   A layout (_layout.tsx) is not a screen: it is a folder's navigator, and expo-router reads its
// Stack, and what the Stack is wrapped in (the providers, the gate, the Command Centre's frame),
// from that file. It is held only to declaring its Stack. app/+native-intent.tsx is expo-router's
// hook for links the system hands over, not a screen (src/navigation's system-links.test.ts holds
// that it only delegates). Any other file that cannot be thin is listed, with its reason, in the
// app's settings (settings/thin-routes.ts).

import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { NOT_THIN } from './settings/thin-routes';
import { codeOf } from './support/code';
import { mountedFrom, routeFaults } from './support/route-files';
import { readRepoFile, repoRoot, walkFiles } from './support/tree';

const LAYOUT = /(^|\/)_layout\.tsx$/;
const NATIVE_INTENT = 'app/+native-intent.tsx';
const SOURCE = /\.tsx?$/;

const routeFiles = walkFiles('app').filter((file) => SOURCE.test(file));
const screens = routeFiles.filter(
  (file) => !LAYOUT.test(file) && file !== NATIVE_INTENT && !(file in NOT_THIN),
);

/** The repo file a route's import names: the module, as .tsx or .ts. */
function resolved(route: string, module: string): string | null {
  const base = path.posix.join(path.posix.dirname(route), module);
  const file = [`${base}.tsx`, `${base}.ts`].find((each) =>
    existsSync(path.join(repoRoot(), each)),
  );
  return file ?? null;
}

describe('every route file under app/ is thin (rule 4.4)', () => {
  it('finds the routes: screens, layouts and the link hook', () => {
    expect(screens.length).toBeGreaterThan(20);
    expect(routeFiles).toContain(NATIVE_INTENT);
    expect(routeFiles).toContain('app/_layout.tsx');
  });

  it.each(screens)('%s mounts its screen and holds nothing else', (file) => {
    expect(routeFaults(file, readRepoFile(file))).toEqual([]);
  });

  it.each(screens)('%s mounts a screen from a file under src/ that exists', (file) => {
    const module = mountedFrom(file, readRepoFile(file));
    if (module === 'expo-router') return;
    expect(module, file).not.toBeNull();
    const screen = resolved(file, module ?? '');
    expect(screen, file).toMatch(/^src\//);
  });

  it('each layout declares its Stack: that, not a screen, is what it is for', () => {
    const layouts = routeFiles.filter((file) => LAYOUT.test(file));
    expect(layouts.length).toBeGreaterThan(3);
    for (const file of layouts) expect(codeOf(file), file).toMatch(/<Stack\b/);
  });

  it('each listed file is still there and still not thin, so the list cannot go stale', () => {
    for (const file of Object.keys(NOT_THIN)) {
      expect(routeFiles, file).toContain(file);
      expect(routeFaults(file, readRepoFile(file)), file).not.toEqual([]);
      expect(NOT_THIN[file]?.length ?? 0, file).toBeGreaterThan(30);
    }
    expect(codeOf('app/(app)/chat/index.tsx').trim()).toBe("export { default } from './[id]';");
  });
});

describe('Settings: the audits read the screen, not its route', () => {
  const route = 'app/(app)/settings/index.tsx';

  it('the route mounts src/settings/SettingsScreen.tsx', () => {
    expect(mountedFrom(route, readRepoFile(route))).toBe('../../../src/settings/SettingsScreen');
  });

  it('the screen holds the sections the audits look for', () => {
    const screen = codeOf('src/settings/SettingsScreen.tsx');
    for (const section of [
      '<ServerSection',
      '<PauseSection />',
      '<ReadinessSection />',
      '<PrivacySection />',
      '<RemovePhone />',
    ]) {
      expect(screen, section).toContain(section);
    }
  });
});

describe('what thin is', () => {
  const thin = (text: string) => routeFaults('app/example.tsx', text);

  it('passes a screen with the route’s params, and a redirect', () => {
    expect(
      thin(`import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../src/thing/params';
import { ThingScreen } from '../src/thing/ThingScreen';
export default function Thing() {
  const id = idParam(useLocalSearchParams());
  return <ThingScreen id={id} />;
}`),
    ).toEqual([]);
    expect(
      thin(`import { Redirect } from 'expo-router';
import { HOME } from '../src/navigation/routes';
export default function Lost() {
  return <Redirect href={HOME} />;
}`),
    ).toEqual([]);
  });

  it.each([
    ['two elements', 'return (<><A /><B /></>);', 'does not return one element with no children'],
    ['another hook', 'const on = useThing();\n  return <A on={on} />;', 'calls useThing'],
    ['a function inside', 'return <A onPress={() => undefined} />;', 'writes a function inside'],
    [
      'a branch',
      'if (Math.random()) return <A />;\n  return <A />;',
      'holds a statement that is not a const',
    ],
  ])('refuses %s', (_what, body, fault) => {
    const text = `import { A } from '../src/a/A';\nimport { B } from '../src/a/B';\nimport { useThing } from '../src/a/use-thing';\nexport default function Route() {\n  ${body}\n}`;
    expect(thin(text)).toContain(fault);
  });

  it('passes each shape a const may take: the params, a read of them, one src/ helper given them', () => {
    expect(
      thin(`import { useLocalSearchParams } from 'expo-router';
import { parseThing } from '../src/thing/params';
import { ThingScreen } from '../src/thing/ThingScreen';
export default function Thing() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const tab = params['tab'];
  const { chat, ...rest } = params;
  const [first] = useLocalSearchParams().ids;
  const { chatId } = parseThing(useLocalSearchParams());
  const again = parseThing(params);
  return <ThingScreen id={id} tab={tab} chat={chat} rest={rest} first={first} chatId={chatId} again={again} />;
}`),
    ).toEqual([]);
  });

  it.each([
    ['a conditional', 'const x = a ? b : c();', 'x'],
    ['arithmetic', 'const n = params.count + 1;', 'n'],
    ['a call to anything else', 'const now = Date.now();', 'now'],
    ['a global given the params', 'const id = String(params.id);', 'id'],
    ['a src/ helper given more than the params', 'const id = idParam(params, 1);', 'id'],
    ['a src/ helper given something else', 'const id = idParam(params.id);', 'id'],
    ['a helper not from src/', 'const id = useLocalSearchParams.call(params);', 'id'],
    ['a read of a helper’s answer', 'const id = idParam(params).value;', 'id'],
    ['an index worked out', 'const id = params[key];', 'id'],
    [
      'a default in a destructuring',
      'const { id = idParam(params) } = params;',
      '{ id = idParam(params) }',
    ],
    ['a constant of its own', "const id = 'one';", 'id'],
  ])('refuses a const given %s', (_what, line, name) => {
    const text = `import { useLocalSearchParams } from 'expo-router';
import { A } from '../src/a/A';
import { idParam } from '../src/a/params';
export default function Route() {
  const params = useLocalSearchParams();
  ${line}
  return <A />;
}`;
    expect(thin(text)).toContain(
      `gives const ${name} more than the params, a read of them or one src/ helper given them`,
    );
  });

  it('refuses styles, React and the router beyond its params', () => {
    const text = `import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { A } from '../src/a/A';
const styles = StyleSheet.create({ a: { flex: 1 } });
export default function Route() {
  return <A />;
}`;
    expect(thin(text)).toEqual([
      'imports from react-native',
      'imports useRouter from expo-router',
      'holds a declaration at the top level',
    ]);
  });

  it('refuses a file with no default function, or a screen drawn from outside src/', () => {
    expect(thin("export { default } from './[id]';")).toEqual([
      'holds an export at the top level',
      'has 0 default-exported functions, not one',
    ]);
    expect(thin('export default function Route() {\n  return <View />;\n}')).toEqual([
      'returns <View>, which is not from src/',
    ]);
  });
});
