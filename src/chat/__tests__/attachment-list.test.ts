import { describe, expect, it } from 'vitest';

import {
  NO_ATTACHMENTS,
  attachmentChips,
  attachmentsReducer,
  isUploading,
  readyFiles,
  type AttachmentAction,
  type AttachmentList,
} from '../attachments/attachment-list';
import { MAX_ATTACHMENTS } from '../attachments/picked';
import type { ChatFile } from '../request';
import { ATTACH_COPY } from '../strings';

const PHOTO: ChatFile = {
  filename: 'IMG_0042.jpg',
  mediaType: 'image/jpeg',
  attachmentId: 'att-1',
};
const REPORT: ChatFile = {
  filename: 'q3-report.pdf',
  mediaType: 'application/pdf',
  attachmentId: 'att-2',
};

function run(actions: readonly AttachmentAction[], from: AttachmentList = NO_ATTACHMENTS) {
  return actions.reduce(attachmentsReducer, from);
}

const ADD_TWO: AttachmentAction = {
  type: 'added',
  files: [
    { key: 'a1', name: 'IMG_0042.HEIC', mime: 'image/heic' },
    { key: 'a2', name: 'q3-report.pdf', mime: 'application/pdf' },
  ],
};

describe('attachmentsReducer', () => {
  it('adds picked files as uploading, in order, and the send waits on them', () => {
    const list = run([ADD_TWO]);
    expect(list.map((entry) => [entry.key, entry.status, entry.image])).toEqual([
      ['a1', 'uploading', true],
      ['a2', 'uploading', false],
    ]);
    expect(isUploading(list)).toBe(true);
    expect(readyFiles(list)).toEqual([]);
  });

  it('turns an upload ready under the name the server kept, and lists the ready files in order', () => {
    const list = run([
      ADD_TWO,
      { type: 'uploaded', key: 'a2', file: REPORT },
      { type: 'uploaded', key: 'a1', file: PHOTO },
    ]);
    expect(isUploading(list)).toBe(false);
    expect(readyFiles(list)).toEqual([PHOTO, REPORT]);
    expect(list[0].name).toBe('IMG_0042.jpg');
  });

  it('drops a refused file and a removed one; a late answer for a removed file lands nowhere', () => {
    const list = run([
      ADD_TWO,
      { type: 'failed', key: 'a2' },
      { type: 'removed', key: 'a1' },
      { type: 'uploaded', key: 'a1', file: PHOTO },
    ]);
    expect(list).toEqual([]);
  });

  it('clears the ready files once the message is sent', () => {
    const list = run([
      ADD_TWO,
      { type: 'uploaded', key: 'a1', file: PHOTO },
      { type: 'uploaded', key: 'a2', file: REPORT },
      { type: 'sent' },
    ]);
    expect(list).toEqual([]);
  });

  it('never takes more than a message carries, nor the same key twice', () => {
    const many: AttachmentAction = {
      type: 'added',
      files: Array.from({ length: MAX_ATTACHMENTS + 3 }, (_, index) => ({
        key: `k${index}`,
        name: `scan-${index}.pdf`,
        mime: 'application/pdf',
      })),
    };
    expect(run([many])).toHaveLength(MAX_ATTACHMENTS);
    expect(run([ADD_TWO, ADD_TWO])).toHaveLength(2);
  });

  it('never changes the list it was given', () => {
    const before = run([ADD_TWO]);
    const frozen = Object.freeze(before.map((entry) => Object.freeze({ ...entry })));
    const after = attachmentsReducer(frozen, { type: 'uploaded', key: 'a1', file: PHOTO });
    expect(after).not.toBe(frozen);
    expect(frozen[0].status).toBe('uploading');
    expect(attachmentsReducer(frozen, { type: 'removed', key: 'nope' })).toBe(frozen);
  });
});

describe('attachmentChips', () => {
  it('gives an uploading chip its word and every chip a name VoiceOver reads and a remove label', () => {
    const list = run([ADD_TWO, { type: 'uploaded', key: 'a2', file: REPORT }]);
    expect(attachmentChips(list)).toEqual([
      {
        key: 'a1',
        name: 'IMG_0042.HEIC',
        image: true,
        uploading: true,
        word: ATTACH_COPY.uploading,
        accessibilityLabel: ATTACH_COPY.uploadingLabel('IMG_0042.HEIC'),
        removeLabel: ATTACH_COPY.remove('IMG_0042.HEIC'),
      },
      {
        key: 'a2',
        name: 'q3-report.pdf',
        image: false,
        uploading: false,
        word: null,
        accessibilityLabel: ATTACH_COPY.attachedLabel('q3-report.pdf'),
        removeLabel: ATTACH_COPY.remove('q3-report.pdf'),
      },
    ]);
  });
});
