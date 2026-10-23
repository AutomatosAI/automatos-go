import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import {
  AttachmentRefusedError,
  AttachmentUploadSchema,
  MAX_UPLOAD_BYTES,
  attachmentIdsOf,
  chatFileOf,
  convertedName,
  filePartOf,
  isHeic,
  needsReencode,
  notAttachedText,
  reencodeTarget,
  uploadPart,
  uploadRefusalText,
} from '../attachments/attachments';
import { libraryOptions } from '../attachments/picked';
import { buildChatRequest } from '../request';
import { ATTACH_COPY } from '../strings';

const UPLOAD = {
  attachment_id: '3f0c9a7e-0000-4000-8000-0000000000a1',
  filename: 'IMG_0042.jpg',
  mime: 'image/jpeg',
  media_type: 'image',
  size_bytes: 2_481_337,
};
const REPORT_UPLOAD = {
  attachment_id: '3f0c9a7e-0000-4000-8000-0000000000a2',
  filename: 'q3-report.pdf',
  mime: 'application/pdf',
  media_type: 'document',
  size_bytes: 88_000,
};

describe('isHeic', () => {
  it('reads HEIC and HEIF by mime, whatever the case or parameters', () => {
    expect(isHeic('image/heic', 'IMG_0042')).toBe(true);
    expect(isHeic('image/HEIF', null)).toBe(true);
    expect(isHeic('image/heic-sequence', '')).toBe(true);
    expect(isHeic('image/heif; codec=hevc', undefined)).toBe(true);
  });

  it('reads HEIC and HEIF by extension when the picker gave no type', () => {
    expect(isHeic('', 'IMG_0042.HEIC')).toBe(true);
    expect(isHeic(null, 'scan.heif')).toBe(true);
    expect(isHeic('application/octet-stream', 'burst.hif')).toBe(true);
  });

  it('is false for every other image and file', () => {
    expect(isHeic('image/jpeg', 'IMG_0042.jpg')).toBe(false);
    expect(isHeic('image/png', 'heic.png')).toBe(false);
    expect(isHeic('application/pdf', 'heic-notes.pdf')).toBe(false);
    expect(isHeic('', 'heic')).toBe(false);
  });
});

describe('needsReencode: every image leaves the phone re-encoded (no EXIF or GPS)', () => {
  it.each([
    ['image/jpeg', 'IMG_0042.JPG'],
    ['image/heic', 'IMG_0042.HEIC'],
    ['image/heif', 'IMG_0042.HEIF'],
    ['image/png', 'screenshot.png'],
    ['image/webp', 'banner.webp'],
    ['image/gif', 'loop.gif'],
    ['image/tiff', 'scan.tiff'],
    ['image/bmp', 'old.bmp'],
    ['image/avif', 'photo.avif'],
  ])('%s (%s) is re-encoded', (mime, name) => {
    expect(needsReencode(mime, name)).toBe(true);
  });

  it.each([
    ['', 'IMG_0042.jpeg'],
    ['', 'IMG_0042.heic'],
    ['application/octet-stream', 'screenshot.PNG'],
    [null, 'banner.webp'],
  ])('an image the picker did not type (%s %s) is re-encoded by its extension', (mime, name) => {
    expect(needsReencode(mime, name)).toBe(true);
  });

  it.each([
    ['application/pdf', 'q3-report.pdf'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'brief.docx'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'budget.xlsx'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'deck.pptx'],
    ['text/plain', 'notes.txt'],
    ['text/csv', 'export.csv'],
    ['application/json', 'config.json'],
    ['application/zip', 'bundle.zip'],
    ['', 'README.md'],
  ])('%s (%s) uploads unchanged', (mime, name) => {
    expect(needsReencode(mime, name)).toBe(false);
    expect(reencodeTarget(mime, name)).toBeNull();
  });

  it('leaves SVG as it is: vector text the manipulator cannot draw, with no camera metadata', () => {
    expect(needsReencode('image/svg+xml', 'logo.svg')).toBe(false);
    expect(needsReencode('', 'logo.svg')).toBe(false);
  });
});

describe('reencodeTarget and convertedName', () => {
  it('turns HEIC and HEIF into JPEG, the type the server takes', () => {
    expect(reencodeTarget('image/heic', 'IMG_0042.HEIC')).toMatchObject({
      format: 'jpeg',
      mime: 'image/jpeg',
      extension: 'jpg',
    });
    expect(reencodeTarget('', 'IMG_0042.heif')?.mime).toBe('image/jpeg');
  });

  it('keeps PNG lossless (GIF too), WebP as WebP, and every other photo as JPEG', () => {
    expect(reencodeTarget('image/png', 'a.png')?.format).toBe('png');
    expect(reencodeTarget('image/gif', 'a.gif')?.format).toBe('png');
    expect(reencodeTarget('image/webp', 'a.webp')?.format).toBe('webp');
    expect(reencodeTarget('image/jpeg', 'a.jpg')?.format).toBe('jpeg');
    expect(reencodeTarget('image/tiff', 'a.tif')?.format).toBe('jpeg');
  });

  it('renames the converted file with the new extension and keeps its name', () => {
    const jpeg = reencodeTarget('image/heic', 'IMG_0042.HEIC');
    expect(jpeg).not.toBeNull();
    if (!jpeg) return;
    expect(convertedName('IMG_0042.HEIC', jpeg)).toBe('IMG_0042.jpg');
    expect(convertedName('holiday.2026.heif', jpeg)).toBe('holiday.2026.jpg');
    expect(convertedName('IMG_0042', jpeg)).toBe('IMG_0042.jpg');
    expect(convertedName('  ', jpeg)).toBe(`${ATTACH_COPY.untitledPhoto}.jpg`);
    expect(convertedName(null, jpeg)).toBe(`${ATTACH_COPY.untitledPhoto}.jpg`);
  });
});

describe('the upload answer, the file part and attachment_ids', () => {
  it('reads POST /api/attachments and keeps only what the message needs', () => {
    const upload = AttachmentUploadSchema.parse({ ...UPLOAD, extra: 'ignored' });
    expect(upload).toEqual({
      attachment_id: UPLOAD.attachment_id,
      filename: 'IMG_0042.jpg',
      mime: 'image/jpeg',
      media_type: 'image',
    });
    expect(AttachmentUploadSchema.safeParse({ filename: 'x' }).success).toBe(false);
  });

  it('builds the ChatRequest file part {type, filename, mediaType, attachment_id}', () => {
    const file = chatFileOf(AttachmentUploadSchema.parse(UPLOAD), 'IMG_0042.jpg');
    expect(filePartOf(file)).toEqual({
      type: 'file',
      filename: 'IMG_0042.jpg',
      mediaType: 'image/jpeg',
      attachment_id: UPLOAD.attachment_id,
    });
    expect(filePartOf({ ...file, url: 'https://files.example.test/a1' })).toMatchObject({
      url: 'https://files.example.test/a1',
    });
  });

  it("falls back to the sent name and the web's media types when the answer lacks them", () => {
    const bare = AttachmentUploadSchema.parse({
      attachment_id: 'att-9',
      filename: '',
      mime: '',
      media_type: 'image',
    });
    expect(chatFileOf(bare, 'photo.jpg')).toEqual({
      filename: 'photo.jpg',
      mediaType: 'image/*',
      attachmentId: 'att-9',
    });
    const doc = AttachmentUploadSchema.parse({ attachment_id: 'att-10', media_type: 'document' });
    expect(chatFileOf(doc, 'notes.txt').mediaType).toBe('application/octet-stream');
  });

  it('sends several attachments in order: every file part first, then the words, then the ids', () => {
    const files = [UPLOAD, REPORT_UPLOAD].map((answer) =>
      chatFileOf(AttachmentUploadSchema.parse(answer), answer.filename),
    );
    expect(attachmentIdsOf(files)).toEqual([UPLOAD.attachment_id, REPORT_UPLOAD.attachment_id]);
    const body = buildChatRequest({ text: 'What do these say?', files });
    expect(body.message.parts).toEqual([
      filePartOf(files[0]),
      filePartOf(files[1]),
      { type: 'text', text: 'What do these say?' },
    ]);
    expect(body.message.attachment_ids).toEqual(attachmentIdsOf(files));
  });

  it('makes one multipart part with the chosen name and type over the bytes', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const part = uploadPart('IMG_0042.jpg', 'image/jpeg', async () => bytes);
    expect(part.name).toBe('IMG_0042.jpg');
    expect(part.type).toBe('image/jpeg');
    await expect(part.bytes()).resolves.toBe(bytes);
    expect(Object.isFrozen(part)).toBe(true);
  });
});

describe("a refusal in the kit's words", () => {
  const badRequest = (detail: string) =>
    new ApiError('server', { status: 400, serverMessage: detail });

  it("names the server's size refusal with its limit", () => {
    const text = uploadRefusalText(badRequest('File too large: 62914560 bytes (max 52428800)'));
    expect(text).toBe(ATTACH_COPY.tooBig(50));
    expect(text).not.toMatch(/bytes|62914560/);
  });

  it("says a type the server's allow-list refuses can't be taken, without the server's mime", () => {
    const text = uploadRefusalText(
      badRequest('File type not allowed: application/zip (bundle.zip)'),
    );
    expect(text).toBe(ATTACH_COPY.wrongType);
  });

  it('says an empty file is empty', () => {
    expect(uploadRefusalText(badRequest('Empty file'))).toBe(ATTACH_COPY.empty);
  });

  it("says the phone's own refusals: over the limit, or an image it could not draw", () => {
    expect(uploadRefusalText(new AttachmentRefusedError('too_big'))).toBe(
      ATTACH_COPY.tooBig(MAX_UPLOAD_BYTES / (1024 * 1024)),
    );
    expect(uploadRefusalText(new AttachmentRefusedError('unreadable'))).toBe(
      ATTACH_COPY.unreadable,
    );
  });

  it('shows every other failure through the taxonomy, never server internals', () => {
    expect(uploadRefusalText(new ApiError('network'))).toBe(API_ERROR_COPY.network);
    expect(uploadRefusalText(new ApiError('forbidden', { status: 403 }))).toBe(
      API_ERROR_COPY.forbidden,
    );
    expect(uploadRefusalText(badRequest('Workspace ID required'))).toBe(API_ERROR_COPY.server);
    expect(
      uploadRefusalText(new ApiError('server', { status: 500, serverMessage: 'Upload failed' })),
    ).toBe(API_ERROR_COPY.server);
  });

  it('names the file in the toast, then says why', () => {
    expect(notAttachedText('bundle.zip', badRequest('File type not allowed: x (bundle.zip)'))).toBe(
      ATTACH_COPY.notAttached('bundle.zip', ATTACH_COPY.wrongType),
    );
  });
});

describe('Android: the system photo picker, and no media permission in the build', () => {
  const appJson = JSON.parse(
    readFileSync(path.resolve(__dirname, '../../../app.json'), 'utf8'),
  ) as { expo: { android: { permissions: string[]; blockedPermissions: string[] } } };
  const MEDIA_PERMISSIONS = [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_EXTERNAL_STORAGE',
  ];

  it('asks for none of READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_EXTERNAL_STORAGE', () => {
    const { permissions } = appJson.expo.android;
    for (const permission of MEDIA_PERMISSIONS) expect(permissions).not.toContain(permission);
  });

  it('blocks all three, so no library (expo-image-picker declares READ_EXTERNAL_STORAGE) adds one', () => {
    const { blockedPermissions } = appJson.expo.android;
    for (const permission of MEDIA_PERMISSIONS) expect(blockedPermissions).toContain(permission);
  });

  it("opens expo-image-picker's default system picker, never the legacy one", () => {
    expect(libraryOptions(5).legacy).toBe(false);
  });
});
