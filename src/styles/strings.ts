// The styles' copy (one strings module per feature, §4.11): the picker's names, taglines and the
// words its cards and rows say to VoiceOver. Nothing commercial (D8), and nothing that points at
// making an account (D63).

import type { MascotName } from '../core/frozen/lib/mascot/types';
import type { ThemeChoice } from './theme-choice';
import type { BuiltInStyleId } from './registry/style-id';

/** Each built-in style's name and the line under it in the picker (PRD-001 §4.6). */
export const STYLE_COPY = Object.freeze({
  names: Object.freeze<Record<BuiltInStyleId, string>>({
    studio: 'Studio',
    play: 'Play',
    hud: 'HUD',
  }),
  taglines: Object.freeze<Record<BuiltInStyleId, string>>({
    studio: 'Cream paper or Studio Dark',
    play: 'Auto and the Ember look',
    hud: 'Voice first, glow and grid',
  }),
});

/** The Style and look screen (US-016h): the word on the chosen card is never colour alone. */
export const PICKER_COPY = Object.freeze({
  selected: 'Selected',
  /** VoiceOver's name for a style card: 'Studio style, selected'. */
  styleLabel: (name: string, selected: boolean) =>
    selected ? `${name} style, selected` : `${name} style`,
  /** An installed theme's row under Studio: 'Harbour · 1.1.0'. */
  themeTitle: (name: string, version: string) => `${name} · ${version}`,
  /** VoiceOver's name for that row: 'Harbour theme, version 1.1.0, selected'. */
  themeLabel: (name: string, version: string, selected: boolean) =>
    selected ? `${name} theme, version ${version}, selected` : `${name} theme, version ${version}`,
  /** The link from a style card to its look page (Studio's look is the scheme, on its card). */
  lookLinks: Object.freeze({ play: 'Make it yours', hud: 'Looks' }),
  /** Studio's Light / Dark / System control and its name for VoiceOver. */
  schemes: Object.freeze<Record<ThemeChoice, string>>({
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  }),
  schemeGroup: 'Studio appearance',
  /** The screen's header (Settings → Style and look). */
  eyebrow: 'Settings',
  title: 'Style and look',
  /** Settings' row to this screen (US-016j): what it opens, for VoiceOver. */
  settingsHint: 'Choose how Automatos Go looks',
  back: 'Back',
  /** After a look link's words on screen ('Make it yours →'); VoiceOver hears the words alone. */
  linkArrow: '→',
  /** What a card does and where its look link goes, for VoiceOver. */
  styleHint: (name: string) => `Paints Automatos Go in ${name}`,
  lookHint: (name: string) => `Opens ${name}'s looks`,
  /** The first row under Studio (D-PHONE-CHOICE): the phone follows the theme Studio uses. */
  follow: Object.freeze({
    title: 'Same as Studio',
    /** What it paints now: 'Now Play', 'Now Harbour · 1.1.0'. */
    summary: (painted: string) => `Now ${painted}`,
    /** A followed theme the list does not have yet. */
    theme: "Studio's theme",
    label: (painted: string, selected: boolean) =>
      selected ? `Same as Studio, now ${painted}, selected` : `Same as Studio, now ${painted}`,
    hint: 'Automatos Go follows the theme you use in Studio',
  }),
});

/** Installed themes on the phone (US-016i, D58): the one toast when a theme on screen is gone. */
export const THEME_COPY = Object.freeze({
  lost: "That theme isn't available any more, so Automatos Go is back on Studio.",
});

/**
 * Play's and HUD's looks in step with the web (US-017d): what Play's look page says while Play is
 * not installed in the workspace (a 404 from the looks route). HUD's looks stay on the phone then
 * with no words. A failed read or save shows the API taxonomy's own words.
 */
export const LOOK_SYNC_COPY = Object.freeze({
  localOnly: 'Kept on this phone only',
  playNotInstalled: 'Install Play in Studio to keep your looks in step with the web.',
});

/**
 * Play's look page 'Make it yours' (US-017e, 'Automatos Play Looks.dc.html' and the web's
 * looks-screen.tsx, look-options.tsx, look-manager.tsx at the pin): the heading, each knob's name
 * as the design writes it, what VoiceOver hears for an option ('Molten accent, selected') and the
 * glow ('24 percent'), the preview's sample words, the looks row, the sheet a long press on a
 * saved look opens, and why a change was refused.
 */
export const PLAY_LOOK_COPY = Object.freeze({
  heading: 'Make it yours.',
  lead: 'Pick a look, then tweak it. Auto changes with it.',
  back: 'Back',
  /** The status line of a look changed since it was picked: 'Ember · edited'. */
  edited: (name: string) => `${name} · edited`,
  knobs: Object.freeze({
    accent: 'Accent',
    ground: 'Background',
    font: 'Type',
    shell: "Auto's shell",
    light: "Auto's light · eyes + ring",
    glow: 'Glow',
  }),
  /** The accent's heading names the one picked: 'Accent · Molten'. */
  accentTitle: (name: string) => `Accent · ${name}`,
  /** What each option is, after its name, for VoiceOver: 'Molten accent'. */
  kinds: Object.freeze({
    accent: 'accent',
    ground: 'background',
    font: 'type',
    shell: 'shell',
    light: 'light',
  }),
  /** VoiceOver's name for an option: 'Molten accent, selected'. */
  option: (name: string, kind: string, selected: boolean) =>
    selected ? `${name} ${kind}, selected` : `${name} ${kind}`,
  glowOff: 'Off',
  glowShown: (glow: number) => `${glow}%`,
  /** The glow in words for VoiceOver; at the cap, why it stops there. */
  glowWords: (glow: number) => `${glow} percent`,
  glowAtCap: (glow: number) => `${glow} percent, the most this look keeps readable`,
  looks: 'Looks',
  /** VoiceOver's name for a look in the row: 'Ember, Warm, editorial, selected'. */
  look: (name: string, sub: string, selected: boolean) =>
    selected ? `${name}, ${sub}, selected` : `${name}, ${sub}`,
  lookHint: 'Touch and hold to rename, duplicate or delete',
  /** The row's type sample, set in each look's own face. */
  sample: 'Aa',
  saveAsNew: 'Save as new look',
  reset: 'Reset',
  resetHint: 'Back to the look you picked',
  /** A look made with Save as new look: 'My look 2', under it 'Your look' (never a time). */
  savedName: (n: number) => `My look ${n}`,
  savedSub: 'Your look',
  /** A duplicate: 'Ember copy', then 'Ember copy 2'. */
  copyWord: 'copy',
  notKept: "This phone couldn't keep that change. It lasts until Automatos Go closes.",
  preview: Object.freeze({
    label: (name: string) => `Preview of ${name}: Auto, a message, what he did and a report`,
    you: 'Can you make me a shortlist under £700?',
    searched: 'Searched the web · 5 results',
    report: 'Made a report',
    reply: 'Three laptops make the cut. My pick is the ',
    pick: 'ASUS Vivobook S 14',
    replyEnd: '.',
    title: 'Laptop shortlist',
  }),
  sheet: Object.freeze({
    rename: 'Rename',
    duplicate: 'Duplicate',
    delete: 'Delete',
    newName: 'New name',
    saveName: 'Save name',
    cancel: 'Cancel',
    confirmDelete: (name: string) => `Delete ${name}? This can't be undone.`,
    deleteLook: 'Delete look',
    keep: 'Keep it',
  }),
  /** The toast after a delete: '… Play is back to Ember.' when the look deleted was the one on. */
  deleted: (name: string, backTo: string | null) =>
    backTo === null ? `Deleted ${name}.` : `Deleted ${name}. Play is back to ${backTo}.`,
  duplicated: (name: string) => `Duplicated as ${name}.`,
  renamed: (name: string) => `Renamed to ${name}.`,
  refusals: Object.freeze({
    preset: "A preset can't be changed. Save it as a new look instead.",
    'not-saved': "That look isn't one of your saved looks any more.",
    full: 'There’s no room for another look. Delete one to save another.',
    name: 'A name is 1 to 40 characters on one line.',
  }),
});

/**
 * The live previews on the picker's cards (US-016h): sample words in each style's own layout,
 * hidden from VoiceOver (the card says its name and state). Play's tool line and HUD's chip take
 * their words from the vendored labels and captions, so they read as the real screens do.
 */
export const PREVIEW_COPY = Object.freeze({
  studio: Object.freeze({
    wordmark: 'automatos',
    needs: 'NEEDS YOU · 2',
    needTitle: 'Approve the launch plan',
    needMeta: 'Mission · 2 min ago',
  }),
  play: Object.freeze({
    /** Ember's status word beside Auto ('Searching.'), for Auto at rest. */
    status: 'Ready.',
    /** The sample call Play's tool chip describes (the vendored toolLineLabel words it). */
    toolName: 'platform_web_search',
    toolSummary: '3 results',
  }),
  hud: Object.freeze({
    brand: 'AUTOMATOS',
    brandMark: '//',
  }),
});

/**
 * HUD's looks (US-018a; the Looks drawer is US-018c): each knob's label as the look schema carries
 * it, the status line's mark and the name 'Save as new look' gives, in HUD's capitals as the HUD
 * drawing writes them ('ARC · EDITED', 'MINE 2').
 */
export const HUD_LOOK_COPY = Object.freeze({
  knobs: Object.freeze({
    ground: 'Background',
    accent: 'Accent',
    font: 'Type',
    grid: 'Grid',
    glow: 'Glow',
    scan: 'Scanlines',
    auto: 'Auto',
    motion: 'Motion',
  }),
  /** The status line of a look changed since it was picked: 'ARC · EDITED'. */
  edited: (name: string) => `${name} · EDITED`,
  /** A look saved with 'Save as new look': 'MINE 1', 'MINE 2'. */
  savedName: (n: number) => `MINE ${n}`,
});

/**
 * HUD's Looks drawer (US-018c, 'Automatos Command HUD.dc.html'): what it draws, in the drawing's
 * capitals, and the option names its script gives; what VoiceOver hears, in sentence case. The
 * sheet a long press opens, the refusals and the glow's words are Play's (PLAY_LOOK_COPY).
 */
export const HUD_DRAWER_COPY = Object.freeze({
  title: 'LOOK',
  titleLabel: 'Look',
  close: 'Close',
  accentTitle: (name: string) => `ACCENT · ${name.toUpperCase()}`,
  background: 'BACKGROUND',
  type: 'TYPE',
  grid: 'GRID',
  glow: 'GLOW',
  accents: Object.freeze({
    arc: 'Arc',
    forge: 'Forge',
    ghost: 'Ghost',
    nova: 'Nova',
    signal: 'Signal',
    gold: 'Gold',
  }),
  grounds: Object.freeze({ void: 'Void', carbon: 'Carbon', navy: 'Navy', ember: 'Ember' }),
  fonts: Object.freeze({ raj: 'Rajdhani', chakra: 'Chakra', mono: 'Mono' }),
  kinds: Object.freeze({ accent: 'accent', ground: 'background', font: 'type' }),
  /** A switch as the drawing writes it: 'SCAN ON', 'MOTION OFF'. */
  switches: Object.freeze({ scan: 'SCAN', auto: 'AUTO', motion: 'MOTION' }),
  switchText: (word: string, on: boolean) => `${word} ${on ? 'ON' : 'OFF'}`,
  /** Under the switches while the phone's Reduce Motion holds HUD still. */
  motionForced: 'MOTION OFF · REDUCE MOTION',
  motionForcedLabel: 'Motion is off while Reduce Motion is on',
  look: (name: string, selected: boolean) => (selected ? `${name}, selected` : name),
  lookHint: 'Touch and hold to rename or delete',
  gridWords: (grid: number, max: number) => `${grid} of ${max}`,
  saveAsNew: 'SAVE AS NEW LOOK',
  saveAsNewLabel: 'Save as new look',
  reset: 'RESET',
  resetLabel: 'Reset',
  /** The toast after a delete: '… HUD is back to ARC.' when the look deleted was the one on. */
  deleted: (name: string, backTo: string | null) =>
    backTo === null ? `Deleted ${name}.` : `Deleted ${name}. HUD is back to ${backTo}.`,
});

/**
 * The words HUD's statuses say beyond the board's own (dress/status-glyphs.ts; the board's are the
 * web's STATUS_CONFIG labels): HUD shows each in capitals after its glyph, never colour alone.
 */
export const STATUS_WORDS = Object.freeze({
  working: 'Working',
  queued: 'Queued',
  needs_you: 'Needs you',
  approved: 'Approved',
  error: 'Error',
  paused: 'Paused',
  idle: 'Idle',
  offline: 'Offline',
  running: 'Running',
});

/** Auto on screen (US-017b): VoiceOver hears his name and what he is doing (the vendored caption). */
export const MASCOT_COPY = Object.freeze({
  label: (caption: string) => `Auto, ${caption}`,
});

/**
 * Play's status word beside Auto (Ember 01-03, US-017c): one short word per state, in the look's
 * display face; the vendored chatCaption's detail (else its caption) sits under it.
 */
export const PLAY_STATUS = Object.freeze<Record<MascotName, string>>({
  hello: 'Hi.',
  idle: 'Ready.',
  listening: 'Listening.',
  thinking: 'Thinking.',
  working: 'On it.',
  searching: 'Searching.',
  reading: 'Reading.',
  celebrate: 'Ta-da.',
  oops: 'Hm.',
  sleeping: 'Asleep.',
  lost: 'Lost.',
  loading: 'Loading.',
});

/**
 * Play's chat (Ember 01-02, US-017c): the header, the needs line (KS10), the tool chips' words for
 * VoiceOver (the vendored toolLineLabel writes what they show), "What Auto did" (the web's
 * receipts.tsx badges), the report card and the composer. No AI label beside the composer: the
 * caption opens the thread (D73).
 */
export const PLAY_CHAT_COPY = Object.freeze({
  chats: 'Chats',
  shelf: 'Shelf',
  /** 'Shelf +1' when Deliverables landed in this conversation. */
  shelfFresh: (count: number) => `Shelf +${count}`,
  shelfLabel: (count: number) => (count > 0 ? `Shelf, ${count} new in this chat` : 'Shelf'),
  /** Shown in the label style's capitals: 'NEEDS YOU · 3'. */
  needs: (total: number) => `Needs you · ${total}`,
  needsLink: 'Command Centre',
  /** After the link's words on screen; VoiceOver hears the words alone. */
  linkArrow: '→',
  needsLabel: (total: number) => `${total} need you. Opens the Command Centre`,
  tool: Object.freeze({ running: 'Running', done: 'Done', failed: 'Failed' }),
  receipts: Object.freeze({
    title: 'What Auto did',
    done: 'Done',
    notDone: 'Not done',
    skipped: 'Skipped',
    joiner: ' — ',
  }),
  report: Object.freeze({
    kind: 'Report',
    justNow: 'just now',
    /** 'Report · just now', in the label style's capitals. */
    eyebrow: (kind: string, when: string) => `${kind} · ${when}`,
    open: 'Open',
    openLabel: (title: string) => `Open ${title}`,
  }),
  composer: Object.freeze({
    placeholder: 'Message Auto',
    send: 'Send',
    stop: 'Stop',
    stopHint: 'Stops Auto’s reply',
  }),
});

/** Play's home over A2's thread (US-016k): the header's title before the chat has its own. */
export const PLAY_HOME_COPY = Object.freeze({
  newChat: 'New chat',
  untitled: 'Chat with Auto',
});

/** Play's Conversations (Ember 03, US-017c): sections, relative times, previews and the badge. */
export const PLAY_CONVERSATIONS_COPY = Object.freeze({
  title: 'Chats',
  newChat: 'New chat',
  /** A conversation with no title yet (the web's UNTITLED_CONVERSATION). */
  untitled: 'New chat',
  sections: Object.freeze({ today: 'Today', week: 'This week', earlier: 'Earlier' }),
  justNow: 'Just now',
  minutes: (n: number) => `${n} min`,
  hours: (n: number) => `${n} h`,
  yesterday: 'Yesterday',
  /** 'Auto: Three laptops make the cut…' / 'You: Shorter, and fewer…'. */
  preview: Object.freeze({ auto: 'Auto', user: 'You', joiner: ': ' }),
  /** '1 Report', '2 Reports', in the label style's capitals. */
  reports: Object.freeze({ one: 'Report', other: 'Reports' }),
  settings: 'Settings',
});

/** Play's bottom bar on Conversations and the Shelf (KS10): Centre is the Command Centre. */
export const PLAY_TABS_COPY = Object.freeze({
  chats: 'Chats',
  shelf: 'Shelf',
  centre: 'Centre',
});

/**
 * Play's Shelf and a Deliverable's page (Ember 04-05, US-017g): the title, the server's count, the
 * newest piece's badge, the eyebrow ('Report · Today', in the label style's capitals) and the way
 * back. Everything else (the pills, the empty, loading and failure words, Load more, the file's
 * actions) is A3's copy.
 */
export const PLAY_SHELF_COPY = Object.freeze({
  title: 'Your shelf',
  /** '15 Deliverables', set in Geist Mono capitals. */
  count: Object.freeze({ one: 'Deliverable', other: 'Deliverables' }),
  newest: 'Newest',
  today: 'Today',
  joiner: ' · ',
  back: '← Shelf',
  backLabel: 'Back to the shelf',
  listLabel: 'Your shelf of Deliverables',
});

/**
 * HUD's phone core (US-018b, 'Automatos Command HUD.dc.html'): the top bar, the status row's word
 * for Auto's state, the mic (A6 opens it: 'MIC LIVE' shows whenever it is open), the command row
 * (KS10), the three buttons and what the transcript says to VoiceOver. HOLD TO TALK does nothing
 * until the voice update (A6, D60), and says so.
 */
export const HUD_CORE_COPY = Object.freeze({
  brand: 'AUTOMATOS',
  brandMark: '//',
  brandLabel: 'Automatos',
  micLive: '● MIC LIVE',
  micOff: '○ MIC OFF',
  micLiveLabel: 'Microphone on',
  micOffLabel: 'Microphone off',
  /** Who answers when no agent is picked, and when a picked one has no name yet. */
  auto: 'Auto',
  unnamedAgent: 'Agent',
  /** The status row: 'RESEARCHER · SEARCHING' (the row draws it in capitals). */
  status: (agent: string, state: string) => `${agent} · ${state}`,
  statusLabel: (agent: string, state: string, elapsed: string) =>
    `${agent}, ${state.toLowerCase()}, ${elapsed}`,
  command: 'COMMAND',
  commandCount: (count: string) => `COMMAND · ${count}`,
  look: 'LOOK',
  lookLabel: 'Look',
  lookHint: 'Changes how HUD looks',
  menuLabel: 'Settings',
  type: 'TYPE',
  typeLabel: 'Type to Auto',
  talk: 'HOLD\nTO TALK',
  talkLabel: 'Hold to talk',
  talkHint: 'Voice comes with the voice update',
  stop: 'STOP',
  stopLabel: 'Stop',
  stopHint: 'Stops Auto’s reply',
  /** The user's words as the transcript shows them. */
  quote: (words: string) => `"${words}"`,
  youLabel: (words: string) => `You said: ${words}`,
  autoLabel: (agent: string, words: string) => `${agent}: ${words}`,
  /** The blinking cursor's text twin. */
  streamingLabel: (agent: string, words: string) => `${agent}, still answering: ${words}`,
});

/** The status row's word for Auto's state, as HUD's statuses read ('SEARCHING', 'IDLE'). */
export const HUD_STATE_WORDS = Object.freeze<Record<MascotName, string>>({
  hello: 'Hello',
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  working: 'Working',
  searching: 'Searching',
  reading: 'Reading',
  celebrate: 'Done',
  oops: 'Snag',
  sleeping: 'Asleep',
  lost: 'Lost',
  loading: 'Loading',
});

/**
 * The edge screens (US-017f, PRD-001 §4.7 Edges, Ember 06-09) in every style: First open, Not
 * running, Something went wrong and Lost. Not running names the server: the hosted one by its
 * host, a self-hosted one as Automatos asleep with the command that starts it (edges/edges.ts).
 * Something went wrong shows the API taxonomy's own words for the error, never internals. Nothing
 * here points at making an account (D63), and nothing commercial (D8).
 */
export const EDGE_COPY = Object.freeze({
  /** The line over an edge screen: Play's 'Automatos Play', HUD's 'AUTOMATOS //' (none in Studio). */
  brand: Object.freeze({
    play: Object.freeze({ name: 'Automatos', mark: 'Play', label: 'Automatos Play' }),
    hud: Object.freeze({ name: 'AUTOMATOS', mark: '//', label: 'Automatos' }),
  }),
  firstOpen: Object.freeze({
    /** Play's greeting, the second line in the accent text. */
    play: Object.freeze(['Your Automatos,', 'the fun way.'] as const),
    studio: 'Talk to Auto',
    lede: "I'm Auto. Tell me what you need and I'll get it done.",
    /** Play's starter chips (KS13): a tap fills the message box and never sends. */
    starters: Object.freeze([
      'Plan my week',
      'What needs me today?',
      'Summarise what my agents did',
    ]),
    starterHint: 'Puts this in the message box',
    /** HUD's transcript before the first message. */
    hud: 'Say or type what you need.',
  }),
  notRunning: Object.freeze({
    /** Beside the dimmed light, the state in words. */
    status: 'Not connected',
    hostedTitle: (host: string) => `${host} isn't answering.`,
    hostedMessage: 'Check your connection, then try again.',
    ownTitle: 'Automatos is asleep.',
    ownMessage: 'Start it on the computer it runs on:',
    /** Read out for the command's box. */
    command: (command: string) => `Command: ${command}`,
    checkAgain: 'Check again',
    recheck: (seconds: number) => `Automatos Go also checks every ${seconds} seconds.`,
    /** HUD's panel line after the stopped glyph: '— NOT ANSWERING'. */
    panel: 'Not answering',
  }),
  somethingWrong: Object.freeze({
    title: 'I hit a snag.',
    retry: 'Try again',
  }),
  lost: Object.freeze({
    number: '404',
    title: 'This page wandered off.',
    message: "Auto looked everywhere. It's not here.",
    back: 'Back to chat',
  }),
});
