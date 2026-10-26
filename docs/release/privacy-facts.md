# Privacy facts from the code

This file lists the `[CHECK]`s in the privacy-policy draft
(`reports/mobile-review-2026-10-20/drafts/privacy-policy-automatos-go.md`) that Automatos Go's own
code answers. Each answer describes the app as it ships, with the evidence: file paths and the
tests that keep it true in CI. Gerard uses it to edit the policy before publishing (OT-R3).

Each entry gives:

- **Draft:** the `[CHECK]` and where it is in the draft.
- **Answer:** the short answer.
- **What the code does:** how the app behaves, with the files.
- **Evidence:** the tests (CI runs them on every pull request).
- **Policy wording:** a sentence the policy can use. It says what the code does and nothing broader [D70].
- **Owner check:** what a person still confirms on a phone, in a dashboard or with the server.

Wave A7 adds entries story by story. US-021q completes the file: every `[CHECK]` the code answers,
and the ones only Gerard or the server can answer, each with who answers it.

## Photo location (EXIF GPS)

**Draft:**

- Section 07, the "Photos and files you attach" row: "HEIC photos are converted to JPEG on your
  phone. [CHECK: whether the app removes location data (EXIF GPS) from photos before upload; the
  server keeps whatever the file carries]".
- Appendix A.1 (App Store), "Location · Precise / Coarse: No [CHECK: Yes if photos keep EXIF GPS
  on upload, or if you count Clerk's IP-derived city on sessions]".

**Answer:** Yes, the app removes it. Before a photo is uploaded, the app saves it again as a new
image file from its pixels. The original file's metadata, including its location, is not copied,
and only the new file is sent. This covers every photo, not only HEIC.

**What the code does:**

- **Where a photo comes from.** The composer's [+] offers the camera, the system photo picker and
  Files (`src/chat/attachments/pickers.ts`). Their options are in `src/chat/attachments/picked.ts`:
  photos only, no video, and `exif: false` and `base64: false`, so the picker returns no metadata or
  base64 copy alongside the file. Android uses the system photo picker and asks for no media
  permission (R08).
- **One way out.** Every attachment goes out through `sendAttachment` in
  `src/chat/attachments/upload.ts`, which the composer's hook (`use-attachments.ts`) calls.
  `prepareForUpload` runs first. It redraws every raster image with expo-image-manipulator
  (`renderAsync`, then `saveAsync`) into a new file in the app's cache. `postAttachment` then sends
  that new file to `POST /api/attachments` as the multipart `file` part, through the app's one API
  client. The redrawn copy is deleted after the upload.
- **Which files are redrawn** (`src/chat/attachments/attachments.ts`, `needsReencode` and
  `reencodeTarget`):
  - HEIC and HEIF become JPEG.
  - PNG and GIF become PNG.
  - WebP stays WebP.
  - Every other photo format (JPEG, TIFF, BMP, AVIF, DNG) becomes JPEG at quality 0.9.

  The app knows an image by its type or its file name. If Files gives neither, it reads the file's
  first 32 bytes (`sniffImageMime`), so a photo named without an extension, or named `.svg`, is
  still redrawn.
- **Refused, never sent as it is.** An image the phone cannot draw is not sent, and neither is a
  file whose first bytes cannot be read. A toast names the file and says why ("… wasn't attached. The image couldn't be prepared to send.").
- **The redraw copies no metadata.** expo-image-manipulator encodes the new file from the decoded
  image:
  - On iOS: `UIImage.jpegData` / `pngData`, or SDWebImage's WebP coder
    (`node_modules/expo-image-manipulator/ios/ImageManipulatorUtils.swift`, `imageData(from:format:compression:)`).
  - On Android: `Bitmap.compress` (`node_modules/expo-image-manipulator/android/.../ImageManipulatorModule.kt`, `saveAsync`).

  Neither copies the source file's EXIF or GPS block.
- **Not redrawn:**
  - SVG: vector text the manipulator cannot draw, which carries no camera metadata.
  - Documents (PDF, DOCX, XLSX, text…), which go as chosen. A photo placed inside a PDF or an
    Office document keeps whatever that document carries.
- **No other path.** No other product file builds a multipart body, names or calls the
  attachments route, calls `postAttachment` (the POST without the redraw), reads a file as base64,
  uploads with expo-file-system's own HTTP, takes a picture with expo-camera (the QR scanner only
  reads codes) or sets a Clerk profile photo.

**Evidence:**

- `src/release/__tests__/upload-audit.test.ts`:
  - **(a)** scans the whole product tree (`src/` and `app/`, comments removed) and fails, naming
    the file, when any file outside the explicit list in
    `src/release/__tests__/support/uploads.ts` gets, redraws or sends a file that way.
  - **(b)** `needsReencode` is true for `image/jpeg`, `image/jpg`, `image/heic`, `image/heif`,
    `image/png`, `image/webp` and for those extensions with no type, and false for PDF, DOCX, XLSX
    and plain text.
  - **(c)** with the manipulator, the file system and the client faked, a camera JPEG, a library
    HEIC, a PNG from Files and an untyped WebP from Files each POST the manipulator's new file
    (never the original), and a PDF POSTs the original.
- `src/chat/__tests__/upload.test.ts` (A2 US-009b): HEIC is redrawn before the POST and the copy
  is deleted after it, and an untyped JPEG, an extension-less HEIC and a JPEG named `.svg` are
  known by their bytes. An image that cannot be drawn, or a file whose head cannot be read, posts
  nothing.
- `src/chat/__tests__/attachments.test.ts` (A2 US-009b), "needsReencode: every image leaves the
  phone re-encoded (no EXIF or GPS)", plus the format and file-name rules.
- `src/release/__tests__/permissions.test.ts` (US-021g): no product file passes `exif: true` or
  `legacy: true` to expo-image-picker.

**Policy wording:**

- Section 07, in place of "HEIC photos are converted to JPEG on your phone." and its `[CHECK]`:
  "Before a photo leaves your phone, the app saves it again as a new image without the original's
  metadata, so it carries no location data. HEIC photos become JPEG. Documents, such as PDFs, are
  sent as they are."
- Appendix A.1: "Location · Precise / Coarse: No". Photos are not a reason for Yes, so drop that
  half of the `[CHECK]`. Whether Clerk's IP-derived city on sessions counts is still Gerard's call.

**Owner check:** OT-R6. On the iPhone, with Location on for the Camera, take a photo in the app and
attach a library photo that has GPS data, then send both. Download each stored attachment and run
`exiftool -gps:all -a <file>`: it should show no GPS tags. Repeat on Android. The server stores
what the app sends, so this checks the bytes the server keeps.
