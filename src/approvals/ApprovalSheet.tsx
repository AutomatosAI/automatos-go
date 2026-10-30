// The approval sheet (PRD-268 §6.11.4, §6.12.3 'Approval view', §6.12.5, US-G08), on the SocialSheet
// pattern: the foundation's bottom Sheet, dressed per layout, over the thread whose card stays the
// record (D30). It shows ApprovalView@1 as sheet-view.ts reads it: who asked and how long it waits,
// the action, its target, the exact preview (text only, selectable, never rendered as markup) and
// the rule sentence, all before the buttons; then Allow once ('Approve & run', full width and
// primary, Face ID first: the caller's gated call) and Refuse ('Deny' or 'Reject', secondary, never
// gated). Always allow is a link only where the view offers it, to a confirm step naming the rule,
// which sends the person to Studio's governance page, where rules are set (there is no route for it
// on the phone, K10). A plan's Reject asks for its reason in place (the caller's refuseForm).

import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { GOVERNANCE_HREF } from '../chat/home/needs-strip';
import { useFollowLink } from '../chat/components/follow-link';
import type { ApprovalView } from '../core/approval-view';
import { appRouteForWebLink } from '../navigation/web-links';
import { useTokens } from '../styles/theme';
import { Button, Sheet, Text } from '../ui';
import { tint } from '../ui/paint';
import { useMinuteClock } from '../cc/shell/use-shell';
import { approvalSheetView, type ApprovalSheetView, type SheetKind } from './sheet-view';
import { APPROVAL_SHEET_COPY } from './strings';

/** The preview box's ground: the cards' params digest tint (bg-muted/40). */
const PREVIEW_TINT = 0.4;

export type ApprovalSheetProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly view: ApprovalView;
  readonly kind: SheetKind;
  /** A call is out (Face ID, then the server). */
  readonly busy: boolean;
  /** Why the last answer was refused, in the card's words; null when it was not. */
  readonly error: string | null;
  readonly onAllow: () => void;
  readonly onRefuse: () => void;
  /** In the buttons' place while a plan's reason is asked for. */
  readonly refuseForm?: ReactNode;
};

function Preview({ sheet }: { readonly sheet: ApprovalSheetView }) {
  const { colours, radii, spacing } = useTokens();
  const { preview } = sheet;
  if (!preview) return null;
  return (
    <View
      style={{
        padding: spacing.space4,
        gap: spacing.space1,
        borderRadius: radii.control,
        backgroundColor: tint(colours.muted, PREVIEW_TINT),
      }}
    >
      <Text variant="mono" tone="muted" accessibilityRole="header">
        {sheet.previewLabel}
      </Text>
      <Text variant={preview.kind === 'diff' ? 'mono' : 'body'} level={5} selectable>
        {preview.body}
      </Text>
    </View>
  );
}

function Request({ sheet }: { readonly sheet: ApprovalSheetView }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space4 }}>
      <View
        accessible
        accessibilityLabel={sheet.accessibilityLabel}
        style={{ gap: spacing.space1 }}
      >
        <Text variant="eyebrow">{sheet.askedBy}</Text>
        {sheet.waiting ? (
          <Text variant="mono" tone={sheet.expired ? 'muted' : 'warning'}>
            {sheet.waiting}
          </Text>
        ) : null}
        <Text variant="title" level={4}>
          {sheet.title}
        </Text>
        {sheet.target ? (
          <Text level={5} tone="muted">{`${APPROVAL_SHEET_COPY.toLabel}: ${sheet.target}`}</Text>
        ) : null}
      </View>
      <Preview sheet={sheet} />
      <Text level={5}>{sheet.rule}</Text>
    </View>
  );
}

type AnswerProps = Pick<ApprovalSheetProps, 'busy' | 'error' | 'onAllow' | 'onRefuse'> & {
  readonly sheet: ApprovalSheetView;
  readonly onAlwaysAllow: () => void;
};

function Answers({ sheet, busy, error, onAllow, onRefuse, onAlwaysAllow }: AnswerProps) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      {sheet.allow ? (
        <Button
          label={sheet.allow}
          onPress={onAllow}
          busy={busy}
          fullWidth
          accessibilityHint={APPROVAL_SHEET_COPY.allowHint}
        />
      ) : null}
      {sheet.refuse ? (
        <Button
          label={sheet.refuse}
          onPress={onRefuse}
          variant="outline"
          disabled={busy}
          fullWidth
        />
      ) : null}
      {sheet.alwaysAllow ? (
        <Button label={APPROVAL_SHEET_COPY.alwaysAllow} onPress={onAlwaysAllow} variant="ghost" />
      ) : null}
      {sheet.allow ? (
        <Text level={6} tone="muted">
          {APPROVAL_SHEET_COPY.faceIdNote}
        </Text>
      ) : null}
      {error ? (
        <Text level={5} tone="warning" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Always allow's confirm step: the rule it changes, and Studio, where rules are set. */
function AlwaysAllowConfirm({
  rule,
  onBack,
}: {
  readonly rule: string;
  readonly onBack: () => void;
}) {
  const { spacing } = useTokens();
  const follow = useFollowLink();
  const studio = appRouteForWebLink(GOVERNANCE_HREF);
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="title" level={4} accessibilityRole="header">
        {APPROVAL_SHEET_COPY.alwaysAllowTitle}
      </Text>
      <Text level={5}>{APPROVAL_SHEET_COPY.alwaysAllowBody(rule)}</Text>
      {studio ? (
        <Button
          label={APPROVAL_SHEET_COPY.alwaysAllowOpen}
          onPress={() => follow(studio)}
          fullWidth
        />
      ) : null}
      <Button label={APPROVAL_SHEET_COPY.cancel} onPress={onBack} variant="outline" fullWidth />
    </View>
  );
}

export function ApprovalSheet(props: ApprovalSheetProps) {
  const { visible, onClose, view, kind, refuseForm } = props;
  const now = useMinuteClock().getTime();
  const [confirming, setConfirming] = useState(false);
  const sheet = approvalSheetView(view, kind, now);
  const close = () => {
    setConfirming(false);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={close}>
      {confirming ? (
        <AlwaysAllowConfirm rule={view.rule.sentence} onBack={() => setConfirming(false)} />
      ) : (
        <>
          <Request sheet={sheet} />
          {refuseForm ?? (
            <Answers sheet={sheet} {...props} onAlwaysAllow={() => setConfirming(true)} />
          )}
        </>
      )}
    </Sheet>
  );
}
