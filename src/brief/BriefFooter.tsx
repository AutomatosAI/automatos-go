// The brief card's foot (PRD-268 §6.12.3 'Brief card': Listen), in BriefBody, so every layout's
// card and Arcade's OPEN BRIEF sheet carry it, and in HUD's sheet. Listen reads the brief aloud in
// Auto's voice (use-brief-listen.ts) and turns into Stop while it reads, with the AI label beside it
// (Auto's voice is an AI's, D73); it never plays until pressed. Dressed by the primitives.

import { Square, Volume2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AiLabel } from '../styles/ai-label';
import { useTokens } from '../styles/theme';
import { Button } from '../ui';
import type { Brief } from './schema';
import { BRIEF_COPY } from './strings';
import { useBriefListen } from './use-brief-listen';

const { listen: LISTEN } = BRIEF_COPY;

export function BriefFooter({ brief }: { readonly brief: Brief }) {
  const { spacing } = useTokens();
  const listen = useBriefListen(brief);
  if (!listen.offered) return null;
  return (
    <View style={[styles.row, { gap: spacing.space3 }]}>
      <Button
        label={listen.reading ? LISTEN.stop : LISTEN.label}
        icon={listen.reading ? Square : Volume2}
        variant="outline"
        size="sm"
        onPress={listen.toggle}
        accessibilityLabel={listen.reading ? LISTEN.stopLabel : LISTEN.accessibilityLabel}
      />
      {listen.reading ? <AiLabel /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
