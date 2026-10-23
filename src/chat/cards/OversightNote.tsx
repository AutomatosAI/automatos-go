// The oversight note on an approval card (PRD-181 S5, components/widgets/oversight-note.tsx): the
// tier and risk class on the warning tint, then why a person is in the loop. One element to screen
// readers, read as its name and its words.

import { View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { joinLabel } from '../../ui/paint';
import { tonePaint } from '../../ui/variants';
import { CARD_COPY } from '../strings';
import type { OversightView } from './oversight';

const NOTE_LEVEL = 6;

export function OversightNote({ view }: { readonly view: OversightView }) {
  const { colours, radii, spacing } = useTokens();
  const { backgroundColor, color } = tonePaint(colours, 'warning');
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={joinLabel(CARD_COPY.oversight, view.title, view.rationale)}
      style={{
        backgroundColor,
        borderRadius: radii.control,
        padding: spacing.space4,
        marginHorizontal: spacing.space6,
        marginBottom: spacing.space4,
        gap: spacing.space1,
      }}
    >
      <Text level={NOTE_LEVEL} weight={600} style={{ color }}>
        {view.title}
      </Text>
      {view.rationale ? (
        <Text level={NOTE_LEVEL} tone="muted">
          {view.rationale}
        </Text>
      ) : null}
    </View>
  );
}
