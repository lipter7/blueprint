---
name: bp:new-milestone
description: Start a new milestone cycle — update PROJECT.md and route to requirements
argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Start a new milestone: questioning → research (optional) → requirements → roadmap.

Brownfield equivalent of new-project. Project exists, PROJECT.md has history. Gathers "what's next", updates PROJECT.md, then runs requirements → roadmap cycle.

**Creates/Updates:**
- `.blueprint/PROJECT.md` — updated with new milestone goals
- `.blueprint/research/` — domain research (optional, NEW features only)
- `.blueprint/REQUIREMENTS.md` — scoped requirements for this milestone
- `.blueprint/ROADMAP.md` — phase structure (continues numbering)
- `.blueprint/STATE.md` — reset for new milestone

**After:** `/bp:plan-phase [N]` to start execution.
</objective>

<execution_context>
@~/.claude/blueprint/workflows/new-milestone.md
@~/.claude/blueprint/references/questioning.md
@~/.claude/blueprint/references/ui-brand.md
@~/.claude/blueprint/templates/project.md
@~/.claude/blueprint/templates/requirements.md
</execution_context>

<context>
Milestone name: $ARGUMENTS (optional - will prompt if not provided)

**Load project context:**
@.blueprint/PROJECT.md
@.blueprint/STATE.md
@.blueprint/MILESTONES.md
@.blueprint/config.json

**Load milestone context (if exists, from /bp:discuss-milestone):**
@.blueprint/MILESTONE-CONTEXT.md
</context>

<process>
Execute the new-milestone workflow from @~/.claude/blueprint/workflows/new-milestone.md end-to-end.
Preserve all workflow gates (validation, questioning, research, requirements, roadmap approval, commits).
</process>
