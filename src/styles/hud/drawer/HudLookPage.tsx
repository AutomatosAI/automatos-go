// Settings → Style and look → HUD's look (US-018c): the Looks drawer over HUD's ground — the Screen
// primitive's HUD glow, grid and scanlines and its status bar — all of it HUD in the active look
// through StyleScope, whatever style the phone is on, so every change repaints the ground behind
// the drawer at once. Close goes back to the picker.

import { StyleSheet, View } from 'react-native';

import { useGoBack } from '../../../navigation/use-go-back';
import { Screen } from '../../../ui';
import { STYLE_SCREENS } from '../../nav';
import { useStyleStore } from '../../provider/context';
import { StyleScope } from '../../provider/StyleScope';
import { builtinChoice } from '../../registry/style-id';
import { LooksDrawer } from '../LooksDrawer';

export const HUD_CHOICE = builtinChoice('hud');

const NO_EDGES = Object.freeze([] as const);

export function HudLookPage() {
  const look = useStyleStore((state) => state.hudLooks.active);
  const goBack = useGoBack(STYLE_SCREENS.settingsStyle);
  return (
    <StyleScope choice={HUD_CHOICE} look={look}>
      <View style={styles.page}>
        <Screen edges={NO_EDGES}>{null}</Screen>
        <LooksDrawer onClose={goBack} />
      </View>
    </StyleScope>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
});
