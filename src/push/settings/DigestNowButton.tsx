// "Send today's brief now" under the digest time (shown only with digest_now): the shared Button,
// so Studio, Play and HUD each dress it; busy while the POST is out, dimmed through the 5-minute
// wait after a 202 with the minutes left in its VoiceOver label, and one plain line under it (the
// wait, or the last refusal). The words and the state are digest-now.ts's (useDigestNow).

import { View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Text } from '../../ui';
import { useDigestNow } from './use-digest-now';

const LINE_LEVEL = 6;

export function DigestNowButton() {
  const { spacing } = useTokens();
  const { view, press } = useDigestNow();
  return (
    <View style={{ gap: spacing.space2, paddingVertical: spacing.space3 }}>
      <Button
        label={view.label}
        variant="outline"
        onPress={press}
        busy={view.busy}
        disabled={view.disabled}
        accessibilityLabel={view.accessibilityLabel}
      />
      {view.line ? (
        <Text
          level={LINE_LEVEL}
          tone="muted"
          accessibilityLiveRegion={view.lineHidden ? 'none' : 'polite'}
          accessibilityElementsHidden={view.lineHidden}
          importantForAccessibility={view.lineHidden ? 'no-hide-descendants' : 'auto'}
        >
          {view.line}
        </Text>
      ) : null}
    </View>
  );
}
