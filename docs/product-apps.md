# Building a product app from this template

Automatos Go is also the starting point for product apps: an app a product ships to its own
customers, with Automatos behind it. This page is the pattern such an app and its server follow,
so that the second product costs less than the first and they all behave the same way.

**Status, 15 Nov 2026: proposed.** No product is built on it yet, and the shared server library
it names does not exist. What Automatos provides was read from automatos-ai `main` at `46c1e2f`
and is marked **verified** below. Everything else is the design to build to.

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

A product may combine them. The rest of this page is written for **People**, the shape a phone
app for consumers nearly always has.

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

The reply comes back as a stream and the server passes it through. Three things to know
(verified):

- The stream is the AI SDK data stream, sent as `text/plain`. This repo's parser in `src/core/`
  already reads it.
- A turn through a server key cannot ask for spoken mode. A reply that will be read aloud arrives
  as ordinary text with formatting, and the app takes the formatting out itself, as
  `src/voice/quick-ask/` does when a server does not offer spoken mode.
- The server voice is not reachable with a server key yet. A product app uses the phone's own
  voice until it is.

## Memory

What Automatos remembers about a person is theirs alone: a turn reads that person's facts and the
workspace's, never another person's (verified). The agent's memory profile decides what is worth
keeping, and a product whose subject is sensitive writes its own profile.

The app shows the person what is remembered, lets them forget one thing, and lets them erase
everything.

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
| Forget one | The memory's id | Deletes it | Done |
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
`@automatos/server`. It is not built. What it must do:

- work from plain JavaScript as well as TypeScript, with no web framework tied in;
- send a turn and hand back the raw stream, with a helper that re-emits it as the chat widget's
  events for servers whose clients read those;
- record consent, always with the retention;
- list and forget memories, and erase a person;
- take its key as an argument, so one server can hold more than one;
- hold no sign-in or session code.

## Starting the app from this template

Copy the repository at a commit and record that commit. Then:

| Keep | Remove | Change |
|---|---|---|
| The API client's shape and error kinds (`src/api/`) | The workspace header, discovery and the workspace bootstrap | The client points at the product's server: one public value, its address |
| The stream parser and turn reducer (`src/core/`, vendored: never edited by hand) | Pairing with an own server (`src/connect/`) | The app's name, bundle ids and EAS project |
| The chat plumbing (`src/chat/`) | Push registration (`src/push/`) unless the product sends its own | Sign-in: the product's own |
| Quick-ask on the phone: recognition and the phone's voice (`src/voice/`) | The Command Centre, approvals, the brief, suggestions, step-up (`src/cc/`, `src/approvals/`, `src/brief/`, `src/suggestions/`, `src/step-up/`) | The privacy manifest and the store answers, to what the product really collects |
| Encrypted storage and the keychain registry (`src/storage/`) | Crash reporting (`src/observability/`) where the product's data is sensitive | The look (below) |
| The primitives and tokens (`src/ui/`, `src/styles/`) | The styles other than the one the product uses | |
| The release audits (`src/release/__tests__/`, `src/config/__tests__/`) | | |

The release audits come with the copy and stay. An audit changes only because the product
changed, and says why in its own comment.

## The look

A product app has one look of its own.

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
- The shared library and a server starter.

## Before a product is switched on

- [ ] Product record and owner workspace set
- [ ] No key in the app, a build setting, a browser or git history
- [ ] Lean agent with its tools and model list
- [ ] Memory profile chosen
- [ ] Retention set and consent wording reviewed
- [ ] Erase tested end to end
- [ ] Limits set on every key
- [ ] "Powered by Automatos AI" and the AI notice shown
- [ ] A data protection review, where the product handles health, children or money
