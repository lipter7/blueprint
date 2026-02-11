# GSD References

## Overview

References are standalone knowledge documents stored in `get-shit-done/references/`. They serve as shared, reusable instruction sets and data definitions that are injected into command prompts, workflow files, agent definitions, and templates via the `@~/.claude/get-shit-done/references/<name>.md` inclusion pattern.

References are **not** executed directly. They are loaded (pulled into context) by orchestrator commands, subagent prompts, workflow files, and templates at the point where their knowledge is needed. This keeps individual prompts lean while ensuring consistent behavior across the system. A reference might define how git commits should be formatted, how to verify code is real (not stubs), or what visual patterns to use for user-facing output.

There are 13 reference files in total. They range from foundational (used by 5+ files) to highly specialized (used by 1-2 files or only referenced internally by other references). Some are purely prescriptive (instructions/rules), some are descriptive (data tables/schemas), and several are mixed.

### How References Are Loaded

References are included in prompts using the `@` file-path syntax, which causes Claude Code to read the file contents into the current context. The canonical path pattern is:

```
@~/.claude/get-shit-done/references/<name>.md
```

The installer replaces `~/.claude/` with the appropriate runtime-specific path for OpenCode and Gemini installations.

### Role in the System

References occupy a specific layer in the GSD architecture:

- **Commands** (orchestrators) reference them for UI patterns, questioning guides, and model profiles
- **Workflows** (step-by-step instructions) reference them for git integration, verification patterns, and phase parsing
- **Agents** (specialized subagents) reference them for checkpoint behavior and commit patterns
- **Templates** (scaffolding) reference them for checkpoint patterns and TDD structure
- **Other references** can cross-reference each other (model-profile-resolution references model-profiles)

---

## Reference Usage Map

| Reference File | Loaded By (Commands) | Loaded By (Workflows) | Loaded By (Agents) | Loaded By (Templates) | Loaded By (Other Refs) | Usage Breadth |
|---|---|---|---|---|---|---|
| `checkpoints.md` | -- | `execute-phase.md`, `execute-plan.md` | `gsd-executor.md` | `phase-prompt.md` (x3) | `verification-patterns.md` | **Foundational** (6 references) |
| `continuation-format.md` | -- | `resume-project.md` | -- | -- | -- | Specialized (1 reference) |
| `decimal-phase-calculation.md` | -- | -- (concepts used in `insert-phase.md`) | -- | -- | -- | Specialized (0 direct `@` refs) |
| `git-integration.md` | -- | `execute-plan.md` | -- | -- | -- | Specialized (1 reference) |
| `git-planning-commit.md` | -- | -- | -- | -- | -- | Specialized (0 direct `@` refs) |
| `model-profile-resolution.md` | -- | `research-phase.md` | -- | -- | -- | Specialized (1 reference) |
| `model-profiles.md` | -- | -- | -- | -- | `model-profile-resolution.md` | Specialized (1 reference) |
| `phase-argument-parsing.md` | -- | `research-phase.md` | -- | -- | -- | Specialized (1 reference) |
| `planning-config.md` | -- | -- | -- | -- | -- | Specialized (0 direct `@` refs) |
| `questioning.md` | `new-project.md`, `new-milestone.md` | -- | -- | -- | -- | Moderate (2 references) |
| `tdd.md` | -- | `execute-phase.md`, `execute-plan.md` | -- | `phase-prompt.md` | -- | Moderate (3 references) |
| `ui-brand.md` | `execute-phase.md`, `new-project.md`, `new-milestone.md`, `plan-phase.md` | `plan-phase.md` | -- | -- | -- | **Foundational** (5 references) |
| `verification-patterns.md` | -- | `verify-phase.md` | -- | -- | -- | Specialized (1 reference) |

### Usage Classification

**Foundational references** (used across many files):
- `ui-brand.md` -- 5 direct references across commands and workflows
- `checkpoints.md` -- 6 direct references across workflows, agents, templates, and other references

**Moderate references** (used by 2-3 files):
- `questioning.md` -- 2 command references
- `tdd.md` -- 3 references across workflows and templates

**Specialized references** (used by 0-1 files directly, or serve as internal documentation):
- `continuation-format.md`, `decimal-phase-calculation.md`, `git-integration.md`, `git-planning-commit.md`, `model-profile-resolution.md`, `model-profiles.md`, `phase-argument-parsing.md`, `planning-config.md`, `verification-patterns.md`

Note: Some "specialized" references like `planning-config.md` and `git-planning-commit.md` have **zero direct `@` inclusions** but define concepts (`commit_docs`, `branching_strategy`, `gsd-tools.js commit`) that are used pervasively across the system. Their knowledge is implemented in `gsd-tools.js` rather than injected into prompts.

---

## checkpoints.md

### Summary

The largest reference file (775 lines). Defines the complete checkpoint system -- formalized human-in-the-loop interaction points during autonomous plan execution. This is the authoritative document for when and how to pause automation to involve the user.

### Content Type

**Prescriptive** (instructions and rules) with extensive examples.

### Structure

The file uses XML wrapper tags to organize content into clear sections:

| Section | Tag | Purpose |
|---|---|---|
| Overview | `<overview>` | Core principle and golden rules |
| Checkpoint Types | `<checkpoint_types>` with nested `<type>` tags | Three checkpoint categories with structures and examples |
| Execution Protocol | `<execution_protocol>` | How to display and handle checkpoints at runtime |
| Authentication Gates | `<authentication_gates>` | Dynamic checkpoint pattern for auth errors |
| Automation Reference | `<automation_reference>` | CLI/API reference tables for what can be automated |
| Writing Guidelines | `<writing_guidelines>` | Do/don't rules for writing checkpoints |
| Examples | `<examples>` | Full workflow examples showing correct checkpoint usage |
| Anti-Patterns | `<anti_patterns>` | Detailed bad/good comparisons |
| Summary | `<summary>` | Concise recap of priority and rules |

### Key Concepts

1. **Core Principle**: "Claude automates everything with CLI/API. Checkpoints are for verification and decisions, not manual work."

2. **Four Golden Rules**:
   - If Claude can run it, Claude runs it
   - Claude sets up the verification environment
   - User only does what requires human judgment
   - Secrets come from user, automation comes from Claude

3. **Three Checkpoint Types**:
   - `checkpoint:human-verify` (90%) -- Claude completed automated work, human confirms visual/functional correctness
   - `checkpoint:decision` (9%) -- Human must make architectural/technology choice
   - `checkpoint:human-action` (1%) -- Truly unavoidable manual steps (email verification, 2FA, OAuth browser flows)

4. **XML Task Structure**: Each checkpoint type has a defined XML structure with specific elements (`<what-built>`, `<how-to-verify>`, `<resume-signal>` for human-verify; `<decision>`, `<options>`, `<context>` for decision; `<action>`, `<instructions>`, `<verification>` for human-action)

5. **Authentication Gates**: Dynamic checkpoints created on-the-fly when Claude encounters auth errors during automation. Pattern: try automation -> auth error -> create checkpoint -> user authenticates -> Claude retries -> continues.

6. **Visual Display Format**: Uses Unicode box-drawing characters for checkpoint display (double-line box at top, single-line separator for action prompt).

### Automation Reference Tables

Contains extensive reference tables for:
- Service CLIs and auth gates (Vercel, Railway, Fly, Stripe, Supabase, etc.)
- Environment variable automation commands per platform
- Dev server start commands and ready signals per framework
- CLI installation handling (auto-install vs user choice)
- Pre-checkpoint failure handling (fix before presenting checkpoint)
- Automatable vs non-automatable action quick reference

### GSD-Specific Tooling

No direct `gsd-tools.js` calls -- this reference is about execution behavior patterns rather than tooling.

### Prompt Engineering Techniques

- **Extensive anti-pattern documentation**: Every good pattern is paired with a bad pattern, making it hard to accidentally follow the wrong approach
- **Percentage distribution** (90/9/1) gives the model a strong prior for which checkpoint type to select
- **"Never present a checkpoint with broken verification environment"** is repeated with examples to prevent a common failure mode
- **XML structure templates** provide copy-paste-able patterns for the model to follow

### Loaded By

- Workflow: `execute-phase.md`, `execute-plan.md`
- Agent: `gsd-executor.md`
- Template: `phase-prompt.md` (3 separate inclusions)
- Cross-reference: `verification-patterns.md` (refers to the `<automation_reference>` section)

---

## continuation-format.md

### Summary

Defines the standard "Next Up" block format displayed after completing a command or workflow, guiding the user to their next action. A UX consistency document.

### Content Type

**Prescriptive** (UI format specification with variants).

### Structure

Plain markdown with code block examples showing different variants of the continuation format.

### Key Concepts

1. **Core Structure**: A visually separated block with:
   - `---` separators above and below
   - `## ▶ Next Up` header
   - Bold identifier + name + description
   - Copy-pasteable command in backticks
   - `/clear` explanation in `<sub>` tags
   - "Also available" alternative options

2. **Six Variants**:
   - Execute next plan
   - Execute final plan in phase (adds "Final plan in Phase N" note)
   - Plan a phase
   - Phase complete, ready for next (shows completion status first)
   - Multiple equal options (no single primary action)
   - Milestone complete (uses celebration emoji)

3. **Context Pulling Rules**:
   - For phases: Extract from `ROADMAP.md` phase name and goal
   - For plans: Extract from `ROADMAP.md` plan list or `PLAN.md` `<objective>` tag

4. **Format Rules**:
   - Always show what it is (name + description), never just a command
   - Command in inline backticks (renders as clickable link in Claude Code)
   - Always include `/clear` explanation
   - Use "Also available" not "Other options"
   - Use visual separators `---`

### Anti-Patterns

- Command-only without context (user has no idea what they're about to run)
- Missing `/clear` explanation (user might skip it)
- "Other options" language (sounds like an afterthought)
- Fenced code blocks for commands (creates nesting ambiguity in templates)

### GSD-Specific Tooling

No `gsd-tools.js` commands. References GSD slash commands by name (`/gsd:execute-phase`, `/gsd:plan-phase`, `/gsd:discuss-phase`, `/gsd:research-phase`, `/gsd:list-phase-assumptions`, `/gsd:new-milestone`).

### Prompt Engineering Techniques

- **Variant-based specification**: Shows the exact output format for each scenario rather than abstract rules
- **Anti-pattern pairing**: Each rule has a "Don't" example showing what to avoid

### Loaded By

- Workflow: `resume-project.md`

---

## decimal-phase-calculation.md

### Summary

A short (66 lines) technical reference for calculating the next available decimal phase number when inserting urgent phases between existing integer phases.

### Content Type

**Descriptive** (data/API reference) with usage examples.

### Key Concepts

1. **Decimal Phase Numbering**: Phases can be integers (01, 02, 03) or decimals (06.1, 06.2). Decimals represent urgent insertions discovered after the original roadmap was planned.

2. **gsd-tools.js API**: The `phase next-decimal` command calculates the next available decimal:
   - Input: base phase number
   - Output: JSON with `found`, `base_phase`, `next`, and `existing` fields
   - `--raw` flag returns just the decimal number string

3. **Increment Logic**: Always takes the next integer after the highest existing decimal (06 -> 06.1, 06.1 exists -> 06.2, gap at 06.2 -> 06.4 not 06.2)

4. **Directory Naming**: Decimal phase directories use the full decimal number: `.planning/phases/06.1-fix-critical-auth-bug/`

### GSD-Specific Tooling

- `gsd-tools.js phase next-decimal <phase>` -- Calculate next decimal phase number
- `gsd-tools.js phase next-decimal <phase> --raw` -- Returns just the number string
- `gsd-tools.js generate-slug "<description>" --raw` -- Generate directory slug from description

### Loaded By

No direct `@` references found. The concepts are used implicitly by the `insert-phase.md` workflow, which implements decimal phase insertion. The workflow itself uses `gsd-tools.js` directly rather than loading this reference. This file serves as **developer documentation** for understanding the decimal phase system.

---

## git-integration.md

### Summary

Defines the complete git commit strategy for GSD projects: what gets committed, when, in what format, and why. The authoritative document for commit behavior.

### Content Type

**Prescriptive** (commit rules and formats) with rationale.

### Structure

Uses XML wrapper tags:

| Section | Tag | Purpose |
|---|---|---|
| Overview | `<overview>` | One-line description |
| Core Principle | `<core_principle>` | "Commit outcomes, not process" |
| Commit Points | `<commit_points>` | Table of what triggers a commit |
| Git Check | `<git_check>` | How to detect/initialize git |
| Commit Formats | `<commit_formats>` with nested `<format>` tags | Four commit format specifications |
| Example Log | `<example_log>` | What git log looks like with per-task commits |
| Anti-Patterns | `<anti_patterns>` | What to commit vs what not to commit |
| Rationale | `<commit_strategy_rationale>` | Why per-task commits matter |

### Key Concepts

1. **Core Principle**: "Commit outcomes, not process." Git log should read like a changelog.

2. **Commit Points Table**:
   - BRIEF + ROADMAP created: YES (project initialization)
   - PLAN.md created: NO (intermediate -- commit with plan completion)
   - RESEARCH.md created: NO (intermediate)
   - DISCOVERY.md created: NO (intermediate)
   - Task completed: YES (atomic unit of work, 1 commit per task)
   - Plan completed: YES (metadata commit: SUMMARY + STATE + ROADMAP)
   - Handoff created: YES (WIP state preserved)

3. **Four Commit Formats**:
   - **Initialization**: `docs: initialize [project-name] ([N] phases)`
   - **Task Completion**: `{type}({phase}-{plan}): {task-name}` with types: feat, fix, test, refactor, perf, chore
   - **Plan Completion**: `docs({phase}-{plan}): complete [plan-name] plan`
   - **Handoff**: `wip: [phase-name] paused at task [X]/[Y]`

4. **Per-Task Commit Rationale**:
   - Context engineering for AI (git history as primary context source for future sessions)
   - Failure recovery (partially completed plans have committed work)
   - Debugging (git bisect finds exact failing task)
   - Observability (atomic commits are git best practice)

5. **Auto-init**: If no `.git` directory exists, `git init` is run silently.

### GSD-Specific Tooling

- `gsd-tools.js commit "<message>" --files <paths>` -- Commit with automatic config checks

### Prompt Engineering Techniques

- **Before/after comparison**: Shows old approach (per-plan commits) vs new approach (per-task commits) side by side
- **Rationale section**: Explains "why" for AI-skeptical developers

### Loaded By

- Workflow: `execute-plan.md`

---

## git-planning-commit.md

### Summary

A concise (39 lines) quick-reference for committing `.planning/` artifacts using `gsd-tools.js commit`. Essentially a cheat sheet for the commit CLI.

### Content Type

**Prescriptive** (how-to instructions) -- a focused subset of git-integration.md.

### Key Concepts

1. **Single Command**: Always use `gsd-tools.js commit` for `.planning/` files -- it handles `commit_docs` and gitignore checks automatically.

2. **Amend Pattern**: `gsd-tools.js commit "" --files <paths> --amend` folds changes into the previous commit.

3. **Commit Message Patterns by Command**:
   | Command | Scope | Example |
   |---|---|---|
   | plan-phase | phase | `docs(phase-03): create authentication plans` |
   | execute-phase | phase | `docs(phase-03): complete authentication phase` |
   | new-milestone | milestone | `docs: start milestone v1.1` |
   | remove-phase | chore | `chore: remove phase 17 (dashboard)` |
   | insert-phase | phase | `docs: insert phase 16.1 (critical fix)` |
   | add-phase | phase | `docs: add phase 07 (settings page)` |

4. **Skip Conditions**: `commit_docs: false` in config, `.planning/` is gitignored, no changes to commit.

### GSD-Specific Tooling

- `gsd-tools.js commit "<message>" --files <paths>` -- Primary commit command
- `gsd-tools.js commit "" --files <paths> --amend` -- Amend previous commit

### Loaded By

No direct `@` references found. This file serves as **developer documentation** / quick-reference. The patterns it documents are implemented directly in workflows and agents that call `gsd-tools.js commit`.

---

## model-profile-resolution.md

### Summary

A short (33 lines) procedural reference for how orchestrators resolve the model profile at the start of a session and use it to select models for spawned agents.

### Content Type

**Prescriptive** (procedure/pattern).

### Key Concepts

1. **Resolution Pattern**: Read `model_profile` from `.planning/config.json`, defaulting to `"balanced"` if not set or config missing.

2. **Lookup Delegation**: Points to `model-profiles.md` via `@` reference for the actual model mapping table.

3. **Usage Pattern**:
   - Resolve once at orchestration start
   - Store the profile value
   - Look up each agent's model from the table when spawning
   - Pass `model` parameter to each Task call

4. **Bash Resolution**: Provides a bash one-liner using `grep` to extract the profile value from config.json.

### GSD-Specific Tooling

No direct `gsd-tools.js` calls (resolution is done inline with bash/grep). The resolved model is passed to Task() spawning calls.

### Cross-References

- Directly loads `@~/.claude/get-shit-done/references/model-profiles.md` for the lookup table.

### Loaded By

- Workflow: `research-phase.md`

---

## model-profiles.md

### Summary

Defines the three model profiles (`quality`, `balanced`, `budget`) and maps each GSD agent to a specific Claude model under each profile. A pure data/config reference.

### Content Type

**Descriptive** (data table/config) with rationale.

### Key Concepts

1. **Profile Definitions Table**:

   | Agent | quality | balanced | budget |
   |---|---|---|---|
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

2. **Profile Philosophies**:
   - **quality**: Maximum reasoning power. Opus for all decision-making agents. For critical architecture work.
   - **balanced** (default): Opus only for planning. Sonnet for execution and research. Smart allocation.
   - **budget**: Minimal Opus usage. Haiku for research and verification. For conserving quota.

3. **Resolution Logic**: Orchestrators read `.planning/config.json` -> get `model_profile` -> look up agent in table -> pass model to Task call.

4. **Switching Profiles**: Runtime: `/gsd:set-profile <profile>`. Per-project: set in `.planning/config.json`.

5. **Design Rationale**: Explains why specific model assignments exist:
   - Opus for planner: Planning involves architecture decisions and goal decomposition
   - Sonnet for executor: Follows explicit PLAN.md instructions (plan contains the reasoning)
   - Sonnet (not Haiku) for verifiers in balanced: Verification requires goal-backward reasoning
   - Haiku for codebase-mapper: Read-only exploration, no reasoning needed

### GSD-Specific Tooling

No direct `gsd-tools.js` calls. References `/gsd:set-profile` command.

### Loaded By

- Cross-reference: `model-profile-resolution.md` (via `@` inclusion)

---

## phase-argument-parsing.md

### Summary

Defines how phase arguments are parsed and normalized from user input in commands that operate on phases.

### Content Type

**Prescriptive** (procedure/API reference).

### Key Concepts

1. **Extraction from $ARGUMENTS**: Phase number (first numeric), flags (prefixed with `--`), remaining text is description.

2. **gsd-tools.js `find-phase` Command**: Handles normalization and validation in one step. Returns JSON with:
   - `found`: boolean
   - `directory`: Full path to phase directory
   - `phase_number`: Normalized number (e.g., "06", "06.1")
   - `phase_name`: Name portion (e.g., "foundation")
   - `plans`: Array of PLAN.md files
   - `summaries`: Array of SUMMARY.md files

3. **Manual Normalization (Legacy)**: Zero-pad integer phases to 2 digits (`8` -> `08`), preserve decimal suffixes (`2.1` -> `02.1`). Bash regex patterns provided.

4. **Validation**: Use `roadmap get-phase` to verify phase exists in the roadmap.

5. **Directory Lookup**: `find-phase <phase> --raw` returns just the directory path.

### GSD-Specific Tooling

- `gsd-tools.js find-phase "<phase>"` -- Normalize, validate, and find phase directory
- `gsd-tools.js find-phase "<phase>" --raw` -- Returns just the directory path
- `gsd-tools.js roadmap get-phase "<phase>"` -- Validate phase exists in roadmap

### Loaded By

- Workflow: `research-phase.md`

---

## planning-config.md

### Summary

Comprehensive documentation of the `.planning/config.json` configuration schema, covering `commit_docs`, `search_gitignored`, and git branching strategies.

### Content Type

**Mixed**: Descriptive (schema/config definitions) and prescriptive (behavior rules).

### Structure

Uses XML wrapper tags: `<planning_config>`, `<config_schema>`, `<commit_docs_behavior>`, `<search_behavior>`, `<setup_uncommitted_mode>`, `<branching_strategy_behavior>`.

### Key Concepts

1. **Config Schema**:
   ```json
   {
     "planning": {
       "commit_docs": true,
       "search_gitignored": false
     },
     "git": {
       "branching_strategy": "none",
       "phase_branch_template": "gsd/phase-{phase}-{slug}",
       "milestone_branch_template": "gsd/{milestone}-{slug}"
     }
   }
   ```

2. **`commit_docs` Behavior**:
   - `true` (default): Planning files committed normally, full history preserved
   - `false`: Skip all git operations for `.planning/` files
   - **Auto-detection**: If `.planning/` is gitignored, `commit_docs` is automatically `false`
   - Use cases for false: OSS contributions, client projects, keeping planning private
   - `gsd-tools.js commit` handles checks internally -- no manual conditionals needed

3. **`search_gitignored` Behavior**:
   - `false` (default): Standard `rg` behavior (respects .gitignore)
   - `true`: Add `--no-ignore` to broad `rg` searches that should include `.planning/`
   - Direct path searches always work regardless of gitignore status

4. **Branching Strategies**:
   - `none` (default): All work commits to current branch
   - `phase`: Creates branch per phase at `execute-phase` start (e.g., `gsd/phase-03-authentication`)
   - `milestone`: Creates branch for entire milestone at first `execute-phase` (e.g., `gsd/v1.0-mvp`)

5. **Template Variables**: `{phase}` (zero-padded), `{slug}` (lowercase-hyphenated), `{milestone}` (version string)

6. **Merge Options at complete-milestone**:
   - Squash merge (recommended): Single clean commit per branch
   - Merge with history: Preserves all individual commits
   - Delete without merging
   - Keep branches for manual handling

7. **Setup Uncommitted Mode**: Set config, add `.planning/` to `.gitignore`, optionally `git rm -r --cached .planning/` for previously tracked files.

### GSD-Specific Tooling

- `gsd-tools.js commit "<message>" --files <paths>` -- Handles `commit_docs` and gitignore internally
- `gsd-tools.js state load` -- Returns config JSON including branching strategy
- `gsd-tools.js init execute-phase "<phase>"` -- Returns all config as JSON

### Loaded By

No direct `@` references found. This is **developer/system documentation**. The config values it documents are read by `gsd-tools.js` and passed to workflows/agents via init JSON output. Many workflows parse `commit_docs` and `branching_strategy` from init JSON (at least 15 workflows reference `commit_docs`).

---

## questioning.md

### Summary

A questioning guide for the project initialization phase. Defines how to conduct collaborative dream-extraction conversations with users to understand what they want to build.

### Content Type

**Prescriptive** (behavioral instructions for the AI).

### Structure

Uses XML wrapper tags: `<questioning_guide>`, `<philosophy>`, `<the_goal>`, `<how_to_question>`, `<question_types>`, `<using_askuserquestion>`, `<context_checklist>`, `<decision_gate>`, `<anti_patterns>`.

### Key Concepts

1. **Philosophy**: "You are a thinking partner, not an interviewer." Project initialization is dream extraction, not requirements gathering. Collaborative thinking, not contract negotiation.

2. **The Goal**: Produce a PROJECT.md clear enough that downstream phases can act on it:
   - Research needs what domain to research
   - Requirements needs clear enough vision to scope v1
   - Roadmap needs clear enough decomposition criteria
   - plan-phase needs specific requirements for tasks
   - execute-phase needs success criteria and "why"

3. **How to Question** (six principles):
   - Start open -- let them dump their mental model
   - Follow energy -- dig into what excited them
   - Challenge vagueness -- never accept fuzzy answers
   - Make the abstract concrete -- "Walk me through using this"
   - Clarify ambiguity -- "When you say Z, do you mean A or B?"
   - Know when to stop -- offer to proceed when ready

4. **Question Types** (as inspiration, not checklist):
   - Motivation: "What prompted this?" / "What are you doing today that this replaces?"
   - Concreteness: "Walk me through using this" / "Give me an example"
   - Clarification: "When you say Z, do you mean A or B?"
   - Success: "How will you know this is working?"

5. **AskUserQuestion Tool Usage**: Present concrete options to help users think (interpretations, specific examples, concrete choices). Avoid generic categories, leading options, or too many options (2-4 ideal).

6. **Context Checklist** (background, not conversation structure):
   - What they're building (concrete enough to explain to a stranger)
   - Why it needs to exist (the problem or desire)
   - Who it's for (even if just themselves)
   - What "done" looks like (observable outcomes)

7. **Decision Gate**: When ready to write PROJECT.md, offer to proceed with AskUserQuestion (options: "Create PROJECT.md" / "Keep exploring"). Loop until user selects "Create PROJECT.md".

### Anti-Patterns

- Checklist walking, canned questions, corporate speak, interrogation
- Rushing, shallow acceptance, premature constraints
- **NEVER ask about user's technical experience** -- Claude builds, not the user

### Prompt Engineering Techniques

- **Role framing**: "thinking partner, not interviewer" shapes the entire interaction style
- **Negative constraints**: The anti-patterns section is as detailed as the positive instructions
- **Downstream dependency chain**: Explaining why vague PROJECT.md cascades into problems at every stage creates urgency for quality
- **Tool-specific guidance**: Includes instructions for using `AskUserQuestion` effectively

### Loaded By

- Command: `new-project.md`, `new-milestone.md`

---

## tdd.md

### Summary

Comprehensive Test-Driven Development reference defining when to use TDD, how TDD plans are structured, the red-green-refactor cycle, test quality standards, framework setup, error handling, and commit patterns.

### Content Type

**Prescriptive** (process instructions with standards).

### Structure

Uses XML wrapper tags: `<overview>`, `<when_to_use_tdd>`, `<tdd_plan_structure>`, `<execution_flow>`, `<test_quality>`, `<framework_setup>`, `<error_handling>`, `<commit_pattern>`, `<context_budget>`.

### Key Concepts

1. **Philosophy**: "TDD is about design quality, not coverage metrics." The red-green-refactor cycle forces thinking about behavior before implementation.

2. **When to Use TDD**:
   - **TDD candidates**: Business logic, API endpoints, data transformations, validation rules, algorithms, state machines, utility functions
   - **Skip TDD**: UI layout/styling, configuration, glue code, scripts, simple CRUD, exploratory prototyping
   - **Heuristic**: Can you write `expect(fn(input)).toBe(output)` before writing `fn`?

3. **TDD Plan Structure**: One feature per TDD plan. YAML frontmatter with `type: tdd`. Sections: `<objective>`, `<context>`, `<feature>` (name, files, behavior, implementation), `<verification>`, `<success_criteria>`, `<output>`.

4. **Red-Green-Refactor Cycle**:
   - **RED**: Write failing test, verify it fails, commit: `test({phase}-{plan}): add failing test for [feature]`
   - **GREEN**: Write minimal code to pass, verify it passes, commit: `feat({phase}-{plan}): implement [feature]`
   - **REFACTOR**: Clean up if needed, verify tests still pass, commit: `refactor({phase}-{plan}): clean up [feature]`

5. **Test Quality Standards**:
   - Test behavior, not implementation (tests should survive refactors)
   - One concept per test
   - Descriptive names ("should reject empty email", not "test1")
   - No implementation details (test public API, not private methods)

6. **Framework Setup**: Includes detection patterns for Node.js, Python, Go, Rust and corresponding test framework installation instructions.

7. **Context Budget**: TDD plans target ~40% context usage (lower than standard plans' ~50%) because the back-and-forth of RED/GREEN/REFACTOR is inherently heavier.

8. **Error Handling**: What to do when test doesn't fail in RED, doesn't pass in GREEN, fails in REFACTOR, or unrelated tests break.

### GSD-Specific Tooling

No direct `gsd-tools.js` calls. References GSD commit format: `{type}({phase}-{plan}): {description}`.

### Prompt Engineering Techniques

- **Decision heuristic**: The `expect(fn(input)).toBe(output)` question gives the model a clear, mechanical test for whether to use TDD
- **Context budget awareness**: Explicitly lowering the budget for TDD plans prevents context exhaustion during the multi-cycle process
- **One feature per plan rule**: Prevents the model from batching too much into a single TDD plan

### Loaded By

- Workflow: `execute-phase.md`, `execute-plan.md`
- Template: `phase-prompt.md`

---

## ui-brand.md

### Summary

Defines all visual patterns for user-facing GSD output: banners, checkpoint boxes, status symbols, progress displays, spawning indicators, "Next Up" blocks, error boxes, and tables.

### Content Type

**Prescriptive** (visual format specification).

### Structure

Plain markdown within `<ui_patterns>` XML wrapper. Organized by UI element type.

### Key Concepts

1. **Stage Banners**: Major workflow transitions. Uses heavy horizontal lines (━) and `GSD ►` prefix:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GSD ► {STAGE NAME}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
   Stage names: QUESTIONING, RESEARCHING, DEFINING REQUIREMENTS, CREATING ROADMAP, PLANNING PHASE {N}, EXECUTING WAVE {N}, VERIFYING, PHASE {N} COMPLETE, MILESTONE COMPLETE

2. **Checkpoint Boxes**: 62-character width, double-line Unicode box at top, single-line separator for action prompt. Three types: Verification Required, Decision Required, Action Required.

3. **Status Symbols**:
   - `✓` Complete/Passed/Verified
   - `✗` Failed/Missing/Blocked
   - `◆` In Progress
   - `○` Pending
   - `⚡` Auto-approved
   - `⚠` Warning
   - Celebration emoji only in milestone complete banner

4. **Progress Display**: Three granularity levels (phase: `████████░░ 80%`, task: `2/4 complete`, plan: `3/5 complete`)

5. **Spawning Indicators**: `◆ Spawning researcher...` / `✓ Researcher complete: STACK.md written`

6. **Next Up Block**: Mirrors the continuation-format.md specification. Always at end of major completions.

7. **Error Box**: Double-line Unicode box with "ERROR" header and "To fix:" resolution steps.

8. **Tables**: Standard markdown table format with status symbols.

### Anti-Patterns

- Varying box/banner widths
- Mixing banner styles
- Skipping `GSD ►` prefix
- Random emoji usage
- Missing "Next Up" block after completions

### Prompt Engineering Techniques

- **Exact character-width specification** (62 characters) prevents visual inconsistency
- **Restricted emoji set** prevents the model from adding random decorative emoji
- **Consistent prefix** (`GSD ►`) creates brand identity across all output

### Loaded By

- Command: `execute-phase.md`, `new-project.md`, `new-milestone.md`, `plan-phase.md`
- Workflow: `plan-phase.md`

---

## verification-patterns.md

### Summary

Comprehensive reference for verifying that code artifacts are real implementations, not stubs or placeholders. Covers detection patterns for multiple artifact types and wiring verification.

### Content Type

**Prescriptive** (verification procedures) with extensive code examples.

### Structure

Uses XML wrapper tags: `<core_principle>`, `<stub_detection>`, `<react_components>`, `<api_routes>`, `<database_schema>`, `<hooks_utilities>`, `<environment_config>`, `<wiring_verification>`, `<verification_checklist>`, `<automated_verification_script>`, `<human_verification_triggers>`, `<checkpoint_automation_reference>`.

### Key Concepts

1. **Core Principle**: "Existence does not equal Implementation." Four verification levels:
   - **Exists**: File is present at expected path
   - **Substantive**: Content is real implementation, not placeholder
   - **Wired**: Connected to the rest of the system
   - **Functional**: Actually works when invoked
   Levels 1-3 can be checked programmatically. Level 4 often requires human verification.

2. **Universal Stub Patterns**: Grep patterns for detecting:
   - Comment-based stubs (TODO, FIXME, placeholder)
   - Placeholder text in output (lorem ipsum, coming soon)
   - Empty/trivial implementations (return null, return {}, pass)
   - Hardcoded values where dynamic expected

3. **Artifact-Specific Verification**:
   - **React/Next.js Components**: Check for real JSX (not null/empty), meaningful content (not just wrapper div), prop/state usage (not static), real event handlers (not empty `() => {}`)
   - **API Routes**: Check for HTTP method exports, database interaction, error handling, meaningful responses (not "not implemented")
   - **Database Schema**: Check for expected fields (not just id), relationships, appropriate types (not all String), applied migrations
   - **Custom Hooks/Utilities**: Check for React hook usage, meaningful return values, actually imported/called somewhere
   - **Environment Variables**: Check for actual values (not placeholders), valid format for type, actually used in code

4. **Wiring Verification Patterns**: Component->API (fetch call exists and uses response), API->Database (query exists and result returned), Form->Handler (onSubmit calls API/mutation), State->Render (state variables appear in JSX). Each with specific red flags.

5. **Verification Checklists**: Per artifact type (Component, API Route, Schema, Hook/Utility, Wiring).

6. **Automated Verification Script**: Bash functions for `check_exists`, `check_stubs`, `check_wiring`, `check_substantive`.

7. **Human Verification Triggers**: Visual appearance, user flow completion, real-time behavior, external service integration, error message clarity, performance feel.

### GSD-Specific Tooling

No direct `gsd-tools.js` calls. References `checkpoints.md` for automation-first checkpoint patterns.

### Cross-References

References `@~/.claude/get-shit-done/references/checkpoints.md` for the `<automation_reference>` section covering pre-checkpoint automation patterns.

### Prompt Engineering Techniques

- **Four-level verification hierarchy** (Exists -> Substantive -> Wired -> Functional) gives the model a systematic approach
- **Red flag examples** in every artifact section show exactly what stub code looks like, making detection mechanical
- **Grep-based detection** provides concrete, executable patterns rather than vague instructions

### Loaded By

- Workflow: `verify-phase.md`

---

## Common Patterns

### XML Wrapper Tags

Many references use XML tags to structure content into semantically meaningful sections. This is a prompt engineering technique -- XML tags help the model identify and reference specific sections. Common patterns:

- `<overview>` -- Introduction and core principle
- `<core_principle>` -- The single most important rule
- `<anti_patterns>` -- What NOT to do (as important as what to do)
- `<examples>` -- Concrete, copy-pasteable examples

### Anti-Pattern Pairing

Nearly every reference includes an anti-patterns section. This is a deliberate prompt engineering choice: telling the model what NOT to do is as important as telling it what to do. Many anti-patterns are shown as before/after pairs (BAD/GOOD).

### `@` File Inclusion

References are injected into prompts using the `@~/.claude/get-shit-done/references/<name>.md` pattern. This path is the canonical form used by Claude Code installations; the installer converts it for other runtimes.

### Layered Loading

Some references are only loaded indirectly through other references:
- `model-profiles.md` is loaded by `model-profile-resolution.md` (which is loaded by `research-phase.md`)
- `checkpoints.md` is referenced by `verification-patterns.md` (which is loaded by `verify-phase.md`)

### gsd-tools.js as the Execution Layer

Many references document patterns that are implemented in `gsd-tools.js`:
- `git-planning-commit.md` documents `gsd-tools.js commit`
- `decimal-phase-calculation.md` documents `gsd-tools.js phase next-decimal`
- `phase-argument-parsing.md` documents `gsd-tools.js find-phase`
- `planning-config.md` documents config values consumed by `gsd-tools.js state load` and `gsd-tools.js init`

### Prescriptive vs Descriptive Distribution

| Type | References |
|---|---|
| Pure prescriptive (behavioral instructions) | `checkpoints.md`, `continuation-format.md`, `questioning.md`, `ui-brand.md` |
| Pure descriptive (data/config) | `model-profiles.md` |
| Mixed (instructions + data) | `git-integration.md`, `git-planning-commit.md`, `tdd.md`, `verification-patterns.md`, `planning-config.md` |
| API/procedure reference | `decimal-phase-calculation.md`, `model-profile-resolution.md`, `phase-argument-parsing.md` |

---

## Cross-References

### References -> Commands

| Reference | Commands That Load It |
|---|---|
| `questioning.md` | `new-project`, `new-milestone` |
| `ui-brand.md` | `execute-phase`, `new-project`, `new-milestone`, `plan-phase` |

### References -> Workflows

| Reference | Workflows That Load It |
|---|---|
| `checkpoints.md` | `execute-phase`, `execute-plan` |
| `continuation-format.md` | `resume-project` |
| `git-integration.md` | `execute-plan` |
| `model-profile-resolution.md` | `research-phase` |
| `phase-argument-parsing.md` | `research-phase` |
| `tdd.md` | `execute-phase`, `execute-plan` |
| `ui-brand.md` | `plan-phase` |
| `verification-patterns.md` | `verify-phase` |

### References -> Agents

| Reference | Agents That Load It |
|---|---|
| `checkpoints.md` | `gsd-executor` |

### References -> Templates

| Reference | Templates That Load It |
|---|---|
| `checkpoints.md` | `phase-prompt` (3 inclusions) |
| `tdd.md` | `phase-prompt` |

### References -> Other References

| Reference | Referenced By |
|---|---|
| `model-profiles.md` | `model-profile-resolution.md` |
| `checkpoints.md` | `verification-patterns.md` |

### References -> gsd-tools.js Commands

| Reference | gsd-tools.js Commands Documented |
|---|---|
| `decimal-phase-calculation.md` | `phase next-decimal`, `generate-slug` |
| `git-integration.md` | `commit` |
| `git-planning-commit.md` | `commit`, `commit --amend` |
| `model-profile-resolution.md` | (reads config.json directly) |
| `phase-argument-parsing.md` | `find-phase`, `roadmap get-phase` |
| `planning-config.md` | `commit`, `state load`, `init execute-phase` |

### Orphaned References (No Direct @ Inclusions)

These references have zero direct `@` file inclusions from commands, workflows, agents, or templates:

1. **`decimal-phase-calculation.md`** -- Concepts implemented in `insert-phase.md` workflow and `gsd-tools.js`; serves as developer documentation
2. **`git-planning-commit.md`** -- Patterns used pervasively in workflows/agents that call `gsd-tools.js commit`; serves as a quick-reference
3. **`planning-config.md`** -- Config values consumed by `gsd-tools.js` and passed to all workflows via init JSON; serves as system documentation
4. **`model-profiles.md`** -- Only loaded indirectly via `model-profile-resolution.md`

These are not truly "unused" -- their knowledge is either encoded in `gsd-tools.js` or loaded indirectly. They serve as the source of truth for behavior that is implemented elsewhere.
