// The brief card's foot (PRD-268 §6.12.3 'Brief card': Listen, thumbs), in BriefBody, so every
// layout's card and Arcade's OPEN BRIEF sheet carry it, and in HUD's sheet. Listen reads the brief
// aloud in Auto's voice (use-brief-listen.ts) and turns into Stop while it reads, with the AI label
// beside it (Auto's voice is an AI's, D73); it never plays until pressed. The thumbs post what the
// person thought of Auto's Read (use-brief-feedback.ts): the chosen one is filled and heard as
// selected, a failure is one line. Dressed by the primitives; no cost or credit is named (D8).

import { Square, ThumbsDown, ThumbsUp, Volume2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AiLabel } from '../styles/ai-label';
import { useTokens } from '../styles/theme';
import { Button, IconButton, Text } from '../ui';
import type { BriefRating } from './feedback';
import type { Brief } from './schema';
import { BRIEF_COPY } from './strings';
import { useBriefFeedback, type BriefFeedback } from './use-brief-feedback';
import { useBriefListen, type BriefListen } from './use-brief-listen';

const { listen: LISTEN, feedback: FEEDBACK } = BRIEF_COPY;

function Listen({ listen }: { readonly listen: BriefListen }) {
  const { spacing } = useTokens();
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

const THUMBS: readonly { readonly rating: BriefRating; readonly icon: typeof ThumbsUp }[] = [
  { rating: 'up', icon: ThumbsUp },
  { rating: 'down', icon: ThumbsDown },
];

function Thumbs({ feedback }: { readonly feedback: BriefFeedback }) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.row, { gap: spacing.space1 }]}>
      {THUMBS.map(({ rating, icon }) => (
        <IconButton
          key={rating}
          icon={icon}
          size="sm"
          variant={feedback.chosen === rating ? 'secondary' : 'ghost'}
          selected={feedback.chosen === rating}
          accessibilityLabel={FEEDBACK[rating]}
          onPress={() => feedback.choose(rating)}
        />
      ))}
    </View>
  );
}

function FeedbackLine({ feedback }: { readonly feedback: BriefFeedback }) {
  if (feedback.failed)
    return (
      <Text level={5} tone="warning" accessibilityLiveRegion="polite">
        {FEEDBACK.failed}
      </Text>
    );
  if (!feedback.thanked) return null;
  return (
    <Text level={5} tone="muted" accessibilityLiveRegion="polite">
      {FEEDBACK.thanks}
    </Text>
  );
}

export function BriefFooter({ brief }: { readonly brief: Brief }) {
  const { spacing } = useTokens();
  const feedback = useBriefFeedback(brief);
  const listen = useBriefListen(brief);
  if (!listen.offered && !feedback.offered) return null;
  return (
    <View style={{ gap: spacing.space2 }}>
      <View style={[styles.row, styles.spread, { gap: spacing.space3 }]}>
        <Listen listen={listen} />
        {feedback.offered ? <Thumbs feedback={feedback} /> : null}
      </View>
      <FeedbackLine feedback={feedback} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  spread: { justifyContent: 'space-between' },
});
