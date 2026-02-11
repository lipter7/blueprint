# Research Result: Codebase Staleness Detection

**Research area:** Area 3 from `02-research-planner.md`
**Status:** Complete

---

## Core Finding

Codebase staleness detection is a simple feature: track when the last mapping happened, check if significant changes have occurred since then, and prompt the user with a choice at natural workflow boundaries. No auto-remapping, no targeted focus-area selection in v1. Full remap every time, with user control over whether and when it happens.

---

## Current State (GSD)

- Mapping is entirely one-shot: `map-codebase` spawns 4 parallel agents, writes 7 docs
- Each doc has a freeform `Analysis Date: [YYYY-MM-DD]` but nothing reads it programmatically
- `init map-codebase` in gsd-tools.js checks directory existence only -- no timestamp, no git hash, no staleness tracking
- Zero staleness detection, zero diff tracking, zero partial remap capability

---

## Design

### What to Track

Store in `.blueprint/config.json` (or a dedicated metadata block in each codebase doc):

```json
{
  "codebase_mapping": {
    "last_mapped_at": "2025-01-15T14:30:00Z",
    "last_mapped_commit": "a1b2c3d",
    "docs_produced": ["STACK.md", "ARCHITECTURE.md", "STRUCTURE.md", "CONVENTIONS.md", "TESTING.md", "INTEGRATIONS.md", "CONCERNS.md"]
  }
}
```

The `last_mapped_commit` is the key field -- it enables a precise `git diff --stat <commit>..HEAD` to quantify what's changed since the last mapping.

### When to Check

Staleness checks fire at **natural workflow boundaries after work is completed**:

| Trigger Point | Why |
|---------------|-----|
| `verify-work` (phase verification complete) | Work just finished -- codebase likely changed |
| `complete-milestone` | Major project milestone -- good time to refresh understanding |
| `new-milestone` | Starting fresh milestone -- ensure codebase docs reflect current state |
| `new-project` (brownfield detection) | Already checks for codebase map existence; extend to check staleness |
| `debug` (optional) | Debugging may benefit from fresh codebase understanding |

The check does NOT fire before `plan-phase` or `execute-phase` -- it fires after work completes, so the docs are fresh by the time the next planning cycle begins.

### Detection Mechanism

Simple git-based diff:

```bash
git diff --stat <last_mapped_commit>..HEAD -- . ':!.blueprint' ':!.planning'
```

This excludes planning/blueprint directories (those are our artifacts, not codebase changes) and gives a summary of files changed, insertions, deletions since the last mapping.

**Staleness signal:** Any non-trivial output from the diff. We don't need a sophisticated threshold -- if the codebase has changed meaningfully since the last mapping, the user should know.

A reasonable heuristic for "non-trivial": more than ~10 files changed OR more than ~200 lines changed. But the exact threshold can be tuned -- the important thing is that trivial changes (README edits, comment fixes) don't trigger noise.

### User Interaction

When staleness is detected, present a choice via `AskUserQuestion`:

```
Codebase mapping may be stale.
Last mapped: [date] ([commit hash])
Changes since: [X files changed, +Y/-Z lines]

Options:
1. Full remap (re-run all 4 mapping agents)
2. Skip (continue with current codebase docs)
3. [Other - user can type context like "only remap, package.json changed significantly"]
```

**For debug-triggered staleness:** Consider a modified prompt that frames the remap as diagnostic rather than routine:

```
Codebase mapping may be outdated for debugging.
Last mapped: [date]

Options:
1. Full remap (refresh codebase understanding before debugging)
2. Targeted remap (focus on architecture and concerns for debugging context)
3. Skip (debug with current codebase docs)
```

This is a v2 consideration -- for v1, the standard prompt is sufficient.

### Remap Scope

**v1: Always full remap.** When the user chooses to remap, all 4 mapper agents run (tech, arch, quality, concerns). This is simpler and guarantees complete freshness.

**Future consideration:** The "Other" option in the choice lets users type context like "only remap tech focus, we added new dependencies." This could be parsed to run only specific mapper agents. But building the parsing logic is not worth it for v1 -- the user can just run `map-codebase` manually with a focus argument if they want targeted mapping.

### When Mapping Completes

After any remap (whether triggered by staleness or by direct `map-codebase` invocation):

1. Update `config.json` with new `last_mapped_at` and `last_mapped_commit`
2. Commit the updated codebase docs

This means the `map-codebase` command/workflow needs a small addition: write the mapping metadata to config after the 4 agents finish.

---

## Implementation Notes

### What Changes in blueprint-tools.js

1. **`init map-codebase`** -- Add `last_mapped_at` and `last_mapped_commit` to the returned context (read from config.json)
2. **New utility command** (e.g., `codebase-staleness-check`) -- Takes the stored commit hash, runs `git diff --stat`, returns structured result (stale: true/false, files_changed, lines_changed, summary)
3. **Config update after mapping** -- A command to write the mapping metadata to config.json after mappers complete

### What Changes in Workflows

The trigger-point commands (`verify-work`, `complete-milestone`, `new-milestone`, `new-project`, `debug`) need a staleness check step added. This is a small addition to each workflow:

```
Step N: Check codebase staleness
1. Call blueprint-tools.js codebase-staleness-check
2. If stale:
   a. Present AskUserQuestion with remap options
   b. If user chooses remap: run map-codebase flow
   c. If user chooses skip: continue
3. If not stale: continue silently
```

### What Doesn't Change

- The codebase-mapper agent itself -- identical behavior, just gets re-run
- The 7 output documents -- same templates, same structure
- The 4 focus areas (tech, arch, quality, concerns) -- unchanged

---

## Open Questions (For Other Research Areas)

- How does this interact with the Cursor vs Claude Code installer? Both runtimes need the staleness check in their workflows. (Area 4)
- Does the staleness check need its own command, or is it always embedded in other commands? (Area 5)
