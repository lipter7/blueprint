# Phase 4: Codebase Freshness & Milestone Lifecycle — Detailed Implementation Plan

**Parent:** `00-phase-overview.md`
**Status:** Complete

---

## Overview

Make codebase awareness "living" by adding staleness detection + auto-remap, and improve the milestone lifecycle with STATE.md compaction. This phase adds a new `codebase-staleness-check` command to `blueprint-tools.js`, modifies 6 workflows to embed staleness checks or auto-remap steps, adds STATE.md compaction to milestone completion, and updates the config template with new metadata blocks.

**Source research:**
- Item 3: Codebase Staleness Detection (`docs/blueprint/refactor/research-results/item-3.md`)
- Item 5: Scope and Command Set Validation (`docs/blueprint/refactor/research-results/item-5.md`) — auto-remap at milestone completion
- Item 6: Template and Artifact Design (`docs/blueprint/refactor/research-results/item-6.md`) — STATE.md compaction, config.json additions

**Key design decisions (from research):**
- v1: Always full remap (all 4 mapper agents). No targeted/partial remap.
- Staleness heuristic: >10 files changed OR >200 lines changed (tunable).
- Auto-remap at milestone completion is automatic (no user prompt). Staleness checks at other trigger points prompt the user.
- STATE.md compaction discards: performance metrics rows, accumulated decisions, resolved blockers, session continuity. Keeps: current position, 3-5 key learnings, active blockers.
- `complete-project` does not exist as a workflow/command — auto-remap applies only to `complete-milestone`.

---

## Scope Summary

| Category | Volume | Files Affected |
|----------|--------|----------------|
| New CLI command (`codebase-staleness-check`) | ~60 lines new code | `blueprint/bin/blueprint-tools.js` |
| New CLI command (`state compact`) | ~80 lines new code | `blueprint/bin/blueprint-tools.js` |
| `loadConfig` + `cmdConfigEnsureSection` updates | ~20 lines modified | `blueprint/bin/blueprint-tools.js` |
| `init` function additions (staleness metadata) | ~30 lines across 5 functions | `blueprint/bin/blueprint-tools.js` |
| Config template update | ~10 lines added | `blueprint/templates/config.json` |
| STATE.md template update | ~15 lines added | `blueprint/templates/state.md` |
| `map-codebase.md` workflow — post-mapping config write | ~10 lines added | `blueprint/workflows/map-codebase.md` |
| `complete-milestone.md` workflow — compaction + auto-remap | ~80 lines added | `blueprint/workflows/complete-milestone.md` |
| `verify-work.md` workflow — staleness check step | ~40 lines added | `blueprint/workflows/verify-work.md` |
| `new-milestone.md` workflow — staleness check step | ~40 lines added | `blueprint/workflows/new-milestone.md` |
| `new-project.md` workflow — extend brownfield detection | ~30 lines added | `blueprint/workflows/new-project.md` |
| `debug.md` command — optional staleness check | ~30 lines added | `commands/bp/debug.md` |
| Test additions | ~200 lines | `blueprint/bin/blueprint-tools.test.js` |

**Total: ~645 lines of new/modified code across ~10 files.**

---

## Execution Order

The steps are ordered by dependency. Infrastructure first (CLI commands, config), then workflow modifications (which consume the new infrastructure), then tests and verification.

---

## Step 1: Config Template Updates

Update `blueprint/templates/config.json` to include the two new top-level blocks. These establish the schema that all subsequent code expects.

### 1a. Add `codebase_mapping` block

After the `safety` block (~line 34), add:

```json
{
  ...existing fields...,
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "codebase_mapping": {
    "last_mapped_at": null,
    "last_mapped_commit": null,
    "docs_produced": []
  },
  "agent_models": {}
}
```

**`codebase_mapping` fields:**
- `last_mapped_at` — ISO 8601 timestamp of last successful mapping (null = never mapped)
- `last_mapped_commit` — Short git commit hash at the time of mapping (null = never mapped)
- `docs_produced` — Array of filenames produced (e.g., `["STACK.md", "ARCHITECTURE.md", ...]`)

**`agent_models` field:** Empty object placeholder for Phase 5 (Cursor per-agent model configuration). Added now so the schema exists when Phase 5 needs it. No code in Phase 4 reads or writes this field.

### 1b. Update STATE.md template

Add documentation for the "Key Learnings" section that replaces "Accumulated Context" after compaction. In `blueprint/templates/state.md`, add after the `</sections>` tag (~line 164):

```markdown
<compaction>

### Post-Milestone Compaction

After milestone completion, STATE.md is aggressively compacted. The `state compact` command handles this automatically as part of the `complete-milestone` workflow.

**What survives compaction:**
- **Project Reference** — unchanged
- **Current Position** — updated to reflect new milestone starting state
- **Key Learnings** (replaces Accumulated Context) — 3-5 distilled insights
- **Active Blockers** — unresolved blockers that carry forward

**What is discarded:**
- Performance Metrics table (detail lives in SUMMARY.md files)
- Accumulated Decisions (full log in PROJECT.md)
- Resolved blockers
- Session Continuity section (reset for new milestone)

**Key Learnings format:**
```markdown
## Key Learnings

- [Insight about development process, architecture, or testing that affects future work]
- [Pattern discovered that should inform future phases]
- [Technical constraint or risk identified during this milestone]
```

The compacted STATE.md should be well under 100 lines.

</compaction>
```

---

## Step 2: `blueprint-tools.js` — Infrastructure Changes

All changes in this step are to `blueprint/bin/blueprint-tools.js` (~4,597 lines).

### 2a. Update `loadConfig` (~line 157)

Add `codebase_mapping` fields to the returned config object. After the `brave_search` field (~line 203):

```javascript
return {
  ...existing fields...,
  brave_search: get('brave_search') ?? defaults.brave_search,
  // Codebase mapping metadata
  codebase_mapping: (() => {
    const cm = parsed.codebase_mapping;
    if (typeof cm === 'object' && cm !== null) {
      return {
        last_mapped_at: cm.last_mapped_at || null,
        last_mapped_commit: cm.last_mapped_commit || null,
        docs_produced: Array.isArray(cm.docs_produced) ? cm.docs_produced : [],
      };
    }
    return { last_mapped_at: null, last_mapped_commit: null, docs_produced: [] };
  })(),
};
```

Also add a default for `codebase_mapping` in the defaults object (~line 159):

```javascript
const defaults = {
  ...existing defaults...,
  brave_search: false,
  codebase_mapping: { last_mapped_at: null, last_mapped_commit: null, docs_produced: [] },
};
```

And ensure the catch block (~line 205) returns the default:

```javascript
} catch {
  return defaults;
}
```

### 2b. Update `cmdConfigEnsureSection` (~line 571)

Add `codebase_mapping` and `agent_models` to the default config written when creating a new project. In the `defaults` object (~line 597):

```javascript
const defaults = {
  ...existing fields...,
  parallelization: true,
  brave_search: hasBraveSearch,
  codebase_mapping: {
    last_mapped_at: null,
    last_mapped_commit: null,
    docs_produced: [],
  },
  agent_models: {},
};
```

### 2c. New command: `codebase-staleness-check`

Add a new function before the `resolveModelInternal` function (~line 3475). This is the core staleness detection mechanism.

```javascript
// ─── Codebase Staleness Check ────────────────────────────────────────────────

function cmdCodebaseStalenessCheck(cwd, raw) {
  const config = loadConfig(cwd);
  const cm = config.codebase_mapping;

  // No mapping metadata → never mapped
  if (!cm || !cm.last_mapped_commit) {
    const hasMaps = pathExistsInternal(cwd, '.blueprint/codebase');
    output({
      stale: false,
      never_mapped: !hasMaps,
      has_maps: hasMaps,
      reason: hasMaps ? 'mapped_but_no_metadata' : 'never_mapped',
      last_mapped_at: null,
      last_mapped_commit: null,
      files_changed: 0,
      lines_added: 0,
      lines_removed: 0,
      summary: hasMaps
        ? 'Codebase map exists but has no tracking metadata. Consider remapping.'
        : 'No codebase map found.',
    }, raw);
    return;
  }

  // Check if git is available
  const gitCheck = execGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (gitCheck.exitCode !== 0) {
    output({
      stale: false,
      never_mapped: false,
      has_maps: true,
      reason: 'no_git',
      last_mapped_at: cm.last_mapped_at,
      last_mapped_commit: cm.last_mapped_commit,
      files_changed: 0,
      lines_added: 0,
      lines_removed: 0,
      summary: 'Not a git repository. Cannot check staleness.',
    }, raw);
    return;
  }

  // Verify the stored commit exists
  const commitCheck = execGit(cwd, ['cat-file', '-t', cm.last_mapped_commit]);
  if (commitCheck.exitCode !== 0) {
    output({
      stale: true,
      never_mapped: false,
      has_maps: true,
      reason: 'commit_not_found',
      last_mapped_at: cm.last_mapped_at,
      last_mapped_commit: cm.last_mapped_commit,
      files_changed: -1,
      lines_added: -1,
      lines_removed: -1,
      summary: `Stored commit ${cm.last_mapped_commit} not found. Remap recommended.`,
    }, raw);
    return;
  }

  // Run git diff --stat, excluding .blueprint/ and .planning/ directories
  const diffResult = execGit(cwd, [
    'diff', '--stat', `${cm.last_mapped_commit}..HEAD`,
    '--', '.', ':!.blueprint', ':!.planning',
  ]);

  if (diffResult.exitCode !== 0) {
    output({
      stale: false,
      never_mapped: false,
      has_maps: true,
      reason: 'diff_error',
      last_mapped_at: cm.last_mapped_at,
      last_mapped_commit: cm.last_mapped_commit,
      files_changed: 0,
      lines_added: 0,
      lines_removed: 0,
      summary: 'Could not compute diff: ' + diffResult.stderr,
    }, raw);
    return;
  }

  // Parse diff --stat output
  // Last line looks like: " 15 files changed, 200 insertions(+), 50 deletions(-)"
  const lines = diffResult.stdout.split('\n').filter(l => l.trim());
  const summaryLine = lines[lines.length - 1] || '';

  let filesChanged = 0;
  let linesAdded = 0;
  let linesRemoved = 0;

  const filesMatch = summaryLine.match(/(\d+)\s+files?\s+changed/);
  const insertMatch = summaryLine.match(/(\d+)\s+insertions?\(\+\)/);
  const deleteMatch = summaryLine.match(/(\d+)\s+deletions?\(-\)/);

  if (filesMatch) filesChanged = parseInt(filesMatch[1], 10);
  if (insertMatch) linesAdded = parseInt(insertMatch[1], 10);
  if (deleteMatch) linesRemoved = parseInt(deleteMatch[1], 10);

  // Staleness heuristic: >10 files changed OR >200 lines changed
  const totalLinesChanged = linesAdded + linesRemoved;
  const isStale = filesChanged > 10 || totalLinesChanged > 200;

  output({
    stale: isStale,
    never_mapped: false,
    has_maps: true,
    reason: isStale ? 'significant_changes' : 'within_threshold',
    last_mapped_at: cm.last_mapped_at,
    last_mapped_commit: cm.last_mapped_commit,
    files_changed: filesChanged,
    lines_added: linesAdded,
    lines_removed: linesRemoved,
    diff_summary: summaryLine.trim(),
    summary: isStale
      ? `Codebase changed since last mapping: ${filesChanged} files, +${linesAdded}/-${linesRemoved} lines.`
      : `Codebase changes within threshold: ${filesChanged} files, +${linesAdded}/-${linesRemoved} lines.`,
  }, raw);
}
```

### 2d. New command: `state compact`

Add a new function that performs STATE.md compaction. Place after the existing `cmdStateRecordSession` function (search for it) and before the compound commands section (~line 3475).

```javascript
// ─── State Compact ───────────────────────────────────────────────────────────

function cmdStateCompact(cwd, raw) {
  const statePath = path.join(cwd, '.blueprint', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    error('STATE.md not found at .blueprint/STATE.md');
  }

  const content = fs.readFileSync(statePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];

  // Extract Project Reference section
  const projectRefMatch = content.match(
    /## Project Reference\s*\n([\s\S]*?)(?=\n## )/
  );
  const projectRef = projectRefMatch ? projectRefMatch[1].trim() : 'See: .blueprint/PROJECT.md';

  // Extract Current Position section
  const currentPosMatch = content.match(
    /## Current Position\s*\n([\s\S]*?)(?=\n## )/
  );
  const currentPos = currentPosMatch ? currentPosMatch[1].trim() : '';

  // Extract active blockers (non-resolved)
  const blockersMatch = content.match(
    /### Blockers\/Concerns\s*\n([\s\S]*?)(?=\n## |\n###|$)/
  );
  let activeBlockers = 'None.';
  if (blockersMatch) {
    const blockerLines = blockersMatch[1].trim().split('\n')
      .filter(l => l.trim() && !l.includes('None yet') && !l.includes('RESOLVED'));
    if (blockerLines.length > 0) {
      activeBlockers = blockerLines.join('\n');
    }
  }

  // Build compacted STATE.md
  // The Key Learnings section is left as a placeholder for the orchestrator to fill
  // with distilled insights from the milestone's work
  const compacted = `# Project State

## Project Reference

${projectRef}

## Current Position

${currentPos}

## Key Learnings

_To be filled by the orchestrator with 3-5 distilled insights from this milestone._

## Active Blockers

${activeBlockers}
`;

  fs.writeFileSync(statePath, compacted, 'utf-8');

  const lineCount = compacted.split('\n').length;

  output({
    compacted: true,
    path: '.blueprint/STATE.md',
    line_count: lineCount,
    sections_kept: ['Project Reference', 'Current Position', 'Key Learnings', 'Active Blockers'],
    sections_discarded: ['Performance Metrics', 'Accumulated Context', 'Session Continuity'],
  }, raw);
}
```

### 2e. Wire new commands into the dispatch switch

In the main `switch (command)` block (~line 4200+):

**Add `codebase-staleness-check` case** (after the `config-set` case, ~line 4413):

```javascript
case 'codebase-staleness-check': {
  cmdCodebaseStalenessCheck(cwd, raw);
  break;
}
```

**Add `compact` subcommand to the `state` case** (~line 4283, before the `else` fallback):

```javascript
} else if (subcommand === 'compact') {
  cmdStateCompact(cwd, raw);
}
```

### 2f. Update `init` functions to include staleness metadata

Five `init` functions need codebase mapping metadata added to their return objects:

**`cmdInitMapCodebase` (~line 4071):** Add `last_mapped_at` and `last_mapped_commit`:

```javascript
const result = {
  ...existing fields...,
  // Codebase mapping metadata
  last_mapped_at: config.codebase_mapping.last_mapped_at,
  last_mapped_commit: config.codebase_mapping.last_mapped_commit,
};
```

**`cmdInitVerifyWork` (~line 3890):** Add mapper model and staleness fields:

```javascript
const result = {
  ...existing fields...,
  // Codebase staleness context
  mapper_model: resolveModelInternal(cwd, 'bp-codebase-mapper'),
  has_codebase_map: pathExistsInternal(cwd, '.blueprint/codebase'),
  has_git: pathExistsInternal(cwd, '.git'),
};
```

**`cmdInitNewMilestone` (~line 3789):** Add mapper model and staleness fields:

```javascript
const result = {
  ...existing fields...,
  // Codebase staleness context
  mapper_model: resolveModelInternal(cwd, 'bp-codebase-mapper'),
  has_codebase_map: pathExistsInternal(cwd, '.blueprint/codebase'),
  has_git: pathExistsInternal(cwd, '.git'),
};
```

**`cmdInitNewProject` (~line 3733):** Already has `has_codebase_map` (~line 3770) and `has_git` (~line 3780). Add mapper model:

```javascript
const result = {
  ...existing fields...,
  mapper_model: resolveModelInternal(cwd, 'bp-codebase-mapper'),
};
```

**`cmdInitMilestoneOp` (~line 4010):** Add mapper model and staleness fields:

```javascript
const result = {
  ...existing fields...,
  // Codebase remap context
  mapper_model: resolveModelInternal(cwd, 'bp-codebase-mapper'),
  has_codebase_map: pathExistsInternal(cwd, '.blueprint/codebase'),
  has_git: pathExistsInternal(cwd, '.git'),
};
```

---

## Step 3: Workflow Modifications — `map-codebase.md`

**File:** `blueprint/workflows/map-codebase.md`

After the `commit_codebase_map` step (~line 261-269), add a new step to write mapping metadata to config.json:

```markdown
<step name="update_mapping_metadata">
Write mapping metadata to config.json so staleness detection can track when the last mapping occurred:

```bash
# Get current commit hash
COMMIT=$(git rev-parse --short HEAD)

# Get current timestamp
TIMESTAMP=$(node ~/.claude/blueprint/bin/blueprint-tools.js current-timestamp full)

# Write mapping metadata
node ~/.claude/blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_at" "$TIMESTAMP"
node ~/.claude/blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_commit" "$COMMIT"
node ~/.claude/blueprint/bin/blueprint-tools.js config-set "codebase_mapping.docs_produced" '["STACK.md","ARCHITECTURE.md","STRUCTURE.md","CONVENTIONS.md","TESTING.md","INTEGRATIONS.md","CONCERNS.md"]'
```

Commit the config update:

```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: update codebase mapping metadata" --files .blueprint/config.json
```

Continue to offer_next.
</step>
```

Also update the `success_criteria` section (~line 319) to include the metadata update:

```
- config.json updated with codebase_mapping metadata (last_mapped_at, last_mapped_commit, docs_produced)
```

---

## Step 4: Staleness Check Reusable Block

The staleness check pattern is identical across 4 workflows. Define it once here; each workflow embeds a copy (workflows are standalone documents, not imported modules).

**Standard staleness check block:**

```markdown
<step name="check_codebase_staleness">
**Check if codebase mapping is stale:**

```bash
STALENESS=$(node ~/.claude/blueprint/bin/blueprint-tools.js codebase-staleness-check)
```

Parse `STALENESS` JSON. Extract `stale`, `never_mapped`, `has_maps`, `summary`, `last_mapped_at`, `files_changed`, `lines_added`, `lines_removed`.

**If `stale` is false AND `never_mapped` is false:** Continue silently to the next step.

**If `never_mapped` is true:** Skip staleness check — no codebase map exists. The user can run `/bp:map-codebase` separately if needed.

**If `stale` is true:**

Present to the user via `AskUserQuestion`:

```
Codebase mapping may be stale.
Last mapped: {last_mapped_at}
Changes since: {files_changed} files, +{lines_added}/-{lines_removed} lines

{summary}
```

**Options:**
1. **Full remap** — Re-run all 4 mapping agents (recommended if significant structural changes)
2. **Skip** — Continue with current codebase docs

**If user chooses Full remap:**

Spawn 4 bp-codebase-mapper agents in parallel, identical to the `map-codebase` workflow's `spawn_agents` step. Use `mapper_model` from the init context. After all 4 complete:

1. Verify all 7 docs exist in `.blueprint/codebase/`
2. Commit: `node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: remap codebase (staleness detected)" --files .blueprint/codebase/*.md`
3. Update mapping metadata:
   ```bash
   COMMIT=$(git rev-parse --short HEAD)
   TIMESTAMP=$(node ~/.claude/blueprint/bin/blueprint-tools.js current-timestamp full)
   node ~/.claude/blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_at" "$TIMESTAMP"
   node ~/.claude/blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_commit" "$COMMIT"
   node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: update codebase mapping metadata" --files .blueprint/config.json
   ```

**If user chooses Skip:** Continue to the next step.

</step>
```

---

## Step 5: Workflow Modifications — `verify-work.md`

**File:** `blueprint/workflows/verify-work.md` (~571 lines)

Add the staleness check step **after** the `present_ready` step (~line 519) and before the closing `</process>` tag (~line 521). This fires after verification is complete — the user has finished testing and any fix plans are ready.

Insert the standard staleness check block (from Step 4) as a new step:

```markdown
<step name="check_codebase_staleness">
[Standard staleness check block from Step 4]
</step>
```

**Why here:** The research (Item 3) says staleness checks fire "after phase verification." At this point, work is done — the codebase likely changed — and the next action is planning the next phase. Fresh codebase docs help that.

Also update the init call at the top of the workflow to include the new fields. The `init verify-work` call (~line 23) already returns JSON; add `mapper_model`, `has_codebase_map`, `has_git` to the list of extracted variables.

---

## Step 6: Workflow Modifications — `complete-milestone.md`

**File:** `blueprint/workflows/complete-milestone.md` (~645 lines)

This workflow gets **two** new steps: STATE.md compaction and auto-remap. Both go after `archive_milestone` / `reorganize_roadmap_and_delete_originals` and before `handle_branches`.

### 6a. Add STATE.md compaction step

Insert after `update_state` (~line 427) and before `handle_branches` (~line 428):

```markdown
<step name="compact_state">
**Compact STATE.md for the new milestone:**

First, compact the structural sections via CLI:

```bash
COMPACT=$(node ~/.claude/blueprint/bin/blueprint-tools.js state compact)
```

This removes Performance Metrics, Accumulated Context (decisions list), resolved blockers, and Session Continuity. It preserves Project Reference, Current Position, and Active Blockers.

**Now fill Key Learnings manually.** Read the compacted STATE.md and the milestone's SUMMARY.md files. Distill 3-5 insights that are genuinely useful for future development:

```markdown
## Key Learnings

- [Insight about the development process, architecture, or testing patterns]
- [Technical constraint or risk discovered during this milestone]
- [Pattern that should inform future phase planning]
```

**Guidelines for key learnings:**
- Focus on insights that change how you'd approach future work
- Not accomplishments ("completed auth system") but process insights ("auth module integration tests caught more bugs than unit tests")
- Not facts about the code ("uses Express") but patterns ("API endpoints need careful error handling because middleware doesn't catch async errors")
- Maximum 5 items. Fewer is better.

Write the learnings to STATE.md, then update the Current Position section to reflect the milestone completion.

Verify STATE.md is under 100 lines:

```bash
wc -l .blueprint/STATE.md
```

</step>
```

### 6b. Add auto-remap step

Insert after `compact_state` and before `handle_branches`:

```markdown
<step name="auto_remap_codebase">
**Automatically remap the codebase after milestone completion.**

This runs unconditionally — no staleness check or user prompt. At a major milestone, the codebase docs should be fresh.

**Check prerequisites:**

```bash
# Verify git is available and we're in a repo
git rev-parse --is-inside-work-tree
```

If not a git repo, skip the remap and continue to handle_branches.

**Spawn 4 mapper agents in parallel:**

Use the `mapper_model` from the init context (add to `init milestone-op` return). Spawn agents identical to the `map-codebase` workflow:

```
Task(subagent_type="bp-codebase-mapper", name="mapper-tech", run_in_background=true,
  prompt="Focus: tech. Write STACK.md and INTEGRATIONS.md to .blueprint/codebase/...")

Task(subagent_type="bp-codebase-mapper", name="mapper-arch", run_in_background=true,
  prompt="Focus: arch. Write ARCHITECTURE.md and STRUCTURE.md to .blueprint/codebase/...")

Task(subagent_type="bp-codebase-mapper", name="mapper-quality", run_in_background=true,
  prompt="Focus: quality. Write CONVENTIONS.md and TESTING.md to .blueprint/codebase/...")

Task(subagent_type="bp-codebase-mapper", name="mapper-concerns", run_in_background=true,
  prompt="Focus: concerns. Write CONCERNS.md to .blueprint/codebase/...")
```

Wait for all 4 agents to complete.

**Verify and commit:**

1. Verify all 7 docs exist in `.blueprint/codebase/`
2. Commit:
   ```bash
   node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: auto-remap codebase at milestone completion" --files .blueprint/codebase/*.md
   ```
3. Update mapping metadata:
   ```bash
   COMMIT=$(git rev-parse --short HEAD)
   TIMESTAMP=$(node ~/.claude/blueprint/bin/blueprint-tools.js current-timestamp full)
   node ~/.claude/blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_at" "$TIMESTAMP"
   node ~/.claude/blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_commit" "$COMMIT"
   node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs: update codebase mapping metadata" --files .blueprint/config.json
   ```

**If mapping fails:** Log the error but do not block milestone completion. The milestone is already archived — a failed remap is inconvenient but not catastrophic. Warn the user to run `/bp:map-codebase` manually.

Continue to handle_branches.
</step>
```

### 6c. Update the init call

The workflow's init call (`init milestone-op`) needs `mapper_model`, `has_codebase_map`, and `has_git` in its return (handled in Step 2f). Update the variable extraction at the top of the workflow to include these.

### 6d. Updated milestone completion sequence

After these additions, the full sequence is:

```
verify_readiness → gather_stats → extract_accomplishments → create_milestone_entry
→ evolve_project_full_review → reorganize_roadmap → archive_milestone
→ reorganize_roadmap_and_delete_originals → update_state
→ compact_state (NEW) → auto_remap_codebase (NEW)
→ handle_branches → git_tag → git_commit_milestone → offer_next
```

---

## Step 7: Workflow Modifications — `new-milestone.md`

**File:** `blueprint/workflows/new-milestone.md` (~357 lines)

Add the staleness check step **early in the workflow**, after loading context (Section 1) and before gathering milestone goals (Section 2). This is a natural boundary — the user is starting fresh work and should have current codebase docs.

Insert the standard staleness check block (from Step 4) between the existing Section 1 and Section 2.

Update the init call (`init new-milestone`) to extract `mapper_model`, `has_codebase_map`, `has_git` (handled in Step 2f).

---

## Step 8: Workflow Modifications — `new-project.md`

**File:** `blueprint/workflows/new-project.md` (~959 lines)

Extend the existing brownfield detection in Step 2. Currently (~lines 40-70), the workflow checks `needs_codebase_map` (code exists but no map). Add a staleness check when the map exists but may be outdated.

After the existing brownfield check, add:

```markdown
**If `has_codebase_map` is true AND `has_git` is true:**

The project already has a codebase map. Check if it's stale:

```bash
STALENESS=$(node ~/.claude/blueprint/bin/blueprint-tools.js codebase-staleness-check)
```

Parse `STALENESS` JSON. If `stale` is true, present to the user:

```
Existing codebase map may be outdated.
Last mapped: {last_mapped_at}
Changes since: {files_changed} files, +{lines_added}/-{lines_removed} lines

Would you like to refresh the codebase map before starting the project?
```

Options:
1. **Refresh** — Full remap before proceeding
2. **Skip** — Use existing codebase docs

If the user chooses Refresh, run the full remap flow (same as Step 4). Otherwise continue.
```

The `mapper_model` is already being added to `init new-project` in Step 2f.

---

## Step 9: Workflow Modifications — `debug.md`

**File:** `commands/bp/debug.md` (~163 lines)

Add an **optional** staleness check before spawning the debugger. The research (Item 3) marks this as "optional, diagnostic context." Make it lightweight — only check, don't prompt for remap unless the staleness is extreme.

After Step 0 (initialize context) and before Step 1 (check active sessions), add:

```markdown
**Step 0.5: Check codebase freshness (optional)**

If `.blueprint/codebase/` exists:

```bash
STALENESS=$(node ~/.claude/blueprint/bin/blueprint-tools.js codebase-staleness-check)
```

If `stale` is true AND `files_changed` > 30 (significantly stale — double the normal threshold):

```
Note: Codebase docs may be significantly outdated ({files_changed} files changed since last mapping).
Debugging with current docs, but consider running `/bp:map-codebase` for better diagnostic context.
```

This is informational only — no prompt, no blocking. The debugger proceeds with existing docs.
```

---

## Step 10: Test Suite Updates

**File:** `blueprint/bin/blueprint-tools.test.js`

Add tests for the new commands and modified functions. The existing test pattern uses `execSync` to call `blueprint-tools.js` with arguments and asserts on the JSON output.

### 10a. Tests for `codebase-staleness-check`

```javascript
describe('codebase-staleness-check', () => {
  test('returns never_mapped when no config metadata', () => {
    // Setup: create .blueprint/config.json without codebase_mapping
    // Run: node blueprint-tools.js codebase-staleness-check
    // Assert: never_mapped=true OR has_maps=false
  });

  test('returns not stale when no changes since mapping', () => {
    // Setup: create config with last_mapped_commit = HEAD
    // Run: codebase-staleness-check
    // Assert: stale=false
  });

  test('returns stale when significant changes', () => {
    // Setup: create config with last_mapped_commit = old commit
    // Create files to make diff significant
    // Run: codebase-staleness-check
    // Assert: stale=true, files_changed > 0
  });

  test('handles missing git gracefully', () => {
    // Setup: run in a non-git directory
    // Run: codebase-staleness-check
    // Assert: reason='no_git', no crash
  });

  test('handles invalid commit hash gracefully', () => {
    // Setup: config with last_mapped_commit = 'deadbeef' (nonexistent)
    // Run: codebase-staleness-check
    // Assert: reason='commit_not_found', stale=true
  });
});
```

### 10b. Tests for `state compact`

```javascript
describe('state compact', () => {
  test('compacts STATE.md preserving key sections', () => {
    // Setup: write a full STATE.md with all sections (metrics, decisions, blockers, session)
    // Run: node blueprint-tools.js state compact
    // Assert: compacted=true, sections_discarded includes Performance Metrics
    // Read STATE.md and verify structure
  });

  test('preserves active blockers', () => {
    // Setup: STATE.md with active blockers
    // Run: state compact
    // Assert: blockers still present in output
  });

  test('errors when STATE.md not found', () => {
    // Setup: no STATE.md
    // Run: state compact
    // Assert: error
  });
});
```

### 10c. Tests for `loadConfig` codebase_mapping

```javascript
test('loadConfig reads codebase_mapping from config', () => {
  // Setup: config.json with codebase_mapping block
  // Run: loadConfig or any init command that uses it
  // Assert: codebase_mapping fields present in output
});

test('loadConfig defaults codebase_mapping when missing', () => {
  // Setup: config.json without codebase_mapping
  // Assert: defaults to null/null/[]
});
```

### 10d. Tests for init function additions

```javascript
test('init map-codebase includes mapping metadata', () => {
  // Setup: config with codebase_mapping
  // Run: init map-codebase
  // Assert: last_mapped_at and last_mapped_commit in output
});

test('init verify-work includes staleness fields', () => {
  // Run: init verify-work <phase>
  // Assert: mapper_model, has_codebase_map, has_git in output
});

test('init new-milestone includes staleness fields', () => {
  // Run: init new-milestone
  // Assert: mapper_model, has_codebase_map, has_git in output
});

test('init milestone-op includes mapper_model', () => {
  // Run: init milestone-op
  // Assert: mapper_model in output
});
```

---

## Step 11: Verification

### 11a. Test Pass

```bash
npm test
```

All existing tests must still pass. New tests must pass.

### 11b. Manual Verification of `codebase-staleness-check`

In a git repository with a `.blueprint/config.json`:

```bash
# Set mapping metadata to current commit
node blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_commit" "$(git rev-parse --short HEAD)"
node blueprint/bin/blueprint-tools.js config-set "codebase_mapping.last_mapped_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Check staleness (should be not stale)
node blueprint/bin/blueprint-tools.js codebase-staleness-check

# Make changes, commit them
echo "test" > /tmp/staleness-test-file && git add /tmp/staleness-test-file && git commit -m "test"

# Check staleness again (should show changes)
node blueprint/bin/blueprint-tools.js codebase-staleness-check
```

### 11c. Manual Verification of `state compact`

```bash
# Create a STATE.md with full content (metrics, decisions, etc.)
# Run compact
node blueprint/bin/blueprint-tools.js state compact

# Verify output has compacted=true
# Read STATE.md and verify structure
cat .blueprint/STATE.md
wc -l .blueprint/STATE.md  # Should be well under 100 lines
```

### 11d. Grep Audit

Search for any inconsistencies or missing references:

```bash
# Verify new commands are wired in dispatch
grep -n 'codebase-staleness-check' blueprint/bin/blueprint-tools.js
grep -n 'compact' blueprint/bin/blueprint-tools.js

# Verify config template has new fields
grep -n 'codebase_mapping' blueprint/templates/config.json
grep -n 'agent_models' blueprint/templates/config.json

# Verify workflow modifications reference the right CLI commands
grep -n 'codebase-staleness-check' blueprint/workflows/*.md commands/bp/*.md
grep -n 'state compact' blueprint/workflows/complete-milestone.md
```

---

## File Modification Summary

Files are grouped by type for clarity. The dependency order (Steps 1-11) determines execution order.

| File | Step | Nature | Estimated Changes |
|------|------|--------|-------------------|
| `blueprint/templates/config.json` | 1a | Add 2 new JSON blocks | +10 lines |
| `blueprint/templates/state.md` | 1b | Add compaction documentation | +30 lines |
| `blueprint/bin/blueprint-tools.js` | 2a-2f | New commands, config updates, init updates | +250 lines, ~30 lines modified |
| `blueprint/workflows/map-codebase.md` | 3 | Add post-mapping metadata step | +20 lines |
| `blueprint/workflows/verify-work.md` | 5 | Add staleness check step | +40 lines |
| `blueprint/workflows/complete-milestone.md` | 6 | Add compaction + auto-remap steps | +80 lines |
| `blueprint/workflows/new-milestone.md` | 7 | Add staleness check step | +40 lines |
| `blueprint/workflows/new-project.md` | 8 | Extend brownfield detection | +30 lines |
| `commands/bp/debug.md` | 9 | Add optional staleness note | +15 lines |
| `blueprint/bin/blueprint-tools.test.js` | 10 | New test cases | +200 lines |

**Total: ~715 lines of new/modified code across 10 files.**

---

## Dependency Graph

```
Step 1: Config Template Updates
  │  config.json template + STATE.md template
  │
  ▼
Step 2: blueprint-tools.js Infrastructure ◄── GATE: nothing else can proceed until CLI commands exist
  │  2a: loadConfig (codebase_mapping)
  │  2b: cmdConfigEnsureSection
  │  2c: cmdCodebaseStalenessCheck (new)
  │  2d: cmdStateCompact (new)
  │  2e: dispatch wiring
  │  2f: init function updates (5 functions)
  │
  ▼
Steps 3-9: Workflow Modifications ◄── PARALLELIZABLE (see sub-agent breakdown below)
  │
  │  ┌─────────────────────────────────────────────────────────────┐
  │  │  Group A: blueprint-tools.js (Step 2 — all CLI changes)     │
  │  │  Group B: map-codebase.md (Step 3)                          │
  │  │  Group C: complete-milestone.md (Step 6)                    │
  │  │  Group D: verify-work.md + new-milestone.md + new-project.md│
  │  │           + debug.md (Steps 5, 7, 8, 9)                    │
  │  │  Group E: test suite (Step 10)                              │
  │  └─────────────────────────────────────────────────────────────┘
  │       Groups B-D are independent (each owns separate files).
  │       Group E depends on Group A (needs CLI commands to exist).
  │
  ▼  (wait for all groups to complete)
Step 11: Verification ◄── GATE: final, blocks on everything
  │  11a: npm test
  │  11b: Manual staleness check test
  │  11c: Manual state compact test
  │  11d: Grep audit
  │
  ▼
DONE — Phase 4 complete.
```

### Blocking Summary

| Step | Blocks | Blocked By | Can Parallelize? |
|------|--------|------------|-----------------|
| 1 | 2 | nothing | No (trivial, just do it) |
| 2 (all sub-steps) | 3-10 | 1 | **No** — single file, sequential edits |
| 3 (map-codebase.md) | 11 | 2 | **Yes** — independent file |
| 5 (verify-work.md) | 11 | 2 | **Yes** — independent file |
| 6 (complete-milestone.md) | 11 | 2 | **Yes** — independent file |
| 7 (new-milestone.md) | 11 | 2 | **Yes** — independent file |
| 8 (new-project.md) | 11 | 2 | **Yes** — independent file |
| 9 (debug.md) | 11 | 2 | **Yes** — independent file |
| 10 (tests) | 11 | 2 | **Yes** — independent file |
| 11 | nothing | all of 3-10 | Sub-checks are independent but fast |

---

## Sub-Agent Decomposition

### What the Orchestrator Does Directly

**Steps 1-2 are orchestrator work.** These modify the templates and the central `blueprint-tools.js` file. Step 2 involves multiple edits to a single file (~4,600 lines) and must be done sequentially to avoid conflicts.

### What Sub-Agents Do (Steps 3-10 — Parallel)

After Steps 1-2 complete, the orchestrator spawns sub-agents. Each handles files that no other agent touches.

---

#### Sub-Agent A: `map-codebase.md` Modifications

**File:** `blueprint/workflows/map-codebase.md`
**Handles:** Step 3
**Estimated edits:** 2 (new step + success_criteria update)

**Prompt for spawning:**

```
You are editing blueprint/workflows/map-codebase.md to add a post-mapping metadata
update step. The codebase-staleness-check command and config-set command already
exist in blueprint-tools.js.

1. Read the file.
2. After the `commit_codebase_map` step (around line 261-269) and before the
   `offer_next` step, add a new step called `update_mapping_metadata` that:
   - Gets the current git commit hash: COMMIT=$(git rev-parse --short HEAD)
   - Gets the current timestamp via blueprint-tools.js current-timestamp full
   - Writes codebase_mapping.last_mapped_at via config-set
   - Writes codebase_mapping.last_mapped_commit via config-set
   - Writes codebase_mapping.docs_produced as a JSON array of the 7 doc names
   - Commits config.json with message "docs: update codebase mapping metadata"
3. Update the success_criteria section to include "config.json updated with
   codebase_mapping metadata".

Do NOT edit any other file.
```

---

#### Sub-Agent B: `complete-milestone.md` Modifications

**File:** `blueprint/workflows/complete-milestone.md`
**Handles:** Step 6 (compaction + auto-remap)
**Estimated edits:** 3 (two new steps + init variable update)

**Prompt for spawning:**

```
You are editing blueprint/workflows/complete-milestone.md to add STATE.md compaction
and auto-remap steps. The CLI commands `state compact` and `codebase-staleness-check`
already exist in blueprint-tools.js. The `init milestone-op` now returns
`mapper_model`, `has_codebase_map`, and `has_git`.

1. Read the file.
2. Find where variables are extracted from the init call. Add mapper_model,
   has_codebase_map, has_git to the extracted variables.
3. After the `update_state` step and before `handle_branches`, add two new steps:

   Step `compact_state`:
   - Run: node ~/.claude/blueprint/bin/blueprint-tools.js state compact
   - The CLI removes metrics, old decisions, resolved blockers, session continuity
   - After CLI compaction, the orchestrator reads SUMMARY.md files from the milestone
     and distills 3-5 key learnings about the development process
   - Write the Key Learnings section to STATE.md
   - Update Current Position to reflect milestone completion
   - Verify STATE.md is under 100 lines (wc -l)

   Step `auto_remap_codebase`:
   - Check prerequisites: has_git must be true, otherwise skip
   - Spawn 4 bp-codebase-mapper agents in parallel (tech, arch, quality, concerns)
     using mapper_model for model selection
   - Wait for all 4 to complete
   - Verify all 7 docs exist in .blueprint/codebase/
   - Commit codebase docs
   - Update config.json with new mapping metadata (last_mapped_at, last_mapped_commit,
     docs_produced) via config-set commands
   - Commit config.json
   - If mapping fails: warn user, don't block milestone completion

4. The full sequence should be: ...archive → reorganize → update_state →
   compact_state → auto_remap_codebase → handle_branches → ...

Do NOT edit any other file.
```

---

#### Sub-Agent C: Staleness Check Workflows

**Files:** `blueprint/workflows/verify-work.md`, `blueprint/workflows/new-milestone.md`, `blueprint/workflows/new-project.md`, `commands/bp/debug.md`
**Handles:** Steps 5, 7, 8, 9
**Estimated edits:** 4 files, ~150 lines total

**Prompt for spawning:**

```
You are adding codebase staleness checks to 4 workflow files. The CLI command
`codebase-staleness-check` already exists in blueprint-tools.js. The init functions
now return mapper_model, has_codebase_map, and has_git where needed.

For each file, read it first, then make the appropriate modifications.

1. blueprint/workflows/verify-work.md:
   - Update the init variable extraction to include mapper_model, has_codebase_map, has_git
   - Add a `check_codebase_staleness` step AFTER the `present_ready` step (the last
     functional step, around line 519) and BEFORE the closing </process> tag
   - The step calls `codebase-staleness-check`, and if stale=true, presents the user
     with an AskUserQuestion: "Full remap" or "Skip"
   - If user chooses remap: spawn 4 bp-codebase-mapper agents, commit results,
     update config metadata
   - If skip or not stale: continue silently

2. blueprint/workflows/new-milestone.md:
   - Update init variable extraction to include mapper_model, has_codebase_map, has_git
   - Add `check_codebase_staleness` step early — after loading context (Section 1)
     and before gathering milestone goals (Section 2)
   - Same pattern as verify-work.md

3. blueprint/workflows/new-project.md:
   - The init already returns has_codebase_map and has_git
   - Update init variable extraction to include mapper_model
   - In Step 2 (brownfield detection), after the existing check for needs_codebase_map,
     add a staleness check when has_codebase_map is true AND has_git is true
   - Call codebase-staleness-check, present "Refresh" or "Skip" if stale

4. commands/bp/debug.md:
   - Add an optional, non-blocking staleness note between Step 0 (init) and Step 1
   - Only trigger if .blueprint/codebase/ exists AND stale=true AND files_changed > 30
   - Do NOT prompt the user — just show an informational note:
     "Note: Codebase docs may be significantly outdated. Consider /bp:map-codebase."
   - The debugger proceeds regardless

Do NOT edit any other file.
```

---

#### Sub-Agent D: Test Suite

**File:** `blueprint/bin/blueprint-tools.test.js`
**Handles:** Step 10
**Estimated edits:** +200 lines

**Prompt for spawning:**

```
You are adding tests for Phase 4 features to blueprint/bin/blueprint-tools.test.js.
The existing test pattern uses Node.js built-in node:test module with execSync to
call blueprint-tools.js and assert on JSON output. Follow the existing patterns.

Read the test file first to understand the conventions (setup, teardown, temp
directories, how tests call the CLI).

Add tests for:

1. codebase-staleness-check command:
   - Returns never_mapped=true when no codebase map exists and no config metadata
   - Returns stale=false when last_mapped_commit equals HEAD
   - Returns stale=true when significant changes exist since last_mapped_commit
   - Handles non-git directories gracefully (reason='no_git')
   - Handles invalid/missing commit hash (reason='commit_not_found')

2. state compact command:
   - Successfully compacts a full STATE.md (with metrics, decisions, blockers, session)
   - Preserves active blockers
   - Removes Performance Metrics, Accumulated Context, Session Continuity
   - Creates Key Learnings placeholder section
   - Errors when STATE.md doesn't exist
   - Result has compacted=true, correct sections_kept and sections_discarded

3. loadConfig codebase_mapping support:
   - Config with codebase_mapping block returns the fields correctly
   - Config without codebase_mapping returns defaults (null/null/[])

4. init function additions:
   - init map-codebase includes last_mapped_at and last_mapped_commit
   - init verify-work includes mapper_model, has_codebase_map, has_git
   - init new-milestone includes mapper_model, has_codebase_map, has_git
   - init milestone-op includes mapper_model
   - init new-project includes mapper_model

5. config-ensure-section includes codebase_mapping and agent_models in defaults

Do NOT edit any other file. Only edit blueprint/bin/blueprint-tools.test.js.
```

---

### Orchestrator Flow: Putting It All Together

```
ORCHESTRATOR: Step 1 (config template + STATE.md template)
  │  Direct edits to 2 small template files.
  │
  ▼
ORCHESTRATOR: Step 2 (blueprint-tools.js — all 6 sub-steps)
  │  Sequential edits to the single large file.
  │  2a: loadConfig update
  │  2b: cmdConfigEnsureSection update
  │  2c: cmdCodebaseStalenessCheck (new function, ~100 lines)
  │  2d: cmdStateCompact (new function, ~80 lines)
  │  2e: dispatch wiring (2 additions to switch statement)
  │  2f: 5 init function updates (~5-10 lines each)
  │
  ▼
ORCHESTRATOR: Spawn 4 sub-agents in parallel ◄── SINGLE MESSAGE with 4 Task calls
  │
  │  ┌──────────────────────────────────────────────────────────┐
  │  │  Sub-Agent A: map-codebase.md (post-mapping metadata)    │
  │  │  Sub-Agent B: complete-milestone.md (compact + remap)    │
  │  │  Sub-Agent C: 4 staleness check workflows                │
  │  │  Sub-Agent D: test suite                                 │
  │  └──────────────────────────────────────────────────────────┘
  │       All 4 run simultaneously. No file conflicts.
  │
  ▼  (wait for all 4 to complete)
ORCHESTRATOR: Step 11 — Verification
  │  11a: npm test
  │  11b-c: Manual CLI command verification
  │  11d: Grep audit
  │
  ▼
DONE — Phase 4 complete.
```

### How to Spawn the Sub-Agents

Use a **single message** with **4 parallel Task tool calls**:

```
Task(
  description: "Add metadata step to map-codebase",
  subagent_type: "general-purpose",
  mode: "dontAsk",
  prompt: [Sub-Agent A prompt]
)

Task(
  description: "Add compaction and remap to complete-milestone",
  subagent_type: "general-purpose",
  mode: "dontAsk",
  prompt: [Sub-Agent B prompt]
)

Task(
  description: "Add staleness checks to 4 workflows",
  subagent_type: "general-purpose",
  mode: "dontAsk",
  prompt: [Sub-Agent C prompt]
)

Task(
  description: "Add Phase 4 tests",
  subagent_type: "general-purpose",
  mode: "dontAsk",
  prompt: [Sub-Agent D prompt]
)
```

### Failure Recovery

**If `npm test` fails after sub-agents complete:**
1. Read test output to identify failing tests
2. Determine which file has the issue
3. Fix directly — most failures will be JSON field mismatches or missing assertions
4. Re-run tests

**If a sub-agent misses something:**
Fix directly — the orchestrator knows the full picture at this point.

**If the staleness check doesn't work in a real git repo:**
Test manually using Step 11b. Most likely issues: git command escaping, diff stat parsing regex, or config path.

---

## Risk Mitigation

**Risk: `git diff --stat` output format varies across git versions.**
Mitigation: The parsing regex handles all standard formats (`N files changed`, `N file changed`, optional insertions/deletions). Test with git 2.x+.

**Risk: STATE.md compaction regex doesn't match all STATE.md formats.**
Mitigation: The section extraction uses `## Header` + content + next `## Header` boundaries, which matches the template format. Test with a full STATE.md fixture.

**Risk: Auto-remap at milestone completion is slow (4 agents).**
Mitigation: This is by design — milestone completion is an infrequent, heavyweight operation. The mapper agents run in parallel. If one fails, it doesn't block milestone completion.

**Risk: `codebase_mapping.last_mapped_commit` points to a rebased/force-pushed commit that no longer exists.**
Mitigation: The `commitCheck` in `cmdCodebaseStalenessCheck` handles this — returns `reason: 'commit_not_found'` with `stale: true`, recommending a remap.

**Risk: Workflow modifications break existing flow.**
Mitigation: All new steps are additive (inserted between existing steps) and conditional (staleness check only acts if stale). Existing behavior is preserved when codebase_mapping metadata is absent.

---

## What Doesn't Change

- The `bp-codebase-mapper` agent — identical behavior, just gets re-triggered
- The 7 codebase output documents — same templates, same structure
- The 4 focus areas (tech, arch, quality, concerns) — unchanged
- `resolveModelInternal` — no changes (Phase 5 adds `agent_models` override)
- The `map-codebase` command and its agent spawning — unchanged (metadata step is additive)
- Existing STATE.md behavior between milestones — compaction only fires at milestone completion
- The staleness threshold (10 files / 200 lines) — hardcoded in v1, tunable in a future iteration
