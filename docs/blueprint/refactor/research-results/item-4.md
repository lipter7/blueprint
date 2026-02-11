# Research Result: Cursor and Claude Code Runtime Compatibility

**Research area:** Area 4 from `02-research-planner.md`
**Status:** Complete

---

## Core Finding

Cursor becomes a first-class installer target alongside Claude Code, OpenCode, and Gemini. The installer writes to `~/.cursor/` (global) or `.cursor/` (local) with format conversions specific to Cursor's primitives. The three main conversion concerns are: (1) commands become Cursor Skills, (2) agent frontmatter is adapted to Cursor's schema, and (3) `AskUserQuestion` references are transformed into explicit `AskQuestion` tool instructions with decision gate patterns. Hooks are deferred to v2.

---

## Decisions

### 1. Cursor Is a Full Installer Target

**Decision:** Add `--cursor` flag to the installer, following the same pattern as `--claude`, `--opencode`, and `--gemini`. Interactive mode adds Cursor as a fifth option. Installation writes to `~/.cursor/` (global) or `.cursor/` (local).

**Why:** Cursor's native `.claude/` compatibility (it reads `.claude/agents/`, `.claude/skills/`) is not sufficient. Cursor has its own agent frontmatter schema, its own hooks system, and its own command/skills format. A proper installation ensures files are in the optimal format for each runtime, just like OpenCode and Gemini already get format-converted files.

**What changes from GSD:** GSD's installer supports Claude Code, OpenCode, and Gemini. Blueprint adds Cursor as a fourth target runtime.

### 2. Commands Convert to Cursor Skills

**Decision:** Blueprint commands install as Cursor Skills (`.cursor/skills/{name}/SKILL.md`) rather than plain Cursor commands (`.cursor/commands/{name}.md`).

**Why:** Cursor Skills have frontmatter (`name`, `description`, `disable-model-invocation`) which preserves the metadata that Claude Code commands carry. Plain Cursor commands are bare markdown with no frontmatter -- they lose description metadata entirely. Skills with `disable-model-invocation: true` behave as explicit slash commands (invoked via `/skill-name`), matching the Claude Code command invocation model.

**Conversion from Claude Code command format:**

| Claude Code Field | Cursor Skill Field               | Notes          
|-------------------|----------------------------------|----------------
| `name`            | `name`                           | Direct mapping 
| `description`     | `description`                    | Direct mapping 
| `allowed-tools`   | *(removed)*                      | Cursor skills don't have tool allowlists; tool control comes from prompt instructions 
| `argument-hint`   | *(removed)*                      | No Cursor equivalent 
| *(none)*          | `disable-model-invocation: true` | Added to all Blueprint skills to enforce explicit `/name` invocation 

**Directory structure:**
```
# Claude Code source
commands/bp/map-codebase.md

# Cursor install target
~/.cursor/skills/bp-map-codebase/SKILL.md
```

### 3. Agent Frontmatter Adapts to Cursor Schema

**Decision:** Agent files convert from Claude Code's frontmatter schema to Cursor's schema during installation.

**Conversion:**

| Claude Code Field           | Cursor Field     | Notes 
|-----------------------------|------------------|-----------------------------
| `name`                      | `name`           | Direct mapping 
| `description`               | `description`    | Direct mapping 
| `tools` / `allowed-tools`   | *(removed)*      | Cursor agents don't restrict tools via frontmatter 
| `color`                     | *(removed)*      | Cursor agents don't support color
| *(none)*                    | `model: inherit` | Added; uses parent agent's model. Could map from MODEL_PROFILES in the future 

**Prompt body stays the same** (with tool name adjustments per decision #4).

### 4. AskUserQuestion → AskQuestion Conversion (Critical)

**Decision:** Every instance where `AskUserQuestion` appears in the source -- whether in `allowed-tools` frontmatter, workflow instructions, or agent prompts -- must be converted for Cursor into explicit `AskQuestion` tool usage instructions with decision gate patterns.

**Why this is the most important conversion:** `AskQuestion` in Cursor is not reliably auto-invoked by the agent. Unlike Claude Code where declaring `AskUserQuestion` in `allowed-tools` is sufficient to make the agent use it, Cursor requires explicit instruction in the prompt body. Without this, Cursor will skip user interaction gates and proceed autonomously -- which directly undermines Blueprint's core value proposition of human-in-the-loop interaction.

**The conversion is NOT a simple rename.** It's a structural enhancement:

1. **Frontmatter:** `AskUserQuestion` in `allowed-tools` → removed (no tool allowlists in Cursor)
2. **Prompt body:** Every reference to `AskUserQuestion` → explicit `AskQuestion` instruction pattern

**Decision gate pattern to inject into Cursor skills/agents:**

```markdown
## Decision Gates

For every workflow checkpoint, use the `AskQuestion` tool with explicit options.
Do not use open-ended chat for checkpoint decisions unless the option "Other" is selected.

- Use single-select where only one answer is valid
- Use multi-select where the user could select more than one option
- If input is missing, call AskQuestion instead of asking free-form text
- Do not proceed until the user selects an option
```

**Implementation note:** The exact pattern needs further design work during implementation to determine the right balance of specificity. The installer should have a conversion function (like the existing `convertClaudeToOpencodeFrontmatter`) that:
- Identifies files containing `AskUserQuestion` references
- Injects the decision gate pattern into the prompt body
- Replaces inline tool name references (`AskUserQuestion` → `AskQuestion`)

### 5. Hooks: Deferred to v2

**Decision:** Skip hooks for the Cursor installation path in v1. Don't port the statusline or update checker to Cursor's hooks.json format.

**Why:** Hooks are nice-to-haves (statusline display, update checking), not core functionality. Cursor has its own UX for these concerns. The hooks systems are completely different:

| Aspect | Claude Code | Cursor |
|---|---|---|
| Config file | `settings.json` (hooks property) | `hooks.json` (standalone) |
| Event names | `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart` | `preToolUse`, `postToolUse`, `stop`, `sessionStart`, `subagentStart`, `subagentStop`, etc. |
| Protocol | JSON via settings | JSON over stdio, exit codes |
| Extra features | *(none)* | Prompt-based hooks, matchers, loop limits |

Porting hooks requires non-trivial engineering for a feature that doesn't affect the core workflow. Defer to v2 when the core install is proven.

### 6. Tool Name Mapping in Prompt Bodies

**Decision:** Follow the "test first, convert if needed" approach for general tool name references (Bash/Shell, Edit/StrReplace, etc.), but the `AskUserQuestion` → `AskQuestion` conversion is mandatory from day one per decision #4.

**Rationale:** Cursor reads `.claude/` directories natively and tunes its agent per model. It likely handles Claude Code tool names correctly for most tools. The one tool that does NOT get reliably used automatically is `AskQuestion`, which is why it gets special treatment. For other tools (Bash, Edit, Read, Write, Glob, Grep, Task), test whether Cursor handles Claude Code names correctly before building a conversion pipeline.

**If testing shows other tool names need conversion:** Add a `claudeToCursorTools` mapping object in the installer (following the existing pattern of `claudeToOpencodeTools` and `claudeToGeminiTools`).

---

## What Stays the Same

- **Source of truth remains Claude Code format.** All commands, agents, workflows, templates, and references are authored in Claude Code format. The installer converts for each runtime.
- **Installer architecture.** The existing `install.js` pattern of reading source files, converting format, and writing to target directories extends naturally to Cursor.
- **Agent prompt bodies.** The XML-structured prompt content (`<role>`, `<process>`, `<critical_rules>`, etc.) works identically in both runtimes.
- **Subagent spawning.** Both runtimes use a `Task` tool to spawn subagents by name. Cursor auto-discovers agents from `.cursor/agents/`.
- **CLAUDE.md / AGENTS.md support.** Cursor reads both natively. Project-level guidance can be shared without conversion.

---

## Implications for Implementation Planning

### What's Mechanical (Can Be Batched)

- Add Cursor to the installer's runtime selection menu (`promptRuntime`, flag parsing)
- Add `getDirName('cursor')` → `.cursor` mapping
- Add `getGlobalDir('cursor')` logic (defaults to `~/.cursor`)
- Create `convertClaudeToCursorAgent()` function (strip `color`, strip `tools`/`allowed-tools`, add `model: inherit`)
- Create Cursor Skills directory structure generator (`commands/bp/*.md` → `.cursor/skills/bp-*/SKILL.md`)
- Create `convertClaudeToCursorSkill()` function (convert frontmatter, add `disable-model-invocation: true`)
- Add Cursor to uninstall logic
- Add Cursor path prefix replacement (`~/.claude/` → `~/.cursor/`)

### What Requires Design Work

- **AskQuestion decision gate pattern:** The exact wording and placement of the `AskQuestion` instruction pattern needs careful design. It must be:
  - Strong enough that Cursor's agent reliably uses the tool
  - Generic enough to work across all Blueprint commands/agents
  - Not so verbose that it bloats every prompt
  - Tested against Cursor's actual behavior to verify it works
- **Tool name testing:** Need to test whether Cursor handles Claude Code tool names (Bash, Edit, etc.) correctly or if a conversion mapping is needed
- **Skills directory naming convention:** Determine naming convention for skill directories (e.g., `bp-map-codebase/SKILL.md` vs `map-codebase/SKILL.md`)

### What's Its Own Phase

- **Cursor hooks support (v2):** When it's time, porting hooks to Cursor's `hooks.json` format is a separate effort requiring its own testing and validation

---

## Open Questions (For Other Research Areas)

- Should Blueprint commands use numbered prefixes (01-, 02-) in skill names for sort order in Cursor's palette? (Area 5: Command Set)
- Do any templates or artifacts need Cursor-specific adjustments? (Area 6: Template/Artifact Design)
- When the migration strategy is designed, should Cursor be supported from the first Blueprint release or added as a fast-follow? (Area 7: Migration)
