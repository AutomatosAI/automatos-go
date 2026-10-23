// The bar over a conversation about a ticket (the web's discussion-bar.tsx), under the header as
// home's needs strip is: 'Discussing #0419 — <title>', which opens the ticket's sheet, then 'Update
// ticket and re-queue' for a role that may approve, or on a Mission's ticket 'Decide on the
// mission →' in Studio (PRD-252 D4), and End. While the ticket opens the bar says so; a ticket this
// workspace does not have says it may be in another workspace; any other failure shows the
// taxonomy's words with Try again. discussionBar (pure) decides every word and target; the web's
// hint about picking the ticket's agent is left out: the phone's composer has no agent picker.

import { useRouter } from 'expo-router';
import X from 'lucide-react-native/icons/x';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppSession } from '../../app-state/session';
import type { ChatMessage } from '../../core/web/types';
import { useTokens } from '../../styles/theme';
import { Button, IconButton, Text } from '../../ui';
import { useFollowLink } from '../components/follow-link';
import { DISCUSSION_COPY, NEEDS_COPY } from '../strings';
import { discussionBar, type DiscussionAction, type DiscussionBarView } from './discussion';
import { RebriefSheet } from './RebriefSheet';
import type { DiscussionState } from './use-discussion';

const TEXT_LEVEL = 3;
const TITLE_WEIGHT = 500;
const TITLE_LINES = 2;

type OpenView = Extract<DiscussionBarView, { kind: 'open' }>;

function BarFrame({
  children,
  onEnd,
}: {
  readonly children: ReactNode;
  readonly onEnd: () => void;
}) {
  const { colours, spacing } = useTokens();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colours.card,
          borderBottomColor: colours.border,
          paddingVertical: spacing.space4,
          paddingLeft: spacing.space7,
          paddingRight: spacing.space4,
          gap: spacing.space3,
        },
      ]}
    >
      <View style={[styles.body, { gap: spacing.space3 }]}>{children}</View>
      <IconButton
        icon={X}
        accessibilityLabel={DISCUSSION_COPY.end}
        onPress={onEnd}
        variant="ghost"
        size="sm"
      />
    </View>
  );
}

function ActionButton({
  action,
  onRebrief,
}: {
  readonly action: DiscussionAction;
  readonly onRebrief: () => void;
}) {
  const follow = useFollowLink();
  if (action.kind === 'rebrief') {
    return <Button label={DISCUSSION_COPY.rebrief} onPress={onRebrief} size="sm" />;
  }
  const target = action.kind === 'mission' ? action.target : null;
  if (!target) return null;
  return (
    <Button
      label={DISCUSSION_COPY.decideMission}
      accessibilityHint={'external' in target ? NEEDS_COPY.opensStudio : undefined}
      onPress={() => follow(target)}
      size="sm"
      variant="outline"
    />
  );
}

function OpenBar({ view, onRebrief }: { readonly view: OpenView; readonly onRebrief: () => void }) {
  const router = useRouter();
  return (
    <>
      <Pressable
        accessibilityRole="link"
        accessibilityHint={DISCUSSION_COPY.openTicketHint}
        onPress={() => router.push(view.ticketRoute)}
      >
        <Text level={TEXT_LEVEL} weight={TITLE_WEIGHT} numberOfLines={TITLE_LINES}>
          {view.title}
        </Text>
      </Pressable>
      <View style={styles.actions}>
        <ActionButton action={view.action} onRebrief={onRebrief} />
      </View>
    </>
  );
}

function Notice({ text, onRetry }: { readonly text: string; readonly onRetry?: () => void }) {
  return (
    <>
      <Text level={TEXT_LEVEL} tone="muted" accessibilityLiveRegion="polite">
        {text}
      </Text>
      {onRetry ? (
        <View style={styles.actions}>
          <Button label={DISCUSSION_COPY.retry} onPress={onRetry} size="sm" variant="outline" />
        </View>
      ) : null}
    </>
  );
}

export type DiscussionBarProps = {
  readonly state: DiscussionState;
  /** The conversation's saved messages, for the rebrief's first words. */
  readonly messages: readonly ChatMessage[];
};

export function DiscussionBar({ state, messages }: DiscussionBarProps) {
  const { workspace } = useAppSession();
  const { load, discussion, retry, end } = state;
  const view = useMemo(() => discussionBar(load, { role: workspace.role }), [load, workspace.role]);
  const [rebriefing, setRebriefing] = useState(false);
  if (view.kind === 'none') return null;
  const done = () => {
    setRebriefing(false);
    end();
  };
  const offersRebrief = view.kind === 'open' && view.action.kind === 'rebrief';
  return (
    <>
      <BarFrame onEnd={end}>
        {view.kind === 'open' ? (
          <OpenBar view={view} onRebrief={() => setRebriefing(true)} />
        ) : (
          <Notice
            text={view.text}
            onRetry={view.kind === 'failed' && view.canRetry ? retry : undefined}
          />
        )}
      </BarFrame>
      {offersRebrief && discussion ? (
        <RebriefSheet
          discussion={discussion}
          visible={rebriefing}
          messages={messages}
          onClose={() => setRebriefing(false)}
          onDone={done}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1 },
  body: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});
