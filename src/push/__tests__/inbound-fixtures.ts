// Shared fixtures of the inbound tests: what expo-notifications 0.32.17 hands over on iOS and on
// Android (build/Notifications.types.d.ts; Android's dataString from NotificationSerializer.java),
// built around the v2 payload of W2 K9's first case.

import { FULL } from './data-fixtures';

export const IOS_ID = 'D2B1E7A4-5C3F-4E8A-9B6D-0F1A2B3C4D5E';
export const ANDROID_ID = '0:1729760000000000%a1b2c3d4e5f6';

/** Every value recursively frozen (arrays and objects); returns the same value. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.values(value).forEach((child) => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
}

export function iosContent(data: unknown = FULL): Record<string, unknown> {
  return {
    title: 'Auto needs an answer',
    subtitle: null,
    body: 'Ship the Lisbon deck?',
    data,
    categoryIdentifier: 'automatos.question.3',
    sound: 'default',
    launchImageName: null,
    badge: 1,
    attachments: [],
    threadIdentifier: null,
  };
}

export function iosResponse(actionIdentifier: string, userText?: string): unknown {
  return {
    notification: {
      date: 1792540800.5,
      request: {
        identifier: IOS_ID,
        content: iosContent(),
        trigger: {
          type: 'push',
          payload: { aps: { category: 'automatos.question.3' }, body: FULL },
        },
      },
    },
    actionIdentifier,
    ...(userText === undefined ? {} : { userText }),
  };
}

/** Android before the JS mapping parsed it: no data, the Expo body as dataString. */
export function androidResponse(actionIdentifier: string, userText?: string): unknown {
  return {
    notification: {
      date: 1792540800500,
      request: {
        identifier: ANDROID_ID,
        content: {
          title: 'Auto needs an answer',
          subtitle: null,
          body: 'Ship the Lisbon deck?',
          dataString: JSON.stringify(FULL),
          categoryIdentifier: 'automatos.question.3',
          sound: 'default',
          priority: 'high',
          vibrationPattern: [0, 250, 250, 250],
        },
        trigger: { type: 'push', channelId: 'questions', remoteMessage: null },
      },
    },
    actionIdentifier,
    ...(userText === undefined ? {} : { userText }),
  };
}

/** A response whose request content is the given one (iOS framing). */
export function responseWithContent(content: unknown, actionIdentifier = 'open'): unknown {
  return {
    notification: { date: 1, request: { identifier: IOS_ID, content, trigger: null } },
    actionIdentifier,
  };
}
