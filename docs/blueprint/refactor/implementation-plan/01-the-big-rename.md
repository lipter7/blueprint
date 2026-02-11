# Phase 1: The Big Rename — Detailed Implementation Plan

**Parent:** `00-phase-overview.md`
**Status:** Complete

---

## Overview

Transform every GSD reference in the codebase into its Blueprint equivalent. This is ~3,600+ references across ~150 files. The phase is mostly mechanical but has several tricky spots that need manual attention. It must be done as a single coordinated pass — partial renames create a broken state.

**Naming conventions (decided in research):**

| Context | Old | New |
|---------|-----|-----|
| Package name | `get-shit-done-cc` | `@lipter7/blueprint` |
| Main directory | `get-shit-done/` | `blueprint/` |
| Command prefix | `/gsd:` | `/bp:` |
| Agent/hook prefix | `gsd-` | `bp-` |
| Tools file | `gsd-tools.js` | `blueprint-tools.js` |
| Artifact directory | `.planning/` | `.blueprint/` |
| Branding | "Get Shit Done" / "GSD" | "Blueprint" |
| Git branch prefix | `gsd/` | `bp/` |
| Cache/manifest prefix | `gsd-` | `bp-` |

---

## Execution Order

The steps below are ordered to avoid broken intermediate states and double-replacements. Content replacements go from most-specific to least-specific strings to prevent substring collisions (e.g., `gsd-tools` must be replaced before the general `gsd-` pattern).

---

## Step 1: Pre-Flight Cleanup

Remove files that are explicitly marked for deletion (Item 7, Decision 5).

**Actions:**
- Delete `docs/workflow-example/` directory
- Delete `commands/gsd/new-project.md.bak` (backup file, not needed)

**Files excluded from ALL subsequent rename steps** (kept as-is for reference):
- `docs/gsd-system-map/` — Reference docs, preserved permanently
- `docs/cursor/` — Cursor research, preserved permanently
- `docs/blueprint/refactor/` — Our research/planning docs (already use Blueprint naming)
- `CHANGELOG.md` — Historical record, don't rewrite history
- `node_modules/`, `.git/`

---

## Step 2: Directory Renames (git mv)

Rename the two top-level directories. Do these first so git tracks them as renames, not delete+create.

```
git mv get-shit-done blueprint
git mv commands/gsd commands/bp
```

**After this step:** All paths that referenced `get-shit-done/` and `commands/gsd/` in the filesystem now use `blueprint/` and `commands/bp/`. But file contents still reference the old names.

---

## Step 3: File Renames (git mv)

### 3a. Agent files (11 files)

```
agents/gsd-codebase-mapper.md    → agents/bp-codebase-mapper.md
agents/gsd-debugger.md           → agents/bp-debugger.md
agents/gsd-executor.md           → agents/bp-executor.md
agents/gsd-integration-checker.md → agents/bp-integration-checker.md
agents/gsd-phase-researcher.md   → agents/bp-phase-researcher.md
agents/gsd-plan-checker.md       → agents/bp-plan-checker.md
agents/gsd-planner.md            → agents/bp-planner.md
agents/gsd-project-researcher.md → agents/bp-project-researcher.md
agents/gsd-research-synthesizer.md → agents/bp-research-synthesizer.md
agents/gsd-roadmapper.md         → agents/bp-roadmapper.md
agents/gsd-verifier.md           → agents/bp-verifier.md
```

### 3b. Hook files (2 files)

```
hooks/gsd-check-update.js  → hooks/bp-check-update.js
hooks/gsd-statusline.js    → hooks/bp-statusline.js
```

### 3c. Core tools files (2 files)

These are now inside `blueprint/` (after Step 2):

```
blueprint/bin/gsd-tools.js      → blueprint/bin/blueprint-tools.js
blueprint/bin/gsd-tools.test.js → blueprint/bin/blueprint-tools.test.js
```

### 3d. Asset files (4 files, low priority)

```
assets/gsd-logo-2000.svg              → assets/bp-logo-2000.svg
assets/gsd-logo-2000.png              → assets/bp-logo-2000.png
assets/gsd-logo-2000-transparent.svg  → assets/bp-logo-2000-transparent.svg
assets/gsd-logo-2000-transparent.png  → assets/bp-logo-2000-transparent.png
```

**Total file renames:** 19

---

## Step 4: Content Replacements — High Specificity

These replacements target the most specific strings first to avoid substring collisions.

### 4a. `gsd-tools` → `blueprint-tools`

**Why first:** The general `gsd-` → `bp-` replacement in Step 6 would incorrectly turn `gsd-tools` into `bp-tools`. By handling this first, the string is already `blueprint-tools` when Step 6 runs.

**Scope:** ~434 occurrences across ~69 files (workflows, agents, commands, references)
**Target files:** `blueprint/workflows/*.md`, `blueprint/references/*.md`, `agents/*.md`, `commands/bp/*.md`, `blueprint/bin/blueprint-tools.js`, `blueprint/bin/blueprint-tools.test.js`, `CLAUDE.md`

**Pattern:** Replace all `gsd-tools` with `blueprint-tools` (literal string, not regex).

### 4b. `get-shit-done-cc` → `@lipter7/blueprint`

**Why before general get-shit-done:** This is the npm package name. It contains `get-shit-done` as a substring. If we did the general replacement first, it would become `blueprint-cc`, which is wrong.

**Scope:** ~15 occurrences in `package.json`, `bin/install.js`, `hooks/bp-check-update.js`, `README.md`

**Pattern:** Replace all `get-shit-done-cc` with `@lipter7/blueprint`.

---

## Step 5: Content Replacements — Medium Specificity

### 5a. `get-shit-done` → `blueprint`

**Scope:** ~652 occurrences across ~96 files — directory paths, permission strings, file references.
**Target files:** Everything except excluded docs.

**Pattern:** Replace all remaining `get-shit-done` with `blueprint`.

**Watch for:**
- `get-shit-done.git` → `blueprint.git` (in repo URLs — will need manual fix to actual repo URL)
- OpenCode permission path `~/.config/opencode/get-shit-done/*` → `~/.config/opencode/blueprint/*`

### 5b. `/gsd:` → `/bp:`

**Scope:** ~754 occurrences across ~86 files — command invocations in workflows, agents, commands, templates.
**Target files:** `blueprint/workflows/*.md`, `blueprint/templates/*.md`, `agents/*.md`, `commands/bp/*.md`, `blueprint/references/*.md`, `blueprint/bin/blueprint-tools.js`, `README.md`, `CLAUDE.md`

**Pattern:** Replace all `/gsd:` with `/bp:`.

**Watch for:** The OpenCode conversion in `bin/install.js` has a regex that converts `/gsd:` → `/gsd-` for OpenCode compatibility. This line needs manual updating (see Step 8c).

### 5c. `.planning/` → `.blueprint/`

**Scope:** ~1,318 occurrences across ~124 files — the most pervasive pattern. Artifact path references in templates, workflows, agents, tools, tests.
**Target files:** Everything except excluded docs.

**Pattern:** Replace all `.planning/` with `.blueprint/`. Also replace `.planning` (without trailing slash) with `.blueprint` where it appears as a standalone reference.

**Special attention:**
- `blueprint/bin/blueprint-tools.js` has 128 occurrences
- `blueprint/bin/blueprint-tools.test.js` has 161 occurrences (in inline test fixtures)
- `blueprint/templates/` has 130+ occurrences

---

## Step 6: Content Replacements — Agent/Hook Names

### 6a. `gsd-` → `bp-` (agent and hook name contexts)

**Scope:** After Steps 4-5, the remaining `gsd-` references are agent names, hook names, and related identifiers.

**Pattern:** Replace all remaining `gsd-` with `bp-`.

**This catches:**
- Agent names in prose: "spawn gsd-planner" → "spawn bp-planner"
- Hook references: `gsd-statusline`, `gsd-check-update`
- Cache/manifest names: `gsd-local-patches` → `bp-local-patches`, `gsd-file-manifest.json` → `bp-file-manifest.json`
- Update check cache: `gsd-update-check.json` → `bp-update-check.json`
- Orphaned file cleanup references in installer (historical filenames like `gsd-notify.sh`, `gsd-intel-index.js`)

**Why this is safe at this point:** `gsd-tools` was already converted to `blueprint-tools` in Step 4a. `get-shit-done` was converted in Step 5a. The only remaining `gsd-` strings are agent/hook names.

---

## Step 7: Content Replacements — Branding

### 7a. `Get Shit Done` → `Blueprint`

**Pattern:** Case-sensitive literal replace. Catches banner text, descriptions, README prose.

### 7b. `GSD` → `Blueprint`

**Pattern:** Case-sensitive, word-boundary-aware replace. This is the trickiest replacement — `GSD` appears in many contexts:
- Standalone branding: "GSD files", "GSD has been uninstalled" → "Blueprint files", etc.
- Comments: "// Configure OpenCode permissions to allow reading GSD reference docs"
- Help text: "Uninstall GSD"

**Do NOT blindly replace.** Review each occurrence. Some may be in contexts where "Blueprint" doesn't read correctly (e.g., "GSD file" might need to become "Blueprint file" or just "file"). Use judgment.

**Files with highest concentration:** `bin/install.js` (33), `README.md` (21), `CLAUDE.md` (multiple).

---

## Step 8: Manual Fixes (Require Human Judgment)

These cannot be done with blind search-and-replace. Each needs careful manual editing.

### 8a. `package.json`

After bulk replacements, manually verify and fix:

```json
{
  "name": "@lipter7/blueprint",
  "version": "...",
  "description": "[Updated description for Blueprint]",
  "bin": {
    "blueprint": "bin/install.js"
  },
  "scripts": {
    "test": "node --test blueprint/bin/blueprint-tools.test.js",
    "build:hooks": "node scripts/build-hooks.js",
    "prepublishOnly": "npm run build:hooks"
  },
  "files": [
    "bin",
    "commands",
    "blueprint",
    "agents",
    "hooks/dist",
    "scripts"
  ],
  "repository": {
    "type": "git",
    "url": "[actual Blueprint repo URL]"
  },
  "homepage": "[actual Blueprint repo URL]",
  "bugs": {
    "url": "[actual Blueprint repo URL]/issues"
  }
}
```

### 8b. `MODEL_PROFILES` in `blueprint/bin/blueprint-tools.js`

The model routing table at ~lines 125-137. All 11 keys must be updated:

```javascript
const MODEL_PROFILES = {
  'bp-planner':              { quality: 'opus', balanced: 'opus',   budget: 'sonnet' },
  'bp-roadmapper':           { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'bp-executor':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'bp-phase-researcher':     { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'bp-project-researcher':   { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'bp-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'bp-debugger':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'bp-codebase-mapper':      { quality: 'sonnet', balanced: 'haiku', budget: 'haiku' },
  'bp-verifier':             { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'bp-plan-checker':         { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'bp-integration-checker':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};
```

**Also update the 18 `resolveModelInternal()` calls** scattered through the file (~lines 3576-4168). These reference agent names as strings and should have been caught by Step 6a, but verify they all read `bp-*`.

### 8c. OpenCode Conversion Regex in `bin/install.js`

~Line 448 has:
```javascript
convertedContent = convertedContent.replace(/\/gsd:/g, '/gsd-');
```

This converts `/gsd:plan-phase` → `/gsd-plan-phase` for OpenCode (which uses `-` instead of `:`). After rename, this should be:
```javascript
convertedContent = convertedContent.replace(/\/bp:/g, '/bp-');
```

### 8d. Git Branch Templates in `blueprint/bin/blueprint-tools.js`

Two locations (~lines 164-165 and ~602-603):
```javascript
// Before:
phase_branch_template: 'gsd/phase-{phase}-{slug}',
milestone_branch_template: 'gsd/{milestone}-{slug}',

// After:
phase_branch_template: 'bp/phase-{phase}-{slug}',
milestone_branch_template: 'bp/{milestone}-{slug}',
```

### 8e. Installer Pattern Matching in `bin/install.js`

Multiple `startsWith('gsd-')` checks (~lines 605, 810, 841, 1192, 1356) that control file cleanup/filtering:
```javascript
// Before:
if (file.startsWith('gsd-') && file.endsWith('.md')) {

// After:
if (file.startsWith('bp-') && file.endsWith('.md')) {
```

Also the hooks array (~line 855):
```javascript
// Before:
const gsdHooks = ['gsd-statusline.js', 'gsd-check-update.js', 'gsd-check-update.sh'];

// After — also rename the variable:
const bpHooks = ['bp-statusline.js', 'bp-check-update.js', 'bp-check-update.sh'];
```

And all references to that variable.

### 8f. Installer Constants in `bin/install.js`

~Lines 1140-1141:
```javascript
// Before:
const PATCHES_DIR_NAME = 'gsd-local-patches';
const MANIFEST_NAME = 'gsd-file-manifest.json';

// After:
const PATCHES_DIR_NAME = 'bp-local-patches';
const MANIFEST_NAME = 'bp-file-manifest.json';
```

### 8g. `.gsd` Config Directory in `blueprint/bin/blueprint-tools.js`

~Lines 593 and 3738 reference a `.gsd` directory in the user's home:
```javascript
const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
```

Update to:
```javascript
const braveKeyFile = path.join(homedir, '.blueprint', 'brave_api_key');
```

**Note:** This `.blueprint` in the home directory is different from the project-level `.blueprint/` directory. Verify this is the intended behavior.

### 8h. `scripts/build-hooks.js`

Update the `HOOKS_TO_COPY` array:
```javascript
// Before:
const HOOKS_TO_COPY = [
  'gsd-check-update.js',
  'gsd-statusline.js'
];

// After:
const HOOKS_TO_COPY = [
  'bp-check-update.js',
  'bp-statusline.js'
];
```

Also update the file comment from "Copy GSD hooks" to "Copy Blueprint hooks".

### 8i. Hook File Contents

**`hooks/bp-check-update.js`** (~63 lines):
- npm package query: `npm view get-shit-done-cc version` → `npm view @lipter7/blueprint version` (should be caught by Step 4b)
- Cache filename: `gsd-update-check.json` → `bp-update-check.json` (should be caught by Step 6a)
- VERSION file path: `get-shit-done/VERSION` → `blueprint/VERSION` (should be caught by Step 5a)
- File comment: update from "GSD" to "Blueprint"

**`hooks/bp-statusline.js`** (~92 lines):
- Cache filename: `gsd-update-check.json` → `bp-update-check.json`
- Update command: `/gsd:update` → `/bp:update`
- File comment: update from "GSD" to "Blueprint"

Verify these were caught by bulk replacements. If not, fix manually.

### 8j. `CLAUDE.md`

This file is read by Claude Code as project instructions. It needs a careful manual rewrite, not just find-replace. Key changes:
- Fork context description
- Core pipeline diagram — all `/gsd:` → `/bp:`
- Key directories section — `commands/gsd/` → `commands/bp/`, `get-shit-done/` → `blueprint/`
- Agent names in the "Areas of Focus" section
- Tool references: `gsd-tools.js` → `blueprint-tools.js`
- Test command: update path
- `.planning/` → `.blueprint/` throughout

### 8k. `README.md`

Comprehensive rewrite needed:
- Title and branding
- All badge URLs (npm package name)
- All install commands (`npx @lipter7/blueprint`)
- All `/gsd:` command examples → `/bp:`
- Repository URLs
- Development setup instructions
- Uninstall commands

---

## Step 9: Test Suite Fixes

The test file (`blueprint/bin/blueprint-tools.test.js`) needs:

### 9a. Import Path Update
Line 11:
```javascript
// Before:
const TOOLS_PATH = path.join(__dirname, 'gsd-tools.js');

// After:
const TOOLS_PATH = path.join(__dirname, 'blueprint-tools.js');
```

### 9b. Fixture Path Updates
~140+ inline references to `.planning/` in test mock data need to become `.blueprint/`. These should have been caught by Step 5c, but verify.

Example patterns to check:
```javascript
// These paths appear in fs.mkdirSync, fs.writeFileSync, path.join calls:
'.planning/phases'
'.planning/phases/01-foundation'
'.planning/codebase'
'.planning/STATE.md'
'.planning/ROADMAP.md'
'.planning/PROJECT.md'
'.planning/config.json'
```

### 9c. Run Tests and Fix Failures
```bash
npm test
```

Fix any remaining failures. The tests use subprocess invocation (`execSync` calling `node blueprint-tools.js <command>`), so the primary failure modes are:
1. Wrong file path in TOOLS_PATH
2. `.planning/` paths in fixtures not updated
3. Any assertion strings that reference old names

---

## Step 10: Verification

### 10a. Grep Audit

Search for any remaining GSD references in source files (excluding docs kept for reference):

```bash
# Should return zero results from source files:
grep -r "gsd-" agents/ commands/ blueprint/ hooks/ scripts/ bin/ --include="*.js" --include="*.md"
grep -r "/gsd:" agents/ commands/ blueprint/ hooks/ scripts/ bin/ --include="*.js" --include="*.md"
grep -r "get-shit-done" agents/ commands/ blueprint/ hooks/ scripts/ bin/ package.json CLAUDE.md
grep -r "\.planning/" agents/ commands/ blueprint/ hooks/ scripts/ bin/ --include="*.js" --include="*.md"
grep -r "Get Shit Done" agents/ commands/ blueprint/ hooks/ scripts/ bin/ CLAUDE.md README.md
```

Acceptable remaining references:
- `docs/gsd-system-map/` content (preserved as reference)
- `docs/cursor/` content (preserved as reference)
- `CHANGELOG.md` (historical record)
- Comments in `bin/install.js` referencing old hook names for backward-compatible cleanup (e.g., "Removed in v1.6.x" orphan list)

### 10b. Test Pass

```bash
npm test
```

All 82 test cases must pass.

### 10c. Local Install Test

```bash
node bin/install.js
```

Verify:
- Runtime selection menu works
- Files install to correct paths (`blueprint/` not `get-shit-done/`)
- Hook commands reference `bp-` prefixed files
- Settings.json entries are correct
- Manifest file is named `bp-file-manifest.json`

### 10d. Build Hooks

```bash
npm run build:hooks
```

Verify `hooks/dist/bp-check-update.js` and `hooks/dist/bp-statusline.js` are produced.

---

## Replacement Summary Table

Execution order matters. Do these in sequence:

| Order | Pattern | Replacement | ~Count | Reason for ordering |
|-------|---------|-------------|--------|-------------------|
| 1 | `gsd-tools` | `blueprint-tools` | 434 | Prevent `gsd-` catch turning it into `bp-tools` |
| 2 | `get-shit-done-cc` | `@lipter7/blueprint` | 15 | Prevent `get-shit-done` catch turning it into `blueprint-cc` |
| 3 | `get-shit-done` | `blueprint` | 652 | Directory/path references |
| 4 | `/gsd:` | `/bp:` | 754 | Command prefix |
| 5 | `.planning/` | `.blueprint/` | 1,318 | Artifact paths (also `.planning` without slash) |
| 6 | `gsd-` | `bp-` | ~250 | Agent/hook names (safe now that gsd-tools is gone) |
| 7 | `Get Shit Done` | `Blueprint` | ~20 | Full branding |
| 8 | `GSD` | `Blueprint` | ~150 | Abbreviation (review each — not all are blind-replaceable) |

**Total: ~3,600 replacements**

---

## Files with Highest Concentration

These files need the most changes and should get extra review attention:

| File | ~Refs | Primary patterns |
|------|-------|-----------------|
| `blueprint/bin/blueprint-tools.js` | 400+ | `.planning/`, `gsd-tools`, MODEL_PROFILES, resolveModelInternal, branch templates |
| `blueprint/bin/blueprint-tools.test.js` | 300+ | `.planning/` in fixtures, tool path reference |
| `bin/install.js` | 100+ | Branding, paths, patterns, hooks, constants, settings |
| `README.md` | 80+ | Branding, commands, URLs, install instructions |
| `CLAUDE.md` | 30+ | Pipeline, directories, agent names, tool references |
| `blueprint/templates/*.md` (30+ files) | 130+ | `.planning/` paths |
| `blueprint/workflows/*.md` (50+ files) | 200+ | `/gsd:`, `gsd-tools`, `.planning/` |
| `agents/*.md` (11 files) | 80+ | Agent names, tool references, command references |
| `commands/bp/*.md` (28 files) | 100+ | `/gsd:` commands, tool references |

---

## Risk Mitigation

**Risk: Missing a reference breaks something silently.**
Mitigation: Step 10a grep audit catches stale references. Step 10b-c catches runtime failures.

**Risk: Double-replacement corrupts strings.**
Mitigation: Ordered replacement strategy (Steps 4-7) goes from most-specific to least-specific.

**Risk: Test fixtures have subtle path differences.**
Mitigation: Step 9b explicitly checks all fixture patterns. Tests use subprocess invocation so failures are caught by assertion mismatches.

**Risk: Installer writes wrong paths to user's system.**
Mitigation: Step 10c local install test verifies installed file paths and contents.

**Risk: Orphan cleanup list in installer references old filenames.**
The installer has a list of historically removed files (like `gsd-notify.sh`, `gsd-intel-index.js`) used for cleanup. These are intentional references to old filenames that were shipped in past GSD versions. **Decision needed:** Should these stay as-is (they clean up old GSD artifacts from users who upgrade) or be removed (Blueprint has no upgrade path from GSD)? Per Item 7 Decision 1 (clean break), these can likely be removed or left as comments since Blueprint users won't have old GSD files.

---

## Estimated Scope

- **Directory renames:** 2
- **File renames:** 19
- **Bulk content replacements:** ~3,600 across ~150 files
- **Manual fixes:** 11 specific areas (Steps 8a-8k)
- **Test fixes:** 1 import path + verification of ~140 fixture paths
- **Verification steps:** 4 (grep audit, test pass, local install, build hooks)

---

## Dependency Graph

Steps have strict ordering constraints. This graph shows what blocks what:

```
Step 1: Pre-Flight Cleanup
  │
  ▼
Step 2: Directory Renames ◄── GATE: nothing can proceed until dirs are moved
  │
  ▼
Step 3: File Renames ◄── GATE: nothing can proceed until files are at new paths
  │
  ▼
Steps 4–7: Bulk Content Replacements ◄── STRICTLY SEQUENTIAL (ordering prevents corruption)
  │  4a: gsd-tools → blueprint-tools
  │  4b: get-shit-done-cc → @lipter7/blueprint
  │  5a: get-shit-done → blueprint
  │  5b: /gsd: → /bp:
  │  5c: .planning/ → .blueprint/
  │  6a: gsd- → bp-
  │  7a: Get Shit Done → Blueprint
  │  7b: GSD → Blueprint
  │
  ▼
Step 8: Manual Fixes ◄── PARALLELIZABLE (see sub-agent breakdown below)
  │
  │  ┌─────────────┬──────────────┬──────────────┬──────────────┐
  │  ▼             ▼              ▼              ▼              ▼
  │  Group A       Group B        Group C        Group D        Group E
  │  tools.js      install.js     CLAUDE+README  small configs  test suite
  │  (8b,8d,8g)    (8c,8e,8f)     (8j,8k)        (8a,8h,8i)     (9a,9b)
  │  └─────────────┴──────────────┴──────────────┴──────────────┘
  │                         │ all must complete
  ▼                         ▼
Step 9c: Run Tests ◄── GATE: blocks on ALL Step 8 groups + 9a/9b
  │
  ▼
Step 10: Verification ◄── GATE: final, blocks on everything
```

### Blocking Summary

| Step | Blocks | Blocked By | Can Parallelize? |
|------|--------|------------|-----------------|
| 1 | 2 | nothing | No (trivial, just do it) |
| 2 | 3 | 1 | No (2 git mv commands) |
| 3 | 4-7 | 2 | Sub-parts 3a-3d are independent, but all are fast git mv's — not worth parallelizing |
| 4a | 4b | 3 | **No** — must run before any other replacement |
| 4b | 5a | 4a | **No** — strict sequence |
| 5a-5c | 6a | 4b | **No** — strict sequence |
| 6a | 7a | 5c | **No** — strict sequence |
| 7a-7b | 8 | 6a | **No** — strict sequence |
| 8 (groups) | 9c | 7b | **Yes** — 5 groups in parallel |
| 9a-9b | 9c | 7b | Yes — can run as part of parallel group |
| 9c | 10 | all of 8 + 9a-9b | No (single test run) |
| 10 | nothing | 9c | Sub-checks are independent but fast |

---

## Sub-Agent Decomposition

### What the Orchestrator Does Directly

**Steps 1–7 and 9c–10 are orchestrator work.** These are either:
- Sequential bash operations (file moves, text replacements)
- Verification steps that need the full picture
- Fast enough that sub-agent overhead isn't worth it

The orchestrator runs Steps 1-7 as a single scripted sequence. Steps 4-7 (the 8 replacement passes) can be a single bash script that processes all ~150 files in order. The entire sequence from Step 1 through Step 7 should complete in under 2 minutes.

**Orchestrator script for Steps 1–7:**

```bash
# Step 1: Cleanup
rm -rf docs/workflow-example
rm -f commands/gsd/new-project.md.bak

# Step 2: Directory renames
git mv get-shit-done blueprint
git mv commands/gsd commands/bp

# Step 3: File renames
# 3a: Agents
for f in agents/gsd-*.md; do
  newname=$(echo "$f" | sed 's/gsd-/bp-/')
  git mv "$f" "$newname"
done
# 3b: Hooks
git mv hooks/gsd-check-update.js hooks/bp-check-update.js
git mv hooks/gsd-statusline.js hooks/bp-statusline.js
# 3c: Tools
git mv blueprint/bin/gsd-tools.js blueprint/bin/blueprint-tools.js
git mv blueprint/bin/gsd-tools.test.js blueprint/bin/blueprint-tools.test.js
# 3d: Assets
for f in assets/gsd-*.svg assets/gsd-*.png; do
  newname=$(echo "$f" | sed 's/gsd-/bp-/')
  git mv "$f" "$newname"
done

# Steps 4–7: Bulk replacements (STRICT ORDER)
# Define target directories (exclude docs kept for reference)
TARGETS="agents commands/bp blueprint hooks scripts bin/install.js package.json CLAUDE.md README.md"

# 4a: gsd-tools → blueprint-tools (MUST be first)
find $TARGETS -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) \
  -exec sed -i '' 's/gsd-tools/blueprint-tools/g' {} +

# 4b: get-shit-done-cc → @lipter7/blueprint (before general get-shit-done)
find $TARGETS -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) \
  -exec sed -i '' 's/get-shit-done-cc/@lipter7\/blueprint/g' {} +

# 5a: get-shit-done → blueprint
find $TARGETS -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) \
  -exec sed -i '' 's/get-shit-done/blueprint/g' {} +

# 5b: /gsd: → /bp:
find $TARGETS -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) \
  -exec sed -i '' 's/\/gsd:/\/bp:/g' {} +

# 5c: .planning/ → .blueprint/ (and .planning without slash)
find $TARGETS -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) \
  -exec sed -i '' 's/\.planning\//\.blueprint\//g' {} +
find $TARGETS -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) \
  -exec sed -i '' 's/\.planning/\.blueprint/g' {} +

# 6a: gsd- → bp- (safe now — gsd-tools already converted)
find $TARGETS -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) \
  -exec sed -i '' 's/gsd-/bp-/g' {} +

# 7a: Get Shit Done → Blueprint
find $TARGETS -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) \
  -exec sed -i '' 's/Get Shit Done/Blueprint/g' {} +

# 7b: GSD → Blueprint (this one needs review — see note below)
# CAUTION: Only apply to known-safe files. Manual review recommended.
find $TARGETS -type f \( -name '*.md' -o -name '*.js' -o -name '*.json' \) \
  -exec sed -i '' 's/\bGSD\b/Blueprint/g' {} +
```

**Important note on the script:** This is a reference template, not a copy-paste-and-run script. The `sed -i ''` syntax is macOS-specific. The `\b` word boundary in 7b may not work in all sed versions. The orchestrator agent should adapt this to whatever tool works (sed, perl, node script, or the Edit tool for smaller batches). Step 7b (`GSD` → `Blueprint`) should be reviewed after running since not all occurrences may read correctly as "Blueprint" (e.g., "GSD file" → "Blueprint file" vs just "file").

### What Sub-Agents Do (Step 8 — Parallel Manual Fixes)

After Steps 1-7 complete, the orchestrator spawns **5 sub-agents in parallel**. Each handles a group of files that no other agent touches. No two agents ever edit the same file.

---

#### Sub-Agent A: `blueprint-tools.js` Manual Fixes

**File:** `blueprint/bin/blueprint-tools.js` (~4,600 lines)
**Handles:** Steps 8b, 8d, 8g
**Estimated edits:** ~35

**Prompt for spawning:**

```
You are editing blueprint/bin/blueprint-tools.js to complete the GSD → Blueprint
rename. The bulk replacements (Steps 4-7) have already run, converting most
references. Your job is to verify and fix the structural references that need
manual attention:

1. MODEL_PROFILES (~line 125-137): Verify all 11 keys read 'bp-*' not 'gsd-*'.
   Expected keys: bp-planner, bp-roadmapper, bp-executor, bp-phase-researcher,
   bp-project-researcher, bp-research-synthesizer, bp-debugger, bp-codebase-mapper,
   bp-verifier, bp-plan-checker, bp-integration-checker.

2. resolveModelInternal() calls (~18 calls, lines 3576-4168): Verify every agent
   name string argument reads 'bp-*'.

3. Git branch templates (2 locations, ~lines 164-165 and ~602-603): Verify they
   read 'bp/phase-{phase}-{slug}' and 'bp/{milestone}-{slug}' (not 'gsd/').

4. .gsd config directory (~lines 593 and 3738): Verify the homedir path reads
   '.blueprint' not '.gsd'. Example: path.join(homedir, '.blueprint', 'brave_api_key')

5. User-facing slash commands in template strings (~lines 2571, 2641, 3435):
   Verify they read '/bp:plan-phase', '/bp:discuss-phase' etc.

6. General scan: Grep the file for any remaining 'gsd' (case-insensitive).
   Fix any stragglers. Report what you found.

Do NOT edit any other file. Only edit blueprint/bin/blueprint-tools.js.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

#### Sub-Agent B: `install.js` Manual Fixes

**File:** `bin/install.js` (~1,740 lines)
**Handles:** Steps 8c, 8e, 8f
**Estimated edits:** ~25

**Prompt for spawning:**

```
You are editing bin/install.js to complete the GSD → Blueprint rename. The bulk
replacements (Steps 4-7) have already run. Your job is to verify and fix the
structural references that need manual attention:

1. OpenCode conversion regex (~line 448): Should read
   convertedContent.replace(/\/bp:/g, '/bp-')
   (converts /bp:command to /bp-command for OpenCode format).

2. startsWith pattern checks (~lines 605, 810, 841, 1192, 1356): All should
   check for 'bp-' not 'gsd-'. Example: file.startsWith('bp-') && file.endsWith('.md')

3. Hook array variable (~line 855): Should be named bpHooks (not gsdHooks) and
   contain ['bp-statusline.js', 'bp-check-update.js', 'bp-check-update.sh'].
   Update all references to this variable name throughout the file.

4. Constants (~lines 1140-1141): Verify:
   PATCHES_DIR_NAME = 'bp-local-patches'
   MANIFEST_NAME = 'bp-file-manifest.json'

5. Hook command construction (~lines 1438-1442): Verify references to
   'bp-statusline.js' and 'bp-check-update.js' in buildHookCommand calls.

6. Settings.json hook registration (~lines 1464-1476): Verify hook command
   strings reference 'bp-check-update'.

7. Orphaned file cleanup list (~lines 699-721): These reference old GSD filenames
   like 'gsd-notify.sh'. Since Blueprint has no upgrade path from GSD (clean break,
   Item 7), remove or comment out these historical cleanup entries.

8. Banner and help text: Verify branding reads "Blueprint" not "Get Shit Done"
   or "GSD". Install command examples should show 'npx @lipter7/blueprint'.

9. General scan: Grep the file for any remaining 'gsd' (case-insensitive).
   Fix any stragglers. Report what you found.

Do NOT edit any other file. Only edit bin/install.js.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

#### Sub-Agent C: `CLAUDE.md` + `README.md` Rewrites

**Files:** `CLAUDE.md`, `README.md`
**Handles:** Steps 8j, 8k
**Estimated edits:** Major prose rewrites

**Prompt for spawning:**

```
You are rewriting CLAUDE.md and README.md to complete the GSD → Blueprint rename.
The bulk replacements (Steps 4-7) have already run and converted most literal
strings. Your job is to do a careful editorial pass ensuring these user-facing
documents read coherently as Blueprint documentation, not as GSD docs with
find-replaced strings.

For CLAUDE.md:
- This file is read by Claude Code as project instructions. It must be accurate.
- Verify the "Fork Context" section describes Blueprint's relationship to GSD
- Core pipeline diagram: all commands should show /bp: prefix
- Key directories: commands/bp/, blueprint/, agents/
- Agent names: bp-planner, bp-executor, bp-verifier, etc.
- Tool references: blueprint-tools.js, blueprint-tools.test.js
- Build command: npm test should reference blueprint/bin/blueprint-tools.test.js
- .planning/ should be .blueprint/ throughout
- The "Areas of Focus for This Fork" section should reference bp- agent names
  and commands/bp/ paths

For README.md:
- Title and branding: "Blueprint" (mention it's a fork of GSD)
- Badge URLs: npm package is @lipter7/blueprint
- Install command: npx @lipter7/blueprint
- All command examples: /bp:new-project, /bp:plan-phase, etc.
- Repository URLs: update to actual Blueprint repo URL (if known, otherwise
  leave a [TODO] placeholder)
- Development setup: git clone of Blueprint repo, cd blueprint
- Uninstall: npx @lipter7/blueprint --uninstall

Read each file, then rewrite for coherence. Don't just check individual strings —
read whole paragraphs and ensure they make sense with "Blueprint" replacing "GSD".

Do NOT edit any other file. Only edit CLAUDE.md and README.md.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

#### Sub-Agent D: Small Config Files

**Files:** `package.json`, `scripts/build-hooks.js`, `hooks/bp-check-update.js`, `hooks/bp-statusline.js`
**Handles:** Steps 8a, 8h, 8i
**Estimated edits:** ~15

**Prompt for spawning:**

```
You are verifying and fixing 4 small config/script files after the bulk GSD →
Blueprint rename (Steps 4-7 have already run).

1. package.json — Verify these fields are correct:
   - "name": "@lipter7/blueprint"
   - "bin": { "blueprint": "bin/install.js" }
   - "scripts.test": "node --test blueprint/bin/blueprint-tools.test.js"
   - "files" array includes "blueprint" (not "get-shit-done")
   - "description": update to describe Blueprint
   - "repository", "homepage", "bugs": update URLs (use placeholder if unknown)
   - No remaining 'gsd' or 'get-shit-done' strings

2. scripts/build-hooks.js — Verify:
   - HOOKS_TO_COPY array contains 'bp-check-update.js' and 'bp-statusline.js'
   - File comment says "Blueprint hooks" not "GSD hooks"
   - No remaining 'gsd' strings

3. hooks/bp-check-update.js — Verify:
   - npm view command queries '@lipter7/blueprint' not 'get-shit-done-cc'
   - Cache filename is 'bp-update-check.json'
   - VERSION file path uses 'blueprint/VERSION' not 'get-shit-done/VERSION'
   - Comments say "Blueprint" not "GSD"

4. hooks/bp-statusline.js — Verify:
   - Cache filename is 'bp-update-check.json'
   - Update command shows '/bp:update' not '/gsd:update'
   - Comments say "Blueprint" not "GSD"

For each file: read it, grep for any remaining 'gsd' (case-insensitive), fix
any issues, and report what you found.

Do NOT edit any other file.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

#### Sub-Agent E: Test Suite Verification

**File:** `blueprint/bin/blueprint-tools.test.js` (~2,000 lines)
**Handles:** Steps 9a, 9b
**Estimated edits:** 1-5 (most should already be caught by bulk replacements)

**Prompt for spawning:**

```
You are verifying the test suite after the bulk GSD → Blueprint rename. The bulk
replacements (Steps 4-7) should have caught most references. Your job is to verify
nothing was missed.

File: blueprint/bin/blueprint-tools.test.js

1. TOOLS_PATH (~line 11): Must read:
   const TOOLS_PATH = path.join(__dirname, 'blueprint-tools.js');
   (not 'gsd-tools.js')

2. Grep the entire file for '.planning' — should be zero results. All fixture
   paths should use '.blueprint/'. The bulk replacement should have caught these
   (~140+ occurrences), but verify.

3. Grep for 'gsd' (case-insensitive) — should be zero results in test logic.
   (May appear in comments about the rename — that's acceptable.)

4. Grep for 'get-shit-done' — should be zero results.

5. Check that test fixture directory structures use '.blueprint/phases/' not
   '.planning/phases/' in all fs.mkdirSync and fs.writeFileSync calls.

Report: List any remaining references you found and fixed, or confirm the file
is clean.

Do NOT edit any other file. Only edit blueprint/bin/blueprint-tools.test.js.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

### Orchestrator Flow: Putting It All Together

This is the complete sequence the orchestrator follows when executing Phase 1:

```
ORCHESTRATOR: Steps 1-3 (file operations)
  │  Run cleanup, directory renames, file renames via Bash.
  │  ~30 seconds.
  │
  ▼
ORCHESTRATOR: Steps 4-7 (bulk replacements)
  │  Run the 8 replacement passes sequentially via Bash script.
  │  ~1-2 minutes.
  │
  ▼
ORCHESTRATOR: Spawn 5 sub-agents in parallel ◄── SINGLE MESSAGE with 5 Task calls
  │
  │  ┌──────────────────────────────────────────────────────────────┐
  │  │  Sub-Agent A: blueprint-tools.js fixes                      │
  │  │  Sub-Agent B: install.js fixes                              │
  │  │  Sub-Agent C: CLAUDE.md + README.md rewrites                │
  │  │  Sub-Agent D: small config files (package.json, hooks, etc) │
  │  │  Sub-Agent E: test suite verification                       │
  │  └──────────────────────────────────────────────────────────────┘
  │       All 5 run simultaneously. No file conflicts (each owns its files).
  │
  ▼  (wait for all 5 to complete)
ORCHESTRATOR: Step 9c — Run tests
  │  npm test
  │  If failures: analyze output, determine which agent's file has the issue,
  │  fix directly or re-spawn a targeted agent.
  │
  ▼
ORCHESTRATOR: Step 10 — Verification
  │  10a: Grep audit (scan for remaining 'gsd' references)
  │  10b: Confirm tests pass
  │  10c: Local install test (node bin/install.js)
  │  10d: Build hooks (npm run build:hooks)
  │
  ▼
DONE — Phase 1 complete. Ready to commit.
```

### How to Spawn the Sub-Agents

Use a **single message** with **5 parallel Task tool calls**. This is critical — sending them in one message ensures they all launch simultaneously rather than sequentially.

```
Message from orchestrator contains 5 tool calls:

Task(
  description: "Fix blueprint-tools.js manual refs",
  subagent_type: "general-purpose",
  mode: "dontAsk",
  prompt: [Sub-Agent A prompt from above]
)

Task(
  description: "Fix install.js manual refs",
  subagent_type: "general-purpose",
  mode: "dontAsk",
  prompt: [Sub-Agent B prompt from above]
)

Task(
  description: "Rewrite CLAUDE.md and README.md",
  subagent_type: "general-purpose",
  mode: "dontAsk",
  prompt: [Sub-Agent C prompt from above]
)

Task(
  description: "Fix small config files",
  subagent_type: "general-purpose",
  mode: "dontAsk",
  prompt: [Sub-Agent D prompt from above]
)

Task(
  description: "Verify test suite refs",
  subagent_type: "general-purpose",
  mode: "dontAsk",
  prompt: [Sub-Agent E prompt from above]
)
```

All 5 return results. The orchestrator reads the results, then proceeds to Step 9c.

### Failure Recovery

**If a sub-agent reports remaining `gsd` references it couldn't resolve:**
The orchestrator fixes them directly (they're in a known file) or asks the user.

**If `npm test` fails after all sub-agents complete:**
1. Read the test output to identify which test(s) failed
2. Determine which file has the issue (usually blueprint-tools.js or the test file)
3. Fix directly — most failures will be missed string references
4. Re-run tests

**If the grep audit finds stale references:**
Fix them directly. At this point the orchestrator knows the full picture and can make targeted edits.

**If the local install test (`node bin/install.js`) fails:**
The issue is in `bin/install.js`. Read the error, fix the reference, re-test.

---

## Work Breakdown Summary

| Who | Steps | Nature | Duration Estimate |
|-----|-------|--------|----------|
| Orchestrator | 1–7 | Sequential bash: file moves + bulk text replacement | Fast |
| Sub-Agent A | 8b, 8d, 8g | Manual fixes in blueprint-tools.js (4,600 lines) | Medium |
| Sub-Agent B | 8c, 8e, 8f | Manual fixes in install.js (1,740 lines) | Medium |
| Sub-Agent C | 8j, 8k | Prose rewrites of CLAUDE.md + README.md | Medium |
| Sub-Agent D | 8a, 8h, 8i | Verify/fix 4 small files | Fast |
| Sub-Agent E | 9a, 9b | Verify test suite references | Fast |
| Orchestrator | 9c, 10 | Run tests, grep audit, install test, build hooks | Fast |
