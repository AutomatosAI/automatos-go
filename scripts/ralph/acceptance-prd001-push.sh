#!/bin/bash
# Acceptance gate — Automatos Go PRD-001 wave A4: Push (kit: push).
#   bash scripts/ralph/acceptance-prd001-push.sh                # full: local checks + the phase's one CI run
#   bash scripts/ralph/acceptance-prd001-push.sh --no-ci        # local checks only (what a build session runs)
#   bash scripts/ralph/acceptance-prd001-push.sh --print-base   # the diff base every check uses
#   bash scripts/ralph/acceptance-prd001-push.sh --print-phase  # 1, or 2 once A1 + A2 + A3 are in this branch (KP3)
#   GATE_BASE=<ref> overrides the base (smoke runs only).
# Phase: 2 when HEAD carries the connect kit's src/connect/routes.ts, A2's src/chat/routes.ts AND A3's
# src/cc/routes.ts (the base move merged them in), else 1. Base: phase 1 → the merge-base with
# origin/feat/a0-a1-foundation (stacked on the foundation, like the chat, cc, connect and styles kits); phase 2 →
# the merge-base with the first of origin/main / the foundation branch whose merge-base already carries A1, A2 and
# A3 (so their own changes never read as this wave's: the gate-base trap). Local checks are pure Node and exactly
# what CI runs.
# KP1 is an ALLOWLIST of changed paths per phase: phase 1 runs beside the A1 connect, A2 chat, A3 Command Centre
# and A5 styles kits and must never touch a file any of them owns or edits.
# No pipefail; each check in its own `( eval … )`; stdin closed. Negative checks read the wave's ADDED lines in
# product code (tests and the kit excluded); on the base they pass by construction, positives fail by design.
set -u
exec </dev/null
cd "$(dirname "$0")/../.." || exit 1
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin"   # appended: nvm's Node 22 (set by the launcher) must stay first

FOUNDATION_REF=origin/feat/a0-a1-foundation
a1_a2_a3_in() {
  git cat-file -e "$1:src/connect/routes.ts" 2>/dev/null && git cat-file -e "$1:src/chat/routes.ts" 2>/dev/null \
    && git cat-file -e "$1:src/cc/routes.ts" 2>/dev/null
}
if a1_a2_a3_in HEAD; then PHASE=2; else PHASE=1; fi
case "${1:-}" in --print-phase) echo "$PHASE"; exit 0 ;; esac

phase2_base() {
  local ref mb
  for ref in origin/main "$FOUNDATION_REF" feat/a0-a1-foundation main; do
    git rev-parse -q --verify "$ref^{commit}" >/dev/null || continue
    mb=$(git merge-base HEAD "$ref" 2>/dev/null) || continue
    if a1_a2_a3_in "$mb"; then echo "$mb"; return 0; fi
  done
  return 1
}
if [ -n "${GATE_BASE:-}" ]; then
  BASE=$(git rev-parse --verify -q "$GATE_BASE^{commit}") || { echo "GATE_BASE $GATE_BASE does not resolve"; exit 1; }
elif [ "$PHASE" = 2 ]; then
  BASE=$(phase2_base) || { echo "phase 2: no merged ref (origin/main, $FOUNDATION_REF) carries A1, A2 and A3 — the base move merges one into this branch"; exit 1; }
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

KIT=scripts/ralph/prd-001-push.json
CI_JOBS=("typecheck · lint · test" "expo-doctor · iOS bundle")
# KP1: the only paths this wave may add or change, per phase.
P1_ALLOWED='^(src/push/|src/step-up/|app/\(app\)/settings/notifications\.tsx$|scripts/ralph/(prd-001-push\.json|PROMPT_build_prd001-push\.md|PROMPT_review_prd001-push\.md|acceptance-prd001-push\.sh)$)'
# Phase 2 adds the shell files (US-014h), two connect files (US-014i) and A2's / A3's write sites and tests (US-015e).
P2_EXTRA='^(app/\(app\)/_layout\.tsx$|app/\(app\)/settings/index\.tsx$|src/lib/secure-keys\.ts$|src/connect/components/ServerSection\.tsx$|src/connect/switch\.ts$|src/chat/cards/|src/cc/(questions|ticket|social)/|src/chat/__tests__/|src/cc/__tests__/)'
# KP2: edits of these need a 'SEAM EDIT: <path>' line in the kit's DONE notes (the A2/A3 test folders are checked for kept cases instead).
SEAMS='^(app/\(app\)/_layout\.tsx|app/\(app\)/settings/index\.tsx|src/lib/secure-keys\.ts|src/connect/components/ServerSection\.tsx|src/connect/switch\.ts)$|^(src/chat/cards/|src/cc/(questions|ticket|social)/)'
OTHER_TESTS="src/chat/__tests__ src/cc/__tests__ src/connect/__tests__"
WAVE_DIRS="src/push src/step-up"
NATIVE_DEPS="expo-notifications expo-local-authentication expo-secure-store expo-crypto expo-localization expo-constants expo-linking"

added_code() { git diff "$BASE"..HEAD -- src app ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++'; }
added_files() { git diff --name-only --diff-filter=A "$BASE"..HEAD -- "$@"; }
# This wave's user-facing copy: added lines of its modules and screens, comment lines dropped.
added_copy() { git diff "$BASE"..HEAD -- src/push src/step-up 'app/(app)/settings' ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' ':!*__fixtures__*' | grep '^+' | grep -v '^+++' | grep -vE '^\+[[:space:]]*(//|\*|/\*)'; }
has() { [ -f "$2" ] && grep -qE -e "$1" "$2"; }
all_exist() { local f; for f in "$@"; do [ -e "$f" ] || { echo "   missing: $f"; return 1; }; done; }
every_commit_signed() { [ -z "$(git log --no-merges --format='%H %(trailers:key=Signed-off-by,valueonly)' "$BASE"..HEAD | awk 'NF<2{print $1}')" ]; }
file_sizes_ok() { local f n bad=0; for f in $(added_files src app | grep -E '\.(ts|tsx)$'); do [ -f "$f" ] || continue; n=$(wc -l < "$f" | tr -d ' '); [ "$n" -le 800 ] || { echo "   $f: $n lines"; bad=1; }; done; [ $bad -eq 0 ]; }
npm_ok() { [ -f package.json ] || { echo "   no package.json in $(pwd) — refusing to run npm (it would climb to a parent)"; return 1; }; }
base_dep() { git show "$BASE:package.json" 2>/dev/null | jq -e --arg p "$1" '.dependencies[$p] != null' >/dev/null; }
outside_kp1() {
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
# Another kit's test file may be extended, never deleted and never left with fewer cases (KP2).
other_tests_kept() {
  local f bad=0 before after
  [ -z "$(git diff --name-only --diff-filter=D "$BASE"..HEAD -- $OTHER_TESTS)" ] || { git diff --name-only --diff-filter=D "$BASE"..HEAD -- $OTHER_TESTS | sed 's/^/   deleted: /'; return 1; }
  for f in $(git diff --name-only --diff-filter=M "$BASE"..HEAD -- $OTHER_TESTS); do
    before=$(git show "$BASE:$f" 2>/dev/null | grep -cE '(^|[^A-Za-z0-9_.])(it|test)(\.each\([^)]*\))?\(')
    after=$(grep -cE '(^|[^A-Za-z0-9_.])(it|test)(\.each\([^)]*\))?\(' "$f")
    [ "$after" -ge "$before" ] || { echo "   $f: $before → $after cases"; bad=1; }
  done
  [ $bad -eq 0 ]
}
# The global secrets hook's patterns (~/.claude/hooks/block-secrets.sh), applied to every path the wave changed
# and every path the kit tells the builder to write.
hook_blocked() { local p; while IFS= read -r p; do [ -n "$p" ] || continue; case "/$p" in
  *.env|*.env.*|*/credentials*|*/secrets/*|*/secret/*|*.pem|*.key|*_rsa*|*/service-account*.json|*/sa-key*.json) echo "   $p" ;; esac; done; }
kit_paths() { jq -r '.userStories[].files[]' "$KIT"; git diff --name-only "$BASE"..HEAD; }
# A module (non-test) of the wave that imports $1; prints offenders other than the allowed files ($2: ERE).
imports_only_in() {
  local hits; hits=$(grep -rlE "from ['\"]$1['\"]|require\(['\"]$1['\"]\)" $WAVE_DIRS 'app/(app)/settings/notifications.tsx' 2>/dev/null \
    | grep -v '__tests__' | grep -vE "$2")
  [ -z "$hits" ] || { echo "$hits" | sed "s|^|   imports $1: |"; return 1; }
}
names_only_in() {
  local hits; hits=$(grep -rlE "$1" $WAVE_DIRS 2>/dev/null | grep -v '__tests__' | grep -vE "$2")
  [ -z "$hits" ] || { echo "$hits" | sed "s|^|   names $1: |"; return 1; }
}
mmkv_holds_no_key() {
  local f bad=0
  for f in $(grep -rlE "storage/mmkv" $WAVE_DIRS 2>/dev/null | grep -v '__tests__'); do
    grep -qE 'pushKey|push_key|expoToken|expo_push_token' "$f" && { echo "   $f imports MMKV and names a push secret"; bad=1; }
  done
  [ $bad -eq 0 ]
}
# Signature v2 (KP6 = W2 K9): the five published sigs are verified by the app's test (no second vector file).
V2_SIGS="ebbf977c0e83aefa57f52a0559c6907b31be5ebb44112450b8b88c248f4080fa 800c8568838c16721faf7e738b7d715f0730c3c7d5cefb9941ab76ba69e293d3 5f11674af935f0ab0a912494ca6502750354541c774c667934922177df07dc88 3e947349177d6ee98138bb05cc14112069522d3ba2c042d8f67ac18b22b02aa5 e0e3a50468bb5e8de2a97706037d82110e07d92d8f8dbb0cdca0de8e01442136"
vectors_ok() {
  local t=src/push/__tests__/signature.test.ts s
  [ -f "$t" ] || { echo "   missing $t"; return 1; }
  for s in $V2_SIGS; do grep -q "$s" "$t" || { echo "   $t lacks the published v2 case $s"; return 1; }; done
  [ -z "$(find src/push -name 'signature-vectors.contract.json' 2>/dev/null)" ] || { echo "   a second vector file exists (ONE shared file: W2's)"; return 1; }
  grep -rq 'PUSH_SIG_MAX_AGE_SECONDS' src/push && grep -rq 'PUSH_SIG_MAX_FUTURE_SECONDS' src/push || { echo "   the freshness window constants are missing"; return 1; }
  grep -q '604800' src/push/config.ts 2>/dev/null && grep -q '300' src/push/config.ts 2>/dev/null || { echo "   src/push/config.ts lacks the 604800 / 300 window"; return 1; }
}
w2_fixture_state() {
  local f=src/push/__fixtures__/prd266_push_signature_vectors.json
  if [ -f "$f" ]; then
    grep -q 'prd266_push_signature_vectors' src/push/__fixtures__/SOURCES.md 2>/dev/null || { echo "   $f without its SOURCES.md line"; return 1; }
    jq -e '.schema == "automatos-push-signature-vectors/v2"' "$f" >/dev/null 2>&1 || { echo "   $f is not the v2 vector file"; return 1; }
    return 0
  fi
  jq -e '[.userStories[].acceptanceCriteria[] | select(contains("[W2-PENDING-OK]") and endswith("(OT-P2)"))] | length > 0' "$KIT" >/dev/null \
    && { echo "   W2's fixture not copied yet (OWNER-marked): OT-P2"; return 1; }
  return 0
}

echo ""; echo "=== Kit (phase $PHASE)"
check "kit JSON valid; every story of phase <= $PHASE passes:true" "jq -e --argjson p $PHASE '[.userStories[] | select((.phase // 1) <= \$p) | select(.passes != true)] | length == 0' $KIT >/dev/null"
check "every acceptance criterion of phase <= $PHASE carries a DONE mark (or OWNER where [W2-PENDING-OK])" "jq -e --argjson p $PHASE '[.userStories[] | select((.phase // 1) <= \$p) | .acceptanceCriteria[] | select((contains(\"→ DONE\") or (contains(\"[W2-PENDING-OK]\") and endswith(\"(OT-P2)\") and contains(\"→ OWNER: \"))) | not)] | length == 0' $KIT >/dev/null"
warn  "W2's shared signature vector is in the app (else OT-P2)" "w2_fixture_state"

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

echo ""; echo "=== KP1/KP2: the wave's files (phase $PHASE)"
check "every changed path is inside KP1's list for phase $PHASE" "o=\$(outside_kp1); [ -z \"\$o\" ] || { echo \"\$o\" | sed 's/^/   outside KP1: /'; false; }"
check "package.json, package-lock.json, app.json, eas.json untouched (D-NATIVE-ONCE)" "git diff --quiet $BASE..HEAD -- package.json package-lock.json app.json eas.json"
check "the base carries every native module this wave uses" "m=0; for p in $NATIVE_DEPS; do base_dep \$p || { echo \"   not a dependency on the base: \$p\"; m=1; }; done; [ \$m -eq 0 ]"
check "the AI label, src/core, src/api, src/auth, src/ui, src/styles and src/navigation untouched (D-AI-LABEL, KP2, KP4)" "git diff --quiet $BASE..HEAD -- src/styles src/core src/api src/auth src/ui src/navigation src/storage src/app-state"
check "every seam file edit is recorded as 'SEAM EDIT: <path>' (KP2)" "seam_notes_ok"
check "another kit's tests are kept: none deleted, none with fewer cases (KP2)" "other_tests_kept"
check "no path the wave writes or the kit names matches the secrets hook" "o=\$(kit_paths | sort -u | hook_blocked); [ -z \"\$o\" ] || { echo \"\$o\"; false; }"

echo ""; echo "=== Stories, phase 1"
check "US-014a route table: W1's device routes, preferences, push settings, answer, mark read, the stale checks" "for p in '/api/v1/mobile/devices' '/api/v1/mobile/devices/\\{device_id\\}' '/api/v1/mobile/push-settings' '/api/notification-preferences' '/api/notifications/\\{notification_id\\}/read' '/api/v1/approval-grants/\\{grant_id\\}/answer' '/api/v1/tasks/\\{task_id\\}' '/api/socials/posts/\\{post_id\\}' '/api/chat/\\{chat_id\\}'; do has \"\$p\" src/push/routes.ts || { echo \"   missing \$p\"; exit 1; }; done; has 'pendingUpstream' src/push/routes.ts"
check "US-014a schemas and API over the foundation client" "all_exist src/push/schemas/payload.ts src/push/schemas/server.ts src/push/api.ts src/push/query-keys.ts && grep -rq 'zod' src/push/schemas"
check "US-015a signature v2: utf8, hmac, canonical, verify; the five published cases; the freshness window; no second vector file" "all_exist src/push/signature/utf8.ts src/push/signature/hmac.ts src/push/signature/canonical.ts src/push/signature/verify.ts src/push/signature/sha256-native.ts && vectors_ok"
check "US-015a expo-crypto only in sha256-native.ts" "imports_only_in expo-crypto '^src/push/signature/sha256-native\\.ts\$'"
check "US-015b reading a notification: parse, intent, dedupe" "all_exist src/push/inbound/parse.ts src/push/inbound/intent.ts src/push/inbound/dedupe.ts && has 'unverified' src/push/inbound/intent.ts && has 'reply' src/push/inbound/intent.ts"
check "US-015c deep links over the foundation's route builders" "all_exist src/push/links/targets.ts src/push/links/stale.ts && grep -rqE 'navigation/routes' src/push/links"
check "US-014b the five categories W2 names, Reply needs an unlocked phone" "for c in automatos.question.0 automatos.question.1 automatos.question.2 automatos.question.3 automatos.open; do has \"\$c\" src/push/platform/categories.ts || { echo \"   missing \$c\"; exit 1; }; done; has 'isAuthenticationRequired: *true' src/push/platform/categories.ts"
check "US-014b the three Android channels, PRIVATE" "for c in questions review auto PRIVATE; do has \"\$c\" src/push/platform/channels.ts || { echo \"   missing \$c\"; exit 1; }; done"
check "US-014b expo-notifications only in src/push/platform/expo.ts" "imports_only_in expo-notifications '^src/push/platform/expo\\.ts\$'"
check "US-014c registration: state, permission, device facts, key store, register" "all_exist src/push/registration/state.ts src/push/registration/permission.ts src/push/registration/device-facts.ts src/push/registration/key-store.ts src/push/registration/register.ts && has 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY' src/push/registration/key-store.ts"
check "US-014c the key store and its tests: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY asserted with a fake SecureStore" "all_exist src/push/__tests__/key-store.test.ts && grep -q 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY' src/push/__tests__/key-store.test.ts"
if [ "$PHASE" = 2 ]; then
  check "US-014c/US-014h the push key is declared in the ONE secure-storage key registry (KP18)" "grep -q 'secure-keys' src/push/registration/key-store.ts || grep -qE 'push' src/lib/secure-keys.ts"
else
  warn  "US-014c the push key writes through the ONE secure-storage key registry (else a FOUNDATION GAP for US-014h)" "grep -q 'secure-keys' src/push/registration/key-store.ts || jq -r '.userStories[].notes' $KIT | grep -q 'FOUNDATION GAP: secure-keys'"
fi
check "US-014c expo-secure-store only in key-store.ts (KP18)" "imports_only_in expo-secure-store '^src/push/registration/key-store\\.ts\$'"
check "US-014c the permission is requested from one module only (KP11)" "names_only_in 'requestPermissionsAsync' '^src/push/(platform/expo|registration/permission)\\.ts\$'"
check "US-014d preferences, digest, redact" "all_exist src/push/settings/prefs.ts src/push/settings/digest.ts src/push/settings/redact.ts && has 'daily_digest' src/push/settings/prefs.ts && has '07:00' src/push/settings/digest.ts && has '09:00' src/push/settings/digest.ts"
check "US-014e step-up: expo-local-authentication only in src/step-up/step-up.ts" "all_exist src/step-up/policy.ts src/step-up/setting-store.ts src/step-up/step-up.ts src/step-up/use-step-up.ts && imports_only_in expo-local-authentication '^src/step-up/step-up\\.ts\$'"
check "US-014f the Notifications screen and the wave's own path" "all_exist 'app/(app)/settings/notifications.tsx' src/push/settings/NotificationsScreen.tsx src/push/nav.ts && has '/settings/notifications' src/push/nav.ts && grep -q 'NotificationsScreen' 'app/(app)/settings/notifications.tsx'"
check "US-015d/US-014g the logger-spy tests exist (no payload text in a log)" "all_exist src/push/__tests__/handler-logging.test.ts src/push/__tests__/receive-logging.test.ts"
check "US-015d the action handler: cold start and warm taps, handled once" "all_exist src/push/inbound/handler.ts src/push/inbound/use-notification-responses.ts && grep -rq 'getLastNotificationResponse' src/push/inbound src/push/platform && grep -rq 'clearLastNotificationResponse' src/push/inbound src/push/platform"
check "US-014g PushRoot, the badge from useNeedsYou, the prompt policy, teardown" "all_exist src/push/PushRoot.tsx src/push/session.ts src/push/badge.ts src/push/prompt/policy.ts src/push/teardown.ts && has 'useNeedsYou' src/push/badge.ts && has 'setBadgeCount' src/push/badge.ts"

if [ "$PHASE" = 2 ]; then
  echo ""; echo "=== Stories, phase 2 (A1 + A2 + A3 in the branch)"
  check "US-014h PushRoot mounted once in the shell; the session from the connect kit" "[ \"\$(grep -c '<PushRoot' 'app/(app)/_layout.tsx')\" = 1 ] && all_exist src/push/bind/session.ts && grep -rq 'connect/install-id' src/push/bind"
  check "US-014h the Notifications row and Remove this phone on Account" "grep -qE 'pushScreens|settings/notifications' 'app/(app)/settings/index.tsx' && grep -rq 'Remove this phone' src/push/strings.ts"
  check "US-014i sign-out revokes the row first; forget clears push; the flows are tested with a fake SecureStore" "grep -q 'pushSignOut' src/connect/components/ServerSection.tsx && grep -q 'teardownLocal' src/connect/switch.ts && all_exist src/push/__tests__/teardown-flows.test.ts"
  check "US-015e A2's and A3's gated writes go through src/step-up" "all_exist src/push/__tests__/step-up-wiring.test.ts && grep -rlq 'step-up' src/chat/cards && grep -rlq 'step-up' src/cc"
fi

echo ""; echo "=== Contract (negative, added lines only)"
check "no WebView (D-NO-WEBVIEW)" "! added_code | grep -q 'react-native-webview'"
check "no fetch( outside the client (D-ONE-CLIENT)" "! added_code | grep -E '(^|[^.A-Za-z0-9_])fetch\\(' | grep -q ."
check "no colour literal (D-SHAPE)" "! added_code | grep -E \"['\\\"\\\`]#[0-9A-Fa-f]{3,8}['\\\"\\\`]|(rgba?|hsla?)\\(\" | grep -q ."
check "no local notification: the server's title and AI badge are shown as sent (D-AI-LABEL)" "! added_code | grep -qE 'scheduleNotificationAsync|presentNotificationAsync'"
check "no background notification task in v1 (KP19)" "! added_code | grep -q 'registerTaskAsync'"
check "every action opens the app; no Approve or option action on a notification (KP7, D18, D45)" "! added_code | grep -qE 'opensAppToForeground: *false' && ! grep -qE \"identifier: *['\\\"](approve|option)\" src/push/platform/categories.ts"
check "no AsyncStorage (KP18)" "! added_code | grep -q 'AsyncStorage'"
check "MMKV never holds a push key or token (KP18)" "mmkv_holds_no_key"
check "no log line names a push key, token, sig, reply or answer text (D-WRITES)" "! added_code | grep -E '(logger|console)\\.' | grep -qiE 'pushKey|push_key|expoToken|expo_push_token|ExponentPushToken|userText|answerText|answer_text|\\.sig\\b'"
check "nothing in the wave talks to Sentry or adds a breadcrumb (D-WRITES)" "! added_code | grep -qE \"@sentry/react-native|addBreadcrumb\""
check "no planMode / missionMode (D30)" "! added_code | grep -qE 'planMode|missionMode'"
check "no pointer to creating an account (D-NO-SIGNUP)" "! added_copy | grep -qiE 'create (an |your |a new )?account|sign[ -]?up|no account\\?|get an account|register (an )?account'"
check "no claim broader than the data rule (D-DATA-CLAIMS)" "! added_copy | grep -iE 'nothing (ever )?leaves|never leaves|no data (ever )?(leaves|is sent)|100% (local|private)|fully (local|private|offline)|completely private|stays? (entirely |completely |only )?(on|in|with) your (server|install|network|phone)' | grep -q ."
check "no plans, credits or prices in the copy (D-NO-BILLING)" "! added_copy | grep -qiE 'credits?|pricing|price|upgrade|subscription'"
check "no 'resuming' claim the answer route cannot back (KP8)" "! added_copy | grep -qiE 'resuming|resumed'"
check "no account or workspace deletion (D-NO-DELETE)" "! added_code | grep -qiE 'delete (your )?(account|workspace)|/api/workspaces/[^\"]*delete'"
check "every commit is signed off (DCO)" "every_commit_signed"
check "new source files <= 800 lines" "file_sizes_ok"
warn  "story commits carry [skip ci] (all but each phase's CI commit)" "[ -z \"\$(git log --no-merges --format='%s' $BASE..HEAD^ | grep -v 'skip ci' | grep -v 'push phase . built, run CI')\" ]"

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
if [ "$FAIL" -eq 0 ]; then echo "✅ PRD-001 push acceptance (phase $PHASE, $MODE): PASS"; else echo "❌ PRD-001 push acceptance (phase $PHASE, $MODE): FAIL"; fi
exit "$FAIL"
