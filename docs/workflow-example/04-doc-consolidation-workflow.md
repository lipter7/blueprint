# Documentation Consolidation Workflow

A multi-phase, sub-agent-driven workflow for consolidating stale or sprawling documentation directories into a single verified summary. Designed to be invoked against any directory containing subdirectories of markdown/text documentation.

---

## Overview

This workflow takes a directory of old documentation (organized into subdirectories) and reduces it to a single, verified `summary.md` through 5 sequential phases:

1. **Discovery** — Resolve the target directory, enumerate subdirectories
2. **Per-directory consolidation** — 1 sub-agent per subdirectory, each producing a summary file
3. **Codebase verification** — 1 sub-agent per summary file, cross-referencing claims against actual code
4. **Unification** — 1 sub-agent reads all verified summaries, produces a single unified document
5. **Verification + final edit** — 1 sub-agent audits the unified doc, reports findings, lead agent makes final cuts and deletes all intermediate files

**Input:** A directory path containing subdirectories of documentation
**Output:** A single `summary.md` in the root of that directory, everything else deleted

---

## Phase 1: Discovery

The lead agent (you) resolves the attached directory and inspects its structure.

**Actions:**
- List all subdirectories in the target directory
- List all files within each subdirectory
- Count total files and subdirectories to plan sub-agent allocation

**Key principle:** 1 sub-agent per subdirectory. The number of sub-agents is determined dynamically by the directory structure.

---

## Phase 2: Per-Directory Consolidation

Spawn 1 sub-agent per subdirectory, all in parallel. Each agent is responsible for exactly one subdirectory.

### Sub-agent instructions:

Each sub-agent must:

1. Read ALL files in its assigned subdirectory
2. Extract and categorize content into 3 buckets:
   - **Unfinished/deferred work** — items not yet implemented in code
   - **Completed work** — items that exist fully in code
   - **Miscellaneous context** — vital information for future developers (only keep if critical)
3. Delete ALL original files in the subdirectory
4. Create a single summary file named `{directory-number}-summary.md`

### Summary document rules:
- Only unique items, no repetition
- As concise as possible without catastrophic data loss
- 3 sections matching the 3 buckets above
- For general codebase mapping/documentation (not todos or implementation plans), assume information is stale but still summarize

### Naming convention:
The summary file uses the leading number from the subdirectory name. Examples:
- `13-dashboard-v3--website/` → `13-summary.md`
- `21-todos/` → `21-summary.md`

### Result:
Each subdirectory now contains exactly 1 file: its summary.

---

## Phase 3: Codebase Verification

Spawn 1 sub-agent per summary file, all in parallel. Each agent's job is to verify claims against actual code.

### Sub-agent instructions:

The lead agent must read each summary file BEFORE spawning verification agents, so it can provide targeted verification instructions. For each summary, the lead agent should identify:

- Specific files/functions to check for "completed" claims
- Specific patterns/types to search for to verify "unfinished" claims
- Specific references to validate in "miscellaneous" context

Each verification sub-agent must:

1. Read its assigned summary file
2. For every completed item: trace it in the codebase, confirm it exists and works as described
3. For every unfinished item: check if it has since been completed or is no longer relevant
4. For every miscellaneous item: verify accuracy against current code
5. Apply these rules:
   - If a completed item is still accurate → keep it
   - If a completed item no longer matches code → remove it
   - If an unfinished item has since been completed → move to completed
   - If an unfinished item is no longer relevant → remove entirely
   - If miscellaneous context is stale/wrong → remove it
   - If ALL content is stale → delete the file entirely
6. Rewrite the summary file with only verified/accurate content, same 3-section structure

### Key principle:
Give each verification agent as much specific context as possible — file paths to check, function names to search, type definitions to look up. Generic "verify everything" instructions produce worse results than targeted "check `src/types/pages.ts` for `BlockPosition` with `column`/`row` fields" instructions.

### Result:
Each summary file now contains only verified, accurate information.

---

## Phase 4: Unification

Spawn 1 sub-agent to read all verified summary files and create a single unified document.

### Sub-agent instructions:

1. Read ALL summary files
2. Create `summary.md` in the root of the target directory
3. Same 3-section structure (unfinished, completed, miscellaneous)
4. De-duplicate aggressively — many items will overlap across source docs
5. Group by topic/theme, NOT by source document
6. Rules:
   - Conciseness above all — cut "nice to know" items
   - No line numbers (go stale)
   - No historical dates or phase labels
   - Completed items can be very brief
   - Unfinished items need enough context to act on (what + where)
   - Miscellaneous = only information a developer absolutely MUST know

### Result:
A single `summary.md` exists alongside the subdirectories.

---

## Phase 5: Verification + Final Edit

This is a two-step phase.

### Step 1: Spawn verification agent (read-only)

This agent reads the unified `summary.md` AND all source summary files, then reports (no edits):

1. **Bloat check** — items that are too verbose, redundant, obvious from code, or "nice to know"
2. **Accuracy check** — items that contradict source docs or lost critical nuance
3. **Missing items** — important things that got accidentally dropped
4. **Overall assessment** — recommended cuts with specific section/line references

### Step 2: Lead agent makes final edits

Based on the verification report, the lead agent:

1. Reads the unified `summary.md`
2. Makes all recommended cuts (lean toward removal)
3. Rewrites the file with final content
4. Deletes all subdirectories and their contents

### Result:
The target directory contains exactly 1 file: `summary.md`

---

## Prompt Templates

### Prompt 1 — Per-directory consolidation

```
You are a documentation expert and a senior TypeScript engineer who has been assigned the task
of sifting through old documentation and consolidating it.

Using sub agents (set model to sonnet) you will delegate 1 agent to every sub directory inside
`{TARGET_DIRECTORY}`. You must carefully assign 1 sub directory per agent, each agent will be
responsible for performing the following workflow:

Each sub-agent, working in its designated folder, must perform the following:

1. Carefully review the documentation and extract:
- Items that were completed
- Items that were not completed or deferred
- Any other unique information deemed as critical context for future reference

2. After sub-agent finishes reading all documentation and understands the contents it must
delete all docs from its designated folder and create one markdown file with a summary of
the completed items, the unfinished items, and a miscellaneous context section for any
unique information deemed important enough to keep.

Document structure for sub-agents:
Markdown must contain a summary of only unique items, no repetition. There should be 3 sections:
1. unfinished/deferred work that was not implemented in code
2. completed/finished work that exists fully complete in code
3. Any miscellaneous context that is deemed highly important (only keep if information is
   vital for a future developer)
- sub agents should keep their documents as concise as possible without introducing terrible
  data loss.

Important note: for general codebase mapping/documentation (not todos or implementation plans)
assume information is stale, but still summarize and document.

Sub agents should name their docs using the number in their assigned directory
(eg 13,14,15) and then -summary.md.
```

### Prompt 2 — Codebase verification

```
Now spawn 1 sub agent per summary file and task it with deep codebase review on all the items
documented as completed or uncompleted, and any miscellaneous information in the summary file
as well. The sub agents task will be to carefully trace back the items in the actual code and
ensure completed and uncompleted items are accurately marked, and that general information is
still (at least somewhat) accurate. These docs were very old, so in the case that a complete,
uncompleted, or miscellaneous item is completely stale and no longer relevant, the sub agent
should remove it from the document entirely. (this includes if all items are stale which is
unlikely but not impossible, in which case the document should be deleted).

Use sonnet again for these sub agents and make sure to give them good instructions.
```

**Critical note for the lead agent:** Between prompts 1 and 2, the lead agent MUST read every
summary file so it can craft targeted verification instructions per agent. Generic instructions
produce significantly worse verification results.

### Prompt 3 — Unification + verification + cleanup

```
Now spawn a sub agent to read every summary file in {TARGET_DIRECTORY} subdirectories and
create a single document in the root called summary.md. This document should have 3 sections
the same way the sub-directory scoped summaries do, and should be as concise as possible
(only keep 110% critical information).

Once that agent has finished, spawn a second agent to verify the first one's work. This
second sub-agent must read the summary document and cross reference it with all the
sub-directory summaries. This agent should return its findings to you (no direct edits)
so that you can make the final decision on what stays and what gets removed (lean toward
removal) and keeping the final summary as concise as possible.

Once this process is complete delete everything except the single unified summary.md.
```

---

## Sub-Agent Configuration

| Phase | Agents | Model | Mode | Parallel |
|-------|--------|-------|------|----------|
| 2 - Consolidation | 1 per subdirectory | sonnet | bypassPermissions | Yes |
| 3 - Verification | 1 per summary | sonnet | bypassPermissions | Yes |
| 4 - Unification | 1 | sonnet | bypassPermissions | No |
| 5 - Audit | 1 (read-only) | sonnet | bypassPermissions | No |

---

## Adaptation Notes

This workflow is directory-agnostic. To apply it to any documentation directory:

1. Replace `{TARGET_DIRECTORY}` with the actual path
2. The lead agent dynamically discovers subdirectories and file counts
3. Naming convention adapts to whatever numbering/naming the subdirectories use
4. If subdirectories don't have leading numbers, use the full directory name for summary files (e.g., `api-docs-summary.md`)
5. Phase 3 (codebase verification) assumes a codebase exists to verify against. If consolidating standalone docs with no codebase, skip Phase 3 entirely.
6. The 3-section structure (unfinished/completed/miscellaneous) assumes the docs track work items. For pure reference docs, adapt sections to fit (e.g., "Current State", "Deprecated", "Reference").
