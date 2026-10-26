#!/bin/bash
# Acceptance gate — Automatos Go PRD-001 wave A5: Styles — Studio, Play, HUD (kit: styles).
#   bash scripts/ralph/acceptance-prd001-styles.sh                # full: local checks + the phase's one CI run
#   bash scripts/ralph/acceptance-prd001-styles.sh --no-ci        # local checks only (what a build session runs)
#   bash scripts/ralph/acceptance-prd001-styles.sh --print-base   # the diff base every check uses
#   bash scripts/ralph/acceptance-prd001-styles.sh --print-phase  # 1, or 2 once A2 and A3 are in this branch (KS3)
#   GATE_BASE=<ref> overrides the base (smoke runs only).
# Phase: 2 when HEAD carries A2's src/chat/routes.ts AND A3's src/cc/routes.ts (the base move merged them in),
# else 1. Base: phase 1 → the merge-base with origin/feat/a0-a1-foundation (stacked on the foundation, as the
# A2 and A3 kits are); phase 2 → the merge-base with the first of origin/main / the foundation branch whose
# merge-base already carries A2 and A3 (so A2's and A3's own changes never read as this wave's: the gate-base
# trap). Local checks are pure Node and exactly what CI runs.
# KS1 is enforced as an ALLOWLIST of changed paths per phase: phase 1 runs in parallel with the A2 chat, A3
# Command Centre and A1 connect kits and must never touch a file any of them owns or edits.
# No pipefail; each check in its own `( eval … )`; stdin closed. Negative checks read the wave's ADDED lines in
# product code, tests and the kit excluded; on the base they pass by construction, positives fail by design.
set -u
exec </dev/null
cd "$(dirname "$0")/../.." || exit 1
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin"   # appended: nvm's Node 22 (set by the launcher) must stay first

FOUNDATION_REF=origin/feat/a0-a1-foundation
a2_a3_in() { git cat-file -e "$1:src/chat/routes.ts" 2>/dev/null && git cat-file -e "$1:src/cc/routes.ts" 2>/dev/null; }
if a2_a3_in HEAD; then PHASE=2; else PHASE=1; fi
case "${1:-}" in --print-phase) echo "$PHASE"; exit 0 ;; esac

phase2_base() {
  local ref mb
  for ref in origin/main "$FOUNDATION_REF" feat/a0-a1-foundation main; do
    git rev-parse -q --verify "$ref^{commit}" >/dev/null || continue
    mb=$(git merge-base HEAD "$ref" 2>/dev/null) || continue
    if a2_a3_in "$mb"; then echo "$mb"; return 0; fi
  done
  return 1
}
if [ -n "${GATE_BASE:-}" ]; then
  BASE=$(git rev-parse --verify -q "$GATE_BASE^{commit}") || { echo "GATE_BASE $GATE_BASE does not resolve"; exit 1; }
elif [ "$PHASE" = 2 ]; then
  BASE=$(phase2_base) || { echo "phase 2: no merged ref (origin/main, $FOUNDATION_REF) carries A2 and A3 — the base move merges one into this branch"; exit 1; }
else
  BASE=$(git merge-base HEAD "$FOUNDATION_REF" 2>/dev/null || git merge-base HEAD feat/a0-a1-foundation 2>/dev/null || git merge-base HEAD origin/main) \
    || { echo "cannot resolve a merge-base with the foundation or origin/main"; exit 1; }
fi
MODE=full
case "${1:-}" in --print-base) echo "$BASE"; exit 0 ;; --no-ci) MODE=no-ci ;; "") ;; *) echo "unknown argument: $1"; exit 2 ;; esac
echo "base: $(git log -1 --format='%h %s' "$BASE") · HEAD: $(git log -1 --format='%h %s' HEAD) · phase: $PHASE · mode: $MODE · node: $(node -v 2>/dev/null || echo MISSING)"
FAIL=0
check() { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ PASS: $name"; else echo "   ❌ FAIL: $name"; FAIL=1; fi; }
warn()  { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ ok: $name"; else echo "   ⚠️  WARN (not a failure): $name"; fi; }

KIT=scripts/ralph/prd-001-styles.json
CI_JOBS=("typecheck · lint · test" "expo-doctor · iOS bundle")
MASCOT_STATES="hello idle listening thinking working searching reading celebrate oops sleeping lost loading"
# KS1: the only paths this wave may add or change, per phase.
P1_ALLOWED='^(src/styles/|src/ui/|assets/mascot/|assets/styles-fonts/|app/\(app\)/settings/style\.tsx$|app/\(app\)/settings/look/|app/\+not-found\.tsx$|scripts/ralph/(prd-001-styles\.json|PROMPT_build_prd001-styles\.md|PROMPT_review_prd001-styles\.md|acceptance-prd001-styles\.sh)$)'
# Phase 2 adds the shell files the A1 connect kit edits in parallel (US-016j) and A2's / A3's files.
P2_EXTRA='^(src/connect/__tests__/edges\.test\.ts$|src/consent/__tests__/consent-gate\.test\.ts$|src/app-state/AppGate\.tsx$|src/app-state/__tests__/app-gate-edge-slot\.test\.tsx?$|app/\(app\)/_layout\.tsx$|app/_layout\.tsx$|app/\(app\)/settings/index\.tsx$|src/chat/|src/cc/|app/\(app\)/index\.tsx$|app/\(app\)/chat/|app/\(app\)/chats\.tsx$|app/\(app\)/cc/)'
# KS2: edits of these need a 'SEAM EDIT: <path>' line in the kit's DONE notes.
SEAMS='^(src/app-state/AppGate\.tsx|app/\(app\)/settings/index\.tsx|app/\(app\)/_layout\.tsx|app/_layout\.tsx|app/\+not-found\.tsx|app/\(app\)/index\.tsx|app/\(app\)/chats\.tsx)$|^(src/chat/|src/cc/|app/\(app\)/chat/|app/\(app\)/cc/)'

added_code() { git diff "$BASE"..HEAD -- src app ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++'; }
added_code_outside_tokens() { git diff "$BASE"..HEAD -- src app ':!src/styles/tokens' ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++'; }
added_files() { git diff --name-only --diff-filter=A "$BASE"..HEAD -- "$@"; }
has() { [ -f "$2" ] && grep -qE -e "$1" "$2"; }
all_exist() { local f; for f in "$@"; do [ -e "$f" ] || { echo "   missing: $f"; return 1; }; done; }
every_commit_signed() { [ -z "$(git log --no-merges --format='%H %(trailers:key=Signed-off-by,valueonly)' "$BASE"..HEAD | awk 'NF<2{print $1}')" ]; }
file_sizes_ok() { local f n bad=0; for f in $(added_files src app | grep -E '\.(ts|tsx)$'); do [ -f "$f" ] || continue; n=$(wc -l < "$f" | tr -d ' '); [ "$n" -le 800 ] || { echo "   $f: $n lines"; bad=1; }; done; [ $bad -eq 0 ]; }
npm_ok() { [ -f package.json ] || { echo "   no package.json in $(pwd) — refusing to run npm (it would climb to a parent)"; return 1; }; }
outside_ks1() {
  local changed; changed=$(git diff --name-only "$BASE"..HEAD | grep -vE "$P1_ALLOWED")
  if [ "$PHASE" = 2 ]; then changed=$(printf '%s\n' "$changed" | grep -vE "$P2_EXTRA"); fi
  printf '%s\n' "$changed" | grep -v '^$'
}
seam_notes_ok() {
  local f bad=0 text
  text=$(jq -r '[.userStories[] | .notes, .acceptanceCriteria[]] | .[]' "$KIT")
  for f in $(git diff --name-only "$BASE"..HEAD | grep -E "$SEAMS"); do
    printf '%s\n' "$text" | grep -qF "SEAM EDIT: $f" || { echo "   no 'SEAM EDIT: $f' in the kit's DONE notes"; bad=1; }
  done
  [ $bad -eq 0 ]
}
mascot_files_ok() {
  local s
  for s in $MASCOT_STATES; do
    [ -s "assets/mascot/$s.mp4" ] && [ -s "assets/mascot/$s.png" ] || { echo "   missing assets/mascot/$s.{mp4,png}"; return 1; }
  done
  [ -s assets/mascot/SOURCES.md ] || { echo "   missing assets/mascot/SOURCES.md"; return 1; }
  [ -z "$(find assets/mascot -name '*.webm' 2>/dev/null)" ] || { echo "   a .webm is web-only"; return 1; }
  all_exist src/styles/mascot/assets.ios.ts src/styles/mascot/assets.android.ts || return 1
  ! grep -q '\.mp4' src/styles/mascot/assets.android.ts || { echo "   the Android asset table names a clip"; return 1; }
}

echo ""; echo "=== Kit (phase $PHASE)"
check "kit JSON valid; every story of phase <= $PHASE passes:true" "jq -e --argjson p $PHASE '[.userStories[] | select((.phase // 1) <= \$p) | select(.passes != true)] | length == 0' $KIT >/dev/null"
check "every acceptance criterion of phase <= $PHASE carries a DONE mark" "jq -e --argjson p $PHASE '[.userStories[] | select((.phase // 1) <= \$p) | .acceptanceCriteria[] | select(contains(\"→ DONE\") | not)] | length == 0' $KIT >/dev/null"

if [ -f package.json ] && [ -f package-lock.json ] && [ ! -d node_modules ]; then
  echo ""; echo "── node_modules absent — installing (npm ci --ignore-scripts)"
  npm ci --ignore-scripts --no-audit --no-fund || { echo "   ❌ FAIL: npm ci"; FAIL=1; }
fi

echo ""; echo "=== Local checks (pure Node)"
check "typecheck (tsc --noEmit)" "npm_ok && npm run -s typecheck"
check "lint (eslint .)" "npm_ok && npm run -s lint"
check "vitest suite" "npm_ok && npx --no-install vitest run"
check "JS bundle compiles (expo export --platform ios)" "npm_ok && npm run -s check:bundle >/dev/null"
check "vendored core unchanged (check:core)" "npm_ok && npm run -s check:core"
check "every route the app calls is in the pinned manifest (check:routes)" "npm_ok && npm run -s check:routes"

echo ""; echo "=== KS1/KS2: the wave's files (phase $PHASE)"
check "every changed path is inside KS1's list for phase $PHASE" "o=\$(outside_ks1); [ -z \"\$o\" ] || { echo \"\$o\" | sed 's/^/   outside KS1: /'; false; }"
check "package.json, package-lock.json, app.json, eas.json untouched (D-NATIVE-ONCE)" "git diff --quiet $BASE..HEAD -- package.json package-lock.json app.json eas.json"
check "the AI label is untouched (D-AI-LABEL)" "git diff --quiet $BASE..HEAD -- src/styles/ai-label.tsx"
check "every seam file edit is recorded as 'SEAM EDIT: <path>' (KS2)" "seam_notes_ok"
check "src/navigation/** untouched: A5's paths live in src/styles/nav.ts (KS4)" "git diff --quiet $BASE..HEAD -- src/navigation"

echo ""; echo "=== Stories, phase 1"
check "US-016a registry, choice and picker" "all_exist src/styles/registry/style-id.ts src/styles/registry/registry.ts src/styles/registry/choice.ts src/styles/registry/choice-store.ts src/styles/registry/picker.ts && grep -rq 'styles.choice' src/styles/registry"
check "US-016b Play tokens from the vendored engine" "all_exist src/styles/tokens/play.ts src/styles/tokens/radii.ts && has 'lookToStudioTokens' src/styles/tokens/play.ts && has 'lookToCssVars' src/styles/tokens/play.ts && has 'isDarkGround' src/styles/tokens/play.ts"
check "US-016c HUD tokens: looks.json data, the safeGlow cap" "all_exist src/styles/tokens/hud-catalogue.ts src/styles/tokens/hud.ts && has '3FE0FF' src/styles/tokens/hud-catalogue.ts && has 'E6F1F5' src/styles/tokens/hud-catalogue.ts && has 'safeGlow' src/styles/tokens/hud.ts"
check "US-018a HUD looks: look-schema/v1, the vendored validators, kept on the phone" "has 'automatos-look-schema/v1' src/styles/hud/look-schema.ts && has 'validateLookSchema' src/styles/hud/look-schema.ts && has 'styles.hud.looks' src/styles/hud/look-store.ts"
check "HUD looks never reach the server (D59)" "[ -z \"\$(grep -rlE '/api/|STYLE_ROUTES' src/styles/hud 2>/dev/null | grep -v __tests__)\" ]"
check "US-016d faces and the scale for every style" "all_exist src/styles/typeface/faces.ts src/styles/typeface/scale.ts && has 'Rajdhani' src/styles/typeface/faces.ts && has 'Chakra' src/styles/typeface/faces.ts && has 'Instrument' src/styles/typeface/faces.ts"
check "US-016e provider: resolveStyle in theme.tsx, StyleScope, Reduce Motion" "all_exist src/styles/provider/resolve.ts src/styles/provider/StyleScope.tsx && has 'resolveStyle|useStyle' src/styles/theme.tsx && grep -rqE 'isReduceMotionEnabled|useReduceMotion' src/styles/provider"
check "US-016f dress and glyphs; the primitives read the dress" "all_exist src/styles/dress/dress.ts src/styles/dress/status-glyphs.ts && grep -rqE 'dressOf|useDress' src/ui && has '◆' src/styles/dress/status-glyphs.ts && has '✕' src/styles/dress/status-glyphs.ts"
check "US-016g grounds and our Slider" "all_exist src/styles/ground/PlayGlow.tsx src/styles/ground/HudOverlay.tsx src/ui/Slider.tsx src/ui/slider-model.ts && has 'adjustable' src/ui/Slider.tsx"
check "US-017a mascot files: 12 clips + 12 stills, SOURCES.md, no .webm, no clip on Android" "mascot_files_ok"
check "US-017a mascot logic: media, colour matrix, ring palette, chat events, driver" "all_exist src/styles/mascot/media.ts src/styles/mascot/shell-matrix.ts src/styles/mascot/ring-palette.ts src/styles/mascot/chat-events.ts src/styles/mascot/driver.ts && grep -rq 'MASCOT_TINTED_CLIPS' src/styles/mascot"
check "US-017b mascot on screen: expo-video clip, Skia colour matrix, the ring" "all_exist src/styles/mascot/Mascot.tsx src/styles/mascot/MascotRing.tsx src/styles/mascot/MascotClip.tsx src/styles/mascot/MascotSkia.tsx && has 'expo-video' src/styles/mascot/MascotClip.tsx && has 'ColorMatrix' src/styles/mascot/MascotSkia.tsx"
check "US-017c Play Companion components" "all_exist src/styles/play/companion/model.ts && for c in PlayHeader AutoRow ToolChip ReportCard PlayComposer PlayConversations PlayBottomBar; do grep -rqE \"(function|const) \$c\" src/styles/play/companion || { echo \"   missing \$c\"; exit 1; }; done"
check "Play's composer carries the AI label" "grep -rq 'AiLabel' src/styles/play/companion"
check "US-018b HUD core: ring specs, waveform, chip, transcript, buttons" "all_exist src/styles/hud/core/ring-specs.ts src/styles/hud/core/RingCore.tsx src/styles/hud/core/waveform.ts src/styles/hud/core/HudCore.tsx && grep -rqE 'HOLD' src/styles/hud/core src/styles/strings.ts"
check "US-016h picker screen and A5's own paths (src/styles/nav.ts)" "all_exist 'app/(app)/settings/style.tsx' src/styles/nav.ts && has 'settingsStyle' src/styles/nav.ts && has 'lookPlay' src/styles/nav.ts && has 'lookHud' src/styles/nav.ts"
check "US-017d the looks API and StyleSync" "has '/api/themes/looks/' src/styles/routes.ts && all_exist src/styles/play/look-sync.ts src/styles/sync/StyleSync.tsx && grep -rq 'automatos/play' src/styles/play src/styles/routes.ts && grep -q 'StyleSync' 'app/(app)/settings/style.tsx'"
check "US-017e Play look page over the vendored presets and the glow cap" "all_exist 'app/(app)/settings/look/play.tsx' src/styles/play/look-page.ts && has 'PRESETS' src/styles/play/look-page.ts && has 'safeGlow' src/styles/play/look-page.ts"
check "US-018c HUD Looks drawer" "all_exist 'app/(app)/settings/look/hud.tsx' src/styles/hud/LooksDrawer.tsx src/styles/hud/drawer-model.ts"
check "US-017f the four edge screens and EdgeScreen; Lost on the not-found route" "all_exist src/styles/edges/edges.ts src/styles/edges/EdgeScreen.tsx src/styles/edges/FirstOpen.tsx src/styles/edges/NotRunning.tsx src/styles/edges/SomethingWrong.tsx src/styles/edges/Lost.tsx && grep -q 'Lost' 'app/+not-found.tsx'"
check "US-016i installed themes: routes, the capability gate, the file allowlist" "has '/api/themes/installed' src/styles/routes.ts && has '/api/themes/mobile/' src/styles/routes.ts && has 'pendingUpstream' src/styles/routes.ts && grep -rq 'canMobileTheme' src/styles/themes && grep -rq '/api/themes/files/' src/styles/themes"

if [ "$PHASE" = 2 ]; then
  echo ""; echo "=== Stories, phase 2 (A2 and A3 in the branch)"
  check "US-016j the shell: the Settings row, StyleSync once, the edge screens on the gate's errors" "grep -q 'settingsStyle' 'app/(app)/settings/index.tsx' && grep -q 'StyleSync' 'app/(app)/_layout.tsx' && grep -q 'EdgeScreen' 'app/(app)/_layout.tsx' && git diff --quiet $BASE..HEAD -- src/app-state ':!src/app-state/AppGate.tsx' ':!src/app-state/__tests__/app-gate-edge-slot.test.ts' ':!src/app-state/__tests__/app-gate-edge-slot.test.tsx'"
  check "US-016k the home is a layout switch; Play and HUD homes over A2's thread" "all_exist src/styles/homes/PlayHome.tsx src/styles/homes/HudHome.tsx && grep -qE 'PlayHome|StyleHome|HudHome' 'app/(app)/index.tsx' && grep -rqE 'chat/(controller|view-model|composer)' src/styles/homes"
  check "US-017g Play conversations and shelf" "all_exist src/styles/homes/PlayShelf.tsx && grep -qE 'PlayConversations' 'app/(app)/chats.tsx' && grep -qE 'PlayShelf' 'app/(app)/cc/deliverables.tsx'"
  check "US-016l the Command Centre dress test" "all_exist src/styles/__tests__/cc-dress.test.ts"
fi

echo ""; echo "=== Contract (negative, added lines only)"
check "no WebView (D-NO-WEBVIEW)" "! added_code | grep -q 'react-native-webview'"
check "no fetch( outside the client (D-ONE-CLIENT)" "! added_code | grep -E '(^|[^.A-Za-z0-9_])fetch\\(' | grep -q ."
check "no colour literal outside src/styles/tokens (D-TOKENS)" "! added_code_outside_tokens | grep -E \"['\\\"\\\`]#[0-9A-Fa-f]{3,8}['\\\"\\\`]|(rgba?|hsla?)\\(\" | grep -q ."
check "no module the native build lacks (KS7)" "! added_code | grep -qE \"from ['\\\"](@react-native-community/slider|expo-blur|expo-clipboard|@react-native-clipboard/clipboard|lottie-react-native)['\\\"]\""
check "nothing evaluated as code from a theme or the server (D-NO-CODE)" "! added_code | grep -qE '(^|[^A-Za-z0-9_.])eval\\(|new Function\\(|injectedJavaScript'"
check "no .webm added (web-only)" "[ -z \"\$(added_files . | grep -E '\\.webm\$')\" ]"
check "no planMode / missionMode (D30)" "! added_code | grep -qE 'planMode|missionMode'"
check "no server polling (refetchInterval)" "! added_code | grep -q 'refetchInterval'"
check "no pointer to creating an account (D-NO-SIGNUP)" "! added_code | grep -iE 'create (an|one|your) account|no account\\?' | grep -q ."
check "no sign-up copy in the styles strings (D-NO-SIGNUP)" "! git diff $BASE..HEAD -- src/styles/strings.ts | grep '^+' | grep -qiE 'sign[ -]?up'"
check "no plans, credits or prices in the copy (D8)" "! git diff $BASE..HEAD -- src/styles/strings.ts | grep '^+' | grep -qiE 'credits?|pricing|price|upgrade|subscription'"
check "every commit is signed off (DCO)" "every_commit_signed"
check "new source files <= 800 lines" "file_sizes_ok"
warn  "story commits carry [skip ci] (all but each phase's CI commit)" "[ -z \"\$(git log --no-merges --format='%s' $BASE..HEAD^ | grep -v 'skip ci' | grep -v 'styles phase . built, run CI')\" ]"

ci_commit_for_head() {
  local sha; sha=$(git rev-parse HEAD)
  while git log -1 --format=%s "$sha" | grep -q 'skip ci' && [ -z "$(git show --format= --name-only "$sha" | grep -v '^scripts/ralph/')" ]; do
    sha=$(git rev-parse "$sha^")
  done
  echo "$sha"
}
wait_run() {
  local wf="$1" sha="$2" waited=0 line
  while :; do
    line=$(gh run list --workflow "$wf" --limit 30 --json databaseId,headSha,status,conclusion --jq ".[] | select(.headSha == \"$sha\") | \"\(.databaseId) \(.status) \(.conclusion)\"" 2>/dev/null | head -1)
    case "$line" in *" completed "*) echo "${line%% *} ${line##* }"; return 0 ;; esac
    [ "$waited" -ge 2700 ] && { echo "   no completed $wf run for $sha after 45 min (${line:-no run})"; return 1; }
    sleep 60; waited=$((waited + 60))
  done
}
ci_green_on_head() {
  local br sha r id concl jobs job hits
  br=$(git rev-parse --abbrev-ref HEAD); sha=$(ci_commit_for_head)
  [ "$sha" = "$(git rev-parse HEAD)" ] || echo "   HEAD is kit-only [skip ci] commits over $(git log -1 --format=%h "$sha"): reading that commit's runs"
  command -v gh >/dev/null || { echo "   gh is required"; return 1; }
  [ -n "$(gh pr list --head "$br" --state open --json number --jq '.[0].number' 2>/dev/null)" ] || { echo "   no open PR for $br: ci.yml runs on pull_request (and push to main) only"; return 1; }
  r=$(wait_run ci.yml "$sha") || { echo "$r"; return 1; }
  id="${r%% *}"
  jobs=$(gh run view "$id" --json jobs --jq '.jobs[] | "\(.conclusion)\t\(.name)"')
  for job in "${CI_JOBS[@]}"; do
    hits=$(echo "$jobs" | grep -F "$job" | cut -f1)
    [ -n "$hits" ] || { echo "   missing job: $job"; return 1; }
    echo "$hits" | grep -qvE '^success$' && { echo "   red: $job"; return 1; }
  done
  r=$(wait_run malware-scan.yml "$sha") || { echo "$r"; return 1; }
  concl="${r##* }"; [ "$concl" = "success" ] || { echo "   malware-scan: $concl"; return 1; }
  echo "   ci.yml run $id green on ${sha:0:9} (${CI_JOBS[*]}); malware-scan green"
}
if [ "$MODE" = full ]; then
  echo ""; echo "=== CI (once per phase)"
  check "CI: both ci.yml jobs and malware-scan green on the tested commit" "ci_green_on_head"
fi
echo ""
if [ "$FAIL" -eq 0 ]; then echo "✅ PRD-001 styles acceptance (phase $PHASE, $MODE): PASS"; else echo "❌ PRD-001 styles acceptance (phase $PHASE, $MODE): FAIL"; fi
exit "$FAIL"
