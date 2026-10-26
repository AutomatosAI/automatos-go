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
- It installs nothing: `actions/checkout@v4` (without stored git credentials) and
  `actions/setup-node@v4`, then `node` runs the repository's own script. No npm package runs, and
  the token is set on that one step only.
- `permissions: contents: read`; five minutes at most.
- Every push to `main` runs `scripts/release/check-push-security.mjs` with the token, so a change
  to that script or this workflow should be reviewed before it merges (required review on `main`
  is a repository setting, Gerard's).

**Accepted risk: tag pins.** The two actions are pinned by tag, `@v4`, as ci.yml pins them (the
kit asks this job to mirror ci.yml, as the foundation's TestFlight job did when it held an Expo
token). They run before the token step, so a re-pointed `v4` tag could tamper with the runner.
Pinning both to commit SHAs (`actions/checkout@<sha> # v4.x.y`) closes that; it is Gerard's call,
and ci.yml and this file should then change together.

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
