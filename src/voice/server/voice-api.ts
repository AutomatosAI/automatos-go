// Auto's server voice over the one API client (D-ONE-CLIENT): the voices the server offers and one
// MP3 per sentence. Pure over the client: no React, React Native or Expo, and no fetch of its own
// (the bearer and X-Workspace-ID go as headers through src/api, never in a URL).
//   GET /api/voice/voices is parsed with zod: each voice on its own (one that does not parse is
//   dropped, unknown fields ignored), in the server's order (English first).
//   POST /api/voice/speech answers one MP3; anything else is a SpeechFailure of one kind: the
//   server's refusal codes (tts_off, tts_unavailable, tts_bad_request, tts_too_long, tts_busy), the
//   taxonomy's kind for any other failure, or invalid_audio for a 200 that is not audio, is empty
//   or is larger than SERVER_VOICE_MAX_BYTES (the client reads no further than that cap). The
//   caller's abort stays an AbortError. A failure carries its kind only: never the sentence, the
//   bearer or the server's words, so a log of it says nothing more.

import { z } from 'zod';

import type { ApiClient, BinaryBody } from '../../api/client';
import { isAbortError, isApiError } from '../../api/errors';
import { SERVER_SPEECH_TIMEOUT_MS, SERVER_VOICE_MAX_BYTES } from '../config';
import { VOICE_ROUTES } from '../routes';

export type ServerVoice = {
  readonly id: string;
  readonly name: string;
  /** As the server words it ('American English', or a tag such as 'en-US'); null when absent. */
  readonly accent: string | null;
  readonly gender: string | null;
};

export type ServerVoiceList = {
  /** The voice the server speaks with when none is asked for; null when it names none. */
  readonly defaultId: string | null;
  readonly voices: readonly ServerVoice[];
};

/** What one sentence is sent as (the server's own field names). */
export type SpeechAsk = {
  readonly text: string;
  readonly voice: string | null;
  readonly speed: number | null;
};

export type SpeechFailureKind =
  | 'tts_off'
  | 'tts_unavailable'
  | 'tts_bad_request'
  | 'tts_too_long'
  | 'tts_busy'
  | 'refused'
  | 'auth'
  | 'network'
  | 'invalid_audio';

/** A speech request that did not give an MP3, by kind only. */
export class SpeechFailure extends Error {
  readonly kind: SpeechFailureKind;

  constructor(kind: SpeechFailureKind) {
    super(`The server voice failed: ${kind}`);
    this.name = 'SpeechFailure';
    this.kind = kind;
  }
}

const ID_MAX = 128;
const LABEL_MAX = 80;
const label = z.string().trim().min(1).max(LABEL_MAX);
const optionalLabel = label.nullable().optional().catch(null);

const VoiceSchema = z.object({
  id: z.string().trim().min(1).max(ID_MAX),
  name: label,
  accent: optionalLabel,
  gender: optionalLabel,
});

const VoicesSchema = z.object({
  default: z.string().trim().min(1).max(ID_MAX).nullable().optional().catch(null),
  voices: z.array(z.unknown()),
});

function parseVoice(entry: unknown): readonly ServerVoice[] {
  const parsed = VoiceSchema.safeParse(entry);
  if (!parsed.success) return [];
  const { id, name, accent, gender } = parsed.data;
  return [Object.freeze({ id, name, accent: accent ?? null, gender: gender ?? null })];
}

/** The server's voices, each parsed on its own; a list that does not parse is invalid_response. */
export async function fetchServerVoices(
  client: Pick<ApiClient, 'request'>,
  signal?: AbortSignal,
): Promise<ServerVoiceList> {
  const body = await client.request(VOICE_ROUTES.voices, { schema: VoicesSchema, signal });
  return Object.freeze({
    defaultId: body.default ?? null,
    voices: Object.freeze(body.voices.flatMap(parseVoice)),
  });
}

const REFUSALS: ReadonlySet<string> = new Set<SpeechFailureKind>([
  'tts_off',
  'tts_unavailable',
  'tts_bad_request',
  'tts_too_long',
  'tts_busy',
]);

/** The kind of a failed request: the server's refusal code, else the taxonomy's kind. */
export function speechFailureKind(error: unknown): SpeechFailureKind {
  if (!isApiError(error)) return 'network';
  if (error.code && REFUSALS.has(error.code)) return error.code as SpeechFailureKind;
  if (error.kind === 'network' || error.kind === 'auth') return error.kind;
  return error.kind === 'invalid_response' ? 'invalid_audio' : 'refused';
}

const AUDIO = /^audio\//i;

/** A 200 that is audio, not empty and not too large; anything else is invalid_audio. */
function audioOf(body: BinaryBody): Uint8Array {
  const type = body.header('content-type') ?? '';
  const size = body.bytes.byteLength;
  if (!AUDIO.test(type.trim()) || size === 0 || size > SERVER_VOICE_MAX_BYTES) {
    throw new SpeechFailure('invalid_audio');
  }
  return body.bytes;
}

/** One sentence's MP3 from the server; a SpeechFailure, or the caller's AbortError. */
export async function fetchSpeech(
  client: Pick<ApiClient, 'binary'>,
  ask: SpeechAsk,
  signal: AbortSignal,
): Promise<Uint8Array> {
  let body: BinaryBody;
  try {
    body = await client.binary(VOICE_ROUTES.speech, {
      body: ask,
      signal,
      timeoutMs: SERVER_SPEECH_TIMEOUT_MS,
      maxBytes: SERVER_VOICE_MAX_BYTES,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new SpeechFailure(speechFailureKind(error));
  }
  return audioOf(body);
}
