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
