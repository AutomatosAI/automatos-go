#!/bin/bash
# Acceptance gate — Automatos Go PRD-001 wave A1 (remaining): connect, bootstrap, roles, consent (kit: connect).
#   bash scripts/ralph/acceptance-prd001-connect.sh               # full: local checks + the wave's one CI run
#   bash scripts/ralph/acceptance-prd001-connect.sh --no-ci       # local checks only (what a build session runs)
#   bash scripts/ralph/acceptance-prd001-connect.sh --print-base  # the diff base every check uses
#   GATE_BASE=<ref> overrides the base (smoke runs only).
# Base: the merge-base with origin/feat/a0-a1-foundation (this wave is stacked on the foundation), else the
# local feat/a0-a1-foundation, else origin/main. Local checks are pure Node and exactly what CI runs.
# KC1/KC2 are enforced as an ALLOWLIST of changed paths: the A2 chat and A3 Command Centre kits may run in
# parallel on the same foundation and must never touch the same file; the named foundation files are this
# kit's by KC2 (each for one purpose, reviewed).
# No pipefail; each check in its own `( eval … )`; stdin closed. Negative checks read the wave's ADDED lines in
# product code, tests and the kit excluded; on the base they pass by construction, positives fail by design.
set -u
exec </dev/null
cd "$(dirname "$0")/../.." || exit 1
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin"   # appended: nvm's Node 22 (set by the launcher) must stay first

if [ -n "${GATE_BASE:-}" ]; then
  BASE=$(git rev-parse --verify -q "$GATE_BASE^{commit}") || { echo "GATE_BASE $GATE_BASE does not resolve"; exit 1; }
else
  BASE=$(git merge-base HEAD origin/feat/a0-a1-foundation 2>/dev/null || git merge-base HEAD feat/a0-a1-foundation 2>/dev/null || git merge-base HEAD origin/main) \
    || { echo "cannot resolve a merge-base with the foundation or origin/main"; exit 1; }
fi
MODE=full
case "${1:-}" in --print-base) echo "$BASE"; exit 0 ;; --no-ci) MODE=no-ci ;; "") ;; *) echo "unknown argument: $1"; exit 2 ;; esac
echo "base: $(git log -1 --format='%h %s' "$BASE") · HEAD: $(git log -1 --format='%h %s' HEAD) · mode: $MODE · node: $(node -v 2>/dev/null || echo MISSING)"
FAIL=0
check() { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ PASS: $name"; else echo "   ❌ FAIL: $name"; FAIL=1; fi; }
warn()  { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ ok: $name"; else echo "   ⚠️  WARN (not a failure): $name"; fi; }

KIT=scripts/ralph/prd-001-connect.json
CI_JOBS=("typecheck · lint · test" "expo-doctor · iOS bundle")
# KC1 (this kit's folders) + KC2 (the named foundation files, each for one purpose): the only paths this wave may add or change.
ALLOWED='^(src/connect/|src/consent/|src/session/|src/auth/providers/(device|registry)\.ts$|src/auth/AuthRoot\.tsx$|src/auth/__tests__/|src/api/(server|discovery|errors|client|workspace)\.ts$|src/api/__tests__/|src/app-state/|src/navigation/(routes|web-links)\.ts$|src/navigation/__tests__/|app/_layout\.tsx$|app/\(app\)/_layout\.tsx$|app/\(app\)/settings/index\.tsx$|app/welcome\.tsx$|app/connect/|app/go/|scripts/ralph/(prd-001-connect\.json|PROMPT_build_prd001-connect\.md|PROMPT_review_prd001-connect\.md|acceptance-prd001-connect\.sh)$)'
# Foundation test folders KC2 lets this wave update (never delete, never fewer cases).
FOUNDATION_TESTS="src/auth/__tests__ src/api/__tests__ src/app-state/__tests__ src/navigation/__tests__"
WAVE_DIRS="src/connect src/consent src/session app/connect app/go"

added_code() { git diff "$BASE"..HEAD -- src app ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++'; }
added_files() { git diff --name-only --diff-filter=A "$BASE"..HEAD -- "$@"; }
has() { [ -f "$2" ] && grep -qE -e "$1" "$2"; }
all_exist() { local f; for f in "$@"; do [ -e "$f" ] || { echo "   missing: $f"; return 1; }; done; }
every_commit_signed() { [ -z "$(git log --no-merges --format='%H %(trailers:key=Signed-off-by,valueonly)' "$BASE"..HEAD | awk 'NF<2{print $1}')" ]; }
file_sizes_ok() { local f n bad=0; for f in $(added_files src app | grep -E '\.(ts|tsx)$'); do [ -f "$f" ] || continue; n=$(wc -l < "$f" | tr -d ' '); [ "$n" -le 800 ] || { echo "   $f: $n lines"; bad=1; }; done; [ $bad -eq 0 ]; }
npm_ok() { [ -f package.json ] || { echo "   no package.json in $(pwd) — refusing to run npm (it would climb to a parent)"; return 1; }; }
outside_kc() { git diff --name-only "$BASE"..HEAD | grep -vE "$ALLOWED"; }
base_dep() { git show "$BASE:package.json" 2>/dev/null | jq -e --arg p "$1" '.dependencies[$p] != null' >/dev/null; }
# The global secrets hook's patterns (~/.claude/hooks/block-secrets.sh), applied to every path the wave changed.
hook_blocked() { local p; while IFS= read -r p; do [ -n "$p" ] || continue; case "/$p" in
  *.env|*.env.*|*/credentials*|*/secrets/*|*/secret/*|*.pem|*.key|*_rsa|*_rsa.pub|*/service-account*.json|*/sa-key*.json) echo "   $p" ;; esac; done; }
# A foundation test file may be updated, never deleted and never left with fewer cases.
foundation_tests_kept() {
  local f bad=0 before after
  [ -z "$(git diff --name-only --diff-filter=D "$BASE"..HEAD -- $FOUNDATION_TESTS)" ] || { git diff --name-only --diff-filter=D "$BASE"..HEAD -- $FOUNDATION_TESTS | sed 's/^/   deleted: /'; return 1; }
  for f in $(git diff --name-only --diff-filter=M "$BASE"..HEAD -- $FOUNDATION_TESTS); do
    before=$(git show "$BASE:$f" 2>/dev/null | grep -cE '(^|[^A-Za-z0-9_.])(it|test)(\.each\([^)]*\))?\(')
    after=$(grep -cE '(^|[^A-Za-z0-9_.])(it|test)(\.each\([^)]*\))?\(' "$f")
    [ "$after" -ge "$before" ] || { echo "   $f: $before → $after cases"; bad=1; }
  done
  [ $bad -eq 0 ]
}
# This wave's user-facing copy: added lines of its strings modules and screens, comment lines dropped.
added_copy() { git diff "$BASE"..HEAD -- src/connect src/consent src/session app/welcome.tsx app/connect app/go ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++' | grep -vE '^\+[[:space:]]*(//|\*|/\*)'; }
# Only the two named modules import expo-secure-store among this wave's own files (KC9).
securestore_scoped() {
  local hits; hits=$(grep -rlE "from ['\"]expo-secure-store['\"]|require\(['\"]expo-secure-store['\"]\)" $WAVE_DIRS app/welcome.tsx src/auth/providers/device.ts 2>/dev/null \
    | grep -v '__tests__' | grep -vE '^src/connect/(device-store|install-id)\.ts$')
  [ -z "$hits" ] || { echo "$hits" | sed 's/^/   imports expo-secure-store: /'; return 1; }
}

echo ""; echo "=== Kit"
check "kit JSON valid; every story passes:true" "jq -e '[.userStories[] | select(.passes != true)] | length == 0' $KIT >/dev/null"
check "every acceptance criterion carries a DONE mark" "jq -e '[.userStories[].acceptanceCriteria[] | select(contains(\"→ DONE\") | not)] | length == 0' $KIT >/dev/null"

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
check "every route the app calls is in the pinned manifest or pendingUpstream (check:routes)" "npm_ok && npm run -s check:routes"

echo ""; echo "=== KC1/KC2: file-disjoint from the A2 and A3 kits; foundation edits only where named"
check "every changed path is inside KC1/KC2's list" "o=\$(outside_kc); [ -z \"\$o\" ] || { echo \"\$o\" | sed 's/^/   outside KC1\/KC2: /'; false; }"
check "package.json, package-lock.json, app.json, eas.json untouched (D-NATIVE-ONCE)" "git diff --quiet $BASE..HEAD -- package.json package-lock.json app.json eas.json"
check "the base carries the native modules this wave uses (expo-camera, expo-secure-store, expo-crypto, expo-constants, expo-linking)" "m=0; for p in expo-camera expo-secure-store expo-crypto expo-constants expo-linking; do base_dep \$p || { echo \"   not a dependency on the base: \$p\"; m=1; }; done; [ \$m -eq 0 ]"
check "foundation tests updated, never deleted, never fewer cases (KC2)" "foundation_tests_kept"
check "no changed path matches the secrets hook's patterns" "b=\$(git diff --name-only $BASE..HEAD | hook_blocked); [ -z \"\$b\" ] || { echo \"\$b\"; false; }"

echo ""; echo "=== Stories"
check "US-006a address, link and code parsers; the server's alphabet" "all_exist src/connect/address.ts src/connect/pair-link.ts src/connect/pair-code.ts src/connect/config.ts && has 'isPrivateHost' src/connect/address.ts && grep -rq 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' src/connect && has '/go/pair' src/connect/config.ts"
check "US-006b route table: pair, rotate, DELETE device, each pendingUpstream" "has '/api/v1/mobile/pair' src/connect/routes.ts && has '/api/v1/mobile/devices/\\{device_id\\}/rotate' src/connect/routes.ts && has 'DELETE' src/connect/routes.ts && has 'pendingUpstream' src/connect/routes.ts"
check "US-006b install id from expo-crypto; pair through the foundation client" "has 'expo-crypto' src/connect/install-id.ts && has 'createApiClient' src/connect/api.ts"
check "US-006c device provider registered; the record in SecureStore, this device only; never in MMKV" "all_exist src/auth/providers/device.ts src/connect/device-store.ts src/connect/expiry.ts && has 'device' src/auth/providers/registry.ts && has 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY' src/connect/device-store.ts && has 'device_revoked' src/connect/expiry.ts && all_exist src/connect/install-marker.ts && ! grep -qE 'storage/mmkv|react-native-mmkv' src/connect/device-store.ts"
check "US-006d own server and the gate's new steps" "has \"[^A-Za-z]own[^A-Za-z]\" src/api/server.ts && all_exist src/connect/current-server.ts src/connect/switch.ts && grep -rq 'welcome' src/app-state && grep -rq 'not_running' src/app-state"
check "US-006e the step machine and nextStepFor" "all_exist src/connect/flow.ts src/connect/next-step.ts src/connect/use-connect.ts && has 'nextStepFor' src/connect/next-step.ts"
check "US-006f Welcome and Connect screens" "all_exist app/welcome.tsx app/connect/_layout.tsx app/connect/index.tsx src/connect/screens/WelcomeScreen.tsx src/connect/screens/ConnectScreen.tsx src/connect/screens/ConfirmCard.tsx"
check "US-006g scanner on expo-camera (QR only) and the /go/pair route" "all_exist app/connect/scan.tsx app/go/pair.tsx && grep -rq 'CameraView' src/connect/scanner && grep -rqE \"barcodeTypes\" src/connect/scanner"
check "US-006h the unencrypted banner in the shell; Not running; the server on Account" "has 'InsecureNetworkBanner' 'app/(app)/_layout.tsx' && all_exist src/connect/components/NotRunning.tsx src/connect/components/ServerSection.tsx && has 'ServerSection' 'app/(app)/settings/index.tsx'"
check "US-007a role freshness and bootstrap refusals" "all_exist src/session/role-refresh.ts src/session/use-session-refresh.ts src/session/bootstrap-refusal.ts && has 'useSessionRefresh|use-session-refresh' 'app/(app)/_layout.tsx'"
check "US-007b providers, policy and the consent record" "all_exist src/consent/providers.ts src/consent/policy.ts src/consent/store.ts && grep -rq 'ai_providers' src/consent src/api/workspace.ts"
check "US-007c the consent step in the gate; the sheet shows the AI label" "grep -rq 'consent' src/app-state && has 'AiLabel' src/consent/ConsentSheet.tsx"
check "US-006i rotation and Remove this phone" "all_exist src/connect/rotation.ts src/connect/remove-device.ts && has 'rotate' src/connect/rotation.ts"

echo ""; echo "=== Contract (negative, added lines only)"
check "no fetch( outside the client (D-ONE-CLIENT)" "! added_code | grep -E '(^|[^.A-Za-z0-9_])fetch\\(' | grep -q ."
check "no expo/fetch or XMLHttpRequest outside the foundation's transport" "! added_code | grep -qE 'expo/fetch|XMLHttpRequest'"
check "no WebView" "! added_code | grep -q 'react-native-webview'"
check "no colour literal (D-TOKENS)" "! added_code | grep -E \"['\\\"\\\`]#[0-9A-Fa-f]{3,8}['\\\"\\\`]|(rgba?|hsla?)\\(\" | grep -q ."
check "no token, pairing code or pairing link handed to a log (KC9)" "! added_code | grep -E '(console|logger)\\.[A-Za-z]+\\(' | grep -qE '\\.token([^A-Za-z0-9_]|\$)|[(,][[:space:]]*token[[:space:]]*[,)]|\\{[[:space:]]*token([^A-Za-z0-9_]|\$)|amd_|pairCode|pairLink|qr_payload'"
check "expo-secure-store only in device-store.ts and install-id.ts (KC9)" "securestore_scoped"
check "no plans, credits or prices in this wave's copy (D8)" "! git diff $BASE..HEAD -- src/connect/strings.ts src/consent/strings.ts src/session/strings.ts | grep '^+' | grep -qiE 'credits?|pricing|price|upgrade|subscription'"
check "no pointer to creating an account (D-SIGNIN)" "! added_copy | grep -qiE 'create (an |your |a new )?account|sign[ -]?up|no account\\?|get an account|register (an )?account'"
check "no claim broader than KC16's data note (nothing leaves your server …)" "! added_copy | grep -iE 'nothing (ever )?leaves|never leaves|no data (ever )?(leaves|is sent)|100% (local|private)|fully (local|private|offline)|completely private|stays? (entirely |completely |only )?(on|in|with) your (server|install|network|phone)' | grep -viE 'chats, files and reports' | grep -q ."
check "no account or workspace deletion (D63)" "! added_code | grep -qiE 'delete (your )?(account|workspace)|/api/workspaces/[^\"]*delete|DELETE /api/workspaces'"
check "every commit is signed off (DCO)" "every_commit_signed"
check "new source files <= 800 lines" "file_sizes_ok"
warn  "story commits carry [skip ci] (all but the final CI commit)" "[ -z \"\$(git log --format='%s' $BASE..HEAD^ | grep -v 'skip ci')\" ]"
warn  "pendingUpstream routes still waiting for the re-pin (KC3; drop them after W1 merges)" "p=\$(grep -n 'pendingUpstream' src/connect/routes.ts 2>/dev/null); [ -z \"\$p\" ] || { echo \"\$p\" | sed 's/^/   /'; false; }"

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
  echo ""; echo "=== CI (once per wave)"
  check "CI: both ci.yml jobs and malware-scan green on the tested commit" "ci_green_on_head"
fi
echo ""
if [ "$FAIL" -eq 0 ]; then echo "✅ PRD-001 connect acceptance ($MODE): PASS"; else echo "❌ PRD-001 connect acceptance ($MODE): FAIL"; fi
exit "$FAIL"
