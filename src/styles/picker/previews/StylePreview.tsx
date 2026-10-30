// A card's live preview: the style's own layout in miniature, painted by the StyleScope around
// the card. Decorative: hidden from VoiceOver and TalkBack (the card says its name and state) and
// never the target of a touch (the card's button takes it).

import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BuiltInStyleId } from '../../registry/style-id';
import { HudPreview } from './HudPreview';
import { PlayPreview } from './PlayPreview';
import { StudioPreview } from './StudioPreview';

type PreviewProps = { readonly animate: boolean };

const PREVIEWS: Readonly<Record<BuiltInStyleId, ComponentType<PreviewProps>>> = Object.freeze({
  studio: StudioPreview,
  play: PlayPreview,
  hud: HudPreview,
  arcade: StudioPreview, // ARCADE_STAND_IN US-022j
});

export function StylePreview({ id, animate }: PreviewProps & { readonly id: BuiltInStyleId }) {
  const Preview = PREVIEWS[id];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.preview}
    >
      <Preview animate={animate} />
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { pointerEvents: 'none', overflow: 'hidden' },
});
