# Autopilot Feature Audit

**Date:** 2026-01-26
**Audited by:** 4 parallel subagents (Explore type)
**Scope:** `/gsd:autopilot`, `/gsd:checkpoints`, `autopilot-script.sh`, GSD integration

---

## Executive Summary

The autopilot feature is architecturally sound but has **8 critical issues** that must be fixed before production use. The core design—shell script outer loop with `claude -p` per phase—is correct. The gaps are in error handling, state management, and documentation.

**Verdict:** Fix critical issues before recommending to users.

---

## Critical Issues (Must Fix)

### 1. Lock File Race Condition

**Location:** `autopilot-script.sh` lines 50-51

**Problem:**
```bash
echo $$ > "$LOCK_FILE"
trap "rm -f '$LOCK_FILE'" EXIT
```

No check if lock already exists. Two autopilot instances can run simultaneously, corrupting STATE.md.

**Fix:** Use atomic `mkdir` pattern or `flock`:
```bash
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "ERROR: Autopilot already running"
  exit 1
fi
trap "rmdir '$LOCK_DIR'" EXIT
```

---

### 2. `claude -p` Exit Code Masked by Pipe

**Location:** `autopilot-script.sh` lines 223-230

**Problem:**
```bash
if ! echo "/gsd:plan-phase $phase" | claude -p ... 2>&1 | tee -a "$phase_log"; then
```

Pipe masks exit code. If `claude -p` fails but `tee` succeeds, failure goes undetected.

**Fix:** Use `PIPESTATUS` or temp file:
```bash
echo "/gsd:plan-phase $phase" | claude -p ... 2>&1 | tee -a "$phase_log"
if [ ${PIPESTATUS[1]} -ne 0 ]; then
  # Handle failure
fi
```

---

### 3. Phase Completion Check Missing

**Location:** `autopilot-script.sh` `execute_phase()` function

**Problem:** No check for already-completed phases. On resume after interruption, script re-executes completed phases.

**Scenario:**
1. Phase 2 completes
2. Script crashes before state update
3. User resumes
4. Phase 2 re-executes (wasted tokens, potential conflicts)

**Fix:** Before executing, check ROADMAP.md for `[x]` or verify SUMMARY.md exists for all plans.

---

### 4. AWK State Update Corrupts STATE.md

**Location:** `autopilot-script.sh` lines 103-112

**Problem:**
```bash
awk '...' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
```

If AWK pattern doesn't match (section missing or format different), output truncates STATE.md.

**Fix:** Validate AWK output before moving:
```bash
awk '...' "$STATE_FILE" > "$STATE_FILE.tmp"
if [ $(wc -l < "$STATE_FILE.tmp") -lt 10 ]; then
  echo "ERROR: State update failed, output too small"
  rm "$STATE_FILE.tmp"
  exit 1
fi
mv "$STATE_FILE.tmp" "$STATE_FILE"
```

---

### 5. Checkpoint ID→File Mapping Broken

**Location:** `checkpoints.md` lines 81-85

**Problem:**
```bash
CHECKPOINT_FILE=$(ls .planning/checkpoints/pending/*.json | sed -n "${ID}p")
```

`ls` output order is undefined. "approve 1" doesn't reliably map to a specific checkpoint.

**Fix:** Use explicit ID in filename or create index:
```bash
# Option A: Parse phase-plan from user input
CHECKPOINT_FILE=".planning/checkpoints/pending/phase-${PHASE}-plan-${PLAN}.json"

# Option B: Create stable index on list
ls -1 .planning/checkpoints/pending/*.json | nl -w1 -s': ' > /tmp/checkpoint_index
```

---

### 6. Continuation Agent Handoff Missing

**Location:** `checkpoints.md` (entire file)

**Problem:** After user approves a checkpoint:
1. Approval file created at `.planning/checkpoints/approved/`
2. Pending file removed
3. **Nothing spawns the continuation agent**

`execute-phase.md` lines 330-346 define continuation but `checkpoints.md` doesn't reference it.

**Questions:**
- Does `/gsd:checkpoints approve` spawn continuation?
- Or does autopilot detect approval files and spawn?
- Or does user manually run something?

**Fix:** Define handoff explicitly. Either:
- Checkpoints command spawns continuation after approval
- Autopilot polls `approved/` directory and spawns
- Document manual step for user

---

### 7. `bc` Dependency Not Checked

**Location:** `autopilot-script.sh` lines 142-148, 155-166

**Problem:**
```bash
local cost=$(echo "scale=2; $tokens * 0.0000108" | bc)
```

`bc` not available on minimal systems (Alpine, some containers). Script fails silently.

**Fix:** Check availability or use pure bash:
```bash
if command -v bc &>/dev/null; then
  cost=$(echo "scale=2; $tokens * 0.0000108" | bc)
else
  # Pure bash approximation (integer math)
  cost=$((tokens / 100000))
fi
```

---

### 8. Autopilot Not in `/gsd:help`

**Location:** `commands/gsd/help.md`

**Problem:** `/gsd:autopilot` and `/gsd:checkpoints` are completely absent from help. Users offered autopilot in new-project can't find documentation.

**Fix:** Add entries:
```markdown
### /gsd:autopilot
Fully automated milestone execution. Generates a shell script that runs
in a separate terminal, executing all phases autonomously.

**Prerequisites:** Roadmap must exist (run /gsd:new-project first)
**Usage:** /gsd:autopilot [--from-phase N]

### /gsd:checkpoints
Review and approve pending checkpoints from autopilot execution.

**Usage:** /gsd:checkpoints [approve <id>] [reject <id>] [clear]
```

---

## Important Issues (Should Fix)

### 9. Missing `AskUserQuestion` in --allowedTools

**Location:** `autopilot-script.sh` lines 223-224

**Problem:** Script passes:
```bash
--allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite"
```

But `execute-phase.md` requires `AskUserQuestion`. Phases needing user input fail.

**Fix:** Add to all `claude -p` calls:
```bash
--allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite,AskUserQuestion"
```

---

### 10. Gap Closure Doesn't Loop

**Location:** `autopilot-script.sh` lines 271-311

**Problem:** Gap closure executes once. If closure introduces new gaps, they're not addressed.

**Fix:** Loop until `passed`:
```bash
while [ "$status" = "gaps_found" ]; do
  # Plan gaps
  # Execute gaps
  # Re-verify
done
```

---

### 11. `/gsd:progress` Doesn't Show Autopilot Status

**Location:** `commands/gsd/progress.md`

**Problem:** STATE.md has autopilot section but progress doesn't display it. Users can't check autopilot status.

**Fix:** Add to progress output:
```markdown
## Autopilot

Mode: running
Current Phase: 3
Phases Remaining: 4, 5
Checkpoints Pending: 1
```

---

### 12. Rejection Files Never Consumed

**Location:** `checkpoints.md` lines 139-156, `execute-phase.md`

**Problem:** Rejection creates file with `approved: false` but nothing reads it. Rejected plans still execute.

**Fix:** In execute-phase, check for rejection:
```bash
if [ -f ".planning/checkpoints/approved/phase-${phase}-plan-${plan}.json" ]; then
  if grep -q '"approved": false' ...; then
    log "Plan rejected, skipping"
    continue
  fi
fi
```

---

### 13. Token Extraction Regex Too Permissive

**Location:** `autopilot-script.sh` line 142

**Problem:**
```bash
grep -o 'tokens[: ]*[0-9,]*' "$log_file"
```

Matches "tokenization", "tokens_sent", etc. Budget tracking inaccurate.

**Fix:** Stricter pattern:
```bash
grep -oP '(?<=tokens used: )\d+' "$log_file"
```

---

### 14. Cost Tracked on Failed Attempts

**Location:** `autopilot-script.sh` line 252

**Problem:** `track_cost` called even if phase fails. Retries inflate budget.

**Fix:** Only track on success:
```bash
if execute_phase "$phase"; then
  track_cost "$phase_log" "$phase"
fi
```

---

## Minor Issues (Nice to Fix)

| Issue | Location | Description |
|-------|----------|-------------|
| Log rotation missing | Script | Logs grow unbounded |
| Banner output not logged | Script | Can't reconstruct timeline from logs |
| Hardcoded 80% budget warning | Script | Should be configurable |
| Trap only on EXIT | Script | SIGTERM leaves stale lock |
| Webhook errors silent | Script | `|| true` masks failures |
| Phase directory glob fragile | Script | Multiple matches pick arbitrary |
| Template variables not validated | Script | Literal `{{var}}` if unfilled |
| Bash arithmetic overflow | Script | Large token counts wrap |

---

## Design Questions

### Q1: Who spawns continuation after checkpoint approval?

**Current state:** Undefined. Approval file created but nothing consumes it.

**Options:**
1. `/gsd:checkpoints approve` spawns continuation
2. Autopilot detects approval files on next iteration
3. User manually runs continuation command

**Recommendation:** Option 2—autopilot detects and spawns. Keeps checkpoint command simple.

---

### Q2: Should autopilot pause at checkpoints or continue?

**Current behavior:** Queues checkpoint, continues to next phase.

**Question:** Is this intended? User might expect autopilot to wait.

**Recommendation:** Current behavior is correct for "queue" mode. Document clearly.

---

### Q3: How to handle partial phase execution?

**Scenario:** Plan 2 of 3 fails after MAX_RETRIES.

**Current behavior:** Phase marked failed, autopilot stops.

**Question:** Should it continue to next phase? Skip the failed plan?

**Recommendation:** Stop is correct. Failed plan might block dependent phases.

---

### Q4: What's the expected duration per phase?

**Current assumption:** "Hours across multiple phases"

**Question:** Should autopilot have per-phase timeout?

**Recommendation:** No timeout. Phases vary wildly. Let `--max-turns` on claude -p provide guard.

---

## Priority Matrix

| Priority | Count | Action |
|----------|-------|--------|
| **P0 - Critical** | 8 | Fix before any user testing |
| **P1 - Important** | 6 | Fix before recommending to users |
| **P2 - Minor** | 8 | Backlog for polish |
| **P3 - Questions** | 4 | Decide and document |

---

## Recommended Fix Order

1. **Lock file** (prevents data corruption)
2. **Exit code handling** (prevents silent failures)
3. **Help documentation** (discoverability)
4. **Phase completion check** (prevents re-execution)
5. **Checkpoint continuation handoff** (completes the workflow)
6. **AWK state update** (prevents state corruption)
7. **`bc` dependency** (cross-platform support)
8. **AskUserQuestion in tools** (phases don't fail)

---

## Files to Modify

| File | Changes Needed |
|------|----------------|
| `get-shit-done/templates/autopilot-script.sh` | Lock, exit codes, completion check, bc, tools |
| `commands/gsd/autopilot.md` | Documentation clarity |
| `commands/gsd/checkpoints.md` | ID mapping, continuation handoff |
| `commands/gsd/help.md` | Add autopilot, checkpoints entries |
| `commands/gsd/progress.md` | Show autopilot status |
| `get-shit-done/workflows/execute-phase.md` | Rejection handling |

---

## Conclusion

The autopilot architecture is solid. The shell-script-per-phase design solves context exhaustion elegantly. The gaps are implementation details—error handling, edge cases, documentation—not fundamental design flaws.

**Estimated fix effort:** 2-3 hours for critical issues, 1-2 hours for important issues.

**After fixes:** Autopilot will be a reliable "fire and forget" execution mode that transforms GSD from interactive to autonomous.
