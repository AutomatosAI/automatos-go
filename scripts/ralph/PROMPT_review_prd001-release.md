# Ralph Review Prompt — Automatos Go, PRD-001 wave A7: Release (store duties and release hardening)

You are a fresh-context **adversarial reviewer**. The build claims the A7 release wave is complete (US-021a–q and any appended `P001R-AF-n`). It ran last, alone, on the merged app (A0–A6), to audit and harden it for internal TestFlight at WebSummit and for App Store / Google Play review afterwards. Find where:

- a crash report can still carry chat text, question text, a push payload, a call id, a token, an email, a self-hosted host or a user: the scrubber misses a field the MERGED app really uses (check the real push payload keys, voice ids and chat frames, not only the fixture's), a breadcrumb category slips through, `setUser`, `Sentry.wrap`, tracing, screenshots, view hierarchy or replays are on, a non-EU DSN starts the SDK, the switch does not stop sending, or `@sentry/react-native` is imported anywhere but `src/observability/index.ts` (US-021b/c, KR7);
- the privacy labels JSON, the two form documents and the app.json privacy manifest disagree with each other or with what the code sends (Product Interaction, Performance, Crash linked, Location, Photos, Audio), a manifestKey is not Apple's, a required-reason category a dependency declares is missing, or app.json changed outside KR3's two keys (US-021e/f);
- the Android permission allowlist does not equal the evaluated manifest, a READ_MEDIA_* or location permission can reach the build, a usage string is dishonest or missing, or the IPA scan can pass a binary that lacks a key (chunk boundaries, frameworks, ATTrackingManager) (US-021g/h);
- an image can leave the phone with EXIF/GPS (any upload path the audit list does not cover), or the audit only proves a mock (US-021i);
- a SecureStore key escapes the registry, the reinstall wipe runs after something reads the Keychain, sign-out or Forget this server leaves a user-bound key or the query cache behind, or a write uses a keychain class that can leave the device (US-021j);
- the copy audit misses a sign-up pointer, billing word, deletion affordance, a 'nothing leaves' claim or an age other than 16 in any wave or style, an ALLOWED entry hides a real violation, a composer or the voice screen renders without the AI label, Report this is missing on Auto's messages or Deliverables, or the consent view-model can drop Retell (US-021k);
- the Dynamic Type audit can be bypassed (allowFontScaling false, a low maxFontSizeMultiplier, an icon-only button without a label) (US-021l);
- the association values disagree with app.json or with automatos-ai's served files, the push-security workflow can leak EXPO_TOKEN, installs third-party code with the token, gates the TestFlight loop, or reads an invented GraphQL field (US-021m/n);
- the testflight build and its OTA can use different EAS environments, or the WebSummit Clerk-key question is not put to Gerard (US-021o);
- a docs/release file holds a password, token, key or real account, a URL differs from legal-links.ts, a listing field is over its limit, a claim is not true of the merged code, or an OWNER step was marked DONE (US-021p/q, KR6);
- a file outside KR1 changed, a seam or audit-fix edit has no note, an audit was weakened, a test deleted, or a story's evidence does not exist.

You fix NOTHING in the code yourself.

## Scope

```
BASE=$(bash scripts/ralph/acceptance-prd001-release.sh --print-base)
git diff --stat $BASE..HEAD
git diff $BASE..HEAD
```

Read beside the diff: `scripts/ralph/prd-001-release.json` (binding: decisions, requirements R01–R23, ACs, seams, ownerTest), PRD-001 §4.10 and US-021, the earlier waves' kit json files on this branch, and the READ ONLY sources the json names (decisions.md 63–71, the privacy and Terms drafts with Appendix A, the three critiques, the W3 kit). Because this wave audits the whole app, a finding may name a line this diff does not touch when an A7 audit should have caught it; say which audit and why.

## Verification

- Run the **code-review** skill (or the code-reviewer agent) on the diff **in the foreground**, and the **security-reviewer** agent in the foreground on `src/observability/`, `src/storage/secure-registry.ts` and every audit-fixed storage file, `scripts/release/check-push-security.mjs` and `.github/workflows/push-security.yml`. Wait for each.
- Run `bash scripts/ralph/acceptance-prd001-release.sh` yourself (it reads the wave's one CI run). **Non-zero = automatic CRITICAL.**
- Plant-and-check: pick two sensitive field names the merged app really uses (one from push, one from chat or voice) that the sample event does not contain, and read whether `scrubEvent` / `scrubBreadcrumb` would remove them; a miss is a finding.
- Spot-check four marked ACs at random against the code and tests; always include one from US-021b and one from US-021j. Check every `OWNER —` AC is marked OWNER, never DONE.
- Only pure-Node checks may run on this machine; never `expo start`, `eas`, a simulator, a server or a request to Sentry or Expo; nothing left in the background.

## Verdict

- **No CRITICAL/HIGH/MEDIUM:** a 6-line summary: (a) crash reporting and the scrubber; (b) labels, manifest and the native change (did app.json change? one iOS build); (c) permissions and the IPA scan; (d) EXIF, secure storage and sign-out; (e) copy, surfaces and Dynamic Type across every wave and style; (f) the OWNER list Gerard must work through (OT-R1..OT-R15) and every AUDIT FIX made in other waves' files. Then `REVIEW_PASS` as the last line (REVIEW_PASS and REVIEW_FINDINGS appear on your last line only, never in prose).
- **Findings:** append `P001R-RVW-n` stories (n from 1) to `scripts/ralph/prd-001-release.json` (same shape: id, prdStory 'review', title, description with `file:line` evidence, acceptanceCriteria with the cause, the change, the test and the checks, files — inside KR1 only, seams, priority after the last story, passes false, notes ''), validate with `jq`, commit `git commit -s -m 'chore(prd-001): release review findings → fix stories [skip ci]' -- scripts/ralph/prd-001-release.json`. Then `REVIEW_FINDINGS` as the last line. A finding that needs a dependency, a native change outside KR3, a backend change or a human step is NOT a fix story: list it in your summary for Gerard. Do not push.
