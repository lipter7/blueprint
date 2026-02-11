# planner-plus-tracker

Create planning documents for a new feature or project by first gathering requirements through clarifying questions.

---

## Directory Structure

### Where to Create Planning Documents

**Single-app repository:**
```
/docs/planner+tracker/
/docs/planner+tracker/archived/
```

**Monorepo (multiple apps):**
Create within the specific app where changes will be made:
```
/apps/[app-name]/docs/planner+tracker/
/apps/[app-name]/docs/planner+tracker/archived/
```

If these directories don't exist, create them as part of the first planning document creation.

---

## File Naming Convention

```
[DOMAIN]_ROADMAP.md          # Full roadmap with phases, scope, and acceptance criteria
[DOMAIN]_ROADMAP_PROGRESS.md # Lightweight checklist for tracking completion
```

Where `[DOMAIN]` describes what's being planned using SCREAMING_SNAKE_CASE:
- `MAPPING_FIX_TOOLKIT_ROADMAP.md`
- `AUTH_REFACTOR_ROADMAP.md`
- `CACHING_LAYER_ROADMAP.md`

---

## Workflow

### Step 1: Understand the Request
Read the user's description of what they want to build. Identify:
- The core functionality requested
- Potential architectural decisions needed
- Integration points with existing code
- Technical uncertainties that need clarification

### Step 2: Explore the Codebase
Before asking questions, do the necessary repo discovery:
- Search for relevant existing patterns, utilities, or similar implementations
- Understand the project structure and conventions
- Check for relevant cursor rules in `.cursor/rules/`
- Identify what already exists that can be reused or extended
- Determine if this is a single-app or monorepo structure

### Step 3: Ask Clarifying Questions
Use the `AskQuestion` tool to gather requirements. Group related questions logically. Common areas to clarify:

**Architecture:**
- Technology choices (framework, libraries)
- Where code should live (directories, separation concerns)
- Integration with existing systems

**Scope:**
- MVP vs full feature set
- Priority of different capabilities
- What's essential vs nice-to-have

**User Experience:**
- Primary use cases (debugging, testing, monitoring)
- UI complexity (minimal functional vs polished)
- Authentication/access requirements

**Data & Persistence:**
- Data sources (live, cached, both)
- Storage requirements (files, database, none)
- Existing data structures to leverage

**Operations:**
- How to start/run the feature
- Deployment considerations
- Separation from production code

Ask questions in batches of 3-6 to avoid overwhelming the user. Follow up if answers reveal new decision points.

### Step 4: Create Planning Documents
Create two documents in the appropriate planning directory.

#### Document 1: `[DOMAIN]_ROADMAP.md`

```markdown
# [Domain] Roadmap

## Overview
Brief description of what this roadmap covers and why it matters.

## Architecture Decisions
Key decisions made during requirements gathering:
- Decision 1: [Choice] - [Rationale]
- Decision 2: [Choice] - [Rationale]

## Prerequisites
- Required tools, dependencies, env vars
- Setup steps

## Current State Inventory

### What Exists
- Existing code/tools to leverage
- Relevant files and their purposes

### What's Missing
- Components to build
- Gaps to fill

## Phase 1: [Foundation]

### Scope
What this phase delivers.

### Files to Create
- `path/to/file.ts` - Description of purpose

### Files to Edit
- `path/to/existing.ts` - What changes and why

### Acceptance Criteria
- [ ] Specific, verifiable criterion
- [ ] Another criterion
- [ ] Command that should pass: `npm run ...`

## Phase 2: [Core Features]

### Scope
...

### Files to Create
...

### Files to Edit
...

### Acceptance Criteria
- [ ] ...

## Phase N: [Final Phase]
...

## Reference
Technical details, API specs, diagrams, or supporting documentation.
```

#### Document 2: `[DOMAIN]_ROADMAP_PROGRESS.md`

```markdown
# [Domain] - Progress Tracker

Last updated: YYYY-MM-DD

## Phase 1: [Foundation]
- [ ] Task 1 (brief description)
- [ ] Task 2
- [ ] Task 3

## Phase 2: [Core Features]
- [ ] Task 1
- [ ] Task 2

## Phase N: [Final Phase]
- [ ] Task 1
- [ ] Final verification
```

### Step 5: Present the Plan
Summarize the plan for the user:
- Number of phases
- Key architectural decisions made
- Estimated complexity
- First steps to begin implementation

---

## Archiving Completed Plans

When a roadmap is fully complete (all phases done, all acceptance criteria met):

1. Create archive directory with completion date: `docs/planner+tracker/archived/[MM-DD-YY]/`
2. Move both `_ROADMAP.md` and `_ROADMAP_PROGRESS.md` files to the archive
3. Update any cursor rules that reference the archived files

**Archive naming uses completion date in `MM-DD-YY` format** (e.g., `02-03-26` for February 3, 2026).

---

## Best Practices

### Roadmap Document
- Include specific file paths for all create/edit operations
- Write acceptance criteria that can be verified with commands
- Keep phases small enough to complete in 1-3 sessions
- Document architectural decisions with rationale

### Progress Tracker
- Keep it lightweight—just checkboxes and brief task names
- Put detailed context in the roadmap, not here
- Update `Last updated` date when making changes
- One task per checkbox (atomic)

### General
- **Questions before assumptions**: Don't guess at requirements—ask
- **Lightweight over complex**: Prefer simpler solutions unless complexity is justified
- **Separation of concerns**: Keep test/debug tooling separate from production code
- **Leverage existing patterns**: Reuse what's already in the codebase
- **Phased delivery**: Break work into incremental, verifiable phases

---

## Example Question Templates

Use these as templates for the `AskQuestion` tool:

**Architecture:**
```
"For the [feature], would you prefer:
(a) integrated into existing [X]
(b) standalone [Y]
(c) separate process/server"
```

**Scope:**
```
"Which capabilities are essential for MVP? (select all that apply)
[ ] Feature A
[ ] Feature B
[ ] Feature C"
```

**Operations:**
```
"Should this be started:
(a) separately from other services
(b) alongside existing dev server
(c) combined single command"
```

**Separation:**
```
"How important is keeping this code separate from production code?
(a) Critical - must be easily excludable from deploys
(b) Somewhat - prefer separation but not strict
(c) Not important - can be integrated"
```

---

## First-Time Setup

If `docs/planner+tracker/` doesn't exist in the target location:

1. Create the directory structure:
   ```
   docs/planner+tracker/
   docs/planner+tracker/archived/
   ```

2. Create a `README.md` in `docs/planner+tracker/` with the file naming convention and archiving instructions (copy relevant sections from this command).

3. Optionally add a cursor rule to document the convention for future AI interactions.
