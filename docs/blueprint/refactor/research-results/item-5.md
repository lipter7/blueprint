# Research Result: Scope and Command Set Validation

**Research area:** Area 5 from `02-research-planner.md`
**Status:** Complete

---

## Core Finding

All 28 GSD commands survive the transition to Blueprint. None are cut. The user's directive is clear: "I don't think we prune out anything. We just need to fix the core issue of having a lack of user input during early-stage mapping, research, planning, roadmapping, etc." The scope changes are: (1) auto-remap at milestone/project completions, (2) Cursor gets pure per-agent model configuration replacing the profile abstraction, (3) Cursor skills get numbered prefixes for palette ordering, and (4) the settings workflow bifurcates by runtime — Claude Code keeps profiles, Cursor gets per-agent model selection.

---

## Full Command Roster

All 28 commands, renamed from `gsd:*` to `bp:*` (Claude Code) / `bp-*` (Cursor):

### Core Pipeline (7 commands)

| GSD Command | Blueprint Command | Description | Changes |
|-------------|-------------------|-------------|---------|
| gsd:new-project | bp:new-project | Initialize project with context gathering | Add verification gates (Item 1) |
| gsd:map-codebase | bp:map-codebase | Parallel codebase analysis | Rename only; staleness integration is in the workflow, not the command |
| gsd:research-phase | bp:research-phase | Research before planning | Add pre-research interview + post-research walkthrough (Item 1) |
| gsd:plan-phase | bp:plan-phase | Create execution plans | Rename only (upstream fixes make this work better) |
| gsd:discuss-phase | bp:discuss-phase | Phase context gathering | Rename only (already most interactive command) |
| gsd:execute-phase | bp:execute-phase | Wave-based parallel execution | Rename only |
| gsd:verify-work | bp:verify-work | Goal-backward verification | Rename + embed staleness check (Item 3) |

### Phase Management (3 commands)

| GSD Command | Blueprint Command | Description | Changes |
|-------------|-------------------|-------------|---------|
| gsd:add-phase | bp:add-phase | Add phase to end of milestone | Rename only |
| gsd:insert-phase | bp:insert-phase | Insert urgent decimal phase | Rename only |
| gsd:remove-phase | bp:remove-phase | Remove future phase, renumber | Rename only |

### Milestone (4 commands)

| GSD Command | Blueprint Command | Description | Changes |
|-------------|-------------------|-------------|---------|
| gsd:new-milestone | bp:new-milestone | Start new milestone cycle | Rename + embed staleness check (Item 3) |
| gsd:complete-milestone | bp:complete-milestone | Archive completed milestone | Rename + **auto-remap** (see below) |
| gsd:audit-milestone | bp:audit-milestone | Verify milestone completeness | Rename only |
| gsd:plan-milestone-gaps | bp:plan-milestone-gaps | Create phases to close audit gaps | Rename only |

### Configuration (4 commands)

| GSD Command | Blueprint Command | Description | Changes |
|-------------|-------------------|-------------|---------|
| gsd:settings | bp:settings | Configure workflow toggles and models | **Major refactoring** for Cursor per-agent model selection (see below) |
| gsd:set-profile | bp:set-profile | Switch model profile | Claude Code only; Cursor equivalent is per-agent model setting |
| gsd:update | bp:update | Update to latest version | Rename + update for Blueprint package name |
| gsd:reapply-patches | bp:reapply-patches | Reapply local modifications | Rename only |

### Utility (8 commands)

| GSD Command | Blueprint Command | Description | Changes |
|-------------|-------------------|-------------|---------|
| gsd:progress | bp:progress | Check progress, route to next action | Rename only |
| gsd:resume-work | bp:resume-work | Resume from previous session | Rename only; kept for all runtimes |
| gsd:pause-work | bp:pause-work | Create context handoff | Rename only; kept for all runtimes |
| gsd:quick | bp:quick | Quick task with GSD guarantees | Rename only |
| gsd:list-phase-assumptions | bp:list-phase-assumptions | Surface assumptions before planning | Rename only |
| gsd:add-todo | bp:add-todo | Capture idea/task as todo | Rename only |
| gsd:check-todos | bp:check-todos | List and select pending todos | Rename only |
| gsd:help | bp:help | Show command reference | Rewrite for Blueprint naming |

### Debugging (1 command)

| GSD Command | Blueprint Command | Description | Changes |
|-------------|-------------------|-------------|---------|
| gsd:debug | bp:debug | Systematic debugging with persistent state | Rename only |

### Community (1 command — may drop or replace)

| GSD Command | Blueprint Command | Description | Changes |
|-------------|-------------------|-------------|---------|
| gsd:join-discord | *(TBD)* | Join community | Replace with Blueprint community link or drop |

**Total: 28 commands. 0 cut.**

---

## Decision 1: No Commands Cut

**Decision:** All 28 GSD commands survive the rename to Blueprint. Nothing is pruned.

**User's reasoning:** "I honestly don't think we prune out anything. We just need to fix the core issue of having a lack of user input during early-stage mapping, research, planning, roadmapping, etc. to make sure that the decisions captured are 100% accurate."

**What this means:** The refactor scope is narrower than the existing phase docs assumed. The phase docs proposed cutting to 8 commands (6 core + 2 utility). The actual plan is: rename all 28, fix the upstream interaction model (Item 1), and make targeted changes to specific commands (settings, completion workflows).

**Commands specifically confirmed as keeping:**
- **resume-work / pause-work:** "super useful for context management and would be useful in any AI coding infrastructure: Claude, Cursor, or whatever it may be."
- **debug:** Kept as-is. Both Cursor and Claude Code benefit from systematic debugging with persistent state.
- **add-phase / insert-phase / remove-phase:** Kept. Direct roadmap editing is simpler in theory, but these commands handle renumbering, directory creation, and STATE.md updates — genuinely useful automation.
- **Milestone commands (new, complete, audit, plan-gaps):** Kept. The full milestone lifecycle (create → execute phases → audit → close gaps → complete) is well-designed and needed for long-running projects.

---

## Decision 2: Auto-Remap at Milestone and Project Completions

**Decision:** `complete-milestone` and `complete-project` (if it exists as a distinct command) auto-trigger a full codebase remap when they run. This is not a prompt — the remap runs automatically.

**User's reasoning:** When a milestone is completed, the codebase has changed significantly. The mapping docs should always be fresh when starting the next cycle. Similarly for project completion.

**How this interacts with Item 3 (Staleness Detection):**
- **complete-milestone / complete-project:** Auto-remap. No staleness check needed — just run the mappers.
- **new-milestone / new-project:** Standard Item 3 staleness check (detect changes, prompt user, they choose to remap or skip).
- **verify-work:** Standard Item 3 staleness check.
- Other trigger points from Item 3 remain unchanged.

**How this interacts with Item 4b (`disable-model-invocation: true`):**
The auto-remap does NOT invoke the `map-codebase` skill. Instead, the `complete-milestone` workflow embeds the mapping step directly — spawning the 4 mapper agents inline with appropriate prompts. This is consistent with the existing architecture where workflows embed sub-workflows; commands never cross-invoke other commands. Therefore `disable-model-invocation: true` on all skills (Item 4b) remains correct and does not conflict with auto-remap capabilities.

**Implementation:** Add a step to the `complete-milestone` workflow (and `complete-project` if it exists) that:
1. Spawns the 4 codebase mapper agents (tech, arch, quality, concerns) — same agents and prompts as `map-codebase`
2. Waits for completion
3. Updates `config.json` with new `last_mapped_at` and `last_mapped_commit` (per Item 3)
4. Continues with the normal completion workflow (archival, git tag, etc.)

The mapping step runs AFTER the milestone work is complete but BEFORE archival, so the codebase docs reflect the final state of the milestone's work.

---

## Decision 3: Cursor Gets Pure Per-Agent Model Configuration

**Decision:** For Cursor installations, the profile abstraction (quality/balanced/budget) is replaced entirely by per-agent model selection. Users fetch available models, select a model for each agent role, and those selections are stored and applied directly.

**User's reasoning:** "Instead of model profile offering the 3 options: quality / balanced / budget, that just get configured in one place, we will need to create a custom system for fetching what models are available and allow the user to configure models to correspond with each role. We will then need to manually set all sub agents to whatever configuration the user selects."

**What this means for each runtime:**

### Claude Code: Profiles survive unchanged

The current system works well:
- `MODEL_PROFILES` in `blueprint-tools.js` maps 11 agents × 3 profiles → model names
- `config.json` stores `model_profile: "balanced"`
- `resolveModelInternal()` does the lookup at workflow init time
- Workflows get pre-resolved model strings in their init JSON

The `/bp:settings` command for Claude Code presents the same 5-question interactive setup (profile, research toggle, plan checker toggle, verifier toggle, branching strategy). The `/bp:set-profile` command for Claude Code provides the same quick profile switcher.

### Cursor: Per-agent model selection

The `/bp:settings` Cursor skill replaces the profile question with a per-agent model configuration flow:

1. **Fetch available models** — Query Cursor's available models (the mechanism for this depends on Cursor's API; the user's workflow examples show models being specified directly)
2. **Present per-role selection** — For each agent role (planner, executor, verifier, debugger, codebase-mapper, phase-researcher, project-researcher, research-synthesizer, roadmapper, plan-checker, integration-checker), present available models and let the user select
3. **Store selections** — Write to `config.json` as an `agent_models` object:
   ```json
   {
     "agent_models": {
       "planner": "claude-sonnet-4-5-20250929",
       "phase-executor": "claude-sonnet-4-5-20250929",
       "phase-verifier": "claude-haiku-4-5-20251001",
       "debugger": "claude-sonnet-4-5-20250929",
       "codebase-mapper": "claude-haiku-4-5-20251001",
       "phase-researcher": "claude-haiku-4-5-20251001",
       "project-researcher": "claude-haiku-4-5-20251001",
       "research-synthesizer": "claude-haiku-4-5-20251001",
       "roadmapper": "claude-sonnet-4-5-20250929",
       "plan-checker": "claude-haiku-4-5-20251001",
       "integration-checker": "claude-haiku-4-5-20251001"
     }
   }
   ```
4. **Apply to agents** — Update agent frontmatter files to use the selected models (either via `model: <model-name>` in frontmatter or by reading from config at spawn time)

**The `/bp:set-profile` command for Cursor** either:
- Does not exist (profiles don't apply), or
- Acts as a preset applier (selects a pre-defined set of per-agent models that match quality/balanced/budget patterns, then writes them to `agent_models`)

The second option provides a nice on-ramp: "start with a preset, customize later."

### Config.json accommodates both

```json
{
  "model_profile": "balanced",        // Claude Code reads this
  "agent_models": {                   // Cursor reads this (takes precedence if present)
    "planner": "claude-sonnet-4-5-20250929",
    "phase-executor": "claude-sonnet-4-5-20250929"
    // ... etc
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  },
  "git": {
    "branching_strategy": "none"
  }
}
```

The model resolution logic in `blueprint-tools.js` can check `agent_models[agentName]` first (explicit per-agent), falling back to `MODEL_PROFILES[agentName][profile]` (profile-based). This means Claude Code users who want per-agent control can also use the `agent_models` config — the system is additive.

### Reference: User's Workflow Examples

The user documented a comprehensive guide at `docs/workflow-example/` showing how Cursor workflows handle sub-agent spawning with explicit model parameters. Key patterns:
- Sub-agents spawned with `model: sonnet` or similar directly in prompts
- No centralized model resolution — models are specified at the point of spawning
- The lead agent controls model assignment
- YAML frontmatter in plan documents tracks todo state

These patterns inform how Blueprint's Cursor workflows should handle model assignment: read from `config.json`'s `agent_models`, substitute into Task() spawn prompts.

---

## Decision 4: Numbered Prefixes for Cursor Skills

**Decision:** Cursor skills get numbered prefixes matching workflow order. Claude Code commands use natural names. The installer handles the conversion.

**Cursor naming convention:**

| # | Cursor Skill Name | Claude Code Name |
|---|-------------------|------------------|
| 01 | bp-01-map-codebase | bp:map-codebase |
| 02 | bp-02-new-project | bp:new-project |
| 03 | bp-03-new-milestone | bp:new-milestone |
| 04 | bp-04-discuss-phase | bp:discuss-phase |
| 05 | bp-05-research-phase | bp:research-phase |
| 06 | bp-06-plan-phase | bp:plan-phase |
| 07 | bp-07-execute-phase | bp:execute-phase |
| 08 | bp-08-verify-work | bp:verify-work |
| 09 | bp-09-audit-milestone | bp:audit-milestone |
| 10 | bp-10-plan-milestone-gaps | bp:plan-milestone-gaps |
| 11 | bp-11-complete-milestone | bp:complete-milestone |
| 12 | bp-12-add-phase | bp:add-phase |
| 13 | bp-13-insert-phase | bp:insert-phase |
| 14 | bp-14-remove-phase | bp:remove-phase |
| 15 | bp-15-progress | bp:progress |
| 16 | bp-16-resume-work | bp:resume-work |
| 17 | bp-17-pause-work | bp:pause-work |
| 18 | bp-18-quick | bp:quick |
| 19 | bp-19-debug | bp:debug |
| 20 | bp-20-list-phase-assumptions | bp:list-phase-assumptions |
| 21 | bp-21-add-todo | bp:add-todo |
| 22 | bp-22-check-todos | bp:check-todos |
| 23 | bp-23-settings | bp:settings |
| 24 | bp-24-set-profile | bp:set-profile |
| 25 | bp-25-update | bp:update |
| 26 | bp-26-reapply-patches | bp:reapply-patches |
| 27 | bp-27-help | bp:help |

**Numbering rationale:** Core pipeline commands first (roughly in workflow order: map → init → discuss → research → plan → execute → verify), then milestone lifecycle, then phase manipulation, then utilities, then configuration.

**The exact numbering is a draft** — final ordering should be reviewed during implementation. The key decision is: yes, Cursor skills are numbered; no, Claude Code commands are not.

**Installer implementation:** The `convertClaudeToCursorSkill()` function reads a `CURSOR_SKILL_ORDER` mapping (command name → number) and prepends the number to the skill directory name.

---

## Decision 5: The Settings Workflow Bifurcates by Runtime

**Decision:** The `/bp:settings` command has substantially different behavior between Claude Code and Cursor.

### Claude Code settings (minimal changes from GSD)

5-question interactive setup, same as current:
1. Model profile (quality / balanced / budget)
2. Spawn plan researcher? (yes/no)
3. Spawn plan checker? (yes/no)
4. Spawn execution verifier? (yes/no)
5. Git branching strategy (none / per-phase / per-milestone)

### Cursor settings (major refactoring required)

Multi-step interactive flow:
1. **Fetch available models** — Discover what models Cursor has access to
2. **Present per-agent model selection** — For each of the 11 agent roles, let user pick a model
3. **Workflow toggles** — Same as Claude Code (research, plan_check, verifier)
4. **Git branching strategy** — Same as Claude Code (none / per-phase / per-milestone)
5. **Write configuration** — Store agent_models + workflow toggles + branching to config.json
6. **Update agent frontmatter** — Write selected models into each agent's frontmatter file

Steps 1-2 are the complex new work. Steps 3-5 are similar to Claude Code. Step 6 is Cursor-specific (agents need `model: <name>` in their frontmatter to use the selected model, or workflows must read config and pass models explicitly at spawn time).

**The `/bp:set-profile` command** could serve as a preset applier for Cursor — "set all agents to quality/balanced/budget defaults" as a shortcut, then let the user fine-tune with `/bp:settings`.

### Implementation consideration

The settings workflow and command will need runtime-aware branching. Two approaches:
1. **Single command, runtime detection:** The settings workflow detects which runtime it's in and branches behavior. Simpler to maintain (one file), but more complex logic inside.
2. **Separate workflows per runtime:** `settings-claude.md` and `settings-cursor.md`. Cleaner separation, but two files to maintain.

This is an implementation decision that can be made during the implementation phase. Either approach works.

---

## What Stays the Same

- **All 28 commands survive** — renamed, not restructured
- **All 11 agents survive** — per Item 2
- **The core pipeline** (map → init → discuss → plan → execute → verify) — unchanged architecturally
- **The milestone lifecycle** (new → audit → plan-gaps → complete) — unchanged except auto-remap at completion
- **Phase manipulation** (add, insert-decimal, remove-with-renumber) — unchanged
- **Utility commands** (progress, resume-work, pause-work, quick, todos, help) — unchanged
- **The debugging command** — unchanged
- **Wave-based parallel execution** — unchanged
- **Deviation rules, checkpoint protocol, goal-backward verification** — unchanged
- **Document-driven state in `.blueprint/`** — unchanged
- **Claude Code's profile-based model configuration** — unchanged

---

## Implications for Implementation Planning

### What's Mechanical (Can Be Batched)

- Rename all 28 commands from `gsd:*` to `bp:*` in command files
- Rename all internal references within workflows (`gsd-tools.js` → `blueprint-tools.js`, `.planning/` → `.blueprint/`, etc.)
- Add numbered prefix mapping for Cursor skill names in installer
- Update help command output for Blueprint naming
- Update "Next Up" suggestions in all command outputs to use Blueprint names

### What Requires Design Work

- **Auto-remap step in `complete-milestone` workflow:** Design the embedded mapping step that runs the 4 mapper agents inline. Needs to handle: model resolution for mappers, config.json metadata update, error handling if mapping fails mid-completion.
- **Cursor settings model fetching:** How to discover available models in Cursor. This may require Cursor API integration or a simpler approach (present known model names, let user pick).
- **Agent frontmatter model application for Cursor:** When the user configures per-agent models, how are they applied? Written directly to frontmatter files? Read from config at spawn time? Both approaches have trade-offs.
- **Settings runtime branching:** Whether to use one command with runtime detection or two separate workflows.

### What's Its Own Phase

- **Cursor settings and per-agent model configuration:** This is the most complex new feature in the command set. It involves: model discovery, per-agent selection UI, config storage, agent frontmatter updates, and integration with all workflow spawn points. This deserves its own implementation phase due to the complexity the user identified: "end-to-end, from model fetching and resolution to sub-agent updating and setting, this workflow becomes pretty complicated."
- **Settings command + set-profile command refactoring for Cursor** — closely coupled with the per-agent model work above.

---

## Open Questions (For Other Research Areas)

- Do any templates need changes given the full 28-command set survives? (Area 6: Template/Artifact Design)
- Does config.json need new fields beyond `agent_models` for the expanded settings? (Area 6: Template/Artifact Design)
- When does the rename from `gsd:*` to `bp:*` happen in the migration sequence? (Area 7: Migration and Coexistence)
- Should the `join-discord` command be kept, replaced with a Blueprint community link, or dropped? (Area 7: Migration and Coexistence)
