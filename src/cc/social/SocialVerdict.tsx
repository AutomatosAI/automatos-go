// The decision on a social post in Needs approval (D-SOCIAL, D6): the line that says what approving
// this exact version does, then Request changes and Approve side by side. Request changes opens the
// comment ('What needs to change?'), which must have words before Send request is enabled; Cancel
// closes it. Approve sends the hash of the post this panel was drawn for. A refusal, or the word that
// the post changed and was reloaded, shows in the sheet (a toast would sit under the sheet's Modal).
// The buttons, labels and enabled states are approval.ts's socialVerdictView; nothing shows without
// a role that may approve (roleCan).

import CircleCheck from 'lucide-react-native/icons/circle-check';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Text, TextField } from '../../ui';
import { SOCIAL_COPY } from '../strings';
import { VERDICT } from '../ticket/chrome';
import {
  approveEffect,
  SOCIAL_COMMENT_MAX_CHARS,
  socialVerdictView,
  type SocialActions,
  type SocialVerdictView,
} from './approval';
import type { SocialPost } from './schemas';
import { useSocialVerdict } from './use-social';

type VerdictState = ReturnType<typeof useSocialVerdict>;

type PanelProps = {
  readonly post: SocialPost;
  readonly view: SocialVerdictView;
  readonly verdict: VerdictState;
};

function CommentField({ view, verdict }: Omit<PanelProps, 'post'>) {
  return (
    <TextField
      label={SOCIAL_COPY.comment.label}
      placeholder={SOCIAL_COPY.comment.placeholder}
      helper={SOCIAL_COPY.comment.helper}
      error={view.comment.error ?? undefined}
      value={verdict.comment}
      onChangeText={verdict.setComment}
      maxLength={SOCIAL_COMMENT_MAX_CHARS}
      disabled={verdict.busy}
      multiline
      autoFocus
    />
  );
}

function VerdictButtons({ post, view, verdict }: PanelProps) {
  const { spacing } = useTokens();
  const commenting = view.comment.open;
  return (
    <View style={[styles.buttons, { gap: spacing[VERDICT.buttonGap] }]}>
      {view.secondary ? (
        <View style={styles.button}>
          <Button
            label={view.secondary.label}
            variant="outline"
            icon={commenting ? undefined : MessageSquareText}
            disabled={view.secondary.disabled}
            onPress={() => verdict.choose(commenting ? 'idle' : 'comment')}
            fullWidth
          />
        </View>
      ) : null}
      {view.primary ? (
        <View style={styles.button}>
          <Button
            label={view.primary.label}
            icon={commenting ? MessageSquareText : CircleCheck}
            disabled={view.primary.disabled}
            busy={verdict.busy}
            onPress={commenting ? verdict.requestChanges : () => verdict.approve(post)}
            fullWidth
          />
        </View>
      ) : null}
    </View>
  );
}

export type SocialVerdictProps = {
  /** The post on screen: Approve carries its content_hash. */
  readonly post: SocialPost;
  readonly actions: SocialActions;
  /** The slot approving schedules it for, when it has one still ahead. */
  readonly slot: string | null;
  /** Reloads the post after a 409 and answers the version now on screen. */
  readonly reload: () => Promise<SocialPost | undefined>;
  /** The decision went through: the sheet closes. */
  readonly onDecided: () => void;
};

export function SocialVerdict({ post, actions, slot, reload, onDecided }: SocialVerdictProps) {
  const { spacing } = useTokens();
  const verdict = useSocialVerdict(post, reload, onDecided);
  const view = socialVerdictView(actions, verdict.mode, verdict.comment, verdict.busy);
  // a refusal stays in sight after the post it refused has moved on (its buttons are gone)
  if (!view.primary && !view.secondary && !verdict.refusal) return null;
  const commenting = view.comment.open;
  return (
    <View style={{ gap: spacing[VERDICT.gap] }}>
      {view.primary && !commenting ? (
        <Text level={VERDICT.effectLevel} tone={VERDICT.effectTone}>
          {approveEffect(slot)}
        </Text>
      ) : null}
      {commenting ? <CommentField view={view} verdict={verdict} /> : null}
      {verdict.refusal ? (
        <Text level={VERDICT.refusalLevel} tone={VERDICT.refusalTone} accessibilityRole="alert">
          {verdict.refusal}
        </Text>
      ) : null}
      <VerdictButtons post={post} view={view} verdict={verdict} />
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row' },
  button: { flex: 1 },
});
