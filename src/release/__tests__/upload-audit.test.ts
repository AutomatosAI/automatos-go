// R09 as a test that keeps running in CI: a photo leaves the phone without its location. (a) The
// whole product tree, comments removed, is scanned for every way a photo or a file could be got,
// redrawn or sent; each file found is in support/uploads.ts's explicit list with exactly its
// markers, so a second upload path fails with its path. (b) needsReencode marks every photo type,
// typed or known by its extension only, and no document. (c) The pipeline from what a picker hands
// over to the bytes POSTed, with expo-image-manipulator, expo-file-system and the client faked:
// every image sent is the manipulator's new file, and a PDF is sent as chosen.
// src/chat/__tests__/upload.test.ts proves the pipeline's order, refusals and sniffing; it posts a
// HEIC and a PDF but only prepares the JPEG, PNG and WebP, so (c) posts each kind here.

import type { DocumentPickerAsset } from 'expo-document-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../../api/client';
import { needsReencode, reencodeTarget } from '../../chat/attachments/attachments';
import { pickedDocuments, pickedPhotos, type PickedFile } from '../../chat/attachments/picked';
import { CHAT_ROUTES } from '../../chat/routes';
import { stripComments, codeOf } from './support/code';
import { productFiles, readRepoFile } from './support/tree';
import { MARKER_HINT, UPLOAD_MARKERS, UPLOAD_PATHS, markersIn } from './support/uploads';

// ── (a) the scan ─────────────────────────────────────────────────────────────────────────────

const products = productFiles();
const found = products
  .filter((file) => MARKER_HINT.test(readRepoFile(file)))
  .map((file) => ({ file, markers: markersIn(codeOf(file)) }))
  .filter((hit) => hit.markers.length > 0);
const listed = new Map(UPLOAD_PATHS.map((entry) => [entry.file, entry.markers]));
const NOWHERE = ['camera-capture', 'file-system-upload', 'base64-read', 'profile-image'];

describe('(a) every file on a photo’s way out is in the explicit list', () => {
  it('scans the whole product tree', () => {
    expect(products.length).toBeGreaterThan(300);
    expect(products).toContain('src/chat/attachments/upload.ts');
  });

  it('finds no product file the list does not name, or with a marker it is not given', () => {
    const unlisted = found
      .filter(({ file, markers }) => listed.get(file)?.join() !== markers.join())
      .map(
        ({ file, markers }) =>
          `${file}: ${markers.join(', ')} (listed: ${listed.get(file)?.join(', ') ?? 'no'})`,
      );
    expect(unlisted).toEqual([]);
  });

  it('lists no file that is gone or no longer shows its markers (no stale entry)', () => {
    const shown = new Map(found.map((hit) => [hit.file, hit.markers.join()]));
    const stale = UPLOAD_PATHS.filter((entry) => shown.get(entry.file) !== entry.markers.join());
    expect(stale.map((entry) => entry.file)).toEqual([]);
  });

  it('gives each listed file a reason and only known markers, in marker order', () => {
    const ids = UPLOAD_MARKERS.map((marker) => marker.id);
    UPLOAD_PATHS.forEach((entry) => {
      expect(entry.reason.length, entry.file).toBeGreaterThan(20);
      expect(entry.markers, entry.file).toEqual(ids.filter((id) => entry.markers.includes(id)));
    });
  });

  it('builds a multipart body and calls the POST without the re-encode in upload.ts only', () => {
    const holders = (id: string) =>
      UPLOAD_PATHS.filter((entry) => entry.markers.includes(id)).map((entry) => entry.file);
    expect(holders('builds-multipart')).toEqual(['src/chat/attachments/upload.ts']);
    expect(holders('post-attachment')).toEqual(['src/chat/attachments/upload.ts']);
    expect(holders('image-manipulator')).toEqual(['src/chat/attachments/upload.ts']);
    NOWHERE.forEach((id) => expect(holders(id), id).toEqual([]));
  });
});

describe('the markers', () => {
  it.each([
    ['builds-multipart', 'const body = new FormData();'],
    ['form-data', 'if (body instanceof FormData) return body;'],
    ['attachments-route', "attachments: { method: 'POST', path: '/api/attachments' },"],
    ['attachments-call', 'await client.request(CHAT_ROUTES.attachments, { body });'],
    ['post-attachment', 'return postAttachment(client, picked);'],
    ['send-attachment', "import { sendAttachment } from './upload';"],
    ['image-source', "import * as ImagePicker from 'expo-image-picker';"],
    ['image-source', "const camera = await import('expo-camera');"],
    ['image-source', "export { launchCameraAsync } from 'expo-image-picker';"],
    ['image-manipulator', "import { ImageManipulator } from 'expo-image-manipulator';"],
    ['camera-capture', 'const photo = await camera.current?.takePictureAsync();'],
    ['file-system-upload', 'await FileSystem.uploadAsync(url, uri, options);'],
    ['base64-read', 'const text = await new File(uri).base64();'],
    ['base64-read', "launchImageLibraryAsync({ mediaTypes: ['images'], base64: true });"],
    ['base64-read', 'await readAsStringAsync(uri, { encoding: EncodingType.Base64 });'],
    ['profile-image', 'await user.setProfileImage({ file });'],
  ])('%s matches `%s`, and the raw-text hint lets the file through', (id, sample) => {
    expect(markersIn(stripComments('sample.ts', sample))).toContain(id);
    expect(MARKER_HINT.test(sample)).toBe(true);
  });

  it('skips a type-only import of a picker (its types are no way to get a photo)', () => {
    const code = stripComments(
      'picked.ts',
      "import type { ImagePickerAsset } from 'expo-image-picker';",
    );
    expect(markersIn(code)).toEqual([]);
  });

  it('reads code, not comments: a comment naming the route or FormData is no marker', () => {
    const text = [
      '// POST /api/attachments, multipart: the client passes FormData through untouched',
      '/** sendAttachment re-encodes first; postAttachment does not. */',
      "export const note = 'see the composer';",
    ].join('\n');
    expect(markersIn(stripComments('note.ts', text))).toEqual([]);
  });
});

// ── (b) which files are re-encoded ───────────────────────────────────────────────────────────

describe('(b) needsReencode', () => {
  it.each(['image/jpeg', 'image/jpg', 'image/heic', 'image/heif', 'image/png', 'image/webp'])(
    'is true for %s',
    (mime) => {
      expect(needsReencode(mime, 'IMG_0042')).toBe(true);
      expect(reencodeTarget(mime, 'IMG_0042')).not.toBeNull();
    },
  );

  it.each(['jpg', 'jpeg', 'heic', 'heif', 'png', 'webp', 'JPG', 'HEIC'])(
    'is true for a .%s with no mime',
    (extension) => {
      expect(needsReencode('', `IMG_0042.${extension}`)).toBe(true);
      expect(needsReencode(null, `IMG_0042.${extension}`)).toBe(true);
      expect(needsReencode(undefined, `IMG_0042.${extension}`)).toBe(true);
    },
  );

  it.each([
    ['application/pdf', 'q3-report.pdf'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'brief.docx'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'budget.xlsx'],
    ['text/plain', 'notes.txt'],
  ])('is false for %s (%s)', (mime, name) => {
    expect(needsReencode(mime, name)).toBe(false);
    expect(reencodeTarget(mime, name)).toBeNull();
  });
});

// ── (c) the pipeline, from the picker's answer to the bytes POSTed ──────────────────────────

const native = vi.hoisted(() => ({
  log: [] as string[],
  saved: 0,
  pdfHead: Uint8Array.from(Array.from('%PDF-1.7\n%', (char) => char.charCodeAt(0))),
}));

vi.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  ImageManipulator: {
    manipulate: (uri: string) => ({
      renderAsync: async () => {
        native.log.push(`draw ${uri}`);
        return {
          saveAsync: async (options: { format: string }) => {
            native.saved += 1;
            return { uri: `file:///cache/ImageManipulator/out-${native.saved}.${options.format}` };
          },
          release: () => undefined,
        };
      },
      release: () => undefined,
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
      return 2048;
    }
    open() {
      return {
        readBytes: (length: number) => native.pdfHead.slice(0, length),
        close: () => undefined,
      };
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

type Part = { name: string; type: string; bytes: () => Promise<Uint8Array> };
type Sent = { route: unknown; field: string; part: Part };

const { sendAttachment, UPLOAD_FIELD } = await import('../../chat/attachments/upload');

/** The client faked: it records the route and the one multipart part, and answers an upload. */
function recordingClient(sent: Sent[]): Pick<ApiClient, 'request'> {
  const request = async (route: unknown, call?: { body?: unknown }) => {
    native.log.push('POST');
    const [field, part] = (call?.body as RecordingFormData).parts[0] as [string, Part];
    sent.push({ route, field, part });
    return { attachment_id: 'att-1', filename: part.name, mime: part.type, media_type: 'image' };
  };
  return { request } as unknown as Pick<ApiClient, 'request'>;
}

const NOW = new Date(2026, 9, 26, 9, 15, 0);
const pickedPhoto = (asset: Partial<ImagePickerAsset> & { uri: string }): PickedFile =>
  pickedPhotos([{ width: 4032, height: 3024, type: 'image', ...asset }], NOW)[0];
const pickedDocument = (
  asset: Partial<DocumentPickerAsset> & { uri: string; name: string },
): PickedFile => pickedDocuments([{ lastModified: 0, size: 2048, ...asset }], NOW)[0];

const CAMERA_JPEG = pickedPhoto({
  uri: 'file:///cache/ImagePicker/5F2C.jpg',
  mimeType: 'image/jpeg',
});
const LIBRARY_HEIC = pickedPhoto({
  uri: 'file:///cache/ImagePicker/0B1E.heic',
  fileName: 'IMG_0042.HEIC',
  mimeType: 'image/heic',
});
const FILES_PNG = pickedDocument({
  uri: 'file:///cache/DocumentPicker/7A1D-diagram.png',
  name: 'diagram.png',
  mimeType: 'image/png',
});
const FILES_WEBP = pickedDocument({
  uri: 'file:///cache/DocumentPicker/3C9E-banner.webp',
  name: 'banner.webp',
});
const FILES_PDF = pickedDocument({
  uri: 'file:///cache/DocumentPicker/9C2A.pdf',
  name: 'q3-report.pdf',
  mimeType: 'application/pdf',
});

describe('(c) every image POSTed is the manipulator’s output; a PDF goes as chosen', () => {
  beforeEach(() => {
    native.log.length = 0;
    native.saved = 0;
    vi.stubGlobal('FormData', RecordingFormData);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads each picked file as the pickers hand it over', () => {
    expect(CAMERA_JPEG).toEqual({
      uri: 'file:///cache/ImagePicker/5F2C.jpg',
      name: 'photo-20261026-091500.jpg',
      mime: 'image/jpeg',
    });
    expect(LIBRARY_HEIC.mime).toBe('image/heic');
    expect(FILES_PNG.mime).toBe('image/png');
    expect(FILES_WEBP.mime).toBe('image/webp');
    expect(FILES_PDF.mime).toBe('application/pdf');
  });

  it.each([
    ['a camera JPEG', CAMERA_JPEG, 'jpeg', 'image/jpeg', 'photo-20261026-091500.jpg'],
    ['a library HEIC', LIBRARY_HEIC, 'jpeg', 'image/jpeg', 'IMG_0042.jpg'],
    ['a PNG from Files', FILES_PNG, 'png', 'image/png', 'diagram.png'],
    ['a WebP from Files, untyped', FILES_WEBP, 'webp', 'image/webp', 'banner.webp'],
  ])('%s: the redrawn copy is the file sent', async (_label, picked, format, mime, name) => {
    const sent: Sent[] = [];
    await sendAttachment(recordingClient(sent), picked);

    expect(sent).toHaveLength(1);
    const [{ route, field, part }] = sent;
    expect(route).toBe(CHAT_ROUTES.attachments);
    expect(field).toBe(UPLOAD_FIELD);
    expect(part).toMatchObject({ name, type: mime });
    const output = `file:///cache/ImageManipulator/out-1.${format}`;
    expect(native.log).toEqual([`draw ${picked.uri}`, 'POST', `delete ${output}`]);
    await part.bytes();
    expect(native.log.at(-1)).toBe(`read ${output}`);
    expect(native.log).not.toContain(`read ${picked.uri}`);
  });

  it('a PDF from Files: the original file is sent, nothing is drawn or deleted', async () => {
    const sent: Sent[] = [];
    await sendAttachment(recordingClient(sent), FILES_PDF);

    const [{ route, part }] = sent;
    expect(route).toBe(CHAT_ROUTES.attachments);
    expect(part).toMatchObject({ name: 'q3-report.pdf', type: 'application/pdf' });
    expect(native.log).toEqual(['POST']);
    await part.bytes();
    expect(native.log).toEqual(['POST', `read ${FILES_PDF.uri}`]);
  });
});
