# GSD System Map: Complete Overview

## What This Directory Contains

This directory contains 7 domain-specific documentation files that together provide an exhaustive map of the GSD (Get Shit Done) framework. Each file focuses on a single domain within the system:

| File | Domain | Lines | What It Covers |
|------|--------|-------|----------------|
| `infrastructure.md` | Scripts, Hooks, Installer, Tools | 862 | The 6 Node.js files that form the runtime infrastructure: `build-hooks.js` (build script), `gsd-check-update.js` (session-start hook), `gsd-statusline.js` (statusline hook), `install.js` (1,739-line multi-runtime installer), `gsd-tools.js` (4,597-line central CLI utility with ~60 subcommands), and `gsd-tools.test.js` (test suite with ~60 test cases). |
| `agents.md` | Specialized Subagents | 1,124 | All 11 agent definitions: their frontmatter, roles, tools allowed, files read/written, spawning relationships, prompt engineering techniques, and the complete agent dependency graph showing data flow through file system artifacts. |
| `commands.md` | Slash Commands | 1,657 | All 29 slash command files: their frontmatter, purpose, arguments, mode (orchestrator vs direct), agents spawned, workflows referenced, templates loaded, references loaded, gsd-tools.js commands used, and the intended command execution order. |
| `references.md` | Shared Reference Documents | 915 | All 13 reference files: their content type (prescriptive vs descriptive), key concepts, loading relationships, and the complete reference usage map showing which commands, workflows, agents, and templates load each reference. |
| `templates-codebase-and-research.md` | Codebase and Research Templates | 678 | The 7 codebase analysis templates (`.planning/codebase/`) and 5 research project templates (`.planning/research/`), including their structure, producers, downstream consumers, and the comparison between retrospective (codebase) and prospective (research) documentation. |
| `templates-root.md` | Root Planning Templates | 973 | All 22 root-level templates: 6 core planning (roadmap, requirements, state, project, context, config), 3 execution/prompt templates (phase-prompt, planner-subagent-prompt, debug-subagent-prompt), 4 summary variants, 3 verification/testing (verification-report, UAT, DEBUG), 2 milestone (milestone, milestone-archive), and 4 session/research management (continue-here, discovery, research, user-setup). |
| `workflows.md` | Workflow Logic Layer | 1,376 | All 30 workflow files across 8 categories: their step-by-step processes, agents spawned, gsd-tools.js commands used, files read/written, decision points, and the complete workflow dependency chain. |

**Total documentation:** 7,585 lines across 7 files.

---

## System Architecture

The GSD framework is a meta-prompting and context engineering system that installs into Claude Code (or OpenCode/Gemini CLI) as a set of slash commands, subagent definitions, workflow files, reference documents, and templates. It provides a complete spec-driven development lifecycle from project initialization to milestone completion.

### The Six Architectural Layers

```
  USER INPUT
      |
      v
+------------------+
| SLASH COMMANDS   |  29 command files in commands/gsd/
| (Orchestrators)  |  Thin wrappers that parse arguments, load state,
|                  |  and delegate to workflows
+--------+---------+
         |
         v
+------------------+
| WORKFLOWS        |  30 workflow files in get-shit-done/workflows/
| (Logic Layer)    |  Step-by-step procedural logic loaded by commands
|                  |  via @file references
+--------+---------+
         |
    +----+----+
    |         |
    v         v
+-------+  +----------+
| AGENTS|  | REFERENCES|  11 agent files in agents/gsd-*.md
| (Work)|  | (Knowledge|  13 reference files in get-shit-done/references/
|       |  |  Layer)   |
+---+---+  +----------+
    |
    v
+------------------+
| TEMPLATES        |  34 template files (22 root + 7 codebase + 5 research)
| (Scaffolding)    |  in get-shit-done/templates/
+--------+---------+
         |
         v
+------------------+
| GSD-TOOLS.JS     |  4,597-line CLI utility
| (State Engine)   |  ~60 subcommands for state management,
|                  |  phase operations, verification, commits
+--------+---------+
         |
         v
+------------------+
| .planning/       |  Project-level state directory
| (File System)    |  The persistent data store for all
|                  |  project state and artifacts
+------------------+
```

### How the Layers Connect

**Commands** are the user-facing entry points. They are markdown files with YAML frontmatter that define what tools are available and what arguments are expected. Each command loads a corresponding **workflow** file via `@~/.claude/get-shit-done/workflows/{name}.md` and says "follow this workflow end-to-end." This keeps commands short (typically under 50 lines) while workflows contain the detailed multi-step logic.

**Workflows** are the procedural logic. They define numbered steps wrapped in XML tags, invoke `gsd-tools.js` for state management, and spawn **agents** via the `Task` tool. Workflows also load **references** for behavioral guidance (how to format commits, how to verify code, how to conduct questioning) and **templates** for scaffolding documents.

**Agents** are specialized worker prompts spawned by workflows into fresh 200k-token context windows. They perform the actual work -- researching, planning, executing code, verifying results, debugging. They communicate through **file system artifacts**: an agent writes a file (PLAN.md, SUMMARY.md, RESEARCH.md); a downstream agent reads it.

**Templates** define the shape of every document in `.planning/`. They specify sections, frontmatter schemas, filling guidelines, and downstream consumer documentation. Templates are filled by agents and written to disk.

**References** are shared knowledge documents injected into prompts. They define behavioral patterns (checkpoint protocol, commit format, verification methodology) that multiple commands, workflows, and agents need consistently.

**gsd-tools.js** is the central state engine. Every operation that involves reading or writing `.planning/` files goes through this CLI utility. It provides compound `init` commands that pre-compute all context a workflow needs in a single call, avoiding multiple round-trips.

### The Infrastructure Layer

Separate from the prompt architecture, the **installer** (`bin/install.js`, 1,739 lines) is the single entry point for `npx get-shit-done-cc`. It handles multi-runtime installation (Claude Code, OpenCode, Gemini CLI), performing on-the-fly format conversion -- Claude Code is the authoring format; OpenCode and Gemini are derived. The installer also manages local patch persistence across updates, hook registration in `settings.json`, and clean uninstall.

Two **hooks** provide runtime enhancements: `gsd-statusline.js` renders a rich terminal statusline with model name, current task, and context window usage; `gsd-check-update.js` checks npm for newer versions on session start.

---

## The Execution Model

A user invocation flows through the system as follows:

```
1. User types /gsd:command [args]
       |
2. Claude Code reads commands/gsd/command.md
   - Parses YAML frontmatter (tools, description, argument-hint)
   - Injects the prompt body as the system instruction
       |
3. Command loads workflow via @~/.claude/get-shit-done/workflows/command.md
   - Also loads references via @~/.claude/get-shit-done/references/name.md
   - Also loads templates via @~/.claude/get-shit-done/templates/name.md
       |
4. Workflow Step 1: Initialize
   - Calls: gsd-tools.js init <command> [--include state,config,roadmap,...]
   - Returns JSON with models, flags, file existence, optionally full file contents
   - Single call replaces 5-10 separate file reads
       |
5. Workflow Steps 2-N: Execute logic
   - Reads/writes .planning/ files via gsd-tools.js commands
   - Presents options to user via AskUserQuestion
   - Checks config flags (mode, gates, workflow toggles)
       |
6. Workflow spawns agent(s) via Task tool
   - Task(prompt=<structured XML>, subagent_type="gsd-agent-name",
          model=<resolved from config>, description="...")
   - Agent gets fresh 200k context window
   - Prompt includes: agent instructions, context files, quality gates,
     downstream consumer notes, output paths
       |
7. Agent executes in isolated context
   - Reads files from .planning/ and codebase
   - Performs work (research, planning, coding, verification)
   - Writes artifacts to .planning/ (PLAN.md, SUMMARY.md, etc.)
   - Returns structured markdown to orchestrator
     (e.g., "## PLANNING COMPLETE", "## VERIFICATION PASSED")
       |
8. Workflow handles agent return
   - Parses structured headers for success/failure/checkpoint
   - If checkpoint: presents to user, spawns continuation agent
   - If success: proceeds to next step or next agent
   - If failure: enters revision loop (max 3 iterations)
       |
9. Workflow commits artifacts via gsd-tools.js commit
       |
10. Workflow presents "Next Up" block routing to next command
```

### Key Execution Patterns

**Orchestrator pattern:** Commands stay lean (~10-15% context usage) and delegate heavy work to subagents, each with a fresh 200k context. This preserves the main conversation for user interaction.

**Wave-based parallelism:** During execute-phase, plans are grouped by dependency wave. All plans in Wave 1 execute in parallel, then Wave 2, etc. Each executor agent gets its own fresh context.

**Revision loop:** Used by plan-phase (planner -> checker -> revise) and verify-work (verifier -> planner gap closure). Maximum 3 iterations before offering the user Force/Guidance/Abandon options.

**Checkpoint protocol:** Three types -- `checkpoint:human-verify` (90% of cases, confirms visual/functional correctness), `checkpoint:decision` (9%, architectural choices), `checkpoint:human-action` (1%, truly unavoidable manual steps like OAuth browser flows). The agent STOPS immediately at a checkpoint, returns structured state, and a fresh continuation agent is spawned after the user responds.

---

## The Data Flow

### The `.planning/` Directory as Communication Channel

All inter-agent and inter-session communication happens through files in the `.planning/` directory. There is no direct message passing between agents. An agent writes a file; a downstream agent reads it. This "file as communication channel" pattern means:

- State survives context resets (`/clear`)
- Agents can be spawned in parallel without coordination
- Any agent can be re-run against existing artifacts
- The entire project state is inspectable by humans

### Complete `.planning/` File Inventory

```
.planning/
  config.json                  CREATED BY: new-project workflow
                               READ BY: all orchestrator commands (gates, toggles, models)
                               UPDATED BY: settings, set-profile commands

  PROJECT.md                   CREATED BY: new-project workflow
                               READ BY: roadmapper, all planning workflows, state references
                               UPDATED BY: new-milestone, complete-milestone, transition

  REQUIREMENTS.md              CREATED BY: new-project workflow
                               READ BY: roadmapper, verifier, plan-checker, audit-milestone
                               UPDATED BY: roadmapper (traceability), transition (status)
                               DELETED BY: complete-milestone (fresh for next milestone)

  ROADMAP.md                   CREATED BY: gsd-roadmapper agent
                               READ BY: planner, checker, verifier, executor, nearly all commands
                               UPDATED BY: phase add/insert/remove, phase complete, plan-phase,
                                           execute-phase, complete-milestone

  STATE.md                     CREATED BY: gsd-roadmapper agent
                               READ BY: every workflow (first action), every command
                               UPDATED BY: executor (advance-plan, record-metric, add-decision),
                                           transition, pause-work, add-todo, check-todos

  MILESTONES.md                CREATED BY: complete-milestone workflow
                               READ BY: new-milestone (version history)

  research/
    STACK.md                   CREATED BY: gsd-project-researcher (stack focus)
    FEATURES.md                CREATED BY: gsd-project-researcher (features focus)
    ARCHITECTURE.md            CREATED BY: gsd-project-researcher (architecture focus)
    PITFALLS.md                CREATED BY: gsd-project-researcher (pitfalls focus)
                               ALL READ BY: gsd-research-synthesizer
                               ALL COMMITTED BY: gsd-research-synthesizer

    SUMMARY.md                 CREATED BY: gsd-research-synthesizer
                               READ BY: gsd-roadmapper, new-project workflow

  codebase/
    STACK.md                   CREATED BY: gsd-codebase-mapper (tech focus)
    INTEGRATIONS.md            CREATED BY: gsd-codebase-mapper (tech focus)
    ARCHITECTURE.md            CREATED BY: gsd-codebase-mapper (arch focus)
    STRUCTURE.md               CREATED BY: gsd-codebase-mapper (arch focus)
    CONVENTIONS.md             CREATED BY: gsd-codebase-mapper (quality focus)
    TESTING.md                 CREATED BY: gsd-codebase-mapper (quality focus)
    CONCERNS.md                CREATED BY: gsd-codebase-mapper (concerns focus)
                               ALL READ BY: gsd-planner (by phase type), gsd-executor
                               COMMITTED BY: map-codebase orchestrator

  phases/XX-name/
    {phase}-CONTEXT.md         CREATED BY: discuss-phase command (conversational, inline)
                               READ BY: gsd-phase-researcher, gsd-planner, gsd-plan-checker

    {phase}-RESEARCH.md        CREATED BY: gsd-phase-researcher agent
                               READ BY: gsd-planner

    DISCOVERY.md               CREATED BY: plan-phase discovery step
                               READ BY: gsd-planner

    {phase}-{NN}-PLAN.md       CREATED BY: gsd-planner agent
                               READ BY: gsd-plan-checker, gsd-executor, gsd-verifier

    {phase}-{plan}-SUMMARY.md  CREATED BY: gsd-executor agent (via execute-plan workflow)
                               READ BY: gsd-verifier, gsd-integration-checker, transition,
                                        future planner instances (selective context)

    {phase}-VERIFICATION.md    CREATED BY: gsd-verifier agent
                               READ BY: gsd-planner (gap closure mode)

    {phase}-UAT.md             CREATED BY: verify-work workflow
                               READ BY: diagnose-issues workflow, planner (gap closure mode)

    {phase}-USER-SETUP.md      CREATED BY: execute-plan workflow (when user_setup in frontmatter)
                               READ BY: human user

    .continue-here.md          CREATED BY: pause-work workflow / execute-plan (session interrupt)
                               READ BY: resume-work workflow
                               DELETED BY: resume-work after consumption

  debug/
    {slug}.md                  CREATED BY: gsd-debugger agent
                               READ BY: gsd-debugger (resume after /clear), UAT gap entries
    resolved/
      {slug}.md                MOVED TO: by debugger after resolution

  quick/
    NNN-slug/
      NNN-PLAN.md              CREATED BY: quick workflow (gsd-planner, quick mode)
      NNN-SUMMARY.md           CREATED BY: quick workflow (gsd-executor)

  todos/
    pending/{date}-{slug}.md   CREATED BY: add-todo workflow
                               READ BY: check-todos workflow
    done/{date}-{slug}.md      MOVED TO: by check-todos when todo worked on

  milestones/
    v{X.Y}-ROADMAP.md          CREATED BY: complete-milestone workflow
    v{X.Y}-REQUIREMENTS.md     CREATED BY: complete-milestone workflow

  v{version}-MILESTONE-AUDIT.md  CREATED BY: audit-milestone workflow
                                  READ BY: plan-milestone-gaps workflow
```

### Data Flow Through the Lifecycle

The lifecycle creates a directed acyclic graph of file dependencies:

```
PROJECT.md ──────────────────────────────────────────────────────────┐
     │                                                                │
     v                                                                │
research/STACK.md ──┐                                                 │
research/FEATURES.md ──> research/SUMMARY.md ──┐                      │
research/ARCHITECTURE.md ┘                      │                      │
research/PITFALLS.md ──┘                        │                      │
                                                v                      │
REQUIREMENTS.md ──────────────────────> ROADMAP.md + STATE.md         │
                                           │         │                 │
                                           v         v                 │
               {phase}-CONTEXT.md ──> {phase}-RESEARCH.md             │
                    │                      │                           │
                    v                      v                           │
               {phase}-{NN}-PLAN.md <──────┘                          │
                    │                                                  │
                    v                                                  │
               {phase}-{plan}-SUMMARY.md ──> STATE.md updates         │
                    │                                                  │
                    v                                                  │
               {phase}-VERIFICATION.md                                │
                    │                                                  │
                    ├──(if gaps)──> {phase}-{NN}-PLAN.md (gap closure) │
                    │                                                  │
                    v                                                  │
               {phase}-UAT.md                                         │
                    │                                                  │
                    v                                                  │
               MILESTONE-AUDIT.md                                     │
                    │                                                  │
                    v                                                  │
               milestones/v{X.Y}-ROADMAP.md                           │
               milestones/v{X.Y}-REQUIREMENTS.md                      │
               MILESTONES.md entry ──────────────────────────> PROJECT.md
```

---

## Component Interaction Map

### Commands to Workflows

Every command loads at most one workflow. The mapping is nearly 1:1:

| Command | Workflow | Notes |
|---------|----------|-------|
| `/gsd:new-project` | `new-project.md` | |
| `/gsd:discuss-phase` | `discuss-phase.md` | |
| `/gsd:plan-phase` | `plan-phase.md` | |
| `/gsd:execute-phase` | `execute-phase.md` | |
| `/gsd:verify-work` | `verify-work.md` | |
| `/gsd:map-codebase` | `map-codebase.md` | |
| `/gsd:research-phase` | Inline process | No workflow file; logic is in the command |
| `/gsd:debug` | Inline process | No workflow file; logic is in the command |
| `/gsd:reapply-patches` | Inline process | No workflow file; logic is in the command |
| `/gsd:new-milestone` | `new-milestone.md` | |
| `/gsd:complete-milestone` | `complete-milestone.md` | |
| `/gsd:audit-milestone` | `audit-milestone.md` | |
| `/gsd:plan-milestone-gaps` | `plan-milestone-gaps.md` | |
| `/gsd:resume-work` | `resume-project.md` | Name mismatch: command is resume-work, workflow is resume-project |
| `/gsd:pause-work` | `pause-work.md` | |
| `/gsd:quick` | `quick.md` | |
| `/gsd:progress` | `progress.md` | |
| `/gsd:help` | `help.md` | Static reference, not procedural |
| `/gsd:settings` | `settings.md` | |
| `/gsd:set-profile` | `set-profile.md` | |
| `/gsd:update` | `update.md` | |
| `/gsd:add-phase` | `add-phase.md` | |
| `/gsd:insert-phase` | `insert-phase.md` | |
| `/gsd:remove-phase` | `remove-phase.md` | |
| `/gsd:add-todo` | `add-todo.md` | |
| `/gsd:check-todos` | `check-todos.md` | |
| `/gsd:list-phase-assumptions` | `list-phase-assumptions.md` | |
| `/gsd:join-discord` | None | Static output only |

**Internally-invoked workflows** (no direct slash command):
- `execute-plan.md` -- loaded by gsd-executor agents
- `verify-phase.md` -- loaded by gsd-verifier agents
- `discovery-phase.md` -- loaded from plan-phase.md
- `diagnose-issues.md` -- loaded from verify-work.md
- `transition.md` -- loaded from execute-phase.md

### Commands to Agents

| Command | Agent(s) Spawned |
|---------|-----------------|
| `/gsd:new-project` | gsd-project-researcher (x4 parallel), gsd-research-synthesizer (x1), gsd-roadmapper (x1+) |
| `/gsd:map-codebase` | gsd-codebase-mapper (x4 parallel) |
| `/gsd:plan-phase` | gsd-phase-researcher (optional), gsd-planner (x1+), gsd-plan-checker (x1+) |
| `/gsd:execute-phase` | gsd-executor (Nx, one per plan per wave), gsd-verifier (x1) |
| `/gsd:verify-work` | debug agents (via diagnose-issues), gsd-planner (gap closure), gsd-plan-checker |
| `/gsd:research-phase` | gsd-phase-researcher (x1) |
| `/gsd:debug` | gsd-debugger (x1+, continuations) |
| `/gsd:quick` | gsd-planner (quick mode), gsd-executor (x1) |
| `/gsd:audit-milestone` | gsd-integration-checker (x1) |
| `/gsd:new-milestone` | gsd-project-researcher (x4), gsd-research-synthesizer, gsd-roadmapper |

### Agents to Templates

| Agent | Templates Used | Output Files |
|-------|---------------|--------------|
| gsd-codebase-mapper | `templates/codebase/*.md` (7 files, also embedded inline in agent) | `.planning/codebase/*.md` (7 files) |
| gsd-project-researcher | `templates/research-project/*.md` (4 files, also embedded inline) | `.planning/research/*.md` (4 files) |
| gsd-research-synthesizer | `templates/research-project/SUMMARY.md` | `.planning/research/SUMMARY.md` |
| gsd-roadmapper | `templates/roadmap.md`, `templates/state.md` | `.planning/ROADMAP.md`, `.planning/STATE.md` |
| gsd-planner | (reads `templates/phase-prompt.md` format, `templates/summary.md`) | `{phase}-{NN}-PLAN.md` files |
| gsd-executor | `templates/summary.md` (+ variants), `templates/user-setup.md` | `{phase}-{plan}-SUMMARY.md`, `{phase}-USER-SETUP.md` |
| gsd-verifier | `templates/verification-report.md` | `{phase}-VERIFICATION.md` |
| gsd-debugger | `templates/DEBUG.md` | `.planning/debug/{slug}.md` |

### Agents to gsd-tools.js Commands

| Agent | gsd-tools.js Commands |
|-------|----------------------|
| gsd-executor | `init execute-phase`, `state advance-plan`, `state update-progress`, `state record-metric`, `state add-decision`, `state record-session`, `state add-blocker`, `commit`, `summary-extract` |
| gsd-planner | `init plan-phase`, `history-digest`, `frontmatter validate`, `verify plan-structure`, `commit` |
| gsd-plan-checker | `init phase-op`, `verify plan-structure`, `frontmatter get`, `roadmap get-phase` |
| gsd-verifier | `roadmap get-phase`, `verify artifacts`, `verify key-links`, `verify commits`, `summary-extract`, `frontmatter get` |
| gsd-phase-researcher | `init phase-op`, `commit`, `websearch` |
| gsd-project-researcher | `websearch` |
| gsd-research-synthesizer | `commit` |
| gsd-roadmapper | (reads config directly) |
| gsd-codebase-mapper | (writes directly, no gsd-tools.js) |
| gsd-integration-checker | (reads directly, no gsd-tools.js) |
| gsd-debugger | `state load`, `commit` |

### Workflows to References

| Reference | Workflows That Load It |
|-----------|----------------------|
| `checkpoints.md` | `execute-phase.md`, `execute-plan.md` |
| `git-integration.md` | `execute-plan.md` |
| `tdd.md` | `execute-phase.md`, `execute-plan.md` |
| `ui-brand.md` | `plan-phase.md` |
| `verification-patterns.md` | `verify-phase.md` |
| `model-profile-resolution.md` | `research-phase.md` |
| `phase-argument-parsing.md` | `research-phase.md` |
| `continuation-format.md` | `resume-project.md` |

### Workflows to Templates

| Template | Workflow(s) That Use It |
|----------|------------------------|
| `templates/project.md` | `new-project.md` |
| `templates/research-project/*.md` | `new-project.md`, `new-milestone.md` |
| `templates/summary.md` | `execute-plan.md` |
| `templates/user-setup.md` | `execute-plan.md` |
| `templates/verification-report.md` | `verify-phase.md` |
| `templates/UAT.md` | `verify-work.md` |
| `templates/discovery.md` | `discovery-phase.md` |
| `templates/milestone.md` | `complete-milestone.md` |
| `templates/milestone-archive.md` | `complete-milestone.md` |

### Templates to `.planning/` Files

| Template | Scaffolds |
|----------|-----------|
| `project.md` | `.planning/PROJECT.md` |
| `roadmap.md` | `.planning/ROADMAP.md` |
| `requirements.md` | `.planning/REQUIREMENTS.md` |
| `state.md` | `.planning/STATE.md` |
| `config.json` | `.planning/config.json` |
| `context.md` | `.planning/phases/XX-name/{phase}-CONTEXT.md` |
| `phase-prompt.md` | `.planning/phases/XX-name/{phase}-{NN}-PLAN.md` |
| `summary.md` (+ 3 variants) | `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` |
| `verification-report.md` | `.planning/phases/XX-name/{phase}-VERIFICATION.md` |
| `UAT.md` | `.planning/phases/XX-name/{phase}-UAT.md` |
| `DEBUG.md` | `.planning/debug/{slug}.md` |
| `continue-here.md` | `.planning/phases/XX-name/.continue-here.md` |
| `discovery.md` | `.planning/phases/XX-name/DISCOVERY.md` |
| `research.md` | `.planning/phases/XX-name/{phase}-RESEARCH.md` |
| `user-setup.md` | `.planning/phases/XX-name/{phase}-USER-SETUP.md` |
| `milestone.md` | `.planning/MILESTONES.md` |
| `milestone-archive.md` | `.planning/milestones/v{VERSION}-{NAME}.md` |
| `codebase/*.md` (7 files) | `.planning/codebase/*.md` |
| `research-project/*.md` (5 files) | `.planning/research/*.md` |

---

## The Core Lifecycle

The complete end-to-end workflow from new project to milestone completion:

### Phase 1: Project Initialization (`/gsd:new-project`)

1. **Setup** -- `gsd-tools.js init new-project` checks for existing project, git status, brownfield indicators
2. **Brownfield detection** -- If existing code found without codebase map, offers `/gsd:map-codebase` first (spawns 4 parallel `gsd-codebase-mapper` agents producing 7 documents in `.planning/codebase/`)
3. **Deep questioning** -- Uses `AskUserQuestion` with `references/questioning.md` techniques to extract the user's vision. Loops until user says "Create PROJECT.md"
4. **Write PROJECT.md** -- Using `templates/project.md`. Greenfield: requirements as hypotheses. Brownfield: infers Validated requirements from existing codebase docs
5. **Workflow preferences** -- Two rounds of `AskUserQuestion` configuring mode, depth, parallelization, research/checker/verifier toggles, model profile. Creates `config.json`
6. **Research** -- Spawns 4 parallel `gsd-project-researcher` agents (Stack, Features, Architecture, Pitfalls). Each writes to `.planning/research/`. Then spawns `gsd-research-synthesizer` to create `SUMMARY.md` and commit all research files
7. **Requirements** -- Presents features by category from research. User scopes v1/v2/out-of-scope. Generates `REQUIREMENTS.md` with REQ-IDs
8. **Roadmap** -- Spawns `gsd-roadmapper` agent. Derives phases from requirements, ensures 100% requirement coverage, writes `ROADMAP.md` and `STATE.md`. Presented for user approval with revision loop

**Files created:** PROJECT.md, config.json, research/* (5 files), REQUIREMENTS.md, ROADMAP.md, STATE.md

### Phase 2: Phase Discussion (`/gsd:discuss-phase N`)

1. Analyzes the phase to identify domain-specific gray areas (visual features produce different questions than CLI tools)
2. User multi-selects which areas to discuss
3. Deep-dives each area with 4 questions per area, then offers more/next
4. Writes `{phase}-CONTEXT.md` with locked decisions, Claude's discretion areas, deferred ideas

**Files created:** {phase}-CONTEXT.md

### Phase 3: Phase Planning (`/gsd:plan-phase N`)

1. **Research** (optional) -- Spawns `gsd-phase-researcher` if enabled. Reads CONTEXT.md to focus research. Writes `{phase}-RESEARCH.md`
2. **Planning** -- Spawns `gsd-planner` with all context (state, roadmap, requirements, context, research, codebase docs). Creates `{phase}-{NN}-PLAN.md` files with XML task structure, wave assignments, must_haves for verification
3. **Verification** -- Spawns `gsd-plan-checker` for goal-backward analysis. If issues found, enters revision loop (max 3 iterations) sending structured issues back to planner

**Files created:** {phase}-RESEARCH.md (optional), {phase}-{NN}-PLAN.md (one or more)

### Phase 4: Phase Execution (`/gsd:execute-phase N`)

1. **Discover plans** -- Groups by wave number, skips plans with existing SUMMARYs
2. **Execute waves** -- For each wave, spawns `gsd-executor` agents (parallel if configured). Each executor:
   - Reads its PLAN.md as execution instructions
   - Implements tasks one at a time with atomic commits per task
   - Handles deviations via 4-tier rules (auto-fix bugs, auto-add critical features, auto-fix blockers, STOP for architectural changes)
   - Creates `{phase}-{plan}-SUMMARY.md` with frontmatter dependency graph
   - Updates STATE.md (advance plan, record metrics, add decisions)
3. **Verify phase goal** -- Spawns `gsd-verifier` for goal-backward analysis (truths, artifacts, key links). Creates `{phase}-VERIFICATION.md`
4. **Handle results** -- Passed: update roadmap. Gaps found: offer `/gsd:plan-phase --gaps`

**Files created:** {phase}-{plan}-SUMMARY.md (per plan), {phase}-VERIFICATION.md, code artifacts, git commits

### Phase 5: User Acceptance Testing (`/gsd:verify-work N`)

1. Extracts user-observable outcomes from SUMMARYs as test cases
2. Creates `{phase}-UAT.md` with test entries
3. Presents tests one at a time. User types "pass" or describes issues. Severity auto-inferred from language
4. If issues found: spawns parallel debug agents (via `diagnose-issues` workflow). Each debugger creates `.planning/debug/{slug}.md`
5. Updates UAT.md with root causes. Spawns `gsd-planner` in gap closure mode to create fix plans

**Files created:** {phase}-UAT.md, debug/{slug}.md (per issue), gap closure PLAN.md files

### Phase 6: Phase Transition (internal, via `transition.md`)

1. Verifies all plans have SUMMARYs
2. Marks phase complete in ROADMAP.md, advances STATE.md to next phase
3. Evolves PROJECT.md (moves requirements between tiers, logs decisions)
4. Routes to next phase or milestone completion

### Phase 7: Milestone Completion (`/gsd:complete-milestone <version>`)

1. **Pre-flight** -- Checks for MILESTONE-AUDIT.md (from `/gsd:audit-milestone` which spawns `gsd-integration-checker` for cross-phase wiring verification)
2. Archives ROADMAP.md and REQUIREMENTS.md to `.planning/milestones/`
3. Creates/appends MILESTONES.md entry with accomplishments, stats, git range
4. Evolves PROJECT.md to brownfield format
5. Creates annotated git tag `v{version}`
6. Deletes original ROADMAP.md and REQUIREMENTS.md (fresh for next milestone)

**Files created:** milestones/v{X.Y}-ROADMAP.md, milestones/v{X.Y}-REQUIREMENTS.md, MILESTONES.md entry, git tag

---

## Prompt Engineering Patterns

The GSD system employs a comprehensive set of prompt engineering techniques, documented across all 7 domain files:

### Structural Patterns

**XML tag organization** -- All agents, commands, and workflows use XML tags for semantic structure. Common tags: `<role>`, `<philosophy>`, `<execution_flow>`, `<success_criteria>`, `<critical_rules>`, `<anti_patterns>`, `<structured_returns>`. These help Claude identify and reference specific sections within long prompts.

**YAML frontmatter** -- Used in PLAN.md, SUMMARY.md, VERIFICATION.md, UAT.md, DEBUG.md for machine-readable metadata. Frontmatter is always in the first ~25 lines for cheap scanning. The frontmatter schema is defined in templates and validated by `gsd-tools.js frontmatter validate`.

**Structured returns** -- Almost all agents return formatted markdown with consistent headers (`## PLANNING COMPLETE`, `## VERIFICATION PASSED`, `## RESEARCH COMPLETE`). These act as machine-parseable signals for orchestrators to branch on success, failure, or checkpoint.

### Behavioral Patterns

**Goal-backward methodology** -- Used by planner, plan-checker, verifier, and roadmapper. Always starts from "What must be TRUE when this is done?" and works backward to tasks. The `must_haves` frontmatter field (truths, artifacts, key_links) is the primary verification mechanism.

**Downstream consumer documentation** -- Multiple agents include explicit tables showing how their output is consumed by downstream agents. The `<downstream_consumer>` and `<why_this_matters>` sections tell each agent why its output quality matters, improving output relevance.

**Anti-pattern documentation** -- Nearly every reference, agent, and template includes an anti-patterns section. These are often shown as before/after pairs (BAD/GOOD), making it hard to accidentally follow the wrong approach. Seven explicit anti-patterns in the plan-checker alone.

**Context fidelity enforcement** -- The planner has a `<context_fidelity>` section with three rules: locked decisions MUST be implemented exactly, deferred ideas MUST NOT appear, Claude's discretion areas use best judgment. A self-check protocol runs before returning.

### Knowledge Patterns

**"Training data is hypothesis"** -- Research agents explicitly treat Claude's built-in knowledge as potentially stale (6-18 months). They use a three-tier source hierarchy: Context7 MCP (HIGH trust) > Official docs via WebFetch (HIGH-MEDIUM) > WebSearch (needs verification). Confidence levels (HIGH/MEDIUM/LOW) propagate through the research pipeline.

**"Plans are prompts"** -- PLAN.md files are designed to be directly consumable by the executor agent without interpretation. They contain the objective, context, tasks with verify/done criteria, and must_haves -- everything the executor needs.

**"Existence does not equal implementation"** -- Both the verifier and integration-checker enforce multi-level verification beyond file existence. Three artifact verification levels: EXISTS (file present) > SUBSTANTIVE (not a stub, has min_lines, expected patterns) > WIRED (imported AND used by other code).

### Efficiency Patterns

**Compound init commands** -- `gsd-tools.js init <command>` pre-computes all context a workflow needs in a single call (models, flags, file existence, optionally full file contents via `--include`). This replaces 5-10 separate file reads and config checks.

**"Write first, then return"** -- Multiple agents are instructed to write files to disk before returning structured results. This ensures artifacts persist even if context is lost during the return.

**"Agents write directly"** -- Codebase mapper and project researcher agents write documents directly to disk and return only confirmation to the orchestrator. This keeps orchestrator context lean (~10-15%).

**Context budget awareness** -- The planner explicitly tracks a quality degradation curve: quality starts dropping at 40% context usage, with measurable degradation at 50% and significant degradation at 65%. Plans target ~50% context usage (40% for TDD). Tasks are sized at 15-60 min Claude execution time.

### Security Patterns

**Forbidden files list** -- The codebase mapper has an explicit `<forbidden_files>` section listing files that must never be read or quoted (.env, credentials, keys, etc.) with rationale: "Your output gets committed to git. Leaked secrets = security incident."

**Commit discipline** -- Per-task atomic commits with explicit prohibition of `git add .`. Individual file staging prevents accidentally committing sensitive files.

### UX Patterns

**Anti-enterprise stance** -- Multiple agents explicitly reject PM theater: no team coordination, no sprint ceremonies, no stakeholder management, no time estimates in human-hours. The roadmapper has a NEVER list for phases (project management, testing strategy documents, deployment planning).

**Consistent visual language** -- `references/ui-brand.md` defines exact patterns: stage banners (62-character width, `GSD >` prefix), checkpoint boxes (Unicode box-drawing), status symbols (restricted set), progress displays, "Next Up" blocks. All workflows end with a structured routing section.

**Severity inference** -- During UAT, severity is INFERRED from user's natural language (crash -> blocker, doesn't work -> major, slow -> minor, color -> cosmetic). The system NEVER asks "how severe?"

---

## Statistics

### Component Counts

| Component | Count | Total Lines |
|-----------|-------|-------------|
| Slash commands | 29 (+ 1 .bak) | 1,573 |
| Agents | 11 | 7,015 |
| Workflows | 30 | 9,084 |
| Templates (root) | 22 | ~5,500* |
| Templates (codebase) | 7 | ~1,000* |
| Templates (research-project) | 5 | ~750* |
| References | 13 | 2,911 |
| gsd-tools.js | 1 | 4,597 |
| gsd-tools.test.js | 1 | ~2,034 |
| install.js | 1 | 1,739 |
| Hooks | 2 | 153 |
| build-hooks.js | 1 | 42 |
| **Total prompt content** | | **~28,860** |
| **Total infrastructure code** | | **~8,565** |

*Template line counts are approximate subdivisions of the 7,277-line total across all template files.

### gsd-tools.js Command Count

The central CLI utility provides approximately 60 subcommands across these categories:

| Category | Commands | Count |
|----------|----------|-------|
| State management | `state load`, `state update`, `state get`, `state patch`, `state advance-plan`, `state record-metric`, `state update-progress`, `state add-decision`, `state add-blocker`, `state resolve-blocker`, `state record-session`, `state-snapshot` | 12 |
| Phase operations | `phase add`, `phase insert`, `phase remove`, `phase complete`, `phase next-decimal`, `find-phase`, `phase-plan-index` | 7 |
| Roadmap operations | `roadmap get-phase`, `roadmap analyze` | 2 |
| Milestone operations | `milestone complete` | 1 |
| Verification | `verify plan-structure`, `verify phase-completeness`, `verify references`, `verify commits`, `verify artifacts`, `verify key-links`, `verify-summary`, `validate consistency` | 8 |
| Frontmatter CRUD | `frontmatter get`, `frontmatter set`, `frontmatter merge`, `frontmatter validate` | 4 |
| Template fill | `template fill summary`, `template fill plan`, `template fill verification`, `template select` | 4 |
| Scaffolding | `scaffold context`, `scaffold uat`, `scaffold verification`, `scaffold phase-dir` | 4 |
| Compound init | `init execute-phase`, `init plan-phase`, `init new-project`, `init new-milestone`, `init quick`, `init resume`, `init verify-work`, `init phase-op`, `init todos`, `init milestone-op`, `init map-codebase`, `init progress` | 12 |
| Utilities | `commit`, `resolve-model`, `generate-slug`, `current-timestamp`, `list-todos`, `todo complete`, `verify-path-exists`, `config-ensure-section`, `config-set`, `history-digest`, `summary-extract`, `progress`, `websearch` | 13 |

### Agent Model Profiles

Three profiles (quality/balanced/budget) map 11 agents to Claude models:

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-planner | opus | opus | sonnet |
| gsd-roadmapper | opus | sonnet | sonnet |
| gsd-executor | opus | sonnet | sonnet |
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-project-researcher | opus | sonnet | haiku |
| gsd-research-synthesizer | sonnet | sonnet | haiku |
| gsd-debugger | opus | sonnet | sonnet |
| gsd-codebase-mapper | sonnet | haiku | haiku |
| gsd-verifier | sonnet | sonnet | haiku |
| gsd-plan-checker | sonnet | sonnet | haiku |
| gsd-integration-checker | sonnet | sonnet | haiku |

### Tool Usage Across Agents

| Tool | Agents Using It |
|------|----------------|
| Read | All 11 |
| Bash | All 11 |
| Write | 7 (mapper, debugger, executor, researchers, synthesizer, roadmapper, planner) |
| Grep | 9 (all except synthesizer, project-researcher) |
| Glob | 9 (all except synthesizer, project-researcher) |
| Edit | 2 (executor, debugger) |
| WebSearch | 4 (phase-researcher, project-researcher, debugger, planner) |
| WebFetch | 2 (phase-researcher, planner) |
| mcp__context7__* | 3 (phase-researcher, project-researcher, planner) |

---

## Key Observations

### What Works Well

**1. The file-as-communication-channel pattern is robust.** Because all state lives in `.planning/` files with well-defined schemas, the system handles context resets (`/clear`), session interruptions, and agent failures gracefully. Any agent can be re-run against existing artifacts. The debug session file is explicitly designed as the "debugging brain" that survives context loss -- with IMMUTABLE, APPEND-only, and OVERWRITE sections controlling data integrity.

**2. Compound init commands are a significant optimization.** The `gsd-tools.js init <command>` pattern pre-computes all context in a single CLI call. Without this, every workflow would need 5-10 separate file reads and config checks. The `--include` flag can embed full file contents in the init JSON, eliminating redundant reads entirely.

**3. Goal-backward methodology provides verification coherence.** The chain from roadmap success criteria to plan `must_haves` to verifier checks creates a traceable quality path. The same methodology (start from "what must be TRUE?") is used at three levels: roadmap (by roadmapper), plan (by planner), and verification (by verifier and plan-checker).

**4. The orchestrator/subagent split preserves context effectively.** By keeping commands as thin orchestrators (~10-15% context) and delegating heavy work to subagents with fresh 200k context, the system avoids the context exhaustion problem that would occur if everything ran in the main conversation.

**5. Anti-pattern documentation is comprehensive.** Nearly every component includes explicit "what NOT to do" sections. The plan-checker has 7 anti-patterns, the debugger has cognitive bias antidotes, the roadmapper has 6 anti-patterns, checkpoints.md pairs every good pattern with a bad one. This makes the system more resilient to prompt drift.

### What Is Complex

**1. The system has massive prompt surface area.** With ~28,860 lines of prompt content across 105 files (29 commands + 11 agents + 30 workflows + 13 references + 22 root templates), the system is difficult to modify safely. Changes to a template or reference can cascade through multiple agents and workflows. The domain docs themselves total 7,585 lines just to document the system.

**2. Template duplication creates drift risk.** Both the `gsd-codebase-mapper` and `gsd-project-researcher` agents contain inline simplified copies of their templates alongside the canonical templates in the `templates/` directory. When the canonical template is updated, the inline version may not be -- and vice versa.

**3. The installer (1,739 lines) handles three runtime conversions.** Format conversion from Claude Code to OpenCode (flat command namespace, different frontmatter format, different tool names) and Gemini (TOML format, YAML array tools, snake_case names) adds complexity. Every structural change to commands or agents must work across all three runtimes.

**4. gsd-tools.js (4,597 lines) is a monolith.** It contains ~60 subcommands covering state management, phase operations, roadmap analysis, verification, git integration, template filling, and frontmatter CRUD -- all in a single file with no external dependencies. The CLI router alone is 380 lines of switch statement.

**5. The four-summary-variant system adds cognitive load.** Having `summary.md` (canonical reference) plus `summary-complex.md`, `summary-standard.md`, and `summary-minimal.md` (instantiation templates) means the executor agent must decide which variant to use based on plan complexity. The template selection logic is in `gsd-tools.js template select`.

### What Patterns Are Most Effective

**1. Structured returns with machine-parseable headers.** The `## PLANNING COMPLETE` / `## VERIFICATION PASSED` / `## RESEARCH COMPLETE` pattern gives orchestrators clear, unambiguous signals to branch on. This is more reliable than parsing natural language responses.

**2. Downstream consumer documentation within agent prompts.** The `<downstream_consumer>` and `<why_this_matters>` sections that tell each agent exactly how its output will be used produce measurably better output than generic "write a good document" instructions. The codebase mapper's table mapping phase types to loaded documents is a notable example.

**3. The three-tier confidence system.** HIGH/MEDIUM/LOW with specific criteria for each level, propagated from researcher to synthesizer to roadmapper, gives the system honest signal about knowledge quality. The "training data is hypothesis" framing directly addresses LLM knowledge staleness.

**4. Section mutation rules (OVERWRITE/APPEND/IMMUTABLE).** Used in UAT.md and DEBUG.md, these rules enable reliable resume after context loss. The Eliminated section in debug sessions (APPEND only) prevents re-investigating dead ends -- a simple rule with high practical impact.

**5. The deviation rules system in the executor.** The four-tier framework (auto-fix bugs, auto-add critical features, auto-fix blockers, STOP for architectural decisions) gives the executor clear authority to make inline fixes without asking while still escalating decisions that change the architecture. This balances autonomy with control.

### Fragilities

**1. `@` path references are brittle across runtimes.** All source files use `~/.claude/` paths. The installer replaces these per-runtime, but any new file reference added to a command, workflow, or agent must use the `~/.claude/` convention or it will break on non-Claude runtimes.

**2. Orphaned references exist.** Four reference files (`decimal-phase-calculation.md`, `git-planning-commit.md`, `planning-config.md`, `model-profiles.md`) have zero direct `@` inclusions. Their knowledge is either encoded in `gsd-tools.js` or loaded indirectly. They serve as developer documentation but could create confusion about what is actively used.

**3. The `reapply-patches` command has inconsistent frontmatter.** It uses comma-separated `allowed-tools` (string) instead of the YAML array used by all other commands, and omits the `name` field. This suggests it was authored differently and may cause issues with future tooling that expects consistent frontmatter format.

**4. Test coverage has significant gaps.** The test suite covers ~20 command groups with ~60 tests, but does not cover: `commit`, `verify-summary`, all `verify *` commands, all `frontmatter *` commands, `template fill/select`, most `state *` commands, `resolve-model`, `websearch`, `config-set`, or most `init` subcommands. These untested areas include complex logic (verification suite, template filling) where bugs would be hard to catch.

**5. The command workflow lifecycle assumes sequential phases.** While the system handles decimal phase insertion for urgent work, it does not natively support parallel phase development, feature branches per phase (only via config), or non-linear phase ordering beyond simple decimals.
