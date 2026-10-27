# Privacy facts from the code

This file lists the `[CHECK]`s in the privacy-policy draft
(`reports/mobile-review-2026-10-20/drafts/privacy-policy-automatos-go.md`) and the Terms draft
(`…/drafts/terms-automatos-go.md`) that Automatos Go's own code answers. Each answer describes the
app as it ships, with the evidence: file paths and the tests that keep it true in CI. Gerard uses
it to edit the policy and the Terms before publishing (OT-R3). The last section lists the
`[CHECK]`s the code cannot answer, with who answers each.

Each entry gives:

- **Draft:** the `[CHECK]` and where it is in the draft.
- **Answer:** the short answer.
- **What the code does:** how the app behaves, with the files.
- **Evidence:** the tests (CI runs them on every pull request).
- **Policy wording:** a sentence the policy can use. It says what the code does and nothing broader [D70].
- **Owner check:** what a person still confirms on a phone, in a dashboard or with the server.

Every answer was read on the merged app (A0–A6 merged; checked 26 Oct). The entries:

1. Photo location (EXIF GPS)
2. On the phone: after sign-out and after uninstall
3. Auto is an AI
4. Report this
5. The consent sheet and a refusal
6. Crash reports
7. Analytics and tracking
8. Photos only, never video
9. Notifications: when the app asks, and what a notification can do
10. Quick-ask: speech recognition and the reply's voice
11. The local network prompt and plain HTTP
12. Clerk on a phone paired with its own server
13. What the Terms draft says about the app
14. The `[CHECK]`s the code cannot answer

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
  | `automatos.storage.mmkv-key.v1` | the AES-256 key of the encrypted store | kept, unless the store could not be emptied | deleted |
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
  the cache has been cleared.

  Sometimes step 6 cannot empty the store: an entry will not delete, or the keychain was locked
  when the app started, so this launch kept its store in memory and never opened the file. Then
  the store's key is deleted too. Without the key, nothing left in the file can be read, and the
  next launch starts a new file.
  - An entry that would not delete still fails the sign-out, because the running app could read
    it until it is closed.
  - A store kept in memory was emptied, so it fails the sign-out only if its key will not delete.
  - A keychain item that cannot be deleted also fails the sign-out, after every other step has
    run. It stays in the index, so the next try deletes it.
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
  - **A store that was not emptied:** the store's key is deleted too. An entry that will not
    delete still fails the sign-out. A store that fell back to memory fails it only if the key
    will not delete.
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

## Auto is an AI

**Draft:** Section 09, "Auto is an AI. Wherever Auto or an agent speaks: Every chat screen and the
voice screen in the app say "Auto is an AI", or "{agent} is an AI" when another agent answers. No
theme, look or setting can hide or recolour this label. An Auto Live call starts with "Hi, this is
Auto, your AI assistant." It reminds you every ten minutes: "Just so you know, I'm an AI
assistant." Quick-ask shows and speaks the same notice at the start and every ten minutes.
Notifications from agents carry an AI badge in their title. [CHECK: these lines match what ships
…]".

**Answer:** Partly. Every way to talk to Auto shows the label, but the draft differs from the app in
four places:

- The label is one small caption [D73].
- It names another agent only in HUD's core and on the voice screen.
- Nothing repeats every ten minutes.
- Auto Live is not in this build.

**What the code does:**

- **The label** is `src/styles/ai-label.tsx` (the foundation's; this wave never edits it). It is
  one muted caption line: "Auto is an AI", or "{agent} is an AI" while another agent answers. Its
  words come from the web's own rule (`src/core/web/lib/ai-label/copy.ts`, vendored). It uses the
  smallest body size (11.5 pt, with Dynamic Type) in the style's muted text colour
  (`src/styles/ai-label-state.ts`). No theme, look or setting changes its words or removes it. A
  look changes its colour as it changes every muted line. Nothing in the app waits for the label or
  locks the composer on it.
- **Where it sits:**
  - **Studio's thread** (home and every conversation): the thread's first row, above the first
    message, which scrolls away with the thread (`src/chat/components/MessageList.tsx`,
    `ThreadCaption`). On home, before the first message, First open opens with the same caption
    (`src/styles/homes/FirstOpenThread.tsx`).
  - **Play's thread:** the first row of the Companion chat (`src/styles/homes/PlayThread.tsx`,
    `PlayThreadCaption`), and First open's.
  - **HUD's home, and the voice screen in every style:** the first line of the core's transcript,
    above YOU and AUTO (`src/styles/hud/core/Transcript.tsx`). When a long reply fills the
    transcript, the oldest lines go off the top, the label first, as a thread's first row
    scrolls away. TYPE's sheet and HOLD TO TALK sit over this core.
  - **The consent sheet**, above its heading (`src/consent/ConsentSheet.tsx`).
- **"{agent} is an AI":** HUD's and the voice screen's transcript name the agent answering while
  its reply streams (the turn's agent-info), else Auto. Studio's and Play's thread caption always
  reads "Auto is an AI".
- **The spoken notice:** quick-ask (hold to talk) says "Hi, this is Auto, your AI assistant."
  before the first spoken reply of a voice session, and never again in that session
  (`src/voice/notice/ai-notice.ts`; D73 took the ten-minute reminder out). It shows on screen as
  the AUTO line above the reply.
- **Auto Live** (the Retell call) is not in this build: no LiveKit or call screen ships, so its
  greeting and reminder are the server's and the next wave's.
- **Notification titles** are written by the server (PRD-266 §4.4). The app registers the
  notification types and shows what the server sends.

**Evidence:**

- `src/release/__tests__/surfaces.test.ts` (US-021k), part (a):
  - It scans the whole product tree (comments removed) for every way to talk to Auto: A2's
    composer, Play's message box, HUD's core and quick-ask.
  - Each file found must be in the explicit list in `src/release/__tests__/support/surfaces.ts`.
  - Its render must reach the label file by file: each file renders the next, and the last renders
    the foundation's `AiLabel`. The label must be the first child of its row.
  - A hook may instead be used only inside a listed screen.
  - Studio's and Play's lists have it as their first row (`ListHeaderComponent`).
  - The composers import nothing from the label.
  - A new surface without the label fails CI.
- `src/styles/__tests__/ai-label.test.ts` (the label's words and face) and
  `src/voice/__tests__/ai-notice.test.ts` (A6: the notice once per session).

**Policy wording:**

- Section 09, in place of the first bullet: "Every chat screen and the voice screen in the app say
  "Auto is an AI" at the top of the conversation. On HUD's screen and the voice screen it says
  "{agent} is an AI" while another agent answers. No theme, look or setting can hide this label or
  change its words."
- In place of the quick-ask sentence: "Quick-ask says "Hi, this is Auto, your AI assistant." before
  its first spoken reply each time you start talking."
- Keep the Auto Live sentences only once Auto Live ships in the app, with what it says then.

**Owner check:** OT-R14 (the WebSummit checklist): in Studio, Play and HUD, the caption is the first
line of a thread and of HUD's transcript; the voice screen shows it; quick-ask's first reply speaks
the greeting once.

## Report this

**Draft:** Section 12, "Every Auto message and every deliverable in the app has **Report this**.
You choose a reason and can add a note. On hosted Studio, the report goes to the workspace owner, as
a notification in Automatos, and to Automatos AI's moderation inbox. … On your own server, the
report goes only to that server's operator." Section 07's "Content reports" row points there.

**Answer:** Yes. Report this is on every saved Auto message the app shows: in Studio's and Play's
thread, in HUD's transcript, and on the voice screen in every style (P001R-AF-1). It is also on every
Deliverable in every style. A reply still being written has no Report this until the server saves
it. The phone sends each report to the server it is connected to. Where a report goes from there is
that server's: the edition rule above is PRD-266's, not the app's.

**What the code does:**

- **Where it is offered:**
  - **Auto's messages in Studio's and Play's thread:** a long-press, or the VoiceOver action
    "Report this", on a saved Auto message (`src/chat/report/report.ts`, `reportTarget`). It is
    never offered on the person's own messages, on a failed reply, or on a reply still streaming
    (it has no id yet). It opens the foundation's one sheet (`src/ui/ReportSheet.tsx`), titled
    "Report this message", through `useMessageReport` in `src/chat/screens/ChatScreen.tsx` and
    `src/styles/homes/PlayHome.tsx`.
  - **Deliverables:** a Deliverable's page in every style. Studio and HUD show it in the page's foot
    (`src/cc/deliverables/DeliverableDetail.tsx`), Play in the bottom row
    (`src/styles/homes/PlayDeliverable.tsx`). Both use `useDeliverablePage`, which builds the target
    in `src/cc/deliverables/detail.ts`.
  - **HUD's home and the voice screen:** a long-press, or the VoiceOver action "Report this", on
    Auto's line in the core's transcript (`src/styles/hud/core/Transcript.tsx`), once that reply is
    saved. The line names its message through `autoMessageId` (`src/styles/hud/core/model.ts`).
    On HUD's home that is the thread's saved reply (`src/styles/homes/hud-turn.ts`). On the voice
    screen, and for a reply heard on HUD's home, it is the voice's own saved reply, found by where
    its turn started (`savedReplyId` in `src/voice/quick-ask/reply-text.ts`), so a typed turn
    after it never takes its place. Both go through A2's `reportTarget`, the same rule as the
    thread. Nothing is offered on the person's own words, on a reply still streaming, or on a
    failure. It opens the same sheet through `useMessageReport` in
    `src/styles/homes/HudHome.tsx` and `src/voice/screen/VoiceScreen.tsx`, mounted beside TYPE's
    sheet, never inside it.
- **Who sees it:** owners, admins and editors (`src/auth/role.ts`), and only when the server's
  discovery document lists `report_content` (`src/api/capabilities.ts`). Viewers never see it.
- **What it sends:** `POST /api/v1/reports` with `target_type` (`message` or `deliverable`),
  `target_id`, one reason (harmful, offensive, inaccurate, privacy or other) and an optional note
  of up to 500 characters, and no other field (`src/api/reports.ts`). It goes through the app's one
  API client to the server the phone is signed in to or paired with. The sheet says "Your
  workspace owner will see this report." The toast says "Thanks. Your report was sent.", or "You
  already reported this. Thanks."
- **Where it goes, per edition** (the server's routing, PRD-266 US-016; D15):
  - **Hosted Studio:** the workspace owner, as a notification in Automatos, and Automatos AI's
    moderation inbox.
  - **Your own server:** its operator only.
  - A crash report the phone sends later can carry the request's method, route and status (`POST
    /api/v1/reports 201`, KR7), never its reason, note or target.
  - The sheet's line names the workspace owner only. On hosted Studio, Automatos AI's moderation
    inbox sees the report too: the policy says so (section 12).

**Evidence:**

- `src/release/__tests__/surfaces.test.ts` (US-021k), part (b):
  - The files that mount the foundation's ReportSheet are exactly the six above (Studio's thread,
    Play's home, HUD's home, the voice screen and the two Deliverable pages). Each one opens it
    through its target's hook.
  - Studio's and Play's threads offer it on Auto's rows (`row.type` `auto`, `target_type`
    `message`), and the Deliverable route opens it in every style (`target_type` `deliverable`).
  - Every surface that can show Auto's messages says what Report this is there. Studio's thread,
    Play's home, HUD's home and the voice screen report. First open shows no message.
  - Only `src/api/reports.ts` uses the reports route, `src/api/routes.ts` is the only file that
    names it, and only the sheet calls `reportContent`.
- `src/chat/__tests__/report.test.ts` (A2 US-009c), `src/ui/__tests__/report.test.ts` (FND-3) and
  `src/cc/__tests__/deliverable-detail.test.ts` (A3 US-013b): the gate, the draft, the payload and
  the toasts.
- P001R-AF-1, HUD's transcript and the voice screen:
  - `src/styles/homes/__tests__/hud-turn.test.ts`: a saved reply's id. None while Auto writes, for
    a turn that ended but is not saved, for a failure or a stop, or for a 65-character id.
  - `src/styles/hud/core/__tests__/model.test.ts`: Report this is on Auto's line only, and only
    once he is done.
  - `src/voice/__tests__/voice-report.test.ts`: the voice's reply over real thread states. None
    until the thread saves it, the voice's own after a typed turn, none for a failure, a stop or an
    id over 64.
  - `src/voice/__tests__/hud-home-voice.test.ts`: HUD's home names the voice's reply, never the
    thread's newest.

**Policy wording:**

- Section 12, first sentence: the draft's "Every Auto message and every deliverable in the app has
  **Report this**." stands. It is true of every saved Auto message in Studio, Play, HUD and on the
  voice screen (P001R-AF-1). A reply gets it once the server saves it.
- Keep the hosted and own-server bullets as they are. The app sends a report only to the server it
  is connected to.

**Owner check:** the device check after PRD-266 W3 is deployed (OT-C7 in the chat wave). On hosted
Studio, report an Auto message and a Deliverable: the owner's notification and the moderation inbox
receive each. On the VPS, the operator receives them and nothing reaches Automatos.

**Owner check, HUD and the voice screen (OT-R16, P001R-AF-1):**

1. In HUD style, on the home, ask Auto something and wait for the reply to finish.
2. Long-press Auto's line in the transcript. The sheet opens, titled "Report this message". Pick a
   reason and send. The toast says "Thanks. Your report was sent."
3. With VoiceOver on, focus Auto's line and swipe up or down to the action "Report this". The same
   sheet opens.
4. Long-press your own words, and Auto's line while the reply is still streaming: nothing opens,
   and VoiceOver lists no "Report this" action on either.
5. Switch to Studio and open the voice screen. Hold to talk, ask something, let the reply finish
   and be spoken, then repeat steps 2 to 4 on its transcript.

## The consent sheet and a refusal

**Draft:** Section 09, "Before your first message, the app shows which AI providers will receive
what you send, and asks you to agree [D23]: "Auto answers using AI models from Anthropic and the
providers your workspace has connected. Your messages are sent to them." The sheet names each
provider, taken from your workspace. If the list changes, the app asks again. Until you agree,
nothing you type, say or attach reaches an AI provider: the app asks before you can use it, and if
you do not agree you can sign out (or forget the server). People with view-only access send
nothing and are not asked. [CHECK: lead decision 20 Oct, connect kit KC11: the sheet gates the
whole app … Gerard can choose a lighter gate (chat and voice only) instead.]" Also "Retell … [CHECK:
… Name Retell in the sheet …]".

**Answer:** The draft's description of the gate matches the app, with two corrections:

- The quoted sentence is not the app's text.
- The sheet names Retell AI whenever the server lists it.

The lighter gate in the `[CHECK]` is not what ships. With it, a person could refuse and chat and
voice would stay off while the rest of the app still works. The app has no 'Not now'. Its only
choices are "Agree and continue", or Sign out (hosted Studio) / Forget this server (own server).

**What the code does:**

- **When it shows** (connect KC11): after sign-in or pairing and the workspace bootstrap, in place
  of every signed-in screen (`app/(app)/_layout.tsx` hands `ConsentSheet` to the gate;
  `src/app-state/gate.ts`, the consent step). It shows only to owners, admins and editors.
  Viewers send nothing and are not asked. A server that lists no provider (an empty
  `ai_providers`) needs no sheet.
- **What it says** (`src/consent/sheet.ts`, `src/consent/strings.ts`):
  - The AI label, then "Before you talk to Auto".
  - Then, for a server that lists its providers: "Auto answers using AI models from {names}. What
    you send to Auto and your agents — messages, answers, notes and attachments — goes to them so
    they can reply."
  - Then the list under "AI providers".
  - The names are the server's own `ai_providers` (`GET /api/workspaces/current`), each once, by
    name (`src/consent/providers.ts`). Nothing is filtered or grouped away, so Retell AI is listed
    whenever the workspace can use Auto Live and the server says so (W3 US-017).
  - A server from before W3 lists none: the sheet names no provider, says "the AI providers this
    workspace uses, for chat and, where it is available, Auto Live voice", and notes "This server
    doesn't list them yet."
- **Agree and continue** saves the agreement on this phone, for this server and workspace, in the
  encrypted store (`src/consent/store.ts`). The record holds the list's fingerprint (the copy
  version and the sorted provider ids), the names shown and the time. Then the app opens.
- **A refusal:** there is no 'Not now'. The one other button is Sign out on hosted Studio, or
  Forget this server on an own server, asked first. Until the person agrees, no signed-in screen
  renders, so nothing reaches Auto, an agent or an AI provider from this phone.
- **Asked again** when the list changes (another fingerprint) or the copy version changes. Sign-out
  deletes the records (step 5 of `clearUserData`, see "On the phone: after sign-out and after
  uninstall").

**Evidence:**

- `src/release/__tests__/surfaces.test.ts` (US-021k), part (c): for a bootstrap listing Anthropic,
  DeepSeek and Retell AI, in either order, through the foundation's schema, the sheet's view-model
  lists all three by name, Retell AI included, says "Anthropic, DeepSeek and Retell AI", and has no
  unlisted note. The way out is Sign out on hosted Studio and Forget this server on an own server.
  The sheet draws every name, opens with the AI label and has no 'Not now', and the signed-in
  gate's consent step is the sheet.
- `src/consent/__tests__/providers.test.ts`, `policy.test.ts`, `store.test.ts`, `memory.test.ts`
  and `consent-gate.test.ts` (A1 US-007b and US-007c): absent, null and empty lists, the
  fingerprint, the record and the gate's order.

**Policy wording:**

- Section 09, the quoted sentence: "Auto answers using AI models from {the providers your
  workspace lists}. What you send to Auto and your agents — messages, answers, notes and
  attachments — goes to them so they can reply."
- Keep "Until you agree, nothing you type, say or attach reaches an AI provider: the app asks
  before you can use it, and if you do not agree you can sign out (or forget the server)." It is
  what the app does. Drop the lighter-gate half of the `[CHECK]`, or change the app first.
- The Retell bullet: "The sheet names Retell AI when your workspace can use Auto Live." Drop its
  `[CHECK]`.

**Owner check:** OT-R14 (the WebSummit checklist): on a fresh sign-in as an owner, the sheet lists
the workspace's providers and nothing else opens before "Agree and continue"; Sign out from the
sheet leaves the phone signed out. On a Business workspace with Auto Live on, Retell AI is in the
list (after W3 is deployed).

## Crash reports

**Draft:**

- Section 07, the "Crash reports" row: "[CHECK: the retention on the Sentry plan; whether reports
  carry a user ID (recommended: no); "Prevent storing of IP addresses" on in Sentry]".
- Section 11, "What the app itself still sends": "crash reports to Sentry (section 07) [CHECK:
  decide whether crash reports stay on, ask first, or switch off when the app is connected to your
  own server …]".
- Appendix A.1: Usage Data · Product Interaction "[CHECK]"; Diagnostics · Crash Data, linked "No
  [CHECK: no user ID set on Sentry events and IP storage off; otherwise Yes]"; Diagnostics ·
  Performance Data "[CHECK: Yes if Sentry performance tracing is on]".
- Appendix A.2: App info and performance · Crash logs "Required [CHECK: Optional if the app gets a
  crash-report switch]".

**Answer:** Reports carry no user, and the app attaches no IP address. Breadcrumbs record no taps,
screens, typing or console lines. There is no performance data. A switch turns reports off, so
Play's Crash logs is Optional. Reports work the same on hosted Studio and on an own server. The
retention and Sentry's own IP setting are in Sentry (OT-R1).

**What the code does:**

- **Where they go.** `buildSentryOptions` (`src/observability/options.ts`) starts Sentry only with a
  DSN from `EXPO_PUBLIC_SENTRY_DSN` whose host ends `.ingest.de.sentry.io` (Sentry's EU region), and
  only while the switch is on. Any other DSN, or none, sends nothing. The build hook
  `scripts/check-release-env.js` fails a production build whose DSN is not in the EU.
- **No user, and no IP address from the app.** `sendDefaultPii` is false. The app never calls
  `Sentry.setUser`, and `scrubEvent` (`src/observability/scrub.ts`) deletes `event.user` (id, email,
  username and IP address) from every event. Whether Sentry stores the address the request came from
  is a project setting, "Prevent storing of IP addresses" (OT-R1).
- **What is removed.** `scrubEvent` and `scrubBreadcrumb` remove chat text, question text,
  notification payloads and keys, call and chat ids and tokens. `redactText` (`redact.ts`) replaces
  tokens, keys, email addresses, URLs with a host (a self-hosted server's address included), UUIDs
  and long quoted text in every message. A request breadcrumb keeps only its method, its path
  template and its status (`paths.ts`).
- **Breadcrumbs.** Console, touch, click, input and navigation breadcrumbs are dropped
  (`breadcrumbs.ts`, `DROPPED_CATEGORIES`). There is no `Sentry.wrap` (its touch boundary records
  taps) and no navigation integration (screen names). On iOS, `enableAutoBreadcrumbTracking` and
  `enableNetworkBreadcrumbs` are off, so a native crash carries no screen titles or request URLs. At
  most 30 breadcrumbs are kept.
- **No performance data.** `tracesSampleRate` is 0. Auto-performance, app-start, frame, stall and
  user-interaction tracing are off, there is no profiler, and no request carries a trace header.
- **Nothing else.** No session tracking (a session records every launch), no screenshots, no view
  hierarchy, no replays, no capture of failed requests and no logs.
- **The switch.** Settings → Privacy & legal → "Send crash reports", on by default
  (`src/observability/crash-setting.ts`). Turning it off closes Sentry at once (`Sentry.close()`),
  and nothing more is sent. Turning it on starts Sentry again. The choice is one word in a small file
  of its own, deleted with the app. While the switch is on, "Send a test error report" sends one
  sample report with planted fake fields (`TEST_REPORT_PROBES`), so the owner can see them removed in
  Sentry.
- **On an own server.** Crash reporting does not depend on the server. A paired phone sends crash
  reports to the same Sentry project, under the same switch, scrubbed the same way, and the server's
  address is redacted. The app neither asks first nor switches off on an own server: that is
  Gerard's call (last section).
- **Native crashes.** A crash written by the iOS or Android Sentry SDK never passes `beforeSend`. It
  carries the app's own breadcrumbs, scrubbed when they were added, and Sentry's random installation
  id, which is not tied to the account.

**Evidence:**

- `src/observability/__tests__/options.test.ts` (every option above), `scrub.test.ts` on the planted
  `__fixtures__/sample-event.json`, `redact.test.ts` and `paths.test.ts` (US-021b).
- `crash-reporting.test.ts` and `crash-setting.test.ts` (US-021c): init once; nothing without an EU
  DSN or with the switch off; close when it goes off; `setUser` and `wrap` never called; the test
  report. `wiring.test.ts`: `src/observability/index.ts` is the only product file that loads
  `@sentry/react-native`.
- `src/release/__tests__/privacy-section.test.ts` (US-021d): the switch's rows and words.
- `src/release/__tests__/privacy-labels.test.ts` (US-021e): Crash Data collected and not linked;
  Performance Data and Product Interaction not collected.

**Policy wording:**

- Section 07, the Crash reports row's last cell, in place of its `[CHECK]`: "Reports carry no user
  ID, and the app sends no IP address with them. Sentry keeps them for {the plan's retention}. You
  can turn them off in Settings → Privacy & legal → Send crash reports." Keep the IP sentence only
  once OT-R1 has turned on "Prevent storing of IP addresses".
- The same row, its third cell: "… and the app's last steps before the error" becomes "… and the
  app's last steps before the error, such as a request's route and result (never your words, the
  screens you opened or what you tapped)".
- Section 11: "crash reports to Sentry (section 07), unless you turned them off in Settings". Drop
  the `[CHECK]`, or change the app first.
- Appendix A.1: Product Interaction No; Crash Data Yes, not linked; Performance Data No
  (`app-store-privacy.md`). Appendix A.2: Crash logs Optional (`play-data-safety.md`).

**Owner check:** OT-R1: the Sentry project, its IP setting and retention, a test report and the
first native crash, each seen scrubbed. The WebSummit checklist (OT-R14) repeats the test report.

## Analytics and tracking

**Draft:** Section 06, "It has no ads, no third-party advertising trackers and no analytics
trackers. [CHECK: no analytics SDK in the build; PRD-001 §4.2 lists none.]", and section 07, "The
app does not track you across other companies' apps or websites."

**Answer:** True. No analytics, advertising, attribution or tracking SDK is installed, tracking is
off, and since this story no SDK in the app sends usage telemetry. This story found one that did:
Clerk's own SDK telemetry, sent to clerk-telemetry.com when the build's publishable key is a
development key. It is now off (an audit fix).

**What the code does:**

- **Installed packages.** None of Firebase, Segment, Amplitude, Mixpanel, PostHog, Datadog,
  Bugsnag, Instabug, New Relic, AppsFlyer, Adjust, Branch, the Facebook SDKs, App Tracking
  Transparency, Google Mobile Ads, AdMob or Application Insights is declared or installed, nested
  packages included. `@sentry/react-native` is the only crash or error SDK, and it records no usage
  ("Crash reports").
- **No tracking.** app.json has no `NSUserTrackingUsageDescription`. Its privacy manifest says
  `NSPrivacyTracking` false and lists no tracking domains. The app never asks for the advertising
  identifier.
- **Clerk's telemetry (AUDIT FIX in this story).** With a development key (`pk_test_`), clerk-js
  builds a telemetry collector (`@clerk/shared`'s `TelemetryCollector` is on only for a development
  instance). It posts which Clerk hooks and components ran, the SDK version and the publishable key
  to clerk-telemetry.com. The WebSummit build may use a development key (`testflight.md`, "The
  Clerk key for the WebSummit build"). `src/auth/AuthRoot.tsx` now passes `telemetry={false}` to the
  hosted `ClerkProvider`, and clerk-js builds no collector (its `load()` builds one only when
  `options.telemetry` is not false). A production key never sent it.
- **Clerk's native iOS SDK** (ClerkKit) is linked by `@clerk/expo` but never set up. Its view
  factory comes from Clerk's config plugin, which the app does not use (CLAUDE.md, Traps), so
  `ClerkExpo.configure` refuses and the native SDK makes no request.
- **The hosts the app talks to** are listed in the App Privacy Report check of
  `websummit-checklist.md`.

**Evidence:**

- `src/release/__tests__/dependency-audit.test.ts` (US-021a): the denylist over `package.json` and
  every `package-lock.json` entry; Sentry the only crash SDK; app.json declares no tracking.
- `src/release/__tests__/sdk-telemetry.test.ts` (US-021q): every `ClerkProvider` in the product
  tree passes `telemetry={false}`, read from the syntax tree. On the base it failed with
  `src/auth/AuthRoot.tsx:101 no telemetry={false}`.
- `src/release/__tests__/privacy-manifest.test.ts` (US-021f): `NSPrivacyTracking` false.

**Policy wording:** section 06, keep "It has no ads, no third-party advertising trackers and no
analytics trackers." and drop the `[CHECK]`.

**Owner check:** the App Privacy Report check in `websummit-checklist.md` (OT-R14): no analytics
host and no clerk-telemetry.com.

## Photos only, never video

**Draft:** Appendix A.1, "User Content · Photos or Videos: Yes (photos only; the attachment
allow-list has no video types)", and A.2, "Photos and videos · Photos".

**Answer:** True. The camera and the photo library offer still photos only. Files can pick any
file, a video included, and the app uploads it, but the server refuses a video before storing
anything, so no video is kept.

**What the code does:**

- **Camera and library** (`src/chat/attachments/picked.ts`): both are asked for
  `mediaTypes: ['images']`, and any video a picker still returns (`video`, `pairedVideo`) is dropped
  before upload.
- **Files** (`expo-document-picker`) is asked for any type (`*/*`). The app decides only whether a
  file is an image to redraw ("Photo location"). It keeps no list of allowed types of its own.
- **The server's list.** `POST /api/attachments` reads the type from the file's bytes and checks it
  against `ALLOWED_MIME_TYPES` (automatos-ai `orchestrator/modules/attachments/validation.py` at
  `10c59c259`: images, documents, text and code, and no `video/` type) before it writes to storage
  (`store.py`). A video is refused with "File type not allowed", and the app's toast says "Auto
  can't take this kind of file."

**Evidence:** `src/chat/__tests__/picked.test.ts` (A2 US-009b: images only, a returned video
dropped); `src/release/__tests__/privacy-labels.test.ts` (US-021e: both pickers ask for images
only, and the labels say photos and no video).

**Policy wording:** Appendix A.1: "Photos or Videos: Yes (photos only: the camera and the photo
library offer photos, and the service accepts no video files)". Section 07 can stay as it is.

**Owner check:** none beyond OT-R6. On a phone, attaching a video from Files shows "Auto can't take
this kind of file."

## Notifications: when the app asks, and what a notification can do

**Draft:** Section 10, "The app asks for each permission the first time you use the feature that
needs it, and works without it." and, under Notifications, "The app asks after you have first used
it, never at launch. … A question carries its text and up to three answer options, so you can
answer from the notification on an unlocked phone. … Approving work always opens the app first".
The Terms draft's section 09 says the same.

**Answer (re-verified on the push wave, A4):** True on iPhone and on Android 13 or later. The
system's question appears only after a tap on the app's own "Turn on" or on Settings →
Notifications → "Turn on notifications", and the app offers its "Turn on" only once something waits
for you, or from your second session. Android 12 or earlier has no question: notifications are
allowed unless they are off in the phone's settings. Two corrections: a question's answer options
are not buttons on the notification ("Reply…" takes a typed answer), and every action opens the
app.

**What the code does:**

- **One place asks.** `askPermission` (`src/push/registration/permission.ts`) is the only call of
  the system request; `src/push/platform/expo.ts` binds it. It runs only from a person's tap: the
  in-context sheet's "Turn on" (`src/push/prompt/PushPrompt.tsx`) or Settings → Notifications
  (`src/push/settings/phone-link.ts`). Never at launch or when a screen mounts.
- **When the sheet is offered** (`offerPrompt`, `src/push/prompt/policy.ts`): only while the
  phone's status is "ask" (the server sends pushes through Expo, the build can register, and the
  system has not been asked), and only once the needs-you count is above zero or from the second
  signed-in session (`PROMPT_MIN_SESSIONS` 2). "Not now" holds it back for 7 days. After 2 declines
  only Settings offers it. A phone the person removed is never asked by the sheet.
- **Registration** (`src/push/registration/register.ts`): the phone sends its push token to the
  server only where the server pushes through Expo, the build has its EAS project id and the
  permission is granted.
- **Android.** The channels are created when a session starts (`src/push/platform/setup.ts`). The
  app targets API 36 (React Native 0.81's `targetSdk`), so on Android 13 or later a new channel
  shows no question, and the question comes only from `askPermission`. Android 12 or earlier has no
  notification permission to ask for: the system reports it granted (unless notifications are off
  for the app), and the phone registers when the session starts.
- **What a notification offers** (`src/push/platform/categories.ts`): a question offers "Reply…" (a
  typed answer, on an unlocked phone only) and "Open". Everything else offers "Open". There is no
  Approve button and no option button: a question's own options are answered in the app. Every
  action opens the app.

**Evidence:** `src/push/__tests__/registration-state.test.ts` ("the wave asks for the permission in
one place (KP11)": only `registration/permission.ts` and `platform/expo.ts` name the request),
`root.test.ts` (the `offerPrompt` table), `registration.test.ts` ("a phone never asked sends
nothing and asks nothing"), `settings-wiring.test.ts` (no screen calls the request) and
`platform.test.ts` (the categories and their actions).

**Policy wording:**

- Section 10, Notifications, first line: "The app asks only when you tap Turn on. It offers this
  once something needs your answer, or from your second visit, never at launch. On Android 12 or
  earlier your phone does not ask: you can turn notifications off in its settings."
- The question line: "A question can show its text on your lock screen. Reply… lets you type an
  answer on an unlocked phone, and the app opens. Its answer options are in the app."
- Keep "Approving work always opens the app first".

**Owner check:** the WebSummit checklist (OT-R14): on a fresh install, no question at launch; the
"Turn on" sheet once something waits; an answer sent with "Reply…".

## Quick-ask: speech recognition and the reply's voice

**Draft:** Section 07, the "Quick-ask voice" row: "Speech is recognised **on your phone**; the audio
is not sent to us or to anyone else. Only the text is sent, as a chat message. Replies are read
aloud by your phone's own voice … [CHECK: on Android, that recognition is on-device only and
quick-ask stops rather than falling back to a network recogniser; and that the Android
text-to-speech engine does not use a network voice]".

**Answer (re-verified on the voice wave, A6):**

- **Android recognition:** true. Recognition runs only on the phone's own recognizer, and
  quick-ask refuses rather than falling back.
- **iPhone recognition:** true, with one open edge, recorded by the voice wave. The app checks
  that the phone's recognizer works on the device before it starts. That check reads the phone's
  default language, while quick-ask listens in the phone's first preferred language. Where the two
  differ, and the first preferred language has no on-device recognizer, iOS may send the speech to
  Apple's servers.
- **The reply's voice:** on iPhone, a voice on the phone. On Android, the app picks a voice on the
  phone when the engine names one. When it finds none, the phone's text-to-speech engine speaks
  with its default voice, and the app cannot see whether that voice uses the network.
- **Auto's server voice (27 Oct 2026):** when the Automatos server the phone is connected to offers
  it (discovery lists `tts`) and the person keeps it (Settings → Voice), each sentence of Auto's
  reply is sent as text to that same server, which answers with the audio. Nothing the person said
  is sent for it: only Auto's own reply, which came from that server. Otherwise, or when the server
  cannot answer, the phone's voice reads the reply as above.

**What the code does:**

- **Recognition** (`recognitionPolicy` in `src/voice/quick-ask/recognition-policy.ts`, started by
  `recognizer-core.ts`). Every start passes `requiresOnDeviceRecognition: true` (`onDeviceOptions`,
  the one way to build the start options). It names no recognition service package, and it asks for
  no recording or audio file.
  - **iOS:** hold to talk starts only when the recognizer supports on-device recognition and is
    available. expo-speech-recognition sets `requiresOnDeviceRecognition` only on a recognizer that
    supports it (`ios/ExpoSpeechRecognizer.swift`, `if recognizer.supportsOnDeviceRecognition`), and
    otherwise uses Apple's servers. So the app checks first. The module's check,
    `supportsOnDeviceRecognition()`, builds `SFSpeechRecognizer()` for the default language
    (`ExpoSpeechRecognitionModule.swift`), while `start()` listens in `lang`, the phone's first
    preferred locale (`src/voice/quick-ask/locale.ts`). That is the edge above: closing it needs a
    native check per language (a lead decision in the voice wave's US-019b notes; device check
    OT-V1 with a second preferred language).
  - **Android:** only on Android 13 (API 33) or later, with on-device recognition supported and
    the phone's language installed for it. A language that is supported but not installed offers
    a download (`androidTriggerOfflineModelDownload`). The phone then fetches the language model;
    nothing the person says is sent. Anything else refuses with its reason ("Hold to talk needs
    speech recognition that runs on this phone, and it isn't available for {language}. You can type
    to Auto instead."). There is no network fallback.
- **What leaves the phone:** the recognised text, sent as a chat message through the app's API
  client. The audio is never saved or sent. With Auto's server voice, also each sentence of Auto's
  reply, sent back to the same server for its audio.
- **The reply's voice** (`pickVoice` in `src/voice/speech/voice-pick.ts`, spoken through
  expo-speech in `speaker.ts`):
  - **iOS:** Apple's own voices only (`com.apple.voice.*`, `com.apple.ttsbundle.*`). Every one is
    on the phone.
  - **Android:** expo-speech has no network flag, so the voice's name decides. Only a name with
    "local" and without "network" is picked (Google's engine names each voice `…-local` or
    `…-network`). If no voice for the language has such a name (another engine, or none installed),
    the app passes no voice. The engine then speaks with its default voice for the language, as set
    in the phone's settings.
- **Auto's server voice** (`src/voice/server/`, spoken through `reply-voice.ts`): only when
  discovery lists `tts` and Settings → Voice keeps Auto's voice (`serverSpeechFor` in
  `server-voices.ts`). Each sentence goes as `POST /api/voice/speech {text, voice, speed}` through
  the app's API client, with the same bearer and workspace headers as every call, never in a URL
  (`voice-api.ts`). The MP3 it answers is written to the app's cache (`<cache>/server-voice`,
  `speech-files.ts`), played with expo-audio and deleted once played or stopped; the folder is
  emptied at every app start (`sweepSpeechFiles` in `app/_layout.tsx`), whether or not the voice
  is used, so nothing a crash left stays. A failure is logged by its kind only, never the
  text, and the phone's voice speaks the rest of that turn.

**Evidence:** `src/voice/__tests__/recognition-policy.test.ts` (iOS and Android policies, every
start option on the phone, no service package), `recognizer-core.test.ts` (start runs only for a
"ready" policy), `recognizer-binding.test.ts`, `voice-pick.test.ts` (Apple's voices only; on
Android "local" names only, never "network"; none → the engine's default) and
`speaker-core.test.ts`. The server voice: `server-voices.test.ts` (only with `tts` and Auto's voice
kept), `voice-api.test.ts` (the bearer and the text in no URL, error or log),
`server-speaker.test.ts` (every file deleted after playing or on stop) and
`server-voice-wiring.test.ts` (without `tts` the phone speaks exactly as before).

**Policy wording:**

- "Speech is recognised on your phone. If your phone cannot recognise your language on the device,
  quick-ask says so and does not start. The audio is not saved or sent. Only the text is sent, as a
  chat message."
- "On iPhone, replies are read aloud by a voice on your phone. On Android, the app uses a voice
  installed on your phone when your text-to-speech engine offers one; otherwise your engine's
  default voice reads them, as set in your phone's settings."
- "When your Automatos server offers Auto's own voice, the app sends the text of Auto's reply back
  to that server, which turns it into speech. You can choose your phone's voice instead in
  Settings → Voice."
- Before publishing the first sentence for iPhone, Gerard decides on the edge above (last section):
  publish it as it is, or add "on iPhone, in your phone's main language".

**Owner check:** the voice wave's airplane-mode checks (OT-V1, OT-V2), including OT-V1 with a
second preferred language; quick-ask in the WebSummit checklist (OT-R14).

## The local network prompt and plain HTTP

**Draft:**

- Section 10: "**Local network** (iPhone): only when you connect to a server on your home or office
  network."
- Section 11: "**Plain HTTP on a home network:** the app shows a lasting note that the connection
  is not encrypted. [CHECK: whether plain-HTTP pairing ships; it changes the Google Data safety
  "encrypted in transit" answer, Appendix A.]"
- Appendix A.2: "Is all user data encrypted in transit? Yes, only if the app refuses plain HTTP.
  … [CHECK: decide before the first Play submission.]"

**Answer:** Both are true. iOS asks about the local network the first time the app connects to an
address on the local network, which happens only when the person pairs with, or uses, their own
server on a private address. Hosted Studio and a server on the internet, such as the VPS, never
cause it. Plain-HTTP pairing ships, for private addresses only, with a lasting note. So Play's
"encrypted in transit" answer is Gerard's (`play-data-safety.md`).

**What the code does:**

- **The prompt.** `NSLocalNetworkUsageDescription` is "Automatos Go connects to your own Automatos
  server when it runs on your home or office network." iOS shows it on the first connection to a
  local address. The app does no Bonjour or mDNS discovery: app.json lists no `NSBonjourServices`,
  and no product file browses the network. If the person taps Don't Allow, iOS blocks the
  connection and the app shows "Can't reach {server}" ("It isn't answering. It may be stopped, or
  this phone can't reach it from here."). Allowing it later is in iOS Settings → Privacy &
  Security → Local Network.
- **Plain HTTP** (`src/connect/address.ts`, `src/connect/config.ts`): `http://` is accepted only for
  a private IPv4 address (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) or a `.local` name. Any other
  `http://` address is refused: "This address needs https://. Only an address on your home
  network, like 192.168.1.20 or nas.local, can use http://." A paired `http://` server shows the
  "Unencrypted home network" banner (`src/connect/components/InsecureNetworkBanner.tsx`): "This
  address uses http://, so what this phone and the server send is not encrypted. Anyone on the same
  network could read it. Pair only on a network you trust." iOS allows it through
  `NSAllowsLocalNetworking` only, with no arbitrary loads.

**Evidence:** `src/release/__tests__/permissions.test.ts` (US-021g: the evaluated Info.plist's
usage strings, `NSAllowsLocalNetworking` and no arbitrary loads); the connect wave's
`src/connect/__tests__/address.test.ts` and `ip.test.ts` (A1, D-HTTPS and KC6: which addresses may
use `http://`).

**Policy wording:**

- Section 10: keep the Local network line as it is.
- Section 11: keep the plain-HTTP bullet and drop its `[CHECK]`: plain-HTTP pairing ships.
- Appendix A.2: the answer is Gerard's (`play-data-safety.md`, "encrypted in transit").

**Owner check:** pairing on a home network is not in the WebSummit run (the VPS has a public HTTPS
address). If a home-network server is paired, check the prompt appears once, on the first
connection, and the banner shows.

## Clerk on a phone paired with its own server

**Draft:** Section 11, "The app does not use our sign-in service (Clerk) in this mode. [CHECK: the
app mounts Clerk only for hosted sign-in, so a paired phone never contacts clerk.automatos.app.]"

**Answer (re-verified on the merged base):** True while the phone is paired. ClerkProvider never
mounts in own-server mode, so no Clerk code runs and nothing is asked of Clerk. The `[CHECK]`'s
reason is not quite right, though. The app mounts Clerk whenever no server is paired, not only on
the hosted sign-in screen. A fresh install therefore loads Clerk on its first screen, Welcome,
before the person pairs, and again after they forget the server.

**What the code does:**

- **The choice** (`authBranch`, `src/session/auth-branch.ts`; rendered by `src/auth/AuthRoot.tsx`
  inside `app/_layout.tsx`'s gates): until the keychain has said whether a server is paired, nothing
  mounts. A paired record gives `DeviceSession`, which has no `ClerkProvider`, so no Clerk hook runs.
  No paired record gives `HostedSession`, the `ClerkProvider`, in a build with a Clerk key and an API
  URL.
- **Before pairing.** Welcome and Connect render under `HostedSession`, because "connected nowhere"
  is the built-in hosted server (KC4). On mount, clerk-js loads its environment and client from
  Clerk's Frontend API: two requests that carry the phone's IP address and device type but no
  account. The connect wave recorded this as a lead flag (US-006d notes), with an option: mount
  Clerk only once hosted sign-in is chosen, or once Clerk's own item is in the keychain.
- **When the person pairs.** Pairing while signed in to hosted Studio signs out of Clerk first
  (`src/connect/switch.ts`). The tree remounts as `DeviceSession`. The signed-out Clerk object stays
  in memory until the app is closed. In clerk-js's native build, loading is one fetch of the
  environment and the client, with no polling and no heartbeat (the heartbeat runs only in a
  standard browser). So nothing more is sent to Clerk in that launch, and every later launch of the
  paired phone never starts Clerk.
- **Clerk's native iOS SDK** stays unconfigured ("Analytics and tracking").

**Evidence:** `src/auth/__tests__/auth-root.test.ts` (US-006d: AuthRoot rendered for an own
server mounts the device session with no `ClerkProvider` and no `useAuth` call, even in a build
with a Clerk key; the hosted case counts one of each); `src/session/__tests__/auth-branch.test.ts`
(nothing until the keychain answers; own → device; none → hosted).

**Policy wording:** Section 11, in place of the sentence and its `[CHECK]`: "While the app is paired
with your own server, it does not contact our sign-in service (Clerk). Before you pair, the app's
first screen loads Clerk so that you can sign in to hosted Studio; Clerk then receives your phone's
IP address and device type, but no account details." If Gerard takes the connect wave's option, the
second sentence goes.

**Owner check:** the App Privacy Report check in `websummit-checklist.md` (OT-R14): on a phone
installed fresh and paired with the VPS, Clerk's host may appear once, from Welcome, and never
after pairing.

## What the Terms draft says about the app

The Terms draft's section 09 ("Automatos Go, the mobile app") makes claims about the app. The code
answers these:

| Terms draft (section 09) | On the merged app | Evidence |
|---|---|---|
| "Free, and nothing to buy … It offers no purchases, subscriptions, credits or keys." | True. No plan, credit or price anywhere in the app (D8). | `src/release/__tests__/store-copy.test.ts` (BILLING) |
| "You cannot create an account in the app." | True. The app only signs in, with no pointer to making an account (D64). | `store-copy.test.ts` (SIGNUP) |
| "A notification about an agent's question can show the question and its answer options." | The text, yes. The options are answered in the app: the notification's buttons are "Reply…" (a typed answer) and "Open". | `src/push/__tests__/platform.test.ts`; "Notifications" above |
| "Answering from a notification needs an unlocked phone. Approving work opens the app first." | True. "Reply…" requires an unlocked phone, and every action opens the app. | as above |
| "Workspace owners and admins can switch question text off for their workspace." | The server's setting. The app shows what the server sends. | automatos-ai (PRD-266) |
| "Auto tells you it is an AI at the start of every voice conversation and reminds you during long ones." | **Not as shipped.** Quick-ask says "Hi, this is Auto, your AI assistant." once, before its first spoken reply of a session, and never reminds (D73). Auto Live is not in this build. | `src/voice/__tests__/ai-notice.test.ts`; "Auto is an AI" above |
| "The app can update itself for fixes within the version you installed. Some features depend on what the connected server supports." | True. expo-updates fetches updates for the installed build's fingerprint only, and features follow the server's discovery document. | `src/release/__tests__/release-config.test.ts` (fingerprint runtime, channels); `src/api/capabilities.ts` |

**Terms wording:** section 09, Voice: "Auto tells you it is an AI when a voice conversation starts."
Drop "and reminds you during long ones" until a build reminds. The rest of section 09 stands as
drafted.

## The `[CHECK]`s the code cannot answer

The `[CHECK]`s answered above are not repeated here. These need a person, a dashboard or the
server. "Gerard" means a decision or a dashboard Gerard holds; "counsel" means legal advice;
"automatos-ai" means the server's code or its production settings.

**Privacy policy draft:**

| Where | The `[CHECK]` | Who answers |
|---|---|---|
| Header | Point Studio's own privacy page at the published policy, or update it in the same drop | Gerard (automatos-ai-landing) |
| Header | Publish sections 06–14 when a build goes beyond internal TestFlight, or on 30 Oct with the app "in testing" | Gerard |
| Header | The publish date: a fixed date, never computed | Gerard (OT-R3) |
| §06 | The controller's legal entity name and address, once D2 names the contracting party | Gerard, counsel |
| §06 | The controller and processor split for workspace content | Counsel |
| §06 note | Whether the page says the App Store seller is Gerard Kavanagh, for Automatos AI | Gerard |
| §07 note | Keep the table and style it, or turn the rows into paragraphs | Gerard (company site) |
| §07 | How long a removed phone's record is kept (PRD-266 keeps it as `revoked`, with no deletion date) | automatos-ai |
| §07 | Whether deleting a chat also removes what Auto learned from it | automatos-ai (memory) |
| §07, §12 | Production `AUDIT_RETENTION_DAYS` (code default 365, never below 180) | Gerard (Railway settings) |
| §07 | The region of `S3_DOCUMENTS_BUCKET`, and the 7-day lifecycle rule on the production bucket | Gerard (AWS) |
| §07 | That Auto Live's audio travels over LiveKit for Retell | Retell |
| §07 | Retell's audio retention off (D53), and the transcript retention set per agent | Gerard (Retell dashboard) |
| §07 | How long Expo keeps push receipts and payloads, and update requests | Gerard, from Expo's terms |
| §07 | The Sentry plan's retention, and "Prevent storing of IP addresses" on (the user ID half is answered above) | Gerard (Sentry, OT-R1) |
| §08 | The legal bases | Counsel |
| §08 | Data-processing agreements with Clerk, Expo (D20), Retell, Sentry and Anthropic | Gerard |
| §08 | Clerk's and Anthropic's regions (United States) | Gerard |
| §08 | The region of Railway's API and Postgres services | Gerard (Railway) |
| §08 | Retell still offers no EU region at publish (D53) | Gerard, Retell |
| §08 | LiveKit and its region, and Retell's speech-recognition and voice sub-processors | Retell |
| §08 | Where `MODERATION_WEBHOOK_URL` delivers (PRD-266 open question 2); list it if it is Slack or similar | Gerard (automatos-ai settings) |
| §08 | The transfer mechanism for each provider | Counsel |
| §09 | Whether the whole-app consent gate stays (it is what ships), or Gerard chooses the lighter one | Gerard (a change to the app if lighter) |
| §09 | Which hosted features use OpenRouter on the platform's own account, and only what is live | automatos-ai, Gerard |
| §09 | The providers' own training terms; for OpenRouter, that providers that train on prompts are excluded | Gerard, counsel |
| §11 | Whether crash reports stay on, ask first or switch off on an own server (they stay on, under the person's switch) | Gerard (a change to the app if not) |
| §11 | Whether to keep loading Clerk on Welcome before a phone pairs ("Clerk on a phone paired with its own server") | Gerard (the connect wave's option, if not) |
| §07 | Whether to publish the iPhone on-device recognition sentence before the per-language check exists ("Quick-ask") | Gerard |
| §12 | How long the moderation inbox keeps reports, and who answers it within what time | Gerard (PRD-266 open question 2) |
| §13 | Studio's Settings → Phones & devices shipped (PRD-266 US-019): it is on automatos-ai `main` at `10c59c259` (`frontend/components/settings/SettingsPanel.tsx`); check it on production | Gerard (production) |
| §13 | Only owners delete a workspace (D63), but the erase route also accepts admins: say which is true, or fix the route | automatos-ai, Gerard |
| §13 | Who runs a login deletion (Clerk's Backend API, then the `users` row and memberships by hand) | Gerard |
| §13 | Clerk's "Allow users to delete their accounts" stays off | Gerard (Clerk dashboard) |
| §13 | privacy@automatos.app is monitored | Gerard |
| §13 | Studio can transfer a workspace's ownership; if not, what support does instead | automatos-ai |
| §14 | One minimum age, 16 (D12), against the live Terms' different age | Gerard (OT-R13) |
| A.1 | Other User Content rather than Emails or Text Messages (`app-store-privacy.md` uses Other User Content) | Gerard |
| A.1 | Whether Clerk's IP-derived city on hosted sessions counts as location (photos are answered above) | Gerard |
| A.2 | "Encrypted in transit", now that plain-HTTP pairing ships | Gerard (`play-data-safety.md`) |
| A.2 | The deletion duty and its public web link (the report's conflict 1) | Gerard, counsel |
| A.2 | The account-creation wording when the form is filled in (the app has no pointer to sign-up) | Gerard (OT-R15) |
| A.2 | Audio marked ephemeral only once Retell's audio retention is confirmed off | Gerard (Retell) |
| A.3 | The merged manifest of the first Android build | Gerard (OT-R5) |

**Terms draft:**

| Where | The `[CHECK]` | Who answers |
|---|---|---|
| Header | Make https://automatos.app/terms the one Terms the app links to (it is: `legal-links.ts`), and point Studio's own terms page at it or bring it in line | Gerard (automatos-ai-landing) |
| Header | The effective date | Gerard (OT-R3) |
| §02 | 16, as D12 says, against the live Terms' different age | Gerard (OT-R13) |
| §06 | What Automatos can do on a report: platform admins pause, delete or restore a whole workspace, and no tool removes one message or Deliverable | automatos-ai, Gerard |
| §06 | Who answers the moderation inbox, and whether "two working days" covers reports | Gerard |
| §09 | Apple's standard EULA with the clause as a courtesy, or these Terms as a custom EULA | Gerard, counsel |
| §09 | Keep or cut "Use voice only where the people who can be heard know …" | Gerard |
| §10–14 | The Fees section rewritten when billing opens (PRD-265), with no in-app purchase language | Gerard |
