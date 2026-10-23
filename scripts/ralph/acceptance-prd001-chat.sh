#!/bin/bash
# Acceptance gate — Automatos Go PRD-001 wave A2: Studio layout and chat (kit: chat).
#   bash scripts/ralph/acceptance-prd001-chat.sh               # full: local checks + the wave's one CI run
#   bash scripts/ralph/acceptance-prd001-chat.sh --no-ci       # local checks only (what a build session runs)
#   bash scripts/ralph/acceptance-prd001-chat.sh --print-base  # the diff base every check uses
#   GATE_BASE=<ref> overrides the base (smoke runs only).
# Base: the merge-base with origin/feat/a0-a1-foundation (this wave is stacked on the foundation), else the
# local feat/a0-a1-foundation, else origin/main. Local checks are pure Node and exactly what CI runs.
# KC1 is enforced as an ALLOWLIST of changed paths: the A3 Command Centre kit runs in parallel on the same
# foundation and the two must never touch the same file.
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

KIT=scripts/ralph/prd-001-chat.json
CI_JOBS=("typecheck · lint · test" "expo-doctor · iOS bundle")
# KC1: the only paths this wave may add or change.
ALLOWED='^(src/chat/|app/\(app\)/index\.tsx$|app/\(app\)/chat/|app/\(app\)/chats\.tsx$|scripts/ralph/(prd-001-chat\.json|PROMPT_build_prd001-chat\.md|PROMPT_review_prd001-chat\.md|acceptance-prd001-chat\.sh)$)'

added_code() { git diff "$BASE"..HEAD -- src app ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++'; }
added_files() { git diff --name-only --diff-filter=A "$BASE"..HEAD -- "$@"; }
has() { [ -f "$2" ] && grep -qE -e "$1" "$2"; }
all_exist() { local f; for f in "$@"; do [ -e "$f" ] || { echo "   missing: $f"; return 1; }; done; }
uses() { grep -rqE -e "$1" src/chat app/\(app\)/index.tsx app/\(app\)/chat 2>/dev/null; }   # uses <ERE>: anywhere in this wave's code
every_commit_signed() { [ -z "$(git log --no-merges --format='%H %(trailers:key=Signed-off-by,valueonly)' "$BASE"..HEAD | awk 'NF<2{print $1}')" ]; }
file_sizes_ok() { local f n bad=0; for f in $(added_files src app | grep -E '\.(ts|tsx)$'); do [ -f "$f" ] || continue; n=$(wc -l < "$f" | tr -d ' '); [ "$n" -le 800 ] || { echo "   $f: $n lines"; bad=1; }; done; [ $bad -eq 0 ]; }
npm_ok() { [ -f package.json ] || { echo "   no package.json in $(pwd) — refusing to run npm (it would climb to a parent)"; return 1; }; }
outside_kc1() { git diff --name-only "$BASE"..HEAD | grep -vE "$ALLOWED"; }

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
check "every route the app calls is in the pinned manifest (check:routes)" "npm_ok && npm run -s check:routes"

echo ""; echo "=== KC1: file-disjoint from the foundation and the A3 kit"
check "every changed path is inside KC1's list" "o=\$(outside_kc1); [ -z \"\$o\" ] || { echo \"\$o\" | sed 's/^/   outside KC1: /'; false; }"
check "package.json, package-lock.json, app.json, eas.json untouched (D-NATIVE-ONCE)" "git diff --quiet $BASE..HEAD -- package.json package-lock.json app.json eas.json"

echo ""; echo "=== Stories"
check "US-008a route table covers the chat endpoints" "has '/api/chat/\\{chat_id\\}/cancel' src/chat/routes.ts && has '/api/chat/history' src/chat/routes.ts && has '/api/attachments' src/chat/routes.ts && has '/api/missions' src/chat/routes.ts && has '/api/v1/approval-grants/\\{grant_id\\}/grant' src/chat/routes.ts && has '/api/v1/tasks/\\{task_id\\}/rebrief' src/chat/routes.ts"
check "US-008b controller: turnReducer, the stale-id check, Stop cancels on the server" "uses 'core/turn-reducer' && uses 'ensureLiveChatId' && grep -rq 'cancelTurn' src/chat/controller"
check "US-008b live refetch through the foundation's events" "uses 'useLiveEvent'"
check "US-008c/d/e thread and cards exist" "all_exist src/chat/components src/chat/view-model.ts src/chat/cards/MissionSuggestionCard.tsx src/chat/cards/PlanApprovalCard.tsx src/chat/cards/ToolApprovalCard.tsx src/chat/cards/TaskCard.tsx src/chat/cards/WithdrawOfferCard.tsx"
check "cards gate on the role (D16, D17)" "grep -rq 'roleCan' src/chat"
check "US-009a the thread opens with the AI label; nothing fences the composer (D73)" "has 'AiLabel' src/chat/components/MessageList.tsx && ! grep -rq 'useAiLabelVisible' src/chat && all_exist src/chat/composer/composer-state.ts"
check "US-008f home replaces the placeholder: the header's MenuButton + the server's needs-you (D73)" "grep -qE 'chat' 'app/(app)/index.tsx' && uses 'MenuButton' && uses 'useNeedsYou'"
check "US-008f/g/h routes exist" "all_exist 'app/(app)/chat/[id].tsx' 'app/(app)/chats.tsx'"
check "US-008h discussion sends the ticket selection and rebriefs" "uses 'discussionSelection' && uses 'proposedBrief|MAX_BRIEF_CHARS'"
check "US-009b HEIC converted with expo-image-manipulator" "grep -rq 'expo-image-manipulator' src/chat/attachments"
check "US-009c Report this uses the foundation's ReportSheet" "uses 'ReportSheet'"

echo ""; echo "=== Contract (negative, added lines only)"
check "no planMode / missionMode (D30)" "! added_code | grep -qE 'planMode|missionMode'"
check "no fetch( outside the client (D-ONE-CLIENT)" "! added_code | grep -E '(^|[^.A-Za-z0-9_])fetch\\(' | grep -q ."
check "no second report call, live connection or needs-you fetch" "! added_code | grep -qE '/api/v1/reports|tasks/stream|/api/activity/needs-you|expo/fetch'"
check "no WebView" "! added_code | grep -q 'react-native-webview'"
check "no colour literal (D-TOKENS)" "! added_code | grep -E \"['\\\"\\\`]#[0-9A-Fa-f]{3,8}['\\\"\\\`]|(rgba?|hsla?)\\(\" | grep -q ."
check "no plans, credits or prices in the copy (D8)" "! git diff $BASE..HEAD -- src/chat/strings.ts | grep '^+' | grep -qiE 'credits?|pricing|price|upgrade|subscription'"
check "every commit is signed off (DCO)" "every_commit_signed"
check "new source files <= 800 lines" "file_sizes_ok"
warn  "story commits carry [skip ci] (all but the final CI commit)" "[ -z \"\$(git log --format='%s' $BASE..HEAD^ | grep -v 'skip ci')\" ]"

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
if [ "$FAIL" -eq 0 ]; then echo "✅ PRD-001 chat acceptance ($MODE): PASS"; else echo "❌ PRD-001 chat acceptance ($MODE): FAIL"; fi
exit "$FAIL"
