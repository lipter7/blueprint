# GSD Infrastructure: Scripts, Hooks, Installer, and Tools

## Overview

The GSD infrastructure consists of five interconnected Node.js files that handle installation, runtime hooks, build tooling, and the central CLI utility that all commands and agents rely on:

1. **`scripts/build-hooks.js`** -- A trivial build script that copies hook source files to `hooks/dist/` for npm packaging.
2. **`hooks/gsd-check-update.js`** -- A SessionStart hook that checks npm for newer GSD versions in a background process and caches the result.
3. **`hooks/gsd-statusline.js`** -- A statusline hook that reads JSON from stdin and renders model name, current task, context window usage, and update notifications.
4. **`bin/install.js`** -- The single-entry-point installer (`npx get-shit-done-cc`). Handles multi-runtime installation (Claude Code, OpenCode, Gemini), format conversion, path replacement, hook registration, local patch persistence, and uninstall.
5. **`get-shit-done/bin/gsd-tools.js`** -- The central CLI utility (~4600 lines) invoked by all commands and agents. Provides ~60 subcommands covering state management, phase operations, roadmap analysis, scaffolding, verification, frontmatter CRUD, git commits, template filling, progress rendering, and compound "init" commands that pre-compute all context a workflow needs.
6. **`get-shit-done/bin/gsd-tools.test.js`** -- Test suite using Node.js built-in test runner (`node:test`), covering ~20 command groups with ~60 individual test cases.

**Data flow:** Slash commands (in `commands/gsd/`) invoke `gsd-tools.js` via `node ~/.claude/get-shit-done/bin/gsd-tools.js <command>`. The tools script reads/writes files in the project's `.planning/` directory. The installer copies all source files (commands, agents, workflows, references, templates, hooks) into the target runtime's config directory, performing format conversion as needed.

---

## scripts/build-hooks.js

**Path:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/scripts/build-hooks.js`
**Lines:** 42
**Invoked by:** `npm run build:hooks` (defined in package.json)

### What It Does

Copies hook source files from `hooks/` to `hooks/dist/` for npm distribution. The `dist/` directory is gitignored but included in the npm package. This is a simple file copy -- no bundling, transpilation, or minification occurs because the hooks are pure Node.js with no external dependencies.

### How It Works

1. Resolves the `hooks/` directory relative to `__dirname/../hooks/`.
2. Ensures `hooks/dist/` exists (creates with `{ recursive: true }`).
3. Iterates over a hardcoded list of hooks: `['gsd-check-update.js', 'gsd-statusline.js']`.
4. For each hook, checks if source exists, then copies with `fs.copyFileSync`.
5. Logs each copy operation and a final "Build complete." message.

### Dependencies

- Node.js built-ins only: `fs`, `path`.
- No external dependencies.

### What Depends On It

- The installer (`bin/install.js`) reads from `hooks/dist/` when installing hooks to the target directory (line 1409: `const hooksSrc = path.join(src, 'hooks', 'dist')`).
- The npm `prepublishOnly` or `prepare` script should invoke this before publishing.

### Notable Details

- The `HOOKS_TO_COPY` array is the single source of truth for which hooks get distributed. If a new hook is added, it must be added here.
- Warns but does not fail if a source hook file is missing -- allows partial builds.

---

## hooks/gsd-check-update.js

**Path:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/hooks/gsd-check-update.js`
**Lines:** 62
**Hook type:** Claude Code `SessionStart` hook (registered in `settings.json`)

### What It Does

Checks if a newer version of the `get-shit-done-cc` npm package is available, writing the result to a JSON cache file. This runs once per session start and is designed to be non-blocking.

### How It Works

1. **Version resolution:** Checks for a `VERSION` file in two locations:
   - Project-local: `<cwd>/.claude/get-shit-done/VERSION`
   - Global: `~/.claude/get-shit-done/VERSION`
   - Falls back to `0.0.0` if neither exists.

2. **Background spawn:** Uses `child_process.spawn` to run a detached Node.js process that:
   - Reads the installed version from the VERSION file.
   - Runs `npm view get-shit-done-cc version` (with 10-second timeout).
   - Writes a JSON result to `~/.claude/cache/gsd-update-check.json`.

3. **Cache format:**
   ```json
   {
     "update_available": true,
     "installed": "1.9.0",
     "latest": "1.9.1",
     "checked": 1706000000
   }
   ```

4. The spawned child is `unref()`-ed and detached so it does not block the parent process.

### Dependencies

- Node.js built-ins: `fs`, `path`, `os`, `child_process.spawn`.
- Requires `npm` to be available on the PATH for the `npm view` command.

### What Depends On It

- **`hooks/gsd-statusline.js`** reads the cache file at `~/.claude/cache/gsd-update-check.json` and displays an update notification in the statusline if `update_available` is true.
- **`bin/install.js`** registers this hook in `settings.json` under `hooks.SessionStart` (line 1469).

### Notable Details

- Windows compatibility: Uses `windowsHide: true` and `detached: true` for proper process detachment.
- The cache directory (`~/.claude/cache/`) is created if it does not exist.
- Silent failure on all errors -- never breaks the session start flow.
- The `checked` timestamp uses Unix epoch seconds (not milliseconds).

---

## hooks/gsd-statusline.js

**Path:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/hooks/gsd-statusline.js`
**Lines:** 91
**Hook type:** Claude Code `statusLine` command (registered in `settings.json`)

### What It Does

Renders a rich terminal statusline showing: model name, current task from the todo list, working directory name, context window usage with color-coded progress bar, and GSD update availability notification.

### How It Works

1. **Input:** Reads JSON from stdin (piped by Claude Code). The JSON contains:
   - `model.display_name` -- current model name
   - `workspace.current_dir` -- working directory
   - `session_id` -- current session identifier
   - `context_window.remaining_percentage` -- percentage of context window remaining

2. **Context window display:**
   - Takes the `remaining_percentage` and computes raw usage: `100 - remaining`.
   - **Scales to 80% limit:** Claude Code enforces an 80% context limit, so the display scales `rawUsed / 80 * 100` to show 100% at the actual cutoff point.
   - Renders a 10-segment Unicode progress bar (`\u2588` filled, `\u2591` empty).
   - Color thresholds (ANSI escape codes):
     - Green (`\x1b[32m`): < 63% scaled (~50% real)
     - Yellow (`\x1b[33m`): 63-80% scaled (~50-65% real)
     - Orange (`\x1b[38;5;208m`): 81-94% scaled (~65-76% real)
     - Blinking red with skull (`\x1b[5;31m`): >= 95% scaled (~76%+ real)

3. **Current task:** Reads from `~/.claude/todos/` directory:
   - Filters for files matching `{session_id}-agent-*.json`.
   - Sorts by modification time (newest first).
   - Parses the JSON and finds the first todo with `status === 'in_progress'`.
   - Displays the `activeForm` field if found.

4. **Update notification:** Reads `~/.claude/cache/gsd-update-check.json`:
   - If `update_available` is true, prepends a yellow `upward arrow /gsd:update` indicator.

5. **Output format:**
   - With task: `[update?] model | task | dirname context_bar`
   - Without task: `[update?] model | dirname context_bar`

### Dependencies

- Node.js built-ins: `fs`, `path`, `os`.
- Reads from Claude Code's internal todo file structure.
- Reads from the cache written by `gsd-check-update.js`.

### What Depends On It

- **`bin/install.js`** configures the statusline command in `settings.json` under `statusLine.command` (line 1498).

### Notable Details

- All errors are silently caught -- the statusline must never break.
- Uses `\x1b[2m` (dim) for secondary text, `\x1b[1m` (bold) for the current task.
- The output is written to stdout via `process.stdout.write` (no trailing newline).
- Does not depend on any GSD-specific files in `.planning/` -- it reads only from Claude Code's internal structures.

---

## bin/install.js

**Path:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/bin/install.js`
**Lines:** 1740
**Invoked by:** `npx get-shit-done-cc` (npm `bin` entry point)

### What It Does

The single entry point for installing, updating, and uninstalling GSD across three runtimes: Claude Code, OpenCode, and Gemini CLI. Handles interactive and non-interactive flows, format conversion, hook registration, local patch persistence, and cleanup of orphaned files from previous versions.

### CLI Arguments

| Flag | Description |
|------|-------------|
| `--global` / `-g` | Install to global config directory |
| `--local` / `-l` | Install to current project directory |
| `--claude` | Target Claude Code runtime |
| `--opencode` | Target OpenCode runtime |
| `--gemini` | Target Gemini runtime |
| `--all` | Target all three runtimes |
| `--both` | Legacy: Claude + OpenCode |
| `--uninstall` / `-u` | Remove GSD files |
| `--config-dir` / `-c` | Custom config directory path |
| `--force-statusline` | Replace existing statusline |
| `--help` / `-h` | Show usage information |

### Runtime Directory Resolution

The installer resolves target directories per runtime:

- **Claude Code:** `CLAUDE_CONFIG_DIR` env > `~/.claude`
- **OpenCode:** `OPENCODE_CONFIG_DIR` > `dirname(OPENCODE_CONFIG)` > `XDG_CONFIG_HOME/opencode` > `~/.config/opencode`
- **Gemini:** `GEMINI_CONFIG_DIR` > `~/.gemini`

The `--config-dir` flag overrides all environment variables for the selected runtime.

For local installs, the target is `<cwd>/.claude/`, `<cwd>/.opencode/`, or `<cwd>/.gemini/`.

### Key Functions

#### Format Conversion Functions

**`convertClaudeToOpencodeFrontmatter(content)`**
Converts Claude Code markdown to OpenCode format:
- Replaces tool name references in body text: `AskUserQuestion` -> `question`, `SlashCommand` -> `skill`, `TodoWrite` -> `todowrite`.
- Replaces `/gsd:command` with `/gsd-command` (OpenCode has flat command namespace).
- Replaces `~/.claude` with `~/.config/opencode` in file paths.
- Converts `allowed-tools:` YAML array to `tools:` map format (`toolname: true`).
- Converts color names to hex values (e.g., `cyan` -> `#00FFFF`).
- Removes `name:` field (OpenCode uses filename for command name).
- Tool name mapping: `AskUserQuestion` -> `question`, `SlashCommand` -> `skill`, `WebFetch` -> `webfetch`, `WebSearch` -> `websearch`. MCP tools (`mcp__*`) keep their format. All others are lowercased.

**`convertClaudeToGeminiAgent(content)`**
Converts Claude Code agent markdown to Gemini CLI format:
- Converts `allowed-tools:` or `tools:` to YAML array format.
- Maps tool names: `Read` -> `read_file`, `Write` -> `write_file`, `Edit` -> `replace`, `Bash` -> `run_shell_command`, `Grep` -> `search_file_content`, `WebSearch` -> `google_web_search`, `WebFetch` -> `web_fetch`, `TodoWrite` -> `write_todos`, `AskUserQuestion` -> `ask_user`.
- Filters out `mcp__*` tools (auto-discovered by Gemini) and `Task` (agents are auto-registered).
- Removes `color:` field (causes Gemini CLI validation errors).
- Strips `<sub>` HTML tags and converts to `*(text)*` italic format.

**`convertClaudeToGeminiToml(content)`**
Converts Claude Code commands (YAML frontmatter + markdown body) to Gemini TOML format:
- Extracts `description:` from frontmatter.
- Wraps body content as `prompt = "..."` in TOML.

**`stripSubTags(content)`**
Converts `<sub>text</sub>` to `*(text)*` for terminal compatibility.

#### Attribution Processing

**`getCommitAttribution(runtime)`**
Reads the commit attribution setting per runtime:
- Claude/Gemini: reads from `settings.json` -> `attribution.commit`.
- OpenCode: reads from `opencode.json` -> `disable_ai_attribution`.
- Returns: `null` (remove Co-Authored-By), `undefined` (keep default), or custom string.
- Results are cached in an in-memory `Map` per runtime.

**`processAttribution(content, attribution)`**
Processes Co-Authored-By lines in file content:
- `null`: Removes Co-Authored-By lines and preceding blank line via regex.
- `undefined`: Keeps content unchanged.
- String: Replaces the attribution text (with `$` escaping for regex safety).

#### Copy Functions

**`copyFlattenedCommands(srcDir, destDir, prefix, pathPrefix, runtime)`**
Copies commands to OpenCode's flat structure:
- Source: `commands/gsd/help.md` -> Destination: `command/gsd-help.md`.
- Recursively flattens subdirectories: `commands/gsd/debug/start.md` -> `command/gsd-debug-start.md`.
- Removes old `gsd-*.md` files from destination before copying.
- Applies path replacement, attribution processing, and frontmatter conversion.

**`copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime)`**
Recursively copies a directory tree:
- Deletes existing destination first (clean install, prevents orphaned files).
- For `.md` files: replaces `~/.claude/` with the runtime-appropriate path prefix.
- For OpenCode: applies frontmatter conversion.
- For Gemini: converts to TOML format and changes file extension to `.toml`.
- For other files: uses `fs.copyFileSync`.

#### Cleanup Functions

**`cleanupOrphanedFiles(configDir)`**
Removes specific files from previous GSD versions:
- `hooks/gsd-notify.sh` (removed in v1.6.x)
- `hooks/statusline.js` (renamed to `gsd-statusline.js` in v1.9.0)

**`cleanupOrphanedHooks(settings)`**
Cleans settings.json of orphaned hook registrations:
- Removes entries referencing: `gsd-notify.sh`, `hooks/statusline.js`, `gsd-intel-index.js`, `gsd-intel-session.js`, `gsd-intel-prune.js`.
- Fixes old statusline paths (`statusline.js` -> `gsd-statusline.js`).

#### Local Patch Persistence

The installer detects when users have modified GSD files and preserves those modifications across updates.

**`fileHash(filePath)`** -- Computes SHA256 hash of a file.

**`generateManifest(dir, baseDir)`** -- Recursively builds `{ relativePath: sha256hash }` map.

**`writeManifest(configDir)`** -- After installation, writes `gsd-file-manifest.json` containing:
```json
{
  "version": "1.9.x",
  "timestamp": "2025-...",
  "files": {
    "get-shit-done/bin/gsd-tools.js": "abc123...",
    "commands/gsd/help.md": "def456...",
    "agents/gsd-executor.md": "ghi789..."
  }
}
```

**`saveLocalPatches(configDir)`** -- Before update:
- Reads the previous manifest.
- Compares current file hashes against stored hashes.
- Copies modified files to `gsd-local-patches/` directory.
- Writes `backup-meta.json` with modification list and previous version.

**`reportLocalPatches(configDir)`** -- After update:
- Reads `gsd-local-patches/backup-meta.json`.
- Prints list of backed-up files and instructions to reapply.

#### Uninstall

**`uninstall(isGlobal, runtime)`** removes only GSD-specific files:
1. Commands: `commands/gsd/` directory (or `command/gsd-*.md` for OpenCode).
2. `get-shit-done/` directory.
3. GSD agents: `agents/gsd-*.md` files only (preserves non-GSD agents).
4. GSD hooks: `gsd-statusline.js`, `gsd-check-update.js`.
5. Settings cleanup: removes GSD statusline and hook entries from `settings.json`.
6. OpenCode cleanup: removes GSD permission entries from `opencode.json`.

#### Install

**`install(isGlobal, runtime)`** performs the full installation:
1. Saves local patches (if updating).
2. Cleans up orphaned files.
3. Copies commands (flat for OpenCode, nested for Claude/Gemini).
4. Copies `get-shit-done/` directory with path replacement.
5. Copies agents with format conversion per runtime.
6. Copies `CHANGELOG.md`.
7. Writes `VERSION` file.
8. Copies hooks from `hooks/dist/`.
9. Registers update-check hook in `settings.json` (not for OpenCode).
10. Writes file manifest.
11. Reports backed-up patches.
12. Enables `experimental.enableAgents` for Gemini.

**`finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline, runtime)`**
- Optionally configures statusline.
- Writes `settings.json`.
- Configures OpenCode permissions (if applicable).
- Prints completion message.

#### OpenCode Permissions

**`configureOpencodePermissions()`**
Adds read and external_directory permissions to `~/.config/opencode/opencode.json` for the GSD docs path, preventing permission prompts.

**`parseJsonc(content)`**
Lightweight JSONC parser that strips `//` and `/* */` comments and trailing commas -- needed because OpenCode supports JSONC configuration files.

#### Interactive Prompts

**`promptRuntime(callback)`** -- Asks user which runtime(s) to install for (1-4 menu).
**`promptLocation(runtimes)`** -- Asks global vs. local installation.
**`handleStatusline(settings, isInteractive, callback)`** -- If an existing statusline is detected, asks whether to keep or replace.

#### Main Flow

The main execution flow at the bottom of the file (lines 1704-1739):
1. Validates flag combinations.
2. If `--uninstall`: calls `uninstall()` for each selected runtime.
3. If runtimes selected with location: calls `installAllRuntimes()`.
4. If only location specified: defaults to Claude Code.
5. If nothing specified: enters interactive mode (prompt for runtime, then location).
6. Non-TTY detection: defaults to global Claude Code install.

### Dependencies

- Node.js built-ins: `fs`, `path`, `os`, `readline`, `crypto`.
- Reads `../package.json` for version info.

### What Depends On It

- npm `bin` configuration points to this file.
- Users invoke it via `npx get-shit-done-cc`.

---

## get-shit-done/bin/gsd-tools.js

**Path:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/bin/gsd-tools.js`
**Lines:** 4598
**Invoked by:** All GSD slash commands and agents via `node <path>/get-shit-done/bin/gsd-tools.js <command> [args] [--raw]`

### What It Does

The central CLI utility that replaces repetitive inline bash patterns across ~50 GSD command/workflow/agent files. Every GSD operation that involves reading or writing `.planning/` files goes through this tool.

### Global Architecture

- **Input:** Command-line arguments parsed via `process.argv`.
- **Output:** JSON to stdout (default) or raw string values (with `--raw` flag).
- **Errors:** Written to stderr, exit code 1.
- **Working directory:** Uses `process.cwd()` -- expects to be run from a project directory containing `.planning/`.

### Model Profile Table

Defines the model-to-agent mapping for three quality profiles:

```
MODEL_PROFILES = {
  'gsd-planner':              quality: opus,   balanced: opus,   budget: sonnet
  'gsd-roadmapper':           quality: opus,   balanced: sonnet, budget: sonnet
  'gsd-executor':             quality: opus,   balanced: sonnet, budget: sonnet
  'gsd-phase-researcher':     quality: opus,   balanced: sonnet, budget: haiku
  'gsd-project-researcher':   quality: opus,   balanced: sonnet, budget: haiku
  'gsd-research-synthesizer': quality: sonnet,  balanced: sonnet, budget: haiku
  'gsd-debugger':             quality: opus,   balanced: sonnet, budget: sonnet
  'gsd-codebase-mapper':      quality: sonnet,  balanced: haiku,  budget: haiku
  'gsd-verifier':             quality: sonnet,  balanced: sonnet, budget: haiku
  'gsd-plan-checker':         quality: sonnet,  balanced: sonnet, budget: haiku
  'gsd-integration-checker':  quality: sonnet,  balanced: sonnet, budget: haiku
}
```

### Helper Functions

**`loadConfig(cwd)`** -- Reads `.planning/config.json` and returns normalized config with defaults:
- `model_profile` (default: `balanced`)
- `commit_docs` (default: `true`)
- `search_gitignored` (default: `false`)
- `branching_strategy` (default: `none`)
- `phase_branch_template` / `milestone_branch_template`
- `research`, `plan_checker`, `verifier` (all default: `true`)
- `parallelization` (default: `true`)
- `brave_search` (default: `false`)
- Supports nested config formats (e.g., `workflow.research` or flat `research`).

**`extractFrontmatter(content)`** -- Custom YAML frontmatter parser:
- Handles nested objects, arrays (both `- item` and `[inline]` syntax).
- Uses a stack-based approach for tracking nesting depth.
- Strips quotes from values.
- Converts empty objects to arrays when array items are encountered.

**`reconstructFrontmatter(obj)`** -- Serializes an object back to YAML frontmatter format.

**`spliceFrontmatter(content, newObj)`** -- Replaces the frontmatter section in a markdown file.

**`normalizePhaseName(phase)`** -- Normalizes phase identifiers: `6` -> `06`, `6.1` -> `06.1`.

**`parseMustHavesBlock(content, blockName)`** -- Parses deeply nested `must_haves` blocks (artifacts, key_links) from raw YAML frontmatter. Handles 3-level nesting.

**`safeReadFile(filePath)`** -- Returns file content or `null` on any error.

**`isGitIgnored(cwd, targetPath)`** -- Checks if a path is gitignored using `git check-ignore`.

**`execGit(cwd, args)`** -- Safe git command execution with argument escaping. Returns `{ exitCode, stdout, stderr }`.

### Command Reference

#### Atomic Commands

**`state load`** -- Loads `.planning/config.json` and checks existence of STATE.md, ROADMAP.md, config.json. In `--raw` mode, outputs key=value pairs.

**`state update <field> <value>`** -- Updates a `**Field:** value` pattern in STATE.md.

**`state get [section]`** -- Gets full STATE.md content, or extracts a specific `**field:**` value or `## Section` block.

**`state patch --field val ...`** -- Batch updates multiple STATE.md fields in one operation.

**`resolve-model <agent-type>`** -- Resolves the appropriate model (opus/sonnet/haiku) for an agent based on the configured model profile.

**`find-phase <phase>`** -- Finds a phase directory by number (supports decimal phases). Returns directory path, plans, summaries.

**`commit <message> [--files f1 f2] [--amend]`** -- Commits planning docs:
- Checks `commit_docs` config flag.
- Checks if `.planning` is gitignored.
- Stages specified files (or `.planning/` by default).
- Returns commit hash.

**`verify-summary <path> [--check-count N]`** -- Verifies a SUMMARY.md file:
- Check 1: File exists.
- Check 2: Spot-checks files mentioned in the summary (backtick paths).
- Check 3: Verifies commit hashes referenced in the summary.
- Check 4: Checks for self-check/verification section status.

**`generate-slug <text>`** -- URL-safe slug generation.

**`current-timestamp [format]`** -- Returns timestamp in `full` (ISO), `date` (YYYY-MM-DD), or `filename` format.

**`list-todos [area]`** -- Lists pending todos from `.planning/todos/pending/`. Supports area filtering.

**`verify-path-exists <path>`** -- Checks if a file or directory exists and reports its type.

**`config-ensure-section`** -- Creates `.planning/config.json` with defaults if it does not exist. Auto-detects Brave Search API key availability.

**`config-set <key.path> <value>`** -- Sets a value in config.json using dot-notation for nested keys.

**`history-digest`** -- Aggregates all SUMMARY.md files across all phases into a single digest:
- Merges `provides`, `affects`, `patterns-established`, `key-decisions`, `tech-stack.added` from all summaries.
- Uses Sets for deduplication, converted to Arrays for output.

**`summary-extract <path> [--fields f1,f2]`** -- Extracts structured data from a SUMMARY.md file: one-liner, key-files, tech-added, patterns, decisions (parsed into summary/rationale pairs).

**`state-snapshot`** -- Full structured parse of STATE.md: extracts current phase, plan, status, progress, decisions table, blockers list, session continuity info, paused_at.

**`phase-plan-index <phase>`** -- Indexes all plans in a phase with wave assignments, autonomous flags, task counts, summary status, and checkpoint detection.

**`websearch <query> [--limit N] [--freshness day|week|month]`** -- Brave Search API integration. Requires `BRAVE_API_KEY` environment variable. Silent fallback if key is not set.

#### Phase Operations

**`phase next-decimal <phase>`** -- Calculates the next decimal phase number (e.g., `06.3` after `06.1`, `06.2`).

**`phase add <description>`** -- Appends a new integer phase to the roadmap. Creates the phase directory. Updates ROADMAP.md with the new phase entry.

**`phase insert <after> <description>`** -- Inserts a decimal phase after an existing one. Creates directory and updates ROADMAP.md with `(INSERTED)` marker.

**`phase remove <phase> [--force]`** -- Removes a phase:
- Safety check: rejects removal of phases with summaries unless `--force`.
- Deletes the phase directory.
- Renumbers all subsequent phases (both directory names and internal file names).
- For decimal phases: renumbers sibling decimals only.
- For integer phases: renumbers all subsequent integer phases and their decimals.
- Updates ROADMAP.md: removes section, checkboxes, table rows, and renumbers references.
- Updates STATE.md: decrements total phase count.

**`phase complete <phase>`** -- Marks a phase complete:
- Updates ROADMAP.md: checks the phase checkbox, updates progress table, sets plan count.
- Finds the next phase directory.
- Updates STATE.md: advances current phase, resets plan to "Not started", sets status.
- Detects if this is the last phase in the milestone.

#### Roadmap Operations

**`roadmap get-phase <phase>`** -- Extracts a phase section from ROADMAP.md. Returns phase name, goal, and full section content.

**`roadmap analyze`** -- Full roadmap analysis:
- Parses all phase headings.
- For each phase: checks disk status (no_directory, empty, discussed, researched, planned, partial, complete).
- Extracts milestones, goals, dependencies.
- Computes aggregate stats: total plans, summaries, completion percentage.
- Identifies current and next phases.

#### Milestone Operations

**`milestone complete <version> [--name <name>]`** -- Archives a milestone:
- Archives ROADMAP.md and REQUIREMENTS.md to `.planning/milestones/`.
- Extracts accomplishments (one-liners from all summaries).
- Creates/appends to MILESTONES.md.
- Updates STATE.md.

#### Validation

**`validate consistency`** -- Cross-checks phase numbering and disk/roadmap sync:
- Phases in ROADMAP but not on disk.
- Phases on disk but not in ROADMAP.
- Gaps in sequential phase numbering.
- Gaps in plan numbering within phases.
- Orphan summaries (no matching plan).
- Missing `wave` in plan frontmatter.

#### Progress Rendering

**`progress [json|table|bar]`** -- Renders progress in multiple formats:
- `json`: Full structured output with phase details.
- `table`: Markdown table with progress bar.
- `bar`: Simple progress bar string.

#### Todo Management

**`todo complete <filename>`** -- Moves a todo from `pending/` to `completed/`, adding a completion timestamp.

#### Scaffolding

**`scaffold context --phase <N>`** -- Creates `NN-CONTEXT.md` with decisions, discretion areas, deferred ideas sections.

**`scaffold uat --phase <N>`** -- Creates `NN-UAT.md` with test results table.

**`scaffold verification --phase <N>`** -- Creates `NN-VERIFICATION.md` with goal-backward verification template.

**`scaffold phase-dir --phase <N> --name <name>`** -- Creates a numbered phase directory.

#### Frontmatter CRUD

**`frontmatter get <file> [--field k]`** -- Extracts frontmatter as JSON (or a single field).

**`frontmatter set <file> --field k --value jsonVal`** -- Updates a single frontmatter field. Value is JSON-parsed.

**`frontmatter merge <file> --data '{json}'`** -- Merges JSON data into existing frontmatter.

**`frontmatter validate <file> --schema plan|summary|verification`** -- Validates required fields against predefined schemas:
- `plan`: phase, plan, type, wave, depends_on, files_modified, autonomous, must_haves
- `summary`: phase, plan, subsystem, tags, duration, completed
- `verification`: phase, verified, status, score

#### Verification Suite

**`verify plan-structure <file>`** -- Checks PLAN.md structure:
- Required frontmatter fields.
- `<task>` XML elements with `<name>`, `<action>`, `<verify>`, `<done>`, `<files>`.
- Wave/depends_on consistency.
- Autonomous/checkpoint consistency.

**`verify phase-completeness <phase>`** -- Checks all plans have matching summaries.

**`verify references <file>`** -- Checks `@path/to/file` references and backtick file paths resolve to existing files.

**`verify commits <h1> [h2] ...`** -- Batch verifies commit hashes exist in git history.

**`verify artifacts <plan-file>`** -- Checks `must_haves.artifacts` from plan frontmatter: file existence, minimum line counts, content patterns, export presence.

**`verify key-links <plan-file>`** -- Checks `must_haves.key_links` from plan frontmatter: source-target relationships, regex pattern matching.

#### Template Fill

**`template fill summary --phase N [--plan M] [--name "..."] [--fields '{json}']`** -- Creates pre-filled SUMMARY.md with frontmatter and section structure.

**`template fill plan --phase N [--plan M] [--type execute|tdd] [--wave N] [--fields '{json}']`** -- Creates pre-filled PLAN.md with `<task>` XML structure.

**`template fill verification --phase N [--fields '{json}']`** -- Creates pre-filled VERIFICATION.md with tables for truths, artifacts, links, requirements.

**`template select <plan-path>`** -- Analyzes a plan file and recommends a summary template (minimal, standard, complex) based on task count, file mentions, and decision presence.

#### State Progression Engine

**`state advance-plan`** -- Increments the current plan counter. If at the last plan, sets status to "Phase complete -- ready for verification".

**`state record-metric --phase N --plan M --duration Xmin [--tasks N] [--files N]`** -- Appends a row to the Performance Metrics table in STATE.md.

**`state update-progress`** -- Recalculates the progress bar by counting summaries vs. plans across all phases.

**`state add-decision --summary "..." [--phase N] [--rationale "..."]`** -- Appends to the Decisions section in STATE.md.

**`state add-blocker --text "..."`** -- Appends to the Blockers section.

**`state resolve-blocker --text "..."`** -- Removes a blocker by text match (case-insensitive). Adds "None" placeholder if section becomes empty.

**`state record-session --stopped-at "..." [--resume-file path]`** -- Updates session continuity fields: Last session, Last Date, Stopped At, Resume File.

#### Compound Init Commands

These commands pre-compute all the context a workflow needs in a single call, avoiding multiple round-trips:

**`init execute-phase <phase> [--include state,config,roadmap]`**
Returns: executor/verifier models, config flags, phase info, plan inventory, pre-computed branch name, milestone info, file existence checks. Optionally includes full file contents.

**`init plan-phase <phase> [--include state,roadmap,requirements,context,research,verification,uat]`**
Returns: researcher/planner/checker models, workflow flags, phase artifacts status, plan count. Optionally includes multiple file contents.

**`init new-project`**
Returns: researcher/synthesizer/roadmapper models, brownfield detection (scans for source files), git state, Brave Search availability.

**`init new-milestone`**
Returns: researcher/synthesizer/roadmapper models, current milestone info, file existence.

**`init quick <description>`**
Returns: planner/executor models, quick task numbering, slug, timestamps, paths.

**`init resume`**
Returns: file existence checks, interrupted agent detection (reads `current-agent-id.txt`).

**`init verify-work <phase>`**
Returns: planner/checker models, phase info, verification artifact status.

**`init phase-op <phase>`**
Returns: generic phase operation context with config, phase info, artifact status.

**`init todos [area]`**
Returns: todo inventory, paths, timestamps, area filter.

**`init milestone-op`**
Returns: milestone info, phase counts, completion status, archive inventory.

**`init map-codebase`**
Returns: mapper model, config, existing codebase maps.

**`init progress [--include state,roadmap,project,config]`**
Returns: detailed phase analysis, current/next phase, paused state, milestone info. Optionally includes file contents.

### CLI Router

The `main()` function (lines 4214-4597) is an async function that:
1. Parses `--raw` flag.
2. Extracts the command and subcommand from args.
3. Routes to the appropriate function via a switch statement.
4. Handles argument parsing for each command (named flags like `--phase`, `--plan`, `--name`, etc.).

### Dependencies

- Node.js built-ins: `fs`, `path`, `child_process.execSync`.
- Uses the native `fetch` API (Node 18+) for Brave Search integration.
- No external dependencies.

### What Depends On It

- **All GSD slash commands** in `commands/gsd/` invoke this tool.
- **All GSD agents** in `agents/gsd-*.md` invoke this tool.
- **GSD workflows** in `get-shit-done/workflows/` reference this tool.
- The invocation pattern is: `node ~/.claude/get-shit-done/bin/gsd-tools.js <command> [args]`

---

## get-shit-done/bin/gsd-tools.test.js

**Path:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/bin/gsd-tools.test.js`
**Lines:** ~2034
**Run by:** `npm test` -> `node --test get-shit-done/bin/gsd-tools.test.js`

### What It Does

Comprehensive test suite using Node.js built-in test runner (`node:test`). Tests are integration-style: each test creates a temporary project directory, runs the `gsd-tools.js` CLI as a subprocess via `execSync`, and asserts on the JSON output.

### Test Infrastructure

**`runGsdTools(args, cwd)`** -- Helper that executes `node gsd-tools.js <args>` in a given directory, capturing stdout and stderr. Returns `{ success, output, error }`.

**`createTempProject()`** -- Creates a temporary directory with `.planning/phases/` structure using `fs.mkdtempSync`.

**`cleanup(tmpDir)`** -- Removes the temp directory recursively.

Each test suite uses `beforeEach` to create a fresh temp project and `afterEach` to clean up.

### Test Coverage by Command Group

| Command Group | Tests | What's Tested |
|---|---|---|
| `history-digest` | 6 | Empty phases, nested frontmatter, multi-phase merge, malformed SUMMARY skip, backward-compatible flat provides, inline array syntax |
| `phases list` | 6 | Empty directory, numerical sort, decimal phase sort, `--type plans` filter, `--type summaries` filter, `--phase` filter |
| `roadmap get-phase` | 5 | Phase extraction, missing phase, decimal phases, full section content, missing ROADMAP.md |
| `phase next-decimal` | 5 | First decimal (X.1), increment from existing, gap handling, single-digit input normalization, missing base phase |
| `phase-plan-index` | 5 | Empty phase, single plan with frontmatter, wave grouping, incomplete detection, checkpoint detection (autonomous: false), phase not found |
| `state-snapshot` | 5 | Missing STATE.md, basic field extraction, decisions table, blockers list, session continuity, paused_at field |
| `summary-extract` | 4 | Missing file, full extraction, selective `--fields`, missing frontmatter fields, key-decisions with rationale parsing |
| `init --include` | 7 | state+config inclusion, omission without flag, multi-file inclusion (state, roadmap, requirements, context, research), verification+uat, progress with state/roadmap/project/config, missing files return null, partial includes |
| `roadmap analyze` | 3 | Missing ROADMAP, phase parsing with disk status, goal/dependency extraction |
| `phase add` | 2 | Add after highest existing, handle empty roadmap |
| `phase insert` | 3 | Insert decimal after target, increment when siblings exist, reject missing phase |
| `phase remove` | 4 | Remove + renumber subsequent, reject removal with summaries (unless --force), decimal removal + sibling renumbering, STATE.md phase count update |
| `phase complete` | 2 | Mark complete + transition to next, detect last phase in milestone |
| `milestone complete` | 2 | Archive roadmap/requirements + create MILESTONES.md, append to existing MILESTONES.md |
| `validate consistency` | 3 | Pass for consistent project, warn about orphan directories, warn about gaps |
| `progress` | 3 | JSON format, bar format, table format |
| `todo complete` | 2 | Move pending to completed with timestamp, fail for nonexistent |
| `scaffold` | 4 | Context file, UAT file, verification file, phase directory, no-overwrite check |

### Coverage Notes

**Well-covered areas:**
- Phase CRUD operations (add, insert, remove, complete) with renumbering logic.
- State management (snapshot, field extraction, decisions, blockers, session).
- History digest with various frontmatter formats.
- Roadmap parsing and analysis.
- Scaffold file creation.
- Compound init commands with `--include` flag.

**Not covered in tests:**
- `commit` command (would require git repo setup).
- `verify-summary` (would need git history).
- `verify plan-structure`, `verify phase-completeness`, `verify references`, `verify commits`, `verify artifacts`, `verify key-links`.
- `frontmatter get/set/merge/validate`.
- `template fill` and `template select`.
- `state update`, `state patch`, `state advance-plan`, `state record-metric`, `state update-progress`, `state add-decision`, `state add-blocker`, `state resolve-blocker`, `state record-session`.
- `resolve-model` (simple lookup, low risk).
- `websearch` (requires API key).
- `config-set`, `config-ensure-section`.
- All other `init` subcommands (new-project, new-milestone, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase).

---

## Cross-References

### How install.js References Other Directories

The installer copies files from these source directories (relative to the package root):

| Source | Destination (Claude) | Destination (OpenCode) | Destination (Gemini) |
|--------|---------------------|----------------------|---------------------|
| `commands/gsd/*.md` | `~/.claude/commands/gsd/*.md` | `~/.config/opencode/command/gsd-*.md` (flattened) | `~/.gemini/commands/gsd/*.toml` (TOML format) |
| `agents/gsd-*.md` | `~/.claude/agents/gsd-*.md` | `~/.config/opencode/agents/gsd-*.md` (converted frontmatter) | `~/.gemini/agents/gsd-*.md` (Gemini agent format) |
| `get-shit-done/**` | `~/.claude/get-shit-done/**` | `~/.config/opencode/get-shit-done/**` | `~/.gemini/get-shit-done/**` |
| `hooks/dist/*.js` | `~/.claude/hooks/*.js` | `~/.config/opencode/hooks/*.js` | `~/.gemini/hooks/*.js` |
| `CHANGELOG.md` | `~/.claude/get-shit-done/CHANGELOG.md` | Same pattern | Same pattern |

### How gsd-tools.js Gets Invoked by Commands/Agents

Commands and agents invoke gsd-tools.js via the path that was installed:
- Global Claude: `node ~/.claude/get-shit-done/bin/gsd-tools.js <command>`
- Local Claude: `node ./.claude/get-shit-done/bin/gsd-tools.js <command>`
- Global OpenCode: `node ~/.config/opencode/get-shit-done/bin/gsd-tools.js <command>`
- Global Gemini: `node ~/.gemini/get-shit-done/bin/gsd-tools.js <command>`

The `~/.claude/` prefix in source files is replaced by the installer with the appropriate prefix for the target runtime.

### How Hooks Register

The installer writes to `settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"~/.claude/hooks/gsd-statusline.js\""
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"~/.claude/hooks/gsd-check-update.js\""
          }
        ]
      }
    ]
  }
}
```

For local installs, the paths use relative format: `node .claude/hooks/gsd-statusline.js`.

### Data Flow: .planning/ Directory

gsd-tools.js operates on the `.planning/` directory in the current working directory:

```
.planning/
  config.json          -- Project configuration (model profile, workflow flags)
  STATE.md             -- Current project state (phase, plan, status, progress)
  ROADMAP.md           -- Phase roadmap with goals and dependencies
  REQUIREMENTS.md      -- Project requirements
  PROJECT.md           -- Project description
  MILESTONES.md        -- Completed milestone history
  codebase/            -- Codebase maps (generated by map-codebase)
  milestones/          -- Archived milestone files
  quick/               -- Quick task files
  todos/
    pending/           -- Pending todo files
    completed/         -- Completed todo files
  phases/
    01-foundation/     -- Phase directories
      01-CONTEXT.md    -- Discussion context
      01-RESEARCH.md   -- Research findings
      01-01-PLAN.md    -- Execution plans
      01-01-SUMMARY.md -- Plan completion summaries
      01-VERIFICATION.md -- Phase verification
      01-UAT.md        -- User acceptance testing
    02-api/
      ...
```

### Tool Name Mappings Across Runtimes

| Claude Code | OpenCode | Gemini CLI |
|-------------|----------|------------|
| Read | read | read_file |
| Write | write | write_file |
| Edit | edit | replace |
| Bash | bash | run_shell_command |
| Glob | glob | glob |
| Grep | grep | search_file_content |
| WebSearch | websearch | google_web_search |
| WebFetch | webfetch | web_fetch |
| TodoWrite | todowrite | write_todos |
| AskUserQuestion | question | ask_user |
| SlashCommand | skill | (n/a) |
| Task | task | (excluded -- auto-registered) |
| mcp__* | mcp__* (unchanged) | (excluded -- auto-discovered) |

### Version Tracking

- The installed GSD version is written to `get-shit-done/VERSION` during installation.
- The update checker reads this file and compares against `npm view get-shit-done-cc version`.
- The file manifest records the installed version for patch persistence.
