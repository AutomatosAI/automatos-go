// The legal line on Welcome (US-021d; R04, Apple 5.1.1(i)): 'Privacy · Terms', so the privacy
// policy and the Terms are one tap away before anyone signs in. Each word opens its page in the
// system browser (use-open-page.ts), never in the app; the caller passes the URLs from
// legal-links.ts, the same ones Settings → Privacy & legal opens. Each link is 44 pt tall and
// underlined (a link is never told by colour alone).

import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { MIN_TOUCH } from '../../ui/paint';
import { LEGAL_LINE_COPY, PRIVACY_COPY } from '../strings';
import { useOpenPage } from './use-open-page';

const LINE_LEVEL = 3;
const PRESSED_OPACITY = 0.6;

export type LegalLineProps = {
  readonly privacyUrl: string;
  readonly termsUrl: string;
};

type LegalLinkProps = {
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
};

function LegalLink({ label, accessibilityLabel, onPress }: LegalLinkProps) {
  const { spacing } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={PRIVACY_COPY.opensInBrowser}
      style={({ pressed }) => [
        styles.link,
        { paddingHorizontal: spacing.space2 },
        pressed ? styles.pressed : null,
      ]}
    >
      <Text level={LINE_LEVEL} tone="muted" style={styles.underline}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LegalLine({ privacyUrl, termsUrl }: LegalLineProps) {
  const openPage = useOpenPage();
  return (
    <View style={styles.line}>
      <LegalLink
        label={LEGAL_LINE_COPY.privacy}
        accessibilityLabel={LEGAL_LINE_COPY.privacyLabel}
        onPress={() => openPage(privacyUrl)}
      />
      <Text level={LINE_LEVEL} tone="muted" accessible={false} importantForAccessibility="no">
        {LEGAL_LINE_COPY.separator}
      </Text>
      <LegalLink
        label={LEGAL_LINE_COPY.terms}
        accessibilityLabel={LEGAL_LINE_COPY.termsLabel}
        onPress={() => openPage(termsUrl)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  pressed: { opacity: PRESSED_OPACITY },
  underline: { textDecorationLine: 'underline' },
});
