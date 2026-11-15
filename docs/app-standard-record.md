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
each session. No session objected to a decision. They objected to the wording of rules, and each
objection was ruled on by the chair:

| Rule | From | Objection | Ruling |
|---|---|---|---|
| 1.2 | A | One shape leaves nowhere for a product's own colour roles | Accepted. An app may add named roles beside the palette. It never renames or drops a shared one |
| 1.4 | C | Say whose the states are | Accepted. The states are the app's. They paint through one table onto the shape's role names |
| 2.2 | A | A product needs content roles of its own | Accepted, as the thread has its own |
| 2.3 | A | Variable fonts set a weight in code | A difference to record, checked on Android before an Android release |
| 4.5 | C | Its picture is a band with no sheet | The frame stays in the app that needs it until a second app does |
| 5.4 | A, C | The bar may float. A tab may be absent when its feature is off. Pressing the selected tab returns its stack to the root | All three accepted into the rule and the TabBar contract |
| 6.2 | A | No kind for a limit reached | Accepted. A ninth kind is owed (T14) |
| 6.3 | C | An app that holds its data on the phone must not show a whole screen when the server is silent | Accepted. It shows what it holds, under rule 6.4 |
| 9.2 | C | Report fits an AI's reply to the person, not text published to everyone after checks | Accepted. That text is corrected at its source |
| 9.3 | A | Its server sends other events, so the vendored parser cannot be a Must | Accepted. One tested parser per app. The vendored one where the data stream is passed through |
| 10.5 | A | Its quiet text tokens carry transparency | Allowed where the contrast test blends them over every ground |
| 11.1 | A, C | Words kept in one folder, or in a source shared with a website | Accepted. The Must is that no word is in a component. Where the files sit is Shaped |
| 12.3 | A | As written it puts a stop control on every loading skeleton | Accepted. Scoped to motion that starts by itself and runs over five seconds |
| 13.2 | A, C | A file transfer cannot go through a client for data, and the file system's own calls slip past the guard | Accepted. One transfer module beside the client, and a wider guard (T7, T15) |
| 13.6 | A | Public content and downloaded media are not what the encrypted store is for | Accepted |
| 13.9 | C | No crash reporter where the app promises nothing leaves the phone | Accepted |
| 14.2 | C | The settings file must accept a product folder outside the app's own | Accepted (T9) |
| 16.1 | C | Drawing loading and failed for every screen repeats the primitives | Accepted. The sheet shows the state primitives once. A frame is drawn for a state that is more than its primitive |
| 16 | B | As a Must it fails every design made before today | Accepted. It applies to handoffs made after the standard is signed. An older one is a row |
| The record | B | A session cannot set a date. Only the owner can | Accepted. A closing row names the work that closes it, and carries a date once the owner sets one |
| 1.5 | B | It draws text over its picture, on one flat colour, and tests that pair | Accepted, in those words |
| 4.1, 4.5 | B | A scene frame is a second frame beside Screen | Ruled: a frame is built on Screen. App B's is a difference until it is |
| 6.1 | B | A turn that fails belongs in the thread, not in an error block | Accepted. A screen's load uses the primitives. One action's failure is shown where the action is |
| 7.3 | B | The week and the two declines should be limits | Accepted. An app that asks less conforms |
| 9.2 | B | Report only where the server takes reports | Accepted |
| 9.3 | B | "16 points" contradicts a larger scale | Accepted: at least 16 |
| 12.2 | B | A haptic that is part of an exercise | Accepted. Still never the only signal |
| 13.2 | B | Say which zod the template is written to | Accepted: zod 3. An app on a newer major records it |
| 14.2 | B | The settings file should carry the allowed lists and the contrast pairs too | Accepted (T9) |

Two notes from App B's session on the server page were checked against automatos-ai at `46c1e2f`
and added to [product-apps.md](product-apps.md): how a product with several agents or keys names
its settings, and that a server key cannot yet manage documents.

The server half of the goal, each product against the ten rules of product-apps.md, is tracked
with each product and not on this page: some of its lines say what a product has not yet closed.

## Decisions

| | Decision | Why |
|---|---|---|
| D1 | Rules have three levels: Must, Shaped, Own. A Must is written as what the app does | All three apps asked for the split. An app that is not on the template can still pass a Must |
| D2 | Two shells: One home, and Tabs (three to five equal places). Never a second bar | Two apps have one home and rooms. Two have several equal places. The behaviours are the same in both |
| D3 | Chrome is drawn from the tokens: one Header and one TabBar primitive. No system header and no system tab bar | Every word is then the Text primitive, so the tests for Dynamic Type, contrast and Android cover the chrome too. The router's native tabs are still marked unstable (`expo-router` 6.0.24) |
| D4 | Each app keeps `TEMPLATE.md` beside its `package.json`, in one shape. A difference that will close names the work that closes it, and a date once the owner sets one | Three files with three names and shapes existed. This record names no product, so the detail has to live with each app |
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
| 5 Navigation | Follows | Differs | Partly | Not built |
| 6 States | Partly: 6.2, 6.4 | Partly | Partly | Partly |
| 7 First run and asks | Follows | Partly | Partly | Not built |
| 8 Settings | Partly: 8.3 | Partly | Partly | Not built |
| 9 Meeting an AI | Follows | Partly | Follows | 9.1 only in its first release |
| 10 Accessibility | Partly: five pairs under AA (T16) | Partly | Follows | Follows |
| 11 Words | Follows | Partly | Follows | Follows |
| 12 Motion, haptics, sound | Follows | Partly | Follows | Not built |
| 13 Code | Partly: 13.2, file transfers | Differs | Follows | Partly |
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
| T4 | **Done, 15 Nov.** A scale builder, so a second type scale is a list of sizes | 2.3 | Lifted from App B, with one addition: it refuses a role under 11 points |
| T5 | Control sizes read from the theme | 3.5 | New |
| T6 | **Done, 15 Nov.** One contrast test over every text colour and ground, in every palette | 10.4 | Lifted from App B. It found T16, and one style whose accent text could not be read, fixed with it |
| T7 | **Done, 15 Nov.** The network guard covers `WebSocket`, `EventSource`, `sendBeacon`, other HTTP clients, and the same modules reached by `require()` or `import()` | 13.2 | Lifted from App C |
| T8 | **Done, 15 Nov.** Inline disabling of a lint rule is refused | 13.5 | Lifted from App C |
| T9 | One settings file per app that the audits read | 14.2 | New |
| T10 | A test that `TEMPLATE.md` exists, names a commit and cites only rules that exist | The app's record | New |
| T11 | A test that walks the words for the named states | 6.4 | Apps A and B each have one for their own fixed words |
| T12 | The TabBar and Header contract's phone checks: VoiceOver's reading of a tab's position, and the swipe back with a drawn header | 10.7 | Cannot be proved in CI. Added to the phone pass |
| T13 | A list of licences in About | 8.3 | New. The template has none |
| T14 | A ninth error kind for a limit reached, carrying when it lifts | 6.2 | The template reads that answer as `server` today |
| T15 | One transfer module in `src/api/` for files sent and fetched, and the guard on the file system's own download and upload calls outside it | 13.2 | Two features of the template download files on their own today, so the guard follows the module |
| T16 | Five pairs of text and ground in Studio Light read under AA: the quietest text most of all, at 3.25 to 1 on the page | 10.4 | Found by T6 and listed in the test. The values are automatos-ai's own tokens, copied here and never retuned, so the fix is there |

## Open for the owner

| | Question | Recommendation |
|---|---|---|
| O1 | App A's path onto the template. Three stages are proposed and sized in its own record: the Musts that need none of the template's code; then the template's parts copied in; then one batch of native changes. The last costs native builds, raises the oldest iOS the app runs on, and moves what testers already hold on their phones into the encrypted store once | Take the stages in that order, after the work App A already has waiting has shipped. The owner sets the dates |
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
| Template | T1 to T16. Record each in the standard's Changes as it lands |
| App A | `TEMPLATE.md` is written, with a row per rule and the three stages sized. Ship what is waiting first. Nothing from the standard goes into that work |
| App B | `TEMPLATE.md` is written. Give T4 and T6 back. Bring back and its one short control into line (4.2, 3.2). Rebuild its scene frame on Screen when it is next touched |
| App C | Build its screens on the Tabs shell with drawn chrome. Build the Header and TabBar to the contract and hand them over. Move its lineage into `TEMPLATE.md` |
