#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# GSD Autopilot Script
# Generated: {{timestamp}}
# Project: {{project_name}}
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script autonomously executes all remaining phases in the milestone.
# Each phase gets fresh 200k context via claude -p.
# State persists in .planning/ - safe to interrupt and resume.
#
# Usage:
#   bash .planning/autopilot.sh              # Run attached
#   nohup bash .planning/autopilot.sh &      # Run in background
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Signal to GSD commands that we're in autopilot mode
# Commands will suppress "Next Up" guidance and use plain text output
export GSD_AUTOPILOT=1

# ─────────────────────────────────────────────────────────────────────────────
# Configuration (filled by /gsd:autopilot)
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_DIR="{{project_dir}}"
PROJECT_NAME="{{project_name}}"
PHASES=({{phases}})
CHECKPOINT_MODE="{{checkpoint_mode}}"
MAX_RETRIES={{max_retries}}
BUDGET_LIMIT={{budget_limit}}
WEBHOOK_URL="{{webhook_url}}"
MODEL_PROFILE="{{model_profile}}"

# ─────────────────────────────────────────────────────────────────────────────
# Derived paths
# ─────────────────────────────────────────────────────────────────────────────

LOG_DIR="$PROJECT_DIR/.planning/logs"
CHECKPOINT_DIR="$PROJECT_DIR/.planning/checkpoints"
STATE_FILE="$PROJECT_DIR/.planning/STATE.md"
# Note: Lock uses directory (atomic mkdir) not file - see LOCK_DIR below

# ─────────────────────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────────────────────

cd "$PROJECT_DIR"
mkdir -p "$LOG_DIR" "$CHECKPOINT_DIR/pending" "$CHECKPOINT_DIR/approved"

# Lock directory (atomic creation prevents race condition)
LOCK_DIR="$PROJECT_DIR/.planning/autopilot.lock.d"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "ERROR: Autopilot already running (lock exists: $LOCK_DIR)"
  echo "If previous run crashed, remove manually: rmdir '$LOCK_DIR'"
  exit 1
fi
trap "rmdir '$LOCK_DIR' 2>/dev/null" EXIT INT TERM

# ─────────────────────────────────────────────────────────────────────────────
# Logging & Notifications
# ─────────────────────────────────────────────────────────────────────────────

log() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/autopilot.log"
}

banner() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " GSD ► $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

notify() {
  local message="$1"
  local status="${2:-info}"

  log "NOTIFY" "$message"

  # Terminal bell
  echo -e "\a"

  # Webhook if configured
  if [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"text\": \"GSD Autopilot [$PROJECT_NAME]: $message\", \"status\": \"$status\"}" \
      > /dev/null 2>&1 || true
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# State Management
# ─────────────────────────────────────────────────────────────────────────────

update_autopilot_state() {
  local mode="$1"
  local phase="$2"
  local remaining="$3"
  local error="${4:-none}"

  # Update or create Autopilot section in STATE.md
  if grep -q "## Autopilot" "$STATE_FILE" 2>/dev/null; then
    # Update existing section (using temp file for portability)
    awk -v mode="$mode" -v phase="$phase" -v remaining="$remaining" -v error="$error" -v ts="$(date -Iseconds)" '
      /^## Autopilot/,/^## / {
        if (/^- \*\*Mode:\*\*/) { print "- **Mode:** " mode; next }
        if (/^- \*\*Current Phase:\*\*/) { print "- **Current Phase:** " phase; next }
        if (/^- \*\*Phases Remaining:\*\*/) { print "- **Phases Remaining:** " remaining; next }
        if (/^- \*\*Last Error:\*\*/) { print "- **Last Error:** " error; next }
        if (/^- \*\*Updated:\*\*/) { print "- **Updated:** " ts; next }
      }
      { print }
    ' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
  else
    # Append new section
    cat >> "$STATE_FILE" << EOF

## Autopilot

- **Mode:** $mode
- **Started:** $(date -Iseconds)
- **Current Phase:** $phase
- **Phases Remaining:** $remaining
- **Checkpoints Pending:** (none)
- **Last Error:** $error
- **Updated:** $(date -Iseconds)
EOF
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Cost Tracking
# ─────────────────────────────────────────────────────────────────────────────

TOTAL_TOKENS=0
TOTAL_COST=0

track_cost() {
  local log_file="$1"
  local phase="$2"

  # Try to extract token count from log (format varies by claude version)
  local tokens=$(grep -o 'tokens[: ]*[0-9,]*' "$log_file" 2>/dev/null | tail -1 | grep -o '[0-9]*' | tr -d ',' || echo "0")

  if [ "$tokens" -gt 0 ]; then
    TOTAL_TOKENS=$((TOTAL_TOKENS + tokens))
    # Rough cost estimate: $3/1M input, $15/1M output, assume 60% output
    local cost=$(echo "scale=2; $tokens * 0.0000108" | bc)
    TOTAL_COST=$(echo "scale=2; $TOTAL_COST + $cost" | bc)

    log "COST" "Phase $phase: ${tokens} tokens (~\$${cost})"
  fi

  # Budget check
  if [ "$BUDGET_LIMIT" -gt 0 ]; then
    local exceeded=$(echo "$TOTAL_COST > $BUDGET_LIMIT" | bc)
    if [ "$exceeded" -eq 1 ]; then
      notify "Budget exceeded: \$${TOTAL_COST} / \$${BUDGET_LIMIT}" "error"
      update_autopilot_state "paused" "$phase" "${PHASES[*]}" "budget_exceeded"
      exit 0
    fi

    # Warning at 80%
    local warning_threshold=$(echo "$BUDGET_LIMIT * 0.8" | bc)
    local near_limit=$(echo "$TOTAL_COST > $warning_threshold" | bc)
    if [ "$near_limit" -eq 1 ]; then
      notify "Budget warning: \$${TOTAL_COST} / \$${BUDGET_LIMIT} (80%)" "warning"
    fi
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Checkpoint Handling
# ─────────────────────────────────────────────────────────────────────────────

check_pending_approvals() {
  local phase="$1"

  # Look for approved checkpoints for this phase
  for approval in "$CHECKPOINT_DIR/approved/phase-${phase}-"*.json; do
    if [ -f "$approval" ]; then
      log "INFO" "Found approval: $approval"
      return 0
    fi
  done
  return 1
}

queue_checkpoint() {
  local phase="$1"
  local plan="$2"
  local checkpoint_data="$3"

  local checkpoint_file="$CHECKPOINT_DIR/pending/phase-${phase}-plan-${plan}.json"
  echo "$checkpoint_data" > "$checkpoint_file"

  log "CHECKPOINT" "Queued: $checkpoint_file"
  notify "Checkpoint queued: Phase $phase, Plan $plan" "checkpoint"
}

process_approved_checkpoints() {
  # Process any approved checkpoints by spawning continuation agents
  mkdir -p "$CHECKPOINT_DIR/processed"

  for approval in "$CHECKPOINT_DIR/approved/"*.json; do
    [ -f "$approval" ] || continue

    # Check if actually approved (not rejected)
    if grep -q '"approved": false' "$approval" 2>/dev/null; then
      log "INFO" "Checkpoint rejected, skipping: $approval"
      mv "$approval" "$CHECKPOINT_DIR/processed/"
      continue
    fi

    # Extract phase and plan from filename (e.g., phase-03-plan-02.json)
    local basename=$(basename "$approval" .json)
    local phase=$(echo "$basename" | sed -n 's/phase-\([0-9]*\)-.*/\1/p')
    local plan=$(echo "$basename" | sed -n 's/.*plan-\([0-9]*\)/\1/p')

    if [ -z "$phase" ] || [ -z "$plan" ]; then
      log "WARN" "Could not parse phase/plan from: $approval"
      mv "$approval" "$CHECKPOINT_DIR/processed/"
      continue
    fi

    log "INFO" "Processing approved checkpoint: Phase $phase, Plan $plan"

    # Extract user response from approval file
    local user_response=$(grep -o '"response"[[:space:]]*:[[:space:]]*"[^"]*"' "$approval" | sed 's/.*: *"//' | sed 's/"$//' || echo "")

    # Spawn continuation agent
    local continuation_log="$LOG_DIR/continuation-phase${phase}-plan${plan}-$(date +%Y%m%d-%H%M%S).log"

    echo ""
    echo "◆ Continuing Phase $phase, Plan $plan (checkpoint approved)..."
    echo ""

    # Pass the checkpoint context and user response to continuation
    echo "/gsd:execute-plan $phase $plan --continue --checkpoint-response \"$user_response\"" | claude -p \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite,AskUserQuestion" \
        2>&1 | tee -a "$continuation_log"

    if [ ${PIPESTATUS[1]} -ne 0 ]; then
      log "ERROR" "Continuation failed for Phase $phase, Plan $plan"
      # Don't move to processed - will retry on next run
    else
      log "SUCCESS" "Continuation complete for Phase $phase, Plan $plan"
      mv "$approval" "$CHECKPOINT_DIR/processed/"
      track_cost "$continuation_log" "$phase"
    fi
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# Phase Execution
# ─────────────────────────────────────────────────────────────────────────────

is_phase_complete() {
  local phase="$1"
  # Check ROADMAP.md for [x] marker on this phase
  if grep -qE "^- \[x\] \*\*Phase $phase" .planning/ROADMAP.md 2>/dev/null; then
    return 0
  fi
  return 1
}

execute_phase() {
  local phase="$1"
  local attempt=1
  local phase_log="$LOG_DIR/phase-${phase}-$(date +%Y%m%d-%H%M%S).log"

  # Skip already-completed phases (idempotency on resume)
  if is_phase_complete "$phase"; then
    log "INFO" "Phase $phase already complete in ROADMAP.md, skipping"
    return 0
  fi

  banner "PHASE $phase"

  while [ $attempt -le $MAX_RETRIES ]; do
    log "INFO" "Phase $phase - Attempt $attempt of $MAX_RETRIES"

    # Check if phase needs planning
    local phase_dir=$(ls -d .planning/phases/$(printf "%02d" "$phase" 2>/dev/null || echo "$phase")-* 2>/dev/null | head -1)

    if [ -z "$phase_dir" ] || [ $(ls "$phase_dir"/*-PLAN.md 2>/dev/null | wc -l) -eq 0 ]; then
      log "INFO" "Planning phase $phase..."
      echo ""
      echo "◆ Planning phase $phase..."
      echo ""

      echo "/gsd:plan-phase $phase" | claude -p \
          --allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite,AskUserQuestion" \
          2>&1 | tee -a "$phase_log"
      if [ ${PIPESTATUS[1]} -ne 0 ]; then
        log "ERROR" "Planning failed for phase $phase"
        ((attempt++))
        sleep 5
        continue
      fi

      # Re-check phase_dir after planning
      phase_dir=$(ls -d .planning/phases/$(printf "%02d" "$phase" 2>/dev/null || echo "$phase")-* 2>/dev/null | head -1)
    fi

    # Execute phase
    log "INFO" "Executing phase $phase..."
    echo ""
    echo "◆ Executing phase $phase..."
    echo ""

    echo "/gsd:execute-phase $phase" | claude -p \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite,AskUserQuestion" \
        2>&1 | tee -a "$phase_log"
    if [ ${PIPESTATUS[1]} -ne 0 ]; then
      log "ERROR" "Execution failed for phase $phase"
      ((attempt++))
      sleep 5
      continue
    fi

    # Track cost
    track_cost "$phase_log" "$phase"

    # Check verification status
    local verification_file=$(ls "$phase_dir"/*-VERIFICATION.md 2>/dev/null | head -1)
    local status="unknown"

    if [ -f "$verification_file" ]; then
      status=$(grep "^status:" "$verification_file" | head -1 | cut -d: -f2 | tr -d ' ')
    fi

    log "INFO" "Phase $phase verification status: $status"

    case "$status" in
      "passed")
        log "SUCCESS" "Phase $phase VERIFIED"
        notify "Phase $phase complete" "success"
        return 0
        ;;

      "gaps_found")
        log "INFO" "Phase $phase has gaps, planning closure..."
        echo ""
        echo "◆ Planning gap closure for phase $phase..."
        echo ""

        echo "/gsd:plan-phase $phase --gaps" | claude -p \
            --allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite,AskUserQuestion" \
            2>&1 | tee -a "$phase_log"
        if [ ${PIPESTATUS[1]} -ne 0 ]; then
          log "ERROR" "Gap planning failed for phase $phase"
          ((attempt++))
          continue
        fi

        echo ""
        echo "◆ Executing gap closure for phase $phase..."
        echo ""

        echo "/gsd:execute-phase $phase --gaps-only" | claude -p \
            --allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite,AskUserQuestion" \
            2>&1 | tee -a "$phase_log"
        if [ ${PIPESTATUS[1]} -ne 0 ]; then
          log "ERROR" "Gap execution failed for phase $phase"
          ((attempt++))
          continue
        fi

        # Track additional cost
        track_cost "$phase_log" "$phase"

        # Re-check verification
        status=$(grep "^status:" "$verification_file" 2>/dev/null | tail -1 | cut -d: -f2 | tr -d ' ')

        if [ "$status" = "passed" ]; then
          log "SUCCESS" "Phase $phase VERIFIED after gap closure"
          notify "Phase $phase complete (after gap closure)" "success"
          return 0
        else
          log "WARN" "Phase $phase still has gaps after closure attempt"
          ((attempt++))
          continue
        fi
        ;;

      "human_needed")
        log "INFO" "Phase $phase needs human verification"

        if [ "$CHECKPOINT_MODE" = "queue" ]; then
          # Queue for later and continue
          queue_checkpoint "$phase" "verification" "{\"type\": \"human_verification\", \"phase\": \"$phase\"}"
          log "INFO" "Human verification queued, continuing..."
          return 0
        else
          # Skip mode - just continue
          log "WARN" "Skipping human verification (checkpoint_mode: skip)"
          return 0
        fi
        ;;

      *)
        # Unknown or no verification - assume success if execution completed
        log "WARN" "Unknown verification status: $status (treating as success)"
        return 0
        ;;
    esac
  done

  # All retries exhausted
  log "FATAL" "Phase $phase failed after $MAX_RETRIES attempts"
  notify "Phase $phase FAILED after $MAX_RETRIES attempts" "error"
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Execution Loop
# ─────────────────────────────────────────────────────────────────────────────

main() {
  banner "AUTOPILOT STARTED"

  log "INFO" "Project: $PROJECT_NAME"
  log "INFO" "Phases: ${PHASES[*]}"
  log "INFO" "Checkpoint mode: $CHECKPOINT_MODE"
  log "INFO" "Max retries: $MAX_RETRIES"
  log "INFO" "Budget limit: \$$BUDGET_LIMIT"

  notify "Autopilot started for $PROJECT_NAME" "info"

  local remaining_phases=("${PHASES[@]}")

  for phase in "${PHASES[@]}"; do
    # Process any approved checkpoints before starting phase
    process_approved_checkpoints

    # Update remaining list
    remaining_phases=("${remaining_phases[@]:1}")
    local remaining_str="${remaining_phases[*]:-none}"

    update_autopilot_state "running" "$phase" "$remaining_str"

    if ! execute_phase "$phase"; then
      update_autopilot_state "failed" "$phase" "$remaining_str" "phase_$phase_failed"
      log "FATAL" "Autopilot stopped at phase $phase"
      notify "Autopilot STOPPED at phase $phase" "error"
      exit 1
    fi

    log "SUCCESS" "Phase $phase complete"
    echo ""
    echo "✓ Phase $phase complete"
    echo ""
  done

  # Process any final approved checkpoints
  process_approved_checkpoints

  # All phases complete
  banner "MILESTONE COMPLETE"

  update_autopilot_state "completed" "all" "none"

  log "SUCCESS" "All ${#PHASES[@]} phases completed"
  log "INFO" "Total tokens: $TOTAL_TOKENS"
  log "INFO" "Total cost: \$$TOTAL_COST"

  # Complete milestone
  echo ""
  echo "◆ Completing milestone..."
  echo ""

  echo "/gsd:complete-milestone" | claude -p \
    --allowedTools "Read,Write,Edit,Glob,Grep,Bash,AskUserQuestion" \
    2>&1 | tee -a "$LOG_DIR/milestone-complete.log"
  # Don't fail on milestone completion - phases are done

  notify "Milestone COMPLETE! ${#PHASES[@]} phases, \$$TOTAL_COST" "success"

  # Final summary
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " AUTOPILOT SUMMARY"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Phases completed: ${#PHASES[@]}"
  echo "Total tokens: $TOTAL_TOKENS"
  echo "Total cost: \$$TOTAL_COST"
  echo "Logs: $LOG_DIR/"
  echo ""

  # Check for pending checkpoints
  local pending_count=$(ls "$CHECKPOINT_DIR/pending/"*.json 2>/dev/null | wc -l | tr -d ' ')
  if [ "$pending_count" -gt 0 ]; then
    echo "⚠ Pending checkpoints: $pending_count"
    echo "Review: ls $CHECKPOINT_DIR/pending/"
    echo ""
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────

main "$@"
