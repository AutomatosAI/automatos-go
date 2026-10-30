// Hide's reason menu (PRD-268 §6.2.5, §6.12.3 'Hide (reason menu)'): the system's action sheet on
// iOS with Not now, Not useful and Wrong agent, and Cancel, which hides nothing. VoiceOver reads it
// as the system's own. Elsewhere (the app is iPhone only, D-PLATFORM) Hide hides with no reason.
// The choices are model.ts's.

import { ActionSheetIOS, Platform } from 'react-native';

import { HIDE_MENU, hideChoiceOf, type HideChoice } from './model';
import { SUGGESTION_COPY } from './strings';

const CANCEL_INDEX = HIDE_MENU.indexOf('cancel');

export function askHideReason(): Promise<HideChoice> {
  if (Platform.OS !== 'ios') return Promise.resolve({ hide: true, reason: null });
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: SUGGESTION_COPY.reasons.title,
        options: HIDE_MENU.map((choice) => SUGGESTION_COPY.reasons[choice]),
        cancelButtonIndex: CANCEL_INDEX,
      },
      (index) => resolve(hideChoiceOf(index)),
    );
  });
}
