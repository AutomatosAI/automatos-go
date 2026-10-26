// The notice under the core when a permission blocks hold to talk or Live (US-019c), in the words of
// permissionNotice (permission-flow.ts): 'settings' says which permission is off and offers Open
// Settings; 'restricted' (Screen Time) offers nothing the app can do. Any other step draws nothing.
// Tokens only; the words are the type scale (nothing under 11 pt) and the button at least 44 pt.
// Announced as an alert: it appears after a press.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Text } from '../../ui';
import { MIN_TOUCH } from '../../ui/paint';
import { PERMISSION_COPY } from '../strings';
import { permissionNotice, type PermissionVerdict } from './permission-flow';
import { permissions } from './permissions';

const TEXT_LEVEL = 4;

export type PermissionNoticeProps = {
  readonly verdict: PermissionVerdict;
};

export function PermissionNotice({ verdict }: PermissionNoticeProps) {
  const { spacing } = useTokens();
  const notice = permissionNotice(verdict);
  if (notice === null) return null;
  return (
    <View style={[styles.notice, { gap: spacing.space3 }]}>
      <Text
        level={TEXT_LEVEL}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={styles.text}
      >
        {notice.text}
      </Text>
      {notice.openSettings ? (
        <Button
          label={PERMISSION_COPY.openSettings}
          onPress={permissions.openSettings}
          minHeight={MIN_TOUCH}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { alignItems: 'center' },
  text: { textAlign: 'center' },
});
