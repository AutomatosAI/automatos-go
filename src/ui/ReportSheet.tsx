// "Report this" (D15): the one sheet the chat and Command Centre waves mount for an Auto message or
// a Deliverable. A reason (the server's ids, src/ui/strings.ts), an optional note of up to 500
// characters, and Send: POST /api/v1/reports through the API client, a toast on success, the
// taxonomy's own words on failure (errorCopy, what ErrorState shows). Nothing renders unless the
// server lists report_content and the role may report (report.ts: canReport). The draft starts
// empty each time the sheet opens (a parent re-rendering the same target keeps it), and the sheet
// keeps the last target on screen while it slides away.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GateInput } from '../api/capabilities';
import type { ApiClient } from '../api/client';
import { REPORT_NOTE_MAX_CHARS, reportContent, type ReportTarget } from '../api/reports';
import type { WorkspaceRole } from '../api/workspace';
import { logger } from '../lib/logger';
import { useTokens } from '../styles/theme';
import { Button } from './Button';
import { Pill } from './Pill';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { TextField } from './TextField';
import { useToast } from './ToastProvider';
import {
  EMPTY_REPORT_DRAFT,
  canReport,
  draftPayload,
  noteCounter,
  reportSentMessage,
  sameTarget,
  withNote,
  withReason,
  type ReportDraft,
} from './report';
import { REPORT_COPY, REPORT_REASON_CHOICES } from './strings';
import { errorCopy } from './variants';

const TITLE_LEVEL = 4;
const INTRO_LEVEL = 3;
const LABEL_LEVEL = 3;
const LABEL_WEIGHT = 500;

export type ReportSheetProps = {
  /** What is reported; null while the sheet is closed. */
  readonly target: ReportTarget | null;
  readonly onClose: () => void;
  readonly client: ApiClient;
  readonly discovery: GateInput;
  readonly role: WorkspaceRole | null | undefined;
};

type FormProps = {
  readonly draft: ReportDraft;
  readonly onDraft: (draft: ReportDraft) => void;
  readonly sending: boolean;
};

function ReasonChoices({ draft, onDraft, sending }: FormProps) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.reasons, { gap: spacing.space2 }]}>
      {REPORT_REASON_CHOICES.map((choice) => (
        <Pill
          key={choice.id}
          label={choice.label}
          selected={draft.reason === choice.id}
          disabled={sending}
          onPress={() => onDraft(withReason(draft, choice.id))}
        />
      ))}
    </View>
  );
}

export function ReportSheet({ target, onClose, client, discovery, role }: ReportSheetProps) {
  const { spacing } = useTokens();
  const toast = useToast();
  // `last` is the prop as of the previous render (null while closed); `held` the last target shown
  const [last, setLast] = useState<ReportTarget | null>(null);
  const [held, setHeld] = useState<ReportTarget | null>(target);
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_REPORT_DRAFT);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!sameTarget(target, last)) {
    setLast(target);
    if (target !== null) {
      setHeld(target);
      setDraft(EMPTY_REPORT_DRAFT);
      setError(null);
    }
  }
  if (!canReport(discovery, role) || held === null) return null;
  const payload = draftPayload(held, draft);

  const send = async () => {
    if (!payload) return;
    setSending(true);
    setError(null);
    try {
      toast.show(reportSentMessage(await reportContent(client, payload)));
      onClose();
    } catch (caught) {
      logger.warn('report failed', caught);
      setError(caught);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet visible={target !== null} onClose={onClose}>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {REPORT_COPY.titles[held.target_type]}
      </Text>
      <Text level={INTRO_LEVEL} tone="muted">
        {REPORT_COPY.intro}
      </Text>
      <Text level={LABEL_LEVEL} weight={LABEL_WEIGHT}>
        {REPORT_COPY.reasonLabel}
      </Text>
      <ReasonChoices draft={draft} onDraft={setDraft} sending={sending} />
      <TextField
        label={REPORT_COPY.noteLabel}
        placeholder={REPORT_COPY.notePlaceholder}
        value={draft.note}
        onChangeText={(note) => setDraft(withNote(draft, note))}
        maxLength={REPORT_NOTE_MAX_CHARS}
        helper={noteCounter(draft.note)}
        disabled={sending}
        multiline
      />
      {error === null ? null : (
        <Text level={INTRO_LEVEL} tone="accent" accessibilityRole="alert">
          {errorCopy(error).message}
        </Text>
      )}
      <View style={[styles.actions, { gap: spacing.space3 }]}>
        <Button label={REPORT_COPY.cancel} onPress={onClose} variant="outline" disabled={sending} />
        <Button
          label={REPORT_COPY.send}
          onPress={() => void send()}
          disabled={payload === null}
          busy={sending}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reasons: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
