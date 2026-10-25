// One Deliverable in Play (Ember 05, US-017g) on routes.cc.deliverable: A3's page
// (src/cc/deliverables useDeliverablePage: the Deliverable with its content, its view, Report this's
// gate) as a printed piece on the dark desk. '← Shelf' in a 52 pt bar (A3's way back: the screen
// before, else the Shelf); the cream sheet (the vendored sheetOf colours: the look's sheet, radius 6
// at the top, 28 x 22 in) with the eyebrow in the sheet's accent ('REPORT · TODAY · SCOUT'), the
// title in the screen slot and the sheet's ink, the summary, then the file as A3 reads it: running
// text as the list's paragraphs (drawn as it scrolls), an image inline with the bearer (A3's own),
// or why the phone cannot show it; A3's actions in Ember's bottom row (DeliverableActions). No
// mascot (Ember: the reading page stays quiet). D25: no review state and no decision; Ember's 'Ask
// Auto about this' is not built (no Deliverable discussion route exists).

import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, View, type ListRenderItem } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { ApiError } from '../../api/errors';
import type { ReportTarget } from '../../api/reports';
import { DeliverableBody } from '../../cc/deliverables/DeliverableBody';
import type { DeliverableDetailView } from '../../cc/deliverables/detail';
import { useDeliverablePage } from '../../cc/deliverables/use-deliverable';
import { useMinuteClock, usePhoneTimeZone } from '../../cc/shell/use-shell';
import { DELIVERABLE_COPY } from '../../cc/strings';
import { usePullRefresh, type PullRefresh } from '../../cc/use-pull-refresh';
import { routes } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { ErrorState, LoadingState, ReportSheet, Screen, Text } from '../../ui';
import { COMPANION } from '../play/companion';
import { useCompanionPaint, type CompanionPaint } from '../play/companion/use-companion';
import { PLAY_SHELF_COPY } from '../strings';
import { useTokens } from '../theme';
import { DeliverableActions, needsStudio } from './DeliverableActions';
import { SHELF, deliverableEyebrow } from './play-shelf';

/** The Command Centre's frame keeps the sides and the bottom; the page paints the top. */
const EDGES: readonly Edge[] = ['top'];
const NOT_A_DELIVERABLE = new ApiError('not_found');
const { page } = SHELF;
const TEXT = Object.freeze({ leading: page.textLeading });

function BackBar() {
  const paint = useCompanionPaint();
  const goBack = useGoBack(routes.cc.deliverables);
  if (!paint) return null;
  const { vars, style } = paint;
  return (
    <View
      style={{
        minHeight: page.barHeight,
        justifyContent: 'center',
        paddingHorizontal: page.barPaddingX,
      }}
    >
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={PLAY_SHELF_COPY.backLabel}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          justifyContent: 'center',
          minHeight: COMPANION.target,
          paddingHorizontal: page.backPaddingX,
          opacity: pressed ? COMPANION.pressedOpacity : 1,
        })}
      >
        <Text style={[style.type.body(page.backSize, 500), { color: vars.groundText2 }]}>
          {PLAY_SHELF_COPY.back}
        </Text>
      </Pressable>
    </View>
  );
}

function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <Screen ground="deliverable" edges={EDGES}>
      <BackBar />
      {children}
    </Screen>
  );
}

type SheetText = { readonly paint: CompanionPaint; readonly text: string; readonly mono?: boolean };

function SheetParagraph({ paint, text, mono = false }: SheetText) {
  const { vars, style } = paint;
  const face = mono ? style.type.mono(page.monoSize) : style.type.body(page.textSize, 400, TEXT);
  return (
    <Text selectable style={[face, { color: vars.sheetText }]}>
      {text}
    </Text>
  );
}

type HeadProps = { readonly view: DeliverableDetailView; readonly eyebrow: string };

function SheetHead({ view, eyebrow }: HeadProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  const studioNote = view.body.kind === 'studio' ? view.body.note : null;
  return (
    <View style={{ gap: page.sheetGap, marginBottom: page.sheetGap }}>
      <Text style={[style.type.eyebrow, { color: vars.sheetAccent }]}>{eyebrow}</Text>
      <Text
        accessibilityRole="header"
        style={[style.type.display('screen'), { color: vars.sheetText }]}
      >
        {view.title}
      </Text>
      {view.summary.map((paragraph, index) => (
        <SheetParagraph key={index} paint={paint} text={paragraph} />
      ))}
      {view.body.kind === 'image' ? (
        <DeliverableBody body={view.body} title={view.title} studioUrl={view.studioUrl} />
      ) : null}
      {studioNote ? <SheetNote text={studioNote} /> : null}
      {needsStudio(view) && view.studioUrl === null ? (
        <SheetNote text={DELIVERABLE_COPY.studioMissing} />
      ) : null}
    </View>
  );
}

function SheetNote({ text }: { readonly text: string }) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  return (
    <Text style={[paint.style.type.body(page.noteSize), { color: paint.vars.sheetText }]}>
      {text}
    </Text>
  );
}

function ParagraphGap() {
  return <View style={{ height: page.sheetGap }} />;
}

type SheetProps = HeadProps & { readonly pull: PullRefresh };

function Sheet({ view, eyebrow, pull }: SheetProps) {
  const paint = useCompanionPaint();
  const { colours } = useTokens();
  if (!paint) return null;
  const text = view.body.kind === 'text' ? view.body : null;
  const render: ListRenderItem<string> = ({ item }) => (
    <SheetParagraph paint={paint} text={item} mono={text?.mono} />
  );
  return (
    <FlatList
      data={text?.paragraphs ?? []}
      keyExtractor={(_, index) => String(index)}
      renderItem={render}
      ItemSeparatorComponent={ParagraphGap}
      ListHeaderComponent={<SheetHead view={view} eyebrow={eyebrow} />}
      ListFooterComponent={
        text?.truncated ? (
          <View style={{ marginTop: page.sheetGap }}>
            <SheetNote text={DELIVERABLE_COPY.truncated} />
          </View>
        ) : null
      }
      style={{
        flex: 1,
        marginHorizontal: page.sheetMarginX,
        borderTopLeftRadius: page.sheetRadius,
        borderTopRightRadius: page.sheetRadius,
        backgroundColor: paint.vars.sheetBg,
      }}
      contentContainerStyle={{ paddingVertical: page.sheetPadY, paddingHorizontal: page.sheetPadX }}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={colours.mutedForeground}
          colors={[colours.mutedForeground]}
        />
      }
    />
  );
}

function Page({ id }: { readonly id: string }) {
  const { query, view, report, client, discovery, role } = useDeliverablePage(id);
  const pull = usePullRefresh(query.refetch);
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const data = query.data;
  if (!view || !data) {
    return (
      <Frame>
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <LoadingState label={DELIVERABLE_COPY.loading} />
        )}
      </Frame>
    );
  }
  const facts = { ...data, typeWord: view.typeWord, failed: view.failed };
  return (
    <Frame>
      <Sheet view={view} eyebrow={deliverableEyebrow(facts, { now, timeZone })} pull={pull} />
      <DeliverableActions view={view} onReport={report ? () => setReporting(report) : null} />
      <ReportSheet
        target={reporting}
        onClose={() => setReporting(null)}
        client={client}
        discovery={discovery}
        role={role}
      />
    </Frame>
  );
}

export type PlayDeliverableProps = {
  /** The Deliverable id from the route, or null when the route's id is not one. */
  readonly id: string | null;
};

export function PlayDeliverable({ id }: PlayDeliverableProps) {
  if (id === null) {
    return (
      <Frame>
        <ErrorState error={NOT_A_DELIVERABLE} />
      </Frame>
    );
  }
  return <Page id={id} />;
}
