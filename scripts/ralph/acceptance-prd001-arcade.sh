#!/bin/bash
# Acceptance gate — Automatos Go PRD-001 wave A8: Arcade, the fourth style (kit: arcade).
#   bash scripts/ralph/acceptance-prd001-arcade.sh                # full: local checks + the wave's one CI run
#   bash scripts/ralph/acceptance-prd001-arcade.sh --no-ci        # local checks only (what a build session runs)
#   bash scripts/ralph/acceptance-prd001-arcade.sh --print-base   # the diff base every check uses
#   bash scripts/ralph/acceptance-prd001-arcade.sh --print-phase  # always 1: the wave has one phase
#   GATE_BASE=<ref> overrides the base (smoke runs only).
# Base: the merge-base with origin/main (main when origin/main is missing). The branch's own first commit, the
# PRD-001 addendum (§4.6.1, US-022), is part of the wave's diff. The base move (origin/main merged into the branch
# before US-022k, or at launch with RALPH_BASE_MOVE=1) moves the merge-base, so main's own changes never read as
# this wave's. Local checks are pure Node: what CI runs (typecheck, lint, vitest, check:core, check:routes,
# expo-doctor, the iOS bundle) plus `expo config --type introspect`, because US-022d changes app.json.
# KA1-FILES is an ALLOWLIST of changed paths; KA5-SEAMS a 'SEAM EDIT: <path>' note for every changed path outside
# src/styles/ (tests and this kit's own files excepted); KA2-STAND-IN no ARCADE_STAND_IN once every story is DONE;
# KA3-VENDOR-PIN provenance headers whose sha256 is the kit source's at 034fa629c (recomputed when the kit
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

KIT=scripts/ralph/prd-001-arcade.json
CI_JOBS=("typecheck · lint · test" "expo-doctor · iOS bundle")
MASCOT_STATES="hello idle listening thinking working searching reading celebrate oops sleeping lost loading"
KIT_PIN=034fa629c8ba79cff042559ca2d132f6d38f6d23   # the design kit (AutomatosAI/automatos-design-kit), themes/arcade (KA3)
KIT_SHORT=034fa629c
PS2P_SHA256=034c77f1f05ec89421e4a63f0e3a4ca1ecf852cc6d2bf611f126f275728e017d   # US-022d: the kit's press-start-2p-regular.ttf
PIXELIFY_COMMIT=39df74aba80df8157546034b878e8be1eb565ced                       # US-022d: eifetx/Pixelify-Sans
KIT_FILES_RE='^scripts/ralph/(prd-001-arcade\.json|PROMPT_build_prd001-arcade\.md|PROMPT_review_prd001-arcade\.md|acceptance-prd001-arcade\.sh)$'
TEST_RE='(^|/)__tests__/|\.test\.tsx?$'
# KA1-FILES: the only paths this wave may add or change (the tests beside each included).
KA1_ALLOWED='^(src/chat/|src/cc/|src/release/__tests__/support/surfaces\.ts$|src/config/__tests__/app-config\.test\.ts$|src/styles/|src/ui/(Slider\.tsx|dressed\.ts)$|src/ui/__tests__/|src/voice/home/(use-)?arcade-home-voice\.ts$|src/voice/home/__tests__/|src/voice/screen/|src/voice/nav\.ts$|src/voice/__tests__/|app/\(app\)/settings/look/arcade\.tsx$|assets/fonts/(press-start-2p/|pixelify-sans/|SOURCES\.md$)|app\.json$|docs/styles-and-themes\.md$|docs/prd/PRD-001-AUTOMATOS-GO-V1\.md$|CLAUDE\.md$|src/(brief|suggestions|approvals)/)'
# KA3: each vendored file and the kit source (under themes/arcade/) whose sha256 its header must carry.
VENDORED="src/styles/tokens/arcade-catalogue.ts=src/looks/catalogue.ts src/styles/arcade/sprite/grid.ts=src/art/grid.ts src/styles/arcade/sprite/auto-sprite.ts=src/art/auto-sprite.ts src/styles/arcade/sprite/states.ts=src/art/states.ts src/styles/arcade/look-schema.ts=looks/schema.json"
# D-SHAPE: modules the stories call pure (no React, React Native, Expo or Skia), so vitest loads them.
PURE_MODULES="src/styles/tokens/arcade-catalogue.ts src/styles/tokens/arcade.ts src/styles/arcade/look-schema.ts src/styles/arcade/arcade-looks.ts src/styles/arcade/motion-pause.ts src/styles/arcade/typewriter.ts src/styles/arcade/sprite/grid.ts src/styles/arcade/sprite/auto-sprite.ts src/styles/arcade/sprite/states.ts src/styles/arcade/sprite/clock.ts src/styles/arcade/sprite/turn-state.ts src/styles/homes/arcade-home.ts src/styles/arcade/arcade-home.ts"
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
need() { local msg="$1"; shift; "$@" || { echo "   missing: $msg"; return 1; }; }
sha_of() { shasum -a 256 "$1" | cut -d' ' -f1; }
kit_text() { jq -r '[.userStories[] | .notes, .acceptanceCriteria[]] | .[]' "$KIT" 2>/dev/null; }
all_done() { jq -e '[.userStories[] | select(.passes != true)] | length == 0' "$KIT" >/dev/null 2>&1; }
skips_ci() { git log -1 --format=%B "${1:-HEAD}" | grep -qiE '\[(skip ci|ci skip|no ci|skip actions|actions skip)\]|skip-checks: *true'; }
every_commit_signed() { [ -z "$(git log --no-merges --format='%H %(trailers:key=Signed-off-by,valueonly)' "$BASE"..HEAD | awk 'NF<2{print $1}')" ]; }
npm_ok() { [ -f package.json ] || { echo "   no package.json in $(pwd) — refusing to run npm (it would climb to a parent)"; return 1; }; }
# The workspace (the main checkout's parent): RALPH_WORKSPACE from the runner, else from the shared .git.
workspace_dir() {
  [ -n "${RALPH_WORKSPACE:-}" ] && { echo "$RALPH_WORKSPACE"; return 0; }
  local common; common=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P) || return 1
  dirname "$(dirname "$common")"
}
KIT_DIR="$(workspace_dir)/.worktrees/automatos-design-kit/kit-arcade-official"
# The files an Arcade home is built from (any name with 'rcade' under homes/, and src/styles/arcade/), tests excluded.
arcade_home_src() { find src/styles/homes src/styles/arcade -type f \( -name '*rcade*' -o -path 'src/styles/arcade/*' \) ! -path '*__tests__*' ! -name '*.test.ts*' 2>/dev/null; }
in_arcade_home() { local files; files=$(arcade_home_src); [ -n "$files" ] && grep -qE -e "$1" $files; }
arcade_tests_mention() { [ -n "$(find src/styles -path '*__tests__*' -name '*.test.ts*' 2>/dev/null | xargs grep -lE -e "$1" 2>/dev/null)" ]; }

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
prd268_files_from_main() {   # PRD-268's files are edited only where main already had them (US-022k, after the base move)
  local f bad=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    git cat-file -e "$BASE:src/$(echo "$f" | cut -d/ -f2)" 2>/dev/null \
      || { echo "   $f: src/$(echo "$f" | cut -d/ -f2) is not on the base — PRD-268's code comes from main, never from this wave"; bad=1; }
  done < <(changed src/brief src/suggestions src/approvals)
  [ $bad -eq 0 ]
}
fonts_only_two_families() { local o; o=$(changed assets/fonts | grep -vE '^assets/fonts/(press-start-2p/|pixelify-sans/|SOURCES\.md$)'); [ -z "$o" ] || { echo "$o" | sed 's/^/   other font family: /'; return 1; }; }
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
           | all(test("^\\./assets/fonts/(press-start-2p|pixelify-sans)/[A-Za-z0-9_-]+\\.ttf$")))' app.json >/dev/null \
    || { echo "   expo-font's fonts: an entry removed or reordered, a duplicate, or an addition outside press-start-2p/ and pixelify-sans/"; return 1; }
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
  local o; o=$(grep -rn ARCADE_STAND_IN src app 2>/dev/null)
  [ -z "$o" ] && return 0
  if ! all_done; then
    echo "   $(printf '%s\n' "$o" | wc -l | tr -d ' ') stand-in(s) left; not every story is DONE yet (US-022k removes the last)"; return 0
  fi
  printf '%s\n' "$o" | sed 's/^/   /'; return 1
}
pure_modules_ok() {
  local f bad=0 hits
  for f in $PURE_MODULES src/styles/arcade/look-page/*.ts; do
    [ -f "$f" ] || continue
    case "$f" in *.test.ts|*.d.ts|*/use-*.ts) continue ;; esac   # use-*.ts: a React hook by name
    hits=$(grep -nE "from ['\"](react|react-native|react-native-[^'\"]*|@shopify/react-native-skia|expo|expo-[^'\"]*)(/[^'\"]*)?['\"]|require\\(['\"](react|expo)" "$f" | grep -vE '^[0-9]+:[[:space:]]*import type ')
    [ -z "$hits" ] || { echo "$hits" | sed "s#^#   $f:#"; bad=1; }
  done
  [ $bad -eq 0 ]
}
provenance_ok() {
  local pair f src sha bad=0 kit_ok=1
  git -C "$KIT_DIR" cat-file -e "$KIT_PIN^{commit}" 2>/dev/null \
    || { kit_ok=0; echo "   the kit checkout is not reachable here (<workspace>/.worktrees/automatos-design-kit/kit-arcade-official): a sha256 is required, not recomputed"; }
  for pair in $VENDORED; do
    f="${pair%%=*}"; src="${pair#*=}"
    [ -f "$f" ] || { echo "   missing $f"; bad=1; continue; }
    grep -q "$KIT_SHORT" "$f" || { echo "   $f: no kit commit $KIT_SHORT in its provenance header"; bad=1; }
    grep -qF "$src" "$f" || { echo "   $f: its header does not name themes/arcade/$src"; bad=1; }
    if [ $kit_ok -eq 1 ]; then
      sha=$(git -C "$KIT_DIR" show "$KIT_PIN:themes/arcade/$src" | shasum -a 256 | cut -d' ' -f1)
      grep -q "$sha" "$f" || { echo "   $f: its header lacks the source's sha256 $sha"; bad=1; }
    else
      grep -qE '[0-9a-f]{64}' "$f" || { echo "   $f: no sha256 in its header"; bad=1; }
    fi
  done
  [ $bad -eq 0 ]
}
fonts_ok() {
  local f bad=0
  all_exist assets/fonts/press-start-2p/PressStart2P-Regular.ttf assets/fonts/press-start-2p/OFL.txt \
    assets/fonts/pixelify-sans/PixelifySans-Regular.ttf assets/fonts/pixelify-sans/PixelifySans-SemiBold.ttf \
    assets/fonts/pixelify-sans/OFL.txt || return 1
  [ "$(sha_of assets/fonts/press-start-2p/PressStart2P-Regular.ttf)" = "$PS2P_SHA256" ] \
    || { echo "   PressStart2P-Regular.ttf is not the pinned bytes (sha256 $PS2P_SHA256)"; bad=1; }
  for f in assets/fonts/press-start-2p/*.ttf assets/fonts/pixelify-sans/*.ttf; do
    [ "$(head -c 4 "$f" | od -An -tx1 | tr -d ' \n')" = "00010000" ] || { echo "   $f is not a TrueType font"; bad=1; }
    grep -q "$(sha_of "$f")" assets/fonts/SOURCES.md || { echo "   SOURCES.md lacks $f's sha256"; bad=1; }
  done
  need "SOURCES.md names eifetx/Pixelify-Sans at $PIXELIFY_COMMIT" grep -q "$PIXELIFY_COMMIT" assets/fonts/SOURCES.md || bad=1
  need "SOURCES.md names google/fonts ofl/pressstart2p" grep -q 'ofl/pressstart2p' assets/fonts/SOURCES.md || bad=1
  need "SOURCES.md's opening counts ten families" grep -qiE 'ten ([a-z]+ )?families' assets/fonts/SOURCES.md || bad=1
  [ $bad -eq 0 ]
}
prd_boxes_ticked() {   # PRD-001 US-022's boxes, between its heading and the next heading
  local section open
  section=$(awk '/^#### US-022:/{f=1; next} f && /^##/{exit} f' docs/prd/PRD-001-AUTOMATOS-GO-V1.md)
  [ -n "$section" ] || { echo "   no '#### US-022:' section in the PRD"; return 1; }
  printf '%s\n' "$section" | grep -qE '^- \[[xX]\]' || { echo "   no ticked box under US-022"; return 1; }
  open=$(printf '%s\n' "$section" | grep -E '^- \[ \]')
  [ -z "$open" ] || { printf '%s\n' "$open" | sed 's/^/   unticked: /'; return 1; }
}
prd268_wired_or_open() {   # D-ARC-7: each PRD-268 slot on the branch is wired into Arcade; each one missing is recorded
  local spec d pr re bad=0 text
  text=$(kit_text)
  for spec in brief:31:brief suggestions:32:suggestion approvals:33:approval; do
    d=${spec%%:*}; pr=$(echo "$spec" | cut -d: -f2); re=${spec##*:}
    if [ -d "src/$d" ]; then
      in_arcade_home "['\"](\\.\\./)+$d/" || { echo "   src/$d is on the branch (Go #$pr) but no Arcade home file imports it"; bad=1; }
    else
      printf '%s\n' "$text" | grep -qiE "PRD-268 SEAM OPEN: .*($re|#$pr)" || { echo "   src/$d is not on the branch and no 'PRD-268 SEAM OPEN: $d' note"; bad=1; }
    fi
  done
  [ $bad -eq 0 ]
}

# --- one check per story (built from its acceptance criteria) --------------------------
us022a() {
  local b=0 ids="src/styles/registry/style-id.ts"
  need "BUILT_IN_STYLE_IDS = ['studio', 'play', 'hud', 'arcade']" flat_has "BUILT_IN_STYLE_IDS = \\[ *'studio', *'play', *'hud', *'arcade',? *\\]" $ids || b=1
  need "LAYOUTS = ['studio', 'play', 'hud', 'arcade']" flat_has "LAYOUTS = \\[ *'studio', *'play', *'hud', *'arcade',? *\\]" $ids || b=1
  need "STYLE_REGISTRY entry('arcade', 'arcade', 'never')" flat_has "entry\\( *'arcade', *'arcade', *'never',? *\\)" src/styles/registry/registry.ts || b=1
  need "'automatos/arcade': 'arcade' in themes/follow.ts" has "'automatos/arcade': 'arcade'" src/styles/themes/follow.ts || b=1
  need "follow.test.ts covers automatos/arcade" has 'automatos/arcade' src/styles/themes/__tests__/follow.test.ts || b=1
  need "Arcade's tagline in strings.ts" has 'Your agents as a party, Auto in the dialogue box' src/styles/strings.ts || b=1
  need "PICKER_COPY.lookLinks arcade: 'Options'" has "arcade: 'Options'" src/styles/strings.ts || b=1
  need "nav.ts lookArcade: '/settings/look/arcade'" has "lookArcade: '/settings/look/arcade'" src/styles/nav.ts || b=1
  need "app/(app)/settings/look/arcade.tsx with StyleSync" has 'StyleSync' 'app/(app)/settings/look/arcade.tsx' || b=1
  [ $b -eq 0 ]
}
us022b() {
  local b=0 p
  all_exist src/styles/tokens/arcade-catalogue.ts src/styles/tokens/arcade.ts src/styles/tokens/__tests__/arcade.test.ts || b=1
  for p in overworld dungeon neon nightcity handheld SPRITE_COLOURS ICON_COLOURS AGENT_COLOURS SCAN_INK SCAN_ALPHA; do
    need "$p in tokens/arcade-catalogue.ts" has "$p" src/styles/tokens/arcade-catalogue.ts || b=1
  done
  for p in ArcadePaintPicks ARCADE_VAR_NAMES arcadeVars ARCADE_ROLES arcadeTokens; do
    need "$p in tokens/arcade.ts" has "$p" src/styles/tokens/arcade.ts || b=1
  done
  need "arcadeStyleTokens in tokens/style-tokens.ts" has 'arcadeStyleTokens' src/styles/tokens/style-tokens.ts || b=1
  need "voicePaint's arcade branch in tokens/voice-colours.ts" has 'arcade' src/styles/tokens/voice-colours.ts || b=1
  need "the contrast test measures with contrastRatio" has 'contrastRatio' src/styles/tokens/__tests__/arcade.test.ts || b=1
  [ $b -eq 0 ]
}
us022c() {
  local b=0 s=src/styles
  all_exist $s/arcade/look-schema.ts $s/arcade/look-store.ts $s/arcade/arcade-looks.ts || b=1
  need "arcade-look/v1 in arcade/look-schema.ts" has 'arcade-look/v1' $s/arcade/look-schema.ts || b=1
  need "the vendored validateLookSchema in arcade/look-schema.ts" has 'validateLookSchema' $s/arcade/look-schema.ts || b=1
  need "isArcadeLook via the vendored validateLook" has 'validateLook([^S]|$)' $s/arcade/look-schema.ts || b=1
  need "isArcadeLook in arcade/look-schema.ts" has 'isArcadeLook' $s/arcade/look-schema.ts || b=1
  need "createArcadeLooksStore in arcade/look-store.ts" has 'createArcadeLooksStore' $s/arcade/look-store.ts || b=1
  need "the store key 'styles.arcade.looks'" has 'styles\.arcade\.looks' $s/arcade/look-store.ts || b=1
  need "ARCADE_THEME_ID 'automatos/arcade'" flat_has "ARCADE_THEME_ID[^;]*automatos/arcade" $s/arcade/arcade-looks.ts || b=1
  need "ARCADE_LOOK_RULES in arcade/arcade-looks.ts" has 'ARCADE_LOOK_RULES' $s/arcade/arcade-looks.ts || b=1
  need "LOOK_THEME_KEYS gains 'arcade'" flat_has "LOOK_THEME_KEYS = Object\\.freeze\\(\\[[^]]*'arcade'" $s/sync/look-marks.ts || b=1
  need "ARCADE_LOOK_THEME in sync/look-themes.ts" has 'ARCADE_LOOK_THEME' $s/sync/look-themes.ts || b=1
  need "the not-installed words in strings.ts" has "Arcade isn.{1,6}t installed in this workspace" $s/strings.ts || b=1
  need "arcade in sync/look-sync-run.ts" has 'arcade' $s/sync/look-sync-run.ts || b=1
  need "arcade in sync/LookSync.tsx" has 'arcade' $s/sync/LookSync.tsx || b=1
  need "setArcadeLooks in provider/store.ts" has 'setArcadeLooks' $s/provider/store.ts || b=1
  need "arcadeLooks in provider/store.ts" has 'arcadeLooks' $s/provider/store.ts || b=1
  need "theme.tsx reads arcadeLook" has 'arcadeLook' $s/theme.tsx || b=1
  need "resolve.ts tells an Arcade look by its interface" has "'arcade'" $s/provider/resolve.ts || b=1
  need "resolve.test.ts covers Arcade" has 'arcade' $s/provider/__tests__/resolve.test.ts || b=1
  need "a test PUTs to /api/themes/looks/automatos/arcade" arcade_tests_mention 'automatos/arcade' || b=1
  [ $b -eq 0 ]
}
us022d() {
  local b=0 e
  fonts_ok || b=1
  for e in press-start-2p/PressStart2P-Regular pixelify-sans/PixelifySans-Regular pixelify-sans/PixelifySans-SemiBold; do
    need "app.json's expo-font list names ./assets/fonts/$e.ttf" app_json_lists "$e" || b=1
  done
  for e in pressStart2p 'Press Start 2P' pixelifySans 'Pixelify Sans' PressStart2P-Regular PixelifySans-Regular PixelifySans-SemiBold; do
    need "$e in src/styles/fonts.ts" has "$e" src/styles/fonts.ts || b=1
  done
  need "fonts.test.ts counts ten family directories" has 'toHaveLength\(10\)' src/styles/__tests__/fonts.test.ts || b=1
  need "STYLE_FACES.arcade on Press Start 2P" flat_has 'arcade.*(pressStart2p|Press Start 2P)' src/styles/typeface/faces.ts || b=1
  [ -f src/styles/typeface/arcade-type.ts ] || [ -f src/styles/tokens/arcade-type.ts ] || { echo "   missing: typeface/arcade-type.ts (or tokens/arcade-type.ts)"; b=1; }
  need "TypeSource gains arcade" has 'arcade' src/styles/typeface/types.ts || b=1
  need "scale.ts gains arcade" has 'arcade' src/styles/typeface/scale.ts || b=1
  [ $b -eq 0 ]
}
us022e() {
  local b=0 st d=src/styles/arcade/sprite
  all_exist $d/grid.ts $d/auto-sprite.ts $d/states.ts $d/clock.ts $d/turn-state.ts $d/PixelSprite.tsx src/styles/arcade/motion-pause.ts || b=1
  for st in $MASCOT_STATES; do need "state '$st' in sprite/states.ts" has "$st" $d/states.ts || b=1; done
  need "SPRITE_TICKS in sprite/clock.ts" has 'SPRITE_TICKS' $d/clock.ts || b=1
  need "CURSOR_TICKS in sprite/clock.ts" has 'CURSOR_TICKS' $d/clock.ts || b=1
  need "the 60 ms tick in sprite/clock.ts" has '(^|[^0-9])60([^0-9]|$)' $d/clock.ts || b=1
  need "frameAt in sprite/clock.ts" has 'frameAt' $d/clock.ts || b=1
  need "cursorOn in sprite/clock.ts" has 'cursorOn' $d/clock.ts || b=1
  need "PixelSprite draws with Skia" has '@shopify/react-native-skia' $d/PixelSprite.tsx || b=1
  need "the sprite takes SPRITE_COLOURS from the tokens" grep -rq 'SPRITE_COLOURS' $d 2>/dev/null || b=1
  need "motion-pause.ts on 'styles.arcade.motionPaused'" has 'styles\.arcade\.motionPaused' src/styles/arcade/motion-pause.ts || b=1
  need "'Pause the animation' in strings.ts" has 'Pause the animation' src/styles/strings.ts || b=1
  need "'Play the animation' in strings.ts" has 'Play the animation' src/styles/strings.ts || b=1
  need "a test pins the frame sequence (frameAt)" arcade_tests_mention 'frameAt' || b=1
  need "turn-state tests" arcade_tests_mention 'turn-state' || b=1
  [ $b -eq 0 ]
}
us022f() {
  local b=0 p d=src/styles/arcade/parts
  all_exist $d/ArcadeWindow.tsx $d/Scanlines.tsx $d/StatusBar.tsx $d/DPad.tsx $d/VoiceSurround.tsx $d/DialogueWindow.tsx src/styles/arcade/typewriter.ts || b=1
  need "ARCADE_COPY in strings.ts" has 'ARCADE_COPY' src/styles/strings.ts || b=1
  for p in Quests Inventory 'done today'; do need "'$p' in strings.ts" has "$p" src/styles/strings.ts || b=1; done
  need "the D-pad's targets are buttons" has 'accessibilityRole' $d/DPad.tsx || b=1
  need "the dialogue window's portrait is the PixelSprite" has 'PixelSprite' $d/DialogueWindow.tsx || b=1
  need "typewriter.ts knows instant, normal and slow" flat_has "instant.*normal.*slow|slow.*normal.*instant" src/styles/arcade/typewriter.ts || b=1
  need "typewriter tests" arcade_tests_mention 'typewriter' || b=1
  [ $b -eq 0 ]
}
us022g() {
  local b=0 h
  all_exist src/styles/homes/ArcadeHome.tsx src/voice/home/use-arcade-home-voice.ts || b=1
  [ -f src/styles/homes/arcade-home.ts ] || [ -f src/styles/arcade/arcade-home.ts ] || { echo "   missing: arcade-home.ts (pure view logic)"; b=1; }
  need "HOME_OF gains arcade" has 'arcade' src/styles/homes/layout.ts || b=1
  need "StyleHome draws ArcadeHome" has 'ArcadeHome' src/styles/homes/StyleHome.tsx || b=1
  for h in useHomeThread useNeedsYou useHomeMenu useMessageReport useArcadeHomeVoice DialogueWindow StatusBar DPad AiLabel; do
    need "$h in the Arcade home" in_arcade_home "$h" || b=1
  done
  need "D-pad ▲ Quests → routes.cc.board" in_arcade_home 'cc\.board' || b=1
  need "D-pad ▶ Inventory → routes.cc.deliverables" in_arcade_home 'cc\.deliverables' || b=1
  need "useArcadeHomeVoice over useQuickAsk" has 'useQuickAsk' src/voice/home/use-arcade-home-voice.ts || b=1
  need "arcade-home tests" arcade_tests_mention 'arcade-home' || b=1
  [ $b -eq 0 ]
}
us022h() {
  local b=0
  need "dress.ts arcade()" flat_has 'function arcade *\(|const arcade *=' src/styles/dress/dress.ts || b=1
  need "arcadeButtons and arcadePaints in dress/paints.ts" flat_has 'arcadeButtons.*arcadePaints|arcadePaints.*arcadeButtons' src/styles/dress/paints.ts || b=1
  need "cc-dress.ts paints arcade" has 'arcade' src/styles/dress/cc-dress.ts || b=1
  need "ground.ts plans arcade" has 'arcade' src/styles/ground/ground.ts || b=1
  need "src/ui/Slider.tsx shapes arcade" has 'arcade' src/ui/Slider.tsx || b=1
  need "cc-dress.test.ts covers arcade" has 'arcade' src/styles/__tests__/cc-dress.test.ts || b=1
  need "ground.test.ts covers arcade" has 'arcade' src/styles/ground/__tests__/ground.test.ts || b=1
  [ $b -eq 0 ]
}
us022i() {
  local b=0 t
  need "edges/paint.ts pick has arcade" has 'arcade' src/styles/edges/paint.ts || b=1
  need "edges/parts.tsx brands arcade" has 'arcade' src/styles/edges/parts.tsx || b=1
  need "the edge screens draw the sprite (PixelSprite)" grep -rq 'PixelSprite' src/styles/edges || b=1
  need "the edge screens sit in an ArcadeWindow" grep -rq 'ArcadeWindow' src/styles/edges || b=1
  need "edges.test.ts covers arcade" has 'arcade' src/styles/edges/__tests__/edges.test.ts || b=1
  need "voice/screen/dress.ts has an arcade branch" has 'arcade' src/voice/screen/dress.ts || b=1
  for t in dress core-props nav; do need "src/voice/__tests__/$t.test.ts covers arcade" has 'arcade' "src/voice/__tests__/$t.test.ts" || b=1; done
  [ $b -eq 0 ]
}
us022j() {
  local b=0 d=src/styles/arcade/look-page
  all_exist $d/ArcadeLookPage.tsx src/styles/picker/previews/ArcadePreview.tsx || b=1
  need "look/arcade.tsx renders StyleSync then ArcadeLookPage" flat_has 'StyleSync.*ArcadeLookPage|ArcadeLookPage.*StyleSync' 'app/(app)/settings/look/arcade.tsx' || b=1
  need "radiogroup / radio roles on the knobs" grep -rqE "radiogroup" $d 2>/dev/null || b=1
  need "saveAsNew from the look page" grep -rq 'saveAsNew' $d 2>/dev/null || b=1
  [ -n "$(find $d -maxdepth 1 -name '*.ts' ! -name '*.d.ts' ! -name 'use-*.ts' 2>/dev/null)" ] || { echo "   missing: pure page rules in arcade/look-page/*.ts"; b=1; }
  [ -n "$(find $d -path '*__tests__*' -name '*.test.ts*' 2>/dev/null)" ] || arcade_tests_mention 'look-page/' \
    || { echo "   missing: tests of the look page's rules"; b=1; }
  need "PREVIEWS draws ArcadePreview" has 'ArcadePreview' src/styles/picker/previews/StylePreview.tsx || b=1
  need "picker/cards.ts gains arcade" has 'arcade' src/styles/picker/cards.ts || b=1
  [ $b -eq 0 ]
}
us022l() {
  local b=0
  all_exist src/styles/arcade/parts/PartyStrip.tsx src/styles/arcade/home/party.ts || b=1
  need "the party under the status bar in the Arcade home" in_arcade_home 'PartyStrip' || b=1
  need "party state from needs-you" has 'agent_name' src/styles/arcade/home/party.ts || b=1
  need "party tests" arcade_tests_mention 'party' || b=1
  [ $b -eq 0 ]
}
us022m() {
  local b=0
  all_exist src/styles/arcade/map/world-map.ts src/styles/arcade/home/QuestsView.tsx src/styles/arcade/home/quests.ts || b=1
  need "world-map.ts names its kit source and commit" grep -q 'themes/arcade/src/art/world-map.ts' src/styles/arcade/map/world-map.ts || b=1
  need "world-map.ts's sha256 at the pinned commit" has "$(git -C "$KIT_DIR" show "$KIT_PIN:themes/arcade/src/art/world-map.ts" 2>/dev/null | shasum -a 256 | cut -d' ' -f1)" src/styles/arcade/map/world-map.ts || b=1
  need "the map drawn with Skia" grep -rq '@shopify/react-native-skia' src/styles/arcade/home/QuestsView.tsx src/styles/arcade/map 2>/dev/null || b=1
  need "quests view in the Arcade home" in_arcade_home 'QuestsView' || b=1
  need "the quiet map's words" grep -rq 'The map is quiet' src/styles || b=1
  need "quests tests" arcade_tests_mention 'quests' || b=1
  [ $b -eq 0 ]
}
us022n() {
  local b=0
  all_exist src/styles/arcade/home/InventoryView.tsx src/styles/arcade/home/inventory.ts || b=1
  need "inventory view in the Arcade home" in_arcade_home 'InventoryView' || b=1
  need "the empty bag's words" grep -rq 'Your bag is empty' src/styles || b=1
  need "inventory tests" arcade_tests_mention 'inventory' || b=1
  [ $b -eq 0 ]
}
us022k() {
  local b=0
  need "docs/styles-and-themes.md describes four layouts and automatos/arcade" flat_has '[Ff]our (built-in )?(styles|layouts).*automatos/arcade|automatos/arcade.*[Ff]our (built-in )?(styles|layouts)' docs/styles-and-themes.md || b=1
  need "CLAUDE.md names Arcade" has 'Arcade' CLAUDE.md || b=1
  ! grep -qi 'three styles' CLAUDE.md || { echo "   CLAUDE.md still says 'three styles'"; b=1; }
  prd_boxes_ticked || b=1
  prd268_wired_or_open || b=1
  [ $b -eq 0 ]
}

echo ""; echo "=== Kit"
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
check "app.json: only expo-font's fonts list, only press-start-2p/ and pixelify-sans/ added (D-ARC-4, jq)" "app_json_ok"
check "assets/fonts: only press-start-2p/, pixelify-sans/ and SOURCES.md change (KA1)" "fonts_only_two_families"
check "PRD-268's files edited only where main already has them (KA1, US-022k)" "prd268_files_from_main"
check "every changed path outside src/styles/ has a 'SEAM EDIT: <path>' note (KA5)" "seam_notes_ok"
check "no ARCADE_STAND_IN left in src or app once every story is DONE (KA2)" "stand_ins_gone"
check "vendored files carry the kit path, commit $KIT_SHORT and the source's sha256 (KA3)" "provenance_ok"
check "the wave's pure modules import no React, React Native, Expo or Skia (D-SHAPE)" "pure_modules_ok"
check "no changed source file over 800 lines (D-SHAPE)" "file_sizes_ok"

echo ""; echo "=== Stories"
check "US-022a the fourth style id, the theme mapping, the picker entry and its words" "us022a"
check "US-022b the palettes as tokens: the vendored catalogue, Arcade's variables, Studio's tokens" "us022b"
check "US-022c the looks: schema, presets, the phone's store, sync through the looks API" "us022c"
check "US-022d Press Start 2P and Pixelify Sans bundled, app.json's font list, the type scale" "us022d"
check "US-022e Auto as the pixel sprite: vendored drawing, the 60 ms clock, Skia, the pause control" "us022e"
check "US-022f the parts: window, scanlines, status bar, D-pad, voice surround, typewriter" "us022f"
check "US-022g the Arcade home over A2's thread: composer, voice, the D-pad's ways out" "us022g"
check "US-022h the shared screens in Arcade's dress" "us022h"
check "US-022i the edge screens and the voice screen in Arcade" "us022i"
check "US-022j Options (the look page) and Arcade's card in the picker" "us022j"
check "US-022l the party strip" "us022l"
check "US-022m Quests: the overworld map" "us022m"
check "US-022n Inventory: the item grid" "us022n"
check "US-022k PRD-268's slots, the docs, the PRD's US-022 boxes" "us022k"

echo ""; echo "=== Contract (negative, added lines only)"
check "no WebView (D-NO-WEBVIEW)" "! added_code | grep -q 'react-native-webview'"
check "no fetch( outside the client (D-ARC-6: no new endpoint, HTTP only through src/api)" "! added_code | grep -E '(^|[^.A-Za-z0-9_])fetch\\(' | grep -q ."
check "no colour literal outside src/styles/tokens (D-TOKENS)" "! added_code_outside_tokens | grep -E \"['\\\"\\\`]#[0-9A-Fa-f]{3,8}['\\\"\\\`]|(rgba?|hsla?)\\(\" | grep -q ."
check "no module the native build lacks (KA4)" "! added_code | grep -qE \"from ['\\\"](@react-native-community/slider|expo-blur|expo-clipboard|@react-native-clipboard/clipboard|lottie-react-native)['\\\"]\""
check "nothing evaluated as code from a theme or the server (D-NO-CODE)" "! added_code | grep -qE '(^|[^A-Za-z0-9_.])eval\\(|new Function\\(|injectedJavaScript'"
check "no server polling (refetchInterval)" "! added_code | grep -q 'refetchInterval'"
check "no pointer to creating an account (D-NO-SIGNUP)" "! added_code | grep -iE 'create (an|one|your) account|no account\\?' | grep -q ."
check "no sign-up copy in the styles strings (D-NO-SIGNUP)" "! git diff $BASE..HEAD -- src/styles/strings.ts | grep '^+' | grep -qiE 'sign[ -]?up'"
check "no plans, credits or prices in the copy (D8)" "! git diff $BASE..HEAD -- src/styles/strings.ts | grep '^+' | grep -qiE 'credits?|pricing|price|upgrade|subscription'"
check "no local machine path in any added line (public repo)" "! git diff $BASE..HEAD | grep '^+' | grep -qE '/Users/[A-Za-z]'"
check "no commit message names an EAS skip token (it would skip delivery)" "! git log --format=%B $BASE..HEAD | grep -qiE '\\[(eas skip|skip eas|no eas)\\]'"
check "every commit is signed off (DCO)" "every_commit_signed"
warn  "story commits carry [skip ci] (all but the wave's CI commit)" "[ -z \"\$(git log --no-merges --format='%s' $BASE..HEAD^ | grep -v 'skip ci' | grep -viE 'arcade built, run CI')\" ]"

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
if [ "$FAIL" -eq 0 ]; then echo "✅ PRD-001 arcade acceptance ($MODE): PASS"; else echo "❌ PRD-001 arcade acceptance ($MODE): FAIL"; fi
exit "$FAIL"
