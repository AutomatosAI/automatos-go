// A Deliverable in the gallery (handoff §2 'Deliverables' card, D25): the type row (the type's icon
// and word, and 'Run failed' as dot and word on a failed run's report), the serif title, the
// summary's first words and who made it when. The whole card is one button that opens the
// Deliverable (routes.cc.deliverable). No review state and no made-up id: it is opened, never
// decided. Its fields are gallery.ts's; its sizes chrome.ts's.

import type { LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import AudioLines from 'lucide-react-native/icons/audio-lines';
import FileArchive from 'lucide-react-native/icons/file-archive';
import FileChartColumn from 'lucide-react-native/icons/file-chart-column';
import FileCode from 'lucide-react-native/icons/file-code';
import FileIcon from 'lucide-react-native/icons/file';
import FileText from 'lucide-react-native/icons/file-text';
import Film from 'lucide-react-native/icons/film';
import ImageIcon from 'lucide-react-native/icons/image';
import Newspaper from 'lucide-react-native/icons/newspaper';
import Presentation from 'lucide-react-native/icons/presentation';
import Table from 'lucide-react-native/icons/table';

import { useTokens } from '../../styles/theme';
import { Card, StatusPip, Text } from '../../ui';
import { ICON_STROKE } from '../../ui/paint';
import { DELIVERABLES_COPY } from '../strings';
import { DELIVERABLE_CARD } from './chrome';
import type { DeliverableCardView } from './gallery';
import type { DeliverableKind } from './types';

/** One icon per type, after the web's artwork (the handoff's Sheet is a table). */
const KIND_ICONS: Readonly<Record<DeliverableKind, LucideIcon>> = Object.freeze({
  report: FileChartColumn,
  image: ImageIcon,
  document: FileText,
  code: FileCode,
  slide: Presentation,
  spreadsheet: Table,
  blog_post: Newspaper,
  video: Film,
  audio: AudioLines,
  archive: FileArchive,
  file: FileIcon,
});

/** The type's icon and word, and 'Run failed' as dot and word: the card's first row and the page's. */
export function TypeRow({
  view,
}: {
  readonly view: Pick<DeliverableCardView, 'kind' | 'typeWord' | 'failed'>;
}) {
  const { colours } = useTokens();
  const Icon = KIND_ICONS[view.kind];
  return (
    <View style={[styles.row, { gap: DELIVERABLE_CARD.typeGap }]}>
      <Icon
        size={DELIVERABLE_CARD.iconSize}
        color={colours[DELIVERABLE_CARD.iconColour]}
        strokeWidth={ICON_STROKE}
      />
      <Text variant="mono" tone={DELIVERABLE_CARD.typeTone}>
        {view.typeWord}
      </Text>
      <View style={styles.spacer} />
      {view.failed ? <StatusPip status="failed" word={view.failed} /> : null}
    </View>
  );
}

export type DeliverableCardProps = { readonly view: DeliverableCardView };

export function DeliverableCard({ view }: DeliverableCardProps) {
  const router = useRouter();
  const { spacing } = useTokens();
  return (
    <Card
      onPress={() => router.push(view.href)}
      radius={DELIVERABLE_CARD.radius}
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={DELIVERABLES_COPY.openHint}
      style={{
        paddingVertical: DELIVERABLE_CARD.paddingY,
        paddingHorizontal: spacing[DELIVERABLE_CARD.paddingX],
        gap: spacing[DELIVERABLE_CARD.gap],
      }}
    >
      <TypeRow view={view} />
      <Text variant="title" level={DELIVERABLE_CARD.titleLevel}>
        {view.title}
      </Text>
      {view.excerpt ? (
        <Text
          level={DELIVERABLE_CARD.excerptLevel}
          tone={DELIVERABLE_CARD.excerptTone}
          numberOfLines={DELIVERABLE_CARD.excerptLines}
        >
          {view.excerpt}
        </Text>
      ) : null}
      <Text
        variant="mono"
        tone={DELIVERABLE_CARD.metaTone}
        style={{ textTransform: DELIVERABLE_CARD.metaCase }}
      >
        {view.meta}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flexGrow: 1 },
});
