# GSD Workflows

## Overview

Workflows are the **logic layer** of the GSD system. They are markdown files in `get-shit-done/workflows/` that define step-by-step processes executed by slash commands. Each workflow is loaded by a corresponding command (in `commands/gsd/`) via its `execution_context` frontmatter -- the command acts as a thin orchestration wrapper while the workflow contains the actual procedural logic.

Workflows define:
- The sequence of operations (numbered steps with named XML tags)
- Which agents to spawn (via `Task()` calls with `subagent_type`)
- Which `gsd-tools.js` CLI commands to invoke
- What files to read, write, and commit in `.planning/`
- Decision points (branching logic via `AskUserQuestion` or config checks)
- Error handling and recovery paths
- Success criteria as checklists
- "Next Up" routing to guide users to the subsequent command

There are **30 workflows** total across 8 functional categories.

## Workflow Categories and Execution Order

The intended lifecycle sequence is:

```
1. new-project      (or map-codebase -> new-project for brownfield)
2. discuss-phase N  (optional, captures user vision)
3. plan-phase N     (creates PLAN.md files, includes research + plan-check)
4. execute-phase N  (spawns executors, runs plans, verifies goals)
5. verify-work N    (optional UAT with user)
6. transition       (marks phase complete, evolves PROJECT.md)
7. Repeat 2-6 for each phase
8. complete-milestone (archives, tags, prepares for next)
9. new-milestone    (starts next cycle)
```

**Categories:**

| Category | Workflows | Purpose |
|----------|-----------|---------|
| Core Workflow | new-project, discuss-phase, plan-phase, execute-phase, execute-plan, verify-phase, verify-work | The main build loop |
| Phase Management | add-phase, insert-phase, remove-phase, list-phase-assumptions | Modify the roadmap structure |
| Milestone Management | new-milestone, complete-milestone, audit-milestone, plan-milestone-gaps | Version lifecycle |
| Session Management | pause-work, resume-project, transition | Context preservation across sessions |
| Research | research-phase, discovery-phase, map-codebase | Knowledge gathering |
| Utilities | quick, help, progress, settings, set-profile, update | Configuration and status |
| Debugging | diagnose-issues | Root cause analysis |
| Todo Management | add-todo, check-todos | Idea capture and triage |

---

## Core Workflow

### new-project.md

**Purpose:** Initialize a new project from scratch through a unified flow: questioning, optional research, requirements definition, and roadmap creation. Described as "the most leveraged moment in any project."

**Invoked by:** `/gsd:new-project`

**Step-by-step process:**

1. **Setup** (mandatory first step)
   - Runs `gsd-tools.js init new-project` to get model profiles, project state flags, git status
   - Errors if project already exists (`project_exists: true`)
   - Initializes git if `has_git` is false

2. **Brownfield Offer**
   - If existing code detected but no codebase map (`needs_codebase_map: true`), offers to run `/gsd:map-codebase` first
   - Skipped in auto mode

3. **Deep Questioning**
   - Opens with freeform "What do you want to build?"
   - Follows threads with `AskUserQuestion` probing responses
   - References `questioning.md` for techniques (challenge vagueness, make abstract concrete, surface assumptions, find edges, reveal motivation)
   - Loops until user selects "Create PROJECT.md"
   - Skipped in auto mode (extracts from provided document)

4. **Write PROJECT.md**
   - Uses `templates/project.md` template
   - Greenfield: requirements as hypotheses (Active section)
   - Brownfield: infers Validated requirements from `ARCHITECTURE.md` and `STACK.md`
   - Includes Key Decisions table from questioning
   - Commits: `gsd-tools.js commit "docs: initialize project"`

5. **Workflow Preferences** (two rounds of `AskUserQuestion`)
   - Round 1: Mode (YOLO/Interactive), Depth (Quick/Standard/Comprehensive), Parallelization, Git tracking
   - Round 2: Research toggle, Plan Checker toggle, Verifier toggle, Model Profile (Quality/Balanced/Budget)
   - Creates `.planning/config.json`
   - If `commit_docs: No`, adds `.planning/` to `.gitignore`
   - Commits config.json

6. **Research Decision**
   - Offers "Research first" or "Skip research"
   - If research: spawns **4 parallel `gsd-project-researcher` agents** (Stack, Features, Architecture, Pitfalls)
   - Each writes to `.planning/research/{DIMENSION}.md` using templates from `templates/research-project/`
   - After all 4 complete, spawns **`gsd-research-synthesizer`** to create `SUMMARY.md`
   - Auto mode defaults to "Research first"

7. **Define Requirements**
   - Loads PROJECT.md context and research FEATURES.md (if exists)
   - Presents features by category with multi-select `AskUserQuestion` for v1 scoping
   - Generates `REQUIREMENTS.md` with REQ-IDs (`[CATEGORY]-[NUMBER]` format)
   - Quality criteria: specific/testable, user-centric, atomic, independent
   - Full list presented for user confirmation
   - Commits REQUIREMENTS.md

8. **Create Roadmap**
   - Spawns **`gsd-roadmapper`** agent with PROJECT.md, REQUIREMENTS.md, research SUMMARY.md, config.json
   - Roadmapper derives phases from requirements, maps every v1 requirement, writes ROADMAP.md, STATE.md, updates REQUIREMENTS.md traceability
   - Returns `## ROADMAP CREATED` or `## ROADMAP BLOCKED`
   - If blocked: resolve with user, re-spawn
   - If created: presents roadmap inline, asks for approval (interactive) or auto-approves (auto mode)
   - Revision loop if user selects "Adjust phases"
   - Commits ROADMAP.md, STATE.md, REQUIREMENTS.md

9. **Done** -- presents artifact summary table and next step: `/gsd:discuss-phase 1`

**Auto mode:** Triggered by `--auto` flag. Requires an `@` document reference. Skips brownfield mapping, deep questioning, category scoping loops, and approval gates. Auto-approves research, requirements, and roadmap.

**Agents spawned:**
- `gsd-project-researcher` (4x parallel, `researcher_model`)
- `gsd-research-synthesizer` (1x, `synthesizer_model`)
- `gsd-roadmapper` (1x+, `roadmapper_model`)

**Templates used:**
- `templates/project.md`
- `templates/research-project/STACK.md`
- `templates/research-project/FEATURES.md`
- `templates/research-project/ARCHITECTURE.md`
- `templates/research-project/PITFALLS.md`
- `templates/research-project/SUMMARY.md`

**gsd-tools.js commands:**
- `init new-project`
- `commit` (3 times: PROJECT.md, config.json, roadmap files)

**Files written:**
- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md` (if research selected)
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

**Key decision points:**
- Brownfield vs greenfield path
- Research yes/no
- Auto mode vs interactive
- Each category scoping (multi-select)
- Roadmap approval loop

---

### discuss-phase.md

**Purpose:** Extract implementation decisions that downstream agents need. Analyzes a phase to identify gray areas, lets the user choose which to discuss, then deep-dives each selected area until satisfied. Creates CONTEXT.md.

**Invoked by:** `/gsd:discuss-phase <number>`

**Philosophy:** User is the visionary/founder; Claude is the builder. Ask about vision and implementation choices, not technical details. Scope creep is explicitly guarded against -- new capabilities are deferred, not discussed.

**Step-by-step process:**

1. **Initialize** -- `gsd-tools.js init phase-op "${PHASE}"` to get phase directory, existence flags
2. **Check Existing** -- If CONTEXT.md already exists, offers Update/View/Skip
3. **Analyze Phase** -- Reads ROADMAP.md phase description, identifies gray areas by domain type (visual, API, CLI, organizational), generates phase-specific decision points (not generic categories)
4. **Present Gray Areas** -- States domain boundary, then `AskUserQuestion` (multiSelect) with 3-4 specific areas. No "skip" option -- user ran this command deliberately
5. **Discuss Areas** -- For each selected area: 4 questions (AskUserQuestion with concrete choices including "You decide"), then check "More questions" vs "Next area". Scope creep captured in "Deferred Ideas"
6. **Write Context** -- Creates `${phase_dir}/${padded_phase}-CONTEXT.md` with sections: Phase Boundary, Implementation Decisions (by category), Claude's Discretion, Specific Ideas, Deferred Ideas
7. **Confirm Creation** -- Summary of decisions captured, next step: `/gsd:plan-phase`
8. **Git Commit** -- `gsd-tools.js commit "docs(${padded_phase}): capture phase context"`

**Downstream awareness:** CONTEXT.md feeds into `gsd-phase-researcher` (what to research) and `gsd-planner` (what decisions are locked). Decisions = locked, Claude's Discretion = freedom areas, Deferred Ideas = out of scope.

**Agents spawned:** None (this is a conversational workflow)

**Templates used:** None (inline markdown structure)

**gsd-tools.js commands:**
- `init phase-op`
- `commit`

**Files written:**
- `.planning/phases/XX-name/XX-CONTEXT.md`

**Notable prompt engineering:** The gray area identification system adapts to domain type (visual features produce different questions than CLI tools or organizational tasks). The "4 questions, then check" rhythm prevents both under-exploring and over-asking.

---

### plan-phase.md

**Purpose:** Create executable phase prompts (PLAN.md files) with integrated research and verification. Orchestrates gsd-phase-researcher, gsd-planner, and gsd-plan-checker agents with a revision loop (max 3 iterations).

**Invoked by:** `/gsd:plan-phase <number>`

**Step-by-step process:**

1. **Initialize** -- `gsd-tools.js init plan-phase "$PHASE" --include state,roadmap,requirements,context,research,verification,uat` loads all context including file contents in a single call
2. **Parse and Normalize Arguments** -- Extracts phase number (supports decimals like `2.1`), flags (`--research`, `--skip-research`, `--gaps`, `--skip-verify`). If no phase number, detects next unplanned phase
3. **Validate Phase** -- `gsd-tools.js roadmap get-phase` confirms phase exists
4. **Load CONTEXT.md** -- Uses `context_content` from init (passed to all downstream agents)
5. **Handle Research**
   - Skip if: `--gaps`, `--skip-research`, or `research_enabled: false` without `--research` override
   - If research needed: spawns **`gsd-phase-researcher`** with phase description, requirements, prior decisions, and CONTEXT.md
   - Research prompt includes structured sections: `<objective>`, `<phase_context>` (decisions = locked, discretion = freedom, deferred = ignore), `<additional_context>`, `<output>`
6. **Check Existing Plans** -- If plans exist, offers: Add more, View existing, Replan from scratch
7. **Use Context Files from INIT** -- All file contents pre-loaded via `--include` flag (no re-reads needed)
8. **Spawn gsd-planner Agent** -- Rich prompt with `<planning_context>` (state, roadmap, requirements, context, research, gap closure data), `<downstream_consumer>` notes, `<quality_gate>` checklist
9. **Handle Planner Return** -- PLANNING COMPLETE / CHECKPOINT REACHED / PLANNING INCONCLUSIVE
10. **Spawn gsd-plan-checker Agent** (unless `--skip-verify` or `plan_checker_enabled: false`) -- Verification prompt with plans content, requirements, context, expected outputs (VERIFICATION PASSED / ISSUES FOUND)
11. **Handle Checker Return** -- VERIFICATION PASSED continues; ISSUES FOUND enters revision loop
12. **Revision Loop** (max 3 iterations) -- Sends issues back to planner with targeted revision instructions. After 3 iterations, offers: Force proceed / Provide guidance / Abandon
13. **Present Final Status** -- Phase planned banner with plan/wave summary

**Required reading:** `references/ui-brand.md`

**Agents spawned:**
- `gsd-phase-researcher` (1x, `researcher_model`) -- if research enabled
- `gsd-planner` (1x+, `planner_model`) -- initial + revisions
- `gsd-plan-checker` (1x+, `checker_model`) -- initial + re-checks after revisions

**gsd-tools.js commands:**
- `init plan-phase "$PHASE" --include ...`
- `roadmap get-phase`

**Files read:**
- `.planning/STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md` (via init --include)
- Phase CONTEXT.md, RESEARCH.md, VERIFICATION.md, UAT.md (via init --include)

**Files written:**
- `.planning/phases/XX-name/XX-RESEARCH.md` (by researcher agent)
- `.planning/phases/XX-name/XX-YY-PLAN.md` (by planner agent)

**Key decision points:**
- Research skip/force via flags
- Existing plans handling (add/view/replan)
- Plan checker pass/fail with revision loop
- Max 3 iteration limit with user override

---

### execute-phase.md

**Purpose:** Execute all plans in a phase using wave-based parallel execution. The orchestrator stays lean (~10-15% context) and delegates plan execution to subagents, each with fresh 200k context.

**Invoked by:** `/gsd:execute-phase <phase-number>`

**Step-by-step process:**

1. **Initialize** -- `gsd-tools.js init execute-phase "${PHASE_ARG}"` for models, parallelization config, branching strategy, plan inventory
2. **Handle Branching** -- If branching strategy is "phase" or "milestone", creates/checks out branch using pre-computed `branch_name`
3. **Validate Phase** -- Confirms plan_count > 0, state_exists
4. **Discover and Group Plans** -- `gsd-tools.js phase-plan-index "${PHASE_NUMBER}"` returns plans grouped by wave, skips plans with existing SUMMARY.md
5. **Execute Waves** -- For each wave in sequence:
   - Describes what's being built (substantive, not generic)
   - Spawns **`gsd-executor`** agents (parallel if `parallelization: true`, sequential if `false`)
   - Passes paths only -- executors read files themselves
   - Executor prompt includes references to `execute-plan.md`, `templates/summary.md`, `references/checkpoints.md`, `references/tdd.md`
   - Wait for all agents in wave
   - Spot-check claims: verify files exist, git commits present, no Self-Check: FAILED
   - Report completion with substantive descriptions
   - Handle failures (classifyHandoffIfNeeded bug detection)
6. **Checkpoint Handling** -- Plans with `autonomous: false` require user interaction. Agent returns structured state; orchestrator presents to user; fresh continuation agent spawned (not resumed)
7. **Aggregate Results** -- Wave-by-wave completion table
8. **Verify Phase Goal** -- Spawns **`gsd-verifier`** agent to check must_haves against actual codebase, creates VERIFICATION.md
9. **Handle Verification** -- `passed` -> update_roadmap; `human_needed` -> present human testing items; `gaps_found` -> offer `/gsd:plan-phase --gaps`
10. **Update Roadmap** -- Marks phase complete, commits
11. **Offer Next** -- Next phase or milestone complete banner

**Core principle:** "Orchestrator coordinates, not executes." Each subagent gets fresh 200k context. No polling (Task blocks). No context bleed.

**Agents spawned:**
- `gsd-executor` (Nx, `executor_model`) -- one per plan per wave
- `gsd-verifier` (1x, `verifier_model`)

**gsd-tools.js commands:**
- `init execute-phase`
- `phase-plan-index`
- `commit`

**Files read:** Plan files, STATE.md, config.json (by executors)

**Files written:**
- SUMMARY.md files (by executors)
- VERIFICATION.md (by verifier)
- Updated ROADMAP.md, STATE.md, REQUIREMENTS.md

**Failure handling:**
- `classifyHandoffIfNeeded` Claude Code bug detection: spot-check passes -> treat as success
- Agent fails mid-plan: report, ask user
- Dependency chain breaks: warn user, offer continue/skip
- All agents in wave fail: systemic issue, stop

**Resumption:** Re-running the command discovers completed SUMMARYs and skips them, resuming from first incomplete plan.

---

### execute-plan.md

**Purpose:** Execute a single PLAN.md file and create the outcome SUMMARY.md. This is the low-level execution workflow loaded by executor agents spawned from execute-phase.

**Invoked by:** gsd-executor agents (not directly by a slash command)

**Required reading:** `references/git-integration.md`

**Step-by-step process:**

1. **Init Context** -- `gsd-tools.js init execute-phase` with `--include state,config`
2. **Identify Plan** -- Find first PLAN without matching SUMMARY; yolo mode auto-approves, interactive waits for confirmation
3. **Record Start Time** -- Captures ISO timestamp and epoch for duration calculation
4. **Parse Segments** -- Checks for checkpoint types in the plan:
   - **Pattern A** (no checkpoints): Single subagent executes full plan + creates SUMMARY + commits
   - **Pattern B** (verify-only checkpoints): Segments between checkpoints; autonomous segments -> subagent, checkpoint segments -> main context
   - **Pattern C** (decision checkpoints): Execute entirely in main context
5. **Init Agent Tracking** -- Creates/maintains `agent-history.json` and `current-agent-id.txt` for interruption recovery
6. **Load Prompt** -- Reads PLAN.md as execution instructions
7. **Previous Phase Check** -- Checks for unresolved issues from prior SUMMARY
8. **Execute** -- Per task:
   - `type="auto"`: implement with deviation rules, TDD if flagged, verify done criteria, commit
   - `type="checkpoint:*"`: STOP, present checkpoint, wait for user
9. **Authentication Gates** -- Recognizes auth errors (401/403, "Not authenticated") as expected interaction points, creates dynamic checkpoint, waits for user to authenticate
10. **Deviation Rules** -- Four-tier system:
    - Rule 1 (Bug): Auto-fix broken behavior
    - Rule 2 (Missing Critical): Auto-add essentials (error handling, validation, auth, CSRF)
    - Rule 3 (Blocking): Auto-fix blockers
    - Rule 4 (Architectural): STOP, present decision to user
11. **TDD Execution** -- RED-GREEN-REFACTOR cycle with specific commit prefixes
12. **Task Commit Protocol** -- Individual staging (never `git add .`), typed commit messages (`feat/fix/test/refactor/perf/docs/style/chore`), phase-plan scope (`{type}({phase}-{plan}): {description}`)
13. **Generate User Setup** -- If `user_setup` in frontmatter, creates `USER-SETUP.md` from template
14. **Create Summary** -- Uses `templates/summary.md` with frontmatter (phase, plan, subsystem, tags, key-files, key-decisions, duration)
15. **Update STATE.md** -- `gsd-tools.js state advance-plan`, `state update-progress`, `state record-metric`, `state add-decision`, `state add-blocker`, `state record-session`
16. **Update Codebase Map** -- If `.planning/codebase/` exists, updates structural changes only (new dirs, deps, patterns)
17. **Offer Next** -- Routes to: A (more plans), B (phase done), C (milestone done)

**Templates used:**
- `templates/summary.md`
- `templates/user-setup.md` (conditional)

**References loaded:**
- `references/git-integration.md`
- `references/checkpoints.md`
- `references/tdd.md`

**gsd-tools.js commands:**
- `init execute-phase` (with `--include`)
- `state advance-plan`, `state update-progress`, `state record-metric`
- `state add-decision`, `state add-blocker`, `state record-session`
- `commit` (per task + metadata)
- `summary-extract` (for codebase map updates)

**Files written:**
- `.planning/phases/XX-name/XX-YY-SUMMARY.md`
- `.planning/phases/XX-name/XX-USER-SETUP.md` (conditional)
- `.planning/STATE.md` (updated)
- `.planning/ROADMAP.md` (updated)
- `.planning/codebase/*.md` (if exists, updated)
- `.planning/agent-history.json`

**Notable prompt engineering:** The deviation rules system is a sophisticated 4-tier decision framework with clear heuristics and escalation paths. The checkpoint protocol handles 3 types (human-verify 90%, decision 9%, human-action 1%) with specific resume signals.

---

### verify-phase.md

**Purpose:** Verify phase goal achievement through goal-backward analysis. Checks that the codebase delivers what the phase promised, not just that tasks completed. "Task completion != Goal achievement."

**Invoked by:** Spawned as a verifier subagent from `execute-phase.md`

**Required reading:**
- `references/verification-patterns.md`
- `templates/verification-report.md`

**Step-by-step process:**

1. **Load Context** -- `gsd-tools.js init phase-op` + `roadmap get-phase` to extract phase goal and requirements
2. **Establish Must-Haves** -- Option A: extract `must_haves` from PLAN frontmatter via `gsd-tools.js frontmatter get`. Option B: derive from phase goal (truths, artifacts, key links)
3. **Verify Truths** -- For each observable truth, checks if codebase enables it. Statuses: VERIFIED / FAILED / UNCERTAIN
4. **Verify Artifacts** -- `gsd-tools.js verify artifacts` checks each plan's must_haves. Three-level check:
   - Level 1: Exists on disk
   - Level 2: Substantive (not stub)
   - Level 3: Wired (imported AND used)
5. **Verify Wiring** -- `gsd-tools.js verify key-links` checks connections (Component->API, API->Database, Form->Handler, State->Render)
6. **Verify Requirements** -- Cross-references REQUIREMENTS.md against truths/artifacts
7. **Scan Anti-patterns** -- Searches for TODO/FIXME/HACK, placeholder content, empty returns, log-only functions. Categorizes as Blocker/Warning/Info
8. **Identify Human Verification** -- Visual appearance, user flow completion, real-time behavior, external integrations
9. **Determine Status** -- `passed` / `gaps_found` / `human_needed` with score (verified_truths / total_truths)
10. **Generate Fix Plans** -- If gaps_found: clusters related gaps, generates plan per cluster, orders by dependency
11. **Create Report** -- Writes VERIFICATION.md using template
12. **Return to Orchestrator** -- Status, score, report path, gaps/human items

**gsd-tools.js commands:**
- `init phase-op`
- `roadmap get-phase`
- `frontmatter get` (per plan)
- `verify artifacts` (per plan)
- `verify key-links` (per plan)

**Files written:**
- `.planning/phases/XX-name/XX-VERIFICATION.md`

---

### verify-work.md

**Purpose:** Validate built features through conversational user acceptance testing (UAT) with persistent state. User tests, Claude records. One test at a time, plain text responses.

**Invoked by:** `/gsd:verify-work [phase]`

**Philosophy:** "Show expected, ask if reality matches." Claude presents what SHOULD happen. User confirms or describes differences. No Pass/Fail buttons. No severity questions.

**Step-by-step process:**

1. **Initialize** -- `gsd-tools.js init verify-work` for phase context
2. **Check Active Sessions** -- Searches for existing `*-UAT.md` files. If found with no arguments, presents resumable sessions table. If found with arguments, offers resume or restart
3. **Find Summaries** -- Lists `*-SUMMARY.md` files in phase directory
4. **Extract Tests** -- Parses SUMMARY.md for user-observable outcomes, creates tests with expected behaviors
5. **Create UAT File** -- `.planning/phases/XX-name/{phase}-UAT.md` with frontmatter (status: testing), Current Test section, Tests section, Summary counts, Gaps section
6. **Present Test** -- Checkpoint box format with expected behavior and "Type 'pass' or describe what's wrong"
7. **Process Response** -- Pass (yes/y/ok/pass/next) / Skip (skip/can't test/n/a) / Issue (anything else). Severity auto-inferred from language (crash->blocker, doesn't work->major, slow->minor, color->cosmetic). NEVER asks "how severe?"
8. **Resume from File** -- Finds first `result: [pending]` test, continues from there
9. **Complete Session** -- Updates frontmatter, commits UAT file
10. **Diagnose Issues** -- If issues > 0, loads `diagnose-issues.md` workflow, spawns parallel debug agents
11. **Plan Gap Closure** -- Spawns `gsd-planner` in `--gaps` mode using diagnosed UAT
12. **Verify Gap Plans** -- Spawns `gsd-plan-checker`, enters revision loop (max 3 iterations)
13. **Present Ready** -- Shows fix plans table, ready for `/gsd:execute-phase --gaps-only`

**Template used:** `templates/UAT.md`

**Agents spawned:**
- Debug agents (via diagnose-issues workflow)
- `gsd-planner` (gap_closure mode, `planner_model`)
- `gsd-plan-checker` (`checker_model`)

**gsd-tools.js commands:**
- `init verify-work`
- `commit`

**Files written:**
- `.planning/phases/XX-name/{phase}-UAT.md`

**Update rules:** Batched writes for efficiency. Write to file on: issue found, session complete, or every 5 passed tests (safety net). Survives `/clear`.

---

## Phase Management

### add-phase.md

**Purpose:** Add a new integer phase to the end of the current milestone. Automatically calculates next phase number, creates directory, updates roadmap.

**Invoked by:** `/gsd:add-phase <description>`

**Process:**
1. Parse arguments -- entire argument string becomes phase description. Error if empty.
2. Init context -- `gsd-tools.js init phase-op "0"` to check roadmap exists
3. Add phase -- `gsd-tools.js phase add "${description}"` handles: finding highest phase number, calculating next, generating slug, creating directory, inserting into ROADMAP.md
4. Update STATE.md -- Adds "Phase N added" under Roadmap Evolution
5. Present completion with next step: `/gsd:plan-phase N`

**Agents spawned:** None

**gsd-tools.js commands:** `init phase-op`, `phase add`

**Files written:** `.planning/phases/{NN}-{slug}/` (directory), `.planning/ROADMAP.md` (updated), `.planning/STATE.md` (updated)

---

### insert-phase.md

**Purpose:** Insert a decimal phase for urgent work between existing integer phases. Uses decimal numbering (72.1, 72.2) to preserve logical sequence without renumbering.

**Invoked by:** `/gsd:insert-phase <after> <description>`

**Process:**
1. Parse arguments -- first arg is integer phase to insert after, remainder is description
2. Init context -- `gsd-tools.js init phase-op "${after_phase}"`
3. Insert phase -- `gsd-tools.js phase insert "${after_phase}" "${description}"` handles: verifying target exists, calculating decimal number, generating slug, creating directory, inserting into ROADMAP.md with `(INSERTED)` marker
4. Update STATE.md -- Adds "Phase N.M inserted after Phase N: description (URGENT)"
5. Present completion noting dependency implications

**Anti-patterns:** Don't use for planned work at end (use add-phase). Don't insert before Phase 1. Don't renumber existing phases. Don't create plans yet.

**Agents spawned:** None

**gsd-tools.js commands:** `init phase-op`, `phase insert`

**Files written:** `.planning/phases/{N.M}-{slug}/` (directory), `.planning/ROADMAP.md`, `.planning/STATE.md`

---

### remove-phase.md

**Purpose:** Remove an unstarted future phase, delete its directory, renumber all subsequent phases, and commit. Git commit serves as the historical record.

**Invoked by:** `/gsd:remove-phase <number>`

**Process:**
1. Parse arguments -- phase number (integer or decimal)
2. Init context -- `gsd-tools.js init phase-op "${target}"`
3. Validate future phase -- Target must be > current phase. Errors with "use /gsd:pause-work instead" if trying to remove current/past
4. Confirm removal -- Shows what will be deleted, asks y/n. Safety rail: always prompts
5. Execute removal -- `gsd-tools.js phase remove "${target}"` handles: deleting directory, renumbering subsequent directories (reverse order), renaming files inside directories, updating ROADMAP.md and STATE.md. Supports `--force` for phases with SUMMARY.md files
6. Commit -- `gsd-tools.js commit "chore: remove phase {target}"`
7. Present completion

**Anti-patterns:** Don't remove completed phases without --force. Don't manually renumber -- the CLI handles it.

**Agents spawned:** None

**gsd-tools.js commands:** `init phase-op`, `phase remove`, `commit`

**Files written/deleted:** Phase directory deleted, subsequent directories renamed, `.planning/ROADMAP.md`, `.planning/STATE.md`

---

### list-phase-assumptions.md

**Purpose:** Surface Claude's assumptions about a phase before planning, enabling users to correct misconceptions early. Purely conversational -- no file output.

**Invoked by:** `/gsd:list-phase-assumptions <number>`

**Process:**
1. Validate phase -- Checks ROADMAP.md for phase existence
2. Analyze phase -- Generates assumptions across 5 areas:
   - Technical Approach (libraries, frameworks, patterns)
   - Implementation Order (build sequence and rationale)
   - Scope Boundaries (included, excluded, ambiguous)
   - Risk Areas (expected complexity/challenges)
   - Dependencies (from prior phases, external, feeds into)
   - Each marked with confidence level (Fairly confident / Assuming / Unclear)
3. Present assumptions -- Clear format with all 5 sections + "What do you think?"
4. Gather feedback -- Acknowledges corrections or confirms assumptions
5. Offer next -- Discuss context / Plan phase / Re-examine / Done

**Key difference from discuss-phase:** This is ANALYSIS of what Claude thinks, not INTAKE of what user knows.

**Agents spawned:** None

**gsd-tools.js commands:** None (reads ROADMAP.md directly)

**Files written:** None

---

## Milestone Management

### new-milestone.md

**Purpose:** Start a new milestone cycle for an existing project. Brownfield equivalent of new-project. Loads existing context, gathers milestone goals, runs research, defines requirements, creates roadmap with phase numbering continuing from previous milestone.

**Invoked by:** `/gsd:new-milestone`

**Step-by-step process:**

1. **Load Context** -- Reads PROJECT.md, MILESTONES.md, STATE.md, checks for MILESTONE-CONTEXT.md
2. **Gather Milestone Goals** -- If MILESTONE-CONTEXT.md exists (from `/gsd:discuss-milestone`), uses it. Otherwise, presents last milestone's accomplishments and asks "What do you want to build next?"
3. **Determine Version** -- Parses last version from MILESTONES.md, suggests next (v1.0 -> v1.1 or v2.0)
4. **Update PROJECT.md** -- Adds Current Milestone section with goal and target features
5. **Update STATE.md** -- Resets position to "Not started (defining requirements)". Keeps Accumulated Context from previous milestone
6. **Cleanup and Commit** -- Deletes consumed MILESTONE-CONTEXT.md
7. **Init and Resolve Models** -- `gsd-tools.js init new-milestone`
8. **Research Decision** -- Same parallel 4-researcher pattern as new-project, but each researcher prompt includes `SUBSEQUENT MILESTONE` context emphasizing: don't re-research existing system, focus on new features
9. **Define Requirements** -- Same category-scoping pattern as new-project. REQ-ID numbering continues from existing
10. **Create Roadmap** -- Spawns `gsd-roadmapper` with starting phase number from last milestone's end
11. **Done** -- Presents initialized milestone with next step

**Agents spawned:**
- `gsd-project-researcher` (4x parallel, subsequent milestone context)
- `gsd-research-synthesizer` (1x)
- `gsd-roadmapper` (1x+)

**gsd-tools.js commands:**
- `init new-milestone`
- `config-set` (persists research choice)
- `commit` (multiple)

**Files written:** Updated `PROJECT.md`, `STATE.md`, research files, `REQUIREMENTS.md`, `ROADMAP.md`

---

### complete-milestone.md

**Purpose:** Mark a shipped version as complete. Creates historical record, performs full PROJECT.md evolution review, reorganizes ROADMAP.md, archives to milestones/, and tags release in git.

**Invoked by:** `/gsd:complete-milestone <version>`

**Step-by-step process:**

1. **Verify Readiness** -- `gsd-tools.js roadmap analyze` checks all phases complete (disk_status === 'complete', progress_percent 100%). Yolo mode auto-approves; interactive asks confirmation
2. **Gather Stats** -- Git commits, file changes, LOC, timeline
3. **Extract Accomplishments** -- `gsd-tools.js summary-extract` per SUMMARY.md for one-liners. Builds 4-6 key accomplishments
4. **Create Milestone Entry** -- MILESTONES.md entry auto-created by `gsd-tools milestone complete`
5. **Evolve PROJECT.md** (full review):
   - "What This Is" accuracy check
   - Core Value still correct?
   - Requirements audit: move shipped Active -> Validated, add new Active, audit Out of Scope
   - Context update (LOC, tech stack, known issues)
   - Key Decisions audit with outcomes
   - Constraints check
6. **Reorganize ROADMAP.md** -- Groups completed milestone phases in `<details>` collapsed section
7. **Archive Milestone** -- `gsd-tools.js milestone complete "v[X.Y]"` creates:
   - `.planning/milestones/v[X.Y]-ROADMAP.md`
   - `.planning/milestones/v[X.Y]-REQUIREMENTS.md`
   - MILESTONES.md entry
   - STATE.md updates
8. **Delete Originals** -- Removes ROADMAP.md and REQUIREMENTS.md (fresh for next milestone)
9. **Update State** -- Project Reference section refreshed
10. **Handle Branches** -- Detects branching strategy (none/phase/milestone). Offers: squash merge, merge with history, delete without merging, keep
11. **Git Tag** -- Creates annotated tag `v[X.Y]` with accomplishments. Asks about pushing to remote
12. **Commit Milestone** -- `gsd-tools.js commit "chore: complete v[X.Y] milestone"` with all archive files
13. **Offer Next** -- `/gsd:new-milestone`

**Required reading:**
- `templates/milestone.md`
- `templates/milestone-archive.md`

**Agents spawned:** None (all work done in main context)

**gsd-tools.js commands:**
- `roadmap analyze`
- `summary-extract` (per SUMMARY.md)
- `milestone complete`
- `commit`

**Files written/archived:**
- `.planning/milestones/v[X.Y]-ROADMAP.md`
- `.planning/milestones/v[X.Y]-REQUIREMENTS.md`
- `.planning/MILESTONES.md` (created/updated)
- `.planning/PROJECT.md` (evolved)
- `.planning/STATE.md` (updated)
- `.planning/ROADMAP.md` (deleted)
- `.planning/REQUIREMENTS.md` (deleted)

**Context efficiency:** Archives keep ROADMAP.md constant-size and REQUIREMENTS.md milestone-scoped.

---

### audit-milestone.md

**Purpose:** Verify milestone achieved its definition of done by aggregating phase verifications, checking cross-phase integration, and assessing requirements coverage.

**Invoked by:** `/gsd:audit-milestone [version]`

**Step-by-step process:**

1. **Initialize** -- `gsd-tools.js init milestone-op` + `resolve-model gsd-integration-checker`
2. **Determine Scope** -- `gsd-tools.js phases list`, parse version, identify phase directories
3. **Read All Phase Verifications** -- Reads each VERIFICATION.md, extracts status, gaps, anti-patterns, requirements coverage. Missing VERIFICATION.md = unverified phase (blocker)
4. **Spawn Integration Checker** -- `gsd-integration-checker` agent checks cross-phase wiring and E2E flows
5. **Collect Results** -- Combines phase-level gaps/debt + integration checker report
6. **Check Requirements Coverage** -- Maps each requirement to owning phase, checks phase verification status
7. **Create MILESTONE-AUDIT.md** -- YAML frontmatter with scores (requirements, phases, integration, flows), gaps, tech_debt. Status: `passed` / `gaps_found` / `tech_debt`
8. **Present Results** -- Routes by status:
   - `passed` -> offer `/gsd:complete-milestone`
   - `gaps_found` -> offer `/gsd:plan-milestone-gaps`
   - `tech_debt` -> offer either complete or plan cleanup

**Agents spawned:**
- `gsd-integration-checker` (1x, resolved model)

**gsd-tools.js commands:**
- `init milestone-op`
- `resolve-model gsd-integration-checker`
- `phases list`

**Files written:**
- `.planning/v{version}-MILESTONE-AUDIT.md`

---

### plan-milestone-gaps.md

**Purpose:** Create all phases necessary to close gaps identified by audit. Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md.

**Invoked by:** `/gsd:plan-milestone-gaps`

**Step-by-step process:**

1. **Load Audit Results** -- Finds most recent `v*-MILESTONE-AUDIT.md`, parses YAML frontmatter for structured gaps (requirements, integration, flows)
2. **Prioritize Gaps** -- Groups by priority from REQUIREMENTS.md: must (create phase, blocks milestone), should (create phase, recommended), nice (ask user: include or defer?)
3. **Group Gaps into Phases** -- Clustering rules: same affected phase -> combine, same subsystem -> combine, dependency order (fix stubs before wiring), keep phases focused (2-4 tasks each)
4. **Determine Phase Numbers** -- Continues from highest existing phase via `gsd-tools.js phases list`
5. **Present Gap Closure Plan** -- Shows proposed phases with gaps they close, tasks, deferred items. Asks for confirmation
6. **Update ROADMAP.md** -- Adds new phases with Goal, Requirements, Gap Closure marker
7. **Create Phase Directories** -- `mkdir -p .planning/phases/{NN}-{name}`
8. **Commit** -- `gsd-tools.js commit "docs(roadmap): add gap closure phases"`
9. **Offer Next** -- `/gsd:plan-phase {N}`, then after all gap phases: re-audit to verify

**Detailed gap-to-phase mapping:** Includes examples for requirement gaps (dashboard doesn't fetch -> add data fetching tasks), integration gaps (auth not passed to API -> add auth header tasks), and flow gaps (often overlap with other gap types).

**Agents spawned:** None

**gsd-tools.js commands:** `phases list`, `commit`

**Files written:** Phase directories, `.planning/ROADMAP.md`

---

## Session Management

### pause-work.md

**Purpose:** Create `.continue-here.md` handoff file to preserve complete work state across sessions. Enables seamless resumption.

**Invoked by:** `/gsd:pause-work`

**Step-by-step process:**

1. **Detect** -- Finds current phase from most recently modified files. Asks user if no active phase detected
2. **Gather** -- Collects: current position, work completed, work remaining, decisions made, blockers/issues, mental context ("the vibe"), files modified but not committed
3. **Write** -- Creates `.planning/phases/XX-name/.continue-here.md` with YAML frontmatter (phase, task, total_tasks, status, last_updated) and sections: current_state, completed_work, remaining_work, decisions_made, blockers, context, next_action
4. **Commit** -- `gsd-tools.js commit "wip: [phase-name] paused at task [X]/[Y]"`
5. **Confirm** -- Shows location and resume instruction: `/gsd:resume-work`

**gsd-tools.js commands:** `current-timestamp`, `commit`

**Files written:** `.planning/phases/XX-name/.continue-here.md`

---

### resume-project.md

**Purpose:** Instantly restore full project context. Answers "Where were we?" with an immediate, complete answer.

**Invoked by:** `/gsd:resume-work`

**Trigger conditions:** Starting new session, user says "continue"/"where were we?"/"resume", any planning operation when `.planning/` exists

**Required reading:** `references/continuation-format.md`

**Step-by-step process:**

1. **Initialize** -- `gsd-tools.js init resume` for state flags, interrupted agent detection
2. **Load State** -- Reads STATE.md and PROJECT.md, extracts position, progress, decisions, todos, blockers, session continuity
3. **Check Incomplete Work** -- Searches for:
   - `.continue-here.md` files (mid-plan resumption)
   - Plans without summaries (incomplete execution)
   - Interrupted agents (from `agent-history.json`)
4. **Present Status** -- Rich status box: building what, phase/plan position, progress bar, last activity, incomplete work warnings, pending todos, blockers
5. **Determine Next Action** -- Priority-based routing:
   - Interrupted agent -> Resume agent
   - .continue-here file -> Resume from checkpoint
   - Incomplete plan -> Complete it
   - Phase complete, all plans done -> Transition
   - Phase ready to plan -> Check for CONTEXT.md: if missing suggest discuss-phase, if exists suggest plan-phase
   - Phase ready to execute -> Execute next plan
6. **Offer Options** -- Contextual list based on state
7. **Route to Workflow** -- Shows command for next step (with `/clear` recommendation)
8. **Update Session** -- Records session resumption in STATE.md

**Reconstruction:** If STATE.md missing but artifacts exist, reconstructs from PROJECT.md, ROADMAP.md, SUMMARY.md files, todos, and .continue-here files.

**Quick resume:** If user says "continue" or "go", loads state silently, determines action, executes immediately without presenting options.

**gsd-tools.js commands:** `init resume`, `progress bar`

**Files read:** `.planning/STATE.md`, `PROJECT.md`, `.continue-here.md`, `agent-history.json`

**Files written:** `.planning/STATE.md` (session continuity update)

---

### transition.md

**Purpose:** Mark current phase complete and advance to next. The natural point where progress tracking and PROJECT.md evolution happen.

**Invoked by:** Internally after phase execution or explicitly when moving between phases

**Step-by-step process:**

1. **Load Project State** -- Reads STATE.md and PROJECT.md
2. **Verify Completion** -- Counts PLAN vs SUMMARY files. If counts match: yolo auto-approves, interactive asks. If incomplete: ALWAYS prompts (safety rail for destructive action of skipping plans)
3. **Cleanup Handoff** -- Deletes stale `.continue-here.md` files
4. **Update Roadmap and State** -- `gsd-tools.js phase complete "${current_phase}"` marks checkbox, updates plan count, updates Progress table, advances STATE.md to next phase, detects if last phase in milestone
5. **Archive Prompts** -- Phase prompts stay in place
6. **Evolve PROJECT.md** -- Full review:
   - Requirements validated? Move Active -> Validated
   - Requirements invalidated? Move to Out of Scope
   - Requirements emerged? Add to Active
   - Decisions to log? Extract from SUMMARY.md files
   - "What This Is" still accurate?
   - Update "Last updated" footer
7. **Update Position** -- Progress bar via `gsd-tools.js progress bar`
8. **Update Project Reference** -- STATE.md Project Reference section
9. **Review Accumulated Context** -- Decisions (3-5 max in STATE), resolved blockers removed, new concerns added
10. **Update Session Continuity** -- Timestamp and "Phase X complete, ready to plan Phase X+1"
11. **Offer Next Phase** -- Two routes:
    - **Route A (more phases):** Yolo auto-continues to `/gsd:plan-phase`, interactive shows next phase with options
    - **Route B (milestone complete):** Yolo auto-continues to `/gsd:complete-milestone`, interactive shows milestone complete banner

**Implicit tracking:** "Forward motion IS progress." Planning phase N implies phases 1-(N-1) complete.

**Partial completion:** If user wants to move on with incomplete plans, shows which are skipped and updates plan count honestly (e.g., "2/3 plans complete").

**gsd-tools.js commands:** `phase complete`, `progress bar`, `roadmap analyze`

**Files written:** `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/STATE.md`

---

## Research

### research-phase.md

**Purpose:** Standalone research command. Spawns gsd-phase-researcher with phase context. For most workflows, `/gsd:plan-phase` integrates research automatically.

**Invoked by:** `/gsd:research-phase <number>`

**Step-by-step process:**

1. **Resolve Model Profile** -- References `model-profile-resolution.md`
2. **Validate Phase** -- `gsd-tools.js roadmap get-phase`, references `phase-argument-parsing.md`
3. **Check Existing Research** -- If RESEARCH.md exists, offers update/view/skip
4. **Gather Phase Context** -- Phase description from roadmap, REQUIREMENTS.md, CONTEXT.md, decisions from `state-snapshot`
5. **Spawn Researcher** -- `gsd-phase-researcher` agent with objective, context, and output path
6. **Handle Return** -- RESEARCH COMPLETE (offer plan/dig deeper/review/done) / CHECKPOINT REACHED (present, spawn continuation) / RESEARCH INCONCLUSIVE (add context/try different mode/manual)

**References loaded:**
- `references/model-profile-resolution.md`
- `references/phase-argument-parsing.md`

**Agents spawned:** `gsd-phase-researcher` (1x, `researcher_model`)

**gsd-tools.js commands:** `roadmap get-phase`, `state-snapshot`

**Files written:** `.planning/phases/XX-name/XX-RESEARCH.md`

---

### discovery-phase.md

**Purpose:** Execute discovery at the appropriate depth level. Produces DISCOVERY.md that informs PLAN.md creation. Called from plan-phase.md's mandatory_discovery step.

**Invoked by:** Internally from `plan-phase.md` (not directly by a slash command)

**Three depth levels:**

| Level | Name | Time | Output |
|-------|------|------|--------|
| 1 (Quick Verify) | 2-5 min | No file, verbal confirmation | Single library syntax check |
| 2 (Standard) | 15-30 min | DISCOVERY.md | Choosing between options |
| 3 (Deep Dive) | 1+ hour | Comprehensive DISCOVERY.md | Architectural decisions |

**Source hierarchy (mandatory):** Context7 MCP FIRST -> Official docs -> WebSearch LAST (for comparisons only). All WebSearch findings cross-verified.

**Level 1 process:** Resolve library in Context7 -> fetch docs -> verify version/syntax -> if concerns, escalate to Level 2

**Level 2 process:** Identify options -> Context7 for each -> official docs for gaps -> WebSearch for comparisons -> cross-verify -> create DISCOVERY.md with recommendation

**Level 3 process:** Scope the discovery -> exhaustive Context7 -> deep official docs -> WebSearch for ecosystem context -> cross-verify ALL findings -> comprehensive DISCOVERY.md with quality report and source attribution -> confidence gate (LOW: present options, MEDIUM: note, HIGH: proceed)

**Templates used:** `templates/discovery.md`

**Files written:** `.planning/phases/XX-name/DISCOVERY.md` (Level 2-3 only)

**Notable:** DISCOVERY.md is NOT committed separately -- committed with phase completion.

---

### map-codebase.md

**Purpose:** Orchestrate parallel codebase mapper agents to analyze an existing codebase and produce 7 structured documents in `.planning/codebase/`.

**Invoked by:** `/gsd:map-codebase`

**Step-by-step process:**

1. **Init Context** -- `gsd-tools.js init map-codebase` for mapper model, existing maps status
2. **Check Existing** -- If `.planning/codebase/` exists, offers: Refresh (delete and remap), Update (specific documents), Skip
3. **Create Structure** -- `mkdir -p .planning/codebase`
4. **Spawn 4 Parallel Agents** -- All `gsd-codebase-mapper` type with `run_in_background: true`:
   - Agent 1 (Tech): writes STACK.md + INTEGRATIONS.md
   - Agent 2 (Architecture): writes ARCHITECTURE.md + STRUCTURE.md
   - Agent 3 (Quality): writes CONVENTIONS.md + TESTING.md
   - Agent 4 (Concerns): writes CONCERNS.md
5. **Collect Confirmations** -- Wait for all 4, read output files
6. **Verify Output** -- All 7 documents exist, each >20 lines
7. **Scan for Secrets** -- Regex check for API keys, tokens, private keys. If found: SECURITY ALERT, pause before commit
8. **Commit** -- `gsd-tools.js commit "docs: map existing codebase"`
9. **Offer Next** -- `/gsd:new-project`

**Philosophy:** Agents write documents directly. Orchestrator only receives confirmation + line counts (minimal context usage). Document quality over length. Always include file paths.

**Agents spawned:** `gsd-codebase-mapper` (4x parallel, `mapper_model`)

**gsd-tools.js commands:** `init map-codebase`, `commit`

**Files written:**
- `.planning/codebase/STACK.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`

---

## Utilities

### quick.md

**Purpose:** Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking) while skipping optional agents (research, plan-checker, verifier).

**Invoked by:** `/gsd:quick`

**Step-by-step process:**

1. **Get Task Description** -- `AskUserQuestion` for task description
2. **Initialize** -- `gsd-tools.js init quick "$DESCRIPTION"` for next number, slug, directory paths
3. **Create Task Directory** -- `.planning/quick/${next_num}-${slug}/`
4. **Spawn Planner** (quick mode) -- `gsd-planner` with constraints: single plan, 1-3 tasks, no research/checker, ~30% context
5. **Spawn Executor** -- `gsd-executor` with plan, constraints: execute all tasks, atomic commits, create summary, do NOT update ROADMAP.md
6. **Update STATE.md** -- Creates/updates "Quick Tasks Completed" table with number, description, date, commit hash, directory link
7. **Final Commit** -- Commits PLAN.md, SUMMARY.md, STATE.md

**Validation:** Requires ROADMAP.md to exist (active project), but can run mid-phase.

**Agents spawned:**
- `gsd-planner` (1x, quick mode, `planner_model`)
- `gsd-executor` (1x, `executor_model`)

**gsd-tools.js commands:** `init quick`, `commit`

**Files written:**
- `.planning/quick/NNN-slug/NNN-PLAN.md`
- `.planning/quick/NNN-slug/NNN-SUMMARY.md`
- `.planning/STATE.md` (quick tasks table)

---

### help.md

**Purpose:** Display the complete GSD command reference. Output ONLY the reference content -- no project-specific analysis, git status, or commentary.

**Invoked by:** `/gsd:help`

**Content:** A comprehensive command reference document (~470 lines) organized into:
- Quick Start (3-step flow)
- Core Workflow (new-project, map-codebase, discuss-phase, research-phase, list-phase-assumptions, plan-phase, execute-phase)
- Quick Mode
- Roadmap Management (add-phase, insert-phase, remove-phase)
- Milestone Management (new-milestone, complete-milestone)
- Progress Tracking
- Session Management (resume-work, pause-work)
- Debugging
- Todo Management (add-todo, check-todos)
- User Acceptance Testing (verify-work)
- Milestone Auditing (audit-milestone, plan-milestone-gaps)
- Configuration (settings, set-profile)
- Utility Commands (help, update, join-discord)
- Files & Structure (directory tree)
- Workflow Modes (Interactive vs YOLO)
- Planning Configuration (commit_docs, search_gitignored)
- Common Workflows (examples)

**Agents spawned:** None. **gsd-tools.js commands:** None. **Files written:** None.

This is a static reference document embedded directly in the workflow file.

---

### progress.md

**Purpose:** Check project progress, summarize recent work, and intelligently route to the next action. The "what's next?" command.

**Invoked by:** `/gsd:progress`

**Step-by-step process:**

1. **Init Context** -- `gsd-tools.js init progress --include state,roadmap,project,config` loads all file contents in one call
2. **Load** -- Uses pre-loaded state_content, roadmap_content, project_content, config_content
3. **Analyze Roadmap** -- `gsd-tools.js roadmap analyze` for structured JSON with all phases, disk status, plan/summary counts, progress percent
4. **Recent** -- Finds 2-3 most recent SUMMARY.md files, uses `summary-extract` for one-liners
5. **Position** -- Current/next phase, paused_at, pending todos, active debug sessions
6. **Report** -- Rich status: progress bar (from `gsd-tools.js progress bar`), recent work, current position (with CONTEXT status), decisions, blockers, pending todos, active debug sessions
7. **Route** -- Multi-step routing logic:
   - Check for UAT gaps needing fixes -> **Route E** (plan-phase --gaps)
   - Unexecuted plans exist -> **Route A** (execute-phase)
   - Phase complete, plans > 0 -> Check milestone status (Step 3)
   - No plans yet -> **Route B** (checks for CONTEXT.md: if missing suggests discuss-phase, if exists suggests plan-phase)
   - More phases remain -> **Route C** (discuss-phase for next phase)
   - Milestone complete -> **Route D** (complete-milestone)
   - Between milestones (ROADMAP.md missing, PROJECT.md exists) -> **Route F** (new-milestone)

**gsd-tools.js commands:** `init progress --include`, `roadmap analyze`, `summary-extract`, `progress bar`

**Files read:** STATE.md, ROADMAP.md, PROJECT.md, config.json, SUMMARY.md files, UAT.md files

**Files written:** None (read-only status check)

---

### settings.md

**Purpose:** Interactive configuration of workflow agents and model profile. Updates `.planning/config.json`.

**Invoked by:** `/gsd:settings`

**Step-by-step process:**

1. **Ensure and Load Config** -- `gsd-tools.js config-ensure-section` + `state load`
2. **Read Current** -- Parses config.json for workflow toggles, model_profile, branching_strategy
3. **Present Settings** -- 5-question `AskUserQuestion`:
   - Model Profile (Quality/Balanced/Budget)
   - Plan Researcher (Yes/No)
   - Plan Checker (Yes/No)
   - Execution Verifier (Yes/No)
   - Git Branching Strategy (None/Per Phase/Per Milestone)
4. **Update Config** -- Merges into config.json with model_profile, workflow, and git sections
5. **Confirm** -- Shows settings table with quick command references

**gsd-tools.js commands:** `config-ensure-section`, `state load`

**Files written:** `.planning/config.json`

---

### set-profile.md

**Purpose:** Quick switch model profile for GSD agents without the full settings flow.

**Invoked by:** `/gsd:set-profile <profile>`

**Step-by-step process:**

1. **Validate** -- Argument must be one of: quality, balanced, budget
2. **Ensure and Load Config** -- `gsd-tools.js config-ensure-section` + `state load`
3. **Update Config** -- Sets `model_profile` field in config.json
4. **Confirm** -- Shows agent-to-model mapping table for selected profile

**gsd-tools.js commands:** `config-ensure-section`, `state load`

**Files written:** `.planning/config.json`

---

### update.md

**Purpose:** Check for GSD updates via npm, display changelog, obtain confirmation, and execute clean installation.

**Invoked by:** `/gsd:update`

**Step-by-step process:**

1. **Get Installed Version** -- Checks `.claude/get-shit-done/VERSION` (local first, then global)
2. **Check Latest** -- `npm view get-shit-done-cc version`
3. **Compare Versions** -- If current, exit. If ahead, note development version
4. **Show Changes and Confirm** -- Fetches changelog from GitHub, extracts entries between versions. Shows clean install warning (commands/gsd/ wiped, agents/gsd-* replaced). Notes that local modifications backed up to `gsd-local-patches/`. `AskUserQuestion`: "Yes, update now" / "No, cancel"
5. **Run Update** -- `npx get-shit-done-cc --local` or `--global` based on install type. Clears update cache
6. **Display Result** -- Version change banner, restart reminder
7. **Check Local Patches** -- If `gsd-local-patches/backup-meta.json` exists, suggests `/gsd:reapply-patches`

**gsd-tools.js commands:** None (uses npm and shell commands)

**Files written:** None (installer handles file changes)

---

## Debugging

### diagnose-issues.md

**Purpose:** Orchestrate parallel debug agents to investigate UAT gaps and find root causes. "Diagnose before planning fixes." Called from verify-work.md when issues are found.

**Invoked by:** `verify-work.md` (not directly by a slash command)

**Core principle:** UAT tells us WHAT is broken (symptoms). Debug agents find WHY (root cause). plan-phase --gaps creates targeted fixes based on actual causes.

**Step-by-step process:**

1. **Parse Gaps** -- Extracts YAML gaps from UAT.md Gaps section. For each gap, also reads corresponding test for full context. Builds structured gap list
2. **Report Plan** -- Shows table of gaps being investigated with severity
3. **Spawn Agents** -- One debug agent per gap, all spawned in parallel (single message). Each agent:
   - Creates `DEBUG-{slug}.md` with symptoms pre-filled
   - Investigates autonomously (read code, form hypotheses, test)
   - Returns root cause with evidence
4. **Collect Results** -- Parses each return for root_cause, files involved, debug_path, suggested_fix. Handles `## INVESTIGATION INCONCLUSIVE` gracefully
5. **Update UAT** -- For each gap: adds `root_cause`, `artifacts` (files + issues), `missing` (what needs fixing), `debug_session` path. Updates frontmatter status to "diagnosed". Commits updated UAT.md
6. **Report Results** -- Shows gap-to-root-cause table, returns to verify-work orchestrator for automatic planning

**Paths:** DEBUG_DIR = `.planning/debug`

**Context efficiency:** Agents start with symptoms pre-filled (no symptom gathering needed). Agents only diagnose -- plan-phase --gaps handles fixes.

**Failure handling:** Agent can't find root cause -> "needs manual review", continue with others. Agent times out -> check partial progress in DEBUG file. All fail -> fall back to plan-phase --gaps without root causes.

**gsd-tools.js commands:** `commit`

**Files written:**
- `.planning/debug/{slug}.md` (per gap, by debug agents)
- `.planning/phases/XX-name/{phase}-UAT.md` (updated with diagnoses)

---

## Todo Management

### add-todo.md

**Purpose:** Capture an idea, task, or issue that surfaces during a session as a structured todo. Enables "thought -> capture -> continue" flow.

**Invoked by:** `/gsd:add-todo [description]`

**Step-by-step process:**

1. **Init Context** -- `gsd-tools.js init todos` for date, timestamp, todo count, existing areas. Creates directories: `.planning/todos/pending/` and `.planning/todos/done/`
2. **Extract Content** -- With arguments: uses as title. Without arguments: analyzes recent conversation for problem, idea, file paths, technical details. Formulates title (3-10 words, action verb), problem, solution, files
3. **Infer Area** -- Maps file path patterns to areas (src/api -> api, src/components -> ui, tests -> testing, etc.). Uses existing areas for consistency
4. **Check Duplicates** -- Searches pending todos for similar titles. If found: offers Skip/Replace/Add anyway
5. **Create File** -- Generates slug via `gsd-tools.js generate-slug`. Writes to `.planning/todos/pending/${date}-${slug}.md` with YAML frontmatter (created, title, area, files) and Problem/Solution sections
6. **Update State** -- Updates STATE.md "Pending Todos" section
7. **Git Commit** -- `gsd-tools.js commit "docs: capture todo - [title]"`
8. **Confirm** -- Shows todo details, offers: continue current work, add another, view all todos

**gsd-tools.js commands:** `init todos`, `generate-slug`, `commit`

**Files written:**
- `.planning/todos/pending/${date}-${slug}.md`
- `.planning/STATE.md` (updated todo count)

---

### check-todos.md

**Purpose:** List pending todos, allow selection, load full context, and route to appropriate action.

**Invoked by:** `/gsd:check-todos [area]`

**Step-by-step process:**

1. **Init Context** -- `gsd-tools.js init todos` for todo_count, todos array, pending_dir. If count is 0: displays "No pending todos" with options
2. **Parse Filter** -- Optional area filter from arguments (e.g., `/gsd:check-todos api`)
3. **List Todos** -- Numbered list with title, area, relative age
4. **Handle Selection** -- User replies with number to view details
5. **Load Context** -- Reads full todo file, displays title, area, created date, files, problem, solution. If files listed, briefly summarizes each
6. **Check Roadmap** -- If ROADMAP.md exists, checks if todo's area or files match an upcoming phase
7. **Offer Actions** -- Context-dependent options:
   - If maps to roadmap phase: "Work on it now" / "Add to phase plan" / "Brainstorm approach" / "Put it back"
   - If no roadmap match: "Work on it now" / "Create a phase" / "Brainstorm approach" / "Put it back"
8. **Execute Action**:
   - Work on it now: moves to `done/`, updates STATE.md, presents context
   - Add to phase plan: notes reference, keeps in pending
   - Create a phase: shows `/gsd:add-phase` command
   - Brainstorm: keeps in pending, starts discussion
   - Put it back: returns to list
9. **Update State** -- Re-runs init todos for updated count
10. **Git Commit** -- If todo moved to done: `gsd-tools.js commit "docs: start work on todo - [title]"`

**gsd-tools.js commands:** `init todos`, `commit`

**Files read:** `.planning/todos/pending/*.md`, `.planning/ROADMAP.md`

**Files written/moved:** `.planning/todos/done/` (moved from pending), `.planning/STATE.md`

---

## Common Patterns Across Workflows

### Initialization Pattern

Nearly every workflow starts with a `gsd-tools.js init <command>` call that returns a JSON object with:
- Model assignments (resolved from config.json's model_profile)
- Feature flags (from config.json's workflow section)
- File existence checks (has_research, has_context, has_plans, etc.)
- Directory paths (phase_dir, padded_phase, phase_slug)
- Optionally, full file contents via `--include` flag (avoiding redundant reads)

This single-call pattern replaces what would otherwise be 5-10 separate file reads and config checks.

### Agent Spawning Pattern

All agent spawns follow the same structure:
```
Task(
  prompt="<structured_prompt_with_xml_tags>",
  subagent_type="{agent-name}",
  model="{model_from_init}",
  description="{human-readable label}"
)
```

The prompt typically includes:
- The agent's own instructions file reference (`~/.claude/agents/gsd-{name}.md`)
- Context via XML-tagged sections (`<planning_context>`, `<research_type>`, `<objective>`, etc.)
- Quality gates as checklists
- Output file paths
- Downstream consumer notes (who reads this agent's output)

### Commit Pattern

All commits go through `gsd-tools.js commit`:
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js commit "{message}" --files {paths}
```

This respects `commit_docs` config (skips if false), handles Co-Authored-By formatting, and uses conventional commit prefixes (docs, feat, fix, chore, test, refactor, perf, style, wip).

### "Next Up" Pattern

Every workflow ends with a structured "Next Up" section:
```
---
## Next Up

**{Action}** -- {description}

`/gsd:{command} {args}`

<sub>`/clear` first -> fresh context window</sub>

---

**Also available:**
- alternative commands

---
```

This consistent routing guides users through the workflow chain.

### Mode Branching Pattern

Most workflows check `mode` from config.json:
- **YOLO mode:** Auto-approves, auto-continues, minimal prompts
- **Interactive mode:** Confirms at each step, presents options, waits for user

Safety rails (`always_confirm_destructive`) override YOLO for destructive actions (skipping incomplete plans, removing phases).

### Revision Loop Pattern

Used by plan-phase and verify-work:
1. Agent produces output
2. Checker verifies output
3. If issues: send back to agent with structured issues
4. Increment iteration count
5. Repeat up to max 3 iterations
6. If still failing: offer Force/Guidance/Abandon

### State Update Pattern

Most workflows update STATE.md after completing their work:
- Current Position (phase, plan, status)
- Accumulated Context (decisions, blockers)
- Session Continuity (timestamp, stopped-at, resume file)
- Progress bar (via `gsd-tools.js progress bar`)

---

## Cross-References

### Workflow-to-Command Mapping

The mapping is essentially 1:1, with each command loading its corresponding workflow:

| Command | Workflow |
|---------|----------|
| `/gsd:new-project` | `new-project.md` |
| `/gsd:discuss-phase` | `discuss-phase.md` |
| `/gsd:plan-phase` | `plan-phase.md` |
| `/gsd:execute-phase` | `execute-phase.md` |
| `/gsd:verify-work` | `verify-work.md` |
| `/gsd:add-phase` | `add-phase.md` |
| `/gsd:insert-phase` | `insert-phase.md` |
| `/gsd:remove-phase` | `remove-phase.md` |
| `/gsd:list-phase-assumptions` | `list-phase-assumptions.md` |
| `/gsd:new-milestone` | `new-milestone.md` |
| `/gsd:complete-milestone` | `complete-milestone.md` |
| `/gsd:audit-milestone` | `audit-milestone.md` |
| `/gsd:plan-milestone-gaps` | `plan-milestone-gaps.md` |
| `/gsd:pause-work` | `pause-work.md` |
| `/gsd:resume-work` | `resume-project.md` |
| `/gsd:research-phase` | `research-phase.md` |
| `/gsd:map-codebase` | `map-codebase.md` |
| `/gsd:quick` | `quick.md` |
| `/gsd:help` | `help.md` |
| `/gsd:progress` | `progress.md` |
| `/gsd:settings` | `settings.md` |
| `/gsd:set-profile` | `set-profile.md` |
| `/gsd:update` | `update.md` |
| `/gsd:add-todo` | `add-todo.md` |
| `/gsd:check-todos` | `check-todos.md` |

**Internally-invoked workflows (no direct slash command):**
- `execute-plan.md` -- loaded by gsd-executor agents
- `verify-phase.md` -- loaded by gsd-verifier agents
- `discovery-phase.md` -- loaded from plan-phase.md
- `diagnose-issues.md` -- loaded from verify-work.md
- `transition.md` -- loaded from execute-phase.md or manually

### Workflow-to-Agent Mapping

| Agent | Spawned by |
|-------|-----------|
| `gsd-project-researcher` | new-project, new-milestone (4x parallel) |
| `gsd-research-synthesizer` | new-project, new-milestone |
| `gsd-roadmapper` | new-project, new-milestone |
| `gsd-phase-researcher` | plan-phase, research-phase |
| `gsd-planner` | plan-phase, verify-work (gap_closure), quick |
| `gsd-plan-checker` | plan-phase, verify-work |
| `gsd-executor` | execute-phase, quick |
| `gsd-verifier` | execute-phase |
| `gsd-codebase-mapper` | map-codebase (4x parallel) |
| `gsd-integration-checker` | audit-milestone |
| debug agents (general-purpose) | diagnose-issues |

### Workflow-to-Template Mapping

| Template | Used by |
|----------|---------|
| `templates/project.md` | new-project |
| `templates/research-project/*.md` | new-project, new-milestone |
| `templates/summary.md` | execute-plan |
| `templates/user-setup.md` | execute-plan |
| `templates/verification-report.md` | verify-phase |
| `templates/UAT.md` | verify-work |
| `templates/discovery.md` | discovery-phase |
| `templates/milestone.md` | complete-milestone |
| `templates/milestone-archive.md` | complete-milestone |

### Workflow-to-Reference Mapping

| Reference | Used by |
|-----------|---------|
| `references/ui-brand.md` | plan-phase |
| `references/git-integration.md` | execute-plan |
| `references/checkpoints.md` | execute-plan, execute-phase |
| `references/tdd.md` | execute-plan, execute-phase |
| `references/verification-patterns.md` | verify-phase |
| `references/model-profile-resolution.md` | research-phase |
| `references/phase-argument-parsing.md` | research-phase |
| `references/continuation-format.md` | resume-project |

### Dependency Chain

**Must run before others:**

```
new-project (or map-codebase -> new-project)
  |
  +-- discuss-phase N (optional, creates CONTEXT.md)
  |
  +-- plan-phase N (creates PLAN.md files)
  |     |
  |     +-- [discovery-phase] (internal, creates DISCOVERY.md)
  |     +-- [research-phase] (creates RESEARCH.md)
  |
  +-- execute-phase N (creates SUMMARY.md, VERIFICATION.md)
  |     |
  |     +-- [execute-plan] (internal, per plan)
  |     +-- [verify-phase] (internal, creates VERIFICATION.md)
  |
  +-- verify-work N (optional, creates UAT.md)
  |     |
  |     +-- [diagnose-issues] (internal, if issues found)
  |
  +-- transition (marks phase complete, next phase)
  |
  +-- [repeat for each phase]
  |
  +-- audit-milestone (optional, creates MILESTONE-AUDIT.md)
  |     |
  |     +-- plan-milestone-gaps (if gaps found)
  |
  +-- complete-milestone (archives, tags)
  |
  +-- new-milestone (starts next cycle)
```

**Independent (can run anytime after new-project):**
- progress (read-only status)
- help (static reference)
- settings / set-profile (config changes)
- update (npm update)
- add-todo / check-todos (todo management)
- quick (ad-hoc tasks)
- pause-work / resume-work (session management)
- add-phase / insert-phase / remove-phase (roadmap modification)
- list-phase-assumptions (conversational)
