// The message's attachments (US-009b): it only wires. attachmentsReducer (attachment-list.ts) holds
// the list; each picked file is prepared and uploaded at once (upload.ts), in parallel, and lands
// as ready or leaves with a toast that names it and says why (uploadRefusalText). Removing a chip
// aborts its upload; leaving the screen aborts every upload still out. Nothing is written to the
// phone beyond the re-encoded copies upload.ts deletes (D-CACHE).

import { useCallback, useEffect, useMemo, useReducer, useRef, type Dispatch } from 'react';

import { isAbortError } from '../../api/errors';
import { useApiClient } from '../../app-state/session';
import { logger } from '../../lib/logger';
import { useToast } from '../../ui';
import type { ChatFile } from '../request';
import {
  NO_ATTACHMENTS,
  attachmentChips,
  attachmentsReducer,
  isUploading,
  readyFiles,
  type AttachmentAction,
  type AttachmentChip,
} from './attachment-list';
import { notAttachedText } from './attachments';
import { roomFor, type PickedFile } from './picked';
import { sendAttachment } from './upload';

export type AttachmentsView = {
  readonly chips: readonly AttachmentChip[];
  /** A file is still uploading: the send waits (composerState). */
  readonly uploading: boolean;
  /** The files that go with the next message. */
  readonly ready: readonly ChatFile[];
  /** How many more this message can take. */
  readonly room: number;
  readonly add: (files: readonly PickedFile[]) => void;
  readonly remove: (key: string) => void;
  /** The message went: its files leave the composer. */
  readonly sent: () => void;
};

type Uploads = {
  readonly upload: (key: string, picked: PickedFile) => void;
  readonly abort: (key: string) => void;
};

/** Each upload with its own abort; every one still out is aborted when the screen goes. */
function useUploads(dispatch: Dispatch<AttachmentAction>): Uploads {
  const client = useApiClient();
  const toast = useToast();
  const out = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const running = out.current;
    return () => running.forEach((controller) => controller.abort());
  }, []);
  const upload = useCallback(
    (key: string, picked: PickedFile) => {
      const controller = new AbortController();
      out.current.set(key, controller);
      sendAttachment(client, picked, controller.signal)
        .then((file) => dispatch({ type: 'uploaded', key, file }))
        .catch((error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return;
          logger.warn('[chat] an attachment was not uploaded', error);
          dispatch({ type: 'failed', key });
          toast.show(notAttachedText(picked.name, error));
        })
        .finally(() => out.current.delete(key));
    },
    [client, dispatch, toast],
  );
  const abort = useCallback((key: string) => out.current.get(key)?.abort(), []);
  return { upload, abort };
}

export function useAttachments(): AttachmentsView {
  const [list, dispatch] = useReducer(attachmentsReducer, NO_ATTACHMENTS);
  const { upload, abort } = useUploads(dispatch);
  const nextKey = useRef(0);
  const room = roomFor(list.length);
  const add = useCallback(
    (files: readonly PickedFile[]) => {
      const keyed = files.slice(0, room).map((file) => {
        nextKey.current += 1;
        return { key: `attachment-${nextKey.current}`, file };
      });
      dispatch({
        type: 'added',
        files: keyed.map(({ key, file }) => ({ key, name: file.name, mime: file.mime })),
      });
      keyed.forEach(({ key, file }) => upload(key, file));
    },
    [room, upload],
  );
  const remove = useCallback(
    (key: string) => {
      abort(key);
      dispatch({ type: 'removed', key });
    },
    [abort],
  );
  const sent = useCallback(() => dispatch({ type: 'sent' }), []);
  return useMemo(
    () => ({
      chips: attachmentChips(list),
      uploading: isUploading(list),
      ready: readyFiles(list),
      room,
      add,
      remove,
      sent,
    }),
    [list, room, add, remove, sent],
  );
}
