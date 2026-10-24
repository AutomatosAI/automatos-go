# Ralph Review Prompt — Automatos Go, PRD-001 wave A5: Styles (Studio, Play, HUD)

You are a fresh-context **adversarial reviewer**. The build claims the current phase of the A5 styles wave is complete (`bash scripts/ralph/acceptance-prd001-styles.sh --print-phase`: phase 1 = the 18 stories with phase 1; phase 2 = all 22). Phase 1 ran in parallel with the A2 chat, A3 Command Centre and A1 connect kits on the same foundation. Stories whose `phase` is above the current phase are expected to be `passes: false`: never a finding. Find where:

- a file outside KS1's list for the phase changed, a dependency, app.json or eas.json changed, `src/styles/ai-label.tsx`, `src/core/**` or `assets/fonts/**` changed, or an edit to a foundation primitive or to `useTokens()` is NOT additive (a prop, export or type renamed or removed — A2's and A3's code must compile unchanged); a seam file edited without its `SEAM EDIT:` note; and list every `FOUNDATION GAP:` the DONE marks record, for Gerard (KS1, KS2);
- a colour, token or rule the vendored engine already computes was re-implemented instead of imported (lookToStudioTokens, lookToCssVars, isDarkGround, safeGlow, tripletToHex, contrastRatio, mascotReducer, the player, ringTone/ringColour, captionFor, chatCaption, toolLineLabel, validateLook, validateLookSchema) (KS5);
- Play's tokens diverge from the web's paint (tone not from the ground, a Studio key missing or extra, Light/Dark/System leaking into Play), HUD's derivations diverge from its README or looks.json (alphas 0.45 / 0.12 / 0.035 / 0.18 / 0.7, grid/300, the glow not capped at the vendored safeGlow), a text pair under AA in any style, or a size under 11 pt anywhere (US-016b/c/d, D-A11Y, KS9);
- HUD's looks are not automatos-look-schema/v1 documents that pass the vendored validators, a preset can be renamed or deleted, a HUD look reaches the server, or the Play look sync sends a PUT without both `looks` and `active`, lets two PUTs race, overwrites a phone change with an older server read, treats a 404 as an error instead of local-only, or polls (US-018a, US-017d, D59);
- Auto: a .webm shipped, a mascot file not byte-identical to automatos-ai frontend/public/auto/ at 630fc1c85 (sha256 in SOURCES.md), a clip in the Android bundle, a loop that keeps running or a clip that plays under Reduce Motion, the ring not app-drawn or in the wrong tone for the state and style, the colour matrix composed in the wrong order, a tinted shell drawn through expo-video (it cannot filter) (US-017a/b, KS6, KS11);
- the dress: a primitive that copies a screen per style instead of reading the dress, HUD statuses as colour alone (no glyph + WORD), a HUD radius other than 0, brackets not as KS12, Play's display face under 19 pt, a Slider that is not adjustable for VoiceOver, a new native module or web-only widget (US-016f/g, KS7);
- the picker or the look pages: a flip that is not instant or loses the choice on restart, a selected state shown by colour alone, previews animating under Reduce Motion, a knob, preset or name that differs from the vendored catalogue or looks.json (US-016h, US-017e, US-018c);
- installed themes: listed without `mobile_theme`, a theme file fetched from anything but a relative `/api/themes/files/` path, the bearer sent to another origin, a .js/.css/.html file ever downloaded or loaded, a painting without --background/--foreground offered, a revoked theme left as the style (US-016i, D-NO-CODE) — security findings are CRITICAL;
- any screen in any style pointing to creating an account ('Create an account', 'Sign up', 'No account?' — D-NO-SIGNUP, a store-rules finding: HIGH);
- the edges: copy naming a plan, credit or price; 'docker compose up' shown for a hosted server; the 5 s re-check left running after the screen goes; the gate's decision logic changed instead of its error branch (US-017f);
- phase 2: a shell edit beyond the lines US-016j names (the gate's decision logic, the connect kit's steps, A4's rows), Studio's home changed by the layout switch, a chat or Command Centre behaviour changed (Stop not cancelling on the server, a card acting for a viewer, a second needs-you number, a second live connection), the AI label missing or restyled beside Play's composer or HUD's TYPE sheet, a Command Centre screen copied per style, D25 broken on Play's shelf (US-016j, US-016k, US-017g, US-016l);
- a colour literal outside src/styles/tokens/, a component over 150 lines or a function over 50, a pure module importing react / react-native / expo / Skia;
- a story's evidence does not exist, or an ownerTest item (OT-S1..OT-S11) was claimed as done.

You fix NOTHING in the code yourself.

## Scope

```
BASE=$(bash scripts/ralph/acceptance-prd001-styles.sh --print-base)
PHASE=$(bash scripts/ralph/acceptance-prd001-styles.sh --print-phase)
git diff --stat $BASE..HEAD
git diff $BASE..HEAD -- ':!assets/mascot/*.mp4' ':!assets/mascot/*.png'
```

Read beside the diff: `scripts/ralph/prd-001-styles.json` (binding), PRD-001 §4.6/§4.7/§4.11, the foundation files the diff imports or edits, the vendored `src/core/web/lib/{look-kit,looks,mascot,theme-host}/`, and the design sources (READ ONLY) under `/Users/gkavanagh/Development/Automatos-AI-Platform/DUMPING AREA/` (`automatos-play-ember/`, `automatos-play-command/` with `looks.json`). Never file a finding against a line this diff does not touch, except a foundation gap the wave had to work around (list those separately, not as findings).

## Verification

- Run the **code-review** skill (or the code-reviewer agent) on the diff **in the foreground**, and the **security-reviewer** agent in the foreground on `src/styles/themes/`, `src/styles/routes.ts` and `src/styles/play/looks-api.ts`. Wait for each.
- Run `bash scripts/ralph/acceptance-prd001-styles.sh` yourself (it reads the phase's one CI run). **Non-zero = automatic CRITICAL.**
- Spot-check four DONE ACs at random against the code and tests; always include one from US-016e (the provider keeps `useTokens()`'s type) and one from US-017a or US-016i.
- Only pure-Node checks may run on this machine; never `expo start`, `eas`, a simulator or a server; nothing left in the background.

## Verdict

- **No CRITICAL/HIGH/MEDIUM:** a 5-line summary: (a) the style system: registry, provider, tokens per style, fonts, AA and the 11 pt floor; (b) the dress: primitives, grounds, the slider; (c) Auto: files, media choice, ring, tint, Reduce Motion; (d) the picker, Play's look page and sync, HUD's drawer, the edges, installed themes (and in phase 2 the homes, Play's conversations and shelf, the Command Centre in three styles); (e) every SEAM EDIT and FOUNDATION GAP recorded and the owner's next steps (OT-S1..OT-S11). Then `REVIEW_PASS` as the last line (REVIEW_PASS and REVIEW_FINDINGS appear on your last line only, never in prose).
- **Findings:** append `P001S-RVW-n` stories (n continues from the highest existing) to `scripts/ralph/prd-001-styles.json` (same shape: id, prdStory 'review', phase = the current phase, title, description with `file:line` evidence, acceptanceCriteria with the cause, the change, the test and the checks, files — inside KS1 for the phase only, priority above the highest existing one (a build session only takes stories whose phase is at most the current one, so a phase-1 fix story is built before any phase-2 story), passes false, notes ''), validate with `jq`, commit `git commit -s -m 'chore(prd-001): styles review findings → fix stories [skip ci]' -- scripts/ralph/prd-001-styles.json`. Then `REVIEW_FINDINGS` as the last line. A finding that can only be fixed in a foundation-owned file outside KS1, or in an A2/A3 file during phase 1, is NOT a fix story here: list it in your summary for that branch. Do not push.
