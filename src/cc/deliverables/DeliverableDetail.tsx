// One Deliverable (D-DELIVERABLES, D25, D15; routes.cc.deliverable), under the Command Centre's
// shell over the tab it was opened from: Back, the type row, the serif title and who made it when,
// then the file. Running text is the list's rows, one per paragraph, so a long file is drawn as it
// scrolls; the first part of an over-long file says so and offers Studio. An image, a viewer file or
// Studio sits under the head (DeliverableBody). 'Report this' opens the foundation's ReportSheet
// where its gate says so. No review state and no decision: a Deliverable is read, opened or reported.

import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Flag from 'lucide-react-native/icons/flag';
import { useState } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';

import { ApiError } from '../../api/errors';
import type { ReportTarget } from '../../api/reports';
import { routes } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { useTokens } from '../../styles/theme';
import { Button, ErrorState, LoadingState, REPORT_COPY, ReportSheet, Text } from '../../ui';
import { DELIVERABLE_COPY } from '../strings';
import { usePullRefresh } from '../use-pull-refresh';
import { DELIVERABLE_PAGE } from './chrome';
import { DeliverableBody, Note, StudioLink } from './DeliverableBody';
import { TypeRow } from './DeliverableCard';
import type { DeliverableDetailView } from './detail';
import { useDeliverablePage } from './use-deliverable';

/** What a route id that is not a Deliverable id is: nothing the server could find. */
const NOT_A_DELIVERABLE = new ApiError('not_found');

function BackButton() {
  const goBack = useGoBack(routes.cc.deliverables);
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Button
        label={DELIVERABLE_COPY.back}
        accessibilityLabel={DELIVERABLE_COPY.backLabel}
        icon={ChevronLeft}
        variant="ghost"
        size="sm"
        onPress={goBack}
      />
    </View>
  );
}

function usePageStyle() {
  const { spacing } = useTokens();
  return {
    paddingTop: spacing[DELIVERABLE_PAGE.paddingTop],
    paddingHorizontal: spacing[DELIVERABLE_PAGE.paddingX],
    paddingBottom: spacing[DELIVERABLE_PAGE.paddingBottom],
    gap: spacing[DELIVERABLE_PAGE.gap],
  };
}

function Head({ view }: { readonly view: DeliverableDetailView }) {
  const { spacing } = useTokens();
  const gap = spacing[DELIVERABLE_PAGE.gap];
  return (
    <View style={{ gap, marginBottom: gap }}>
      <BackButton />
      <View style={{ gap: spacing[DELIVERABLE_PAGE.headGap] }}>
        <TypeRow view={view} />
        <Text variant="title" level={DELIVERABLE_PAGE.titleLevel} accessibilityRole="header">
          {view.title}
        </Text>
        <Text
          variant="mono"
          tone={DELIVERABLE_PAGE.labelTone}
          style={{ textTransform: DELIVERABLE_PAGE.monoCase }}
        >
          {view.meta}
        </Text>
      </View>
      {view.summary.length > 0 ? (
        <View style={{ gap: spacing[DELIVERABLE_PAGE.headGap] }}>
          <Text variant="mono" tone={DELIVERABLE_PAGE.labelTone}>
            {DELIVERABLE_COPY.summary}
          </Text>
          {view.summary.map((paragraph, index) => (
            <Text key={index} level={DELIVERABLE_PAGE.textLevel}>
              {paragraph}
            </Text>
          ))}
        </View>
      ) : null}
      <DeliverableBody body={view.body} title={view.title} studioUrl={view.studioUrl} />
    </View>
  );
}

type FootProps = {
  readonly view: DeliverableDetailView;
  readonly onReport: (() => void) | null;
};

function Foot({ view, onReport }: FootProps) {
  const { spacing } = useTokens();
  const gap = spacing[DELIVERABLE_PAGE.gap];
  const truncated = view.body.kind === 'text' && view.body.truncated;
  return (
    <View style={{ gap, marginTop: gap }}>
      {truncated ? <Note text={DELIVERABLE_COPY.truncated} /> : null}
      {truncated ? <StudioLink url={view.studioUrl} /> : null}
      {onReport ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button label={REPORT_COPY.action} icon={Flag} variant="ghost" onPress={onReport} />
        </View>
      ) : null}
    </View>
  );
}

function ParagraphGap() {
  const { spacing } = useTokens();
  return <View style={{ height: spacing[DELIVERABLE_PAGE.paragraphGap] }} />;
}

function Page({ id }: { readonly id: string }) {
  const { colours } = useTokens();
  const style = usePageStyle();
  const { query, view, report, client, discovery, role } = useDeliverablePage(id);
  const pull = usePullRefresh(query.refetch);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  if (!view) {
    return (
      <View style={style}>
        <BackButton />
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <LoadingState label={DELIVERABLE_COPY.loading} />
        )}
      </View>
    );
  }
  const text = view.body.kind === 'text' ? view.body : null;
  const renderParagraph: ListRenderItem<string> = ({ item }) =>
    text?.mono ? (
      <Text variant="mono" selectable style={{ textTransform: DELIVERABLE_PAGE.monoCase }}>
        {item}
      </Text>
    ) : (
      <Text level={DELIVERABLE_PAGE.textLevel} selectable>
        {item}
      </Text>
    );
  return (
    <>
      <FlatList
        data={text?.paragraphs ?? []}
        keyExtractor={(_, index) => String(index)}
        renderItem={renderParagraph}
        ItemSeparatorComponent={ParagraphGap}
        ListHeaderComponent={<Head view={view} />}
        ListFooterComponent={
          <Foot view={view} onReport={report ? () => setReporting(report) : null} />
        }
        contentContainerStyle={{ ...style, gap: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={colours[DELIVERABLE_PAGE.spinner]}
            colors={[colours[DELIVERABLE_PAGE.spinner]]}
          />
        }
      />
      <ReportSheet
        target={reporting}
        onClose={() => setReporting(null)}
        client={client}
        discovery={discovery}
        role={role}
      />
    </>
  );
}

export type DeliverableDetailProps = {
  /** The Deliverable id from the route, or null when the route's id is not one. */
  readonly id: string | null;
};

export function DeliverableDetail({ id }: DeliverableDetailProps) {
  const style = usePageStyle();
  if (id === null) {
    return (
      <View style={style}>
        <BackButton />
        <ErrorState error={NOT_A_DELIVERABLE} />
      </View>
    );
  }
  return <Page id={id} />;
}
