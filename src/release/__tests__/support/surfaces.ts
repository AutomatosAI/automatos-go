// Every way to talk to Auto, as the surface audit reads it (R15): the markers of code that sends a
// person's text or speech to Auto, and the file that declares the AI label. The explicit list of
// the product files that show a marker, the files that mount the ReportSheet and what Report this
// is on each thread are the app's (settings/surfaces.ts). surfaces.test.ts fails on a file that
// shows a marker the list does not give it.

export type SendMarker = Readonly<{ id: string; pattern: RegExp; what: string }>;

export const SEND_MARKERS: readonly SendMarker[] = [
  {
    id: 'composer',
    pattern: /<Composer\b/,
    what: "renders a composer: A2's Composer, or a home's own wrapper of its message box",
  },
  { id: 'play-composer', pattern: /<PlayComposer\b/, what: "renders Play's message box" },
  {
    id: 'hud-core',
    pattern: /<HudCore\b/,
    what: "renders HUD's core, whose TYPE and HOLD TO TALK reach Auto",
  },
  {
    id: 'speech',
    pattern: /(?<!function )\buseQuickAsk\(/,
    what: "runs A6's quick-ask: listens, and sends the words heard to Auto",
  },
  {
    id: 'candy-talk',
    pattern: /<CandyTalkButton\b/,
    what: "renders Candy's hold to talk, whose press sends the words heard to Auto (A6's quick-ask)",
  },
  { id: 'candy-composer', pattern: /<CandyComposer\b/, what: "renders Candy's message box" },
];

/** The words some marker's match must contain, read on the raw file before it is parsed. */
export const SEND_HINT = /Composer|HudCore|useQuickAsk|CandyTalkButton/;

/** The ids of the markers a piece of code shows, in SEND_MARKERS order. */
export function sendMarkersIn(code: string): string[] {
  return SEND_MARKERS.filter((marker) => marker.pattern.test(code)).map((marker) => marker.id);
}

/** The file that declares the AI label (FND-3; never edited by this wave). */
export const AI_LABEL_FILE = 'src/styles/ai-label.tsx';
