# Blueprint: Research Planner

What needs to be investigated and understood before we can create a comprehensive, phased implementation plan.

---

## Area 1: Interaction Model Design

The single most important area to get right. We're adding human-in-the-loop to stages that GSD runs autonomously. We need to design exactly what that looks like.

### Questions to Answer

**Research stage interaction:**
- How should research findings be presented for user validation? Per-topic (stack, architecture, pitfalls, features) with approve/redirect, or a more granular per-finding model?
- Should the user be able to inject their own knowledge during research ("actually, we tried X and it failed because Y")?
- How do we handle the case where the user doesn't know enough to validate research findings? (e.g., researching an unfamiliar stack)
- What's the right balance between "show me everything" and "only surface what needs my input"?

**Requirements building interaction:**
- GSD presents features by category and the user scopes v1/v2/out-of-scope. Should Blueprint build requirements more conversationally (one at a time, or small groups)?
- How do we handle requirement dependencies that the user might not see? (e.g., "you need auth before you can build the admin panel")
- Should the agent propose requirements and the user accepts/modifies/rejects, or should the user describe what they want and the agent structures it?

**Roadmap building interaction:**
- GSD's roadmapper produces the entire phase structure at once. Should Blueprint propose phases incrementally?
- How does the user communicate ordering preferences? ("I want to see something working quickly" vs "I want the foundation solid before anything visible")
- What's the interaction model for phase scope? Can the user split/merge phases during creation?

**Planning interaction:**
- GSD's planner produces the full plan and the user reviews it. Where should checkpoints go during plan creation?
- Should the planner surface architectural decisions as it encounters them ("I'm about to plan task 3, which involves choosing between approach A and B -- which do you prefer?")?
- How do we avoid over-interrupting? Not every task in a plan needs user input. What heuristics determine when to check in vs proceed autonomously?

### What to Investigate
- Review GSD's `references/questioning.md` for existing questioning patterns
- Review GSD's `commands/gsd/discuss-phase.md` for the current interactive model (it's the most interactive GSD command)
- Review GSD's `commands/gsd/new-project.md` for the questioning flow during project init
- Study how the `gates` config works in GSD -- this is the existing mechanism for controlling interaction points
- Look at GSD's checkpoint protocol (`references/checkpoints.md`) for the existing human-verify pattern

### Deliverable
A concrete interaction specification for each stage: what gets presented, what choices the user has, when the agent proceeds autonomously, and how the user's input flows into the output artifacts.

---

## Area 2: Agent Architecture

GSD has 11 agents. The existing phase docs proposed cutting to 4. We need to validate that number and determine the right set.

### Questions to Answer

**Which agents are still needed?**
- GSD's 11: planner, executor, verifier, debugger, codebase-mapper, project-researcher (x4 focus areas but 1 agent def), research-synthesizer, roadmapper, plan-checker, phase-researcher, integration-checker
- The existing phase docs proposed 4: codebase-mapper, phase-executor, phase-verifier, integration-checker
- But if we're adding more interaction to research/planning/roadmapping, do those need dedicated agents or do they run inline in the command?
- Key question: what work is heavy enough to justify a fresh 200k-token context window vs what should run in the parent context?

**Agent responsibility boundaries with more user interaction:**
- If planning becomes interactive (user co-creates), does the planner agent still make sense as a subagent? Or does planning happen in the command context with the user?
- Same question for roadmapping -- if it's incremental/conversational, should it be a subagent or inline?
- Research might still benefit from subagents (heavy codebase exploration), but the synthesis step might need to be inline so the user can guide it

**The gsd-tools.js question:**
- GSD's central CLI utility provides ~60 subcommands for state management, phase ops, verification, frontmatter CRUD, template filling
- Which of these capabilities does Blueprint actually need?
- Can agents read/write files directly for most things, with a much smaller utility for the genuinely complex operations (like verifying plan structure, managing frontmatter)?
- Or is the monolith actually a strength (single call pre-computes all context) that we should preserve and adapt?

### What to Investigate
- Read each of the 11 GSD agent definitions to understand what they actually do and how much context they consume
- Identify which agents are spawned for heavy codebase exploration (need fresh context) vs which do light work (could run inline)
- Map out which `gsd-tools.js` commands are called by which agents -- this determines what we can cut
- Look at the `init` compound commands in `gsd-tools.js` -- these pre-compute context in single calls and might be worth preserving in some form
- Determine if Cursor's subagent system has any limitations we need to account for (max concurrent, context window sharing, etc.)

### Deliverable
A validated agent roster with clear justification for each agent's existence (or removal), responsibility boundaries, and a decision on the gsd-tools.js situation.

---

## Area 3: Codebase Staleness Detection

New capability. Needs design from scratch.

### Questions to Answer

**Detection mechanism:**
- What signals indicate stale codebase docs? Git diff line counts since last mapping? New files in key directories? Changed imports/exports?
- What threshold makes sense? (100 lines changed? 10 files? Any changes to package.json/config files?)
- Should staleness be per-document (STACK.md might be stale while CONVENTIONS.md is fine) or global (any significant change = full remap warning)?

**Trigger points:**
- When should staleness be checked? Before every plan-phase? Only when explicitly asked? On a schedule?
- Should it be passive (warn the user) or active (auto-remap)?

**Partial remapping:**
- Can we remap only affected focus areas (tech, arch, quality, concerns)?
- How do we determine which focus area is affected by which changes? (e.g., new dependencies = tech focus, new directory = arch focus)
- Should partial remap produce diffs or full document replacements?

**Tracking:**
- Where does the "last mapped at" timestamp live? In config.json? In each codebase doc's frontmatter? In a separate metadata file?
- Should we track the git commit hash at time of mapping for precise diff calculation?

### What to Investigate
- Look at how GSD's codebase mapper currently works (what it reads, what it produces, how it explores)
- Determine if git diff stats are sufficient for staleness detection or if we need something more semantic
- Research whether partial codebase remapping is practical (can a mapper run against a subset of the codebase meaningfully?)

### Deliverable
A staleness detection design: what triggers it, what signals it uses, where state is tracked, and how partial remapping works (or a decision that it's always full remap with a "things have changed" warning).

---

## Area 4: Cursor and Claude Code Runtime Compatibility

The installer needs to handle both runtimes. We need to understand the actual constraints.

### Questions to Answer

**Cursor primitives:**
- What are the exact format requirements for `.cursor/commands/` files? Frontmatter fields? Body format?
- What are the exact format requirements for `.cursor/agents/` files? Frontmatter fields? How are they spawned?
- What are the exact format requirements for `.cursor/rules/` files? The `.mdc` extension -- what does Cursor expect?
- Does Cursor support the `Task` tool for spawning subagents from commands? If not, what's the equivalent?
- How does `$ARGUMENTS` work in Cursor commands? Is it passed as a variable, or is it part of the prompt?

**Claude Code primitives:**
- Claude Code commands live in `.claude/commands/`. Frontmatter: `allowed-tools`, `description`, `name`. How does argument passing work (`$ARGUMENTS`)?
- Claude Code agents live in `.claude/agents/`. Frontmatter: `name`, `description`, `tools`, `color`. How are they spawned from commands?
- Claude Code has no rules system -- `CLAUDE.md` serves this purpose. What's the best way to inject workflow guidance?

**Cross-runtime command identity:**
- Cursor commands: `/01-map-codebase` (from filename)
- Claude Code commands: `/bp:01-map-codebase` (from `commands/bp/` directory)
- Are the prompt bodies truly identical or do tool names differ? (Cursor: `Shell`, Claude Code: `Bash`? Cursor: `StrReplace`, Claude Code: `Edit`?)
- If tool names differ, does the installer need to do search-and-replace in prompt bodies?

**Spawning subagents:**
- In Claude Code, the `Task` tool spawns agents with `subagent_type` matching the agent filename. How does this work in Cursor?
- Can Cursor commands reference agents by name for spawning?
- If spawning mechanisms differ, how much of the command body needs to change per runtime?

### What to Investigate
- Read Cursor documentation on commands, agents, and rules formats
- Read Claude Code documentation on commands, agents, and CLAUDE.md
- Test both runtimes with simple command + agent pairs to understand actual behavior
- Determine the exact tool name mapping between runtimes
- Understand if GSD's existing installer (`bin/install.js`) has solved any of these problems already and what we can learn from it

### Deliverable
A runtime compatibility matrix: what's identical, what needs conversion, what the installer must handle, and any hard constraints that affect command/agent design.

---

## Area 4a: AskUserQuestion → AskQuestion Conversion Audit

**Depends on:** Area 4 (runtime compatibility decisions)
**Parent result:** `research-results/item-4.md`, Decision #4

Area 4 established that `AskUserQuestion` references must be converted to explicit `AskQuestion` tool instructions for Cursor. But the conversion cannot be a generic boilerplate injection -- each usage serves a specific purpose in a specific workflow. This sub-research audits every usage to design context-appropriate conversions.

### Questions to Answer

- Where exactly does `AskUserQuestion` appear in the current system? (frontmatter `allowed-tools`, inline prompt references, workflow instructions, agent prompts)
- For each occurrence, what is the *specific interaction* it enables? (e.g., "ask user to select research focus areas", "confirm roadmap phase ordering", "checkpoint:decision gate")
- What information does each `AskUserQuestion` call need to present to the user? (options, context, what happens with the response)
- What is the minimum instruction pattern that reliably makes Cursor's agent use `AskQuestion` in each context?
- Can a reusable pattern template cover most cases, or does each context need bespoke instructions?

### What to Investigate

- `grep -r "AskUserQuestion" agents/ commands/ get-shit-done/` to find every occurrence
- For each file containing `AskUserQuestion`, read the surrounding context to understand the workflow purpose
- Review `get-shit-done/workflows/*.md` for workflow steps that involve user interaction
- Review `get-shit-done/references/checkpoints.md` for the checkpoint protocol (which likely drives many `AskUserQuestion` calls)
- Review `get-shit-done/references/questioning.md` for existing questioning patterns
- Check whether `AskUserQuestion` is used differently in commands vs agents vs workflows (frontmatter declaration vs inline instruction)

### Deliverable

A complete audit table: every file containing `AskUserQuestion`, what the interaction does, and a designed `AskQuestion` instruction pattern for the Cursor conversion. This becomes the specification for the installer's `convertClaudeToCursorSkill()` and `convertClaudeToCursorAgent()` functions.

---

## Area 4b: Cursor Skills Invocation Model (`disable-model-invocation`)

**Depends on:** Area 4 (runtime compatibility decisions)
**Parent result:** `research-results/item-4.md`, Decision #2

Area 4 decided Blueprint commands become Cursor Skills. But should all skills use `disable-model-invocation: true` (explicit `/name` invocation only) or should some allow Cursor's agent to auto-invoke them based on context?

### Questions to Answer

- Can Blueprint commands/skills benefit from auto-invocation? For example, if a user says "let's plan phase 3", could Cursor auto-invoke the `bp-plan-phase` skill without the user typing `/bp-plan-phase`?
- Is there a risk of unwanted auto-invocation? Could Cursor incorrectly decide to invoke a Blueprint skill during unrelated work?
- Do any Blueprint workflows depend on commands invoking other commands? If so, `disable-model-invocation: true` would break that chain.
- How does Cursor's agent decide when a skill is relevant? Does it use just the `description` field, or does it also parse the skill body?
- What is the actual user experience difference between explicit and auto-invocable skills in Cursor's UI?

### What to Investigate

- Read Cursor docs on `disable-model-invocation` behavior and how the agent decides skill relevance
- Check whether any GSD commands reference or invoke other commands (e.g., does `execute-phase` suggest running `verify-work` afterward?)
- Review the GSD workflow files in `get-shit-done/workflows/` for cross-command references
- Test in Cursor: create a simple skill with and without `disable-model-invocation` and observe when/how it gets invoked

### Deliverable

A decision on the `disable-model-invocation` default for Blueprint skills, with justification. May result in a split: some skills always explicit, others auto-invocable.

---

## Area 5: Scope and Command Set Validation

The existing phase docs proposed 8 commands (6 core + 2 utility). We need to validate this against the enhanced interaction model.

### Questions to Answer

**Does the interaction model change the command set?**
- If research becomes interactive, does it need its own command instead of being folded into init-project?
- If roadmapping becomes incremental, does it need a separate command or is it part of init-project?
- Should "remap codebase" (staleness-triggered) be a separate command or a flag on map-codebase?

**What about the commands we cut?**
- GSD's `resume-work` / `pause-work` -- Cursor has session resume, but Claude Code doesn't. Do we need these for Claude Code compatibility?
- GSD's `debug` -- Cursor has Debug Mode, but Claude Code uses a debugger agent. Do we need this?
- GSD's `add-phase` / `insert-phase` / `remove-phase` -- direct ROADMAP.md editing is simpler, but is it actually simpler for the user?
- GSD's milestone commands -- are milestones genuinely unnecessary, or do long-running projects need some form of "checkpoint the project state"?

**Command naming:**
- Numbered prefixes (01-06) ensure sort order in Cursor's palette. But they're awkward in Claude Code (`/bp:01-map-codebase`). Is there a better approach?
- Should utility commands also be numbered for consistency?

**What about settings/configuration?**
- GSD has a settings command and config.json with gates, profiles, toggles. Blueprint needs some configuration (at minimum: interaction depth, model preferences). How should this work?
- Should there be a setup/config command, or is editing config.json directly sufficient?

### What to Investigate
- Map out every GSD command and its actual usage frequency / importance
- Determine which commands are "must have" vs "nice to have" vs "actively harmful ceremony"
- Test the numbered naming convention in both Cursor and Claude Code
- Determine if any GSD capabilities (like the deviation rules, checkpoint protocol, wave-based execution) require dedicated commands or infrastructure we haven't accounted for

### Deliverable
A validated command set with names, a clear rationale for each inclusion/exclusion, and identification of any new commands the enhanced interaction model requires.

---

## Area 6: Template and Artifact Design

The `.blueprint/` directory structure and the templates that scaffold it.

### Questions to Answer

**Does enhanced interaction change what artifacts are produced?**
- If research is interactive, is there still a synthesis document? Or do the research artifacts look different (e.g., a conversation log + distilled findings)?
- If roadmapping is incremental, does ROADMAP.md get built progressively or produced in one shot?
- Does the interaction model produce new artifact types? (e.g., a decision log separate from CONTEXT.md?)

**Template simplification:**
- GSD has 34 templates (22 root + 7 codebase + 5 research). How many does Blueprint need?
- The existing phase docs proposed cutting to ~17 (10 root + 7 codebase). Is this the right number?
- GSD has 4 summary variants (canonical + 3 instantiation). Blueprint proposed 1. Is one enough?

**The STATE.md question:**
- GSD's STATE.md is a living document updated throughout the lifecycle. It's also the first file read by every command.
- The existing phase docs proposed keeping it under 100 lines. Is that achievable?
- What must STATE.md contain for the system to work? (Current phase, accumulated decisions, blockers -- what else?)

**PROGRESS.md vs STATE.md:**
- The existing phase docs added PROGRESS.md (a lightweight checklist). Is this needed alongside STATE.md, or does it create confusion about what's the "source of truth" for progress?
- GSD tracks progress in ROADMAP.md (status column) + STATE.md (current position). Adding PROGRESS.md makes it three places. Too many?

### What to Investigate
- Inventory every artifact GSD produces and which agents produce/consume each one
- Determine the minimum set of artifacts needed for the Plan/Execute/Verify lifecycle with enhanced interaction
- Review GSD's template structures to determine which patterns to preserve and which to simplify
- Decide on the PROGRESS.md vs ROADMAP.md progress tracking question

### Deliverable
A complete artifact specification: every file in `.blueprint/`, what template produces it, what creates it, what consumes it, and what's changed from GSD.

---

## Area 7: Migration and Coexistence Strategy

How does Blueprint relate to the existing GSD installation? How do we handle the transition?

### Questions to Answer

**Coexistence:**
- Can Blueprint and GSD be installed on the same system simultaneously? (Different paths: `.blueprint/` vs `.planning/`, different command prefixes)
- Can a user migrate a GSD project to Blueprint? Should we support this?
- What about the npm package? Different name (`blueprint-dev` vs `get-shit-done-cc`)?

**The existing repo:**
- The repo currently contains the full GSD codebase. When do we delete the old files?
- Do we maintain backward compatibility with GSD during development, or do we cut over?
- Should the repo be the same repo (fork) or a new repo?

**Documentation:**
- What docs from GSD are worth preserving? The system map (`docs/gsd-system-map/`) is excellent documentation of the original system.
- Should we keep GSD docs in an `archive/` or `reference/` directory, or remove them entirely?

### What to Investigate
- Determine the npm package name and publishing strategy
- Decide on the repo strategy (stay in fork vs new repo)
- Plan the file deletion sequence to avoid losing useful reference material prematurely

### Deliverable
A migration plan: what gets deleted when, how coexistence works, and what the publishing/distribution strategy is.

---

## Priority Order

These areas are listed roughly in dependency order for planning:

1. **Interaction Model Design** -- Everything else depends on this. The interaction model determines the agent architecture, command set, and artifact design.
2. **Agent Architecture** -- Determines what gets built and how work is distributed.
3. **Cursor and Claude Code Compatibility** -- Hard constraints that affect all implementation.
   - **4a: AskQuestion Conversion Audit** -- Depends on Area 4. Must complete before installer implementation.
   - **4b: Skills Invocation Model** -- Depends on Area 4. Must complete before installer implementation.
4. **Scope and Command Set** -- Depends on interaction model + agent architecture + runtime constraints.
5. **Template and Artifact Design** -- Depends on command set + interaction model.
6. **Codebase Staleness Detection** -- Independent feature, can be designed in parallel.
7. **Migration and Coexistence** -- Logistics, can be finalized last.

---

## How to Use This Document

Each area above defines:
- **Questions to answer** -- The unknowns that block planning
- **What to investigate** -- Specific files, docs, and tests to examine
- **Deliverable** -- What a completed investigation produces

Once all 7 areas have deliverables, we can create a comprehensive phased implementation plan with high confidence that it reflects reality and won't need major restructuring mid-execution.
