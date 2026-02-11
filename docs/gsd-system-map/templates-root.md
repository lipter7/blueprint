# GSD Templates: Root-Level Planning Documents

## Overview

The `get-shit-done/templates/` root directory contains 22 files that scaffold every planning document the GSD system produces. These templates define the structure of the `.planning/` directory tree that lives inside every GSD-managed project. They are the canonical source of truth for what a planning document looks like, what sections it has, who fills it, and who reads it downstream.

The templates serve three distinct roles:

1. **Scaffolding templates** -- define the structure of documents that persist across the project lifecycle (roadmap, requirements, state, project, config). These are created once during project initialization and evolve over time.

2. **Execution templates** -- define the structure of documents produced during active development (plans, summaries, verification reports, debug files). These are created per-phase or per-plan and accumulate as work progresses.

3. **Prompt templates** -- define the context payloads passed to subagents when spawning them (planner prompt, debug prompt). These are not persisted as files; they structure the dynamic prompt that launches an agent.

All templates use a consistent pattern: a markdown code fence containing the actual template content, surrounded by XML-tagged sections (`<guidelines>`, `<example>`, `<lifecycle>`, etc.) that instruct the filling agent on how to use the template. The templates range from highly prescriptive (e.g., `phase-prompt.md` with rigid YAML frontmatter fields) to flexible (e.g., `context.md` where section headings emerge from the discussion).

The 22 files break down as: 6 core planning, 3 execution/subagent prompts, 4 summary variants, 3 verification/testing, 2 milestone, and 4 session/research management.

---

## Core Planning Templates

### roadmap.md

**Scaffolds:** `.planning/ROADMAP.md` -- the master plan for the entire project.

**Template structure:**
- Title line: `# Roadmap: [Project Name]`
- `## Overview` -- one-paragraph project journey description
- `## Phases` -- checklist with phase numbering rules (integers for planned, decimals like 2.1 for urgent insertions marked INSERTED)
- `## Phase Details` -- per-phase blocks with: Goal, Depends on, Requirements (REQ-IDs), Success Criteria (2-5 observable behaviors), Plans count, and Plan checklist items using `{phase}-{plan}` naming (e.g., `01-02`)
- `## Progress` -- table with columns: Phase, Plans Complete, Status, Completed

**Two formats provided:**
1. **Initial Roadmap (v1.0 Greenfield)** -- flat phase list, simple progress table
2. **Milestone-Grouped Roadmap (After v1.0 Ships)** -- phases grouped under milestones (emoji-prefixed), completed milestones collapsed in `<details>` tags, progress table gains a Milestone column

**Producer:** The `new-project` command / roadmap creation workflow. Phase count depends on depth setting: quick (3-5), standard (5-8), comprehensive (8-12).

**Downstream consumers:**
- `gsd-planner` -- reads phase details to create PLAN.md files
- `gsd-verifier` -- reads success criteria to verify phase completion
- Execute workflow -- updates progress table after each plan
- Milestone workflows -- collapse completed milestones

**Paths referenced:**
- `.planning/ROADMAP.md` (output location)
- Plan naming: `{phase}-{plan}-PLAN.md` (e.g., `01-02-PLAN.md`)

**Notable patterns:**
- `<guidelines>` XML tag with planning rules
- `<status_values>` XML tag defining: Not started, In progress, Complete, Deferred
- Success criteria flow downstream: roadmap -> `must_haves` in plan-phase -> verified by verify-phase
- Plan count can be "TBD" initially
- Continuous phase numbering across milestones (never restart at 01)
- Decimal phases appear between surrounding integers in numeric order

**Prescriptiveness:** Highly prescriptive on structure (phase format, progress table, numbering scheme). Flexible on content (phase names, criteria wording, plan counts).

---

### requirements.md

**Scaffolds:** `.planning/REQUIREMENTS.md` -- checkable requirements that define "done."

**Template structure:**
- Wrapped in `<template>` XML tag
- Title: `# Requirements: [Project Name]`
- `**Defined:** [date]` / `**Core Value:** [from PROJECT.md]`
- `## v1 Requirements` -- categorized requirements with checkbox format: `- [ ] **[CAT]-[NUM]**: [Description]`
- `## v2 Requirements` -- deferred requirements (no checkboxes, not yet actionable)
- `## Out of Scope` -- table with Feature and Reason columns
- `## Traceability` -- table mapping Requirement -> Phase -> Status, with coverage summary (total, mapped, unmapped)

**Producer:** The `new-project` / requirements definition workflow, informed by research FEATURES.md categories.

**Downstream consumers:**
- Roadmap creation -- ensures all v1 requirements are mapped to phases
- Phase execution -- requirements checked off as they complete
- Verification -- requirements coverage checked

**Paths referenced:**
- `.planning/REQUIREMENTS.md` (output location)
- `PROJECT.md` Core Value section (input)
- Research `FEATURES.md` (category source)

**Notable patterns:**
- `<guidelines>` tag: requirement format rules (ID: `[CATEGORY]-[NUMBER]`, user-centric, testable, atomic)
- `<evolution>` tag: what to update after each phase completes and after roadmap updates
- `<example>` tag: full 18-requirement CommunityApp example with AUTH, PROF, CONT, SOCL categories
- Status values: Pending, In Progress, Complete, Blocked
- Requirement completion requires: implemented + verified + committed
- Moving v2 to v1 requires roadmap update

**Prescriptiveness:** Highly prescriptive on ID format and traceability structure. Flexible on category names and requirement descriptions.

---

### state.md

**Scaffolds:** `.planning/STATE.md` -- the project's living memory / short-term state.

**Template structure:**
- `# Project State`
- `## Project Reference` -- pointer to PROJECT.md with core value and current focus
- `## Current Position` -- Phase X of Y, Plan A of B, Status, Last activity, Progress bar (ASCII: `[░░░░░░░░░░] 0%`)
- `## Performance Metrics` -- velocity stats (total plans, average duration, total time), per-phase table, recent trend
- `## Accumulated Context` -- Decisions (references PROJECT.md Key Decisions), Pending Todos (references `.planning/todos/pending/`), Blockers/Concerns
- `## Session Continuity` -- last session timestamp, stopped at description, resume file path

**Producer:** Created after ROADMAP.md during init. Updated by execute workflow, transition workflow, and gsd-tools.js.

**Downstream consumers:**
- Every workflow reads STATE.md first (progress, plan, execute, transition)
- Commands use it for instant session restoration

**Paths referenced:**
- `.planning/STATE.md` (output location)
- `.planning/PROJECT.md` (referenced for full context)
- `.planning/todos/pending/` (todos location)
- `.continue-here*.md` (resume file)

**Notable patterns:**
- `<purpose>` tag explaining the problem STATE.md solves (information captured but not consumed; sessions start without context)
- `<lifecycle>` tag with create/read/write rules per workflow stage
- `<sections>` tag with detailed field-by-field guidance
- `<size_constraint>` tag: keep under 100 lines; it is a DIGEST, not an archive
- Progress calculation: `(completed plans) / (total plans across all phases) * 100%`
- Pending Todos: "Brief list if few, count if many"

**Prescriptiveness:** Moderately prescriptive. Fixed section structure, but flexible on content within sections. Hard constraint on size (100 lines max).

---

### project.md

**Scaffolds:** `.planning/PROJECT.md` -- the living project context document.

**Template structure:**
- Wrapped in `<template>` XML tag
- `# [Project Name]`
- `## What This Is` -- 2-3 sentence product description
- `## Core Value` -- the ONE thing that matters most (drives prioritization)
- `## Requirements` -- three tiers: Validated (shipped and confirmed), Active (current scope, hypotheses until shipped), Out of Scope (with reasoning)
- `## Context` -- background info: technical environment, prior work, user feedback, known issues
- `## Constraints` -- hard limits with type and rationale (Tech stack, Timeline, Budget, Dependencies, etc.)
- `## Key Decisions` -- table with Decision, Rationale, Outcome columns (outcome emoji: checkmark Good, warning Revisit, dash Pending)
- Footer: `*Last updated: [date] after [trigger]*`

**Producer:** The `new-project` command; for brownfield projects, `/gsd:map-codebase` informs the Validated requirements section.

**Downstream consumers:**
- STATE.md references it (core value, current focus)
- Every planning workflow reads it for context
- Phase transitions update it (move requirements between tiers, add decisions)
- Milestone reviews audit it comprehensively

**Paths referenced:**
- `.planning/PROJECT.md` (output location)
- References `/gsd:map-codebase` for brownfield initialization

**Notable patterns:**
- `<guidelines>` tag with section-by-section authoring rules
- `<evolution>` tag with update triggers (after each phase transition, after each milestone)
- `<brownfield>` tag: explicit flow for existing codebases (map codebase -> infer Validated -> gather Active -> initialize)
- `<state_reference>` tag: shows exactly how STATE.md references PROJECT.md
- Requirements are "hypotheses until shipped" -- only move to Validated after proving valuable
- Out of Scope always includes reasoning to prevent re-adding

**Prescriptiveness:** Moderately prescriptive structure, highly flexible content. The Core Value section is deliberately constrained to one sentence.

---

### context.md

**Scaffolds:** `.planning/phases/XX-name/{phase}-CONTEXT.md` -- captures implementation decisions for a specific phase.

**Template structure:**
- Header block: `# Phase [X]: [Name] - Context` with Gathered date and Status
- `<domain>` section: Phase Boundary (scope anchor from ROADMAP.md, fixed)
- `<decisions>` section: Implementation Decisions with emergent category headings (not predefined), plus "Claude's Discretion" subsection for areas where user explicitly delegated choice
- `<specifics>` section: Specific Ideas (product references, "I want it like X" moments)
- `<deferred>` section: Ideas that came up but belong in other phases

**Key principle stated at top:** "Categories are NOT predefined. They emerge from what was actually discussed for THIS phase."

**Producer:** The `/gsd:discuss-phase` command, during interactive conversation with the user.

**Downstream consumers (explicitly documented):**
- `gsd-phase-researcher` -- reads decisions to focus research (e.g., "card layout" -> research card component patterns)
- `gsd-planner` -- reads decisions to create specific tasks (e.g., "infinite scroll" -> task includes virtualization)

**Paths referenced:**
- `.planning/phases/XX-name/{phase}-CONTEXT.md` (output location)
- `.planning/ROADMAP.md` (source of phase boundary)

**Notable patterns:**
- Three full worked examples provided in `<good_examples>` tag:
  1. Visual feature (Post Feed) -- layout, loading behavior, empty state decisions
  2. CLI tool (Database Backup) -- output format, flag design, error recovery decisions
  3. Organization task (Photo Library) -- grouping criteria, duplicate handling, naming convention
- `<guidelines>` tag with good/bad content examples
- Good: "Card-based layout, not timeline" / Bad: "Should feel modern and clean"
- Deferred Ideas captures scope leakage ("Commenting on posts -- Phase 5")
- "Downstream agents should NOT need to ask the user again about captured decisions"

**Prescriptiveness:** Flexible on section headings within `<decisions>` (they emerge from discussion). Prescriptive on the four top-level XML sections and the principle that decisions must be concrete.

---

### config.json

**Scaffolds:** `.planning/config.json` -- project-level GSD configuration.

**Template structure (raw JSON, no wrapper):**
```json
{
  "mode": "interactive",
  "depth": "standard",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  },
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  }
}
```

**Producer:** Copied into `.planning/` during project initialization. User can edit manually.

**Downstream consumers:**
- All orchestrator commands -- check `gates` to decide whether to pause for user confirmation
- Execute workflow -- checks `parallelization` settings
- Plan workflow -- checks `workflow.research`, `workflow.plan_check`
- Verify workflow -- checks `workflow.verifier`

**Paths referenced:**
- `.planning/config.json` (output location)

**Notable patterns:**
- `mode` controls interactive vs autonomous behavior
- `depth` controls phase count: quick (3-5), standard (5-8), comprehensive (8-12)
- `gates` are per-step confirmation toggles (all true by default = interactive)
- `parallelization` controls whether plans can run concurrently
- `safety` overrides: destructive operations and external services always confirm regardless of other settings

**Prescriptiveness:** Highly prescriptive (exact JSON structure). All values have sensible defaults. The config is the primary user-facing customization point.

---

## Execution Templates

### phase-prompt.md

**Scaffolds:** `.planning/phases/XX-name/{phase}-{plan}-PLAN.md` -- executable phase plans optimized for parallel execution.

This is the largest and most complex template (16,598 bytes, ~500 lines). It defines the PLAN.md output format that the planner agent produces.

**Template structure:**
- YAML frontmatter with fields: `phase`, `plan`, `type` (execute or tdd), `wave` (pre-computed execution wave), `depends_on` (plan ID array), `files_modified`, `autonomous` (true/false), `user_setup` (optional array), `must_haves` (goal-backward verification with `truths`, `artifacts`, `key_links`)
- `<objective>` section: what the plan accomplishes, purpose, output
- `<execution_context>` section: references to execute-plan workflow, summary template, checkpoints reference
- `<context>` section: references to PROJECT.md, ROADMAP.md, STATE.md, plus selective prior SUMMARY references
- `<tasks>` section: ordered task list using XML task elements with type attributes
- `<verification>` section: checklist of verification commands
- `<success_criteria>` section: completion criteria
- `<output>` section: instructions to create SUMMARY.md after completion

**Task types defined:**
| Type | Use | Autonomy |
|------|-----|----------|
| `auto` | Everything Claude can do independently | Fully autonomous |
| `checkpoint:human-verify` | Visual/functional verification | Pauses, returns to orchestrator |
| `checkpoint:decision` | Implementation choices | Pauses, returns to orchestrator |
| `checkpoint:human-action` | Truly unavoidable manual steps (rare) | Pauses, returns to orchestrator |

Each `auto` task has: `<name>`, `<files>`, `<action>`, `<verify>`, `<done>`.
Each `checkpoint:decision` task has: `<decision>`, `<context>`, `<options>` with pros/cons, `<resume-signal>`.
Each `checkpoint:human-verify` task has: `<what-built>`, `<how-to-verify>`, `<resume-signal>`.

**Producer:** `gsd-planner` agent, spawned by `/gsd:plan-phase`.

**Downstream consumers:**
- `/gsd:execute-phase` -- reads and executes plans grouped by wave number
- `gsd-verifier` -- reads `must_haves` for goal-backward verification
- `gsd-executor` -- executes individual tasks

**Paths referenced:**
- `.planning/phases/XX-name/{phase}-{plan}-PLAN.md` (output location)
- `~/.claude/get-shit-done/workflows/execute-plan.md` (execution context)
- `~/.claude/get-shit-done/templates/summary.md` (summary format)
- `~/.claude/get-shit-done/references/checkpoints.md` (checkpoint patterns)
- `~/.claude/get-shit-done/references/tdd.md` (TDD plan structure)
- `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`

**Notable patterns:**
- `must_haves` is the core verification mechanism: `truths` (observable behaviors), `artifacts` (files that must exist with `min_lines`, `exports`, `contains` checks), `key_links` (connections between artifacts with regex `pattern` verification)
- Wave numbers are pre-computed at plan time -- no runtime dependency analysis
- Vertical slices preferred over horizontal layers (PREFER: User model+API+UI per plan; AVOID: all models, then all APIs, then all UIs)
- Plan sizing: 2-3 tasks, ~50% context usage maximum
- Anti-patterns section: reflexive dependency chaining, horizontal layer grouping, missing autonomy flag, vague tasks
- `user_setup` field with full schema for external services (env vars, dashboard config, local dev commands)
- Three full examples: autonomous parallel plan, plan with checkpoint, parallel wave examples

**Prescriptiveness:** Extremely prescriptive. Every frontmatter field is mandatory. Task XML structure is rigid. The only flexibility is in the number of tasks and what they contain.

---

### planner-subagent-prompt.md

**Scaffolds:** Not a file -- this is a prompt template for spawning the `gsd-planner` agent.

**Template structure:**
- `<planning_context>` section: Phase number, Mode (standard or gap_closure), references to STATE.md, ROADMAP.md, REQUIREMENTS.md, phase CONTEXT.md, RESEARCH.md
- `<downstream_consumer>` section: states output is consumed by `/gsd:execute-phase`, lists required plan attributes
- `<quality_gate>` section: checklist that must pass before returning "PLANNING COMPLETE"

**Placeholders:**
| Placeholder | Source | Example |
|-------------|--------|---------|
| `{phase_number}` | From roadmap/arguments | `5` or `2.1` |
| `{phase_dir}` | Phase directory name | `05-user-profiles` |
| `{phase}` | Phase prefix | `05` |
| `{standard \| gap_closure}` | Mode flag | `standard` |

**Producer:** `/gsd:plan-phase` command fills the template and passes it as the spawn prompt.

**Downstream consumers:** The spawned `gsd-planner` agent receives this as its initial prompt. The agent's output (PLAN.md files) flows to `/gsd:execute-phase`.

**Paths referenced:**
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`
- `.planning/phases/{phase_dir}/{phase}-CONTEXT.md`
- `.planning/phases/{phase_dir}/{phase}-RESEARCH.md`
- `.planning/phases/{phase_dir}/{phase}-VERIFICATION.md` (gap closure mode)
- `.planning/phases/{phase_dir}/{phase}-UAT.md` (gap closure mode)

**Notable patterns:**
- Continuation template provided for checkpoint scenarios (spawn fresh agent with prior state + checkpoint response)
- Explicit note: "Planning methodology, task breakdown, dependency analysis, wave assignment, TDD detection, and goal-backward derivation are baked into the gsd-planner agent. This template only passes context."
- Gap closure mode adds VERIFICATION.md and UAT.md to context

**Prescriptiveness:** Moderately prescriptive. Fixed structure but the content is all placeholder references.

---

### debug-subagent-prompt.md

**Scaffolds:** Not a file -- this is a prompt template for spawning the `gsd-debugger` agent.

**Template structure:**
- `<objective>` section: Issue ID and summary
- `<symptoms>` section: expected, actual, errors, reproduction, timeline
- `<mode>` section: `symptoms_prefilled` (true/false), `goal` (find_root_cause_only or find_and_fix)
- `<debug_file>` section: path to create `.planning/debug/{slug}.md`

**Placeholders:**
| Placeholder | Source | Example |
|-------------|--------|---------|
| `{issue_id}` | Orchestrator-assigned | `auth-screen-dark` |
| `{issue_summary}` | User description | `Auth screen is too dark` |
| `{expected}` / `{actual}` / `{errors}` | From symptoms | Various |
| `{goal}` | Orchestrator sets | `find_and_fix` |
| `{slug}` | Generated | `auth-screen-dark` |

**Producer:** `/gsd:debug` command or the `diagnose-issues` workflow (from UAT).

**Downstream consumers:** The spawned `gsd-debugger` agent. Produces a DEBUG.md file that may feed back into UAT gap diagnosis.

**Paths referenced:**
- `.planning/debug/{slug}.md` (output location for debug session file)

**Notable patterns:**
- Continuation template provided for checkpoint scenarios
- Minimal template -- the agent itself contains all debugging expertise
- Explicit separation: this template passes problem context only

**Prescriptiveness:** Low. Just provides the problem context structure. All methodology is in the agent definition.

---

## Summary Templates (4 Variants)

GSD has four summary template files. The base `summary.md` is the canonical reference with full documentation, guidelines, examples, and frontmatter guidance. The three variants (`summary-complex.md`, `summary-standard.md`, `summary-minimal.md`) are stripped-down instantiation templates at different detail levels, selected based on plan complexity.

### summary.md (Base / Canonical Reference)

**Scaffolds:** `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` -- plan completion documentation.

**Template structure:**
- YAML frontmatter (extensive): `phase`, `plan`, `subsystem`, `tags`, `requires` (dependency graph with phase + provides), `provides`, `affects`, `tech-stack` (added libraries, patterns), `key-files` (created, modified), `key-decisions`, `patterns-established`, `duration`, `completed`
- `# Phase [X]: [Name] Summary` with mandatory substantive one-liner
- `## Performance` -- duration, started/completed timestamps, task count, files modified
- `## Accomplishments` -- key outcomes list
- `## Task Commits` -- atomic commit list with hashes and type (feat/fix/test/refactor)
- `## Files Created/Modified` -- paths with descriptions
- `## Decisions Made` -- key decisions with rationale
- `## Deviations from Plan` -- detailed auto-fix records following GSD deviation rules (Rule number, category, description, found during, issue, fix, files, verification, commit hash)
- `## Issues Encountered` -- problems during planned work
- `## User Setup Required` -- reference to USER-SETUP.md if generated
- `## Next Phase Readiness` -- readiness assessment and blockers

**Producer:** The execute-plan workflow, after all tasks in a plan complete.

**Downstream consumers:**
- Future plan context references (selective, only when genuinely needed)
- STATE.md updates (decisions, position, blockers)
- UAT verification (tests derived from accomplishments)
- Frontmatter enables automatic context assembly (machine-readable dependency graph)

**Paths referenced:**
- `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` (output location)
- `{phase}-USER-SETUP.md` (referenced when external services configured)

**Notable patterns:**
- `<frontmatter_guidance>` tag: explains purpose of machine-readable frontmatter (fast scanning, dependency graph, context selection)
- `<one_liner_rules>` tag: Good: "JWT auth with refresh rotation using jose library" / Bad: "Phase complete", "Authentication implemented"
- `<example>` tag: full Phase 1 Foundation example with 2 auto-fixed deviations (password hashing, missing dependency)
- Deviations section distinguishes "Deviations from Plan" (unplanned auto-fixes) from "Issues Encountered" (problems during planned work)
- Frontmatter `requires`/`provides`/`affects` create explicit dependency graph for transitive closure during context selection

**Prescriptiveness:** Highly prescriptive. Mandatory frontmatter, mandatory one-liner quality standard, detailed deviation logging format.

---

### summary-complex.md

**Scaffolds:** Same as base summary, selected when the plan had significant deviations, issues, or decisions.

**Template structure:** Same sections as base summary but presented as a raw template (no surrounding documentation). Includes all sections: Performance, Accomplishments, Task Commits, Files, Decisions, Deviations (detailed auto-fix records), Issues, Next Phase Readiness.

**Difference from base:** This is the "fill this in" template -- no `<guidelines>`, `<example>`, or `<frontmatter_guidance>` tags. Just the frontmatter and sections ready to populate.

**YAML frontmatter:** Full set including `requires` with `phase` and `provides` sub-fields, `patterns-established`.

---

### summary-standard.md

**Scaffolds:** Same as base summary, selected when the plan was routine with minor or no deviations.

**Template structure:** Reduced from complex variant:
- Frontmatter drops `requires` (no dependency tracking) and `patterns-established`
- Sections: Performance, Accomplishments, Task Commits, Files Created/Modified
- `## Decisions & Deviations` -- combined into single section (not separate)
- `## Next Phase Readiness` -- retained

**Difference from complex:** No separate Deviations or Issues sections. Simpler frontmatter. Suitable for straightforward plans that followed the spec.

---

### summary-minimal.md

**Scaffolds:** Same as base summary, selected when the plan was trivial or quick.

**Template structure:** Most stripped-down variant:
- Frontmatter drops `requires`, `patterns-established`, and has empty `key-decisions: []`
- Sections: Performance, Accomplishments, Task Commits, Files Created/Modified, Next Phase Readiness
- No Decisions section, no Deviations section, no Issues section

**Difference from standard:** No decisions or deviations tracking at all. Just what happened, what files changed, and readiness for next phase.

---

**Why four variants exist:** The base `summary.md` is the reference document with all rules and examples. The three instantiation variants exist so the executor agent can select the appropriate level of detail based on plan complexity:
- Complex: plan had auto-fixes, significant decisions, or issues
- Standard: plan ran smoothly with minor notes
- Minimal: quick or trivial plan, nothing noteworthy

The frontmatter complexity decreases across variants (complex has `requires`/`patterns-established`; minimal has neither). This controls how much context future planning passes get from this summary.

---

## Verification and Testing Templates

### verification-report.md

**Scaffolds:** `.planning/phases/XX-name/{phase}-VERIFICATION.md` -- phase goal verification results.

**Template structure:**
- YAML frontmatter: `phase`, `verified` (ISO timestamp), `status` (passed / gaps_found / human_needed), `score` (N/M must-haves verified)
- `# Phase {X}: {Name} Verification Report` with phase goal, timestamp, status
- `## Goal Achievement` with three sub-tables:
  - **Observable Truths:** table with Truth, Status (VERIFIED/FAILED/UNCERTAIN), Evidence
  - **Required Artifacts:** table with Artifact path, Expected, Status (EXISTS+SUBSTANTIVE / STUB), Details
  - **Key Link Verification:** table with From, To, Via, Status (WIRED / NOT WIRED), Details
- `## Requirements Coverage` -- table mapping requirements to satisfaction status
- `## Anti-Patterns Found` -- table with File, Line, Pattern, Severity (Blocker/Warning), Impact
- `## Human Verification Required` -- manual test descriptions (if needed)
- `## Gaps Summary` -- Critical Gaps (block progress) and Non-Critical Gaps (can defer)
- `## Recommended Fix Plans` -- generated fix plan outlines if gaps found
- `## Verification Metadata` -- approach, sources, automated/human check counts, duration

**Producer:** `gsd-verifier` agent, spawned by `/gsd:verify-work` or the execute workflow's verification step.

**Downstream consumers:**
- `/gsd:plan-phase --gaps` -- reads gaps to generate fix plans
- UAT workflow -- references verification results
- `gsd-planner` in gap_closure mode -- reads verification + UAT gaps

**Paths referenced:**
- `.planning/phases/XX-name/{phase}-VERIFICATION.md` (output location)
- `PLAN.md` frontmatter `must_haves` (source of truths/artifacts/key_links)
- `ROADMAP.md` (source of phase goal)
- `.planning/phases/XX-name/{phase}-{next}-PLAN.md` (recommended fix plans)

**Notable patterns:**
- Status hierarchy: VERIFIED > FAILED > UNCERTAIN for truths; EXISTS+SUBSTANTIVE > STUB for artifacts; WIRED > NOT WIRED for links
- Severity levels: Blocker (prevents goal), Warning (incomplete but non-blocking), Info (notable)
- Anti-patterns specifically checked: TODO comments, placeholder returns, missing files
- Fix plans are generated inline with estimated scope (Small/Medium)
- Full worked example: Chat Interface with 2/5 truths verified, 0/4 wiring verified -- demonstrates what a gap-heavy report looks like

**Prescriptiveness:** Extremely prescriptive. Rigid table formats, mandatory evidence for every check, structured gap/fix plan output.

---

### UAT.md

**Scaffolds:** `.planning/phases/XX-name/{phase}-UAT.md` -- persistent UAT (User Acceptance Testing) session tracking.

**Template structure:**
- YAML frontmatter: `status` (testing / complete / diagnosed), `phase`, `source` (list of SUMMARY.md files), `started`, `updated`
- `## Current Test` -- OVERWRITTEN on each test transition, shows active test name and expected behavior
- `## Tests` -- numbered test entries with `expected`, `result` ([pending] / pass / issue / skipped), and conditional fields: `reported` (verbatim user response), `severity` (inferred), `reason` (for skipped)
- `## Summary` -- running counts: total, passed, issues, pending, skipped
- `## Gaps` -- YAML-formatted gap entries for consumption by `/gsd:plan-phase --gaps`

**Section mutation rules (documented in `<section_rules>`):**
- Frontmatter: status OVERWRITE, phase/source/started IMMUTABLE, updated OVERWRITE
- Current Test: OVERWRITE entirely on each transition
- Tests: OVERWRITE result field per test
- Summary: OVERWRITE counts after each response
- Gaps: APPEND only

**Producer:** `/gsd:verify-work` command starts the UAT session.

**Downstream consumers:**
- Diagnosis workflow -- spawns parallel debug agents per gap
- `/gsd:plan-phase --gaps` -- reads Gaps section (YAML format) for gap closure planning
- After diagnosis, gaps get enriched with `root_cause`, `artifacts`, `missing`, `debug_session` fields

**Paths referenced:**
- `.planning/phases/XX-name/{phase}-UAT.md` (output location)
- `.planning/debug/{slug}.md` (debug sessions linked from gap entries)
- SUMMARY.md files (source of test derivation)

**Notable patterns:**
- `<severity_guide>` tag: severity is INFERRED from user's natural language, never asked directly
  - Crash/error/fails -> blocker
  - Doesn't work/nothing happens -> major
  - Works but.../slow/weird -> minor
  - Color/font/spacing -> cosmetic
  - Default: major (safe default)
- `<diagnosis_lifecycle>` tag: after testing complete with gaps, debug agents investigate each gap, fill root_cause/artifacts/missing/debug_session, status -> "diagnosed"
- `<lifecycle>` tag: creation -> testing loop -> completion -> optional diagnosis
- Resume after `/clear`: parse frontmatter for status, read Current Test, find first [pending] result
- Full worked example: Comments phase with 6 tests, 5 passed, 1 issue (comment not refreshing), diagnosed with root cause

**Prescriptiveness:** Extremely prescriptive. Rigid section mutation rules (OVERWRITE vs APPEND vs IMMUTABLE). YAML format for gaps is exact. Severity inference rules are defined.

---

### DEBUG.md

**Scaffolds:** `.planning/debug/[slug].md` -- active debug session tracking.

**Template structure:**
- YAML frontmatter: `status` (gathering / investigating / fixing / verifying / resolved), `trigger` (verbatim user input, IMMUTABLE), `created`, `updated`
- `## Current Focus` -- OVERWRITTEN each update: hypothesis, test, expecting, next_action
- `## Symptoms` -- written during gathering, then IMMUTABLE: expected, actual, errors, reproduction, started
- `## Eliminated` -- APPEND only: hypothesis, evidence that disproved it, timestamp
- `## Evidence` -- APPEND only: timestamp, checked, found, implication
- `## Resolution` -- OVERWRITTEN as understanding evolves: root_cause, fix, verification, files_changed

**Section mutation rules (documented in `<section_rules>`):**
- Current Focus: OVERWRITE (always reflects NOW)
- Symptoms: IMMUTABLE after gathering
- Eliminated: APPEND only (prevents re-investigating dead ends after /clear)
- Evidence: APPEND only (builds case for root cause)
- Resolution: OVERWRITE (evolves as fixes are tried)

**Producer:** `/gsd:debug` command or `diagnose-issues` workflow.

**Downstream consumers:**
- The debug agent itself on resume after `/clear`
- UAT.md gap entries (debug_session field links back)
- Resolved files moved to `.planning/debug/resolved/`

**Paths referenced:**
- `.planning/debug/[slug].md` (output location)
- `.planning/debug/resolved/` (destination for resolved debug files)

**Notable patterns:**
- `<lifecycle>` tag: gathering -> investigating -> fixing -> verifying -> resolved (or back to investigating if verification fails)
- `<resume_behavior>` tag: "The file IS the debugging brain" -- Claude reads frontmatter for status, Current Focus for what to do, Eliminated for what NOT to retry, Evidence for what's known
- `<size_constraint>` tag: keep evidence entries to 1-2 lines, no narrative prose, structured data only; if evidence grows very large (10+ entries), check if going in circles
- Eliminated section is critical for efficiency across /clear boundaries -- prevents re-investigating dead ends

**Prescriptiveness:** Highly prescriptive on structure and mutation rules. The five-section structure with strict OVERWRITE/APPEND/IMMUTABLE rules is rigid by design to enable reliable resume.

---

## Milestone Templates

### milestone.md

**Scaffolds:** Entries in `.planning/MILESTONES.md` -- records of shipped milestones.

**Template structure:**
- Entry format: `## v[X.Y] [Name] (Shipped: YYYY-MM-DD)`
- `**Delivered:**` -- one sentence
- `**Phases completed:**` -- range and plan count
- `**Key accomplishments:**` -- bulleted list
- `**Stats:**` -- files created/modified, LOC, phases/plans/tasks counts, timeline
- `**Git range:**` -- first commit to last commit reference
- `**What's next:**` -- next milestone goals

If MILESTONES.md does not exist, creates it with header: `# Project Milestones: [Project Name]` (entries in reverse chronological order).

**Producer:** `/gsd:complete-milestone` workflow.

**Downstream consumers:**
- Project history reference
- Roadmap milestone grouping (cross-references)

**Paths referenced:**
- `.planning/MILESTONES.md` (output location)
- ROADMAP.md (source of phase data)

**Notable patterns:**
- `<guidelines>` tag: when to create (MVP shipped, major versions, significant feature milestones) vs when NOT to (individual phase completions, WIP, minor bug fixes)
- Stats gathering commands provided: `git diff --stat`, `find . -name "*.swift" | xargs wc -l`
- `<example>` tag: WeatherBar app with v1.0 MVP and v1.1 Security & Polish milestones
- Git range format: `feat(01-01)` -> `feat(04-01)` for phases 1-4

**Prescriptiveness:** Moderately prescriptive. Fixed entry format but flexible stats and accomplishments content.

---

### milestone-archive.md

**Scaffolds:** `.planning/milestones/v{VERSION}-{NAME}.md` -- comprehensive milestone archive files.

**Template structure:**
- Uses `{{PLACEHOLDER}}` style (double curly braces, unlike other templates)
- `# Milestone v{{VERSION}}: {{MILESTONE_NAME}}`
- Status, Phases, Total Plans header
- `## Overview` -- milestone description
- `## Phases` -- full phase details copied from ROADMAP.md (per-phase: goal, depends on, plan count, plan checklist, details)
- Decimal phases include `(INSERTED)` marker
- `## Milestone Summary` -- Decimal Phases list, Key Decisions (from PROJECT/STATE), Issues Resolved, Issues Deferred, Technical Debt Incurred

**Producer:** `/gsd:complete-milestone` workflow.

**Downstream consumers:**
- Historical reference only
- ROADMAP.md gets updated to collapse this milestone in `<details>` tags
- PROJECT.md gets updated to brownfield format

**Paths referenced:**
- `.planning/milestones/v{VERSION}-{NAME}.md` (output location)
- `.planning/ROADMAP.md` (source of phase details)
- `.planning/PROJECT-STATE.md` or SUMMARY files (source of decisions)

**Notable patterns:**
- `<guidelines>` tag: how to fill placeholders, archive location, post-archiving steps
- Post-archive actions: update ROADMAP.md (collapse completed), update PROJECT.md (brownfield format), continue phase numbering
- Captures both resolved and deferred issues, plus technical debt -- ensures nothing is lost during milestone transition

**Prescriptiveness:** Highly prescriptive structure. The `{{PLACEHOLDER}}` format makes it closer to a traditional template engine input than the other templates.

---

## Session Management Templates

### continue-here.md

**Scaffolds:** `.planning/phases/XX-name/.continue-here.md` -- session resumption file.

**Template structure:**
- YAML frontmatter: `phase`, `task` (current number), `total_tasks`, `status` (in_progress / blocked / almost_done), `last_updated`
- `<current_state>` -- immediate context
- `<completed_work>` -- specific task completion list
- `<remaining_work>` -- remaining tasks
- `<decisions_made>` -- key decisions with WHY (to prevent re-debating)
- `<blockers>` -- stuck items with status/workaround
- `<context>` -- mental state, "vibe", what the plan was
- `<next_action>` -- the very first thing to do when resuming

**Producer:** Execute workflow creates this when a session ends mid-phase.

**Downstream consumers:**
- Next session reads this to resume exactly where work stopped
- STATE.md references its path in Session Continuity section
- File is DELETED after resume (not permanent storage)

**Paths referenced:**
- `.planning/phases/XX-name/.continue-here.md` (output location)

**Notable patterns:**
- `<guidelines>` tag: "Be specific enough that a fresh Claude instance understands immediately", "Include WHY decisions were made", "`<next_action>` should be actionable without reading anything else"
- Ephemeral by design -- deleted after consumption
- The `<context>` section explicitly captures "mental state" and "vibe" -- unique among GSD templates

**Prescriptiveness:** Moderately prescriptive. Fixed XML sections but free-form content within each.

---

### discovery.md

**Scaffolds:** `.planning/phases/XX-name/DISCOVERY.md` -- shallow research for library/option decisions.

**Template structure:**
- YAML frontmatter: `phase`, `type: discovery`, `topic`
- `<session_initialization>` -- date verification (use today's date for "current" searches)
- `<discovery_objective>` -- topic, purpose, scope, output
- `<discovery_scope>` with `<include>` and `<exclude>` subsections
- `<discovery_protocol>` -- source priority (Context7 MCP > Official Docs > WebSearch), quality checklist, confidence levels (HIGH/MEDIUM/LOW)
- `<output_structure>` defining the output file format: Summary, Primary Recommendation, Alternatives Considered, Key Findings, Code Examples, Metadata (confidence, sources, open questions, validation checkpoints)
- `<success_criteria>` and `<guidelines>` for when to use discovery vs RESEARCH.md

**Producer:** `/gsd:plan-phase` during mandatory discovery step.

**Downstream consumers:**
- `gsd-planner` -- reads discovery recommendation to inform plan creation
- The discovery output feeds into PLAN.md context references

**Paths referenced:**
- `.planning/phases/XX-name/DISCOVERY.md` (output location)

**Notable patterns:**
- Explicit source hierarchy: Context7 MCP is #1 for library docs, WebSearch is last resort
- Quality checklist: all claims need authoritative sources, negative claims verified, API syntax from Context7 or official docs only
- Clear distinction from `research.md`: discovery answers "which library" while research answers "how do experts build this"
- `<session_initialization>` forces date verification to prevent stale search queries

**Prescriptiveness:** Moderately prescriptive on protocol (source hierarchy, confidence levels). Flexible on content.

---

### research.md

**Scaffolds:** `.planning/phases/XX-name/{phase}-RESEARCH.md` -- comprehensive ecosystem research before planning.

This is the second-largest template (16,332 bytes). It produces deep domain research, not just library comparisons.

**Template structure:**
- Header: Phase name, Researched date, Domain, Confidence (HIGH/MEDIUM/LOW)
- `<user_constraints>` -- copies locked decisions from CONTEXT.md verbatim (CRITICAL: must be honored), Claude's Discretion areas, Deferred Ideas (OUT OF SCOPE)
- `<research_summary>` -- 2-3 paragraph executive summary with primary recommendation one-liner
- `<standard_stack>` -- Core and Supporting library tables (library, version, purpose, why standard), Alternatives Considered table, installation command
- `<architecture_patterns>` -- recommended project structure, named patterns with code examples, anti-patterns to avoid
- `<dont_hand_roll>` -- problems that look simple but have existing solutions (table: Problem, Don't Build, Use Instead, Why)
- `<common_pitfalls>` -- 3+ pitfalls with: What goes wrong, Why it happens, How to avoid, Warning signs
- `<code_examples>` -- verified patterns from official sources with source attribution
- `<sota_updates>` -- state of the art changes (Old Approach vs Current Approach table), new tools, deprecated items
- `<open_questions>` -- unresolved items with partial info and recommendations
- `<sources>` -- Primary (HIGH), Secondary (MEDIUM), Tertiary (LOW) with confidence tagging
- `<metadata>` -- research scope, confidence breakdown per section, research date, valid-until estimate

**Producer:** `gsd-phase-researcher` agent, spawned by `/gsd:research-phase`.

**Downstream consumers (explicitly stated):**
- `gsd-planner` -- loads as @context reference in PLAN.md
- Standard stack informs library choices
- Don't hand-roll prevents custom solutions
- Pitfalls inform verification criteria
- Code examples referenced in task actions

**Paths referenced:**
- `.planning/phases/XX-name/{phase}-RESEARCH.md` (output location)
- `.planning/phases/XX-name/{phase}-CONTEXT.md` (source of user constraints)

**Notable patterns:**
- Full worked example: 3D City Driving game with Three.js/R3F/Rapier stack (260+ lines of example)
- Seven mandatory sections: summary, standard_stack, architecture_patterns, dont_hand_roll, common_pitfalls, code_examples, sources
- "Don't Hand-Roll" section is unique -- explicitly prevents reinventing solved problems
- Confidence tagging at section level, not just document level
- Valid-until estimate: 30 days for stable tech, 7 days for fast-moving
- User constraints section copies CONTEXT.md decisions verbatim with "CRITICAL: must be honored" warning

**Prescriptiveness:** Highly prescriptive on structure (seven mandatory sections, each with specific table/list formats). Content depth varies by domain.

---

### user-setup.md

**Scaffolds:** `.planning/phases/XX-name/{phase}-USER-SETUP.md` -- human-required configuration that Claude cannot automate.

**Template structure:**
- Header: Phase name, Generated date, Status (Incomplete/Complete)
- `## Environment Variables` -- table: Status checkbox, Variable name, Source (dashboard path), Add to (file)
- `## Account Setup` -- checklist for account creation (with "Skip if" notes)
- `## Dashboard Configuration` -- checklist for external service dashboard settings
- `## Verification` -- bash commands to verify setup, expected results

**Producer:** Execute-plan workflow, generated when PLAN.md frontmatter contains `user_setup` field. Generated after tasks complete, before SUMMARY.md creation.

**Downstream consumers:**
- The human user (this is a human-facing checklist)
- SUMMARY.md references it in "User Setup Required" section

**Paths referenced:**
- `.planning/phases/XX-name/{phase}-USER-SETUP.md` (output location)
- PLAN.md frontmatter `user_setup` field (trigger/source)
- `.env.local` (common target for env vars)

**Notable patterns:**
- **Automation-first rule (central design principle):** USER-SETUP.md contains ONLY what Claude literally cannot do. Table provided:
  - Claude CAN: npm install, write code, create .env structure, run CLI commands, configure package.json
  - Claude CANNOT: create accounts, get API keys from dashboards, authenticate CLI tools (browser OAuth), access external dashboards
- The test: "Does this require a human in a browser, accessing an account Claude doesn't have credentials for?"
- Three full service-specific examples in XML tags: `<stripe_example>`, `<supabase_example>`, `<sendgrid_example>`
- Stripe example is the most detailed (webhook endpoint creation, product/price setup, local dev with stripe listen)
- Searchability: `grep -r "USER-SETUP" .planning/` finds all phases with user requirements

**Prescriptiveness:** Highly prescriptive on the automation-first boundary (what goes in vs what Claude handles). Flexible on the specific service configurations.

---

## Blueprint Migration Status

Based on `/Users/miles-mac-mini/Desktop/custom-gsd-framework/docs/phase-1-foundation.md`, "Templates to Cut" and "Templates to Adapt" sections:

### Kept and Adapted (6 templates)

| GSD Template | Blueprint Template | Key Changes |
|---|---|---|
| `roadmap.md` | `templates/roadmap.md` | Remove milestone-grouped section, remove plan-level sub-tracking (Blueprint uses one plan per phase), keep phase structure/success criteria/progress table/decimal insertion |
| `requirements.md` | `templates/requirements.md` | Remove FEATURES.md research references, keep ID format/v1-v2 split/traceability |
| `state.md` | `templates/state.md` | Remove pending todos (Cursor TodoWrite handles it), remove resume file/.continue-here references (Cursor has session resume), remove performance metrics, simplify to well under 100 lines |
| `project.md` | `templates/project.md` | Replace `/gsd:map-codebase` with `/01-map-codebase`, keep everything else |
| `context.md` | `templates/context.md` | Replace `gsd-phase-researcher`/`gsd-planner` consumer references with `phase-executor`, keep XML structure and all three examples |
| `config.json` | `templates/config.json` | Kept minimal with just the settings commands reference |

### Replaced by New Templates (3 templates)

| GSD Template(s) | New Blueprint Template | Rationale |
|---|---|---|
| `phase-prompt.md` | `templates/plan.md` | Prompt logic moves into commands directly; new plan uses simpler YAML frontmatter with todo tracking |
| `summary.md` + `summary-complex.md` + `summary-standard.md` + `summary-minimal.md` | `templates/summary.md` (single) | One summary format replaces four variants |
| `verification-report.md` | `templates/verification.md` | Adapted with simpler structure: goal restated, criteria checked, evidence, pass/fail verdict |

A new `templates/progress.md` is also created (no GSD equivalent) for lightweight phase checklist tracking.

### Cut Entirely (12 templates)

| GSD Template | Reason for Cutting |
|---|---|
| `milestone.md` | No milestone ceremony in Blueprint; direct ROADMAP.md editing |
| `milestone-archive.md` | No milestone ceremony in Blueprint |
| `planner-subagent-prompt.md` | Subagent prompts live in the agent files in Blueprint |
| `debug-subagent-prompt.md` | Subagent prompts live in the agent files in Blueprint |
| `summary-complex.md` | Replaced by single summary.md |
| `summary-standard.md` | Replaced by single summary.md |
| `summary-minimal.md` | Replaced by single summary.md |
| `UAT.md` | Not needed in Blueprint |
| `DEBUG.md` | Cursor has Debug Mode built in |
| `user-setup.md` | Not needed in Blueprint |
| `discovery.md` | Discovery logic folded into `02-init-project` command |
| `continue-here.md` | Cursor has session resume built in |
| `research.md` | Research agents cut from Blueprint |

---

## Cross-References

### Template -> Agent Mapping

| Template | Producer Agent/Command | Consumer Agents/Commands |
|---|---|---|
| `roadmap.md` | `new-project` workflow | `gsd-planner`, `gsd-verifier`, execute workflow |
| `requirements.md` | `new-project` workflow | Roadmap creation, phase execution, verification |
| `state.md` | Init workflow, `gsd-tools.js` | Every workflow (read first), every command |
| `project.md` | `new-project`, `/gsd:map-codebase` | STATE.md, all planning workflows, phase transitions |
| `context.md` | `/gsd:discuss-phase` | `gsd-phase-researcher`, `gsd-planner` |
| `config.json` | Init workflow | All orchestrator commands |
| `phase-prompt.md` | `gsd-planner` agent | `/gsd:execute-phase`, `gsd-executor`, `gsd-verifier` |
| `planner-subagent-prompt.md` | `/gsd:plan-phase` command | `gsd-planner` agent (receives as spawn prompt) |
| `debug-subagent-prompt.md` | `/gsd:debug`, diagnose-issues | `gsd-debugger` agent (receives as spawn prompt) |
| `summary.md` (+ variants) | Execute-plan workflow | Future plan context, STATE.md, UAT verification |
| `verification-report.md` | `gsd-verifier` agent | `/gsd:plan-phase --gaps`, UAT workflow, `gsd-planner` gap_closure |
| `UAT.md` | `/gsd:verify-work` | Diagnosis workflow, `/gsd:plan-phase --gaps` |
| `DEBUG.md` | `/gsd:debug`, diagnose-issues | Debug agent on resume, UAT gap entries |
| `milestone.md` | `/gsd:complete-milestone` | Historical reference |
| `milestone-archive.md` | `/gsd:complete-milestone` | Historical reference, ROADMAP.md update |
| `continue-here.md` | Execute workflow (mid-session) | Next session resume, STATE.md |
| `discovery.md` | `/gsd:plan-phase` (discovery step) | `gsd-planner` |
| `research.md` | `gsd-phase-researcher` | `gsd-planner` (loaded as @context in PLAN.md) |
| `user-setup.md` | Execute-plan workflow | Human user, SUMMARY.md |

### Template -> gsd-tools.js Interactions

`gsd-tools.js` (~1800 lines) interacts with templates through several commands:
- **State management:** Loads, updates, and patches STATE.md (using the state.md template structure)
- **Phase operations:** Creates phase directories, manages phase numbering (supports decimal insertion from roadmap.md)
- **Summary/plan verification:** Validates SUMMARY.md frontmatter fields
- **Progress rendering:** Reads ROADMAP.md progress table format
- **Frontmatter CRUD:** get/set/merge/validate operations on YAML frontmatter (used across PLAN.md, SUMMARY.md, VERIFICATION.md, UAT.md, DEBUG.md)
- **Milestone archival:** Uses milestone-archive.md template structure
- **Scaffolding:** Creates CONTEXT.md, UAT.md from templates

### Template Document Flow (Project Lifecycle)

```
Initialization:
  project.md -> PROJECT.md
  roadmap.md -> ROADMAP.md
  requirements.md -> REQUIREMENTS.md
  state.md -> STATE.md
  config.json -> config.json

Per-Phase:
  context.md -> {phase}-CONTEXT.md (from discuss-phase)
  discovery.md -> DISCOVERY.md (from plan-phase discovery step)
  research.md -> {phase}-RESEARCH.md (from research-phase)
  planner-subagent-prompt.md -> [spawn prompt for gsd-planner]
  phase-prompt.md -> {phase}-{plan}-PLAN.md (planner output)
  user-setup.md -> {phase}-USER-SETUP.md (if external services)
  summary*.md -> {phase}-{plan}-SUMMARY.md (after plan execution)
  continue-here.md -> .continue-here.md (if session interrupted)

Verification:
  verification-report.md -> {phase}-VERIFICATION.md
  UAT.md -> {phase}-UAT.md
  debug-subagent-prompt.md -> [spawn prompt for gsd-debugger]
  DEBUG.md -> debug/{slug}.md

Milestones:
  milestone.md -> MILESTONES.md entry
  milestone-archive.md -> milestones/v{VERSION}-{NAME}.md
```

### Shared Conventions Across Templates

1. **XML tags for instructions:** All templates use XML tags (`<guidelines>`, `<lifecycle>`, `<example>`, `<section_rules>`, etc.) to separate the template content from the instructions on how to fill it.

2. **YAML frontmatter:** Used in PLAN.md, SUMMARY.md, VERIFICATION.md, UAT.md, DEBUG.md, continue-here.md, discovery.md for machine-readable metadata. Frontmatter is always first ~25 lines for cheap scanning.

3. **Section mutation rules:** Several templates (UAT.md, DEBUG.md) explicitly declare per-section mutation semantics: OVERWRITE (replace entirely), APPEND (add only), IMMUTABLE (never change). This enables reliable resume after context loss (/clear).

4. **Downstream consumer documentation:** Most templates include explicit notes about who reads the output. This is most formal in context.md (names specific agents) and phase-prompt.md (names specific commands).

5. **`.planning/` path prefix:** Every template references `.planning/` as the root directory for all planning documents. Blueprint changes this to `.blueprint/`.

6. **`@` file references:** Plan templates and context sections use `@path/to/file` syntax for Claude Code context loading.

7. **Confidence levels:** Used in discovery.md and research.md: HIGH (Context7/official docs), MEDIUM (WebSearch + verification), LOW (WebSearch only or training knowledge).
