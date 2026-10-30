// The approval sheet's copy (one strings module per feature, §4.11). Who asked, the action, its
// target, the preview and the rule sentence are the server's, in the person's language (PRD-268
// §6.11.4); these are the frames around them. The buttons keep today's words until Always allow
// ships (§12-Q17, Q28; the W2 kit's K10): 'Approve & run' with 'Deny' on a tool, 'Reject' on a
// Mission plan, exactly the thread cards' own (src/chat/strings.ts).

import { CARD_COPY, GRANT_COPY } from '../chat/strings';

export const APPROVAL_SHEET_COPY = Object.freeze({
  /** 'Auto asks' / 'SCRIBE asks'. */
  askedBy: (name: string) => `${name} asks`,
  /** The rule, read before the buttons. */
  rule: (sentence: string) => `Asking because of your rule: ${sentence}`,
  toLabel: 'To',
  /** The preview's label by the action's verb; any other verb reads the neutral one. */
  previewLabels: Object.freeze({
    send: 'What it will send',
    pay: 'What it will pay',
    sign: 'What it will sign',
    delete: 'What it will delete',
    publish: 'What it will publish',
    run: 'What it will run',
  }) as Readonly<Record<string, string>>,
  previewLabel: 'Exactly what it will do',
  allow: GRANT_COPY.approve,
  refuseTool: GRANT_COPY.deny,
  refusePlan: CARD_COPY.reject,
  /** VoiceOver's hint on Allow: Face ID comes first; Refuse needs none. */
  allowHint: 'Asks for Face ID first.',
  faceIdNote: 'Face ID to allow. Refusing needs none.',
  expiresIn: (minutes: number) =>
    minutes <= 1 ? 'Waiting · less than a minute left' : `Waiting · ${minutes} min left`,
  expired: 'This request has expired.',
  /** The thread card's way in to the sheet. */
  review: 'Review and answer',
  reviewHint: 'Opens what it will do and the rule that asked',
  /** Always allow (only where the view offers it): a link, then a confirm sheet naming the rule. */
  alwaysAllow: 'Always allow…',
  alwaysAllowTitle: 'Always allow this?',
  alwaysAllowBody: (sentence: string) =>
    `This changes your rule "${sentence}", so Auto stops asking for this. You set it in Studio.`,
  alwaysAllowOpen: 'Open in Studio',
  cancel: 'Cancel',
  /** HUD: the waiting approval's way back in once its sheet was closed. */
  hudOpen: '◆ WAITING FOR YOU · OPEN',
  hudOpenLabel: 'An approval is waiting for you. Opens it',
});
