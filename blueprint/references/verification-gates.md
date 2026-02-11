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

2. header: "Known"
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

1. header: "Focus"
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
