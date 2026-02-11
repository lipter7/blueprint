<purpose>
Display the complete Blueprint command reference. Output ONLY the reference content. Do NOT add project-specific analysis, git status, next-step suggestions, or any commentary beyond the reference.
</purpose>

<reference>
# Blueprint Command Reference

**Blueprint** (Blueprint) creates hierarchical project plans optimized for solo agentic development with Claude Code.

## Quick Start

1. `/bp:new-project` - Initialize project (includes research, requirements, roadmap)
2. `/bp:plan-phase 1` - Create detailed plan for first phase
3. `/bp:execute-phase 1` - Execute the phase

## Staying Updated

Blueprint evolves fast. Update periodically:

```bash
npx @lipter7/blueprint@latest
```

## Core Workflow

```
/bp:new-project → /bp:plan-phase → /bp:execute-phase → repeat
```

### Project Initialization

**`/bp:new-project`**
Initialize new project through unified flow.

One command takes you from idea to ready-for-planning:
- Deep questioning to understand what you're building
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with v1/v2/out-of-scope scoping
- Roadmap creation with phase breakdown and success criteria

Creates all `.blueprint/` artifacts:
- `PROJECT.md` — vision and requirements
- `config.json` — workflow mode (interactive/yolo)
- `research/` — domain research (if selected)
- `REQUIREMENTS.md` — scoped requirements with REQ-IDs
- `ROADMAP.md` — phases mapped to requirements
- `STATE.md` — project memory

Usage: `/bp:new-project`

**`/bp:map-codebase`**
Map an existing codebase for brownfield projects.

- Analyzes codebase with parallel Explore agents
- Creates `.blueprint/codebase/` with 7 focused documents
- Covers stack, architecture, structure, conventions, testing, integrations, concerns
- Use before `/bp:new-project` on existing codebases

Usage: `/bp:map-codebase`

### Phase Planning

**`/bp:discuss-phase <number>`**
Help articulate your vision for a phase before planning.

- Captures how you imagine this phase working
- Creates CONTEXT.md with your vision, essentials, and boundaries
- Use when you have ideas about how something should look/feel

Usage: `/bp:discuss-phase 2`

**`/bp:research-phase <number>`**
Comprehensive ecosystem research for niche/complex domains.

- Discovers standard stack, architecture patterns, pitfalls
- Creates RESEARCH.md with "how experts build this" knowledge
- Use for 3D, games, audio, shaders, ML, and other specialized domains
- Goes beyond "which library" to ecosystem knowledge

Usage: `/bp:research-phase 3`

**`/bp:list-phase-assumptions <number>`**
See what Claude is planning to do before it starts.

- Shows Claude's intended approach for a phase
- Lets you course-correct if Claude misunderstood your vision
- No files created - conversational output only

Usage: `/bp:list-phase-assumptions 3`

**`/bp:plan-phase <number>`**
Create detailed execution plan for a specific phase.

- Generates `.blueprint/phases/XX-phase-name/XX-YY-PLAN.md`
- Breaks phase into concrete, actionable tasks
- Includes verification criteria and success measures
- Multiple plans per phase supported (XX-01, XX-02, etc.)

Usage: `/bp:plan-phase 1`
Result: Creates `.blueprint/phases/01-foundation/01-01-PLAN.md`

### Execution

**`/bp:execute-phase <phase-number>`**
Execute all plans in a phase.

- Groups plans by wave (from frontmatter), executes waves sequentially
- Plans within each wave run in parallel via Task tool
- Verifies phase goal after all plans complete
- Updates REQUIREMENTS.md, ROADMAP.md, STATE.md

Usage: `/bp:execute-phase 5`

### Quick Mode

**`/bp:quick`**
Execute small, ad-hoc tasks with Blueprint guarantees but skip optional agents.

Quick mode uses the same system with a shorter path:
- Spawns planner + executor (skips researcher, checker, verifier)
- Quick tasks live in `.blueprint/quick/` separate from planned phases
- Updates STATE.md tracking (not ROADMAP.md)

Use when you know exactly what to do and the task is small enough to not need research or verification.

Usage: `/bp:quick`
Result: Creates `.blueprint/quick/NNN-slug/PLAN.md`, `.blueprint/quick/NNN-slug/SUMMARY.md`

### Roadmap Management

**`/bp:add-phase <description>`**
Add new phase to end of current milestone.

- Appends to ROADMAP.md
- Uses next sequential number
- Updates phase directory structure

Usage: `/bp:add-phase "Add admin dashboard"`

**`/bp:insert-phase <after> <description>`**
Insert urgent work as decimal phase between existing phases.

- Creates intermediate phase (e.g., 7.1 between 7 and 8)
- Useful for discovered work that must happen mid-milestone
- Maintains phase ordering

Usage: `/bp:insert-phase 7 "Fix critical auth bug"`
Result: Creates Phase 7.1

**`/bp:remove-phase <number>`**
Remove a future phase and renumber subsequent phases.

- Deletes phase directory and all references
- Renumbers all subsequent phases to close the gap
- Only works on future (unstarted) phases
- Git commit preserves historical record

Usage: `/bp:remove-phase 17`
Result: Phase 17 deleted, phases 18-20 become 17-19

### Milestone Management

**`/bp:new-milestone <name>`**
Start a new milestone through unified flow.

- Deep questioning to understand what you're building next
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with scoping
- Roadmap creation with phase breakdown

Mirrors `/bp:new-project` flow for brownfield projects (existing PROJECT.md).

Usage: `/bp:new-milestone "v2.0 Features"`

**`/bp:complete-milestone <version>`**
Archive completed milestone and prepare for next version.

- Creates MILESTONES.md entry with stats
- Archives full details to milestones/ directory
- Creates git tag for the release
- Prepares workspace for next version

Usage: `/bp:complete-milestone 1.0.0`

### Progress Tracking

**`/bp:progress`**
Check project status and intelligently route to next action.

- Shows visual progress bar and completion percentage
- Summarizes recent work from SUMMARY files
- Displays current position and what's next
- Lists key decisions and open issues
- Offers to execute next plan or create it if missing
- Detects 100% milestone completion

Usage: `/bp:progress`

### Session Management

**`/bp:resume-work`**
Resume work from previous session with full context restoration.

- Reads STATE.md for project context
- Shows current position and recent progress
- Offers next actions based on project state

Usage: `/bp:resume-work`

**`/bp:pause-work`**
Create context handoff when pausing work mid-phase.

- Creates .continue-here file with current state
- Updates STATE.md session continuity section
- Captures in-progress work context

Usage: `/bp:pause-work`

### Debugging

**`/bp:debug [issue description]`**
Systematic debugging with persistent state across context resets.

- Gathers symptoms through adaptive questioning
- Creates `.blueprint/debug/[slug].md` to track investigation
- Investigates using scientific method (evidence → hypothesis → test)
- Survives `/clear` — run `/bp:debug` with no args to resume
- Archives resolved issues to `.blueprint/debug/resolved/`

Usage: `/bp:debug "login button doesn't work"`
Usage: `/bp:debug` (resume active session)

### Todo Management

**`/bp:add-todo [description]`**
Capture idea or task as todo from current conversation.

- Extracts context from conversation (or uses provided description)
- Creates structured todo file in `.blueprint/todos/pending/`
- Infers area from file paths for grouping
- Checks for duplicates before creating
- Updates STATE.md todo count

Usage: `/bp:add-todo` (infers from conversation)
Usage: `/bp:add-todo Add auth token refresh`

**`/bp:check-todos [area]`**
List pending todos and select one to work on.

- Lists all pending todos with title, area, age
- Optional area filter (e.g., `/bp:check-todos api`)
- Loads full context for selected todo
- Routes to appropriate action (work now, add to phase, brainstorm)
- Moves todo to done/ when work begins

Usage: `/bp:check-todos`
Usage: `/bp:check-todos api`

### User Acceptance Testing

**`/bp:verify-work [phase]`**
Validate built features through conversational UAT.

- Extracts testable deliverables from SUMMARY.md files
- Presents tests one at a time (yes/no responses)
- Automatically diagnoses failures and creates fix plans
- Ready for re-execution if issues found

Usage: `/bp:verify-work 3`

### Milestone Auditing

**`/bp:audit-milestone [version]`**
Audit milestone completion against original intent.

- Reads all phase VERIFICATION.md files
- Checks requirements coverage
- Spawns integration checker for cross-phase wiring
- Creates MILESTONE-AUDIT.md with gaps and tech debt

Usage: `/bp:audit-milestone`

**`/bp:plan-milestone-gaps`**
Create phases to close gaps identified by audit.

- Reads MILESTONE-AUDIT.md and groups gaps into phases
- Prioritizes by requirement priority (must/should/nice)
- Adds gap closure phases to ROADMAP.md
- Ready for `/bp:plan-phase` on new phases

Usage: `/bp:plan-milestone-gaps`

### Configuration

**`/bp:settings`**
Configure workflow toggles and model profile interactively.

- Toggle researcher, plan checker, verifier agents
- Select model profile (quality/balanced/budget)
- Updates `.blueprint/config.json`

Usage: `/bp:settings`

**`/bp:set-profile <profile>`**
Quick switch model profile for Blueprint agents.

- `quality` — Opus everywhere except verification
- `balanced` — Opus for planning, Sonnet for execution (default)
- `budget` — Sonnet for writing, Haiku for research/verification

Usage: `/bp:set-profile budget`

### Utility Commands

**`/bp:help`**
Show this command reference.

**`/bp:update`**
Update Blueprint to latest version with changelog preview.

- Shows installed vs latest version comparison
- Displays changelog entries for versions you've missed
- Highlights breaking changes
- Confirms before running install
- Better than raw `npx @lipter7/blueprint`

Usage: `/bp:update`

**`/bp:join-discord`**
Join the Blueprint Discord community.

- Get help, share what you're building, stay updated
- Connect with other Blueprint users

Usage: `/bp:join-discord`

## Files & Structure

```
.blueprint/
├── PROJECT.md            # Project vision
├── ROADMAP.md            # Current phase breakdown
├── STATE.md              # Project memory & context
├── config.json           # Workflow mode & gates
├── todos/                # Captured ideas and tasks
│   ├── pending/          # Todos waiting to be worked on
│   └── done/             # Completed todos
├── debug/                # Active debug sessions
│   └── resolved/         # Archived resolved issues
├── codebase/             # Codebase map (brownfield projects)
│   ├── STACK.md          # Languages, frameworks, dependencies
│   ├── ARCHITECTURE.md   # Patterns, layers, data flow
│   ├── STRUCTURE.md      # Directory layout, key files
│   ├── CONVENTIONS.md    # Coding standards, naming
│   ├── TESTING.md        # Test setup, patterns
│   ├── INTEGRATIONS.md   # External services, APIs
│   └── CONCERNS.md       # Tech debt, known issues
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## Workflow Modes

Set during `/bp:new-project`:

**Interactive Mode**

- Confirms each major decision
- Pauses at checkpoints for approval
- More guidance throughout

**YOLO Mode**

- Auto-approves most decisions
- Executes plans without confirmation
- Only stops for critical checkpoints

Change anytime by editing `.blueprint/config.json`

## Planning Configuration

Configure how planning artifacts are managed in `.blueprint/config.json`:

**`planning.commit_docs`** (default: `true`)
- `true`: Planning artifacts committed to git (standard workflow)
- `false`: Planning artifacts kept local-only, not committed

When `commit_docs: false`:
- Add `.blueprint/` to your `.gitignore`
- Useful for OSS contributions, client projects, or keeping planning private
- All planning files still work normally, just not tracked in git

**`planning.search_gitignored`** (default: `false`)
- `true`: Add `--no-ignore` to broad ripgrep searches
- Only needed when `.blueprint/` is gitignored and you want project-wide searches to include it

Example config:
```json
{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}
```

## Common Workflows

**Starting a new project:**

```
/bp:new-project        # Unified flow: questioning → research → requirements → roadmap
/clear
/bp:plan-phase 1       # Create plans for first phase
/clear
/bp:execute-phase 1    # Execute all plans in phase
```

**Resuming work after a break:**

```
/bp:progress  # See where you left off and continue
```

**Adding urgent mid-milestone work:**

```
/bp:insert-phase 5 "Critical security fix"
/bp:plan-phase 5.1
/bp:execute-phase 5.1
```

**Completing a milestone:**

```
/bp:complete-milestone 1.0.0
/clear
/bp:new-milestone  # Start next milestone (questioning → research → requirements → roadmap)
```

**Capturing ideas during work:**

```
/bp:add-todo                    # Capture from conversation context
/bp:add-todo Fix modal z-index  # Capture with explicit description
/bp:check-todos                 # Review and work on todos
/bp:check-todos api             # Filter by area
```

**Debugging an issue:**

```
/bp:debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/clear
/bp:debug                                    # Resume from where you left off
```

## Getting Help

- Read `.blueprint/PROJECT.md` for project vision
- Read `.blueprint/STATE.md` for current context
- Check `.blueprint/ROADMAP.md` for phase status
- Run `/bp:progress` to check where you're up to
</reference>
