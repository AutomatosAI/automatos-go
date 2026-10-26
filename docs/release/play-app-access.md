# Google Play App access: Automatos Go (for later, D10; OT-R12)

No Play Console exists yet [D10]: Android testers install the EAS preview APK by link (see
[testflight.md](testflight.md)). This page is ready for when a console exists. Play Console → App
content → **App access** asks how a reviewer reaches every part of an app that needs a login. The
answer for Automatos Go is "All or some functionality in my app is restricted", with one set of
instructions per lane. Requirement R21 and owner step OT-R12 are in [README.md](README.md). The
same access for Apple, and how to set up the demo account, the demo workspace and the review server,
is in [app-review-notes.md](app-review-notes.md): Play uses the same three.

Every value in angle brackets is typed into Play Console only, never into this repository. Check the
form's field names when the console exists: Play may name them differently from this page.

Proof: [src/release/\_\_tests\_\_/release-docs.test.ts](../../src/release/__tests__/release-docs.test.ts)
reads this file. Each block uses no sign-up, billing or 'nothing leaves' phrase, and the file has no
secret-shaped string.

## Lane 1: hosted sign-in

| Field | Value |
|---|---|
| Instruction name | Hosted sign-in |
| Username | `<demo account email — in Play Console only>` |
| Password | `<demo account password — in Play Console only>` |

Any other information:

```text
On the first screen, tap "Sign in to Automatos". Enter the email, tap "Use my password", enter the password and tap "Sign in". No second step is asked. "Before you talk to Auto" lists the AI providers that receive what you send: tap "Agree and continue". Home is the conversation with Auto, with work waiting for you above it. The Menu button in the header opens the Command Centre (Board, Calendar, Questions, Deliverables) and Settings. The workspace and its data are made up.
```

## Lane 2: your own server

| Field | Value |
|---|---|
| Instruction name | Connect to your own server |
| Username | None: this lane uses a pairing code |
| Password | None |

Any other information:

```text
On the first screen, tap "Connect to your own server". Server address: <review server address — in Play Console only>. Pairing code: <code — in Play Console only>. Tap "Continue", check the server's name under "Pair with this server?" and tap "Pair". The code works once and expires on <expiry date — in Play Console only>; if it was used or has expired, write to us and we will send a new one.
```

## Where things are (for Play's reviewers)

Play's form has no free Notes field like Apple's. If Play asks for more, use this block.

```text
"Auto is an AI" is the first line of every conversation and of the voice screen. Report this: long-press a finished reply from Auto, or tap "Report this" on a Deliverable's page; choose a reason and send. Settings, "Privacy & legal" links the privacy policy and the Terms. The app only signs in: accounts are made in Studio on the web, by a workspace owner's invitation. Automatos Go sells nothing. Voice: "Talk to Auto" opens the voice screen; hold "HOLD TO TALK" and speak. The first time, the phone may ask to download its offline speech model.
```

## Android differences to check before submitting

- **Two pairing codes.** Mint a separate review code for Play (each code pairs one phone, once).
  Never reuse Apple's code.
- **The offline speech model.** On Android, quick-ask asks to download the phone's speech model
  before the first hold, if the phone does not have it (A6 quick-ask). The reviewer's phone may not
  have it.
- **Approve and answer.** The step before approving or answering uses the phone's screen lock or
  biometrics, not Face ID.
- **Notifications** need Android 13's notification permission. The app asks for it with the same
  in-context sheet as on iOS.
- **Photos** use the system photo picker, so there is no photo permission
  ([android-permissions.json](android-permissions.json)).

## The rest of Play's App content (when the console exists)

| Section | Answer | Where it is written |
|---|---|---|
| Ads | No ads | [README.md](README.md) R11 (no advertising SDK) |
| Content rating | The IARC questionnaire | [age-rating.md](age-rating.md) |
| Target audience | 16 and over: the age groups are in age-rating.md | [age-rating.md](age-rating.md) |
| Data safety | The form's answers | [play-data-safety.md](play-data-safety.md) (OT-R15) |
| Store listing | Not written yet: no Play listing in this wave (KR16) | The App Store fields in [store-listing.md](store-listing.md) are its starting point |

## Owner step (OT-R12, when a Play Console exists)

Enter both lanes in Play Console → App content → App access, each with its own fresh review code,
and check that the demo account still signs in on an Android phone.
