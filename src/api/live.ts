// Live events (PRD-001 §4.4, K5): the board and the questions update while the app is open, through
// ONE GET /api/v1/tasks/stream for the whole app. <LiveEvents /> is mounted once, by the signed-in
// gate (AppGate.tsx), so the stream runs only while someone is signed in; it follows AppState
// (foreground: open; background: closed; back again: refetch, then reopen). The lifecycle is
// live-connection.ts and the frames live-events.ts, both pure and tested; this file only wires.
// Screens never open the stream: they subscribe with useLiveEvent (chat_changed for the open
// conversation, A2) and show useLiveStatus (the Command Centre's STREAMING LIVE, A3).

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAppSession } from '../app-state/session';
import { createLiveController, isForeground } from './live-connection';
import {
  createLiveHub,
  type LiveEventType,
  type LiveHandler,
  type LiveStatus,
} from './live-events';

/** The app's one hub: every subscriber and the status read the one connection. */
export const liveHub = createLiveHub();

/** Opens the one stream for this session; renders nothing. Only the gate mounts it. */
export function LiveEvents(): null {
  const { client, workspace } = useAppSession();
  const queryClient = useQueryClient();
  // the stream is the workspace's (its X-Workspace-ID is sent once, at connect): another one reopens
  const workspaceId = workspace.id;

  useEffect(() => {
    const controller = createLiveController({ client, queryClient, hub: liveHub });
    controller.setForeground(isForeground(AppState.currentState));
    const subscription = AppState.addEventListener('change', (next) =>
      controller.setForeground(isForeground(next)),
    );
    return () => {
      subscription.remove();
      controller.stop();
    };
  }, [client, queryClient, workspaceId]);

  return null;
}

/** Runs `handler` with each event of this type while the calling screen is mounted. */
export function useLiveEvent<T extends LiveEventType>(type: T, handler: LiveHandler<T>): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => liveHub.on(type, (data) => latest.current(data)), [type]);
}

/** 'live' while the stream is open, 'connecting' while it opens, 'offline' otherwise. */
export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(liveHub.onStatus, liveHub.status);
}

export type { LiveEventData, LiveEventType, LiveHandler, LiveStatus } from './live-events';
