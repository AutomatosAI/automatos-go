#!/bin/bash
# Acceptance gate — Automatos Go PRD-001 wave A9: Candy, the fifth style (kit: candy).
#   bash scripts/ralph/acceptance-prd001-candy.sh                # full: local checks + the wave's one CI run
#   bash scripts/ralph/acceptance-prd001-candy.sh --no-ci        # local checks only (what a build session runs)
#   bash scripts/ralph/acceptance-prd001-candy.sh --print-base   # the diff base every check uses
#   bash scripts/ralph/acceptance-prd001-candy.sh --print-phase  # always 1: the wave has one phase
#   GATE_BASE=<ref> overrides the base (smoke runs only).
# Base: the merge-base with origin/main (main when origin/main is missing). The branch's own first commit (this
# kit and the PRD-001 addendum: §4.6.2, US-023) is part of the wave's diff. The base move (origin/main merged into
# the branch before US-023n, or at launch with RALPH_BASE_MOVE=1) moves the merge-base, so main's own changes never
# read as this wave's. Local checks are pure Node: what CI runs (typecheck, lint, vitest, check:core, check:routes,
# expo-doctor, the iOS bundle) plus `expo config --type introspect`, because US-023d changes app.json.
# KA1-FILES is an ALLOWLIST of changed paths; KA5-SEAMS a 'SEAM EDIT: <path>' note for every changed path outside
# src/styles/ (tests and this kit's own files excepted); KA2-STAND-IN no CANDY_STAND_IN once every story is DONE;
# KA3-VENDOR-PIN provenance headers whose sha256 is the kit source's at the pinned commit (recomputed when the kit
# checkout is reachable, else only its presence is checked).
# No pipefail; each check in its own `( eval … )`; stdin closed. Negative checks read the wave's ADDED lines in
# product code, tests and the kit excluded; on the base they pass by construction, positives fail by design.
set -u
exec </dev/null
cd "$(dirname "$0")/../.." || exit 1
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin"   # appended: nvm's Node 22 (set by the launcher) must stay first

case "${1:-}" in --print-phase) echo 1; exit 0 ;; esac

if [ -n "${GATE_BASE:-}" ]; then
  BASE=$(git rev-parse --verify -q "$GATE_BASE^{commit}") || { echo "GATE_BASE $GATE_BASE does not resolve"; exit 1; }
else
  BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null) \
    || { echo "cannot resolve a merge-base with origin/main or main"; exit 1; }
fi
MODE=full
case "${1:-}" in --print-base) echo "$BASE"; exit 0 ;; --no-ci) MODE=no-ci ;; "") ;; *) echo "unknown argument: $1"; exit 2 ;; esac
echo "base: $(git log -1 --format='%h %s' "$BASE") · HEAD: $(git log -1 --format='%h %s' HEAD) · mode: $MODE · node: $(node -v 2>/dev/null || echo MISSING)"
FAIL=0
check() { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ PASS: $name"; else echo "   ❌ FAIL: $name"; FAIL=1; fi; }
warn()  { local name="$1" body="$2"; echo ""; echo "── $name"; if ( eval "$body" ); then echo "   ✅ ok: $name"; else echo "   ⚠️  WARN (not a failure): $name"; fi; }

KIT=scripts/ralph/prd-001-candy.json
CI_JOBS=("typecheck · lint · test" "expo-doctor · iOS bundle")
MASCOT_STATES="hello idle listening thinking working searching reading celebrate oops sleeping lost loading"
KIT_PIN=310a31723cf61f52a9d835afbd6b32a73fba0978   # the design kit (AutomatosAI/automatos-design-kit), themes/candy (KA3): the lead fills it in
KIT_SHORT=310a31723
# US-023d: the five static instances (fonts.gstatic.com) and the two licences (google/fonts at a pinned commit).
FONT_SHA256="outfit/Outfit-SemiBold.ttf=8900df5726b5a6f23e723594f11d5ea27e695bd85c884f18d88ed080544fe205
outfit/Outfit-Bold.ttf=49dcdf653a004a2575b3de649f5e4c549d774fecddf317812330edd0ad70685a
outfit/OFL.txt=c676351bf8576b9aba743cd5eaa8c0e7ee0d51f805d720447b4df4ddb6a2e416
nunito/Nunito-Regular.ttf=9ecbdba35fa74f10a1a916c31649b802a12deb9e66c7b1fe4650afcfd4d16971
nunito/Nunito-Bold.ttf=1a025dfce6e6e03bbe31ba82277ec5ed96df8b8dd58b3df6267269490b90b1dc
nunito/Nunito-ExtraBold.ttf=c5776505c7b3df3c3ca763477b795d6bbc6517760bede0462ab77d1fb44954a6
nunito/OFL.txt=580df76c95a1ec5ab878ceb25bb3d85c6a076804e9c970c8c6972aea775fdf65"
OFL_COMMITS="29e94d990c84a54f83644e7c43f42dfc9e1a4ac7 a5bd0ea86b2576f86672aab557a6024d272187a5"   # ofl/outfit, ofl/nunito
KIT_FILES_RE='^scripts/ralph/(prd-001-candy\.json|PROMPT_build_prd001-candy\.md|PROMPT_review_prd001-candy\.md|acceptance-prd001-candy\.sh|overnight-prd001-candy\.sh|launch-prd001-candy\.sh)$'
TEST_RE='(^|/)__tests__/|\.test\.tsx?$'
# KA1-FILES: the only paths this wave may add or change (the tests beside each included).
KA1_ALLOWED='^(src/chat/|src/cc/|src/release/__tests__/support/(surfaces|a11y-allowed)\.ts$|src/config/__tests__/app-config\.test\.ts$|src/styles/|src/ui/(Slider\.tsx|dressed\.ts)$|src/ui/__tests__/|src/voice/home/(use-)?candy-home-voice\.ts$|src/voice/home/__tests__/|src/voice/screen/|src/voice/nav\.ts$|src/voice/__tests__/|app/\(app\)/settings/look/candy\.tsx$|assets/fonts/(outfit/|nunito/|SOURCES\.md$)|app\.json$|docs/styles-and-themes\.md$|docs/prd/PRD-001-AUTOMATOS-GO-V1\.md$|CLAUDE\.md$|src/(brief|suggestions|approvals)/)'
# KA3: each vendored file and the kit source (under themes/candy/) whose sha256 its header must carry.
VENDORED="src/styles/tokens/candy-catalogue.ts=src/looks/catalogue.ts
src/styles/candy/look-schema.ts=looks/schema.json
src/styles/candy/look-schema.ts=looks/presets/blush.look.json
src/styles/candy/look-schema.ts=looks/presets/lilac.look.json
src/styles/candy/look-schema.ts=looks/presets/nightbloom.look.json
src/styles/candy/look-schema.ts=src/looks/spec.ts
src/styles/candy/auto/auto-geometry.ts=src/art/auto-geometry.ts
src/styles/candy/auto/auto-path.ts=src/art/auto-path.ts
src/styles/candy/auto/state-words.ts=src/art/state-words.ts
src/styles/candy/sets.ts=src/ui/sets.ts
src/styles/candy/when.ts=src/ui/when.ts
src/styles/tokens/__tests__/candy.test.ts=design/contrast.json"
# D-SHAPE: modules the stories call pure (no React, React Native, Expo or Skia), so vitest loads them.
PURE_MODULES="src/styles/tokens/candy-catalogue.ts src/styles/tokens/candy.ts src/styles/tokens/candy-paint.ts src/styles/candy/sets.ts src/styles/candy/when.ts src/styles/candy/kinds.ts src/styles/candy/look-schema.ts src/styles/candy/candy-looks.ts src/styles/candy/motion-pause.ts src/styles/candy/strings.ts src/styles/candy/auto/auto-geometry.ts src/styles/candy/auto/auto-path.ts src/styles/candy/auto/state-words.ts src/styles/candy/auto/clock.ts src/styles/candy/auto/stage.ts src/styles/candy/parts/tab-bar.ts src/styles/homes/candy-home.ts src/styles/candy/home/today.ts src/styles/candy/home/chat.ts src/styles/candy/home/shelf.ts src/styles/candy/home/team.ts src/styles/typeface/candy-type.ts"
# app.json: the expo-font plugin's fonts list, and the whole file with that list emptied.
APP_FONTS='[.expo.plugins[]? | select(type == "array" and .[0] == "expo-font") | .[1].fonts[]?]'
APP_REST='(.expo.plugins[]? | select(type == "array" and .[0] == "expo-font") | .[1].fonts) |= []'

# --- helpers -------------------------------------------------------------------------
changed() { git -c core.quotePath=false diff --no-renames --name-only "$BASE"..HEAD -- "$@"; }
added_code() { git diff "$BASE"..HEAD -- src app ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++'; }
added_code_outside_tokens() { git diff "$BASE"..HEAD -- src app ':!src/styles/tokens' ':!*__tests__*' ':!*.test.ts' ':!*.test.tsx' | grep '^+' | grep -v '^+++'; }
has() { [ -f "$2" ] && grep -qE -e "$1" "$2"; }
flat_has() { [ -f "$2" ] && tr '\n' ' ' < "$2" | grep -qE -e "$1"; }   # a pattern that may span prettier's line breaks
all_exist() { local f; for f in "$@"; do [ -e "$f" ] || { echo "   missing: $f"; return 1; }; done; }
all_gone() { local f; for f in "$@"; do [ ! -e "$f" ] || { echo "   still there: $f"; return 1; }; done; }
need() { local msg="$1"; shift; "$@" || { echo "   missing: $msg"; return 1; }; }
sha_of() { shasum -a 256 "$1" | cut -d' ' -f1; }
kit_text() { jq -r '[.userStories[] | .notes, .acceptanceCriteria[]] | .[]' "$KIT" 2>/dev/null; }
all_done() { jq -e '[.userStories[] | select(.passes != true)] | length == 0' "$KIT" >/dev/null 2>&1; }
skips_ci() { git log -1 --format=%B "${1:-HEAD}" | grep -qiE '\[(skip ci|ci skip|no ci|skip actions|actions skip)\]|skip-checks: *true'; }
every_commit_signed() { [ -z "$(git log --no-merges --format='%H %(trailers:key=Signed-off-by,valueonly)' "$BASE"..HEAD | awk 'NF<2{print $1}')" ]; }
npm_ok() { [ -f package.json ] || { echo "   no package.json in $(pwd) — refusing to run npm (it would climb to a parent)"; return 1; }; }
pin_filled() { [[ "$KIT_PIN" =~ ^[0-9a-f]{40}$ ]] && [[ "$KIT_SHORT" =~ ^[0-9a-f]{7,40}$ ]] && [[ "$KIT_PIN" == "$KIT_SHORT"* ]] \
  || { echo "   the kit pin is not a commit yet (KIT_PIN '$KIT_PIN', KIT_SHORT '$KIT_SHORT'): the lead fills it in"; return 1; }; }
# The workspace (the main checkout's parent): RALPH_WORKSPACE from the runner, else from the shared .git.
workspace_dir() {
  [ -n "${RALPH_WORKSPACE:-}" ] && { echo "$RALPH_WORKSPACE"; return 0; }
  local common; common=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P) || return 1
  dirname "$(dirname "$common")"
}
KIT_DIR="$(workspace_dir)/.worktrees/automatos-design-kit/theme-candy"
# The files a Candy home is built from (any name with 'andy' under homes/, and src/styles/candy/), tests excluded.
candy_home_src() { find src/styles/homes src/styles/candy -type f \( -name '*andy*' -o -path 'src/styles/candy/*' \) ! -path '*__tests__*' ! -name '*.test.ts*' 2>/dev/null; }
in_candy_home() { local files; files=$(candy_home_src); [ -n "$files" ] && grep -qE -e "$1" $files; }
candy_tests_mention() { [ -n "$(find src/styles -path '*__tests__*' -name '*.test.ts*' 2>/dev/null | xargs grep -lE -e "$1" 2>/dev/null)" ]; }
candy_copy() { has "$1" src/styles/candy/strings.ts; }
# A test file whose path matches $1 (and, given $2, whose text matches it): Candy's tests sit in __tests__/ beside each module.
candy_test() {
  local files; files=$(find src/styles src/voice -path '*__tests__*' -name '*.test.ts*' 2>/dev/null | grep -E -e "$1")
  [ -n "$files" ] && { [ -z "${2:-}" ] || grep -qE -e "$2" $files; }
}

outside_ka1() { changed | grep -vE "$KA1_ALLOWED" | grep -vE "$KIT_FILES_RE" | grep -v '^$'; }
seam_paths() { changed | grep -vE '^src/styles/' | grep -vE "$KIT_FILES_RE" | grep -vE "$TEST_RE" | grep -v '^$'; }
seam_notes_ok() {
  local f bad=0 text
  text=$(kit_text)
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    printf '%s\n' "$text" | grep -qF "SEAM EDIT: $f" || { echo "   no 'SEAM EDIT: $f' in the kit's DONE notes"; bad=1; }
  done < <(seam_paths)
  [ $bad -eq 0 ]
}
prd268_files_from_main() {   # PRD-268's files are edited only where main already had them (US-023n, after the base move)
  local f bad=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    git cat-file -e "$BASE:src/$(echo "$f" | cut -d/ -f2)" 2>/dev/null \
      || { echo "   $f: src/$(echo "$f" | cut -d/ -f2) is not on the base — PRD-268's code comes from main, never from this wave"; bad=1; }
  done < <(changed src/brief src/suggestions src/approvals)
  [ $bad -eq 0 ]
}
fonts_only_two_families() { local o; o=$(changed assets/fonts | grep -vE '^assets/fonts/(outfit/|nunito/|SOURCES\.md$)'); [ -z "$o" ] || { echo "$o" | sed 's/^/   other font family: /'; return 1; }; }
app_json_ok() {
  local base_json base_fonts f
  base_json=$(git show "$BASE:app.json" 2>/dev/null) || { echo "   app.json is missing at the base"; return 1; }
  jq -e . app.json >/dev/null 2>&1 || { echo "   app.json is not valid JSON"; return 1; }
  [ "$(printf '%s' "$base_json" | jq -S "$APP_REST")" = "$(jq -S "$APP_REST" app.json)" ] \
    || { echo "   app.json changed outside expo-font's fonts list"; return 1; }
  base_fonts=$(printf '%s' "$base_json" | jq -c "$APP_FONTS")
  jq -e --argjson base "$base_fonts" "$APP_FONTS"' as $head
      | ($head | map(select(. as $f | any($base[]; . == $f)))) == $base
      and ($head | length) == ($head | unique | length)
      and ([$head[] | select(. as $f | any($base[]; . == $f) | not)]
           | all(test("^\\./assets/fonts/(outfit|nunito)/[A-Za-z0-9_-]+\\.ttf$")))' app.json >/dev/null \
    || { echo "   expo-font's fonts: an entry removed or reordered, a duplicate, or an addition outside outfit/ and nunito/"; return 1; }
  for f in $(jq -r "$APP_FONTS | .[]" app.json); do [ -f "$f" ] || { echo "   app.json names a missing file: $f"; return 1; }; done
}
app_json_lists() { jq -e --arg f "./assets/fonts/$1.ttf" "$APP_FONTS | any(. == \$f)" app.json >/dev/null 2>&1; }
file_sizes_ok() {
  local f n bad=0
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    n=$(wc -l < "$f" | tr -d ' '); [ "$n" -le 800 ] || { echo "   $f: $n lines"; bad=1; }
  done < <(changed src app | grep -E '\.(ts|tsx)$')
  [ $bad -eq 0 ]
}
stand_ins_gone() {
  local o; o=$(grep -rn CANDY_STAND_IN src app 2>/dev/null)
  [ -z "$o" ] && return 0
  if ! all_done; then
    echo "   $(printf '%s\n' "$o" | wc -l | tr -d ' ') stand-in(s) left; not every story is DONE yet (US-023n removes the last)"; return 0
  fi
  printf '%s\n' "$o" | sed 's/^/   /'; return 1
}
pure_modules_ok() {
  local f bad=0 hits
  for f in $PURE_MODULES src/styles/candy/look-page/*.ts; do
    [ -f "$f" ] || continue
    case "$f" in *.test.ts|*.d.ts|*/use-*.ts) continue ;; esac   # use-*.ts: a React hook by name
    hits=$(grep -nE "from ['\"](react|react-native|react-native-[^'\"]*|@shopify/react-native-skia|expo|expo-[^'\"]*)(/[^'\"]*)?['\"]|require\\(['\"](react|expo)" "$f" | grep -vE '^[0-9]+:[[:space:]]*import type ')
    [ -z "$hits" ] || { echo "$hits" | sed "s#^#   $f:#"; bad=1; }
  done
  [ $bad -eq 0 ]
}
provenance_ok() {
  local pair f src sha bad=0 kit_ok=1
  pin_filled || return 1
  git -C "$KIT_DIR" cat-file -e "$KIT_PIN^{commit}" 2>/dev/null \
    || { kit_ok=0; echo "   the kit checkout is not reachable here (<workspace>/.worktrees/automatos-design-kit/theme-candy): a sha256 is required, not recomputed"; }
  while IFS= read -r pair; do
    [ -n "$pair" ] || continue
    f="${pair%%=*}"; src="${pair#*=}"
    [ -f "$f" ] || { echo "   missing $f"; bad=1; continue; }
    grep -q "$KIT_SHORT" "$f" || { echo "   $f: no kit commit $KIT_SHORT in its provenance header"; bad=1; }
    grep -qF "$src" "$f" || { echo "   $f: its header does not name themes/candy/$src"; bad=1; }
    if [ $kit_ok -eq 1 ]; then
      sha=$(git -C "$KIT_DIR" show "$KIT_PIN:themes/candy/$src" | shasum -a 256 | cut -d' ' -f1)
      grep -q "$sha" "$f" || { echo "   $f: its header lacks the source's sha256 $sha"; bad=1; }
    else
      grep -qE '[0-9a-f]{64}' "$f" || { echo "   $f: no sha256 in its header"; bad=1; }
    fi
  done <<< "$VENDORED"
  [ $bad -eq 0 ]
}
fonts_ok() {
  local line path want f bad=0 commit
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    path="assets/fonts/${line%%=*}"; want="${line#*=}"
    [ -f "$path" ] || { echo "   missing: $path"; bad=1; continue; }
    [ "$(sha_of "$path")" = "$want" ] || { echo "   $path is not the pinned bytes (sha256 $want)"; bad=1; }
    grep -q "$want" assets/fonts/SOURCES.md || { echo "   SOURCES.md lacks $path's sha256"; bad=1; }
  done <<< "$FONT_SHA256"
  for f in assets/fonts/outfit/*.ttf assets/fonts/nunito/*.ttf; do
    [ -f "$f" ] || continue
    [ "$(head -c 4 "$f" | od -An -tx1 | tr -d ' \n')" = "00010000" ] || { echo "   $f is not a TrueType font"; bad=1; }
  done
  for commit in $OFL_COMMITS; do
    need "SOURCES.md names google/fonts at $commit" grep -q "$commit" assets/fonts/SOURCES.md || bad=1
  done
  need "SOURCES.md names fonts.gstatic.com" grep -q 'fonts.gstatic.com' assets/fonts/SOURCES.md || bad=1
  need "SOURCES.md's opening counts twelve families" grep -qiE 'twelve ([a-z]+ )?families' assets/fonts/SOURCES.md || bad=1
  [ $bad -eq 0 ]
}
prd_boxes_ticked() {   # PRD-001 US-023's boxes, between its heading and the next heading
  local section open
  section=$(awk '/^#### US-023:/{f=1; next} f && /^##/{exit} f' docs/prd/PRD-001-AUTOMATOS-GO-V1.md)
  [ -n "$section" ] || { echo "   no '#### US-023:' section in the PRD"; return 1; }
  printf '%s\n' "$section" | grep -qE '^- \[[xX]\]' || { echo "   no ticked box under US-023"; return 1; }
  open=$(printf '%s\n' "$section" | grep -E '^- \[ \]')
  [ -z "$open" ] || { printf '%s\n' "$open" | sed 's/^/   unticked: /'; return 1; }
}
prd268_wired_or_open() {   # D-CAN-8: each PRD-268 slot on the branch is wired into Candy; each one missing is recorded
  local spec d pr re bad=0 text
  text=$(kit_text)
  for spec in brief:31:brief suggestions:32:suggestion approvals:33:approval; do
    d=${spec%%:*}; pr=$(echo "$spec" | cut -d: -f2); re=${spec##*:}
    if [ -d "src/$d" ]; then
      in_candy_home "['\"](\\.\\./)+$d/" || { echo "   src/$d is on the branch (Go #$pr) but no Candy home file imports it"; bad=1; }
    else
      printf '%s\n' "$text" | grep -qiE "PRD-268 SEAM OPEN: .*($re|#$pr)" || { echo "   src/$d is not on the branch and no 'PRD-268 SEAM OPEN: $d' note"; bad=1; }
    fi
  done
  [ $bad -eq 0 ]
}

# --- one check per story (built from its acceptance criteria) --------------------------
us023a() {
  local b=0 ids="src/styles/registry/style-id.ts"
  need "BUILT_IN_STYLE_IDS = ['studio', 'play', 'hud', 'arcade', 'candy']" flat_has "BUILT_IN_STYLE_IDS = \\[ *'studio', *'play', *'hud', *'arcade', *'candy',? *\\]" $ids || b=1
  need "LAYOUTS = ['studio', 'play', 'hud', 'arcade', 'candy']" flat_has "LAYOUTS = \\[ *'studio', *'play', *'hud', *'arcade', *'candy',? *\\]" $ids || b=1
  need "STYLE_REGISTRY entry('candy', 'candy', 'never')" flat_has "entry\\( *'candy', *'candy', *'never',? *\\)" src/styles/registry/registry.ts || b=1
  need "'automatos/candy': 'candy' in themes/follow.ts" has "'automatos/candy': 'candy'" src/styles/themes/follow.ts || b=1
  need "follow.test.ts covers automatos/candy" has 'automatos/candy' src/styles/themes/__tests__/follow.test.ts || b=1
  need "Candy's tagline in strings.ts" has 'Bright, glossy and round' src/styles/strings.ts || b=1
  need "PICKER_COPY.lookLinks candy: 'Make it sweet'" has "candy: 'Make it sweet'" src/styles/strings.ts || b=1
  need "nav.ts lookCandy: '/settings/look/candy'" has "lookCandy: '/settings/look/candy'" src/styles/nav.ts || b=1
  need "app/(app)/settings/look/candy.tsx with StyleSync" has 'StyleSync' 'app/(app)/settings/look/candy.tsx' || b=1
  need "Candy's own strings module" all_exist src/styles/candy/strings.ts || b=1
  [ $b -eq 0 ]
}
us023b() {
  local b=0 p
  all_exist src/styles/tokens/candy-catalogue.ts src/styles/tokens/candy.ts src/styles/tokens/candy-paint.ts \
    src/styles/tokens/__tests__/candy.test.ts src/styles/tokens/__tests__/candy-paint.test.ts src/styles/candy/sets.ts || b=1
  for p in blush lilac nightbloom '#D73178' '#2675D3' CARD_SETS LAYER_COLOURS SHARED_COLOURS AUTO_COLOURS KIND_SETS DANGER; do
    need "$p in tokens/candy-catalogue.ts" has "$p" src/styles/tokens/candy-catalogue.ts || b=1
  done
  for p in CandyPaintPicks CANDY_VAR_NAMES candyVars CANDY_ROLES candyTokens nearestRadius innerRadius candyGlowAlpha candyShadow; do
    need "$p in tokens/candy.ts" has "$p" src/styles/tokens/candy.ts || b=1
  done
  for p in cardGradient bandGradient orbPaint auraCircles; do
    need "$p in tokens/candy-paint.ts" has "$p" src/styles/tokens/candy-paint.ts || b=1
  done
  need "candyStyleTokens in tokens/style-tokens.ts" has 'candyStyleTokens' src/styles/tokens/style-tokens.ts || b=1
  need "voicePaint's candy branch in tokens/voice-colours.ts" has 'candy' src/styles/tokens/voice-colours.ts || b=1
  need "candyAutoColour in tokens/mascot-colours.ts" has 'candyAutoColour' src/styles/tokens/mascot-colours.ts || b=1
  need "the contrast test measures with contrastRatio" has 'contrastRatio' src/styles/tokens/__tests__/candy.test.ts || b=1
  need "the contrast test holds the kit's Studio triplets (tripletToHex)" has 'tripletToHex' src/styles/tokens/__tests__/candy.test.ts || b=1
  [ $b -eq 0 ]
}
us023c() {
  local b=0 s=src/styles
  all_exist $s/candy/look-schema.ts $s/candy/look-store.ts $s/candy/candy-looks.ts || b=1
  need "candy-look/v1 in candy/look-schema.ts" has 'candy-look/v1' $s/candy/look-schema.ts || b=1
  need "the vendored validateLookSchema in candy/look-schema.ts" has 'validateLookSchema' $s/candy/look-schema.ts || b=1
  need "isCandyLook via the vendored validateLook" has 'validateLook([^S]|$)' $s/candy/look-schema.ts || b=1
  need "isCandyLook in candy/look-schema.ts" has 'isCandyLook' $s/candy/look-schema.ts || b=1
  need "createCandyLooksStore in candy/look-store.ts" has 'createCandyLooksStore' $s/candy/look-store.ts || b=1
  need "the store key 'styles.candy.looks'" has 'styles\.candy\.looks' $s/candy/look-store.ts || b=1
  need "CANDY_THEME_ID 'automatos/candy'" flat_has "CANDY_THEME_ID[^;]*automatos/candy" $s/candy/candy-looks.ts || b=1
  need "CANDY_LOOK_RULES in candy/candy-looks.ts" has 'CANDY_LOOK_RULES' $s/candy/candy-looks.ts || b=1
  need "setNumber in candy/candy-looks.ts" has 'setNumber' $s/candy/candy-looks.ts || b=1
  need "LOOK_THEME_KEYS gains 'candy'" flat_has "LOOK_THEME_KEYS = Object\\.freeze\\(\\[[^]]*'candy'" $s/sync/look-marks.ts || b=1
  need "styles.candy.looks.sync in sync/look-marks.ts" has 'styles\.candy\.looks\.sync' $s/sync/look-marks.ts || b=1
  need "CANDY_LOOK_THEME in sync/look-themes.ts" has 'CANDY_LOOK_THEME' $s/sync/look-themes.ts || b=1
  need "the not-installed words in strings.ts" has "Candy isn.{1,6}t installed in this workspace" $s/strings.ts || b=1
  need "candy in sync/look-sync-run.ts" has 'candy' $s/sync/look-sync-run.ts || b=1
  need "candy in sync/LookSync.tsx" has 'candy' $s/sync/LookSync.tsx || b=1
  need "setCandyLooks in provider/store.ts" has 'setCandyLooks' $s/provider/store.ts || b=1
  need "theme.tsx reads candyLook" has 'candyLook' $s/theme.tsx || b=1
  need "resolve.ts tells a Candy look by its interface" has 'candyLook' $s/provider/resolve.ts || b=1
  need "resolve.test.ts covers Candy" has 'candy' $s/provider/__tests__/resolve.test.ts || b=1
  need "a test PUTs to /api/themes/looks/automatos/candy" candy_tests_mention 'automatos/candy' || b=1
  [ $b -eq 0 ]
}
us023d() {
  local b=0 e
  fonts_ok || b=1
  for e in outfit/Outfit-SemiBold outfit/Outfit-Bold nunito/Nunito-Regular nunito/Nunito-Bold nunito/Nunito-ExtraBold; do
    need "app.json's expo-font list names ./assets/fonts/$e.ttf" app_json_lists "$e" || b=1
  done
  for e in "outfit: 'Outfit'" "nunito: 'Nunito'" Outfit-SemiBold Outfit-Bold Nunito-Regular Nunito-Bold Nunito-ExtraBold; do
    need "$e in src/styles/fonts.ts" has "$e" src/styles/fonts.ts || b=1
  done
  need "FontWeight gains 800" has 'FontWeight = .*800' src/styles/fonts.ts || b=1
  need "fonts.test.ts counts twelve family directories" has 'toHaveLength\(12\)' src/styles/__tests__/fonts.test.ts || b=1
  need "app-config.test.ts counts 28 TTFs" has 'toHaveLength\(28\)' src/config/__tests__/app-config.test.ts || b=1
  need "STYLE_FACES.candy on Outfit" flat_has 'candy.*(outfit|Outfit)' src/styles/typeface/faces.ts || b=1
  need "typeface/candy-type.ts" all_exist src/styles/typeface/candy-type.ts || b=1
  need "TypeSource gains candy" has 'candy' src/styles/typeface/types.ts || b=1
  need "scale.ts gains candy" has 'candy' src/styles/typeface/scale.ts || b=1
  [ $b -eq 0 ]
}
us023e() {
  local b=0 st d=src/styles/candy/auto
  all_exist $d/auto-geometry.ts $d/auto-path.ts $d/state-words.ts $d/clock.ts $d/stage.ts $d/CandyAuto.tsx \
    src/styles/candy/motion-pause.ts src/styles/candy/use-candy-motion.ts src/styles/candy/CandyPauseButton.tsx || b=1
  for st in $MASCOT_STATES; do need "state '$st' in auto/auto-geometry.ts EYE_FORMS" has "$st" $d/auto-geometry.ts || b=1; done
  need "EYE_FORMS in auto/auto-geometry.ts" has 'EYE_FORMS' $d/auto-geometry.ts || b=1
  need "motionAt in auto/clock.ts" has 'motionAt' $d/clock.ts || b=1
  need "the 3 s float in auto/clock.ts" has '3000|3_000' $d/clock.ts || b=1
  need "BLINK_PERIODS_MS in auto/clock.ts" has 'BLINK_PERIODS_MS' $d/clock.ts || b=1
  need "CandyAuto draws with Skia" has '@shopify/react-native-skia' $d/CandyAuto.tsx || b=1
  need "CandyAuto draws the vendored paths (shapePath)" has 'shapePath' $d/CandyAuto.tsx || b=1
  need "CandyAuto's colours from candyAutoColour" grep -rq 'candyAutoColour' $d 2>/dev/null || b=1
  need "VoiceOver hears Auto's caption (captionFor)" grep -rqE 'captionFor' $d 2>/dev/null || b=1
  need "motion-pause.ts on 'styles.candy.motionPaused'" has 'styles\.candy\.motionPaused' src/styles/candy/motion-pause.ts || b=1
  need "setCandyMotionPaused in provider/store.ts" has 'setCandyMotionPaused' src/styles/provider/store.ts || b=1
  need "'Pause the animation' in candy/strings.ts" candy_copy 'Pause the animation' || b=1
  need "'Play the animation' in candy/strings.ts" candy_copy 'Play the animation' || b=1
  need "clock tests" candy_tests_mention 'motionAt' || b=1
  need "stage tests" candy_tests_mention 'stageOf' || b=1
  [ $b -eq 0 ]
}
us023f() {
  local b=0 d=src/styles/candy/parts
  all_exist $d/GradientCard.tsx $d/Orb.tsx $d/Band.tsx $d/TabBar.tsx $d/tab-bar.ts $d/Pill.tsx $d/StatusChip.tsx \
    $d/Avatar.tsx $d/WritingChip.tsx || b=1
  need "the gradient parts draw with Skia" flat_has '@shopify/react-native-skia' $d/GradientCard.tsx || b=1
  need "the orb draws with Skia" has '@shopify/react-native-skia' $d/Orb.tsx || b=1
  need "the tab bar's items are tabs" has 'accessibilityRole' $d/TabBar.tsx || b=1
  need "tabBarMetrics in parts/tab-bar.ts" has 'tabBarMetrics' $d/tab-bar.ts || b=1
  need "tab bar tests" candy_test 'candy/parts/__tests__/tab-bar\.test' 'tabBarMetrics' || b=1
  need "'Auto is writing' in candy/strings.ts" candy_copy 'Auto is writing' || b=1
  [ $b -eq 0 ]
}
us023g() {
  local b=0 h
  all_exist src/styles/homes/CandyHome.tsx src/styles/homes/use-candy-home.ts src/styles/homes/candy-home.ts \
    src/styles/candy/home/today.ts src/styles/candy/home/TodayView.tsx src/styles/candy/when.ts \
    src/styles/candy/__tests__/pause-reach.test.ts src/voice/home/use-candy-home-voice.ts || b=1
  need "HOME_OF gains candy" has 'candy' src/styles/homes/layout.ts || b=1
  need "StyleHome draws CandyHome" has 'CandyHome' src/styles/homes/StyleHome.tsx || b=1
  for h in useHomeThread useNeedsYou useHomeMenu useMessageReport useCandyHomeVoice boardQuery TabBar Orb needsStrip useFollowLink CandyPauseButton; do
    need "$h in the Candy home" in_candy_home "$h" || b=1
  done
  need "greetingFor in candy/home/today.ts" has 'greetingFor' src/styles/candy/home/today.ts || b=1
  need "'need you' in candy/strings.ts" candy_copy 'need you' || b=1
  need "useCandyHomeVoice over useQuickAsk" has 'useQuickAsk' src/voice/home/use-candy-home-voice.ts || b=1
  need "the pause-reach test names CandyPauseButton" has 'CandyPauseButton' src/styles/candy/__tests__/pause-reach.test.ts || b=1
  need "today tests" candy_test 'candy/home/__tests__/today\.test' || b=1
  need "candy-home tests" candy_test 'homes/__tests__/candy-home\.test' || b=1
  [ $b -eq 0 ]
}
us023h() {
  local b=0 d=src/styles/candy/home
  all_exist $d/ChatStage.tsx $d/ChatView.tsx $d/chat.ts $d/CandyComposer.tsx src/styles/candy/kinds.ts || b=1
  need "the AI label in the Chat view" in_candy_home 'AiLabel' || b=1
  need "the stage draws Auto" has 'CandyAuto' $d/ChatStage.tsx || b=1
  need "the stage draws the pause" has 'CandyPauseButton' $d/ChatStage.tsx || b=1
  need "the writing chip in the Chat view" in_candy_home 'WritingChip' || b=1
  need "A2's threadRows under chat.ts" has 'threadRows|view-model' $d/chat.ts || b=1
  need "'Message Auto' in candy/strings.ts" candy_copy 'Message Auto' || b=1
  need "routes.cc.deliverable from the Chat view" in_candy_home 'cc\.deliverable' || b=1
  need "chat tests" candy_test 'candy/home/__tests__/chat\.test' || b=1
  need "kinds tests" candy_test 'candy/__tests__/kinds\.test' || b=1
  [ $b -eq 0 ]
}
us023i() {
  local b=0 d=src/styles/candy/home
  all_exist $d/ShelfView.tsx $d/shelf.ts || b=1
  need "the shelf reads A3's gallery (useGallery)" in_candy_home 'useGallery' || b=1
  need "'Spreadsheets' in candy/strings.ts" candy_copy 'Spreadsheets' || b=1
  need "the shelf's words for an empty shelf" candy_copy 'Your shelf is empty' || b=1
  need "routes.cc.deliverables from the shelf" in_candy_home 'cc\.deliverables' || b=1
  need "shelf tests" candy_test 'candy/home/__tests__/shelf\.test' || b=1
  [ $b -eq 0 ]
}
us023j() {
  local b=0 d=src/styles/candy/home
  all_exist $d/TeamView.tsx $d/team.ts || b=1
  need "the team reads the chat's agents (agentsQuery)" in_candy_home 'agentsQuery' || b=1
  need "'Your team' in candy/strings.ts" candy_copy 'Your team' || b=1
  need "team tests" candy_test 'candy/home/__tests__/team\.test' || b=1
  [ $b -eq 0 ]
}
us023k() {
  local b=0
  need "dress.ts candy()" flat_has 'function candy *\(|const candy *=' src/styles/dress/dress.ts || b=1
  need "candyButtons and candyPaints in dress/paints.ts" flat_has 'candyButtons.*candyPaints|candyPaints.*candyButtons' src/styles/dress/paints.ts || b=1
  need "cc-dress.ts paints candy" has 'candy' src/styles/dress/cc-dress.ts || b=1
  need "ground.ts plans candy" has 'candy' src/styles/ground/ground.ts || b=1
  need "src/ui/Slider.tsx shapes candy" has 'candy' src/ui/Slider.tsx || b=1
  need "a cc-dress test covers candy" candy_test 'cc-dress[^/]*\.test' 'candy' || b=1
  need "ground.test.ts covers candy" has 'candy' src/styles/ground/__tests__/ground.test.ts || b=1
  [ $b -eq 0 ]
}
us023l() {
  local b=0 t
  all_exist src/styles/edges/CandyEdgeWindow.tsx || b=1
  need "edges/paint.ts pick has candy" has 'candy' src/styles/edges/paint.ts || b=1
  need "edges/parts.tsx brands candy" has 'candy' src/styles/edges/parts.tsx || b=1
  need "the edge window draws Auto" has 'CandyAuto' src/styles/edges/CandyEdgeWindow.tsx || b=1
  need "the edge window draws the pause" has 'CandyPauseButton' src/styles/edges/CandyEdgeWindow.tsx || b=1
  need "an edges test covers candy" candy_test 'edges/__tests__/' 'candy' || b=1
  need "voice/screen/dress.ts has a candy branch" has 'candy' src/voice/screen/dress.ts || b=1
  need "the voice screen draws Candy's pause" has 'CandyPauseButton' src/voice/screen/VoiceScreen.tsx || b=1
  for t in dress core-props nav; do need "src/voice/__tests__/$t.test.ts covers candy" has 'candy' "src/voice/__tests__/$t.test.ts" || b=1; done
  [ $b -eq 0 ]
}
us023m() {
  local b=0 d=src/styles/candy/look-page
  all_exist $d/CandyLookPage.tsx src/styles/picker/previews/CandyPreview.tsx || b=1
  all_gone src/styles/candy/CandyLookStandIn.tsx || b=1
  need "look/candy.tsx renders StyleSync then CandyLookPage" flat_has 'StyleSync.*CandyLookPage|CandyLookPage.*StyleSync' 'app/(app)/settings/look/candy.tsx' || b=1
  need "radiogroup / radio roles on the page" grep -rqE "radiogroup" $d 2>/dev/null || b=1
  need "the Motion row is a Switch" grep -rqE "<Switch\\b" $d 2>/dev/null || b=1
  need "saveAsNew from the look page" grep -rq 'saveAsNew' $d 2>/dev/null || b=1
  need "the look page draws the pause" grep -rq 'CandyPauseButton' $d 2>/dev/null || b=1
  need "'Motion off · Reduce Motion' in candy/strings.ts" candy_copy 'Motion off · Reduce Motion' || b=1
  [ -n "$(find $d -maxdepth 1 -name '*.ts' ! -name '*.d.ts' ! -name 'use-*.ts' 2>/dev/null)" ] || { echo "   missing: pure page rules in candy/look-page/*.ts"; b=1; }
  [ -n "$(find $d -path '*__tests__*' -name '*.test.ts*' 2>/dev/null)" ] || candy_tests_mention 'look-page/' \
    || { echo "   missing: tests of the look page's rules"; b=1; }
  need "PREVIEWS draws CandyPreview" has 'CandyPreview' src/styles/picker/previews/StylePreview.tsx || b=1
  need "picker/cards.ts gains candy" has 'candy' src/styles/picker/cards.ts || b=1
  [ $b -eq 0 ]
}
us023n() {
  local b=0
  need "docs/styles-and-themes.md describes five layouts and automatos/candy" flat_has '[Ff]ive (built-in )?(styles|layouts).*automatos/candy|automatos/candy.*[Ff]ive (built-in )?(styles|layouts)' docs/styles-and-themes.md || b=1
  need "CLAUDE.md names Candy" has 'Candy' CLAUDE.md || b=1
  ! grep -qiE 'four (styles|layouts)' CLAUDE.md || { echo "   CLAUDE.md still says 'four styles' or 'four layouts'"; b=1; }
  prd_boxes_ticked || b=1
  prd268_wired_or_open || b=1
  [ $b -eq 0 ]
}

echo ""; echo "=== Kit"
check "the kit's design-kit pin is a commit (KIT_PIN, KIT_SHORT)" "pin_filled"
check "kit JSON valid; every story passes:true" "jq -e '[.userStories[] | select(.passes != true)] | length == 0' $KIT >/dev/null"
check "every acceptance criterion carries a DONE mark" "jq -e '[.userStories[] | .acceptanceCriteria[] | select(contains(\"→ DONE\") | not)] | length == 0' $KIT >/dev/null"

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
check "expo-doctor (as CI runs it)" "npm_ok && npx --yes expo-doctor"
check "every config plugin evaluates (expo config --type introspect)" "npm_ok && npx --no-install expo config --type introspect >/dev/null"

echo ""; echo "=== KA1-FILES, KA5-SEAMS, KA2, KA3, KA4: the wave's files"
check "every changed path is inside KA1-FILES" "o=\$(outside_ka1); [ -z \"\$o\" ] || { echo \"\$o\" | sed 's/^/   outside KA1: /'; false; }"
check "package.json, package-lock.json, eas.json, .eas, .github, src/core, core.lock.json, src/api, src/navigation/routes.ts untouched (KA1, KA4)" "git diff --quiet $BASE..HEAD -- package.json package-lock.json eas.json .eas .github src/core core.lock.json src/api src/navigation/routes.ts"
check "the AI label is untouched (D-AI-LABEL)" "git diff --quiet $BASE..HEAD -- src/styles/ai-label.tsx"
check "app.json: only expo-font's fonts list, only outfit/ and nunito/ added (D-CAN-4, jq)" "app_json_ok"
check "assets/fonts: only outfit/, nunito/ and SOURCES.md change (KA1)" "fonts_only_two_families"
check "PRD-268's files edited only where main already has them (KA1, US-023n)" "prd268_files_from_main"
check "every changed path outside src/styles/ has a 'SEAM EDIT: <path>' note (KA5)" "seam_notes_ok"
check "no CANDY_STAND_IN left in src or app once every story is DONE (KA2)" "stand_ins_gone"
check "vendored files carry the kit path, the pinned commit and the source's sha256 (KA3)" "provenance_ok"
check "the wave's pure modules import no React, React Native, Expo or Skia (D-SHAPE)" "pure_modules_ok"
check "no changed source file over 800 lines (D-SHAPE)" "file_sizes_ok"

echo ""; echo "=== Stories"
check "US-023a the fifth style id, the theme mapping, the picker entry and its words" "us023a"
check "US-023b the palettes and gradients as tokens: catalogue, variables, Studio's tokens, the paint model" "us023b"
check "US-023c the looks: schema, presets, number knobs, the phone's store, sync through the looks API" "us023c"
check "US-023d Outfit and Nunito bundled, app.json's font list, the type scale" "us023d"
check "US-023e Auto with Skia: vendored geometry, one clock, the stage's states, the pause control" "us023e"
check "US-023f the parts: gradient card, orb, band, tab bar, pills, status chips, avatars, writing chip" "us023f"
check "US-023g the Candy home over A2's thread, the tab bar with A6's voice, P1 Today" "us023g"
check "US-023h P2 Chat: the stage, the thread with the AI label, the composer and voice" "us023h"
check "US-023i P3 Shelf: the Deliverables grid" "us023i"
check "US-023j P4 Team: the agents" "us023j"
check "US-023k the shared screens in Candy's dress" "us023k"
check "US-023l the edge screens and the voice screen in Candy" "us023l"
check "US-023m Make it sweet (the look page) and Candy's card in the picker" "us023m"
check "US-023n PRD-268's slots, the docs, the PRD's US-023 boxes" "us023n"

echo ""; echo "=== Contract (negative, added lines only)"
check "no WebView (D-NO-WEBVIEW)" "! added_code | grep -q 'react-native-webview'"
check "no fetch( outside the client (D-CAN-6: no new endpoint, HTTP only through src/api)" "! added_code | grep -E '(^|[^.A-Za-z0-9_])fetch\\(' | grep -q ."
check "no colour literal outside src/styles/tokens (D-TOKENS)" "! added_code_outside_tokens | grep -E \"['\\\"\\\`]#[0-9A-Fa-f]{3,8}['\\\"\\\`]|(rgba?|hsla?)\\(\" | grep -q ."
check "no module the native build lacks (KA4)" "! added_code | grep -qE \"from ['\\\"](@react-native-community/slider|@react-native-community/blur|expo-blur|expo-clipboard|@react-native-clipboard/clipboard|lottie-react-native|react-native-linear-gradient)['\\\"]\""
check "nothing evaluated as code from a theme or the server (D-NO-CODE)" "! added_code | grep -qE '(^|[^A-Za-z0-9_.])eval\\(|new Function\\(|injectedJavaScript'"
check "no server polling (refetchInterval)" "! added_code | grep -q 'refetchInterval'"
check "no '%2F' in a looks route (D-CAN-3: the theme id travels as path segments)" "! added_code | grep -qiE 'looks/automatos%2F'"
check "no pointer to creating an account (D-NO-SIGNUP)" "! added_code | grep -iE 'create (an|one|your) account|no account\\?' | grep -q ."
check "no sign-up copy in the styles strings (D-NO-SIGNUP)" "! git diff $BASE..HEAD -- src/styles/strings.ts src/styles/candy/strings.ts | grep '^+' | grep -qiE 'sign[ -]?up'"
check "no plans, credits or prices in the copy (D8)" "! git diff $BASE..HEAD -- src/styles/strings.ts src/styles/candy/strings.ts | grep '^+' | grep -qiE 'credits?|pricing|price|upgrade|subscription'"
check "no local machine path in any added line (public repo)" "! git diff $BASE..HEAD | grep '^+' | grep -qE '/Users/[A-Za-z]'"
check "no commit message names an EAS skip token (it would skip delivery)" "! git log --format=%B $BASE..HEAD | grep -qiE '\\[(eas skip|skip eas|no eas)\\]'"
check "every commit is signed off (DCO)" "every_commit_signed"
warn  "story commits carry [skip ci] (all but the wave's CI commit)" "[ -z \"\$(git log --no-merges --format='%s' $BASE..HEAD^ | grep -v 'skip ci' | grep -viE 'candy built, run CI')\" ]"

ci_commit_for_head() {
  local sha; sha=$(git rev-parse HEAD)
  while skips_ci "$sha" && [ -z "$(git show --format= --name-only "$sha" | grep -v '^scripts/ralph/')" ]; do
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
  local br sha r id concl jobs job bad
  br=$(git rev-parse --abbrev-ref HEAD); sha=$(ci_commit_for_head)
  [ "$sha" = "$(git rev-parse HEAD)" ] || echo "   HEAD is kit-only [skip ci] commits over $(git log -1 --format=%h "$sha"): reading that commit's runs"
  command -v gh >/dev/null || { echo "   gh is required"; return 1; }
  [ -n "$(gh pr list --head "$br" --state open --json number --jq '.[0].number' 2>/dev/null)" ] || { echo "   no open PR for $br: ci.yml runs on pull_request (and push to main) only"; return 1; }
  r=$(wait_run ci.yml "$sha") || { echo "$r"; return 1; }
  id="${r%% *}"
  jobs=$(gh run view "$id" --json jobs --jq '.jobs[] | "\(.conclusion)\t\(.name)"')
  for job in "${CI_JOBS[@]}"; do
    printf '%s\n' "$jobs" | awk -F'\t' -v j="$job" 'index($2, j) {found=1} END {exit !found}' || { echo "   missing job: $job"; return 1; }
    bad=$(printf '%s\n' "$jobs" | awk -F'\t' -v j="$job" 'index($2, j) && $1 != "success"' | wc -l | tr -d ' ')
    [ "$bad" = "0" ] || { echo "   red: $job"; return 1; }
  done
  r=$(wait_run malware-scan.yml "$sha") || { echo "$r"; return 1; }
  concl="${r##* }"; [ "$concl" = "success" ] || { echo "   malware-scan: $concl"; return 1; }
  echo "   ci.yml run $id green on ${sha:0:9} (${CI_JOBS[*]}); malware-scan green"
}
if [ "$MODE" = full ]; then
  echo ""; echo "=== CI (once, on the wave's PR)"
  check "the PR head is a CI commit (no [skip ci]), so the required checks run on it" "! skips_ci HEAD"
  check "CI: both ci.yml jobs and malware-scan green on the tested commit" "ci_green_on_head"
fi
echo ""
if [ "$FAIL" -eq 0 ]; then echo "✅ PRD-001 candy acceptance ($MODE): PASS"; else echo "❌ PRD-001 candy acceptance ($MODE): FAIL"; fi
exit "$FAIL"
