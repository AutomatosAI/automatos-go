// Every way to talk to Auto, as the surface audit reads it (R15): the markers of code that sends a
// person's text or speech to Auto, and the explicit list of the product files that show one, each
// with how it carries the AI label (D73, one muted caption): the files its render reaches the
// foundation's AiLabel through, or the surfaces it is used only inside. Then the files that mount
// the foundation's ReportSheet (D15), and what Report this is on each thread's Auto messages.
// surfaces.test.ts fails on a file that shows a marker the list does not give it.

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
];

/** The words some marker's match must contain, read on the raw file before it is parsed. */
export const SEND_HINT = /Composer|HudCore|useQuickAsk|CandyTalkButton/;

/** The ids of the markers a piece of code shows, in SEND_MARKERS order. */
export function sendMarkersIn(code: string): string[] {
  return SEND_MARKERS.filter((marker) => marker.pattern.test(code)).map((marker) => marker.id);
}

/** The file that declares the AI label (FND-3; never edited by this wave). */
export const AI_LABEL_FILE = 'src/styles/ai-label.tsx';

/**
 * A surface's way to the label: the files after it, in render order, the last of which renders
 * AiLabel itself (an empty path: the surface renders it). One path per branch that can send.
 */
export type LabelPath = readonly string[];

export type SendSurface = Readonly<{
  file: string;
  sends: readonly string[];
  reason: string;
}> &
  (
    | Readonly<{ labels: readonly LabelPath[]; inside?: never }>
    | Readonly<{ inside: readonly string[]; labels?: never }>
  );

const MESSAGE_LIST = 'src/chat/components/MessageList.tsx';
const PLAY_MESSAGES = 'src/styles/play/companion/Messages.tsx';
const HUD_CORE = 'src/styles/hud/core/HudCore.tsx';
const TRANSCRIPT = 'src/styles/hud/core/Transcript.tsx';
export const CHAT_SCREEN = 'src/chat/screens/ChatScreen.tsx';
export const PLAY_HOME = 'src/styles/homes/PlayHome.tsx';
export const HUD_HOME = 'src/styles/homes/HudHome.tsx';
export const ARCADE_HOME = 'src/styles/homes/ArcadeHome.tsx';
const STORY_WINDOW = 'src/styles/arcade/home/StoryWindow.tsx';
export const CANDY_HOME = 'src/styles/homes/CandyHome.tsx';
const CANDY_VOICE_WINDOW = 'src/styles/candy/home/VoiceWindow.tsx';
export const VOICE_SCREEN = 'src/voice/screen/VoiceScreen.tsx';
export const FIRST_OPEN = 'src/styles/edges/FirstOpen.tsx';
export const FIRST_OPEN_THREAD = 'src/styles/homes/FirstOpenThread.tsx';

/** Every product file that shows a send marker, and exactly its markers. */
export const SEND_SURFACES: readonly SendSurface[] = [
  {
    file: CHAT_SCREEN,
    sends: ['composer'],
    labels: [[MESSAGE_LIST]],
    reason:
      "Studio's thread (A2, home and the chat route): MessageList's first row is the caption (ThreadCaption, its ListHeaderComponent); First open in the thread's place opens with it too (FirstOpenThread)",
  },
  {
    file: PLAY_HOME,
    sends: ['composer', 'play-composer'],
    labels: [
      ['src/styles/homes/PlayThread.tsx', PLAY_MESSAGES],
      [FIRST_OPEN_THREAD, PLAY_MESSAGES],
    ],
    reason:
      "Play's Companion chat (US-016k): PlayThread's ListHeaderComponent is PlayThreadCaption; First open's thread opens with the same caption",
  },
  {
    file: HUD_HOME,
    sends: ['composer', 'hud-core'],
    labels: [[HUD_CORE, TRANSCRIPT]],
    reason:
      "HUD's home (US-016k, US-019k): the core's Transcript opens with the caption; TYPE's Sheet and HOLD TO TALK sit over that core",
  },
  {
    file: ARCADE_HOME,
    sends: ['composer'],
    labels: [[STORY_WINDOW]],
    reason:
      "Arcade's home (US-022g): the story window's first row is the caption, above every entry; TYPE's Sheet and hold to talk sit under that window",
  },
  {
    file: CANDY_HOME,
    sends: ['candy-talk'],
    labels: [[CANDY_VOICE_WINDOW]],
    reason:
      "Candy's home (US-023g): hold to talk in the tab bar's raised centre; from the press on, the voice window over the bar opens with the caption, while Auto listens, thinks and speaks",
  },
  {
    file: VOICE_SCREEN,
    sends: ['composer', 'hud-core'],
    labels: [[HUD_CORE, TRANSCRIPT]],
    reason:
      "The voice screen in every style (US-019j): A5's HUD core, whose Transcript opens with the caption; TYPE's Sheet sits over it",
  },
  {
    file: FIRST_OPEN,
    sends: ['hud-core'],
    labels: [[HUD_CORE, TRANSCRIPT], [PLAY_MESSAGES]],
    reason:
      "US-017f's whole First open screen (exported, not mounted on the merged base): HUD's branch is the core; Play's and Studio's lay the composer slot under the hello, which opens with PlayThreadCaption",
  },
  {
    file: 'src/voice/home/use-hud-home-voice.ts',
    sends: ['speech'],
    inside: [HUD_HOME],
    reason: "HOLD TO TALK on HUD's home (US-019k): a hook, used only by HudHome",
  },
  {
    file: 'src/voice/home/use-arcade-home-voice.ts',
    sends: ['speech'],
    inside: [ARCADE_HOME],
    reason: "Hold to talk on Arcade's home (US-022g): a hook, used only by ArcadeHome",
  },
  {
    file: 'src/voice/home/use-candy-home-voice.ts',
    sends: ['speech'],
    inside: [CANDY_HOME],
    reason: "Hold to talk on Candy's home (US-023g): a hook, used only by CandyHome",
  },
  {
    file: 'src/voice/screen/use-voice-screen.ts',
    sends: ['speech'],
    inside: [VOICE_SCREEN],
    reason: "The voice screen's quick-ask (US-019j): a hook, used only by VoiceScreen",
  },
];

export type ReportMount = Readonly<{
  file: string;
  target: 'message' | 'deliverable';
  /** The hook that opens the sheet on that target, and the file that declares it. */
  opener: Readonly<{ name: string; file: string }>;
  reason: string;
}>;

const MESSAGE_REPORT = { name: 'useMessageReport', file: 'src/chat/report/use-message-report.ts' };
const DELIVERABLE_PAGE = {
  name: 'useDeliverablePage',
  file: 'src/cc/deliverables/use-deliverable.ts',
};

/** Every product file that mounts the foundation's ReportSheet. */
export const REPORT_MOUNTS: readonly ReportMount[] = [
  {
    file: CHAT_SCREEN,
    target: 'message',
    opener: MESSAGE_REPORT,
    reason:
      "Studio's thread (A2 US-009c): a long-press or the accessible action on Auto's messages",
  },
  {
    file: PLAY_HOME,
    target: 'message',
    opener: MESSAGE_REPORT,
    reason: "Play's thread (US-016k): the same, on Play's Auto messages",
  },
  {
    file: HUD_HOME,
    target: 'message',
    opener: MESSAGE_REPORT,
    reason:
      "HUD's home (P001R-AF-1): a long-press or the accessible action on Auto's saved reply in the core's Transcript (HudTurn's autoMessageId)",
  },
  {
    file: ARCADE_HOME,
    target: 'message',
    opener: MESSAGE_REPORT,
    reason:
      "Arcade's home (US-022g): a long-press or the accessible action on Auto's saved replies in the story window, and on the one the dialogue window says",
  },
  {
    file: CANDY_HOME,
    target: 'message',
    opener: MESSAGE_REPORT,
    reason:
      "Candy's home (US-023g): mounted once beside its views; the Chat view takes `report` for a long-press or the accessible action on Auto's bubbles (US-023h)",
  },
  {
    file: VOICE_SCREEN,
    target: 'message',
    opener: MESSAGE_REPORT,
    reason:
      "The voice screen in every style (P001R-AF-1): the same, on the voice's saved reply in the core's Transcript",
  },
  {
    file: 'src/cc/deliverables/DeliverableDetail.tsx',
    target: 'deliverable',
    opener: DELIVERABLE_PAGE,
    reason: "A Deliverable's page in Studio and HUD (A3 US-013b): Report this in its foot",
  },
  {
    file: 'src/styles/homes/PlayDeliverable.tsx',
    target: 'deliverable',
    opener: DELIVERABLE_PAGE,
    reason: "A Deliverable's page in Play (US-017g): Report this in Ember's bottom row",
  },
];

/** What a person can do with Auto's messages on each surface that can show them. */
export type AutoMessages =
  | Readonly<{ kind: 'report' }>
  | Readonly<{ kind: 'none'; reason: string }>
  | Readonly<{ kind: 'pending'; story: string; reason: string }>;

export const AUTO_MESSAGES: Readonly<Record<string, AutoMessages>> = {
  [CHAT_SCREEN]: { kind: 'report' },
  [PLAY_HOME]: { kind: 'report' },
  [HUD_HOME]: { kind: 'report' },
  [ARCADE_HOME]: { kind: 'report' },
  [CANDY_HOME]: { kind: 'report' },
  [VOICE_SCREEN]: { kind: 'report' },
  [FIRST_OPEN]: {
    kind: 'none',
    reason: "First open is the hello before any message (HUD's core with EMPTY_TURN)",
  },
};
