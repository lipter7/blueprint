# Blueprint Refactor: Research Summary (Archived)

**Source:** Consolidated from 7 research results (Items 1-7) produced during the Blueprint refactor research phase.
**Archived:** 2026-02-11
**Original files:** `docs/blueprint/refactor/research-results/item-{1..7}.md`

---

## Item 1: Interaction Model Design

**Area:** User interaction gaps and workflow gates

**Core Finding:** Interaction gaps are concentrated upstream (research, requirements, roadmap), not downstream. The fix is two gate types added to early stages, not a redesign of every command.

**Decisions:**
1. **Add two gate types to upstream stages only** -- Pre-research interview (structured user input before agents run) and post-creation verification (summary + review after automated creation).
2. **No structural changes to downstream stages** -- discuss-phase, plan-phase, execute-phase, verify-phase remain unchanged.
3. **Research workflow gates** -- Add pre-research interview and post-research walkthrough; research agents and outputs unchanged.
4. **Requirements verification** -- Add summarization + verification gate after automated creation.
5. **Roadmap verification** -- Add summarization + verification gate after automated creation.
6. **Preserve GSD architecture** -- Keep XML prompts, fresh-context subagents, document-driven state, goal-backward verification, deviation rules, atomic commits, wave-based parallel execution.

**Key Insight:** Refactor scope is significantly narrower than originally assumed. Not redesigning every command, not cutting from 11 to 4 agents, not removing research pipeline. Fixing upstream documents fixes downstream quality.

---

## Item 2: Agent Architecture

**Area:** Agent roster, tool architecture, and model routing

**Decisions:**
1. **Keep all 11 agents** -- Rename but don't cut; all serve distinct purposes in context management.
2. **Rename gsd-tools.js to blueprint-tools.js** -- Keep as-is with potential additions for new workflow stages.
3. **Agent renaming** -- All agents drop `gsd-` prefix, become `bp-*` (e.g., gsd-executor -> bp-executor, gsd-planner -> bp-planner).
4. **Model profiles unchanged** -- Keep quality/balanced/budget tiers; planner stays Opus in balanced mode.
5. **Require agent review pass** -- Dedicated phase to audit information flow for new feedback loops before implementation.
6. **Defer blueprint-tools.js modifications** -- Changes beyond renaming need separate phase due to 4,600 line complexity.

**Key Insight:** Original phase docs proposed cutting to 4 agents based on incorrect assumption. Every agent serves a distinct purpose: parallel spawns (speed), heavy synthesis (complex reasoning), verification (independence), research (isolation), execution (fresh context), debugging (persistent investigation). gsd-tools.js provides genuinely hard-to-replicate features: compound init commands, bulletproof frontmatter CRUD, atomic multi-file updates, structured verification suite, dependency analysis, model routing, state machine transitions.

---

## Item 3: Codebase Staleness Detection

**Area:** Detecting when codebase mapping docs are outdated (new capability)

**Decisions:**
1. **Track in config.json** -- Store `last_mapped_at` timestamp, `last_mapped_commit` git hash, and `docs_produced` array.
2. **Git-based detection** -- Use `git diff --stat <commit>..HEAD` excluding .blueprint/.planning dirs.
3. **Staleness threshold** -- Non-trivial = >10 files changed OR >200 lines changed (tunable).
4. **Check at workflow boundaries** -- Fire after work completes: verify-work, complete-milestone, new-milestone, new-project (brownfield), optionally debug.
5. **User-controlled remapping** -- Present AskUserQuestion with options: full remap, skip, or other.
6. **v1: Always full remap** -- Run all 4 mapper agents when user chooses remap; no targeted remapping.
7. **Update metadata after mapping** -- Write new timestamp/commit to config.json and commit docs.

**Key Insight:** GSD has zero staleness detection despite timestamps in docs. Simple git diff provides precise change quantification. Checks fire AFTER work (docs fresh for next planning cycle), not before.

**Implementation:** 3 blueprint-tools.js additions (enhanced `init map-codebase`, new `codebase-staleness-check` command, config writer after mapping). Staleness check step in 5+ workflows. No changes to mapper agents or output templates.

---

## Item 4: Cursor and Claude Code Runtime Compatibility

**Area:** Cursor runtime integration as first-class installer target

**Decisions:**
1. **Cursor as full installer target** -- Add `--cursor` flag to installer, writing to `~/.cursor/` (global) or `.cursor/` (local). Native `.claude/` compatibility insufficient.
2. **Commands become Cursor Skills** -- Install as `.cursor/skills/{name}/SKILL.md` with frontmatter (name, description, disable-model-invocation: true).
3. **Agent frontmatter conversion** -- Strip `tools`/`allowed-tools`, `color`; add `model: inherit`. Prompt bodies unchanged.
4. **AskUserQuestion -> AskQuestion conversion** -- NOT a simple rename. Every reference becomes explicit `AskQuestion` tool instructions with decision gate patterns. Cursor doesn't auto-invoke `AskQuestion` reliably.
5. **Hooks deferred** -- Skip statusline (no Cursor equivalent), defer update checker to v2.
6. **Strip Claude Code frontmatter** -- Remove all `allowed-tools`, `argument-hint`, `color` fields during Cursor install.
7. **All skills use explicit invocation** -- `disable-model-invocation: true` on all Blueprint skills. Users must type `/skill-name`.

**Sub-research 4a (AskQuestion Conversion):**
- **Hybrid strategy**: 4 gate pattern templates + 3 bespoke blocks
- **13 interaction points** audited across 37 files
- **Templates**: Confidence gate, decision gate, continuation gate, action gate
- **Bespoke blocks**: Discuss-phase deep-dive (iterative 4Q per area), settings config (5 chained questions), debug symptoms (5 sequential diagnostics)
- **Structured XML format**: `<cursor_interaction>` blocks with explicit `AskQuestion` usage instructions
- **Installer**: `CURSOR_INTERACTION_MAP` lookup table matches files to gate types, fills templates with instance-specific params

**Frontmatter Mapping (Commands -> Skills):**
| Claude Code | Cursor |
|---|---|
| `name` | `name` (direct) |
| `description` | `description` (direct) |
| `allowed-tools` | removed |
| `argument-hint` | removed |
| -- | `disable-model-invocation: true` (added) |

**Frontmatter Mapping (Agents):**
| Claude Code | Cursor |
|---|---|
| `name` | `name` (direct) |
| `description` | `description` (direct) |
| `tools`/`allowed-tools` | removed |
| `color` | removed |
| -- | `model: inherit` (added) |

**Key Insight:** Most important conversion is `AskUserQuestion` -> `AskQuestion`. Without explicit instructions, Cursor skips interaction gates -- directly undermining Blueprint's core value.

---

## Item 5: Scope and Command Set Validation

**Area:** Complete command roster validation and cross-runtime configuration

**Decisions:**
1. **No commands cut** -- All 28 GSD commands survive as Blueprint commands. Scope change narrower than initial docs.
2. **Auto-remap at completions** -- `complete-milestone` and `complete-project` auto-trigger full codebase remap. Runs inline (not via `map-codebase` skill). Updates metadata.
3. **Cursor gets per-agent model configuration** -- Replace profile abstraction entirely for Cursor. Users select models per-agent, stored in `config.json` as `agent_models` object. Claude Code keeps profiles unchanged.
4. **Numbered prefixes for Cursor skills** -- Workflow-order numbering (e.g., `bp-01-map-codebase`). Claude Code uses natural names. Installer handles via `CURSOR_SKILL_ORDER` mapping.
5. **Settings workflow bifurcates** -- Claude Code: 5-question setup. Cursor: multi-step flow (fetch models -> per-agent selection -> toggles -> branching -> write config -> update frontmatter).

**Full Command Roster (28 commands):**
- Core Pipeline (7): new-project, map-codebase, research-phase, plan-phase, discuss-phase, execute-phase, verify-work
- Phase Management (3): add-phase, insert-phase, remove-phase
- Milestone (4): new-milestone, complete-milestone, audit-milestone, plan-milestone-gaps
- Configuration (4): settings, set-profile, update, reapply-patches
- Utility (8): progress, resume-work, pause-work, quick, list-phase-assumptions, add-todo, check-todos, help
- Debugging (1): debug
- Community (1): join-discord

**Config.json Dual-Runtime Structure:**
```json
{
  "model_profile": "balanced",
  "agent_models": {
    "planner": "claude-sonnet-4-5-20250929",
    "phase-executor": "claude-sonnet-4-5-20250929",
    "phase-verifier": "claude-haiku-4-5-20251001",
    ...
  }
}
```

**Model Resolution:** Check `agent_models[agentName]` first (explicit), fallback to `MODEL_PROFILES[agentName][profile]` (profile-based).

**Key Insight:** User directive: "I don't think we prune out anything. We just need to fix the core issue of having a lack of user input during early-stage mapping, research, planning, roadmapping."

---

## Item 6: Template and Artifact Design

**Area:** Template design and artifact structure

**Decisions:**
1. **Same artifacts, no new types** -- All 35 templates survive unchanged. Enhanced interaction doesn't alter what artifacts are produced, only how they're validated.
2. **Post-write verification gate** -- After batch questions and writing, orchestrator reads back artifact, summarizes to user, incorporates corrections. Fixes early-answer distortion problem. Applies to: discuss-phase (CONTEXT.md), new-project (PROJECT.md, REQUIREMENTS.md, ROADMAP.md), research-phase (*-RESEARCH.md).
3. **No template simplification** -- All 35 templates kept. 4 codebase mapping focus areas remain. Summary variants preserved.
4. **STATE.md compaction after milestones** -- Aggressively compact to: current position + 3-5 key learnings + active blockers. Discard: Performance Metrics table, accumulated decisions, resolved blockers, Session Continuity section.
5. **Keep 100-line guideline** -- STATE.md limit preserved. Compaction enforces it at milestone boundaries. Limit exists because STATE.md loads into every agent's context window.
6. **PROGRESS.md is not an artifact** -- No separate file. `/bp:progress` synthesizes from STATE.md + ROADMAP.md + summaries for display only.

**Key Insight:** The distortion problem isn't in artifact design but in validation timing. Post-write verification gates are purely additive -- no restructuring needed.

---

## Item 7: Migration and Coexistence Strategy

**Area:** Distribution, versioning, and migration path

**Decisions:**
1. **Clean break, no GSD coexistence** -- Users uninstall GSD before installing Blueprint. No migration tooling, no backward-compatibility code.
2. **`.blueprint/` only, no `.planning/` support** -- Existing GSD projects not auto-detected or migrated. Users start fresh.
3. **npm distribution** -- Package: `@lipter7/blueprint`. Install: `npx @lipter7/blueprint`. Same model as GSD.
4. **Keep existing update workflow** -- Port as `/bp:update` with zero architectural changes. Only package name and command prefixes change.
5. **Repo cleanup** -- Remove `docs/workflow-example/` now. Remove everything except `docs/gsd-system-map/` and `docs/cursor/` after refactor.
6. **Update check hook: straight rename** -- `hooks/bp-check-update.js`, npm query to new package name, cache to `bp-update-check.json`.

**Renaming Scope:** 113+ files, 2,254+ references across 6 categories:
- Command prefix `/gsd:` -> `/bp:`: ~200+ occurrences, 58+ files
- Agent names `gsd-*` -> `bp-*`: ~80+ occurrences, 22 files
- Directory `get-shit-done/` -> `blueprint/`: ~40+ occurrences, 50+ files
- Branding "Get Shit Done" -> "Blueprint": ~10 occurrences, 5-10 files
- Hook names `gsd-*` -> `bp-*`: ~20+ occurrences, 10+ files
- Artifact path `.planning/` -> `.blueprint/`: ~30+ occurrences, 20+ files

**Tricky References:**
1. MODEL_PROFILES in gsd-tools.js -- 11 hardcoded agent names
2. Installer file pattern matching -- multiple `startsWith('gsd-')` checks
3. OpenCode conversion -- existing `/gsd:` regex transforms
4. Git branch templates -- `gsd/phase-{phase}-{slug}` naming
5. Embedded command invocations in workflows/templates

---

## Cross-Item Decision Summary

| # | Decision | Items | Phase |
|---|---|---|---|
| 1 | Pre-research interview + post-write verification gates | 1, 6 | 3 |
| 2 | All 11 agents survive, rename only | 2 | 1 |
| 3 | All 35 templates survive, no cuts | 6 | 1 |
| 4 | All 28 commands survive, no cuts | 5 | 1 |
| 5 | Git-based staleness detection, 5 trigger points, full remap only | 3 | 4 |
| 6 | Auto-remap at milestone/project completion | 5 | 4 |
| 7 | STATE.md compaction at milestone boundaries | 6 | 4 |
| 8 | Cursor as full installer target with Skills + Agents | 4 | 5 |
| 9 | AskUserQuestion -> AskQuestion hybrid conversion (4 templates + 3 bespoke) | 4, 4a | 5 |
| 10 | All Cursor skills: disable-model-invocation: true | 4b | 5 |
| 11 | Per-agent model config for Cursor, profiles for Claude Code | 5 | 5 |
| 12 | Numbered prefixes for Cursor palette ordering | 5 | 5 |
| 13 | Clean break from GSD, npm as @lipter7/blueprint | 7 | 1, 2 |
| 14 | Settings workflow bifurcates by runtime | 5 | 5 |
| 15 | blueprint-tools.js preserved as-is beyond rename | 2 | 1 |
