// ESLint flat config — eslint-config-expo (SDK 54 pairing) + prettier compat, then the app's
// guards (PRD-001 §4.11, US-004c): no console.* outside src/lib/logger.ts; the network only
// through src/api/ (fetch, XMLHttpRequest, WebSocket, EventSource and navigator.sendBeacon;
// expo/fetch only in src/api/transport.ts; no other HTTP client anywhere; no picture fetched by
// address by react-native-svg; the file system's own downloads and uploads only in src/api/);
// never a web view (react-native-webview, DOM components and their 'use dom' directive); the size
// limits; no colour literals outside the tokens; a pure hand-written core. A guard cannot be
// switched off from inside a file: inline eslint comments are not read (docs/app-standard.md
// rules 13.2, 13.5 and 13.8). scripts/__tests__/eslint-rules*.test.ts prove each guard fires
// where it should.
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
// Every way a request can leave by a global: the bare name, and the name on a global object.
const NETWORK_NAMES = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'];
const NETWORK_OBJECTS = ['globalThis', 'global', 'window', 'self'];
// HTTP clients that would be a second way out. The platform's fetch, in src/api/, is the one.
const OTHER_CLIENTS = ['axios', 'whatwg-fetch', 'ws', 'undici'];
const NO_OTHER_CLIENTS = OTHER_CLIENTS.map((name) => ({ name, message: ONE_WAY_IN }));
// Their subpaths too ('ws/wrapper'): a path entry matches the bare name only.
const NO_OTHER_CLIENT_PATHS = {
  group: OTHER_CLIENTS.map((name) => `${name}/*`),
  message: ONE_WAY_IN,
};

const NO_EXPO_FETCH = {
  name: 'expo/fetch',
  message: 'expo/fetch is imported by src/api/transport.ts only: use the API client.',
};
// expo's own file behind expo/fetch: refused everywhere, src/api/transport.ts included.
const NO_EXPO_FETCH_FILES = {
  group: ['expo/src/winter/fetch'],
  message: 'Import expo/fetch by that name, in src/api/transport.ts only: use the API client.',
};

// A web view in any form (D-NO-WEBVIEW, rule 13.8). A DOM component ('use dom', expo/dom) is a
// web view too: @expo/dom-webview or react-native-webview draws it.
const NO_WEBVIEW_MESSAGE = 'No WebView (D-NO-WEBVIEW): links to Studio open the system browser.';
const DOM_MESSAGE =
  "No DOM components (D-NO-WEBVIEW): a 'use dom' component runs in a web view. Draw it with React Native.";
const NO_WEB_VIEWS = [
  { name: 'react-native-webview', message: NO_WEBVIEW_MESSAGE },
  { name: 'expo/dom', message: DOM_MESSAGE },
  { name: '@expo/dom-webview', message: DOM_MESSAGE },
];
const NO_WEB_VIEW_PATTERNS = [
  { group: ['react-native-webview/*'], message: NO_WEBVIEW_MESSAGE },
  { group: ['expo/dom/*', '@expo/dom-webview/*', 'expo/src/dom'], message: DOM_MESSAGE },
];
const NO_DOM_DIRECTIVE = { selector: "ExpressionStatement[directive='use dom']", message: DOM_MESSAGE };

// What react-native-svg fetches by address itself, with the global fetch and outside the API
// client: SvgUri, SvgFromUri and fetchText, and in react-native-svg/css SvgCssUri, SvgWithCssUri
// and LocalSvg, WithLocalSvg and loadLocalRawResource (they fetch their source's address). The
// package root's copies of the /css names only throw: refused all the same. A namespace import
// carries every name, so it is refused too.
const SVG_BY_ADDRESS = [
  'SvgUri',
  'SvgFromUri',
  'fetchText',
  'SvgCssUri',
  'SvgWithCssUri',
  'LocalSvg',
  'WithLocalSvg',
  'loadLocalRawResource',
];
const SVG_MESSAGE =
  'A picture is fetched through src/api/ (D-ONE-CLIENT): fetch its text with the API client and draw it with SvgXml.';
const NO_SVG_BY_ADDRESS = ['react-native-svg', 'react-native-svg/css'].map((name) => ({
  name,
  importNames: SVG_BY_ADDRESS,
  message: SVG_MESSAGE,
}));
// The package's own files hold the same names, out of the guard's sight.
const NO_SVG_FILES = {
  group: ['react-native-svg/src', 'react-native-svg/lib'],
  message: `Import react-native-svg, react-native-svg/css or react-native-svg/filter-image, never its own files. ${SVG_MESSAGE}`,
};

// The file system's own transfers, each fetching or sending by address (rule 13.2): in
// expo-file-system File.downloadFileAsync, in expo-file-system/legacy downloadAsync, uploadAsync,
// createDownloadResumable, createUploadTask and the DownloadResumable and UploadTask classes (and
// the stubs of those names the package root keeps). Only src/api/ may name them.
const FILE_TRANSFERS = [
  'downloadFileAsync',
  'downloadAsync',
  'uploadAsync',
  'createDownloadResumable',
  'createUploadTask',
  'DownloadResumable',
  'UploadTask',
];
const TRANSFER_MESSAGE =
  'Fetch or send a file through src/api/transfer.ts (rule 13.2): the file system never fetches or sends by address on its own.';
const NO_TRANSFER_IMPORTS = [
  { name: 'expo-file-system', importNames: FILE_TRANSFERS, message: TRANSFER_MESSAGE },
];
const NO_TRANSFER_IMPORT_PATTERNS = [
  { group: ['expo-file-system/*'], importNames: FILE_TRANSFERS, message: TRANSFER_MESSAGE },
];
const TRANSFER_NAMES = `/^(${FILE_TRANSFERS.join('|')})$/`;
// A member by its name, whatever holds it (File.downloadFileAsync, FileSystem.uploadAsync,
// a resumable's downloadAsync), and the same names taken out by destructuring.
const NO_FILE_TRANSFERS = [
  { selector: `MemberExpression[property.name=${TRANSFER_NAMES}]`, message: TRANSFER_MESSAGE },
  { selector: `MemberExpression[property.value=${TRANSFER_NAMES}]`, message: TRANSFER_MESSAGE },
  { selector: `ObjectPattern > Property[key.name=${TRANSFER_NAMES}]`, message: TRANSFER_MESSAGE },
];

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

// Refused in every file: a second client, a web view, a picture fetched by address, expo's file
// behind expo/fetch. Each block adds what it refuses beside them.
function restrictedImports(paths, patterns) {
  return [
    'error',
    {
      paths: [...paths, ...NO_WEB_VIEWS, ...NO_SVG_BY_ADDRESS, ...NO_OTHER_CLIENTS],
      patterns: [
        ...patterns,
        ...NO_WEB_VIEW_PATTERNS,
        NO_SVG_FILES,
        NO_EXPO_FETCH_FILES,
        NO_OTHER_CLIENT_PATHS,
      ],
    },
  ];
}
const OUTSIDE_THE_CLIENT_IMPORTS = [NO_EXPO_FETCH, ...NO_TRANSFER_IMPORTS];

// The same modules reached by require() or import(), which no-restricted-imports does not see.
// No slash in the pattern: a selector's own /.../ cannot hold one, so a dot stands for it.
const REFUSED_MODULES = [
  'react-native-webview',
  'expo.dom',
  '@expo.dom-webview',
  'expo.src.dom',
  'expo.fetch',
  'expo.src.winter.fetch',
  ...OTHER_CLIENTS,
];
const LOADED_ANOTHER_WAY =
  'Not by require() or import() either: see the guards at the top of eslint.config.js.';
const SVG_LOADED_ANOTHER_WAY = `Import react-native-svg statically, so the guard reads the names. ${SVG_MESSAGE}`;

function loadedBy(modules, message) {
  const source = `/^(${modules.join('|')})($|[^a-zA-Z0-9_-])/`;
  return [
    { selector: `CallExpression[callee.name='require'][arguments.0.value=${source}]`, message },
    { selector: `ImportExpression[source.value=${source}]`, message },
  ];
}
const NO_OTHER_LOADERS = [
  ...loadedBy(REFUSED_MODULES, LOADED_ANOTHER_WAY),
  ...loadedBy(['react-native-svg'], SVG_LOADED_ANOTHER_WAY),
];

// The colours React Native reads from a string, anywhere in it: #rgb, #rrggbb, #rrggbbaa, #rgba
// with a letter in it, and the rgb(), rgba(), hsl(), hsla() and hwb() functions. Four decimal
// digits read as the board's ticket number (#0422), so that #rgba is refused where a colour goes.
const COLOUR =
  '(#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|(?=[0-9]{0,3}[a-fA-F])[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_])|\\b(rgba?|hsla?|hwb)\\s*\\()';
const COLOUR_MESSAGE = 'Colour literal (D-TOKENS): read the colour from src/styles/tokens.';
// Where a colour goes: a key React Native reads as one (color, backgroundColor, tintColor…) and
// a component's colour prop (those, colors, fill and stroke). There, a whole string of four
// decimal digits or a colour's name is a colour. Elsewhere a name may be a token's ('olive',
// 'navy') or a word. React Native's own list of names; 'transparent' is no colour and stays.
const NAMED_COLOURS = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond
  blue blueviolet brown burlywood burntsienna cadetblue chartreuse chocolate coral cornflowerblue
  cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
  darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue
  darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey
  dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green
  greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen
  lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey
  lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue
  lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid
  mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
  midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered
  orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen
  seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal
  thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/);
const COLOUR_KEY = '/^(color|[a-zA-Z_]+Color)$/';
const COLOUR_PROP = '/^(color|colors|fill|stroke|[a-zA-Z_]+Color)$/';
const COLOUR_IN_ITS_PLACE = `/^(#[0-9]{4}|${NAMED_COLOURS.join('|')})$/`;
const NO_COLOUR_LITERALS = [
  { selector: `Literal[value=/${COLOUR}/]`, message: COLOUR_MESSAGE },
  { selector: `TemplateElement[value.raw=/${COLOUR}/]`, message: COLOUR_MESSAGE },
  {
    selector: `Property[key.name=${COLOUR_KEY}] Literal[value=${COLOUR_IN_ITS_PLACE}]`,
    message: COLOUR_MESSAGE,
  },
  {
    selector: `JSXAttribute[name.name=${COLOUR_PROP}] Literal[value=${COLOUR_IN_ITS_PLACE}]`,
    message: COLOUR_MESSAGE,
  },
];

// One rule holds every list a file gets: a second no-restricted-syntax for the same files would
// replace the first, not add to it.
function restrictedSyntax({ transfers, colours }) {
  return [
    'error',
    ...NO_OTHER_LOADERS,
    NO_DOM_DIRECTIVE,
    ...(transfers ? NO_FILE_TRANSFERS : []),
    ...(colours ? NO_COLOUR_LITERALS : []),
  ];
}

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
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        ...NETWORK_NAMES.map((name) => ({ name, message: ONE_WAY_IN })),
      ],
      'no-restricted-properties': [
        'error',
        ...NETWORK_OBJECTS.flatMap((object) =>
          NETWORK_NAMES.map((property) => ({ object, property, message: ONE_WAY_IN })),
        ),
        { object: 'navigator', property: 'sendBeacon', message: ONE_WAY_IN },
      ],
      'no-restricted-syntax': restrictedSyntax({ transfers: true, colours: false }),
      'no-restricted-imports': restrictedImports(
        OUTSIDE_THE_CLIENT_IMPORTS,
        NO_TRANSFER_IMPORT_PATTERNS,
      ),
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
    files: HAND_WRITTEN_CORE,
    rules: {
      'no-restricted-imports': restrictedImports(OUTSIDE_THE_CLIENT_IMPORTS, [
        ...NO_TRANSFER_IMPORT_PATTERNS,
        PURE_CORE_PATTERN,
      ]),
    },
  },
  {
    files: APP_CODE,
    ignores: TOKEN_FILES,
    rules: { 'no-restricted-syntax': restrictedSyntax({ transfers: true, colours: true }) },
  },
  {
    // the one client: the network globals, and the file system's transfers (src/api/transfer.ts)
    files: ['src/api/**'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': restrictedSyntax({ transfers: false, colours: true }),
      'no-restricted-imports': restrictedImports([NO_EXPO_FETCH], []),
    },
  },
  {
    files: ['src/api/transport.ts'],
    rules: { 'no-restricted-imports': restrictedImports([], []) },
  },
  {
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
];
