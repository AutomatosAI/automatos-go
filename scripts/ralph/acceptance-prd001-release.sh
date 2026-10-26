#!/bin/bash
# Acceptance gate — Automatos Go PRD-001 wave A7: Release, store duties and release hardening (kit: release).
#   bash scripts/ralph/acceptance-prd001-release.sh               # full: local checks + the wave's one CI run
#   bash scripts/ralph/acceptance-prd001-release.sh --no-ci       # local checks only (what a build session runs)
#   bash scripts/ralph/acceptance-prd001-release.sh --print-base  # the diff base every check uses
#   GATE_BASE=<ref> overrides the base (smoke runs only).
# Base: the merge-base with ${RALPH_RELEASE_BASE:-origin/main} — A7 runs LAST, on the merged app (A0–A6). The
# launcher exports RALPH_RELEASE_BASE when the lead named another base; the runner and every build session inherit it.
# Local checks are pure Node (tsc, eslint, vitest — which runs this wave's store audits —, expo export, expo-doctor,
# expo config introspection, check:core, check:routes): exactly what CI runs, no server, no simulator, no EAS.
# KR1 is enforced as an ALLOWLIST of changed paths, plus SEAM EDIT / AUDIT FIX notes for every other product file.
# KR3: app.json may differ from the base only at expo.ios.privacyManifests and expo.android.allowBackup.
# No pipefail (a negative `! producer | grep -q` would invert on SIGPIPE); each check in its own `( eval … )`;
# stdin closed so a grep with a missing file argument fails instead of hanging. Negative checks read the wave's
# ADDED lines in product code (src/, app/), the vendored core, tests and fixtures excluded; on the base they pass
# by construction, and every positive (story) check fails there by design.
set -u
exec </dev/null
cd "$(dirname "$0")/../.." || exit 1
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin"   # appended: nvm's Node 22 (set by the launcher) must stay first

REF="${RALPH_RELEASE_BASE:-origin/main}"
if [ -n "${GATE_BASE:-}" ]; then
  BASE=$(git rev-parse --verify -q "$GATE_BASE^{commit}") || { echo "GATE_BASE $GATE_BASE does not resolve"; exit 1; }
else
  BASE=$(git merge-base HEAD "$REF" 2>/dev/null || git merge-base HEAD main 2>/dev/null) \
    || { echo "cannot resolve a merge-base with $REF or main"; exit 1; }
fi
MODE=full
case "${1:-}" in --print-base) echo "$BASE"; exit 0 ;; --no-ci) MODE=no-ci ;; "") ;; *) echo "unknown argument: $1"; exit 2 ;; esac
echo "base: $(git log -1 --format='%h %s' "$BASE") ($REF) · HEAD: $(git log -1 --format='%h %s' HEAD) · mode: $MODE · node: $(node -v 2>/dev/null || echo MISSING)"
FAIL=0
check() { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ PASS: $name"; else echo "   ❌ FAIL: $name"; FAIL=1; fi; }
warn()  { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ ok: $name"; else echo "   ⚠️  WARN (not a failure): $name"; fi; }

KIT=scripts/ralph/prd-001-release.json
CI_JOBS=("typecheck · lint · test" "expo-doctor · iOS bundle")
# KR1: paths this wave may create or change freely.
ALLOWED='^(src/release/|src/observability/|src/storage/secure-registry\.ts$|docs/release/|scripts/release/|scripts/__tests__/release-[^/]+\.test\.ts$|\.github/workflows/push-security\.yml$|scripts/ralph/(prd-001-release\.json|PROMPT_build_prd001-release\.md|PROMPT_review_prd001-release\.md|acceptance-prd001-release\.sh)$)'
# KR1: seam files outside src/ and app/ — each edit needs 'SEAM EDIT: <path>' in the kit's notes or marks.
SEAM_OUTSIDE='^(scripts/check-release-env\.js|scripts/__tests__/check-release-env\.test\.ts|app\.json|CLAUDE\.md|README\.md)$'
# KR1: never.
NEVER='^(src/core/|core\.lock\.json$|scripts/core-manifest\.json$|src/styles/ai-label\.tsx$|assets/|package\.json$|package-lock\.json$|eas\.json$|\.github/workflows/(ci|testflight|malware-scan)\.yml$)'
# The global secrets hook's patterns (~/.claude/hooks/block-secrets.sh): no path this wave adds may match one.
HOOK_PATHS='(\.env$|\.env\.|/\.env|(^|/)credentials|/secrets/|/secret/|\.pem$|\.key$|_rsa$|_rsa\.pub$|/service-account[^/]*\.json$|/sa-key[^/]*\.json$)'

# --- helpers (never read stdin) --------------------------------------------------------------
added_code() { git diff "$BASE"..HEAD -- src app ':!src/core/web' ':!*__tests__*' ':!*__fixtures__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++'; }
added_files() { git diff --name-only --diff-filter=A "$BASE"..HEAD -- "$@"; }
changed() { git diff --name-only "$BASE"..HEAD; }
has() { [ -f "$2" ] && grep -qE -e "$1" "$2"; }                  # has <ERE> <file>: false when the file is missing
all_exist() { local f; for f in "$@"; do [ -e "$f" ] || { echo "   missing: $f"; return 1; }; done; }
appjson() { [ -f app.json ] && jq -e "$1" app.json >/dev/null; }
jsonok() { [ -f "$2" ] && jq -e "$1" "$2" >/dev/null; }
kit_text() { jq -r '[.userStories[] | .notes, .acceptanceCriteria[]] | .[]' "$KIT" 2>/dev/null; }
every_commit_signed() { [ -z "$(git log --no-merges --format='%H %(trailers:key=Signed-off-by,valueonly)' "$BASE"..HEAD | awk 'NF<2{print $1}')" ]; }
file_sizes_ok() { local f n bad=0; for f in $(added_files src app scripts | grep -E '\.(ts|tsx|js|mjs)$' | grep -v '^scripts/ralph/'); do [ -f "$f" ] || continue; n=$(wc -l < "$f" | tr -d ' '); [ "$n" -le 800 ] || { echo "   $f: $n lines"; bad=1; }; done; [ $bad -eq 0 ]; }
npm_ok() { [ -f package.json ] || { echo "   no package.json in $(pwd) — refusing to run npm (it would climb to a parent)"; return 1; }; }
kr1_paths_ok() {
  local f text bad=0
  text=$(kit_text)
  for f in $(changed); do
    printf '%s\n' "$f" | grep -qE "$ALLOWED" && continue
    if printf '%s\n' "$f" | grep -qE "$SEAM_OUTSIDE"; then
      printf '%s\n' "$text" | grep -qF "SEAM EDIT: $f" || { echo "   seam without 'SEAM EDIT: $f'"; bad=1; }
      continue
    fi
    case "$f" in
      src/*|app/*)
        printf '%s\n' "$text" | grep -qF "SEAM EDIT: $f" || printf '%s\n' "$text" | grep -qF "AUDIT FIX: $f" \
          || { echo "   product file without 'SEAM EDIT: $f' or 'AUDIT FIX: $f'"; bad=1; } ;;
      *) echo "   outside KR1: $f"; bad=1 ;;
    esac
  done
  [ $bad -eq 0 ]
}
appjson_kr3_only() {
  local a b
  [ -f app.json ] || { echo "   no app.json"; return 1; }
  a=$(git show "$BASE:app.json" 2>/dev/null | jq -S 'del(.expo.ios.privacyManifests, .expo.android.allowBackup)') || { echo "   base app.json unreadable"; return 1; }
  b=$(jq -S 'del(.expo.ios.privacyManifests, .expo.android.allowBackup)' app.json) || { echo "   app.json unreadable"; return 1; }
  [ "$a" = "$b" ] || { diff <(printf '%s\n' "$a") <(printf '%s\n' "$b") | head -20 | sed 's/^/   /'; return 1; }
}
native_commits_marked() {
  local c bad=0
  for c in $(git log --no-merges --format=%H "$BASE"..HEAD -- app.json); do
    git log -1 --format=%B "$c" | grep -q '^NATIVE CHANGE:' || { echo "   $(git log -1 --format='%h %s' "$c") changes app.json without a 'NATIVE CHANGE:' body"; bad=1; }
  done
  [ $bad -eq 0 ]
}
readme_rows_ok() { local i m=0; [ -f docs/release/README.md ] || return 1; for i in $(seq -w 1 23); do grep -q "R$i" docs/release/README.md || { echo "   no row R$i"; m=1; }; done; [ $m -eq 0 ]; }
manifest_matches_labels() {
  local m l
  m=$(jq -r '[.expo.ios.privacyManifests.NSPrivacyCollectedDataTypes[]?.NSPrivacyCollectedDataType] | sort | join(",")' app.json 2>/dev/null)
  l=$(jq -r '[.apple[] | select(.collected == true) | .manifestKey] | sort | join(",")' docs/release/privacy-labels.json 2>/dev/null)
  [ -n "$m" ] && [ "$m" = "$l" ] || { echo "   manifest: ${m:-none}"; echo "   labels:   ${l:-none}"; return 1; }
}

# --- the kit: every story done, every AC marked DONE or (owner steps) OWNER -------------------------------
echo ""; echo "=== Kit"
check "kit JSON valid; every story passes:true" "jq -e '[.userStories[] | select(.passes != true)] | length == 0' $KIT >/dev/null"
check "every AC carries '→ DONE' (or '→ OWNER' for an OWNER step, KR6)" "jq -e '[.userStories[].acceptanceCriteria[] | select(((startswith(\"OWNER\") and contains(\"→ OWNER\")) or ((startswith(\"OWNER\") | not) and contains(\"→ DONE\"))) | not)] | length == 0' $KIT >/dev/null"
check "no OWNER step marked DONE (KR6)" "jq -e '[.userStories[].acceptanceCriteria[] | select(startswith(\"OWNER\") and contains(\"→ DONE\"))] | length == 0' $KIT >/dev/null"

if [ -f package.json ] && [ -f package-lock.json ] && [ ! -d node_modules ]; then
  echo ""; echo "── node_modules absent — installing (npm ci --ignore-scripts)"
  npm ci --ignore-scripts --no-audit --no-fund || { echo "   ❌ FAIL: npm ci"; FAIL=1; }
fi

echo ""; echo "=== Local checks (pure Node; vitest runs every store audit)"
check "typecheck (tsc --noEmit)" "npm_ok && npm run -s typecheck"
check "lint (eslint .)" "npm_ok && npm run -s lint"
check "vitest suite (incl. src/release/__tests__ and scripts/__tests__/release-*)" "npm_ok && npx --no-install vitest run"
check "JS bundle compiles (expo export --platform ios)" "npm_ok && npm run -s check:bundle >/dev/null"
check "expo-doctor" "npm_ok && npx --yes expo-doctor"
check "every config plugin evaluates (expo config --type introspect)" "npm_ok && npx --no-install expo config --type introspect >/dev/null"
check "vendored core unchanged (check:core)" "npm_ok && npm run -s check:core"
check "every route the app calls is in the pinned manifest (check:routes)" "npm_ok && npm run -s check:routes"

echo ""; echo "=== KR1 / KR3: the wave's files"
check "no NEVER path changed (core, lock, AI label, assets, package files, eas.json, foundation workflows)" "o=\$(changed | grep -E '$NEVER'); [ -z \"\$o\" ] || { echo \"\$o\" | sed 's/^/   forbidden: /'; false; }"
check "every changed path is KR1's, a noted seam, or a noted audit fix" "kr1_paths_ok"
check "app.json differs from the base only at ios.privacyManifests and android.allowBackup (KR3)" "appjson_kr3_only"
check "every commit touching app.json says 'NATIVE CHANGE:' (KR3)" "native_commits_marked"
check "no added path matches the secrets hook's patterns" "o=\$(added_files . | grep -E '$HOOK_PATHS'); [ -z \"\$o\" ] || { echo \"\$o\" | sed 's/^/   hook path: /'; false; }"
if git diff --quiet "$BASE"..HEAD -- app.json; then echo ""; echo "── app.json unchanged: no native change in this wave (over the air)"
else echo ""; echo "── ⚠️  NATIVE CHANGE in this wave (app.json): the merge costs one iOS build through the fingerprint loop (D43)"; fi

echo ""; echo "=== Stories"
check "US-021a tree reader, denylist, dependency audit, README with R01–R23" "all_exist src/release/__tests__/support/tree.ts src/release/__tests__/support/denylist.ts src/release/__tests__/tree.test.ts src/release/__tests__/dependency-audit.test.ts && readme_rows_ok"
check "US-021b scrubber and options with the sample event" "all_exist src/observability/scrub.ts src/observability/options.ts src/observability/__fixtures__/sample-event.json src/observability/__tests__/scrub.test.ts src/observability/__tests__/options.test.ts && jq -e . src/observability/__fixtures__/sample-event.json >/dev/null"
check "US-021b fixed options (KR7): no PII, EU only, no tracing, no screenshots or view hierarchy" "has 'sendDefaultPii: *false' src/observability/options.ts && has 'ingest\\.de\\.sentry\\.io' src/observability/options.ts && has 'tracesSampleRate: *0' src/observability/options.ts && has 'attachScreenshot: *false' src/observability/options.ts && has 'attachViewHierarchy: *false' src/observability/options.ts && has 'enableUserInteractionTracing: *false' src/observability/options.ts"
check "US-021b scrub/options import no runtime react, react-native, expo or Sentry" "! grep -nE \"^import [^t].*from ['\\\"](react|react-native|expo[^'\\\"]*|@sentry/react-native)['\\\"]\" src/observability/scrub.ts src/observability/options.ts"
check "US-021c crash reporting wired at launch; the setting; the EU guard in the build hook" "all_exist src/observability/crash-setting.ts src/observability/crash-reporting.ts src/observability/index.ts src/observability/__tests__/crash-reporting.test.ts && grep -q 'initCrashReporting' app/_layout.tsx && has 'ingest\\.de\\.sentry\\.io' scripts/check-release-env.js && ! grep -q 'Create an account in Studio' scripts/check-release-env.js"
check "US-021c @sentry/react-native imported only inside src/observability/" "[ -z \"\$(grep -rlE \"from ['\\\"]@sentry/react-native['\\\"]|require\\\\(['\\\"]@sentry/react-native\" src app 2>/dev/null | grep -v '^src/observability/' | grep -v __tests__)\" ]"
check "US-021d legal links (KR8), the Privacy & legal section, the Welcome line" "has 'https://automatos\\.app/privacy' src/release/legal-links.ts && has 'https://automatos\\.app/terms' src/release/legal-links.ts && has 'https://automatos\\.app/contact' src/release/legal-links.ts && all_exist src/release/privacy-section.ts src/release/strings.ts src/release/components/PrivacySection.tsx && grep -q 'PrivacySection' 'app/(app)/settings/index.tsx' && [ -n \"\$(grep -rl 'release/legal-links' src app 2>/dev/null | grep -v '^src/release/' | grep -v 'settings/index.tsx' | grep -v __tests__)\" ]"
check "US-021e privacy labels JSON and both form documents" "jsonok '(.apple | length > 0) and (.play | length > 0) and ([.apple[] | select(.tracking != false)] | length == 0)' docs/release/privacy-labels.json && all_exist docs/release/app-store-privacy.md docs/release/play-data-safety.md src/release/__tests__/privacy-labels.test.ts"
check "US-021f privacy manifest present (no tracking, API reasons) and Android backup off" "appjson '.expo.ios.privacyManifests.NSPrivacyTracking == false and ((.expo.ios.privacyManifests.NSPrivacyTrackingDomains // []) | length == 0) and (.expo.ios.privacyManifests.NSPrivacyAccessedAPITypes | length) >= 4 and .expo.android.allowBackup == false' && all_exist src/release/__tests__/support/plist.ts src/release/__tests__/privacy-manifest.test.ts"
check "US-021f manifest collected types equal the labels JSON" "manifest_matches_labels"
check "US-021g Android allowlist and iOS usage keys as data; no READ_MEDIA_* allowed" "jsonok '(.allowed | length > 0) and ([.denied[].name] | index(\"android.permission.READ_MEDIA_IMAGES\") != null or index(\"READ_MEDIA_IMAGES\") != null) and ([.allowed[].name | select(test(\"READ_MEDIA|READ_EXTERNAL_STORAGE|LOCATION\"))] | length == 0)' docs/release/android-permissions.json && jsonok 'length > 0' docs/release/ios-usage-keys.json && all_exist src/release/__tests__/permissions.test.ts"
check "US-021h the IPA scan: script, symbol table, test, doc" "all_exist scripts/release/scan-ipa.mjs scripts/release/usage-symbols.json scripts/__tests__/release-scan-ipa.test.ts docs/release/ipa-scan.md && jq -e . scripts/release/usage-symbols.json >/dev/null && node --check scripts/release/scan-ipa.mjs && grep -q 'PHAsset' scripts/release/usage-symbols.json && grep -q 'ATTrackingManager' scripts/release/usage-symbols.json"
check "US-021i upload audit and the privacy facts' EXIF entry" "all_exist src/release/__tests__/upload-audit.test.ts docs/release/privacy-facts.md && grep -qi 'EXIF' docs/release/privacy-facts.md"
check "US-021j secure-store registry (one survivor) and its audit" "all_exist src/storage/secure-registry.ts src/release/__tests__/secure-store-audit.test.ts && has 'survivesReinstall' src/storage/secure-registry.ts"
check "US-021k store-copy and surface audits" "all_exist src/release/__tests__/support/forbidden-copy.ts src/release/__tests__/store-copy.test.ts src/release/__tests__/surfaces.test.ts && has 'SIGNUP' src/release/__tests__/support/forbidden-copy.ts && has 'BILLING' src/release/__tests__/support/forbidden-copy.ts && has 'DELETION' src/release/__tests__/support/forbidden-copy.ts && has 'DATA_CLAIMS' src/release/__tests__/support/forbidden-copy.ts"
check "US-021l Dynamic Type audit and the screenshot matrix" "all_exist src/release/__tests__/a11y-audit.test.ts docs/release/accessibility-pass.md"
check "US-021m association values checked against app.json" "jsonok '.ios.appID == \"KGVA9933BG.com.automatos.app\" and .android.package == \"com.automatos.app\"' docs/release/association.json && all_exist src/release/__tests__/association.test.ts docs/release/universal-links.md"
check "US-021n push-security check: script, test, workflow (testflight env, schedule, no npm install), doc" "all_exist scripts/release/check-push-security.mjs scripts/__tests__/release-push-security.test.ts .github/workflows/push-security.yml docs/release/push-security.md && node --check scripts/release/check-push-security.mjs && has 'environment: *testflight' .github/workflows/push-security.yml && has 'schedule:' .github/workflows/push-security.yml && has 'workflow_dispatch' .github/workflows/push-security.yml && ! grep -qE 'npm (ci|install)|npx ' .github/workflows/push-security.yml"
check "US-021o release-config audit and the TestFlight doc" "all_exist src/release/__tests__/release-config.test.ts docs/release/testflight.md"
check "US-021p reviewer access, listing, age rating, export compliance, and their audit" "all_exist docs/release/app-review-notes.md docs/release/play-app-access.md docs/release/store-listing.md docs/release/age-rating.md docs/release/export-compliance.md src/release/__tests__/release-docs.test.ts"
check "US-021q privacy facts, the WebSummit checklist, CLAUDE.md's Release section" "all_exist docs/release/privacy-facts.md docs/release/websummit-checklist.md && grep -q 'Release (A7)' CLAUDE.md"

echo ""; echo "=== Contract (negative, added lines)"
check "never Sentry.setUser (KR7)" "! added_code | grep -qE 'setUser\\('"
check "never Sentry.wrap (touch breadcrumbs, KR7)" "! added_code | grep -qE 'Sentry\\.wrap\\('"
check "no fetch( added in product code (D-ONE-CLIENT)" "! added_code | grep -E '(^|[^.A-Za-z0-9_])fetch\\(' | grep -q ."
check "no WebView (D-NO-WEBVIEW)" "! added_code | grep -q 'react-native-webview'"
check "no planMode / missionMode" "! added_code | grep -qE 'planMode|missionMode'"
check "no colour literal added outside src/styles/tokens (D-TOKENS)" "! git diff $BASE..HEAD -- src app ':!src/styles/tokens' ':!src/core/web' ':!*__tests__*' ':!*__fixtures__*' ':!*.test.ts' | grep '^+' | grep -v '^+++' | grep -E \"['\\\"\\\`]#[0-9A-Fa-f]{3,8}['\\\"\\\`]|(rgba?|hsla?)\\(\" | grep -q ."
check "this wave's copy: no billing, sign-up pointer, deletion or 'nothing leaves' (D8, D63, D64, D70)" "! git diff $BASE..HEAD -- src/release/strings.ts | grep '^+' | grep -v '^+++' | grep -qiE 'credits?|pricing|price|upgrade|subscri|top ?up|sign ?up|create (an|one|your) account|no account\\?|delete (your |my |this )?(account|workspace)|nothing leaves|never leaves'"
check "no secret-shaped string in docs/release or scripts/release" "! grep -rnE 'pk_(live|test)_[A-Za-z0-9]{10,}|sk_(live|test)_[A-Za-z0-9]{10,}|amd_[A-Za-z0-9_-]{16,}|ExponentPushToken\\[[A-Za-z0-9_-]{8,}\\]|-----BEGIN [A-Z ]*PRIVATE KEY-----|[Pp]assword[^:=]{0,20}[:=][[:space:]]*[^<([:space:]][^[:space:]]{5,}' docs/release scripts/release 2>/dev/null | grep -q ."
check "every commit is signed off (DCO)" "every_commit_signed"
check "new source files <= 800 lines (D-SHAPE)" "file_sizes_ok"
warn  "story commits carry [skip ci] (all but the final CI commit)" "[ -z \"\$(git log --no-merges --format='%s' $BASE..HEAD^ | grep -v 'skip ci')\" ]"

ci_commit_for_head() {
  local sha; sha=$(git rev-parse HEAD)
  while git log -1 --format=%s "$sha" | grep -q 'skip ci' && [ -z "$(git show --format= --name-only "$sha" | grep -v '^scripts/ralph/')" ]; do
    sha=$(git rev-parse "$sha^")
  done
  echo "$sha"
}
wait_run() { # wait_run <workflow file> <sha> → prints "<id> <conclusion>" of the newest completed run, or fails after 45 min
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
if [ "$FAIL" -eq 0 ]; then echo "✅ PRD-001 release acceptance ($MODE): PASS"; else echo "❌ PRD-001 release acceptance ($MODE): FAIL"; fi
exit "$FAIL"
