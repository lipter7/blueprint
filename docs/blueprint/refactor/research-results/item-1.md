# Research Result: Interaction Model Design

**Research area:** Area 1 from `02-research-planner.md`
**Status:** Complete

---

## Core Finding

The interaction gaps in GSD are concentrated upstream -- in research, requirements, and roadmap creation. The downstream stages (discuss-phase, plan-phase, execute-phase, verify-phase) already work well. The fix is not a redesign of every command but the addition of two gate types to the early stages:

1. **Pre-research interview** -- structured user input before agents run
2. **Post-creation verification** -- summarization and user review after automated creation

If the upstream documents (research findings, requirements, roadmap) accurately capture user intent, the downstream stages produce good results with their current designs.

---

## Interaction Model Per Stage

### Research

```
PRE-RESEARCH INTERVIEW (new)
  - What should we focus on?
  - Known problems in the codebase?
  - Conventions you want checked?
  - General guidance for the research agents
        |
        v
CONCURRENT RESEARCH (unchanged)
  - Run all research topics in parallel
  - Same agent architecture as GSD
        |
        v
POST-RESEARCH WALKTHROUGH (new)
  - Present findings topic-by-topic
  - User validates, corrects, or flags for re-research
  - Corrections feed back into the artifacts
```

**What changes:** Two new interaction points wrap the existing automated research. The research agents themselves, their parallelism, and their output format stay the same.

**Why:** GSD's research takes zero user input before running and presents only the final synthesis for approval. The user has no way to steer what gets researched, flag known issues, or inject domain knowledge. By the time they see results, everything is already baked in.

### Requirements

```
AUTOMATED CREATION (unchanged)
  - Same process as current GSD
        |
        v
SUMMARIZATION + VERIFICATION (new)
  - Agent summarizes what it created at a high level
  - User verifies alignment, proposes changes
  - Changes applied before moving on
```

**What changes:** A verification gate after creation. The creation process itself is fine.

**Why:** GSD generates requirements and moves on. The user never interacts with the requirements document. Adding a high-level summary and review ensures the requirements actually represent what the user wants before they flow into the roadmap.

### Roadmap

```
AUTOMATED CREATION (unchanged)
  - Same process as current GSD
        |
        v
SUMMARIZATION + VERIFICATION (new)
  - Agent summarizes the phase structure at a high level
  - User verifies ordering, scope, and criteria
  - User can propose changes (reorder, split, merge, rescope)
  - Changes applied before moving on
```

**What changes:** A verification gate after creation. The roadmapper agent and its process stay the same.

**Why:** Same rationale as requirements. The roadmap is produced autonomously and presented as approve/reject. A guided review lets the user shape it incrementally rather than accepting or rejecting the whole thing.

### Discuss Phase

**No structural changes.** The current `discuss-phase` command is the most interactive stage in GSD and works well. The problem was never this stage -- it was that the documents feeding into it (research, requirements, roadmap) didn't reflect user intent, so discussions started from a misaligned base.

### Plan Phase

**No structural changes.** The `plan-phase` command works well provided the upstream documents (CONTEXT.md from discuss, ROADMAP.md, REQUIREMENTS.md, codebase docs) are aligned with user intent. Fixing the upstream stages fixes planning quality.

### Execute Phase

**No changes.** Execution is where autonomy is appropriate -- the subagent runs the plan in a fresh context.

### Verify Phase

**No changes.** Goal-backward verification works as designed.

---

## Implications for the Refactor

### Narrowed Scope

This interaction model means the refactor is significantly smaller than the existing phase docs assumed:

- **Not** redesigning every command for more interaction
- **Not** cutting from 11 agents to 4 (the agent roster needs separate validation but the cuts won't be as aggressive)
- **Not** removing the research pipeline (it stays, with gates added around it)

### What Actually Needs to Change

1. **Research command/workflow** -- Add pre-research interview step and post-research walkthrough step. The research agents, their prompts, and their artifacts stay the same.

2. **New-project command/workflow** (or init-project equivalent) -- Add verification gates after requirements creation and after roadmap creation. The creation logic stays the same.

3. **All commands/agents/templates/references** -- Rename from GSD to Blueprint (mechanical, not architectural).

4. **Codebase staleness detection** -- New capability (separate research area).

5. **Installer** -- Multi-runtime support for Cursor + Claude Code (separate research area).

### What Stays the Same (Architecturally)

- XML-structured prompts
- Fresh-context subagent pattern
- Document-driven state in `.blueprint/`
- Goal-backward verification
- Deviation rules for executors
- Atomic commits per task
- Downstream consumer documentation in agent prompts
- Anti-pattern documentation
- Checkpoint protocol
- The discuss-phase interaction model
- The plan-phase process
- The execute/verify cycle
- Wave-based parallel execution

---

## Open Questions (For Other Research Areas)

- Which of GSD's 11 agents survive the rename? (Area 2: Agent Architecture)
- What happens to `gsd-tools.js`? (Area 2: Agent Architecture)
- How does staleness detection work? (Area 3: Codebase Staleness)
- What are Cursor's actual format constraints? (Area 4: Runtime Compatibility)
- Does the command count change from what the existing phase docs proposed? (Area 5: Command Set)
- Does the artifact set change? (Area 6: Template/Artifact Design)
