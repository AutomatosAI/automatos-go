// First open in the thread's place (US-017f's FirstOpenHello, mounted by US-016k): the home before
// the first message, opening as every thread opens, with the AI label's one muted caption (D73),
// then Auto's hello, the greeting and the lede, and Play's three starters (Studio draws none, D29).
// A starter fills the message box and never sends (KS13). Nothing points at making an account
// (D-NO-SIGNUP).

import { StyleSheet, View } from 'react-native';

import { FirstOpenHello, type FirstOpenHelloProps } from '../edges/FirstOpen';
import { PlayThreadCaption } from '../play/companion';
import { useTokens } from '../theme';

export function FirstOpenThread({ onStarter }: FirstOpenHelloProps) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.fill, { paddingTop: spacing.space7 }]}>
      <PlayThreadCaption />
      <FirstOpenHello onStarter={onStarter} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
