# Automatos Go technical docs

For engineers working on the app, and for operators who run their own Automatos server and want to
connect phones to it. Help for people who use the app is in the Automatos GitBook
(`automatos-gitbook` repo), not here.

State on 24 Oct 2026. `main` is at `f432b3f`. Each page says what is on `main` and what is still on a
branch, using these labels:

| Label | Meaning |
|---|---|
| **On `main`** | Merged, in the build or the next over-the-air update |
| **On branch** | Built on a feature branch, not merged |
| **Kit only** | No code yet; the wave's kit JSON is the contract |
| **Gated** | On `main`, but shown only when the server lists a capability |

## Pages

**[architecture.md](architecture.md).** How the app is put together. The layers: `app/` screens,
the gate in `src/app-state/`, the sign-in providers in `src/auth/` (Clerk for hosted, a device token
for an own server), the one API client in `src/api/` with its error kinds, the code vendored from
automatos-ai into `src/core/`, the feature modules, navigation, storage and the keychain. Also how
the app talks to automatos-ai: discovery, capabilities, the workspace bootstrap and the live event
stream.

**[connecting.md](connecting.md).** Hosted sign-in, and pairing a phone with a server you run.
Discovery, the pairing flow step by step with its routes, the address rules (https, home-network
http, Tailscale), and the security model: the one-time 10-minute code, the per-IP rate limit, the
device token in the keychain, rotation, revoke and the reinstall wipe. Lists what the operator sets
on the server.

**[styles-and-themes.md](styles-and-themes.md).** The phone's side of styles and themes: Studio,
Play and HUD, "Same as Studio", how an active Studio theme maps to a phone style, installed themes
painting the Studio layout, looks kept in step with the web, which theme files the phone downloads,
and the routes. Mostly on branch (A5). The theme contract itself is in automatos-ai's Themes docs.

**[push.md](push.md).** Notifications: what triggers a push on the server, how the phone registers
and checks each push's signature, the notification buttons, Face ID before approving, the
notification settings, links into the app, and what the operator sets. On branch (A4 in this repo);
the server side, W2, merged into automatos-ai `main` on 24 Oct (#1300).

**[voice.md](voice.md).** Talking to Auto: quick-ask (hold to talk, recognition on the phone, the
reply spoken by the phone, the AI notice once per voice session) and, later, Auto Live through
Retell. Kit only: this page is written from the A6 kit contract.

**[release.md](release.md).** How a merge reaches phones. GitHub CI checks; EAS Workflows ship.
`testflight.yml` takes the fingerprint and either publishes an over-the-air update or builds iOS and
sends it to TestFlight; `pr-check.yml` says on each PR which it will be. Also the manual run while
the repository is not linked on expo.dev, the traps and the plan limits.

**[native-modules.md](native-modules.md).** Every native module in the build, why it is there, its
config plugin, the usage strings Apple requires, the privacy manifest, App Transport Security,
Android permissions, associated domains and background modes. Read it before adding a native
dependency: a native change costs a build.

**[prd/PRD-001-AUTOMATOS-GO-V1.md](prd/PRD-001-AUTOMATOS-GO-V1.md).** The plan for v1: scope,
decisions, waves and stories. Where it and the code differ, the code is right. Known differences:

- §4.5: a QR scanned with the iPhone Camera app opens the server's web page, not the app. Scan from
  inside Automatos Go.
- §4.6: HUD looks are kept in step with the web, not only on the phone, and the default is "Same as
  Studio", not Studio.
- §4.8: notification categories are `automatos.question.0`–`3` with Reply… and Open only.
- §4.9: the AI notice in voice is given once per voice session, not every ten minutes.

## Server side (automatos-ai)

- `docs/PRDS/PRD-266-AUTOMATOS-GO-BACKEND.md`: the server plan for discovery, pairing, push and the
  phone's routes.
- [docs/getting-started/self-hosting.md, "Connect a phone (Automatos Go)"](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/getting-started/self-hosting.md#connect-a-phone-automatos-go):
  the settings reference for phones: modes, addresses, the recommended setups, checks and removal
  (added by the automatos-ai `docs/self-hosting-phone` change).
- [QUICKSTART.md, "Reach your install from your phone"](https://github.com/AutomatosAI/automatos-ai/blob/main/QUICKSTART.md#reach-your-install-from-your-phone-optional):
  the operator's steps for phones.
- [docs/theme-host/mobile.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/mobile.md):
  the theme contract for phones. The rest of the theme docs: [docs/theme-host/](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/_index.md)
  for engineers, [docs/themes/](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/_index.md) for people who install themes.

## In this repository

- [README.md](../README.md): stack, commands, environment, CI and release, human steps.
- [CLAUDE.md](../CLAUDE.md): the working rules, layout, traps and terms.
