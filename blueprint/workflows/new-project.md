<purpose>
Initialize a new project through unified flow: questioning, research (optional), requirements, roadmap. This is the most leveraged moment in any project — deep questioning here means better plans, better execution, better outcomes. One workflow takes you from idea to ready-for-planning.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<auto_mode>
## Auto Mode Detection

Check if `--auto` flag is present in $ARGUMENTS.

**If auto mode:**
- Skip brownfield mapping offer (assume greenfield)
- Skip deep questioning (extract context from provided document)
- Config questions still required (Step 5)
- After config: run Steps 6-9 automatically with smart defaults:
  - Research: Always yes
  - Requirements: Include all table stakes + features from provided document
  - Requirements approval: Auto-approve
  - Roadmap approval: Auto-approve

**Document requirement:**
Auto mode requires an idea document via @ reference (e.g., `/bp:new-project --auto @prd.md`). If no document provided, error:

```
Error: --auto requires an idea document via @ reference.

Usage: /bp:new-project --auto @your-idea.md

The document should describe what you want to build.
```
</auto_mode>

<process>

## 1. Setup

**MANDATORY FIRST STEP — Execute these checks before ANY user interaction:**

```bash
INIT=$(node ~/.claude/blueprint/bin/blueprint-tools.js init new-project)
```

Parse JSON for: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `mapper_model`, `commit_docs`, `project_exists`, `has_codebase_map`, `planning_exists`, `has_existing_code`, `has_package_file`, `is_brownfield`, `needs_codebase_map`, `has_git`.

**If `project_exists` is true:** Error — project already initialized. Use `/bp:progress`.

**If `has_git` is false:** Initialize git:
```bash
git init
```

## 2. Brownfield Offer

**If auto mode:** Skip to Step 4 (assume greenfield, synthesize PROJECT.md from provided document).

**If `needs_codebase_map` is true** (from init — existing code detected but no codebase map):

Use AskUserQuestion:
- header: "Existing Code"
- question: "I detected existing code in this directory. Would you like to map the codebase first?"
- options:
  - "Map codebase first" — Run /bp:map-codebase to understand existing architecture (Recommended)
  - "Skip mapping" — Proceed with project initialization

**If "Map codebase first":**
```
Run `/bp:map-codebase` first, then return to `/bp:new-project`
```
Exit command.

**If "Skip mapping" OR `needs_codebase_map` is false:** Continue.

**If `has_codebase_map` is true AND `has_git` is true:**

The project already has a codebase map. Check if it's stale:

```bash
STALENESS=$(node ~/.claude/blueprint/bin/blueprint-tools.js codebase-staleness-check)
```

Parse `STALENESS` JSON. If `stale` is true, present to the user:

```
Existing codebase map may be outdated.
Last mapped: {last_mapped_at}
Changes since: {files_changed} files, +{lines_added}/-{lines_removed} lines

Would you like to refresh the codebase map before starting the project?
```

Options:
1. **Refresh** — Full remap before proceeding
2. **Skip** — Use existing codebase docs

If the user chooses Refresh, run the full remap flow (spawn 4 bp-codebase-mapper agents, commit results, update config metadata). Otherwise continue.

## 3. Deep Questioning

**If auto mode:** Skip. Extract project context from provided document instead and proceed to Step 4.

**Display stage banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Open the conversation:**

Ask inline (freeform, NOT AskUserQuestion):

"What do you want to build?"

Wait for their response. This gives you the context needed to ask intelligent follow-up questions.

**Follow the thread:**

Based on what they said, ask follow-up questions that dig into their response. Use AskUserQuestion with options that probe what they mentioned — interpretations, clarifications, concrete examples.

Keep following threads. Each answer opens new threads to explore. Ask about:
- What excited them
- What problem sparked this
- What they mean by vague terms
- What it would actually look like
- What's already decided

Consult `questioning.md` for techniques:
- Challenge vagueness
- Make abstract concrete
- Surface assumptions
- Find edges
- Reveal motivation

**Check context (background, not out loud):**

As you go, mentally check the context checklist from `questioning.md`. If gaps remain, weave questions naturally. Don't suddenly switch to checklist mode.

**Decision gate:**

When you could write a clear PROJECT.md, use AskUserQuestion:

- header: "Ready?"
- question: "I think I understand what you're after. Ready to create PROJECT.md?"
- options:
  - "Create PROJECT.md" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more

If "Keep exploring" — ask what they want to add, or identify gaps and probe naturally.

Loop until "Create PROJECT.md" selected.

## 4. Write PROJECT.md

**If auto mode:** Synthesize from provided document. No "Ready?" gate was shown — proceed directly to commit.

Synthesize all context into `.blueprint/PROJECT.md` using the template from `templates/project.md`.

**For greenfield projects:**

Initialize requirements as hypotheses:

```markdown
## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] [Requirement 1]
- [ ] [Requirement 2]
- [ ] [Requirement 3]

### Out of Scope

- [Exclusion 1] — [why]
- [Exclusion 2] — [why]
```

All Active requirements are hypotheses until shipped and validated.

**For brownfield projects (codebase map exists):**

Infer Validated requirements from existing code:

1. Read `.blueprint/codebase/ARCHITECTURE.md` and `STACK.md`
2. Identify what the codebase already does
3. These become the initial Validated set

```markdown
## Requirements

### Validated

- ✓ [Existing capability 1] — existing
- ✓ [Existing capability 2] — existing
- ✓ [Existing capability 3] — existing

### Active

- [ ] [New requirement 1]
- [ ] [New requirement 2]

### Out of Scope

- [Exclusion 1] — [why]
```

**Key Decisions:**

Initialize with any decisions made during questioning:

```markdown
## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice from questioning] | [Why] | — Pending |
```

**Last updated footer:**

```markdown
---
*Last updated: [date] after initialization*
```

Do not compress. Capture everything gathered.

Write the file to disk:
```bash
mkdir -p .blueprint
# Write .blueprint/PROJECT.md (do NOT commit yet — verification gate first)
```

### 4a. PROJECT.md Verification Gate

**If auto mode:** Skip gate. Display brief confirmation and commit directly:
```
✓ PROJECT.md created at .blueprint/PROJECT.md ({line_count} lines)
```
```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: initialize project" --files .blueprint/PROJECT.md
```
Proceed to Step 5.

**Interactive mode:**

Read back `.blueprint/PROJECT.md` and extract a structured summary.

Display with review banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► REVIEW: Project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**What this is:** {2-3 sentence description from What This Is section}

**Core value:** {one sentence from Core Value section}

**Active requirements:** {count} requirements in {count} categories
- {Category 1}: {count} requirements
- {Category 2}: {count} requirements

**Out of scope:** {count} exclusions

**Constraints:** {count} hard limits
- {list each constraint type: value pair}

**Key decisions:** {count} decisions logged
```

Use AskUserQuestion:
- header: "Project"
- question: "Does this accurately capture what you described?"
- options:
  - "Approve" — Looks good, proceed
  - "Corrections" — I want to change some things
  - "Review full file" — Show me the raw file first

**If "Approve":** Commit and proceed to Step 5.

```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: initialize project" --files .blueprint/PROJECT.md
```

**If "Corrections":**
- Ask: "What would you like to change?"
- Wait for freeform response
- Apply corrections to `.blueprint/PROJECT.md` using Edit tool (targeted edits, not full rewrite)
- Re-read the file and re-generate summary
- Re-display summary and re-ask (loop back to AskUserQuestion above)

**If "Review full file":**
- Display raw file content: `cat .blueprint/PROJECT.md`
- Then re-ask (loop back to AskUserQuestion above, without re-displaying summary)

Loop until user selects "Approve". Only commit after approval.

## 5. Workflow Preferences

**Round 1 — Core workflow settings (4 questions):**

```
questions: [
  {
    header: "Mode",
    question: "How do you want to work?",
    multiSelect: false,
    options: [
      { label: "YOLO (Recommended)", description: "Auto-approve, just execute" },
      { label: "Interactive", description: "Confirm at each step" }
    ]
  },
  {
    header: "Depth",
    question: "How thorough should planning be?",
    multiSelect: false,
    options: [
      { label: "Quick", description: "Ship fast (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced scope and speed (5-8 phases, 3-5 plans each)" },
      { label: "Comprehensive", description: "Thorough coverage (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  },
  {
    header: "Git Tracking",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .blueprint/ local-only (add to .gitignore)" }
    ]
  }
]
```

**Round 2 — Workflow agents:**

These spawn additional agents during planning/execution. They add tokens and time but improve quality.

| Agent | When it runs | What it does |
|-------|--------------|--------------|
| **Researcher** | Before planning each phase | Investigates domain, finds patterns, surfaces gotchas |
| **Plan Checker** | After plan is created | Verifies plan actually achieves the phase goal |
| **Verifier** | After phase execution | Confirms must-haves were delivered |

All recommended for important projects. Skip for quick experiments.

```
questions: [
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  },
  {
    header: "Model Profile",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" }
    ]
  }
]
```

Create `.blueprint/config.json` with all settings:

```json
{
  "mode": "yolo|interactive",
  "depth": "quick|standard|comprehensive",
  "parallelization": true|false,
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget",
  "workflow": {
    "research": true|false,
    "plan_check": true|false,
    "verifier": true|false
  }
}
```

**If commit_docs = No:**
- Set `commit_docs: false` in config.json
- Add `.blueprint/` to `.gitignore` (create if needed)

**If commit_docs = Yes:**
- No additional gitignore entries needed

**Commit config.json:**

```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "chore: add project config" --files .blueprint/config.json
```

**Note:** Run `/bp:settings` anytime to update these preferences.

## 5.5. Resolve Model Profile

Use models from init: `researcher_model`, `synthesizer_model`, `roadmapper_model`.

## 6. Research Decision

**If auto mode:** Default to "Research first" without asking.

Use AskUserQuestion:
- header: "Research"
- question: "Research the domain ecosystem before defining requirements?"
- options:
  - "Research first (Recommended)" — Discover standard stacks, expected features, architecture patterns
  - "Skip research" — I know this domain well, go straight to requirements

**If "Research first":**

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Researching [domain] ecosystem...
```

### 6a. Pre-Research Interview

**If auto mode:** Skip interview entirely. Researchers receive default context (all focus areas, no known problems, "Research should recommend"). Proceed directly to research directory creation.

**Interactive mode:**

Display interview banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► PRE-RESEARCH INTERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your input shapes what researchers investigate.
Quick 2-round interview — skip with default answers if unsure.
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

**Focus areas:** {selected areas from Q1, comma-separated}
**Known problems:** {user's freeform description from Q2, or "None specified" / "Domain is new — full discovery needed"}
**Conventions:** {user's freeform description from Q4, or "Research should recommend" / "Must match existing codebase"}
</user_research_guidance>
```

This `<user_research_guidance>` block is appended after `<project_context>` in ALL 4 researcher spawn prompts below.

Create research directory:
```bash
mkdir -p .blueprint/research
```

**Determine milestone context:**

Check if this is greenfield or subsequent milestone:
- If no "Validated" requirements in PROJECT.md → Greenfield (building from scratch)
- If "Validated" requirements exist → Subsequent milestone (adding to existing app)

Display spawning indicator:
```
◆ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

Spawn 4 parallel bp-project-researcher agents with rich context:

```
Task(prompt="First, read ~/.claude/agents/bp-project-researcher.md for your role and instructions.

<research_type>
Project Research — Stack dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: Research the standard stack for building [domain] from scratch.
Subsequent: Research what's needed to add [target features] to an existing [domain] app. Don't re-research the existing system.
</milestone_context>

<question>
What's the standard 2025 stack for [domain]?
</question>

<project_context>
[PROJECT.md summary - core value, constraints, what they're building]
</project_context>

{user_research_guidance block from interview — omit if auto mode}

<downstream_consumer>
Your STACK.md feeds into roadmap creation. Be prescriptive:
- Specific libraries with versions
- Clear rationale for each choice
- What NOT to use and why
</downstream_consumer>

<quality_gate>
- [ ] Versions are current (verify with Context7/official docs, not training data)
- [ ] Rationale explains WHY, not just WHAT
- [ ] Confidence levels assigned to each recommendation
</quality_gate>

<output>
Write to: .blueprint/research/STACK.md
Use template: ~/.claude/blueprint/templates/research-project/STACK.md
</output>
", subagent_type="general-purpose", model="{researcher_model}", description="Stack research")

Task(prompt="First, read ~/.claude/agents/bp-project-researcher.md for your role and instructions.

<research_type>
Project Research — Features dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What features do [domain] products have? What's table stakes vs differentiating?
Subsequent: How do [target features] typically work? What's expected behavior?
</milestone_context>

<question>
What features do [domain] products have? What's table stakes vs differentiating?
</question>

<project_context>
[PROJECT.md summary]
</project_context>

{user_research_guidance block from interview — omit if auto mode}

<downstream_consumer>
Your FEATURES.md feeds into requirements definition. Categorize clearly:
- Table stakes (must have or users leave)
- Differentiators (competitive advantage)
- Anti-features (things to deliberately NOT build)
</downstream_consumer>

<quality_gate>
- [ ] Categories are clear (table stakes vs differentiators vs anti-features)
- [ ] Complexity noted for each feature
- [ ] Dependencies between features identified
</quality_gate>

<output>
Write to: .blueprint/research/FEATURES.md
Use template: ~/.claude/blueprint/templates/research-project/FEATURES.md
</output>
", subagent_type="general-purpose", model="{researcher_model}", description="Features research")

Task(prompt="First, read ~/.claude/agents/bp-project-researcher.md for your role and instructions.

<research_type>
Project Research — Architecture dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: How are [domain] systems typically structured? What are major components?
Subsequent: How do [target features] integrate with existing [domain] architecture?
</milestone_context>

<question>
How are [domain] systems typically structured? What are major components?
</question>

<project_context>
[PROJECT.md summary]
</project_context>

{user_research_guidance block from interview — omit if auto mode}

<downstream_consumer>
Your ARCHITECTURE.md informs phase structure in roadmap. Include:
- Component boundaries (what talks to what)
- Data flow (how information moves)
- Suggested build order (dependencies between components)
</downstream_consumer>

<quality_gate>
- [ ] Components clearly defined with boundaries
- [ ] Data flow direction explicit
- [ ] Build order implications noted
</quality_gate>

<output>
Write to: .blueprint/research/ARCHITECTURE.md
Use template: ~/.claude/blueprint/templates/research-project/ARCHITECTURE.md
</output>
", subagent_type="general-purpose", model="{researcher_model}", description="Architecture research")

Task(prompt="First, read ~/.claude/agents/bp-project-researcher.md for your role and instructions.

<research_type>
Project Research — Pitfalls dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What do [domain] projects commonly get wrong? Critical mistakes?
Subsequent: What are common mistakes when adding [target features] to [domain]?
</milestone_context>

<question>
What do [domain] projects commonly get wrong? Critical mistakes?
</question>

<project_context>
[PROJECT.md summary]
</project_context>

{user_research_guidance block from interview — omit if auto mode}

<downstream_consumer>
Your PITFALLS.md prevents mistakes in roadmap/planning. For each pitfall:
- Warning signs (how to detect early)
- Prevention strategy (how to avoid)
- Which phase should address it
</downstream_consumer>

<quality_gate>
- [ ] Pitfalls are specific to this domain (not generic advice)
- [ ] Prevention strategies are actionable
- [ ] Phase mapping included where relevant
</quality_gate>

<output>
Write to: .blueprint/research/PITFALLS.md
Use template: ~/.claude/blueprint/templates/research-project/PITFALLS.md
</output>
", subagent_type="general-purpose", model="{researcher_model}", description="Pitfalls research")
```

After all 4 agents complete, spawn synthesizer to create SUMMARY.md:

```
Task(prompt="
<task>
Synthesize research outputs into SUMMARY.md.
</task>

<research_files>
Read these files:
- .blueprint/research/STACK.md
- .blueprint/research/FEATURES.md
- .blueprint/research/ARCHITECTURE.md
- .blueprint/research/PITFALLS.md
</research_files>

<output>
Write to: .blueprint/research/SUMMARY.md
Use template: ~/.claude/blueprint/templates/research-project/SUMMARY.md
Commit after writing.
</output>
", subagent_type="bp-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

Display research complete banner and key findings:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Key Findings

**Stack:** [from SUMMARY.md]
**Table Stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]

Files: `.blueprint/research/`
```

### 6b. Post-Research Verification Gate

**If auto mode:** Skip gate. Display brief confirmation and proceed directly to Step 7:
```
✓ Research complete — 5 files in .blueprint/research/
```

**Interactive mode:**

Read `.blueprint/research/SUMMARY.md` and extract a structured summary.

Display with review banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► REVIEW: Research Findings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
```

Use AskUserQuestion:
- header: "Research"
- question: "Do these research findings look right?"
- options:
  - "Approve" — Findings look good, proceed to requirements
  - "Dig deeper" — I want more detail on a specific area
  - "Corrections" — Some findings are wrong or missing
  - "Review files" — Show me a specific research file

**If "Approve":** Proceed to Step 7.

**If "Dig deeper":**
- Ask freeform: "Which area needs deeper research, and what concerns do you have?"
- Wait for response. Capture the area and concerns.
- Spawn a single targeted researcher:
  ```
  Task(prompt="First, read ~/.claude/agents/bp-project-researcher.md for your role and instructions.

  <research_type>
  Targeted deep-dive — {area user specified} for [domain].
  </research_type>

  <user_concern>
  {user's description of what needs deeper investigation}
  </user_concern>

  <existing_research>
  Read these files for context on what's already been researched:
  - .blueprint/research/SUMMARY.md
  - .blueprint/research/{relevant file based on area}
  </existing_research>

  <project_context>
  [PROJECT.md summary]
  </project_context>

  <output>
  Update the relevant research file in .blueprint/research/ with deeper findings.
  Then update .blueprint/research/SUMMARY.md to reflect new information.
  </output>
  ", subagent_type="general-purpose", model="{researcher_model}", description="Deep-dive: {area}")
  ```
- After researcher completes, re-read SUMMARY.md
- Re-generate summary and re-enter this gate (loop back to AskUserQuestion above)

**If "Corrections":**
- Ask: "What's wrong or missing in the research?"
- Wait for freeform response
- Apply corrections to the relevant research files using Edit tool
- Update SUMMARY.md if affected
- Re-read SUMMARY.md and re-generate summary
- Re-display summary and re-ask (loop back to AskUserQuestion above)

**If "Review files":**
- Ask which file to review:
  AskUserQuestion:
  - header: "File"
  - question: "Which research file do you want to review?"
  - options:
    - "SUMMARY.md" — Research synthesis and key findings
    - "STACK.md" — Technology stack recommendations
    - "FEATURES.md" — Feature landscape analysis
    - "ARCHITECTURE.md" — System architecture patterns
- Display the selected file: `cat .blueprint/research/{selected_file}`
- Then re-ask (loop back to the main AskUserQuestion above, without re-displaying summary)

Loop until user selects "Approve".

**If "Skip research":** Continue to Step 7.

## 7. Define Requirements

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Load context:**

Read PROJECT.md and extract:
- Core value (the ONE thing that must work)
- Stated constraints (budget, timeline, tech limitations)
- Any explicit scope boundaries

**If research exists:** Read research/FEATURES.md and extract feature categories.

**If auto mode:**
- Auto-include all table stakes features (users expect these)
- Include features explicitly mentioned in provided document
- Auto-defer differentiators not mentioned in document
- Skip per-category AskUserQuestion loops
- Skip "Any additions?" question
- Skip requirements approval gate
- Generate REQUIREMENTS.md and commit directly

**Present features by category (interactive mode only):**

```
Here are the features for [domain]:

## Authentication
**Table stakes:**
- Sign up with email/password
- Email verification
- Password reset
- Session management

**Differentiators:**
- Magic link login
- OAuth (Google, GitHub)
- 2FA

**Research notes:** [any relevant notes]

---

## [Next Category]
...
```

**If no research:** Gather requirements through conversation instead.

Ask: "What are the main things users need to be able to do?"

For each capability mentioned:
- Ask clarifying questions to make it specific
- Probe for related capabilities
- Group into categories

**Scope each category:**

For each category, use AskUserQuestion:

- header: "[Category name]"
- question: "Which [category] features are in v1?"
- multiSelect: true
- options:
  - "[Feature 1]" — [brief description]
  - "[Feature 2]" — [brief description]
  - "[Feature 3]" — [brief description]
  - "None for v1" — Defer entire category

Track responses:
- Selected features → v1 requirements
- Unselected table stakes → v2 (users expect these)
- Unselected differentiators → out of scope

**Identify gaps:**

Use AskUserQuestion:
- header: "Additions"
- question: "Any requirements research missed? (Features specific to your vision)"
- options:
  - "No, research covered it" — Proceed
  - "Yes, let me add some" — Capture additions

**Validate core value:**

Cross-check requirements against Core Value from PROJECT.md. If gaps detected, surface them.

**Generate REQUIREMENTS.md:**

Create `.blueprint/REQUIREMENTS.md` with:
- v1 Requirements grouped by category (checkboxes, REQ-IDs)
- v2 Requirements (deferred)
- Out of Scope (explicit exclusions with reasoning)
- Traceability section (empty, filled by roadmap)

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, CONTENT-02)

**Requirement quality criteria:**

Good requirements are:
- **Specific and testable:** "User can reset password via email link" (not "Handle password reset")
- **User-centric:** "User can X" (not "System does Y")
- **Atomic:** One capability per requirement (not "User can login and manage profile")
- **Independent:** Minimal dependencies on other requirements

Reject vague requirements. Push for specificity:
- "Handle authentication" → "User can log in with email/password and stay logged in across sessions"
- "Support sharing" → "User can share post via link that opens in recipient's browser"

### 7a. Requirements Verification Gate

**If auto mode:** Skip gate. Display brief confirmation and commit directly:
```
✓ REQUIREMENTS.md created at .blueprint/REQUIREMENTS.md ({line_count} lines)
```
```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: define v1 requirements" --files .blueprint/REQUIREMENTS.md
```
Proceed to Step 8.

**Interactive mode:**

Read back `.blueprint/REQUIREMENTS.md` and extract a structured summary.

Display with review banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► REVIEW: Requirements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**v1 scope:** {total count} requirements across {category count} categories

For each category:
- **{Category} ({count}):** {comma-separated REQ-IDs with brief labels}

**v2 deferred:** {count} requirements

**Out of scope:** {count} exclusions
For each:
- {Feature}: {reason}

**Coverage check:** All v1 requirements mapped? {yes/no}
```

Use AskUserQuestion:
- header: "Requirements"
- question: "Does this accurately capture what you're building?"
- options:
  - "Approve" — Looks good, proceed to roadmap
  - "Corrections" — I want to change some things
  - "Review full file" — Show me the raw file first

**If "Approve":** Commit and proceed to Step 8.

```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: define v1 requirements" --files .blueprint/REQUIREMENTS.md
```

**If "Corrections":**
- Ask: "What would you like to change?"
- Wait for freeform response
- Apply corrections to `.blueprint/REQUIREMENTS.md` using Edit tool (targeted edits, not full rewrite)
- Re-read the file and re-generate summary
- Re-display summary and re-ask (loop back to AskUserQuestion above)

**If "Review full file":**
- Display raw file content: `cat .blueprint/REQUIREMENTS.md`
- Then re-ask (loop back to AskUserQuestion above, without re-displaying summary)

Loop until user selects "Approve". Only commit after approval.

## 8. Create Roadmap

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

Spawn bp-roadmapper agent with context:

```
Task(prompt="
<planning_context>

**Project:**
@.blueprint/PROJECT.md

**Requirements:**
@.blueprint/REQUIREMENTS.md

**Research (if exists):**
@.blueprint/research/SUMMARY.md

**Config:**
@.blueprint/config.json

</planning_context>

<instructions>
Create roadmap:
1. Derive phases from requirements (don't impose structure)
2. Map every v1 requirement to exactly one phase
3. Derive 2-5 success criteria per phase (observable user behaviors)
4. Validate 100% coverage
5. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
6. Return ROADMAP CREATED with summary

Write files first, then return. This ensures artifacts persist even if context is lost.
</instructions>
", subagent_type="bp-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**Handle roadmapper return:**

**If `## ROADMAP BLOCKED`:**
- Present blocker information
- Work with user to resolve
- Re-spawn when resolved

**If `## ROADMAP CREATED`:**

Read the created ROADMAP.md and extract a structured summary.

**If auto mode:** Skip approval gate — auto-approve and commit directly:
```
✓ ROADMAP.md created at .blueprint/ROADMAP.md ({line_count} lines, {phase_count} phases)
```
```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: create roadmap ([N] phases)" --files .blueprint/ROADMAP.md .blueprint/STATE.md .blueprint/REQUIREMENTS.md
```
Proceed to Step 9.

**Interactive mode — CRITICAL: Ask for approval before committing:**

Display with review banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► REVIEW: Roadmap
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phases:** {count} phases | **Depth:** {depth setting}

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| {n} | {name} | {goal} | {REQ-IDs} | {count} criteria |
[... for all phases ...]

**Requirement coverage:** {mapped}/{total} v1 requirements mapped

**Phase dependencies:**
{Phase N} → {Phase M} → ... (dependency chain)

**Success criteria preview** (Phase 1 only, to show quality):
1. {criterion 1}
2. {criterion 2}
3. {criterion 3}
```

Use AskUserQuestion:
- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" — Commit and continue
  - "Adjust phases" — Change phase structure
  - "Review criteria" — Show all success criteria for all phases
  - "Review full file" — Show raw ROADMAP.md

**If "Approve":** Continue to commit.

**If "Adjust phases":**

Ask which kind of adjustment:

AskUserQuestion:
- header: "Adjust"
- question: "What kind of adjustment?"
- options:
  - "Reorder phases" — Change the sequence of phases
  - "Split or merge" — Split a large phase or merge small ones
  - "Change scope" — Move requirements between phases
  - "Change criteria" — Modify success criteria for a phase

Capture the user's specific adjustment notes based on their selection.

Re-spawn roadmapper with revision context:
```
Task(prompt="
<revision>
User feedback on roadmap:
Adjustment type: {selected adjustment type}
Details: [user's notes]

Current ROADMAP.md: @.blueprint/ROADMAP.md

Update the roadmap based on feedback. Edit files in place.
Return ROADMAP REVISED with changes made.
</revision>
", subagent_type="bp-roadmapper", model="{roadmapper_model}", description="Revise roadmap")
```

After roadmapper returns:
- Re-read ROADMAP.md and re-generate summary
- Re-display summary and re-ask (loop back to the main AskUserQuestion above)
- Loop until user selects "Approve"

**If "Review criteria":**
- Read ROADMAP.md and extract ALL success criteria for ALL phases
- Display them grouped by phase:
  ```
  ## Success Criteria — All Phases

  **Phase 1: {Name}**
  1. {criterion}
  2. {criterion}
  3. {criterion}

  **Phase 2: {Name}**
  1. {criterion}
  2. {criterion}

  [... all phases ...]
  ```
- Then re-ask (loop back to the main AskUserQuestion above, without re-displaying the summary)

**If "Review full file":** Display raw `cat .blueprint/ROADMAP.md`, then re-ask (loop back to the main AskUserQuestion above).

**Commit roadmap (after approval):**

```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: create roadmap ([N] phases)" --files .blueprint/ROADMAP.md .blueprint/STATE.md .blueprint/REQUIREMENTS.md
```

## 9. Done

Present completion with next steps:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint ► PROJECT INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[Project Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.blueprint/PROJECT.md`      |
| Config         | `.blueprint/config.json`     |
| Research       | `.blueprint/research/`       |
| Requirements   | `.blueprint/REQUIREMENTS.md` |
| Roadmap        | `.blueprint/ROADMAP.md`      |

**[N] phases** | **[X] requirements** | Ready to build ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/bp:discuss-phase 1 — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

---

**Also available:**
- /bp:plan-phase 1 — skip discussion, plan directly

───────────────────────────────────────────────────────────────
```

</process>

<output>

- `.blueprint/PROJECT.md`
- `.blueprint/config.json`
- `.blueprint/research/` (if research selected)
  - `STACK.md`
  - `FEATURES.md`
  - `ARCHITECTURE.md`
  - `PITFALLS.md`
  - `SUMMARY.md`
- `.blueprint/REQUIREMENTS.md`
- `.blueprint/ROADMAP.md`
- `.blueprint/STATE.md`

</output>

<success_criteria>

- [ ] .blueprint/ directory created
- [ ] Git repo initialized
- [ ] Brownfield detection completed
- [ ] Deep questioning completed (threads followed, not rushed)
- [ ] PROJECT.md captures full context → **verified by user** → **committed**
- [ ] config.json has workflow mode, depth, parallelization → **committed**
- [ ] Pre-research interview completed (if interactive + research selected)
- [ ] Research completed (if selected) — 4 parallel agents spawned → **committed**
- [ ] Research findings reviewed by user (if interactive + research selected)
- [ ] Requirements gathered (from research or conversation)
- [ ] User scoped each category (v1/v2/out of scope)
- [ ] REQUIREMENTS.md created with REQ-IDs → **verified by user** → **committed**
- [ ] bp-roadmapper spawned with context
- [ ] Roadmap files written immediately (not draft)
- [ ] Roadmap reviewed by user with structured summary (if interactive)
- [ ] User feedback incorporated (if any)
- [ ] ROADMAP.md created with phases, requirement mappings, success criteria
- [ ] STATE.md initialized
- [ ] REQUIREMENTS.md traceability updated
- [ ] User knows next step is `/bp:discuss-phase 1`

**Atomic commits:** Each phase commits its artifacts immediately. If context is lost, artifacts persist.

</success_criteria>
