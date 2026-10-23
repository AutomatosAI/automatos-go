// A chat screen's frame: the header (it runs up under the status bar itself), what sits above the
// thread (home's needs strip), then the thread and the composer, lifted over the keyboard on iOS as
// the foundation's Sheet is. The home indicator's inset sits below the keyboard's reach in the
// composer's own ground, so the keyboard covers it rather than pushing it up. The lift is offset by
// the signed-in stack's distance from the window's top, so a bar drawn above the stack (the
// unencrypted-network note) never leaves the composer behind the keyboard.

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTokens } from '../../styles/theme';
import { Screen } from '../../ui';

const KEYBOARD_BEHAVIOUR = Platform.OS === 'ios' ? 'padding' : undefined;
const SIDE_EDGES: readonly Edge[] = ['left', 'right'];

export type ChatFrameProps = {
  readonly header: ReactNode;
  readonly above?: ReactNode;
  /** The thread, or its loading or error state. */
  readonly children: ReactNode;
  readonly composer?: ReactNode;
};

export function ChatFrame({ header, above, children, composer }: ChatFrameProps) {
  const insets = useSafeAreaInsets();
  // KeyboardAvoidingView measures itself from its parent as if the screen began at the window's top,
  // but the keyboard from the window's top: offset it by where the signed-in stack starts, the
  // nearest safe-area provider's y (a bar's height under the gate's nested provider, 0 with no bar).
  const { y: stackTop } = useSafeAreaFrame();
  const { colours } = useTokens();
  const inset = { height: insets.bottom, backgroundColor: composer ? colours.card : undefined };
  return (
    <Screen edges={SIDE_EDGES}>
      {header}
      {above}
      <KeyboardAvoidingView
        behavior={KEYBOARD_BEHAVIOUR}
        keyboardVerticalOffset={stackTop}
        style={styles.fill}
      >
        <View style={styles.fill}>{children}</View>
        {composer}
      </KeyboardAvoidingView>
      <View style={inset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
