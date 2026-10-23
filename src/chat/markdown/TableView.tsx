// A table in Auto's answer (OT-C8): compact Body 3 cells in columns sized from their longest line
// (look.ts columnWidths), the header row bold on the secondary ground, hairline rules in the
// border token between rows and around the table; wider than the thread, it scrolls sideways.

import { useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type TextStyle } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import type { ReportAccessibility } from '../report/report';
import type { Cell, CellAlign, TableBlock } from './blocks';
import { strongSpans } from './inline';
import { InlineText } from './InlineText';
import { TABLE_TEXT_LEVEL, columnWidths } from './look';

const TEXT_ALIGN: Readonly<Record<NonNullable<CellAlign>, TextStyle['textAlign']>> = Object.freeze({
  left: 'left',
  center: 'center',
  right: 'right',
});

type RowProps = {
  readonly cells: readonly Cell[];
  readonly widths: readonly number[];
  readonly align: readonly CellAlign[];
  readonly header: boolean;
  readonly onLink: (target: WebLinkTarget) => void;
  readonly report: ReportAccessibility;
};

function TableRow({ cells, widths, align, header, onLink, report }: RowProps) {
  const { colours, spacing } = useTokens();
  const rule = header
    ? { backgroundColor: colours.secondary }
    : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colours.border };
  return (
    <View style={[styles.row, rule]}>
      {cells.map((cell, index) => {
        const side = align[index];
        return (
          <View
            // a table's cells never reorder
            key={index}
            style={{
              width: widths[index],
              paddingHorizontal: spacing.space4,
              paddingVertical: spacing.space3,
            }}
          >
            <InlineText
              spans={cell}
              level={TABLE_TEXT_LEVEL}
              style={side ? { textAlign: TEXT_ALIGN[side] } : undefined}
              onLink={onLink}
              report={report}
            />
          </View>
        );
      })}
    </View>
  );
}

export type TableViewProps = {
  readonly table: TableBlock;
  readonly onLink: (target: WebLinkTarget) => void;
  readonly report: ReportAccessibility;
};

export function TableView({ table, onLink, report }: TableViewProps) {
  const { colours, radii, spacing } = useTokens();
  const { fontScale } = useWindowDimensions();
  const padding = spacing.space4;
  const widths = useMemo(
    () => columnWidths(table, fontScale, padding),
    [table, fontScale, padding],
  );
  const header = useMemo(() => table.header.map(strongSpans), [table.header]);
  const shared = { widths, align: table.align, onLink, report };
  return (
    <ScrollView horizontal>
      <View style={[styles.table, { borderColor: colours.border, borderRadius: radii.control }]}>
        <TableRow cells={header} header {...shared} />
        {table.rows.map((row, index) => (
          // a table's rows never reorder; a streaming table only adds rows
          <TableRow key={index} cells={row} header={false} {...shared} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row' },
});
