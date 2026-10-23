// The AI label's rules, pure (D-AI-LABEL, D73; EU AI Act Art. 50(1)): its words, its face and its
// tone. The words are the web's own (src/core/web/lib/ai-label/copy.ts, vendored): "Auto is an AI",
// or "{agent} is an AI" while another agent answers. Since D73 (Gerard 23 Oct on build 7: "if
// required make it bloody small") it is one caption line at the scale's smallest body size (Body 6,
// 11.5 pt, above the 11 pt floor of D38) in the muted text token, which every look keeps readable on
// its background; nothing about it holds the composer.

import { UNNAMED_AGENT, aiLabelText } from '../core/web/lib/ai-label/copy';
import type { ColourName } from './tokens';
import type { TypeRole } from './type';

/** Who answers: Auto (null or undefined), or a picked agent whose name may not be loaded yet. */
export type AiLabelAgent = { readonly name?: string | null } | null | undefined;

/** "Auto is an AI", "{agent} is an AI", or "This agent is an AI" while the name is unknown. */
export function aiLabelWords(agent: AiLabelAgent): string {
  if (!agent) return aiLabelText(null);
  return aiLabelText(agent.name?.trim() || UNNAMED_AGENT);
}

/** The label's face: the scale's smallest body size (Geist 400, 11.5/17.25). */
export const AI_LABEL_TYPE: TypeRole = 'body6';

/** The label's colour: the muted text token (Studio Light about 5.5:1 on its background). */
export const AI_LABEL_TONE: ColourName = 'mutedForeground';
