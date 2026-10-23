// 'Update ticket and re-queue' (the web's rebrief-dialog.tsx, in the foundation's Sheet): the brief
// Auto proposed in its last reply (rebriefPrefill: its fenced block, capped at MAX_BRIEF_CHARS),
// read afresh each time the sheet opens, for the owner to check and edit. Save sends it (POST
// /api/v1/tasks/{id}/rebrief {brief}) for a role that may approve (D16, D17, canRebrief); the toast
// says the ticket is back with its agent and the discussion ends. A refusal shows refusalText's
// words under the field.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppSession } from '../../app-state/session';
import type { Discussion } from '../../core/web/lib/discussion';
import type { ChatMessage } from '../../core/web/types';
import { useTokens } from '../../styles/theme';
import { Button, Sheet, Text, TextField } from '../../ui';
import { RefusalText } from '../cards/CardNotes';
import { DISCUSSION_COPY } from '../strings';
import { MAX_BRIEF_CHARS, canRebrief, rebriefPrefill, rebriefSheetCopy } from './discussion';
import { useRebrief } from './use-discussion';

const TITLE_LEVEL = 4;
const INTRO_LEVEL = 3;

export type RebriefSheetProps = {
  readonly discussion: Discussion;
  readonly visible: boolean;
  /** The conversation's saved messages: the brief is read from Auto's last reply. */
  readonly messages: readonly ChatMessage[];
  readonly onClose: () => void;
  /** The ticket was updated and re-queued. */
  readonly onDone: () => void;
};

export function RebriefSheet({
  discussion,
  visible,
  messages,
  onClose,
  onDone,
}: RebriefSheetProps) {
  const { spacing } = useTokens();
  const { workspace } = useAppSession();
  const request = useRebrief(discussion, onDone);
  const [brief, setBrief] = useState('');
  // `shown` is `visible` as of the previous render: each opening starts from Auto's proposal
  const [shown, setShown] = useState(false);
  if (visible !== shown) {
    setShown(visible);
    if (visible) {
      setBrief(rebriefPrefill(messages));
      request.clear();
    }
  }
  const copy = rebriefSheetCopy(discussion);
  const ready = canRebrief(workspace.role, brief);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {copy.title}
      </Text>
      <Text level={INTRO_LEVEL} tone="muted">
        {copy.intro}
      </Text>
      <TextField
        label={DISCUSSION_COPY.briefLabel}
        placeholder={DISCUSSION_COPY.briefPlaceholder}
        value={brief}
        onChangeText={setBrief}
        maxLength={MAX_BRIEF_CHARS}
        helper={brief.trim() ? undefined : DISCUSSION_COPY.briefRequired}
        disabled={request.busy}
        multiline
      />
      <RefusalText text={request.error} />
      <View style={[styles.actions, { gap: spacing.space3 }]}>
        <Button
          label={DISCUSSION_COPY.cancel}
          onPress={onClose}
          variant="outline"
          disabled={request.busy}
        />
        <Button
          label={DISCUSSION_COPY.save}
          onPress={() => request.save(brief)}
          disabled={!ready}
          busy={request.busy}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
