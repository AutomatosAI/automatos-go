// The item sheet (handoff §2 'Calendar' tap → sheet, D-PAUSE): the foundation's bottom sheet over
// the Calendar with the kind, the title and when it runs, then what can be done: Pause or Resume for
// a routine or an agent-scheduled task (a role that may pause; a viewer is told who does), 'Manage
// in Studio' in the system browser for every other kind, and 'Open #n on the board' when the item
// belongs to a ticket. A refusal shows in the sheet in the server's words or the taxonomy's (a
// toast would sit under the sheet's Modal); a pause that goes through closes the sheet with a toast.

import { useState } from 'react';
import { View } from 'react-native';
import ExternalLink from 'lucide-react-native/icons/external-link';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';

import { useTokens } from '../../styles/theme';
import { Button, Divider, Sheet, Text } from '../../ui';
import { openInBrowser } from '../open-studio';
import { CALENDAR_COPY } from '../strings';
import { ITEM_SHEET } from './chrome';
import { KindLine } from './DayView';
import { itemSheetView, type ItemSheetView, type PauseButtonView, type SheetTarget } from './sheet';
import { useBoardNumber, usePause } from './use-calendar';

function SheetHead({ view }: { readonly view: ItemSheetView }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing[ITEM_SHEET.headGap] }}>
      <KindLine kind={view.kind} flags={view.flags} />
      <Text variant="title" level={ITEM_SHEET.titleLevel} accessibilityRole="header">
        {view.title}
      </Text>
      {view.when ? (
        <Text level={ITEM_SHEET.whenLevel} tone={ITEM_SHEET.whenTone}>
          {view.when}
        </Text>
      ) : null}
    </View>
  );
}

function Note({ text }: { readonly text: string }) {
  return (
    <Text level={ITEM_SHEET.noteLevel} tone={ITEM_SHEET.noteTone}>
      {text}
    </Text>
  );
}

type PauseBlockProps = {
  readonly button: PauseButtonView;
  readonly busy: boolean;
  readonly onPress: () => void;
};

function PauseBlock({ button, busy, onPress }: PauseBlockProps) {
  return (
    <>
      <Note text={button.effect} />
      <Button
        label={button.label}
        variant="outline"
        icon={button.resumes ? Play : Pause}
        busy={busy}
        disabled={busy}
        onPress={onPress}
        fullWidth
      />
      {button.note ? <Note text={button.note} /> : null}
    </>
  );
}

function StudioBlock({
  url,
  onFailed,
}: {
  readonly url: string | null;
  readonly onFailed: () => void;
}) {
  if (url === null) return <Note text={CALENDAR_COPY.sheet.studioMissing} />;
  return (
    <Button
      label={CALENDAR_COPY.sheet.studio}
      variant="outline"
      icon={ExternalLink}
      accessibilityHint={CALENDAR_COPY.sheet.studioHint}
      onPress={() => {
        void openInBrowser(url).then((opened) => {
          if (!opened) onFailed();
        });
      }}
      fullWidth
    />
  );
}

type ItemContentProps = {
  readonly target: SheetTarget;
  readonly onClose: () => void;
  readonly onOpenBoard: (href: string) => void;
};

function ItemContent({ target, onClose, onOpenBoard }: ItemContentProps) {
  const { spacing } = useTokens();
  const [refusal, setRefusal] = useState<string | null>(null);
  const pause = usePause(onClose, setRefusal);
  const ticketNumber = useBoardNumber(target.item.board_task_id);
  const view = itemSheetView({ ...target, role: pause.role, ticketNumber });
  const { board, pause: button } = view;
  return (
    <>
      <SheetHead view={view} />
      <Divider />
      <View style={{ gap: spacing[ITEM_SHEET.actionsGap] }}>
        {button ? (
          <PauseBlock
            button={button}
            busy={pause.busy}
            onPress={() => pause.send({ button, title: view.title })}
          />
        ) : null}
        {view.readOnly ? <Note text={view.readOnly} /> : null}
        {view.studio ? (
          <StudioBlock
            url={view.studio.url}
            onFailed={() => setRefusal(CALENDAR_COPY.sheet.studioFailed)}
          />
        ) : null}
        {board ? (
          <Button
            label={board.label}
            variant="outline"
            icon={LayoutDashboard}
            accessibilityHint={CALENDAR_COPY.sheet.onBoardHint}
            onPress={() => onOpenBoard(board.href)}
            fullWidth
          />
        ) : null}
        {refusal ? (
          <Text
            level={ITEM_SHEET.refusalLevel}
            tone={ITEM_SHEET.refusalTone}
            accessibilityRole="alert"
          >
            {refusal}
          </Text>
        ) : null}
      </View>
    </>
  );
}

export type ItemSheetProps = {
  readonly visible: boolean;
  /** The item as the feed shows it now; null once it has gone (the sheet closes). */
  readonly target: SheetTarget | null;
  readonly onClose: () => void;
  readonly onOpenBoard: (href: string) => void;
};

export function ItemSheet({ visible, target, onClose, onOpenBoard }: ItemSheetProps) {
  return (
    <Sheet visible={visible && target !== null} onClose={onClose}>
      {target ? (
        <ItemContent
          key={target.item.id}
          target={target}
          onClose={onClose}
          onOpenBoard={onOpenBoard}
        />
      ) : null}
    </Sheet>
  );
}
