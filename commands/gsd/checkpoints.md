---
name: gsd:checkpoints
description: Review and approve pending checkpoints from autopilot execution
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<objective>
Interactive guided flow to review and complete pending checkpoints from autopilot.

Checkpoints are human tasks created when plans need manual intervention (adding secrets, external setup, design decisions). This command walks you through each one.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<process>

## 1. Check for Pending Checkpoints

```bash
PENDING_DIR=".planning/checkpoints/pending"
PENDING_COUNT=$(ls "$PENDING_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
```

**If no checkpoints:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CHECKPOINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No pending checkpoints.

Checkpoints are created when autopilot encounters tasks that need
your input—like adding API keys or making design decisions.

Run /gsd:autopilot to start autonomous execution.
```

**Stop here if no checkpoints.**

## 2. Present Checkpoint Selection

Build options from pending checkpoint files. Parse each JSON to extract:
- Phase number
- Plan name
- Brief description of what's awaiting

Use AskUserQuestion:
```
question: "You have {N} pending checkpoints. Which would you like to handle?"
header: "Checkpoint"
options:
  - label: "Phase {X}: {task_name}"
    description: "{brief awaiting description}"
  - label: "Phase {Y}: {task_name}"
    description: "{brief awaiting description}"
  - ... (up to 4, or summarize if more)
  - label: "Skip for now"
    description: "Exit without handling any checkpoints"
```

**If "Skip for now":** End with "Run /gsd:checkpoints when you're ready."

## 3. Show Checkpoint Instructions

For the selected checkpoint, read the full JSON and display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CHECKPOINT: {task_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase {X}, Plan {Y} paused here waiting for you.

## What you need to do

{instructions from checkpoint JSON, formatted as numbered steps}

───────────────────────────────────────────────────────
```

## 4. Ask for Completion

Use AskUserQuestion:
```
question: "Have you completed this task?"
header: "Status"
options:
  - label: "Done"
    description: "I've completed the steps above (Recommended)"
  - label: "Skip this feature"
    description: "Don't need this, continue without it"
  - label: "Later"
    description: "I'll handle this another time"
```

### If "Done":

Ask for optional note:
```
question: "Any notes for the continuation? (e.g., 'Used different env var name')"
header: "Notes"
options:
  - label: "No notes"
    description: "Just continue with the plan"
  - label: "Add a note"
    description: "Provide context for the AI"
```

**If "Add a note":** Use AskUserQuestion with text input for the note.

Create approval file:
```json
{
  "phase": "{phase}",
  "plan": "{plan}",
  "approved": true,
  "note": "{user note or empty}",
  "approved_at": "{ISO timestamp}"
}
```

Write to `.planning/checkpoints/approved/{original_filename}`
Remove from `.planning/checkpoints/pending/`

```
✓ Checkpoint approved

Autopilot will continue this plan on next run.
```

### If "Skip this feature":

Create rejection file:
```json
{
  "phase": "{phase}",
  "plan": "{plan}",
  "approved": false,
  "reason": "User skipped - feature not needed",
  "rejected_at": "{ISO timestamp}"
}
```

Write to `.planning/checkpoints/approved/{original_filename}`
Remove from `.planning/checkpoints/pending/`

```
✓ Checkpoint skipped

This plan will be marked as skipped during execution.
```

### If "Later":

Leave checkpoint in pending, no changes.

```
Checkpoint remains pending. Run /gsd:checkpoints when ready.
```

## 5. Offer Next Checkpoint

If more pending checkpoints remain:

Use AskUserQuestion:
```
question: "You have {N} more pending checkpoints."
header: "Continue"
options:
  - label: "Handle next"
    description: "{next checkpoint brief description}"
  - label: "Done for now"
    description: "Exit checkpoints"
```

**If "Handle next":** Loop back to step 3 with the next checkpoint.

**If "Done for now":**
```
───────────────────────────────────────────────────────

{N} checkpoints remaining. Run /gsd:checkpoints to continue.

Autopilot will process approved checkpoints on next run,
or run it now: bash .planning/autopilot.sh
```

</process>

<checkpoint_json_format>
Pending checkpoint files contain:

```json
{
  "phase": "03",
  "plan": "02",
  "plan_name": "OAuth Integration",
  "task_name": "Add Google OAuth credentials",
  "instructions": "1. Go to console.cloud.google.com\n2. Create OAuth 2.0 credential\n3. Add to .env.local:\n   GOOGLE_CLIENT_ID=your-id\n   GOOGLE_CLIENT_SECRET=your-secret",
  "context": "Plan paused after task 2. Remaining tasks need OAuth configured.",
  "completed_tasks": [
    {"task": 1, "commit": "abc123", "name": "Create OAuth service skeleton"},
    {"task": 2, "commit": "def456", "name": "Add config structure"}
  ],
  "created_at": "2026-01-26T14:30:00Z"
}
```

The `instructions` field is what gets shown to the user. It should be actionable steps they can follow, not a request for data to paste.
</checkpoint_json_format>

<success_criteria>
- [ ] Graceful handling when no checkpoints exist
- [ ] Interactive selection when multiple checkpoints pending
- [ ] Clear instructions displayed for selected checkpoint
- [ ] Three completion options: Done / Skip / Later
- [ ] Optional notes on Done
- [ ] Approval/rejection files created correctly
- [ ] Loops to offer next checkpoint
- [ ] No secrets stored in checkpoint files
</success_criteria>
