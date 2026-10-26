// ESLint flat config — eslint-config-expo (SDK 54 pairing) + prettier compat, then the app's
// guards (PRD-001 §4.11, US-004c): no console.* outside src/lib/logger.ts; HTTP only through
// src/api/ (expo/fetch only in src/api/transport.ts); never react-native-webview; the size
// limits; no colour literals outside the tokens; a pure hand-written core.
// scripts/__tests__/eslint-rules.test.ts proves each guard fires where it should.
const { builtinRules } = require('eslint/use-at-your-own-risk');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

const MAX_FILE_LINES = 800;
const TARGET_FILE_LINES = 400;
const MAX_FUNCTION_LINES = 50;
const MAX_COMPONENT_LINES = 150;
const MAX_DEPTH = 4;
const MAX_COMPLEXITY = 10;

const TEST_FILES = ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'];
const APP_CODE = ['src/**', 'app/**'];
const TOKEN_FILES = ['src/styles/tokens/**'];
// Hand-written core (K1): src/core/web (vendored) and src/core/frozen (frozen copies) are
// ignored here and checked by sync-core.
const HAND_WRITTEN_CORE = ['src/core/*.ts', 'src/core/parity/**'];

const ONE_WAY_IN = 'HTTP goes through src/api/ only (D-ONE-CLIENT): use the API client.';

const NO_WEBVIEW = {
  name: 'react-native-webview',
  message: 'No WebView (D-NO-WEBVIEW): links to Studio open the system browser.',
};
const NO_EXPO_FETCH = {
  name: 'expo/fetch',
  message: 'expo/fetch is imported by src/api/transport.ts only: use the API client.',
};
const NO_WEBVIEW_PATTERN = {
  group: ['react-native-webview/*'],
  message: NO_WEBVIEW.message,
};
const PURE_CORE_PATTERN = {
  group: [
    'react',
    'react/*',
    'react-dom',
    'react-dom/*',
    'react-native',
    'react-native*',
    'react-native/*',
    'expo',
    'expo*',
    'expo/*',
    '@expo/*',
  ],
  message: 'src/core is pure TypeScript (D-PURE): no React, React Native or Expo.',
};

function restrictedImports(paths, patterns) {
  return ['error', { paths, patterns }];
}

// #rgb, #rrggbb, #rrggbbaa and the rgb()/rgba()/hsl()/hsla() functions, anywhere in a string.
const COLOUR =
  '(#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_])|\\b(rgba?|hsla?)\\s*\\()';
const COLOUR_MESSAGE = 'Colour literal (D-TOKENS): read the colour from src/styles/tokens.';
const NO_COLOUR_LITERALS = [
  'error',
  { selector: `Literal[value=/${COLOUR}/]`, message: COLOUR_MESSAGE },
  { selector: `TemplateElement[value.raw=/${COLOUR}/]`, message: COLOUR_MESSAGE },
];

// A second name for the core max-lines rule, so one file can warn at 400 and fail at 800.
const shapePlugin = { rules: { 'target-file-lines': builtinRules.get('max-lines') } };

function functionLines(max) {
  return ['error', { max, skipBlankLines: true, skipComments: true, IIFEs: true }];
}

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'coverage/**',
      'shims/**',
      // vendored from automatos-ai by scripts/sync-core.ts — never edited by hand
      'src/core/web/**',
      // frozen copies of files core has deleted (scripts/core-manifest.json frozen) — never edited
      'src/core/frozen/**',
      'scripts/ralph/**',
      'babel.config.js',
      'metro.config.js',
      'eslint.config.js',
    ],
  },
  {
    plugins: { shape: shapePlugin },
    rules: {
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: ONE_WAY_IN },
        { name: 'XMLHttpRequest', message: ONE_WAY_IN },
      ],
      'no-restricted-properties': [
        'error',
        ...['globalThis', 'global', 'window', 'self'].flatMap((object) => [
          { object, property: 'fetch', message: ONE_WAY_IN },
          { object, property: 'XMLHttpRequest', message: ONE_WAY_IN },
        ]),
      ],
      'no-restricted-imports': restrictedImports([NO_WEBVIEW, NO_EXPO_FETCH], [NO_WEBVIEW_PATTERN]),
      'max-lines': ['error', { max: MAX_FILE_LINES }],
      'shape/target-file-lines': ['warn', { max: TARGET_FILE_LINES }],
      'max-lines-per-function': functionLines(MAX_FUNCTION_LINES),
      'max-depth': ['error', MAX_DEPTH],
      complexity: ['error', MAX_COMPLEXITY],
    },
  },
  {
    files: ['**/*.tsx'],
    rules: { 'max-lines-per-function': functionLines(MAX_COMPONENT_LINES) },
  },
  {
    // a describe() callback is long by design (the web's code-shape gate exempts tests too)
    files: TEST_FILES,
    rules: { 'max-lines-per-function': 'off', 'max-depth': 'off' },
  },
  {
    files: ['src/api/**'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ['src/api/transport.ts'],
    rules: { 'no-restricted-imports': restrictedImports([NO_WEBVIEW], [NO_WEBVIEW_PATTERN]) },
  },
  {
    files: HAND_WRITTEN_CORE,
    rules: {
      'no-restricted-imports': restrictedImports(
        [NO_WEBVIEW, NO_EXPO_FETCH],
        [NO_WEBVIEW_PATTERN, PURE_CORE_PATTERN],
      ),
    },
  },
  {
    files: APP_CODE,
    ignores: TOKEN_FILES,
    rules: { 'no-restricted-syntax': NO_COLOUR_LITERALS },
  },
  {
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
];
