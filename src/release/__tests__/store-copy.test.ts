// R12–R14 and R16 as a test that keeps running in CI: the app's copy — every strings module and
// the literal text of every product .tsx, in every wave and every style — never points at creating
// an account (D64), never speaks of plans, credits or prices (D8), never offers to delete an
// account or a workspace (D63), never claims that nothing leaves (D70), and states one minimum
// age, 16 (D12). A phrase in support/forbidden-copy.ts fails the test with its file and text
// unless ALLOWED names that exact text there, with its reason.

import { describe, expect, it } from 'vitest';

import { appCopy, copyFiles, copyTextsOf } from './support/copy-text';
import {
  AGE_STATEMENTS,
  ALLOWED,
  BILLING,
  DATA_CLAIMS,
  DELETION,
  FORBIDDEN_COPY,
  MINIMUM_AGE,
  SIGNUP,
  agesIn,
  forbiddenIn,
  type CopyRule,
} from './support/forbidden-copy';
import { stringsModules } from './support/tree';

const copy = appCopy();
const allowedKey = (file: string, text: string, rule: string) => `${file}\n${rule}\n${text}`;
const allowed = new Set(ALLOWED.map((entry) => allowedKey(entry.file, entry.text, entry.rule)));
const hits = copy.flatMap(({ file, text }) =>
  forbiddenIn(text).map((hit) => ({ file, text, ...hit })),
);

describe('the copy the audit reads', () => {
  it('reads every strings module of every wave', () => {
    const modules = stringsModules();
    expect(modules.length).toBeGreaterThanOrEqual(14);
    ['api', 'auth', 'cc', 'chat', 'connect', 'consent', 'push', 'release', 'styles', 'ui', 'voice']
      .map((folder) => `src/${folder}/strings.ts`)
      .forEach((module) => expect(modules).toContain(module));
    modules.forEach((module) => expect(copyFiles()).toContain(module));
  });

  it('reads every product .tsx under src/ and app/', () => {
    const files = copyFiles();
    expect(files.filter((file) => file.endsWith('.tsx')).length).toBeGreaterThan(150);
    expect(files).toContain('app/welcome.tsx');
    expect(files).toContain('src/styles/homes/PlayHome.tsx');
  });

  it('holds the words the screens show', () => {
    const texts = copy.map((entry) => entry.text);
    expect(texts).toContain('Agree and continue');
    expect(texts).toContain('Send crash reports');
  });

  it('reads JSX text, prop strings and templates, and never a comment or a module name', () => {
    const source = [
      "import { Text } from 'react-native';",
      '// Sign up for a free trial',
      'export const A = ({ n }: { n: number }) => (',
      '  <Text accessibilityLabel="Read the  label">',
      '    {/* Upgrade now */}',
      '    Don’t miss  this',
      "    {`${n} left`}{'plain'}",
      '  </Text>',
      ');',
    ].join('\n');
    expect(copyTextsOf('a.tsx', source)).toEqual([
      'Read the  label',
      'Don’t miss this',
      '${…} left',
      'plain',
    ]);
  });
});

const SAMPLES: readonly (readonly [CopyRule, readonly string[], readonly string[]])[] = [
  [
    SIGNUP,
    [
      'Sign up',
      'New here? Sign-up takes a minute',
      'Create an account',
      'create your account in Studio',
      'No account?',
      'Don’t have an account? Ask your admin',
      'Register for an account',
      'Get started free',
    ],
    ['Sign in', 'Sign in with your Automatos account', 'Signed up for push', 'Account'],
  ],
  [
    BILLING,
    [
      'Out of credits',
      'See pricing',
      'Upgrade to continue',
      'Your subscription ended',
      'Top up',
      'Add your own key',
      'Buy more',
      'Purchase',
      'Billing',
      'Checkout',
      'Business plan',
      'Your trial ends soon',
      '$9',
      '€12 a month',
      '20 per month',
      'Pay an invoice',
      'Payment failed',
    ],
    [
      'Plan my week',
      'Approve the plan',
      'Your workspace is paused; ask your workspace owner.',
      'Sign out',
      'Update the app',
    ],
  ],
  [
    DELETION,
    [
      'Delete your account',
      'Erase this workspace',
      'Delete my account',
      'Delete account',
      'Workspace deletion',
    ],
    ['Delete', 'Delete this look', 'Forget this server', 'Remove this phone'],
  ],
  [
    DATA_CLAIMS,
    [
      'Nothing leaves your server',
      'Your data never leaves the phone',
      'No data is sent',
      '100% local',
      'Fully private',
      'Completely private',
      'It stays entirely on your server',
      'Your chats stay on your server',
    ],
    [
      "Your chats, files and reports stay on {server}. Automatos Go itself sends crash reports to Automatos, checks Expo for app updates and, if this server's operator agrees, sends notifications through Expo and Apple or Google.",
      'Leave this server',
    ],
  ],
];

describe.each(SAMPLES)('%s', (rule, matches, passes) => {
  it.each(matches)('catches “%s”', (text) => {
    expect(forbiddenIn(text).map((hit) => hit.rule)).toContain(rule.id);
  });

  it.each(passes)('lets “%s” through', (text) => {
    expect(forbiddenIn(text).map((hit) => hit.rule)).not.toContain(rule.id);
  });
});

describe('the rule lists', () => {
  it('name the rule each enforces', () => {
    expect(FORBIDDEN_COPY.map((rule) => rule.id)).toEqual([
      'SIGNUP',
      'BILLING',
      'DELETION',
      'DATA_CLAIMS',
    ]);
    FORBIDDEN_COPY.forEach((rule) => {
      expect(rule.rule, rule.id).toMatch(/^D\d+/);
      expect(rule.phrases.length, rule.id).toBeGreaterThan(0);
      rule.phrases.forEach((phrase) => expect(phrase.flags, phrase.source).not.toContain('g'));
    });
  });
});

describe('the app’s copy', () => {
  it('uses no listed phrase but the ALLOWED ones', () => {
    const found = hits
      .filter((hit) => !allowed.has(allowedKey(hit.file, hit.text, hit.rule)))
      .map((hit) => `${hit.file}: ${hit.rule} (/${hit.phrase}/) “${hit.text}”`);
    expect(found).toEqual([]);
  });

  it('allows only text that is there and still trips its rule (no stale entry)', () => {
    const shown = new Set(hits.map((hit) => allowedKey(hit.file, hit.text, hit.rule)));
    const stale = ALLOWED.filter(
      (entry) => !shown.has(allowedKey(entry.file, entry.text, entry.rule)),
    );
    expect(stale.map((entry) => `${entry.file}: “${entry.text}”`)).toEqual([]);
  });

  it('gives every ALLOWED entry a reviewed reason', () => {
    ALLOWED.forEach((entry) => {
      expect(entry.reason.length, entry.text).toBeGreaterThan(60);
      expect(entry.reason, entry.text).toMatch(/\(D\d+/);
    });
  });
});

describe('one minimum age, 16 (D12, R16)', () => {
  it.each([
    ['You must be 16 or older to use Automatos Go', [16]],
    ['For people aged 18 and over', [18]],
    ['at least 13 years', [13]],
    ['You must be at least 18', [18]],
    ['Rated 17+ only', [17]],
  ])('reads the age in “%s”', (text, ages) => {
    expect(agesIn(text)).toEqual(ages);
  });

  it.each(['Files over 25 MB are not sent', '99+', 'Over 3 hours ago', 'Retry in 16 seconds'])(
    'reads no age in “%s”',
    (text) => {
      expect(agesIn(text)).toEqual([]);
    },
  );

  it('every age the app’s copy states is 16', () => {
    const wrong = copy.flatMap(({ file, text }) =>
      agesIn(text)
        .filter((age) => age !== MINIMUM_AGE)
        .map((age) => `${file}: ${age} in “${text}”`),
    );
    expect(wrong).toEqual([]);
    expect(MINIMUM_AGE).toBe(16);
    AGE_STATEMENTS.forEach((pattern) => expect(pattern.flags).toContain('g'));
  });
});
