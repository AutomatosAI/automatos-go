// The styles' copy (one strings module per feature, §4.11): the picker's names, taglines and the
// words its cards and rows say to VoiceOver. Nothing commercial (D8), and nothing that points at
// making an account (D63).

import type { MascotName } from '../core/web/lib/mascot/types';
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
