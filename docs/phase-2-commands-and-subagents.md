# Phase 2: Commands and Subagents

**Goal:** Write all 8 command files and all 4 subagent files. This is the core of the framework -- the actual prompts that drive the workflow.

**Why this goes second:** Commands reference templates (Phase 1) and spawn subagents. Both commands and subagents need to be built together since they're tightly coupled.

---

## Formatting Rules (Apply to Everything)

Every command and subagent file must follow these patterns from GSD:

- **XML-structured sections:** `<role>`, `<process>`, `<step>`, `<critical_rules>`, `<success_criteria>`, `<anti_patterns>`, `<output>`, `<templates>`, `<forbidden_files>`
- **Downstream consumer docs:** Document who reads the output and how
- **Success criteria:** `- [ ]` checkboxes that define "done" (verifiable, not vague)
- **Prescriptive language:** "Use X" not "X is used"
- **Anti-patterns:** Explicit "what NOT to do" sections
- **Forbidden files:** Never read `.env`, credentials, keys, secrets

---

## Part A: Commands (8 files in `.cursor/commands/`)

Commands are plain markdown files. No YAML frontmatter for Cursor (the installer adds frontmatter when converting for Claude Code).

### Command 1: `01-map-codebase.md`

**Invoked as:** `/01-map-codebase`  
**Mode:** Agent  
**Source reference:** `commands/gsd/map-codebase.md` + `agents/gsd-codebase-mapper.md`

**What it does:**
- Spawn 4 parallel `codebase-mapper` subagents to analyze the codebase
- Each mapper writes docs directly to `.blueprint/codebase/`
- Orchestrator receives confirmations only (keeps context minimal)

**Key sections to include:**
- `<objective>`: Analyze codebase using parallel mapper subagents, output to `.blueprint/codebase/`
- `<context>`: `$ARGUMENTS` for optional focus area, check for existing `.blueprint/STATE.md`
- `<process>`: Check if `.blueprint/codebase/` exists -> create directory -> spawn 4 agents -> verify 7 docs exist -> offer next steps
- `<success_criteria>`: 7 docs exist in `.blueprint/codebase/`, follow template structure

**Subagent spawning (4 parallel tasks):**
```
Agent 1 (tech):     -> STACK.md, INTEGRATIONS.md
Agent 2 (arch):     -> ARCHITECTURE.md, STRUCTURE.md
Agent 3 (quality):  -> CONVENTIONS.md, TESTING.md
Agent 4 (concerns): -> CONCERNS.md
```

Each spawn uses the Task tool with `subagent_type: "generalPurpose"` and passes the focus area + template content in the prompt.

---

### Command 2: `02-init-project.md`

**Invoked as:** `/02-init-project`  
**Mode:** Agent  
**Source reference:** `commands/gsd/new-project.md` + `get-shit-done/workflows/new-project.md`

**What it does:**
- Adaptive questioning to understand the project
- Create PROJECT.md, REQUIREMENTS.md, ROADMAP.md, PROGRESS.md, STATE.md in `.blueprint/`
- If `.blueprint/codebase/` exists (brownfield), incorporate that context

**Key sections to include:**
- `<role>`: Project architect gathering requirements and creating structure
- `<process>`: Read codebase docs if they exist -> ask questions (adaptive, 3-5 rounds) -> create PROJECT.md -> create REQUIREMENTS.md -> create ROADMAP.md -> create PROGRESS.md -> create STATE.md
- `<questioning>`: Adapt question depth to answers. If user gives detailed answers, go deeper. If short answers, move on. Reference GSD's `references/questioning.md` approach.
- `<templates>`: Reference each template from `templates/`
- `<success_criteria>`: All 5 documents created, requirements traced to phases, progress tracker initialized

**Important:** This command does NOT use Plan Mode. It runs in Agent mode because it needs to create files.

---

### Command 3: `03-discuss-phase.md`

**Invoked as:** `/03-discuss-phase`  
**Mode:** Agent  
**Source reference:** `commands/gsd/discuss-phase.md` + `get-shit-done/workflows/discuss-phase.md`

**What it does:**
- Load phase context from ROADMAP.md
- Adaptive questioning about implementation decisions
- Write CONTEXT.md to `.blueprint/phases/XX-name/`

**Key sections to include:**
- `<role>`: Implementation consultant gathering decisions
- `<context>`: `$ARGUMENTS` is the phase number. Read ROADMAP.md for phase details, STATE.md for current position.
- `<process>`: Read state -> find phase in roadmap -> ask implementation questions (3-8 rounds, adaptive) -> write CONTEXT.md using template -> update STATE.md
- `<philosophy>`: Categories emerge from discussion, not predefined. A CLI phase gets CLI questions, a UI phase gets UI questions.
- `<anti_patterns>`: Don't ask vague questions, don't ask about things already decided in ROADMAP.md
- `<success_criteria>`: CONTEXT.md created with concrete decisions (not vague), STATE.md updated

---

### Command 4: `04-plan-phase.md`

**Invoked as:** `/04-plan-phase`
**Mode:** Agent
**Source reference:** User's `02-plan-phase.md` example + `commands/gsd/plan-phase.md`

**What it does:**
- Research the codebase for the specific phase
- Create an implementation plan in `.blueprint/phases/XX-name/PLAN.md`
- Plan uses YAML frontmatter with todo tracking (user's pattern)
- Plans are stored in the repo (`.blueprint/`), not in Cursor's internal plan storage

**Key sections to include:**
- `<role>`: Implementation planner creating an actionable plan
- `<context>`: `$ARGUMENTS` is the phase number. Read ROADMAP.md, CONTEXT.md, STATE.md, and relevant `.blueprint/codebase/` docs.
- `<process>`: Read all context docs -> explore codebase for relevant files -> create PLAN.md with YAML frontmatter todos -> each task specifies files and verification -> present plan summary for user review
- `<plan_format>`: YAML frontmatter with `todos:` array (each has `id`, `task`, `files`, `status: pending`). Body has detailed steps per task.
- `<critical_rules>`:
  - Every task must list specific files it will touch
  - Every task must have a verification step
  - Tasks ordered by dependency (what needs to happen first)
  - Plan must reference CONTEXT.md decisions (don't re-decide what was already decided)
  - Do NOT execute the plan -- only create it. Execution happens in `/05-execute-phase`
- `<success_criteria>`: PLAN.md created with YAML frontmatter, all tasks have files listed, tasks have verification, plan references context decisions

**Note:** This command creates the plan document but does not execute it. The user reviews PLAN.md before running `/05-execute-phase`. Plans live in `.blueprint/phases/` so they're version-controlled and visible in the repo.

---

### Command 5: `05-execute-phase.md`

**Invoked as:** `/05-execute-phase`  
**Mode:** Agent  
**Source reference:** User's `03-execute-phase-plan.md` example

**What it does:**
- Read the plan from `.blueprint/phases/XX-name/PLAN.md`
- Spawn a `phase-executor` subagent in a fresh context with the plan content
- The subagent does all the work; parent stays clean

**Key sections to include:**
- `<role>`: Orchestrator that delegates execution to a fresh-context subagent
- `<context>`: `$ARGUMENTS` is the phase number. Read PLAN.md to get the full plan content.
- `<process>`: Read PLAN.md -> read STATE.md for current position -> spawn `phase-executor` subagent via Task tool, passing: the full plan content, the deviation policy, the progress tracking instructions -> receive summary when done -> update PROGRESS.md and STATE.md
- `<critical_rules>`:
  - Do NOT execute the plan yourself -- spawn the subagent
  - Pass the FULL plan content to the subagent (it can't read files from your context)
  - The subagent runs in a fresh context (this is the "+ New Agent" automation)
- `<success_criteria>`: Subagent spawned, plan executed, PROGRESS.md updated, STATE.md updated

**Subagent spawning:**
```
Task tool call:
  subagent_type: "generalPurpose"
  prompt: [Full plan content + executor instructions + deviation policy]
```

---

### Command 6: `06-verify-phase.md`

**Invoked as:** `/06-verify-phase`  
**Mode:** Agent  
**Source reference:** `agents/gsd-verifier.md` + `agents/gsd-integration-checker.md`

**What it does:**
- Spawn `phase-verifier` subagent to check the phase goal was achieved
- If multiple phases are complete, also spawn `integration-checker` subagent
- Write VERIFICATION.md to `.blueprint/phases/XX-name/`

**Key sections to include:**
- `<role>`: Orchestrator that delegates verification to fresh-context subagents
- `<context>`: `$ARGUMENTS` is the phase number. Read ROADMAP.md for success criteria, PLAN.md for what was supposed to happen.
- `<process>`: Read roadmap success criteria for this phase -> spawn `phase-verifier` subagent with criteria + plan -> if >1 phase complete, also spawn `integration-checker` -> collect results -> write VERIFICATION.md -> update STATE.md and PROGRESS.md
- `<success_criteria>`: VERIFICATION.md created with pass/fail per criterion, PROGRESS.md updated

---

### Command 7: `quick-task.md`

**Invoked as:** `/quick-task`  
**Mode:** Agent  
**Source reference:** `commands/gsd/quick.md`

**What it does:**
- Execute an ad-hoc task outside the phase workflow
- Log what was done to STATE.md

**Key sections to include:**
- `<role>`: Quick execution agent for one-off tasks
- `<context>`: `$ARGUMENTS` is the task description. Read STATE.md for project context.
- `<process>`: Read STATE.md -> execute the task described in arguments -> update STATE.md accumulated context with what was done
- `<critical_rules>`: Don't modify ROADMAP.md or PROGRESS.md (this isn't a phase). Do update STATE.md.
- `<success_criteria>`: Task completed, STATE.md updated

---

### Command 8: `show-progress.md`

**Invoked as:** `/show-progress`  
**Mode:** Ask (read-only)  
**Source reference:** `commands/gsd/progress.md` + `commands/gsd/help.md`

**What it does:**
- Display current project state, what's next, and list available commands
- Read-only -- doesn't modify anything

**Key sections to include:**
- `<role>`: Status reporter and guide
- `<context>`: Read STATE.md, PROGRESS.md, ROADMAP.md
- `<process>`: Read all three files -> present: current phase, overall progress, what's next, list of available commands with descriptions
- `<output>`: Formatted status display with progress indicators
- `<success_criteria>`: User knows where they are, what's next, and what commands are available

---

## Part B: Subagents (4 files in `.cursor/agents/`)

Subagents use YAML frontmatter for Cursor configuration. The frontmatter fields are: `name`, `description`, `model` (optional), `readonly` (optional), `is_background` (optional).

### Subagent 1: `codebase-mapper.md`

**Source reference:** `agents/gsd-codebase-mapper.md`

**Frontmatter:**
```yaml
---
name: codebase-mapper
description: Analyzes codebase for a specific focus area and writes structured documents to .blueprint/codebase/
---
```

**What it does:**
- Receives a focus area (tech/arch/quality/concerns) and template content from the spawning command
- Explores the codebase thoroughly
- Writes analysis documents directly to `.blueprint/codebase/`

**Key adaptations from GSD's `gsd-codebase-mapper.md`:**
- Replace `.planning/` with `.blueprint/`
- Replace `Bash` tool references with `Shell`
- Remove `gsd-tools.js` dependencies
- Use Cursor tool names (Shell, Read, StrReplace, Glob, Grep)
- Keep: the four focus areas, the 7 output documents, the template structure, the exploration process, the downstream consumer documentation
- Keep: the anti-patterns, forbidden files, and the "write documents directly" pattern

---

### Subagent 2: `phase-executor.md`

**Source reference:** User's `03-execute-phase-plan.md` + `agents/gsd-executor.md`

**Frontmatter:**
```yaml
---
name: phase-executor
description: Executes a phase implementation plan in a fresh context with structured progress tracking
---
```

**What it does:**
- Receives the full plan content from the spawning command
- Executes each task in order, tracking progress via YAML frontmatter status updates
- Follows deviation policy
- Makes atomic commits per task
- Returns a structured summary

**Key sections to include:**
- `<role>`: Implementation engineer executing a plan
- `<plan_tracking>`: Update YAML frontmatter `status: pending` -> `status: in_progress` -> `status: completed` for each todo
- `<deviation_policy>`:
  - Factual inaccuracy in plan: Fix and note the deviation
  - Clear improvement opportunity: Apply if low-risk, note it
  - Codebase conventions differ from plan: Follow codebase conventions
  - Major architectural disagreement: Stop and note, don't deviate
- `<commit_discipline>`: One commit per task, descriptive messages
- `<output>`: Structured summary of what was done, files changed, deviations taken
- `<success_criteria>`: All plan todos completed or explicitly noted, YAML frontmatter updated, atomic commits made

---

### Subagent 3: `phase-verifier.md`

**Source reference:** `agents/gsd-verifier.md`

**Frontmatter:**
```yaml
---
name: phase-verifier
description: Verifies that a phase achieved its goals by checking success criteria against actual code
readonly: true
---
```

**What it does:**
- Receives success criteria from ROADMAP.md and the plan content
- Checks each criterion against the actual codebase
- Goal-backward verification (checks the GOAL, not just task completion)
- Writes VERIFICATION.md

**Key adaptations from GSD's `gsd-verifier.md`:**
- Replace `.planning/` with `.blueprint/`
- Remove `gsd-tools.js` dependency (use Glob/Grep directly)
- Use Cursor tool names
- Keep: goal-backward verification approach, evidence gathering, pass/fail per criterion
- Keep: the verification report template structure
- Mark as `readonly: true` -- verifier should not modify code

---

### Subagent 4: `integration-checker.md`

**Source reference:** `agents/gsd-integration-checker.md`

**Frontmatter:**
```yaml
---
name: integration-checker
description: Checks cross-phase integration -- exports used, APIs consumed, E2E flows complete
readonly: true
---
```

**What it does:**
- Receives information about completed phases
- Checks that phases integrate correctly (exports consumed, APIs working, flows end-to-end)
- Only spawned when multiple phases are complete

**Key adaptations from GSD's `gsd-integration-checker.md`:**
- Replace `.planning/` with `.blueprint/`
- Remove `gsd-tools.js` dependency
- Use Cursor tool names
- Keep: cross-phase checking logic, integration patterns, evidence gathering
- Mark as `readonly: true`

---

## Wiring: How Commands Spawn Subagents

```
01-map-codebase  --spawns-->  codebase-mapper (x4 parallel, different focus areas)
05-execute-phase --spawns-->  phase-executor  (x1, fresh context with full plan)
06-verify-phase  --spawns-->  phase-verifier  (x1, fresh context with criteria)
06-verify-phase  --spawns-->  integration-checker (x1, only if multiple phases done)
```

Commands 02, 03, 04, 07, 08 do NOT spawn subagents -- they run directly in the agent session.

---

## Checklist

- [ ] All 8 command files written in `.cursor/commands/`
- [ ] All 4 subagent files written in `.cursor/agents/`
- [ ] Commands use XML-structured prompts with all required sections
- [ ] Subagents have proper YAML frontmatter
- [ ] Commands that spawn subagents pass full context in the Task tool prompt
- [ ] All files reference `.blueprint/` paths (not `.planning/`)
- [ ] No `gsd-` references anywhere
- [ ] Success criteria checklists in every file
- [ ] Anti-patterns sections in every file
- [ ] Forbidden files sections in relevant files
- [ ] Downstream consumer docs in every subagent file
- [ ] Delete `get-shit-done/templates/` originals (no longer needed for reference)
