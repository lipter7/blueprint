# Phase 3: Interaction Model Enhancements — Detailed Implementation Plan

**Parent:** `00-phase-overview.md`
**Status:** Complete

---

## Overview

Add the user interaction gates that are the core reason Blueprint exists — pre-research interviews and post-write verification across the workflows that write artifacts from user input. This is the primary differentiator from GSD: Blueprint puts the human in the loop at every high-leverage moment.

The North Star says: "The difference between 'here's the plan, approve it?' and 'let's build this plan together' is the difference between a rubber stamp and actual alignment."

**What changes:**

| Workflow | Current Behavior | Blueprint Behavior |
|----------|-----------------|-------------------|
| `discuss-phase` | Writes CONTEXT.md, no read-back | Writes → reads back → summarizes → user confirms/corrects → applies corrections |
| `new-project` | Writes PROJECT.md, moves on | Writes → reads back → summarizes → user confirms/corrects → applies corrections |
| `new-project` | Writes REQUIREMENTS.md, simple approve | Writes → reads back → detailed summary → user confirms/corrects → applies corrections |
| `new-project` | Roadmapper writes ROADMAP.md, approve/reject | Writes → reads back → phase-by-phase summary → user confirms/corrects → applies corrections |
| `research-phase` | 4 researchers run unsupervised | Pre-research interview → researchers get richer input → post-research summary for user validation |
| `plan-phase` | Research runs before planning, results passed through | Pre-research interview (if standalone research) → post-research findings summary |

**What does NOT change:**
- Artifact templates (same formats, same sections)
- Agent behavior (same prompts, same outputs)
- The write pipeline itself (agents still write files)
- Test suite (no `blueprint-tools.js` changes)
- Installer (no `install.js` changes)
- Config schema (no `config.json` template changes in this phase — that's Phase 4)

---

## Design Decisions

These decisions were derived from the North Star document and research findings. They drive every implementation detail below.

### Decision 1: Verification Gates Are Post-Write Read-Backs, Not Pre-Write Previews

The orchestrator lets the agent write the artifact, then reads it back, summarizes, and asks the user. This is simpler than intercepting agent output, and it means the artifact always exists on disk (survives context resets). If the user requests corrections, the orchestrator applies them directly to the file.

**Why not pre-write preview?** Agents write complex multi-section artifacts. Previewing in the orchestrator would mean duplicating the formatting logic. Reading back the actual file is the source of truth.

### Decision 2: Summarization Formats Are Artifact-Specific

Each artifact type gets a tailored summary. A CONTEXT.md summary shows "decisions per area." A ROADMAP.md summary shows "phase structure with requirements mapping." A RESEARCH.md summary shows "key findings per topic with confidence levels." Generic summaries ("here's what was written") don't surface the decisions that matter.

### Decision 3: Corrections Are Applied Inline, Not Re-Generated

When a user says "change X to Y in the requirements," the orchestrator edits the file directly. It does NOT re-spawn the agent to regenerate the whole artifact. This is faster, more predictable, and preserves the parts the user already approved.

**Exception:** If corrections are so extensive that they'd require restructuring (e.g., "scrap this roadmap, I want a completely different phase structure"), re-spawn the agent with revision context.

### Decision 4: Pre-Research Interview Is Structured, Not Open-Ended

The interview before research uses `AskUserQuestion` with concrete questions, not freeform conversation. This ensures consistent, parseable input that feeds directly into the researcher's prompt as structured context. Four questions covering: focus areas, known problems, conventions to check, general guidance.

### Decision 5: Gates Are Additive Workflow Steps, Controlled by Config

Each gate checks `config.json` settings before activating. In `yolo` mode or `auto` mode, gates default to auto-approve (orchestrator reads back but doesn't pause). In `interactive` mode, gates pause for user input. This preserves the existing mode system.

### Decision 6: The Same Pattern Everywhere

Every verification gate follows the identical pattern:

```
Agent writes artifact
    ↓
Orchestrator reads file from disk
    ↓
Orchestrator generates artifact-specific summary
    ↓
Orchestrator presents summary to user
    ↓
AskUserQuestion: "Approve" / "Corrections" / "Review full file"
    ↓
If "Corrections": capture → apply edits → re-summarize → re-ask
If "Review full file": display raw file → re-ask
If "Approve": proceed
```

This pattern is documented once in a new reference file and invoked by name in each workflow.

---

## Scope Inventory

### Files Modified (Existing)

| File | Nature of Change | Estimated Size |
|------|-----------------|----------------|
| `blueprint/workflows/new-project.md` | Add verification gates after Steps 4, 7, 8; add pre-research interview at Step 6 | Major (~80 lines added) |
| `blueprint/workflows/new-milestone.md` | Add verification gates after research and roadmap; add pre-research interview | Major (~60 lines added) |
| `blueprint/workflows/discuss-phase.md` | Add post-write verification gate after CONTEXT.md creation | Medium (~30 lines added) |
| `blueprint/workflows/research-phase.md` | Add pre-research interview; add post-research findings summary | Medium (~40 lines added) |
| `blueprint/workflows/plan-phase.md` | Add pre-research interview (when research runs); add post-research summary | Medium (~35 lines added) |

### Files Created (New)

| File | Purpose | Estimated Size |
|------|---------|----------------|
| `blueprint/references/verification-gates.md` | Reference doc defining the gate pattern, all summary formats, correction handling | ~300 lines |

### Files NOT Modified

These are explicitly unchanged in Phase 3:

- `blueprint/bin/blueprint-tools.js` — No new commands or utilities
- `blueprint/bin/blueprint-tools.test.js` — No testable logic changes (workflow changes are in markdown prompts)
- `bin/install.js` — No installer changes
- `agents/*.md` — Agent prompts unchanged (they still write the same artifacts the same way)
- `blueprint/templates/*.md` — Templates unchanged (artifact formats stay the same)
- `commands/bp/*.md` — Command entry points unchanged (they delegate to workflows)
- `.blueprint/config.json` template — Config schema unchanged (existing `mode` and `gates` suffice)
- `hooks/*` — No hook changes
- `package.json` — No dependency or script changes

---

## Execution Order

Phase 3 has no tricky ordering constraints like Phase 1's substring collisions. The changes are additive (inserting new steps into existing workflows) and non-overlapping (each file is modified independently). However, the reference file should be created first since workflows will reference it.

---

## Step 1: Create Verification Gates Reference

Create a new reference document that defines the universal gate pattern and all artifact-specific summary formats. This is referenced by workflows instead of duplicating the pattern in each one.

**File:** `blueprint/references/verification-gates.md`

**Purpose:** Single source of truth for:
1. The universal gate pattern (read-back → summarize → confirm → correct)
2. Summary format for each artifact type
3. Correction handling protocol
4. Auto-mode behavior (skip gates)
5. Pre-research interview question design

**Content structure:**

```markdown
# Verification Gates Reference

## Purpose

Verification gates ensure the user co-creates artifacts rather than rubber-stamping them.
Every workflow that writes an artifact from user input pauses after writing to:
1. Read back what was written
2. Summarize the key decisions/content
3. Present the summary to the user
4. Incorporate corrections before proceeding

## Universal Gate Pattern

<gate_pattern>

### Step 1: Agent Writes Artifact
The agent writes the artifact to disk as normal. No changes to agent behavior.

### Step 2: Orchestrator Reads Back
```bash
cat {artifact_path}
```
Parse the content to extract key decisions, sections, or structure.

### Step 3: Generate Summary
Use the artifact-specific summary format (see below). The summary is NOT the full file —
it's a structured extraction of the decisions that matter.

### Step 4: Present to User

Display the summary with a clear header:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► REVIEW: {artifact_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{artifact-specific summary}
```

### Step 5: Ask for Confirmation

AskUserQuestion:
- header: "Review"
- question: "Does this accurately capture what you described?"
- options:
  - "Approve" — Looks good, proceed
  - "Corrections" — I want to change some things
  - "Review full file" — Show me the raw file first

### Step 6: Handle Response

**If "Approve":** Proceed to next workflow step. Commit artifact if not already committed.

**If "Corrections":**
- Ask: "What would you like to change?"
- Wait for freeform response
- Apply corrections to the file using Edit tool (targeted edits, not full rewrite)
- Re-read the file and re-generate summary
- Re-present summary and re-ask (loop back to Step 4)

**If "Review full file":**
- Display raw file content: `cat {artifact_path}`
- Then re-ask (loop back to Step 5, without re-displaying summary)

### Auto Mode Behavior

When `mode: "yolo"` or running in auto mode:
- Still read back the artifact (Step 2)
- Display a brief confirmation instead of full summary:
  ```
  ✓ {artifact_name} created at {path} ({line_count} lines)
  ```
- Skip AskUserQuestion — auto-proceed
- Do NOT skip the read-back (it validates the file was written correctly)

</gate_pattern>

## Artifact-Specific Summary Formats

### CONTEXT.md Summary

<context_summary>
Extract and display:

**Phase boundary:** {one-line scope from Phase Boundary section}

**Decisions made:**
For each area discussed:
- **{Area name}:** {1-2 sentence summary of key decisions}

**Claude's discretion:** {comma-separated list of areas}

**Deferred ideas:** {count} ideas captured for future phases

**Specific references:** {any "I want it like X" moments, or "None"}
</context_summary>

### PROJECT.md Summary

<project_summary>
Extract and display:

**What this is:** {2-3 sentence description from What This Is section}

**Core value:** {one sentence from Core Value section}

**Active requirements:** {count} requirements in {count} categories
- {Category 1}: {count} requirements
- {Category 2}: {count} requirements

**Out of scope:** {count} exclusions

**Constraints:** {count} hard limits
- {list each constraint type: value pair}

**Key decisions:** {count} decisions logged
</project_summary>

### REQUIREMENTS.md Summary

<requirements_summary>
Extract and display:

**v1 scope:** {total count} requirements across {category count} categories

For each category:
- **{Category} ({count}):** {comma-separated REQ-IDs with brief labels}

**v2 deferred:** {count} requirements

**Out of scope:** {count} exclusions
For each:
- {Feature}: {reason}

**Coverage check:** All v1 requirements mapped? {yes/no}
</requirements_summary>

### ROADMAP.md Summary

<roadmap_summary>
Extract and display:

**Phases:** {count} phases | **Depth:** {depth setting}

For each phase:
| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| {n} | {name} | {goal} | {REQ-IDs} | {count} criteria |

**Requirement coverage:** {mapped}/{total} v1 requirements mapped

**Phase dependencies:**
{Phase N} → {Phase M} → ... (dependency chain)

**Success criteria preview** (Phase 1 only, to show quality):
1. {criterion 1}
2. {criterion 2}
3. {criterion 3}
</roadmap_summary>

### RESEARCH.md Summary (Phase-Level)

<research_summary_phase>
Extract and display:

**Domain:** {primary domain from research}
**Confidence:** {overall HIGH/MEDIUM/LOW}

**Standard stack:**
| Library | Version | Purpose |
(top 3-5 most important)

**Key architecture patterns:** {2-3 bullet points}

**Don't hand-roll:** {comma-separated list of problems with existing solutions}

**Top pitfalls:**
1. {Pitfall name}: {one-line description}
2. {Pitfall name}: {one-line description}
3. {Pitfall name}: {one-line description}

**Open questions:** {count} unresolved ({list if ≤3})

**Sources:** {count} PRIMARY, {count} SECONDARY, {count} TERTIARY
</research_summary_phase>

### Research Summary (Project-Level — from SUMMARY.md)

<research_summary_project>
Extract and display:

**Domain:** {type of product}
**Overall confidence:** {HIGH/MEDIUM/LOW}

**Stack:** {one-liner from Key Findings}
**Table stakes:** {count} features identified
**Top differentiators:** {2-3 most impactful}
**Critical pitfall:** {most important one}

**Roadmap implications:**
{Suggested phase count} phases suggested
1. {Phase suggestion}: {rationale}
2. {Phase suggestion}: {rationale}

**Research flags:**
- Needs deeper research: {phases}
- Standard patterns: {phases}

**Gaps:** {count} areas needing attention
</research_summary_project>

## Pre-Research Interview

<pre_research_interview>

### Purpose
Surface user knowledge that researchers can't discover — domain expertise, known problems,
conventions, and constraints that shape research direction.

### When to Run
- Before spawning `bp-project-researcher` agents (in `new-project` and `new-milestone`)
- Before spawning `bp-phase-researcher` agent (in `research-phase` and `plan-phase`)

### Interview Questions (Project-Level Research)

AskUserQuestion (4 questions in 1-2 rounds):

**Round 1 (2 questions):**

1. header: "Focus"
   question: "What aspects of {domain} should research focus on?"
   multiSelect: true
   options:
   - "Technology stack" — Best frameworks, libraries, databases for this domain
   - "Architecture patterns" — How to structure the system, component design
   - "Feature landscape" — What users expect, table stakes vs differentiators
   - "Common pitfalls" — What goes wrong, what to avoid

2. header: "Known problems"
   question: "Are there known technical challenges or constraints?"
   options:
   - "Yes, let me describe" — I know specific issues to investigate
   - "Not sure" — Research should discover these
   - "Domain is new to me" — Full ecosystem discovery needed

**Round 2 (if user selected "Yes, let me describe" for Q2):**

3. Freeform: "Describe the known challenges or constraints:"
   Wait for response. Capture as `<known_problems>` context for researchers.

**Round 2 (always):**

4. header: "Conventions"
   question: "Any technology preferences or conventions to follow?"
   options:
   - "Yes, let me specify" — I have stack/pattern preferences
   - "Research should recommend" — No strong preferences
   - "Must match existing codebase" — Research should check compatibility

### Interview Questions (Phase-Level Research)

AskUserQuestion (3 questions in 1 round):

1. header: "Research focus"
   question: "What should research for Phase {N} ({name}) focus on?"
   multiSelect: true
   options:
   - "Implementation patterns" — How to build {phase domain}
   - "Library/API selection" — Best tools for {phase domain}
   - "Integration approach" — How {phase domain} connects to existing code
   - "Known gotchas" — Specific problems I've seen in {phase domain}

2. header: "Constraints"
   question: "Any constraints for this phase's technical approach?"
   options:
   - "Yes, let me describe" — I have specific constraints
   - "Use project conventions" — Follow what's established
   - "Research should recommend" — No additional constraints

3. header: "Depth"
   question: "How deep should research go?"
   options:
   - "Thorough" — Comprehensive investigation (slower, more tokens)
   - "Focused" — Key decisions only (faster, fewer tokens)
   - "Verify only" — I know the approach, just validate it

### Passing Interview Results to Researchers

Interview responses are formatted as structured context and appended to the researcher's prompt:

```markdown
<user_research_guidance>
## User Research Guidance

**Focus areas:** {selected areas}
**Known problems:** {user's description or "None specified"}
**Conventions:** {user's preferences or "Research should recommend"}
**Depth:** {thorough/focused/verify-only}
</user_research_guidance>
```

For phase-level research, also include:
```markdown
**Phase constraints:** {user's description or "Use project conventions"}
```

### Auto Mode Behavior

When `mode: "yolo"` or running in auto mode:
- Skip pre-research interview entirely
- Researchers receive default context: all focus areas, no known problems, "Research should recommend"
- This matches current GSD behavior (research runs unsupervised)

</pre_research_interview>

## Correction Handling Protocol

<correction_protocol>

### Targeted Corrections (Default)
When user provides specific corrections:
1. Parse corrections into discrete edits
2. For each edit: use Edit tool to modify the file in place
3. Re-read the modified file
4. Re-generate and re-display summary
5. Re-ask for confirmation

### Extensive Corrections (Rare)
If corrections amount to "start over" or restructure the artifact:
1. Acknowledge: "That's a significant change. Let me regenerate."
2. Re-spawn the agent with revision context:
   - Original prompt
   - Current artifact content
   - User's correction notes
3. Agent writes new version
4. Enter verification gate again with new content

### Correction Scope Rules
- Corrections within a verification gate only affect THAT artifact
- Corrections to one artifact don't cascade to others automatically
  (e.g., changing a requirement in REQUIREMENTS.md doesn't auto-update ROADMAP.md)
- If corrections create inconsistency, the orchestrator flags it:
  "Note: This change affects {other_artifact}. You'll review that next."

</correction_protocol>
```

**This file is purely reference documentation** — it's read by the orchestrator (Claude) as context, not executed as code. It ensures consistent behavior across all workflows.

---

## Step 2: Add Verification Gate to `discuss-phase` Workflow

**File:** `blueprint/workflows/discuss-phase.md`

**Current behavior:** After deep-dive discussion completes, the orchestrator writes CONTEXT.md and presents a brief confirmation with next steps.

**New behavior:** After writing CONTEXT.md, the orchestrator reads it back, summarizes decisions per area, and asks the user to confirm or correct before committing.

### 2a. Insert Gate After CONTEXT.md Write

**Location:** After the step that writes CONTEXT.md (currently the last substantive step before the commit).

**Insert between write and commit:**

```markdown
### Post-Write Verification: CONTEXT.md

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — CONTEXT.md Summary format.

**Skip in auto mode** (auto-approve and commit directly).

1. Read back the CONTEXT.md file:
   ```bash
   cat {phase_dir}/{phase}-CONTEXT.md
   ```

2. Generate summary using the CONTEXT.md summary format:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Blueprint ► REVIEW: Phase {N} Context
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **Phase boundary:** {scope from Phase Boundary section}

   **Decisions made:**
   - **{Area 1}:** {key decisions}
   - **{Area 2}:** {key decisions}
   - **{Area 3}:** {key decisions}

   **Claude's discretion:** {areas where user said "you decide"}

   **Deferred ideas:** {count} ideas captured for future phases

   **Specific references:** {any "I want it like X" moments}
   ```

3. AskUserQuestion:
   - header: "Context"
   - question: "Does this capture your decisions for Phase {N}?"
   - options:
     - "Approve" — Decisions captured correctly, proceed
     - "Corrections" — I want to change or add decisions
     - "Review full file" — Show me the raw CONTEXT.md

4. Handle response per verification-gates.md protocol:
   - "Approve" → Proceed to commit
   - "Corrections" → Ask what to change, apply edits, re-summarize, re-ask
   - "Review full file" → Display raw file, re-ask

5. Commit after approval:
   ```bash
   node ~/.claude/blueprint/bin/blueprint-tools.js commit \
     "docs({phase}): capture implementation decisions" \
     --files {phase_dir}/{phase}-CONTEXT.md
   ```
```

**Files affected:** `blueprint/workflows/discuss-phase.md` only.

**Estimated additions:** ~30 lines inserted into existing workflow.

---

## Step 3: Add Pre-Research Interview to `new-project` Workflow

**File:** `blueprint/workflows/new-project.md`

**Current behavior:** Step 6 asks "Research first?" and if yes, immediately spawns 4 researchers.

**New behavior:** If research selected, run a brief interview to surface user's domain knowledge, then pass the interview results as structured context to all 4 researchers.

### 3a. Insert Interview Between Research Decision and Researcher Spawning

**Location:** After user selects "Research first" in Step 6, before `mkdir -p .blueprint/research`.

**Insert:**

```markdown
### Pre-Research Interview

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — Pre-Research Interview (Project-Level).

**Skip in auto mode** (researchers receive default context).

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► PRE-RESEARCH INTERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before research begins, a few questions to focus the investigation:
```

**Round 1 — AskUserQuestion (2 questions):**

1. header: "Focus"
   question: "What aspects of {domain} should research focus on?"
   multiSelect: true
   options:
   - "Technology stack" — Best frameworks, libraries, databases for this domain
   - "Architecture patterns" — How to structure the system, component design
   - "Feature landscape" — What users expect, table stakes vs differentiators
   - "Common pitfalls" — What goes wrong, what to avoid

2. header: "Known problems"
   question: "Are there known technical challenges or constraints?"
   options:
   - "Yes, let me describe" — I know specific issues to investigate
   - "Not sure" — Research should discover these
   - "Domain is new to me" — Full ecosystem discovery needed

**If user selected "Yes, let me describe":**
- Ask: "Describe the known challenges or constraints:"
- Wait for freeform response
- Store as `known_problems_text`

**Round 2 — AskUserQuestion (1 question):**

3. header: "Conventions"
   question: "Any technology preferences or conventions to follow?"
   options:
   - "Yes, let me specify" — I have stack/pattern preferences
   - "Research should recommend" — No strong preferences
   - "Must match existing codebase" — Research should check compatibility

**If user selected "Yes, let me specify":**
- Ask: "What technology preferences or conventions?"
- Wait for freeform response
- Store as `conventions_text`

**Format interview results:**

```markdown
<user_research_guidance>
## User Research Guidance

**Focus areas:** {selected focus areas}
**Known problems:** {known_problems_text or "None specified — discover during research"}
**Conventions:** {conventions_text or "Research should recommend"}
**Domain familiarity:** {new to me / not sure / experienced (inferred from answers)}
</user_research_guidance>
```

Store this block as `research_guidance` for passing to researchers.
```

### 3b. Modify Researcher Spawn Prompts to Include Interview Results

**Location:** The 4 parallel researcher spawn prompts in Step 6.

**Current:** Each researcher prompt includes `<project_context>` and `<question>`.

**New:** Append `{research_guidance}` block to each researcher's prompt, after `<project_context>`:

```markdown
{research_guidance}
```

This is a simple string concatenation — the `<user_research_guidance>` XML tags are already self-contained and parseable by the researcher agent. No agent prompt changes needed; the researchers will naturally incorporate the user's guidance because it appears in their context.

**If research_guidance is empty (auto mode):** Omit the block entirely. Researchers operate as before.

---

## Step 4: Add Post-Research Verification Gate to `new-project` Workflow

**File:** `blueprint/workflows/new-project.md`

**Current behavior:** After synthesizer writes SUMMARY.md, the orchestrator displays key findings in a banner and proceeds to requirements.

**New behavior:** After synthesizer completes, read SUMMARY.md, present a structured summary of research findings, and let the user confirm or request deeper investigation before proceeding.

### 4a. Insert Gate After Research Completion

**Location:** After synthesizer returns and "RESEARCH COMPLETE" banner displays, before Step 7 (Define Requirements).

**Insert:**

```markdown
### Post-Research Verification: Research Findings

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — Research Summary (Project-Level) format.

**Skip in auto mode** (auto-approve and proceed to requirements).

1. Read SUMMARY.md:
   ```bash
   cat .blueprint/research/SUMMARY.md
   ```

2. Generate summary using the project-level research summary format:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Blueprint ► REVIEW: Research Findings
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **Domain:** {type of product}
   **Overall confidence:** {HIGH/MEDIUM/LOW}

   **Recommended stack:**
   | Library | Version | Purpose |
   (top 5 from STACK.md)

   **Table stakes features:** {count} identified
   **Top differentiators:** {2-3 most impactful from FEATURES.md}

   **Critical pitfall:** {most important from PITFALLS.md}

   **Roadmap implications:**
   1. {Phase suggestion}: {rationale}
   2. {Phase suggestion}: {rationale}

   **Gaps:** {areas needing attention}
   ```

3. AskUserQuestion:
   - header: "Research"
   - question: "Do these findings match your understanding of this domain?"
   - options:
     - "Approve" — Findings look right, proceed to requirements
     - "Dig deeper" — I want to investigate specific areas more
     - "Corrections" — Some findings are wrong or missing context
     - "Review full files" — Show me the raw research files

4. Handle response:

   **"Approve":** Proceed to Step 7 (Define Requirements).

   **"Dig deeper":**
   - AskUserQuestion:
     - header: "Investigate"
     - question: "Which area needs deeper investigation?"
     - options:
       - "Stack choices" — Question specific technology recommendations
       - "Architecture" — Need more detail on system structure
       - "Pitfalls" — Want to explore specific risks
       - "Feature gaps" — Missing features or wrong categorization
   - Capture user's specific concerns as freeform input
   - Spawn a single `bp-project-researcher` agent with:
     - The specific dimension to investigate
     - User's concerns as additional context
     - Instructions to UPDATE the existing research file (not overwrite)
   - After agent returns, re-read SUMMARY.md (or re-synthesize if dimension file changed significantly)
   - Re-enter this gate

   **"Corrections":**
   - Ask: "What needs correcting?"
   - Apply targeted edits to relevant research file(s)
   - Re-read and re-summarize
   - Re-ask

   **"Review full files":**
   - AskUserQuestion:
     - header: "Which file?"
     - question: "Which research file do you want to review?"
     - options:
       - "SUMMARY.md" — Synthesized overview
       - "STACK.md" — Technology recommendations
       - "FEATURES.md" — Feature landscape
       - "ARCHITECTURE.md" — System structure
       - "PITFALLS.md" — Common mistakes
   - Display selected file
   - Re-ask confirmation
```

---

## Step 5: Add Post-Write Verification Gates to `new-project` Workflow (PROJECT.md, REQUIREMENTS.md, ROADMAP.md)

**File:** `blueprint/workflows/new-project.md`

These are three separate gates inserted at three points in the existing workflow. Each follows the universal gate pattern.

### 5a. PROJECT.md Verification Gate

**Location:** After Step 4 writes PROJECT.md, before Step 5 (Workflow Preferences).

**Current behavior:** Orchestrator writes PROJECT.md and commits immediately.

**New behavior:** Write → read back → summarize → confirm/correct → commit.

```markdown
### Post-Write Verification: PROJECT.md

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — PROJECT.md Summary format.

**Skip in auto mode** (auto-approve and commit directly).

1. Read back PROJECT.md:
   ```bash
   cat .blueprint/PROJECT.md
   ```

2. Display summary:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Blueprint ► REVIEW: PROJECT.md
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **What this is:** {description}

   **Core value:** {one sentence}

   **Active requirements:** {count}
   - {Category}: {count}

   **Out of scope:** {count} exclusions

   **Constraints:**
   - {Type}: {value}

   **Key decisions:** {count} logged
   ```

3. AskUserQuestion:
   - header: "Project"
   - question: "Does PROJECT.md capture your vision accurately?"
   - options:
     - "Approve" — Looks good
     - "Corrections" — I want to adjust some things
     - "Review full file" — Show me the raw file

4. Handle per protocol. Commit after approval.
```

### 5b. REQUIREMENTS.md Verification Gate

**Location:** After Step 7 writes REQUIREMENTS.md, before Step 8 (Create Roadmap).

**Current behavior:** In interactive mode, there's already a simple "Does this capture it?" confirmation. This enhances it with a structured summary.

**New behavior:** Replace the existing simple confirmation with the full verification gate.

```markdown
### Post-Write Verification: REQUIREMENTS.md

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — REQUIREMENTS.md Summary format.

**Skip in auto mode** (auto-approve and commit directly).

1. Read back REQUIREMENTS.md:
   ```bash
   cat .blueprint/REQUIREMENTS.md
   ```

2. Display summary:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Blueprint ► REVIEW: Requirements
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **v1 scope:** {total} requirements across {N} categories

   **{Category 1} ({count}):**
   - {REQ-01}: {brief label}
   - {REQ-02}: {brief label}

   **{Category 2} ({count}):**
   - {REQ-01}: {brief label}
   - {REQ-02}: {brief label}

   **v2 deferred:** {count} requirements

   **Out of scope:**
   - {Feature}: {reason}
   ```

3. AskUserQuestion:
   - header: "Requirements"
   - question: "Do these requirements define what you're building?"
   - options:
     - "Approve" — Requirements are correct
     - "Corrections" — I want to add, remove, or change requirements
     - "Review full file" — Show me the raw file

4. Handle per protocol. Commit after approval.
```

**Note:** This replaces the existing interaction point #9 (the simple "Does this capture what you're building?" confirmation) with the structured verification gate. The old interaction point #15 in Step 7 is subsumed by this gate.

### 5c. ROADMAP.md Verification Gate

**Location:** After Step 8's roadmapper agent returns, replacing the existing simple approve/adjust interaction.

**Current behavior:** The orchestrator already presents the roadmap and asks "Does this roadmap structure work?" with Approve/Adjust/Review options.

**Enhancement:** Replace the current presentation with the structured summary format, and enhance the "Adjust" flow with more specific guidance.

```markdown
### Post-Write Verification: ROADMAP.md

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — ROADMAP.md Summary format.

**Skip in auto mode** (auto-approve and commit directly).

1. Read back ROADMAP.md:
   ```bash
   cat .blueprint/ROADMAP.md
   ```

2. Display summary:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Blueprint ► REVIEW: Roadmap
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **{N} phases** | **Depth:** {setting} | **Coverage:** {mapped}/{total} ✓

   | # | Phase | Goal | Requirements | Criteria |
   |---|-------|------|--------------|----------|
   | 1 | {name} | {goal} | {REQ-IDs} | {count} |
   | 2 | {name} | {goal} | {REQ-IDs} | {count} |
   | ... |

   **Dependencies:** {Phase 1} → {Phase 2} → ...

   **Phase 1 success criteria (preview):**
   1. {criterion}
   2. {criterion}
   3. {criterion}
   ```

3. AskUserQuestion:
   - header: "Roadmap"
   - question: "Does this phase structure work for your project?"
   - options:
     - "Approve" — Phase structure is good
     - "Adjust phases" — I want to change the structure
     - "Review criteria" — Show me all success criteria
     - "Review full file" — Show me the raw ROADMAP.md

4. Handle response:

   **"Approve":** Commit and proceed.

   **"Adjust phases":**
   - AskUserQuestion:
     - header: "Adjust"
     - question: "What kind of change?"
     - options:
       - "Reorder phases" — Change the sequence
       - "Split/merge phases" — Phase too big or too small
       - "Change scope" — Move requirements between phases
       - "Change criteria" — Success criteria don't match my expectations
   - Capture specific changes as freeform input
   - Re-spawn roadmapper with revision context (current ROADMAP.md + user's changes)
   - Re-enter this gate with revised roadmap

   **"Review criteria":**
   - Display all success criteria for all phases (extracted from ROADMAP.md Phase Details)
   - Re-ask confirmation

   **"Review full file":**
   - Display raw ROADMAP.md
   - Re-ask confirmation
```

**Note:** This replaces the existing interaction point #10 (the current "Does this roadmap structure work?") with a richer version. The current Approve/Adjust/Review flow is preserved but enhanced with structured summaries and more specific adjustment options.

---

## Step 6: Add Pre-Research Interview and Post-Research Summary to `research-phase` Workflow

**File:** `blueprint/workflows/research-phase.md`

**Current behavior:** Validates phase, checks existing research, spawns `bp-phase-researcher` immediately.

**New behavior:** Before spawning researcher, run a brief interview. After researcher returns, present structured findings summary for validation.

### 6a. Pre-Research Interview

**Location:** After existing research check (update/view/skip) and before spawning `bp-phase-researcher`.

```markdown
### Pre-Research Interview

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — Pre-Research Interview (Phase-Level).

**Skip in auto mode** (researcher receives default context).
**Skip if `--skip-research` flag** (research isn't running).

AskUserQuestion (3 questions in 1 round):

1. header: "Research focus"
   question: "What should research for Phase {N} ({name}) focus on?"
   multiSelect: true
   options:
   - "Implementation patterns" — How to build {phase domain}
   - "Library/API selection" — Best tools for {phase domain}
   - "Integration approach" — How {phase domain} connects to existing code
   - "Known gotchas" — Specific problems I've seen in {phase domain}

2. header: "Constraints"
   question: "Any constraints for this phase's technical approach?"
   options:
   - "Yes, let me describe" — I have specific constraints
   - "Use project conventions" — Follow what's established
   - "Research should recommend" — No additional constraints

3. header: "Depth"
   question: "How deep should research go?"
   options:
   - "Thorough" — Comprehensive investigation
   - "Focused" — Key decisions only
   - "Verify only" — I know the approach, just validate it

**If "Yes, let me describe" for constraints:**
- Ask: "Describe the constraints:"
- Wait for freeform response

**Format and pass to researcher as `<user_research_guidance>` block** (see reference doc).
```

### 6b. Post-Research Findings Summary

**Location:** After researcher returns `## RESEARCH COMPLETE`, before presenting next steps.

```markdown
### Post-Research Verification: RESEARCH.md

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — RESEARCH.md Summary (Phase-Level) format.

**Skip in auto mode** (auto-approve).

1. Read back RESEARCH.md:
   ```bash
   cat {phase_dir}/{phase}-RESEARCH.md
   ```

2. Display summary:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Blueprint ► REVIEW: Phase {N} Research
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **Domain:** {primary domain}
   **Confidence:** {HIGH/MEDIUM/LOW}

   **Standard stack:**
   | Library | Version | Purpose |

   **Key patterns:** {2-3 bullet points}

   **Don't hand-roll:** {list}

   **Top pitfalls:**
   1. {name}: {description}
   2. {name}: {description}

   **Open questions:** {count}
   ```

3. AskUserQuestion:
   - header: "Research"
   - question: "Do these findings look right for Phase {N}?"
   - options:
     - "Approve" — Findings are good, proceed
     - "Dig deeper" — Investigate specific areas more
     - "Corrections" — Some findings are wrong
     - "Review full file" — Show me the raw RESEARCH.md

4. Handle response:

   **"Approve":** Proceed to next steps (planning or done).

   **"Dig deeper":**
   - Ask: "What should we investigate further?"
   - Wait for freeform response
   - Re-spawn `bp-phase-researcher` with:
     - Existing RESEARCH.md content
     - User's specific investigation request
     - Instructions to UPDATE (not overwrite)
   - Re-enter this gate with updated research

   **"Corrections":**
   - Ask: "What needs correcting?"
   - Apply targeted edits to RESEARCH.md
   - Re-summarize and re-ask

   **"Review full file":**
   - Display raw RESEARCH.md
   - Re-ask
```

---

## Step 7: Add Pre-Research Interview to `plan-phase` Workflow

**File:** `blueprint/workflows/plan-phase.md`

**Current behavior:** Step 5 checks research flags and spawns `bp-phase-researcher` if needed, with no user input on research direction.

**New behavior:** When research will run (Step 5), insert the same phase-level pre-research interview from Step 6a. Also add a brief post-research summary before passing findings to the planner.

### 7a. Pre-Research Interview in plan-phase

**Location:** In Step 5, after determining research will run, before spawning `bp-phase-researcher`.

```markdown
### Pre-Research Interview (plan-phase)

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — Pre-Research Interview (Phase-Level).

**Skip if:**
- Auto mode
- `--skip-research` flag
- `--gaps` flag (gap closure mode)
- Research not running (existing research used as-is)

**Same questions as research-phase Step 6a.** Format and pass to researcher as `<user_research_guidance>` block.
```

### 7b. Post-Research Summary in plan-phase

**Location:** After researcher returns `## RESEARCH COMPLETE`, before passing research to planner (Step 7).

```markdown
### Post-Research Summary (plan-phase)

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — RESEARCH.md Summary (Phase-Level) format.

**Skip in auto mode** (auto-approve, pass research to planner immediately).

1. Read RESEARCH.md and display abbreviated summary:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Blueprint ► RESEARCH FINDINGS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **Confidence:** {level}
   **Stack:** {key libraries}
   **Key pattern:** {primary architecture recommendation}
   **Top pitfall:** {most critical}
   **Open questions:** {count}
   ```

2. AskUserQuestion:
   - header: "Findings"
   - question: "Research complete. Proceed to planning with these findings?"
   - options:
     - "Proceed to planning" — Findings are good (Recommended)
     - "Review findings" — Let me review before planning
     - "Adjust research" — Re-run with different focus

3. Handle response:

   **"Proceed to planning":** Continue to Step 7 (spawn planner).

   **"Review findings":** Display full RESEARCH.md, then re-ask.

   **"Adjust research":**
   - Ask: "What should change?"
   - Re-spawn researcher with updated guidance
   - Re-enter this gate
```

**Note:** The plan-phase post-research summary is deliberately shorter than the standalone research-phase version. In plan-phase, research is a means to an end (planning), not the final output. The user needs to approve findings quickly, not do a deep review.

---

## Step 8: Add Pre-Research Interview and Post-Research Gate to `new-milestone` Workflow

**File:** `blueprint/workflows/new-milestone.md`

**Current behavior:** Step 8 asks "Research for new features?" and spawns researchers if yes. Same pattern as new-project but with "subsequent milestone" context.

**New behavior:** Same enhancements as new-project (Steps 3-4 above) — pre-research interview and post-research verification gate. The interview questions are identical since the underlying pattern is the same (project-level research).

### 8a. Pre-Research Interview

**Location:** After research decision in Step 8, before researcher spawning.

**Same as Step 3 above** (new-project pre-research interview). The only difference is that the `<user_research_guidance>` block may include:

```markdown
**Existing system context:** Subsequent milestone — focus research on NEW features only.
Existing validated capabilities: {list from PROJECT.md Validated section}
```

### 8b. Post-Research Verification Gate

**Location:** After synthesizer completes, before requirements definition.

**Same as Step 4 above** (new-project post-research gate). No differences — the summary format and interaction flow are identical.

---

## Step 9: Verification

### 9a. Workflow Read-Through Audit

For each modified workflow file, read the complete file and verify:

1. **Gate placement is correct:** Gates appear between "write" and "commit" steps
2. **Auto mode bypass works:** Every gate has a "Skip in auto mode" instruction
3. **Reference file is cited:** Each gate references `verification-gates.md`
4. **Summary format matches:** Summary display matches the format in the reference file
5. **AskUserQuestion parameters are valid:** All headers ≤12 chars, 2-4 options per question
6. **Correction flow loops correctly:** "Corrections" path loops back to re-display summary
7. **No downstream artifacts are orphaned:** If a correction changes content, any dependent artifacts are flagged

### 9b. Interaction Flow Audit

Walk through each workflow end-to-end and count the interaction points:

**`new-project` (interactive mode) — Expected interaction points:**

| Step | Existing | New | Total |
|------|----------|-----|-------|
| Brownfield offer | 1 | 0 | 1 |
| Deep questioning | 2 (freeform + "ready?") | 0 | 2 |
| PROJECT.md verification | 0 | 1 | **1 (new)** |
| Workflow preferences | ~8 (4+4 questions) | 0 | ~8 |
| Research decision | 1 | 0 | 1 |
| Pre-research interview | 0 | 2-3 | **2-3 (new)** |
| Post-research verification | 0 | 1 | **1 (new)** |
| Requirements scoping | ~3 (per-category + additions) | 0 | ~3 |
| REQUIREMENTS.md verification | 1 (existing, enhanced) | 0 | 1 (enhanced) |
| ROADMAP.md verification | 1 (existing, enhanced) | 0 | 1 (enhanced) |

**Total new gates in new-project:** 4-5 new interaction points (PROJECT.md gate, pre-research interview x2-3, post-research gate).

**`discuss-phase` (interactive mode):**

| Step | Existing | New | Total |
|------|----------|-----|-------|
| Existing context check | 1 | 0 | 1 |
| Area selection | 1 | 0 | 1 |
| Deep-dive per area | ~5 per area | 0 | ~5/area |
| CONTEXT.md verification | 0 | 1 | **1 (new)** |

**Total new gates in discuss-phase:** 1 new interaction point.

**`research-phase` (interactive mode):**

| Step | Existing | New | Total |
|------|----------|-----|-------|
| Existing research check | 1 | 0 | 1 |
| Pre-research interview | 0 | 3 | **3 (new)** |
| Post-research verification | 0 | 1 | **1 (new)** |

**Total new gates in research-phase:** 4 new interaction points.

**`plan-phase` (interactive mode, with research):**

| Step | Existing | New | Total |
|------|----------|-----|-------|
| Existing plans check | 1 | 0 | 1 |
| Pre-research interview | 0 | 3 | **3 (new)** |
| Post-research summary | 0 | 1 | **1 (new)** |
| Plan revision loop | 1 (at max iterations) | 0 | 1 |

**Total new gates in plan-phase:** 4 new interaction points.

### 9c. Auto Mode Regression Check

Verify that in `yolo`/auto mode, no new gates create user pauses:
- Every gate has explicit "Skip in auto mode" instruction
- Auto mode still displays brief confirmation (file created, line count)
- Auto mode workflow timing is unchanged (no waits)

### 9d. Consistency Check

Verify that all summary formats in the reference file match the actual artifact templates:
- CONTEXT.md summary mentions all sections from `templates/context.md`
- PROJECT.md summary mentions all sections from `templates/project.md`
- REQUIREMENTS.md summary mentions all sections from `templates/requirements.md`
- ROADMAP.md summary mentions all sections from `templates/roadmap.md`
- RESEARCH.md summary mentions all sections from `templates/research.md`

---

## Manual Fixes (Require Human Judgment)

Unlike Phase 1's mechanical find-replace, Phase 3's changes are entirely editorial — inserting new workflow steps that must read naturally within the existing flow. Each file needs careful attention to:

1. **Step numbering:** Existing steps may need renumbering if new steps are inserted between them
2. **Variable naming:** New variables (like `research_guidance`) must not collide with existing ones
3. **Flow control:** New gates must correctly handle both the happy path and correction loops
4. **Banner consistency:** New banners must match existing banner styling (`━━━` borders, `Blueprint ►` prefix)
5. **Existing interactions:** Where new gates replace or enhance existing ones (e.g., REQUIREMENTS.md confirmation), the old interaction must be cleanly removed to avoid double-asking

### Files with Highest Concentration of Changes

| File | ~Lines Added | Complexity | Key Concern |
|------|-------------|------------|-------------|
| `blueprint/workflows/new-project.md` | ~80 | High | 4 gates + interview, must integrate with existing 9-step flow |
| `blueprint/references/verification-gates.md` | ~300 | Medium | New file, reference only, no integration risk |
| `blueprint/workflows/research-phase.md` | ~40 | Medium | Pre-research + post-research around existing spawn logic |
| `blueprint/workflows/plan-phase.md` | ~35 | Medium | Pre-research + summary around existing Step 5 |
| `blueprint/workflows/discuss-phase.md` | ~30 | Low | Single gate at end of existing flow |
| `blueprint/workflows/new-milestone.md` | ~60 | Medium | Same pattern as new-project, different variable context |

---

## Sub-Agent Decomposition

### What the Orchestrator Does Directly

**Step 1 (verification-gates.md) is orchestrator work.** Creating a new reference file is straightforward — write the complete file with all summary formats and the universal gate pattern.

### What Sub-Agents Do (Steps 2-8 — Parallelizable)

After the reference file is created, all workflow modifications are independent. No two agents edit the same file.

---

#### Sub-Agent A: `discuss-phase.md` Gate

**File:** `blueprint/workflows/discuss-phase.md`
**Handles:** Step 2
**Estimated additions:** ~30 lines

**Prompt for spawning:**

```
You are adding a post-write verification gate to blueprint/workflows/discuss-phase.md.

Read the file first to understand the current flow. Then read
~/.claude/blueprint/references/verification-gates.md for the gate pattern
and CONTEXT.md summary format.

Your task: Insert a verification gate between the step that writes CONTEXT.md
and the step that commits it. The gate should:

1. Read back the CONTEXT.md file
2. Generate a summary using the CONTEXT.md summary format from verification-gates.md
3. Present the summary with a "Blueprint ► REVIEW: Phase {N} Context" banner
4. AskUserQuestion with options: Approve / Corrections / Review full file
5. Handle corrections (edit file, re-summarize, re-ask)
6. Only commit after approval
7. Skip the gate entirely in auto mode

Match the existing workflow's style — banner formatting, variable naming,
step numbering. If inserting this gate requires renumbering existing steps,
do so cleanly.

Do NOT edit any other file.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

#### Sub-Agent B: `new-project.md` Full Enhancement

**File:** `blueprint/workflows/new-project.md`
**Handles:** Steps 3, 4, 5a, 5b, 5c
**Estimated additions:** ~80 lines

**Prompt for spawning:**

```
You are adding pre-research interviews and post-write verification gates to
blueprint/workflows/new-project.md. This is the most complex modification.

Read the file first to understand the full flow. Then read
~/.claude/blueprint/references/verification-gates.md for all patterns,
summary formats, and the pre-research interview design.

Your tasks (in order within the file):

1. **PROJECT.md verification gate** (after Step 4, before Step 5):
   - Read back PROJECT.md, summarize using PROJECT.md format, ask confirm/correct
   - Move the commit to after approval

2. **Pre-research interview** (in Step 6, after "Research first" selected):
   - Insert the project-level interview (2 rounds, 3-4 questions)
   - Format responses into <user_research_guidance> block
   - Pass the block to all 4 researcher spawn prompts

3. **Post-research verification gate** (after synthesizer completes, before Step 7):
   - Read SUMMARY.md, summarize using project-level research format
   - Options: Approve / Dig deeper / Corrections / Review full files
   - "Dig deeper" spawns targeted researcher agent
   - Handle "which file?" for review option

4. **REQUIREMENTS.md verification gate** (after Step 7 writes requirements):
   - Replace the existing simple confirmation with full verification gate
   - Read back REQUIREMENTS.md, summarize using requirements format
   - Ask confirm/correct, commit after approval

5. **ROADMAP.md verification gate** (enhance existing Step 8 interaction):
   - Replace current approve/adjust with structured summary format
   - Add "Review criteria" option to show all success criteria
   - Enhance "Adjust phases" with specific adjustment types

Match the existing workflow style. Preserve all existing functionality —
these are ADDITIVE changes. Every gate must have "Skip in auto mode" bypass.
Step numbering should flow naturally.

Do NOT edit any other file.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

#### Sub-Agent C: `research-phase.md` Enhancement

**File:** `blueprint/workflows/research-phase.md`
**Handles:** Step 6 (6a + 6b)
**Estimated additions:** ~40 lines

**Prompt for spawning:**

```
You are adding a pre-research interview and post-research verification gate
to blueprint/workflows/research-phase.md.

Read the file first to understand the current flow. Then read
~/.claude/blueprint/references/verification-gates.md for the phase-level
interview questions and RESEARCH.md summary format.

Your tasks:

1. **Pre-research interview** (after existing research check, before spawning
   bp-phase-researcher):
   - 3 questions: research focus (multiSelect), constraints, depth
   - Format responses into <user_research_guidance> block
   - Append block to researcher's spawn prompt
   - Skip in auto mode

2. **Post-research verification gate** (after researcher returns
   "## RESEARCH COMPLETE", before presenting next steps):
   - Read RESEARCH.md, summarize using phase-level research format
   - Options: Approve / Dig deeper / Corrections / Review full file
   - "Dig deeper" re-spawns researcher with specific investigation request
   - Skip in auto mode

Match the existing workflow style. Preserve all existing return handling
(RESEARCH COMPLETE, CHECKPOINT REACHED, RESEARCH INCONCLUSIVE).

Do NOT edit any other file.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

#### Sub-Agent D: `plan-phase.md` Enhancement

**File:** `blueprint/workflows/plan-phase.md`
**Handles:** Step 7 (7a + 7b)
**Estimated additions:** ~35 lines

**Prompt for spawning:**

```
You are adding a pre-research interview and post-research summary to
blueprint/workflows/plan-phase.md.

Read the file first to understand the current flow. Then read
~/.claude/blueprint/references/verification-gates.md for the phase-level
interview and research summary formats.

Your tasks:

1. **Pre-research interview** (in Step 5, when research will run):
   - Same 3 questions as research-phase.md
   - Skip if: auto mode, --skip-research, --gaps, research not running
   - Format and pass to researcher

2. **Post-research summary** (after researcher returns, before passing to planner):
   - Abbreviated summary (confidence, stack, key pattern, top pitfall, open questions)
   - Options: Proceed to planning (Recommended) / Review findings / Adjust research
   - "Proceed" continues to planner spawn
   - "Review findings" shows full RESEARCH.md
   - "Adjust research" re-spawns researcher
   - Skip in auto mode

The post-research summary should be SHORTER than the standalone research-phase
version. In plan-phase, research is a stepping stone to planning — the user
needs quick validation, not deep review.

Do NOT edit any other file.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

#### Sub-Agent E: `new-milestone.md` Enhancement

**File:** `blueprint/workflows/new-milestone.md`
**Handles:** Step 8 (8a + 8b)
**Estimated additions:** ~60 lines

**Prompt for spawning:**

```
You are adding a pre-research interview and post-research verification gate
to blueprint/workflows/new-milestone.md.

Read the file first to understand the current flow. Then read
~/.claude/blueprint/references/verification-gates.md for the project-level
interview and research summary formats.

Also read blueprint/workflows/new-project.md to see how the same gates were
implemented there (for consistency).

Your tasks:

1. **Pre-research interview** (after research decision, before researcher spawning):
   - Same project-level interview as new-project (2 rounds, 3-4 questions)
   - Additional context: "Subsequent milestone — focus on NEW features"
   - Include existing validated capabilities as context
   - Skip in auto mode

2. **Post-research verification gate** (after synthesizer, before requirements):
   - Same as new-project post-research gate
   - Same summary format, same options (Approve / Dig deeper / Corrections / Review)
   - Skip in auto mode

Match the style used in new-project.md. The gate logic should be nearly
identical, with the only differences being milestone-specific context.

Do NOT edit any other file.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

### Orchestrator Flow: Putting It All Together

```
ORCHESTRATOR: Step 1 — Create verification-gates.md
  │  Write the reference file with all patterns and summary formats.
  │
  ▼
ORCHESTRATOR: Spawn 5 sub-agents in parallel ◄── SINGLE MESSAGE with 5 Task calls
  │
  │  ┌──────────────────────────────────────────────────────────────┐
  │  │  Sub-Agent A: discuss-phase.md gate                          │
  │  │  Sub-Agent B: new-project.md full enhancement                │
  │  │  Sub-Agent C: research-phase.md enhancement                  │
  │  │  Sub-Agent D: plan-phase.md enhancement                      │
  │  │  Sub-Agent E: new-milestone.md enhancement                   │
  │  └──────────────────────────────────────────────────────────────┘
  │       All 5 run simultaneously. No file conflicts (each owns its files).
  │
  ▼  (wait for all 5 to complete)
ORCHESTRATOR: Step 9 — Verification
  │  9a: Read each modified file end-to-end (workflow read-through audit)
  │  9b: Count interaction points per workflow
  │  9c: Verify auto mode bypass in each gate
  │  9d: Cross-check summary formats against templates
  │
  ▼
DONE — Phase 3 complete. Ready to commit.
```

### Failure Recovery

**If a sub-agent's gate doesn't integrate cleanly with the existing workflow:**
The orchestrator reads the file, identifies the integration issue (usually step numbering or variable scoping), and fixes it directly.

**If summary formats reference sections that don't exist in the template:**
Fix the reference file's summary format to match the actual template structure.

**If the interaction count seems too high for a workflow:**
Review whether any gates can be combined. For example, if new-project has too many pauses in interactive mode, consider combining the PROJECT.md gate with the "Ready to create PROJECT.md?" question that already exists.

**If auto mode bypass doesn't work cleanly:**
Add explicit `mode` check at the top of each gate section. The pattern should be:
```markdown
**If mode is "yolo" or running in auto mode:** Skip to [next step], displaying only:
```
✓ {artifact} created ({line_count} lines)
```
```

---

## Replacement Summary Table

Unlike Phase 1, there are no bulk text replacements. All changes are editorial insertions into existing workflow files.

| Step | File | Action | ~Lines |
|------|------|--------|--------|
| 1 | `blueprint/references/verification-gates.md` | Create new file | ~300 |
| 2 | `blueprint/workflows/discuss-phase.md` | Insert post-write gate | ~30 |
| 3 | `blueprint/workflows/new-project.md` | Insert pre-research interview | ~25 |
| 4 | `blueprint/workflows/new-project.md` | Insert post-research gate | ~30 |
| 5a | `blueprint/workflows/new-project.md` | Insert PROJECT.md gate | ~20 |
| 5b | `blueprint/workflows/new-project.md` | Enhance REQUIREMENTS.md gate | ~15 |
| 5c | `blueprint/workflows/new-project.md` | Enhance ROADMAP.md gate | ~15 |
| 6a | `blueprint/workflows/research-phase.md` | Insert pre-research interview | ~20 |
| 6b | `blueprint/workflows/research-phase.md` | Insert post-research gate | ~25 |
| 7a | `blueprint/workflows/plan-phase.md` | Insert pre-research interview | ~15 |
| 7b | `blueprint/workflows/plan-phase.md` | Insert post-research summary | ~20 |
| 8a | `blueprint/workflows/new-milestone.md` | Insert pre-research interview | ~25 |
| 8b | `blueprint/workflows/new-milestone.md` | Insert post-research gate | ~30 |

**Total: ~570 lines of new content across 6 files (1 new, 5 modified)**

---

## Risk Mitigation

**Risk: New gates make interactive mode too slow (too many pauses).**
Mitigation: Every gate is controlled by mode. In `yolo` mode, zero new pauses. In interactive mode, the gates are at high-leverage moments where user input prevents compounding errors. The North Star explicitly prioritizes correctness over speed at these moments. If users find it excessive, they can switch to `yolo` mode.

**Risk: Correction loops create infinite cycles.**
Mitigation: While the protocol doesn't impose a max correction count (corrections should converge naturally), if a user provides contradictory corrections, the orchestrator should recognize this and suggest starting over rather than looping. The "Review full file" option lets users see exactly what's there, grounding the conversation.

**Risk: Summary formats drift from actual artifact structure.**
Mitigation: Step 9d explicitly cross-checks summary formats against templates. The reference file documents which template sections map to which summary fields. If templates change in future phases, the reference file must be updated.

**Risk: Pre-research interview adds questions that don't materially improve research quality.**
Mitigation: The questions are deliberately minimal (3-4 questions, mostly multiple-choice). They surface information researchers CAN'T discover on their own (user domain expertise, known constraints, technology preferences). The "skip" paths (auto mode, "Research should recommend") let users opt out quickly.

**Risk: Post-research "Dig deeper" creates expensive re-research loops.**
Mitigation: "Dig deeper" spawns a SINGLE targeted researcher (not all 4), and the user must specify what to investigate. This keeps cost bounded. The orchestrator doesn't re-synthesize unless the dimension file changed significantly.

**Risk: Sub-agents produce inconsistent gate styles across workflows.**
Mitigation: The reference file (`verification-gates.md`) is the single source of truth. All sub-agents read it. The orchestrator verifies consistency in Step 9.

**Risk: Existing interaction points get double-asked (old and new gate).**
Mitigation: Steps 5b and 5c explicitly REPLACE existing interactions, not add alongside them. Sub-Agent B's prompt specifies "Replace the existing simple confirmation with full verification gate."

---

## Dependency Graph

```
Step 1: Create verification-gates.md
  │
  ▼
Steps 2-8: Workflow modifications ◄── ALL PARALLELIZABLE (no file conflicts)
  │
  │  ┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
  │  │  Step 2      │  Steps 3-5   │  Step 6      │  Step 7      │  Step 8      │
  │  │  discuss     │  new-project │  research    │  plan-phase  │  new-        │
  │  │  -phase.md   │  .md         │  -phase.md   │  .md         │  milestone   │
  │  └─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
  │                        │ all must complete
  ▼                        ▼
Step 9: Verification ◄── GATE: blocks on ALL workflow modifications
```

### Blocking Summary

| Step | Blocks | Blocked By | Can Parallelize? |
|------|--------|------------|-----------------|
| 1 | 2-8 | nothing | No (must exist before workflows reference it) |
| 2 | 9 | 1 | **Yes** — independent of 3-8 |
| 3-5 | 9 | 1 | **Yes** — independent of 2, 6-8 |
| 6 | 9 | 1 | **Yes** — independent of 2-5, 7-8 |
| 7 | 9 | 1 | **Yes** — independent of 2-6, 8 |
| 8 | 9 | 1 | **Yes** — independent of 2-7 |
| 9 | nothing | all of 2-8 | Sub-checks are independent but fast |

---

## Work Breakdown Summary

| Who | Steps | Nature | Complexity |
|-----|-------|--------|-----------|
| Orchestrator | 1 | Create reference file (verification-gates.md) | Medium (300 lines, carefully structured) |
| Sub-Agent A | 2 | Insert gate into discuss-phase.md | Low (single gate, end of workflow) |
| Sub-Agent B | 3, 4, 5a-5c | Full enhancement of new-project.md | High (4 gates + interview, complex flow) |
| Sub-Agent C | 6a, 6b | Enhance research-phase.md | Medium (interview + gate around spawn) |
| Sub-Agent D | 7a, 7b | Enhance plan-phase.md | Medium (interview + summary in existing flow) |
| Sub-Agent E | 8a, 8b | Enhance new-milestone.md | Medium (mirrors new-project pattern) |
| Orchestrator | 9 | Read-through audit, interaction count, auto mode check | Low (verification only) |

---

## Cross-Phase Dependencies

Phase 3 is designed to be self-contained, but it intersects with other phases:

| Phase | Intersection | Impact |
|-------|-------------|--------|
| Phase 4 (Codebase Freshness) | Phase 4 adds a `codebase_mapping` block to config.json. Phase 3 does NOT modify config.json, so no conflict. | None |
| Phase 4 (STATE.md Compaction) | Phase 4 modifies the `complete-milestone` workflow. Phase 3 does NOT touch this workflow. | None |
| Phase 5 (Cursor Support) | Phase 5 adds `convertClaudeToCursorSkill()` for commands. Phase 3 doesn't add new commands, only modifies workflows within existing commands. | None |
| Phase 6 (Polish) | Phase 6 removes `docs/blueprint/refactor/`. This implementation plan is in that directory but will have served its purpose by then. | None |

---

## Design Work Captured

The following design decisions were made during this plan and are documented in the reference file:

1. **Summarization formats** — Artifact-specific summaries for CONTEXT.md, PROJECT.md, REQUIREMENTS.md, ROADMAP.md, RESEARCH.md (phase and project level)
2. **Correction protocol** — Targeted inline edits by default, agent re-generation for extensive changes
3. **Pre-research interview design** — 3-4 questions per level (project/phase), structured `<user_research_guidance>` XML block
4. **Auto mode behavior** — All gates skip in yolo/auto mode, brief confirmation only
5. **"Dig deeper" flow** — Single targeted researcher re-spawn, not full re-research

These are all specified in `blueprint/references/verification-gates.md` and implemented in the workflow modifications.
