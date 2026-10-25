// The Android notification channels (PRD-001 §4.8, KP20 = W2 K9): the ids are W2's channel_id
// values (services/push/payload.py CHANNEL_BY_TYPE: needs_answer → questions, review → review,
// auto_message → auto). Each hides its text on a locked screen (PRIVATE, D20) and may badge the
// icon. A channel must exist before Android 13 shows the permission prompt, so setup.ts registers
// these first. Pure data: the importance and visibility are names the port maps to the module's
// numbers.

import { PUSH_CHANNEL_COPY } from '../strings';
import type { AndroidImportanceName, AndroidVisibilityName } from './port';

export type PushChannel = Readonly<{
  id: string;
  name: string;
  importance: AndroidImportanceName;
  lockscreenVisibility: AndroidVisibilityName;
  showBadge: true;
}>;

export const PUSH_CHANNELS: readonly PushChannel[] = Object.freeze([
  Object.freeze({
    id: 'questions',
    name: PUSH_CHANNEL_COPY.questions,
    importance: 'HIGH',
    lockscreenVisibility: 'PRIVATE',
    showBadge: true,
  }),
  Object.freeze({
    id: 'review',
    name: PUSH_CHANNEL_COPY.review,
    importance: 'DEFAULT',
    lockscreenVisibility: 'PRIVATE',
    showBadge: true,
  }),
  Object.freeze({
    id: 'auto',
    name: PUSH_CHANNEL_COPY.auto,
    importance: 'DEFAULT',
    lockscreenVisibility: 'PRIVATE',
    showBadge: true,
  }),
]);
