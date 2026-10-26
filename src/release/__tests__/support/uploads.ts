// The way a photo could leave the phone (R09), as the upload audit reads it: the markers of code
// that gets a photo or a file, redraws one, builds or carries a multipart body, names the
// attachments route or reads a file as text a JSON body could carry, and the explicit list of the
// product files allowed each marker. A product file whose code (comments removed) shows a marker
// the list does not give it fails the audit with its path. Markers no file is given are allowed
// nowhere: a second way out would have to use one of them.

export type UploadMarker = Readonly<{ id: string; pattern: RegExp; what: string }>;

/** A value import (never `import type`), a re-export, a dynamic import or a require of `names`. */
function importOf(names: readonly string[]): RegExp {
  const name = `['"](?:${names.map((each) => each.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})['"]`;
  return new RegExp(
    `\\bimport\\s+(?!type\\b)[^;]*?\\bfrom\\s*${name}|\\bexport\\s[^;]*?\\bfrom\\s*${name}|\\b(?:import|require)\\s*\\(\\s*${name}`,
  );
}

export const IMAGE_SOURCES = [
  'expo-image-picker',
  'expo-document-picker',
  'expo-media-library',
  'expo-camera',
] as const;

export const UPLOAD_MARKERS: readonly UploadMarker[] = [
  { id: 'builds-multipart', pattern: /\bnew\s+FormData\b/, what: 'builds a multipart body' },
  {
    id: 'form-data',
    pattern: /\bFormData\b/,
    what: 'handles a multipart body (builds it, passes it on or types it)',
  },
  { id: 'attachments-route', pattern: /\/api\/attachments\b/, what: 'names the attachments route' },
  {
    id: 'attachments-call',
    pattern: /\b\w*ROUTES\.attachments\b/,
    what: 'calls the attachments route from a route table',
  },
  {
    id: 'post-attachment',
    pattern: /\bpostAttachment\b/,
    what: 'names postAttachment, the POST without the re-encode',
  },
  {
    id: 'send-attachment',
    pattern: /\bsendAttachment\b/,
    what: 'sends a picked file (re-encode first, then the POST)',
  },
  {
    id: 'image-source',
    pattern: importOf(IMAGE_SOURCES),
    what: 'gets a photo or a file from the phone (camera, library, Files)',
  },
  {
    id: 'image-manipulator',
    pattern: importOf(['expo-image-manipulator']),
    what: 'redraws an image (the re-encode)',
  },
  {
    id: 'camera-capture',
    pattern: /\b(?:takePictureAsync|recordAsync)\b/,
    what: "takes a picture or a video with expo-camera's CameraView",
  },
  {
    id: 'file-system-upload',
    pattern: /\b(?:uploadAsync|createUploadTask|FileSystemUploadType)\b/,
    what: "uploads with expo-file-system's own HTTP, outside the API client",
  },
  {
    id: 'base64-read',
    pattern:
      /\.base64(?:Sync)?\s*\(|\bbase64\s*:\s*true\b|\breadAsStringAsync\b|\bEncodingType\.Base64\b/,
    what: 'reads a file or a photo as base64 text, which a JSON body could carry',
  },
  {
    id: 'profile-image',
    pattern: /\bsetProfileImage\b/,
    what: "uploads a profile photo through Clerk's own API",
  },
];

export type UploadPath = Readonly<{ file: string; markers: readonly string[]; reason: string }>;

/** Every product file on a photo's way out, and exactly the markers each is allowed. */
export const UPLOAD_PATHS: readonly UploadPath[] = [
  {
    file: 'src/chat/attachments/upload.ts',
    markers: [
      'builds-multipart',
      'form-data',
      'attachments-call',
      'post-attachment',
      'send-attachment',
      'image-manipulator',
    ],
    reason:
      'the one upload (A2 US-009b): sendAttachment redraws every image with expo-image-manipulator (prepareForUpload), then postAttachment POSTs the redrawn copy as the multipart `file` part',
  },
  {
    file: 'src/chat/attachments/use-attachments.ts',
    markers: ['send-attachment'],
    reason:
      "the composer's attachments hook: every picked file goes out through sendAttachment, never postAttachment",
  },
  {
    file: 'src/chat/attachments/pickers.ts',
    markers: ['image-source'],
    reason:
      "the camera, the system photo picker and Files behind the composer's [+], with picked.ts's options (exif: false, base64: false, photos only)",
  },
  {
    file: 'src/chat/routes.ts',
    markers: ['attachments-route'],
    reason: 'the chat route table: CHAT_ROUTES.attachments is POST /api/attachments',
  },
  {
    file: 'src/api/client.ts',
    markers: ['form-data'],
    reason:
      "the foundation client's multipart helper (US-004a): encodeBody passes a FormData through untouched; it builds none",
  },
  {
    file: 'src/api/transport-types.ts',
    markers: ['form-data'],
    reason: 'types a request body as a JSON string or a FormData',
  },
  {
    file: 'src/connect/scanner/QrScanner.tsx',
    markers: ['image-source'],
    reason:
      "expo-camera's CameraView reads QR codes for pairing; it takes no picture (camera-capture is allowed nowhere)",
  },
];

/**
 * The words some marker's match must contain, read on the raw file. Removing comments can join
 * tokens but never makes an identifier or a string, so a file without one of these cannot show a
 * marker, and only the few files with one are parsed (printing all ~700 takes seconds).
 */
export const MARKER_HINT = new RegExp(
  [
    'FormData',
    'attachments',
    'postAttachment',
    'sendAttachment',
    ...IMAGE_SOURCES,
    'expo-image-manipulator',
    'takePictureAsync',
    'recordAsync',
    'uploadAsync',
    'createUploadTask',
    'FileSystemUploadType',
    'base64',
    'readAsStringAsync',
    'EncodingType',
    'setProfileImage',
  ].join('|'),
);

/** The ids of the markers a piece of code shows, in UPLOAD_MARKERS order. */
export function markersIn(code: string): string[] {
  return UPLOAD_MARKERS.filter((marker) => marker.pattern.test(code)).map((marker) => marker.id);
}
