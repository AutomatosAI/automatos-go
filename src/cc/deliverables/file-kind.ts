// How the phone shows a Deliverable's file, pure (D-DELIVERABLES, D25): text inline, an image
// inline, a PDF, DOCX or XLSX in the system viewer (QuickLook on iOS) after an authenticated
// download, and anything else in Studio. The file's MIME type speaks first, then its extension,
// then the artifact type, as the web's preview does (FilePreview inferPreviewType, the Deliverable
// panel's getPreviewTypeForDeliverable). A page (HTML) or an SVG is never drawn as plain text or
// through React Native's Image, which cannot: Studio shows both.

export const FILE_KINDS = ['inline-text', 'inline-image', 'system-viewer', 'unsupported'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/** What the system viewer opens (D25): the copy it downloads keeps this extension. */
export const VIEWER_FORMATS = ['pdf', 'docx', 'xlsx'] as const;
export type ViewerFormat = (typeof VIEWER_FORMATS)[number];

export type FileFacts = {
  readonly artifact_type?: string | null;
  /** The file's MIME type, or its extension as the server stored it ('pdf'). */
  readonly file_type?: string | null;
  readonly file_name?: string | null;
};

const VIEWER_MIMES: ReadonlyMap<string, ViewerFormat> = new Map([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
]);
const VIEWER: ReadonlySet<string> = new Set(VIEWER_FORMATS);
/** What React Native's Image decodes on iOS and Android (no SVG). */
const IMAGES: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic']);
const PROSE: ReadonlySet<string> = new Set(['md', 'markdown', 'txt', 'text']);
/** Text kept as written, line for line, in the mono face. */
const MONO: ReadonlySet<string> = new Set(
  'csv tsv json yaml yml xml log sql sh py js jsx ts tsx css go rb rs java kt swift'.split(' '),
);
const TEXT_MIMES: ReadonlySet<string> = new Set(['application/json', 'application/x-yaml']);
const NOT_TEXT_MIMES: ReadonlySet<string> = new Set(['text/html']);
/** Artifact types whose file the detail answers with as text when its extension says nothing. */
const TEXT_TYPES: ReadonlySet<string> = new Set(['report', 'document', 'code', 'blog_post']);
const EXTENSION = /\.([a-z0-9]{1,8})$/;
const BARE_EXTENSION = /^\.?([a-z0-9]{1,8})$/;

function lower(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** 'Reports/Q3 plan.PDF' → 'pdf'; the stored file type when it is a bare extension; else ''. */
export function extensionOf(facts: FileFacts): string {
  const name = lower(facts.file_name).split('/').pop() ?? '';
  const fromName = EXTENSION.exec(name)?.[1];
  if (fromName) return fromName;
  return BARE_EXTENSION.exec(lower(facts.file_type))?.[1] ?? '';
}

function mimeOf(facts: FileFacts): string {
  const type = lower(facts.file_type);
  return type.includes('/') ? (type.split(';', 1)[0]?.trim() ?? '') : '';
}

function kindOfMime(mime: string): FileKind | null {
  if (!mime) return null;
  if (VIEWER_MIMES.has(mime)) return 'system-viewer';
  if (mime.startsWith('image/'))
    return IMAGES.has(mime.slice('image/'.length)) ? 'inline-image' : 'unsupported';
  if (NOT_TEXT_MIMES.has(mime)) return 'unsupported';
  if (mime.startsWith('text/') || TEXT_MIMES.has(mime)) return 'inline-text';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'unsupported';
  return null; // application/octet-stream and the like say nothing: the extension decides
}

function kindOfExtension(extension: string): FileKind | null {
  if (!extension) return null;
  if (VIEWER.has(extension)) return 'system-viewer';
  if (IMAGES.has(extension)) return 'inline-image';
  if (PROSE.has(extension) || MONO.has(extension)) return 'inline-text';
  return 'unsupported';
}

function kindOfType(type: string): FileKind {
  if (type === 'image') return 'inline-image';
  return TEXT_TYPES.has(type) ? 'inline-text' : 'unsupported';
}

export function fileKind(facts: FileFacts): FileKind {
  return (
    kindOfMime(mimeOf(facts)) ??
    kindOfExtension(extensionOf(facts)) ??
    kindOfType(lower(facts.artifact_type))
  );
}

/** The format the system viewer opens, or null for a file it does not take. */
export function viewerFormat(facts: FileFacts): ViewerFormat | null {
  const fromMime = VIEWER_MIMES.get(mimeOf(facts));
  if (fromMime) return fromMime;
  const extension = extensionOf(facts);
  return VIEWER.has(extension) ? (extension as ViewerFormat) : null;
}

/** Code, data and logs keep their lines in the mono face; prose is shown without its marks. */
export function isMonoText(facts: FileFacts): boolean {
  if (lower(facts.artifact_type) === 'code') return true;
  const mime = mimeOf(facts);
  return MONO.has(extensionOf(facts)) || TEXT_MIMES.has(mime) || mime === 'text/csv';
}
