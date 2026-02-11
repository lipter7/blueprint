# GSD Agents

## Overview

Agents are the specialized worker units of the GSD framework. Each agent is a markdown file in the `agents/` directory with YAML frontmatter defining metadata and a prompt body defining behavior. Agents are **never invoked directly by users**; they are spawned by orchestrator commands (slash commands in `commands/gsd/`) which pass them arguments, context, and scope.

### How Agents Are Structured

Every agent file follows this structure:

1. **YAML Frontmatter** -- contains `name`, `description`, `tools` (comma-separated list of allowed tools), and `color` (terminal display color).
2. **Prompt Body** -- the full system prompt injected when the agent is spawned. Uses XML tags extensively for structured sections: `<role>`, `<philosophy>`, `<process>`, `<execution_flow>`, `<success_criteria>`, etc.

### The Spawning Model

Orchestrator commands (e.g., `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:new-project`) act as coordinators. They:

1. Load project state via `gsd-tools.js init <command>`
2. Determine which agent(s) to spawn
3. Pass context (phase number, plan files, user decisions, prior outputs) to the agent
4. Receive structured return messages from agents (e.g., `## PLANNING COMPLETE`, `## VERIFICATION PASSED`)
5. Act on the return (commit files, spawn next agent, present results to user)

Agents communicate via **file system artifacts** (PLAN.md, SUMMARY.md, RESEARCH.md, VERIFICATION.md, etc.) rather than direct message passing. An agent writes a file; a downstream agent reads it.

### Agent Count and Categories

There are **11 agents** organized into these functional categories:

| Category | Agents | Purpose |
|----------|--------|---------|
| Research | gsd-project-researcher, gsd-phase-researcher, gsd-research-synthesizer | Investigate domains, libraries, patterns before planning |
| Planning | gsd-planner, gsd-plan-checker, gsd-roadmapper | Create and validate plans and roadmaps |
| Execution | gsd-executor | Execute plans with atomic commits |
| Quality | gsd-verifier, gsd-integration-checker | Verify goal achievement post-execution |
| Analysis | gsd-codebase-mapper | Analyze existing codebases |
| Debugging | gsd-debugger | Investigate and fix bugs |

---

## Agent Dependency Graph

### Full Data Flow

```
/gsd:new-project (orchestrator)
  |
  +--> gsd-project-researcher (x4 parallel: STACK, FEATURES, ARCHITECTURE, PITFALLS)
  |       |
  |       +--> writes .planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md
  |
  +--> gsd-research-synthesizer
  |       |
  |       +--> reads all 4 research files
  |       +--> writes .planning/research/SUMMARY.md
  |       +--> commits all research files
  |
  +--> gsd-roadmapper
          |
          +--> reads SUMMARY.md, PROJECT.md, REQUIREMENTS.md
          +--> writes .planning/ROADMAP.md, .planning/STATE.md

/gsd:map-codebase (orchestrator)
  |
  +--> gsd-codebase-mapper (x4 parallel: tech, arch, quality, concerns)
          |
          +--> writes .planning/codebase/{STACK,INTEGRATIONS,ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,CONCERNS}.md

/gsd:plan-phase (orchestrator)
  |
  +--> gsd-phase-researcher (optional, if research needed)
  |       |
  |       +--> reads CONTEXT.md (from /gsd:discuss-phase)
  |       +--> writes {phase}-RESEARCH.md
  |
  +--> gsd-planner
  |       |
  |       +--> reads RESEARCH.md, CONTEXT.md, ROADMAP.md, STATE.md, codebase docs
  |       +--> writes {phase}-{NN}-PLAN.md files
  |
  +--> gsd-plan-checker
          |
          +--> reads PLAN.md files, ROADMAP.md, CONTEXT.md
          +--> returns PASSED or ISSUES FOUND to orchestrator
          |
          (if issues) --> gsd-planner (revision mode)

/gsd:execute-phase (orchestrator)
  |
  +--> gsd-executor
          |
          +--> reads PLAN.md, STATE.md, codebase docs
          +--> writes {phase}-{plan}-SUMMARY.md
          +--> updates STATE.md
          +--> creates git commits per task

/gsd:verify-work (orchestrator)
  |
  +--> gsd-verifier
          |
          +--> reads PLAN.md, SUMMARY.md, ROADMAP.md, REQUIREMENTS.md
          +--> writes {phase}-VERIFICATION.md
          |
          (if gaps) --> /gsd:plan-phase --gaps --> gsd-planner (gap closure mode)

/gsd:complete-milestone (orchestrator)
  |
  +--> gsd-integration-checker
          |
          +--> reads SUMMARY.md files across phases
          +--> returns integration report

/gsd:debug (orchestrator)
  |
  +--> gsd-debugger
          |
          +--> reads/writes .planning/debug/{slug}.md
          +--> may fix code and commit
```

### Agent-to-Agent Data Flow Summary

| Upstream Agent | Artifact Written | Downstream Agent(s) |
|---------------|-----------------|---------------------|
| gsd-project-researcher | .planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md | gsd-research-synthesizer |
| gsd-research-synthesizer | .planning/research/SUMMARY.md | gsd-roadmapper |
| gsd-roadmapper | .planning/ROADMAP.md, .planning/STATE.md | gsd-planner, gsd-verifier, gsd-plan-checker |
| gsd-codebase-mapper | .planning/codebase/*.md | gsd-planner, gsd-executor |
| gsd-phase-researcher | {phase}-RESEARCH.md | gsd-planner |
| gsd-planner | {phase}-{NN}-PLAN.md | gsd-plan-checker, gsd-executor, gsd-verifier |
| gsd-plan-checker | (structured return only) | gsd-planner (revision mode) |
| gsd-executor | {phase}-{plan}-SUMMARY.md, STATE.md | gsd-verifier, gsd-integration-checker |
| gsd-verifier | {phase}-VERIFICATION.md | gsd-planner (gap closure mode) |
| gsd-integration-checker | (structured return only) | orchestrator (milestone completion) |
| gsd-debugger | .planning/debug/{slug}.md | gsd-debugger (resume after /clear) |

---

## gsd-codebase-mapper

### Frontmatter

```yaml
name: gsd-codebase-mapper
description: Explores codebase and writes structured analysis documents. Spawned by map-codebase with a focus area (tech, arch, quality, concerns). Writes documents directly to reduce orchestrator context load.
tools: Read, Bash, Grep, Glob, Write
color: cyan
```

### Role and Purpose

Explores an existing codebase for a specific focus area and writes structured analysis documents directly to `.planning/codebase/`. The key design choice is that this agent **writes documents directly** rather than returning findings to the orchestrator, explicitly to reduce context transfer overhead.

### Spawning Command

- `/gsd:map-codebase` -- spawned with one of four focus areas

### Focus Areas and Output Files

| Focus | Documents Written |
|-------|-------------------|
| tech | STACK.md, INTEGRATIONS.md |
| arch | ARCHITECTURE.md, STRUCTURE.md |
| quality | CONVENTIONS.md, TESTING.md |
| concerns | CONCERNS.md |

### Tools Allowed

Read, Bash, Grep, Glob, Write

### Files Read

- Package manifests (package.json, requirements.txt, Cargo.toml, go.mod, pyproject.toml)
- Config files (*.config.*, tsconfig.json, .nvmrc, etc.)
- Linting/formatting configs (.eslintrc*, .prettierrc*, biome.json)
- Test configs (jest.config.*, vitest.config.*)
- Source files throughout src/ for pattern analysis

### Files Written

- `.planning/codebase/STACK.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`

### Downstream Consumers

- **gsd-planner** loads relevant codebase docs based on phase type (e.g., UI phases load CONVENTIONS.md and STRUCTURE.md; API phases load ARCHITECTURE.md and CONVENTIONS.md)
- **gsd-executor** references codebase docs to follow conventions, know file placement, match testing patterns, and avoid technical debt

### Key Prompt Sections

- **`<role>`**: Defines the four focus areas and their document outputs
- **`<why_this_matters>`**: Explicitly explains how downstream agents consume each document, with a table mapping phase types to documents loaded. This section is a notable prompt engineering technique -- telling the agent *why* its output matters to other agents.
- **`<philosophy>`**: Emphasizes document quality over brevity, mandatory file paths, current state only (no temporal language), prescriptive over descriptive writing
- **`<process>`**: Four steps: parse_focus, explore_codebase (with specific bash commands per focus), write_documents, return_confirmation
- **`<templates>`**: Full markdown templates for each of the 7 possible output documents, with placeholder syntax like `[YYYY-MM-DD]` and `[Placeholder text]`
- **`<forbidden_files>`**: Comprehensive list of files that must never be read or quoted (.env, credentials, keys, etc.) with explicit rationale: "Your output gets committed to git. Leaked secrets = security incident."
- **`<critical_rules>`**: Six rules including "WRITE DOCUMENTS DIRECTLY", "ALWAYS INCLUDE FILE PATHS", "RETURN ONLY CONFIRMATION"
- **`<success_criteria>`**: Checklist of 6 items

### Notable Prompt Engineering Techniques

1. **Explicit downstream consumer documentation** -- The `<why_this_matters>` section tells the agent exactly how its output is consumed, which drives output quality
2. **Template-driven output** -- Full templates prevent format drift
3. **Forbidden files list** -- Security boundary embedded in the prompt
4. **"Return only confirmation" rule** -- Explicitly constrains response length to ~10 lines, forcing the agent to write to disk rather than dumping content into the response

---

## gsd-debugger

### Frontmatter

```yaml
name: gsd-debugger
description: Investigates bugs using scientific method, manages debug sessions, handles checkpoints. Spawned by /gsd:debug orchestrator.
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch
color: orange
```

### Role and Purpose

A systematic bug investigator that uses the scientific method (hypothesis formation, experimental testing, evidence gathering). Manages persistent debug sessions via markdown files that survive context resets (the file IS the debugging brain). Can operate in diagnostic-only mode or full find-and-fix mode.

### Spawning Commands

- `/gsd:debug` (interactive debugging)
- `diagnose-issues` workflow (parallel UAT diagnosis)

### Tools Allowed

Read, Write, Edit, Bash, Grep, Glob, WebSearch

### Files Read

- `.planning/debug/*.md` (existing debug sessions)
- Codebase source files (investigation targets)

### Files Written

- `.planning/debug/{slug}.md` (debug session file -- created immediately, updated continuously)
- `.planning/debug/resolved/{slug}.md` (archived sessions)
- Source code fixes (in find-and-fix mode)

### Agent Interactions

- **Upstream**: Receives symptoms from user or from `diagnose-issues` workflow (UAT failures)
- **Downstream**: In `find_root_cause_only` mode, returns diagnosis to `/gsd:plan-phase --gaps` for gap closure planning

### Key Prompt Sections

- **`<role>`**: Defines core responsibilities: investigate autonomously, maintain persistent debug file state, return structured results, handle checkpoints
- **`<philosophy>`**: Extensive section covering:
  - "User = Reporter, Claude = Investigator" -- users describe symptoms, agent investigates causes
  - "Meta-Debugging: Your Own Code" -- guidance for debugging code Claude itself wrote, acknowledging the mental model trap
  - "Foundation Principles" -- distinguishing certainties from assumptions
  - **Cognitive Biases table** -- Confirmation, Anchoring, Availability, Sunk Cost biases with specific antidotes
  - "When to Restart" protocol with 5 specific triggers
- **`<hypothesis_testing>`**: Detailed scientific method framework:
  - Falsifiability requirement with good/bad examples
  - Experimental design framework (7-step: prediction, setup, measurement, criteria, run, observe, conclude)
  - Evidence quality assessment (strong vs weak evidence)
  - Decision point criteria (4 conditions before acting)
  - Recovery from wrong hypotheses (5 steps)
  - Multiple hypotheses strategy with a JavaScript code example showing how one experiment can differentiate 4 hypotheses
- **`<investigation_techniques>`**: Seven techniques documented in detail:
  1. Binary Search / Divide and Conquer
  2. Rubber Duck Debugging
  3. Minimal Reproduction
  4. Working Backwards
  5. Differential Debugging
  6. Observability First
  7. Comment Out Everything / Git Bisect
  - Includes a technique selection matrix and combination guidance
- **`<verification_patterns>`**: Defines what "verified" means (5 criteria), reproduction verification, regression testing, environment verification, stability testing (with bash loops and stress test code), test-first debugging, verification checklist, red flags
- **`<research_vs_reasoning>`**: Decision tree for when to use external research vs internal code reasoning, with red flags for over-researching and over-reasoning
- **`<debug_file_protocol>`**: Defines the persistent debug session file format:
  - YAML frontmatter with status transitions: `gathering -> investigating -> fixing -> verifying -> resolved`
  - Sections: Current Focus (OVERWRITE), Symptoms (IMMUTABLE after gathering), Eliminated (APPEND only), Evidence (APPEND only), Resolution (OVERWRITE)
  - Critical rule: "Update the file BEFORE taking action, not after"
  - Resume behavior protocol for post-/clear continuation
- **`<execution_flow>`**: Six steps: check_active_session, create_debug_file, symptom_gathering, investigation_loop, resume_from_file, return_diagnosis, fix_and_verify, archive_session
- **`<checkpoint_behavior>`**: Three checkpoint types (human-verify, human-action, decision) with note: "You will NOT be resumed" after checkpoint
- **`<structured_returns>`**: Four return formats: ROOT CAUSE FOUND, DEBUG COMPLETE, INVESTIGATION INCONCLUSIVE, CHECKPOINT REACHED
- **`<modes>`**: Three operating modes controlled by flags:
  - `symptoms_prefilled: true` -- skip gathering, start investigating
  - `goal: find_root_cause_only` -- diagnose but don't fix
  - `goal: find_and_fix` (default) -- full cycle
- **`<success_criteria>`**: 9-item checklist

### Notable Prompt Engineering Techniques

1. **File-as-brain pattern** -- The debug session file IS the agent's persistent memory, designed to survive context resets
2. **Cognitive bias awareness** -- Explicitly names biases and provides antidotes
3. **Scientific method framing** -- Structures debugging as hypothesis testing with falsifiability requirements
4. **Meta-debugging awareness** -- Addresses the unique challenge of Claude debugging its own code
5. **Mode flags** -- Runtime behavior modification through prompt-level flags
6. **Immutable vs append-only vs overwrite sections** -- Different update rules for different parts of the debug file prevent data loss

---

## gsd-executor

### Frontmatter

```yaml
name: gsd-executor
description: Executes GSD plans with atomic commits, deviation handling, checkpoint protocols, and state management. Spawned by execute-phase orchestrator or execute-plan command.
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
```

### Role and Purpose

The implementation workhorse of GSD. Executes PLAN.md files atomically -- one task at a time, one commit per task, with deviation handling, checkpoint pausing, and SUMMARY.md generation. This is the agent that actually writes code and modifies the project.

### Spawning Command

- `/gsd:execute-phase` orchestrator

### Tools Allowed

Read, Write, Edit, Bash, Grep, Glob

### Files Read

- `.planning/phases/XX-name/{phase}-{NN}-PLAN.md` (the plan to execute)
- `.planning/STATE.md` (project state)
- `.planning/ROADMAP.md` (context)
- `.planning/PROJECT.md` (context)
- `.planning/codebase/*.md` (conventions, structure, etc.)
- `~/.claude/get-shit-done/workflows/execute-plan.md` (execution workflow reference)
- `~/.claude/get-shit-done/templates/summary.md` (summary template)
- `~/.claude/get-shit-done/references/checkpoints.md` (checkpoint patterns)
- Prior plan SUMMARY.md files (when needed for context)

### Files Written

- Source code files (the actual implementation)
- `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` (execution summary with frontmatter)
- `.planning/STATE.md` (updated via gsd-tools.js)
- Git commits (one per task, plus final metadata commit)

### Agent Interactions

- **Upstream**: Receives PLAN.md files created by `gsd-planner`
- **Downstream**: SUMMARY.md consumed by `gsd-verifier` and `gsd-integration-checker`

### Key Prompt Sections

- **`<role>`**: Core job: execute plan completely, commit each task, create SUMMARY.md, update STATE.md
- **`<execution_flow>`**: Five steps:
  1. `load_project_state` -- calls `gsd-tools.js init execute-phase` to get context
  2. `load_plan` -- parses plan frontmatter and tasks
  3. `record_start_time` -- captures timing for metrics
  4. `determine_execution_pattern` -- Pattern A (autonomous), Pattern B (has checkpoints), Pattern C (continuation after checkpoint)
  5. `execute_tasks` -- iterates through tasks by type (auto, checkpoint, TDD)
- **`<deviation_rules>`**: Four rules for handling unexpected work during execution:
  - **Rule 1**: Auto-fix bugs (no permission needed)
  - **Rule 2**: Auto-add missing critical functionality (no permission needed)
  - **Rule 3**: Auto-fix blocking issues (no permission needed)
  - **Rule 4**: Ask about architectural changes (STOP, return checkpoint)
  - Priority order and edge cases documented
- **`<authentication_gates>`**: Auth errors during execution treated as gates (not failures) -- agent recognizes auth indicators, stops, returns checkpoint with exact auth steps
- **`<checkpoint_protocol>`**: Three checkpoint types with frequency estimates: human-verify (90%), decision (9%), human-action (1%). Critical rule: "STOP immediately" when encountering checkpoint.
- **`<checkpoint_return_format>`**: Structured markdown format with completed tasks table, current task status, checkpoint details
- **`<continuation_handling>`**: Protocol for when spawned as continuation agent after checkpoint -- verify previous commits, don't redo completed tasks, handle based on checkpoint type
- **`<tdd_execution>`**: RED-GREEN-REFACTOR cycle implementation with specific commit message formats per phase
- **`<task_commit_protocol>`**: Git commit protocol -- stage files individually (NEVER `git add .`), commit type table (feat/fix/test/refactor/chore), message format with scope
- **`<summary_creation>`**: SUMMARY.md creation with frontmatter including dependency graph, tech-stack, key-files, decisions, metrics. Requires substantive one-liners (not generic "Authentication implemented")
- **`<self_check>`**: Post-summary verification: check created files exist, check commits exist, append pass/fail result to SUMMARY.md. "Do NOT skip. Do NOT proceed to state updates if self-check fails."
- **`<state_updates>`**: Uses gsd-tools.js commands: `state advance-plan`, `state update-progress`, `state record-metric`, `state add-decision`, `state record-session`
- **`<final_commit>`**: Separate commit for execution metadata (SUMMARY.md, STATE.md)
- **`<completion_format>`**: Structured `## PLAN COMPLETE` return with plan, tasks, summary path, commits, duration
- **`<success_criteria>`**: 8-item checklist

### Notable Prompt Engineering Techniques

1. **Deviation rules as autonomous decision framework** -- The 4-rule system gives the executor clear authority to make inline fixes without asking, while still escalating architectural decisions
2. **Three execution patterns** -- Handles fully autonomous, checkpoint-interrupted, and continuation scenarios
3. **Self-check as quality gate** -- The agent verifies its own claims before proceeding
4. **Commit discipline** -- Per-task atomic commits with explicit prohibition of `git add .`
5. **Auth gate recognition** -- Pattern matching on error messages (401, 403, "Not authenticated", etc.) to distinguish auth issues from bugs

---

## gsd-integration-checker

### Frontmatter

```yaml
name: gsd-integration-checker
description: Verifies cross-phase integration and E2E flows. Checks that phases connect properly and user workflows complete end-to-end.
tools: Read, Bash, Grep, Glob
color: blue
```

### Role and Purpose

Verifies that phases work together as a system, not just individually. Focuses on connections rather than existence -- "Existence does not equal Integration." Checks export/import wiring, API route consumption, auth protection, and end-to-end user flows.

### Spawning Command

- `/gsd:complete-milestone` orchestrator (milestone auditor spawns this agent)

### Tools Allowed

Read, Bash, Grep, Glob

### Files Read

- `.planning/phases/*/*-SUMMARY.md` (all summaries across phases)
- Source code in `src/` (checking imports, exports, API calls, component wiring)
- API routes (checking for consumers)

### Files Written

None -- returns structured report to the milestone auditor orchestrator.

### Agent Interactions

- **Upstream**: Receives phase information and codebase structure from the milestone auditor
- **Downstream**: Returns structured integration report to the orchestrator for milestone completion

### Key Prompt Sections

- **`<role>`**: "Individual phases can pass while the system fails"
- **`<core_principle>`**: "Existence does not equal Integration" -- checks four types of connections: Exports->Imports, APIs->Consumers, Forms->Handlers, Data->Display
- **`<inputs>`**: Documents required context from milestone auditor (phase directories, key exports, file locations, expected connections)
- **`<verification_process>`**: Six-step process:
  1. **Build Export/Import Map** -- extract provides/consumes from SUMMARYs
  2. **Verify Export Usage** -- bash function `check_export_used()` that checks imports AND usage (not just import statements)
  3. **Verify API Coverage** -- finds all API routes, checks each has consumers via `check_api_consumed()`
  4. **Verify Auth Protection** -- finds protected route indicators, checks for auth hooks/redirect
  5. **Verify E2E Flows** -- three complete bash verification functions for Auth Flow, Data Flow, Form Flow with step-by-step tracing
  6. **Compile Integration Report** -- YAML-structured output with wiring status (connected, orphaned, missing) and flow status (complete, broken with break point)
- **`<output>`**: Structured report format with sections: Wiring Summary, API Coverage, Auth Protection, E2E Flows, Detailed Findings
- **`<critical_rules>`**: Five rules emphasizing connections over existence, full path tracing, both-direction checking, specific break descriptions, structured data format
- **`<success_criteria>`**: 9-item checklist

### Notable Prompt Engineering Techniques

1. **Concrete bash functions as verification tools** -- The prompt includes complete, runnable bash functions that the agent uses as verification primitives
2. **Three-state classification** -- CONNECTED, IMPORTED_NOT_USED, ORPHANED for exports; CONSUMED/ORPHANED for API routes; PROTECTED/UNPROTECTED for auth
3. **YAML-structured output** -- Uses YAML for machine-parseable findings (wiring status, flow status) that the orchestrator can aggregate
4. **Flow-tracing methodology** -- Step-by-step tracing through complete user flows (form -> API -> DB -> response -> display)

---

## gsd-phase-researcher

### Frontmatter

```yaml
name: gsd-phase-researcher
description: Researches how to implement a phase before planning. Produces RESEARCH.md consumed by gsd-planner. Spawned by /gsd:plan-phase orchestrator.
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
color: cyan
```

### Role and Purpose

Answers "What do I need to know to PLAN this phase well?" by investigating the phase's technical domain and producing a single RESEARCH.md. This is the phase-level researcher (as opposed to gsd-project-researcher which operates at project level). It is tightly coupled with gsd-planner through its output format.

### Spawning Commands

- `/gsd:plan-phase` (integrated, when research is needed)
- `/gsd:research-phase` (standalone)

### Tools Allowed

Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__* (Context7 MCP tools)

### Files Read

- `.planning/phases/XX-name/*-CONTEXT.md` (user decisions from `/gsd:discuss-phase`)
- `.planning/ROADMAP.md`, `.planning/STATE.md` (project context)

### Files Written

- `.planning/phases/XX-name/{phase}-RESEARCH.md`

### Agent Interactions

- **Upstream**: Reads CONTEXT.md produced by `/gsd:discuss-phase` command
- **Downstream**: RESEARCH.md is consumed directly by `gsd-planner`

### Key Prompt Sections

- **`<role>`**: Core responsibilities include confidence level tracking (HIGH/MEDIUM/LOW) and returning structured results
- **`<upstream_input>`**: Explicit documentation of how CONTEXT.md constrains research scope -- locked decisions are researched deeply (not alternatives), deferred ideas are ignored
- **`<downstream_consumer>`**: Table showing exactly how each RESEARCH.md section is consumed by the planner. Critical rule: "`## User Constraints` MUST be the FIRST content section."
- **`<philosophy>`**: Three principles:
  - "Claude's Training as Hypothesis" -- training data is 6-18 months stale, treat as hypothesis not fact
  - "Honest Reporting" -- "I couldn't find X" is valuable
  - "Research is Investigation, Not Confirmation"
- **`<tool_strategy>`**: Priority order: Context7 (1st, HIGH trust), WebFetch (2nd, HIGH-MEDIUM), WebSearch (3rd, needs verification). Includes enhanced Brave Search API integration via `gsd-tools.js websearch` command. Verification protocol: Context7 = HIGH, verified with official docs = MEDIUM, unverified = LOW.
- **`<source_hierarchy>`**: Formal five-level source priority ranking
- **`<verification_protocol>`**: Four known pitfalls: Configuration Scope Blindness, Deprecated Features, Negative Claims Without Evidence, Single Source Reliance. Pre-submission checklist of 7 items.
- **`<output_format>`**: Complete RESEARCH.md template with sections: Summary, Standard Stack (tables), Architecture Patterns (with code examples), Don't Hand-Roll (table), Common Pitfalls, Code Examples, State of the Art, Open Questions, Sources (by confidence level), Metadata
- **`<execution_flow>`**: Seven steps: receive scope, identify domains, execute research protocol, quality check, write RESEARCH.md, commit, return structured result
- **`<structured_returns>`**: Two formats: RESEARCH COMPLETE (with confidence assessment table), RESEARCH BLOCKED
- **`<success_criteria>`**: 11-item checklist plus quality indicators

### Notable Prompt Engineering Techniques

1. **Explicit upstream/downstream documentation** -- Tables showing exactly how input is consumed and how output is used by the next agent
2. **Three-tier confidence system** -- HIGH/MEDIUM/LOW with specific criteria for each level
3. **"Training as Hypothesis" framing** -- Directly addresses the LLM knowledge staleness problem
4. **Tool priority ordering** -- Context7 > Official Docs > WebSearch, with escalation path
5. **"Be prescriptive, not exploratory"** -- "Use X" not "Consider X or Y"

---

## gsd-plan-checker

### Frontmatter

```yaml
name: gsd-plan-checker
description: Verifies plans will achieve phase goal before execution. Goal-backward analysis of plan quality. Spawned by /gsd:plan-phase orchestrator.
tools: Read, Bash, Glob, Grep
color: green
```

### Role and Purpose

A pre-execution quality gate that verifies plans WILL achieve the phase goal (as opposed to gsd-verifier which checks that code DID achieve the goal post-execution). Uses goal-backward analysis: starts from what the phase should deliver, then verifies plans address it. Does NOT run the application or check code -- it performs static plan analysis only.

### Spawning Command

- `/gsd:plan-phase` orchestrator (after planner creates PLAN.md files, or after planner revises)

### Tools Allowed

Read, Bash, Glob, Grep

### Files Read

- `.planning/phases/XX-name/{phase}-{NN}-PLAN.md` (all plan files in phase)
- `.planning/ROADMAP.md` (phase goal extraction)
- `.planning/phases/XX-name/*-CONTEXT.md` (user decisions, if exists)
- `.planning/phases/XX-name/*-BRIEF.md` (if exists)

### Files Written

None -- returns structured result to orchestrator.

### Agent Interactions

- **Upstream**: Receives PLAN.md files from `gsd-planner`
- **Downstream**: Returns VERIFICATION PASSED or ISSUES FOUND to orchestrator, which may trigger `gsd-planner` revision mode

### Key Prompt Sections

- **`<role>`**: "Plans describe intent. You verify they deliver." Lists six ways plans can look complete but miss the goal.
- **`<upstream_input>`**: How CONTEXT.md sections constrain verification -- locked decisions must be implemented exactly, deferred ideas must be excluded
- **`<core_principle>`**: "Plan completeness does not equal Goal achievement" -- goal-backward verification working backwards from outcome. Distinguishes itself from gsd-verifier: "Same methodology (goal-backward), different timing, different subject matter."
- **`<verification_dimensions>`**: Seven verification dimensions:
  1. **Requirement Coverage** -- every phase requirement has task(s)
  2. **Task Completeness** -- every task has Files + Action + Verify + Done
  3. **Dependency Correctness** -- valid acyclic dependency graph
  4. **Key Links Planned** -- artifacts wired together, not just created in isolation
  5. **Scope Sanity** -- plans fit within context budget (2-3 tasks target, 4 warning, 5+ blocker)
  6. **Verification Derivation** -- must_haves trace back to phase goal, truths are user-observable
  7. **Context Compliance** (conditional on CONTEXT.md existing) -- plans honor locked decisions, exclude deferred ideas
  - Each dimension includes process steps, red flags, and example issue in YAML format
- **`<verification_process>`**: Ten-step process using gsd-tools.js commands (`verify plan-structure`, `frontmatter get`, `roadmap get-phase`) with specific bash commands at each step
- **`<examples>`**: Detailed scope-exceeded example (most common miss) showing a 5-task, 12-file plan with analysis and YAML issue
- **`<issue_structure>`**: Formal issue format with fields: plan, dimension, severity, description, task, fix_hint. Three severity levels: blocker (must fix), warning (should fix), info (suggestions)
- **`<structured_returns>`**: Two formats: VERIFICATION PASSED (with coverage and plan summary tables), ISSUES FOUND (with blockers, warnings, structured YAML issues, recommendation)
- **`<anti_patterns>`**: Seven anti-patterns including "DO NOT check code existence" (that's verifier's job), "DO NOT run the application", "DO NOT trust task names alone"
- **`<success_criteria>`**: 13-item checklist

### Notable Prompt Engineering Techniques

1. **Seven orthogonal verification dimensions** -- Comprehensive coverage of plan quality from multiple angles
2. **YAML-structured issues** -- Machine-parseable issue format that can be fed back to the planner
3. **Severity levels with clear criteria** -- blocker/warning/info with specific conditions for each
4. **Explicit anti-patterns** -- Seven "DO NOT" rules that prevent common checker mistakes
5. **Distinction from verifier** -- Explicitly clarifies its role vs. post-execution verification

---

## gsd-planner

### Frontmatter

```yaml
name: gsd-planner
description: Creates executable phase plans with task breakdown, dependency analysis, and goal-backward verification. Spawned by /gsd:plan-phase orchestrator.
tools: Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*
color: green
```

### Role and Purpose

The core planning agent. Creates PLAN.md files that serve as executable prompts for the executor. Handles three modes: standard planning, gap closure planning (from verification failures), and revision planning (from checker feedback). Manages dependency graphs, wave assignment for parallelism, and goal-backward must-haves derivation.

This is the **largest and most complex agent** in the system (~1150 lines).

### Spawning Commands

- `/gsd:plan-phase` (standard phase planning)
- `/gsd:plan-phase --gaps` (gap closure from verification failures)
- `/gsd:plan-phase` revision mode (updating plans based on checker feedback)

### Tools Allowed

Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*

### Files Read

- `.planning/STATE.md` (project state, decisions, blockers)
- `.planning/ROADMAP.md` (phase goals)
- `.planning/phases/XX-name/*-CONTEXT.md` (user decisions from discuss-phase)
- `.planning/phases/XX-name/*-RESEARCH.md` (from phase-researcher)
- `.planning/phases/XX-name/*-DISCOVERY.md` (from discovery)
- `.planning/phases/XX-name/*-VERIFICATION.md` (for gap closure mode)
- `.planning/phases/XX-name/*-UAT.md` (for gap closure mode)
- `.planning/phases/*/*-SUMMARY.md` (prior phase summaries for context)
- `.planning/codebase/*.md` (codebase analysis docs, loaded by phase type)
- `.planning/REQUIREMENTS.md`
- `~/.claude/get-shit-done/templates/summary.md`

### Files Written

- `.planning/phases/XX-name/{phase}-{NN}-PLAN.md` (one or more plan files)
- `.planning/ROADMAP.md` (updated with plan details)

### Agent Interactions

- **Upstream**: Reads CONTEXT.md (from discuss-phase), RESEARCH.md (from phase-researcher), VERIFICATION.md (from verifier, in gap mode), checker feedback (in revision mode), codebase docs (from codebase-mapper)
- **Downstream**: PLAN.md files consumed by `gsd-plan-checker` for validation, then by `gsd-executor` for implementation

### Key Prompt Sections

- **`<role>`**: Defines three operating modes and core principle: "Plans are prompts, not documents that become prompts"
- **`<context_fidelity>`**: CRITICAL section on honoring user decisions. Three rules: locked decisions MUST be implemented exactly, deferred ideas MUST NOT appear, Claude's discretion areas use best judgment. Self-check protocol before returning. Conflict resolution: honor user's locked decision, note in task action.
- **`<philosophy>`**: Four principles:
  - Solo Developer + Claude workflow (no teams, no ceremonies)
  - Plans are prompts (objective, context, tasks, criteria)
  - Quality degradation curve (table showing quality drops at context usage thresholds)
  - Ship fast (anti-enterprise patterns to delete)
- **`<discovery_levels>`**: Four levels (0-3) of mandatory pre-planning discovery:
  - Level 0: Skip (internal work, existing patterns)
  - Level 1: Quick verification (2-5 min, Context7 check)
  - Level 2: Standard research (15-30 min, produces DISCOVERY.md)
  - Level 3: Deep dive (1+ hour, full research)
- **`<task_breakdown>`**: Comprehensive task anatomy:
  - Four required fields: `<files>`, `<action>`, `<verify>`, `<done>` with good/bad examples
  - Task types: auto, checkpoint:human-verify, checkpoint:decision, checkpoint:human-action
  - Task sizing: 15-60 min Claude execution time
  - Specificity examples table (TOO VAGUE vs JUST RIGHT)
  - TDD detection heuristic
  - User setup detection for external services
- **`<dependency_graph>`**: Building dependency graphs with needs/creates/has_checkpoint per task. Includes example with 6 tasks showing graph and wave analysis. Emphasizes vertical slices (PREFER) over horizontal layers (AVOID). File ownership rules for parallel execution.
- **`<scope_estimation>`**: Context budget rules (target ~50%), tasks per plan (2-3 max), split signals, depth calibration table, context per task estimates by file count and complexity
- **`<plan_format>`**: Complete PLAN.md template with all frontmatter fields (phase, plan, type, wave, depends_on, files_modified, autonomous, user_setup, must_haves), XML task structure, context section rules
- **`<goal_backward>`**: Full goal-backward methodology:
  - Five steps: state the goal, derive observable truths, derive artifacts, derive wiring, identify key links
  - Must-haves output format in YAML (truths, artifacts with path/provides/min_lines, key_links with from/to/via/pattern)
  - Common failures with examples
- **`<checkpoints>`**: Checkpoint type documentation with frequency estimates, XML templates for each type, authentication gates, writing guidelines, anti-patterns (bad examples + good examples)
- **`<tdd_integration>`**: TDD plan structure, RED-GREEN-REFACTOR cycle, context budget (40% for TDD, lower than standard 50%)
- **`<gap_closure_mode>`**: Planning from verification/UAT gaps -- find sources, parse gaps, load summaries, find next plan number, group gaps, create gap closure tasks, write PLAN.md with `gap_closure: true` flag
- **`<revision_mode>`**: Planning from checker feedback -- "Surgeon, not architect. Minimal changes for specific issues." Parse checker issues, apply strategy by dimension, make targeted updates, validate, commit, return summary
- **`<execution_flow>`**: 13 steps covering both standard and revision modes, including `load_project_state`, `load_codebase_context`, `read_project_history` (two-step: digest for selection, full read for understanding), `gather_phase_context`, task breakdown, dependency graph, wave assignment, plan grouping, must-haves derivation, scope estimation, validation, roadmap update, git commit
- **`<structured_returns>`**: Three formats: PLANNING COMPLETE (with wave structure table), GAP CLOSURE PLANS CREATED, REVISION COMPLETE
- **`<success_criteria>`**: Separate checklists for Standard Mode (14 items) and Gap Closure Mode (8 items)

### Notable Prompt Engineering Techniques

1. **Three operating modes in one agent** -- Standard, gap closure, and revision modes share infrastructure but have distinct flows
2. **Context fidelity enforcement** -- Self-check protocol for user decision compliance before returning
3. **Quality degradation curve** -- Quantified context budget awareness driving scope decisions
4. **"Plans are prompts" philosophy** -- Plans are designed to be directly consumable by the executor agent without interpretation
5. **History digest pattern** -- Two-step context assembly (digest index for selection, full read for relevant phases only) to manage context budget
6. **Frontmatter validation** -- Uses gsd-tools.js to validate plan structure and frontmatter before committing
7. **Discovery levels as decision framework** -- Four-level system with clear indicators for each level

---

## gsd-project-researcher

### Frontmatter

```yaml
name: gsd-project-researcher
description: Researches domain ecosystem before roadmap creation. Produces files in .planning/research/ consumed during roadmap creation. Spawned by /gsd:new-project or /gsd:new-milestone orchestrators.
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
color: cyan
```

### Role and Purpose

Researches the project-level domain ecosystem before roadmap creation. Unlike gsd-phase-researcher (which researches a specific phase), this agent researches the entire project domain. Spawned in parallel (4 instances, one per research area) to produce research files consumed by gsd-research-synthesizer and ultimately by gsd-roadmapper.

### Spawning Commands

- `/gsd:new-project` orchestrator
- `/gsd:new-milestone` orchestrator (Phase 6: Research)

### Tools Allowed

Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*

### Files Read

- Project description/requirements provided by orchestrator

### Files Written

- `.planning/research/STACK.md` (technology recommendations)
- `.planning/research/FEATURES.md` (feature landscape)
- `.planning/research/ARCHITECTURE.md` (architecture patterns)
- `.planning/research/PITFALLS.md` (domain pitfalls)
- `.planning/research/COMPARISON.md` (comparison mode only)
- `.planning/research/FEASIBILITY.md` (feasibility mode only)

**Note**: This agent writes files but does NOT commit -- the gsd-research-synthesizer commits all research files together.

### Agent Interactions

- **Upstream**: Receives project description and scope from orchestrator
- **Downstream**: Files read by `gsd-research-synthesizer` for synthesis into SUMMARY.md

### Key Prompt Sections

- **`<role>`**: Explicitly maps each output file to how the roadmap uses it (table)
- **`<philosophy>`**: Same three principles as phase-researcher: Training Data = Hypothesis, Honest Reporting, Investigation Not Confirmation
- **`<research_modes>`**: Three modes:
  - **Ecosystem** (default) -- "What exists for X?"
  - **Feasibility** -- "Can we do X?"
  - **Comparison** -- "Compare A vs B"
- **`<tool_strategy>`**: Same three-tier priority (Context7, WebFetch, WebSearch) with Brave Search integration and verification protocol. Confidence level table (HIGH/MEDIUM/LOW).
- **`<verification_protocol>`**: Four research pitfalls (same as phase-researcher), pre-submission checklist
- **`<output_formats>`**: Complete templates for 7 possible output files:
  - **SUMMARY.md** -- executive summary with roadmap implications, confidence assessment
  - **STACK.md** -- technology stack with alternatives considered
  - **FEATURES.md** -- table stakes, differentiators, anti-features, MVP recommendation
  - **ARCHITECTURE.md** -- recommended architecture, component boundaries, patterns, scalability
  - **PITFALLS.md** -- critical/moderate/minor pitfalls, phase-specific warnings
  - **COMPARISON.md** -- comparison matrix with recommendation
  - **FEASIBILITY.md** -- YES/NO/MAYBE verdict with requirements and blockers
- **`<execution_flow>`**: Six steps: receive scope, identify domains, execute research, quality check, write files, return result. "DO NOT commit. Spawned in parallel with other researchers."
- **`<structured_returns>`**: Two formats: RESEARCH COMPLETE, RESEARCH BLOCKED
- **`<success_criteria>`**: 11-item checklist plus quality indicators ("Comprehensive not shallow. Opinionated not wishy-washy.")

### Notable Prompt Engineering Techniques

1. **Parallel spawning design** -- Four instances research different areas simultaneously; explicitly told not to commit
2. **Three research modes** -- Same agent handles ecosystem discovery, feasibility assessment, and comparison
3. **Anti-features concept** -- FEATURES.md explicitly includes features NOT to build
4. **"Opinionated not wishy-washy"** -- Explicit directive for decisive recommendations

---

## gsd-research-synthesizer

### Frontmatter

```yaml
name: gsd-research-synthesizer
description: Synthesizes research outputs from parallel researcher agents into SUMMARY.md. Spawned by /gsd:new-project after 4 researcher agents complete.
tools: Read, Write, Bash
color: purple
```

### Role and Purpose

The consolidation agent that reads outputs from 4 parallel project researcher agents and synthesizes them into a cohesive SUMMARY.md. Also responsible for committing all research files (the researchers write but don't commit). This is the bridge between research and roadmapping.

### Spawning Command

- `/gsd:new-project` orchestrator (after all 4 research agents complete)

### Tools Allowed

Read, Write, Bash (minimal tool set -- this is a synthesis agent, not an investigation agent)

### Files Read

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `~/.claude/get-shit-done/templates/research-project/SUMMARY.md` (template)

### Files Written

- `.planning/research/SUMMARY.md`
- Commits all files in `.planning/research/` (including the 4 upstream research files)

### Agent Interactions

- **Upstream**: Reads files from 4 parallel `gsd-project-researcher` instances
- **Downstream**: SUMMARY.md consumed by `gsd-roadmapper`

### Key Prompt Sections

- **`<role>`**: Lists responsibilities including the critical commit responsibility (researchers write, synthesizer commits)
- **`<downstream_consumer>`**: Table showing how roadmapper uses each SUMMARY.md section. "Be opinionated."
- **`<execution_flow>`**: Eight steps: read research files, synthesize executive summary, extract key findings, derive roadmap implications, assess confidence, write SUMMARY.md, commit all research, return summary
- **`<output_format>`**: Key sections: Executive Summary, Key Findings, Implications for Roadmap, Confidence Assessment, Sources
- **`<structured_returns>`**: Two formats: SYNTHESIS COMPLETE (with files synthesized, executive summary, roadmap implications, research flags, confidence), SYNTHESIS BLOCKED (with missing files)
- **`<success_criteria>`**: 10-item checklist plus quality indicators: "Synthesized, not concatenated", "Opinionated", "Actionable", "Honest"

### Notable Prompt Engineering Techniques

1. **Minimal tool set by design** -- Only Read, Write, Bash. This agent synthesizes, not investigates.
2. **"Synthesized, not concatenated"** -- Explicit quality indicator that findings must be integrated, not just copied
3. **Commit responsibility delegation** -- Centralizes git commits for all research files in one agent
4. **Phase suggestion with research flags** -- Output explicitly flags which future phases need deeper research vs. standard patterns

---

## gsd-roadmapper

### Frontmatter

```yaml
name: gsd-roadmapper
description: Creates project roadmaps with phase breakdown, requirement mapping, success criteria derivation, and coverage validation. Spawned by /gsd:new-project orchestrator.
tools: Read, Write, Bash, Glob, Grep
color: purple
```

### Role and Purpose

Transforms requirements into a phase structure that delivers the project. Every v1 requirement must map to exactly one phase. Every phase gets observable success criteria via goal-backward methodology. Also initializes STATE.md (project memory).

### Spawning Command

- `/gsd:new-project` orchestrator

### Tools Allowed

Read, Write, Bash, Glob, Grep

### Files Read

- `.planning/PROJECT.md` (core value, constraints)
- `.planning/REQUIREMENTS.md` (v1 requirements with REQ-IDs)
- `.planning/research/SUMMARY.md` (research context, phase suggestions)
- `config.json` (depth setting)
- `~/.claude/get-shit-done/templates/roadmap.md` (template)
- `~/.claude/get-shit-done/templates/state.md` (template)

### Files Written

- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/REQUIREMENTS.md` (updated with traceability section)

### Agent Interactions

- **Upstream**: Receives SUMMARY.md from `gsd-research-synthesizer`
- **Downstream**: ROADMAP.md and STATE.md consumed by `gsd-planner`, `gsd-verifier`, `gsd-plan-checker`, and all orchestrator commands

### Key Prompt Sections

- **`<role>`**: Core responsibilities include 100% requirement coverage validation and goal-backward success criteria
- **`<downstream_consumer>`**: Table showing how plan-phase uses roadmap outputs
- **`<philosophy>`**: Five principles:
  - Solo Developer + Claude workflow
  - Anti-Enterprise (NEVER include phases for team coordination, sprint ceremonies, etc.)
  - Requirements drive structure (derive phases from requirements, don't impose)
  - Goal-backward at phase level
  - Coverage is non-negotiable
- **`<goal_backward_phases>`**: Deriving phase success criteria:
  - Four steps: state goal, derive observable truths (2-5 per phase), cross-check against requirements, resolve gaps
  - Gap resolution example showing how a "password reset" success criterion with no supporting requirement creates an actionable gap
- **`<phase_identification>`**: Four-step process: group by category, identify dependencies, create delivery boundaries (good vs bad), assign requirements. Phase numbering (integers for planned, decimals for insertions). Depth calibration table (Quick 3-5, Standard 5-8, Comprehensive 8-12). Good phase patterns (Foundation->Features->Enhancement, Vertical Slices) vs anti-pattern (Horizontal Layers).
- **`<coverage_validation>`**: 100% requirement coverage protocol. Build coverage map, handle orphaned requirements (create phase, add to existing, or defer to v2). "Do not proceed until coverage = 100%." Traceability update format for REQUIREMENTS.md.
- **`<output_formats>`**: ROADMAP.md structure (from template), STATE.md structure (from template), draft presentation format for user approval
- **`<execution_flow>`**: Nine steps: receive context, extract requirements, load research, identify phases, derive success criteria, validate coverage, write files immediately ("Files on disk = context preserved"), return summary, handle revision
- **`<structured_returns>`**: Three formats: ROADMAP CREATED, ROADMAP REVISED, ROADMAP BLOCKED
- **`<anti_patterns>`**: Six anti-patterns including "Don't impose arbitrary structure", "Don't use horizontal layers", "Don't skip coverage validation", "Don't add project management artifacts"
- **`<success_criteria>`**: 16-item checklist plus quality indicators

### Notable Prompt Engineering Techniques

1. **100% coverage as hard requirement** -- "Do not proceed until coverage = 100%" with explicit orphan handling
2. **Anti-enterprise stance** -- Aggressive filtering of PM theater patterns
3. **Write files immediately** -- "Write files first, then return. This ensures artifacts persist even if context is lost."
4. **Draft presentation for user approval** -- Roadmap is presented as draft, not finalized unilaterally
5. **Depth calibration** -- Config-driven compression guidance (Quick/Standard/Comprehensive)

---

## gsd-verifier

### Frontmatter

```yaml
name: gsd-verifier
description: Verifies phase goal achievement through goal-backward analysis. Checks codebase delivers what phase promised, not just that tasks completed. Creates VERIFICATION.md report.
tools: Read, Bash, Grep, Glob
color: green
```

### Role and Purpose

Post-execution verification agent that checks whether a phase actually achieved its goal, not just completed its tasks. Uses the same goal-backward methodology as the plan-checker but applied to the actual codebase rather than plans. Creates VERIFICATION.md with structured gap data that can feed back into the planner for gap closure.

### Spawning Command

- `/gsd:verify-work` orchestrator

### Tools Allowed

Read, Bash, Grep, Glob

### Files Read

- `.planning/phases/XX-name/{phase}-{NN}-PLAN.md` (plan files with must_haves)
- `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` (execution summaries)
- `.planning/ROADMAP.md` (phase goal)
- `.planning/REQUIREMENTS.md` (requirements mapped to phase)
- `.planning/phases/XX-name/{phase}-VERIFICATION.md` (previous verification, for re-verification mode)
- Source code files in the project (the actual verification targets)

### Files Written

- `.planning/phases/XX-name/{phase}-VERIFICATION.md`

**Note**: Does NOT commit. The orchestrator handles commits.

### Agent Interactions

- **Upstream**: Receives SUMMARY.md files from `gsd-executor`
- **Downstream**: VERIFICATION.md (with gaps in YAML frontmatter) consumed by `gsd-planner` in gap closure mode via `/gsd:plan-phase --gaps`

### Key Prompt Sections

- **`<role>`**: "Do NOT trust SUMMARY.md claims. SUMMARYs document what Claude SAID it did. You verify what ACTUALLY exists in the code. These often differ."
- **`<core_principle>`**: "Task completion does not equal Goal achievement" -- a component can be a placeholder but the task marked complete. Three-level backwards analysis: truths, artifacts, wiring.
- **`<verification_process>`**: Ten-step process:
  1. **Check for Previous Verification** -- re-verification mode focuses on failed items with quick regression check on passed items
  2. **Load Context** (initial mode only) -- plan files, summaries, roadmap phase goal
  3. **Establish Must-Haves** -- Option A: extract from PLAN frontmatter, Option B: derive from phase goal
  4. **Verify Observable Truths** -- status: VERIFIED, FAILED, UNCERTAIN
  5. **Verify Artifacts (Three Levels)** -- uses `gsd-tools.js verify artifacts` for Level 1-2, manual grep for Level 3:
     - Level 1: EXISTS (file present)
     - Level 2: SUBSTANTIVE (not a stub, has min_lines, contains expected patterns)
     - Level 3: WIRED (imported AND used by other code)
     - Final status matrix: VERIFIED, ORPHANED, STUB, MISSING
  6. **Verify Key Links** -- uses `gsd-tools.js verify key-links` with fallback grep patterns for Component->API, API->Database, Form->Handler, State->Render
  7. **Check Requirements Coverage** -- each requirement parsed against supporting truths
  8. **Scan for Anti-Patterns** -- TODO/FIXME/placeholder comments, empty implementations, console.log-only implementations
  9. **Identify Human Verification Needs** -- visual appearance, user flows, real-time behavior, external services
  10. **Determine Overall Status** -- passed, gaps_found, human_needed with score calculation
- **`<output>`**: VERIFICATION.md format with extensive YAML frontmatter (status, score, re_verification metadata, gaps with truth/status/reason/artifacts/missing, human_verification items). Structured return to orchestrator.
- **`<critical_rules>`**: Seven rules including "DO NOT trust SUMMARY claims", "DO NOT assume existence = implementation", "DO NOT skip key link verification"
- **`<stub_detection_patterns>`**: Comprehensive examples of stubs in React components, API routes, and wiring red flags with actual code patterns
- **`<success_criteria>`**: 13-item checklist

### Notable Prompt Engineering Techniques

1. **Distrust of self-reported results** -- The verifier explicitly distrusts SUMMARY.md (which Claude wrote) and verifies against actual code
2. **Three-level artifact verification** -- EXISTS -> SUBSTANTIVE -> WIRED progression catches stubs and orphaned code
3. **Re-verification mode** -- Previous VERIFICATION.md drives focused re-checks on failed items with regression checks on passed items
4. **YAML frontmatter gaps** -- Structured gap data in frontmatter feeds directly into planner's gap closure mode
5. **Stub detection patterns** -- Concrete code examples of what stubs look like in React, API routes, and wiring

---

## Common Patterns Across Agents

### XML Tag Structure

All agents use XML tags extensively for prompt organization. Common tags across agents:

| Tag | Purpose | Used By |
|-----|---------|---------|
| `<role>` | Agent identity, responsibilities, spawning context | All 11 agents |
| `<philosophy>` | Design principles and mindset guidance | 7 agents |
| `<execution_flow>` | Step-by-step process with `<step>` sub-tags | 9 agents |
| `<success_criteria>` | Checklist of completion requirements | All 11 agents |
| `<structured_returns>` | Formal output format templates | 9 agents |
| `<critical_rules>` | Hard constraints and prohibitions | 4 agents |
| `<anti_patterns>` | What NOT to do | 3 agents |
| `<process>` | Process steps (alternative to execution_flow) | 1 agent |
| `<output>` | Output format specification | 4 agents |

### Frontmatter Conventions

All agents use identical YAML frontmatter structure:

```yaml
name: gsd-{agent-name}
description: {one-line description including spawning context}
tools: {comma-separated tool list}
color: {terminal color}
```

**Color assignments**:
- **cyan**: Research agents (codebase-mapper, phase-researcher, project-researcher)
- **green**: Planning/verification agents (planner, plan-checker, verifier)
- **purple**: Synthesis/roadmap agents (research-synthesizer, roadmapper)
- **yellow**: Executor
- **orange**: Debugger
- **blue**: Integration checker

**Tool patterns**:
- Research agents get `WebSearch`, `WebFetch`, `mcp__context7__*`
- Execution/editing agents get `Edit`
- Read-only verification agents omit `Write` and `Edit`
- The debugger gets `WebSearch` (for error message research) but not `WebFetch` or `mcp__context7__*`

### Shared Prompt Engineering Techniques

1. **Goal-backward methodology** -- Used by planner, plan-checker, verifier, and roadmapper. Always starts from "What must be TRUE?" rather than "What should we do?"

2. **Structured returns** -- Almost all agents return formatted markdown with consistent headers (e.g., `## PLANNING COMPLETE`, `## VERIFICATION PASSED`, `## RESEARCH COMPLETE`). These headers act as machine-parseable signals for orchestrators.

3. **Upstream/downstream documentation** -- Multiple agents include explicit tables showing how their input is consumed and how their output feeds downstream agents. This creates self-documenting data flow.

4. **Confidence levels** -- Research agents use HIGH/MEDIUM/LOW confidence with specific criteria. This propagates through the chain from researcher to synthesizer to roadmapper.

5. **Anti-enterprise stance** -- Multiple agents explicitly reject PM theater: no team coordination, no sprint ceremonies, no stakeholder management, no time estimates in human-hours.

6. **"File paths are critical"** -- Multiple agents emphasize using actual file paths (`src/services/user.ts`) rather than vague descriptions ("the user service").

7. **Checklist-based success criteria** -- All agents end with `- [ ]` checklists that serve as self-verification for the agent.

8. **Context budget awareness** -- Planner and plan-checker are explicitly aware of context window limits and plan around the ~50% target.

9. **gsd-tools.js as shared infrastructure** -- Multiple agents use gsd-tools.js commands for state management, frontmatter operations, verification, and commits rather than implementing these operations inline.

10. **"Write first, then return" pattern** -- Multiple agents are instructed to write files to disk before returning, ensuring artifacts survive context resets.

### Shared Philosophical Principles

- **"Plans are prompts"** -- PLAN.md files are designed to be directly consumable by the executor without interpretation
- **"Training data is hypothesis"** -- Research agents treat Claude's built-in knowledge as potentially stale
- **"Existence does not equal implementation"** -- Both verifier and integration-checker enforce multi-level verification beyond mere file existence
- **"Be prescriptive, not descriptive"** -- Output should tell downstream agents what to DO, not just what EXISTS

---

## Cross-References

### Agents to Commands (Spawning Relationships)

| Command | Agent(s) Spawned |
|---------|-----------------|
| `/gsd:new-project` | gsd-project-researcher (x4), gsd-research-synthesizer, gsd-roadmapper |
| `/gsd:new-milestone` | gsd-project-researcher |
| `/gsd:map-codebase` | gsd-codebase-mapper (x4) |
| `/gsd:plan-phase` | gsd-phase-researcher (optional), gsd-planner, gsd-plan-checker |
| `/gsd:research-phase` | gsd-phase-researcher |
| `/gsd:execute-phase` | gsd-executor |
| `/gsd:verify-work` | gsd-verifier |
| `/gsd:complete-milestone` | gsd-integration-checker |
| `/gsd:debug` | gsd-debugger |

### Agents to Workflows

| Agent | Workflows Referenced |
|-------|---------------------|
| gsd-executor | `~/.claude/get-shit-done/workflows/execute-plan.md` |
| gsd-executor | `~/.claude/get-shit-done/references/checkpoints.md` |

### Agents to Templates

| Agent | Templates Referenced |
|-------|---------------------|
| gsd-executor | `~/.claude/get-shit-done/templates/summary.md` |
| gsd-research-synthesizer | `~/.claude/get-shit-done/templates/research-project/SUMMARY.md` |
| gsd-roadmapper | `~/.claude/get-shit-done/templates/roadmap.md`, `~/.claude/get-shit-done/templates/state.md` |
| gsd-codebase-mapper | (templates embedded in agent prompt, not external files) |

### Agents to gsd-tools.js Commands

| Agent | gsd-tools.js Commands Used |
|-------|--------------------------|
| gsd-executor | `init execute-phase`, `state advance-plan`, `state update-progress`, `state record-metric`, `state add-decision`, `state record-session`, `state add-blocker`, `commit` |
| gsd-planner | `init plan-phase`, `history-digest`, `frontmatter validate`, `verify plan-structure`, `commit` |
| gsd-plan-checker | `init phase-op`, `verify plan-structure`, `frontmatter get`, `roadmap get-phase` |
| gsd-phase-researcher | `init phase-op`, `commit`, `websearch` (Brave) |
| gsd-project-researcher | `websearch` (Brave) |
| gsd-research-synthesizer | `commit` |
| gsd-verifier | `roadmap get-phase`, `verify artifacts`, `verify key-links`, `verify commits`, `summary-extract` |
| gsd-debugger | `state load`, `commit` |

### Key File Artifacts in the Data Flow

```
.planning/
  PROJECT.md          -- created by new-project, read by roadmapper
  REQUIREMENTS.md     -- created by new-project, read by roadmapper, updated with traceability
  ROADMAP.md          -- created by roadmapper, read by planner/checker/verifier
  STATE.md            -- created by roadmapper, updated by executor, read by planner
  research/
    STACK.md          -- created by project-researcher, read by synthesizer
    FEATURES.md       -- created by project-researcher, read by synthesizer
    ARCHITECTURE.md   -- created by project-researcher, read by synthesizer
    PITFALLS.md       -- created by project-researcher, read by synthesizer
    SUMMARY.md        -- created by synthesizer, read by roadmapper
  codebase/
    STACK.md          -- created by codebase-mapper, read by planner/executor
    INTEGRATIONS.md   -- created by codebase-mapper, read by planner/executor
    ARCHITECTURE.md   -- created by codebase-mapper, read by planner/executor
    STRUCTURE.md      -- created by codebase-mapper, read by planner/executor
    CONVENTIONS.md    -- created by codebase-mapper, read by planner/executor
    TESTING.md        -- created by codebase-mapper, read by planner/executor
    CONCERNS.md       -- created by codebase-mapper, read by planner/executor
  phases/XX-name/
    {phase}-CONTEXT.md      -- created by discuss-phase, read by researcher/planner/checker
    {phase}-RESEARCH.md     -- created by phase-researcher, read by planner
    {phase}-{NN}-PLAN.md    -- created by planner, read by checker/executor/verifier
    {phase}-{plan}-SUMMARY.md -- created by executor, read by verifier/integration-checker
    {phase}-VERIFICATION.md -- created by verifier, read by planner (gap closure)
    {phase}-UAT.md          -- used in gap closure mode
  debug/
    {slug}.md               -- created/updated by debugger
    resolved/{slug}.md      -- archived by debugger
```
