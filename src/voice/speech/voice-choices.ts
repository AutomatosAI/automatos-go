// The voices Settings → Voice offers, and the one quick-ask speaks with. Pure: no React, React
// Native or Expo.
//   voiceChoices: Automatic first (pickVoice's pick, the behaviour before the setting existed), then
//   every voice voice-pick.ts's own rules let speak the phone's language (localeVoices: Apple's own
//   voices on iOS, local ones on Android; the exact locale's, else the language's), each with its
//   tier (voiceTier), the best tier first, then by name.
//   resolveVoice: the saved voice while the list still offers it (still on the phone, still for the
//   phone's language), else pickVoice's. A voice the phone dropped, or one for a language the phone
//   no longer speaks, falls back to Automatic without touching what is saved.

import type { RecognitionPlatform } from '../quick-ask/recognition-policy';
import {
  TIER_RANK,
  localeVoices,
  pickVoice,
  voiceTier,
  type SpeechVoice,
  type VoiceTier,
} from './voice-pick';

/** One voice on the list: its identifier (what expo-speech speaks with), name and tier. */
export type ListedVoice = {
  readonly kind: 'voice';
  readonly identifier: string;
  readonly name: string;
  readonly tier: VoiceTier;
};

/** A row of Settings → Voice: Automatic (pickVoice decides) or one of the phone's voices. */
export type VoiceChoice = { readonly kind: 'automatic' } | ListedVoice;

export const AUTOMATIC_VOICE: VoiceChoice = Object.freeze({ kind: 'automatic' });

function byTierThenName(a: ListedVoice, b: ListedVoice): number {
  const tier = TIER_RANK[b.tier] - TIER_RANK[a.tier];
  if (tier !== 0) return tier;
  const name = a.name.localeCompare(b.name);
  return name !== 0 ? name : a.identifier.localeCompare(b.identifier);
}

function listed(voice: SpeechVoice, platform: RecognitionPlatform): ListedVoice {
  return Object.freeze({
    kind: 'voice',
    identifier: voice.identifier,
    name: voice.name,
    tier: voiceTier(voice, platform),
  });
}

/** Automatic, then the voices for the locale: the best tier first, then by name. */
export function voiceChoices(
  voices: readonly SpeechVoice[],
  locale: string,
  platform: RecognitionPlatform,
): readonly VoiceChoice[] {
  const offered = localeVoices(voices, locale, platform)
    .map((voice) => listed(voice, platform))
    .sort(byTierThenName);
  return Object.freeze([AUTOMATIC_VOICE, ...offered]);
}

/** The saved voice while the list offers it, else pickVoice's (undefined: the engine's default). */
export function resolveVoice(
  voices: readonly SpeechVoice[],
  locale: string,
  platform: RecognitionPlatform,
  saved: string | null | undefined,
): string | undefined {
  const offered = localeVoices(voices, locale, platform);
  if (saved && offered.some((voice) => voice.identifier === saved)) return saved;
  return pickVoice(voices, locale, platform);
}
