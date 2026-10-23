// The unencrypted home network in one line (D-HTTPS, US-006h): 'Unencrypted home network · {host}'
// while the server is http://, nothing over https. In words beside its icon, not only a colour;
// tokens only. 'top' is the signed-in shell's bar: app/(app)/_layout.tsx hands it to the gate
// (src/app-state/AppGate.tsx), which draws it once above every state it shows a signed-in phone
// (its own states, the consent sheet, the screens); it takes the top safe area itself and what is
// under it starts below it, so it never covers a screen's own header. 'inline' is the same line
// inside a card (Account's server section, the confirm card).

import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { insecureNetworkLine } from '../edges';

const LINE_LEVEL = 5;
const ICON_SIZE = 14;

export type InsecureNetworkBannerProps = {
  /** The server's origin: the line shows only while it is http://. */
  readonly origin: string;
  readonly placement?: 'top' | 'inline';
};

export function InsecureNetworkBanner({
  origin,
  placement = 'inline',
}: InsecureNetworkBannerProps) {
  const { colours, spacing } = useTokens();
  const insets = useSafeAreaInsets();
  const line = insecureNetworkLine(origin);
  if (line === null) return null;
  const bar =
    placement === 'top'
      ? {
          paddingTop: insets.top + spacing.space2,
          paddingHorizontal: spacing.space5,
          backgroundColor: colours.background,
          borderBottomColor: colours.border,
        }
      : null;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={line}
      style={[
        styles.row,
        { gap: spacing.space2, paddingVertical: spacing.space2 },
        bar && [styles.bar, bar],
      ]}
    >
      <View importantForAccessibility="no-hide-descendants">
        <ShieldAlert size={ICON_SIZE} color={colours.warnInk} />
      </View>
      <Text level={LINE_LEVEL} tone="warning" style={styles.line}>
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexShrink: 1 },
});
