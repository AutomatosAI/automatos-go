#!/bin/bash
# Launcher — Automatos Go PRD-001 wave A9: Candy, the fifth style (kit: candy).
#
# Run it where the kit sits (Gerard, or a Claude session at his request — 20 Oct: Claude may launch and monitor):
# the worktree's committed copy, or a copy in the automatos-go main checkout's scripts/ralph/.
#
#   <workspace>/.worktrees/automatos-go/feat+a9-candy/scripts/ralph/launch-prd001-candy.sh
#   RALPH_STOP_AT=07:30 …/scripts/ralph/launch-prd001-candy.sh
#   RALPH_BASE_MOVE=1 …/scripts/ralph/launch-prd001-candy.sh    # merge origin/main into feat/a9-candy first
#
# ONE phase, on origin/main. feat/a9-candy already exists in <workspace>/.worktrees/automatos-go/feat+a9-candy with
# its own first commit (this kit, the runner and launcher included, and Gerard's PRD-001 addendum: §4.6.2, US-023,
# wave A9): the launcher resumes on it as is. The kit must be committed (a dirty worktree is refused) and its
# design-kit pin filled in (the placeholder is refused). Before US-023n's session the runner fetches origin and,
# when origin/main has commits the branch lacks, merges it in: one signed '[skip ci]' merge commit; a conflict
# aborts the merge, lists the files and stops the run as BLOCKED. RALPH_BASE_MOVE=1 does the same merge here, at
# launch; a conflict aborts it and stops the launch.
#
# Works from the automatos-go main checkout (found through git's common dir: logs, state and setup-worktree.sh
# live there) but never touches its working tree or its branch: all work happens in the worktree on feat/a9-candy
# (cut by the runner from origin/main if it is ever missing).
#
# One PR per wave, one CI run: story commits are ' [skip ci]' and pushed only as a backup; the runner opens the
# wave's draft PR when the build is COMPLETE (its head is the one commit without [skip ci]) and the gate reads that
# PR's CI run. One review cycle; the PR stays a draft for Gerard.
#
# Model: RALPH_MODEL=claude-opus-5-5, pinned; the runner passes it to every claude call (unattended runs never
# float). Billing: SUBSCRIPTION — ANTHROPIC_API_KEY is intentionally not exported.
#
# Refuses: on battery (RALPH_ALLOW_BATTERY=1 overrides), a dirty worktree, env files in the worktree, a missing
# base or one without docs/prd/PRD-001-AUTOMATOS-GO-V1.md, another branch for this wave on origin, this kit's loop
# already running, any OTHER Ralph loop (overnight-*.sh of any repo) unless RALPH_ALLOW_PARALLEL=1, and a failed
# base move.
set -uo pipefail
export PATH="/opt/homebrew/bin:$HOME/.local/bin:$PATH"
KIT_SRC="$(cd "$(dirname "$0")" && pwd)"            # this kit's files (the runner reads its own the same way)
COMMON_DIR="$(git -C "$KIT_SRC" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" \
  || { echo "[launch] ABORT: cannot find the automatos-go repository from $KIT_SRC" >&2; exit 1; }
REPO="$(dirname "$COMMON_DIR")"                      # the automatos-go main checkout, from the worktree too
PLATFORM="$(dirname "$REPO")"
KIT="candy"
NUM="001-$KIT"
RUNNER="overnight-prd$NUM.sh"
BR="feat/a9-candy"
export RALPH_BASE_REF="origin/main"           # one phase on main: no stacked base
BASE_REF="$RALPH_BASE_REF"
SIBLING=""                                    # kits whose loops may run beside this one (regex alternation; empty = none)
WAVE_RE='a9-candy'                            # double-build guard: any other origin branch matching this
BASE_MOVE_MSG="chore(prd-001): A9 base move — merge origin/main [skip ci]"   # the runner's, word for word
WT="$PLATFORM/.worktrees/automatos-go/$(echo "$BR" | tr '/' '+')"
cd "$REPO" || exit 1
mkdir -p scripts/ralph/logs scripts/ralph/state     # in the main checkout: never on the branch
LOG="scripts/ralph/logs/launch-prd$NUM-$(date +%F-%H%M).log"
export RALPH_WORKSPACE="$PLATFORM"            # the kit json's <workspace>; the sessions read it from the env
export RALPH_MODEL="${RALPH_MODEL:-claude-opus-5-5}"   # pinned: unattended runs never float
export RALPH_MAX_ITERS="${RALPH_MAX_ITERS:-24}"
export RALPH_ITER_TIMEOUT="${RALPH_ITER_TIMEOUT:-75m}"
export RALPH_REVIEW_TIMEOUT="${RALPH_REVIEW_TIMEOUT:-45m}"
say() { echo "[launch-$NUM] $*"; }
die() { echo "[launch-$NUM] ABORT: $*" >&2; exit 1; }
# Anchored on the process name: the runner shows as "/bin/bash ./scripts/ralph/overnight-prd001-<kit>.sh <kit>".
loop_pattern() { echo "^[^ ]*bash [^ ]*scripts/ralph/overnight-prd001-$1\\.sh( |\$)"; }
ANY_LOOP='^[^ ]*bash [^ ]*scripts/ralph/(overnight-[^ ]*|run)\.sh'

# --- Node 22 (CI's version, eas-cli's floor; Expo SDK 54 needs >= 20.19) -------------
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true
case "$(node -v 2>/dev/null)" in
  v22.*) say "node $(node -v)" ;;
  *) die "could not select Node 22 (got '$(node -v 2>/dev/null || echo none)') — nvm install 22." ;;
esac

if command -v pmset >/dev/null 2>&1 && ! pmset -g batt 2>/dev/null | head -1 | grep -q "AC Power"; then
  [ "${RALPH_ALLOW_BATTERY:-0}" = "1" ] || die "on battery power — plug in (or set RALPH_ALLOW_BATTERY=1)."
  say "⚠️  on battery (RALPH_ALLOW_BATTERY=1)."
fi

# --- the kit (committed on the branch; KIT_SRC is where this launcher sits) ----------------
KIT_FILES=("$KIT_SRC/prd-$NUM.json" "$KIT_SRC/PROMPT_build_prd$NUM.md" "$KIT_SRC/PROMPT_review_prd$NUM.md" \
           "$KIT_SRC/acceptance-prd$NUM.sh" "$KIT_SRC/$RUNNER" "$KIT_SRC/launch-prd$NUM.sh")
for f in "${KIT_FILES[@]}" "scripts/ralph/setup-worktree.sh"; do
  [ -f "$f" ] || die "missing $f"
done
jq -e '.userStories | length > 0' "$KIT_SRC/prd-$NUM.json" >/dev/null || die "prd-$NUM.json is not valid kit JSON."
bash -n "$KIT_SRC/acceptance-prd$NUM.sh" && bash -n "$KIT_SRC/$RUNNER" && bash -n scripts/ralph/setup-worktree.sh \
  || die "a kit script does not parse."
# The kit is committed to a PUBLIC repo: no local machine path in any of its files.
LEAK=$(grep -lE '/Users/[A-Za-z]' "${KIT_FILES[@]}" 2>/dev/null || true)
[ -z "$LEAK" ] || die "a kit file names a local path (public repo): $LEAK"
# The design kit's commit replaces the pin placeholder in the json, the prompts and the gate before any run (KA3).
PIN_LEFT=$(grep -lE 'KIT_CANDY''_PIN' "${KIT_FILES[@]}" 2>/dev/null || true)
[ -z "$PIN_LEFT" ] || die "the design-kit pin is still a placeholder in: $PIN_LEFT — fill in the commit (the 40-character form first)."

for cmd in claude jq gh git npm; do command -v "$cmd" >/dev/null || die "missing $cmd"; done
gh auth status >/dev/null 2>&1 || die "gh is not authenticated (the wave's one CI run needs its draft PR)."
command -v timeout >/dev/null || command -v gtimeout >/dev/null || die "missing timeout/gtimeout (brew install coreutils)."

say "fetching origin…"
git fetch origin --quiet --prune || die "git fetch failed."
git rev-parse -q --verify "$BASE_REF" >/dev/null || die "base $BASE_REF does not exist."
git cat-file -e "$BASE_REF:docs/prd/PRD-001-AUTOMATOS-GO-V1.md" 2>/dev/null || die "$BASE_REF does not carry docs/prd/PRD-001-AUTOMATOS-GO-V1.md."
say "the wave is on $BASE_REF $(git rev-parse --short "$BASE_REF")."

# --- the worktree, if it already exists: right branch, clean, no env files ---------------
if [ -d "$WT" ]; then
  [ "$(git -C "$WT" rev-parse --abbrev-ref HEAD)" = "$BR" ] || die "$WT is not on $BR."
  for f in .env .env.local; do [ ! -f "$WT/$f" ] || die "$WT/$f exists — remove it (no env files in a Ralph worktree)."; done
  DIRTY=$(git -C "$WT" status --porcelain 2>/dev/null | grep -v 'node_modules' || true)
  [ -z "$DIRTY" ] || { echo "$DIRTY" | sed "s/^/[launch-$NUM]     /" >&2; die "$WT has uncommitted changes (above)."; }
  # Run from a copy outside the worktree, kit files on the branch are (re-)seeded from it (except a tracked json).
  for f in PROMPT_build_prd$NUM.md PROMPT_review_prd$NUM.md acceptance-prd$NUM.sh $RUNNER launch-prd$NUM.sh; do
    [ "$KIT_SRC/$f" -ef "$WT/scripts/ralph/$f" ] && continue
    if [ ! -f "$WT/scripts/ralph/$f" ]; then say "note: $f is not on the branch yet — the runner seeds it."
    elif ! cmp -s "$KIT_SRC/$f" "$WT/scripts/ralph/$f"; then say "note: $f differs between $KIT_SRC and the branch — the runner re-seeds it."
    fi
  done
  OWN=$(git -C "$WT" rev-list --count "$BASE_REF"..HEAD)
  say "$BR has $OWN commit(s) of its own ($(git -C "$WT" log -1 --format='%h %s' HEAD)) — resuming on it as is."
else
  say "the runner cuts $BR from $BASE_REF into $WT"
fi

# --- double-build guard: no OTHER branch for this wave on origin ----------------------
DUPE=$(git ls-remote --heads origin 2>/dev/null | awk '{print $2}' | sed 's#refs/heads/##' | grep -E "$WAVE_RE" | grep -vx "$BR" || true)
[ -z "$DUPE" ] || { echo "$DUPE" | sed "s/^/[launch-$NUM]     /" >&2; die "another branch for this wave exists on origin (above)."; }

# --- one loop per kit; any other Ralph loop needs the override (no sibling kit for this wave) ----
pgrep -f "$(loop_pattern "$KIT")" >/dev/null 2>&1 && die "a PRD-$NUM run is already going (pgrep -f '$(loop_pattern "$KIT")')."
OTHER=$(pgrep -fl "$ANY_LOOP" 2>/dev/null || true)
if [ -n "$SIBLING" ]; then OTHER=$(echo "$OTHER" | grep -vE "overnight-prd001-($SIBLING)\\.sh" || true); fi
OTHER=$(echo "$OTHER" | grep -v '^$' || true)
if [ -n "$OTHER" ]; then
  echo "$OTHER" | sed "s/^/[launch-$NUM]     /" >&2
  [ "${RALPH_ALLOW_PARALLEL:-0}" = "1" ] || die "another Ralph loop is running (above). Wait for it, or set RALPH_ALLOW_PARALLEL=1."
  say "⚠️  running beside the loop(s) above (RALPH_ALLOW_PARALLEL=1)."
fi

# --- the base move: origin/main into the branch (RALPH_BASE_MOVE=1 now; the runner before US-023n) ----
if [ -d "$WT" ]; then
  BEHIND=$(git -C "$WT" rev-list --count "HEAD..$BASE_REF")
  if [ "$BEHIND" -gt 0 ] && [ "${RALPH_BASE_MOVE:-0}" = "1" ]; then
    BEFORE=$(git -C "$WT" rev-parse HEAD)
    say "base move: merging $BASE_REF ($(git rev-parse --short "$BASE_REF"), $BEHIND commit(s)) into $BR…"
    if ! git -C "$WT" -c core.hooksPath=/var/empty merge --no-ff --signoff --no-edit -m "$BASE_MOVE_MSG" "$BASE_REF"; then
      CONFLICTS=$(git -C "$WT" diff --name-only --diff-filter=U 2>/dev/null || true)
      git -C "$WT" merge --abort 2>/dev/null || true
      echo "$CONFLICTS" | sed "s/^/[launch-$NUM]     conflict: /" >&2
      die "the base move conflicts (above; merge aborted) — resolve it by hand in $WT (the seams are listed in the kit's SEAM EDIT notes), then relaunch."
    fi
    say "base move: $(git -C "$WT" log -1 --format='%h %s')"
    if ! git -C "$WT" diff --quiet "$BEFORE" HEAD -- package-lock.json; then
      rm -rf "$WT/node_modules"
      say "package-lock.json moved with the base: node_modules removed; the runner re-provisions it (setup-worktree.sh)."
    fi
  elif [ "$BEHIND" -gt 0 ]; then
    say "note: $BASE_REF has $BEHIND commit(s) $BR lacks — the runner merges them before US-023n (RALPH_BASE_MOVE=1 merges them now)."
  elif [ "${RALPH_BASE_MOVE:-0}" = "1" ]; then
    say "RALPH_BASE_MOVE=1: $BR already carries $BASE_REF — nothing to merge."
  fi
elif [ "${RALPH_BASE_MOVE:-0}" = "1" ]; then
  say "RALPH_BASE_MOVE=1: no worktree yet — the runner cuts $BR from $BASE_REF, so there is nothing to merge."
fi

J="$WT/scripts/ralph/prd-$NUM.json"; [ -f "$J" ] || J="$KIT_SRC/prd-$NUM.json"
LEFT=$(jq -r '[.userStories[] | select(.passes != true) | .id] | join(" ")' "$J")
[ -n "$LEFT" ] || say "every story is DONE — the runner only re-checks CI, the gate and the review."
say "Automatos Go PRD-001 wave A9 Candy ($RALPH_MODEL, $(jq '.userStories | length' "$J") stories in one phase, left: ${LEFT:-none}; cap $RALPH_MAX_ITERS × $RALPH_ITER_TIMEOUT, no simulator, no EAS)"
say "owner checks after the build: ownerTest in $J"
say "worktree : $WT"
say "live log : tail -f $REPO/$LOG"
say "per-kit  : $REPO/scripts/ralph/logs/prd$NUM-{build,review,acceptance}-$(date +%F).log"
say "report   : $REPO/scripts/ralph/night-report-prd$NUM-$(date +%F).md"
say "state    : $REPO/scripts/ralph/state/prd$NUM.status  (delete to force a re-run)"

nohup "$KIT_SRC/$RUNNER" "$KIT" > "$LOG" 2>&1 &
say "detached PID $! — running. Close this terminal anytime."
