// Candy's copy (one strings module per feature, §4.11): every word Candy says beyond the picker's
// name, tagline and look link (src/styles/strings.ts holds those, for its shared maps). Nothing
// commercial (D8), and nothing that points at making an account (D63). Pure: no React.

/** Make it sweet until Candy's look page lands (US-023m): what the page says meanwhile. */
// CANDY_STAND_IN US-023m
export const CANDY_LOOK_SOON_COPY = Object.freeze({
  eyebrow: 'Candy',
  title: 'Make it sweet',
  message: "Candy's palettes, roundness, glow and motion are coming in an update.",
  back: 'Back',
});

/** Save look's name for a saved look ('My look 2') and its line (spec.ts asNewLook). */
export const CANDY_LOOK_COPY = Object.freeze({
  savedName: (n: number) => `My look ${n}`,
  savedSub: (name: string) => `From ${name}`,
});

/** The pause control (WCAG 2.2.2): its word, and what VoiceOver hears (the action a tap takes). */
export const CANDY_PAUSE_COPY = Object.freeze({
  pause: 'Pause',
  play: 'Play',
  pauseLabel: 'Pause the animation',
  playLabel: 'Play the animation',
});

/** Auto in Candy: his one name for VoiceOver, and the stage's word while he speaks. */
export const CANDY_AUTO_COPY = Object.freeze({
  name: (caption: string) => `Auto, ${caption}`,
  speaking: 'Speaking',
});

/** Candy's parts (US-023f): the tab bar's words, the orb's words for VoiceOver, the status glyphs and the writing chip. */
export const CANDY_COPY = Object.freeze({
  tabs: Object.freeze({ today: 'Today', chat: 'Chat', shelf: 'Shelf', team: 'Team' }),
  /** What VoiceOver hears for the tab bar as a whole. */
  tabsLabel: 'Home views',
  /** The orb's figure and caption as one line ('3 need you'). */
  orbLabel: (figure: string, caption: string) => `${figure} ${caption}`,
  /** A status is a glyph and a word, never colour alone: filled while active, open while resting. */
  statusGlyph: Object.freeze({ active: '●', resting: '○' }),
  writing: 'Auto is writing',
});

/** P1 Today (US-023g): the greeting for the time of day, the line under it, the orb, the stat cards and the Needs you window. */
export const CANDY_TODAY_COPY = Object.freeze({
  /** The kit's greetingFor (today-words.ts): the app reads no person's name, so the greeting has none. */
  greeting: Object.freeze({
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  }),
  /** Under the greeting, from needs-you's total. */
  needs: (count: number) => (count === 1 ? '1 thing needs you' : `${count} things need you`),
  nothingNeeds: 'Nothing needs you',
  /** The orb's caption under needs-you's number (no completion time to count: openQuestions Q1). */
  orbCaption: 'need you',
  /** What VoiceOver hears for the stat cards' row, and each card ('Working now, 2'). */
  statsLabel: "Today's numbers",
  stats: Object.freeze({ working: 'Working now', needs: 'Needs you', queue: 'In queue' }),
  statLabel: (label: string, figure: string) => `${label}, ${figure}`,
  needsTitle: 'Needs you',
  /** Who a row names when it names no agent (the kit's SOME_AGENT). */
  someAgent: 'An agent',
  /** A row's line: '{agent} · {time ago}', or the agent alone when the row gives no time. */
  meta: (agent: string, when: string | null) => (when ? `${agent} · ${when}` : agent),
});

/** The home's voice in the tab bar (US-023g): Stop while the voice works or a typed turn streams. */
export const CANDY_VOICE_COPY = Object.freeze({
  stop: 'Stop',
  stopHint: 'Stops Auto’s reply',
});

/** P2 Chat (US-023h): the stage, the thread's chips and Deliverables, and the message box. */
export const CANDY_CHAT_COPY = Object.freeze({
  /** The stage's title before the chat has its own. */
  newChat: 'New chat',
  back: 'Back',
  /** The back circle's glyph; VoiceOver hears 'Back'. */
  backGlyph: '‹',
  /** The state pill: Auto's state as a glyph and a word ('● Listening'). */
  state: (glyph: string, word: string) => `${glyph} ${word}`,
  /** A tool chip's glyph by how the call went (the kit's CHIP_GLYPHS): never colour alone. */
  chipGlyph: Object.freeze({ done: '✓', running: '●', failed: '✕' }),
  open: 'Open',
  openHint: 'Opens the Deliverable',
  /** What VoiceOver hears for a Deliverable's row ('Spring launch post, Document'). */
  deliverableLabel: (title: string, kind: string) => `${title}, ${kind}`,
  /** What VoiceOver hears for the thread as a whole. */
  threadLabel: 'Conversation with Auto',
  composer: Object.freeze({
    placeholder: 'Message Auto',
    send: 'Send',
    stop: 'Stop',
    stopHint: 'Stops Auto’s reply',
  }),
});

/** P3 Shelf (US-023i): the title, the type chips, a tile's line and label, paging and the empty shelf. */
export const CANDY_SHELF_COPY = Object.freeze({
  title: 'Deliverables',
  /** The type chips, each the gallery's type filter (shelf.ts SHELF_CHIPS). */
  chips: Object.freeze({
    all: 'All',
    reports: 'Reports',
    documents: 'Documents',
    images: 'Images',
    spreadsheets: 'Spreadsheets',
    slides: 'Slides',
  }),
  /** Under a tile's title: '{type} · {day}', the type alone when the day is unknown. */
  line: (type: string, day: string | null) => (day ? `${type} · ${day}` : type),
  /** What VoiceOver hears for a tile: 'Q3 brand report, Report, Today'. */
  tileLabel: (title: string, type: string, day: string | null) =>
    day ? `${title}, ${type}, ${day}` : `${title}, ${type}`,
  more: 'More',
  /** The More pill while the next page loads. */
  loadingMore: 'Loading…',
  all: 'All Deliverables',
  allHint: 'Opens the Deliverables in the Command Centre',
  /** No Deliverable at all: Auto asleep, these words and the way to the chat. */
  empty: Object.freeze({
    title: 'Your shelf is empty.',
    message: 'Ask Auto for something and it lands here.',
  }),
  chat: 'Chat',
  chatHint: 'Shows the chat with Auto',
  /** A type with none: back to every type. */
  showAll: 'Show all',
  showAllHint: 'Shows every type',
});

/**
 * The edge screens in Candy (US-023l): the brand line over them, First open's greeting (its line
 * the kit's chat/thread.tsx EMPTY_THREAD) and Lost's lines (the kit's edges/not-found.tsx).
 */
export const CANDY_EDGE_COPY = Object.freeze({
  brand: Object.freeze({ name: 'Automatos', mark: 'Candy', label: 'Automatos Candy' }),
  greeting: Object.freeze({
    title: "Hi, I'm Auto",
    line: 'Tell Auto what you need: a post, a report, a plan. He takes it from there.',
  }),
  lostTitle: "This page isn't here",
  lostMessage: 'The link may be old, or the page may have moved. Let’s get you back.',
});

/** P4 Team (US-023j): the title, the active count, each agent's state, what VoiceOver hears and an empty team. */
export const CANDY_TEAM_COPY = Object.freeze({
  title: 'Your team',
  /** Under the title, once the agents are read: '6 of 8 agents active'. */
  count: (active: number, total: number) =>
    `${active} of ${total} ${total === 1 ? 'agent' : 'agents'} active`,
  /** Each agent's state by Arcade's party rules, in words (the status chip adds its glyph). */
  states: Object.freeze({ needs: 'Needs you', working: 'Working', ready: 'Ready' }),
  /** What VoiceOver hears for a row: 'Iris, Social media lead, working'. */
  memberLabel: (name: string, line: string | null, word: string) =>
    line ? `${name}, ${line}, ${word.toLowerCase()}` : `${name}, ${word.toLowerCase()}`,
  /** What VoiceOver hears for the active row as a whole. */
  frontLabel: 'Your agents, active ones first',
  empty: 'No agents yet.',
});
