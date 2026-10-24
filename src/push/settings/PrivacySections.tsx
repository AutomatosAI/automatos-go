// Question text and Face ID. 'Hide question text in notifications' is the workspace's switch (W2
// US-014b): owners and admins change it, everyone else sees its state and who can change it. 'Face
// ID before approve or answer' is this phone's (D19, src/step-up): always shown, on by default,
// turning it off asks first, and a phone with no passcode is told nothing is asked.

import { useAppSession } from '../../app-state/session';
import { Card, ErrorState, LoadingState } from '../../ui';
import { PUSH_SETTINGS_COPY } from '../strings';
import { Section } from './components/Section';
import { SwitchRow } from './components/Switch';
import { useFaceId, useRedact } from './use-notification-settings';
import { redactView } from './view-model';

function RedactSwitch() {
  const { workspace } = useAppSession();
  const redact = useRedact();
  const { query } = redact;
  if (!query.data) {
    if (query.isError)
      return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    return <LoadingState label={PUSH_SETTINGS_COPY.loading} inline />;
  }
  const view = redactView(redact.role ?? workspace.role, query.data, redact.pending);
  return (
    <SwitchRow
      title={view.label}
      detail={view.detail}
      note={view.note}
      value={view.on}
      disabled={!view.editable}
      onChange={redact.set}
    />
  );
}

export function QuestionTextSection() {
  return (
    <Section title={PUSH_SETTINGS_COPY.questionSection}>
      <Card>
        <RedactSwitch />
      </Card>
    </Section>
  );
}

export function FaceIdSection() {
  const faceId = useFaceId();
  const { view } = faceId;
  return (
    <Section title={PUSH_SETTINGS_COPY.faceIdSection}>
      <Card>
        <SwitchRow
          title={view.label}
          detail={view.detail}
          note={view.note}
          value={faceId.on}
          disabled={faceId.asking}
          onChange={(on) => void faceId.set(on)}
        />
      </Card>
    </Section>
  );
}
