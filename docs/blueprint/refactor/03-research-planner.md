# Blueprint: Research Planner 03

What needs to be investigated and understood before we can create a comprehensive, phased implementation plan for Cursor runtime support, model management, and YOLO mode behavior.

---

## Area 1: Cursor Settings & Model Profile Workflow

The existing `/bp:set-profile` and `/bp:settings` commands manage model routing for Claude Code. For Cursor runtime support, this needs to extend to Cursor's model ecosystem, where model IDs follow a different format and must be resolved from provider APIs.

### Questions to Answer

**Model Resolution Pipeline:**
- How should the model registry (`models-registry.json`) integrate with Blueprint's existing `MODEL_PROFILES` and `resolveModelInternal()` in `blueprint-tools.js`?
- Should model resolution happen at install time, on-demand via a refresh command, or lazily when a model is first needed?
- How do we handle the case where a user has Anthropic/OpenAI API keys for model list fetching but uses Cursor's built-in billing for actual inference?

**API Key Management:**
- Where should API keys be stored? Environment variables, `.blueprint/config.json`, or a separate credentials file?
- Fetching model lists from Anthropic and OpenAI is free but still requires an API key -- how do we handle users who don't have provider API keys? Fallback to a static registry?
- How do we avoid storing API keys in files that might get committed to git?

**Cursor-Specific Skill Design:**
- The workflow requires a custom Cursor skill containing instructions for using the fetch tool to gather currently available models from Cursor, then querying OpenAI + Anthropic to resolve IDs. What is the exact skill structure needed?
- How does the skill interact with Blueprint's existing `config.json` model profile system?
- Should the skill auto-invoke or require explicit `/refresh-models` invocation?

### What to Investigate
- `docs/workflowexample/` -- Complete workflow documentation for the model resolution skill, including `FetchModels and resolve to slugs.md` (2075 lines), `IMPLEMENTATION-GUIDE.md`, `test-model-resolution.js`, `README.md`, `SUMMARY.md`
- `blueprint/bin/blueprint-tools.js` -- `MODEL_PROFILES` object, `resolveModelInternal()` function, `loadConfig()` for how model routing currently works
- `blueprint/references/model-profiles.md` and `model-profile-resolution.md` -- Current model resolution docs
- `commands/bp/set-profile.md` and `commands/bp/settings.md` -- Current settings commands
- Anthropic API `/v1/models` endpoint (free, key required)
- OpenAI API `/v1/models` endpoint (free, key required)

### Deliverable
A specification for the model registry system: where it lives, how it's populated, how it integrates with existing `MODEL_PROFILES`, how API keys are managed, and the exact Cursor skill structure (SKILL.md frontmatter, scripts, references).

---

## Area 2: Cursor Skills & Subagents Architecture

Cursor has its own primitives for extensibility (skills and subagents) that differ from Claude Code's commands and agents. Blueprint needs to map its existing command/agent system to these Cursor primitives.

### Questions to Answer

**Skills Mapping:**
- Which Blueprint `/bp:*` commands should become Cursor skills vs. which should remain as direct agent prompts?
- Cursor skills support `disable-model-invocation: true` for explicit-only invocation (like slash commands). Which Blueprint commands need this?
- Skills load from `.cursor/skills/` with `SKILL.md` files. How does this map to Blueprint's `commands/bp/*.md` structure? Can the installer transform one to the other?
- Skills support `scripts/`, `references/`, and `assets/` subdirectories. Which Blueprint commands benefit from these?

**Subagents Mapping:**
- Cursor subagents live in `.cursor/agents/` with a different frontmatter schema (`name`, `description`, `model`, `readonly`, `is_background`). How do we translate Blueprint's agent frontmatter (`name`, `description`, `tools`, `model`)?
- Blueprint agents declare specific `tools` access lists. Cursor subagents don't have explicit tool restrictions (except `readonly`). How do we enforce tool boundaries?
- Cursor has 3 built-in subagents (Explore, Bash, Browser). Do any of these overlap with or replace Blueprint agents?
- Cursor supports `model: fast`, `model: inherit`, and specific model IDs. How does this map to Blueprint's 3-profile system (quality/balanced/budget)?

**Cross-Runtime Compatibility:**
- `.cursor/agents/` and `.claude/agents/` are both valid agent directories in Cursor (Claude compatibility). Should Blueprint install to `.cursor/` or `.claude/` when targeting Cursor?
- Can a single agent file work in both runtimes, or do we need runtime-specific transforms in the installer?

### What to Investigate
- `docs/cursor/general/skills.md` -- Full Cursor skills specification (directories, SKILL.md format, frontmatter fields, scripts, auto-invocation, migration from rules)
- `docs/cursor/general/subagents.md` -- Full Cursor subagents specification (file format, configuration fields, built-in subagents, patterns, performance/cost)
- `agents/*.md` -- All 11 Blueprint agent files, their frontmatter schemas and tool declarations
- `commands/bp/*.md` -- All Blueprint command files, their structure and workflow delegation pattern
- `bin/install.js` -- Current multi-runtime installer logic (how it handles Claude Code vs. OpenCode vs. Gemini)

### Deliverable
A mapping matrix: each Blueprint command/agent mapped to its Cursor equivalent (skill or subagent), with required transforms, frontmatter translations, and installer changes. Identifies gaps where Cursor primitives don't cover Blueprint's needs.

---

## Area 3: YOLO Mode Deep Dive

YOLO mode (`mode: "yolo"` in config) is the auto-approve workflow that skips user confirmation gates. Understanding exactly what it does -- and what it doesn't do -- is critical for this fork, since Blueprint's core mission is adding more user interaction points. We need to know exactly what gates YOLO bypasses to know what we're working with.

### Questions to Answer

**Gate Behavior:**
- What is the complete list of confirmation gates that YOLO mode skips? Map every `<if mode="yolo">` / `mode: "yolo"` conditional across all workflows.
- Are there gates that YOLO mode does NOT skip (critical checkpoints)? What are they?
- How does YOLO mode interact with the `gates.*` config settings? Does `gates.execute_next_plan: true` override YOLO, or does YOLO override gates?

**Workflow-Specific Behavior:**
- `new-project.md` -- YOLO is offered as "Auto-approve, just execute" during project init. What specifically gets auto-approved in this flow?
- `execute-plan.md` -- YOLO auto-approves plan execution and logs issues without prompting. What's the exact UX difference?
- `research-phase.md` -- YOLO skips the pre-research interview and post-research verification gate. What context does the researcher lose?
- `discuss-phase.md` -- YOLO skips the CONTEXT.md verification gate. What does the user miss?
- `complete-milestone.md` -- YOLO auto-approves milestone scope verification. What checks are skipped?
- `transition.md` -- YOLO auto-approves phase transitions and milestone completion. What decisions are made automatically?
- `bp-planner.md` -- YOLO auto-approves plan breakdown confirmation. What oversight is lost?

**Blueprint Fork Implications:**
- Which YOLO-skipped gates are the ones this fork specifically wants to make more interactive?
- Should Blueprint preserve YOLO mode as-is, modify it, or replace it with a graduated interaction model?
- Could YOLO mode serve a different purpose in Blueprint -- e.g., "experienced user" mode that still pauses at the new interaction points we're adding, but auto-approves the original GSD gates?

### What to Investigate
- Every workflow file in `blueprint/workflows/` -- Search for all `yolo`, `mode`, `auto` references
- `blueprint/references/verification-gates.md` -- Gate protocol with YOLO-specific behavior (auto mode sections for artifacts and research)
- `blueprint/workflows/new-project.md` -- Where YOLO is initially offered to the user
- `blueprint/workflows/execute-plan.md` -- Execute-time YOLO behavior
- `blueprint/workflows/research-phase.md` -- Research-time YOLO behavior (skips pre-research interview, post-research gate)
- `blueprint/workflows/discuss-phase.md` -- Discussion-time YOLO behavior (skips CONTEXT.md verification)
- `blueprint/workflows/complete-milestone.md` -- Milestone-time YOLO behavior
- `blueprint/workflows/transition.md` -- Transition-time YOLO behavior (3 separate YOLO blocks)
- `agents/bp-planner.md` -- Planner YOLO behavior (auto-approve breakdown)
- `blueprint/workflows/help.md` -- User-facing YOLO description
- `.blueprint/config.json` (or template) -- How `mode` field interacts with `gates` field
- `blueprint/bin/blueprint-tools.js` -- Check if YOLO mode has any logic in the CLI tool itself (initial grep shows no matches, so it may be purely workflow-level)

### Deliverable
A complete YOLO mode behavior map: every gate it skips, every workflow it affects, the exact UX difference per workflow, and a recommendation for how Blueprint should handle it (preserve, modify, or replace with graduated interaction levels).

---

## Priority Order

1. **Area 3: YOLO Mode** -- Must understand the current interaction model before modifying it. This directly informs what gates we're adding/changing, which feeds into all other planning.
2. **Area 2: Cursor Skills & Subagents** -- Architecture decisions about how Blueprint maps to Cursor primitives affect everything else, including how the model resolution skill is structured.
3. **Area 1: Cursor Settings & Model Profiles** -- Depends on Area 2 (skill architecture) and benefits from Area 3 (understanding which settings gates exist).

---

## How to Use This Document

Each area above defines:
- **Questions to answer** -- The unknowns that block planning
- **What to investigate** -- Specific files, docs, and tests to examine
- **Deliverable** -- What a completed investigation produces

Once all areas have deliverables, create a comprehensive phased implementation plan.
