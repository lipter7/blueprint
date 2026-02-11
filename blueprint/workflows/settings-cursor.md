<purpose>
Interactive configuration of Blueprint workflow agents (research, plan_check, verifier), per-agent model selection, and git branching strategy via sequential AskQuestion prompts. Cursor-specific variant that replaces profile-based model selection with individual model assignment per agent role. Updates .blueprint/config.json with user preferences.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="ensure_and_load_config">
Ensure config exists and load current state:

```bash
node ~/.cursor/blueprint/bin/blueprint-tools.js config-ensure-section
INIT=$(node ~/.cursor/blueprint/bin/blueprint-tools.js state load)
```

Creates `.blueprint/config.json` with defaults if missing and loads current config values.
</step>

<step name="read_current">
```bash
cat .blueprint/config.json
```

Parse current values:
- `agent_models` — per-agent model assignments (default: `{}`)
- `workflow.research` — spawn researcher during plan-phase (default: `true`)
- `workflow.plan_check` — spawn plan checker during plan-phase (default: `true`)
- `workflow.verifier` — spawn verifier during execute-phase (default: `true`)
- `git.branching_strategy` — branching approach (default: `"none"`)

If `agent_models` is empty or missing, derive defaults from the `balanced` profile:
- bp-planner: claude-opus-4
- bp-roadmapper: claude-sonnet-4-5
- bp-executor: claude-sonnet-4-5
- bp-phase-researcher: claude-sonnet-4-5
- bp-project-researcher: claude-sonnet-4-5
- bp-research-synthesizer: claude-sonnet-4-5
- bp-debugger: claude-sonnet-4-5
- bp-codebase-mapper: claude-sonnet-4-5
- bp-verifier: claude-sonnet-4-5
- bp-plan-checker: claude-sonnet-4-5
- bp-integration-checker: claude-sonnet-4-5
</step>

<step name="present_model_selection">
Configure models for each agent role. Group agents by function to reduce question count. Ask each group sequentially using AskQuestion, waiting for a response before proceeding to the next.

Available models to present for each selection:
- `claude-sonnet-4-5`
- `claude-opus-4`
- `gpt-4o`
- `gpt-4.1`
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `o3`
- `o4-mini`

<cursor_interaction type="configuration_chain" id="agent-model-selection">
IMPORTANT: You MUST use the AskQuestion tool for EACH group below. Do NOT skip any group. Do NOT proceed to the next group until the user responds.

**Group 1 — Planning agents (bp-planner, bp-roadmapper):**

Ask via AskQuestion:
- Context: "Select model for planning agents (bp-planner, bp-roadmapper). These agents create phase plans and project roadmaps. Higher-capability models produce better architectural decisions."
- Options: claude-sonnet-4-5, claude-opus-4, gpt-4o, gpt-4.1, gemini-2.5-pro, gemini-2.5-flash, o3, o4-mini
- Show the current value if one exists in agent_models
- Wait for response

Store selection for both bp-planner and bp-roadmapper.

**Group 2 — Execution agent (bp-executor):**

Ask via AskQuestion:
- Context: "Select model for the execution agent (bp-executor). This agent implements plan tasks and writes code. Balances code quality with token cost."
- Options: claude-sonnet-4-5, claude-opus-4, gpt-4o, gpt-4.1, gemini-2.5-pro, gemini-2.5-flash, o3, o4-mini
- Show the current value if one exists in agent_models
- Wait for response

Store selection for bp-executor.

**Group 3 — Research agents (bp-phase-researcher, bp-project-researcher, bp-research-synthesizer):**

Ask via AskQuestion:
- Context: "Select model for research agents (bp-phase-researcher, bp-project-researcher, bp-research-synthesizer). These agents gather and synthesize information before planning. Good results at lower cost tiers."
- Options: claude-sonnet-4-5, claude-opus-4, gpt-4o, gpt-4.1, gemini-2.5-pro, gemini-2.5-flash, o3, o4-mini
- Show the current value if one exists in agent_models
- Wait for response

Store selection for all three research agents.

**Group 4 — Verification agents (bp-verifier, bp-plan-checker, bp-integration-checker):**

Ask via AskQuestion:
- Context: "Select model for verification agents (bp-verifier, bp-plan-checker, bp-integration-checker). These agents check plans and execution results. Reliable at lower cost tiers."
- Options: claude-sonnet-4-5, claude-opus-4, gpt-4o, gpt-4.1, gemini-2.5-pro, gemini-2.5-flash, o3, o4-mini
- Show the current value if one exists in agent_models
- Wait for response

Store selection for all three verification agents.

**Group 5 — Utility agents (bp-debugger, bp-codebase-mapper):**

Ask via AskQuestion:
- Context: "Select model for utility agents (bp-debugger, bp-codebase-mapper). The debugger diagnoses issues; the codebase mapper analyzes project structure."
- Options: claude-sonnet-4-5, claude-opus-4, gpt-4o, gpt-4.1, gemini-2.5-pro, gemini-2.5-flash, o3, o4-mini
- Show the current value if one exists in agent_models
- Wait for response

Store selection for both bp-debugger and bp-codebase-mapper.

If the user provides a model name not in the list, accept it as-is (custom model support).
</cursor_interaction>
</step>

<step name="present_workflow_toggles">
Ask workflow toggle and git branching questions sequentially.

<cursor_interaction type="configuration_chain" id="workflow-and-git-settings">
IMPORTANT: You MUST use the AskQuestion tool for EACH question below. Do NOT skip any. Wait for each response before asking the next.

**Question 1 — Plan Researcher:**

Ask via AskQuestion:
- Context: "Spawn Plan Researcher? This agent researches domain context before the planner creates phase plans."
- Options:
  1. "Yes" -- Research phase goals before planning
  2. "No" -- Skip research, plan directly from existing context
- Show current value if set
- Wait for response

**Question 2 — Plan Checker:**

Ask via AskQuestion:
- Context: "Spawn Plan Checker? This agent verifies plans meet phase goals before execution begins."
- Options:
  1. "Yes" -- Verify plans meet phase goals
  2. "No" -- Skip plan verification
- Show current value if set
- Wait for response

**Question 3 — Execution Verifier:**

Ask via AskQuestion:
- Context: "Spawn Execution Verifier? This agent verifies phase completion after executors finish."
- Options:
  1. "Yes" -- Verify must-haves after execution
  2. "No" -- Skip post-execution verification
- Show current value if set
- Wait for response

**Question 4 — Git Branching Strategy:**

Ask via AskQuestion:
- Context: "Git branching strategy for Blueprint work?"
- Options:
  1. "None (Recommended)" -- Commit directly to current branch
  2. "Per Phase" -- Create branch for each phase (bp/phase-{N}-{name})
  3. "Per Milestone" -- Create branch for entire milestone (bp/{version}-{name})
- Show current value if set
- Wait for response
</cursor_interaction>
</step>

<step name="update_config">
Merge all selections into existing config.json:

```json
{
  ...existing_config,
  "agent_models": {
    "bp-planner": "<group-1-selection>",
    "bp-roadmapper": "<group-1-selection>",
    "bp-executor": "<group-2-selection>",
    "bp-phase-researcher": "<group-3-selection>",
    "bp-project-researcher": "<group-3-selection>",
    "bp-research-synthesizer": "<group-3-selection>",
    "bp-debugger": "<group-5-selection>",
    "bp-codebase-mapper": "<group-5-selection>",
    "bp-verifier": "<group-4-selection>",
    "bp-plan-checker": "<group-4-selection>",
    "bp-integration-checker": "<group-4-selection>"
  },
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone"
  }
}
```

Write updated config to `.blueprint/config.json`.
</step>

<step name="confirm">
Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Blueprint > SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent Models:
| Agent Group          | Agents                                                    | Model              |
|----------------------|-----------------------------------------------------------|--------------------|
| Planning             | bp-planner, bp-roadmapper                                 | {group-1-selection} |
| Execution            | bp-executor                                               | {group-2-selection} |
| Research             | bp-phase-researcher, bp-project-researcher, bp-research-synthesizer | {group-3-selection} |
| Verification         | bp-verifier, bp-plan-checker, bp-integration-checker      | {group-4-selection} |
| Utility              | bp-debugger, bp-codebase-mapper                           | {group-5-selection} |

Workflow Settings:
| Setting              | Value |
|----------------------|-------|
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Execution Verifier   | {On/Off} |
| Git Branching        | {None/Per Phase/Per Milestone} |

These settings apply to future /bp:plan-phase and /bp:execute-phase runs.

Quick commands:
- /bp:settings — re-run this configuration
- /bp:plan-phase --research — force research
- /bp:plan-phase --skip-research — skip research
- /bp:plan-phase --skip-verify — skip plan check
```
</step>

</process>

<critical_rules>
- NEVER skip an AskQuestion interaction. Every group and toggle must be presented to the user.
- NEVER assume a model selection. Always wait for explicit user input.
- ALWAYS show the current value when one exists, so the user can keep it by selecting the same option.
- If the user types a model identifier not in the presented list, accept it as a custom model.
- ALWAYS write all 11 agent entries to agent_models, even if some share the same model.
- NEVER remove existing config keys not managed by this workflow (gates, parallelization, etc.).
- Merge into existing config — do not overwrite the entire file.
</critical_rules>

<success_criteria>
- [ ] Current config read
- [ ] User presented with 5 model group selections (covering all 11 agents)
- [ ] User presented with 3 workflow toggles (research, plan_check, verifier)
- [ ] User presented with git branching strategy selection
- [ ] Config updated with agent_models, workflow, and git sections
- [ ] Changes confirmed to user with summary table
</success_criteria>
