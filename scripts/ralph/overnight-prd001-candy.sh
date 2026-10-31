#!/bin/bash

# Ralph runner — Automatos Go, PRD-001 wave A9: Candy, the fifth style (kit: candy).
#
# Topology: branch feat/a9-candy on origin/main, in its own worktree
#   <workspace>/.worktrees/automatos-go/<branch, / → +>  (owner rule 2026-09-16: never inside a checkout).
# The worktree already exists with its own first commit (this kit and Gerard's PRD-001 addendum: §4.6.2, US-023,
# wave A9); ensure_worktree reuses it. Unlike A8's, this kit is COMMITTED on the branch, the runner and launcher
# included: the kit's own files are read from the folder this script sits in (KIT_SRC: the worktree's
# scripts/ralph/, or a copy in the main checkout's), while the state, logs, night reports and setup-worktree.sh
# stay in the automatos-go MAIN checkout's scripts/ralph/ (found through git's common dir, wherever this runs
# from: never written on the branch). seed_scaffolding copies the kit onto the branch only where the branch's
# copy differs (never the tracked json, which carries the DONE marks); run from the worktree there is nothing to
# copy. The kit's design-kit pin (a placeholder in the json, prompts and gate until the lead fills in the commit)
# must be filled in before a launch: preflight refuses otherwise. Bash reads a script as it runs: never edit this
# file in the worktree while a run is going.
#
# Derived from overnight-prd001-arcade.sh (A8) — same loop, usage-limit handling, sentinels, state file, report,
# acceptance gate, draft PR and review — with what this wave needs:
#   - ONE phase on origin/main (no phase 2, no foundation stack: the PR's base is main);
#   - the base move before US-023n (D-CAN-8): before that story's session the runner fetches origin and, when
#     origin/main has commits the branch lacks, merges it in, signed, '[skip ci]', exactly as the launcher's
#     RALPH_BASE_MOVE=1 does; a conflict aborts the merge, lists the files and stops the run as BLOCKED; a moved
#     package-lock.json re-provisions node_modules;
#   - ONE review cycle (Gerard: one review, then his): findings become fix stories, the build loop builds them,
#     the gate runs again, and the PR goes to Gerard without a second review;
#   - the wave's CI head never carries [skip ci] (ensure_ci_head), and no commit message, PR title or body names
#     an EAS skip token (it would skip delivery: eas_skip_free);
#   - the PR body is drawn from the kit json and says the merge is a native build (D-CAN-4: app.json's fonts).
# Kept from every kit since PRD-259/260: worktree under <workspace>/.worktrees/; provisioning on both paths, no
# env files; sentinels on the reply's LAST non-empty line only (<= 80 chars), from the LAST result event; ONE
# push for CI, ONE PR, ONE CI run (story commits ' [skip ci]', pushed only as an offsite backup; ci.yml runs on
# pull_request and push-to-main only); FINDINGS checked before PASS; signed seed and merge commits; timed-out
# iterations keep node_modules (git clean -e node_modules/). Never pushes anything but this wave's own branch.
#
# Usage: launched (detached) by scripts/ralph/launch-prd001-candy.sh.
# Env:   RALPH_MODEL (default claude-opus-5-5, pinned; passed to every claude call) · RALPH_MAX_ITERS (24)
#        RALPH_STOP_AT=HH:MM · RALPH_ITER_TIMEOUT (75m) · RALPH_REVIEW_TIMEOUT (45m) · RALPH_WORKSPACE (exported
#        for the sessions: the <workspace> the kit json names)
# State: <main checkout>/scripts/ralph/state/prd001-candy.status (delete to force a re-run)
# Logs:  <main checkout>/scripts/ralph/logs/prd001-candy-{build,review,acceptance}-<date>.log
# Report: <main checkout>/scripts/ralph/night-report-prd001-candy-<date>.md

set -uo pipefail

# --- keep the Mac awake for the whole run -----------------------------------
if [[ "$(uname)" == "Darwin" ]] && command -v caffeinate >/dev/null 2>&1 && [[ -z "${RALPH_CAFFEINATED:-}" ]]; then
  export RALPH_CAFFEINATED=1
  exec caffeinate -dimsu "$0" "$@"
fi

# Allow nested Claude Code sessions (Ralph spawns child claude processes)
unset CLAUDECODE
# After a restart the inherited PATH can lack Homebrew (claude, gh, gtimeout live there). APPENDED, never
# prepended: /opt/homebrew/bin has its own node (23.x), which must not shadow the launcher's nvm Node 22.
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin"   # appended: nvm's Node 22 (set by the launcher) must stay first

KIT_SRC="$(cd "$(dirname "$0")" && pwd)"            # this kit's files: the worktree's scripts/ralph/ or the main checkout's
COMMON_DIR="$(git -C "$KIT_SRC" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" \
  || { echo "cannot find the automatos-go repository from $KIT_SRC"; exit 1; }
REPO_ROOT="$(dirname "$COMMON_DIR")"                 # .../automatos-go (the main checkout), from a worktree too
PLATFORM_ROOT="$(dirname "$REPO_ROOT")"              # the workspace
RALPH_DIR="$REPO_ROOT/scripts/ralph"                 # state, logs, reports and setup-worktree.sh: never on the branch
STATE_DIR="$RALPH_DIR/state"
LOG_DIR="$RALPH_DIR/logs"
KIT="candy"
NUM="001-$KIT"                                        # file stem: prd-001-<kit>.json, acceptance-prd001-<kit>.sh …
REPORT="$RALPH_DIR/night-report-prd$NUM-$(date +%F).md"
mkdir -p "$STATE_DIR" "$LOG_DIR"
# The kit json's <workspace>: the sessions read it from here, so no committed file names a local path.
export RALPH_WORKSPACE="${RALPH_WORKSPACE:-$PLATFORM_ROOT}"

MAX_ITERS="${RALPH_MAX_ITERS:-24}"                   # 14 stories + the review's fix stories
RALPH_MODEL="${RALPH_MODEL:-claude-opus-5-5}"       # pinned: unattended runs never float
ITER_TIMEOUT="${RALPH_ITER_TIMEOUT:-75m}"            # npm / expo export / expo-doctor run in-session
REVIEW_TIMEOUT="${RALPH_REVIEW_TIMEOUT:-45m}"
CI_WAIT_SECONDS=2700                                 # the wave's one CI run (two jobs + malware-scan)
TIMEOUT_BIN=$(command -v timeout || command -v gtimeout)

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

# --- per-kit config ----------------------------------------------------------------
WAVE_BRANCH="feat/a9-candy"
BASE_REF="${RALPH_BASE_REF:-origin/main}"            # cut point, merge-base and the base move's source
PR_BASE="main"
PR_TITLE="feat(styles): Candy, the fifth style (PRD-001 US-023, wave A9)"
PRD_DOC="docs/prd/PRD-001-AUTOMATOS-GO-V1.md"
BASE_MOVE_BEFORE="US-023n"                           # the story whose session the base move precedes (D-CAN-8)
BASE_MOVE_MSG="chore(prd-001): A9 base move — merge origin/main [skip ci]"
CI_COMMIT_MSG="chore(prd-001): A9 Candy built, run CI"
EAS_SKIP_RE='\[(eas skip|skip eas|no eas)\]'         # in a commit message, PR title or body: skips delivery
BLOCK_REASON=""
branch_for() { echo "$WAVE_BRANCH"; }
base_for()   { echo "$BASE_REF"; }

# Worktrees live OUTSIDE the checkouts: <workspace>/.worktrees/<repo>/<branch with / → +>
wt_for() { echo "$PLATFORM_ROOT/.worktrees/automatos-go/$(branch_for "$1" | tr '/' '+')"; }

# --- stop-time handling ------------------------------------------------------
STOP_EPOCH=0
if [[ -n "${RALPH_STOP_AT:-}" ]]; then
  H="${RALPH_STOP_AT%%:*}"; M="${RALPH_STOP_AT##*:}"
  STOP_EPOCH=$(date -v"${H}"H -v"${M}"M -v0S +%s 2>/dev/null || date -d "today ${H}:${M}:00" +%s)
  [[ $STOP_EPOCH -le $(date +%s) ]] && STOP_EPOCH=$((STOP_EPOCH + 86400))
fi

past_stop_time() {
  [[ $STOP_EPOCH -gt 0 ]] && [[ $(date +%s) -ge $STOP_EPOCH ]]
}

# --- report helpers ----------------------------------------------------------
rep() { echo "$@" >> "$REPORT"; }

report_init() {
  if [[ ! -f "$REPORT" ]]; then
    rep "# Ralph run — Automatos Go PRD-001 wave A9 Candy — $(date '+%F %H:%M')"
    rep ""
    rep "Kit: $KIT. Model: $RALPH_MODEL. Iter cap: $MAX_ITERS × $ITER_TIMEOUT. Stop-at: ${RALPH_STOP_AT:-none}. One phase on $BASE_REF; origin/main merged in before $BASE_MOVE_BEFORE when it moved. One PR and one CI run for the wave: story commits are [skip ci]; the draft PR opens when the build is COMPLETE. One review cycle."
    rep ""
  else
    rep ""
    rep "---"
    rep "## Re-entered $(date '+%H:%M')"
  fi
}

# --- status file helpers -----------------------------------------------------
set_status() { echo "$2=$3" >> "$STATE_DIR/prd$1.status"; }
get_status() { grep "^$2=" "$STATE_DIR/prd$1.status" 2>/dev/null | tail -1 | cut -d= -f2; }

# The state file AND the branch's own kit json (every story passes) must agree.
prd_already_done() {
  local wt; wt=$(wt_for "$1")
  [[ "$(get_status "$1" BUILD)" == "COMPLETE" ]] \
    && [[ "$(get_status "$1" ACCEPT)" == "PASS" ]] \
    && [[ "$(get_status "$1" REVIEW)" == "PASS" ]] \
    && jq -e '[.userStories[] | select(.passes != true)] | length == 0' "$wt/scripts/ralph/prd-$1.json" >/dev/null 2>&1
}

# The story the next build session takes: the first by priority that does not pass.
next_story() {
  local wt; wt=$(wt_for "$1")
  jq -r '[.userStories[] | select(.passes != true)] | sort_by(.priority) | .[0].id // empty' "$wt/scripts/ralph/prd-$1.json" 2>/dev/null
}

# --- usage-limit handling ----------------------------------------------------
seconds_until_next_hour() {
  local seconds_past_hour=$((10#$(date +%M) * 60 + 10#$(date +%S)))
  echo $((3600 - seconds_past_hour))
}

seconds_until_daily_reset() {
  local reset_hour=5
  local now=$(date +%s)
  local today_reset=$(date -v${reset_hour}H -v0M -v0S +%s 2>/dev/null || date -d "today ${reset_hour}:00:00" +%s)
  if [[ $now -ge $today_reset ]]; then
    echo $((today_reset + 86400 - now))
  else
    echo $((today_reset - now))
  fi
}

countdown() {
  local seconds=$1 message=$2
  while [[ $seconds -gt 0 ]]; do
    printf "\r${CYAN}%s${NC} %02d:%02d:%02d " "$message" $((seconds / 3600)) $(((seconds % 3600) / 60)) $((seconds % 60))
    sleep 1
    seconds=$((seconds - 1))
  done
  printf "\r%-80s\r" " "
}

is_usage_limit_error() {
  local output="$1" exit_code="$2"
  [[ "$exit_code" -eq 0 ]] && return 1
  # Structured check first: the result object's own api_error/api_error_status say this
  # directly, regardless of the human sentence's wording (session/weekly/daily/five_hour/...).
  if echo "$output" | grep '^{' | jq -e '
      select(.type == "result") | select(.is_error == true) |
      select((.api_error // "" | test("usage_limit|rate_limit")) or (.api_error_status == 429) or ((.subtype // "") | test("error.*limit|rate_limit")))
    ' &>/dev/null; then
    return 0
  fi
  local error_text
  error_text=$(echo "$output" | grep -v '^{' || true)
  error_text+=$(echo "$output" | grep '^{' | jq -r 'select(.type == "result" and .is_error == true) | [.result, .error, .api_error] | map(select(. != null)) | join(" ")' 2>/dev/null || true)
  [[ "$error_text" =~ "You've hit your limit" ]] && return 0
  [[ "$error_text" =~ "You have hit your limit" ]] && return 0
  [[ "$error_text" =~ Error:\ 429 ]] && return 0
  [[ "$error_text" =~ Error:\ 529 ]] && return 0
  [[ "$error_text" =~ rate.?limit ]] && return 0
  [[ "$error_text" =~ usage.?limit ]] && return 0
  # Covers "hit your session/weekly/daily/... limit" — any wording between "hit your" and "limit".
  [[ "$error_text" =~ hit\ your.*limit ]] && return 0
  return 1
}

seconds_until_clock() {
  # "resets 10:20am (Europe/Lisbon)" -> seconds until that wall-clock time (today, else tomorrow) + 60 s.
  local hh=$((10#$1 % 12)) mm=$2 ampm=$3 zone=${4:-} now target
  [[ "$ampm" == [pP][mM] ]] && hh=$((hh + 12))
  now=$(date +%s)
  # An empty TZ means UTC, so set it only when the message names a zone.
  [[ -n "$zone" ]] && local TZ="$zone" && export TZ
  target=$(date -v${hh}H -v${mm}M -v0S +%s 2>/dev/null || date -d "today ${hh}:${mm}:00" +%s)
  [[ $target -le $now ]] && target=$((target + 86400))
  echo $((target - now + 60))
}

get_sleep_duration() {
  # Read only the limit message: the iteration's transcript is full of "day", "daily" and "hour"
  # (the kits build day models and daily digests), which used to send every limit to the 05:00 reset.
  local msg re='resets ([0-9]{1,2})(:([0-9]{2}))? ?([aApP][mM])( \(([A-Za-z_/+-]+)\))?'
  msg=$(printf '%s\n' "$1" | grep -oiE "hit your [a-z ]*limit[^\"]*|try again in [0-9]+ (minute|hour)s?" | tail -1)
  if [[ "$msg" =~ $re ]]; then
    seconds_until_clock "${BASH_REMATCH[1]}" "${BASH_REMATCH[3]:-00}" "${BASH_REMATCH[4]}" "${BASH_REMATCH[6]}"; return
  fi
  if [[ "$msg" =~ "try again in "([0-9]+)" minute" ]]; then
    echo $(( ${BASH_REMATCH[1]} * 60 + 60 )); return
  fi
  if [[ "$msg" =~ "try again in "([0-9]+)" hour" ]]; then
    echo $(( ${BASH_REMATCH[1]} * 3600 + 60 )); return
  fi
  if [[ "$msg" =~ (daily|24.?hour) ]]; then
    seconds_until_daily_reset; return
  fi
  local wait_time=$(seconds_until_next_hour)
  [[ $wait_time -lt 300 ]] && wait_time=300
  echo $wait_time
}

handle_usage_limit() {
  local sleep_duration=$(get_sleep_duration "$1")
  echo -e "\n${YELLOW}=== Usage limit — waiting for reset ===${NC}"
  countdown "$sleep_duration" "Limit wait..."
  echo -e "${GREEN}Resuming...${NC}"
}

# --- sentinels ----------------------------------------------------------------
# A sentinel counts only on the reply's LAST non-empty line (<= 80 chars). The prompts say the sentinel is
# the final line and is never written anywhere else.
last_line() { printf '%s\n' "$1" | sed 's/\x1b\[[0-9;]*m//g; s/[[:space:]]*$//' | grep -v '^[[:space:]]*$' | tail -1; }
ends_with() { local last; last=$(last_line "$1"); [[ "$last" == *"$2"* ]] && [[ ${#last} -le 80 ]]; }

# --- one headless claude invocation ------------------------------------------
# Sets: CLAUDE_EXIT, CLAUDE_OUTPUT, CLAUDE_RESULT. Every session runs on the pinned $RALPH_MODEL.
run_claude() {
  local wt="$1" prompt_file="$2" tmo="$3" logfile="$4"
  local tmp; tmp=$(mktemp)

  cd "$wt"
  "$TIMEOUT_BIN" --kill-after=30s "$tmo" claude --print \
    --model "$RALPH_MODEL" \
    --verbose \
    --output-format stream-json \
    --dangerously-skip-permissions \
    < "$prompt_file" 2>&1 | tee "$tmp" | tee -a "$logfile" | sed 's/\x1b\[[0-9;]*m//g' | grep --line-buffered '^{' | jq --unbuffered -r '
      def tool_info:
        if .name == "Edit" or .name == "Write" or .name == "Read" then
          (.input.file_path // .input.path | split("/") | last | .[0:60])
        elif .name == "Bash" then
          (.input.command // .input.cmd | if contains("\n") then split("\n") | first | .[0:50] else .[0:80] end)
        elif .name == "Grep" then
          (.input.pattern | .[0:40])
        elif .name == "Glob" then
          (.input.pattern // .input.filePattern | .[0:40])
        else null end;
      if .type == "assistant" then
        .message.content[] |
        if .type == "text" then
          if (.text | split("\n") | length) <= 3 then .text else empty end
        elif .type == "tool_use" then
          "    [" + .name + "]" + (tool_info | if . then " " + . else "" end)
        else empty end
      elif .type == "result" then
        "--- " + ((.duration_ms / 1000 * 10 | floor / 10) | tostring) + "s, " + (.num_turns | tostring) + " turns ---"
      else empty end
    ' 2>/dev/null

  CLAUDE_EXIT=${PIPESTATUS[0]}
  CLAUDE_OUTPUT=$(cat "$tmp")
  # Slurp + last FULL result (a sentinel under a long summary must stay visible).
  CLAUDE_RESULT=$(sed 's/\x1b\[[0-9;]*m//g' "$tmp" | grep '^{' | jq -rs '[.[] | select(.type == "result") | .result // empty] | last // empty' 2>/dev/null)
  rm -f "$tmp"
  cd "$REPO_ROOT"
}

# --- worktree management ------------------------------------------------------
ensure_worktree() {
  local num="$1" wt br base
  wt=$(wt_for "$num"); br=$(branch_for "$num"); base=$(base_for "$num")

  if [[ -d "$wt" ]]; then
    local cur
    cur=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    if [[ "$cur" != "$br" ]]; then
      echo -e "${RED}Worktree $wt exists but is on '$cur', expected '$br'. Fix manually.${NC}"
      return 1
    fi
    echo -e "${CYAN}Reusing worktree $wt ($br, $(git -C "$wt" rev-list --count "$base..HEAD" 2>/dev/null || echo '?') commit(s) of its own)${NC}"
  elif git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$br"; then
    echo -e "${CYAN}Branch $br exists — attaching worktree${NC}"
    mkdir -p "$(dirname "$wt")"
    git -C "$REPO_ROOT" -c core.hooksPath=/dev/null worktree add "$wt" "$br" || return 1
  else
    git -C "$REPO_ROOT" rev-parse --verify --quiet "$base" >/dev/null || {
      echo -e "${RED}Base '$base' for PRD-$num does not resolve — fetch origin first.${NC}"; return 1; }
    echo -e "${CYAN}Creating worktree $wt: $br ← $base${NC}"
    mkdir -p "$(dirname "$wt")"
    git -C "$REPO_ROOT" -c core.hooksPath=/dev/null worktree add --no-track -b "$br" "$wt" "$base" || return 1
  fi
  provision_worktree "$wt"
}

# Runs on BOTH paths. Copies NO env file: EXPO_PUBLIC_* values come from EAS environments at build time,
# never from a file in a Ralph worktree.
provision_worktree() {
  local wt="$1" f
  for f in .env .env.local; do
    if [[ -f "$wt/$f" ]]; then
      echo -e "${RED}$wt/$f exists. Ralph worktrees carry no env files — remove it and relaunch.${NC}"
      return 1
    fi
  done
  git -C "$REPO_ROOT" config extensions.worktreeConfig true 2>/dev/null || true
  git -C "$wt" config --worktree core.hooksPath /var/empty 2>/dev/null || true
  [[ -x "$RALPH_DIR/setup-worktree.sh" ]] && "$RALPH_DIR/setup-worktree.sh" "$wt"
  return 0
}

# Seed the kit onto the branch (prd json must be TRACKED: the loop marks stories DONE and commits it).
# The branch's prd json is never clobbered once tracked (it carries the DONE marks); prompts, the gate and the
# runner / launcher are re-copied when the kit copy (KIT_SRC) differs — run from the worktree, KIT_SRC is the
# branch's own folder and nothing is copied.
seed_scaffolding() {
  local num="$1" wt changed=0 f
  wt=$(wt_for "$num")
  mkdir -p "$wt/scripts/ralph"
  for f in "prd-$num.json" "PROMPT_build_prd$num.md" "PROMPT_review_prd$num.md" "acceptance-prd$num.sh" \
           "overnight-prd$num.sh" "launch-prd$num.sh"; do
    if [[ ! -f "$KIT_SRC/$f" ]]; then
      echo -e "${RED}Missing $KIT_SRC/$f — the kit is incomplete.${NC}"
      return 1
    fi
    if [[ "$f" == "prd-$num.json" ]] && git -C "$wt" ls-files --error-unmatch "scripts/ralph/$f" >/dev/null 2>&1; then
      continue
    fi
    if [[ "$KIT_SRC/$f" -ef "$wt/scripts/ralph/$f" ]]; then
      # run from the worktree: the file is the branch's own; commit it only if it is not tracked yet
      git -C "$wt" ls-files --error-unmatch "scripts/ralph/$f" >/dev/null 2>&1 && continue
    elif cmp -s "$KIT_SRC/$f" "$wt/scripts/ralph/$f" 2>/dev/null; then
      continue
    else
      cp "$KIT_SRC/$f" "$wt/scripts/ralph/$f"
    fi
    git -C "$wt" add -f "scripts/ralph/$f"
    changed=1
  done
  if ! git -C "$wt" ls-files --error-unmatch "$PRD_DOC" >/dev/null 2>&1; then
    echo -e "${RED}$PRD_DOC is not on $(branch_for "$num") — the base must carry PRD-001.${NC}"
    return 1
  fi
  if [[ $changed -eq 1 ]]; then
    git -C "$wt" -c core.hooksPath=/var/empty commit -q -s -m "chore(prd-001): seed the Ralph kit ($KIT) [skip ci]" || return 1
  fi
  return 0
}

# --- the base move (before US-023n, D-CAN-8) -------------------------------------------
# Returns 0 (merged, or nothing to merge), 2 (BLOCKED: a conflict, a dirty worktree), 4 (environmental: origin
# unreachable, node_modules could not be re-provisioned). Sets BLOCK_REASON on a non-zero return.
base_move() {
  local num="$1" wt br behind dirty conflicts before attempt
  wt=$(wt_for "$num"); br=$(branch_for "$num")
  for attempt in 1 2 3; do
    git -C "$REPO_ROOT" fetch -q origin 2>/dev/null && break
    if [[ $attempt -eq 3 ]]; then BLOCK_REASON="git fetch failed three times before the base move"; return 4; fi
    sleep 30
  done
  behind=$(git -C "$wt" rev-list --count "HEAD..$BASE_REF" 2>/dev/null) || { BLOCK_REASON="cannot compare $br with $BASE_REF"; return 2; }
  if [[ "$behind" == "0" ]]; then
    echo -e "${CYAN}Base move before $BASE_MOVE_BEFORE: $br already carries $BASE_REF ($(git -C "$REPO_ROOT" rev-parse --short "$BASE_REF"))${NC}"
    return 0
  fi
  dirty=$(git -C "$wt" status --porcelain 2>/dev/null | grep -v 'node_modules' || true)
  if [[ -n "$dirty" ]]; then
    BLOCK_REASON="the worktree is dirty before the base move: $(echo "$dirty" | head -5 | tr '\n' ' ')"
    rep "- Base move before $BASE_MOVE_BEFORE: **not done** — $BLOCK_REASON"
    return 2
  fi
  before=$(git -C "$wt" rev-parse HEAD)
  echo -e "${CYAN}Base move before $BASE_MOVE_BEFORE: merging $BASE_REF ($(git -C "$REPO_ROOT" rev-parse --short "$BASE_REF"), $behind commit(s)) into $br${NC}"
  if ! git -C "$wt" -c core.hooksPath=/var/empty merge --no-ff --signoff --no-edit -m "$BASE_MOVE_MSG" "$BASE_REF"; then
    conflicts=$(git -C "$wt" diff --name-only --diff-filter=U 2>/dev/null | tr '\n' ' ')
    git -C "$wt" merge --abort 2>/dev/null || true
    BLOCK_REASON="the base move conflicts (merge aborted): ${conflicts:-(no conflicted file listed; see the console log) }— resolve it by hand in the worktree (signed, [skip ci]; the seams are the kit's SEAM EDIT notes), then relaunch"
    echo -e "${RED}$BLOCK_REASON${NC}"
    rep "- Base move before $BASE_MOVE_BEFORE: **CONFLICT** — ${conflicts:-see the console log}"
    return 2
  fi
  rep "- Base move before $BASE_MOVE_BEFORE: merged $BASE_REF $(git -C "$REPO_ROOT" rev-parse --short "$BASE_REF") ($behind commit(s)) → $(git -C "$wt" log -1 --format=%h HEAD)"
  if ! git -C "$wt" diff --quiet "$before" HEAD -- package-lock.json; then
    echo -e "${YELLOW}package-lock.json moved with the base — re-provisioning node_modules${NC}"
    rm -rf "$wt/node_modules"
    "$RALPH_DIR/setup-worktree.sh" "$wt" || { BLOCK_REASON="node_modules could not be re-provisioned after the base move"; return 4; }
  fi
  return 0
}

# --- the Ralph build loop -------------------------------------------------------
# Returns: 0=COMPLETE  2=BLOCKED  3=MAX_ITERS  4=ENVIRONMENTAL  5=TIME_UP
run_build_loop() {
  local num="$1" wt br prompt logfile cur bm
  wt=$(wt_for "$num"); br=$(branch_for "$num")
  prompt="$wt/scripts/ralph/PROMPT_build_prd$num.md"
  logfile="$LOG_DIR/prd$num-build-$(date +%F).log"

  local iteration=0 consecutive_failures=0

  while true; do
    past_stop_time && return 5
    iteration=$((iteration + 1))
    if [[ $iteration -gt $MAX_ITERS ]]; then return 3; fi

    echo -e "\n${GREEN}=== PRD-$num build iteration $iteration/$MAX_ITERS ($(date +%H:%M)) ===${NC}\n"

    # Branch lock — never build on the wrong branch.
    cur=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    if [[ "$cur" != "$br" ]]; then
      echo -e "${RED}PRD-$num worktree drifted to '$cur' (expected '$br') — halting.${NC}"
      return 4
    fi

    # D-CAN-8: US-023n wires PRD-268's slots from whatever main carries, so main comes in first.
    if [[ "$(next_story "$num")" == "$BASE_MOVE_BEFORE" ]]; then
      base_move "$num"; bm=$?
      [[ $bm -eq 0 ]] || return $bm
    fi

    run_claude "$wt" "$prompt" "$ITER_TIMEOUT" "$logfile"

    if is_usage_limit_error "$CLAUDE_OUTPUT" "$CLAUDE_EXIT"; then
      handle_usage_limit "$CLAUDE_OUTPUT"
      iteration=$((iteration - 1))
      continue
    fi

    if [[ $CLAUDE_EXIT -eq 124 || $CLAUDE_EXIT -eq 137 || $CLAUDE_EXIT -eq 143 ]]; then
      consecutive_failures=$((consecutive_failures + 1))
      echo -e "${RED}Iteration timed out (${ITER_TIMEOUT}) — discarding partial work${NC}"
      git -C "$wt" checkout -- . 2>/dev/null || true
      git -C "$wt" clean -fdq -e 'node_modules/' 2>/dev/null || true
      [[ $consecutive_failures -ge 4 ]] && return 4
      countdown 15 "Retrying..."
      iteration=$((iteration - 1))
      continue
    fi

    if [[ $CLAUDE_EXIT -ne 0 ]]; then
      consecutive_failures=$((consecutive_failures + 1))
      echo -e "${RED}Error (exit $CLAUDE_EXIT)${NC}"
      echo "$CLAUDE_OUTPUT" | tail -20
      [[ $consecutive_failures -ge 4 ]] && return 4
      local backoff=$((30 * (2 ** (consecutive_failures - 1))))
      [[ $backoff -gt 300 ]] && backoff=300
      countdown $backoff "Retrying..."
      iteration=$((iteration - 1))
      continue
    fi

    consecutive_failures=0

    # Offsite backup only. Story commits end ' [skip ci]', ci.yml runs on pull_request and push-to-main
    # only, and the branch has no PR until the build is COMPLETE, so nothing runs here.
    if git -C "$wt" push -q -u origin "$br" 2>/dev/null; then
      echo -e "${CYAN}pushed → origin/$br (backup; [skip ci], no CI)${NC}"
    else
      echo -e "${YELLOW}push failed (offline/auth?) — continuing; retry next iteration${NC}"
    fi

    if ends_with "$CLAUDE_RESULT" RALPH_COMPLETE; then return 0; fi
    if ends_with "$CLAUDE_RESULT" RALPH_BLOCKED || ends_with "$CLAUDE_RESULT" RALPH_ABORT; then return 2; fi

    sleep 2
  done
}

# --- the wave's CI head ---------------------------------------------------------------
# Under pipefail, `producer | grep -q` can read as "no match" when grep exits first and the producer dies of
# SIGPIPE: these guards capture the text, then grep a here-string.
skips_ci() {
  local msg; msg=$(git -C "$1" log -1 --format=%B "${2:-HEAD}")
  grep -qiE '\[(skip ci|ci skip|no ci|skip actions|actions skip)\]|skip-checks: *true' <<<"$msg"
}

# The commit CI tested: HEAD, or the nearest ancestor that is not a kit-only '[skip ci]' commit.
ci_commit_for_head() {
  local wt="$1" sha
  sha=$(git -C "$wt" rev-parse HEAD)
  while skips_ci "$wt" "$sha" \
        && [[ -z "$(git -C "$wt" show --format= --name-only "$sha" | grep -v '^scripts/ralph/')" ]]; do
    sha=$(git -C "$wt" rev-parse "$sha^")
  done
  echo "$sha"
}

# The head the wave pushes for CI never carries [skip ci] (GitHub skips the PR's checks on such a head). The
# build session's completion commit is that commit; when the head is a [skip ci] one anyway, add it here.
ensure_ci_head() {
  local wt="$1"
  skips_ci "$wt" HEAD || return 0
  echo -e "${YELLOW}HEAD carries [skip ci] — adding the wave's CI commit so the PR's checks run on it${NC}"
  git -C "$wt" -c core.hooksPath=/var/empty commit -q -s --allow-empty -m "$CI_COMMIT_MSG"
}

# No commit message (GitHub's default squash body lists them), PR title or body may name an EAS skip token.
eas_skip_free() {
  local wt="$1" text="$2" msgs
  if grep -qiE "$EAS_SKIP_RE" <<<"$text"; then
    echo -e "${RED}The PR title or body names an EAS skip token — refusing (it would skip delivery)${NC}"; return 1
  fi
  msgs=$(git -C "$wt" log --format=%B "$BASE_SHA..HEAD")
  if grep -qiE "$EAS_SKIP_RE" <<<"$msgs"; then
    echo -e "${RED}A commit message on $(branch_for "$NUM") names an EAS skip token — refusing to open or edit the PR (reword it by hand)${NC}"; return 1
  fi
  return 0
}

# --- CI reconciliation (recorded; the gate and the reviewer judge it) -----------
# Echoes one of: SUCCESS / FAILURE / PENDING_TIMEOUT / NO_RUN / NO_GH
wait_for_ci() {
  local num="$1" wt br sha waited=0 line status conclusion
  wt=$(wt_for "$num"); br=$(branch_for "$num")
  command -v gh >/dev/null 2>&1 || { echo "NO_GH"; return 0; }
  sha=$(ci_commit_for_head "$wt")
  while [[ $waited -lt $CI_WAIT_SECONDS ]]; do
    line=$(gh run list --branch "$br" --workflow ci.yml --limit 10 \
      --json headSha,status,conclusion \
      --jq ".[] | select(.headSha == \"$sha\") | \"\(.status) \(.conclusion)\"" 2>/dev/null | head -1)
    status="${line%% *}"; conclusion="${line##* }"
    if [[ "$status" == "completed" ]]; then
      [[ "$conclusion" == "success" ]] && echo "SUCCESS" || echo "FAILURE"
      return 0
    fi
    [[ -z "$line" && $waited -ge 300 ]] && { echo "NO_RUN"; return 0; }
    sleep 60; waited=$((waited + 60))
  done
  echo "PENDING_TIMEOUT"
}

# --- the wave's ONE draft PR ------------------------------------------------------
# Body = the kit json's description and backend line, what was built, what CI verified (filled in after the
# gate reads the run), the delivery note (a native build), the ownerTest list (Gerard's).
pr_body() {
  local wt="$1" ci_line="$2" review_line="$3" json summary backend stories owner decisions
  json="$wt/scripts/ralph/prd-$NUM.json"
  summary=$(jq -r '.description | sub(" *THIS JSON IS THE BINDING CONTRACT\\.?$"; "")' "$json" 2>/dev/null)
  backend=$(jq -r '.backendPrd // empty' "$json" 2>/dev/null)
  stories=$(jq -r '.userStories[] | "- **\(.id)** \(.title)\(if .passes == true then "" else " — NOT DONE" end)"' "$json" 2>/dev/null)
  owner=$(jq -r '.ownerTest[] | "- [ ] **\(.id)** \(.what)"' "$json" 2>/dev/null)
  decisions=$(jq -r '[.decisions[].id] | join(", ")' "$json" 2>/dev/null)
  cat <<BODY
$summary

**PRD:** AutomatosAI/automatos-go#2 (\`$PRD_DOC\` §4.6.2, US-023, wave A9) · **Backend:** $backend · **Kit:** \`scripts/ralph/prd-$NUM.json\` (binding decisions: $decisions)

**Delivery: a native build.** US-023d adds Outfit and Nunito to app.json's expo-font list (D-CAN-4), so the iOS fingerprint moves and this merge is a native build from the monthly quota, not an over-the-air update. No dependency change.

## What was built
$stories

## What was verified
- **CI (this PR's one run, \`ci.yml\` + \`malware-scan\`):** $ci_line
- **Local gate** (\`bash scripts/ralph/acceptance-prd$NUM.sh\`): typecheck · lint · vitest · \`expo export --platform ios\` bundle check · check:core · check:routes · expo-doctor · \`expo config --type introspect\` · the kit's contract checks (the KA1 file list, app.json's font entries only, the font bytes and SOURCES.md, SEAM EDIT notes, no stand-in left, vendored provenance at the kit's pinned commit).
- **Review:** $review_line
- Nothing ran on a device, a simulator, EAS or a live server. Every UI story is verified by types, lint, the iOS bundle compile and unit tests of its pure logic only; the screenshots the PRD asks for are in the owner checks below.

## Owner checks (Gerard — device, EAS, live server)
$owner

Commits are signed off (DCO). Ralph run, model \`$RALPH_MODEL\`; branch \`$WAVE_BRANCH\` on \`$BASE_REF\`.
BODY
}

pr_upsert() {
  local wt="$1" br="$2" title="$3" body="$4" n
  eas_skip_free "$wt" "$title
$body" || return 1
  n=$(gh pr list --head "$br" --state open --json number --jq '.[0].number' 2>/dev/null)
  if [[ -n "$n" ]]; then
    (cd "$wt" && gh pr edit "$n" --title "$title" --body "$body")
  else
    (cd "$wt" && gh pr create --draft --base "$PR_BASE" --head "$br" --title "$title" --body "$body")
  fi
}

open_wave_pr() {
  local num="$1" wt br
  wt=$(wt_for "$num"); br=$(branch_for "$num")
  command -v gh >/dev/null 2>&1 || { echo -e "${RED}gh is required: the wave's CI runs on its draft PR.${NC}"; return 1; }
  ensure_ci_head "$wt" || return 1
  eas_skip_free "$wt" "$PR_TITLE" || return 1
  git -C "$wt" push -q -u origin "$br" || return 1
  pr_upsert "$wt" "$br" "$PR_TITLE" "$(pr_body "$wt" "pending — this PR's run is the wave's CI" "pending")" >/dev/null 2>&1 || true
  [[ -n "$(gh pr list --head "$br" --state open --json number --jq '.[0].number' 2>/dev/null)" ]]
}

update_wave_pr() {
  local num="$1" ci_line="$2" review_line="$3" wt br n body
  wt=$(wt_for "$num"); br=$(branch_for "$num")
  command -v gh >/dev/null 2>&1 || return 0
  n=$(gh pr list --head "$br" --state open --json number --jq '.[0].number' 2>/dev/null)
  [[ -n "$n" ]] || return 0
  body=$(pr_body "$wt" "$ci_line" "$review_line")
  eas_skip_free "$wt" "$body" || return 0
  (cd "$wt" && gh pr edit "$n" --body "$body") >/dev/null 2>&1 || true
}

# --- deterministic acceptance gate ---------------------------------------------
run_acceptance() {
  local num="$1" mode="${2:-}" wt logfile rc
  wt=$(wt_for "$num")
  logfile="$LOG_DIR/prd$num-acceptance-$(date +%F).log"
  echo -e "\n${CYAN}=== PRD-$num acceptance gate ${mode:-full} (90m cap) ===${NC}"
  (cd "$wt" && "$TIMEOUT_BIN" --kill-after=60s 90m bash "scripts/ralph/acceptance-prd$num.sh" $mode) >> "$logfile" 2>&1
  rc=$?
  [[ $rc -eq 124 || $rc -eq 137 ]] && echo "ACCEPTANCE TIMED OUT (90m)" >> "$logfile"
  tail -20 "$logfile"
  return $rc
}

# --- ONE headless review cycle ----------------------------------------------------
# Returns: 0=REVIEW_PASS  1=findings → fix stories built and the gate green (not re-reviewed: one cycle)
#          2=findings unresolved / no sentinel  3=review errored
run_review_cycle() {
  local num="$1" wt br prompt logfile rc
  wt=$(wt_for "$num"); br=$(branch_for "$num")
  prompt="$wt/scripts/ralph/PROMPT_review_prd$num.md"
  logfile="$LOG_DIR/prd$num-review-$(date +%F).log"

  past_stop_time && return 2
  echo -e "\n${CYAN}=== PRD-$num review (one cycle) ===${NC}\n"
  while :; do
    run_claude "$wt" "$prompt" "$REVIEW_TIMEOUT" "$logfile"
    is_usage_limit_error "$CLAUDE_OUTPUT" "$CLAUDE_EXIT" || break
    handle_usage_limit "$CLAUDE_OUTPUT"
    past_stop_time && return 2
  done
  [[ $CLAUDE_EXIT -ne 0 ]] && return 3

  # FINDINGS is checked first: a findings reply that quotes the word PASS must not pass.
  if ends_with "$CLAUDE_RESULT" REVIEW_FINDINGS; then
    echo -e "${YELLOW}Reviewer filed fix stories — re-entering the build loop (no second review)${NC}"
    run_build_loop "$num"; rc=$?
    [[ $rc -eq 4 ]] && return 3
    [[ $rc -eq 0 ]] || return 2
    ensure_ci_head "$wt" || return 2
    git -C "$wt" push -q -u origin "$br" 2>/dev/null || true
    run_acceptance "$num" || return 2
    return 1
  fi
  if ends_with "$CLAUDE_RESULT" REVIEW_PASS; then return 0; fi

  # No sentinel — leave it for the human.
  return 2
}

# --- pre-flight ------------------------------------------------------------------
preflight() {
  local missing=0 f
  for cmd in claude jq git node npm; do
    command -v "$cmd" >/dev/null || { echo -e "${RED}Missing: $cmd${NC}"; missing=1; }
  done
  command -v gh >/dev/null || { echo -e "${RED}Missing: gh (the wave's CI runs on its PR)${NC}"; missing=1; }
  gh auth status >/dev/null 2>&1 || { echo -e "${RED}gh is not authenticated — run: gh auth login${NC}"; missing=1; }
  [[ -z "$TIMEOUT_BIN" ]] && { echo -e "${RED}Missing: timeout/gtimeout (brew install coreutils)${NC}"; missing=1; }
  [[ -n "$RALPH_MODEL" ]] || { echo -e "${RED}RALPH_MODEL is empty — unattended runs are pinned${NC}"; missing=1; }
  case "$(node -v 2>/dev/null)" in
    v22.*) ;;
    *) echo -e "${RED}Node 22 required (CI and eas-cli use 22; got '$(node -v 2>/dev/null || echo none)') — launch through launch-prd001-$KIT.sh${NC}"; missing=1 ;;
  esac
  for f in "prd-$NUM.json" "PROMPT_build_prd$NUM.md" "PROMPT_review_prd$NUM.md" "acceptance-prd$NUM.sh"; do
    [[ -f "$KIT_SRC/$f" ]] || { echo -e "${RED}Missing kit file: $KIT_SRC/$f${NC}"; missing=1; }
  done
  [[ -f "$RALPH_DIR/setup-worktree.sh" ]] || { echo -e "${RED}Missing $RALPH_DIR/setup-worktree.sh (the main checkout's)${NC}"; missing=1; }
  if grep -lE 'KIT_CANDY''_PIN' "$KIT_SRC/prd-$NUM.json" "$KIT_SRC/PROMPT_build_prd$NUM.md" "$KIT_SRC/PROMPT_review_prd$NUM.md" \
       "$KIT_SRC/acceptance-prd$NUM.sh" >/dev/null 2>&1; then
    echo -e "${RED}The kit still names its design-kit pin placeholder: fill in the commit first${NC}"; missing=1
  fi
  [[ $missing -eq 1 ]] && exit 1
  return 0
}

# --- main --------------------------------------------------------------------------
[[ $# -eq 0 || "$1" == "$KIT" ]] || { echo "overnight-prd001-$KIT.sh takes one profile: $KIT"; exit 2; }

preflight
report_init

trap 'rep ""; rep "**INTERRUPTED** at $(date +%H:%M)"; echo -e "\n${YELLOW}Interrupted — report: $REPORT${NC}"; exit 130' INT TERM

echo -e "${GREEN}Ralph run: PRD-$NUM ($RALPH_MODEL) — report: $REPORT${NC}"

if past_stop_time; then
  rep "## PRD-$NUM — SKIPPED (stop time ${RALPH_STOP_AT:-} reached)"
  exit 0
fi
if prd_already_done "$NUM"; then
  echo -e "${GREEN}PRD-$NUM already COMPLETE+PASS+PASS — skipping${NC}"
  rep "## PRD-$NUM — already done (state file and kit json), skipped"
  exit 0
fi

WT=$(wt_for "$NUM"); BR=$(branch_for "$NUM"); BASE=$(base_for "$NUM")
rep ""
rep "## PRD-$NUM — started $(date '+%H:%M')"
rep "- Branch: \`$BR\` on \`$BASE\` (worktree \`$WT\`)"

if ! ensure_worktree "$NUM" || ! seed_scaffolding "$NUM"; then
  rep "- **SETUP FAILED** — see console; run aborted"
  exit 1
fi

BASE_SHA=$(git -C "$WT" merge-base "$BR" "$BASE" 2>/dev/null || git -C "$REPO_ROOT" rev-parse "$BASE")
rep "- Stories left: $(jq -r '[.userStories[] | select(.passes != true) | .id] | join(" ") | if . == "" then "none" else . end' "$WT/scripts/ralph/prd-$NUM.json" 2>/dev/null)"

run_build_loop "$NUM"; BUILD_RC=$?
case $BUILD_RC in
  0) set_status "$NUM" BUILD COMPLETE; rep "- Build: **RALPH_COMPLETE**" ;;
  2) set_status "$NUM" BUILD BLOCKED;  rep "- Build: **RALPH_BLOCKED** — ${BLOCK_REASON:-see the last commit/log for why}" ;;
  3) set_status "$NUM" BUILD MAX_ITERS; rep "- Build: hit the iteration cap ($MAX_ITERS)" ;;
  5) set_status "$NUM" BUILD TIME_UP;  rep "- Build: stop time reached mid-wave" ;;
  4) set_status "$NUM" BUILD ENV_FAIL
     rep "- Build: **ENVIRONMENTAL FAILURE** — ${BLOCK_REASON:-repeated crashes} — run aborted"
     exit 1 ;;
esac
BASE_SHA=$(git -C "$WT" merge-base "$BR" "$BASE" 2>/dev/null || echo "$BASE_SHA")   # a base move moved it

# The wave's ONE push for CI: the draft PR opened now starts ci.yml once; the gate reads that run.
# A build that is not COMPLETE gets no PR and no CI (the gate then runs locally only).
if [[ $BUILD_RC -eq 0 ]]; then
  if open_wave_pr "$NUM"; then
    PR_URL=$(gh pr list --head "$BR" --state open --json url --jq '.[0].url' 2>/dev/null || true)
    rep "- Draft PR (the wave's one CI run): ${PR_URL:-opened} — base \`$PR_BASE\`"
  else
    rep "- Draft PR: **could not be opened** (gh? an EAS skip token? see console) — CI has not run; open it by hand: gh pr create --draft --base $PR_BASE --head $BR"
  fi
  CI_RESULT=$(wait_for_ci "$NUM")
else
  rep "- Draft PR: not opened (build not COMPLETE) — no CI ran"
  CI_RESULT="NO_PR"
fi
set_status "$NUM" CI "$CI_RESULT"
CI_SHA=$(ci_commit_for_head "$WT")
rep "- CI (ci.yml on the draft PR, ONE run for the wave, commit ${CI_SHA:0:9}): **$CI_RESULT**"

if [[ $BUILD_RC -eq 0 ]]; then GATE_MODE=""; else GATE_MODE="--no-ci"; fi
if run_acceptance "$NUM" $GATE_MODE; then
  set_status "$NUM" ACCEPT PASS; rep "- Acceptance${GATE_MODE:+ ($GATE_MODE)}: **PASS**"
  ACCEPT_OK=1
else
  set_status "$NUM" ACCEPT FAIL; rep "- Acceptance${GATE_MODE:+ ($GATE_MODE)}: **FAIL** (\`logs/prd$NUM-acceptance-$(date +%F).log\`)"
  ACCEPT_OK=0
fi

REVIEW_LINE="not run (build or acceptance incomplete)"
if [[ $BUILD_RC -eq 0 && $ACCEPT_OK -eq 1 ]]; then
  run_review_cycle "$NUM"; REVIEW_RC=$?
  case $REVIEW_RC in
    0) set_status "$NUM" REVIEW PASS;    rep "- Review: **REVIEW_PASS** — the draft PR is ready for the owner checks"
       REVIEW_LINE="adversarial review PASS (fresh session; code-review and security-reviewer in the foreground)"
       git -C "$WT" push -q -u origin "$BR" 2>/dev/null || true ;;
    1) set_status "$NUM" REVIEW FIXED;   rep "- Review: findings → fix stories built, gate **PASS**; not re-reviewed (one cycle) — Gerard reviews the fixes"
       REVIEW_LINE="adversarial review filed findings; the fix stories (P001C-RVW-*) are built and the gate is green; not re-reviewed (one review cycle)" ;;
    2) set_status "$NUM" REVIEW FINDINGS; rep "- Review: findings unresolved — human review needed"
       REVIEW_LINE="findings unresolved after the one review cycle — see the fix stories in the kit json" ;;
    3) set_status "$NUM" REVIEW ERROR;   rep "- Review: errored — human review needed"
       REVIEW_LINE="review session errored — human review needed" ;;
  esac
else
  set_status "$NUM" REVIEW SKIPPED
  rep "- Review: skipped (build/acceptance incomplete)"
fi
if [[ $BUILD_RC -eq 0 ]]; then
  CI_RESULT_NOW=$(wait_for_ci "$NUM")
  update_wave_pr "$NUM" "$CI_RESULT_NOW on $(ci_commit_for_head "$WT" | cut -c1-9) (jobs: typecheck · lint · test, expo-doctor · iOS bundle, malware-scan)" "$REVIEW_LINE"
fi

COMMITS=$(git -C "$WT" rev-list --count "$BASE_SHA..HEAD" 2>/dev/null || echo "?")
DIFFSTAT=$(git -C "$WT" diff --stat "$BASE_SHA..HEAD" 2>/dev/null | tail -1)
rep "- Delta vs base: $COMMITS commits — ${DIFFSTAT:-no changes}"
rep "- Finished $(date '+%H:%M')"

rep ""
rep "---"
rep "Run finished $(date '+%F %H:%M'). Owner protocol: (1) CI green on the draft PR (one run: typecheck · lint · test, expo-doctor · iOS bundle, malware-scan); (2) the ownerTest list in scripts/ralph/prd-$NUM.json (OT-C1..OT-C6: device, EAS and live-server checks in Candy; UI stories were gated by types, lint, the bundle compile and unit tests only); (3) mark the PR ready only when you would merge it now (a draft cannot be approved; a ready PR with green checks can land at once). This merge is a NATIVE build (D-CAN-4: app.json's fonts move the fingerprint), so batch it with any other native change."

echo -e "\n${GREEN}=== Run finished — report: $REPORT ===${NC}"
if command -v osascript >/dev/null 2>&1; then
  osascript -e "display notification \"Report ready — Automatos Go PRD-001 $KIT\" with title \"Ralph run finished\"" 2>/dev/null || true
fi
