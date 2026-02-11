# Blueprint: North Star

## What Blueprint Is

Blueprint is a context engineering framework for AI-assisted development. It structures complex projects into a Plan/Execute/Verify lifecycle where specialized agents get fresh context windows for each step, communicating through markdown artifacts in a `.blueprint/` directory.

It is a fork of the GET SHIT DONE (GSD) framework. GSD got the architecture right -- XML-structured prompts, multi-agent orchestration, document-driven state, goal-backward verification. What it got wrong was treating the human as a passenger. Blueprint fixes that.

---

## The Core Problem We're Solving

GSD automates too aggressively during the phases that matter most:

**Research** -- GSD spawns 4 parallel research agents that run unsupervised and produce a synthesis document the user never shaped. The user's first real input on research findings comes after they're already baked into requirements.

**Codebase mapping** -- Runs once, produces 7 static documents, and never updates. By phase 3 of a project, the codebase analysis is stale because the project has evolved. There's no mechanism to detect drift or trigger a remap.

**Requirements and roadmapping** -- GSD asks a few rounds of questions, then hands everything to a roadmapper agent that produces the complete phase structure. The user approves or rejects the whole thing, but has limited ability to shape it incrementally.

**Phase planning** -- A planner agent produces the implementation plan with minimal user input beyond what's in CONTEXT.md. The user reviews the finished plan but doesn't co-create it.

These are the highest-leverage moments in a project -- the ones where wrong decisions compound. Blueprint puts the human in the loop at every one of them.

---

## Design Principles

### 1. The Human Co-Creates, Not Just Approves

The difference between "here's the plan, approve it?" and "let's build this plan together" is the difference between a rubber stamp and actual alignment. Blueprint's commands are conversational where it matters -- research, requirements, roadmapping, and planning all involve iterative back-and-forth, not batch-and-review.

**What this means concretely:**
- Research presents findings incrementally and asks "does this match your understanding?" before moving on
- Requirements are built through dialogue, not generated from a synthesis doc
- Roadmap phases are proposed one at a time with the user shaping scope and ordering
- Plans surface key decisions during creation, not after

### 2. Preserve What Works

GSD's architecture is sound. Blueprint keeps:

- **XML-structured prompts** -- `<role>`, `<process>`, `<critical_rules>`, `<success_criteria>`, `<anti_patterns>`. These create clear sections that LLMs parse reliably
- **Fresh-context subagents** -- Heavy work happens in isolated 200k-token windows. The orchestrator stays lean
- **Document-driven state** -- `.blueprint/` markdown files are the system. No databases, no hidden state. Everything is human-readable, git-trackable, and survives context resets
- **Goal-backward verification** -- "What must be TRUE?" drives verification, not "were tasks completed?"
- **Downstream consumer documentation** -- Every agent knows who reads its output and why quality matters
- **Anti-pattern documentation** -- Explicit "what NOT to do" prevents prompt drift
- **Atomic commits per task** -- Clean git history with traceable changes
- **Deviation rules** -- Executors have clear authority boundaries (auto-fix bugs, escalate architecture changes)
- **Forbidden files** -- Never read `.env`, credentials, keys, secrets

### 3. Codebase Awareness Is Living, Not Static

Codebase mapping shouldn't be a one-shot operation. Blueprint treats codebase analysis as a living layer:

- Detect when codebase docs are stale (significant changes since last mapping)
- Offer targeted remapping (only re-analyze what changed, not the whole codebase)
- Surface staleness warnings when planning against outdated codebase docs

### 4. Multi-Runtime From Day One

Blueprint works with both Cursor and Claude Code. The source of truth is one set of command and agent files. An installer handles the format differences between runtimes:

- **Cursor** -- Commands in `.cursor/commands/`, agents in `.cursor/agents/`, rules in `.cursor/rules/`
- **Claude Code** -- Commands in `.claude/commands/bp/`, agents in `.claude/agents/`, guidance in `CLAUDE.md`

The prompt content is identical. Only frontmatter and file paths differ.

---

## What Changes From GSD

### Renaming

Everything with `gsd-`, `GSD`, or `Get Shit Done` becomes `blueprint` or `bp`. This includes:
- All file names (agents, commands, workflows, references, templates)
- All internal references within prompts
- The `.planning/` directory becomes `.blueprint/`
- The `/gsd:` command prefix becomes runtime-appropriate (`/01-map-codebase` for Cursor, `/bp:01-map-codebase` for Claude Code)
- The npm package name
- All branding and documentation

### User Interaction Model

| Stage | GSD Behavior | Blueprint Behavior |
|-------|-------------|-------------------|
| **Codebase mapping** | Runs 4 agents, returns results | Same (mapping doesn't need user input) + staleness detection |
| **Research** | 4 parallel agents -> synthesis -> user sees final | Iterative: present findings per topic, user validates/redirects before next |
| **Requirements** | Questions -> auto-generate from research | Collaborative: build requirements through dialogue, user shapes each one |
| **Roadmapping** | Agent produces full roadmap -> approve/reject | Incremental: propose phases one at a time, user shapes scope and order |
| **Phase discussion** | Multi-select areas -> deep dive | Similar, but with more structured decision capture |
| **Phase planning** | Agent produces plan -> user reviews | Co-creation: surface key architectural decisions during planning, not after |
| **Execution** | Subagent runs plan autonomously | Same (execution is where autonomy is appropriate) |
| **Verification** | Goal-backward check | Same |

### Codebase Staleness Detection

New capability not in GSD:
- Track when codebase mapping was last run (timestamp in config or codebase docs)
- Before planning, compare git diff stats since last mapping against a threshold
- If significant changes detected, warn the user and offer targeted remap
- Support partial remap (only re-run the mapper focus areas affected by changes)

### Command Set Reduction

GSD has 29 commands. Blueprint targets approximately 8-10 core commands covering the essential lifecycle. The exact count will be determined during detailed planning, but the principle is: cut ceremony, keep substance. Commands that duplicate built-in IDE features (debug, todos, pause/resume) are dropped. Milestone management becomes direct file editing.

### Infrastructure Simplification

GSD's `gsd-tools.js` (4,597 lines, ~60 subcommands) is a monolith that handles state management, phase operations, verification, frontmatter CRUD, template filling, and git integration. Blueprint needs to determine what subset of this functionality is actually required and what can be replaced by agents reading/writing files directly or by simpler utilities.

---

## The Lifecycle

The core workflow Blueprint preserves from GSD, with enhanced interaction:

```
Map Codebase (optional, brownfield)
        |
        v
Init Project (collaborative requirements + roadmap building)
        |
        v
  +---> Discuss Phase N (capture implementation decisions)
  |         |
  |         v
  |     Plan Phase N (co-create implementation plan)
  |         |
  |         v
  |     Execute Phase N (subagent runs plan in fresh context)
  |         |
  |         v
  |     Verify Phase N (goal-backward verification)
  |         |
  |     [staleness check -- offer remap if needed]
  |         |
  +----< Next phase
```

---

## What Success Looks Like

1. A user initializing a complex project feels like they're having a conversation with an architect, not watching an automation pipeline produce documents they'll need to review and fix

2. When a plan misaligns with the user's intent, it's caught during creation -- not after execution

3. Codebase analysis stays relevant throughout a multi-phase project, not just at the start

4. The system works identically on Cursor and Claude Code, with installation being the only difference

5. The prompt engineering quality (XML structure, downstream consumers, anti-patterns, goal-backward verification) is preserved or improved from GSD

6. A developer familiar with GSD can understand Blueprint immediately -- it's the same architecture with better human interaction, not a different system
