---
name: gsd:quick
description: Execute a quick task with Blueprint guarantees (atomic commits, state tracking) but skip optional agents
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Execute small, ad-hoc tasks with Blueprint guarantees (atomic commits, STATE.md tracking) while skipping optional agents (research, plan-checker, verifier).

Quick mode is the same system with a shorter path:
- Spawns bp-planner (quick mode) + bp-executor(s)
- Skips bp-phase-researcher, bp-plan-checker, bp-verifier
- Quick tasks live in `.blueprint/quick/` separate from planned phases
- Updates STATE.md "Quick Tasks Completed" table (NOT ROADMAP.md)

Use when: You know exactly what to do and the task is small enough to not need research or verification.
</objective>

<execution_context>
@~/.claude/blueprint/workflows/quick.md
</execution_context>

<context>
@.blueprint/STATE.md
</context>

<process>
Execute the quick workflow from @~/.claude/blueprint/workflows/quick.md end-to-end.
Preserve all workflow gates (validation, task description, planning, execution, state updates, commits).
</process>
