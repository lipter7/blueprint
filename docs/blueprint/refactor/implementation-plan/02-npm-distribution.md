# Phase 2: npm Distribution & Install Verification — Detailed Implementation Plan

**Parent:** `00-phase-overview.md`
**Status:** Draft

---

## Overview

Publish `@lipter7/blueprint` to npm and verify the full install/update/patch lifecycle works end-to-end. This is the smallest phase by code changes, but it requires fixing several Phase 1 leftovers discovered during investigation, a version decision, and a comprehensive manual verification matrix.

**What's new vs GSD:** Nothing architecturally. The distribution infrastructure (npm publishing, `npx` install, version checking, SHA256 manifest hashing, backup/restore) carries over unchanged. This phase verifies it all works under the new name.

**Key finding from investigation:** Three GSD references survived Phase 1's bulk rename in the update workflow files, and the CHANGELOG.md was intentionally excluded from Phase 1 but now needs attention for a clean first publish.

---

## Pre-Requisites

- Phase 1 complete (all tests passing, grep audit clean)
- npm account access for `@lipter7` scope
- `npm login` completed on the publishing machine

---

## Execution Order

Steps are ordered by dependency: fix issues first, then publish, then verify.

---

## Step 1: Fix Phase 1 Leftovers in Update Workflow

Three GSD references survived the Phase 1 bulk rename. These are in files that will be installed to user machines and would cause confusing display during updates.

### 1a. `commands/bp/update.md` — Line 2

**Current:**
```yaml
name: gsd:update
```

**Fix:**
```yaml
name: bp:update
```

**Why missed:** The `name:` frontmatter field uses a colon (`:`) as part of the command name, not as a separator. The Phase 1 replacement pattern `/gsd:` → `/bp:` only matched the slash-prefixed form. This is `gsd:` without a leading slash.

### 1b. `blueprint/workflows/update.md` — Lines 120, 127

**Current (line 120):**
```
- `commands/gsd/` will be wiped and replaced
```

**Fix:**
```
- `commands/bp/` will be wiped and replaced
```

**Current (line 127):**
```
- Custom commands not in `commands/gsd/` ✓
```

**Fix:**
```
- Custom commands not in `commands/bp/` ✓
```

**Why missed:** These are prose references in backtick-quoted strings within markdown. The Phase 1 `get-shit-done` → `blueprint` replacement caught the directory references, but these lines use the already-shortened `gsd` form as a directory name (`commands/gsd/`), which the `/gsd:` → `/bp:` pattern didn't match (different context — directory path vs command prefix). The `gsd-` → `bp-` pattern also didn't match because there's no hyphen — it's `gsd/`.

### 1c. Verification

After fixes, grep for any remaining `gsd` in these two files:

```bash
grep -i 'gsd' commands/bp/update.md blueprint/workflows/update.md
```

Expected: zero results.

---

## Step 2: Version Decision & Bump

**Decision required:** What version number for the first Blueprint publish?

### Option A: `2.0.0` (Recommended)

Blueprint is a clean break from GSD (Item 7, Decision 1). Semantic versioning says major version bump for breaking changes. Since Blueprint does not coexist with GSD and uses different names everywhere, `2.0.0` signals the fork clearly.

**Changes:**
- `package.json` line 3: `"version": "1.18.0"` → `"version": "2.0.0"`

### Option B: Keep `1.18.0`

Continue GSD's version lineage. Simpler, but the version history from 1.0.0-1.18.0 is GSD's history, not Blueprint's.

### Option C: `0.1.0`

Signal that Blueprint is pre-release. Appropriate if the Phase 3-5 features are considered required for a "real" v1.

**Note:** The VERSION file is not in the source repo — it's generated during `install()` at line 1416 of `bin/install.js` from `pkg.version`. Changing `package.json` is the only required edit.

---

## Step 3: CHANGELOG.md Preparation

CHANGELOG.md was intentionally preserved during Phase 1 (historical record). For the first Blueprint publish, it needs:

### 3a. Add Blueprint Fork Entry

Add a new entry at the top under `[Unreleased]`:

```markdown
## [2.0.0] - YYYY-MM-DD

### Changed
- **Forked from GSD (Get Shit Done)** as Blueprint
- Renamed all references: `gsd` → `bp`, `get-shit-done` → `blueprint`, `.planning/` → `.blueprint/`
- Package renamed from `get-shit-done-cc` to `@lipter7/blueprint`
- Command prefix changed from `/gsd:` to `/bp:`
- Agent prefix changed from `gsd-` to `bp-`
- Artifact directory changed from `.planning/` to `.blueprint/`

### Removed
- `docs/workflow-example/` directory
```

### 3b. Update Header Line

**Current (line 3):**
```
All notable changes to GSD will be documented in this file.
```

**Fix:**
```
All notable changes to Blueprint will be documented in this file.
```

### 3c. Update Footer URLs

Lines 1209-1365 contain release URLs. Two changes needed:

1. **`[Unreleased]` compare URL (line 1209):**
   ```
   [Unreleased]: https://github.com/glittercowboy/blueprint/compare/v2.0.0...HEAD
   ```

2. **Add `[2.0.0]` release URL:**
   ```
   [2.0.0]: https://github.com/glittercowboy/blueprint/releases/tag/v2.0.0
   ```

**Historical URLs (lines 1210-1365):** Leave as-is. These point to `glittercowboy/get-shit-done/releases/tag/vX.Y.Z` which is the upstream GSD repo. These are historical references to the forked project and changing them would break the links (those releases exist on the upstream repo, not the Blueprint fork). The links serve as a historical record.

### 3d. CHANGELOG Content — Leave GSD References As-Is

The body of the CHANGELOG (lines 9-1207) contains GSD-era entries with `/gsd:` commands, `gsd-tools`, `.planning/` paths, etc. **Do not rename these.** They are historical records of what changed in each version. Rewriting history would make the changelog inaccurate.

### 3e. Update Workflow Changelog URL

`blueprint/workflows/update.md` line 182 contains a changelog link:

**Current:**
```
[View full changelog](https://github.com/glittercowboy/blueprint/blob/main/CHANGELOG.md)
```

This URL is already correct (points to the Blueprint fork repo). No change needed.

---

## Step 4: Build Hooks

The `prepublishOnly` script handles this automatically during `npm publish`, but verify it manually first:

```bash
npm run build:hooks
```

**Verify output:**
- `hooks/dist/bp-check-update.js` exists and is current
- `hooks/dist/bp-statusline.js` exists and is current

**Note:** `hooks/dist/` is in `.gitignore` (not committed to git) but IS in the `files` array of `package.json` (published to npm). The `prepublishOnly` script ensures they're built fresh before every publish.

---

## Step 5: Pre-Publish Dry Run

Before publishing to npm, verify what will be included in the package:

```bash
npm pack --dry-run
```

**Expected output:** ~125 files across these directories:
- `bin/install.js` — The CLI entry point
- `commands/bp/*.md` — 28+ command definitions
- `blueprint/` — Workflows, templates, references, bin/
- `agents/bp-*.md` — 11 agent definitions
- `hooks/dist/` — 2 compiled hooks
- `scripts/build-hooks.js` — Hook build script
- `package.json`, `LICENSE`, `README.md`

**Verify:**
- No `.env`, credential, or secret files
- No `node_modules/`
- No `docs/` directory (not in `files` array)
- No `.git/` directory
- `blueprint/bin/blueprint-tools.test.js` IS included (it's inside the `blueprint/` directory which is in the `files` array — this is acceptable, adds ~77KB)
- `CLAUDE.md` is NOT included (in `.gitignore` and not in `files` array)

**Check package size:**

```bash
npm pack
ls -lh lipter7-blueprint-*.tgz
```

Expected: ~300-350 KB tarball. If significantly larger, investigate what unexpected files are included.

---

## Step 6: Publish to npm

```bash
npm publish --access public
```

**Why `--access public`:** Scoped packages (`@lipter7/*`) default to private on npm. The `--access public` flag is required on the first publish. Subsequent publishes inherit the access level.

**Verify publication:**

```bash
npm view @lipter7/blueprint version
```

Expected output: `2.0.0` (or whichever version was chosen in Step 2).

```bash
npm view @lipter7/blueprint
```

Verify: name, version, description, bin entry, homepage all look correct.

---

## Step 7: Test Fresh Install (Global — Claude Code)

This is the primary install path. Test on a clean machine or in a directory without prior Blueprint installation.

```bash
npx @lipter7/blueprint --claude --global
```

**Verification checklist:**

| Check | How to Verify | Expected |
|-------|--------------|----------|
| Banner displays | Visual | "BLUEPRINT" ASCII art with correct version |
| Commands installed | `ls ~/.claude/commands/bp/` | 28+ `.md` files |
| Blueprint dir installed | `ls ~/.claude/blueprint/` | workflows/, templates/, references/, bin/ |
| Agents installed | `ls ~/.claude/agents/bp-*.md` | 11 agent files |
| VERSION file written | `cat ~/.claude/blueprint/VERSION` | `2.0.0` |
| Manifest file written | `cat ~/.claude/bp-file-manifest.json \| head -5` | JSON with version and timestamp |
| Hooks installed | `ls ~/.claude/hooks/bp-*.js` | `bp-check-update.js`, `bp-statusline.js` |
| CHANGELOG installed | `test -f ~/.claude/blueprint/CHANGELOG.md` | File exists |
| Settings.json updated | `cat ~/.claude/settings.json` | SessionStart hook for `bp-check-update.js` |
| Path references correct | `grep '~/.claude/' ~/.claude/commands/bp/update.md` (should be absolute path for global) | Paths use `~/.claude/` or full absolute path |

---

## Step 8: Test Fresh Install (Local — Claude Code)

```bash
mkdir /tmp/blueprint-test && cd /tmp/blueprint-test
npx @lipter7/blueprint --claude --local
```

**Verification checklist:**

| Check | How to Verify | Expected |
|-------|--------------|----------|
| Commands installed | `ls .claude/commands/bp/` | 28+ `.md` files |
| Blueprint dir installed | `ls .claude/blueprint/` | workflows/, templates/, references/ |
| Agents installed | `ls .claude/agents/bp-*.md` | 11 agent files |
| VERSION file written | `cat .claude/blueprint/VERSION` | `2.0.0` |
| Manifest file written | `test -f .claude/bp-file-manifest.json` | File exists |
| Path references correct | `grep './.claude/' .claude/commands/bp/update.md` | Paths use `./.claude/` (relative) |

**Cleanup after test:**
```bash
rm -rf /tmp/blueprint-test
```

---

## Step 9: Test Update Check Hook

After a global install (Step 7), the update check hook should work:

### 9a. Manually Trigger Hook

```bash
node ~/.claude/hooks/bp-check-update.js
```

Wait 2-3 seconds (it spawns a background process), then:

```bash
cat ~/.claude/cache/bp-update-check.json
```

**Expected:**
```json
{
  "update_available": false,
  "installed": "2.0.0",
  "latest": "2.0.0",
  "checked": 1707588000
}
```

`update_available` should be `false` since we just installed the latest version.

### 9b. Verify Statusline Reads Cache

```bash
echo '{"model":{"display_name":"Claude"},"workspace":{"current_dir":"/tmp"},"context_window":{"remaining_percentage":80}}' | node ~/.claude/hooks/bp-statusline.js
```

**Expected:** Output includes model name, directory, context bar. Should NOT show `⬆ /bp:update` since `update_available` is false.

### 9c. Simulate Update Available

Temporarily edit the cache to test the statusline indicator:

```bash
echo '{"update_available":true,"installed":"1.0.0","latest":"2.0.0","checked":1707588000}' > ~/.claude/cache/bp-update-check.json
```

Re-run the statusline test from 9b. **Expected:** Output includes `⬆ /bp:update` in yellow.

Restore the correct cache after testing:

```bash
node ~/.claude/hooks/bp-check-update.js
```

---

## Step 10: Test Local Patch System

This verifies the most complex user-facing feature: local modifications are detected, backed up, and can be reapplied after an update.

### 10a. Modify an Installed File

After global install from Step 7:

```bash
echo "<!-- User modification for test -->" >> ~/.claude/commands/bp/update.md
```

### 10b. Verify Manifest Detects Modification

The manifest was written during install. The next install will compare current file hashes against the manifest.

```bash
# Check the manifest has the original hash for this file
node -e "
const m = require(process.env.HOME + '/.claude/bp-file-manifest.json');
console.log('Has update.md:', 'commands/bp/update.md' in m.files);
"
```

Expected: `Has update.md: true`

### 10c. Run Reinstall to Trigger Patch Backup

```bash
npx @lipter7/blueprint --claude --global
```

**Expected output should include:**
```
  i  Found 1 locally modified Blueprint file(s) — backed up to bp-local-patches/
     commands/bp/update.md
```

**Verify backup:**

```bash
cat ~/.claude/bp-local-patches/backup-meta.json
```

Expected: JSON with `backed_up_at`, `from_version`, and `files` array containing `commands/bp/update.md`.

```bash
test -f ~/.claude/bp-local-patches/commands/bp/update.md && echo "Backup exists"
```

Expected: `Backup exists`

### 10d. Verify `/bp:reapply-patches` Would Work

The reapply-patches command is a workflow executed inside Claude Code, so it can't be tested from the command line. But verify the prerequisites:

```bash
# backup-meta.json exists and is valid
node -e "
const meta = require(process.env.HOME + '/.claude/bp-local-patches/backup-meta.json');
console.log('Files backed up:', meta.files.length);
console.log('From version:', meta.from_version);
"
```

Expected: Shows count and version.

### 10e. Cleanup Test Patches

```bash
rm -rf ~/.claude/bp-local-patches/
```

---

## Step 11: Test Uninstall

```bash
npx @lipter7/blueprint --claude --global --uninstall
```

**Verification checklist:**

| Check | How to Verify | Expected |
|-------|--------------|----------|
| Commands removed | `ls ~/.claude/commands/bp/ 2>/dev/null` | Directory gone or empty |
| Blueprint dir removed | `ls ~/.claude/blueprint/ 2>/dev/null` | Directory gone |
| Agents removed | `ls ~/.claude/agents/bp-*.md 2>/dev/null` | No bp-* files |
| Hooks removed | `ls ~/.claude/hooks/bp-*.js 2>/dev/null` | No bp-* files |
| Settings cleaned | `cat ~/.claude/settings.json` | No bp-check-update references |
| Non-Blueprint files preserved | Any custom commands/agents still exist | Preserved |

---

## Step 12: Test OpenCode Install Path

```bash
npx @lipter7/blueprint --opencode --global
```

**Verification checklist:**

| Check | How to Verify | Expected |
|-------|--------------|----------|
| Commands installed | `ls ~/.config/opencode/command/bp-*.md` | Flattened `bp-*.md` files |
| Command format | Check frontmatter of any command | OpenCode format (tools as object, no `allowed-tools`) |
| Blueprint dir | `ls ~/.config/opencode/blueprint/` | workflows/, templates/, etc. |
| Agents | `ls ~/.config/opencode/agents/bp-*.md` | 11 agents with OpenCode frontmatter |
| No hooks for OpenCode | Settings check | No SessionStart hook (OpenCode doesn't support hooks) |
| Permissions configured | `cat ~/.config/opencode/opencode.json` | Blueprint paths in permissions |

**Cleanup:**
```bash
npx @lipter7/blueprint --opencode --global --uninstall
```

---

## Step 13: Test Gemini Install Path

```bash
npx @lipter7/blueprint --gemini --global
```

**Verification checklist:**

| Check | How to Verify | Expected |
|-------|--------------|----------|
| Commands installed | `ls ~/.gemini/commands/bp/` | `.md` files |
| Agents | `ls ~/.gemini/agents/bp-*.md` | Gemini-formatted agents |
| Hooks | `ls ~/.gemini/hooks/bp-*.js` | Both hooks present |
| Settings | `cat ~/.gemini/settings.json` | SessionStart hook configured |
| Experimental agents enabled | Check settings.json | `"experimental": {"enableAgents": true}` |

**Cleanup:**
```bash
npx @lipter7/blueprint --gemini --global --uninstall
```

---

## Step 14: Run Test Suite

After all verification steps, ensure the test suite still passes:

```bash
npm test
```

Expected: All 75 tests pass.

---

## Step 15: Final Verification Summary

Run a comprehensive check that everything is consistent:

```bash
# Verify npm registry
npm view @lipter7/blueprint version

# Verify local package.json matches
node -e "console.log(require('./package.json').version)"

# Verify no remaining gsd references in the update workflow files
grep -i 'gsd' commands/bp/update.md blueprint/workflows/update.md commands/bp/reapply-patches.md

# Verify hooks build
npm run build:hooks
diff hooks/bp-check-update.js hooks/dist/bp-check-update.js
diff hooks/bp-statusline.js hooks/dist/bp-statusline.js
```

---

## Issues Found During Investigation

### Phase 1 Leftovers (Fixed in Step 1)

| File | Line | Issue |
|------|------|-------|
| `commands/bp/update.md` | 2 | `name: gsd:update` (should be `bp:update`) |
| `blueprint/workflows/update.md` | 120 | `commands/gsd/` (should be `commands/bp/`) |
| `blueprint/workflows/update.md` | 127 | `commands/gsd/` (should be `commands/bp/`) |

### CHANGELOG.md (Handled in Step 3)

| Line(s) | Issue | Resolution |
|---------|-------|------------|
| 3 | "changes to GSD" | Update to "changes to Blueprint" |
| 9-1207 | GSD-era content with old names | Leave as-is (historical record) |
| 1209 | `[Unreleased]` URL points to upstream GSD | Update to Blueprint repo |
| 1210-1365 | Release URLs point to upstream GSD | Leave as-is (releases exist there) |

### Test File in npm Package

`blueprint/bin/blueprint-tools.test.js` (77 KB) is included in the published package because the `files` array includes the entire `blueprint/` directory. This is acceptable for now — it adds ~77 KB but doesn't affect functionality. A `.npmignore` could exclude it later if package size becomes a concern.

---

## Dependency Graph

```
Step 1: Fix Phase 1 Leftovers
  │
  ▼
Step 2: Version Decision & Bump
  │
  ▼
Step 3: CHANGELOG.md Preparation
  │
  ▼
Step 4: Build Hooks ◄── Verify before publish
  │
  ▼
Step 5: Pre-Publish Dry Run ◄── Verify package contents
  │
  ▼
Step 6: Publish to npm ◄── IRREVERSIBLE (but can publish newer version)
  │
  ▼
Steps 7-13: Verification Matrix ◄── PARALLELIZABLE (independent install paths)
  │  ┌──────────────────┐
  │  │ Step 7:  Global Claude Code install    │
  │  │ Step 8:  Local Claude Code install     │
  │  │ Step 9:  Update check hook             │
  │  │ Step 10: Local patch system            │
  │  │ Step 11: Uninstall                     │
  │  │ Step 12: OpenCode install              │
  │  │ Step 13: Gemini install                │
  │  └──────────────────┘
  │       All must complete
  ▼
Step 14: Test Suite ◄── Confirm nothing broke
  │
  ▼
Step 15: Final Verification ◄── Summary check
```

### Blocking Summary

| Step | Blocks | Blocked By | Can Parallelize? |
|------|--------|------------|-----------------:|
| 1 | 2 | nothing | No (3 small edits) |
| 2 | 3 | 1 | No (1 edit + decision) |
| 3 | 4 | 2 | No (depends on version choice) |
| 4 | 5 | 3 | No (single command) |
| 5 | 6 | 4 | No (review output) |
| 6 | 7-13 | 5 | No (single command, irreversible) |
| 7-13 | 14 | 6 | **Yes** — independent install paths |
| 14 | 15 | all of 7-13 | No (single test run) |
| 15 | nothing | 14 | No (final check) |

---

## Sub-Agent Decomposition

### What the Orchestrator Does Directly

**Steps 1-6 are orchestrator work.** These are sequential edits and shell commands:
- Step 1: Three small file edits (Edit tool)
- Step 2: One package.json edit (Edit tool)
- Step 3: CHANGELOG.md edits (Edit tool)
- Step 4: `npm run build:hooks` (Bash)
- Step 5: `npm pack --dry-run` (Bash, review output)
- Step 6: `npm publish --access public` (Bash, requires user confirmation)

### What Sub-Agents Do (Steps 7-13 — Verification Matrix)

After publishing, the orchestrator can spawn **up to 3 sub-agents** for verification. However, since these tests modify the filesystem (install/uninstall to global directories), they must be run **sequentially by the orchestrator** to avoid conflicts. The verification is primarily a series of bash commands and visual checks.

**Recommended approach:** The orchestrator runs all verification steps directly. Sub-agents are not needed — the steps are straightforward bash commands with expected output checks. The orchestrator can run Steps 7-11 (Claude Code tests) sequentially, then Steps 12-13 (OpenCode, Gemini) sequentially.

### Failure Recovery

**If `npm publish` fails:**
- Check `npm whoami` to verify login
- Check `npm access ls-packages @lipter7` for scope access
- Verify `--access public` flag is included
- If package name already taken: choose different scope or name

**If install verification fails:**
- Read error output from `npx` command
- Most likely causes: missing file in `files` array, wrong `bin` path, broken shebang
- Fix, bump patch version, re-publish

**If update check hook fails:**
- Verify `npm view @lipter7/blueprint version` works manually
- Check cache directory permissions (`~/.claude/cache/`)
- Check VERSION file was written correctly

**If local patch system fails:**
- Verify `bp-file-manifest.json` was written during install
- Check file permissions on `bp-local-patches/` directory
- Verify SHA256 hashing works (`node -e "require('crypto').createHash('sha256').update('test').digest('hex')"`)

---

## Work Breakdown Summary

| Who | Steps | Nature | Duration Estimate |
|-----|-------|--------|-----------|
| Orchestrator | 1-6 | Sequential: file edits + npm commands | Fast (requires user input for version decision and publish confirmation) |
| Orchestrator | 7-13 | Sequential: install/verify/uninstall cycles | Medium (7 install paths to test) |
| Orchestrator | 14-15 | Test suite + final checks | Fast |

---

## Risk Mitigation

**Risk: Publishing wrong version or broken package.**
Mitigation: Step 5 dry run verifies package contents. Step 6 is flagged as irreversible — user must confirm. Even if a bad version is published, a patch version can be published immediately to fix it.

**Risk: Global install interferes with existing Blueprint installation.**
Mitigation: Test on a machine/user without prior Blueprint installation, or uninstall first (Step 11 before Step 7).

**Risk: CHANGELOG.md GSD references confuse users.**
Mitigation: New Blueprint entry at the top clearly signals the fork. Historical entries are preserved as-is with a clear delineation.

**Risk: `hooks/dist/` not fresh when publishing.**
Mitigation: `prepublishOnly` script rebuilds hooks automatically. Step 4 verifies this manually before publish.

**Risk: npm registry caches old/wrong version data.**
Mitigation: Wait 1-2 minutes after publish before verification. Use `npm view @lipter7/blueprint version --fetch-retries 0` to force fresh check.

---

## Exit Criteria

- [ ] `npm view @lipter7/blueprint version` returns correct version
- [ ] `npx @lipter7/blueprint --claude --global` installs correctly with all Blueprint names
- [ ] `npx @lipter7/blueprint --claude --local` installs correctly with relative paths
- [ ] Update check hook queries `@lipter7/blueprint` and writes cache
- [ ] Statusline shows update indicator when cache says update available
- [ ] Local patch system: modify file → reinstall → backup detected → patches saved
- [ ] Uninstall removes all Blueprint files and hook registrations
- [ ] OpenCode install path works with correct frontmatter conversion
- [ ] Gemini install path works with correct agent/command conversion
- [ ] `npm test` passes (75/75)
- [ ] No remaining `gsd` references in update-related files
