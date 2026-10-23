// Attachments, pure (US-009b; D-COMPOSER): which files are images that must be re-encoded before
// they leave the phone, what the re-encoded file is called and typed, what POST /api/attachments
// answers, the ChatRequest file part and attachment_ids built from that answer, and why a file
// was refused. EVERY raster image is re-encoded by expo-image-manipulator (upload.ts), so no EXIF
// or GPS metadata is sent (lead, 20 Oct; the store privacy labels): HEIC/HEIF becomes JPEG (the
// server's allow-list has no HEIC, D29), PNG and GIF become PNG, WebP stays WebP, every other
// photo format becomes JPEG. SVG is vector text the manipulator cannot draw, and carries no camera
// metadata: it goes as chosen, like every non-image file (PDF, DOCX, XLSX…).

import { z } from 'zod';

import { isApiError } from '../../api/errors';
import { refusalText } from '../cards/actions';
import type { ChatFile } from '../request';
import { ATTACH_COPY } from '../strings';

/** expo-image-manipulator's SaveFormat values (upload.ts maps them; this file imports no Expo). */
export type ReencodeFormat = 'jpeg' | 'png' | 'webp';

export type ReencodeTarget = {
  readonly format: ReencodeFormat;
  readonly mime: string;
  readonly extension: string;
  /** SaveOptions.compress: 1 keeps every pixel; PNG ignores it. */
  readonly compress: number;
};

/** A photo re-encoded once, at a quality that keeps it sharp for Auto to read. */
export const JPEG_QUALITY = 0.9;

const JPEG: ReencodeTarget = Object.freeze({
  format: 'jpeg',
  mime: 'image/jpeg',
  extension: 'jpg',
  compress: JPEG_QUALITY,
});
const PNG: ReencodeTarget = Object.freeze({
  format: 'png',
  mime: 'image/png',
  extension: 'png',
  compress: 1,
});
const WEBP: ReencodeTarget = Object.freeze({
  format: 'webp',
  mime: 'image/webp',
  extension: 'webp',
  compress: JPEG_QUALITY,
});

const HEIC_MIMES: ReadonlySet<string> = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const HEIC_EXTENSIONS: ReadonlySet<string> = new Set(['heic', 'heif', 'hif']);
const SVG_MIME = 'image/svg+xml';
const SVG_EXTENSION = 'svg';
const IMAGE_PREFIX = 'image/';

/** The raster image extensions, by the mime each names (a file whose picker gave no type). */
export const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  heif: 'image/heif',
  hif: 'image/heif',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  avif: 'image/avif',
  dng: 'image/x-adobe-dng',
});

/** Kept as they are: lossless or transparent formats stay lossless. */
const KEEP_FORMAT: Readonly<Record<string, ReencodeTarget>> = Object.freeze({
  'image/png': PNG,
  'image/gif': PNG,
  'image/webp': WEBP,
});

/** The bare type, lower case, without its parameters ('image/HEIC; q=1' → 'image/heic'). */
function bareMime(mime: string | null | undefined): string {
  return (mime ?? '').split(';')[0].trim().toLowerCase();
}

/** The extension after the last dot, lower case; '' when the name has none. */
export function extensionOf(filename: string | null | undefined): string {
  const name = (filename ?? '').trim();
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isHeic(mime: string | null | undefined, filename: string | null | undefined) {
  return HEIC_MIMES.has(bareMime(mime)) || HEIC_EXTENSIONS.has(extensionOf(filename));
}

/** The raster image type the mime or the name says, or null for anything else (SVG included). */
function imageType(mime: string | null | undefined, filename: string | null | undefined) {
  const bare = bareMime(mime);
  if (bare.startsWith(IMAGE_PREFIX) && bare !== SVG_MIME) return bare;
  const extension = extensionOf(filename);
  if (extension === SVG_EXTENSION) return null;
  return IMAGE_EXTENSIONS[extension] ?? null;
}

/** Whether the file is an image that must be re-encoded before upload (no metadata leaves). */
export function needsReencode(
  mime: string | null | undefined,
  filename: string | null | undefined,
) {
  return imageType(mime, filename) !== null;
}

/** What an image is re-encoded as; null for a file that goes as chosen. HEIC is always JPEG. */
export function reencodeTarget(
  mime: string | null | undefined,
  filename: string | null | undefined,
): ReencodeTarget | null {
  const type = imageType(mime, filename);
  if (type === null) return null;
  if (isHeic(mime, filename)) return JPEG;
  return KEEP_FORMAT[type] ?? JPEG;
}

/** The re-encoded file's name: the chosen name with the new extension ('IMG_0042.HEIC' → .jpg). */
export function convertedName(filename: string | null | undefined, target: ReencodeTarget) {
  const name = (filename ?? '').trim();
  const extension = extensionOf(name);
  const stem = extension ? name.slice(0, -(extension.length + 1)) : name;
  return `${stem || ATTACH_COPY.untitledPhoto}.${target.extension}`;
}

// ── The upload's answer, and what goes out with the message ──────────────────────────────────

/** api/attachments.py AttachmentResponse; only what the message needs is kept. */
export const AttachmentUploadSchema = z.object({
  attachment_id: z.string().min(1),
  filename: z.string().catch(''),
  mime: z.string().catch(''),
  media_type: z.string().catch(''),
});

export type AttachmentUpload = z.output<typeof AttachmentUploadSchema>;

/** The web's types for an answer with no mime (multimodal-input.tsx). */
const MEDIA_TYPE_FALLBACK = Object.freeze({
  image: 'image/*',
  document: 'application/octet-stream',
});

/** The uploaded file as it rides on the message: the server's (sanitised) name and its mime. */
export function chatFileOf(upload: AttachmentUpload, sentName: string): ChatFile {
  const fallback =
    upload.media_type === 'image' ? MEDIA_TYPE_FALLBACK.image : MEDIA_TYPE_FALLBACK.document;
  return {
    filename: upload.filename.trim() || sentName,
    mediaType: upload.mime.trim() || fallback,
    attachmentId: upload.attachment_id,
  };
}

/** The ChatRequest file part (chat.py MessagePart); the upload has no url, so none is sent. */
export function filePartOf(file: ChatFile) {
  return {
    type: 'file' as const,
    filename: file.filename,
    mediaType: file.mediaType,
    ...(file.url ? { url: file.url } : {}),
    attachment_id: file.attachmentId,
  };
}

/** The message's attachment_ids, in the order the files were attached. */
export function attachmentIdsOf(files: readonly ChatFile[]): string[] {
  return files.map((file) => file.attachmentId);
}

/** One multipart part: the bytes under the name and type chosen here (upload.ts reads them). */
export type UploadPart = {
  readonly name: string;
  readonly type: string;
  readonly bytes: () => Promise<Uint8Array>;
};

export function uploadPart(name: string, type: string, bytes: () => Promise<Uint8Array>) {
  return Object.freeze({ name, type, bytes }) as UploadPart;
}

// ── Refusals ─────────────────────────────────────────────────────────────────────────────────

/** The server's default limit (validation.py MAX_ATTACHMENT_SIZE): a larger file is not read. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const BYTES_PER_MEGABYTE = 1024 * 1024;
const BAD_REQUEST = 400;
/** validation.py ValidationError's words, as upload_attachment answers them (400 {detail}). */
const TOO_LARGE = /^File too large: \d+ bytes \(max (\d+)\)$/;
const TYPE_NOT_ALLOWED = /^File type not allowed: /;
const EMPTY = /^Empty file$/;

export type LocalRefusal = 'too_big' | 'unreadable';

/** A file the phone refused before anything was sent: over the limit, or an image it can't draw. */
export class AttachmentRefusedError extends Error {
  readonly reason: LocalRefusal;
  readonly maxBytes: number;

  constructor(reason: LocalRefusal, options: { maxBytes?: number; cause?: unknown } = {}) {
    super(`attachment refused on the phone: ${reason}`, { cause: options.cause });
    this.name = 'AttachmentRefusedError';
    this.reason = reason;
    this.maxBytes = options.maxBytes ?? MAX_UPLOAD_BYTES;
  }
}

function megabytes(bytes: number): number {
  return Math.max(1, Math.round(bytes / BYTES_PER_MEGABYTE));
}

function localRefusal(error: AttachmentRefusedError): string {
  return error.reason === 'too_big'
    ? ATTACH_COPY.tooBig(megabytes(error.maxBytes))
    : ATTACH_COPY.unreadable;
}

/** The server's type and size refusals in the kit's words (its limit kept); else refusalText. */
export function uploadRefusalText(error: unknown): string {
  if (error instanceof AttachmentRefusedError) return localRefusal(error);
  if (isApiError(error) && error.status === BAD_REQUEST) {
    const words = (error.serverMessage ?? '').trim();
    const limit = TOO_LARGE.exec(words);
    if (limit) return ATTACH_COPY.tooBig(megabytes(Number(limit[1])));
    if (TYPE_NOT_ALLOWED.test(words)) return ATTACH_COPY.wrongType;
    if (EMPTY.test(words)) return ATTACH_COPY.empty;
  }
  return refusalText(error);
}

/** The toast for a file that did not go: its name, then why. */
export function notAttachedText(filename: string, error: unknown): string {
  return ATTACH_COPY.notAttached(filename, uploadRefusalText(error));
}
