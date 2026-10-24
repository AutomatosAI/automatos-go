// The push wave's calls, through the foundation's one client (D-ONE-CLIENT) with this wave's route
// table (src/push/routes.ts) and GET /api/workspaces/current from the foundation's. Every answer is
// parsed with its schema (src/push/schemas/server.ts); every failure is the client's ApiError,
// passed to the caller as is (a 409's code: deviceConflictOf). A write is sent at once and never
// queued or retried here (D-WRITES): the server's answer is the truth. A bad id throws before
// anything is sent. Nothing here logs: the bodies carry tokens, keys and the person's words.

import type { ApiClient } from '../api/client';
import { routes } from '../api/routes';
import { isTaskId, isUsableId } from '../navigation/routes';
import { PENDING_STATUS, QUESTION_KIND, ROW_ID_PATTERN, UUID_PATTERN } from './config';
import { PUSH_ROUTES } from './routes';
import {
  answerSchema,
  chatCheckSchema,
  devicesSchema,
  deviceSchema,
  pendingQuestionsSchema,
  preferencesSavedSchema,
  preferencesSchema,
  pushSettingsSchema,
  registrationSchema,
  socialPostCheckSchema,
  ticketCheckSchema,
  workspacePushSchema,
  type AnswerResult,
  type ChatCheck,
  type Device,
  type Devices,
  type PreferenceRow,
  type Preferences,
  type PreferencesSaved,
  type PushSettings,
  type Registration,
  type SocialPostCheck,
  type TicketCheck,
  type WorkspacePush,
} from './schemas/server';

/** The platforms this app registers as (W1 also takes 'web', which a phone never is). */
export type PushPlatform = 'ios' | 'android';

/** This phone as it is now (W1 RegisterDeviceRequest; the name is W2 US-009's). */
export type RegistrationInput = {
  /** The connect kit's install id: never a second one. */
  readonly installId: string;
  readonly platform: PushPlatform;
  readonly appVersion: string;
  /** A BCP 47 tag, e.g. 'en-IE'. */
  readonly locale: string;
  /** An IANA time zone name (required by W1). */
  readonly timezone: string;
  /** The phone's model name; left out when unknown or blank. */
  readonly name?: string | null;
  /** The Expo push token; left out when not given (the row's push stays as it was). */
  readonly expoPushToken?: string | null;
};

/** PATCH /devices/{device_id} takes only these three; a key left out keeps its value. */
export type DeviceChanges = {
  readonly push_enabled?: boolean;
  readonly digest_time?: string;
  readonly timezone?: string;
};

/** An answer is an offered option, or the person's own words (W1 AnswerRequest). */
export type AnswerBody = { readonly answer_text: string } | { readonly option: string };

/** The JSON body of POST /devices: the name only when known, the token only when given. */
export function registrationBody(input: RegistrationInput): Readonly<Record<string, string>> {
  const name = input.name?.trim();
  return Object.freeze({
    install_id: input.installId,
    platform: input.platform,
    app_version: input.appVersion,
    locale: input.locale,
    timezone: input.timezone,
    ...(name ? { name } : {}),
    ...(input.expoPushToken ? { expo_push_token: input.expoPushToken } : {}),
  });
}

function checked(value: string, valid: (text: string) => boolean, what: string): string {
  if (!valid(value)) throw new TypeError(`${what} is not one the server can take`);
  return value;
}

const isUuid = (value: string) => UUID_PATTERN.test(value);
const isRowId = (value: string) => ROW_ID_PATTERN.test(value);

export function registerDevice(client: ApiClient, input: RegistrationInput): Promise<Registration> {
  return client.request(PUSH_ROUTES.devices.register, {
    body: registrationBody(input),
    schema: registrationSchema,
  });
}

export function listDevices(client: ApiClient, signal?: AbortSignal): Promise<Devices> {
  return client.request(PUSH_ROUTES.devices.list, { schema: devicesSchema, signal });
}

export function updateDevice(
  client: ApiClient,
  deviceId: string,
  changes: DeviceChanges,
): Promise<Device> {
  const body = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  );
  return client.request(PUSH_ROUTES.devices.update, {
    params: { device_id: checked(deviceId, isUuid, 'A device id') },
    body,
    schema: deviceSchema,
  });
}

/**
 * Revokes this phone's own row. W1 answers the revoked row, which nothing reads: the body is
 * discarded, so a 2xx is the whole answer and a row this version cannot parse never fails it.
 */
export function revokeDevice(
  client: ApiClient,
  deviceId: string,
  signal?: AbortSignal,
): Promise<void> {
  return client.request(PUSH_ROUTES.devices.revoke, {
    params: { device_id: checked(deviceId, isUuid, 'A device id') },
    signal,
  });
}

export function getPreferences(client: ApiClient, signal?: AbortSignal): Promise<Preferences> {
  return client.request(PUSH_ROUTES.preferences.list, { schema: preferencesSchema, signal });
}

/** Replaces every row of each event the rows name (KP12): send all of an event's rows, never one. */
export function putPreferences(
  client: ApiClient,
  rows: readonly PreferenceRow[],
): Promise<PreferencesSaved> {
  return client.request(PUSH_ROUTES.preferences.replace, {
    body: { preferences: rows },
    schema: preferencesSavedSchema,
  });
}

export function putPushSettings(client: ApiClient, redact: boolean): Promise<PushSettings> {
  return client.request(PUSH_ROUTES.pushSettings, {
    body: { redact_questions: redact },
    schema: pushSettingsSchema,
  });
}

/** The role and the redact switch, from the foundation's route (src/api/routes.ts). */
export function getWorkspacePush(client: ApiClient, signal?: AbortSignal): Promise<WorkspacePush> {
  return client.request(routes.workspaceCurrent, { schema: workspacePushSchema, signal });
}

/** Exactly one of option or answer_text is sent, as given (the server trims and matches). */
export function answerQuestion(
  client: ApiClient,
  grantId: string,
  answer: AnswerBody,
): Promise<AnswerResult> {
  const body = 'option' in answer ? { option: answer.option } : { answer_text: answer.answer_text };
  return client.request(PUSH_ROUTES.questions.answer, {
    params: { grant_id: checked(grantId, isRowId, 'A question id') },
    body,
    schema: answerSchema,
  });
}

/** Marks one bell notification read; the answer ({success}) carries nothing more and is discarded. */
export function markNotificationRead(client: ApiClient, notificationId: string): Promise<void> {
  return client.request(PUSH_ROUTES.notificationRead, {
    params: { notification_id: checked(notificationId, isUuid, 'A notification id') },
  });
}

/** The ids (as the payload carries them: strings) of the workspace's open questions. */
export async function pendingQuestionIds(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<readonly string[]> {
  const answer = await client.request(PUSH_ROUTES.questions.list, {
    query: { status: PENDING_STATUS, kind: QUESTION_KIND },
    schema: pendingQuestionsSchema,
    signal,
  });
  return Object.freeze(answer.grants);
}

export function getTicket(
  client: ApiClient,
  taskId: string,
  signal?: AbortSignal,
): Promise<TicketCheck> {
  return client.request(PUSH_ROUTES.ticket, {
    params: { task_id: checked(taskId, isTaskId, 'A ticket id') },
    schema: ticketCheckSchema,
    signal,
  });
}

export function getSocialPost(
  client: ApiClient,
  postId: string,
  signal?: AbortSignal,
): Promise<SocialPostCheck> {
  return client.request(PUSH_ROUTES.socialPost, {
    params: { post_id: checked(postId, isUuid, 'A post id') },
    schema: socialPostCheckSchema,
    signal,
  });
}

export function getChat(
  client: ApiClient,
  chatId: string,
  signal?: AbortSignal,
): Promise<ChatCheck> {
  return client.request(PUSH_ROUTES.chat, {
    params: { chat_id: checked(chatId, isUsableId, 'A chat id') },
    schema: chatCheckSchema,
    signal,
  });
}
