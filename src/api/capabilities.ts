// Feature gates over the discovery document (PRD-001 §4.4, D-CAPABILITIES): a feature shows only
// when the server lists its capability, never because of a server version, so an older self-hosted
// install degrades feature by feature. Before discovery has loaded every gate is closed.

import type { Capability, Discovery } from './discovery';

/** What the gates read; null or undefined while the document is still loading. */
export type GateInput = Pick<Discovery, 'capabilities' | 'push'> | null | undefined;

function has(discovery: GateInput, capability: Capability): boolean {
  return discovery?.capabilities.includes(capability) ?? false;
}

/**
 * Push settings and registration. The app receives push only through Expo, so the server must
 * also send through Expo (push.expo: SaaS always, a local install once its operator agreed).
 */
export function canPush(discovery: GateInput): boolean {
  return has(discovery, 'push') && discovery?.push.expo === true;
}

/** Quick-ask asks for spoken-style replies; without it the reply is read as plain text. */
export function canSpokenMode(discovery: GateInput): boolean {
  return has(discovery, 'spoken_mode');
}

/** The Auto Live button. */
export function canVoiceLive(discovery: GateInput): boolean {
  return has(discovery, 'voice_live');
}

/** A workspace theme's mobile block; without it only the built-in styles are offered. */
export function canMobileTheme(discovery: GateInput): boolean {
  return has(discovery, 'mobile_theme');
}

/** "Report this" on an Auto message or a Deliverable (POST /api/v1/reports). */
export function canReportContent(discovery: GateInput): boolean {
  return has(discovery, 'report_content');
}

/** The daily digest time in the push settings. */
export function canDigest(discovery: GateInput): boolean {
  return has(discovery, 'digest');
}

/**
 * Auto's server voice: quick-ask's replies and Settings → Voice's sample spoken by the server
 * (POST /api/voice/speech). Without it the phone's own voice speaks, as before.
 */
export function canServerVoice(discovery: GateInput): boolean {
  return has(discovery, 'tts');
}

/** "Send today's brief now" under the digest time (POST /api/v1/mobile/digest/now). */
export function canDigestNow(discovery: GateInput): boolean {
  return has(discovery, 'digest_now');
}

/** PRD-268's brief (US-G06): the on-open call and the brief@1 card in the thread. */
export function canBrief(discovery: GateInput): boolean {
  return has(discovery, 'brief');
}

/** PRD-268's suggestions (US-G01): the pinned card, the header count, Start and Hide. */
export function canSuggestions(discovery: GateInput): boolean {
  return has(discovery, 'suggestions');
}

/** PRD-268's "What Auto depends on" in Settings (US-G07): GET /api/readiness and Check again. */
export function canReadiness(discovery: GateInput): boolean {
  return has(discovery, 'readiness');
}

/**
 * PRD-268 W3 (US-C24): an approval's ApprovalView@1 by its grant id, so a tap on an approval's push
 * opens the US-G08 approval sheet. Without it the tap opens what it opened before.
 */
export function canApprovalView(discovery: GateInput): boolean {
  return has(discovery, 'approval_view');
}
