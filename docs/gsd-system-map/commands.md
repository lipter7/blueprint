# GSD Commands

## Overview

GSD slash commands live in `/commands/gsd/` as individual Markdown files. Each file defines a single slash command that users invoke via `/gsd:<command-name>` in Claude Code (or the equivalent syntax in OpenCode/Gemini after installer conversion).

### Structure of a Command File

Every command file has two parts:

1. **YAML Frontmatter** (between `---` delimiters) -- declares metadata:
   - `name`: The slash command name (e.g., `gsd:new-project`)
   - `description`: One-line description shown in command autocomplete
   - `argument-hint`: Placeholder text showing expected arguments (e.g., `<phase>`, `[optional description]`)
   - `allowed-tools`: Array of tools the command can use (Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, TodoWrite, WebFetch, SlashCommand, `mcp__context7__*`)
   - `type`: (rare) Explicitly set to `prompt` in some commands
   - `agent`: (rare) Specifies which agent definition to use (only `plan-phase` uses `agent: gsd-planner`)

2. **Prompt Body** -- structured with XML tags that guide Claude's behavior:
   - `<objective>` -- What the command does and why
   - `<execution_context>` -- Files to load via `@` references (workflows, templates, references)
   - `<context>` -- Dynamic context: `$ARGUMENTS`, project files to read
   - `<process>` -- Step-by-step instructions
   - `<success_criteria>` -- Checklist of what "done" looks like
   - `<critical_rules>` -- Hard constraints that must not be violated
   - `<when_to_use>` -- (some commands) Guidance on appropriate usage
   - `<output>` -- (some commands) Static output to display

### The Orchestrator Model

Commands follow an **orchestrator pattern**. The command prompt itself is the orchestrator -- it stays lean, manages user interaction, and delegates heavy work to subagent specialists via the `Task` tool. This preserves the main conversation's context window (200k tokens) for user interaction while giving each subagent a fresh 200k context for its work.

Key orchestrator responsibilities:
- Parse and validate `$ARGUMENTS`
- Load project state (STATE.md, ROADMAP.md)
- Spawn subagents with rich context prompts
- Handle subagent return values (success, checkpoint, failure)
- Present results to user
- Route to next command

Most commands delegate their core logic to a **workflow file** in `~/.claude/get-shit-done/workflows/`. The command prompt loads the workflow via `@` reference and says "follow this workflow end-to-end." This keeps command files short (~20-50 lines of prompt) while workflows contain the detailed multi-step logic.

### File Count

There are **29 active command files** plus 1 `.bak` backup file (an older, more verbose version of `new-project.md`).

---

## Command Workflow (Intended Order)

The GSD system follows a phased development lifecycle. Commands chain together in a specific order:

```
INITIALIZATION
  new-project -----> (creates PROJECT.md, config.json, research/, REQUIREMENTS.md, ROADMAP.md, STATE.md)
       |
       |  (or for existing projects)
       |
  map-codebase ---> new-project  (brownfield: map first, then initialize)

MILESTONE LIFECYCLE (repeats per milestone)
  |
  v
  discuss-phase N ---------> (creates {phase}-CONTEXT.md)
       |
       v
  list-phase-assumptions N -> (conversational only -- no file output)
       |
       v
  research-phase N --------> (creates {phase}-RESEARCH.md)  [standalone; usually integrated into plan-phase]
       |
       v
  plan-phase N ------------> (creates PLAN-*.md files in phase directory)
       |
       v
  execute-phase N ---------> (executes all PLAN-*.md, creates SUMMARY.md, code artifacts)
       |
       v
  verify-work N -----------> (creates {phase}-UAT.md, optionally creates gap fix plans)
       |
       v
  (loop back to discuss-phase N+1 for next phase)
       |
       v
  audit-milestone ---------> (creates MILESTONE-AUDIT.md)
       |
       v
  plan-milestone-gaps -----> (creates gap-closure phases if needed)
       |
       v
  complete-milestone ------> (archives to milestones/, tags git, prepares for next)
       |
       v
  new-milestone -----------> (starts next milestone cycle)

UTILITIES (usable anytime)
  progress      -- check status, auto-route to next action
  resume-work   -- restore context from previous session
  pause-work    -- create handoff file for session breaks
  quick         -- execute small tasks outside planned phases
  debug         -- systematic debugging with subagent isolation
  help          -- show command reference
  settings      -- configure workflow toggles
  set-profile   -- switch model profile (quality/balanced/budget)
  update        -- update GSD to latest npm version
  reapply-patches -- merge local modifications after update
  add-phase     -- add phase to end of milestone
  insert-phase  -- insert decimal phase between existing phases
  remove-phase  -- remove future phase and renumber
  add-todo      -- capture idea/task as structured todo
  check-todos   -- list and act on pending todos
  join-discord  -- display Discord invite link
```

---

## new-project

**File:** `/commands/gsd/new-project.md`

### Frontmatter
```yaml
name: gsd:new-project
description: Initialize a new project with deep context gathering and PROJECT.md
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
```

### Purpose
The entry point for all new GSD projects. Takes the user from a bare idea to a fully planned project with requirements, research, and a roadmap. This is the single most important command -- everything downstream depends on the quality of context gathered here.

### Mode
Runs as a direct prompt (orchestrator). No `agent` field specified. Spawns multiple subagents via Task.

### Arguments
- `--auto` -- Automatic mode. After config questions, runs research, requirements, and roadmap without further user interaction. Expects the project idea to be provided via `@` file reference.

### Files Read
- `.planning/PROJECT.md` (existence check -- aborts if already exists)
- `.planning/codebase/` (brownfield detection)
- `.planning/config.json` (after creation)
- `.planning/research/SUMMARY.md` (for roadmap context)
- `.planning/REQUIREMENTS.md` (for roadmap context)

### Files Created/Modified
- `.planning/PROJECT.md` -- project context document
- `.planning/config.json` -- workflow preferences
- `.planning/research/STACK.md` -- stack research (optional)
- `.planning/research/FEATURES.md` -- features research (optional)
- `.planning/research/ARCHITECTURE.md` -- architecture research (optional)
- `.planning/research/PITFALLS.md` -- pitfalls research (optional)
- `.planning/research/SUMMARY.md` -- research synthesis (optional)
- `.planning/REQUIREMENTS.md` -- scoped requirements with REQ-IDs
- `.planning/ROADMAP.md` -- phase structure
- `.planning/STATE.md` -- project memory

### Agents Spawned
- **gsd-project-researcher** (x4, parallel) -- Stack, Features, Architecture, Pitfalls research
- **gsd-research-synthesizer** (x1) -- Synthesizes research into SUMMARY.md
- **gsd-roadmapper** (x1) -- Creates ROADMAP.md from requirements

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/new-project.md` (main workflow)

### References Loaded
- `~/.claude/get-shit-done/references/questioning.md` -- questioning techniques
- `~/.claude/get-shit-done/references/ui-brand.md` -- UI/branding guidelines

### Templates Loaded
- `~/.claude/get-shit-done/templates/project.md`
- `~/.claude/get-shit-done/templates/requirements.md`

### gsd-tools.js Commands
None directly in the current version. The `.bak` version shows model resolution via `gsd-tools.js resolve-model`.

### Key Process (from `.bak` file which contains the full inline process)
1. **Setup** -- Abort if project exists, init git, detect brownfield (existing code)
2. **Brownfield Offer** -- If code exists without codebase map, offer `/gsd:map-codebase` first
3. **Deep Questioning** -- Open-ended "What do you want to build?", then follow threads with AskUserQuestion. Uses questioning.md techniques (challenge vagueness, surface assumptions, find edges). Loops until user says "Create PROJECT.md"
4. **Write PROJECT.md** -- Synthesize all context. Greenfield: requirements as hypotheses. Brownfield: infer validated requirements from existing code
5. **Workflow Preferences** -- Two rounds of AskUserQuestion: Round 1 (mode, depth, parallelization, git tracking), Round 2 (research toggle, plan check toggle, verifier toggle, model profile). Creates config.json
6. **Research Decision** -- Offer domain research or skip. If research: spawn 4 parallel gsd-project-researcher agents (Stack, Features, Architecture, Pitfalls), then gsd-research-synthesizer for SUMMARY.md
7. **Define Requirements** -- Present features by category from research (or gather conversationally). User scopes v1/v2/out-of-scope per category. Generate REQUIREMENTS.md with REQ-IDs
8. **Create Roadmap** -- Spawn gsd-roadmapper with PROJECT.md + REQUIREMENTS.md + research. Present roadmap for approval, loop with revisions until approved
9. **Done** -- Present completion summary, suggest `/gsd:discuss-phase 1`

### Notable Prompt Engineering
- The `.bak` version is the most verbose command file at 29,300 bytes with full inline process. The current version delegates entirely to the workflow file (1,402 bytes)
- Uses stage banners (`GSD > QUESTIONING`, `GSD > RESEARCHING`, etc.)
- Spawning indicators (`Spawning 4 researchers in parallel...`)
- Research agents receive `<downstream_consumer>` tags explaining who consumes their output
- `<quality_gate>` tags with checklists for each research agent
- `<milestone_context>` differentiates greenfield vs subsequent milestone research
- Atomic commits after each phase: "If context is lost, artifacts persist"

---

## discuss-phase

**File:** `/commands/gsd/discuss-phase.md`

### Frontmatter
```yaml
name: gsd:discuss-phase
description: Gather phase context through adaptive questioning before planning
argument-hint: "<phase>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
```

### Purpose
Extract implementation decisions that downstream agents (researcher, planner) need. Identifies "gray areas" in a phase -- things like UI layout, UX interactions, behavior states, error handling -- and deep-dives each through structured questioning. Creates a CONTEXT.md that locks decisions so downstream agents can act without re-asking the user.

### Mode
Direct prompt (orchestrator). No subagents spawned -- this command handles everything inline with AskUserQuestion.

### Arguments
- `$ARGUMENTS` = phase number (required)

### Files Read
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- Existing `{phase}-CONTEXT.md` (if any, to offer update/view/skip)

### Files Created/Modified
- `.planning/phases/{phase}-{slug}/{phase}-CONTEXT.md`

### Agents Spawned
None -- runs entirely in the main context.

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/discuss-phase.md`

### Templates Loaded
- `~/.claude/get-shit-done/templates/context.md`

### gsd-tools.js Commands
None directly referenced in command file (workflow may use them).

### Key Process
1. Validate phase number
2. Check if CONTEXT.md exists (offer update/view/skip)
3. Analyze phase to identify domain and generate phase-specific gray areas
4. Present gray areas -- user multi-selects which to discuss (NO skip option)
5. Deep-dive each area: 4 questions per area, then offer more/next
6. Write CONTEXT.md with sections matching areas discussed
7. Offer next steps (research or plan)

### Notable Prompt Engineering
- **Scope guardrail**: Phase boundary from ROADMAP.md is FIXED. Discussion clarifies HOW, not WHETHER to add more. If user suggests new capabilities: "That's its own phase. I'll note it for later."
- **Domain-aware gray area generation**: The command analyzes what's being built (UI, API, CLI, docs, organizing) and generates domain-appropriate questions rather than generic ones
- **Probing depth protocol**: 4 questions per area before checking satisfaction, then offer more or next
- **Exclusion list**: Explicitly tells Claude NOT to ask about technical implementation, architecture choices, performance concerns, or scope expansion

---

## plan-phase

**File:** `/commands/gsd/plan-phase.md`

### Frontmatter
```yaml
name: gsd:plan-phase
description: Create detailed execution plan for a phase (PLAN.md) with verification loop
argument-hint: "[phase] [--research] [--skip-research] [--gaps] [--skip-verify]"
agent: gsd-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
```

### Purpose
Create executable phase prompts (PLAN.md files) for a roadmap phase. Integrates research (unless skipped), planning, and verification into a single flow: Research (if needed) -> Plan -> Verify -> Done.

### Mode
Uses `agent: gsd-planner` -- this is the only command that specifies an agent in frontmatter. Also spawns subagents via Task.

### Arguments
- `$ARGUMENTS` = phase number (optional -- auto-detects next unplanned phase if omitted)
- `--research` -- Force re-research even if RESEARCH.md exists
- `--skip-research` -- Skip research, go straight to planning
- `--gaps` -- Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` -- Skip verification loop

### Files Read
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- Existing RESEARCH.md (if any)
- Existing VERIFICATION.md (in `--gaps` mode)

### Files Created/Modified
- `.planning/phases/{phase}-{slug}/PLAN-*.md` (one or more plan files)
- `.planning/phases/{phase}-{slug}/{phase}-RESEARCH.md` (if research runs)

### Agents Spawned
- **gsd-phase-researcher** -- Research how to implement the phase (unless skipped)
- **gsd-planner** -- Create PLAN.md files (the command itself runs as this agent)
- **gsd-plan-checker** -- Verify plans achieve the phase goal (unless `--skip-verify`)

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/plan-phase.md`

### References Loaded
- `~/.claude/get-shit-done/references/ui-brand.md`

### gsd-tools.js Commands
None directly in command file (workflow uses them).

### Key Process
1. Parse arguments and flags
2. Validate phase against roadmap
3. Research domain (spawn gsd-phase-researcher, unless `--skip-research`)
4. Spawn gsd-planner to create PLAN.md files
5. Verify with gsd-plan-checker (iterate until pass or max iterations)
6. Present results and route to next step

### Notable Prompt Engineering
- Only command to use `agent: gsd-planner` in frontmatter
- Only command with `mcp__context7__*` and `WebFetch` in allowed-tools (for research)
- Phase input normalization is explicitly called out: "Normalize phase input in step 2 before any directory lookups"

---

## execute-phase

**File:** `/commands/gsd/execute-phase.md`

### Frontmatter
```yaml
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
```

### Purpose
Execute all PLAN.md files in a phase using wave-based parallel execution. The orchestrator discovers plans, analyzes dependencies, groups into waves, spawns subagents, and collects results. Each subagent gets a fresh context for its plan.

### Mode
Direct prompt (orchestrator). Spawns gsd-executor subagents via Task.

### Arguments
- `$ARGUMENTS` = phase number
- `--gaps-only` -- Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Used after verify-work creates fix plans.

### Files Read
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- All `PLAN-*.md` files in the phase directory

### Files Created/Modified
- Code artifacts (whatever the plans specify)
- `SUMMARY.md` (phase execution summary)
- Various project files as directed by plans

### Agents Spawned
- **gsd-executor** (multiple, parallel per wave) -- Each executor handles one PLAN.md

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/execute-phase.md`

### References Loaded
- `~/.claude/get-shit-done/references/ui-brand.md`

### gsd-tools.js Commands
None directly in command file.

### Key Process
Per workflow: discover plans, analyze dependencies, group into waves, spawn subagents per wave, collect results, handle checkpoints, verify, update state, route.

### Notable Prompt Engineering
- Context budget explicitly stated: "~15% orchestrator, 100% fresh per subagent"
- Wave-based parallelization for dependency-aware execution
- `TodoWrite` tool included (only command besides `quick` to include it)

---

## verify-work

**File:** `/commands/gsd/verify-work.md`

### Frontmatter
```yaml
name: gsd:verify-work
description: Validate built features through conversational UAT
argument-hint: "[phase number, e.g., '4']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
  - Task
```

### Purpose
Validate that built features actually work from the user's perspective. Runs conversational user acceptance testing -- one test at a time, plain text responses, no interrogation. When issues are found, automatically diagnoses gaps, plans fixes, and prepares for re-execution.

### Mode
Direct prompt (orchestrator). Spawns subagents via Task for diagnosis and fix planning.

### Arguments
- `$ARGUMENTS` = phase number (optional -- checks for active sessions or prompts if not provided)

### Files Read
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- Phase PLAN files and SUMMARY files

### Files Created/Modified
- `.planning/phases/{phase}-{slug}/{phase}-UAT.md` -- test results
- Gap fix PLAN files (if issues found)

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/verify-work.md`

### Templates Loaded
- `~/.claude/get-shit-done/templates/UAT.md`

### gsd-tools.js Commands
None directly in command file.

### Key Process
Per workflow: session management, test presentation, diagnosis, fix planning, routing. After verification, if issues found, creates fix plans ready for `/gsd:execute-phase --gaps-only`.

---

## complete-milestone

**File:** `/commands/gsd/complete-milestone.md`

### Frontmatter
```yaml
type: prompt
name: gsd:complete-milestone
description: Archive completed milestone and prepare for next version
argument-hint: <version>
allowed-tools:
  - Read
  - Write
  - Bash
```

### Purpose
Mark a milestone complete, archive it to `milestones/`, and prepare for the next version. Creates a historical record of shipped work, collapses the ROADMAP.md entry, archives requirements, updates PROJECT.md, and creates a git tag.

### Mode
Direct prompt. No subagents. Notable: explicitly includes `type: prompt` in frontmatter (only command to do so).

### Arguments
- `$ARGUMENTS` = version string (e.g., "1.0", "1.1", "2.0"), referred to as `{{version}}` in the prompt

### Files Read
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`
- `.planning/v{{version}}-MILESTONE-AUDIT.md` (pre-flight check)
- All phase `SUMMARY.md` files in milestone range

### Files Created/Modified
- `.planning/milestones/v{{version}}-ROADMAP.md` -- archived roadmap
- `.planning/milestones/v{{version}}-REQUIREMENTS.md` -- archived requirements
- `.planning/ROADMAP.md` -- collapsed to one-line summary with link
- `.planning/PROJECT.md` -- updated with "Current State" and "Next Milestone Goals"
- `.planning/REQUIREMENTS.md` -- DELETED (fresh one created for next milestone)
- Git tag `v{{version}}`

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/complete-milestone.md`

### Templates Loaded
- `~/.claude/get-shit-done/templates/milestone-archive.md`

### gsd-tools.js Commands
None directly in command file.

### Key Process
0. **Pre-flight check** -- Look for MILESTONE-AUDIT.md. If missing, recommend `audit-milestone`. If gaps found, recommend `plan-milestone-gaps`. If passed, proceed.
1. **Verify readiness** -- All phases must have SUMMARY.md
2. **Gather stats** -- Count phases, plans, tasks; calculate git range, file changes, LOC
3. **Extract accomplishments** -- Read all phase SUMMARY.md files, extract 4-6 key accomplishments
4. **Archive milestone** -- Create archived ROADMAP, fill template, collapse roadmap entry
5. **Archive requirements** -- Create archived REQUIREMENTS, mark all complete, DELETE original
6. **Update PROJECT.md** -- Add current state, next milestone goals
7. **Commit and tag** -- Stage, commit, `git tag -a v{{version}}`, offer to push
8. **Offer next steps** -- Suggest `/gsd:new-milestone`

### Notable Prompt Engineering
- Uses `{{version}}` template variable syntax (unique among commands)
- Pre-flight check cascade: no audit -> recommend audit; audit with gaps -> recommend plan-milestone-gaps; audit passed -> proceed
- `<critical_rules>` tag with hard constraints: "Archive before deleting", "One-line summary", "Fresh requirements"
- Context efficiency pattern: archiving keeps ROADMAP.md and REQUIREMENTS.md constant size per milestone

---

## audit-milestone

**File:** `/commands/gsd/audit-milestone.md`

### Frontmatter
```yaml
name: gsd:audit-milestone
description: Audit milestone completion against original intent before archiving
argument-hint: "[version]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
```

### Purpose
Verify a milestone achieved its definition of done. Checks requirements coverage, cross-phase integration, and end-to-end flows. Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.

### Mode
Direct prompt (IS the orchestrator, as explicitly stated). Spawns integration checker subagent via Task.

### Arguments
- `$ARGUMENTS` = version (optional -- defaults to current milestone)

### Files Read
- `.planning/PROJECT.md` (original intent)
- `.planning/REQUIREMENTS.md` (original intent)
- `.planning/ROADMAP.md` (planned work)
- `.planning/config.json` (if exists)
- `.planning/phases/*/*-SUMMARY.md` (completed work)
- `.planning/phases/*/*-VERIFICATION.md` (completed work)

### Files Created/Modified
- `.planning/v{version}-MILESTONE-AUDIT.md`

### Agents Spawned
- **gsd-integration-checker** (implied by spawning integration checker)

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/audit-milestone.md`

### gsd-tools.js Commands
None directly in command file.

### Notable Prompt Engineering
- "This command IS the orchestrator" -- explicitly claims orchestrator role
- Uses Glob patterns for discovery: `.planning/phases/*/*-SUMMARY.md`

---

## plan-milestone-gaps

**File:** `/commands/gsd/plan-milestone-gaps.md`

### Frontmatter
```yaml
name: gsd:plan-milestone-gaps
description: Create phases to close all gaps identified by milestone audit
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
```

### Purpose
After `audit-milestone` identifies gaps, this command reads the MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase. Creates ALL fix phases in one command -- no manual `add-phase` per gap.

### Mode
Direct prompt (orchestrator). No subagents.

### Arguments
None -- reads the most recent `v*-MILESTONE-AUDIT.md` automatically.

### Files Read
- `.planning/v*-MILESTONE-AUDIT.md` (most recent via Glob)
- `.planning/PROJECT.md` (for prioritization)
- `.planning/REQUIREMENTS.md` (for prioritization)
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

### Files Created/Modified
- `.planning/ROADMAP.md` -- updated with gap-closure phases

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/plan-milestone-gaps.md`

---

## new-milestone

**File:** `/commands/gsd/new-milestone.md`

### Frontmatter
```yaml
name: gsd:new-milestone
description: Start a new milestone cycle -- update PROJECT.md and route to requirements
argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
```

### Purpose
Brownfield equivalent of `new-project`. Project already exists with history. Gathers "what's next", updates PROJECT.md, then runs the requirements-to-roadmap cycle. Flow: questioning -> research (optional, NEW features only) -> requirements -> roadmap.

### Mode
Direct prompt (orchestrator). Spawns subagents via Task.

### Arguments
- `$ARGUMENTS` = milestone name (optional -- will prompt if not provided)

### Files Read
- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `.planning/MILESTONES.md`
- `.planning/config.json`
- `.planning/MILESTONE-CONTEXT.md` (if exists, from discuss-milestone)

### Files Created/Modified
- `.planning/PROJECT.md` -- updated with new milestone goals
- `.planning/research/` -- domain research (optional, NEW features only)
- `.planning/REQUIREMENTS.md` -- scoped requirements for this milestone
- `.planning/ROADMAP.md` -- phase structure (continues numbering)
- `.planning/STATE.md` -- reset for new milestone

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/new-milestone.md`

### References Loaded
- `~/.claude/get-shit-done/references/questioning.md`
- `~/.claude/get-shit-done/references/ui-brand.md`

### Templates Loaded
- `~/.claude/get-shit-done/templates/project.md`
- `~/.claude/get-shit-done/templates/requirements.md`

---

## research-phase

**File:** `/commands/gsd/research-phase.md`

### Frontmatter
```yaml
name: gsd:research-phase
description: Research how to implement a phase (standalone - usually use /gsd:plan-phase instead)
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Task
```

### Purpose
Standalone research command. Spawns gsd-phase-researcher agent with phase context. For most workflows, `plan-phase` integrates research automatically. Use this when you want research without planning, re-research after planning, or need to investigate feasibility.

### Mode
Direct prompt (orchestrator). Spawns subagent via Task.

### Arguments
- `$ARGUMENTS` = phase number (required)

### Files Read
- `.planning/ROADMAP.md` (via gsd-tools)
- `.planning/REQUIREMENTS.md`
- `.planning/phases/{phase}-*/*-CONTEXT.md`
- `.planning/STATE.md` (Decisions Made section)
- Existing RESEARCH.md (if any)

### Files Created/Modified
- `.planning/phases/{phase}-{slug}/{phase}-RESEARCH.md`

### Agents Spawned
- **gsd-phase-researcher** -- Spawned via Task with `subagent_type="general-purpose"` (NOT the agent name). The prompt instructs the agent to first read `~/.claude/agents/gsd-phase-researcher.md` for its role.

### gsd-tools.js Commands
- `gsd-tools.js init phase-op "$ARGUMENTS"` -- Initialize phase operation, returns phase_dir, phase_number, phase_name, phase_found, commit_docs, has_research
- `gsd-tools.js resolve-model gsd-phase-researcher --raw` -- Resolve model for researcher agent
- `gsd-tools.js roadmap get-phase "${phase_number}"` -- Get phase info from roadmap

### Key Process
0. **Initialize Context** -- `state load`, `resolve-model`
1. **Validate Phase** -- `roadmap get-phase`
2. **Check Existing Research** -- Offer update/view/skip if RESEARCH.md exists
3. **Gather Phase Context** -- Requirements, prior decisions, CONTEXT.md
4. **Spawn gsd-phase-researcher** -- With rich context including `<research_type>`, `<key_insight>`, `<downstream_consumer>`, `<quality_gate>`, `<output>` tags
5. **Handle Agent Return** -- Three outcomes: RESEARCH COMPLETE (offer plan/dig deeper/review/done), CHECKPOINT REACHED (get user input, spawn continuation), RESEARCH INCONCLUSIVE (offer add context/different mode/manual)
6. **Spawn Continuation Agent** -- For checkpoints, fresh agent with prior state reference

### Notable Prompt Engineering
- Research modes: ecosystem (default), feasibility, implementation, comparison
- `<key_insight>` tag reframes the research question: "The question is NOT 'which library should I use?' -- The question is: 'What do I not know that I don't know?'"
- `<downstream_consumer>` tag explicitly tells the researcher what sections plan-phase expects: "Standard Stack", "Architecture Patterns", "Don't Hand-Roll", "Common Pitfalls", "Code Examples"
- Prescriptive output: "Use X" not "Consider X or Y"
- Agent spawning uses `subagent_type="general-purpose"` but instructs reading of the specific agent file as first action
- Continuation agents receive prior state via `@` file reference

---

## debug

**File:** `/commands/gsd/debug.md`

### Frontmatter
```yaml
name: gsd:debug
description: Systematic debugging with persistent state across context resets
argument-hint: [issue description]
allowed-tools:
  - Read
  - Bash
  - Task
  - AskUserQuestion
```

### Purpose
Debug issues using scientific method with subagent isolation. The orchestrator gathers symptoms, spawns gsd-debugger agent, handles checkpoints, and spawns continuations. Investigation burns context fast, so subagents get fresh 200k context while the main context stays lean.

### Mode
Direct prompt (orchestrator). Spawns gsd-debugger subagent(s) via Task.

### Arguments
- `$ARGUMENTS` = issue description (optional -- if empty, checks for active sessions)

### Files Read
- `.planning/debug/*.md` (active debug sessions)
- `.planning/STATE.md` (via gsd-tools)

### Files Created/Modified
- `.planning/debug/{slug}.md` -- debug session file (created by debugger agent)

### Agents Spawned
- **gsd-debugger** -- Spawned via Task with `subagent_type="gsd-debugger"`. Can be spawned multiple times (initial + continuations).

### gsd-tools.js Commands
- `gsd-tools.js state load` -- Initialize context
- `gsd-tools.js resolve-model gsd-debugger --raw` -- Resolve debugger model

### Key Process
0. **Initialize Context** -- Load state, resolve debugger model
1. **Check Active Sessions** -- List existing debug sessions if no arguments; user picks to resume or new
2. **Gather Symptoms** -- AskUserQuestion for: expected behavior, actual behavior, error messages, timeline, reproduction steps
3. **Spawn gsd-debugger** -- With `<symptoms>`, `<mode>` (goal: find_and_fix), `<debug_file>` tags
4. **Handle Agent Return** -- Three outcomes:
   - ROOT CAUSE FOUND: offer fix now/plan fix/manual fix
   - CHECKPOINT REACHED: present to user, spawn continuation
   - INVESTIGATION INCONCLUSIVE: offer continue/manual/add context
5. **Spawn Continuation** -- Fresh agent with `<prior_state>` reference to debug file and `<checkpoint_response>`

### Notable Prompt Engineering
- Scientific method framing: symptoms -> hypothesis -> investigation -> root cause
- Session persistence: debug files survive context resets
- Explicit context justification: "Investigation burns context fast (reading files, forming hypotheses, testing). Fresh 200k context per investigation."
- Checkpoint protocol for multi-session debugging

---

## map-codebase

**File:** `/commands/gsd/map-codebase.md`

### Frontmatter
```yaml
name: gsd:map-codebase
description: Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents
argument-hint: "[optional: specific area to map, e.g., 'api' or 'auth']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
```

### Purpose
Analyze an existing codebase using parallel gsd-codebase-mapper agents to produce structured codebase documents. Each mapper agent explores a focus area and writes documents directly to `.planning/codebase/`. The orchestrator only receives confirmations, keeping context usage minimal.

### Mode
Direct prompt (orchestrator). Spawns 4 parallel subagents via Task.

### Arguments
- `$ARGUMENTS` = optional focus area (e.g., 'api', 'auth')

### Files Read
- `.planning/STATE.md` (if exists)
- `.planning/codebase/` (existence check for refresh offer)

### Files Created/Modified
- `.planning/codebase/STACK.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`

### Agents Spawned
- **gsd-codebase-mapper** (x4, parallel):
  - Agent 1: tech focus -> writes STACK.md, INTEGRATIONS.md
  - Agent 2: arch focus -> writes ARCHITECTURE.md, STRUCTURE.md
  - Agent 3: quality focus -> writes CONVENTIONS.md, TESTING.md
  - Agent 4: concerns focus -> writes CONCERNS.md

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/map-codebase.md`

### Key Process
1. Check if `.planning/codebase/` exists (offer refresh or skip)
2. Create directory structure
3. Spawn 4 parallel mapper agents
4. Collect confirmations (NOT document contents)
5. Verify all 7 documents exist with line counts
6. Commit codebase map
7. Offer next steps

### Notable Prompt Engineering
- `<when_to_use>` tag with explicit usage guidance
- "Agents write directly" pattern -- orchestrator gets confirmations, not content
- Can run before or after `new-project`

---

## progress

**File:** `/commands/gsd/progress.md`

### Frontmatter
```yaml
name: gsd:progress
description: Check project progress, show context, and route to next action (execute or plan)
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
```

### Purpose
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action. Provides situational awareness before continuing work.

### Mode
Direct prompt. Notable: includes `SlashCommand` in allowed-tools to route to other commands.

### Arguments
None.

### Files Read
- Project state files (via workflow)

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/progress.md`

### Notable Prompt Engineering
- Routes A through F with edge case handling
- Uses `SlashCommand` tool to invoke other GSD commands directly

---

## quick

**File:** `/commands/gsd/quick.md`

### Frontmatter
```yaml
name: gsd:quick
description: Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents
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
```

### Purpose
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking) while skipping optional agents (research, plan-checker, verifier). Same system, shorter path.

### Mode
Direct prompt (orchestrator). Spawns gsd-planner (quick mode) and gsd-executor(s) via Task.

### Arguments
- `$ARGUMENTS` = empty (argument-hint is empty string)

### Files Read
- `.planning/STATE.md`

### Files Created/Modified
- `.planning/quick/` directory (quick tasks live here, separate from planned phases)
- `STATE.md` "Quick Tasks Completed" table (NOT ROADMAP.md)

### Agents Spawned
- **gsd-planner** (quick mode)
- **gsd-executor** (one or more)

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/quick.md`

---

## resume-work

**File:** `/commands/gsd/resume-work.md`

### Frontmatter
```yaml
name: gsd:resume-work
description: Resume work from previous session with full context restoration
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
  - SlashCommand
```

### Purpose
Restore complete project context and resume work seamlessly from a previous session. Detects checkpoints (`.continue-here` files), incomplete work (PLAN without SUMMARY), and intelligently routes to the appropriate next action.

### Mode
Direct prompt. Uses `SlashCommand` to route to other commands.

### Arguments
None.

### Files Read
- `.planning/STATE.md` (or reconstructs if missing)
- `.continue-here.md` files (checkpoint detection)
- Phase directories (incomplete work detection)

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/resume-project.md`

### Notable Prompt Engineering
- "Context-aware option offering" -- checks CONTEXT.md before suggesting plan vs discuss
- STATE.md reconstruction if missing

---

## pause-work

**File:** `/commands/gsd/pause-work.md`

### Frontmatter
```yaml
name: gsd:pause-work
description: Create context handoff when pausing work mid-phase
allowed-tools:
  - Read
  - Write
  - Bash
```

### Purpose
Create a `.continue-here.md` handoff file to preserve complete work state across sessions. Detects current phase, gathers state (position, completed work, remaining work, decisions, blockers), writes handoff file, commits as WIP.

### Mode
Direct prompt. No subagents.

### Arguments
None.

### Files Read
- `.planning/STATE.md`
- Recent files (for phase detection)

### Files Created/Modified
- `.continue-here.md` -- handoff file with all context sections
- Git WIP commit

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/pause-work.md`

---

## list-phase-assumptions

**File:** `/commands/gsd/list-phase-assumptions.md`

### Frontmatter
```yaml
name: gsd:list-phase-assumptions
description: Surface Claude's assumptions about a phase approach before planning
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
```

### Purpose
Help users see what Claude thinks BEFORE planning begins. Surfaces assumptions about technical approach, implementation order, scope boundaries, risk areas, and dependencies. Conversational output only -- no file creation. Ends with "What do you think?" prompt.

### Mode
Direct prompt. No subagents, no file creation.

### Arguments
- `$ARGUMENTS` = phase number (required)

### Files Read
- `.planning/STATE.md`
- `.planning/ROADMAP.md`

### Files Created/Modified
None -- conversational output only.

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/list-phase-assumptions.md`

### Notable Prompt Engineering
- Five assumption areas: technical approach, implementation order, scope, risks, dependencies
- Explicitly states "no file creation" -- conversational only
- Course correction mechanism before expensive planning

---

## add-phase

**File:** `/commands/gsd/add-phase.md`

### Frontmatter
```yaml
name: gsd:add-phase
description: Add phase to end of current milestone in roadmap
argument-hint: <description>
allowed-tools:
  - Read
  - Write
  - Bash
```

### Purpose
Add a new integer phase to the end of the current milestone in the roadmap.

### Mode
Direct prompt. No subagents.

### Arguments
- `$ARGUMENTS` = phase description

### Files Read
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

### Files Created/Modified
- `.planning/ROADMAP.md` -- updated with new phase entry
- Phase directory created (with slug generation)
- `.planning/STATE.md` -- roadmap evolution tracking

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/add-phase.md`

### Key Process (from workflow delegation)
1. Argument parsing and validation
2. Roadmap existence checking
3. Current milestone identification
4. Next phase number calculation (ignoring decimals)
5. Slug generation from description
6. Phase directory creation
7. Roadmap entry insertion
8. STATE.md updates

---

## insert-phase

**File:** `/commands/gsd/insert-phase.md`

### Frontmatter
```yaml
name: gsd:insert-phase
description: Insert urgent work as decimal phase (e.g., 72.1) between existing phases
argument-hint: <after> <description>
allowed-tools:
  - Read
  - Write
  - Bash
```

### Purpose
Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases. Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence without renumbering the entire roadmap.

### Mode
Direct prompt. No subagents.

### Arguments
- `$ARGUMENTS` = `<after-phase-number> <description>` (two-part argument)

### Files Read
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

### Files Created/Modified
- `.planning/ROADMAP.md` -- updated with decimal phase
- Phase directory created

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/insert-phase.md`

---

## remove-phase

**File:** `/commands/gsd/remove-phase.md`

### Frontmatter
```yaml
name: gsd:remove-phase
description: Remove a future phase from roadmap and renumber subsequent phases
argument-hint: <phase-number>
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
```

### Purpose
Remove an unstarted future phase from the roadmap and renumber all subsequent phases to maintain a clean, linear sequence. Clean removal without polluting context with cancelled/deferred markers.

### Mode
Direct prompt. No subagents.

### Arguments
- `$ARGUMENTS` = phase number

### Files Read
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

### Files Created/Modified
- `.planning/ROADMAP.md` -- phase removed, subsequent renumbered
- Phase directory deleted
- Git commit as historical record

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/remove-phase.md`

---

## add-todo

**File:** `/commands/gsd/add-todo.md`

### Frontmatter
```yaml
name: gsd:add-todo
description: Capture idea or task as todo from current conversation context
argument-hint: [optional description]
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
```

### Purpose
Capture an idea, task, or issue that surfaces during a GSD session as a structured todo for later work. Handles directory structure creation, content extraction from arguments or conversation, area inference from file paths, duplicate detection, and todo file creation with frontmatter.

### Mode
Direct prompt. No subagents.

### Arguments
- `$ARGUMENTS` = optional description (if empty, extracts from conversation context)

### Files Read
- `.planning/STATE.md`

### Files Created/Modified
- `.planning/todos/{area}/{slug}.md` -- todo file with frontmatter
- `.planning/STATE.md` -- updated
- Git commit

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/add-todo.md`

---

## check-todos

**File:** `/commands/gsd/check-todos.md`

### Frontmatter
```yaml
name: gsd:check-todos
description: List pending todos and select one to work on
argument-hint: [area filter]
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
```

### Purpose
List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action (work now, add to phase, brainstorm, create phase).

### Mode
Direct prompt. No subagents.

### Arguments
- `$ARGUMENTS` = optional area filter

### Files Read
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- Todo files in `.planning/todos/`

### Files Created/Modified
- `.planning/STATE.md` -- updated
- Git commit

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/check-todos.md`

---

## settings

**File:** `/commands/gsd/settings.md`

### Frontmatter
```yaml
name: gsd:settings
description: Configure GSD workflow toggles and model profile
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
```

### Purpose
Interactive configuration of GSD workflow agents and model profile. Presents a multi-question prompt covering model profile, research toggle, plan check toggle, verifier toggle, and branching strategy.

### Mode
Direct prompt. No subagents.

### Arguments
None.

### Files Read/Modified
- `.planning/config.json`

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/settings.md`

---

## set-profile

**File:** `/commands/gsd/set-profile.md`

### Frontmatter
```yaml
name: gsd:set-profile
description: Switch model profile for GSD agents (quality/balanced/budget)
argument-hint: <profile>
allowed-tools:
  - Read
  - Write
  - Bash
```

### Purpose
Quick switch of the model profile used by GSD agents. Controls which Claude model each agent uses: quality (Opus), balanced (Sonnet), budget (Haiku).

### Mode
Direct prompt. No subagents.

### Arguments
- `$ARGUMENTS` = profile name: `quality`, `balanced`, or `budget`

### Files Read/Modified
- `.planning/config.json`

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/set-profile.md`

---

## help

**File:** `/commands/gsd/help.md`

### Frontmatter
```yaml
name: gsd:help
description: Show available GSD commands and usage guide
```

### Purpose
Display the complete GSD command reference. Notable for its constraint: "Output ONLY the reference content. Do NOT add project-specific analysis, git status, next-step suggestions, or any commentary."

### Mode
Direct prompt. No tools needed (none declared).

### Arguments
None.

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/help.md`

---

## update

**File:** `/commands/gsd/update.md`

### Frontmatter
```yaml
name: gsd:update
description: Update GSD to latest version with changelog display
allowed-tools:
  - Bash
  - AskUserQuestion
```

### Purpose
Check for GSD updates, install if available, and display what changed. Handles version detection (local vs global), npm version checking, changelog fetching, user confirmation, update execution, and cache clearing.

### Mode
Direct prompt. No subagents. Minimal tools (Bash + AskUserQuestion only).

### Arguments
None.

### Workflows Referenced
- `~/.claude/get-shit-done/workflows/update.md`

---

## reapply-patches

**File:** `/commands/gsd/reapply-patches.md`

### Frontmatter
```yaml
description: Reapply local modifications after a GSD update
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
```

### Purpose
After a GSD update wipes and reinstalls files, this command merges user's previously saved local modifications back into the new version. Uses intelligent comparison to handle cases where upstream also changed.

### Mode
Direct prompt. No subagents.

### Notable Frontmatter Difference
This command has a **different frontmatter format**: `allowed-tools` is a comma-separated string instead of a YAML array. No `name` field is declared (the filename is used). This suggests it may have been authored differently or is a newer addition.

### Arguments
None.

### Files Read
- `~/.claude/gsd-local-patches/backup-meta.json` (or `./.claude/gsd-local-patches/`)
- Backed-up file versions
- Newly installed file versions
- VERSION file

### Files Created/Modified
- Merged files at their installed locations
- Updated manifest

### Key Process
1. **Detect backed-up patches** -- Check global then local patches directory
2. **Show patch summary** -- Table of files with status
3. **Merge each file** -- Compare backed-up vs new, identify user modifications, apply. Three strategies: skip (modification incorporated upstream), merge (apply user additions), conflict (show both, ask user)
4. **Update manifest** -- For future update detection
5. **Cleanup option** -- Keep or remove patch backups
6. **Report** -- Status table

### Notable Prompt Engineering
- Uses `<purpose>` tag instead of `<objective>` (unique among commands)
- Inline bash in process steps (not delegated to workflow)
- Merge strategy explained in detail within the command itself

---

## join-discord

**File:** `/commands/gsd/join-discord.md`

### Frontmatter
```yaml
name: gsd:join-discord
description: Join the GSD Discord community
```

### Purpose
Display the Discord invite link for the GSD community server. Simplest command in the system -- static output only.

### Mode
Static output. No tools needed.

### Arguments
None.

### Output
```
# Join the GSD Discord
Connect with other GSD users, get help, share what you're building, and stay updated.
Invite link: https://discord.gg/5JJgD5svVS
```

---

## Common Patterns Across Commands

### XML Tag Structure

All commands use a consistent set of XML tags for prompt structure:

| Tag | Usage | Found In |
|-----|-------|----------|
| `<objective>` | What the command does and why | All commands except reapply-patches |
| `<execution_context>` | Files to load via `@` references | Most commands |
| `<context>` | Dynamic context, $ARGUMENTS, project files | Most commands |
| `<process>` | Step-by-step instructions | All commands |
| `<success_criteria>` | Checklist of done conditions | ~12 commands |
| `<critical_rules>` | Hard constraints | complete-milestone |
| `<when_to_use>` | Usage guidance | map-codebase |
| `<purpose>` | Alternative to objective | reapply-patches |
| `<output>` | Static output or file listing | join-discord, new-project.bak |

### $ARGUMENTS Usage Patterns

- **Required phase number**: discuss-phase, execute-phase, research-phase, list-phase-assumptions, remove-phase
- **Optional phase number**: plan-phase (auto-detects next unplanned), verify-work (checks active sessions)
- **Flags**: new-project (`--auto`), execute-phase (`--gaps-only`), plan-phase (`--research`, `--skip-research`, `--gaps`, `--skip-verify`)
- **Description text**: add-phase, add-todo
- **Two-part argument**: insert-phase (`<after> <description>`)
- **Version string**: complete-milestone (`<version>`)
- **Profile name**: set-profile (`<profile>`)
- **Area filter**: check-todos
- **Optional focus area**: map-codebase
- **No arguments**: help, progress, resume-work, pause-work, settings, update, reapply-patches, join-discord

### Workflow Delegation Pattern

The dominant pattern (used by ~22 commands) is:

```markdown
<execution_context>
@~/.claude/get-shit-done/workflows/{workflow-name}.md
</execution_context>

<process>
Execute the {workflow-name} workflow from @~/.claude/get-shit-done/workflows/{workflow-name}.md end-to-end.
Preserve all workflow gates (...).
</process>
```

This keeps command files short (under 50 lines typically) and centralizes logic in workflow files. The `.bak` version of `new-project.md` shows the alternative: 1000+ lines of inline process. The current architecture clearly favors delegation.

### Subagent Spawning via Task

Commands that spawn subagents follow a consistent pattern:

```
Task(
  prompt=filled_prompt,
  subagent_type="{agent-name}" or "general-purpose",
  model="{resolved_model}",
  description="{human-readable description}"
)
```

When using `subagent_type="general-purpose"`, the prompt starts with:
```
First, read ~/.claude/agents/gsd-{agent-name}.md for your role and instructions.
```

### Model Resolution

Commands that spawn subagents resolve models via:
```bash
MODEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.js resolve-model {agent-name} --raw)
```

Model profiles (quality/balanced/budget) map agents to Claude models (Opus/Sonnet/Haiku).

### State Management Pattern

Most commands load state as their first action:
```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.js state load)
```
or
```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.js init phase-op "$ARGUMENTS")
```

### Frontmatter Conventions

**Allowed-tools frequency across all commands:**

| Tool | Count | Commands |
|------|-------|----------|
| Read | 25 | Nearly all |
| Bash | 27 | Nearly all |
| Write | 22 | Most |
| AskUserQuestion | 12 | Interactive commands |
| Task | 9 | Orchestrators that spawn subagents |
| Glob | 9 | Commands that search for files |
| Grep | 8 | Commands that search file contents |
| Edit | 4 | execute-phase, verify-work, quick, reapply-patches |
| SlashCommand | 2 | progress, resume-work |
| TodoWrite | 1 | execute-phase |
| WebFetch | 1 | plan-phase |
| `mcp__context7__*` | 1 | plan-phase |

### Commit Patterns

Commands that modify files typically commit with structured messages:
```bash
git commit -m "$(cat <<'EOF'
docs: {action description}

{Details}
EOF
)"
```

Commit prefixes used: `docs:` (project docs), `chore:` (config/archive), WIP (pause-work).

### Closing `</output>` Tag

Nearly every command file ends with a stray `</output>` closing tag that does not have a corresponding opening `<output>` tag in the same scope. This appears to be a convention or artifact -- possibly the outermost wrapper that the system expects.

---

## Cross-References

### Commands -> Agents

| Command | Agent(s) Spawned |
|---------|-----------------|
| new-project | gsd-project-researcher (x4), gsd-research-synthesizer, gsd-roadmapper |
| plan-phase | gsd-phase-researcher, gsd-planner (self), gsd-plan-checker |
| execute-phase | gsd-executor (multiple per wave) |
| verify-work | (subagents for diagnosis/fix planning) |
| research-phase | gsd-phase-researcher |
| debug | gsd-debugger (multiple for continuations) |
| map-codebase | gsd-codebase-mapper (x4) |
| quick | gsd-planner (quick mode), gsd-executor |
| audit-milestone | gsd-integration-checker |
| new-milestone | (inherits from new-project pattern) |

### Commands -> Workflows

| Command | Workflow File |
|---------|--------------|
| add-phase | workflows/add-phase.md |
| add-todo | workflows/add-todo.md |
| audit-milestone | workflows/audit-milestone.md |
| check-todos | workflows/check-todos.md |
| complete-milestone | workflows/complete-milestone.md |
| debug | (inline process, no workflow) |
| discuss-phase | workflows/discuss-phase.md |
| execute-phase | workflows/execute-phase.md |
| help | workflows/help.md |
| insert-phase | workflows/insert-phase.md |
| list-phase-assumptions | workflows/list-phase-assumptions.md |
| map-codebase | workflows/map-codebase.md |
| new-milestone | workflows/new-milestone.md |
| new-project | workflows/new-project.md |
| pause-work | workflows/pause-work.md |
| plan-milestone-gaps | workflows/plan-milestone-gaps.md |
| plan-phase | workflows/plan-phase.md |
| progress | workflows/progress.md |
| quick | workflows/quick.md |
| reapply-patches | (inline process, no workflow) |
| remove-phase | workflows/remove-phase.md |
| research-phase | (inline process, no workflow) |
| resume-work | workflows/resume-project.md |
| set-profile | workflows/set-profile.md |
| settings | workflows/settings.md |
| update | workflows/update.md |
| verify-work | workflows/verify-work.md |

### Commands -> Templates

| Command | Template(s) |
|---------|------------|
| complete-milestone | templates/milestone-archive.md |
| discuss-phase | templates/context.md |
| new-milestone | templates/project.md, templates/requirements.md |
| new-project | templates/project.md, templates/requirements.md |
| verify-work | templates/UAT.md |
| new-project.bak | templates/research-project/STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md |

### Commands -> References

| Command | Reference(s) |
|---------|-------------|
| execute-phase | references/ui-brand.md |
| new-milestone | references/questioning.md, references/ui-brand.md |
| new-project | references/questioning.md, references/ui-brand.md |
| plan-phase | references/ui-brand.md |

### Commands -> gsd-tools.js

| Command | gsd-tools.js Commands |
|---------|----------------------|
| debug | `state load`, `resolve-model gsd-debugger` |
| research-phase | `init phase-op`, `resolve-model gsd-phase-researcher`, `roadmap get-phase` |
| new-project.bak | `resolve-model` (implied via model resolution) |

Note: Many commands delegate to workflows which themselves call gsd-tools.js extensively. The commands listed above are those that call gsd-tools.js directly in their command file.

### Key Project Files (read/written by multiple commands)

| File | Read By | Written By |
|------|---------|-----------|
| `.planning/STATE.md` | Nearly all commands | add-phase, add-todo, check-todos, complete-milestone, execute-phase, insert-phase, new-milestone, new-project, pause-work, remove-phase, resume-work |
| `.planning/ROADMAP.md` | discuss-phase, execute-phase, plan-phase, verify-work, check-todos, list-phase-assumptions, audit-milestone, plan-milestone-gaps, complete-milestone, insert-phase, remove-phase, add-phase | add-phase, insert-phase, remove-phase, plan-milestone-gaps, complete-milestone, new-project, new-milestone |
| `.planning/PROJECT.md` | audit-milestone, plan-milestone-gaps, complete-milestone, new-milestone | new-project, new-milestone, complete-milestone |
| `.planning/REQUIREMENTS.md` | audit-milestone, plan-milestone-gaps, research-phase | new-project, new-milestone, complete-milestone (deletes) |
| `.planning/config.json` | new-milestone, audit-milestone | new-project, settings, set-profile |
