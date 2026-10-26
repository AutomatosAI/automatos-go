# App Store listing: Automatos Go (OT-R13)

The text and choices for the App Store Connect record of Automatos Go (bundle id
`com.automatos.app`, team `KGVA9933BG`). Requirement R22 and owner step OT-R13 are in
[README.md](README.md). Each field below has its App Store Connect limit. A block is pasted as it is.

Proof: [src/release/\_\_tests\_\_/release-docs.test.ts](../../src/release/__tests__/release-docs.test.ts)
parses this file. Each field is within its limit, the name is `app.json`'s, and the URLs are
`src/release/legal-links.ts`'s. The description says "AI assistant" and states one age, 16. No
block uses a sign-up, billing or 'nothing leaves' phrase (US-021k's lists), or a word the app's
terms rule out (Artifact, Recipe, Workflow, "the assistant", Command Center).

Rules for every field [D8, D64, D70]: what the app does, in plain words. Nothing about plans,
credits or prices. No pointer to creating an account. No claim that nothing leaves the phone or the
server. Auto Live is not in this build (A6's US-020 is not built on 26 Oct), so the listing does not
name it. Add it with the first build that has it.

## Where each field goes

| App Store Connect page | Fields |
|---|---|
| App Information | Name, Subtitle, Category, Age Rating ([age-rating.md](age-rating.md)), License Agreement |
| The version (1.0.0) | Promotional text, Description, Keywords, Support URL, Marketing URL, Copyright, Screenshots, App Review Information ([app-review-notes.md](app-review-notes.md)) |
| App Privacy | Privacy policy URL, the privacy answers ([app-store-privacy.md](app-store-privacy.md)) |
| Pricing and Availability | Free; the app sells nothing [D8] |
| The build | Export compliance is answered by `app.json` ([export-compliance.md](export-compliance.md)) |

## Name

Limit 30. It is `app.json`'s `expo.name` [D11].

```text
Automatos Go
```

## Subtitle

Limit 30.

```text
Your AI workspace, on the go
```

## Promotional text

Limit 170. It can change without a new version.

```text
Answer your agents' questions from a notification, approve their work, follow the board and talk to Auto, your workspace's AI assistant, wherever you are.
```

## Description

Limit 4,000.

```text
Automatos Go puts your Automatos workspace on your iPhone. Auto, your workspace's AI assistant, and your agents keep working while you are away from your desk. The app tells you when they need you, and lets you answer, approve and follow along.

CHAT WITH AUTO
- Ask Auto about your work in the same conversation you use in Studio.
- Attach a photo, a picture from your library or a file.
- Every conversation starts with "Auto is an AI", so you always know who you are talking to.
- Long-press a reply from Auto to report it.

THE COMMAND CENTRE
- Board: every ticket and its status, with a filter for each status.
- Calendar: your routines and scheduled tasks. Pause and resume them.
- Questions: answer what your agents are asking.
- Deliverables: open what your agents made, from documents to images and files.
- Social posts: see a post as it will publish, then approve it or ask for changes.

NOTIFICATIONS THAT MATTER
- Hear about it when a question needs your answer, when a ticket is ready for review, and when Auto messages you.
- Answer a question straight from its notification on an unlocked phone.
- Choose what notifies you, and when Auto's daily digest arrives.

TALK TO AUTO
- Hold to talk: your phone turns your words into text on the device and sends them to Auto, and Auto's reply is read aloud.

THREE STYLES
- Studio, Play and HUD. Or let the app follow the theme you use in Studio.

YOUR OWN SERVER
- Run Automatos yourself? Connect Automatos Go to your own Automatos server with a pairing code from Studio.

PRIVACY
- Before your first message, the app shows which AI providers receive what you send.
- Crash reports never include your chats, questions or notifications, and you can turn them off in Settings.

BEFORE YOU START
- Automatos Go works with an Automatos workspace you already belong to, or with an Automatos server you run. Sign in with your Automatos account, or connect to your own server.
- For people aged 16 and over.
```

## Keywords

Limit 100, comma-separated with no spaces. The name's words (Automatos, Go) are indexed already
and are not repeated.

```text
ai,assistant,agents,workspace,tasks,board,approvals,questions,voice,chat,automation,missions,team
```

## Support URL

Required. `SUPPORT_URL` in `src/release/legal-links.ts`.

```text
https://automatos.app/contact
```

## Marketing URL

Optional: the company site. Leave it empty if Gerard would rather a reviewer did not follow the site
to its sign-up or pricing pages. D8 and D64 govern the app, not this field.

```text
https://automatos.app
```

## Privacy policy URL

Required. `PRIVACY_POLICY_URL` in `src/release/legal-links.ts`. The page must carry the policy
with `privacy-facts.md` applied before submission (OT-R3).

```text
https://automatos.app/privacy
```

## Copyright

The year and the owner of the rights, with no URL. The rights are Gerard's while the app ships from
his individual account [D9]. Gerard changes it if a company owns them.

```text
2026 Gerard Kavanagh
```

## Category

- **Primary:** Productivity.
- **Secondary:** Business.

## Seller name

The App Store shows the seller as **Gerard Kavanagh**, the individual developer account (team
`KGVA9933BG`) [D9], as on the academy app. It changes only with a transfer to an organisation
account. A transfer needs a registered company and a D-U-N-S number, and it resets TestFlight
(critic-store-policy).

## License agreement

Apple's standard licence agreement, the App Store Connect default, unless Gerard decides to submit
the Terms as a custom licence. A custom licence must then carry Apple's minimum terms (terms draft
§09, `[CHECK]`, counsel).

## Screenshots

- **iPhone 6.9-inch display, from Gerard's phone.** App Store Connect states the accepted pixel
  sizes. If Gerard's phone is not a 6.9-inch model, its screenshots do not fit that slot.
- **No iPad screenshots.** `ios.supportsTablet` is false [D38], pinned by
  `src/release/__tests__/release-config.test.ts`, so the app is listed for iPhone only.
- **The demo workspace only:** made-up data, no real names, no customer's work, no notification
  from another app in the status bar.
- **What to show (one to ten screenshots, in this order):**
  1. Home in the Studio style: the conversation with Auto, "Auto is an AI" at the top, waiting
     work above it.
  2. Command Centre → Questions, with a question and its options.
  3. Command Centre → Board, with a ticket in Review.
  4. A social post awaiting approval, as it will publish.
  5. A Deliverable open.
  6. The voice screen, HOLD TO TALK.
  7. Home in Play and in HUD.
- No screenshot shows a plan, a price or a sign-up page [D8, D64].

## Owner step (OT-R13)

Enter every field above in App Store Connect, take the screenshots on Gerard's phone in the demo
workspace, and choose the licence agreement.
