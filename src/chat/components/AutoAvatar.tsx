// Auto in the thread (D72, Gerard 23 Oct: "auto is mascot or sail"): a 28 pt accent disc with the
// web's white sail. The sail is assets/brand/splash.png tinted white: its silhouette is the web's
// automatos-mark-white.png, so no new PNG joins the four app.json names (brand-assets.test.ts).
// Both sides of the mark are pinned and nothing is sized by aspect (image-size.test.ts: iOS let a
// bundled image's own width win before). A solid disc, not the web's gradient and glow: in Studio those
// resolve to a muddy bronze and blur at 28 pt. At the head of one of Auto's messages the disc is
// the message's header to VoiceOver ('Auto said') and carries Report this as an accessible action;
// beside the thinking pill, a notice or loose cards it is decoration and hidden. Play's mascot
// replaces this in A5 (D37).

import { Image, View, type ViewStyle } from 'react-native';

import { useTokens } from '../../styles/theme';
import type { ReportAccessibility } from '../report/report';
import { CHAT_COPY } from '../strings';
import { THREAD } from './thread-look';

const SAIL = require('../../../assets/brand/splash.png');
const NO_REPORT: ReportAccessibility = Object.freeze({});

export type AutoAvatarProps = {
  readonly role: 'header' | 'decorative';
  /** Report this, on the head of a message that offers it. */
  readonly report?: ReportAccessibility;
};

export function AutoAvatar({ role, report = NO_REPORT }: AutoAvatarProps) {
  const { radii, thread } = useTokens();
  const disc: ViewStyle = {
    width: THREAD.avatar,
    height: THREAD.avatar,
    borderRadius: radii.full,
    backgroundColor: thread.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  };
  const sail = (
    <Image
      source={SAIL}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      style={{ width: THREAD.sail.width, height: THREAD.sail.height, tintColor: thread.sail }}
    />
  );
  if (role === 'decorative') {
    return (
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={disc}
      >
        {sail}
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={CHAT_COPY.autoSaid}
      {...report}
      style={disc}
    >
      {sail}
    </View>
  );
}
