// The server's own words (PRD-001 §4.5): a refusal from Clerk or from Automatos at sign-in is shown
// as its sender wrote it, never rewritten. For the sign-in screens and the first authenticated call
// (the workspace bootstrap); every other screen shows the taxonomy's copy (api/errors.ts).
//
// Clerk: the user-facing words are a ClerkAPIError's longMessage (the FAPI's long_message); an
// error's `message` is for developers and is never shown (@clerk/shared errors/clerkError.d.ts). A
// ClerkAPIResponseError carries them in errors[]; a single ClerkAPIError or ClerkError on itself.
// Clerk's own waitlist refuses sign-ups only (sign_up_restricted_waitlist), so on sign-in it reaches
// the app the same way, as Clerk's words.
//
// Automatos: a 409 says why the signed-in user cannot carry on: the pending invitation
// {"detail": {"code": "pending_invitation", "message", …}} (core/auth/hybrid.py:855-862) or the
// unlinked account {"detail": "This sign-in matches an existing account that is not linked to it.
// …"} (core/auth/user_link.py:33-36, 59-61); both reach ApiError.serverMessage (errors.ts detailOf).
// A 403 with words is shown the same way, except the paused workspace, which has its D8 copy.

import { z } from 'zod';

import { SERVER_MESSAGE_MAX_CHARS } from '../api/config';
import { isApiError, userMessage, type ApiError } from '../api/errors';
import { API_ERROR_COPY, WORKSPACE_COPY } from '../api/strings';
import { isWorkspacePaused } from '../api/workspace';

const WordsSchema = z.object({ longMessage: z.string().trim().min(1) });
const EntriesSchema = z.object({ errors: z.array(z.unknown()) });
const CodeSchema = z.object({ code: z.string() });

/** Clerk's codes for "Clerk could not be reached": the network copy, as for any call. */
const CLERK_OFFLINE_CODES: ReadonlySet<string> = new Set(['network_error', 'clerk_offline']);

function clip(text: string): string {
  return text.length > SERVER_MESSAGE_MAX_CHARS ? text.slice(0, SERVER_MESSAGE_MAX_CHARS) : text;
}

function longMessageOf(value: unknown): string | undefined {
  const parsed = WordsSchema.safeParse(value);
  return parsed.success ? parsed.data.longMessage : undefined;
}

/** The first longMessage Clerk sent: in errors[] (the FAPI's answer), else on the error itself. */
export function clerkWords(error: unknown): string | undefined {
  const entries = EntriesSchema.safeParse(error);
  const listed = entries.success ? entries.data.errors.map(longMessageOf).find(Boolean) : undefined;
  const words = listed ?? longMessageOf(error);
  return words === undefined ? undefined : clip(words);
}

/** The code of a Clerk error (a ClerkError, or the first entry of a ClerkAPIResponseError). */
export function clerkCode(error: unknown): string | undefined {
  const entries = EntriesSchema.safeParse(error);
  const first = entries.success ? CodeSchema.safeParse(entries.data.errors[0]) : undefined;
  if (first?.success) return first.data.code;
  const own = CodeSchema.safeParse(error);
  return own.success ? own.data.code : undefined;
}

const REFUSAL_KINDS: ReadonlySet<ApiError['kind']> = new Set<ApiError['kind']>([
  'conflict',
  'forbidden',
]);

function automatosWords(error: ApiError): string {
  // the paused workspace's own 403 words name an administrator; D8 has the app's words for it
  if (isWorkspacePaused(error)) return WORKSPACE_COPY.paused;
  if (REFUSAL_KINDS.has(error.kind) && error.serverMessage) return error.serverMessage;
  return userMessage(error);
}

/**
 * What to show for a failed sign-in step or a refused first call. An Automatos error: a 409 or 403
 * in the server's words, otherwise its taxonomy copy. A Clerk error: its longMessage; offline: the
 * network copy. Any other shape: the taxonomy's copy.
 */
export function serverWords(error: unknown): string {
  if (isApiError(error)) return automatosWords(error);
  const words = clerkWords(error);
  if (words) return words;
  const code = clerkCode(error);
  if (code && CLERK_OFFLINE_CODES.has(code)) return API_ERROR_COPY.network;
  return userMessage(error);
}
