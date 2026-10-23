// The files attached to the message being written, pure (US-009b): each is uploading or ready, in
// the order it was picked, until the message is sent or the chip is removed. A file that was
// refused leaves the list (its toast says why); a file removed while it uploads is dropped, and its
// late answer finds nothing to land on. Only ready files go with the message, and the send waits
// while one is still uploading (composerState's `uploading`).

import type { ChatFile } from '../request';
import { ATTACH_COPY } from '../strings';
import { needsReencode } from './attachments';
import { roomFor } from './picked';

export type AttachmentEntry =
  | {
      readonly key: string;
      readonly name: string;
      readonly image: boolean;
      readonly status: 'uploading';
    }
  | {
      readonly key: string;
      readonly name: string;
      readonly image: boolean;
      readonly status: 'ready';
      readonly file: ChatFile;
    };

export type AttachmentList = readonly AttachmentEntry[];

export type NewAttachment = {
  readonly key: string;
  readonly name: string;
  readonly mime: string;
};

export type AttachmentAction =
  | { readonly type: 'added'; readonly files: readonly NewAttachment[] }
  | { readonly type: 'uploaded'; readonly key: string; readonly file: ChatFile }
  | { readonly type: 'failed'; readonly key: string }
  | { readonly type: 'removed'; readonly key: string }
  /** The message went: its ready files leave; one still uploading (none, as the send waits) stays. */
  | { readonly type: 'sent' };

export const NO_ATTACHMENTS: AttachmentList = Object.freeze([]);

function added(list: AttachmentList, files: readonly NewAttachment[]): AttachmentList {
  const known = new Set(list.map((entry) => entry.key));
  const fresh = files
    .filter((file) => !known.has(file.key))
    .slice(0, roomFor(list.length))
    .map((file): AttachmentEntry => ({
      key: file.key,
      name: file.name,
      image: needsReencode(file.mime, file.name),
      status: 'uploading',
    }));
  return fresh.length > 0 ? [...list, ...fresh] : list;
}

function uploaded(list: AttachmentList, key: string, file: ChatFile): AttachmentList {
  return list.map((entry) =>
    entry.key === key && entry.status === 'uploading'
      ? { key, name: file.filename, image: entry.image, status: 'ready', file }
      : entry,
  );
}

function without(list: AttachmentList, key: string): AttachmentList {
  return list.some((entry) => entry.key === key) ? list.filter((entry) => entry.key !== key) : list;
}

export function attachmentsReducer(list: AttachmentList, action: AttachmentAction): AttachmentList {
  switch (action.type) {
    case 'added':
      return added(list, action.files);
    case 'uploaded':
      return uploaded(list, action.key, action.file);
    case 'failed':
    case 'removed':
      return without(list, action.key);
    case 'sent':
      return list.filter((entry) => entry.status !== 'ready');
  }
}

/** The files that go with the next message, in the order they were picked. */
export function readyFiles(list: AttachmentList): ChatFile[] {
  return list.flatMap((entry) => (entry.status === 'ready' ? [entry.file] : []));
}

export function isUploading(list: AttachmentList): boolean {
  return list.some((entry) => entry.status === 'uploading');
}

/** One chip above the pill: the name, the word for its state (§4.6), what VoiceOver hears. */
export type AttachmentChip = {
  readonly key: string;
  readonly name: string;
  readonly image: boolean;
  readonly uploading: boolean;
  /** 'Uploading…' while it uploads; a ready chip needs no word. */
  readonly word: string | null;
  readonly accessibilityLabel: string;
  readonly removeLabel: string;
};

export function attachmentChips(list: AttachmentList): AttachmentChip[] {
  return list.map((entry) => {
    const uploading = entry.status === 'uploading';
    return {
      key: entry.key,
      name: entry.name,
      image: entry.image,
      uploading,
      word: uploading ? ATTACH_COPY.uploading : null,
      accessibilityLabel: uploading
        ? ATTACH_COPY.uploadingLabel(entry.name)
        : ATTACH_COPY.attachedLabel(entry.name),
      removeLabel: ATTACH_COPY.remove(entry.name),
    };
  });
}
