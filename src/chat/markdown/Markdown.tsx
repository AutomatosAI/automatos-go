// Auto's answer as formatted text (OT-C8, decided 23 Oct): blocks.ts lexes the markdown (marked,
// GFM) into blocks once per text, and this draws them on the look's tokens: paragraphs in the
// thread's Body 1 (14/1.55), headings on the Title scale, lists with their markers (nested lists
// indent), code blocks and tables (their own files), quotes behind a rule in the border token, and
// a rule as the Divider. No bubble and no box around the words, as the handoff draws Auto's
// answer. Every block's words stay selectable and carry Report this where it is offered.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import { Divider, Text } from '../../ui';
import type { ReportAccessibility } from '../report/report';
import { markdownBlocks, type Block, type ListBlock, type QuoteBlock } from './blocks';
import { CodeBlockView } from './CodeBlockView';
import { InlineText } from './InlineText';
import { headingTextLevel, listMarker } from './look';
import { TableView } from './TableView';

const QUOTE_RULE = 2;
const MARKER_MIN_WIDTH = 14;
const NO_REPORT: ReportAccessibility = Object.freeze({});

type Shared = {
  readonly onLink: (target: WebLinkTarget) => void;
  readonly report: ReportAccessibility;
  /** How deep in lists these blocks sit (a bullet's shape). */
  readonly listDepth: number;
};

function ListView({ list, listDepth, ...shared }: Shared & { readonly list: ListBlock }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space2 }}>
      {list.items.map((item, index) => (
        // a list's items never reorder; a streaming list only adds them
        <View key={index} style={[styles.item, { gap: spacing.space3 }]}>
          <Text
            tone="muted"
            selectable={false}
            style={styles.marker}
            importantForAccessibility={list.ordered ? 'auto' : 'no'}
            accessibilityElementsHidden={!list.ordered}
          >
            {listMarker(list, index, listDepth)}
          </Text>
          <View style={styles.itemBody}>
            <BlockList blocks={item.blocks} listDepth={listDepth + 1} {...shared} />
          </View>
        </View>
      ))}
    </View>
  );
}

function QuoteView({ quote, ...shared }: Shared & { readonly quote: QuoteBlock }) {
  const { colours, spacing } = useTokens();
  return (
    <View style={[styles.quote, { borderLeftColor: colours.border, paddingLeft: spacing.space5 }]}>
      <BlockList blocks={quote.blocks} {...shared} />
    </View>
  );
}

function BlockView({ block, ...shared }: Shared & { readonly block: Block }) {
  const { onLink, report } = shared;
  switch (block.kind) {
    case 'paragraph':
      return <InlineText spans={block.spans} onLink={onLink} report={report} />;
    case 'heading':
      return (
        <InlineText
          spans={block.spans}
          variant="title"
          level={headingTextLevel(block.level)}
          header
          onLink={onLink}
          report={report}
        />
      );
    case 'list':
      return <ListView list={block} {...shared} />;
    case 'code':
      return <CodeBlockView block={block} report={report} />;
    case 'table':
      return <TableView table={block} onLink={onLink} report={report} />;
    case 'quote':
      return <QuoteView quote={block} {...shared} />;
    case 'rule':
      return <Divider />;
  }
}

function BlockList({ blocks, ...shared }: Shared & { readonly blocks: readonly Block[] }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      {blocks.map((block, index) => (
        // blocks never reorder; while a reply streams the last one may change kind (a paragraph
        // that becomes a table), so the kind is part of the key
        <BlockView key={`${index}-${block.kind}`} block={block} {...shared} />
      ))}
    </View>
  );
}

export type MarkdownProps = {
  /** Auto's words as markdown. */
  readonly text: string;
  readonly onLink: (target: WebLinkTarget) => void;
  /** Report this on each block, where the message offers it (report.ts reportAccessibility). */
  readonly report?: ReportAccessibility;
};

export function Markdown({ text, onLink, report = NO_REPORT }: MarkdownProps) {
  const blocks = useMemo(() => markdownBlocks(text), [text]);
  if (blocks.length === 0) return null;
  return <BlockList blocks={blocks} onLink={onLink} report={report} listDepth={0} />;
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start' },
  marker: { minWidth: MARKER_MIN_WIDTH },
  itemBody: { flex: 1, minWidth: 0 },
  quote: { borderLeftWidth: QUOTE_RULE },
});
