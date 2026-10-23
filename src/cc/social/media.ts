// A social post's media, pure (D-SOCIAL): the files the approval view shows, read off the post's
// `media` ({aspect: [Deliverable id | file record]}, modules/socials/credits.py media_entries). A
// render writes file records ({deliverable_id, name, sha256, bytes, content_type}); the post serves
// each one at GET /api/socials/posts/{post_id}/media/{file_name} with the bearer
// (media_store.py valid_file_name). An entry with no file name (a Deliverable id an edit set) has no
// such route, so it is counted and left to Studio. Each file is an image, a video or another file,
// from its content type, else its extension.

import { buildUrl } from '../../api/url';
import { CC_ROUTES } from '../routes';

/** media_store.py FILE_NAME at the pinned SHA, and never a '..'. */
const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,119}$/;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|heic)$/;
const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm)$/;
/** '9:16', '1:1', '16:9', '4:5': width over height. */
const ASPECT = /^(\d+(?:\.\d+)?)[:x](\d+(?:\.\d+)?)$/;
/** A square, when the aspect says nothing usable. */
export const DEFAULT_RATIO = 1;

export type MediaKind = 'image' | 'video' | 'file';

export type MediaFile = {
  /** The aspect it was rendered for ('9:16'), as the post names it. */
  readonly aspect: string;
  readonly name: string;
  readonly kind: MediaKind;
  /** Width over height, for the frame it is drawn in. */
  readonly ratio: number;
};

export type PostMedia = {
  readonly files: readonly MediaFile[];
  /** Entries the post does not serve by name: opened in Studio. */
  readonly elsewhere: number;
};

export function isMediaFileName(value: unknown): value is string {
  return typeof value === 'string' && FILE_NAME.test(value) && !value.includes('..');
}

export function mediaKind(contentType: string | null, name: string): MediaKind {
  const type = contentType?.trim().toLowerCase() ?? '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (IMAGE_EXTENSIONS.test(name)) return 'image';
  if (VIDEO_EXTENSIONS.test(name)) return 'video';
  return 'file';
}

export function aspectRatio(aspect: string): number {
  const match = ASPECT.exec(aspect.trim());
  if (!match) return DEFAULT_RATIO;
  const [width, height] = [Number(match[1]), Number(match[2])];
  return width > 0 && height > 0 ? width / height : DEFAULT_RATIO;
}

function fileOf(aspect: string, entry: unknown): MediaFile | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as { readonly name?: unknown; readonly content_type?: unknown };
  if (!isMediaFileName(record.name)) return null;
  const contentType = typeof record.content_type === 'string' ? record.content_type : null;
  return {
    aspect,
    name: record.name,
    kind: mediaKind(contentType, record.name),
    ratio: aspectRatio(aspect),
  };
}

/** The files in the post's own order, and how many entries only Studio can show. */
export function postMedia(media: Readonly<Record<string, readonly unknown[]>>): PostMedia {
  const entries = Object.entries(media).flatMap(([aspect, list]) =>
    list.map((entry) => ({ aspect, entry })),
  );
  const files = entries.flatMap(({ aspect, entry }) => {
    const file = fileOf(aspect, entry);
    return file ? [file] : [];
  });
  return { files, elsewhere: entries.length - files.length };
}

/** Where the phone loads one file from: the post's media route, sent with the bearer. */
export function mediaUrl(apiUrl: string, postId: string, name: string): string {
  return buildUrl(apiUrl, CC_ROUTES.social.media.path, { post_id: postId, file_name: name });
}

export type MediaFrame = { readonly width: number; readonly height: number };

/** The file's frame in `available` width: its own shape, no taller than `maxHeight` (a 9:16 video). */
export function mediaFrame(available: number, ratio: number, maxHeight: number): MediaFrame {
  const shape = ratio > 0 ? ratio : DEFAULT_RATIO;
  const width = Math.max(available, 0);
  const height = Math.min(width / shape, maxHeight);
  return { width: Math.round(height * shape), height: Math.round(height) };
}
