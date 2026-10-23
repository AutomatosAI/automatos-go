import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SERVER, fakeTransport, jsonReply, reply } from '../../api/__tests__/fake-transport';
import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { AttachmentRefusedError, MAX_UPLOAD_BYTES } from '../attachments/attachments';
import type { PickedFile } from '../attachments/picked';

// The native modules, replaced: each records what it was asked, in order, so the test can see the
// re-encode happen before the POST and the copy deleted after it.
const native = vi.hoisted(() => ({
  log: [] as string[],
  sizes: new Map<string, number>(),
  failDraw: false,
  saved: 0,
}));

vi.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  ImageManipulator: {
    manipulate: (uri: string) => ({
      renderAsync: async () => {
        native.log.push(`draw ${uri}`);
        if (native.failDraw) throw new Error('cannot decode');
        return {
          saveAsync: async (options: { format: string; compress: number }) => {
            native.saved += 1;
            const out = `file:///cache/ImageManipulator/out-${native.saved}.${options.format}`;
            native.log.push(`save ${options.format} ${options.compress}`);
            return { uri: out, width: 1, height: 1 };
          },
          release: () => native.log.push('release image'),
        };
      },
      release: () => native.log.push('release context'),
    }),
  },
}));

vi.mock('expo-file-system', () => ({
  File: class {
    readonly uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return native.sizes.get(this.uri) ?? 1024;
    }
    async bytes() {
      native.log.push(`read ${this.uri}`);
      return new Uint8Array([1, 2, 3]);
    }
    delete() {
      native.log.push(`delete ${this.uri}`);
    }
  },
}));

/** A FormData whose parts the test can read (node's own would turn the part into a string). */
class RecordingFormData {
  readonly parts: [string, unknown][] = [];
  append(name: string, value: unknown) {
    this.parts.push([name, value]);
  }
}

const { postAttachment, prepareForUpload, sendAttachment, UPLOAD_FIELD } =
  await import('../attachments/upload');

const ANSWER = {
  attachment_id: 'att-1',
  filename: 'IMG_0042.jpg',
  mime: 'image/jpeg',
  media_type: 'image',
  size_bytes: 3,
};
const HEIC: PickedFile = {
  uri: 'file:///cache/ImagePicker/0B1E.heic',
  name: 'IMG_0042.HEIC',
  mime: 'image/heic',
};
const PDF: PickedFile = {
  uri: 'file:///cache/DocumentPicker/9C2A.pdf',
  name: 'q3-report.pdf',
  mime: 'application/pdf',
};

function clientAnswering(status: number, body: unknown) {
  const transport = fakeTransport(async (request) => {
    native.log.push(`POST ${request.url}`);
    return typeof body === 'string' ? reply(status, body) : jsonReply(status, body);
  });
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => 'ws-1',
    transport,
  });
  return { client, transport };
}

type Part = { name: string; type: string; bytes: () => Promise<Uint8Array> };

function sentPart(body: unknown): [string, Part] {
  expect(body).toBeInstanceOf(RecordingFormData);
  const parts = (body as RecordingFormData).parts;
  expect(parts).toHaveLength(1);
  return parts[0] as [string, Part];
}

describe('upload.ts', () => {
  beforeEach(() => {
    native.log.length = 0;
    native.sizes.clear();
    native.failDraw = false;
    native.saved = 0;
    vi.stubGlobal('FormData', RecordingFormData);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('converts HEIC to JPEG BEFORE the upload, sends the JPEG, then deletes the copy', async () => {
    const { client, transport } = clientAnswering(200, ANSWER);
    const file = await sendAttachment(client, HEIC);

    expect(file).toEqual({
      filename: 'IMG_0042.jpg',
      mediaType: 'image/jpeg',
      attachmentId: 'att-1',
    });
    expect(native.log).toEqual([
      `draw ${HEIC.uri}`,
      'save jpeg 0.9',
      'release image',
      'release context',
      'POST https://api.example.test/api/attachments',
      'delete file:///cache/ImageManipulator/out-1.jpeg',
    ]);
    const request = transport.calls[0];
    expect(request.method).toBe('POST');
    expect(request.headers['Content-Type']).toBeUndefined();
    expect(request.headers.Authorization).toBe('Bearer jwt.token.value');
    const [field, part] = sentPart(request.body);
    expect(field).toBe(UPLOAD_FIELD);
    expect(part).toMatchObject({ name: 'IMG_0042.jpg', type: 'image/jpeg' });
    await part.bytes();
    expect(native.log.at(-1)).toBe('read file:///cache/ImageManipulator/out-1.jpeg');
  });

  it.each([
    [
      { uri: 'file:///a.jpg', name: 'IMG_0001.JPG', mime: 'image/jpeg' },
      'jpeg',
      'image/jpeg',
      'IMG_0001.jpg',
    ],
    [{ uri: 'file:///a.png', name: 'shot.png', mime: 'image/png' }, 'png', 'image/png', 'shot.png'],
    [{ uri: 'file:///a.webp', name: 'b.webp', mime: '' }, 'webp', 'image/webp', 'b.webp'],
  ])('re-encodes every image, a JPEG or PNG too (%o)', async (picked, format, mime, name) => {
    const prepared = await prepareForUpload(picked);
    expect(native.log[0]).toBe(`draw ${picked.uri}`);
    expect(prepared).toMatchObject({ mime, name, reencoded: true });
    expect(prepared.uri).toMatch(new RegExp(`\\.${format}$`));
  });

  it('uploads a non-image file unchanged and deletes nothing it did not make', async () => {
    const { client, transport } = clientAnswering(200, {
      ...ANSWER,
      filename: 'q3-report.pdf',
      mime: 'application/pdf',
      media_type: 'document',
    });
    const file = await sendAttachment(client, PDF);

    expect(file.mediaType).toBe('application/pdf');
    expect(native.log).toEqual(['POST https://api.example.test/api/attachments']);
    const [, part] = sentPart(transport.calls[0].body);
    expect(part).toMatchObject({ name: 'q3-report.pdf', type: 'application/pdf' });
  });

  it('sends an untyped file as octet-stream: the server detects it from the bytes', async () => {
    const { client, transport } = clientAnswering(200, ANSWER);
    await postAttachment(client, { uri: 'file:///notes', name: 'notes', mime: '' });
    expect(sentPart(transport.calls[0].body)[1].type).toBe('application/octet-stream');
  });

  it('refuses an image it cannot draw rather than send it with its metadata', async () => {
    native.failDraw = true;
    const { client, transport } = clientAnswering(200, ANSWER);
    await expect(sendAttachment(client, HEIC)).rejects.toMatchObject({ reason: 'unreadable' });
    expect(transport.calls).toHaveLength(0);
  });

  it('never reads or sends a file over the limit', async () => {
    native.sizes.set(PDF.uri, MAX_UPLOAD_BYTES + 1);
    const { client, transport } = clientAnswering(200, ANSWER);
    const refusal = sendAttachment(client, PDF);
    await expect(refusal).rejects.toBeInstanceOf(AttachmentRefusedError);
    await expect(refusal).rejects.toMatchObject({ reason: 'too_big' });
    expect(transport.calls).toHaveLength(0);
    expect(native.log).toEqual([]);
  });

  it("hands the server's refusal on as the taxonomy's error, and still deletes the copy", async () => {
    const { client } = clientAnswering(400, {
      detail: 'File too large: 60000000 bytes (max 52428800)',
    });
    const refusal = sendAttachment(client, HEIC);
    await expect(refusal).rejects.toBeInstanceOf(ApiError);
    await expect(refusal).rejects.toMatchObject({
      kind: 'server',
      status: 400,
      serverMessage: 'File too large: 60000000 bytes (max 52428800)',
    });
    expect(native.log.at(-1)).toBe('delete file:///cache/ImageManipulator/out-1.jpeg');
  });
});
