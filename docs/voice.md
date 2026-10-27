# Voice

Talking to Auto from the phone: quick-ask (hold to talk) first, Auto Live later.

## Status (24 Oct 2026)

**Being built. No voice code exists yet.** This page describes the plan from its binding contract,
the wave A6 kit `scripts/ralph/prd-001-voice.json` (16 stories, every one `passes: false`), and
PRD-001 §4.7 and §4.9. Like the other waves, the kit is committed on its own branch
(`feat/a6-voice`) when the wave starts; that branch does not exist yet. When the code lands, the
code is the truth and this page follows it.

KV1–KV19 are the A6 kit's own decisions. Dnn are PRD-001's decision table; names such as
D-ONE-VOICE are rules the kit names.

What is already in place:

- **The native modules are in the binary.** `expo-speech-recognition`, `expo-speech`,
  `@livekit/react-native`, `@livekit/react-native-webrtc` and `livekit-client` are in
  [package.json](../package.json), with their config plugins and the microphone and speech
  recognition usage strings in [app.json](../app.json) ([native-modules.md](native-modules.md),
  "Voice" rows). So A6 is JavaScript only and ships as an over-the-air update.
- **The gates are on `main`.** `canSpokenMode` and `canVoiceLive` in
  [src/api/capabilities.ts](../src/api/capabilities.ts). automatos-ai `main` lists both
  `spoken_mode` and `voice_live` in discovery.
- **A5 has the screen parts.** HUD's phone core (rings, state chip, transcript, waveform, buttons)
  is on `feat/a5-styles`. Its HOLD TO TALK button is disabled; VoiceOver's hint says "Voice comes
  with the voice update".

| Part | Stories | Status |
|---|---|---|
| Quick-ask and the voice screen | US-019a – US-019k (phase 1) | Kit only. Needs A2 chat (on `main`) and A5 phase 1 (on branch) in its base |
| Auto Live | US-020a – US-020e (phase 2) | Kit only. Blocked until Retell confirms (`RETELL_LIVEKIT_CONFIRMED` is `false`, as of 21 Oct) |

## Quick-ask (phase 1)

For everyone, on every plan and edition. Never gated on a plan.

### The flow

1. The person presses and holds **HOLD TO TALK** on the voice screen.
2. On the first press only, the phone asks for the microphone and, on iOS, speech recognition.
   Never at launch or on opening a screen.
3. The phone checks it can recognise speech **on the device** (below). If not, it says so and
   typing stays.
4. While held, the microphone is open and **MIC LIVE** shows. The words appear as they are heard.
   MIC LIVE follows the recogniser's real audio start and end, not the button.
5. On release, the words go to Auto through the normal chat (A2's chat controller), with
   `spokenMode` when the server lists `spoken_mode`. Without it, the turn is a plain one and the
   phone strips the markdown itself.
6. Auto's reply is spoken by the phone's own text-to-speech (`expo-speech`), sentence by sentence
   as it streams, or by the server's voice when the server offers one
   ([Auto's server voice](#autos-server-voice)). Only Auto's text is spoken: no receipts, tool lines or cards. A reply with cards
   or receipts also offers "See it in the chat".

Hold rules (KV5): a hold under 300 ms is a tap ("Hold the button while you talk"); listening stops
by itself at 60 s. With VoiceOver on, the button toggles instead: double-tap to talk, double-tap to
send.

Stopping (KV5):

- **STOP** aborts listening (nothing is sent), stops speech, and cancels a turn still streaming on
  the server, through the chat's Stop.
- Saying **"Auto, stop"** as the whole utterance during a hold acts as STOP and sends nothing.
- Pressing HOLD TO TALK while Auto speaks stops the speech at once.

Only turns started by quick-ask are spoken, and only while the voice screen is open. A typed turn
is never spoken (KV6).

### Recognition stays on the phone

KV4. Speech recognition runs on the phone or not at all, so the audio never goes to Apple or
Google:

- **iOS:** start only when the recogniser supports on-device recognition. Otherwise the module
  would silently use Apple's servers, so the app checks first.
- **Android:** start only on Android 13 (API 33) or later, with on-device support and the language
  installed. A language that is supported but not installed gets a download offer.

The words still go to Auto's AI providers, as any chat does. The consent sheet names them. No copy
may say that nothing leaves the server (KV18).

### The AI notice

KV7, D73. Quick-ask shows **and** speaks the AI notice **once per voice session**, before the first
spoken reply, with the answering agent's name when it is not Auto. There is no ten-minute reminder.
A session starts at the first quick-ask after the voice screen opens, and ends when it closes or
the app goes to the background.

The small "Auto is an AI" caption ([src/styles/ai-label.tsx](../src/styles/ai-label.tsx)) also
sits on the voice screen. Nothing waits for it.

Open question for the lead: the kit takes the notice's words from the server's `VOICE_GREETING`
(automatos-ai `orchestrator/modules/policy/ai_disclosure.py`). Its current wording calls Auto an
"assistant", which the naming rule does not allow.

### Interruptions and the screen

- **Background or screen lock:** listening is aborted (nothing sent), speech stops, the notice
  session ends.
- **A phone call, Siri or an alarm:** abort, keep the heard words on screen unsent, "Interrupted.
  Hold to talk when you're ready."
- **A headset or Bluetooth device going away:** "The microphone changed. Hold to talk again."
- **Back to the foreground:** nothing reopens the microphone or resumes speech by itself.
- **The screen stays on** while the microphone is open or a reply is being spoken
  (`expo-keep-awake`, already part of `expo`), and is released otherwise.
- **No background microphone** and no Android microphone foreground service (decision 33).

### Who can talk

Owners, admins and editors (`roleCan(role, 'chat')`). Viewers see HOLD TO TALK disabled with "Ask
your workspace owner for editor access to talk to Auto", and no Live button.

### The voice screen

- Route `/voice`, optionally `/voice?chat=<id>`: `app/(app)/voice.tsx`, path builder in
  `src/voice/nav.ts` (KV17).
- One voice screen in every style: A5's HUD core, painted by the style (D-ONE-VOICE, KV9). Studio:
  ink rings with orange motion. Play: Ember rings with Auto in the centre. HUD: its accent.
- Ways in: a voice button in the chat composer and Play's composer, and HOLD TO TALK on the HUD
  home.
- One pure reducer drives it (`src/voice/machine/voice-reducer.ts`, KV8): `idle`, `listening`,
  `thinking`, `speaking`, `error`, with `micOpen` kept apart as the truth about capture.

### Where the code will live

`src/voice/**` only, plus named, additive seams into A2's chat request and composer and A5's HUD
core (KV1, KV2). One file per native module (KV15): only `src/voice/quick-ask/recognizer.ts` and
`src/voice/permissions/permissions.ts` import `expo-speech-recognition`; only
`src/voice/speech/speaker.ts` imports `expo-speech`; only `src/voice/server/audio-player.ts`
imports `expo-audio`; only `src/voice/interruptions/keep-awake.ts`
imports `expo-keep-awake`; only `src/voice/live/livekit-session.ts` imports LiveKit.

## Auto's server voice

Added 27 Oct 2026 (Gerard): Auto's spoken replies in the server's natural voice (Kokoro on
automatos-ai, branch `feat/voice-tts`), with the phone's voice as the automatic fallback. Code:
`src/voice/server/`, `src/voice/speech/reply-voice.ts`, `voice-out.ts`.

**When.** Only when discovery lists `tts` (`canServerVoice`) and Settings → Voice keeps Auto's voice
(the default). Without `tts` the app speaks exactly as before: the reply voice hands every sentence
to the phone's speaker unchanged.

**The contract.**

- `POST /api/voice/speech {text (1–500 chars), voice (id | null), speed (0.8–1.2 | null)}` → 200
  `audio/mpeg`, one MP3 for that text, with `X-Voice-Id`. Refusals `{code, detail}`: 503 `tts_off`,
  503 `tts_unavailable`, 422 `tts_bad_request`, 413 `tts_too_long`, 429 `tts_busy`.
- `GET /api/voice/voices` → `{default, voices: [{id, name, accent, gender}]}`, or 503.
- Both are `pendingUpstream` in [src/voice/routes.ts](../src/voice/routes.ts) until a re-pin
  carries them.

**From the server to the speaker.** The one API client reads the 200's body as bytes
(`client.binary()`: expo/fetch's body stream in `src/api/transport.ts`, read by `src/api/body.ts`
`readBytes`, which refuses a Content-Length over 4 MB and stops reading as soon as the body passes
it), with the same bearer and `X-Workspace-ID` headers as every call. `voice-api.ts` checks it is
audio and not empty; `speech-files.ts` writes it to `<cache>/server-voice/<name>.mp3`; `audio-player.ts` plays the
`file://` URI with expo-audio, and the file is deleted once played or stopped. No token or text in
a URL, a file name or a log.

**The queue** (`server-speaker.ts`). One request in flight at a time: while a sentence plays, the
next one is fetched, so the gap between them is the player's start. A sentence that is due (nothing
plays before it) has 4 s to be ready; a prefetched sentence starts that wait only when it falls
due. A sentence over 500 characters goes in pieces split at a space.

**Fallback, never silent.** Any failure (a refusal, the network, the 4 s wait, a file that cannot
be written, an audio session or a player that does not start within 3 s, or a file that plays
past its length) speaks that sentence
and the rest of the turn with the phone's voice, and logs the kind only. The next turn (each send)
tries the server again. STOP, "Auto, stop", barge-in, leaving the screen and the background stop
the player, abort every request and delete every file. The AI notice is spoken in whichever voice
the turn uses.

**The iOS audio session.** Before each run, expo-audio's mode is set to playback with
`playsInSilentMode` (it plays with the ringer switch on silent) and `duckOthers` (other apps'
audio is lowered while Auto speaks); no recording, no background (D33). Each player keeps the
session active (`keepAudioSessionActive`): expo-audio otherwise deactivates the session 100 ms
after a pause or the end, which would land on the recognizer's session when a press barges in. The
session is never touched between a run's sentences. When the run ends (its last sentence played,
STOP, leaving the screen or the background, or a failure handed to the phone's voice), it is
released: the mode goes back to mixing (`mixWithOthers`, nothing ducked) and the session is
deactivated with `notifyOthersOnDeactivation` (`setIsAudioActiveAsync(false)`), so music or a
podcast comes back to full volume. A barge-in is the one end that does not release it
(`handOver`): the recognizer takes the session at once, and deactivating it would stop the capture.
The recognizer sets its own session each time it starts (`playAndRecord`, `defaultToSpeaker`,
`allowBluetooth`), so hold to talk works after a reply; the phone's voice keeps its own session
(`useApplicationAudioSession: false`). Session changes run in order on one chain, so a run's
release never lands after the next run's set-up.

**Settings → Voice.** With `tts`, "Auto's voice" lists the server's voices (name and accent, the
server's default marked and selected unless one was chosen), read afresh when the screen opens,
then "Use this phone's voice instead", which shows the phone's list and its help line. A tap saves
the choice and plays the sample through the server (the phone's voice when the server cannot).
Speed applies to both voices (sent as `speed`); Pitch to the phone's voice only, with a one-line
reason in its place. The choice is in the same MMKV setting (`source`, `serverVoice`); a value
saved before them reads with Auto's voice as the default and keeps its phone voice, speed and pitch.

**Native.** `expo-audio` ~1.1.1 (and its peer `expo-asset`) is a new native module: its PR moves
the fingerprint and builds iOS build 13 ([native-modules.md](native-modules.md#expo-audio)).

**Owner checks (device only).** With build 13 and the core route live: the reply in the server
voice with the ringer switch on silent; music ducked while Auto speaks; no gap between sentences;
STOP and "Auto, stop" mid-sentence; a press while Auto speaks, then hold to talk works; Bluetooth
headphones; airplane mode mid-reply (the phone's voice takes over within about 4 s); Settings →
Voice samples and the phone-voice switch.

## Auto Live (phase 2, later)

A full-duplex voice call with Auto through Retell, joined natively with LiveKit's React Native SDK.
No WebView and nothing from Retell's browser SDK (D-NO-WEBVIEW). It starts only after Retell
confirms that a client other than its browser SDK may join a web call over LiveKit with the minted
token.

**Who sees the Live button** (KV14): the server lists `voice_live`, **and** the workspace's
`ai_providers` names Retell, **and** the person may chat. On SaaS that means a Business workspace;
the server enforces it at the mint. A self-hosted install shows it once its operator has set up
Retell. No plan, price or upgrade words are ever shown.

**The call:**

1. `POST /api/voice/web-call {chat_id?}` with the app's bearer and workspace header. It answers
   `{call_id, access_token, chat_id}`, plus `transport`, `url`, `ice_servers` and `expires_at`
   when Retell returns them (PRD-266 W1 US-008a, on automatos-ai `main`:
   `orchestrator/modules/voice/mint.py` `mint_response`). The server calls Retell with the
   workspace's own Retell key; the phone never sees a Retell key. The token dies in about 30 s
   unused, so the phone joins at once.
2. The phone checks consent: the consent sheet must cover the current provider list, Retell
   included (KV19).
3. It joins only when `transport` is absent or `livekit` (KV16). Anything else: "Auto Live can't
   connect from this phone yet. Hold to talk still works."
4. Buttons: **MUTE** / **UNMUTE** and **END**. The transcript runs live. Receipts arrive in the
   thread afterwards, over `chat_changed`. Voice and text are one conversation.

The Live screen says "Auto Live sends your voice to Retell while the call is on." The server speaks
the AI greeting inside the call; the phone speaks nothing itself.

Auto Live ends when the app leaves the screen, on iOS and Android alike: "Auto Live ended when
Automatos Go left the screen." (KV11). The call id and token never go into a URL, a log, Sentry, an
error or a toast.

## Where the PRD and the kit differ

- **PRD-001 §4.9** repeats the AI notice every ten minutes. The kit (D73, Gerard, 23 Oct) shows and
  speaks it once per voice session. Build to the kit.
- **Voice in Studio, and its settings there,** do not apply to the phone. Quick-ask uses the
  phone's own recogniser, and the phone's voices or, when the server offers one, Auto's server
  voice (chosen in the phone's Settings → Voice).

## Related

- [styles-and-themes.md](styles-and-themes.md): the HUD core the voice screen is built on.
- [native-modules.md](native-modules.md): the voice modules, plugins and usage strings.
- automatos-ai `docs/PRDS/PRD-266-AUTOMATOS-GO-BACKEND.md` §4.7: `spokenMode` and the Auto Live
  mint.
