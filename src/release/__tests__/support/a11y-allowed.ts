// The accessibility audit's true negatives (a11y-audit.test.ts, R17), each an exact file and place,
// reviewed, with its reason: an icon-only pressable that is not the IconButton primitive, and the
// one text that does not grow with Dynamic Type. A new one fails the audit until it is moved to the
// primitive (or scales) or is listed here with a reason. A listed one that is gone fails it too.

export type A11yRule = 'ICON_ONLY' | 'SCALING_OFF';

export type AllowedA11y = Readonly<{
  file: string;
  /** ICON_ONLY: placeOf's 'Tag in Component'; SCALING_OFF: '<setting>: <value>'. */
  text: string;
  rule: A11yRule;
  reason: string;
}>;

/** D38's floor: no text under 11 pt (src/styles/type.ts MIN_TEXT_SIZE). */
export const MIN_TEXT_POINTS = 11;

/** The least cap on Dynamic Type the audit accepts, with a one-line reason above it. */
export const LEAST_FONT_SCALE_CAP = 2;

/** The primitive every icon-only button goes through: its accessibilityLabel is required. */
export const ICON_BUTTON_FILE = 'src/ui/IconButton.tsx';

export const ALLOWED: readonly AllowedA11y[] = [
  {
    file: 'src/chat/home/MenuButton.tsx',
    text: 'Pressable in MenuButton',
    rule: 'ICON_ONLY',
    reason:
      "The header's menu (D73): lucide's menu with the orange CountBadge BESIDE it while something needs you (D26), in a box that grows to hold the badge. IconButton is a fixed square with no badge slot. Its label is required by menuButtonView's type and carries the count ('Menu, 13 need you').",
  },
  {
    file: 'src/styles/hud/core/HudTopBar.tsx',
    text: 'RowButton in CommandRow',
    rule: 'ICON_ONLY',
    reason:
      "HUD's command row (KS10, D38): the menu square is the same RowButton as LOOK beside it, 34 high in the 1 pt accent lines the row is drawn in, with a 44 pt hit area. IconButton's HUD dress is a different box. RowButton's label prop is required by its type and becomes the accessibilityLabel ('Settings'; 'Close voice' on the voice screen).",
  },
  {
    file: 'src/styles/play/companion/PlayComposer.tsx',
    text: 'Pressable in ComposerButton',
    rule: 'ICON_ONLY',
    reason:
      "Play's Send / Stop (US-017c; Ember 01-02, 06): one 42 pt circle in Play's own paint (composerButtonPaint: the ground's text with the ground as ink, the accent on First open) holding lucide's arrow up for Send or Play's 10 x 10 radius-2 square for Stop. IconButton takes a lucide icon only and paints from the dress's variants, so it can draw neither the square nor that paint. Its accessibilityLabel is composerView's label ('Send' / 'Stop', with Stop's hint), always set.",
  },
  {
    file: 'src/styles/play/companion/PlayConversations.tsx',
    text: 'Pressable in InboxChip',
    rule: 'ICON_ONLY',
    reason:
      "Play's way to the notifications inbox (D73: Play has no header menu): lucide's bell in Play's own round chip (the avatar chip's ground paint beside it, KS10) with the CountBadge BESIDE it while something is unread, in a chip that grows to hold the badge. IconButton is a fixed square with no badge slot and paints from the dress, not Play's ground. Its label is inboxButtonLabel's, always set, and carries the count ('Notifications, 3 unread').",
  },
  {
    file: 'src/styles/edges/Lost.tsx',
    text: 'allowFontScaling: false',
    rule: 'SCALING_OFF',
    reason:
      "Lost's huge '404' (US-017f, D38): a mark behind Auto, not words to read. It is hidden from accessibility (accessibilityElementsHidden, no-hide-descendants) inside a stage of fixed height, and the screen's title and message under it say the same in Text that scales.",
  },
];
