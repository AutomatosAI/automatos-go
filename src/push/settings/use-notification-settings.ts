// Settings → Notifications' reads and writes: the preference rows (the three push types and the
// digest switch), this phone's digest time, the workspace's redact switch, and Face ID before
// approve or answer. A write is sent at once through the foundation's client and never queued
// offline or retried (D-WRITES; the client's mutations run networkMode 'always', retry off): the
// switch shows the person's choice while it is out, the server's answer then lands in the cache,
// and a failure puts the switch back with the taxonomy's words in a toast. Only wiring: the rows
// are prefs.ts's, the words view-model.ts's.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { userMessage } from '../../api/errors';
import { useAppSession } from '../../app-state/session';
import { usePhoneSecurity, useStepUpSetting } from '../../step-up/use-step-up';
import { useToast } from '../../ui';
import { getPreferences, getWorkspacePush } from '../api';
import { pushQueryKeys } from '../query-keys';
import type { Devices, PreferenceRow, Preferences, WorkspacePush } from '../schemas/server';
import { devicesWith, preferencesAfter } from './cache';
import { saveDigestTime } from './digest';
import { pushTypesOf, savePushType, type PushTypeKey } from './prefs';
import { saveRedact } from './redact';
import { faceIdView, sectionsShown, type Overrides } from './view-model';

type SwitchChange = Readonly<{
  key: PushTypeKey;
  on: boolean;
  rows: readonly PreferenceRow[];
  events: readonly string[];
}>;

function without(overrides: Overrides, key: string): Overrides {
  return Object.fromEntries(Object.entries(overrides).filter(([name]) => name !== key));
}

export function usePreferences() {
  const { client, discovery } = useAppSession();
  return useQuery({
    queryKey: pushQueryKeys.preferences(),
    queryFn: ({ signal }) => getPreferences(client, signal),
    enabled: sectionsShown(discovery).pushTypes,
  });
}

/** The three push types and the digest switch: each a PUT of its events' rows (KP12). */
export function usePushSwitches() {
  const { client } = useAppSession();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [overrides, setOverrides] = useState<Overrides>({});
  const { mutate } = useMutation({
    mutationFn: ({ rows, events, on }: SwitchChange) => savePushType(client, rows, events, on),
    onMutate: ({ key, on }: SwitchChange) => setOverrides((now) => ({ ...now, [key]: on })),
    onSuccess: (_saved, { events, on }: SwitchChange) =>
      queryClient.setQueryData<Preferences>(
        pushQueryKeys.preferences(),
        (cached) => cached && preferencesAfter(cached, events, on),
      ),
    onError: (error: unknown) => show(userMessage(error)),
    onSettled: (_saved, _error, { key }: SwitchChange) => setOverrides((now) => without(now, key)),
  });
  const set = useCallback(
    (preferences: Preferences, key: PushTypeKey, on: boolean) => {
      const events = pushTypesOf(preferences)[key];
      mutate({ key, on, rows: preferences.preferences, events });
    },
    [mutate],
  );
  return { overrides, set };
}

/** This phone's digest time: PATCH its own device row, never another phone's. */
export function useDigestTime() {
  const { client } = useAppSession();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const save = useMutation({
    mutationFn: ({ deviceId, time }: { deviceId: string; time: string }) =>
      saveDigestTime(client, deviceId, time),
    onSuccess: (device) =>
      queryClient.setQueryData<Devices>(
        pushQueryKeys.devices(),
        (cached) => cached && devicesWith(cached, device),
      ),
    onError: (error: unknown) => show(userMessage(error)),
  });
  const { mutate } = save;
  const set = useCallback((deviceId: string, time: string) => mutate({ deviceId, time }), [mutate]);
  return { pendingTime: save.isPending ? (save.variables?.time ?? null) : null, set };
}

/** The workspace's redact switch and the role that may change it (owners and admins). */
export function useRedact() {
  const { client, discovery } = useAppSession();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const query = useQuery({
    queryKey: pushQueryKeys.workspacePush(),
    queryFn: ({ signal }) => getWorkspacePush(client, signal),
    enabled: sectionsShown(discovery).redact,
  });
  const role = query.data?.role;
  const save = useMutation({
    mutationFn: (on: boolean) => saveRedact(client, role, on),
    onSuccess: (saved: boolean) =>
      queryClient.setQueryData<WorkspacePush>(
        pushQueryKeys.workspacePush(),
        (cached) => cached && { ...cached, redactQuestions: saved },
      ),
    onError: (error: unknown) => show(userMessage(error)),
  });
  return {
    query,
    role,
    pending: save.isPending ? (save.variables ?? null) : null,
    set: save.mutate,
  };
}

/** Face ID before approve or answer: turning it off asks first (src/step-up); on asks nothing. */
export function useFaceId() {
  const setting = useStepUpSetting();
  const secure = usePhoneSecurity();
  const [asking, setAsking] = useState(false);
  const { set: setOn } = setting;
  const set = useCallback(
    async (on: boolean) => {
      setAsking(true);
      try {
        await setOn(on);
      } finally {
        setAsking(false);
      }
    },
    [setOn],
  );
  return { on: setting.on, asking, set, view: faceIdView(secure) };
}
