# Model Profiles

Model profiles control which Claude model each Blueprint agent uses. This allows balancing quality vs token spend.

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` |
|-------|-----------|------------|----------|
| bp-planner | opus | opus | sonnet |
| bp-roadmapper | opus | sonnet | sonnet |
| bp-executor | opus | sonnet | sonnet |
| bp-phase-researcher | opus | sonnet | haiku |
| bp-project-researcher | opus | sonnet | haiku |
| bp-research-synthesizer | sonnet | sonnet | haiku |
| bp-debugger | opus | sonnet | sonnet |
| bp-codebase-mapper | sonnet | haiku | haiku |
| bp-verifier | sonnet | sonnet | haiku |
| bp-plan-checker | sonnet | sonnet | haiku |
| bp-integration-checker | sonnet | sonnet | haiku |

## Profile Philosophy

**quality** - Maximum reasoning power
- Opus for all decision-making agents
- Sonnet for read-only verification
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation
- Opus only for planning (where architecture decisions happen)
- Sonnet for execution and research (follows explicit instructions)
- Sonnet for verification (needs reasoning, not just pattern matching)
- Use when: normal development, good balance of quality and cost

**budget** - Minimal Opus usage
- Sonnet for anything that writes code
- Haiku for research and verification
- Use when: conserving quota, high-volume work, less critical phases

## Resolution Logic

Orchestrators resolve model before spawning:

```
1. Read .blueprint/config.json
2. Get model_profile (default: "balanced")
3. Look up agent in table above
4. Pass model parameter to Task call
```

## Switching Profiles

Runtime: `/bp:set-profile <profile>`

Per-project default: Set in `.blueprint/config.json`:
```json
{
  "model_profile": "balanced"
}
```

## Design Rationale

**Why Opus for bp-planner?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why Sonnet for bp-executor?**
Executors follow explicit PLAN.md instructions. The plan already contains the reasoning; execution is implementation.

**Why Sonnet (not Haiku) for verifiers in balanced?**
Verification requires goal-backward reasoning - checking if code *delivers* what the phase promised, not just pattern matching. Sonnet handles this well; Haiku may miss subtle gaps.

**Why Haiku for bp-codebase-mapper?**
Read-only exploration and pattern extraction. No reasoning required, just structured output from file contents.
