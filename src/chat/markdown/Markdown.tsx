// Auto's answer as formatted text (OT-C8, decided 23 Oct): lex.ts lexes the markdown (marked, GFM)
// into blocks once per text, and as a reply streams only the text after its settled blocks, and
// this draws them on the look's tokens: paragraphs in the thread's words (16/24, the web's 16 px,
// D72), headings above them (look.ts headingFace), lists with their markers (a task item's box
// ticked or not; nested lists indent), code blocks and tables (their own files), quotes behind a
// rule in the border token, and a rule as the Divider, 12 pt between blocks (6 inside a list
// item, look.ts blockGap). It is drawn inside Auto's box (AutoMessage). Every block's words stay
// selectable and carry Report this where it is offered. A settled block is the same object frame
// after frame and each block view is memoised, so while a reply streams only its last block is
// drawn again; Markdown itself is memoised, so a saved message is not drawn again while another
// one streams.

import { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import { Divider, Text } from '../../ui';
import type { ReportAccessibility } from '../report/report';
import { MARKDOWN_COPY } from '../strings';
import type { Block, ListBlock, QuoteBlock } from './blocks';
import { CodeBlockView } from './CodeBlockView';
import { InlineText } from './InlineText';
import { lexMarkdown, type MarkdownLex } from './lex';
import { blockGap, headingFace, listMarker } from './look';
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
      {list.items.map((item, index) => {
        // a number and a task's box are heard ('Done', 'Not done'); a bullet is not
        const heard = list.ordered || item.checked !== null;
        return (
          // a list's items never reorder; a streaming list only adds them
          <View key={index} style={[styles.item, { gap: spacing.space3 }]}>
            <Text
              variant="thread"
              tone="muted"
              selectable={false}
              style={styles.marker}
              importantForAccessibility={heard ? 'auto' : 'no'}
              accessibilityElementsHidden={!heard}
              accessibilityLabel={
                item.checked === null ? undefined : MARKDOWN_COPY.taskWords(item.checked)
              }
            >
              {listMarker(list, index, listDepth, item.checked)}
            </Text>
            <View style={styles.itemBody}>
              <BlockList blocks={item.blocks} listDepth={listDepth + 1} {...shared} />
            </View>
          </View>
        );
      })}
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

/** Memoised: a settled block keeps its object while a reply streams, so it is not drawn again. */
const BlockView = memo(function BlockView({
  block,
  ...shared
}: Shared & { readonly block: Block }) {
  const { onLink, report } = shared;
  switch (block.kind) {
    case 'paragraph':
      return <InlineText spans={block.spans} variant="thread" onLink={onLink} report={report} />;
    case 'heading': {
      const face = headingFace(block.level);
      return (
        <InlineText
          spans={block.spans}
          variant={face.variant}
          level={face.level}
          weight={face.weight}
          header
          onLink={onLink}
          report={report}
        />
      );
    }
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
});

function BlockList({ blocks, ...shared }: Shared & { readonly blocks: readonly Block[] }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing[blockGap(shared.listDepth)] }}>
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

/**
 * The text's blocks, lexed once per text; as the text grows, only after what the last lex settled
 * (lex.ts). The last lex is only a head start: the blocks are the same with or without it.
 */
function useBlocks(text: string): readonly Block[] {
  const last = useRef<MarkdownLex | null>(null);
  const lexed = useMemo(() => lexMarkdown(text, last.current), [text]);
  useEffect(() => {
    last.current = lexed;
  }, [lexed]);
  return lexed.blocks;
}

/** Memoised: a saved message's answer is not drawn again while another reply streams. */
export const Markdown = memo(function Markdown({
  text,
  onLink,
  report = NO_REPORT,
}: MarkdownProps) {
  const blocks = useBlocks(text);
  if (blocks.length === 0) return null;
  return <BlockList blocks={blocks} onLink={onLink} report={report} listDepth={0} />;
});

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start' },
  marker: { minWidth: MARKER_MIN_WIDTH },
  itemBody: { flex: 1, minWidth: 0 },
  quote: { borderLeftWidth: QUOTE_RULE },
});
