<purpose>
Research how to implement a phase. Spawns bp-phase-researcher with phase context.

Standalone research command. For most workflows, use `/bp:plan-phase` which integrates research automatically.
</purpose>

<process>

## Step 0: Resolve Model Profile

@~/.claude/blueprint/references/model-profile-resolution.md

Resolve model for:
- `bp-phase-researcher`

## Step 1: Normalize and Validate Phase

@~/.claude/blueprint/references/phase-argument-parsing.md

```bash
PHASE_INFO=$(node ~/.claude/blueprint/bin/blueprint-tools.js roadmap get-phase "${PHASE}")
```

If `found` is false: Error and exit.

## Step 2: Check Existing Research

```bash
ls .blueprint/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
```

If exists: Offer update/view/skip options.

## Step 3: Gather Phase Context

```bash
# Phase section from roadmap (already loaded in PHASE_INFO)
echo "$PHASE_INFO" | jq -r '.section'
cat .blueprint/REQUIREMENTS.md 2>/dev/null
cat .blueprint/phases/${PHASE}-*/*-CONTEXT.md 2>/dev/null
# Decisions from state-snapshot (structured JSON)
node ~/.claude/blueprint/bin/blueprint-tools.js state-snapshot | jq '.decisions'
```

## Step 4: Spawn Researcher

```
Task(
  prompt="<objective>
Research implementation approach for Phase {phase}: {name}
</objective>

<context>
Phase description: {description}
Requirements: {requirements}
Prior decisions: {decisions}
Phase context: {context_md}
</context>

<output>
Write to: .blueprint/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>",
  subagent_type="bp-phase-researcher",
  model="{researcher_model}"
)
```

## Step 5: Handle Return

- `## RESEARCH COMPLETE` — Display summary, offer: Plan/Dig deeper/Review/Done
- `## CHECKPOINT REACHED` — Present to user, spawn continuation
- `## RESEARCH INCONCLUSIVE` — Show attempts, offer: Add context/Try different mode/Manual

</process>
