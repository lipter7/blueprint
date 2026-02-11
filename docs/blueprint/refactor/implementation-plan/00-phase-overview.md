# Blueprint Refactor: Phase Overview

**Source:** Synthesized from research results (Items 1-7) and the North Star document.
**Status:** Draft

---

## Summary

The Blueprint refactor is organized into **6 phases**, ordered by dependency and risk. Phase 1 is the foundation everything else builds on. Phases 3-5 are independent of each other and could theoretically run in parallel, but are ordered by value: interaction improvements first (the core reason Blueprint exists), then codebase freshness (the second-biggest gap in GSD), then Cursor support (new runtime target).

---

## Phase 1: The Big Rename — COMPLETE

**What:** Transform every GSD reference into Blueprint across the entire codebase. This is the largest phase by file count (~113 files, ~2,254 references) but is mostly mechanical search-and-replace with a few tricky spots requiring manual attention.

**Why first:** Everything downstream depends on the codebase being consistently named. Doing this incrementally would create a broken state where some references point to old names and others to new. It must be a single coordinated pass.

**Completion notes:** All steps executed successfully. 75/75 tests pass. Grep audit clean (remaining `gsd` references are intentional: orphan cleanup list in install.js for backward-compatible GSD artifact removal, and upstream project mentions in CLAUDE.md/README.md). Installer produces correct Blueprint-named outputs. Hooks build correctly.

**Scope:**

| Category | Volume | Example |
|----------|--------|---------|
| Command prefix `/gsd:` → `/bp:` | ~200+ refs in 58+ files | `/gsd:plan-phase` → `/bp:plan-phase` |
| Agent/hook prefix `gsd-` → `bp-` | ~80+ refs in 22 files | `gsd-planner` → `bp-planner` |
| Directory `get-shit-done/` → `blueprint/` | ~40+ refs in 50+ files | Path references throughout |
| Branding "Get Shit Done" → "Blueprint" | ~10 refs in 5-10 files | Banner, help text |
| Hook names `gsd-*` → `bp-*` | ~20+ refs in 10+ files | `gsd-statusline.js` → `bp-statusline.js` |
| Artifact path `.planning/` → `.blueprint/` | ~30+ refs in 20+ files | Template refs, init checks |

**Includes:**
- Rename all directories: `get-shit-done/` → `blueprint/`, `commands/gsd/` → `commands/bp/`
- Rename all agent files: `gsd-*.md` → `bp-*.md`
- Rename hooks: `gsd-check-update.js` → `bp-check-update.js`, `gsd-statusline.js` → `bp-statusline.js`
- Rename `gsd-tools.js` → `blueprint-tools.js` and `gsd-tools.test.js` → `blueprint-tools.test.js`
- Update `MODEL_PROFILES` keys to match new agent filenames (11 agents x 3 profiles)
- Update `package.json`: name → `@lipter7/blueprint`, bin entry → `blueprint`, description, repository, homepage, bugs, files array
- Update `CLAUDE.md` with all new references
- Update `scripts/build-hooks.js` with new hook filenames
- Update installer file patterns (`startsWith('gsd-')` → `startsWith('bp-')`)
- Update OpenCode compatibility conversion (`/gsd:` → `/bp:` regex)
- Update git branch template prefix (`gsd/` → `bp/`)
- Update all embedded command invocations in workflows (e.g., "run `/gsd:plan-phase 2`" → "run `/bp:plan-phase 2`")
- Remove `docs/workflow-example/`
- Run full test suite and fix failures

**Tricky spots requiring manual attention:**
1. `MODEL_PROFILES` in blueprint-tools.js — 11 agent names hardcoded in model routing
2. Installer file pattern matching — multiple `startsWith('gsd-')` checks
3. OpenCode frontmatter conversion — already has regex transforms that need updating
4. Embedded command invocations scattered across workflow markdown files
5. Test suite (~2000 lines) — all assertions reference old names

**Exit criteria:** `npm test` passes. `node bin/install.js` installs correctly with all Blueprint names. No remaining `gsd` references in source files (excluding docs kept for reference).

---

## Phase 2: npm Distribution & Install Verification

**What:** Publish `@lipter7/blueprint` to npm and verify the full install/update/patch lifecycle works end-to-end.

**Why second:** The distribution infrastructure already exists from GSD — this phase is about verifying it works with the new names, not building anything new. It's the smallest phase but establishes that Blueprint is a real, installable package.

**Scope:**
- Run `npm publish --access public` for initial release
- Test `npx @lipter7/blueprint` install (both `--local` and `--global`)
- Test the update workflow: `/bp:update` → `workflows/update.md` → `bin/install.js`
- Verify `npm view @lipter7/blueprint version` returns correct version
- Test the update check hook (`bp-check-update.js`) queries the right package
- Test the local patch system: modify an installed file, run update, verify patch detection and backup
- Test `/bp:reapply-patches` after a clean reinstall
- Test uninstall path (`npx @lipter7/blueprint --uninstall`)

**What's new vs GSD:** Nothing architecturally. The only changes are the package name in `npm view` calls and `npx` invocations. The entire pipeline (version checking, changelog fetching, SHA256 manifest hashing, backup/restore) carries over unchanged.

**Exit criteria:** A user can `npx @lipter7/blueprint`, install Blueprint, use it, receive update notifications, run `/bp:update`, and have their local modifications preserved through the update.

---

## Phase 3: Interaction Model Enhancements

**What:** Add the user interaction gates that are the core reason Blueprint exists — pre-research interviews and post-write verification across the workflows that write artifacts from user input.

**Why this phase:** This is the primary differentiator from GSD. The North Star says Blueprint puts the human in the loop at every high-leverage moment. These changes implement that principle.

**Scope:**

### Pre-Research Interview (Item 1)
- Add structured user input collection **before** research agents run
- Covers: focus areas, known problems, conventions to check, general guidance
- Applies to: `research-phase` workflow
- Research agents themselves are unchanged — they just receive richer input context

### Post-Write Verification Gates (Items 1, 6)
After any workflow writes artifacts from user input, the orchestrator reads back what it wrote, summarizes to the user, and incorporates corrections before proceeding.

| Workflow | Artifact Verified | What the Summary Covers |
|----------|------------------|------------------------|
| `discuss-phase` | CONTEXT.md | Decisions per discussion area |
| `new-project` | PROJECT.md | Core product description + constraints |
| `new-project` | REQUIREMENTS.md | v1/v2/out-of-scope breakdown |
| `new-project` | ROADMAP.md | Phase structure + ordering |
| `research-phase` | *-RESEARCH.md | Key findings per topic |

Each gate follows the same pattern: read-back → summarize → user confirms/corrects → apply corrections or proceed.

**Design work required:**
- Summarization format for each artifact type (CONTEXT.md summary looks different from ROADMAP.md summary)
- How corrections feed back into artifacts (re-write section vs. append corrections)
- Pre-research interview question design (what questions surface the most useful context)

**What doesn't change:** The artifact templates, the agent behavior, the write pipeline itself. The verification gates are purely additive workflow steps.

**Exit criteria:** A user going through `new-project` and `research-phase` experiences the interview and verification steps. Corrections made during verification are reflected in the artifacts.

---

## Phase 4: Codebase Freshness & Milestone Lifecycle

**What:** Make codebase awareness "living" (staleness detection + auto-remap) and add milestone lifecycle improvements (STATE.md compaction). These are grouped because they all modify the `complete-milestone` workflow and share the theme of keeping the system's understanding of the project fresh.

**Why this ordering:** Staleness detection is the second-biggest gap identified in GSD (after interaction model). It's more self-contained than Cursor support and delivers value for the primary Claude Code runtime.

**Scope:**

### Codebase Staleness Detection (Item 3)
- Add `codebase_mapping` block to `.blueprint/config.json`: `last_mapped_at`, `last_mapped_commit`, `docs_produced`
- New utility in `blueprint-tools.js`: `codebase-staleness-check` — runs `git diff --stat <commit>..HEAD`, returns structured result
- Post-mapping config update: after mappers complete, write timestamp + commit hash to config
- Add staleness check steps to 5 trigger-point workflows:
  - `verify-work` (after phase verification)
  - `complete-milestone` (at major milestone)
  - `new-milestone` (starting fresh milestone)
  - `new-project` (brownfield detection)
  - `debug` (optional, diagnostic context)
- User choice via `AskUserQuestion`: Full remap / Skip / Other
- Staleness heuristic: >10 files changed OR >200 lines changed (tunable)

### Auto-Remap at Milestone/Project Completion (Item 5)
- `complete-milestone` and `complete-project` automatically trigger full codebase remapping
- Embedded inline in the workflow (not cross-invoked via `map-codebase` command)
- Updates `config.json` metadata after remapping

### STATE.md Compaction (Item 6)
- After milestone completion, aggressively compact STATE.md to: current position + 3-5 key learnings + active blockers
- Discard: performance metrics table, accumulated decisions, resolved blockers, session continuity
- New "Key Learnings" section replaces "Accumulated Context"
- 100-line guideline preserved as target enforced by compaction

### config.json Template Updates (Items 3, 5, 6)
- Add `codebase_mapping` block to config template
- Add `agent_models` block to config template (for Cursor per-agent model selection in Phase 5)

**Milestone completion sequence:** finish work → archive → compact STATE.md → auto-remap → update config → close milestone

**Design work required:**
- Compaction heuristics: what constitutes a "key learning" (judgment task, needs agent prompt design)
- Staleness threshold tuning
- Error handling if git is unavailable or repo has no commits

**Exit criteria:** After completing a milestone, STATE.md is compacted, codebase is remapped, and config reflects the new state. Staleness warnings appear at workflow boundaries when codebase has changed significantly.

---

## Phase 5: Cursor Runtime Support

**What:** Make Cursor a first-class installer target with full command/agent support, interaction point conversion, and per-agent model configuration.

**Why last among feature phases:** Cursor support is the most complex new feature (13 interaction points to convert, new conversion functions, new settings workflow) and it's a new runtime target — Claude Code is the primary runtime and works from Phase 1. Cursor support builds on all prior phases being stable.

**Scope:**

### Installer Infrastructure (Item 4)
- Add `--cursor` flag to `bin/install.js`
- Add `getDirName('cursor')` → `.cursor` mapping and global dir logic
- Write to `~/.cursor/` (global) or `.cursor/` (local)
- Add Cursor to uninstall logic

### Command → Skill Conversion (Items 4, 5)
- Implement `convertClaudeToCursorSkill()` — converts Claude Code commands to Cursor skills
- Skills install as `.cursor/skills/{name}/SKILL.md`
- Set `disable-model-invocation: true` on all Blueprint skills (explicit invocation only)
- Numbered prefixes for Cursor palette ordering: `bp-01-map-codebase` through `bp-27-*` (Item 5)
- `CURSOR_SKILL_ORDER` lookup table in installer

### Agent Conversion (Item 4)
- Implement `convertClaudeToCursorAgent()` — strips unsupported fields, adds `model: inherit`
- Strip: `color`, `tools`, `allowed-tools`
- Preserve: `name`, `description`
- Agents install to `.cursor/agents/`

### AskUserQuestion → AskQuestion Conversion (Item 4a)
- Build `CURSOR_INTERACTION_MAP` — lookup table mapping 13 interaction points to template types or bespoke blocks
- 4 reusable gate templates covering most interaction points
- 3 bespoke blocks for complex sequences:
  - discuss-phase deep-dive (#4)
  - settings config chain (#7)
  - debug symptom gathering (#13)
- Dynamic parameter filling per interaction instance

### Per-Agent Model Configuration (Item 5)
- Cursor replaces GSD's profile abstraction with per-agent model selection
- Fetch/present available models from Cursor
- User selects model for each of 11 agent roles
- Store in `config.json` as `agent_models` object
- `agent_models` takes precedence over `model_profile`
- Apply to agents via frontmatter at install time

### Cursor-Specific Settings Workflow (Item 5)
- Multi-step flow: fetch models → per-agent selection → workflow toggles → branching strategy → write config → update frontmatter
- Separate from Claude Code's 5-question setup (which stays unchanged)

### What's Excluded (v2)
- Hooks for Cursor (statusline impossible, update-checker deferred)
- `hooks/gsd-statusline.js` is not copied for Cursor install path

**Design work required:**
- `CURSOR_INTERACTION_MAP` — the most complex piece, mapping 13 points with per-instance parameters
- Cursor model discovery — how to fetch/present available models
- Testing strategy for Cursor install path

**Exit criteria:** `node bin/install.js --cursor` installs Blueprint into `.cursor/` with working skills, agents, and interaction points. Per-agent model configuration works. All 28 commands are accessible as numbered Cursor skills.

---

## Phase 6: Polish & Cleanup

**What:** Remove temporary documentation, final cross-runtime testing, and any loose ends from prior phases.

**Why last:** Cleanup only makes sense once all feature work is stable. Removing docs during active development loses useful reference material.

**Scope:**
- Remove all docs except `docs/gsd-system-map/` and `docs/cursor/` (per Item 7, Decision 5 — these are kept permanently)
- Remove `docs/blueprint/refactor/` (research results and implementation plan — their purpose is fulfilled)
- Final cross-runtime testing: Claude Code, OpenCode, Gemini, Cursor
- Verify all 28 commands work in each supported runtime
- Verify update flow works end-to-end from npm
- README and user-facing documentation updates
- Any edge cases or issues discovered during Phases 3-5

**Exit criteria:** Blueprint is a clean, documented, multi-runtime package on npm with no remaining GSD artifacts in user-facing surfaces.

---

## Phase Dependency Map

```
Phase 1: The Big Rename
    |
    v
Phase 2: npm Distribution & Install Verification
    |
    v
Phase 3: Interaction Model ──┐
    |                         |
Phase 4: Codebase Freshness ─┤  (independent of each other,
    |                         |   ordered by value)
Phase 5: Cursor Support ─────┘
    |
    v
Phase 6: Polish & Cleanup
```

Phases 3, 4, and 5 have no hard dependencies on each other — they all build on the renamed codebase from Phase 1/2. They're ordered by value delivery: interaction model (core differentiator) → codebase freshness (second-biggest GSD gap) → Cursor (new runtime).

---

## Cross-Cutting Concerns

These themes span multiple phases:

| Concern | Phases Affected | Notes |
|---------|----------------|-------|
| Test suite maintenance | 1, 3, 4, 5 | ~2000 lines of tests need updating in Phase 1; new tests needed for features in 3-5 |
| `blueprint-tools.js` modifications | 1, 3, 4 | Rename in Phase 1; new commands in 3-4; potential additions in 5 |
| `config.json` template | 1, 4, 5 | Rename in 1; `codebase_mapping` in 4; `agent_models` in 5 |
| Workflow modifications | 3, 4 | Verification gates in 3; staleness checks + compaction in 4 |
| Installer (`bin/install.js`) | 1, 2, 5 | Rename in 1; verify in 2; Cursor path in 5 |
| Agent prompt updates | 1, 3 | Rename in 1; interaction gate adjustments in 3 |

---

## Research Decisions Summary

For quick reference, the key decisions from all 7 research areas that drive this plan:

| Research Area | Key Decision | Phase |
|---------------|-------------|-------|
| Item 1: Interaction Model | Pre-research interview + post-write verification gates | 3 |
| Item 2: Agent Architecture | All 11 agents survive, rename only | 1 |
| Item 3: Codebase Staleness | Git-based detection, full remap only in v1, 5 trigger points | 4 |
| Item 4: Cursor Support | Full installer target, skill conversion, 13 interaction point conversions | 5 |
| Item 5: Command Set | All 28 commands survive, auto-remap at milestones, numbered Cursor prefixes | 1, 4, 5 |
| Item 6: Templates & Artifacts | All 35 templates survive, verification gates, STATE.md compaction | 1, 3, 4 |
| Item 7: Migration & Distribution | Clean break from GSD, npm as `@lipter7/blueprint`, keep update infrastructure | 1, 2 |
