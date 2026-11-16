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
| 3 Primitives | Follows | Differs | Follows | Follows |
| 4 The screen | Partly: the Header is built, the template's own screens are not on it (T26) | Differs | Partly | Partly |
| 5 Navigation | Follows. The Tabs shell is built and not mounted | Differs | Partly | Not built |
| 6 States | Partly: 6.4, the out-of-date line on eight screens (T27) | Partly | Partly | Partly |
| 7 First run and asks | Partly: 7.5, the speech recognition string (T28) | Partly | Partly | Not built |
| 8 Settings | Partly: 8.4, pictures left in the phone's picture cache (T25) | Partly | Partly | Not built |
| 9 Meeting an AI | Follows | Partly | Follows | 9.1 only in its first release |
| 10 Accessibility | Partly: five pairs under AA (T16), the text field (T30), a spinner and the kind squares (T31) | Partly | Follows | Follows |
| 11 Words | Follows | Partly | Follows | Follows |
| 12 Motion, haptics, sound | Follows | Partly | Follows | Not built |
| 13 Code | Partly: 13.2, pictures and video (T25) and files sent (T32); 13.6, the backup (T23) | Differs | Follows | Partly |
| 14 Release | Partly: 14.2 (T9), a plugin's order (T24) | Differs | Partly | Not built |
| 15 Android | Follows. Before an Android release: T29 | Partly | Not built | Not built |
| 16 The design handoff | Partly | Not checked | Not checked | Follows |

## What the template owes

The template is held to the standard too. Each line is a rule's "Owed".

| | What | Rule | Where it comes from |
|---|---|---|---|
| T1 | **Done, 16 Nov.** A Header primitive: back, a title and at most two actions, a third refused by its type. Back goes through `useGoBack`, whose rule is a pure function | 4.2 | Built to the agreed contract. The template's own screens are not on it yet: T26 |
| T2 | **Done, 16 Nov.** The Tabs shell: a TabBar primitive and `src/shell/`, the app's tabs passed as data, a tab whose feature is off dropped, a list's faults named by a pure function | 5.4 | Built to the agreed contract. The template is One home and mounts none of it |
| T3 | **Done, 16 Nov.** Switch, SwitchRow, Section and SectionNote are in `src/ui/` | 3.1 | They lived in one feature, and were copied by hand in others. Every copy now uses them |
| T4 | **Done, 15 Nov.** A scale builder, so a second type scale is a list of sizes | 2.3 | Lifted from App B, with one addition: it refuses a role under 11 points |
| T5 | **Done, 16 Nov.** Control sizes read from the style: one list for each style, built by `buildControlSizes`, which refuses a pressable under the 44-point target | 3.5 | New. It found the text field, 40 points tall with no slop: T30 |
| T6 | **Done, 15 Nov.** One contrast test over every text colour and ground, in every palette | 10.4 | Lifted from App B. It found T16, and one style whose accent text could not be read, fixed with it |
| T7 | **Done, 15 Nov.** The network guard covers `WebSocket`, `EventSource`, `sendBeacon`, other HTTP clients, and the same modules reached by `require()` or `import()` | 13.2 | Lifted from App C |
| T8 | **Done, 15 Nov.** Inline disabling of a lint rule is refused | 13.5 | Lifted from App C |
| T9 | One settings file per app that the audits read | 14.2 | New |
| T10 | A test that `TEMPLATE.md` exists, names a commit and cites only rules that exist | The app's record | New |
| T11 | **Done, 16 Nov.** A test that walks the words for the named states, and the out-of-date line on the Command Centre's four tabs and the inbox | 6.4 | Apps A and B each have one for their own fixed words. Eight more screens and sheets owe the line: T27 |
| T12 | The TabBar and Header contract's phone checks, on the first app that mounts the shell: VoiceOver's reading of a tab's position, and the swipe back with a drawn header | 10.7, 5.4 | Cannot be proved in CI. They go into the phone pass with that app |
| T13 | **Done, 16 Nov.** Settings → About → Licences, its list generated from the lockfile and the installed packages, and a test that the list matches a fresh run | 8.3 | New. The native libraries a native build fetches are not in the list |
| T14 | **Done, 16 Nov.** A ninth error kind, `limit`: every 429, carrying when the limit lifts, from Retry-After or the body, against a clock given to the client | 6.2 | A 402 stays `server`: no route the template calls answers one for a spent allowance |
| T15 | **Done, 16 Nov.** One transfer module in `src/api/` writes every fetched file, and the guard refuses the file system's own download and upload calls outside `src/api/` | 13.2 | Both features that downloaded on their own now use it. Files sent are T32; pictures and video, T25 |
| T16 | Five pairs of text and ground in Studio Light read under AA: the quietest text most of all, at 3.25 to 1 on the page | 10.4 | Found by T6 and listed in the test. The values are automatos-ai's own tokens, copied here and never retuned, so the fix is there. Until it is, text in the accent is held to the 3 to 1 a mark needs and not the 4.5 to 1 text needs: Studio Light's own accent is 4.23 on the page, and a stricter line would turn its links to ink |
| T17 | **Done, 15 Nov.** Shared code painted the accent colour itself in ten places: a link in an answer, a field's invalid border, the failed state's icon, the text cursor, an unread dot, a calendar dot, a tab's rule, the reason chip and a blocked status's dot. In the one style whose accent is a quiet ground they did not read | 10.4 | Found by the reviews of T6 and of its fix. All of them, and the Text primitive, now read the accent from one lookup that picks a colour that reads on the palette's page and cards |
| T18 | **Done, 16 Nov.** Text has tones for a state's words, `danger` new among them, and for the two quieter inks, and a state's glyph is `StateGlyph`. A scan refuses a colour given to Text outside `src/ui/` | 2.1, 1.4 | App C. It moved a running or waiting chat line's mark off the raw accent, and the calendar's kind word onto the muted ink. What it found that is not Text is T31 |
| T19 | **Done, 16 Nov.** The guards refuse remote pictures loaded by address (`SvgUri` and its siblings), the `'use dom'` directive and the DOM web view imports, four-digit hex and more colour forms where a colour goes, and `expo/fetch` anywhere but the transport, the file behind it included. The dependency audit refuses the DOM web view package | 13.2, 1.1, 13.8 | App C. Proved in `scripts/__tests__/eslint-rules*.test.ts`. The colour rule still misses an all-digit four-digit hex held in a constant, and a colour's name outside a colour's place |
| T20 | **Done, 15 Nov.** Every body the client reads is read under a cap. The transport no longer has a way to read one whole without a limit | 13.2a | Lifted from App C, with the template's own caps and with an oversized error body still mapped by its status |
| T21 | **Done, 15 Nov.** The address a build is given is held to a bare https address, at build time and again at launch. A server a person pairs their own phone with is a separate rule and may still be plain http on a home network | 13.2b | Lifted from App C |
| T22 | **Done, 15 Nov.** A redirect is never followed and no cookie is kept. Pairing reads where one redirect pointed, to offer a server's own https address | 13.2c | App C refuses redirects outright. The template also serves people's own servers, so it reads the one case and follows none |
| T23 | A native step that keeps a folder out of the phone's backup: the encrypted store's, and a downloads folder for an app that needs one | 13.6 | The store's folder is in the backup today. Its key is for this device only, so a backup restored onto another phone cannot be read |
| T24 | The config plugin that pins the background modes listed first in `app.json` | 14.3 | Native. The change a plugin registers last runs first, so a plugin that pins a list must be listed first. The resolved list is right today. Goes with the next native change |
| T25 | Pictures and video fetched through the transfer module and drawn from the file | 13.2, 13.2c, 8.4 | The platform's own loaders fetch them today with the bearer attached: a Deliverable's pictures, a social post's pictures and videos. What was shown may stay in the phone's picture cache after leaving. A video would be downloaded before it plays: a decision for the owner |
| T26 | The template's own screens on the Header, and the three files that write the back rule by hand moved onto `useGoBack` | 4.2 | Each screen would change visibly (most settings screens have no bar: back sits at the top of the scrolling content), so each needs a phone check. The three files are listed in `go-back.test.ts` |
| T27 | The out-of-date line on the eight screens and sheets that `named-states.test.ts` lists | 6.4 | Found by T11 |
| T28 | The speech recognition usage string corrected in `app.json` | 7.5 | Native. It says recognition happens on the iPhone, which is not always true. The corrected sentence is in `docs/release/ipa-scan.md` |
| T29 | Before any Android release: the sign-in library keeps a native copy of its token outside the registry, which sign-out does not remove | 15.1, 8.5 | The template has no Android release yet |
| T30 | The text field: 40 points tall with no slop, the one control under 44 | 10.1 | Found by T5 |
| T31 | One spinner that is not Text still paints the raw accent, and some of the calendar's kind squares read under 3 to 1 as marks on dark grounds | 10.4 | Found by T18. The kind colours are the server repository's own values, as T16's are, so that fix is there |
| T32 | A file sent without being held in memory | 13.2 | The fetch implementation reads a request body whole before it sends it, and the file system's own uploader follows a redirect with its headers, so none is built. The 50 MB limit on an attachment bounds it |

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
- Two more slots on ListRow, for a coloured summary and for a mono value such as a version (App
  C keeps two rows of its own for them). It comes into the template when a second app needs it.
- Whether an in-app browser counts as a web view under rule 13.8 (App C refuses it). The template
  itself uses one, so this is a question, not yet a rule.

## Actions

| Who | What |
|---|---|
| Template | T9, T10, T12, T16 and T23 to T32. Record each in the standard's Changes as it lands |
| App A | `TEMPLATE.md` is written, with a row per rule and the three stages sized. Ship what is waiting first. Nothing from the standard goes into that work |
| App B | `TEMPLATE.md` is written. Give T4 and T6 back. Bring back and its one short control into line (4.2, 3.2). Rebuild its scene frame on Screen when it is next touched |
| App C | Build its screens on the Tabs shell with drawn chrome. Build the Header and TabBar to the contract and hand them over. Move its lineage into `TEMPLATE.md` |
