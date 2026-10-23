// The composer (US-009a, the handoff's 2j without its chips; D-COMPOSER, D-AI-LABEL, D-ROLES): the
// foundation's AiLabel, the attached files' chips (US-009b), then a row of the [+] (camera, photo
// library, files), the 'Message Auto' pill and the 42 pt round ink button, arrow-up to send and a
// square to stop. Return inserts a newline; only the button sends. No suggestion chips, no Plan
// toggle (D30), no voice button (A6). composerState decides everything; this only wires: the
// label's visibility (useLabelFence) gates it, an upload holds the send, and a send hands the
// trimmed words and the ready files up, then clears the pill and the chips.

import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Square from 'lucide-react-native/icons/square';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { WorkspaceRole } from '../../api/workspace';
import { AiLabel, AiLabelPaused } from '../../styles/ai-label';
import { useTokens } from '../../styles/theme';
import { IconButton, Text } from '../../ui';
import { AttachMenu } from '../attachments/AttachMenu';
import { AttachmentChips } from '../attachments/AttachmentChips';
import type { AttachmentsView } from '../attachments/use-attachments';
import type { ChatFile } from '../request';
import { COMPOSER_COPY } from '../strings';
import { composerButton, composerState, outgoingText, type ComposerNotice } from './composer-state';
import { PillInput } from './PillInput';
import { useLabelFence } from './use-label-fence';

const NOTICE_LEVEL = 4;

export type ComposerProps = {
  readonly role: WorkspaceRole | null | undefined;
  /** The thread's canStop: a reply streams, or a reopened chat's turn is in flight. */
  readonly streaming: boolean;
  /** The thread is still being opened: the pill takes typing, the send waits. */
  readonly loading?: boolean;
  /** The message's attachments (useAttachments); without them there is no [+]. */
  readonly files?: AttachmentsView;
  /** The trimmed words (blank when only files go) and the ready files; the composer clears. */
  readonly onSend: (text: string, files: readonly ChatFile[]) => void;
  readonly onStop: () => void;
};

const NO_FILES: readonly ChatFile[] = Object.freeze([]);

function Notice({ notice }: { readonly notice: ComposerNotice | null }) {
  if (!notice) return null;
  if (notice.kind === 'paused') return <AiLabelPaused />;
  return (
    <Text level={NOTICE_LEVEL} tone="muted" accessibilityRole="text">
      {notice.text}
    </Text>
  );
}

export function Composer({
  role,
  streaming,
  loading = false,
  files,
  onSend,
  onStop,
}: ComposerProps) {
  const { colours, spacing } = useTokens();
  const [text, setText] = useState('');
  const fence = useLabelFence();
  const state = composerState({
    text,
    streaming,
    role,
    aiLabelVisible: fence.visible,
    aiLabelChecked: fence.checked,
    uploading: files?.uploading ?? false,
    attachments: files?.ready.length ?? 0,
    loading,
  });
  const button = composerButton(state.buttonMode);
  const press = () => {
    if (state.buttonMode === 'stop') {
      onStop();
    } else if (state.buttonMode === 'send') {
      onSend(outgoingText(text), files?.ready ?? NO_FILES);
      setText('');
      files?.sent();
    }
  };
  return (
    <View
      style={[
        styles.strip,
        {
          borderTopColor: colours.border,
          backgroundColor: colours.card,
          paddingVertical: spacing.space4,
          paddingHorizontal: spacing.space5,
          gap: spacing.space3,
        },
      ]}
    >
      <AiLabel track={fence.track} />
      <Notice notice={state.notice} />
      {files ? <AttachmentChips chips={files.chips} onRemove={files.remove} /> : null}
      <View style={[styles.row, { gap: spacing.space3 }]}>
        {files ? (
          <AttachMenu disabled={!state.inputEditable} room={files.room} onPicked={files.add} />
        ) : null}
        <PillInput
          value={text}
          onChangeText={setText}
          placeholder={state.placeholder}
          label={COMPOSER_COPY.inputLabel}
          editable={state.inputEditable}
        />
        <IconButton
          icon={button.icon === 'stop' ? Square : ArrowUp}
          accessibilityLabel={button.label}
          accessibilityHint={button.hint}
          onPress={press}
          variant="primary"
          size="lg"
          round
          disabled={state.buttonMode === 'disabled'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
