#!/bin/bash
# Acceptance gate — Automatos Go PRD-001 wave A0+A1: the foundation (kit: foundation).
#   bash scripts/ralph/acceptance-prd001-foundation.sh               # full: local checks + the wave's one CI run
#   bash scripts/ralph/acceptance-prd001-foundation.sh --no-ci       # local checks only (what a build session runs)
#   bash scripts/ralph/acceptance-prd001-foundation.sh --print-base  # the diff base every check uses
#   GATE_BASE=<ref> overrides the base (smoke runs only).
# Base: the merge-base with origin/docs/prd-001-automatos-go-v1 (the wave is cut from PR #2's branch), else
# with origin/main. Local checks are pure Node (tsc, eslint, vitest, expo export, expo-doctor, expo config
# introspection, check:core, check:routes) — honest on this machine, exactly what CI runs, no server, no
# simulator. CI once per wave on the draft PR.
# No pipefail (a negative `! producer | grep -q` would invert on SIGPIPE); every check runs in its own
# `( eval … )`; stdin is closed so a grep with a missing file argument fails instead of hanging.
# Negative checks read the wave's ADDED lines in product code (src/, app/), tests and the kit excluded, so a
# check's own pattern or a test asserting absence never trips it; on the base (no src/, no app/) every negative
# check passes by construction and every positive check fails by design.
set -u
exec </dev/null
cd "$(dirname "$0")/../.." || exit 1
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin"   # appended: nvm's Node 22 (set by the launcher) must stay first

if [ -n "${GATE_BASE:-}" ]; then
  BASE=$(git rev-parse --verify -q "$GATE_BASE^{commit}") || { echo "GATE_BASE $GATE_BASE does not resolve"; exit 1; }
else
  BASE=$(git merge-base HEAD origin/docs/prd-001-automatos-go-v1 2>/dev/null || git merge-base HEAD origin/main) \
    || { echo "cannot resolve a merge-base with origin/docs/prd-001-automatos-go-v1 or origin/main"; exit 1; }
fi
MODE=full
case "${1:-}" in --print-base) echo "$BASE"; exit 0 ;; --no-ci) MODE=no-ci ;; "") ;; *) echo "unknown argument: $1"; exit 2 ;; esac
echo "base: $(git log -1 --format='%h %s' "$BASE") · HEAD: $(git log -1 --format='%h %s' HEAD) · mode: $MODE · node: $(node -v 2>/dev/null || echo MISSING)"
FAIL=0
check() { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ PASS: $name"; else echo "   ❌ FAIL: $name"; FAIL=1; fi; }
warn()  { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ ok: $name"; else echo "   ⚠️  WARN (not a failure): $name"; fi; }

KIT=scripts/ralph/prd-001-foundation.json
PINNED_SHA=630fc1c85af06c5c76e70c74e9653ee1804fdf41
CI_JOBS=("typecheck · lint · test" "expo-doctor · iOS bundle")

# --- helpers (never read stdin) --------------------------------------------------------------
added_code() { git diff "$BASE"..HEAD -- src app ':!src/core/web' ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' ':!src/core/__fixtures__' | grep '^+' | grep -v '^+++'; }
added_files() { git diff --name-only --diff-filter=A "$BASE"..HEAD -- "$@"; }
has() { [ -f "$2" ] && grep -qE -e "$1" "$2"; }                  # has <ERE> <file>: false when the file is missing
all_exist() { local f; for f in "$@"; do [ -e "$f" ] || { echo "   missing: $f"; return 1; }; done; }
appjson() { [ -f app.json ] && jq -e "$1" app.json >/dev/null; }
easjson() { [ -f eas.json ] && jq -e "$1" eas.json >/dev/null; }
png_ihdr() { [ -f "$1" ] || return 1; local h; h=$(od -An -tx1 -j16 -N10 "$1" | tr -d ' \n'); echo "$((16#${h:0:8})) $((16#${h:8:8})) $((16#${h:18:2}))"; }
sfnt_ok() { local m; m=$(od -An -tx1 -N4 "$1" | tr -d ' \n'); [ "$m" = "00010000" ] || [ "$m" = "74727565" ]; }
every_commit_signed() { [ -z "$(git log --no-merges --format='%H %(trailers:key=Signed-off-by,valueonly)' "$BASE"..HEAD | awk 'NF<2{print $1}')" ]; }
file_sizes_ok() { local f n bad=0; for f in $(added_files src app scripts | grep -E '\.(ts|tsx|js)$' | grep -v '^src/core/web/' | grep -v '^scripts/ralph/'); do [ -f "$f" ] || continue; n=$(wc -l < "$f" | tr -d ' '); [ "$n" -le 800 ] || { echo "   $f: $n lines"; bad=1; }; done; [ $bad -eq 0 ]; }
npm_ok() { [ -f package.json ] || { echo "   no package.json in $(pwd) — refusing to run npm (it would climb to a parent)"; return 1; }; }

# --- the kit: every story DONE -------------------------------------------------------------------
echo ""; echo "=== Kit"
check "kit JSON valid; every story passes:true" "jq -e '[.userStories[] | select(.passes != true)] | length == 0' $KIT >/dev/null"
check "every acceptance criterion carries a DONE mark" "jq -e '[.userStories[].acceptanceCriteria[] | select(contains(\"→ DONE\") | not)] | length == 0' $KIT >/dev/null"

# --- deps present (worktrees start bare; setup-worktree.sh installs) --------------------------------
if [ -f package.json ] && [ -f package-lock.json ] && [ ! -d node_modules ]; then
  echo ""; echo "── node_modules absent — installing (npm ci --ignore-scripts)"
  npm ci --ignore-scripts --no-audit --no-fund || { echo "   ❌ FAIL: npm ci"; FAIL=1; }
fi

# --- primary gates: what CI runs ---------------------------------------------------------------
echo ""; echo "=== Local checks (pure Node)"
check "typecheck (tsc --noEmit)" "npm_ok && npm run -s typecheck"
check "lint (eslint .)" "npm_ok && npm run -s lint"
check "vitest suite" "npm_ok && npx --no-install vitest run"
check "JS bundle compiles (expo export --platform ios)" "npm_ok && npm run -s check:bundle >/dev/null"
check "expo-doctor" "npm_ok && npx --yes expo-doctor"
check "every config plugin evaluates (expo config --type introspect)" "npm_ok && npx --no-install expo config --type introspect >/dev/null"
check "vendored core matches core.lock.json (check:core)" "npm_ok && npm run -s check:core"
check "every route the app calls is in the pinned manifest (check:routes)" "npm_ok && npm run -s check:routes"

# --- US-001: scaffold, identity, release plumbing ------------------------------------------------------
echo ""; echo "=== US-001 scaffold"
check "repo files exist" "all_exist package.json package-lock.json app.json eas.json .npmrc .nvmrc .gitignore metro.config.js babel.config.js shims/react-dom/index.js shims/react-dom/client.js tsconfig.json vitest.config.ts eslint.config.js LICENSE README.md CLAUDE.md scripts/check-release-env.js scripts/testflight-decide.js .github/workflows/ci.yml .github/workflows/testflight.yml"
check "README.md and CLAUDE.md document every EXPO_PUBLIC_* name (LEAD-20OCT, no .env.example)" "names=\$(grep -oE 'EXPO_PUBLIC_[A-Z0-9_]+' scripts/check-release-env.js | sort -u); [ -n \"\$names\" ] && m=0; for n in \$names; do grep -qF \"\$n\" README.md || { echo \"   not in README: \$n\"; m=1; }; grep -qF \"\$n\" CLAUDE.md || { echo \"   not in CLAUDE.md: \$n\"; m=1; }; done; [ \$m -eq 0 ]"
check "@clerk/expo is 3.2.x and expo-modules-core is not a direct dependency (LEAD-20OCT)" "jq -r '.dependencies[\"@clerk/expo\"] // \"\"' package.json | grep -Eq '^[~^]?3\\.2\\.' && jq -e '.dependencies[\"expo-modules-core\"] == null' package.json >/dev/null"
check "package name automatos-go" "jq -e '.name == \"automatos-go\"' package.json >/dev/null"
check "LICENSE is Apache-2.0" "has 'Apache License' LICENSE && has 'Version 2\\.0' LICENSE"
check ".nvmrc is 22" "[ \"\$(tr -d ' \\n' < .nvmrc)\" = 22 ]"
check "CLAUDE.md carries the CI-is-the-gate rule" "has 'CI is the gate\\. Nothing runs on this machine except pure-Node checks' CLAUDE.md"
check "app.json identity (name, slug, scheme, bundle id, package, iPhone only)" "appjson '.expo.name == \"Automatos Go\" and .expo.slug == \"automatos-go\" and (.expo.scheme == \"automatos\" or .expo.scheme == [\"automatos\"]) and .expo.ios.bundleIdentifier == \"com.automatos.app\" and .expo.android.package == \"com.automatos.app\" and .expo.ios.supportsTablet == false'"
check "runtimeVersion policy fingerprint (D46)" "appjson '.expo.runtimeVersion.policy == \"fingerprint\"'"
check "ITSAppUsesNonExemptEncryption false" "appjson '.expo.ios.infoPlist.ITSAppUsesNonExemptEncryption == false'"
check "no EAS projectId, owner or updates.url committed (OT-1)" "appjson '(.expo.owner == null) and (.expo.extra.eas.projectId == null) and (.expo.updates.url == null)'"
check "the Clerk extraPods (GoogleUtilities, RecaptchaInterop) kept" "appjson '[.expo.plugins[] | select(type == \"array\" and .[0] == \"expo-build-properties\") | .[1].ios.extraPods[].name] | (index(\"GoogleUtilities\") != null and index(\"RecaptchaInterop\") != null)'"
check "eas.json profiles (development client, preview APK, testflight channel, production)" "easjson '.cli.appVersionSource == \"remote\" and .build.development.developmentClient == true and .build.preview.android.buildType == \"apk\" and .build.testflight.channel == \"testflight\" and (.build.production != null)'"
check "eas.json submit carries no ascAppId (OT-2)" "easjson '[.. | objects | select(has(\"ascAppId\"))] | length == 0'"
check "ci.yml: npm ci and the two named jobs" "has 'npm ci' .github/workflows/ci.yml && grep -qF 'typecheck · lint · test' .github/workflows/ci.yml && grep -qF 'expo-doctor · iOS bundle' .github/workflows/ci.yml"
check "ci.yml runs check:core and check:routes" "has 'check:core' .github/workflows/ci.yml && has 'check:routes' .github/workflows/ci.yml"
check "testflight.yml: environment, token and projectId fail-fast, in-progress guard" "has 'environment: testflight' .github/workflows/testflight.yml && has 'EXPO_TOKEN' .github/workflows/testflight.yml && has 'projectId' .github/workflows/testflight.yml && has 'testflight-decide' .github/workflows/testflight.yml && has 'in_progress|in_queue' .github/workflows/testflight.yml"
check "malware-scan.yml byte-identical to the base" "git diff --quiet $BASE..HEAD -- .github/workflows/malware-scan.yml"
check "check-release-env requires the Clerk pk_live_ key for production" "has 'pk_live_' scripts/check-release-env.js && has 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY' scripts/check-release-env.js"

# --- US-002a–c: the native set ---------------------------------------------------------------------
echo ""; echo "=== US-002 native modules, plugins, usage keys"
NATIVE="@clerk/expo @clerk/expo-passkeys expo-secure-store expo-device expo-notifications expo-local-authentication expo-camera expo-image-picker expo-document-picker expo-image-manipulator expo-file-system expo-speech-recognition expo-speech @livekit/react-native @livekit/react-native-webrtc @livekit/react-native-expo-plugin @config-plugins/react-native-webrtc @shopify/react-native-skia expo-video expo-font expo-haptics react-native-mmkv @sentry/react-native expo-localization expo-dev-client expo-task-manager expo-system-ui expo-build-properties lucide-react-native"
check "every §4.2 module and K11 addition is a dependency" "m=0; for p in $NATIVE; do jq -e --arg p \"\$p\" '.dependencies[\$p] != null' package.json >/dev/null || { echo \"   missing: \$p\"; m=1; }; done; [ \$m -eq 0 ]"
check "docs/native-modules.md records each module (and the document viewer)" "[ -f docs/native-modules.md ] && m=0; for p in $NATIVE; do grep -qF \"\$p\" docs/native-modules.md || { echo \"   not in docs: \$p\"; m=1; }; done; [ \$m -eq 0 ] && grep -qi 'quicklook' docs/native-modules.md"
check "no react-native-webview anywhere in the lockfile (D-NO-WEBVIEW)" "[ -f package-lock.json ] && ! jq -e '[.packages | keys[] | select(endswith(\"node_modules/react-native-webview\"))] | length > 0' package-lock.json >/dev/null"
check "no expo-apple-authentication (D-SIGNIN)" "! jq -e '(.dependencies // {}) | has(\"expo-apple-authentication\")' package.json >/dev/null"
check "associated domains (K9)" "appjson '.expo.ios.associatedDomains == [\"applinks:ui.automatos.app\", \"webcredentials:clerk.automatos.app\"]'"
check "UIBackgroundModes exactly remote-notification (K11, D33)" "appjson '.expo.ios.infoPlist.UIBackgroundModes == [\"remote-notification\"]'"
check "ATS: local networking allowed, arbitrary loads not" "appjson '.expo.ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking == true and (.expo.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads // false) == false'"
check "usage keys present and naming Automatos Go" "m=0; for k in NSCameraUsageDescription NSMicrophoneUsageDescription NSSpeechRecognitionUsageDescription NSPhotoLibraryUsageDescription NSFaceIDUsageDescription NSLocalNetworkUsageDescription; do appjson \".expo.ios.infoPlist.\$k | type == \\\"string\\\" and test(\\\"Automatos Go\\\")\" || { echo \"   missing or unnamed: \$k\"; m=1; }; done; [ \$m -eq 0 ]"
check "Android intent filters for ui.automatos.app (autoVerify)" "appjson '[.expo.android.intentFilters[]? | select(.autoVerify == true) | .data[]? | select(.host == \"ui.automatos.app\")] | length > 0'"
check "no ios/ or android/ directory committed" "[ -z \"\$(git ls-files ios android)\" ]"

# --- US-002d/e: fonts and brand --------------------------------------------------------------------
echo ""; echo "=== US-002d fonts · US-002e brand"
check "8 font families, each with a TTF and a licence" "[ -d assets/fonts ] && n=0; for d in assets/fonts/*/; do ls \"\$d\"*.ttf >/dev/null 2>&1 && ls \"\$d\" | grep -qiE '^(license|ofl)' && n=\$((n+1)); done; echo \"   families with TTF + licence: \$n\"; [ \$n -ge 8 ]"
check "every TTF is a valid sfnt" "m=0; for f in \$(find assets/fonts -name '*.ttf'); do sfnt_ok \"\$f\" || { echo \"   bad sfnt: \$f\"; m=1; }; done; [ \$m -eq 0 ] && [ -n \"\$(find assets/fonts -name '*.ttf')\" ]"
check "assets/fonts/SOURCES.md exists" "[ -s assets/fonts/SOURCES.md ]"
check "icon.png 1024x1024 RGB without alpha" "[ \"\$(png_ihdr assets/brand/icon.png)\" = '1024 1024 2' ]"
check "assets/brand/SOURCES.md exists" "[ -s assets/brand/SOURCES.md ]"

# --- US-003: the vendored core ------------------------------------------------------------------
echo ""; echo "=== US-003 vendored core"
check "core.lock.json pinned to $PINNED_SHA" "jq -e --arg s $PINNED_SHA '.sha == \$s and (.files | length) > 0' core.lock.json >/dev/null"
check "lock lists the route manifest and every §4.3 chat/cc/styles anchor" "m=0; for p in lib/chat/receipts.ts lib/chat/chat-session.ts lib/ai-label/copy.ts components/play/chat/labels.ts lib/discussion.ts lib/ticket-number.ts lib/ticket-links.ts components/command-center/calendar-actions.ts hooks/use-board-event-stream.ts lib/look-kit/hsl.ts lib/looks/engine.ts lib/mascot/reducer.ts lib/theme-host/look-schema.ts; do jq -e --arg p \"src/core/web/\$p\" '.files | has(\$p)' core.lock.json >/dev/null || { echo \"   not in lock: \$p\"; m=1; }; done; jq -e '.files | has(\"src/core/route-manifest.json\")' core.lock.json >/dev/null || { echo '   route manifest not in lock'; m=1; }; [ \$m -eq 0 ]"
check "applyCssVars dropped from the vendored look-kit" "[ -d src/core/web ] && ! grep -rqE '(function|const|let|var|export)[[:space:]]+applyCssVars|applyCssVars[[:space:]]*\\(' src/core/web"
check "sync-core, manifest, stream parser, reducer, corpus, recorder exist" "all_exist scripts/sync-core.ts scripts/core-manifest.json src/core/ai-sdk-stream.ts src/core/turn-reducer.ts src/core/parity scripts/record-turn.ts"
check "hand-written core imports no React / RN / expo" "! grep -nE \"from ['\\\"](react|react-native|expo)[a-z0-9/@-]*['\\\"]\" src/core/ai-sdk-stream.ts src/core/turn-reducer.ts"
check "at least six contract corpus files" "[ \"\$(ls src/core/__fixtures__/parity/*.json 2>/dev/null | wc -l | tr -d ' ')\" -ge 6 ]"
check "no corpus file claims 'recorded' without a real-workspace source (K10)" "m=0; for f in src/core/__fixtures__/parity/*.json; do [ -f \"\$f\" ] || continue; jq -e '(.provenance != \"recorded\") or (.source.workspace == \"real\" and .source.server != null and .source.recordedAt != null)' \"\$f\" >/dev/null || { echo \"   \$f\"; m=1; }; done; [ \$m -eq 0 ]"

# --- US-004: client, discovery, cache, guards ----------------------------------------------------
echo ""; echo "=== US-004 API client"
check "src/api modules exist" "all_exist src/api/client.ts src/api/errors.ts src/api/strings.ts src/api/stream.ts src/api/sse.ts src/api/transport.ts src/api/routes.ts src/api/server.ts src/api/discovery.ts src/api/capabilities.ts src/api/workspace.ts src/api/query-keys.ts src/api/query-client.ts src/api/live.ts src/api/needs-you.ts src/api/reports.ts src/storage/mmkv.ts"
check "expo/fetch imported only by src/api/transport.ts" "[ -z \"\$(grep -rlE \"from ['\\\"]expo/fetch['\\\"]\" src app 2>/dev/null | grep -v '^src/api/transport.ts\$' | grep -v __tests__)\" ]"
check "no fetch( added outside src/api (D-ONE-CLIENT)" "! added_code | grep -E '(^|[^.A-Za-z0-9_])fetch\\(' | grep -q ."
check "query-keys carries every family the parallel kits need (K5)" "m=0; for k in workspace discovery needsYou board ticket schedule questions socialPost deliverables chat; do grep -q \"\$k\" src/api/query-keys.ts || { echo \"   missing family: \$k\"; m=1; }; done; [ \$m -eq 0 ]"
check "hosted defaults on a discovery 404 (K3)" "has '404' src/api/discovery.ts && has 'hostedDefaults|HOSTED_DEFAULTS' src/api/discovery.ts"
check "role policy (D16, D17)" "has 'roleCan' src/auth/role.ts"

# --- US-005: sign-in ------------------------------------------------------------------------------
echo ""; echo "=== US-005 sign-in"
check "AuthProvider interface: kind, getToken, signOut, onExpired" "has 'interface AuthProvider' src/auth/providers/types.ts && has 'kind' src/auth/providers/types.ts && has 'getToken' src/auth/providers/types.ts && has 'signOut' src/auth/providers/types.ts && has 'onExpired' src/auth/providers/types.ts"
check "Clerk provider asks for the 'mobile' JWT template" "all_exist src/auth/providers/clerk.ts src/auth/config.ts && grep -qE \"['\\\"]mobile['\\\"]\" src/auth/config.ts && has 'template' src/auth/providers/clerk.ts"
check "unknown auth mode → 'This server needs a newer Automatos Go'" "grep -rq 'needs a newer Automatos Go' src/auth"
check "sign-in machine and screens exist" "all_exist src/auth/sign-in-machine.ts src/auth/server-words.ts src/auth/screens 'app/(auth)/sign-in.tsx'"
check "no sign-up, social or Apple sign-in path (D5, D6)" "! added_code | grep -E 'useSignUp|signUp\\.|useSSO|oauth_|expo-apple-authentication|useSignInWithApple' | grep -q ."
check "no account-creation pointer anywhere in the app (LEAD-20OCT-SIGNUP)" "! added_code | grep -iE 'create (an|one|your) account|no account\\?' | grep -q ."

# --- FND: the shared contracts (K5) --------------------------------------------------------------
echo ""; echo "=== FND shared contracts"
check "tokens, theme, type, AI label" "all_exist src/styles/tokens src/styles/theme.tsx src/styles/type.ts src/styles/fonts.ts src/styles/ai-label.tsx && has 'aiLabelWords' src/styles/ai-label.tsx"
check "UI primitives incl. Sheet, Toast, ReportSheet, CommandCentreButton" "all_exist src/ui/index.ts src/ui/Button.tsx src/ui/StatusPip.tsx src/ui/Sheet.tsx src/ui/Toast.tsx src/ui/ReportSheet.tsx src/ui/CommandCentreButton.tsx"
check "ReportSheet gated on the report_content capability and the role" "grep -qE 'canReportContent' src/ui/ReportSheet.tsx && grep -qE 'roleCan' src/ui/ReportSheet.tsx"
check "app routes incl. chatWithTicket; web-link mapping" "has 'chatWithTicket' src/navigation/routes.ts && all_exist src/navigation/web-links.ts"
check "shell: gate, placeholders the kits replace, Account stub" "all_exist 'app/_layout.tsx' 'app/(app)/_layout.tsx' 'app/(app)/index.tsx' 'app/(app)/cc/_layout.tsx' 'app/(app)/settings/index.tsx' src/app-state"
check "one live connection: tasks/stream only in src/api" "[ -z \"\$(grep -rl 'tasks/stream' src app 2>/dev/null | grep -v '^src/api/' | grep -v '^src/core/' | grep -v __tests__)\" ]"

# --- hygiene ------------------------------------------------------------------------------------
echo ""; echo "=== Hygiene"
check "no WebView import anywhere" "! grep -rqE \"from ['\\\"]react-native-webview\" src app 2>/dev/null"
check "no colour literal added outside src/styles/tokens (D-TOKENS)" "! git diff $BASE..HEAD -- src app ':!src/styles/tokens' ':!src/core/web' ':!src/core/__fixtures__' ':!*__tests__*' ':!*.test.ts' | grep '^+' | grep -v '^+++' | grep -E \"['\\\"\\\`]#[0-9A-Fa-f]{3,8}['\\\"\\\`]|(rgba?|hsla?)\\(\" | grep -q ."
check "no secret-shaped string added (Clerk keys, tokens)" "! git diff $BASE..HEAD -- . ':!package-lock.json' ':!scripts/ralph' | grep '^+' | grep -qE 'pk_(live|test)_[A-Za-z0-9]{20,}|sk_(live|test)_[A-Za-z0-9]{10,}|amd_[A-Za-z0-9]{16,}'"
check "no .env file tracked" "[ -z \"\$(git ls-files | grep -E '(^|/)\\.env(\\.local)?\$')\" ]"
check "no expo start / run / prebuild / eas command added in product code" "! added_code | grep -qE 'expo (start|run:|prebuild)|\\beas (build|init|update|submit)'"
check "every commit is signed off (DCO)" "every_commit_signed"
check "new source files <= 800 lines (D-SHAPE)" "file_sizes_ok"
warn  "story commits carry [skip ci] (all but the final CI commit)" "[ -z \"\$(git log --format='%s' $BASE..HEAD^ | grep -v 'skip ci')\" ]"

# --- CI: once per wave, on the draft PR ------------------------------------------------------------
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
if [ "$FAIL" -eq 0 ]; then echo "✅ PRD-001 foundation acceptance ($MODE): PASS"; else echo "❌ PRD-001 foundation acceptance ($MODE): FAIL"; fi
exit "$FAIL"
