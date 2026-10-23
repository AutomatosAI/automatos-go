// A code block in Auto's answer (OT-C8): the look's mono face at Body 4 on the secondary ground,
// its language named in the mono label above it, the lines kept as written and scrolled sideways
// when wider than the thread, wrapped only past CODE_BLOCK_MAX_WIDTH (a wider text draws blank on
// iOS). Selectable, as the thread's words are.

import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import type { ReportAccessibility } from '../report/report';
import type { CodeBlock } from './blocks';
import { CODE_BLOCK_MAX_WIDTH, CODE_BLOCK_ROLE, monoFace } from './look';

export type CodeBlockViewProps = {
  readonly block: CodeBlock;
  readonly report: ReportAccessibility;
};

export function CodeBlockView({ block, report }: CodeBlockViewProps) {
  const { colours, radii, spacing, type } = useTokens();
  const face = useMemo(
    () => ({ ...monoFace(type, CODE_BLOCK_ROLE), maxWidth: CODE_BLOCK_MAX_WIDTH }),
    [type],
  );
  const inset = { paddingHorizontal: spacing.space5 };
  return (
    <View
      style={{
        backgroundColor: colours.secondary,
        borderRadius: radii.control,
        paddingVertical: spacing.space4,
        gap: spacing.space2,
      }}
    >
      {block.lang ? (
        <Text variant="mono" tone="muted" style={inset}>
          {block.lang}
        </Text>
      ) : null}
      <ScrollView horizontal contentContainerStyle={inset}>
        <Text selectable style={face} {...report}>
          {block.text}
        </Text>
      </ScrollView>
    </View>
  );
}
