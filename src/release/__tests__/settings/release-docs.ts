// The store-document audit's settings (release-docs.test.ts, US-021p): the ALLOWED statements of
// an age other than 16, the words the app's terms rule out of its store text, and the labels the
// review notes send a reviewer to. The audit's rules (the limits, the minimum age, the secret
// shapes) are its own (support/release-docs.ts, support/forbidden-copy.ts).

import { SIGN_IN_SCREEN_COPY } from '../../../auth/strings';
import { HOME_COPY, MENU_COPY } from '../../../chat/strings';
import { SHELL_COPY as CC_COPY } from '../../../cc/strings';
import { CONFIRM_COPY, CONNECT_SCREEN_COPY, WELCOME_COPY } from '../../../connect/strings';
import { CONSENT_SHEET_COPY } from '../../../consent/strings';
import { aiLabelText } from '../../../core/web/lib/ai-label/copy';
import { PUSH_CATEGORY_COPY, PUSH_PHONE_COPY, PUSH_SETTINGS_COPY } from '../../../push/strings';
import { SHELL_COPY } from '../../../app-state/strings';
import { PICKER_COPY } from '../../../styles/strings';
import { REPORT_COPY } from '../../../ui/strings';
import {
  AI_VOICE_GREETING,
  LANGUAGE_COPY,
  VOICE_CENTRE_COPY,
  VOICE_ENTRY_COPY,
} from '../../../voice/strings';
import { PRIVACY_COPY } from '../../strings';
import { frozen } from './types';

export type AllowedAge = Readonly<{ file: string; text: string; age: number; reason: string }>;

/** Statements of an age other than 16 that keep the rule: each exact text, where, and why. */
export const ALLOWED_AGES: readonly AllowedAge[] = frozen([
  {
    file: 'docs/release/age-rating.md',
    text: 'The live Terms at https://automatos.app/terms (v2.3, section 02) say "You must be at least 18".',
    age: 18,
    reason:
      "Quotes the live Terms' 18 to list it as Gerard's conflict with the one minimum age (D12, KR11, OT-R13). The page's own answers say 16.",
  },
  {
    file: 'docs/release/age-rating.md',
    text: 'tick only the age groups 16–17 and 18 and over',
    age: 18,
    reason:
      "Play's Target audience names its age groups so; ticking 16–17 and the group above it is how Play shows the one minimum age, 16 (D12).",
  },
  {
    file: 'docs/release/README.md',
    text: "Resolve the live Terms' minimum age of 18 against D12's 16.",
    age: 18,
    reason:
      "OT-R13's row names the live Terms' 18 as the conflict Gerard resolves (D12, KR11); the record states no age of its own but 16.",
  },
]);

/** The words of the app's terms (CLAUDE.md 'Terms') that its store text never uses. */
export const RULED_OUT_TERMS: readonly RegExp[] = Object.freeze([
  /\bartifacts?\b/i,
  /\boutputs?\b/i,
  /\brecipes?\b/i,
  /\bworkflows?\b/i,
  /\bjobs?\b/i,
  /\bthe assistant\b/i,
  /\bCommand Center\b/,
]);

/** Labels the review notes send a reviewer to: each exactly as the app shows it. */
export const REVIEW_LABELS: readonly string[] = Object.freeze([
  WELCOME_COPY.signIn,
  WELCOME_COPY.connect,
  SIGN_IN_SCREEN_COPY.usePassword,
  SIGN_IN_SCREEN_COPY.signIn,
  CONSENT_SHEET_COPY.heading,
  CONSENT_SHEET_COPY.agree,
  CONNECT_SCREEN_COPY.continue,
  CONNECT_SCREEN_COPY.scan,
  CONFIRM_COPY.title,
  CONFIRM_COPY.pair,
  SHELL_COPY.signOut,
  HOME_COPY.menu,
  MENU_COPY.newChat,
  MENU_COPY.chats,
  MENU_COPY.commandCentre,
  MENU_COPY.settings,
  ...Object.values(CC_COPY.tabs),
  aiLabelText(),
  REPORT_COPY.action,
  PRIVACY_COPY.title,
  PRIVACY_COPY.crashReports,
  PICKER_COPY.title,
  PUSH_SETTINGS_COPY.title,
  PUSH_PHONE_COPY.turnOn,
  PUSH_CATEGORY_COPY.reply,
  VOICE_ENTRY_COPY.label,
  VOICE_CENTRE_COPY.hold.talk.label,
  LANGUAGE_COPY.section,
  AI_VOICE_GREETING,
]);
