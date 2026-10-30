// Not running (PRD-001 §4.7 Edges, Ember 07, US-017f): the server isn't answering. On the style's
// ground for the screen (Play's dusk light, the glow out; HUD's grid), the brand line dimmed with
// 'Not connected' beside it, Auto asleep at 150 (Play; HUD when the look's auto is on; Studio only
// with a theme's mascot), the title and what to do — for a self-hosted server the command that
// starts it, selectable (KS7) — in HUD's bracket panel under '— NOT ANSWERING' (Arcade: a window
// tabbed so, Auto's sprite asleep at its head, US-022i). Check again (48,
// full width) re-runs the step; a quiet re-check runs every 5 s while the screen is shown
// (useRecheck) and stops when it goes. The words are edges.ts notRunningEdge's.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen, Text } from '../../ui';
import { MASCOT_SIZES } from '../mascot/geometry';
import { Mascot } from '../mascot/Mascot';
import { useStyle } from '../theme';
import { notRunningEdge, type EdgeServer } from './edges';
import { EDGE_METRICS, checkAgainVariant } from './metrics';
import { CommandBox, EdgeAction, EdgeActions, EdgeBrand, EdgePanel, useEdgePaint } from './parts';
import type { RecheckRun } from './recheck';
import { useRecheck } from './use-recheck';

export type NotRunningProps = {
  /** The server that isn't answering: its address, and whether it is the hosted one. */
  readonly server: EdgeServer;
  /** Check again: the step tried again (the gate's Retry re-runs discovery). */
  readonly onRetry: () => void;
  /** The quiet re-check every 5 s; Check again's when omitted. */
  readonly onRecheck?: RecheckRun;
  /** A second way forward under Check again (the gate's Forget this server). */
  readonly secondary?: ReactNode;
};

export function NotRunning({ server, onRetry, onRecheck, secondary }: NotRunningProps) {
  const style = useStyle();
  const paint = useEdgePaint();
  const view = notRunningEdge(server);
  useRecheck(onRecheck ?? onRetry);
  const message = style.type.body(EDGE_METRICS.messageSize, 400, {
    leading: EDGE_METRICS.messageLeading,
  });
  return (
    <Screen scroll ground="not-running" autoState="sleeping">
      <EdgeBrand status={view.status} dimmed />
      <View style={[styles.middle, { gap: EDGE_METRICS.notRunningGap }]}>
        <Mascot size={MASCOT_SIZES.notRunning} state="sleeping" />
        <EdgePanel
          line={view.panel}
          label={view.panelLabel}
          gap={EDGE_METRICS.notRunningGap}
          auto="sleeping"
        >
          <Text
            accessibilityRole="header"
            style={[style.type.display('notRunning'), { color: paint.text }]}
          >
            {view.title}
          </Text>
          <Text style={[message, { color: paint.text2 }]}>{view.message}</Text>
          {view.command !== null && view.commandLabel !== null ? (
            <CommandBox command={view.command} label={view.commandLabel} />
          ) : null}
        </EdgePanel>
      </View>
      <EdgeActions>
        <EdgeAction
          label={view.checkAgain}
          onPress={onRetry}
          variant={checkAgainVariant(style.layout)}
        />
        <Text style={[style.type.body(EDGE_METRICS.recheckSize), { color: paint.text3 }]}>
          {view.recheck}
        </Text>
        {secondary}
      </EdgeActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: EDGE_METRICS.padX },
});
