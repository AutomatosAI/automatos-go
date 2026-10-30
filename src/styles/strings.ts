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
    arcade: 'Arcade',
  }),
  taglines: Object.freeze<Record<BuiltInStyleId, string>>({
    studio: 'Cream paper or Studio Dark',
    play: 'Auto and the Ember look',
    hud: 'Voice first, glow and grid',
    arcade: 'Your agents as a party, Auto in the dialogue box',
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
  lookLinks: Object.freeze({ play: 'Make it yours', hud: 'Looks', arcade: 'Options' }),
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
 * Play's, HUD's and Arcade's looks in step with the web (US-017d, US-022c): what Play's and Arcade's
 * look pages say while the theme is not installed in the workspace (a 404 from the looks route).
 * HUD's looks stay on the phone then with no words. A failed read or save shows the API taxonomy's
 * own words.
 */
export const LOOK_SYNC_COPY = Object.freeze({
  localOnly: 'Kept on this phone only',
  playNotInstalled: 'Install Play in Studio to keep your looks in step with the web.',
  arcadeNotInstalled: "Arcade isn't installed in this workspace, so your looks stay on this phone.",
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
 * Arcade's looks (US-022c; the Options page is US-022j): the name and line 'Save look' gives a
 * saved look, as the design kit's spec.ts asNewLook writes them ('Save slot 1', 'From Overworld').
 * Each knob's label is the kit's looks/schema.json's (arcade/look-schema.ts).
 */
export const ARCADE_LOOK_COPY = Object.freeze({
  savedName: (n: number) => `Save slot ${n}`,
  savedSub: (name: string) => `From ${name}`,
});

/**
 * Arcade's Options (US-022j; the design kit's looks/look-editor.tsx, look-controls.tsx,
 * look-preview.tsx, look-transfer.tsx and spec.ts at 034fa629c): the heading and its line, each
 * choice's word as spec.ts KNOBS gives it (a palette's is the catalogue's name), what VoiceOver
 * hears for a sign ('2×'), the motion note, SAVE LOOK and RESET with what they say after, the
 * preview's sample words, the save slots and the toast after a delete. The ▶ glyph is hidden from
 * VoiceOver, which hears a choice's checked state and a slot's selected state.
 */
export const ARCADE_OPTIONS_COPY = Object.freeze({
  back: 'Back',
  heading: 'Options',
  lead: 'Saved per person, per workspace.',
  cursor: '▶',
  choices: Object.freeze({
    scanlines: Object.freeze<Record<string, string>>({ off: 'Off', soft: 'Soft', strong: 'Strong' }),
    pixelScale: Object.freeze<Record<string, string>>({ '2': '2×', '3': '3×' }),
    windowStyle: Object.freeze<Record<string, string>>({ classic: 'Classic double', thin: 'Thin' }),
    textSpeed: Object.freeze<Record<string, string>>({
      instant: 'Instant',
      normal: 'Normal',
      slow: 'Slow',
    }),
  }),
  spoken: Object.freeze<Record<string, string>>({ '2×': '2 times', '3×': '3 times' }),
  motionNote:
    'Under reduced motion, text speed is instant and sprites hold their first frame, whatever is chosen here.',
  saveLook: 'Save look',
  reset: 'Reset',
  resetHint: "Back to the palette's preset",
  saved: (name: string) => `Saved ${name}.`,
  backTo: (name: string) => `Back to ${name}.`,
  slots: 'Save slots',
  /** VoiceOver's name for a slot: 'Overworld, Night forest, grass-green accent, selected'. */
  slot: (name: string, sub: string, selected: boolean) =>
    [name, sub, selected ? 'selected' : ''].filter((part) => part !== '').join(', '),
  slotHint: 'Touch and hold to rename or delete',
  preview: Object.freeze({
    title: (name: string) => `Preview · ${name}`,
    line: 'Text types out at this speed. Press on, hero.',
    gameColours: Object.freeze({ hp: 'HP', xp: 'XP', mp: 'Mana', qs: '! Quest' }),
    selectedItem: 'Selected menu item',
    menuItem: 'Menu item',
    accentLine: 'Accent text on the page ground reads here.',
    cursor: '▼',
  }),
  /** The toast after a delete: '… Arcade is back to Overworld.' when the look deleted was on. */
  deleted: (name: string, backTo: string | null) =>
    backTo === null ? `Deleted ${name}.` : `Deleted ${name}. Arcade is back to ${backTo}.`,
});

/**
 * Arcade's pause control (US-022e, WCAG 2.2.2; the kit's motion/pause-toggle.tsx): the word it
 * shows, in the design's capitals, and what VoiceOver hears, the action a tap takes.
 */
export const ARCADE_PAUSE_COPY = Object.freeze({
  pause: 'PAUSE',
  play: 'PLAY',
  pauseLabel: 'Pause the animation',
  playLabel: 'Play the animation',
});

/**
 * Arcade's handheld (US-022f; the design kit's frame/{controls,status-bar,today}.tsx and
 * chat/dialogue.tsx): the status bar's wordmark and today's counters, each a game word and a
 * number on screen and words for VoiceOver ('3 done today'); the D-pad's four targets with what
 * each opens (D-ARC-6); the voice surround's word; the dialogue window's tab, Skip, the thinking
 * dots and the ▼ cursor, the design's dialogue cursor. Glyphs on screen are hidden from VoiceOver.
 */
export const ARCADE_COPY = Object.freeze({
  brand: 'AUTOMATOS',
  brandLabel: 'Automatos',
  counters: Object.freeze({
    xp: Object.freeze({ game: 'XP', words: (n: number) => `${n} done today` }),
    needs: Object.freeze({
      game: '!',
      words: (n: number) => (n === 1 ? '1 needs you' : `${n} need you`),
    }),
    quest: Object.freeze({ game: 'QUEST', words: (n: number) => `${n} in progress` }),
  }),
  dpad: Object.freeze({
    quests: Object.freeze({ arrow: '▲', word: 'Quests', hint: 'Shows your quests on the map' }),
    chat: Object.freeze({ arrow: '◀', word: 'Chat', hint: "Auto's chat" }),
    inventory: Object.freeze({
      arrow: '▶',
      word: 'Inventory',
      hint: 'Shows your Deliverables as items',
    }),
    menu: Object.freeze({ arrow: '▼', word: 'Menu', hint: 'Opens the menu' }),
  }),
  voice: 'VOICE',
  dialogue: Object.freeze({
    speaker: 'AUTO',
    /** Under the portrait, for VoiceOver: 'Auto: thinking'. */
    stateLabel: (state: string) => `Auto: ${state.toLowerCase()}`,
    thinking: '…',
    thinkingLabel: 'Auto is thinking',
    cursor: '▼',
    skip: 'Skip',
    skipHint: "Shows Auto's whole reply",
  }),
});

/**
 * Arcade's dress on the shared screens (US-022h): the menus' ▶ cursor beside the page on screen
 * (the Command Centre's title; hidden from VoiceOver, which hears the page's own name).
 */
export const ARCADE_DRESS_COPY = Object.freeze({ cursor: '▶' });

/**
 * Arcade's home (US-022g; the design kit's chat/{story,entries,cards,saying}.ts(x)): the story
 * window's title and its speakers (YOU, AUTO: the label face sets them in capitals, VoiceOver hears
 * the words), the ★ and ✕ marks of what a turn did (hidden from VoiceOver: each line says its
 * words), the ITEM RECEIVED window and its OPEN, the headings over A2's own cards, what the
 * dialogue says before any reply, and TYPE and STOP under it.
 */
export const ARCADE_HOME_COPY = Object.freeze({
  story: 'Story',
  storyLabel: 'Story so far',
  you: 'You',
  auto: 'Auto',
  event: '★',
  failed: '✕',
  itemReceived: 'Item received!',
  itemMeta: (kind: string) => `${kind} · made in this chat`,
  itemLabel: (title: string, kind: string) => `Item received: ${title}, ${kind}`,
  open: 'Open',
  openHint: 'Opens the Deliverable',
  choiceAwaits: '! A choice awaits',
  choiceMade: 'A choice was made',
  looseChoices: 'Choices still open',
  greeting: "Hi, I'm Auto. Tell me what you need, and I'll get the party moving.",
  yourMove: 'Your move.',
  type: 'Type',
  typeHint: 'Opens the message box',
  stop: 'Stop',
  stopHint: 'Stops Auto’s reply',
  /** The day's brief (US-G06): a story window's title ('★ Today's brief') and OPEN BRIEF. */
  brief: Object.freeze({
    today: 'Today’s brief',
    dated: (date: string) => `Brief · ${date}`,
    label: (title: string, greeting: string) => (greeting ? `${title}: ${greeting}` : title),
    open: 'Open brief',
    openHint: 'Shows the whole brief',
  }),
  /** Auto's newest suggestion (US-G01): '▶ NEXT'; START and HIDE are SUGGESTION_COPY's. */
  next: Object.freeze({ word: 'Next', label: (title: string) => `Next: ${title}` }),
});

/**
 * The party strip under Arcade's status bar (US-022l; the kit's chat/party-rows.ts STATE_WORDS and
 * the 'Phone 390' PARTY row): each state a glyph and a word, the label face drawing both in
 * capitals; VoiceOver hears each agent's name and state.
 */
export const ARCADE_PARTY_COPY = Object.freeze({
  title: 'Party',
  states: Object.freeze({
    needs: Object.freeze({ glyph: '!', word: 'Needs you' }),
    working: Object.freeze({ glyph: '●', word: 'Working' }),
    ready: Object.freeze({ glyph: '—', word: 'Ready' }),
  }),
  memberLabel: (name: string, word: string) => `${name}, ${word.toLowerCase()}`,
});

/**
 * Arcade's Quests on the handheld (US-022m; the kit's quests/{quests,map-view,quest-window,
 * quests-page}.ts(x)): the map window's label and count, each region's name and its state (a glyph
 * and a word, never the colour alone), a quest's state words, the quest window's OPEN and BOARD,
 * and the map's loading, failed and quiet lines. VoiceOver hears 'Compare three laptops, in
 * progress' for a marker.
 */
export const ARCADE_QUESTS_COPY = Object.freeze({
  worldMap: 'World map',
  count: (shown: number, total: number) =>
    shown < total ? `${shown} of ${total} quests` : `${total} ${total === 1 ? 'quest' : 'quests'}`,
  regions: Object.freeze({
    active: Object.freeze({ name: 'Greenwood', glyph: '◆', word: 'Active' }),
    needs: Object.freeze({ name: 'Storm Peaks', glyph: '!', word: 'Needs you' }),
    done: Object.freeze({ name: 'Hearth Village', glyph: '✓', word: 'Done' }),
  }),
  regionLabel: (name: string, word: string) => `${name}: ${word.toLowerCase()}`,
  glyphs: Object.freeze({ active: '◆', needs: '!', failed: '✕', done: '✓', closed: '—' }),
  needsYou: 'Needs you',
  failed: 'Failed',
  markerLabel: (title: string, word: string) => `${title}, ${word.toLowerCase()}`,
  markerHint: 'Shows this quest under the map',
  quest: 'Quest',
  statusLabel: (word: string, region: string) => `${word}, ${region}`,
  open: 'Open',
  openHint: 'Opens the ticket',
  board: 'Board',
  boardHint: 'Opens the whole Board',
  loading: 'Unfolding the map…',
  loadFailed: "Couldn't load the map.",
  retry: 'Try again',
  quietTitle: 'The map is quiet.',
  quietLine: 'Start a quest from the chat.',
  goToChat: 'Go to chat',
  goToChatHint: "Shows Auto's chat",
});

/** Arcade's Inventory on the handheld (US-022n; the kit's deliverables/{inventory.ts,bag.tsx}). */
export const ARCADE_INVENTORY_COPY = Object.freeze({
  tabs: Object.freeze({ all: 'All', reports: 'Reports', documents: 'Documents', images: 'Images' }),
  tabsLabel: 'Inventory filters',
  bag: 'Inventory',
  count: (n: number) => `${n} ${n === 1 ? 'item' : 'items'} · newest first`,
  post: 'Post',
  today: 'Today',
  yesterday: 'Yesterday',
  slotHint: 'Names this item under the bag',
  emptyInfo: 'Nothing in the bag yet.',
  open: 'Open',
  openHint: 'Opens this Deliverable',
  more: 'More',
  moreHint: 'Loads older items',
  all: 'All Deliverables',
  allHint: 'Opens the Deliverables page',
  loading: 'Opening your bag…',
  loadFailed: "Couldn't open your bag.",
  retry: 'Try again',
  emptyTitle: 'Your bag is empty.',
  emptyLine: 'Ask Auto for something and it lands here.',
  goToChat: 'Go to chat',
  goToChatHint: "Shows Auto's chat",
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
  /** PRD-268 §6.11.1: a finished piece not yet looked at (HUD's short word; STATE_WORDS' long one). */
  ready: 'Ready',
  /** PRD-268 §6.11.3: a readiness item a person must set up, or one that couldn't be checked. */
  needs_setup: 'Needs setup',
  not_checked: 'Not checked',
  approved: 'Approved',
  error: 'Error',
  paused: 'Paused',
  idle: 'Idle',
  offline: 'Offline',
  running: 'Running',
});

/**
 * PRD-268 §6.11.1's states in Studio, an installed theme and Play: the server computes the state,
 * the app draws its glyph and this word (dress/status-glyphs.ts stateGlyph). HUD says its own
 * shorter words in capitals (READY, FAILED: STATUS_WORDS and the board's). A Brand Kit may relabel
 * a word; the glyph and the colour role stay.
 */
export const STATE_WORDS = Object.freeze({
  needs_you: 'Needs you',
  working: 'Working',
  ready: 'Ready to look at',
  done: 'Done',
  failed: "Couldn't finish",
  needs_setup: 'Needs setup',
  not_checked: 'Not checked',
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
  /**
   * The line over an edge screen: Play's 'Automatos Play', HUD's 'AUTOMATOS //', Arcade's
   * 'AUTOMATOS ARCADE' (the design kit's wordmark; none in Studio).
   */
  brand: Object.freeze({
    play: Object.freeze({ name: 'Automatos', mark: 'Play', label: 'Automatos Play' }),
    hud: Object.freeze({ name: 'AUTOMATOS', mark: '//', label: 'Automatos' }),
    arcade: Object.freeze({ name: 'AUTOMATOS', mark: 'ARCADE', label: 'Automatos Arcade' }),
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
  /**
   * Arcade's own lines (US-022i): First open's greeting, the one its dialogue says before any
   * reply (the design kit's chat/saying.ts), and Lost's, the kit's edges/not-found.tsx.
   */
  arcade: Object.freeze({
    greeting: ARCADE_HOME_COPY.greeting,
    lostTitle: 'You wandered off the map',
    lostMessage: "This page isn't here. The link may be old, or the page may have moved.",
  }),
});
