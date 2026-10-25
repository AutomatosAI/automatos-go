// The state chip under the core (D54, D-ONE-VOICE): what Auto is doing in words, the core's text
// twin — the vendored captionFor in capitals ('SEARCHING THE WEB') in the style's mono at 11, 500,
// tracked .16em, in the accent inside a 1 pt accent line, 5 x 12 pad. VoiceOver reads the caption
// as written, and hears it again when it changes.

import { StyleSheet, View } from 'react-native';

import type { MascotName } from '../../../core/web/lib/mascot/types';
import { Text } from '../../../ui';
import { HUD_CORE, chipView } from './model';
import { useVoiceCore } from './use-voice-core';

export type StateChipProps = {
  readonly state: MascotName;
  /** The kind of Deliverable that just landed, while Auto celebrates: 'YOUR REPORT IS READY'. */
  readonly deliverableKind?: string;
};

const { chip } = HUD_CORE;

export function StateChip({ state, deliverableKind }: StateChipProps) {
  const { paint, style } = useVoiceCore();
  const view = chipView(state, deliverableKind);
  const face = style.type.mono(HUD_CORE.monoSize, 500, { trackingEm: HUD_CORE.tracking.chip });
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={view.label}
      accessibilityLiveRegion="polite"
      style={[
        styles.chip,
        {
          paddingVertical: chip.padY,
          paddingHorizontal: chip.padX,
          borderWidth: chip.border,
          borderColor: paint.accentLine,
        },
      ]}
    >
      <Text style={[face, styles.words, { color: paint.accent }]}>{view.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'center' },
  words: { textAlign: 'center' },
});
