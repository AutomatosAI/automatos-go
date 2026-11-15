# Building a product app from this template

Automatos Go is also the starting point for product apps: an app a product ships to its own
customers, with Automatos behind it. This page is the pattern such an app and its server follow,
so that the second product costs less than the first and they all behave the same way.

**Status, 15 Nov 2026: proposed.** No product is built on it yet, and the shared server library
it names is being built and is not published. What Automatos provides was read from automatos-ai
`main` at `46c1e2f` and is marked **verified** below. Everything else is the design to build to.

## How a product app differs from Automatos Go

| | Automatos Go | A product app |
|---|---|---|
| Who uses it | A member of an Automatos workspace | The product's own customers, who have no Automatos account |
| Who it talks to | automatos-ai, directly | The product's own server, and nothing else |
| What it holds | The person's own sign-in token | A session token for the product's server. No Automatos key, token, workspace id or address |
| Who pays | The person's workspace | The product's owner workspace |
| What the AI is | Auto, with the workspace's tools | One lean agent with only the tools it was granted |

Automatos Go itself does not change. It stays the app for people who work in Automatos.

## Pick a shape first

| Shape | What it means | What it needs |
|---|---|---|
| **One space** | The product works in one workspace and remembers nobody | A server key and a lean agent |
| **People** | One workspace, with a memory for each person | The above, plus consent, a retention period and erase for each person |
| **A space per business** | Each customer business gets a sealed workspace of its own | A product key that creates and closes workspaces, paid for by the owner workspace |

A product may combine them. Most of this page is written for **People**, the shape a phone
app for consumers nearly always has. An app that knows nobody has its own section below.

## The rules

1. **A product record.** Automatos holds one record per product: its owner workspace, its agents,
   its key's permissions and its retention.
2. **Keys live on the server.** Never in a phone app, a build setting, a browser or git.
3. **The product has its own server.** It signs people in and is the only thing that calls
   Automatos.
4. **People are end users.** Consent is recorded before the first memory, a retention period
   applies, and erase is there when asked. Deleting in the product deletes in Automatos.
5. **Businesses get workspaces** (the third shape only).
6. **Agents are lean.** Only the tools granted, a model from an approved list, a memory profile
   that fits the product.
7. **Live data is context.** What the app can see right now goes in for one reply. It is never
   stored and never pasted into the message.
8. **Background work** starts with an idempotency key, and results come back as signed callbacks
   the receiver checks.
9. **Limits per key.** A quota in the app is never the only limit.
10. **The owner pays, and the AI is labelled.** "Powered by Automatos AI", and the AI notice on
    replies.

## Who talks to whom

```
phone app  ──►  product server  ──►  automatos-ai
(session token)   (server key, in      (the only place
                   server settings)     the key is used)
```

## The person

**An id the product makes.** The server gives each person an id it never reuses:
`<product>:<random id>`. It holds no name, email or device identifier. Automatos accepts letters,
digits and `. _ : @ -`, up to 128 characters (verified).

**Consent first.** Before a person's first turn:

1. The app shows the consent wording and the person agrees.
2. The server stores the wording's version and the time.
3. The server records consent in Automatos, **with the retention in days every time**. A
   product's default retention does not reach people in the owner workspace by itself.

Automatos refuses a turn for a person with no consent on record (verified: 409). After an erase
that keeps the person's account, consent is asked again before their next turn, because the erase
removes the consent record too (verified).

## A turn

The server sends:

- the agent: a lean agent of the product's workspace;
- the person's id;
- **the message: the person's own words.** Text the person saw in the box and chose to send is
  theirs. Anything added that they did not see is not, and does not go in the message;
- **app context**: what the app knows right now, as JSON or text. It goes in that turn's prompt
  only. It is not stored, not returned in history and not read by memory (verified; at most
  8,000 characters).

The reply comes back as a stream and the server passes it through. Four things to know
(verified):

- The stream is the AI SDK data stream, sent as `text/plain`. This repo's parser in `src/core/`
  already reads it.
- A turn through a server key cannot ask for spoken mode. A reply that will be read aloud arrives
  as ordinary text with formatting, and the app takes the formatting out itself, as
  `src/voice/quick-ask/` does when a server does not offer spoken mode.
- The server voice is not reachable with a server key yet. A product app uses the phone's own
  voice until it is.
- Automatos accepts a turn before the model starts, and finishes a turn it has accepted even if
  the connection drops. Closing the connection stops the reading, not the turn or its cost. A
  server that times out waiting cannot tell whether the turn was taken.

## Memory

What Automatos remembers about a person is theirs alone: a turn reads that person's facts and the
workspace's, never another person's (verified). The agent's memory profile decides what is worth
keeping, and a product whose subject is sensitive writes its own profile.

The app shows the person what is remembered, lets them forget one thing, and lets them erase
everything.

Forgetting one thing has a limit today (verified): a server key can delete only a memory it
stored itself. What Automatos kept from the person's conversations is in the list, and a key
cannot remove those one at a time; they go with a full erase. Until that changes, an app offers
"forget" only on what the product stored, and tells the person that the rest goes with erase.

## Erase

One action in the app, in this order:

1. The server asks Automatos to erase the person: their memories, conversations and sessions.
2. The server deletes its own record of the person.
3. The app wipes the phone.

Erase is safe to repeat. If a step fails, the same call again finishes it. It is tested end to
end before launch: afterwards Automatos returns nothing for that person.

## Limits

The key carries its own requests and tokens a minute, set when it is minted (verified: there is
no route to change them afterwards). The server keeps a second limit per person and answers a
person who is over it with a plain message the app can show.

## What every product shares, and what each decides

Shared: the actions and what they carry.

| Action | The app sends | The server does | The app gets |
|---|---|---|---|
| Agree | The consent wording's version | Stores it, then records consent in Automatos with the retention | Done |
| Send a turn | The person's words, and what the app knows right now | Checks the session and the person's limit, calls Automatos with the person's id and the app context, passes the stream through | The reply stream |
| What is remembered | Nothing | Reads the person's memories | A list: id, text, when |
| Forget one | The memory's id | Deletes it, where the product stored it (see Memory) | Done |
| Erase | Nothing | The three steps above | Done |

Each product decides: its route prefix, and how its people sign in. A product whose server is
already live keeps its routes.

**Server settings**, named the same everywhere:

| Setting | Holds |
|---|---|
| `AUTOMATOS_API_URL` | The Automatos API's address |
| `AUTOMATOS_SERVER_KEY` | The server key. In no file, build setting or log |
| `AUTOMATOS_AGENT_ID` | The lean agent |

**Logs** hold ids, counts, status codes and timings. Never a message, a reply, a memory or app
context.

**The shared library.** The calls to Automatos belong in one library every product server uses,
`@automatos/server`, in the widget SDK repository under `packages/server`. It is being built and
is not published. What it must do:

- work from plain JavaScript as well as TypeScript, with no web framework tied in;
- send a turn and hand back the raw stream, with a helper that re-emits it as the chat widget's
  events for servers whose clients read those;
- record consent, always with the retention;
- list and forget memories, and erase a person;
- take its key as an argument, so one server can hold more than one;
- hold no sign-in or session code.

## An app with no sign-in and no people

Some product apps know nobody: the **One space** shape on a phone. The app reads what the product
publishes for everyone and does its work on the phone. For such an app:

- **The app still talks only to the product's server**, with no session. Every request is one any
  phone could make. None carries anything that says who is asking or what they keep on the phone.
- **There is no consent, no retention and nothing to erase in Automatos**, because no person is
  ever sent there. On the launch checklist those lines are answered in writing ("does not apply:
  no person is known"), never skipped.
- **What the person keeps lives only on the phone**: their own lists and settings, in the
  template's encrypted storage (`src/storage/`). The app says that the phone holds the only copy
  and that removing the app removes it.
- **If the product's server uses Automatos at all**, it does so by itself, as a lean agent with no
  end user. The app never knows.
- **Any record the server holds because of the phone** (a push registration, below) is named in
  the app in one plain sentence, with the one action that removes it.

From the template: remove sign-in and everything behind it. Keep the API client's shape and error
kinds, pointed at the product's server through one public address. The audit of the sign-in
SDK's telemetry (`src/release/__tests__/sdk-telemetry.test.ts`) goes with the SDK, and the
user-data audit (`user-data.test.ts`) becomes "a reinstall starts clean".

## Push for a product app

A product that sends its own notifications keeps the template's push code (`src/push/`) and
points it at its own server. Automatos does not send a product's notifications: the product's
server does.

**What the template's app code does (verified in this repository):**

- **Registration.** The phone registers with an install id made on the phone, its platform, the
  app's version, its locale and time zone, and its Expo push token (`registration/`). One
  registrar runs at launch, on resume, after a permission change and when the system hands over
  a new token. It sends again only when something changed, or after a day.
- **The ask.** Never at launch. It is offered once something waits for the person, or from the
  second session on. "Not now" holds it back seven days, and after two declines only Settings
  offers it. The system's prompt appears only after the person says yes in the app (`prompt/`).
- **Android channels** exist before the system's prompt is shown (`platform/`).
- **The check.** Every push carries a signature. A push that does not verify shows nothing and
  does nothing: no banner, nothing opened, nothing marked read. A push more than seven days old
  is refused too (`signature/`, `inbound/`).
- **Leaving.** Turning alerts off tells the server. "Remove this phone" deletes the server's row
  and clears the phone (`bind/`).

**What changes for a product:** the route table (`routes.ts`) and the answer shapes (`schemas/`)
become the product server's. The payload and the exact message the signature covers
(`schemas/payload.ts`, `signature/canonical.ts`) become the product's own fields. What belongs to
Automatos's own records goes: the inbox, the brief on request, a reply to a question from the
notification, and the links to tasks and missions.

**What the product's server does** (the design; a product builds it):

- Offers the registration route and keeps one row per phone.
- Sends through Expo's push service. No other push vendor's SDK goes into the app.
- Signs every push. The template's way is HMAC-SHA256 with a secret made for each phone when it
  registers, kept on the phone in the keychain.
- Turns a phone off when Expo reports its token gone, and removes a row not seen for a set time.

### An app with no accounts

The server has nobody to address, so it does not try. Every registered phone gets every alert.
Each alert is one line that is true for everyone, and the phone decides what it means for its
person from what only the phone holds, then says so in its own words. The server's row is then an
install id, a platform, a version and a token: nothing about what the phone holds or follows, and
no third party learns it either.

Two costs to state plainly:

- The product does hold a list of phones that asked for alerts, and the app says so.
- On iOS, rewriting an alert on the phone needs a notification service extension, and iOS shows
  something for every alert unless Apple grants the entitlement that lets an extension drop one.
  So an alert that does not concern a phone arrives as a quiet entry that says so. The template
  has no such extension today.

The registration route is public and takes no sign-in. Limit it per address, accept only a token
of Expo's shape (`EXPO_PUSH_TOKEN_PATTERN` in `src/push/config.ts`), and answer the same whether
or not the token was known.

### A push that a leak of the product's database cannot forge

The template signs each push with a secret kept per phone, which the server stores. Anyone who
reads the server's database then holds the tokens and the secrets, and can send a push that
verifies. For most products that is an acceptable risk. Where a false alert would itself do harm,
sign with a public-key signature instead:

- The private key lives in a key service outside the hosting, and the server may only ask it to
  sign. The public key is built into the app: two of them, so one can be replaced without a gap.
- What is signed is a short statement: a fixed label for the purpose, then the payload exactly as
  sent. One label and one key per purpose, so a signature for one thing is never accepted for
  another. Some key services sign only a few kilobytes: sign the statement, never a large body.
  For a large file, sign a label and its hash.
- The server checks every signature against the built-in public key before it sends, so a wrong
  key fails loudly on the server and never reaches a phone.

It fits the template's seam: the same "verify or show nothing" rule, with the check in
`src/push/signature/` replaced by the public-key one. The template has no public-key check today,
and the library that adds one has to pass the dependency audit.

## Starting the app from this template

Copy the repository at a commit and record that commit in a file in the app. The app may be its
own repository or a folder inside the product's repository, with its own install and lockfile.
The audits find the app by the nearest `package.json` and check its name: set `PACKAGE_NAME` in
`src/release/__tests__/support/tree.ts` to the app's own, and run the audits from the app's
folder, with a real install there (the dependency and privacy audits read `node_modules`). Then:

| Keep | Remove | Change |
|---|---|---|
| The API client's shape and error kinds (`src/api/`) | The workspace header, discovery and the workspace bootstrap | The client points at the product's server: one public value, its address |
| The stream parser and turn reducer (`src/core/`, vendored: never edited by hand) | Pairing with an own server (`src/connect/`) | The app's name, bundle ids and EAS project |
| The chat plumbing (`src/chat/`) | Push (`src/push/`) unless the product sends its own notifications (see Push for a product app) | Sign-in: the product's own |
| Quick-ask on the phone: recognition and the phone's voice (`src/voice/`) | The Command Centre, approvals, the brief, suggestions, step-up (`src/cc/`, `src/approvals/`, `src/brief/`, `src/suggestions/`, `src/step-up/`) | The privacy manifest and the store answers, to what the product really collects |
| Encrypted storage and the keychain registry (`src/storage/`) | Crash reporting (`src/observability/`) where the product's data is sensitive | The look (below) |
| The primitives and tokens (`src/ui/`, `src/styles/`) | The styles other than the one the product uses | |
| The release audits (`src/release/__tests__/`, `src/config/__tests__/`) | | |

The release audits come with the copy and stay. An audit changes only because the product
changed, and says why in its own comment.

## The look

A product app has one look of its own. The full rules for how the app is designed and built, of
which these are the short form, are [the app standard](app-standard.md).

- **Tokens only.** A screen reads colours, radii, spacing and type through the tokens. No colour
  and no font size is written in a screen.
- **A palette fills the token shape** in `src/styles/tokens/types.ts`, so no screen changes when
  the palette does.
- **A type scale of its own, beside Studio's.** Studio's scale in `src/styles/type.ts` is pinned
  by tests to its handoff sizes, which are a desktop's. A phone app for consumers needs larger
  text: add a second scale with the same roles and leave Studio's alone.
- **Decoration carries no meaning.** A picture or a scene is hidden from VoiceOver and is never
  the only way something is said.
- **Contrast is tested.** Every text colour on every ground it is drawn on, in every palette,
  at WCAG AA.
- **Dynamic Type stays on, and touch targets are 44 points.**

## What Automatos provides (verified on automatos-ai `main`, 15 Nov 2026)

| Need | Route or setting |
|---|---|
| A turn with a server key | `POST /api/chat`, scope `agents:chat`, to a lean agent. Fields `agentId`, `endUserId`, `appContext`, `model` |
| Consent and retention | `PUT /api/memory/end-users/{id}` with `consent: true` and `retention_days` |
| A person's memories | `GET /api/memory/end-users/{id}/memories`, `POST …/memories`, `DELETE …/memories/{memory_id}`. Scopes `memory:read`, `memory:write` |
| Where a person left off | `GET /api/memory/end-users/{id}/resume` |
| Erase | `DELETE /api/memory/end-users/{id}` |
| Retention | A daily job removes what is older than the person's `retention_days` |
| The product record | `/api/admin/products` |
| The key | A server key (`ak_srv_`), minted in the product's workspace with its scopes, its limits and its model allow-list |
| Memory profiles | `general`, `customer`, `incident`, `case`, and a workspace's own |

Two switches are off by default: `LEAN_TURNS_ENABLED` (a key can only talk to a lean agent) and
`PRODUCTS_ENABLED` (product records).

The full design is automatos-ai's
[PRD-274, Automatos for products](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/PRDS/PRD-274-AUTOMATOS-FOR-PRODUCTS.md).

**Not there yet**

- The server voice and spoken mode for a server key.
- Usage split per person. Usage rolls up to the workspace.
- A way to change a key's limits after it is minted.
- Forgetting one memory that Automatos kept from a conversation. A server key can delete only
  what it stored itself.
- A published shared library, and a server starter.

## Before a product is switched on

- [ ] Product record and owner workspace set
- [ ] No key in the app, a build setting, a browser or git history
- [ ] Lean agent with its tools and model list
- [ ] Memory profile chosen
- [ ] Retention set and consent wording reviewed
- [ ] Erase tested end to end
- [ ] Limits set on every key
- [ ] "Powered by Automatos AI" and the AI notice shown
- [ ] If the app receives notifications: a push that does not verify shows nothing, and the app
      names the server's record of the phone and the action that removes it
- [ ] A data protection review, where the product handles health, children or money

A line that does not apply is answered in writing, with the reason. It is never skipped.
