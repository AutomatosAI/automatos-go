# The app standard: the record

Who agreed [the app standard](app-standard.md) and how, where each app stands against it, what
the template still owes, and what is open. The standard is the rules. This page is the tracking.

This repository is public, so no product is named here. The apps are:

| | What it is | Where it came from | Shell |
|---|---|---|---|
| **Template** | Automatos Go | This repository | One home |
| **App A** | An app with its own accounts, in testers' hands | Older than the template: the template's first scaffold was lifted from it. It has not taken the template's later work | Tabs |
| **App B** | An app that remembers each person | Copied from the template at `ad31af8` | One home |
| **App C** | An app with no sign-in that knows nobody | Copied from the template at `16c667d`, as a folder inside its product's repository. In build | Tabs |

Each app's own detail, with file paths, lives in its `TEMPLATE.md` in its own repository.

## Meeting, 15 Nov 2026

**Called by** the owner: one gold-standard pattern for how the phone apps are designed. The
standard comes from the template. The apps will not always be the same, but the overall patterns
hold in all four. The goal behind it is the product standard, whose page for apps and their
servers is [product-apps.md](product-apps.md).

**Taking part:** the sessions building the template and apps A, B and C. The template's session
chaired, and the owner gave it the design decisions.

**Round 1.** Each session audited its own app from its code against fourteen areas: tokens, type,
primitives, navigation, the screen frame, states, first run, settings, the AI surface,
accessibility, words, motion, code guards and release, and Android. Each also named what it does
better than the template, where the template's pattern does not fit, what must stay its own, and
its view on how the standard is kept.

**What round 1 found**

- B and C are true copies of the template and follow most of it. Their differences are the look,
  the shell and what they removed, which is what a product is meant to change.
- A is not on the template. It has its own theme, a thin set of primitives and none of the
  template's guards or audits. It is the largest gap, and closing it includes native changes.
- The template had no answer for four things the apps needed: a shell with tabs, a shared header,
  text and control sizes for a consumer app, and audits that run in a copy without hand edits.
- The apps had built five things the template lacks and should have: a scale builder, one
  contrast test over every text and ground, a wider network guard that cannot be switched off
  inside a file, named states for offline and out-of-date data, and data rights for an app with
  accounts.

**Round 2.** The chair sent draft 2 of the standard with the decisions below, and directions to
each session. _Objections: pending._

## Decisions

| | Decision | Why |
|---|---|---|
| D1 | Rules have three levels: Must, Shaped, Own. A Must is written as what the app does | All three apps asked for the split. An app that is not on the template can still pass a Must |
| D2 | Two shells: One home, and Tabs (three to five equal places). Never a second bar | Two apps have one home and rooms. Two have several equal places. The behaviours are the same in both |
| D3 | Chrome is drawn from the tokens: one Header and one TabBar primitive. No system header and no system tab bar | Every word is then the Text primitive, so the tests for Dynamic Type, contrast and Android cover the chrome too. The router's native tabs are still marked unstable (`expo-router` 6.0.24) |
| D4 | Each app keeps `TEMPLATE.md` beside its `package.json`, in one shape. A difference that will close carries a date | Three files with three names and shapes existed. This record names no product, so the detail has to live with each app |
| D5 | The app asks in its own words before the system's prompt (Must). When it asks is Shaped | One app's reminders are the product and are asked for in first run. The rule that matters is that the system's prompt follows a yes |
| D6 | Crash reporting depends on how sensitive the data is | One app handles what people say and their health data, and has no crash reporter at all |
| D7 | The audits read one settings file per app, and are written against rules with a per-app allowed list | Today a constant is edited by hand in every copy, and the audits cannot run in a tree shaped differently from the template |
| D8 | The standard carries a dated list of changes. An app catches up at each release or records why not | A copy is the same as the template only until the template's next commit |
| D9 | The design handoff is part of the standard: a token file, a component sheet in every palette, every state a frame, and a test that compares tokens | Designs are made outside the code sessions |
| D10 | This record names no product. Apps are A, B and C | The repository is public |

## Where each app stands

By section of the standard. **Follows**, **Partly**, **Differs**, **Not built**, or **n/a**. A
cell says where the app is today, not where its open branches would put it.

| Section | Template | App A | App B | App C |
|---|---|---|---|---|
| 1 Tokens | Follows | Differs | Follows | Follows |
| 2 Type | Follows | Differs | Follows | Follows |
| 3 Primitives | Partly: three owed | Differs | Follows | Follows |
| 4 The screen | Partly: Header owed | Differs | Partly | Partly |
| 5 Navigation | Follows | Differs | Follows | Not built |
| 6 States | Partly: 6.4 | Partly | Partly | Partly |
| 7 First run and asks | Follows | Follows | Follows | Not built |
| 8 Settings | Follows | Partly | Follows | Not built |
| 9 Meeting an AI | Follows | Partly | Follows | n/a in its first release |
| 10 Accessibility | Partly: 10.4 | Partly | Follows | Follows |
| 11 Words | Follows | Partly | Follows | Follows |
| 12 Motion, haptics, sound | Follows | Follows | Follows | Not built |
| 13 Code | Partly: 13.2, 13.5 | Differs | Follows | Follows |
| 14 Release | Partly: 14.2 | Differs | Partly | Not built |
| 15 Android | Follows | Partly | Not built | Not built |
| 16 The design handoff | Partly | Not checked | Not checked | Follows |

## What the template owes

The template is held to the standard too. Each line is a rule's "Owed".

| | What | Rule | Where it comes from |
|---|---|---|---|
| T1 | A Header primitive | 4.2 | App C builds it to an agreed contract. Lifted from there |
| T2 | The Tabs shell: a TabBar primitive | 5.4 | The same |
| T3 | Switch and settings Section move into `src/ui/` | 3.1 | They live in one feature of the template today |
| T4 | A scale builder, so a second type scale is a list of sizes | 2.3 | App B has written it |
| T5 | Control sizes read from the theme | 3.5 | New |
| T6 | One contrast test over every text colour and ground, in every palette | 10.4 | Apps B and C have each written it |
| T7 | The network guard covers `WebSocket`, `EventSource`, `sendBeacon`, other HTTP clients, and the same modules reached by `require()` or `import()` | 13.2 | App C has written it |
| T8 | Inline disabling of a lint rule is refused | 13.5 | App C has it. The template has no inline disable today |
| T9 | One settings file per app that the audits read | 14.2 | New |
| T10 | A test that `TEMPLATE.md` exists, names a commit and cites only rules that exist | The app's record | New |
| T11 | A shared frame for a picture above a sheet | 4.5 | App B has one. App C needs one |
| T12 | A test that walks the words for the named states | 6.4 | Apps A and B each have one for their own fixed words |

## Open for the owner

| | Question | Recommendation |
|---|---|---|
| O1 | App A's path onto the template. Three stages are proposed: the Musts that need none of the template's code; then the template's parts copied in; then one batch of native changes. The last costs native builds | Take the stages in that order, after the work App A already has waiting has shipped. The owner sets the dates |
| O2 | Copies or a shared package. Today each app copies the template at a commit. A package for the primitives and the audits would end the drift, and would be one more thing to publish and version | Stay with copies and the Changes list until three apps are on the template, then decide with what the catch-up actually cost |

## Raised, not adopted

- Every dependency held to an exact version with a written reason (App C does this). Left to
  each app for now.
- One plain page in the app that says what the phone downloads, sends and stores and what the
  server holds, backed by a test over every request the client can build (App C). Rule 8.4 asks
  for the sentence, not the page.
- A queue for what a person does while offline, as a template pattern (App A). The product's own
  for now: only one app needs it.
- A check that reads a message before it is sent, where the subject is sensitive (App B). The
  product's own.

## Actions

| Who | What |
|---|---|
| Template | T1 to T12. Record each in the standard's Changes as it lands |
| App A | Write `TEMPLATE.md` with a row per rule and the three stages sized. Ship what is waiting first. Nothing from the standard goes into that work |
| App B | Turn its strip record into `TEMPLATE.md`. List which of the four states each loading screen draws. Give T4, T6 and T11 back |
| App C | Build its screens on the Tabs shell with drawn chrome. Build the Header and TabBar to the contract and hand them over. Move its lineage into `TEMPLATE.md` |
