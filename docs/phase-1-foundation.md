# Phase 1: Foundation

**Goal:** Set up the directory structure, adapt all templates, write the rule file, and clean up the old GSD files we no longer need.

**Why this goes first:** Templates are referenced by commands and subagents. The rule file provides Cursor with background context. Both need to exist before Phase 2. Cleanup goes here too so we start Phase 2 with a clean workspace.

---

## Step 1: Scaffold Directory Structure

Create the following empty directories:

```
.cursor/
  commands/
  agents/
  rules/
templates/
  codebase/
bin/
```

These are the Cursor-native locations for commands (`.cursor/commands/`), subagents (`.cursor/agents/`), and rules (`.cursor/rules/`). The `templates/` directory lives at the project root since it's shared across runtimes. The `bin/` directory is for the installer (Phase 3).

---

## Step 2: Adapt Templates

Take the existing GSD templates from `get-shit-done/templates/` and adapt them for Blueprint. Every template needs these changes:

**Universal changes across all templates:**
- Replace all `.planning/` paths with `.blueprint/`
- Remove all `gsd-` prefixed references (e.g., `gsd-planner`, `gsd-phase-researcher`)
- Replace downstream consumer references with Blueprint agent names (e.g., `codebase-mapper`, `phase-executor`)
- Remove references to `gsd-tools.js`
- Remove references to `~/.claude/` paths
- Update command references (e.g., `/gsd:map-codebase` becomes `/01-map-codebase`)

### Templates to Adapt (9 files)

**From `get-shit-done/templates/roadmap.md` -> `templates/roadmap.md`**
- Change `.planning/ROADMAP.md` references to `.blueprint/ROADMAP.md`
- Remove milestone-grouped roadmap section (we cut milestone ceremony)
- Remove plan-level sub-tracking (01-01, 01-02 numbering) -- Blueprint uses one plan per phase, not multiple
- Keep: phase structure, success criteria, progress table, status values, decimal phase insertion

**From `get-shit-done/templates/requirements.md` -> `templates/requirements.md`**
- Change `.planning/REQUIREMENTS.md` to `.blueprint/REQUIREMENTS.md`
- Remove references to FEATURES.md from research phase (we cut research agents)
- Keep: requirement ID format, v1/v2 split, out of scope table, traceability matrix

**From `get-shit-done/templates/state.md` -> `templates/state.md`**
- Change `.planning/STATE.md` to `.blueprint/STATE.md`
- Remove: pending todos section (Cursor's TodoWrite handles this)
- Remove: resume file / `.continue-here*.md` references (Cursor has session resume)
- Remove: performance metrics section (too much ceremony for our simpler workflow)
- Simplify to: project reference, current position, accumulated context (decisions + blockers), session continuity
- Target: well under 100 lines

**From `get-shit-done/templates/context.md` -> `templates/context.md`**
- Change `.planning/phases/XX-name/` to `.blueprint/phases/XX-name/`
- Replace `gsd-phase-researcher` and `gsd-planner` consumer references with `phase-executor`
- Keep: the XML-structured template, domain/decisions/specifics/deferred sections, examples, guidelines
- Keep all three examples (they're excellent)

**From `get-shit-done/templates/project.md` -> `templates/project.md`**
- Change `.planning/PROJECT.md` to `.blueprint/PROJECT.md`
- Replace `/gsd:map-codebase` with `/01-map-codebase` in brownfield section
- Keep: everything else (this template is already clean and well-structured)

**New: `templates/progress.md`** (based on user's planner+tracker pattern)
- Lightweight phase checklist
- Format based on user's `_ROADMAP_PROGRESS.md` pattern from their example commands
- Structure:
  ```
  # Progress: [Project Name]
  
  ## Phases
  
  ### Phase 1: [Name]
  - Status: Not started | In progress | Complete
  - [ ] Step/goal 1
  - [ ] Step/goal 2
  
  ### Phase 2: [Name]
  ...
  
  ## Summary
  Phases complete: 0/N
  Current: Phase 1
  ```

**New: `templates/plan.md`** (phase implementation plan)
- Uses YAML frontmatter for todo tracking (user's pattern from execute-phase-plan)
- Structure:
  ```
  ---
  phase: X
  name: [Phase Name]
  status: pending
  created: YYYY-MM-DD
  todos:
    - id: 1
      task: [Description]
      files: [file1.ts, file2.ts]
      status: pending
    - id: 2
      task: [Description]
      files: [file3.ts]
      status: pending
  ---
  
  # Phase X: [Name] -- Implementation Plan
  
  ## Goal
  [From ROADMAP.md success criteria]
  
  ## Context
  [Key decisions from CONTEXT.md]
  
  ## Tasks
  ### 1. [Task Name]
  **Files:** `file1.ts`, `file2.ts`
  **Steps:**
  1. [Specific step]
  2. [Specific step]
  **Verification:** [How to confirm this task is done]
  
  ### 2. [Task Name]
  ...
  ```

**New: `templates/summary.md`** (single format replacing GSD's three variants)
- One summary format, not three (complex/standard/minimal)
- Covers: what was done, files changed, decisions made, issues found, next steps

**New: `templates/verification.md`** (verification report)
- Adapted from GSD's `verification-report.md`
- Structure: goal restated, criteria checked, evidence, pass/fail verdict

**New: `templates/config.json`** (default Blueprint config)
- Copied into `.blueprint/config.json` when a project is initialized
- Contains settings like `depth` (quick/standard/comprehensive) and `mode`
- Kept minimal -- just the settings that commands reference

### Templates to Cut (Not Adapted)

These GSD templates are explicitly dropped:

- `milestone.md`, `milestone-archive.md` -- no milestone ceremony (direct ROADMAP.md editing)
- `planner-subagent-prompt.md`, `debug-subagent-prompt.md` -- subagent prompts live in the agent files now
- `summary-complex.md`, `summary-minimal.md`, `summary-standard.md` -- replaced by single `summary.md`
- `UAT.md` -- not needed
- `user-setup.md` -- not needed
- `discovery.md` -- not needed (discovery logic folded into `02-init-project`)
- `continue-here.md` -- Cursor has session resume built in
- `phase-prompt.md` -- prompt logic lives in commands directly
- `research.md` -- research agents cut
- `research-project/` directory (ARCHITECTURE.md, FEATURES.md, PITFALLS.md, STACK.md, SUMMARY.md) -- research phase cut
- `DEBUG.md` -- Cursor has Debug Mode built in

### Codebase Templates (7 files)

Copy from `get-shit-done/templates/codebase/` to `templates/codebase/`:
- `stack.md`, `architecture.md`, `structure.md`, `conventions.md`, `testing.md`, `integrations.md`, `concerns.md`

Changes to each:
- Replace `.planning/codebase/` paths with `.blueprint/codebase/`
- Remove references to `gsd-tools.js` or GSD-specific tooling
- Keep: the template structure, section headers, examples, downstream consumer docs

---

## Step 3: Write the Rule File

Create `.cursor/rules/planning-workflow.mdc`

This is a Cursor rule that provides background context to the agent. It should be applied intelligently (based on the `description` field matching), not always-on.

**Content should cover:**
- What `.blueprint/` is and where files live
- The command flow (01 through 06 + utilities)
- When to read which files (e.g., "always read STATE.md first")
- References to the command files so the agent can read them when relevant
- Keep it concise -- rules add to every prompt when active

**Format (Cursor `.mdc` file):**
```
---
description: "Planning workflow context -- active when working with .blueprint/ files or running planning commands"
globs:
  - ".blueprint/**"
---

[Rule content here in markdown]
```

---

## Step 4: Clean Up Old GSD Files

Remove these directories and files that are being replaced:

**Directories to remove entirely:**
- `commands/` -- replaced by `.cursor/commands/`
- `agents/` -- replaced by `.cursor/agents/`
- `hooks/` -- Cursor hooks are a different format (and we're not using hooks yet)
- `get-shit-done/workflows/` -- logic moves into commands directly
- `get-shit-done/references/` -- GSD-specific (model profiles, phase calculation, etc.)
- `get-shit-done/bin/` -- `gsd-tools.js` not needed
- `scripts/` -- `build-hooks.js` not needed
- `.github/` -- repo artifacts from original GSD
- `assets/` -- branding from original GSD

**Files to remove:**
- `bin/install.js` -- old GSD installer (1,740 lines), replaced by new installer in Phase 3
- `package.json` -- no npm package needed
- `package-lock.json` -- no npm package needed
- `.gitignore` -- will be rewritten if needed
- `CHANGELOG.md` -- original GSD changelog
- `SECURITY.md` -- original GSD security policy

**Keep but move:**
- `get-shit-done/templates/` -- content adapted into `templates/` (Step 2)

**Keep for reference during Phase 2 (delete after):**
- `get-shit-done/templates/` originals -- useful while writing commands/agents

---

## Checklist

- [ ] `.cursor/commands/`, `.cursor/agents/`, `.cursor/rules/` directories created
- [ ] `templates/` directory created with all 10 adapted template files (9 markdown + config.json)
- [ ] `templates/codebase/` directory created with 7 adapted codebase template files
- [ ] `bin/` directory created (empty, for Phase 3)
- [ ] `.cursor/rules/planning-workflow.mdc` written
- [ ] Old GSD directories removed (commands/, agents/, hooks/, workflows/, references/, scripts/, .github/, assets/)
- [ ] Old GSD files removed (package.json, package-lock.json, CHANGELOG.md, SECURITY.md)
- [ ] `get-shit-done/templates/` kept temporarily for Phase 2 reference
