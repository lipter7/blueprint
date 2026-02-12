# Blueprint Refactor: Phase Overview

**Source:** Synthesized from research results and the North Star document.
**Status:** [Draft | Active | Complete]

**Completed plans archived to:** `docs/blueprint/refactor/archive/plans/implementation-plans-summary.md`

---

## Summary

[Brief description of how phases are organized, their ordering rationale, and dependency structure.]

---

## Phase N: [Phase Title] — [Status]

**What:** [1-2 sentences describing the phase scope.]

**Why [this ordering]:** [Why this phase comes where it does in the sequence.]

**Scope:**

### [Sub-feature 1]
- [Key deliverable or change]
- [Key deliverable or change]

### [Sub-feature 2]
- [Key deliverable or change]

**Design work required:**
- [Open design questions that need resolution before implementation]

**What doesn't change:** [Explicitly call out preserved elements to prevent scope creep.]

**Exit criteria:** [Observable, testable conditions that prove the phase is complete.]

---

## Phase Dependency Map

```
Phase 1: [Title]
    |
    v
Phase 2: [Title]
    |
    v
Phase 3: [Title] ──┐
    |                |
Phase N: [Title] ───┘  (note parallel/independent phases)
    |
    v
Phase Final: [Title]
```

[Explain which phases are independent and why.]

---

## Cross-Cutting Concerns

| Concern | Phases Affected | Notes |
|---------|----------------|-------|
| [Shared concern] | N, M | [How it spans phases] |

---

## Research Decisions Summary

| Research Area | Key Decision | Phase |
|---------------|-------------|-------|
| [Area] | [Decision] | N |
