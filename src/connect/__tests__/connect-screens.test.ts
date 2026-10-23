// The connect screens' shape, read from the source (vitest runs no React Native renderer): the
// routes mount the screens, one component per file, the words come from strings.ts, the fields are
// set up as US-006f says, and nothing on Welcome or Connect points at making an account (D-SIGNIN)
// or claims more about data than KC16's note.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import * as STRINGS from '../strings';

const ROOT = path.resolve(__dirname, '../../..');
const read = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), 'utf8');

function components(dir: string) {
  return readdirSync(path.join(ROOT, dir))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => ({ name: path.basename(file, '.tsx'), source: read(dir, file) }));
}

const SCREENS = components('src/connect/screens');
const PARTS = [...SCREENS, ...components('src/connect/components')];
const source = (name: string) => PARTS.find((part) => part.name === name)?.source ?? '';

/** Every string the connect copy holds (functions called with a sample server). */
function copyStrings(value: unknown): readonly string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function')
    return copyStrings((value as (s: string) => unknown)('nas.local'));
  if (value && typeof value === 'object') return Object.values(value).flatMap(copyStrings);
  return [];
}

const COPY = copyStrings(STRINGS);
const ACCOUNT_CREATION =
  /create (an |your |a new )?account|sign[ -]?up|no account\?|get an account/i;
const BROAD_DATA_CLAIM =
  /nothing (ever )?leaves|never leaves|no data|100% (local|private)|fully (local|private)|completely private|stays? (entirely |completely |only )?(on|in|with) your/i;

describe('the connect routes', () => {
  it('mount the screens', () => {
    expect(read('app/welcome.tsx')).toContain('<WelcomeScreen />');
    expect(read('app/connect/index.tsx')).toMatch(/<ConnectScreen prefill=\{prefill\} \/>/);
    expect(read('app/connect/index.tsx')).toContain('connectPrefillFromParams');
    expect(read('app/connect/_layout.tsx')).toMatch(
      /<Stack screenOptions=\{\{ headerShown: false \}\} \/>/,
    );
  });

  it('Welcome goes to hosted sign-in and to Connect through the route table', () => {
    expect(source('WelcomeScreen')).toContain('routes.signIn');
    expect(source('WelcomeScreen')).toContain('routes.connect');
    expect(source('WelcomeScreen')).toContain('hostedSignInConfigured(env)');
    expect(source('WelcomeScreen')).toContain('<BrandMark />');
  });

  it('Connect scans through the route table, and each flow is keyed by its prefill', () => {
    expect(source('ConnectScreen')).toContain('routes.connectScan');
    expect(source('ConnectScreen')).toContain('key={prefillKey(prefill)}');
  });
});

describe('Connect holds until the session has loaded (KC8, review P001N-RVW-1)', () => {
  const connect = () => source('ConnectScreen');
  /** The body of one top-level function in ConnectScreen.tsx, up to the next one. */
  function body(name: string): string {
    const start = connect().indexOf(`function ${name}(`);
    const next = connect().indexOf('\nfunction ', start + 1);
    return connect().slice(start, next === -1 ? undefined : next);
  }

  it('decides how it opens through connectEntry, with the session loaded or not', () => {
    expect(connect()).toContain('const { isLoaded, isSignedIn } = useAuthSession();');
    expect(connect()).toContain('entry={connectEntry({ prefill, isLoaded, inUse })}');
    // the question is never read without the session's isLoaded
    expect(connect()).not.toContain('connectSwitchQuestion(');
  });

  it("renders the foundation's LoadingState for loading, before the question or the flow", () => {
    const entry = body('ConnectEntry');
    expect(entry).toContain("if (entry.kind === 'loading') return <Holding />;");
    expect(entry.indexOf('<Holding />')).toBeLessThan(entry.indexOf('<SwitchQuestion'));
    expect(entry.indexOf('<Holding />')).toBeLessThan(entry.indexOf('<ConnectFlow'));
    expect(body('Holding')).toContain('<LoadingState />');
    expect(connect()).toMatch(/import \{[^}]*\bLoadingState\b[^}]*\} from '\.\.\/\.\.\/ui';/);
  });

  it('runs discovery only inside the flow, which mounts after the decision', () => {
    expect(connect().match(/useConnect\(/g)).toHaveLength(1);
    expect(body('ConnectFlow')).toContain('const flow = useConnect(prefill);');
    expect(body('ConnectEntry')).not.toContain('useConnect(');
    expect(body('ConnectScreen')).not.toContain('useConnect(');
  });

  it('keeps the yes as component state, never a route param', () => {
    expect(body('ConnectEntry')).toContain('const [agreed, setAgreed] = useState(answered);');
    expect(read('app/connect/index.tsx')).not.toContain('switchAnswered');
  });
});

describe('src/connect/screens and components', () => {
  it('has the screens US-006f names', () => {
    const names = SCREENS.map((screen) => screen.name);
    for (const name of ['WelcomeScreen', 'ConnectScreen', 'ConfirmCard']) {
      expect(names).toContain(name);
    }
  });

  it('exports exactly one component per file, named after the file', () => {
    for (const { name, source: text } of PARTS) {
      expect(text.match(/^export function [A-Z]\w*/gm), name).toEqual([`export function ${name}`]);
    }
  });

  it('takes its words from strings.ts, never a literal in JSX text', () => {
    for (const { name, source: text } of PARTS) {
      expect(text, name).not.toMatch(/>\s*[A-Za-z][^<>{}]*</);
    }
  });

  it('reads colours from the tokens only', () => {
    for (const { name, source: text } of PARTS) {
      expect(text, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/);
    }
  });
});

describe('the fields', () => {
  const form = () => source('ConnectForm');

  it('types the address on a URL keyboard, nothing capitalised or corrected', () => {
    const address = form().slice(form().indexOf('addressLabel'), form().indexOf('codeLabel'));
    expect(address).toContain('keyboardType="url"');
    expect(address).toContain('autoCapitalize="none"');
    expect(address).toContain('autoCorrect={false}');
  });

  it('types the code in capitals, shown as XXXX-XXXX', () => {
    const code = form().slice(form().indexOf('codeLabel'));
    expect(code).toContain('autoCapitalize="characters"');
    expect(code).toContain('value={view.codeDisplay}');
    expect(code).toContain('autoCorrect={false}');
  });

  it('pairs only from the card: the form submits, the card confirms (KC8)', () => {
    expect(form()).not.toMatch(/onConfirm|\.confirm\(|pairDevice/);
    expect(source('ConfirmCard')).toContain('onConfirm');
    expect(source('ConnectScreen')).toContain('onConfirm={flow.confirm}');
  });
});

describe('the copy (D-SIGNIN, KC16)', () => {
  it('points nowhere at making an account', () => {
    for (const words of COPY) expect(words).not.toMatch(ACCOUNT_CREATION);
    for (const { name, source: text } of PARTS) expect(text, name).not.toMatch(ACCOUNT_CREATION);
  });

  it('makes no claim broader than the data note', () => {
    for (const words of COPY) expect(words).not.toMatch(BROAD_DATA_CLAIM);
  });

  it('puts the data note on the card', () => {
    expect(source('ConfirmCard')).toContain('{card.dataNote}');
    expect(source('ConfirmCard')).toContain(
      '<InsecureNote note={card.insecureNote} origin={card.address} />',
    );
    expect(source('ConfirmCard')).toContain('<InsecureNetworkBanner origin={origin} />');
  });
});
