<purpose>

Start a new milestone cycle for an existing project. Loads project context, gathers milestone goals (from MILESTONE-CONTEXT.md or conversation), updates PROJECT.md and STATE.md, optionally runs parallel research, defines scoped requirements with REQ-IDs, spawns the roadmapper to create phased execution plan, and commits all artifacts. Brownfield equivalent of new-project.

</purpose>

<required_reading>

Read all files referenced by the invoking prompt's execution_context before starting.

</required_reading>

<process>

## 1. Load Context

- Read PROJECT.md (existing project, validated requirements, decisions)
- Read MILESTONES.md (what shipped previously)
- Read STATE.md (pending todos, blockers)
- Check for MILESTONE-CONTEXT.md (from /bp:discuss-milestone)

## 1.5. Check Codebase Staleness

**If `has_codebase_map` is true AND `has_git` is true:**

```bash
STALENESS=$(node ~/.claude/blueprint/bin/blueprint-tools.js codebase-staleness-check)
```

Parse `STALENESS` JSON. Extract `stale`, `never_mapped`, `has_maps`, `summary`, `last_mapped_at`, `files_changed`, `lines_added`, `lines_removed`.

**If `stale` is false AND `never_mapped` is false:** Continue silently to the next step.

**If `never_mapped` is true:** Skip staleness check — no codebase map exists. The user can run `/bp:map-codebase` separately if needed.

**If `stale` is true:**

Present to the user via `AskUserQuestion`:

```
Codebase mapping may be stale.
Last mapped: {last_mapped_at}
Changes since: {files_changed} files, +{lines_added}/-{lines_removed} lines

{summary}
```

**Options:**
1. **Full remap** — Re-run all 4 mapping agents (recommended if significant structural changes)
2. **Skip** — Continue with current codebase docs

**If user chooses Full remap:**

Spawn 4 bp-codebase-mapper agents in parallel, identical to the `map-codebase` workflow's `spawn_agents` step. Use `mapper_model` from the init context. After all 4 complete:

1. Verify all 7 docs exist in `.blueprint/codebase/`
2. Commit: `node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: remap codebase (staleness detected)" --files .blueprint/codebase/*.md`
3. Update mapping metadata:
   ```bash
   COMMIT=$(git rev-parse --short HEAD)
   TIMESTAMP=$(node ~/.claude/blueprint/bin/blueprint-tools.js current-timestamp full)
   node ~/.claude/blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_at" "$TIMESTAMP"
   node ~/.claude/blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_commit" "$COMMIT"
   node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: update codebase mapping metadata" --files .blueprint/config.json
   ```

**If user chooses Skip:** Continue to the next step.

## 2. Gather Milestone Goals

**If MILESTONE-CONTEXT.md exists:**
- Use features and scope from discuss-milestone
- Present summary for confirmation

**If no context file:**
- Present what shipped in last milestone
- Ask: "What do you want to build next?"
- Use AskUserQuestion to explore features, priorities, constraints, scope

## 3. Determine Milestone Version

- Parse last version from MILESTONES.md
- Suggest next version (v1.0 → v1.1, or v2.0 for major)
- Confirm with user

## 4. Update PROJECT.md

Add/update:

```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence describing milestone focus]

**Target features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]
```

Update Active requirements section and "Last updated" footer.

## 5. Update STATE.md

```markdown
## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: [today] — Milestone v[X.Y] started
```

Keep Accumulated Context section from previous milestone.

## 6. Cleanup and Commit

Delete MILESTONE-CONTEXT.md if exists (consumed).

```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: start milestone v[X.Y] [Name]" --files .blueprint/PROJECT.md .blueprint/STATE.md
```

## 7. Load Context and Resolve Models

```bash
INIT=$(node ~/.claude/blueprint/bin/blueprint-tools.js init new-milestone)
```

Extract from init JSON: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `mapper_model`, `commit_docs`, `research_enabled`, `current_milestone`, `project_exists`, `roadmap_exists`, `has_codebase_map`, `has_git`.

## 8. Research Decision

AskUserQuestion: "Research the domain ecosystem for new features before defining requirements?"
- "Research first (Recommended)" — Discover patterns, features, architecture for NEW capabilities
- "Skip research" — Go straight to requirements

**Persist choice to config** (so future `/bp:plan-phase` honors it):

```bash
# If "Research first": persist true
node ~/.claude/blueprint/bin/blueprint-tools.js config-set workflow.research true

# If "Skip research": persist false
node ~/.claude/blueprint/bin/blueprint-tools.js config-set workflow.research false
```

**If "Research first":**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning 4 researchers in parallel...
  → Stack, Features, Architecture, Pitfalls
```

### 8a. Pre-Research Interview

**If auto mode:** Skip interview entirely. Researchers receive default context (all focus areas, no known problems, "Research should recommend"). Proceed directly to research directory creation.

**Interactive mode:**

Display interview banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► PRE-RESEARCH INTERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your input shapes what researchers investigate.
Quick 2-round interview — skip with default answers if unsure.

**Existing system context:** Subsequent milestone — focus research on NEW features only.
Existing validated capabilities: {list from PROJECT.md Validated section}
```

**Round 1 (2 questions):**

AskUserQuestion:
- header: "Focus"
- question: "What aspects of {domain} should research focus on?"
- multiSelect: true
- options:
  - "Technology stack" — Best frameworks, libraries, databases for this domain
  - "Architecture patterns" — How to structure the system, component design
  - "Feature landscape" — What users expect, table stakes vs differentiators
  - "Common pitfalls" — What goes wrong, what to avoid

AskUserQuestion:
- header: "Known"
- question: "Are there known technical challenges or constraints?"
- options:
  - "Yes, let me describe" — I know specific issues to investigate
  - "Not sure" — Research should discover these
  - "Domain is new to me" — Full ecosystem discovery needed

**If "Yes, let me describe":**
Ask freeform: "Describe the known challenges or constraints:"
Wait for response. Capture as known_problems context.

**Round 2:**

AskUserQuestion:
- header: "Conventions"
- question: "Any technology preferences or conventions to follow?"
- options:
  - "Yes, let me specify" — I have stack/pattern preferences
  - "Research should recommend" — No strong preferences
  - "Must match existing codebase" — Research should check compatibility

**If "Yes, let me specify":**
Ask freeform: "Describe your technology preferences or conventions:"
Wait for response. Capture as conventions context.

**Format interview responses:**

Assemble all responses into a structured block:

```markdown
<user_research_guidance>
## User Research Guidance

**Existing system context:** Subsequent milestone — focus research on NEW features only.
Existing validated capabilities: {list from PROJECT.md Validated section}

**Focus areas:** {selected focus areas from Q1, comma-separated}
**Known problems:** {known_problems_text or "None specified — discover during research"}
**Conventions:** {conventions_text or "Research should recommend"}
**Domain familiarity:** {new to me / not sure / experienced (inferred from answers)}
</user_research_guidance>
```

This `<user_research_guidance>` block is appended after `<project_context>` in ALL 4 researcher spawn prompts below.

```bash
mkdir -p .blueprint/research
```

Spawn 4 parallel bp-project-researcher agents. Each uses this template with dimension-specific fields:

**Common structure for all 4 researchers:**
```
Task(prompt="
<research_type>Project Research — {DIMENSION} for [new features].</research_type>

<milestone_context>
SUBSEQUENT MILESTONE — Adding [target features] to existing app.
{EXISTING_CONTEXT}
Focus ONLY on what's needed for the NEW features.
</milestone_context>

<question>{QUESTION}</question>

<project_context>[PROJECT.md summary]</project_context>

{user_research_guidance block from interview — omit if auto mode}

<downstream_consumer>{CONSUMER}</downstream_consumer>

<quality_gate>{GATES}</quality_gate>

<output>
Write to: .blueprint/research/{FILE}
Use template: ~/.claude/blueprint/templates/research-project/{FILE}
</output>
", subagent_type="bp-project-researcher", model="{researcher_model}", description="{DIMENSION} research")
```

**Dimension-specific fields:**

| Field | Stack | Features | Architecture | Pitfalls |
|-------|-------|----------|-------------|----------|
| EXISTING_CONTEXT | Existing validated capabilities (DO NOT re-research): [from PROJECT.md] | Existing features (already built): [from PROJECT.md] | Existing architecture: [from PROJECT.md or codebase map] | Focus on common mistakes when ADDING these features to existing system |
| QUESTION | What stack additions/changes are needed for [new features]? | How do [target features] typically work? Expected behavior? | How do [target features] integrate with existing architecture? | Common mistakes when adding [target features] to [domain]? |
| CONSUMER | Specific libraries with versions for NEW capabilities, integration points, what NOT to add | Table stakes vs differentiators vs anti-features, complexity noted, dependencies on existing | Integration points, new components, data flow changes, suggested build order | Warning signs, prevention strategy, which phase should address it |
| GATES | Versions current (verify with Context7), rationale explains WHY, integration considered | Categories clear, complexity noted, dependencies identified | Integration points identified, new vs modified explicit, build order considers deps | Pitfalls specific to adding these features, integration pitfalls covered, prevention actionable |
| FILE | STACK.md | FEATURES.md | ARCHITECTURE.md | PITFALLS.md |

After all 4 complete, spawn synthesizer:

```
Task(prompt="
Synthesize research outputs into SUMMARY.md.

Read: .blueprint/research/STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

Write to: .blueprint/research/SUMMARY.md
Use template: ~/.claude/blueprint/templates/research-project/SUMMARY.md
Commit after writing.
", subagent_type="bp-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

Display key findings from SUMMARY.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Stack additions:** [from SUMMARY.md]
**Feature table stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]
```

### 8b. Post-Research Verification Gate

**Reference:** See `~/.claude/blueprint/references/verification-gates.md` — Research Summary (Project-Level) format.

**If auto mode:** Skip gate. Display brief confirmation and auto-proceed to Step 9:
```
✓ Research complete — .blueprint/research/SUMMARY.md ({line_count} lines)
```

**Interactive mode:**

Read SUMMARY.md:
```bash
cat .blueprint/research/SUMMARY.md
```

Generate summary using the project-level research summary format:

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

AskUserQuestion:
- header: "Research"
- question: "Do these findings match your understanding of this domain?"
- options:
  - "Approve" — Findings look right, proceed to requirements
  - "Dig deeper" — I want to investigate specific areas more
  - "Corrections" — Some findings are wrong or missing context
  - "Review full files" — Show me the raw research files

Handle response:

**"Approve":** Proceed to Step 9 (Define Requirements).

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
    - "ARCHITECTURE.md" — System architecture and pitfalls
- Display selected file
- Re-ask confirmation

**If "Skip research":** Continue to Step 9.

## 9. Define Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Read PROJECT.md: core value, current milestone goals, validated requirements (what exists).

**If research exists:** Read FEATURES.md, extract feature categories.

Present features by category:
```
## [Category 1]
**Table stakes:** Feature A, Feature B
**Differentiators:** Feature C, Feature D
**Research notes:** [any relevant notes]
```

**If no research:** Gather requirements through conversation. Ask: "What are the main things users need to do with [new features]?" Clarify, probe for related capabilities, group into categories.

**Scope each category** via AskUserQuestion (multiSelect: true):
- "[Feature 1]" — [brief description]
- "[Feature 2]" — [brief description]
- "None for this milestone" — Defer entire category

Track: Selected → this milestone. Unselected table stakes → future. Unselected differentiators → out of scope.

**Identify gaps** via AskUserQuestion:
- "No, research covered it" — Proceed
- "Yes, let me add some" — Capture additions

**Generate REQUIREMENTS.md:**
- v1 Requirements grouped by category (checkboxes, REQ-IDs)
- Future Requirements (deferred)
- Out of Scope (explicit exclusions with reasoning)
- Traceability section (empty, filled by roadmap)

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, NOTIF-02). Continue numbering from existing.

**Requirement quality criteria:**

Good requirements are:
- **Specific and testable:** "User can reset password via email link" (not "Handle password reset")
- **User-centric:** "User can X" (not "System does Y")
- **Atomic:** One capability per requirement (not "User can login and manage profile")
- **Independent:** Minimal dependencies on other requirements

Present FULL requirements list for confirmation:

```
## Milestone v[X.Y] Requirements

### [Category 1]
- [ ] **CAT1-01**: User can do X
- [ ] **CAT1-02**: User can do Y

### [Category 2]
- [ ] **CAT2-01**: User can do Z

Does this capture what you're building? (yes / adjust)
```

If "adjust": Return to scoping.

**Commit requirements:**
```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: define milestone v[X.Y] requirements" --files .blueprint/REQUIREMENTS.md
```

## 10. Create Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

**Starting phase number:** Read MILESTONES.md for last phase number. Continue from there (v1.0 ended at phase 5 → v1.1 starts at phase 6).

```
Task(prompt="
<planning_context>
@.blueprint/PROJECT.md
@.blueprint/REQUIREMENTS.md
@.blueprint/research/SUMMARY.md (if exists)
@.blueprint/config.json
@.blueprint/MILESTONES.md
</planning_context>

<instructions>
Create roadmap for milestone v[X.Y]:
1. Start phase numbering from [N]
2. Derive phases from THIS MILESTONE's requirements only
3. Map every requirement to exactly one phase
4. Derive 2-5 success criteria per phase (observable user behaviors)
5. Validate 100% coverage
6. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
7. Return ROADMAP CREATED with summary

Write files first, then return.
</instructions>
", subagent_type="bp-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**Handle return:**

**If `## ROADMAP BLOCKED`:** Present blocker, work with user, re-spawn.

**If `## ROADMAP CREATED`:** Read ROADMAP.md, present inline:

```
## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| [N] | [Name] | [Goal] | [REQ-IDs] | [count] |

### Phase Details

**Phase [N]: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
```

**Ask for approval** via AskUserQuestion:
- "Approve" — Commit and continue
- "Adjust phases" — Tell me what to change
- "Review full file" — Show raw ROADMAP.md

**If "Adjust":** Get notes, re-spawn roadmapper with revision context, loop until approved.
**If "Review":** Display raw ROADMAP.md, re-ask.

**Commit roadmap** (after approval):
```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: create milestone v[X.Y] roadmap ([N] phases)" --files .blueprint/ROADMAP.md .blueprint/STATE.md .blueprint/REQUIREMENTS.md
```

## 11. Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► MILESTONE INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.blueprint/PROJECT.md`      |
| Research       | `.blueprint/research/`       |
| Requirements   | `.blueprint/REQUIREMENTS.md` |
| Roadmap        | `.blueprint/ROADMAP.md`      |

**[N] phases** | **[X] requirements** | Ready to build ✓

## ▶ Next Up

**Phase [N]: [Phase Name]** — [Goal]

`/bp:discuss-phase [N]` — gather context and clarify approach

<sub>`/clear` first → fresh context window</sub>

Also: `/bp:plan-phase [N]` — skip discussion, plan directly
```

</process>

<success_criteria>
- [ ] PROJECT.md updated with Current Milestone section
- [ ] STATE.md reset for new milestone
- [ ] MILESTONE-CONTEXT.md consumed and deleted (if existed)
- [ ] Pre-research interview completed (if research selected, interactive mode)
- [ ] Research completed (if selected) — 4 parallel agents, milestone-aware
- [ ] Post-research findings reviewed and approved (if research selected, interactive mode)
- [ ] Requirements gathered and scoped per category
- [ ] REQUIREMENTS.md created with REQ-IDs
- [ ] bp-roadmapper spawned with phase numbering context
- [ ] Roadmap files written immediately (not draft)
- [ ] User feedback incorporated (if any)
- [ ] ROADMAP.md phases continue from previous milestone
- [ ] All commits made (if planning docs committed)
- [ ] User knows next step: `/bp:discuss-phase [N]`

**Atomic commits:** Each phase commits its artifacts immediately.
</success_criteria>
