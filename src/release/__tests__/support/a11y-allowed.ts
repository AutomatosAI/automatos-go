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
    file: 'src/styles/edges/Lost.tsx',
    text: 'allowFontScaling: false',
    rule: 'SCALING_OFF',
    reason:
      "Lost's huge '404' (US-017f, D38): a mark behind Auto, not words to read. It is hidden from accessibility (accessibilityElementsHidden, no-hide-descendants) inside a stage of fixed height, and the screen's title and message under it say the same in Text that scales.",
  },
];
