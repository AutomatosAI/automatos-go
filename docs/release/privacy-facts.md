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

## On the phone: after sign-out and after uninstall

**Draft:** Section 07, "On the phone itself": "The app keeps these in the phone's secure storage
(iOS Keychain, Android Keystore): your sign-in token, or your pairing token for your own server;
the key it uses to check that a notification is genuine; its install ID. It keeps a cache of recent
screens in encrypted storage. It never stores chat text or question text unencrypted. Signing out
or uninstalling removes them. [CHECK: iOS keeps Keychain items after an app is deleted. The app
must clear its secure storage on the first launch after a reinstall, or this sentence is wrong.]"

**Answer:** The sentence is right except for the install ID, which the app keeps on purpose.
Signing out deletes the tokens, the notification key and the cache at once. Uninstalling deletes
the app's files. On an iPhone the Keychain items stay after the app is deleted. If the app is
installed again, its first launch deletes them before anything reads one. The install ID is the
only item kept through both. The list also misses one item: the key that encrypts the app's
storage. Sign-out keeps it, because it is the phone's key and not the person's. A reinstall
deletes it.

**What the code does:**

- **Every keychain item is in one list,** `src/storage/secure-registry.ts` (`SECURE_KEYS`). Each
  item's name is written there and nowhere else:

  | Item | What it holds | Sign-out | Reinstall |
  |---|---|---|---|
  | `automatos.secure-keys.v1` | the names of the items below that are written through the key registry | emptied | deleted |
  | `automatos.storage.mmkv-key.v1` | the AES-256 key of the encrypted store | kept | deleted |
  | `__clerk_client_jwt` (and any other key Clerk asks for) | the hosted sign-in | deleted | deleted |
  | `automatos.paired-server.v1` | your own server's address, this phone's device id and its token | deleted | deleted |
  | `automatos.push-record.v1` | the push row's device id and the key that checks a notification is genuine | deleted | deleted |
  | `automatos.install-id.v1` | a random install ID, no personal data | kept | kept |

  Every item is written with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (`src/lib/secure-store.ts`), so
  it is never in iCloud Keychain and never restored onto another phone. Clerk chooses its own
  key names: its token cache (`src/auth/token-cache.ts`) writes through the key registry
  (`src/lib/secure-keys.ts`), which records each name in the index item before the item is
  written. That way every item can be listed and deleted.
- **One clearing for every way out.** Sign out (hosted Studio), Forget this server and Remove this
  phone all run `clearUserData` (`src/connect/switch.ts`; wired in
  `src/app-state/use-sign-out.ts` and `src/connect/use-server-switch.ts`). So does a session the
  server ends: an expired hosted session, or this phone removed in Studio. In that case it runs
  every step but the first, because push leaves on its own (`onSessionExpired`). The steps, in
  order:
  1. Push leaves. Registration stops, the hosted server is asked to delete this phone's row, and
     the push record, the badge and the delivered notifications are cleared.
  2. The cache of recent screens is cleared, in memory and on the phone.
  3. The stored workspace is cleared.
  4. The provider signs out. Clerk does this first, while its token is still there.
  5. The consent records go.
  6. Every entry of the encrypted store goes except Light / Dark / System and the style (Studio,
     Play, HUD or Same as Studio). This includes the consent records, Play's and HUD's looks, the
     workspace's theme, the "Face ID before approving" setting (back to its default, on) and
     push's notes.
  7. Any copy of a Deliverable the system viewer left in the app's cache is deleted.
  8. Every keychain item that is the person's goes.

  If Clerk cannot be reached, sign-out stops and says so. The person stays signed in, and only
  the cache has been cleared. A store entry or keychain item that cannot be deleted fails the
  sign-out too, after every other step has run. A keychain item that failed stays in the index,
  so the next try deletes it.
- **Two small files of their own:** the install marker (one word, `checked`) and the crash-report
  switch (on or off). Sign-out keeps both; uninstalling deletes them.
- **The first launch after a reinstall** (`src/connect/install-marker.ts`). The marker is in a file
  the phone deletes with the app, so a new install finds no marker. Before anything reads the
  keychain, the app deletes every item in the list by name, so a lost index changes nothing. It
  also deletes every key the index names. Only the install ID is kept. Then the app writes the
  marker. `app/_layout.tsx` shows nothing until this is done. Clerk's sign-in, the paired-server
  read and push all start inside that gate. If the keychain refuses (before the phone's first
  unlock), nothing is deleted and nothing can be read either. The check runs again at the next
  launch.
- **Android:** uninstalling deletes the app's Keystore-backed storage and its files.
  `allowBackup` is false in app.json, so nothing comes back from a backup.
- **What sign-out does not reset at once:** two settings stay in memory until the app is closed:
  the "Face ID before approving" switch and the looks a style is painted with. Their saved copies
  are already deleted, so the next launch starts from the defaults. The looks carry their owner,
  so another account never receives them (`src/styles/play/look-sync.ts`).
- **What stays on the server:** when a hosted session expires, push keeps this phone's row on the
  server, as the push wave designed. The row stays until this phone signs in again or someone
  removes it in Studio. The push record on the phone is deleted with the other keychain items.

**Evidence:**

- `src/release/__tests__/secure-store-audit.test.ts` (US-021j) reads the syntax tree of every
  product file. Every `expo-secure-store` call, every call through the keychain ports and every
  key-registry call must pass a registry key, or a key it was given (an explicit list with
  reasons), and never a literal. No other file spells a registry key. Every entry is used by its
  owner, and Clerk's item is the key `@clerk/expo` asks for. `expo-secure-store` is imported as a
  module only by the two adapters. Every write passes the app's keychain options, and the only
  `keychainAccessible` is `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.
- `src/release/__tests__/user-data.test.ts` (US-021j) runs over a fake keychain and memory
  stores:
  - **Reinstall:** every item is gone but the install ID, with a readable index and with a lost
    one. Clerk's token cache, the device store and the push store read only after the last
    delete.
  - **Sign-out:** push leaves first, Clerk signs out with its item still there, and afterwards
    the keychain holds only the store's key, the empty index and the install ID. The store holds
    only the phone's choices, and the marker is untouched.
  - **Forget this server:** the same, and the paired record goes too.
  - **Clerk offline:** a refused sign-out deletes nothing but the cache.
  - **A session the server ended:** the same clearing, without push's leave.
  - **A store entry that will not delete:** the sign-out fails, but only after the keychain has
    been cleared.
- `src/connect/__tests__/switch.test.ts` (the order), `install-marker.test.ts`,
  `src/session/__tests__/install-gate.test.ts`, `src/auth/__tests__/clerk-provider.test.ts`,
  `src/lib/__tests__/secure-keys.test.ts` and `src/storage/__tests__/encrypted-storage.test.ts`.

**Policy wording:**

- Section 07, add to the list: "the key that encrypts the app's storage on your phone."
- Section 07, in place of "Signing out or uninstalling removes them." and its `[CHECK]`:
  "When you sign out, forget your own server or remove this phone, the app deletes your sign-in
  or pairing token, the notification key, the cache and your settings in the app from the phone,
  except light or dark mode and the style. If you uninstall the app, its storage goes with it.
  On an iPhone, a reinstalled app deletes anything left in the Keychain the first time it opens,
  before it reads any of it. The install ID stays on the phone through sign-out and reinstalling,
  so that pairing again reuses this phone's entry in Studio. It is a random number and contains
  no personal data."

**Owner check:** OT-R7. On the iPhone, signed in to hosted Studio, delete the app and reinstall it
from TestFlight: it opens at Welcome, signed out. Repeat while paired to the VPS: it opens at
Welcome, not paired. Pair it again: Studio's Phones & devices shows the same phone, not a second
one, because the install ID was kept.
