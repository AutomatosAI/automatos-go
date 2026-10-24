// A Deliverable's actions in Play (Ember 05, US-017g): A3's own, in Ember's bottom row under the
// sheet: 'Report this' as the outline and the file's action as the primary, both 48 high (Ember's
// Download and 'Ask Auto about this'; the phone has no download and no Deliverable discussion, so
// neither is drawn). The file's action is A3's: a PDF, DOCX or XLSX in the system viewer
// (useSystemViewer, one press at a time), or Studio in the system browser for a file the phone
// cannot show or only the first part of. A failure says why over the row, as A3's page does.

import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DeliverableDetailView } from '../../cc/deliverables/detail';
import { useSystemViewer, type ViewerBody } from '../../cc/deliverables/use-deliverable';
import { openInBrowser } from '../../cc/open-studio';
import { DELIVERABLE_COPY } from '../../cc/strings';
import { Button, REPORT_COPY, Text } from '../../ui';
import { useCompanionPaint } from '../play/companion/use-companion';
import { SHELF } from './play-shelf';

const { page } = SHELF;

type SlotProps = { readonly grow: number; readonly children: ReactNode };

function Slot({ grow, children }: SlotProps) {
  return <View style={{ flexGrow: grow, flexBasis: 0 }}>{children}</View>;
}

function Failure({ text }: { readonly text: string | null }) {
  const paint = useCompanionPaint();
  if (!text || !paint) return null;
  return (
    <Text
      accessibilityRole="alert"
      style={[paint.style.type.body(page.noteSize), { color: paint.vars.errorText }]}
    >
      {text}
    </Text>
  );
}

type Primary = { readonly label: string; readonly hint?: string; readonly busy: boolean };

function PrimaryButton({ label, hint, busy, onPress }: Primary & { readonly onPress: () => void }) {
  return (
    <Button
      label={label}
      accessibilityHint={hint}
      busy={busy}
      onPress={onPress}
      minHeight={page.actionHeight}
      fullWidth
    />
  );
}

function ViewerAction({ body, title }: { readonly body: ViewerBody; readonly title: string }) {
  const viewer = useSystemViewer(body, title);
  return (
    <>
      <Failure text={viewer.failure} />
      <PrimaryButton
        label={body.label}
        hint={DELIVERABLE_COPY.openHint}
        busy={viewer.busy}
        onPress={viewer.open}
      />
    </>
  );
}

function StudioAction({ url }: { readonly url: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Failure text={failed ? DELIVERABLE_COPY.studioFailed : null} />
      <PrimaryButton
        label={DELIVERABLE_COPY.studio}
        hint={DELIVERABLE_COPY.studioHint}
        busy={false}
        onPress={() => {
          void openInBrowser(url).then((opened) => setFailed(!opened));
        }}
      />
    </>
  );
}

/** Studio is the way to a file the phone cannot show, or shows only the first part of. */
export function needsStudio(view: Pick<DeliverableDetailView, 'body'>): boolean {
  const { body } = view;
  return body.kind === 'studio' || (body.kind === 'text' && body.truncated);
}

function FileAction({ view }: { readonly view: DeliverableDetailView }) {
  if (view.body.kind === 'viewer') return <ViewerAction body={view.body} title={view.title} />;
  if (needsStudio(view) && view.studioUrl) return <StudioAction url={view.studioUrl} />;
  return null;
}

export type DeliverableActionsProps = {
  readonly view: DeliverableDetailView;
  /** Report this, where the foundation's gate offers it. */
  readonly onReport: (() => void) | null;
};

export function DeliverableActions({ view, onReport }: DeliverableActionsProps) {
  const paint = useCompanionPaint();
  const file = view.body.kind === 'viewer' || (needsStudio(view) && view.studioUrl !== null);
  if (!paint || (!file && !onReport)) return null;
  return (
    <View
      style={[
        styles.row,
        {
          gap: page.actionsGap,
          paddingVertical: page.actionsPadY,
          paddingHorizontal: page.actionsPadX,
          borderTopColor: paint.lines.headerLine,
        },
      ]}
    >
      {onReport ? (
        <Slot grow={page.outlineGrow}>
          <Button
            label={REPORT_COPY.action}
            variant="outline"
            onPress={onReport}
            minHeight={page.actionHeight}
            fullWidth
          />
        </Slot>
      ) : null}
      {file ? (
        <Slot grow={page.primaryGrow}>
          <View style={{ gap: page.actionsGap }}>
            <FileAction view={view} />
          </View>
        </Slot>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1 },
});
