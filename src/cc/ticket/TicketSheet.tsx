// The ticket sheet (handoff §2, D-BOARD, D31): the foundation's bottom sheet over the tab the
// ticket was opened from, with the head, the description, why it waits, the 'Waiting for your
// answer' box (it opens Questions), what it handed in, its Deliverables, the verdict for a role
// that may approve, and Ask Auto about #number, which opens the chat wave's new conversation with
// the ticket as its context (routes.chatWithTicket): never a chat of its own. A route id that is
// not a row id reads as not found; a load that fails says why, with Try again where it can help.

import MessagesSquare from 'lucide-react-native/icons/messages-square';
import { View } from 'react-native';

import { ApiError } from '../../api/errors';
import { routes } from '../../navigation/routes';
import { useTokens } from '../../styles/theme';
import { Button, ErrorState, LoadingState, Sheet, Text } from '../../ui';
import { BOARD_SCREEN } from '../shell/tabs';
import { TICKET_COPY } from '../strings';
import { useSheetRoute, type SheetRoute } from '../use-sheet-route';
import { readOnlyNote } from './actions';
import { ASK_AUTO, VERDICT } from './chrome';
import type { TicketSheetView } from './sheet';
import { LinkedDeliverables, QuestionBox, ReasonLine, TextBlock, TicketHead } from './TicketParts';
import { useTicketSheet } from './use-ticket';
import { Verdict } from './Verdict';

/** What a route id that is not a board row id is: no ticket the server could find. */
const NOT_A_TICKET = new ApiError('not_found');

function AskAuto({
  view,
  onPress,
}: {
  readonly view: TicketSheetView;
  readonly onPress: () => void;
}) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing[ASK_AUTO.gap] }}>
      {view.discussHint ? (
        <Text level={ASK_AUTO.hintLevel} tone={ASK_AUTO.hintTone}>
          {view.discussHint}
        </Text>
      ) : null}
      <Button
        label={view.ask.label}
        variant="outline"
        icon={MessagesSquare}
        onPress={onPress}
        accessibilityHint={TICKET_COPY.askHint}
        fullWidth
      />
    </View>
  );
}

/** What the ticket says: its head, description, why it waits, the question box, its result. */
function TicketBody({
  view,
  route,
}: {
  readonly view: TicketSheetView;
  readonly route: SheetRoute;
}) {
  return (
    <>
      <TicketHead view={view} />
      {view.description ? <TextBlock text={view.description} /> : null}
      {view.reason ? <ReasonLine reason={view.reason} /> : null}
      {view.question ? (
        <QuestionBox onPress={() => route.replaceWith(routes.cc.questions)} />
      ) : null}
      {view.failure ? <TextBlock label={TICKET_COPY.failure} text={view.failure} /> : null}
      {view.result ? <TextBlock label={TICKET_COPY.result} text={view.result} /> : null}
    </>
  );
}

function TicketContent({ taskId, route }: { readonly taskId: string; readonly route: SheetRoute }) {
  const { ticket, view, deliverables, actions, role } = useTicketSheet(taskId);
  const data = ticket.data;
  if (!view || !data || !actions) {
    return ticket.error ? (
      <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />
    ) : (
      <LoadingState label={TICKET_COPY.loading} inline />
    );
  }
  const readOnly = readOnlyNote(data, role);
  return (
    <>
      <TicketBody view={view} route={route} />
      <LinkedDeliverables rows={deliverables} onOpen={route.replaceWith} />
      {readOnly ? (
        <Text level={VERDICT.effectLevel} tone={VERDICT.effectTone}>
          {readOnly}
        </Text>
      ) : null}
      <Verdict ticket={data} actions={actions} onDecided={route.close} />
      <AskAuto view={view} onPress={() => route.push(view.ask.href)} />
    </>
  );
}

export type TicketSheetProps = {
  /** The board row id from the route, or null when the route's id is not one. */
  readonly taskId: string | null;
};

export function TicketSheet({ taskId }: TicketSheetProps) {
  const route = useSheetRoute(BOARD_SCREEN);
  return (
    <Sheet visible={route.visible} onClose={route.close}>
      {taskId === null ? (
        <ErrorState error={NOT_A_TICKET} />
      ) : (
        <TicketContent taskId={taskId} route={route} />
      )}
    </Sheet>
  );
}
