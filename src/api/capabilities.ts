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
