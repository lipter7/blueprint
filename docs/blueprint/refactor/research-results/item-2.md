# Research Result: Agent Architecture

**Research area:** Area 2 from `02-research-planner.md`
**Status:** Complete

---

## Core Finding

All 11 GSD agents survive the transition to Blueprint. None are cut. The architecture is sound -- context window management via subagents is the framework's core value proposition. The changes are:

1. Rename all agents from `gsd-*` to Blueprint equivalents
2. Add a dedicated review pass to ensure agents have the right information for the new interaction gates (verification/feedback loops from Item 1)
3. Rename and keep `gsd-tools.js` as `blueprint-tools.js`, with potential additions for new workflow stages

---

## Agent Roster

All 11 agents, renamed:

| GSD Name | Blueprint Name | Lines | Fresh Context? | Justification |
|----------|---------------|-------|----------------|---------------|
| gsd-codebase-mapper | codebase-mapper | 762 | YES | 4 parallel deep explorations; writes directly to disk |
| gsd-debugger | debugger | 1,199 | YES | Unbounded investigation; persistent session files survive context resets |
| gsd-executor | phase-executor | 403 | YES | Core quality strategy -- fresh context per plan |
| gsd-integration-checker | integration-checker | 424 | YES | Cross-phase wiring verification; heavy grepping for large codebases |
| gsd-phase-researcher | phase-researcher | 470 | YES | Heavy web research + Context7 queries; planner shouldn't see search noise |
| gsd-plan-checker | plan-checker | 623 | YES | Separate agent for clean context; returns structured issues for feedback loop |
| gsd-planner | planner | 1,158 | YES | Most context-intensive agent; reads history + research + codebase + synthesizes |
| gsd-project-researcher | project-researcher | 619 | YES | 4 parallel domain researchers; each needs dedicated context |
| gsd-research-synthesizer | research-synthesizer | 237 | YES | Separate agent; output feeds user verification gate |
| gsd-roadmapper | roadmapper | 606 | YES | Phase derivation from requirements; output feeds user verification gate |
| gsd-verifier | phase-verifier | 524 | YES | Systematic codebase scanning; bounded but thorough |

**Why nothing was cut:** The existing phase docs (now stale) proposed cutting to 4 agents based on the assumption that the framework was being fundamentally simplified. Item 1 established that the architecture stays intact -- we're adding interaction gates, not removing machinery. Every agent serves a distinct purpose in the context management strategy:

- **Parallel spawns** (codebase-mapper x4, project-researcher x4) -- speed through parallelism
- **Heavy synthesis** (planner, roadmapper) -- need full context windows for complex reasoning
- **Verification** (plan-checker, phase-verifier, integration-checker) -- separate context keeps verification independent from creation
- **Research** (phase-researcher, research-synthesizer) -- isolates search noise from downstream agents
- **Execution** (phase-executor) -- fresh context per plan is the core quality strategy
- **Debugging** (debugger) -- persistent session files + unbounded investigation

---

## The gsd-tools.js Decision

**Decision:** Rename to `blueprint-tools.js` and keep as-is. Likely needs additions.

**What it provides that's genuinely hard to replicate:**
- Compound init commands (12 commands, each replacing 5-15 file reads with 1 pre-computed JSON blob)
- Bulletproof frontmatter CRUD (150+ lines of YAML parsing with edge case handling)
- Atomic multi-file updates (e.g., phase complete updates ROADMAP + STATE + transitions in one operation)
- Structured verification suite (6 verification modes with detailed error reporting)
- Dependency analysis (wave grouping, plan-to-summary matching)
- Model routing (11 agents x 3 profiles = 33 model mappings, centralized)
- State machine transitions (phase progression with validation)

**What agents can do directly (no tool needed):**
- Simple file reads (PROJECT.md, STATE.md, individual plans)
- Basic existence checks
- String operations (slugs, timestamps)

**Potential additions for Blueprint:**
- New init commands for the added interaction stages (e.g., `init research-review`, `init requirements-review`)
- Commands to support staleness detection (compare git state against last mapping timestamp)
- Commands to support the new verification/feedback gates

**Important:** Modifying `blueprint-tools.js` will be its own dedicated phase in the implementation plan due to the file's complexity (~4,600 lines, ~60 subcommands). Changes need to be carefully scoped and tested.

### MODEL_PROFILES (Current)

```
Agent                    | quality | balanced | budget
-------------------------|---------|----------|-------
planner                  | opus    | opus     | sonnet
roadmapper               | opus    | sonnet   | sonnet
phase-executor           | opus    | sonnet   | sonnet
phase-researcher         | opus    | sonnet   | haiku
project-researcher       | opus    | sonnet   | haiku
research-synthesizer     | sonnet  | sonnet   | haiku
debugger                 | opus    | sonnet   | sonnet
codebase-mapper          | sonnet  | haiku    | haiku
phase-verifier           | sonnet  | sonnet   | haiku
plan-checker             | sonnet  | sonnet   | haiku
integration-checker      | sonnet  | sonnet   | haiku
```

Key insight: Planner is the only agent that stays Opus in balanced mode. This concentrates the intelligence budget where it matters most.

---

## New Work Identified: Agent Review Pass

Before implementation, there needs to be a dedicated phase where each agent is reviewed to ensure:

1. **Information flow is correct for new feedback loops.** The plan-checker, for example, currently returns structured issues to the orchestrator. With the new manual verification step, does the orchestrator need the plan-checker to return its findings in a different format that's suitable for presenting to the user?

2. **Agents that feed verification gates produce user-readable output.** The research-synthesizer's SUMMARY.md feeds the new post-research user review. The roadmapper's ROADMAP.md feeds the new post-roadmap user review. Are these outputs structured well enough for a human to review meaningfully, or do they need a summarization layer?

3. **Agents receive upstream user decisions.** When the user provides corrections during a verification gate (e.g., "this research finding is wrong, the actual situation is X"), how does that correction flow back into the relevant agent's artifacts?

4. **Return context is sufficient.** Each subagent returns structured results to the parent. The parent uses these to drive the next step (which now includes user interaction). Do the structured returns contain enough context for the parent to present meaningful summaries to the user?

This review pass is not just renaming -- it's auditing the information flow through the agent graph against the new interaction model from Item 1.

---

## Implications for Implementation Planning

### What's Mechanical (Can Be Batched)
- Rename all 11 agent files (`gsd-*` -> Blueprint names)
- Rename all internal references within agent prompts (`.planning/` -> `.blueprint/`, `gsd-tools.js` -> `blueprint-tools.js`, command name references)
- Rename `gsd-tools.js` -> `blueprint-tools.js` and update the MODEL_PROFILES keys

### What Requires Design Work
- Agent review pass (information flow audit for new feedback loops)
- New interaction gates in workflows that spawn agents (pre-research interview, post-creation verification)
- Potential additions to `blueprint-tools.js` for new workflow stages

### What's Its Own Phase
- Any modifications to `blueprint-tools.js` beyond renaming (due to complexity and the need for careful testing)

---

## Open Questions (For Other Research Areas)

- How does staleness detection integrate with `blueprint-tools.js`? (Area 3)
- Do agent frontmatter formats differ between Cursor and Claude Code? (Area 4)
- Does the command set need to change given all 11 agents survive? (Area 5)
- Do any templates need to change given the agent roster is unchanged? (Area 6)
