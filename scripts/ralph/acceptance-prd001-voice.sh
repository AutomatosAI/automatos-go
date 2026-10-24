#!/bin/bash
# Acceptance gate — Automatos Go PRD-001 wave A6: Voice — quick-ask, the voice screen, Auto Live (kit: voice).
#   bash scripts/ralph/acceptance-prd001-voice.sh                # full: local checks + the phase's one CI run
#   bash scripts/ralph/acceptance-prd001-voice.sh --no-ci        # local checks only (what a build session runs)
#   bash scripts/ralph/acceptance-prd001-voice.sh --print-base   # the diff base every check uses
#   bash scripts/ralph/acceptance-prd001-voice.sh --print-phase  # 1, or 2 once Auto Live may be built (KV3)
#   GATE_BASE=<ref> overrides the base (smoke runs only); VOICE_BASE_REF=<ref> is tried first (the launcher's
#   RALPH_BASE_REF, e.g. origin/main once the foundation merged).
# Phase: 2 when the kit json's RETELL_LIVEKIT_CONFIRMED value is true AND HEAD carries the connect kit's
# src/consent/policy.ts; else 1. Base: the merge-base with the first of VOICE_BASE_REF / the foundation branch /
# origin/main whose merge-base already carries A2 chat and A5 styles phase 1 (and, in phase 2, the consent code),
# so A2's, A5's and connect's own changes never read as this wave's (the gate-base trap).
# KV1 is enforced as an ALLOWLIST of changed paths: src/voice/**, app/(app)/voice.tsx, this kit's files, and
# KV2's named seams into A2 and A5 (each needs a 'SEAM EDIT: <path>' note).
# No pipefail; each check in its own `( eval … )`; stdin closed. Negative checks read the wave's ADDED lines in
# product code, tests and the kit excluded; on the base they pass by construction, positives fail by design.
set -u
exec </dev/null
cd "$(dirname "$0")/../.." || exit 1
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin"   # appended: nvm's Node 22 (set by the launcher) must stay first

KIT=scripts/ralph/prd-001-voice.json
FOUNDATION_REF=origin/feat/a0-a1-foundation
BASE_REFS="${VOICE_BASE_REF:-} $FOUNDATION_REF origin/main feat/a0-a1-foundation main"
flag_on() { [ -f "$KIT" ] && jq -e '[.decisions[] | select(.id == "RETELL_LIVEKIT_CONFIRMED") | .value] == [true]' "$KIT" >/dev/null 2>&1; }
consent_in() { git cat-file -e "$1:src/consent/policy.ts" 2>/dev/null; }
deps_in() {   # A2 chat + A5 styles phase 1 (needsInBase.phase1)
  git cat-file -e "$1:src/chat/routes.ts" 2>/dev/null && git cat-file -e "$1:src/chat/request.ts" 2>/dev/null \
    && git cat-file -e "$1:src/styles/hud/core/HudCore.tsx" 2>/dev/null && git cat-file -e "$1:src/styles/provider/resolve.ts" 2>/dev/null
}
if flag_on && consent_in HEAD; then PHASE=2; else PHASE=1; fi
case "${1:-}" in --print-phase) echo "$PHASE"; exit 0 ;; esac

base_with() {
  local ref mb
  for ref in $BASE_REFS; do
    git rev-parse -q --verify "$ref^{commit}" >/dev/null || continue
    mb=$(git merge-base HEAD "$ref" 2>/dev/null) || continue
    deps_in "$mb" || continue
    if [ "$1" = 2 ]; then consent_in "$mb" || continue; fi
    echo "$mb"; return 0
  done
  return 1
}
if [ -n "${GATE_BASE:-}" ]; then
  BASE=$(git rev-parse --verify -q "$GATE_BASE^{commit}") || { echo "GATE_BASE $GATE_BASE does not resolve"; exit 1; }
elif ! BASE=$(base_with "$PHASE"); then
  if [ "$PHASE" = 2 ]; then
    echo "phase 2: no merged ref ($FOUNDATION_REF, origin/main) carries A2, A5 phase 1 and the connect kit's consent — the base move merges one into this branch"; exit 1
  fi
  BASE=$(git merge-base HEAD "$FOUNDATION_REF" 2>/dev/null || git merge-base HEAD feat/a0-a1-foundation 2>/dev/null || git merge-base HEAD origin/main) \
    || { echo "cannot resolve a merge-base with the foundation or origin/main"; exit 1; }
fi
MODE=full
case "${1:-}" in --print-base) echo "$BASE"; exit 0 ;; --no-ci) MODE=no-ci ;; "") ;; *) echo "unknown argument: $1"; exit 2 ;; esac
echo "base: $(git log -1 --format='%h %s' "$BASE") · HEAD: $(git log -1 --format='%h %s' HEAD) · phase: $PHASE · mode: $MODE · node: $(node -v 2>/dev/null || echo MISSING)"
FAIL=0
check() { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ PASS: $name"; else echo "   ❌ FAIL: $name"; FAIL=1; fi; }
warn()  { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ ok: $name"; else echo "   ⚠️  WARN (not a failure): $name"; fi; }

CI_JOBS=("typecheck · lint · test" "expo-doctor · iOS bundle")
# KV1: the wave's own paths.
OWN='^(src/voice/|app/\(app\)/voice\.tsx$|scripts/ralph/(prd-001-voice\.json|PROMPT_build_prd001-voice\.md|PROMPT_review_prd001-voice\.md|acceptance-prd001-voice\.sh)$)'
# KV2: the named seams into A2 and A5 (each edit needs a 'SEAM EDIT: <path>' note).
SEAMS='^(src/chat/request\.ts|src/chat/composer/Composer\.tsx|src/chat/screens/ChatScreen\.tsx|src/styles/play/companion/PlayComposer\.tsx|src/styles/homes/HudHome\.tsx)$|^(src/chat/controller/|src/styles/hud/core/)'
TRANSITIVE_OK='expo-keep-awake'   # KV12: a dependency of expo 54, already in the binary

added_code() { git diff "$BASE"..HEAD -- src app ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++'; }
added_files() { git diff --name-only --diff-filter=A "$BASE"..HEAD -- "$@"; }
wave_code_files() { git diff --name-only --diff-filter=AM "$BASE"..HEAD -- src app | grep -vE '__tests__|\.test\.tsx?$'; }
has() { [ -f "$2" ] && grep -qE -e "$1" "$2"; }
all_exist() { local f; for f in "$@"; do [ -e "$f" ] || { echo "   missing: $f"; return 1; }; done; }
every_commit_signed() { [ -z "$(git log --no-merges --format='%H %(trailers:key=Signed-off-by,valueonly)' "$BASE"..HEAD | awk 'NF<2{print $1}')" ]; }
file_sizes_ok() { local f n bad=0; for f in $(added_files src app | grep -E '\.(ts|tsx)$'); do [ -f "$f" ] || continue; n=$(wc -l < "$f" | tr -d ' '); [ "$n" -le 800 ] || { echo "   $f: $n lines"; bad=1; }; done; [ $bad -eq 0 ]; }
npm_ok() { [ -f package.json ] || { echo "   no package.json in $(pwd) — refusing to run npm (it would climb to a parent)"; return 1; }; }
outside_kv1() { git diff --name-only "$BASE"..HEAD | grep -vE "$OWN" | grep -vE "$SEAMS" | grep -v '^$'; }
seam_notes_ok() {
  local f bad=0 text
  text=$(jq -r '[.userStories[] | .notes, .acceptanceCriteria[]] | .[]' "$KIT")
  for f in $(git diff --name-only "$BASE"..HEAD | grep -E "$SEAMS"); do
    printf '%s\n' "$text" | grep -qF "SEAM EDIT: $f" || { echo "   no 'SEAM EDIT: $f' in the kit's DONE notes"; bad=1; }
  done
  [ $bad -eq 0 ]
}
foreign_tests_untouched() { local t; t=$(git diff --name-only "$BASE"..HEAD | grep -E '^src/(chat|styles)/(.*/)?__tests__/'); [ -z "$t" ] || { echo "$t" | sed 's/^/   edited: /'; return 1; }; }
# only_importer <module ERE> <allowed file>...: among the wave's code files, only the named ones import the module.
only_importer() {
  local mod="$1" f a ok bad=0; shift
  for f in $(wave_code_files); do
    [ -f "$f" ] || continue
    grep -qE "(from|import\\(|require\\() *['\"]($mod)['\"/]" "$f" || continue
    ok=0; for a in "$@"; do [ "$f" = "$a" ] && ok=1; done
    [ $ok -eq 1 ] || { echo "   $f imports $mod"; bad=1; }
  done
  [ $bad -eq 0 ]
}
# Every package the wave's added lines import is a dependency in package.json (or KV12's transitive one).
imports_ok() {
  local m pkg bad=0
  for m in $(added_code | grep -oE "(from|import\\(|require\\() *['\"][^'\"]+['\"]" | sed -E "s/^(from|import\\(|require\\() *['\"]//; s/['\"]\$//" | sort -u); do
    case "$m" in .*|@/*) continue ;; esac
    case "$m" in @*/*) pkg=$(printf '%s' "$m" | cut -d/ -f1-2) ;; *) pkg=${m%%/*} ;; esac
    [ "$pkg" = "$TRANSITIVE_OK" ] && continue
    jq -e --arg p "$pkg" '(.dependencies[$p] // .devDependencies[$p]) != null' package.json >/dev/null 2>&1 || { echo "   not a dependency: $pkg ($m)"; bad=1; }
  done
  [ $bad -eq 0 ]
}
no_live_code() {
  local f; f=$(git diff --name-only "$BASE"..HEAD -- src/voice/live)
  [ -z "$f" ] || { echo "$f" | sed 's/^/   phase-2 file in phase 1: /'; return 1; }
  ! added_code | grep -qE "from ['\"](@livekit/react-native|livekit-client)['\"]"
}
fixtures_ok() {
  local f n=0
  for f in src/voice/__tests__/__fixtures__/retell/*.json; do
    [ -f "$f" ] || continue; n=$((n + 1))
    jq -e '.provenance | type == "string" and startswith("contract")' "$f" >/dev/null 2>&1 || grep -q '"provenance": *"recorded' "$f" || { echo "   $f: no provenance"; return 1; }
  done
  [ $n -gt 0 ] || { echo "   no fixtures under src/voice/__tests__/__fixtures__/retell/"; return 1; }
}
flag_flipped_by_lead() {   # the one '"value": true' in the kit was introduced by a commit that names the decision
  local s; s=$(git log -1 --format=%s -S'"value": true' -- "$KIT" 2>/dev/null)
  printf '%s' "$s" | grep -q 'RETELL_LIVEKIT_CONFIRMED' || { echo "   the flip commit is '${s:-none}' — the lead's commit names RETELL_LIVEKIT_CONFIRMED"; return 1; }
}

echo ""; echo "=== Kit (phase $PHASE)"
check "kit JSON valid; every story of phase <= $PHASE passes:true" "jq -e --argjson p $PHASE '[.userStories[] | select((.phase // 1) <= \$p) | select(.passes != true)] | length == 0' $KIT >/dev/null"
check "every acceptance criterion of phase <= $PHASE carries a DONE mark" "jq -e --argjson p $PHASE '[.userStories[] | select((.phase // 1) <= \$p) | .acceptanceCriteria[] | select(contains(\"→ DONE\") | not)] | length == 0' $KIT >/dev/null"
check "RETELL_LIVEKIT_CONFIRMED is one explicit decision line with a boolean value" "jq -e '[.decisions[] | select(.id == \"RETELL_LIVEKIT_CONFIRMED\") | .value | type] == [\"boolean\"]' $KIT >/dev/null"
check "the base carries A2 chat and A5 styles phase 1 (needsInBase.phase1)" "deps_in $BASE || { echo '   merge feat/a2-studio-chat and feat/a5-styles phase 1 into the base first'; false; }"

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

echo ""; echo "=== KV1/KV2: the wave's files"
check "every changed path is inside KV1's list or a KV2 seam" "o=\$(outside_kv1); [ -z \"\$o\" ] || { echo \"\$o\" | sed 's/^/   outside KV1: /'; false; }"
check "package.json, package-lock.json, app.json, eas.json, plugins/ untouched (D-NATIVE-ONCE)" "git diff --quiet $BASE..HEAD -- package.json package-lock.json app.json eas.json plugins"
check "the AI label is untouched (D-AI-LABEL)" "git diff --quiet $BASE..HEAD -- src/styles/ai-label.tsx"
check "src/navigation, src/api, src/core, src/consent and the shell layouts untouched (KV1, KV17)" "git diff --quiet $BASE..HEAD -- src/navigation src/api src/core src/consent src/auth src/ui app/_layout.tsx 'app/(app)/_layout.tsx'"
check "every seam edit is recorded as 'SEAM EDIT: <path>' (KV2)" "seam_notes_ok"
check "A2's and A5's tests are unchanged (seams are additive)" "foreign_tests_untouched"
check "every package the wave imports is installed (no new dependency; expo-keep-awake via expo)" "npm_ok && imports_ok"
check "only recognizer.ts and permissions.ts import expo-speech-recognition (KV15)" "only_importer 'expo-speech-recognition' src/voice/quick-ask/recognizer.ts src/voice/permissions/permissions.ts"
check "only speaker.ts imports expo-speech (KV15)" "only_importer 'expo-speech' src/voice/speech/speaker.ts"
check "only keep-awake.ts imports expo-keep-awake (KV12)" "only_importer 'expo-keep-awake' src/voice/interruptions/keep-awake.ts"

echo ""; echo "=== Stories, phase 1 (quick-ask and the voice screen)"
check "US-019a the one reducer and the config" "all_exist src/voice/machine/voice-state.ts src/voice/machine/voice-reducer.ts src/voice/config.ts && has 'micOpen' src/voice/machine/voice-state.ts && has 'HOLD_MIN_MS' src/voice/config.ts && has 'AI_NOTICE_INTERVAL_MS' src/voice/config.ts"
check "US-019b on-device only: the policy, the recognizer core and adapter" "all_exist src/voice/quick-ask/recognition-policy.ts src/voice/quick-ask/recognizer-core.ts src/voice/__tests__/recognizer-core.test.ts src/voice/quick-ask/recognizer.ts src/voice/quick-ask/recognizer-events.ts src/voice/quick-ask/locale.ts && grep -rqE 'requiresOnDeviceRecognition: *true' src/voice/quick-ask && grep -rq 'supportsOnDeviceRecognition' src/voice/quick-ask && grep -rq 'getSupportedLocales' src/voice/quick-ask && has 'installedLocales' src/voice/quick-ask/recognition-policy.ts"
check "US-019c permissions from the press; Settings for a denial" "all_exist src/voice/permissions/permission-flow.ts src/voice/permissions/permissions.ts src/voice/permissions/PermissionNotice.tsx && has 'openSettings' src/voice/permissions/permissions.ts"
check "US-019d speakable text, sentences, a voice on the phone" "all_exist src/voice/speech/speakable.ts src/voice/speech/sentences.ts src/voice/speech/voice-pick.ts src/voice/speech/speaker.ts && has 'useApplicationAudioSession' src/voice/speech/speaker.ts && has 'network' src/voice/speech/voice-pick.ts"
check "US-019e the AI notice once per session: the server's greeting, no reminder (D73)" "all_exist src/voice/notice/ai-notice.ts && grep -qF 'Hi, this is Auto, your AI assistant.' src/voice/strings.ts && ! grep -qF \"Just so you know, I'm an AI assistant.\" src/voice/strings.ts"
check "US-019f spokenMode through A2's request and controller" "has 'spokenMode' src/chat/request.ts && grep -rq 'spokenMode' src/chat/controller && grep -rq 'canSpokenMode' src/voice"
check "US-019g quick-ask over A2's controller; STOP; 'Auto, stop'" "all_exist src/voice/quick-ask/use-quick-ask.ts src/voice/quick-ask/stop-phrase.ts src/voice/quick-ask/quick-ask-plan.ts src/voice/quick-ask/reply-text.ts src/voice/audio/audio-owner.ts && grep -qE 'chat/controller' src/voice/quick-ask/use-quick-ask.ts"
check "US-019h interruptions and keep-awake" "all_exist src/voice/interruptions/interruption-policy.ts src/voice/interruptions/use-interruptions.ts src/voice/interruptions/keep-awake.ts && has 'AppState' src/voice/interruptions/use-interruptions.ts && has 'expo-keep-awake' src/voice/interruptions/keep-awake.ts"
check "US-019i the view-model and the dress (Studio ink and orange)" "all_exist src/voice/screen/voice-view-model.ts src/voice/screen/dress.ts && has '--foreground' src/voice/screen/dress.ts && has '--accent' src/voice/screen/dress.ts"
check "US-019j the voice screen on A5's HudCore, with the AI caption and no fence (D73)" "all_exist 'app/(app)/voice.tsx' src/voice/nav.ts src/voice/screen/VoiceScreen.tsx && has '/voice' src/voice/nav.ts && grep -qE 'styles/hud/core' src/voice/screen/VoiceScreen.tsx && grep -rq 'AiLabel' src/voice/screen && ! grep -rq 'useAiLabelVisible' src/voice"
check "US-019k the voice button in A2's and Play's composers" "all_exist src/voice/entry/voice-entry.ts src/voice/entry/VoiceButton.tsx && ! grep -qi 'voice' src/chat/composer/Composer.tsx && has 'VoiceButton' src/chat/screens/ChatScreen.tsx && has 'VoiceButton' src/styles/play/companion/PlayComposer.tsx"

if [ "$PHASE" = 1 ]; then
  echo ""; echo "=== Phase 1: Auto Live is not built (RETELL_LIVEKIT_CONFIRMED false, or the consent code is not in the branch)"
  check "no src/voice/live/ and no LiveKit import yet (KV3)" "no_live_code"
else
  echo ""; echo "=== Stories, phase 2 (Auto Live: Retell confirmed, consent in the branch)"
  check "the flag was flipped by the lead's own commit" "flag_flipped_by_lead"
  check "US-020a the mint route, schema, gate, the plan gate's words and the secrets spy test" "has '/api/voice/web-call' src/voice/routes.ts && all_exist src/voice/live/mint-schema.ts src/voice/live/mint.ts src/voice/live/live-start.ts src/voice/__tests__/live-secrets.test.ts src/voice/live/live-gate.ts src/voice/live/refusal.ts && has 'retell' src/voice/live/live-gate.ts && grep -qF \"Auto Live isn't available for this workspace. Ask your workspace owner.\" src/voice/strings.ts"
  check "US-020b Retell's LiveKit protocol, with contract fixtures" "all_exist src/voice/live/transport.ts src/voice/live/retell-protocol.ts src/voice/live/live-transcript.ts && has 'retell-ai-4ihahnq7\\.livekit\\.cloud' src/voice/config.ts && has 'agent_audio' src/voice/config.ts && has 'RETELL_SERVER_IDENTITY' src/voice/config.ts && fixtures_ok"
  check "US-020c Live in the one reducer" "grep -rq 'live_connected' src/voice/machine && grep -rq 'THINKING_AFTER_MS' src/voice/machine"
  check "US-020d LiveKit session: registerGlobals, the audio session, leave" "all_exist src/voice/live/livekit-session.ts src/voice/live/audio-config.ts src/voice/live/room-events.ts src/voice/live/use-live-call.ts && has 'registerGlobals' src/voice/live/livekit-session.ts && has 'setLogLevel' src/voice/live/livekit-session.ts && has 'startAudioSession' src/voice/live/livekit-session.ts && has 'stopAudioSession' src/voice/live/livekit-session.ts && has 'disconnect' src/voice/live/livekit-session.ts"
  check "US-020e the Live button, consent naming Retell" "all_exist src/voice/live/LiveButton.tsx src/voice/live/live-consent.ts && grep -qF 'Auto Live sends your voice to Retell' src/voice/strings.ts"
  check "only livekit-session.ts imports LiveKit (KV15)" "only_importer '@livekit/react-native|livekit-client' src/voice/live/livekit-session.ts"
fi

echo ""; echo "=== Contract (negative, added lines only)"
check "no WebView and no Retell browser SDK (D-NO-WEBVIEW)" "! added_code | grep -qE 'react-native-webview|WebView|retell-client-js-sdk'"
check "no fetch( outside the client (D-ONE-CLIENT)" "! added_code | grep -E '(^|[^.A-Za-z0-9_])fetch\\(' | grep -q ."
check "no colour literal (D-TOKENS)" "! added_code | grep -E \"['\\\"\\\`]#[0-9A-Fa-f]{3,8}['\\\"\\\`]|(rgba?|hsla?)\\(\" | grep -q ."
check "recognition never off the phone: no service package, no requiresOnDeviceRecognition false (KV4)" "! added_code | grep -qE 'androidRecognitionServicePackage|requiresOnDeviceRecognition: *false'"
check "audio is never saved (no recordingOptions, no audioSource) (KV4)" "! added_code | grep -qE 'recordingOptions|audioSource:'"
check "no background audio, foreground service or background task (KV11)" "! added_code | grep -qE 'FOREGROUND_SERVICE|UIBackgroundModes|foregroundService|staysActiveInBackground|TaskManager'"
check "no log, breadcrumb or toast line names the Live token or call id (privacy AC)" "! added_code | grep -E '(logger|console|Sentry|addBreadcrumb|captureException|captureMessage|toast|Toast|showToast)[.(]' | grep -qiE '(^|[^A-Za-z])(access_?token|call_?id)([^A-Za-z]|\$)'"
check "no planMode / missionMode (D30)" "! added_code | grep -qE 'planMode|missionMode'"
check "no pointer to creating an account (D-NO-SIGNUP)" "! added_code | grep -iE 'create (an|one|your) account|no account\\?' | grep -q ."
check "no sign-up copy in the voice strings (D-NO-SIGNUP)" "! git diff $BASE..HEAD -- src/voice/strings.ts | grep '^+' | grep -qiE '(^|[^a-z])sign[ -]?up([^a-z]|\$)'"
check "no 'nothing leaves your server' claims (KV18)" "! added_code | grep -iE 'nothing leaves|never leaves|no data (is )?sent|100% local|fully private|stays entirely on' | grep -q ."
check "no plans, credits or prices in the voice copy (D8)" "! git diff $BASE..HEAD -- src/voice/strings.ts | grep '^+' | grep -v '^+++' | grep -iE 'credits?|pricing|price|upgrade|subscription|business|(^|[^a-z])plans?([^a-z]|\$)|(^|[^a-z])tier' | grep -q ."
check "every commit is signed off (DCO)" "every_commit_signed"
check "new source files <= 800 lines" "file_sizes_ok"
warn  "story commits carry [skip ci] (all but each phase's CI commit)" "[ -z \"\$(git log --no-merges --format='%s' $BASE..HEAD^ | grep -v 'skip ci' | grep -v 'voice phase . built, run CI')\" ]"

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
if [ "$FAIL" -eq 0 ]; then echo "✅ PRD-001 voice acceptance (phase $PHASE, $MODE): PASS"; else echo "❌ PRD-001 voice acceptance (phase $PHASE, $MODE): FAIL"; fi
exit "$FAIL"
