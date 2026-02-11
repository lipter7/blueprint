<purpose>
Research how to implement a phase. Spawns bp-phase-researcher with phase context.

Standalone research command. For most workflows, use `/bp:plan-phase` which integrates research automatically.
</purpose>

<process>

## Step 0: Resolve Model Profile

@~/.claude/blueprint/references/model-profile-resolution.md

Resolve model for:
- `bp-phase-researcher`

## Step 1: Normalize and Validate Phase

@~/.claude/blueprint/references/phase-argument-parsing.md

```bash
PHASE_INFO=$(node ~/.claude/blueprint/bin/blueprint-tools.js roadmap get-phase "${PHASE}")
```

If `found` is false: Error and exit.

## Step 2: Check Existing Research

```bash
ls .blueprint/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
```

If exists: Offer update/view/skip options.

## Step 3: Gather Phase Context

```bash
# Phase section from roadmap (already loaded in PHASE_INFO)
echo "$PHASE_INFO" | jq -r '.section'
cat .blueprint/REQUIREMENTS.md 2>/dev/null
cat .blueprint/phases/${PHASE}-*/*-CONTEXT.md 2>/dev/null
# Decisions from state-snapshot (structured JSON)
node ~/.claude/blueprint/bin/blueprint-tools.js state-snapshot | jq '.decisions'
```

## Step 3.5: Pre-Research Interview

**Skip conditions:**
- If running in auto mode (`mode: "yolo"`): Skip entirely. Researcher receives default context (all focus areas, no constraints, standard depth). This matches existing behavior where research runs unsupervised.
- If user chose "skip" or "view" (without update) in Step 2: Skip entirely. Research is not running.

**Interactive mode — 3 questions in 1 round:**

Set `user_research_guidance` to empty string initially.

**Question 1:**

AskUserQuestion:
- header: "Focus"
- question: "What should research for Phase {phase} ({name}) focus on?"
- multiSelect: true
- options:
  - "Implementation patterns" — How to build {phase domain}
  - "Library/API selection" — Best tools for {phase domain}
  - "Integration approach" — How {phase domain} connects to existing code
  - "Known gotchas" — Specific problems I've seen in {phase domain}

Capture selected items as `research_focus_areas`.

**Question 2:**

AskUserQuestion:
- header: "Constraints"
- question: "Any constraints for this phase's technical approach?"
- options:
  - "Yes, let me describe" — I have specific constraints
  - "Use project conventions" — Follow what's established
  - "Research should recommend" — No additional constraints

If "Yes, let me describe":
- Ask freeform: "Describe the constraints for this phase:"
- Wait for response. Capture as `phase_constraints`.

If "Use project conventions": Set `phase_constraints` to "Use project conventions"
If "Research should recommend": Set `phase_constraints` to "Research should recommend"

**Question 3:**

AskUserQuestion:
- header: "Depth"
- question: "How deep should research go?"
- options:
  - "Thorough" — Comprehensive investigation (slower, more tokens)
  - "Focused" — Key decisions only (faster, fewer tokens)
  - "Verify only" — I know the approach, just validate it

Capture selection as `research_depth`.

**Format guidance block:**

Build `user_research_guidance` from responses:

```markdown
<user_research_guidance>
## User Research Guidance

**Focus areas:** {research_focus_areas}
**Phase constraints:** {phase_constraints}
**Depth:** {research_depth}
</user_research_guidance>
```

## Step 4: Spawn Researcher

Append `user_research_guidance` (if non-empty) to the spawn prompt after `<context>`:

```
Task(
  prompt="<objective>
Research implementation approach for Phase {phase}: {name}
</objective>

<context>
Phase description: {description}
Requirements: {requirements}
Prior decisions: {decisions}
Phase context: {context_md}
</context>

{user_research_guidance}

<output>
Write to: .blueprint/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>",
  subagent_type="bp-phase-researcher",
  model="{researcher_model}"
)
```

If `user_research_guidance` is empty (auto mode or skipped interview), the prompt is sent without the guidance block — researcher receives default context only.

## Step 5: Handle Return

- `## RESEARCH COMPLETE` — Enter post-research verification gate (Step 5.1)
- `## CHECKPOINT REACHED` — Present to user, spawn continuation
- `## RESEARCH INCONCLUSIVE` — Show attempts, offer: Add context/Try different mode/Manual

### Step 5.1: Post-Research Verification Gate

**Only activates on the `RESEARCH COMPLETE` path.** The CHECKPOINT REACHED and RESEARCH INCONCLUSIVE paths are unchanged.

**Auto mode:** If running in auto mode (`mode: "yolo"`):
```
✓ RESEARCH.md created at .blueprint/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md ({line_count} lines)
```
Auto-approve and proceed directly to next steps (planning or done). Do NOT skip the read-back (validates file was written correctly).

**Interactive mode:**

**1. Read back the artifact:**

```bash
cat .blueprint/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
```

Parse content to extract domain, confidence level, stack recommendations, architecture patterns, pitfalls, open questions, and sources.

**2. Generate summary using Phase-Level RESEARCH.md summary format:**

Extract and display:

- **Domain:** {primary domain from research}
- **Confidence:** {overall HIGH/MEDIUM/LOW}
- **Standard stack:** top 3-5 libraries with version and purpose (table)
- **Key architecture patterns:** {2-3 bullet points}
- **Don't hand-roll:** {comma-separated list of problems with existing solutions}
- **Top pitfalls:** numbered list (up to 3), each with name and one-line description
- **Open questions:** {count} unresolved ({list if ≤3})
- **Sources:** {count} PRIMARY, {count} SECONDARY, {count} TERTIARY

**3. Present with banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► REVIEW: Phase {N} Research
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Domain:** {domain}
**Confidence:** {confidence}

**Standard stack:**
| Library | Version | Purpose |
|---------|---------|---------|
| {lib}   | {ver}   | {why}   |

**Key architecture patterns:**
- {pattern 1}
- {pattern 2}
- {pattern 3}

**Don't hand-roll:** {list}

**Top pitfalls:**
1. {Pitfall name}: {one-line description}
2. {Pitfall name}: {one-line description}
3. {Pitfall name}: {one-line description}

**Open questions:** {count} unresolved ({list if ≤3})

**Sources:** {count} PRIMARY, {count} SECONDARY, {count} TERTIARY
```

**4. Ask for confirmation:**

AskUserQuestion:
- header: "Research"
- question: "How do these research findings look?"
- options:
  - "Approve" — Findings are good, proceed
  - "Dig deeper" — Investigate specific areas more
  - "Corrections" — Some findings are wrong
  - "Review full file" — Show me the raw RESEARCH.md

**5. Handle response:**

**If "Approve":** Proceed to next steps (offer Plan/Done as in original flow).

**If "Dig deeper":**
- Ask freeform: "What should we investigate further?"
- Wait for response. Capture as `deeper_request`.
- Re-spawn bp-phase-researcher with existing research + user's request:

```
Task(
  prompt="<objective>
Deepen research for Phase {phase}: {name}
</objective>

<context>
Phase description: {description}
Requirements: {requirements}
Prior decisions: {decisions}
Phase context: {context_md}
</context>

<existing_research>
Read the current research file: .blueprint/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
This contains findings from the initial research pass.
</existing_research>

<user_request>
The user wants deeper investigation into:
{deeper_request}
</user_request>

<instructions>
UPDATE the existing RESEARCH.md — do not overwrite it. Add new findings, refine existing sections,
and expand on the areas the user requested. Preserve existing valid findings.
</instructions>

<output>
Update: .blueprint/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>",
  subagent_type="bp-phase-researcher",
  model="{researcher_model}"
)
```

- After researcher returns, loop back to Step 5.1 (re-read, re-summarize, re-present gate).

**If "Corrections":**
- Ask freeform: "What needs correcting?"
- Wait for response. Capture as `correction_notes`.
- Apply targeted edits to RESEARCH.md using Edit tool (not full rewrite).
- Re-read the file:
  ```bash
  cat .blueprint/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
  ```
- Re-generate summary from updated content.
- Re-present banner and summary (loop back to step 3 of this gate).
- Re-ask for confirmation (loop back to step 4 of this gate).

**If "Review full file":**
- Display raw file content:
  ```bash
  cat .blueprint/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
  ```
- Re-ask for confirmation (loop back to step 4 of this gate, without re-displaying summary).

</process>
