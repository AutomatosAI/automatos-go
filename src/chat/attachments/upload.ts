// One attachment's way out (US-009b): an image is re-encoded by expo-image-manipulator FIRST
// (HEIC/HEIF to JPEG, every other image in its own or the nearest format: attachments.ts), so no
// EXIF or GPS metadata leaves the phone; a non-image file goes as chosen. An image is known by its
// type or name, else by its first bytes (a JPEG in Files named 'IMG_0042' comes typed
// octet-stream), and a file whose head cannot be read is refused, never sent unexamined. Then POST
// /api/attachments, multipart, through the foundation's client (D-ONE-CLIENT): the client passes
// FormData through untouched, and Expo's fetch (its transport) encodes a part that has bytes()
// under the part's own name and type (expo/src/winter/fetch/convertFormData.ts; it takes no
// React Native {uri} part). The bytes are read with expo-file-system, after a size check, so a
// file over the server's limit is never loaded. The re-encoded copy is deleted once it is sent.

import { File as DeviceFile } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { ApiClient } from '../../api/client';
import { logger } from '../../lib/logger';
import type { ChatFile } from '../request';
import { CHAT_ROUTES } from '../routes';
import {
  AttachmentRefusedError,
  AttachmentUploadSchema,
  MAX_UPLOAD_BYTES,
  SNIFF_BYTES,
  chatFileOf,
  convertedName,
  reencodeTarget,
  sniffedTarget,
  uploadPart,
  type ReencodeFormat,
  type ReencodeTarget,
} from './attachments';
import type { PickedFile } from './picked';

/** upload_attachment's form field (api/attachments.py `file: UploadFile = File(...)`). */
export const UPLOAD_FIELD = 'file';
/** The type sent for a file the picker could not type: the server detects it from the bytes. */
const UNKNOWN_TYPE = 'application/octet-stream';

const SAVE_FORMATS: Readonly<Record<ReencodeFormat, SaveFormat>> = Object.freeze({
  jpeg: SaveFormat.JPEG,
  png: SaveFormat.PNG,
  webp: SaveFormat.WEBP,
});

/** The file that goes: the picked one, or the re-encoded copy made here (deleted after). */
export type PreparedFile = PickedFile & { readonly reencoded: boolean };

/** Draws the image afresh and saves it in the target format: a new file with no metadata. */
async function reencode(uri: string, format: ReencodeFormat, compress: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  try {
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ format: SAVE_FORMATS[format], compress });
      return saved.uri;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** The file's first bytes, through a handle that is closed whatever the read does. */
function readHead(uri: string): Uint8Array {
  const handle = new DeviceFile(uri).open();
  try {
    return handle.readBytes(SNIFF_BYTES);
  } finally {
    handle.close();
  }
}

/** The target its type or name gives, else the one its head shows; an unreadable head refuses. */
function targetOf(picked: PickedFile): ReencodeTarget | null {
  const declared = reencodeTarget(picked.mime, picked.name);
  if (declared) return declared;
  try {
    return sniffedTarget(readHead(picked.uri));
  } catch (cause) {
    throw new AttachmentRefusedError('unreadable', { cause });
  }
}

/** Every image re-encoded before upload; an image that cannot be drawn is refused, never sent. */
export async function prepareForUpload(picked: PickedFile): Promise<PreparedFile> {
  const target = targetOf(picked);
  if (!target) return { ...picked, reencoded: false };
  try {
    const uri = await reencode(picked.uri, target.format, target.compress);
    return { uri, name: convertedName(picked.name, target), mime: target.mime, reencoded: true };
  } catch (cause) {
    throw new AttachmentRefusedError('unreadable', { cause });
  }
}

/** POST /api/attachments with the prepared file as the `file` part; the answer as a ChatFile. */
export async function postAttachment(
  client: Pick<ApiClient, 'request'>,
  prepared: PickedFile,
  signal?: AbortSignal,
): Promise<ChatFile> {
  const file = new DeviceFile(prepared.uri);
  if (file.size > MAX_UPLOAD_BYTES) throw new AttachmentRefusedError('too_big');
  const part = uploadPart(prepared.name, prepared.mime || UNKNOWN_TYPE, () => file.bytes());
  const body = new FormData();
  // the DOM typing knows only Blob; Expo's fetch encodes any part with bytes() (convertFormData.ts)
  body.append(UPLOAD_FIELD, part as unknown as Blob);
  const upload = await client.request(CHAT_ROUTES.attachments, {
    body,
    schema: AttachmentUploadSchema,
    signal,
  });
  return chatFileOf(upload, prepared.name);
}

function discard(prepared: PreparedFile): void {
  if (!prepared.reencoded) return;
  try {
    new DeviceFile(prepared.uri).delete();
  } catch (error) {
    // the copy is in the cache, which the system clears; the upload's outcome stands
    logger.debug('[chat] a re-encoded attachment was not deleted', error);
  }
}

/** Prepare, then upload; a re-encoded copy is deleted whatever the upload's outcome. */
export async function sendAttachment(
  client: Pick<ApiClient, 'request'>,
  picked: PickedFile,
  signal?: AbortSignal,
): Promise<ChatFile> {
  const prepared = await prepareForUpload(picked);
  try {
    return await postAttachment(client, prepared, signal);
  } finally {
    discard(prepared);
  }
}
