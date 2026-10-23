// The AI label (D-AI-LABEL, D73; EU AI Act Art. 50(1)): one muted caption line, "Auto is an AI", or
// "{agent} is an AI" while another agent answers. It opens every thread (MessageList's first row,
// scrolling away with it) and the AI-provider consent sheet; Auto's avatar also says it to
// VoiceOver. Its face and tone are ai-label-state.ts's, read from the tokens like any other text,
// with Dynamic Type on. It never holds the composer.

import { Text } from 'react-native';

import { AI_LABEL_TONE, AI_LABEL_TYPE, aiLabelWords, type AiLabelAgent } from './ai-label-state';
import { useTokens } from './theme';
import { TEXT_SCALING } from './type';

export type AiLabelProps = {
  /** Who answers: Auto when omitted or null; a picked agent by name (unknown name: "This agent"). */
  readonly agent?: AiLabelAgent;
};

export function AiLabel({ agent }: AiLabelProps) {
  const { colours, type } = useTokens();
  const words = aiLabelWords(agent);
  return (
    <Text
      {...TEXT_SCALING}
      accessibilityRole="text"
      accessibilityLabel={words}
      style={[type[AI_LABEL_TYPE], { color: colours[AI_LABEL_TONE] }]}
    >
      {words}
    </Text>
  );
}
