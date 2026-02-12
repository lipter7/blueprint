# Blueprint Refactor: Implementation Plans Summary (Archived)

**Source:** Consolidated from 6 implementation plan files (Phases 0-5).
**Archived:** 2026-02-11
**Original files:** `docs/blueprint/refactor/implementation-plan/{00-05}-*.md`

---

## Phase Overview (00)

The refactor is organized into **6 phases** ordered by dependency and risk. Phases 1-2 are sequential foundations. Phases 3-5 are independent of each other (all build on Phase 1/2), ordered by value: interaction model (core differentiator) > codebase freshness (second-biggest GSD gap) > Cursor support (new runtime).

```
Phase 1: The Big Rename
    |
    v
Phase 2: npm Distribution
    |
    v
Phase 3: Interaction Model ──┐
    |                         |
Phase 4: Codebase Freshness ─┤  (independent, ordered by value)
    |                         |
Phase 5: Cursor Support ─────┘
    |
    v
Phase 6: Polish & Cleanup
```

**Cross-cutting concerns:** Test suite maintenance (Phases 1,3,4,5), `blueprint-tools.js` modifications (1,3,4), `config.json` template (1,4,5), workflow modifications (3,4), installer (1,2,5), agent prompts (1,3).

---

## Phase 1: The Big Rename — COMPLETE

**Purpose:** Transform every GSD reference (~3,600 occurrences across ~150 files) into Blueprint equivalents in a single coordinated pass.

**Naming Conventions:**
- Package: `get-shit-done-cc` -> `@lipter7/blueprint`
- Directory: `get-shit-done/` -> `blueprint/`
- Commands: `/gsd:` -> `/bp:`
- Agents/hooks: `gsd-` -> `bp-`
- Tools: `gsd-tools.js` -> `blueprint-tools.js`
- Artifacts: `.planning/` -> `.blueprint/`

**10 Execution Steps:**
1. Pre-flight cleanup (delete docs/workflow-example/, backup files)
2. Directory renames via git mv (`get-shit-done/` -> `blueprint/`, `commands/gsd/` -> `commands/bp/`)
3. File renames via git mv (19 files: 11 agents, 2 hooks, 2 tools, 4 assets)
4. High-specificity replacements: `gsd-tools` -> `blueprint-tools` (~434), `get-shit-done-cc` -> `@lipter7/blueprint` (~15)
5. Medium-specificity: `get-shit-done` -> `blueprint` (~652), `/gsd:` -> `/bp:` (~754), `.planning/` -> `.blueprint/` (~1,318)
6. Agent/hook names: `gsd-` -> `bp-` (~250)
7. Branding: `Get Shit Done` -> `Blueprint` (~20), `GSD` -> `Blueprint` (~150, manual review)
8. Manual fixes (5 parallel sub-agents): blueprint-tools.js internals, install.js patterns, CLAUDE.md/README.md rewrites, package.json/build scripts, test suite imports
9. Test suite fixes (~140+ fixture path updates)
10. Verification (grep audit, test pass, install test, hooks build)

**Sub-agents:** 5 parallel for Step 8 (blueprint-tools.js, install.js, docs, config, tests).

**Key design decision:** Replacement ordering is critical -- most-specific to least-specific prevents substring corruption.

---

## Phase 2: npm Distribution — COMPLETE

**Purpose:** Publish `@lipter7/blueprint` to npm and verify full install/update/patch lifecycle end-to-end.

**15 Execution Steps:**
1. Fix 3 Phase 1 leftover GSD references (update.md command name, workflow paths)
2. Version bump to 2.0.0 (signals clean break)
3. CHANGELOG.md preparation (new entry, updated header/URLs, historical entries preserved)
4. Build hooks (`npm run build:hooks`)
5. Pre-publish dry run (`npm pack --dry-run`, ~125 files, ~350KB)
6. Publish (`npm publish --access public`)
7. Test global Claude Code install (`npx @lipter7/blueprint --claude --global`)
8. Test local Claude Code install (`--claude --local`)
9. Test update check hook (cache file, statusline indicator)
10. Test local patch system (modify file, reinstall, verify backup)
11. Test uninstall (verify cleanup, preserve non-Blueprint files)
12. Test OpenCode install path (flattened commands, frontmatter conversion)
13. Test Gemini install path (commands, agents, hooks, experimental agents)
14. Run test suite
15. Final verification summary

**No sub-agents needed.** All steps sequential (filesystem conflicts in parallel installs).

**Key design decision:** Version 2.0.0 chosen to signal breaking changes from GSD fork.

---

## Phase 3: Interaction Model Enhancements — COMPLETE

**Purpose:** Add pre-research interviews and post-write verification gates -- the core differentiator from GSD. Puts humans in the loop at every high-leverage moment.

**What changed:** 6 workflows modified with verification gates and/or pre-research interviews.

| Workflow | Enhancement |
|----------|-------------|
| `discuss-phase` | Post-write gate for CONTEXT.md |
| `new-project` | Pre-research interview + post-research gate + 3 artifact gates (PROJECT.md, REQUIREMENTS.md, ROADMAP.md) |
| `new-milestone` | Pre-research interview + post-research gate |
| `research-phase` | Pre-research interview + post-research gate |
| `plan-phase` | Pre-research interview + post-research summary |

**What did NOT change:** blueprint-tools.js, test suite, installer, agent prompts, artifact templates, config schema.

**9 Execution Steps:**
1. Create `verification-gates.md` reference (~300 lines) -- universal gate pattern, artifact-specific summaries, correction protocol, interview questions, auto mode behavior
2. Add CONTEXT.md gate to discuss-phase (~30 lines)
3. Add pre-research interview to new-project (~25 lines)
4. Add post-research gate to new-project (~30 lines)
5. Add PROJECT.md (5a), REQUIREMENTS.md (5b), ROADMAP.md (5c) gates to new-project (~50 lines)
6. Add interview (6a) + gate (6b) to research-phase (~45 lines)
7. Add interview (7a) + summary (7b) to plan-phase (~35 lines)
8. Add interview (8a) + gate (8b) to new-milestone (~55 lines)
9. Verification audit (workflow read-through, interaction flow, auto mode regression, consistency)

**Sub-agents:** 5 parallel after Step 1 (one per workflow file, no conflicts).

**Key design decisions:**
- Post-write read-backs (not pre-write previews) -- simpler, survives context resets
- Artifact-specific summaries (not generic) -- each type highlights different decisions
- Inline corrections (not re-generation) -- edit file directly unless extensive restructuring needed
- Config-controlled gates -- auto/yolo mode skips all gates
- Universal pattern documented once in reference file, invoked by name

**~570 lines across 6 files (1 new, 5 modified).**

---

## Phase 4: Codebase Freshness & Milestone Lifecycle — COMPLETE

**Purpose:** Make codebase awareness "living" (staleness detection + auto-remap) and add STATE.md compaction at milestone boundaries.

**Design parameters:**
- Staleness heuristic: >10 files changed OR >200 lines changed
- Detection: `git diff --stat <commit>..HEAD` excluding .blueprint/.planning
- v1: Always full remap (all 4 mapper agents), no partial/targeted
- Auto-remap at milestone completion: automatic (no user prompt)
- Staleness at other trigger points: user-prompted (remap/skip)
- STATE.md compaction: discard metrics, decisions, resolved blockers, session continuity; keep position, 3-5 key learnings, active blockers; target <100 lines

**11 Execution Steps:**
1. Config template updates -- add `codebase_mapping` block and `agent_models` placeholder to config.json; add compaction docs to state.md template
2. blueprint-tools.js infrastructure (~250 new lines):
   - 2a-b: Update loadConfig and config-ensure for new fields
   - 2c: New `codebase-staleness-check` command (~100 lines)
   - 2d: New `state compact` command (~80 lines)
   - 2e: Wire into dispatch
   - 2f: Update 5 init functions with staleness metadata
3. map-codebase.md -- add post-mapping metadata update step
4. Define standard staleness check block pattern (embedded in 4 workflows)
5. verify-work.md -- add staleness check after phase verification
6. complete-milestone.md -- add STATE.md compaction (6a) + auto-remap (6b) steps
7. new-milestone.md -- add staleness check early in flow
8. new-project.md -- add brownfield staleness check
9. debug.md -- add optional staleness note (2x threshold, non-blocking)
10. Test suite (~200 lines): staleness-check, state-compact, loadConfig, init functions
11. Verification (tests, manual staleness/compact tests, grep audit)

**Sub-agents:** 4 parallel after Step 2 (map-codebase, complete-milestone, 4 staleness workflows, tests).

**~715 lines across 10 files.**

---

## Phase 5: Cursor Runtime Support — COMPLETE

**Purpose:** Make Cursor a first-class installer target with Skills, Agents, interaction point conversion, and per-agent model configuration.

**Architecture:**
- Commands -> Skills in `.cursor/skills/bp-NN-name/SKILL.md`
- Agents -> `.cursor/agents/` with `model: inherit`
- AskUserQuestion -> `<cursor_interaction>` XML blocks (4 gate templates + 3 bespoke blocks)
- Per-agent models in `config.json` -> `agent_models` overrides profile-based resolution
- All skills: `disable-model-invocation: true`
- Hooks deferred to v2

**10 Execution Steps:**
1. Installer infrastructure (~100 lines): `--cursor` flag, getDirName, getGlobalDir, menu option 4, banner/labels
2. Conversion functions (~290 lines):
   - `convertClaudeToCursorSkill()` -- strip allowed-tools/argument-hint, convert name, add disable-model-invocation
   - `convertClaudeToCursorAgent()` -- strip color/tools, add model:inherit
   - `copySkillsFromCommands()` -- nested dirs with numbered prefixes
3. Interaction conversion system (~430 lines) **[most complex]**:
   - `CURSOR_INTERACTION_MAP` -- 13 points across 10 files
   - 4 gate templates (confidence, decision, continuation, action)
   - 3 bespoke blocks (discuss deep-dive, settings config, debug symptoms)
   - `applyInteractionConversions()` -- template filling + catch-all rename
4. `CURSOR_SKILL_ORDER` -- 28-entry lookup table for palette numbering
5. Install logic (~80 lines): isCursor branches for skills, agents, hooks skip, settings skip
6. Uninstall logic (~30 lines): remove skills/bp-* directories
7. Per-agent model config (~125 lines): config template, resolveModelInternal override, settings-cursor.md workflow, set-profile adaptation
8. Command reference conversion: `/bp:X` -> `/bp-NN-X`
9. Test suite (~500 lines, 28+ test cases): conversion functions, interactions, integration
10. Verification: install test, interaction audit, skill naming, cross-runtime regression, uninstall, test pass

**Sub-agents:** Round 1 (3 parallel after Step 1): conversion functions, interaction map, settings workflow. Round 2 (2 parallel after Step 5): test suite, model resolution.

**~1,700 lines across 5 files (1 new).**

---

## Phase 6: Polish & Cleanup (Planned, Not Yet Executed)

**Purpose:** Remove temporary documentation, final cross-runtime testing, loose ends.

**Scope:**
- Remove all docs except `docs/gsd-system-map/` and `docs/cursor/`
- Remove `docs/blueprint/refactor/` (research + plans -- purpose fulfilled)
- Final cross-runtime testing: Claude Code, OpenCode, Gemini, Cursor
- Verify all 28 commands work in each runtime
- Verify update flow end-to-end from npm
- README and user-facing documentation updates

**Exit criteria:** Blueprint is a clean, documented, multi-runtime package on npm with no remaining GSD artifacts in user-facing surfaces.

---

## Aggregate Metrics

| Phase | Status | Files Changed | Lines Added | Sub-Agents |
|-------|--------|---------------|-------------|------------|
| 1: Big Rename | Complete | ~150 | ~3,600 replacements | 5 |
| 2: npm Distribution | Complete | 4 | ~50 | 0 |
| 3: Interaction Model | Complete | 6 | ~570 | 5 |
| 4: Codebase Freshness | Complete | 10 | ~715 | 4 |
| 5: Cursor Support | Complete | 5 | ~1,700 | 5 |
| 6: Polish & Cleanup | Planned | TBD | TBD | TBD |
