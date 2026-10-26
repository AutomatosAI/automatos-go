// The live transcript (D54, D-ONE-VOICE): the newest turn as two rows, the user's words in quotes
// (the style's sans 15/1.5 in text2) and Auto's (19/1.45 in text) with a 9 x 18 block cursor in the
// accent after them while he streams, blinking each second (step-end, as hudBlink) while loops run
// and lit and still while they may not. It opens with the AI label, the thread's one muted caption
// (D73); before the first words, First open's 'Say or type what you need.' (US-017f). Centred while it fits; past that the newest lines show and the oldest go off the top.
// Given A2's ThreadReport, Auto's saved reply offers Report this (D15) as A2's AutoMessage does: a
// long-press on the line and the 'Report this' accessible action. Never on YOU's line, never while
// he streams, never past the gate (a viewer, a server without report_content).

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { reportAccessibility, type ThreadReport } from '../../../chat/report/report';
import { Text } from '../../../ui';
import { AiLabel } from '../../ai-label';
import { useLayoutSize } from '../../ground/use-size';
import {
  HUD_CORE,
  transcriptAlign,
  transcriptHint,
  transcriptReport,
  transcriptRows,
  type HudTurn,
  type TranscriptRow,
} from './model';
import { useLoop } from './use-loop';
import { useVoiceCore, type VoiceCore } from './use-voice-core';

const { transcript } = HUD_CORE;
const { cursor } = transcript;
/** hudBlink: lit for the first half of each second, dark for the second. */
const LIT_UNTIL = 0.5;

function Cursor({ core }: { readonly core: VoiceCore }) {
  const progress = useLoop(core.loops, cursor.blinkMs);
  const blink = useAnimatedStyle(() => ({ opacity: progress.get() < LIT_UNTIL ? 1 : 0 }));
  return (
    <Animated.View
      style={[
        {
          width: cursor.width,
          height: cursor.height,
          marginLeft: cursor.gap,
          backgroundColor: core.paint.accent,
        },
        blink,
      ]}
    />
  );
}

type ReportPressProps = {
  readonly onReport: (() => void) | undefined;
  readonly children: ReactNode;
};

/** The long-press (A2's ReportPress); not accessible itself, so the line stays one element. */
function ReportPress({ onReport, children }: ReportPressProps) {
  if (!onReport) return children;
  return (
    <Pressable accessible={false} onLongPress={onReport}>
      {children}
    </Pressable>
  );
}

/** Opens Report this on the row, where it is offered (transcriptReport); none otherwise. */
function reportOpener(row: TranscriptRow, report: ThreadReport | undefined) {
  const target = report ? transcriptReport(row, report.allowed) : null;
  return report && target ? () => report.open(target) : undefined;
}

type RowProps = {
  readonly row: TranscriptRow;
  readonly core: VoiceCore;
  readonly onReport: (() => void) | undefined;
};

function Row({ row, core, onReport }: RowProps) {
  const { paint, style } = core;
  const spec = row.who === 'you' ? transcript.you : transcript.auto;
  const face = style.type.body(spec.size, 400, { leading: spec.leading });
  const colour = row.who === 'you' ? paint.text2 : paint.text;
  return (
    <ReportPress onReport={onReport}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={row.label}
        style={styles.row}
        {...reportAccessibility(onReport)}
      >
        {row.text ? (
          <Text selectable style={[face, styles.words, { color: colour }]}>
            {row.text}
          </Text>
        ) : null}
        {row.who === 'auto' && row.cursor ? <Cursor core={core} /> : null}
      </View>
    </ReportPress>
  );
}

/** First open's words while the turn is empty: the user's line's face, in text2. */
function Hint({ turn, core }: { readonly turn: HudTurn; readonly core: VoiceCore }) {
  const hint = transcriptHint(turn);
  if (hint === null) return null;
  const face = core.style.type.body(transcript.you.size, 400, { leading: transcript.you.leading });
  return <Text style={[face, { color: core.paint.text2 }]}>{hint}</Text>;
}

export type TranscriptProps = {
  readonly turn: HudTurn;
  /** Report this on Auto's saved reply (A2's useMessageReport); absent, nothing is offered. */
  readonly report?: ThreadReport;
};

export function Transcript({ turn, report }: TranscriptProps) {
  const core = useVoiceCore();
  const [box, onBoxLayout] = useLayoutSize();
  const [content, onContentLayout] = useLayoutSize();
  const align = box && content ? transcriptAlign(content.height, box.height) : 'center';
  return (
    <View
      onLayout={onBoxLayout}
      style={[
        styles.box,
        {
          paddingHorizontal: transcript.padX,
          justifyContent: align === 'end' ? 'flex-end' : 'center',
        },
      ]}
    >
      <View onLayout={onContentLayout} style={[styles.content, { gap: transcript.gap }]}>
        <AiLabel agent={turn.agent} />
        <Hint turn={turn} core={core} />
        {transcriptRows(turn).map((row) => (
          <Row key={row.who} row={row} core={core} onReport={reportOpener(row, report)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, overflow: 'hidden' },
  content: { flexShrink: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  words: { flexShrink: 1 },
});
