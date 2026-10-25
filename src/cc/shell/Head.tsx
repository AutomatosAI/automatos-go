// The Command Centre's head (handoff §2): the dateline eyebrow in the phone's timezone, the title and
// the lede, its figures in mono and the needs clause in the accent. The words are lede.ts's and
// dateline.ts's; nothing shows for a source that has not answered. A5 dresses the title per style
// (src/styles/dress/cc-dress.ts): Play's display face, HUD's 'AUTOMATOS // COMMAND'.

import { View } from 'react-native';

import { useShellTitle } from '../../styles/dress/use-cc-dress';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { SHELL_COPY } from '../strings';
import { HEAD, ledeFigureFace } from './chrome';
import { ledeText, type LedePart } from './lede';
import { useEyebrow } from './use-shell';

function LedeRun({ part }: { readonly part: LedePart }) {
  const { type } = useTokens();
  if (!part.figure && !part.needs) return part.text;
  return (
    <Text
      level={HEAD.ledeLevel}
      tone={part.needs ? HEAD.needsTone : HEAD.figureTone}
      style={part.figure ? ledeFigureFace(type) : undefined}
    >
      {part.text}
    </Text>
  );
}

/** The title in the style's face; HUD's mark run in its accent. */
function Title() {
  const { colours } = useTokens();
  const title = useShellTitle(SHELL_COPY.title);
  return (
    <Text
      variant="title"
      level={HEAD.titleLevel}
      accessibilityRole="header"
      accessibilityLabel={title.accessibilityLabel}
      style={title.face}
    >
      {title.runs.map((run) =>
        run.accent ? (
          <Text key={run.text} style={[title.face, { color: colours.primary }]}>
            {run.text}
          </Text>
        ) : (
          run.text
        ),
      )}
    </Text>
  );
}

export function Head({ lede }: { readonly lede: readonly LedePart[] }) {
  const { spacing } = useTokens();
  const eyebrow = useEyebrow();
  return (
    <View
      style={{
        gap: spacing[HEAD.gap],
        paddingHorizontal: spacing[HEAD.paddingX],
        paddingTop: spacing[HEAD.paddingTop],
        paddingBottom: spacing[HEAD.paddingBottom],
      }}
    >
      <Text variant="eyebrow">{eyebrow}</Text>
      <Title />
      {lede.length > 0 ? (
        <Text
          level={HEAD.ledeLevel}
          tone={HEAD.ledeTone}
          accessibilityLabel={ledeText(lede)}
          accessibilityLiveRegion="polite"
        >
          {lede.map((part, index) => (
            // the runs are positional: the same sentence, in the same order, every render
            <LedeRun key={index} part={part} />
          ))}
        </Text>
      ) : null}
    </View>
  );
}
