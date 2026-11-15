# The app standard

How an Automatos phone app is designed and built. Automatos Go is the template, and the rules on
this page are taken from what Go does: the file that does it and, where there is one, the test
that holds it. Every app follows the same rules, so the apps read as one family and each new one
costs less than the last.

This page is the app. Its other half is [product-apps.md](product-apps.md): what a product's
server does, the rules for keys, consent and erase, and what to keep and remove when copying the
template. How this page was agreed, where each app stands against it and what the template still
owes is in [app-standard-record.md](app-standard-record.md).

**Status, 15 Nov 2026: draft 2.** Written from the template at `51a768b` and from an audit of
each app by the session building it. Not yet signed off by the owner.

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
tokens and writes none of them itself. Template: `useTokens()` in `src/styles/theme.tsx`. Held by:
the lint rule against colour literals outside `src/styles/tokens/**` (`eslint.config.js`, proved
by `scripts/__tests__/eslint-rules.test.ts`).

**1.2 One token shape. (Must)** Every palette fills the shape in `src/styles/tokens/types.ts`:
the colour names, nine radii (`tag` to `full`), ten spacing steps (`space1` to `space10`) and five
shadows. An app adds a palette. It does not add a second shape, and no screen changes when the
palette does.

**1.3 The palette. (Shaped)** The colours, radii and shadows are the app's own. A palette says
whether it is light or dark, so the status bar and the system's controls follow.

**1.4 A status is never colour alone. (Must)** A state is painted from its role token and always
carries a word or a glyph. Template: `src/ui/state-tokens.ts`, `src/ui/StatusPip.tsx`. Held by:
`src/ui/__tests__/state-tokens.test.ts`.

**1.5 A picture's colours are their own file. (Shaped)** The colours of an illustration or a
scene sit in a token file of their own and are never drawn under text.

## 2. Type

**2.1 Every word is the Text primitive. (Must)** A role from the scale and a tone from the tokens.
No screen sets a font size, a weight or a colour on text. Template: `src/ui/Text.tsx`,
`src/ui/variants.ts`.

**2.2 The roles. (Must)** Title 1 to 6, body 1 to 6, label, figure 1 to 3, eyebrow, and the
thread's own roles. Template: `src/styles/type.ts`.

**2.3 The sizes and faces. (Shaped)** An app sets its own sizes and its own fonts for those roles,
in a second scale built beside the template's. Studio's scale is a desktop's and stays pinned. An
app for consumers uses larger text: 16 points for body. Fonts are bundled files named by their
PostScript name, with no weight or italic set on top. Template: `src/styles/fonts.ts`. Owed: a
scale builder, so a second scale is a list of sizes and not a second copy of the file.

**2.4 Nothing under 11 points, and Dynamic Type stays on. (Must)** Text grows to the
accessibility sizes and layouts wrap. A cap is at least 2 and carries its reason on the line
above. Template: `MIN_TEXT_SIZE` and `TEXT_SCALING` in `src/styles/type.ts`. Held by:
`src/release/__tests__/a11y-audit.test.ts`.

## 3. Primitives

**3.1 One core set. (Must)** Screen, Text, Button, IconButton, TextField, Card, ListRow, Divider,
Sheet, Toast, KeyboardLift, LoadingState, EmptyState and ErrorState, from `src/ui/`. Chip, Pill,
SegmentedControl, Slider, StatusPip and CountBadge come with them for an app that needs them. A
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

**3.5 Control sizes come from the theme. (Shaped)** A consumer app's buttons and fields are
larger than Studio's. Owed: the sizes are constants in `src/ui/variants.ts` today, so an app keeps
a second file beside it.

**3.6 Icons. (Must)** One icon set (`lucide-react-native`), imported one icon at a time, drawn at
the stroke the primitives use (`ICON_STROKE` in `src/ui/paint.ts`).

Owed for this section: a Switch and a settings Section in `src/ui/` (they live in one feature
today), and a Header (rule 4.2).

## 4. The screen

**4.1 Every screen is the Screen primitive. (Must)** It gives the safe area, the ground and the
status bar's tone. `scroll` is on for forms, settings and long states, and off where the screen
owns a list. Template: `src/ui/Screen.tsx`.

**4.2 One header. (Must)** A screen's header is one component built from the tokens: back, a
title and at most two actions. Back goes through one hook that falls back to home when there is
nothing behind. Template: `src/navigation/use-go-back.ts`. Owed: the Header primitive; today each
screen in the template draws its own. _Open for the owner: whether an app may use the system's
header and tab bar in place of drawn ones (see the record, O-2)._

**4.3 The keyboard. (Must)** Every keyboard-avoiding view takes the one behaviour
(`KEYBOARD_AVOIDING_BEHAVIOUR`), on both platforms. A message box pads through
`useKeyboardSafeBottom`, never by the raw home-indicator inset. Template:
`src/ui/use-keyboard-height.ts`, `src/ui/KeyboardLift.tsx`. Held by:
`src/ui/__tests__/sheet-keyboard.test.ts`.

**4.4 Route files are thin. (Must)** A file under `app/` mounts a screen that lives under `src/`
and holds nothing else. Template: `app/welcome.tsx`.

**4.5 A picture above a sheet. (Shaped)** Where a screen is a scene with its content on a sheet
below, it is one shared frame, not drawn per screen. The template has none: the first app to
build one gives it back.

## 5. Navigation

**5.1 One route table. (Must)** Every route is a constant or a builder in
`src/navigation/routes.ts`. No path is written by hand anywhere else.

**5.2 One way in from outside. (Must)** A notification, a link or a scan becomes an app route
through one table, and what it carries is checked before anything opens. Template:
`src/navigation/web-links.ts`, `app/+native-intent.tsx`.

**5.3 A gate before the screens. (Must)** One pure, tested table decides what a person sees
before the app proper: each first-run stage, sign-in, consent, then the app. The screens behind
it never check for themselves. Template: `src/app-state/gate.ts`, `src/app-state/AppGate.tsx`.

**5.4 One of two shells. (Shaped)**

| Shell | When | What it is |
|---|---|---|
| **One home** | The person starts in the same place every time, and the rest are rooms they go to and come back from | One stack. Home, and the rooms pushed from it. No tab bar |
| **Tabs** | Three to five places of equal weight | One tab bar, and a stack in each tab |

Never both a tab bar and a second bar or drawer. Never more than five tabs. Every tab shows its
word, not only an icon. The rules above and in sections 4 and 6 hold in both shells. The template
is One home. Owed: the Tabs shell.

**5.5 Sheet or screen. (Must)** Something read or decided on top of where the person is opens as
a sheet. Somewhere the person goes is a screen. Template: `src/ui/Sheet.tsx`.

## 6. States

**6.1 Every load has four states. (Must)** Loading, empty, failed and loaded, drawn by
`LoadingState`, `EmptyState` and `ErrorState`. No screen shows a blank while it waits, and none
writes its own spinner or error block.

**6.2 An error is a kind, and each kind has its words. (Must)** The app has one API client, and
it turns every failure into one of its kinds: `network`, `auth`, `forbidden`, `not_found`,
`conflict`, `server`, `stream`, `invalid_response`. The words for a kind come from one table. A
person never sees a status code, an address or a server's own message. "Try again" is offered
only where trying again can help. Template: `src/api/errors.ts`, `src/ui/ErrorState.tsx`.

**6.3 The edges are whole screens. (Must)** The server does not answer, something went wrong, the
first open and a route that does not exist each have a screen in the app's own voice. The first
re-checks quietly by itself. Template: `src/styles/edges/`.

**6.4 A screen says what it is showing. (Must)** Data that is out of date stays on screen under a
line that says so. Not set up, offline, waiting to send and not downloaded are named states with
their own words, never a spinner that does not end. Held by: review. Owed: a test that walks
those words, as two of the apps already have.

**6.5 Nothing is shown that does not work. (Must)** A row, a tab or a button appears only when
what it opens exists. No "coming soon". And what has shipped can be reached: two taps from an
obvious entry. Held by: review.

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
says yes there. "Not now" is respected: it is not asked again for a week, and after the second
decline only Settings offers it. Template: `src/push/prompt/policy.ts`.

**7.4 When to ask. (Shaped)** At the moment the permission is first useful, never on a cold
launch. An app whose reminders are the product may ask during first run.

**7.5 Every usage string is honest and names the app. (Must)** Held by:
`src/release/__tests__/permissions.test.ts` and `privacy-manifest.test.ts`.

**7.6 Sign-in. (Own)** How people sign in is the product's. Two things follow from the stores'
rules: an account made in the app can be deleted in the app, and an app that offers another
company's sign-in offers Sign in with Apple beside it.

## 8. Settings

**8.1 One Settings screen. (Shaped)** A scrolling Screen of Cards holding ListRows. The product's
own sections and the app's (the look, Notifications, Voice) come first. Privacy and legal with
About come after them. The ways to leave are always last, and the one that cannot be undone is
the very last. A section the app has no use for is left out. Template:
`app/(app)/settings/index.tsx`.

**8.2 Privacy and legal. (Must)** The policy, the Terms, support, the crash reports switch where
the app reports crashes, and the version with the code the app runs. Template:
`src/release/components/PrivacySection.tsx`. Held by:
`src/release/__tests__/privacy-section.test.ts`.

**8.3 About. (Must)** A product app says "Powered by Automatos AI" here, from one constant, and
lists the licences of what it is built from.

**8.4 Leaving is plain. (Must)** Whatever the app or its server holds about the person or the
phone is named in one sentence, next to the one action that removes it.

**8.5 A person's data is theirs to take and to remove. (Must, where the app has accounts)** Export
my data, delete my data and delete my account are each one action. Each runs on the server first
and then on the phone, is safe to repeat, and names on screen what was left undone if it stops
half way. A second person who signs in on the same phone finds nothing of the first. Held by:
`src/release/__tests__/user-data.test.ts`.

## 9. Where a person meets an AI

**9.1 The AI label. (Must)** Wherever a person talks to an AI or reads what an AI wrote, one small
caption says so, in the muted text tone. Text made by fixed rules is not labelled as an AI's.
Template: `src/styles/ai-label.tsx`. Held by: `src/release/__tests__/surfaces.test.ts`.

**9.2 Report this. (Must)** An AI's message can be reported from where it is shown. Template:
`src/ui/ReportSheet.tsx`. Held by the same test.

**9.3 The thread. (Must)** The stream parser and the turn reducer are the vendored ones in
`src/core/`, never edited by hand. The thread's words and the message box are 16 points.

**9.4 Voice. (Must)** The notice that the voice is an AI is given once in each voice session.
Template: `src/voice/`.

## 10. Accessibility

**10.1 Touch targets are 44 points. (Must)** A smaller control reaches 44 through its hit slop.
Template: `MIN_TOUCH` and `hitSlopFor` in `src/ui/paint.ts`.

**10.2 Every control has a name. (Must)** A control that shows no words has an accessibility
label, and a button that is only an icon is the IconButton, whose type requires one. Held by:
`src/release/__tests__/a11y-audit.test.ts`.

**10.3 Reduce Motion is honoured. (Must)** A sheet fades where it would slide, and every loop
stops and shows a still. Template: `src/styles/provider/reduce-motion.ts`, `src/ui/Sheet.tsx`.

**10.4 Contrast is tested. (Must)** Every text colour on every ground it is drawn on, in every
palette, at WCAG AA (4.5 to 1), computed from the tokens. Owed: the template tests each style in
its own file; the one test over every pair, which two of the apps have written, comes back into
the template so it travels.

**10.5 Text to be read is never dimmed. (Must)** Read, quiet or secondary text takes a muted
token, never an opacity, so its contrast can be tested. A disabled control may dim.

**10.6 Decoration carries no meaning. (Must)** A picture, a scene or a character is hidden from
VoiceOver and is never the only way something is said.

**10.7 The largest text is checked on a phone. (Must)** Before a release, every screen is walked
at the largest text size. Template: `docs/release/accessibility-pass.md`.

## 11. Words

**11.1 One strings file per feature. (Must)** No user-facing word is written in a component.
Words that differ by platform sit in a pair beside it. Template: `src/*/strings.ts`,
`src/step-up/check-copy.ts`. Held by: `src/release/__tests__/store-copy.test.ts`.

**11.2 A terms table. (Shaped)** Each app keeps a short table of its own nouns and the words it
never uses for them, and its copy follows it.

**11.3 Words that must not change are tested. (Must)** A disclaimer, a safety line or any
sentence that was reviewed has a test that walks every string that carries it.

**11.4 The voice. (Own)** How the app speaks is the product's.

## 12. Motion, haptics and sound

**12.1 Motion is short and has a reason. (Shaped)** A sheet takes 220 ms and a toast stays 2.4
seconds. An app's own motion is its own, inside rule 10.3. Template: `src/ui/overlay.ts`.

**12.2 Haptics are rare. (Shaped)** One for an action the person just took, such as a message
sent or a choice flipped. Never the only signal. A haptic that fails is logged and never thrown.
Template: `src/chat/composer/Composer.tsx`.

**12.3 A loop can be paused. (Must)** Any motion that repeats has a control that stops it.

**12.4 No interface sounds. (Must)** A sound belongs to a notification or to audio the person
started.

## 13. Code

**13.1 The layout. (Must)** `app/` for routes, `src/<feature>/` for everything else, organised by
feature. A feature holds its server routes (`routes.ts`), its schemas, its calls (`api.ts`), its
pure model, its hooks, its components, its `strings.ts` and its tests in `__tests__/`.

**13.2 One API client. (Must)** Every request goes through `src/api/`. Every answer is parsed
with zod and unknown fields are ignored. Held by: the lint rules on `fetch` and `XMLHttpRequest`.
Owed: the same guard on `WebSocket`, `EventSource`, `sendBeacon` and other HTTP clients, which one
app has already added.

**13.3 Pure logic outside React, with tests. (Must)** Updates never mutate. Held by: the coverage
gate in `vitest.config.ts`.

**13.4 Sizes. (Must)** A file warns over 400 lines and fails over 800. A function is at most 50
lines, a component 150, nesting 4 and complexity 10. Held by: `eslint.config.js`.

**13.5 A guard cannot be switched off inside a file. (Must)** Owed: the lint setting that refuses
inline disabling. The template has no inline disable today, so it costs nothing to turn on.

**13.6 Storage. (Must)** What the phone keeps goes in the encrypted store, and secrets in the
keychain through the one registry. A reinstall starts clean. Template: `src/storage/`,
`src/session/InstallGate.tsx`. Held by: `src/release/__tests__/secure-store-audit.test.ts` and
`user-data.test.ts`.

**13.7 Logs. (Must)** Only the logger writes to the console, and it never writes a person's
content. Template: `src/lib/logger.ts`.

**13.8 No web view. (Must)** Not as a dependency and not through another package. Held by: lint
and `src/release/__tests__/dependency-audit.test.ts`.

**13.9 Crash reports. (Shaped)** By how sensitive the data is. Where what a person says or their
health data could reach a report, the app has no crash reporter at all. Where it has one, the
options are the template's fixed ones and the person has a switch. Template:
`src/observability/options.ts`.

## 14. Release

**14.1 CI is the gate. (Must)** Typecheck, lint, tests, an iOS bundle check and Expo's doctor, on
every pull request, from a lockfile install with scripts off. Template:
`.github/workflows/ci.yml`.

**14.2 The release audits travel with the copy and stay. (Must)** An audit changes only because
the product changed, and says why in its own comment. Template: `src/release/__tests__/`,
`src/config/__tests__/`. Owed: one small settings file per app (its package name, its product
folders, its palettes, its allowed lists) that the audits read, in place of constants edited by
hand in each copy.

**14.3 Updates over the air go only to the build they were made for. (Must)** The runtime version
is the fingerprint, so an update never reaches a binary with different native code. An app may
ship with no updates over the air at all. Template: `app.json`, `.eas/workflows/`,
[release.md](release.md).

**14.4 The release runs with the project's own credentials. (Must)** No token for the build
service is held as a secret in the code host.

**14.5 The store record lives with the code. (Must)** What the app collects, asks for and says is
written under `docs/release/`, and a change that alters it updates the record in the same pull
request.

## 15. Android

**15.1 iOS first, Android kept compiling. (Shaped)** What differs by platform is a `*.android.ts`
twin beside its file, and CI bundles both. An app with no Android release yet says so in its
record. Template: `npm run check:bundle:android`.

## 16. The design handoff

Designs are made outside the code. So that what is built is what was drawn:

**16.1 What a handoff holds. (Must)** A token file. A component sheet that shows every component
once, in every palette. Every state of each screen as its own frame: loading, empty, failed, out
of date, and the screen with something in it.

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

| Rule | What this app does | Why | Stays, or closes by |
|---|---|---|---|
| 5.4 | ... | ... | Stays |
| 14.3 | ... | ... | Closes by <date> |
```

A difference that will close carries a date. A rule the app has no use for is a row too ("9.4:
does not apply, the app has no voice"). The file lives in the app's own repository: this
repository's record names no product. Owed: a test, travelling with the audits, that the file
exists, names a commit and cites only rules that exist.

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

## Related

- [product-apps.md](product-apps.md): the server side, and starting an app from this template.
- [app-standard-record.md](app-standard-record.md): the meeting record, where each app stands and
  what the template owes.
- [architecture.md](architecture.md): how the template is put together.
- [styles-and-themes.md](styles-and-themes.md): the template's own styles.
- [release.md](release.md) and [release/README.md](release/README.md): how a merge ships, and the
  store requirements.
