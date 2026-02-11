# Plan Phase

Plan the next phase from existing roadmap documentation created by `/planner-plus-tracker`.

> **Mode**: This command runs in **Plan Mode** (read-only except for plan crud). Switch to Agent Mode after reviewing the plan to begin implementation.

---

## Step 1: Locate Planning Documents

Find the `planner+tracker` directory:

**Single-app repository:** `docs/planner+tracker/`
**Monorepo:** `apps/[current-app]/docs/planner+tracker/`

Look for files matching the naming pattern:
```
[DOMAIN]_ROADMAP.md
[DOMAIN]_ROADMAP_PROGRESS.md
```

If multiple roadmaps exist, ask the user which one to work on.

---

## Step 2: Read Both Documents

1. Read the `_ROADMAP.md` file to understand:
   - Overall scope and architecture decisions
   - Phase definitions and acceptance criteria
   - Files to create/edit for each phase

2. Read the `_ROADMAP_PROGRESS.md` file to understand:
   - Which tasks are completed `[x]`
   - Which tasks remain `[ ]`

---

## Step 3: Identify the Next Phase

Scan the progress tracker for the **first phase with unchecked items** `[ ]`.

- If all items in Phase 1 are checked, move to Phase 2
- If some items in Phase N are checked but not all, that's the current phase
- If all phases are complete, inform the user the roadmap is done and suggest archiving

Report to the user: "The next phase to implement is **Phase N: [Phase Name]**"

---

## Step 4: Create Implementation Plan

Generate a comprehensive implementation plan for the identified phase.

### Requirements

- **Repo discovery first**: Search, open, and trace through the specific code paths involved so you understand the current behavior before proposing changes.

- **Identify every file** you expect to touch as well as those that will be involved/imported:
  - Files to edit (and what/why)
  - Files to create (and what they contain)
  - Files to delete (and why safe)
  - Files to be used (data access helpers, data types, utilities)

- **Step-by-step plan**: Produce a plan that is specific and actionable, with clear sequencing and dependencies. The plan should be detailed enough that a developer with no prior experience in this codebase could implement it without any additional information.

- **Verification steps**: Include explicit verification steps (e.g., typecheck, lint, and unit/integration checks if necessary).

- **Clean code over backward compatibility**: Assume backward compatibility is never needed.

- **Success criteria**: Define success criteria / acceptance checks that confirm the phase is fully complete. Pull these from the roadmap's acceptance criteria for this phase.

---

## Step 5: Include Document Update Step

**CRITICAL**: The final step of every plan MUST be to update the planning documents:

```markdown
### Final Step: Update Planning Documents

1. Update `[DOMAIN]_ROADMAP_PROGRESS.md`:
   - Mark completed tasks as `[x]`
   - Update `Last updated: YYYY-MM-DD` date

2. Update `[DOMAIN]_ROADMAP.md` (if needed):
   - Mark acceptance criteria as `[x]` if met
   - Add notes about any deviations or scope changes
   - Document any follow-up items discovered

3. **If this is the FINAL PHASE**, add archiving as the last step:
   - Verify all acceptance criteria across all phases are met
   - Create archive directory if it doesn't exist: `mkdir -p docs/planner+tracker/archived/[MM-DD-YY]/`
   - Move both files to archive:
     - `mv docs/planner+tracker/[DOMAIN]_ROADMAP.md docs/planner+tracker/archived/[MM-DD-YY]/`
     - `mv docs/planner+tracker/[DOMAIN]_ROADMAP_PROGRESS.md docs/planner+tracker/archived/[MM-DD-YY]/`
   - Use completion date in `MM-DD-YY` format (e.g., `02-03-26` for February 3, 2026)
```

---

## Output Format

Present the plan in this structure:

```markdown
## Phase N: [Phase Name] - Implementation Plan

### Overview
Brief summary of what this phase accomplishes.

### Pre-Implementation
- [ ] Verify prerequisites are met
- [ ] Confirm understanding of existing code

### Implementation Steps

#### Step 1: [Description]
**Files involved:** `path/to/file.ts`
**What to do:** Detailed instructions...

#### Step 2: [Description]
...

### Verification
- [ ] `npm run type-check` passes
- [ ] [Other verification commands from acceptance criteria]

### Update Planning Documents
- [ ] Mark tasks complete in `[DOMAIN]_ROADMAP_PROGRESS.md`
- [ ] Update acceptance criteria in `[DOMAIN]_ROADMAP.md`
- [ ] Update `Last updated` date

### Archive (FINAL PHASE ONLY)
- [ ] Create archive directory: `mkdir -p docs/planner+tracker/archived/[MM-DD-YY]/`
- [ ] Move `[DOMAIN]_ROADMAP.md` to archive
- [ ] Move `[DOMAIN]_ROADMAP_PROGRESS.md` to archive

### Success Criteria
[Copy from roadmap's acceptance criteria for this phase]
```

---

## Notes

- If the roadmap doesn't have enough detail for a phase, ask clarifying questions before planning
- If implementation reveals the phase scope was wrong, note adjustments to make in the roadmap
- Cross-reference with cursor rules in `.cursor/rules/` for project-specific conventions
