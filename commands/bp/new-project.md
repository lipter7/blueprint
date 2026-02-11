---
name: gsd:new-project
description: Initialize a new project with deep context gathering and PROJECT.md
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---
<context>
**Flags:**
- `--auto` — Automatic mode. After config questions, runs research → requirements → roadmap without further interaction. Expects idea document via @ reference.
</context>

<objective>
Initialize a new project through unified flow: questioning → research (optional) → requirements → roadmap.

**Creates:**
- `.blueprint/PROJECT.md` — project context
- `.blueprint/config.json` — workflow preferences
- `.blueprint/research/` — domain research (optional)
- `.blueprint/REQUIREMENTS.md` — scoped requirements
- `.blueprint/ROADMAP.md` — phase structure
- `.blueprint/STATE.md` — project memory

**After this command:** Run `/bp:plan-phase 1` to start execution.
</objective>

<execution_context>
@~/.claude/blueprint/workflows/new-project.md
@~/.claude/blueprint/references/questioning.md
@~/.claude/blueprint/references/ui-brand.md
@~/.claude/blueprint/templates/project.md
@~/.claude/blueprint/templates/requirements.md
</execution_context>

<process>
Execute the new-project workflow from @~/.claude/blueprint/workflows/new-project.md end-to-end.
Preserve all workflow gates (validation, approvals, commits, routing).
</process>
