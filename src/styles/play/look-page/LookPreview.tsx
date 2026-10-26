// The look page's live preview ('Automatos Play Looks.dc.html'): the look being edited, painted
// through StyleScope so it repaints on every change whatever style the phone is on — Auto at 220
// celebrating, his ring in the look's light, 'Ta-da.' in the status slot; the user's question;
// the two done chips; his reply with his pick in the accent text; the report card with Open. To
// VoiceOver it is one picture whose label names the look; it takes no touches (the sample's Open
// opens nothing).

import { StyleSheet, View } from 'react-native';

import type { Look } from '../../../core/frozen/lib/looks/types';
import { Text } from '../../../ui';
import { MASCOT_SIZES } from '../../mascot/geometry';
import { Mascot } from '../../mascot/Mascot';
import { StyleScope } from '../../provider/StyleScope';
import { builtinChoice } from '../../registry/style-id';
import { PLAY_LOOK_COPY, PLAY_STATUS } from '../../strings';
import { UserMessage } from '../companion/Messages';
import { ReportCard } from '../companion/ReportCard';
import { ToolChip } from '../companion/ToolChip';
import { useCompanionPaint } from '../companion/use-companion';
import { LOOK_PAGE } from './knobs';
import { PREVIEW_CHIPS, PREVIEW_STATE } from './preview';

export const PLAY_CHOICE = builtinChoice('play');

const { preview } = LOOK_PAGE;
/** Auto's reply in the thread's 16/1.6, his pick in Geist 600 (the serif never goes below 19). */
const REPLY_SIZE = 16;
const PICK_WEIGHT = 600;
const OPENS_NOTHING = () => undefined;

function PreviewPanel({ name }: { readonly name: string }) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  const said = PLAY_LOOK_COPY.preview;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={said.label(name)}
      pointerEvents="none"
      style={[
        styles.panel,
        { borderColor: vars.groundLine, backgroundColor: vars.groundPanel },
      ]}
    >
      <View style={styles.auto}>
        <Mascot size={MASCOT_SIZES.lookPreview} state={PREVIEW_STATE} />
        <Text style={[style.type.display('status'), { color: vars.groundText }]}>
          {PLAY_STATUS[PREVIEW_STATE]}
        </Text>
      </View>
      <UserMessage text={said.you} />
      <View style={styles.chips}>
        {PREVIEW_CHIPS.map((chip) => (
          <ToolChip key={chip.key} chip={chip} />
        ))}
      </View>
      <Text style={[style.type.body(REPLY_SIZE), { color: vars.groundText }]}>
        {said.reply}
        <Text style={[style.type.body(REPLY_SIZE, PICK_WEIGHT), { color: vars.accentText }]}>
          {said.pick}
        </Text>
        {said.replyEnd}
      </Text>
      <ReportCard title={said.title} onOpen={OPENS_NOTHING} />
    </View>
  );
}

export type LookPreviewProps = { readonly look: Look };

export function LookPreview({ look }: LookPreviewProps) {
  return (
    <StyleScope choice={PLAY_CHOICE} look={look}>
      <PreviewPanel name={look.name} />
    </StyleScope>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: preview.radius,
    paddingHorizontal: preview.padX,
    paddingVertical: preview.padY,
    gap: preview.gap,
  },
  auto: { alignItems: 'center', gap: preview.gap },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: preview.chipGap },
});
