# The app standard

How an Automatos phone app is designed and built. Automatos Go is the template, and the rules on
this page are taken from what Go does: the file that does it and, where there is one, the test
that holds it. Every app follows the same rules, so the apps read as one family and each new one
costs less than the last.

This page is the app. Its other half is [product-apps.md](product-apps.md): what a product's
server does, the rules for keys, consent and erase, and what to keep and remove when copying the
template. How this page was agreed, where each app stands against it and what the template still
owes is in [app-standard-record.md](app-standard-record.md).

**Status: in force from 15 Nov 2026.** Agreed by the sessions building the apps. Written from the
template at `51a768b` and from an audit of each app by the session building it, then changed
where those sessions objected.

## How to read a rule

Each rule has a level.

| Level | Meaning |
|---|---|
| **Must** | Every app does it. An app can pass a Must rule without sharing the template's code. |
| **Shaped** | The pattern is the template's. The values are the app's. |
| **Own** | The product decides. The standard only says that it may. |

Three lines may follow a rule:

- **Template:** the file in this repository that does it. It is the reference, not the only way.
- **Held by:** the test or lint rule that fails when the rule is broken. "Review" means nothing
  automatic holds it yet.
- **Owed:** what the template itself has to add or change before the rule can travel. Each is
  tracked in the record.

An app that cannot follow a **Must** or **Shaped** rule writes the difference down, with its
reason ([The app's record](#the-apps-record)). A difference nobody wrote down is a bug.

## 1. Tokens

**1.1 Tokens only. (Must)** A screen reads colour, spacing, radius, shadow and type through the
tokens and writes none of them itself. Template: `useTokens()` in `src/styles/theme.tsx`. Held
by, for colour: the lint rule against colour literals outside `src/styles/tokens/**`
(`eslint.config.js`, proved by `scripts/__tests__/eslint-rules-colours.test.ts`). It refuses
every hex form, `rgb()`, `hsl()`, `hwb()` and their alpha forms, and, where a colour goes, four
decimal digits or a colour's name. It misses an all-digit four-digit hex held in a constant, and
a colour's name outside a colour's place. Spacing, radius and shadow written in a screen are held
by review.

**1.2 One token shape. (Must)** Every palette fills the shape in `src/styles/tokens/types.ts`:
the colour names, nine radii (`tag` to `full`), ten spacing steps (`space1` to `space10`) and five
shadows. An app adds a palette. It does not add a second shape, and no screen changes when the
palette does. An app may add named roles of its own in files beside the palette, inside the tokens
folder. It never renames or drops a shared one.

**1.3 The palette. (Shaped)** The colours, radii and shadows are the app's own. A palette says
whether it is light or dark, so the status bar and the system's controls follow.

**1.4 A status is never colour alone. (Must)** A state is painted from its role token and always
carries a word or a glyph. The states are the app's own. They paint through one table onto the
shape's role names, not from a second set of colours. A state's word is a Text tone from that
table, and its glyph is drawn by `StateGlyph`, which takes the state and nothing else, so no
feature hands it a colour. The glyph sits beside the word and is hidden from the screen reader
(rule 10.6). Template: `src/ui/state-tokens.ts`, `src/ui/StateGlyph.tsx`, `src/ui/StatusPip.tsx`.
Held by: `src/ui/__tests__/state-tokens.test.ts`, `src/ui/__tests__/state-glyph.test.ts` and
`src/release/__tests__/text-tones.test.ts`.

**1.5 A picture's colours are their own file. (Shaped)** The colours of an illustration or a
scene sit in a token file of their own. Text is drawn over a picture only on one flat colour of
it, and that pair is in the contrast test (rule 10.4).

## 2. Type

**2.1 Every word is the Text primitive. (Must)** A role from the scale and a tone from the tokens.
No screen sets a font size, a weight or a colour on text. The tones cover a state's words
(`success`, `info`, `warning`, `danger`) and the two quieter inks (`muted`, `subtle`). Template:
`src/ui/Text.tsx`, `src/ui/variants.ts`. Held by: `src/release/__tests__/text-tones.test.ts`, which
refuses a colour handed to Text outside `src/ui/`. Each exception is in its allowed list with its
reason, such as a style's own chrome painting its own palette.

**2.2 The roles. (Must)** Title 1 to 6, body 1 to 6, label, figure 1 to 3, eyebrow, and the
thread's own roles. An app may add content roles of its own beside them, as the thread has.
Template: `src/styles/type.ts`.

**2.3 The sizes and faces. (Shaped)** An app sets its own sizes and its own fonts for those roles,
in a second scale built beside the template's. Studio's scale is a desktop's and stays pinned. An
app for consumers uses larger text: 16 points for body. Fonts are bundled files named by their
PostScript name, with no weight or italic set on top. A variable font with its weight chosen in
code is a difference to record, and is checked on Android before an Android release. Template:
`src/styles/fonts.ts`, and `buildTypeScale` in `src/styles/type.ts`, so a second scale is a list
of sizes and not a second copy of the file. Held by: `src/styles/__tests__/type-scale.test.ts`.

**2.4 Nothing under 11 points, and Dynamic Type stays on. (Must)** Text grows to the
accessibility sizes and layouts wrap. A cap is at least 2 and carries its reason on the line
above. Template: `MIN_TEXT_SIZE` and `TEXT_SCALING` in `src/styles/type.ts`. Held by:
`src/release/__tests__/a11y-audit.test.ts`, and by the scale builder, which refuses a role under
11 points.

## 3. Primitives

**3.1 One core set. (Must)** Screen, Header, Text, Button, IconButton, TextField, Card, ListRow,
Divider, Sheet, Toast, KeyboardLift, LoadingState, EmptyState and ErrorState, from `src/ui/`.
Chip, Pill, SegmentedControl, Slider, Switch, SwitchRow, Section, SectionNote, StatusPip,
StateGlyph, OutOfDateNote, CountBadge and TabBar come with them for an app that needs them. A
feature imports these and never writes a second button, row or sheet.

**3.2 Raw controls are the exception. (Must)** A feature may draw a shape no primitive has. It
then carries what the primitive would have given it: a role, a name and a 44-point target. Raw
text and raw text fields are not used outside `src/ui/`. Held by:
`src/release/__tests__/a11y-audit.test.ts`.

**3.3 One component per file, its logic beside it. (Must)** What a variant, size or state means
is a pure function with tests. The component only wires. Template: `src/ui/variants.ts`,
`src/ui/__tests__/`.

**3.4 A new primitive. (Shaped)** Something two features need goes into `src/ui/`. Something one
feature needs stays in that feature until a second asks for it. A primitive two apps need goes
into the template.

**3.5 Control sizes come from the style. (Shaped)** A consumer app's buttons and fields are
larger than Studio's. Each style has one list of control sizes, built by `buildControlSizes`. The
builder refuses a list that would put a pressable under the 44-point target, with the slop its
primitive gives it, and a size no control can be. It keeps a frozen copy. The primitives read the
list from `useStyle().controls`. Template: `src/styles/controls.ts`, `STYLE_CONTROLS` in
`src/styles/tokens/controls.ts`. Held by: `src/styles/__tests__/controls.test.ts`.

**3.6 Icons. (Must)** One icon set, imported one icon at a time, drawn at the stroke the
primitives use (`ICON_STROKE` in `src/ui/paint.ts`). The template's is `lucide-react-native`. The
audits read the set's name from `ICON_SET` in `src/release/__tests__/settings/a11y-audit.ts`, so
an app on another set names it there.

## 4. The screen

**4.1 Every screen is the Screen primitive, or a frame built on it. (Must)** It gives the safe
area, the ground and the status bar's tone. `scroll` is on for forms, settings and long states, and off where the screen
owns a list. Template: `src/ui/Screen.tsx`.

**4.2 One header. (Must)** A screen's header is one component built from the tokens: back, a
title and at most two actions (its type refuses a third). Back goes through one hook that falls
back to home when there is nothing behind. It stays, and does nothing, on a tab's root and where
nothing is behind and the fallback is the screen already showing. The Header draws no Back where
pressing it would do nothing, by the same rule. An app does not use the system's header or tab bar
in their place (the record, decision D3). Template: `src/ui/Header.tsx`, its logic in
`src/ui/header-model.ts` and its collapsing title in `src/ui/use-collapsing-title.ts`;
`src/navigation/use-go-back.ts` (`useBack`, which also hands the Header its move, and
`useGoBack`), whose rule is the pure `backMove` in `src/navigation/back.ts`. Held by:
`src/ui/__tests__/header.test.ts`, `src/navigation/__tests__/go-back.test.ts`, which also walks
every product file: no file but the hook calls the router's back. A copy keeps the pure module's
name, `header-model.ts`: a `header.ts` beside `Header.tsx` clashes on a file system that ignores
case. Owed: none of the template's own screens is on the Header yet. Each would change visibly
(most settings screens have no bar: back sits at the top of the scrolling content), so each move
needs a phone check.

**4.3 The keyboard. (Must)** Every keyboard-avoiding view takes the one behaviour
(`KEYBOARD_AVOIDING_BEHAVIOUR`), on both platforms. A message box pads through
`useKeyboardSafeBottom`, never by the raw home-indicator inset. Template:
`src/ui/use-keyboard-height.ts`, `src/ui/KeyboardLift.tsx`. Held by:
`src/ui/__tests__/sheet-keyboard.test.ts`.

**4.4 Route files are thin. (Must)** A file under `app/` mounts a screen that lives under `src/`
and holds nothing else. Thin means this. The file imports only from `src/`, and from the router
only the route's params and `Redirect`. Beside its imports it holds one default function.
That function takes no props, may name what it reads from the params, calls no other hook, writes
no function inside, and returns one element with no children: a screen from `src/`, or a
`Redirect`. A layout file is not a screen: it is held only to declaring its stack. Nor is
`app/+native-intent.tsx`, the router's file for links the system hands over, which
`src/navigation/__tests__/system-links.test.ts` holds to handing them to rule 5.2's one table. A
route that cannot be thin is on the audit's allowed list with its reason. One is: an alias of the
chat route. Template: `app/welcome.tsx`, the rule in
`src/release/__tests__/support/route-files.ts`, the list in
`src/release/__tests__/settings/thin-routes.ts`. Held by:
`src/release/__tests__/thin-routes.test.ts`.

**4.5 A picture above a sheet. (Shaped)** Where a screen is a scene with its content on a sheet
below, it is one shared frame built on Screen, not drawn per screen. The template has none. It is
built once in the app that needs it and comes into the template when a second app does (rule
3.4).

## 5. Navigation

**5.1 One route table. (Must)** Every route is a constant or a builder in
`src/navigation/routes.ts`. No path is written by hand anywhere else.

**5.2 One way in from outside. (Must)** A notification, a link or a scan becomes an app route
through one table, and what it carries is checked before anything opens. In a release build,
nothing from outside reaches the router but a route that table builds: anything else opens Lost
(`routes.lost`). A link over 2,048 characters is not parsed. A link with a scheme is read only
when it is https on the one host the app claims for its links, or the app's own scheme: another
scheme or another host opens Lost. A link's query holds at most 16 pairs, counted before any is
read. The table reads only the names its entry reads and ignores any other, but a name it reads
given twice refuses the link, and so does a value it reads over 512 characters once decoded. An id
from outside holds letters, digits, dot, underscore and hyphen, at most 128, and is never `.` or
`..` (`isUsableId` in `src/navigation/routes.ts`). It is taken exactly as it came: an id that
arrives padded is refused, not trimmed. An address or a code a person typed, pasted or scanned is
still trimmed, because a person may paste a space. In a development build only the development
client's own launch form goes on unmapped. The app's own scheme is held to the table in every
build. Template: `src/navigation/web-links.ts`, `app/+native-intent.tsx`. Held by:
`src/navigation/__tests__/link-rules.test.ts`, `system-links.test.ts` and
`src/navigation/__tests__/routes.test.ts`.

**5.3 A gate before the screens. (Must)** One pure, tested table decides what a person sees
before the app proper: each first-run stage, sign-in, consent, then the app. The screens behind
it never check for themselves. Template: `src/app-state/gate.ts`, `src/app-state/AppGate.tsx`.

**5.4 One of two shells. (Shaped)**

| Shell | When | What it is |
|---|---|---|
| **One home** | The person starts in the same place every time, and the rest are rooms they go to and come back from | One stack. Home, and the rooms pushed from it. No tab bar |
| **Tabs** | Three to five places of equal weight | One tab bar, and a stack in each tab |

Never both a tab bar and a second bar or drawer. Never more than five tabs. Every tab shows its
word, not only an icon, and the selected one is marked by more than colour. A tab whose feature
is off is absent (rule 6.5). Pressing the selected tab takes its stack back to its root. Whether
the bar is docked or floats is the app's. The rules above and in sections 4 and 6 hold in both
shells. The template is One home and mounts no tabs. Its Tabs shell is for an app that does: the
app passes its tabs as data, a tab whose feature is off is dropped, and a pure function names
what is wrong with a list (more than five, fewer than three, a route twice, a tab with no word).
Template: `src/ui/TabBar.tsx` with `src/ui/tab-bar.ts`, and `src/shell/` (`AppTabs.tsx`,
`TabStack.tsx`, `tabs.ts`). Held by: `src/ui/__tests__/tab-bar.test.ts`,
`src/shell/__tests__/tabs.test.ts`. Owed: the phone checks, on the first app that mounts the shell.

**5.5 Sheet or screen. (Must)** Something read or decided on top of where the person is opens as
a sheet. Somewhere the person goes is a screen. Template: `src/ui/Sheet.tsx`.

## 6. States

**6.1 Every load has four states. (Must)** Loading, empty, failed and loaded, drawn by
`LoadingState`, `EmptyState` and `ErrorState`. No screen shows a blank while it waits, and none
writes its own spinner or error block. When one action inside a screen fails, such as a turn in
a conversation, the failure is shown where the action is, in the words of its error kind.

**6.2 An error is a kind, and each kind has its words. (Must)** The app has one API client, and
it turns every failure into one of its kinds: `network`, `auth`, `forbidden`, `not_found`,
`conflict`, `server`, `stream`, `invalid_response`, `limit`. The words for a kind come from one
table. A person never sees a status code, an address or a server's own message. "Try again" is
offered only where trying again can help. Every 429 is `limit`, at a stream's opening too. It
carries when the limit lifts, from Retry-After (seconds or a date) or the body, worked out against
a clock given to the client. A wait that is missing, unreadable, negative or more than 24 hours is
unknown. "Try again" is offered for a limit. No route the template calls answers 402 for a spent
allowance, so a 402 stays `server`. Template: `src/api/errors.ts`, `src/api/retry-after.ts`,
`src/ui/ErrorState.tsx`.

**6.3 The edges are whole screens. (Must)** Something went wrong, the first open and a route that
does not exist each have a screen in the app's own voice. So does a server that does not answer,
where the app has nothing to show without it: that screen re-checks quietly by itself. An app
that keeps its data on the phone shows what it holds instead, under rule 6.4. Template:
`src/styles/edges/`.

**6.4 A screen says what it is showing. (Must)** Data that is out of date stays on screen under a
line that says so. Not set up, offline, waiting to send and not downloaded are named states with
their own words, never a spinner that does not end. The out-of-date line is `OutOfDateNote`, on
every screen and sheet that can hold older data: thirteen, listed in
`src/release/__tests__/settings/named-states.ts`. Beside them, `OWED` lists a copy's screens that
still owe the line, each with its file and its reason. It is empty in the template. A failed
refresh keeps what the screen holds,
under the line. The failed state is for a read that holds nothing. Coming back from the background
asks again: TanStack's focus follows the app's foreground state, wired once beside the query
client, so a stale query a screen holds is read again on a real return, and shows fresh data or
keeps what it held under the line. A short flip to inactive and back, such as a permission prompt,
asks nothing, and a query with a rule of its own for a return opts out. Template:
`src/ui/OutOfDateNote.tsx`, `src/api/app-focus.ts`. Held by:
`src/release/__tests__/named-states.test.ts` with `support/out-of-date.ts`, which walks the words
of each named state, checks that each listed screen draws the line, and holds that every screen
that reads its query's refetch error is in one list or the other, never both, and that each owed
one names a file and a reason; and `src/api/__tests__/app-focus.test.ts`.

**6.5 Nothing is shown that does not work. (Must)** A row, a tab or a button appears only when
what it opens exists. No "coming soon". And what has shipped can be reached: two taps from an
obvious entry. What stops working while it is on screen leaves it: in the template, a suggestion
past its expiry leaves at the next minute, though its list has not changed. Template:
`src/suggestions/use-suggestions.ts`. Held by: review, and for a suggestion's expiry
`src/suggestions/__tests__/expiry-tick.test.ts`.

**6.6 One toast. (Must)** A short confirmation goes through the one toast provider. Template:
`src/ui/ToastProvider.tsx`.

## 7. First run and asks

**7.1 The first screen carries the policy and the Terms. (Must)** Both open the system browser,
never a web view. Held by: `src/release/__tests__/privacy-surfaces.test.ts`.

**7.2 Consent comes before the first thing sent. (Must)** Where an app sends a person's words to
an AI, the gate shows what goes where and waits for a yes. Template: `src/consent/`. Held by:
`src/release/__tests__/surfaces.test.ts`.

**7.3 The app asks before the system does. (Must)** A permission is asked for in the app's own
words first, on a screen that says why, and the system's prompt appears only after the person
says yes there. "Not now" is respected: the app does not ask again within a week, and never by
itself after a second no. An app that asks less than that conforms. Template:
`src/push/prompt/policy.ts`.

**7.4 When to ask. (Shaped)** At the moment the permission is first useful, never on a cold
launch. An app whose reminders are the product may ask during first run.

**7.5 Every usage string is honest and names the app. (Must)** Held by:
`src/release/__tests__/permissions.test.ts` and `privacy-manifest.test.ts`. Owed: the speech
recognition string says recognition happens on the iPhone, which is not always true. The
corrected sentence is in `docs/release/ipa-scan.md`, and goes into `app.json` with the next native
change.

**7.6 Sign-in. (Own)** How people sign in is the product's. Two things follow from the stores'
rules: an account made in the app can be deleted in the app, and an app that offers another
company's sign-in offers Sign in with Apple beside it.

## 8. Settings

**8.1 One Settings screen. (Shaped)** A scrolling Screen of Cards holding ListRows. The product's
own sections and the app's (the look, Notifications, Voice) come first. Privacy and legal with
About come after them. The ways to leave are always last, and the one that cannot be undone is
the very last. A section the app has no use for is left out. Template:
`src/settings/SettingsScreen.tsx`, which `app/(app)/settings/index.tsx` mounts.

**8.2 Privacy and legal. (Must)** The policy, the Terms, support, the crash reports switch where
the app reports crashes, and the version with the code the app runs. Template:
`src/release/components/PrivacySection.tsx`. Held by:
`src/release/__tests__/privacy-section.test.ts`.

**8.3 About. (Must)** A product app says "Powered by Automatos AI" here, from one constant, and
lists the licences of what it is built from. Template: Settings → About → Licences, from
`src/about/`. Its list, `src/about/licences.json`, is written by `scripts/generate-licences.mjs`
from the lockfile and the installed packages. Held by: `scripts/__tests__/release-licences.test.ts`:
the file matches a fresh run, every package has a licence, and the kinds of licence are pinned so
that a new kind is read by a person. The list does not hold the native libraries a native build
fetches.

**8.4 Leaving is plain. (Must)** Whatever the app or its server holds about the person or the
phone is named in one sentence, next to the one action that removes it. A session the server ends
is not the person leaving. An app that holds the person's work not yet sent keeps it. While signed
out it shows none of it, and the signed-out screen names what is kept in one sentence next to one
action that removes it. It sends the work when the same person signs in again, and clears
everything before any sync when a different person signs in. Every way the person chooses to leave
(sign-out, switching or forgetting a server, deleting the account) still runs the one clearing. A
sign-out first sends the waiting work while the token still works, and if it cannot, says what will
be lost before clearing. Any partial wipe while signed in (for example, deleting one kind of data)
keeps the record the different-person check reads; otherwise the next person's sign-in looks like
the install's first and keeps the previous person's work. While signed out, every screen that shows
the person's data is gated in its own layout, not only by navigation, so a link cannot open it;
scheduled local notifications are held and cleared from the screen too. An app on Clerk cannot tell
an account deleted on the server from a session that ended: `useAuth` reports an expired session, a
revoked one and an account deleted elsewhere the same way (`isSignedIn` false, no reason). So the
carve-out relies on the signed-out screen's remove action, and on a deleted account's next sign-in
being a different id. The template holds no work not yet sent, so its behaviour is unchanged: every
way of leaving, and a session the server ends, runs one clearing, which also deletes the person's
files in the cache, a downloaded theme's files among them. Template: `clearUserData` in
`src/connect/switch.ts`, `src/connect/user-files.ts`. Held by:
`src/connect/__tests__/user-files.test.ts`, for the one clearing. The carve-out for a session the
server ends is not pinned by a test here, because the template holds no work not yet sent: a copy
that holds such work pins it with its own tests. Owed: pictures the app has shown may stay in the
phone's own picture cache until the phone clears it.

**8.5 A person's data is theirs to take and to remove. (Must, where the app has accounts)** Export
my data, delete my data and delete my account are each one action. Each runs on the server first
and then on the phone, is safe to repeat, and names on screen what was left undone if it stops
half way. A second person who signs in on the same phone finds nothing of the first. Held by:
`src/release/__tests__/user-data.test.ts`.

## 9. Where a person meets an AI

**9.1 The AI label. (Must)** Wherever a person talks to an AI or reads what an AI wrote, one small
caption says so, in the muted text tone. Text made by fixed rules is not labelled as an AI's.
Template: `src/styles/ai-label.tsx`. Held by: `src/release/__tests__/surfaces.test.ts`.

**9.2 Report this. (Must)** An AI's reply to the person can be reported from where it is shown,
where the server takes reports.
Text an AI wrote that the product checked and published for everyone is corrected at its source:
the app gives a way to say it is wrong. Template: `src/ui/ReportSheet.tsx`. Held by the same
test.

**9.3 The thread. (Must)** One tested parser for the reply stream in each app, never a second
written by hand. Where the product's server passes Automatos's data stream through, it is the
vendored parser and turn reducer in `src/core/`, never edited by hand. The thread's words and
the message box are at least 16 points.

**9.4 Voice. (Must)** The notice that the voice is an AI is given once in each voice session.
Template: `src/voice/`.

## 10. Accessibility

**10.1 Touch targets are 44 points. (Must)** A smaller control reaches 44 through its hit slop.
The text field is drawn 40 points tall and sits in a frame whose slop grows it to 44, and
`buildControlSizes` holds the field to the target with the other controls. A switch is one
control. In a row, the row is the control: a press anywhere on it turns the switch, it carries the
role, the name and the state, and the native switch inside is drawn only, neither a second target
nor a second stop. On its own, the switch and its word are the control, grown to 44 by the slop.
Every switch in the app, a style's own included, takes its state from the one model. Template:
`MIN_TOUCH` and `hitSlopFor` in `src/ui/paint.ts`, `fieldTouch` in `src/ui/variants.ts`;
`src/ui/SwitchRow.tsx`, `src/ui/Switch.tsx`, `src/ui/switch-model.ts`. Held by:
`src/ui/__tests__/touch-targets.test.ts`, `src/styles/__tests__/controls.test.ts`,
`src/ui/__tests__/every-switch.test.ts`.

**10.2 Every control has a name. (Must)** A control that shows no words has an accessibility
label, and a button that is only an icon is the IconButton, whose type requires one. Held by:
`src/release/__tests__/a11y-audit.test.ts`. What changes on a screen is told one way. A region
whose words appear or change while the person is there calls `useAnnounce` beside its live
region. On iOS, which has no live regions, it says the words once each time they appear or
change, never words still on screen and never blank or hidden ones. On Android the live region
speaks. Template: `src/ui/use-announce.ts`, its decision the pure `announceStep` in
`src/ui/announce-model.ts`. Held by: `src/release/__tests__/announcements.test.ts`: only the hook
announces, and every live region that speaks sits in a component that uses it or is on a short
list with its reason. Owed: one list footer, listed there.

**10.3 Reduce Motion is honoured. (Must)** A sheet fades where it would slide, and every loop
stops and shows a still. Template: `src/styles/provider/reduce-motion.ts`, `src/ui/Sheet.tsx`.

**10.4 Contrast is tested. (Must)** Every text colour on every ground it is drawn on, in every
palette, at WCAG AA (4.5 to 1), computed from the tokens. A pair that reads under it is listed in
the test with what it measures and why it stands, and may not get worse. A mark in the accent (a
rule, a dot, a cursor) reads at 3 to 1 or more, from one lookup. Template:
`src/styles/contrast.ts`, `src/ui/accent.ts`. Held by: `src/styles/__tests__/contrast.test.ts`
and `src/ui/__tests__/accent.test.ts`. The tool line's spinner and the other marks that painted
the accent raw (a tab's rule, a day's dot, the busy ring, the chosen style card's ring and word)
read it through `src/ui/accent.ts`, and `accent.test.ts` checks each mark. Every mark of a switch
reads at 3 to 1: each track on the page and on a card, and the thumb on each track. Each track is
the first token in its list that reads there, by the accent's lookup (`switchTokens` in
`src/ui/switch-model.ts`, `firstMark` in `src/ui/accent.ts`), and the contrast test holds the pairs
in every palette. The slider's part past its limit is drawn faded and is decoration, not a mark:
the thumb stops there and the value is said in words. Owed: some of the calendar's kind squares
read under 3 to 1 as marks on dark grounds. Their colours are the server repository's own values.
Also owed: only a screen reader is told why the slider's thumb stops at its limit. A sighted
person has no line that says it.

**10.5 Text to be read is never dimmed. (Must)** Read, quiet or secondary text takes a muted
token, never an opacity set on the text or on what holds it, so its contrast can be tested. A
token that carries transparency is allowed where the contrast test blends it over every ground it
is drawn on. A count beside a pill's label is a colour held at 4.5 to 1 on each ground it is drawn
on, idle, pressed and selected, never its label's ink under an opacity. A disabled control may
dim, and a pressed one while it is pressed. Template: `src/ui/pill-count.ts`. Held by:
`src/styles/__tests__/contrast.test.ts`, `src/ui/__tests__/pill-count.test.ts`.

**10.6 Decoration carries no meaning. (Must)** A picture, a scene or a character is hidden from
VoiceOver and is never the only way something is said. So is a state's glyph beside its word: the
word says the state (rule 1.4). Template: `src/ui/StateGlyph.tsx`. Held by:
`src/ui/__tests__/state-glyph.test.ts`.

**10.7 The largest text is checked on a phone. (Must)** Before a release, every screen is walked
at the largest text size. Template: `docs/release/accessibility-pass.md`.

## 11. Words

**11.1 No word is written in a component. (Must)** Every user-facing word sits in a strings file
the audits can walk. Where they sit is Shaped: the template keeps one `strings.ts` per feature,
with words that differ by platform in a pair beside it. An app whose website and app share their
words may keep those in the one shared source. Template: `src/*/strings.ts`,
`src/step-up/check-copy.ts`. Held by: `src/release/__tests__/store-copy.test.ts`.

**11.2 A terms table. (Shaped)** Each app keeps a short table of its own nouns and the words it
never uses for them, and its copy follows it.

**11.3 Words that must not change are tested. (Must)** A disclaimer, a safety line or any
sentence that was reviewed has a test that walks every string that carries it.

**11.4 The voice. (Own)** How the app speaks is the product's.

**11.5 The words say no more than the code does. (Must)** A sentence about what the app sends,
keeps or deletes, or where it does something, is read against the code that does it, and says no
more than that code does. Held by: review.

## 12. Motion, haptics and sound

**12.1 Motion is short and has a reason. (Shaped)** A sheet takes 220 ms and a toast stays 2.4
seconds. An app's own motion is its own, inside rule 10.3. Template: `src/ui/overlay.ts`.

**12.2 Haptics are rare. (Shaped)** One for an action the person just took, such as a message
sent or a choice flipped. An exercise the product is made of may use one as part of the exercise.
Never the only signal. A haptic that fails is logged and never thrown.
Template: `src/chat/composer/Composer.tsx`.

**12.3 A loop can be paused. (Must)** Motion that starts by itself and runs for more than five
seconds has a control that stops it. A loading indicator is not such a loop: rule 10.3 covers it.

**12.4 No interface sounds. (Must)** A sound belongs to a notification or to audio the person
started.

## 13. Code

**13.1 The layout. (Must)** `app/` for routes, `src/<feature>/` for everything else, organised by
feature. A feature holds its server routes (`routes.ts`), its schemas, its calls (`api.ts`), its
pure model, its hooks, its components, its `strings.ts` and its tests in `__tests__/`.

**13.2 One way out. (Must)** Every request goes through `src/api/`: data through the one client,
and a fetched file through one transfer module beside it. The transfer module writes a fetched
body to a file through the client's own request policy, a part at a time under a cap, to a
partial file that moves into place only when it is whole, so a download never passes through
memory. A file sent still does: the fetch implementation reads a request body whole before it
sends it, and the only upload that streams is the file system's own, which follows a redirect with
its headers, so none is built. The 50 MB limit on an attachment bounds it. Every answer is parsed
with zod and unknown fields are ignored. The template's parsing is written to zod 3: an app on a
newer major records it. Template: `src/api/client.ts`, `src/api/transfer.ts` with
`src/api/transfer-request.ts`. Held by, for where a request is made: the lint rules on `fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon` and other HTTP clients, however they
are loaded; on `expo/fetch` outside the transport, and on the file behind it everywhere; on a
remote picture loaded by address through the SVG library; and on the file system's own download
and upload calls outside `src/api/` (proved by `scripts/__tests__/eslint-rules*.test.ts`). The
transfer module is held by `src/api/__tests__/transfer.test.ts`. That every answer is parsed is
held by review. Owed: pictures and video are still loaded by the platform's own loaders with the
bearer attached (a Deliverable's pictures, a social post's pictures and videos), outside the one
way out. Also owed: an upload that does not hold the file in memory and follows no redirect.

**13.2a Every body is read under a cap. (Must)** The client cannot read an answer whole without a
size limit: the transport gives a body as bytes up to the caller's cap, or as it arrives, and
nothing else. An answer over its cap is refused and read no further. An error's body over its cap
gives no detail, and its status alone says what kind of error it is. A cap bounds the size, not
the work: text a server chooses is never trimmed or cut with a pattern whose work grows with the
square of its length. It is read once, by the single passes in `src/lib/text-runs.ts` and
`src/voice/speech/runs.ts`, each held equal to the pattern it replaced on ordinary input and to
linear growth on a hostile one. Template: `src/api/transport-types.ts`, `src/api/body.ts`, the
caps in `src/api/config.ts`, `src/lib/text-runs.ts`, `src/voice/speech/runs.ts`. Held by:
`src/api/__tests__/client-caps.test.ts`, `src/lib/__tests__/text-runs.test.ts`,
`src/voice/__tests__/speech-runs.test.ts`, `src/cc/__tests__/deliverable-text-runs.test.ts`.

**13.2b The address a build is given is an address and nothing more. (Must)** https, a host and an
optional port: no user name or password, no path, no query, no fragment. The host is written
plainly: lower-case ASCII letters, digits and hyphens in labels, a strict dotted quad if it is a
number, or an IPv6 address in brackets. Plain http only in a development build. A value that is
not one fails the build, and is refused again when the app starts, by the same rules: the two
checks run on different URL parsers, so neither takes its parser's reading as enough. Template:
`isServerAddress` in `src/lib/env.ts`, `scripts/check-release-env.js`. Held by:
`src/lib/__tests__/env.test.ts`, `scripts/__tests__/check-release-env.test.ts`.

**13.2c A redirect is never followed, and no cookie is kept. (Must)** Every request is sent so
that an answer asking to be followed elsewhere comes back as it is, and the client treats it as an
error. What the app holds to prove who is asking goes only to the address it was given. No request
carries a cookie or stores one. An app that lets a person pair with a server of their own may read
where one such answer pointed, to offer that same server's https address, and nothing else. One
exception: a download marked as one whose route answers with a redirect to storage follows that
redirect once, only to an https address, and carries no header at all. Its host is refused first
and judged second. It may hold only ASCII letters, digits, hyphens and dots, in labels of legal
length, with an optional numeric port, and the platform's own reading of the address must give
the same host. From a server on a public address, storage is a name of two labels or more, never
a local name and never a number in any form. From a server on a home or office network, it may be
a name, or a private dotted quad written plainly, never the phone itself, loopback or link-local.
Nothing in brackets is taken from either. What storage answers is never read as the server's: its
refusals sign no one out, and its address is kept on no error. The platform's own picture and
video loaders are not under this rule yet. Template: the request policy in
`src/api/transport.ts`, `src/api/transfer-request.ts`, `src/api/private-host.ts`,
`src/lib/host-text.ts`, `src/connect/https-twin.ts`. Held by: `src/api/__tests__/transport.test.ts`,
`client-redirect.test.ts`, `transfer-redirect.test.ts`, `storage-host.test.ts`,
`src/connect/__tests__/https-twin.test.ts`.

**13.2d An opened stream has limits. (Must)** An idle time (90 seconds for the live events, which
carry a heartbeat every 20 seconds; 15 minutes for a chat turn, which has none), a cap on one line
or event, and a cap on the whole stream. A stream ended by one is the kind `stream`. A read that
fails releases its body, and a stream read whole has a deadline. Template:
`src/api/stream-limits.ts`, the numbers in `src/api/config.ts`. Held by:
`src/api/__tests__/stream-limits.test.ts`.

**13.3 Pure logic outside React, with tests. (Must)** Updates never mutate. Held by: the coverage
gate in `vitest.config.ts`.

**13.4 Sizes. (Must)** A file warns over 400 lines and fails over 800. A function is at most 50
lines, a component 150, nesting 4 and complexity 10. Held by: `eslint.config.js`.

**13.5 A guard cannot be switched off inside a file. (Must)** Inline lint comments are not read.
Held by: `linterOptions` in `eslint.config.js`, proved by
`scripts/__tests__/eslint-rules.test.ts`.

**13.6 Storage. (Must)** What the phone keeps about the person goes in the encrypted store, and
secrets in the keychain through the one registry. A reinstall starts clean, except for the install
id, which is kept in the keychain on purpose and survives a reinstall, and except when a backup is
restored onto the same phone. Public content and downloaded media are files, outside the
encrypted store. The template keeps every file it fetches in the cache folder, which is outside
the phone's backup and which the phone may empty, because each can be fetched again. The
encrypted store's folder is in the phone's backup. Its key is in the keychain for this device
only, so a backup restored onto another phone cannot be read and the store starts clean there. A
backup restored onto the same phone after the app was deleted may bring the data and its key back
together. That is read from the platform's documents, which do not agree for a computer backup
that is not encrypted, and has not been tried on a phone: an app's words assume it can happen. On
Android `allowBackup` is false, so no backup carries either. An app whose downloads
must stay keeps them under documents. Template: `src/storage/`, `src/session/InstallGate.tsx`,
`src/connect/install-id.ts`. Held by: `src/release/__tests__/secure-store-audit.test.ts` and
`user-data.test.ts`. Owed: a native step that keeps a folder out of the phone's backup, for the
encrypted store's folder or an app's downloads. The template has none.

**13.7 Logs. (Must)** Only the logger writes to the console, and it never writes a person's
content. Template: `src/lib/logger.ts`.

**13.8 No web view. (Must)** Not as a dependency and not through another package. Held by: lint,
which refuses `react-native-webview` and Expo's DOM components (the `'use dom'` directive,
`expo/dom`, `@expo/dom-webview`), proved by `scripts/__tests__/eslint-rules-web-views.test.ts`; and
`src/release/__tests__/dependency-audit.test.ts`, which refuses both packages.

**13.9 Crash reports. (Shaped)** By how sensitive the data is. Where what a person says, their
health data or anything the app promises never leaves the phone could reach a report, the app has
no crash reporter at all. Where it has one, the
options are the template's fixed ones and the person has a switch. Template:
`src/observability/options.ts`.

## 14. Release

**14.1 CI is the gate. (Must)** Typecheck, lint, tests, an iOS bundle check and Expo's doctor, on
every pull request, from a lockfile install with scripts off. Every action the repository's own
workflows use is pinned to a commit, with its release beside it, never to a tag: a tag can be
moved to other code after review, and a commit cannot. One workflow in this repository is never
edited and still pins by tag: what it pins is its owner's to change. Template:
`.github/workflows/ci.yml`. Held by, for the pins: `src/config/__tests__/workflow-pins.test.ts`.

**14.2 The release audits travel with the copy and stay. (Must)** An audit changes only because
the product changed, and says why in its own comment. What differs by app is in one settings
folder the audits read, `src/release/__tests__/settings/`, and a copy edits that folder and no
audit. It holds the app's identity, the folders the audits walk (one outside the repository is
written as `../<folder>`, for an app that shares source with its product), the palettes and pairs
of the contrast test, and each audit's allowed list in a file named after it, every entry with
its reason, all registered in its index. It sits under `__tests__` on purpose: in the product
tree, the audits would scan it. Checks of the app's own files stay inside the audits: the files a
scan must find, and `app.json`'s plugins and fonts. A copy rewrites those as its own tests. The
audits import only what every app has: Node's own modules and the packages listed with their
reasons in `settings/audit-imports.ts`. The icon set's name is a setting (`ICON_SET` in
`settings/a11y-audit.ts`), so a copy without that library can take the accessibility audit.
Template: `src/release/__tests__/` with its `settings/`, `src/config/__tests__/`. Held by:
`src/release/__tests__/audit-settings.test.ts`, which also refuses an audit that keeps its own
copy of a value that moved, `tree.test.ts`, and `audit-imports.test.ts`, which refuses a package
not on the list and a listed one no audit imports. Owed: `yaml`, which the audits use to read
workflow files, is not declared in `package.json` and arrives only through other packages.
Declaring it waits for the next change to `package.json`.

**14.3 Updates over the air go only to the build they were made for. (Must)** The runtime version
is the fingerprint, so an update never reaches a binary with different native code. The
fingerprint reads `app.json`, `eas.json`, the scripts in `package.json`, patches and the config
plugins' own files, so a change to any of them, even a new script, makes the next merge a native
build. An app may ship with no updates over the air at all. Template: `app.json`,
`.eas/workflows/`, [release.md](release.md). Owed: the config plugin that pins the background
modes is listed near the end of the plugins in `app.json`, and the change a plugin registers last
runs first, so a plugin that pins a list must be listed first. The resolved list is right today.
Moving it changes `app.json`, so it goes with the next native change.

**14.4 The release runs with the project's own credentials. (Must)** No token for the build
service is held as a secret in the code host.

**14.5 The store record lives with the code. (Must)** What the app collects, asks for and says is
written under `docs/release/`, and a change that alters it updates the record in the same pull
request.

**14.6 No secret in a public build value, and an update is checked like a build. (Must)** Every
`EXPO_PUBLIC_` value is written into the bundle every phone downloads. The release check fails
every profile on an `EXPO_PUBLIC_` name that says secret or a value shaped like a key, and names
the variable, never the value. The update job runs the same check before it publishes, since an
update runs no build hook. Template: `scripts/check-release-env.js`,
`.eas/workflows/testflight.yml`. Held by: `scripts/__tests__/check-release-env-secrets.test.ts`,
`src/config/__tests__/eas-release.test.ts`.

**14.7 Every release step comes from the template's release files, copied. (Must)** Never from
memory, and never from another app's handoff. A step the template lacks is added to the template
first, then copied. The files are the delivery, `.eas/workflows/testflight.yml` and `pr-check.yml`
(rules 14.3 and 14.6); the first release, `scripts/release/first-release.mjs`, which makes the
internal TestFlight group with automatic distribution that eas-cli does not always make; the state
check, `scripts/release/state.mjs` with `state-eas.mjs`; the modules both read,
`scripts/release/asc.mjs`, `eas.mjs` and `project.mjs`; the list of the EAS environment's names,
`docs/release/eas-env.json`; and the steps in `docs/release/README.md` under First release, Signing
and capabilities, EAS environment and State check. A copy takes them whole. It lists its own names
in `eas-env.json`, changes the public address in the update hook (14.6), and passes `--profile`,
`--workflow` or `--group` where its names differ. The scripts read the app's own `app.json` and
`eas.json`, so no id is written into them. Before an app's first build goes to TestFlight,
`first-release.mjs --apply` has made the group and the group has testers; before each release,
`state.mjs` prints no FAIL. Template: those files. Held by: their tests, which a copy takes with
them: `scripts/__tests__/release-first-release.test.ts`, `release-state.test.ts` and
`release-state-eas.test.ts`, over the fakes in `release-state-harness.ts` and
`release-fixtures.ts`. `release-state.test.ts` also holds `eas-env.json` to the names
`src/lib/env.ts` reads, and, in the template, these files and sections to this rule.

## 15. Android

**15.1 iOS first, Android kept compiling. (Shaped)** What differs by platform is a `*.android.ts`
twin beside its file, and CI bundles both. An app with no Android release yet says so in its
record. Template: `npm run check:bundle:android`. Owed, before any Android release: the sign-in
library keeps a native copy of its token outside the registry, which sign-out does not remove.

## 16. The design handoff

Designs are made outside the code. So that what is built is what was drawn, a handoff made after
this standard is signed follows these two rules. An older one is a row in the app's record.

**16.1 What a handoff holds. (Must)** A token file. A component sheet that shows every component
once, in every palette, the three state primitives among them. A frame for each state of a screen
that is more than its primitive: nothing to act on, nothing listed yet, out of date. And the
edges of rule 6.3.

**16.2 The code is checked against it. (Must)** A test compares the app's tokens to the handoff's
token file. Each component on the sheet exists once in the code, built on the primitives.

## 17. The product's own

The palette, the fonts and sizes, the picture or character, the home screen's layout, the words
and their tone, how people sign in, whether the app works offline, audio the product plays, any
safety check its subject needs, its own features, and the names of its places. The standard says
how a screen is built and how the app behaves. It does not say what the product is.

## The app's record

Each app keeps one file with one name, `TEMPLATE.md`, beside its `package.json`:

```markdown
# Where this app came from, and where it differs

Template commit: <40-character sha>. Standard read at: <sha>.

## Kept, removed, changed

| Part | Kept, removed or changed | Why |
|---|---|---|

## Differences from the app standard

| Rule | What this app does | Why | Stays, or closes with |
|---|---|---|---|
| 5.4 | ... | ... | Stays |
| 14.3 | ... | ... | Closes with <the work>, by <date> |
```

A difference that will close names the work that closes it, and carries a date once the owner has
set one. A rule the app has no use for is a row too ("9.4: does not apply, the app has no
voice"). The file lives in the app's own repository: this
repository's record names no product.

A test travels with the audits and holds the file. In a copy, which sets `role: 'copy'` in
`src/release/__tests__/settings/record.ts`, it requires `TEMPLATE.md` beside `package.json`: a
40-character template commit and the commit the standard was read at, both tables, only rules
that exist, and no row that leaves its rule, what the app does or whether it stays blank. The rule
numbers travel as `src/release/__tests__/support/standard-rules.json`, written from this page by
`node scripts/generate-standard-rules.mjs`. In the template the test fails while that list differs
from this page, and proves the checker on the example above. Template:
`src/release/__tests__/support/app-record.ts`. Held by:
`src/release/__tests__/app-record.test.ts`.

## How the standard changes

1. A change is proposed against this page, with the app that needs it and the reason.
2. It is written here first, in one pull request, with the template's code if the code changes,
   and a dated line is added under Changes.
3. Each app then follows, or adds a row to its record.

A pattern one app invents that a second app wants moves into the template and onto this page. It
is not copied from app to app. An app reads Changes at each release and brings itself up to the
template, or records why not.

## Changes

| Date | Change |
|---|---|
| 15 Nov 2026 | First written. |
| 15 Nov 2026 | Landed in the template: the scale builder (2.3), the one contrast test over every pair (10.4), the wider network guard (13.2) and no inline disabling of a guard (13.5). A copy made before this takes those four files. |
| 15 Nov 2026 | A redirect is never followed and no cookie is kept (13.2c). Every answer of the transport now has `header()`, not only a binary one, so a copy's fakes gain it. A copy that talks to one fixed server takes the request policy and has no use for the https lookup. |
| 15 Nov 2026 | Every body the client reads is read under a cap (13.2a), and the address a build is given is held to a bare https address (13.2b). A copy takes `src/api/transport-types.ts`, `transport.ts`, `client.ts`, `config.ts`, `src/lib/env.ts` and `scripts/check-release-env.js`. Its own fakes and tests lose `text()` on a transport answer. |
| 15 Nov 2026 | The accent as a foreground (text, a glyph, a rule, a dot) is read from `src/ui/accent.ts`: the palette's `accent` where that reads on its page, its `primary` where `accent` is a ground. The contrast test found one style drawing its accent text in a ground colour. A copy takes that file and reads the accent through it wherever it paints one. |
| 16 Nov 2026 | The Header (4.2) and the Tabs shell (5.4) are built. The Header is back, a title and at most two actions, and back goes through `useGoBack`, whose rule is the pure `src/navigation/back.ts`; the shell takes an app's tabs as data and drops one whose feature is off. A copy takes `src/ui/Header.tsx`, `header-model.ts`, `use-collapsing-title.ts`, `TabBar.tsx`, `tab-bar.ts`, `src/navigation/back.ts`, `use-go-back.ts` and `src/shell/`, with their tests. |
| 16 Nov 2026 | Switch, SwitchRow, Section and SectionNote are primitives in `src/ui/` (3.1), and every feature that drew its own now uses them. A copy takes those four files with `switch-model.ts` and `section-model.ts`. |
| 16 Nov 2026 | Control sizes come from the style (3.5), no longer from constants in `src/ui/variants.ts`. An app whose controls are larger builds its own list with `buildControlSizes` (`src/styles/controls.ts`) and gives it to its style in `STYLE_CONTROLS` (`src/styles/tokens/controls.ts`); the primitives read it from `useStyle().controls`. A copy takes those two files, `src/styles/provider/resolve.ts`, `src/ui/variants.ts` and the primitives that read the list. |
| 16 Nov 2026 | A state's word is a Text tone and its glyph is `StateGlyph` (1.4, 2.1); Text gains `danger`, and a scan refuses a colour handed to Text outside `src/ui/`. Two colours changed: a running or waiting chat line's mark used the accent raw, which in one style is a ground colour and could not be seen, and the calendar's kind word is the muted ink in every palette, because the kind colours fail AA as text (the square keeps its colour). A copy takes `src/ui/variants.ts`, `tone-colour.ts`, `state-tokens.ts`, `StateGlyph.tsx` and `src/release/__tests__/text-tones.test.ts` with its support files. |
| 16 Nov 2026 | A test walks the words of the named states (6.4), and the out-of-date line, `OutOfDateNote`, is drawn over a list kept after a failed refresh on the Command Centre's four tabs and the inbox. A copy takes `src/ui/OutOfDateNote.tsx` and `src/release/__tests__/named-states.test.ts`, and lists its own states and screens in the test. |
| 16 Nov 2026 | Settings → About → Licences lists every package the app is built from, with its licence (8.3). `scripts/generate-licences.mjs` writes `src/about/licences.json` from the lockfile and the installed packages, and its test fails while the file differs from a fresh run. A copy takes the script, `scripts/__tests__/release-licences.test.ts`, `src/about/` and `app/(app)/settings/licences.tsx`, then regenerates from its own lockfile with `node scripts/generate-licences.mjs`. |
| 16 Nov 2026 | A ninth error kind, `limit` (6.2): every 429, carrying when the limit lifts, read against a clock given to the client. A 402 stays `server`. A copy takes `src/api/errors.ts`, `retry-after.ts`, `client.ts`, `config.ts` and `strings.ts`, and gives `limit` its case wherever it switches on a kind. |
| 16 Nov 2026 | One transfer module writes a fetched body to a file (13.2), and a route that redirects to storage is followed once, to https only, with no header (13.2c). The lint rules refuse the file system's own download and upload calls outside `src/api/`. A copy takes `src/api/transfer.ts`, `transfer-request.ts`, `client.ts` and `eslint.config.js` with their tests, and moves any download of its own onto `download()`. |
| 16 Nov 2026 | An opened stream has limits (13.2d): an idle time, a cap on one line or event and a cap on the whole stream. A read that fails releases its body, and a stream read whole has a deadline. A copy takes `src/api/stream-limits.ts`, `stream.ts`, `sse.ts`, `deadline.ts`, `body.ts`, `client.ts` and `config.ts`, and sets the idle times to its own server's heartbeat. |
| 16 Nov 2026 | The guards are wider (1.1, 13.2, 13.8): a remote picture loaded by address through the SVG library, the `'use dom'` directive and the DOM web view imports, four-digit hex and more colour forms where a colour goes, and `expo/fetch` anywhere but the transport. The dependency audit refuses the DOM web view package too. A copy takes `eslint.config.js`, `scripts/__tests__/eslint-rules*.test.ts` and `src/release/__tests__/dependency-audit.test.ts`. |
| 16 Nov 2026 | An update is checked like a build (14.6): the release check fails every profile on a secret in an `EXPO_PUBLIC_` value, and the update job runs it before it publishes. The update's check that `main` has not moved on reads `main`'s head through the job's own checkout first, so a private copy can publish, and publishes with a loud warning when the head cannot be read at all. A copy takes `scripts/check-release-env.js` and `.eas/workflows/testflight.yml` with their tests, and changes the public address in that hook to its own. |
| 16 Nov 2026 | Every way of leaving also deletes a downloaded theme's files (8.4). A copy takes `src/connect/user-files.ts`, `switch.ts` and `use-server-switch.ts`, and adds each folder of a person's files it keeps in the cache to `USER_FILE_CLEARERS`. |
| 16 Nov 2026 | The app's words were read against its code and corrected where they said more than the code does: the pairing card, where speech is recognised, what each way of leaving deletes, the report sheet on the hosted server and the count of styles. Rule 11.5 says so for every app. |
| 16 Nov 2026 | Rule 13.6 now says what survives a reinstall and what a backup carries, and 14.3 what the fingerprint reads. Nothing for a copy to take. An app whose downloads must stay keeps them under documents. |
| 16 Nov 2026 | The release audits read one settings folder (14.2): the app's identity, the folders they walk, the contrast test's palettes and pairs, and each audit's allowed list in a file named after it, every entry with its reason. The audits now import from it, and `audit-settings.test.ts` refuses one that keeps its own copy of a value that moved. A copy takes `src/release/__tests__/settings/` and edits it (its identity, its folders, its own allowed lists), with the audits, `audit-settings.test.ts` and `tree.test.ts`. |
| 16 Nov 2026 | A test holds the app's record: in a copy, `app-record.test.ts` requires `TEMPLATE.md` beside `package.json`, naming its commits, carrying both tables and citing only rules that exist. The rule numbers travel as `standard-rules.json`, which the template writes from this page. A copy takes `src/release/__tests__/app-record.test.ts`, `support/app-record.ts`, `support/standard-rules.json`, `settings/record.ts` and `scripts/generate-standard-rules.mjs`, and sets its role to `copy`. |
| 16 Nov 2026 | One way to announce (10.2): a region whose words appear or change calls `useAnnounce`, which says them on iOS once each time they appear or change, and leaves them to the live region on Android. A walk of the source refuses any other caller of the announcement, and a speaking live region without the hook unless it is listed with its reason. A copy takes `src/ui/use-announce.ts`, `announce-model.ts`, `src/release/__tests__/announcements.test.ts` and `settings/announcements.ts`, and moves its own announcements onto the hook. |
| 16 Nov 2026 | The out-of-date line is on every screen and sheet that can hold older data (6.4): thirteen, and none owed. A failed refresh keeps what a screen holds under the line, and the failed state is for a read that holds nothing. A copy takes `src/ui/OutOfDateNote.tsx` and `named-states.test.ts`, and lists its own screens in `settings/named-states.ts`. |
| 16 Nov 2026 | Every file under `app/` is held to a stated thin-route rule (4.4), and the Settings screen lives in `src/settings/SettingsScreen.tsx`, which its route only mounts (8.1). A layout is held only to declaring its stack, and one alias route is on the allowed list with its reason. A copy takes `src/release/__tests__/thin-routes.test.ts`, `support/route-files.ts` and `settings/thin-routes.ts`, and moves what its own routes hold into `src/`. |
| 16 Nov 2026 | No file but `useGoBack` calls the router's back (4.2). The chat route, Older chats and the voice screen, which wrote the rule by hand, go through the hook, and `go-back.test.ts` refuses any other caller. A copy takes `src/navigation/__tests__/go-back.test.ts`, and moves its own back buttons onto `useGoBack`. |
| 16 Nov 2026 | The text field takes the 44-point touch (10.1). It is still drawn 40 tall, inside a frame whose slop grows it to 44, and `buildControlSizes` holds the field to the target. A copy takes `src/ui/TextField.tsx`, `src/ui/variants.ts` and `src/styles/controls.ts`, with `src/ui/__tests__/touch-targets.test.ts` and `src/styles/__tests__/controls.test.ts`. |
| 16 Nov 2026 | A link from outside opens a route the one table builds, or Lost (5.2). Before, a link the table could not map went to the router as it came, so a crafted link could open any screen; now only a development build lets one through, an id from outside is held to `isUsableId`, and a link over 2,048 characters is not parsed. A copy takes `src/navigation/web-links.ts`, `routes.ts` (its `lost` route and `isUsableId`), `app/+native-intent.tsx` and `src/api/url.ts`, with `system-links.test.ts`, `web-links.test.ts` and `routes.test.ts`, and sets `APP_LINK_HOST` to its own host. |
| 16 Nov 2026 | Back has a third move, stay (4.2): on a tab's root, and where nothing is behind and the fallback is the screen already showing, it does nothing; before, in that second case, it put the screen in its own place. The Header draws no Back where the move is stay, read from the same rule through `useBack`, and `showsBack` takes the move, not `root`. A copy takes `src/navigation/back.ts`, `use-go-back.ts`, `src/ui/Header.tsx` and `header-model.ts`, with `go-back.test.ts` and `header.test.ts`. |
| 16 Nov 2026 | A switch is one control and every mark of it reads at 3 to 1 (10.1, 10.4): a switch row is the control, the native switch inside is drawn only, every switch in the app, a style's own included, takes its state from the one model, and each track is the first token in its list that reads on the page and on a card. This changes what a person sees: the off track, in every style. A copy takes `src/ui/switch-model.ts`, `Switch.tsx`, `SwitchRow.tsx` and `accent.ts`, with `switch-model.test.ts`, `every-switch.test.ts` and the switch pairs in `src/styles/__tests__/contrast.test.ts`, and moves any switch of its own onto the model. |
| 16 Nov 2026 | `StateGlyph` takes a state, never a colour, and is hidden from the screen reader (1.4, 10.6). Its props were a glyph and a colour name; it now takes `state` alone, and draws the glyph and its token from `stateGlyphMark` in `src/ui/state-tokens.ts`. A copy takes `src/ui/StateGlyph.tsx`, `state-tokens.ts` and `src/ui/__tests__/state-glyph.test.ts`, and changes each of its callers to pass the state. |
| 16 Nov 2026 | A pill's count is a colour held at AA on each ground it is drawn on, idle, pressed and selected, not its label's ink under an opacity (10.5); where three quarters of the ink would read under AA, the count takes the ink itself, which changed some counts in two styles. Rule 10.5 now says that a pressed control may dim while it is pressed, as the primary button does. A copy takes `src/ui/pill-count.ts`, `Pill.tsx`, `variants.ts` and `src/styles/contrast.ts`, with `pill-count.test.ts` and the count's pairs in the contrast test. |
| 16 Nov 2026 | Coming back from the background asks again (6.4): TanStack's focus follows the app's foreground state, wired once beside the query client, so a stale query a screen holds is read again on a real return, and a short flip to inactive asks nothing. Before, nothing wired it, so a return asked again only where a screen did so itself. A copy takes `src/api/app-focus.ts` and its call in `src/app-state/query-root.tsx`, with `app-focus.test.ts`, and sets `refetchOnWindowFocus: false` on any query with a return rule of its own. |
| 16 Nov 2026 | Every action the repository's own workflows use is pinned to a commit, with its release beside it, not to a tag (14.1). `workflow-pins.test.ts` refuses any other `uses:`, read as lines and as YAML, and holds the CI job names. A copy takes `src/config/__tests__/workflow-pins.test.ts`, and pins its own workflows at commits. |
| 16 Nov 2026 | Text a server chooses is trimmed and cut in one read, never with a pattern whose work grows with the square of its length (13.2a). Each single pass answers as the pattern it replaced on ordinary and random input, and grows linearly on a long run. A copy takes `src/lib/text-runs.ts`, `src/voice/speech/runs.ts` and the files that call them (`sentences.ts`, `speakable.ts`, `src/cc/deliverables/detail.ts`, `file-source.ts`), with their tests and `src/lib/__tests__/growth.ts`. |
| 16 Nov 2026 | The link table is as strict as the strictest copy's (5.2): a link carries at most 16 query pairs, counted before any is read, a name the table reads given twice refuses it, a name it does not read is ignored, and a value it reads is at most 512 characters once decoded. An id that arrives padded is refused, not trimmed, and in a development build only the development client's own launch form goes on unmapped, so the app's own scheme is held to the table in every build. A copy takes `src/navigation/web-links.ts` and `routes.ts`, with `link-rules.test.ts`, `web-links.test.ts`, `routes.test.ts` and `system-links.test.ts`. |
| 16 Nov 2026 | The redirect to storage refuses a host first and judges it second (13.2c): it must be written plainly and read the same by the platform's own URL, so a host written with a percent-escape, a non-ASCII or full-width character, or in brackets can no longer be judged public while the phone connects somewhere else. The address a build is given is written plainly too (13.2b): the check at launch had accepted a non-ASCII, full-width or capital host that the build's check refused, because the two run on different URL parsers. A copy takes `src/lib/host-text.ts`, `src/api/private-host.ts`, `transfer-request.ts`, `src/lib/env.ts` and `scripts/check-release-env.js`, with `storage-host.test.ts`, `private-host.test.ts`, `transfer-redirect.test.ts`, `host-text.test.ts`, `env.test.ts` and `check-release-env.test.ts`. |
| 16 Nov 2026 | A copy has a place to say which screens still owe the out-of-date line (6.4): `OWED` in `settings/named-states.ts`, each entry a screen's file and its reason, empty in the template. `named-states.test.ts` holds that every screen that reads its query's refetch error is in one list or the other, never both. A copy takes `src/release/__tests__/named-states.test.ts` and `support/out-of-date.ts`, adds `OWED` to its `settings/named-states.ts` and its settings index, and lists there each screen of its own that does not draw the line yet. |
| 16 Nov 2026 | The audits import only what every app has (14.2, 3.6): Node's own modules and the packages listed with their reasons in `settings/audit-imports.ts`, and `audit-imports.test.ts` refuses any other. The icon set's name is a setting, `ICON_SET` in `settings/a11y-audit.ts`, so a copy without that library can take the accessibility audit, and the upload audit types the pickers' files from the app's own `picked.ts`. A copy takes `audit-imports.test.ts`, `support/imports.ts`, `support/a11y.ts`, `a11y-audit.test.ts`, `upload-audit.test.ts`, `audit-settings.test.ts` and `settings/audit-imports.ts` with its settings index, sets `ICON_SET` to its own set, and adds to the list, with its reason, any package its own audits import. |
| 16 Nov 2026 | A copy that gains `src/config/__tests__` moves its identity values into `settings/identity.ts` in the same change: `audit-settings.test.ts` reads every file there as an audit and fails on one that spells the app's identity (14.2). That test and `audit-imports.test.ts` both walk the folder, and fail while it is missing. |
| 16 Nov 2026 | The client was hardened after two security reviews and a correctness review of a copy (13.2, 13.2a, 13.2c, 13.2d, 6.2). The bearer is given to a loader outside the client only for an address on the client's own server: `headersFor(url)` replaces `authHeaders()`, so a copy updates its callers. A stream has a total time as well as an idle time; a download names its time limit, which covers the whole body, and a stopped one never shares a partial file; a query in a limit is not asked again by a remount, a return to the front or a reconnect until the limit lifts; a route path starts with exactly one slash; a redirect's address is kept on no error when it carries a query; development http stays on a home network, and the client itself refuses an address that is not a plain origin. A copy takes `src/api/` whole, with `src/lib/host-text.ts` and `src/lib/ip.ts`. |
| 16 Nov 2026 | Push was hardened after a review of a copy's push code (5.2, 7.3, 8.4). The person's last choice wins over a registration call that is out: a tap releases its hold when it is made, and a removal runs in the registrar's own queue. A sign-out finds and removes the server's row of a registration whose answer was lost, and a removal the server has not confirmed is kept as owed and tried again. A Reply typed on a notification is posted only when every word the notification shows is the server's own: the body is the signed question, there is no subtitle or picture, and the sender in the title is either the app's fixed one or the one the server names for that question when the phone asks it; each signed payload can be replied to once. What the lock screen draws is still not signed. A copy with push takes `src/push/registration/`, `src/push/bind/` and `src/push/inbound/` with their tests, and `docs/release/push-security.md`. |
| 16 Nov 2026 | Every release step comes from the template's release files, copied (14.7). A copy's first build reached no tester: the app already existed in App Store Connect, and eas-cli makes the internal TestFlight group only when it creates the app, or when the app has no group and it can sign in to App Store Connect. `scripts/release/first-release.mjs` makes that group (dry run by default, `--apply` to act, never changing or deleting a group), `scripts/release/state.mjs` reads the release's state in one line per check (the group, its testers, the newest build, the EAS environment's names, the latest delivery run, the build quota and the CI/CD minutes), and `docs/release/README.md` gains First release, Signing and capabilities, EAS environment and State check. A copy takes `scripts/release/first-release.mjs`, `state.mjs`, `state-eas.mjs`, `asc.mjs`, `eas.mjs` and `project.mjs`, `docs/release/eas-env.json` with its own names, those four sections, and `scripts/__tests__/release-first-release.test.ts`, `release-state.test.ts`, `release-state-eas.test.ts`, `release-state-harness.ts` and `release-fixtures.ts`; then runs `first-release.mjs` once and `state.mjs` before each release. |
| 16 Nov 2026 | A session the server ends is not the person leaving (8.4), decided by the template as the standard's chair and agreed by the owner. An app that holds the person's work not yet sent keeps it, shows none of it while signed out, names it beside one action that removes it, sends it when the same person signs in again and clears everything first when another person does. Every way the person chooses to leave still runs the one clearing, and a sign-out sends the waiting work first or says what will be lost. A partial wipe while signed in keeps the record the different-person check reads, every screen with the person's data is gated in its own layout while signed out, and scheduled local notifications are held and cleared; Clerk reports a deleted account and an ended session alike, so the carve-out leans on the signed-out screen's remove action. The template holds no work not yet sent, so nothing changes in it, and a copy that holds none takes nothing. |

## Related

- [product-apps.md](product-apps.md): the server side, and starting an app from this template.
- [app-standard-record.md](app-standard-record.md): the meeting record, where each app stands and
  what the template owes.
- [architecture.md](architecture.md): how the template is put together.
- [styles-and-themes.md](styles-and-themes.md): the template's own styles.
- [release.md](release.md) and [release/README.md](release/README.md): how a merge ships, and the
  store requirements.
