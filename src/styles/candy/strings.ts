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

/** The Chat view until US-023h builds it: its words, and the way back to Today. */
// CANDY_STAND_IN US-023h
export const CANDY_CHAT_SOON_COPY = Object.freeze({
  message: 'Chat with Auto opens here in this update.',
  back: 'Back',
});

/** The Shelf view until US-023i builds it. */
// CANDY_STAND_IN US-023i
export const CANDY_SHELF_SOON_COPY = Object.freeze({
  message: 'Your Deliverables land on this shelf in this update.',
});

/** The Team view until US-023j builds it. */
// CANDY_STAND_IN US-023j
export const CANDY_TEAM_SOON_COPY = Object.freeze({
  message: 'Your agents line up here in this update.',
});
