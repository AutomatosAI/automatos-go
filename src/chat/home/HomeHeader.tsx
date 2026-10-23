// The home's header (the handoff's §1 Header): --secondary chrome with a 1 pt --border under it,
// running up under the status bar. The brand mark from assets/brand beside 'automatos' in
// Newsreader (the scale's 15 pt title: the handoff's 17 is not in the scale), the mono line under
// it (home.ts headerLine), then the foundation's CommandCentreButton (the one header that shows the
// needs-you number, D26) and the avatar chip, which opens Settings. The chat route adds Back.
// FOUNDATION GAP: the session names no signed-in user (AppSession, AuthProvider), so the chip
// shows the user icon, not the handoff's initials.

import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import UserRound from 'lucide-react-native/icons/user-round';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSession } from '../../app-state/session';
import { routes } from '../../navigation/routes';
import { useTokens } from '../../styles/theme';
import { CommandCentreButton, IconButton, Text } from '../../ui';
import { HOME_COPY } from '../strings';
import { headerLine } from './home';
import { useAgentCount } from './use-home';

// the trimmed sail mark (assets/brand/SOURCES.md: 321 × 394), drawn 20 pt high as the handoff's
const BRAND_MARK = require('../../../assets/brand/splash.png');
const MARK_HEIGHT = 20;
const MARK_ASPECT = 321 / 394;
const WORDMARK_LEVEL = 4;
/** The handoff's 3 px between the lockup and the mono line. */
const LINE_GAP = 3;

export type HomeHeaderProps = {
  /** A turn streams or runs on the server: the line says Auto is working. */
  readonly working: boolean;
  /** The chat route's way back; home has none. */
  readonly onBack?: () => void;
};

function Brand({ line }: { readonly line: string }) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.brand, { gap: LINE_GAP }]}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={HOME_COPY.brand}
        style={[styles.lockup, { gap: spacing.space2 }]}
      >
        <Image source={BRAND_MARK} style={styles.mark} accessibilityIgnoresInvertColors />
        <Text variant="title" level={WORDMARK_LEVEL}>
          {HOME_COPY.wordmark}
        </Text>
      </View>
      <Text variant="mono" tone="muted" numberOfLines={1} accessibilityLiveRegion="polite">
        {line}
      </Text>
    </View>
  );
}

export function HomeHeader({ working, onBack }: HomeHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colours, spacing } = useTokens();
  const { workspace } = useAppSession();
  const agents = useAgentCount();
  const line = headerLine({ workspace: workspace.name, agents, working });
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colours.secondary,
          borderBottomColor: colours.border,
          paddingTop: insets.top + spacing.space3,
          paddingBottom: spacing.space4,
          paddingLeft: onBack ? spacing.space3 : spacing.space7,
          paddingRight: spacing.space6,
          gap: spacing.space4,
        },
      ]}
    >
      {onBack ? (
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel={HOME_COPY.back}
          onPress={onBack}
          variant="ghost"
          size="md"
        />
      ) : null}
      <Brand line={line} />
      <CommandCentreButton />
      <IconButton
        icon={UserRound}
        accessibilityLabel={HOME_COPY.settings}
        onPress={() => router.push(routes.settings)}
        variant="outline"
        size="md"
        round
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  brand: { flex: 1, minWidth: 0 },
  lockup: { flexDirection: 'row', alignItems: 'center' },
  mark: { height: MARK_HEIGHT, aspectRatio: MARK_ASPECT },
});
