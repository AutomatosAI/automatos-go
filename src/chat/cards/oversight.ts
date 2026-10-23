// The oversight note both approval cards carry (PRD-181 S5, the web's components/widgets/
// oversight-note.tsx), pure: the tier in words (an unknown or missing one reads as the strictest),
// the risk class, and why a person is in the loop. Shown only when the card carries a tier or a
// reason, as the web shows it.

import type { MissionApprovalWidgetData } from '../../core/web/components/widgets/types';
import { OVERSIGHT_TIERS } from '../strings';

export type OversightView = { readonly title: string; readonly rationale: string | null };

/** The oversight fields the mission_approval and tool_approval cards share. */
export type OversightFields = Pick<
  MissionApprovalWidgetData,
  'risk_tier' | 'risk_class' | 'oversight_rationale'
>;

/** `words[key]` when it is the table's own entry, else null (never a prototype's). */
export function ownWord(
  words: Readonly<Record<string, string>>,
  key: string | undefined,
): string | null {
  return key !== undefined && Object.prototype.hasOwnProperty.call(words, key) ? words[key] : null;
}

/** The oversight note when the card carries a tier or a reason (the web's condition). */
export function oversightView(fields: OversightFields): OversightView | null {
  if (!fields.risk_tier && !fields.oversight_rationale) return null;
  const tier = ownWord(OVERSIGHT_TIERS, fields.risk_tier) ?? OVERSIGHT_TIERS.human_in_the_loop;
  const riskClass = fields.risk_class?.replace(/_/g, ' ').trim();
  return {
    title: riskClass ? `${tier} · ${riskClass}` : tier,
    rationale: fields.oversight_rationale?.trim() || null,
  };
}
