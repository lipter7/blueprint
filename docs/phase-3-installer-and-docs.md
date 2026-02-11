# Phase 3: Installer and Documentation

**Goal:** Write the multi-runtime installer and rewrite the README. This makes the framework installable and usable by others.

**Why this goes last:** The installer copies and adapts the commands/subagents from Phases 1-2. It can't be written properly until those files exist and are finalized. The README documents the finished product.

---

## Step 1: Write the Installer

Create `bin/install.js` -- a lightweight Node.js installer (much simpler than GSD's 1,740-line version).

### CLI Interface

```
npx blueprint-dev install [options]

Options:
  --cursor          Install for Cursor
  --claude          Install for Claude Code
  --all             Install for both
  --global, -g      Install globally (~/)
  --local, -l       Install locally (./)
  --uninstall, -u   Remove installed files
```

If no flags provided, prompt interactively:
1. Runtime: Cursor / Claude Code / Both
2. Scope: Global (~/) or Local (./)

### What's Shared vs Runtime-Specific

**Shared (identical files, no conversion):**

- `.blueprint/` directory and all planning documents
- Template content (structure, sections, logic)
- Command files (same YAML frontmatter format, same body -- just copied to different paths)

**Runtime-specific (adapted by installer):**

- File locations (`.cursor/` vs `.claude/`)
- Agent frontmatter (Cursor uses `model`/`readonly`/`is_background`; Claude Code uses `tools`/`color`)
- Rules location (`.cursor/rules/` vs `CLAUDE.md`)

### What the Installer Does

**For Cursor (`--cursor`):**
- Copy commands to `{target}/.cursor/commands/`
- Copy subagents to `{target}/.cursor/agents/`
- Copy rule to `{target}/.cursor/rules/`
- Copy templates to `{target}/templates/`
- No format changes needed -- source files are already in Cursor format

**For Claude Code (`--claude`):**
- Copy commands to `{target}/.claude/commands/bp/`
  - Commands are invoked as `/bp:01-map-codebase`, `/bp:02-init-project`, etc.
  - The `bp` namespace avoids conflicts with GSD's `/gsd:` namespace
  - **No file modification needed** -- command files are identical for both runtimes
- Copy subagents to `{target}/.claude/agents/`
  - **Convert agent frontmatter only** (prompt body is identical):
    - Strip Cursor-only fields: `model`, `readonly`, `is_background`
    - Add Claude Code fields: `tools` (explicit tool allowlist), `color`
  - Example conversion:
    ```yaml
    # Cursor source (in .cursor/agents/)
    ---
    name: phase-executor
    description: Executes a phase implementation plan in a fresh context
    ---

    # Converted for Claude Code (in .claude/agents/)
    ---
    name: phase-executor
    description: Executes a phase implementation plan in a fresh context
    tools: Read, Write, Edit, Bash, Grep, Glob
    color: yellow
    ---
    ```
  - Tool allowlists and colors are defined per-agent in the installer's conversion map
- Copy templates to `{target}/templates/`

**Rules handling for Claude Code:**
- Cursor uses `.cursor/rules/planning-workflow.mdc` -- a dedicated rule file with YAML frontmatter (`description`, `globs`)
- Claude Code does not have an equivalent rules system. Instead, the rule content should be appended to the project's `CLAUDE.md` file (or created if it doesn't exist)
- The installer should extract the rule content (stripping the Cursor YAML frontmatter) and write it as a section in `CLAUDE.md`

### Format Conversion Details

Commands are identical across runtimes -- no conversion needed. The installer only converts agent frontmatter and handles rules:

| What | Cursor Format | Claude Code Format | Conversion |
|------|--------------|-------------------|------------|
| Commands | YAML frontmatter + markdown body | Same | None (copy as-is) |
| Command location | `.cursor/commands/` | `.claude/commands/bp/` | Path only |
| Agent frontmatter | `name`, `description`, `model`, `readonly`, `is_background` | `name`, `description`, `tools`, `color` | Strip Cursor fields, add Claude fields |
| Agent body | Markdown prompt | Same | None |
| Rules | `.cursor/rules/planning-workflow.mdc` | `CLAUDE.md` (content appended) | Strip YAML frontmatter, append |

### Installer Implementation Notes

- Use only Node.js built-ins (`fs`, `path`, `os`, `readline`) -- no npm dependencies
- File operations should be idempotent (safe to run multiple times)
- Print clear output: what's being copied, where, any conversions applied
- Handle errors gracefully (target directory doesn't exist, permission denied, etc.)
- Uninstall should only remove files the installer created (track via a manifest or known file list)

### Keeping It Simple

GSD's installer is 1,740 lines because it handles:
- 3 runtimes (Claude, OpenCode, Gemini) with different config structures
- Hooks compilation and installation
- Version checking and updates
- Complex XDG directory resolution
- Runtime detection

Our installer should be ~200-400 lines because:
- 2 runtimes (Cursor, Claude Code) with straightforward directories
- Commands are identical -- just copy to different paths
- Agent conversion is frontmatter-only (no body/prompt changes)
- No hooks to compile
- No version checking
- Simple `~/` or `./` scope
- Explicit runtime selection (no auto-detection needed)

---

## Step 2: Rewrite README.md

Replace the current GSD README with a Blueprint-focused README.

### README Structure

```markdown
# Blueprint

A simplified planning and execution framework for AI-assisted development.
Works with Cursor and Claude Code.

## What It Does

[2-3 sentences: document-driven planning workflow, codebase analysis,
phased execution with fresh-context subagents, verification]

## Quick Start

### Install
[Installation commands for Cursor, Claude Code, both]

### Your First Project
[The 6-command workflow with 1-line descriptions]

## Commands

### Core Workflow
[Table: command, what it does, mode]

### Utilities
[Table: command, what it does, mode]

## How It Works

[Brief explanation of the workflow:
map -> init -> discuss -> plan -> execute -> verify]

[Explain the subagent model: fresh context, "+New Agent" automation]

## Storage

[Where .blueprint/ lives, what's in it]

## Differences From GSD

[Brief comparison for people familiar with GSD:
- 8 commands vs 28
- .blueprint/ vs .planning/
- Cursor-native (commands/subagents/rules) vs Claude Code-native
- Can coexist -- both installable on same system]

## Uninstall

[Uninstall command]
```

### README Guidelines

- Keep it concise -- the commands themselves are self-documenting
- No emojis in headers (keep it clean)
- Show the workflow visually (the 6-step progression)
- Include both Cursor and Claude Code installation paths
- Mention coexistence with GSD explicitly

---

## Step 3: Final Cleanup

After the installer and README are done:

- Remove `get-shit-done/` directory entirely (if any remnants from Phase 1 remain)
- Remove `README.md` backup if one was created
- Verify the complete directory structure matches the target from `00-overview.md`

---

## Checklist

- [ ] `bin/install.js` written and functional
- [ ] Installer handles `--cursor` flag (copies commands, agents, rules, templates to `.cursor/` paths)
- [ ] Installer handles `--claude` flag (copies commands as-is to `.claude/commands/bp/`, converts agent frontmatter, handles rules)
- [ ] Installer handles `--all` flag (both runtimes)
- [ ] Installer handles `--global` and `--local` scope
- [ ] Installer handles `--uninstall`
- [ ] Interactive prompts work when no flags provided
- [ ] Agent frontmatter conversion tested: Cursor fields stripped, Claude Code fields added
- [ ] Commands copied without modification to both runtimes
- [ ] Rules content written to `CLAUDE.md` for Claude Code installs
- [ ] README.md rewritten for Blueprint
- [ ] README covers both Cursor and Claude Code installation
- [ ] README mentions coexistence with GSD
- [ ] Final directory structure matches target
- [ ] No remaining GSD files or references
