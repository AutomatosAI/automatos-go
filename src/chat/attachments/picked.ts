// What the three pickers are asked for and what they hand back, pure (US-009b): the options for the
// camera, the photo library and Files, and each picked asset as one PickedFile (a local uri, a
// name, a type). Photos only, never video (the server takes none). The library is the system
// photo picker on both platforms (PHPicker on iOS; Android's photo picker, expo-image-picker's
// default, never the legacy one), which hands over only what was chosen and needs no media
// permission, so the build asks for none (app.json blocks READ_MEDIA_IMAGES / READ_MEDIA_VIDEO /
// READ_EXTERNAL_STORAGE). Metadata is not asked for (exif: false) and is stripped anyway by the
// re-encode before upload (attachments.ts).

import type { DocumentPickerAsset, DocumentPickerOptions } from 'expo-document-picker';
import type { ImagePickerAsset, ImagePickerOptions } from 'expo-image-picker';

import { ATTACH_COPY } from '../strings';
import { IMAGE_EXTENSIONS, extensionOf } from './attachments';

/** One file chosen on the phone, before it is prepared and uploaded. */
export type PickedFile = {
  readonly uri: string;
  readonly name: string;
  /** The picker's type; '' when it gave none (the server detects it from the bytes). */
  readonly mime: string;
};

/**
 * The most files one message carries: resolver.py MAX_IMAGES_PER_REQUEST (20); the server drops
 * images past it with attachment_unavailable, so the phone never offers more.
 */
export const MAX_ATTACHMENTS = 20;

/** Every pick is a still image, at full quality: the one re-encode happens before upload. */
const PHOTO_OPTIONS = Object.freeze({
  mediaTypes: ['images'],
  quality: 1,
  exif: false,
  allowsEditing: false,
  base64: false,
} satisfies ImagePickerOptions);

export function cameraOptions(): ImagePickerOptions {
  return { ...PHOTO_OPTIONS, mediaTypes: [...PHOTO_OPTIONS.mediaTypes] };
}

/** The system photo picker, up to `limit` photos at once, in the order they were tapped. */
export function libraryOptions(limit: number): ImagePickerOptions {
  const selectionLimit = Math.max(1, Math.min(limit, MAX_ATTACHMENTS));
  return {
    ...cameraOptions(),
    allowsMultipleSelection: selectionLimit > 1,
    selectionLimit,
    orderedSelection: true,
    legacy: false,
  };
}

/** Any file in Files; copied into the app's cache so it can be read for the upload. */
export function documentOptions(): DocumentPickerOptions {
  return { type: '*/*', multiple: true, copyToCacheDirectory: true, base64: false };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** 'photo-20261023-083012' (local time), '-2' on from the second of one pick. */
export function untitledName(base: string, now: Date, index: number): string {
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${base}-${day}-${time}${index > 0 ? `-${index + 1}` : ''}`;
}

function photoName(asset: ImagePickerAsset, now: Date, index: number): string {
  const given = (asset.fileName ?? '').trim();
  if (given) return given;
  const extension = extensionOf(asset.uri) || 'jpg';
  return `${untitledName(ATTACH_COPY.untitledPhoto, now, index)}.${extension}`;
}

/** The type a picker gave, or the one the name's extension says for an image. */
function mimeOf(given: string | null | undefined, name: string): string {
  const mime = (given ?? '').trim();
  return mime || (IMAGE_EXTENSIONS[extensionOf(name)] ?? '');
}

/** The camera's or the library's assets: photos only (a video the picker let through is left). */
export function pickedPhotos(
  assets: readonly ImagePickerAsset[] | null | undefined,
  now: Date,
  limit: number = MAX_ATTACHMENTS,
): PickedFile[] {
  return (assets ?? [])
    .filter((asset) => asset.uri && asset.type !== 'video' && asset.type !== 'pairedVideo')
    .slice(0, Math.max(0, limit))
    .map((asset, index) => {
      const name = photoName(asset, now, index);
      return { uri: asset.uri, name, mime: mimeOf(asset.mimeType, name) };
    });
}

/** Files' documents, as many as the message still has room for. */
export function pickedDocuments(
  assets: readonly DocumentPickerAsset[] | null | undefined,
  now: Date,
  limit: number = MAX_ATTACHMENTS,
): PickedFile[] {
  return (assets ?? [])
    .filter((asset) => asset.uri)
    .slice(0, Math.max(0, limit))
    .map((asset, index) => {
      const name = asset.name.trim() || untitledName(ATTACH_COPY.untitledFile, now, index);
      return { uri: asset.uri, name, mime: mimeOf(asset.mimeType, name) };
    });
}

/** What one pick hands over, and how many it chose past the message's room (left behind). */
export type PickResult = { readonly files: readonly PickedFile[]; readonly left: number };

export const NOTHING_PICKED: PickResult = Object.freeze({ files: Object.freeze([]), left: 0 });

export function pickOf(
  chosen: readonly unknown[] | null | undefined,
  files: readonly PickedFile[],
) {
  return { files, left: Math.max(0, (chosen?.length ?? 0) - files.length) } as PickResult;
}

/** How many more a message can take, given what is already attached. */
export function roomFor(attached: number): number {
  return Math.max(0, MAX_ATTACHMENTS - attached);
}
