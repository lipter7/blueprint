# Research Result: Migration and Coexistence Strategy

**Research area:** Area 7 from `02-research-planner.md`
**Status:** Complete

---

## Core Finding

Blueprint takes the simplest possible migration path: clean break from GSD, no coexistence, no backward compatibility. v1 distribution is clone-and-install from the forked repo — no npm publishing needed. The existing update system (`/gsd:update` → `workflows/update.md` → `bin/install.js`) is already excellent and gets ported to Blueprint with local-repo semantics instead of npm-registry semantics. The local patch system (SHA256 manifest hashing, backup/restore) survives intact. The only file removed for Cursor compatibility is `hooks/gsd-statusline.js` (Cursor has no statusline support).

---

## Decision 1: Clean Break — No GSD Coexistence

**Decision:** Blueprint and GSD do not coexist. Users must uninstall GSD before installing Blueprint. No migration tooling, no detection of existing GSD installations, no backward-compatibility code.

**User's reasoning:** "Let's just figure out what the easiest path forward is for this for v1. If this means just telling the user to uninstall gsd before installing blueprint then I'm fine with that."

**What this means practically:**
- The Blueprint installer does NOT check for existing GSD installations
- No `--migrate-from-gsd` flag or detection logic
- Documentation should state: "If you have GSD installed, run `npx get-shit-done-cc --uninstall --global --claude` first"
- The existing GSD uninstall logic (in `bin/install.js`) is thorough — it removes commands, agents, hooks, settings entries, and OpenCode permissions while preserving non-GSD files

**What this simplifies:**
- No need for dual-prefix support (`/gsd:` and `/bp:` simultaneously)
- No need for settings.json merging between GSD and Blueprint entries
- No need for hook coexistence logic
- The installer can assume a clean target directory (or one with only non-Blueprint files)

---

## Decision 2: `.blueprint/` Only — No `.planning/` Support

**Decision:** Blueprint only recognizes `.blueprint/` as its project artifact directory. Existing GSD projects with `.planning/` directories are not auto-detected, not migrated, not supported. Users start fresh with Blueprint.

**Why this is fine:** Blueprint is a fork focused on improving the research/plan/codebase mapping workflows. The improvements are substantial enough that existing `.planning/` artifacts (PROJECT.md, ROADMAP.md, CONTEXT.md, etc.) wouldn't cleanly map to Blueprint's enhanced workflow anyway. Starting fresh is cleaner.

**What changes from GSD:**
- All path references in templates, workflows, agents, and gsd-tools.js change from `.planning/` to `.blueprint/`
- The `init` commands in gsd-tools.js that check for `.planning/` directory existence now check `.blueprint/`
- Template path prefixes update accordingly

**What doesn't change:**
- The directory structure inside `.blueprint/` mirrors `.planning/` (same artifact layout)
- The artifact types and templates are identical (per Item 6 — all 35 templates survive)
- The layered context loading pattern is unchanged

---

## Decision 3: Clone-and-Install Distribution for v1

**Decision:** v1 distribution is: user clones the Blueprint repo (or pulls updates), then runs `node bin/install.js` from inside the repo. No npm publishing, no `npx` distribution.

**User's reasoning:** "All that I really want to have work right now is that if a person clones this blueprint repo, which is a fork of the original GSD repo, they can then run the script to install from inside the cloned repo. We don't need any sort of distribution strategy in v1. We just need something so that we can start testing and using it."

**What this changes in the installer:**
- The banner, branding, and help text change from "Get Shit Done" to "Blueprint"
- The `package.json` name changes (for version tracking, not npm publishing)
- The `bin` entry point may change for clarity
- The npm-specific parts of the install flow (like the `npx` command references in help text) get updated to `node bin/install.js`

**What stays the same:**
- The runtime selection (Claude Code, OpenCode, Gemini, and Cursor per Item 4)
- The global vs local install choice
- The file copying pipeline (`copyWithPathReplacement`, `copyFlattenedCommands`)
- The frontmatter conversion per runtime (`convertClaudeToOpencodeFrontmatter`, `convertClaudeToGeminiAgent`, `convertClaudeToGeminiToml`, and the new `convertClaudeToCursorSkill`/`convertClaudeToCursorAgent` per Item 4)
- The hooks installation (compiled from `hooks/dist/`)
- The settings.json configuration (hooks, statusline)
- The file manifest system for patch detection

---

## Decision 4: Keep the Existing Update Workflow

**Decision:** The current update system — `/gsd:update` command → `get-shit-done/workflows/update.md` → routes through `bin/install.js` — is already excellent. Port it to Blueprint as `/bp:update` → `blueprint/workflows/update.md` → `bin/install.js`.

**User's reasoning:** "The current setup for however this works is great. So the workflow triggered by `commands/gsd/update.md` (`get-shit-done/workflows/update.md`) which I believe all route through `bin/install.js` is already excellent."

**How the existing update works:**
1. `/gsd:update` command triggers `workflows/update.md`
2. Workflow detects install location (local vs global) via VERSION file
3. Checks npm registry for latest version (`npm view get-shit-done-cc version`)
4. Compares versions, fetches changelog from GitHub
5. Shows what's new, asks user confirmation via `AskUserQuestion`
6. Runs clean install: `npx get-shit-done-cc --local` or `--global`
7. Clears update cache, checks for local patches
8. Offers `/gsd:reapply-patches` if patches detected

**What changes for Blueprint's local-repo model:**
- Step 3: Instead of checking npm, detect if the local repo has newer files than the installed version. Could compare VERSION file or git HEAD hash against the installed manifest's version/timestamp.
- Step 4: Instead of fetching changelog from GitHub, read CHANGELOG.md from the local repo (already available since the user cloned it).
- Step 6: Instead of `npx get-shit-done-cc`, run `node bin/install.js` from the repo directory. The installer needs to know the repo's location — either passed as an argument, stored in config during initial install, or detected from the command's own path reference.

**What stays the same:**
- The local patch system (SHA256 manifest → detect modifications → backup → clean install → offer reapply)
- The user confirmation step
- The `/bp:reapply-patches` command for merging user modifications back
- The VERSION file tracking

**Implementation note:** The installer should store the source repo path in config.json (or in the VERSION file alongside the version) during initial install, so the update command knows where to find the repo for re-installation.

---

## Decision 5: Repo Cleanup — Keep Almost Everything

**Decision:** This is a fork. Almost nothing gets deleted. The only removal is `hooks/gsd-statusline.js` for the Cursor install path (Cursor doesn't support statusline). Documentation directories are kept for reference.

**User's reasoning:** "This repo is a fork. We don't need to delete anything at all, the only thing that should be removed is `hooks/gsd-statusline.js` for the cursor install path because cursor doesn't support statusline."

**What gets removed now:**
- `docs/workflow-example/` — User explicitly wants this removed ("can be removed")

**What stays during refactor:**
- All GSD source files (they get renamed/modified, not deleted)
- `docs/gsd-system-map/` — Valuable reference documentation of the original system
- `docs/cursor/` — Cursor compatibility research
- All other documentation

**What gets removed after refactor is complete:**
- Everything except `docs/gsd-system-map/` and `docs/cursor/` (the user said "once the refactor is complete we can remove everything else")
- This means old GSD-specific docs, any remaining unrenamed files, etc.

**Cursor-specific handling:**
- The Cursor install path skips `hooks/gsd-statusline.js` (and its compiled dist version)
- Per Item 4, all hooks for Cursor are deferred to v2
- The Cursor installer path (`--cursor` flag per Item 4) simply doesn't copy any hooks

---

## Decision 6: The Update Check Hook Adapts to Local-Repo Model

**Current state:** `hooks/gsd-check-update.js` runs at SessionStart, spawns a detached process that queries `npm view get-shit-done-cc version`, writes result to `~/.claude/cache/gsd-update-check.json`, and the statusline shows an update indicator.

**What changes for Blueprint:**
- The hook renames to `hooks/bp-check-update.js` (or `blueprint-check-update.js`)
- Instead of querying npm, it could:
  - Check if the source repo directory exists and has newer commits (via `git -C <repo-path> log -1 --format=%H`)
  - Compare against the installed manifest's version/hash
  - Or simply check if the VERSION in the repo differs from the installed VERSION
- Cache file moves to `~/.claude/cache/bp-update-check.json`
- The statusline indicator changes from `⬆ /gsd:update` to `⬆ /bp:update`

**For Cursor:** This hook is deferred to v2 (per Item 4, Decision 5). Cursor gets no session hooks in v1.

---

## The Renaming Scope

Based on codebase investigation, the GSD → Blueprint rename touches:

**Scale:** 113+ files, 2,254+ references across 6 categories:

| Category | Occurrences | Files | Example |
|----------|-------------|-------|---------|
| Command prefix `/gsd:` → `/bp:` | ~200+ | 58+ | `/gsd:plan-phase` → `/bp:plan-phase` |
| Agent names `gsd-*` → `bp-*` | ~80+ | 22 | `gsd-planner` → `bp-planner` |
| Directory `get-shit-done/` → `blueprint/` | ~40+ | 50+ | Path references throughout |
| Branding "Get Shit Done" → "Blueprint" | ~10 | 5-10 | Banner, help text, README |
| Hook names `gsd-*` → `bp-*` | ~20+ | 10+ | `gsd-statusline.js` → `bp-statusline.js` |
| Artifact path `.planning/` → `.blueprint/` | ~30+ | 20+ | Template references, init checks |

**Particularly tricky references:**
1. **MODEL_PROFILES** in gsd-tools.js — 11 agent names hardcoded in model routing, must stay in sync with renamed agent files
2. **Installer file pattern matching** — Multiple `startsWith('gsd-')` checks for cleanup/uninstall logic
3. **OpenCode compatibility conversion** — Already has `content.replace(/\/gsd:/g, '/gsd-')`, must update to `/bp:`/`/bp-`
4. **Git branch templates** — `'gsd/phase-{phase}-{slug}'` affects branch naming, needs decision on `bp/` prefix
5. **Embedded command invocations** — Workflow instructions like "run `/gsd:plan-phase 2`" scattered across workflows and templates

---

## What Changes from GSD

1. **Clean break** — No GSD coexistence, no migration tooling, no `.planning/` support
2. **Distribution model** — Clone-and-install from repo instead of npm publishing
3. **Update mechanism** — Same workflow structure, but checks local repo instead of npm registry
4. **All naming** — `gsd` → `bp`, `GSD` → `Blueprint`, `get-shit-done` → `blueprint`, `.planning/` → `.blueprint/`
5. **Cursor install path** — No statusline hook, no session hooks (deferred to v2)
6. **`docs/workflow-example/`** — Removed

## What Stays the Same

- The installer's core architecture (`bin/install.js`)
- Multi-runtime support (Claude Code, OpenCode, Gemini + Cursor)
- Global vs local install model
- Runtime-specific frontmatter conversion pipeline
- Local patch system (manifest hashing, backup, reapply)
- The update workflow structure (command → workflow → installer)
- Settings.json hook registration pattern
- Compiled hooks distribution (`hooks/dist/`)
- The uninstall command and cleanup logic (adapted for `bp-` prefix)

---

## Implications for Implementation Planning

### What's Mechanical (Can Be Batched)

- **Mass rename**: All `gsd` → `bp` prefixes across commands, agents, workflows, templates (2,254+ references). This is search-and-replace with a few categories:
  - `/gsd:` → `/bp:` (command invocations)
  - `gsd-` → `bp-` (agent/hook file prefixes)
  - `get-shit-done` → `blueprint` (directory names, package references)
  - `GSD` → `Blueprint` or `BP` (branding in prose)
  - `.planning/` → `.blueprint/` (artifact path references)
  - `Get Shit Done` → `Blueprint` (full branding)
- **Directory renames**: `get-shit-done/` → `blueprint/`, `commands/gsd/` → `commands/bp/`
- **File renames**: All `gsd-*.md` agents → `bp-*.md`
- **Package.json updates**: Name, bin entry, description
- **CLAUDE.md updates**: All GSD references → Blueprint references
- **Remove `docs/workflow-example/`**

### What Requires Design Work

- **Update workflow adaptation** — The update command/workflow needs to detect local repo changes instead of npm versions. Needs the repo source path stored during install so the update command can find it.
- **Installer Cursor path** — Per Item 4, `convertClaudeToCursorSkill()` and `convertClaudeToCursorAgent()` need to be implemented. The `--cursor` flag and its install path are new code.
- **Update check hook adaptation** — Changing from npm-based version checking to git/file-based checking for local repo model.
- **MODEL_PROFILES sync** — After agent renames, the model routing table in gsd-tools.js (→ blueprint-tools.js) must be updated in lockstep.
- **Test suite updates** — `gsd-tools.test.js` (~2000 lines) needs all references updated and tests passing.

### What's Its Own Phase

- **The full rename** is best done as a single coordinated phase — renaming files, updating references, and verifying tests pass. Doing it incrementally would create a broken state where some references point to old names and others to new.
- **The Cursor installer path** (new `--cursor` flag, skill/agent conversion, AskQuestion conversion per Item 4/4a) is a separate implementation phase that can happen before or after the rename.
- **The update workflow adaptation** (npm → local repo) is a small but distinct piece of work that should happen after the rename, since the update command itself gets renamed.

---

## Open Questions (For Other Research Areas)

None — this is the final research area. All 7 areas are now complete. The research phase is finished and the system is ready for implementation planning.
