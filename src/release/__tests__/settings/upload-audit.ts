// The upload audit's list (upload-audit.test.ts, R09): every product file on a photo's way out,
// and exactly the markers (support/uploads.ts) each is allowed, with its reason. A file that shows
// a marker it is not given fails the audit; one that no longer shows its markers fails it too.

import { frozen } from './types';

export type UploadPath = Readonly<{ file: string; markers: readonly string[]; reason: string }>;

/** Every product file on a photo's way out, and exactly the markers each is allowed. */
export const UPLOAD_PATHS: readonly UploadPath[] = frozen([
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
]);
