# Expo enhanced push security stays off (OT-R10)

A self-hosted Automatos server sends push notifications through Expo's push service without an
Expo access token (`EXPO_PUSH_ACCESS_TOKEN` is empty by default, [../push.md](../push.md)). If
Expo's "enhanced push security" is switched on, Expo refuses those sends and push stops on every
self-hosted install. It stays off: a standing decision of Gerard's [D21], and PRD-001 §4.10 asks
for a CI check that fails when it is switched on. Requirement R19 and owner step OT-R10 in
[README.md](README.md).

## What the check reads

[scripts/release/check-push-security.mjs](../../scripts/release/check-push-security.mjs) reads the
EAS project id from `app.json` (`expo.extra.eas.projectId`) and POSTs one GraphQL query to
`https://api.expo.dev/graphql` with `Authorization: Bearer $EXPO_TOKEN`:

```graphql
query AutomatosGoPushSecurity($appId: String!) {
  app {
    byId(appId: $appId) {
      fullName
      pushSecurityEnabled
      ownerAccount {
        name
        pushSecurityEnabled
      }
    }
  }
}
```

The fields come from Expo's published schema, `packages/eas-cli/graphql.schema.json` in
expo/eas-cli (main, read 26 Oct 2026), not from a guess:

| Field | Type | Expo's description |
|---|---|---|
| `RootQuery.app` → `AppQuery.byId(appId: String!)` | `App!` | Look up app by app id |
| `App.pushSecurityEnabled` | `Boolean!` | none; its mutation, `AppMutation.setPushSecurityEnabled`, says "Require api token to send push notifs for experience" |
| `App.ownerAccount` → `Account.pushSecurityEnabled` | `Boolean!` | none; its mutation, `AccountMutation.setPushSecurityEnabled`, says "Require authorization to send push notifications for experiences owned by this account" |

The schema has the setting twice: on the project and on the account that owns it. Either one
switched on blocks unauthenticated sends for the project, so the check fails when either is on.

**OWNER note (the gap).** Which of the two the expo.dev dashboard's toggle sets could not be
checked from the build machine: Expo's push documentation names the toggle "Enhanced Security for
Push Notifications". On the first green run (step 4 below), look at the toggle and confirm it
agrees with both lines the run prints.

| Exit | When | Printed |
|---|---|---|
| 0 | both settings off | `Project …: enhanced push security off`, `Account …: … off`, `PASS: …` |
| 0 | `app.json` has no EAS project id | `skipped: no EAS project yet` |
| 1 | either setting on | `Expo enhanced push security is ON — self-hosted push breaks (D21). Turn it off in the EAS dashboard.` |
| 1 | no `EXPO_TOKEN` (unset or blank) | `EXPO_TOKEN is not set. …` with where to add it |
| 1 | an HTTP error, a GraphQL error, an answer that is not JSON or lacks a field, no answer in 30 s | `FAIL: AutomatosGoPushSecurity …` with Expo's status or error text |

The token goes only in the Authorization header, to the fixed Expo address (never one from the
environment); a redirect is an error and is never followed; anything printed has the token
replaced by `[EXPO_TOKEN]`. The script is Node 22 with no dependency (node:https).
[scripts/\_\_tests\_\_/release-push-security.test.ts](../../scripts/__tests__/release-push-security.test.ts)
proves each exit with a fake transport, that the token never reaches stdout or stderr, the
workflow's shape below, and that this page names the fields.

## The workflow

[.github/workflows/push-security.yml](../../.github/workflows/push-security.yml), "Expo push
security", runs the script on every push to `main`, once a day (06:17 UTC) and by hand
(workflow_dispatch). It is its own workflow and not a required check (KR13): a red run never
blocks a merge, CI or the TestFlight delivery on EAS Workflows.

### Trust boundary

- `EXPO_TOKEN` is a secret of the GitHub environment `testflight`, and that environment must be
  restricted to `main` before the token goes in (D50; step 1 below). **The branch rule is the
  control.** GitHub reads a workflow file from the branch that runs it, so anyone who can push a
  branch could write a workflow without this one's `if`; only the environment's rule keeps the
  secret from that run.
- The job's `if: github.ref == 'refs/heads/main'` keeps this file's own runs on `main`: never a
  pull request, so a fork never triggers it.
- It installs nothing: `actions/checkout` (without stored git credentials) and
  `actions/setup-node`, each at a commit, then `node` runs the repository's own script. No npm
  package runs, and the token is set on that one step only.
- `permissions: contents: read`; five minutes at most.
- Every push to `main` runs `scripts/release/check-push-security.mjs` with the token, so a change
  to that script or this workflow should be reviewed before it merges (required review on `main`
  is a repository setting, Gerard's).

**Pinned by commit, not by tag.** The two actions run before the token step, so a re-pointed tag
could tamper with the runner. Both are pinned to the commit their `v4` tag named on 16 Nov 2026,
the same commits ci.yml names, with the release beside each: `actions/checkout@11d5960a… # v4.4.0`
and `actions/setup-node@49933ea5… # v4.4.0`. An update moves both files together, to the full
sha of a release (`gh api repos/actions/checkout/commits/<tag> -q .sha`).
`src/config/__tests__/workflow-pins.test.ts` refuses a `uses:` in either file that is not a
40-character sha with its release beside it, and `scripts/__tests__/release-push-security.test.ts`
holds this job to ci.yml's commits.

**The schedule can stop.** GitHub turns off scheduled workflows in a public repository after 60
days without activity in it. A push to `main` still runs the check; after a quiet spell, look
for the yellow "This scheduled workflow is disabled" banner under Actions and re-enable it.

## Where things stand (26 Oct 2026)

- The `testflight` environment exists on AutomatosAI/automatos-go with **no secrets and no
  deployment branch rule** (any branch may use it), read with `gh api` on 26 Oct. D50 wants it
  restricted to `main`.
- Since 24 Oct, TestFlight delivery runs on EAS Workflows with no `EXPO_TOKEN` in GitHub
  (foundation OT-5: "no EXPO_TOKEN will exist in GitHub (EAS Workflows), so that check needs
  another home; still open"). Until a token is added, **every run of this workflow is red** with
  `EXPO_TOKEN is not set`, on each push to `main` and once a day. That is the check saying it
  cannot see the setting, not that the setting is on.
- Gerard's call: add a token (below), or give the check another home. The script runs anywhere
  that has Node 22, this repository and `EXPO_TOKEN` (an EAS Workflows custom job, for example,
  is outside this wave's files); if it moves, delete this workflow in the same pull request.

## Adding the token (OT-R10)

1. **Restrict the environment first.** GitHub → AutomatosAI/automatos-go → Settings →
   Environments → `testflight` → Deployment branches and tags → Selected branches and tags → add
   `main`. Nothing else may deploy to it. Check it before going on; both must hold:

   ```sh
   gh api repos/AutomatosAI/automatos-go/environments/testflight --jq .deployment_branch_policy
   # {"custom_branch_policies":true,"protected_branches":false}
   gh api repos/AutomatosAI/automatos-go/environments/testflight/deployment-branch-policies \
     --jq '[.branch_policies[].name]'
   # ["main"]
   ```

   `null` from the first command means any branch may use the environment: do not add the token.
2. **Make the token.** On expo.dev, account `gerard161` (the project's owner in `app.json`), make
   a token that can only read: a dedicated robot user's token with a read-only role, never a
   personal token (it acts as you, with every right you have) and never one that can publish
   updates, build or submit (an update ships to every TestFlight install). Give it an expiry and
   note the date to rotate it. If a read-only token cannot read the two fields (a permission
   error naming one), do not raise its role: give the check another home instead (above). These
   expo.dev names were not checked from the build machine.
3. **Store it.** In the same `testflight` environment → Environment secrets → add `EXPO_TOKEN`.
   An environment secret, not a repository secret: a repository secret reaches every branch's
   workflows. If the token ever shows up anywhere else, revoke it on expo.dev first, then make a
   new one.
4. **Run it once.** Actions → Expo push security → Run workflow → branch `main`. Green: the two
   `off` lines and `PASS`. Compare them with the dashboard toggle (the OWNER note above).

## A red run

| The run says | What it means | What to do |
|---|---|---|
| `Expo enhanced push security is ON …` | Someone switched it on, for the project or the account (the line above it says which). Self-hosted push is failing now. | Turn it off on expo.dev, then re-run the workflow by hand. |
| `EXPO_TOKEN is not set` | The environment has no token. | "Adding the token" above, or Gerard's call on another home. |
| `Expo answered HTTP 401` or `403`, or a GraphQL error about authorisation | The token was revoked or expired, or its role cannot read the project or the account. | Make a new token (step 2), replace the secret (step 3), re-run. |
| `the answer lacks app.byId.pushSecurityEnabled …` | Expo changed or removed the field. | Read Expo's current schema (the address above), update the query in the script and its test, and this page's table. Never guess a field. |
| `no answer from Expo`, `ENOTFOUND`, HTTP 5xx | Expo or the network was down. | Re-run later; the daily run tries again tomorrow. |

To run the check from a laptop (a person with a token, never the build loop):

```sh
EXPO_TOKEN=<the token> node scripts/release/check-push-security.mjs
```

## What the phone does about a push (rule 14.5)

The rest of this page is the phone's own side: what it registers, what it keeps when the person
changes their mind, and what a push that verifies does and does not prove. The full path of a push
is [../push.md](../push.md).

### The person's last choice wins

The session's one registrar
([src/push/registration/registrar.ts](../../src/push/registration/registrar.ts)) runs one
registration at a time. A choice the person makes while a call is out is read by the run after
it; nothing a run read at its start is written back over it:

- **Notifications off in the phone's Settings during a registration.** The registration's record
  is kept, then the next run sends `PATCH …/devices/{id} {push_enabled: false}`. On again during
  that PATCH: the next run registers again.
- **Remove this phone.** The hold is set first. The row is then read, DELETEd and the phone cleared
  as one task in the registrar's queue, after the run under way. A **Turn on** tapped before the
  removal, still waiting behind a run, reads the removal's hold when its turn comes and sends
  nothing. One tapped during the removal registers after it, from a cleared phone.
- **Sign out, Forget this server or a new pairing during a registration.** The registrar closes,
  the late answer's key is not kept, and with no push record the leave DELETEs the row that answer
  named.

Each case holds the call open, changes the choice and releases it:
[src/push/\_\_tests\_\_/registration-races.test.ts](../../src/push/__tests__/registration-races.test.ts).

### A registration whose answer was lost

A registration can reach the server while its answer never reaches the phone: a timeout after the
request left, a network that dropped, the app killed while the request was out. The server then
holds an active row that sends to this phone, and the phone holds no record of it, so no id and no
key. What the phone does
([src/push/registration/attempts.ts](../../src/push/registration/attempts.ts)):

- **Before each registration goes,** it notes that one is out for this server and workspace, in
  the encrypted store (scopes only). The note is cleared only when that is settled: a push record
  kept, a DELETE the server confirmed (or answered "already gone") in that scope, by Sign out or by
  Remove this phone, or a learning registration the server refused with a 409. The encrypted store
  is the signed-in session's: every way of leaving empties it, or makes it unreadable, once the
  provider has signed out, so a note is only ever read in the session that wrote it.
- **The next registration repairs it.** With no record, the next launch or resume registers again.
  The server answers the same row (one per install, person and workspace) with no key, because it
  hands out a key once. A hosted phone then revokes that row and registers once more for a new key
  (at most once a day). An own server cannot do that without ending the pairing, so the phone says
  "This phone can't check its notifications. Pair it again to turn them on."
- **Sign out (hosted)** DELETEs the record's row. With no record it DELETEs the row the server last
  answered, and with neither, where a registration is noted, it learns the row by registering
  again without the push token (the server answers the caller's own row for this install, and a
  registration with no token leaves the row's push as it was), then DELETEs it. Learning and the
  DELETE share the 4 s. Nothing is learned where nothing was sent, or where the person removed this
  phone. If the original registration never arrived, this registers a row only to revoke it, and
  Studio then lists one removed phone.
- **When the DELETE does not go through** (no network, a refusal, the 4 s over, a learning
  registration still out when they end), the note stays and the next chance finishes the job: a
  second Sign out in this launch (Clerk refuses a sign-out offline) revokes the row it learned; after
  a relaunch, still signed in, the next registration keeps a record (the row is the person's own
  again) or the next Sign out learns the row again and revokes it. A learning registration that
  reaches the server after the 4 s changes nothing on a row that already exists; where none did, it
  makes one with no push token, so nothing can be sent to it, and the next Sign out removes it. Once
  the sign-out completes, the note goes with the session's store: from then on the next
  registration on this phone, by anyone, moves the push token off that row.
- **Notifications off in the phone's Settings** has no row id to tell the server. The phone's own
  setting stops every notification from showing, the screen says the setting is off, and turning it
  on again registers.
- **Remove this phone** is offered only with a push record, which names the one row the server keeps
  for this install. "Removed" is shown only when the server answered the DELETE (or said the row was
  already gone).

[src/push/\_\_tests\_\_/lost-registration.test.ts](../../src/push/__tests__/lost-registration.test.ts)
proves each of these.

### What a verified push proves

**What is signed.** `sig` is HMAC-SHA256, keyed with this phone's own push key, over
`["v2", type, workspace_id, notification_id, grant_id, link_type, link_id, ticket_number, question, options, iat]`
([src/push/signature/canonical.ts](../../src/push/signature/canonical.ts)). Nothing else in a push
is signed: not the title, the body, the sound, the priority, the category (which chooses the
buttons), the Android channel, or the unsigned `message_id` a brief's push carries.

**What the server sends a person to read.** Each push it sends a phone is `to`, `title`, `body`,
`data` (the signed payload), `priority`, `categoryId`, `channelId` and `sound`: no subtitle, no
picture, no badge count, nothing else a person reads.

| Field | What the server puts there | Can the phone check it? |
|---|---|---|
| `title` | "{sender} · {badge}": the sender is the agent that asked, or "Auto" when no agent is named; the badge is the fixed AI term of the language the phone registered: AI, IA (Portuguese, Spanish, French, Italian) or KI (German) | "Auto · AI", "Auto · IA" and "Auto · KI" by itself. An agent's name is not in the signed payload, so any other title only once the server says that agent asked (below). |
| `body` | A question's own `question`, exactly as signed. A push with no `question` (any other event, or a question hidden by the workspace's "Hide question text in notifications") shows a fixed line, such as "A question needs your answer", that no signed field names | Yes, for a question: it must be the signed `question`. |
| subtitle, pictures | Never sent | They must be absent. |

A question asked by a named agent, the usual case, arrives under a title the phone cannot check by
itself.

**What each action trusts.**

| Action | What it acts on |
|---|---|
| A tap, or **Open** | The signed payload only. The screen is the signed link's, read again from the server with the person's own sign-in before it opens, so the real question is what the app shows. The bell row marked read is the signed `notification_id`. An approval's sheet is the signed `grant_id`'s and shows the server's own record; with "Face ID before approve or answer" on (the default) it asks for Face ID before Approve. The title, body and subtitle change nothing, so a tap stays as it was. |
| **Reply**, with typed words | Where the answer goes: the signed `grant_id` of a signed `link_type` `question`. What the answer says: what the person typed, in answer to everything the notification showed. |
| A push while the app is open | Shown only when it verifies within 2 s, with its own title and body. |

**The worst case, before this change.** Anyone who holds this phone's Expo push token and one
signed question payload less than 7 days old, for a question still open in the workspace the app
is in, could send it again with words of their own (in its body, its title or a subtitle) and a
Reply button. What the person typed in answer to those words was then posted as their answer to
the real question, once.

**What already bounds it.** The age limit (7 days old, 5 minutes ahead); the workspace check (a push
of another workspace acts on nothing); the role check (a viewer cannot answer); the server takes one
answer per question (a second gets "That question was already answered."); iOS asks for an unlocked
phone before the reply field opens. Not a bound: the record of responses handled
(`identifier:action`), because a push sent again arrives under a new identifier; and Face ID is not
asked for a notification Reply.

**What the phone does now**
([src/push/inbound/shown.ts](../../src/push/inbound/shown.ts),
[confirm-sender.ts](../../src/push/inbound/confirm-sender.ts),
[intent.ts](../../src/push/inbound/intent.ts), [handler.ts](../../src/push/inbound/handler.ts),
[dedupe.ts](../../src/push/inbound/dedupe.ts)). A Reply is posted only when everything the
notification showed is the signed question or confirmed by the server; otherwise nothing is sent
and the question opens in the app, where the server's own text is shown:

- The body must be the signed `question`, word for word (spaces at either end aside), and there
  must be no subtitle and no picture. Otherwise: "This notification's words couldn't be matched to
  the question, so nothing was sent. Answer it here."
- A title that is absent or one of Auto's three posts at once.
- Any other title (an agent's name) is confirmed first. The phone reads the open questions the
  Questions screen lists (`GET /api/v1/approval-grants?status=pending&kind=question`, the
  person's own sign-in) and takes the one whose id is the signed `grant_id`, compared as text (a
  signed id over 15 digits is not read); nothing the notification shows chooses it. For one question the route returns its `id`, `status`,
  `question_md` (its words, as markdown), `options` and `owner.agent.name` (the agent that asked).
  The Reply posts only if that question is still open, its words are the signed `question`, as
  written or as the server makes a push's words from a question's markdown (the same rules,
  mirrored on the phone in `src/push/inbound/question-text.ts`, and never looser: a character
  inside a word or a mark the rendering keeps is never dropped), and the title is exactly "{that
  agent's name} · AI", "· IA" or "· KI".
  Then the sender shown is the one the server names. Otherwise:

  | The server says | The line |
  |---|---|
  | The question is not open (answered, closed, or not listed) | "That question was already answered or closed." |
  | Other words | "This notification's words couldn't be matched to the question, so nothing was sent. Answer it here." |
  | Another agent asked, or it names no agent | "The sender on this notification couldn't be matched to who asked, so nothing was sent. Answer it here." |
  | Nothing: no network, a refusal (a 403 for a person who may not list questions, a 404), an answer that is not the list, or no answer in 4 s | "Not sent. Open the question to answer it." |

- **The time it has.** Reply opens the app to the foreground (and iOS asks for an unlocked phone
  first), so it does not run in the time iOS gives a background notification action. The read
  waits at most 4 s (`STALE_CHECK_TIMEOUT_MS`, the same as Open's check); the answer's POST keeps
  the client's own 30 s limit.
- A signed payload is replied to once. After every check has passed, in the same step as the
  send, its workspace, grant and notification ids and its `iat` are claimed in the store of
  responses handled (ids only, never words; the last 50 keys; kept across launches; cleared by
  sign-out). A Reply that is not posted (a read that failed, a copy under a wrong title) never uses
  it up. The same payload sent again after a Reply was posted opens the question with "You already
  replied to this notification, so nothing was sent again."

What a person sees: a Reply to a question Auto asked, or one a named agent asked whose name the
server confirms, posts and says "Answered". An agent renamed between asking and the Reply is not
the name on the notification any more, so that Reply opens the question in the app: the title's
name and `owner.agent.name` are the same field (the agent's name), read when it asked and when
the list is read.

[src/push/\_\_tests\_\_/reply-binding.test.ts](../../src/push/__tests__/reply-binding.test.ts),
[confirm-sender.test.ts](../../src/push/__tests__/confirm-sender.test.ts) and
[inbound.test.ts](../../src/push/__tests__/inbound.test.ts) prove each branch, for a Reply and for a
plain tap.

**What the server could sign instead.** With the sender's name as a signed field (the phone then
rebuilds "{sender} · {badge}"), or the title itself (or its SHA-256), under a new payload version,
the phone would need no read before an agent's Reply, and would post one offline. To check a push
that is not a question, the body's fixed line too.

**What a verified push still does not prove.** The words on the lock screen. A notification that
arrives while the app is closed is drawn by iOS or Android without any of the app's code, so a push
with genuine signed data and words of its own is shown as it was sent. Checking it before it is
shown needs a notification service extension, which is native code this app does not have. Android
also draws a large picture from an image link without telling the app; the server never sends one.
