# Research Result: Cursor and Claude Code Runtime Compatibility

**Research area:** Area 4 from `02-research-planner.md`
**Status:** Complete (including sub-research 4a and 4b)

---

## Core Finding

Cursor becomes a first-class installer target alongside Claude Code, OpenCode, and Gemini. The installer writes to `~/.cursor/` (global) or `.cursor/` (local) with format conversions specific to Cursor's primitives. The three main conversion concerns are: (1) commands become Cursor Skills, (2) agent frontmatter is adapted to Cursor's schema, and (3) `AskUserQuestion` references are transformed into explicit `AskQuestion` tool instructions with decision gate patterns. Hooks are deferred to v2.

**Sub-research complete:** Area 4a audited all 13 `AskUserQuestion` interaction points and designed a hybrid conversion strategy (pattern templates for simple gates + bespoke instruction blocks for complex multi-step sequences), using structured `<cursor_interaction>` XML blocks at each interaction point. Area 4b determined that all Blueprint skills use `disable-model-invocation: true` — explicit `/name` invocation only, no auto-invocation.

---

## Decisions

### 1. Cursor Is a Full Installer Target

**Decision:** Add `--cursor` flag to the installer, following the same pattern as `--claude`, `--opencode`, and `--gemini`. Interactive mode adds Cursor as a fifth option. Installation writes to `~/.cursor/` (global) or `.cursor/` (local).

**Why:** Cursor's native `.claude/` compatibility (it reads `.claude/agents/`, `.claude/skills/`) is not sufficient. Cursor has its own agent frontmatter schema, its own hooks system, and its own command/skills format. A proper installation ensures files are in the optimal format for each runtime, just like OpenCode and Gemini already get format-converted files.

**What changes from GSD:** GSD's installer supports Claude Code, OpenCode, and Gemini. Blueprint adds Cursor as a fourth target runtime.

### 2. Commands Convert to Cursor Skills

**Decision:** Blueprint commands install as Cursor Skills (`.cursor/skills/{name}/SKILL.md`) rather than plain Cursor commands (`.cursor/commands/{name}.md`).

**Why:** Cursor Skills have frontmatter (`name`, `description`, `disable-model-invocation`) which preserves the metadata that Claude Code commands carry. Plain Cursor commands are bare markdown with no frontmatter -- they lose description metadata entirely. Skills can be configured for explicit `/skill-name` invocation (via `disable-model-invocation: true`) or for agent-decided auto-invocation. The right default for Blueprint skills needs further research (see Area 4b).

**Conversion from Claude Code command format:**

| Claude Code Field | Cursor Skill Field               | Notes          
|-------------------|----------------------------------|----------------
| `name`            | `name`                           | Direct mapping 
| `description`     | `description`                    | Direct mapping 
| `allowed-tools`   | *(removed)*                      | Cursor skills don't have tool allowlists; tool control comes from prompt instructions 
| `argument-hint`   | *(removed)*                      | No Cursor equivalent 
| *(none)*          | `disable-model-invocation: true` | Always `true` — explicit `/name` invocation only. See Decision #8 (Area 4b)

**Directory structure:**
```
# Claude Code source
commands/bp/map-codebase.md

# Cursor install target
~/.cursor/skills/bp-map-codebase/SKILL.md
```

### 3. Agent Frontmatter Adapts to Cursor Schema

**Decision:** Agent files convert from Claude Code's frontmatter schema to Cursor's schema during installation.

**Conversion:**

| Claude Code Field           | Cursor Field     | Notes 
|-----------------------------|------------------|-----------------------------
| `name`                      | `name`           | Direct mapping 
| `description`               | `description`    | Direct mapping 
| `tools` / `allowed-tools`   | *(removed)*      | Cursor agents don't restrict tools via frontmatter 
| `color`                     | *(removed)*      | Cursor agents don't support color
| *(none)*                    | `model: inherit` | Added; uses parent agent's model. Could map from MODEL_PROFILES in the future 

**Prompt body stays the same** (with tool name adjustments per decision #4).

### 4. AskUserQuestion → AskQuestion Conversion (Critical)

**Decision:** Every instance where `AskUserQuestion` appears in the source -- whether in `allowed-tools` frontmatter, workflow instructions, or agent prompts -- must be converted for Cursor into explicit `AskQuestion` tool usage instructions with decision gate patterns.

**Why this is the most important conversion:** `AskQuestion` in Cursor is not reliably auto-invoked by the agent. Unlike Claude Code where declaring `AskUserQuestion` in `allowed-tools` is sufficient to make the agent use it, Cursor requires explicit instruction in the prompt body. Without this, Cursor will skip user interaction gates and proceed autonomously -- which directly undermines Blueprint's core value proposition of human-in-the-loop interaction.

**The conversion is NOT a simple rename.** It's a structural enhancement:

1. **Frontmatter:** `AskUserQuestion` in `allowed-tools` → removed (no tool allowlists in Cursor)
2. **Prompt body:** Every reference to `AskUserQuestion` → explicit `AskQuestion` instruction pattern

**How the installer conversion works:**

The installer must have a conversion function (like the existing `convertClaudeToOpencodeFrontmatter`) that:
1. **Strips all Claude Code-specific frontmatter** (`allowed-tools`, `argument-hint`, etc.) -- these fields do not function in Cursor and would break the file
2. **Identifies every file containing `AskUserQuestion` references** -- in frontmatter, in workflow steps, in agent instructions
3. **For each identified file,** replaces `AskUserQuestion` references with explicit `AskQuestion` tool usage instructions tailored to the specific workflow context where the interaction gate appears

**Critical:** The conversion is NOT a generic "inject a boilerplate decision gates section." Each instance of `AskUserQuestion` in the current system serves a specific purpose in a specific workflow (e.g., pre-research interview, post-roadmap verification, checkpoint:decision). The installer's conversion must produce instructions that match the *specific* interaction context.

**Sub-research complete (Area 4a):** The full audit of all 13 `AskUserQuestion` interaction points is documented in Decision #7 below, along with the conversion strategy and instruction format specifications.

### 5. Hooks: Not Applicable / Deferred

**Decision:** Skip hooks for the Cursor installation path. The two GSD hooks have different Cursor realities:

- **Statusline (`gsd-statusline.js`):** Cannot be ported. Cursor does not support statusline customization at all -- there is no equivalent feature. This hook is permanently inapplicable to Cursor.
- **Update checker (`gsd-check-update.js`):** Could theoretically be ported to Cursor's `hooks.json` format as a `sessionStart` hook, but this is low priority. Not a v1 concern.

**Cursor's hooks system for reference** (relevant if we ever add Cursor-specific hooks):

| Aspect | Claude Code | Cursor |
|---|---|---|
| Config file | `settings.json` (hooks property) | `hooks.json` (standalone) |
| Event names | `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart` | `preToolUse`, `postToolUse`, `stop`, `sessionStart`, `subagentStart`, `subagentStop`, etc. |
| Protocol | JSON via settings | JSON over stdio, exit codes |
| Extra features | *(none)* | Prompt-based hooks, matchers, loop limits |

### 6. Claude Code-Specific Frontmatter Must Be Stripped

**Decision:** All Claude Code-specific frontmatter (`allowed-tools`, `argument-hint`, and any other fields that are not part of Cursor's schema) must be removed during Cursor installation. This is not optional -- these fields do not function in Cursor and will break file parsing.

**What this means concretely:**
- `allowed-tools:` YAML arrays → **removed entirely**. Cursor does not have per-file tool allowlists. Cursor's agent knows its available tools automatically.
- `argument-hint:` → **removed**. No Cursor equivalent.
- `color:` → **removed**. Cursor agents don't support color.
- `tools:` (comma-separated string format) → **removed**. Cursor agents don't restrict tools via frontmatter.

**The one exception is `AskQuestion`:** While Cursor doesn't need to be told what tools to use for file operations, shell commands, etc., the `AskQuestion` tool does not get reliably auto-selected. Every file that currently references `AskUserQuestion` (whether in frontmatter or prompt body) needs the conversion described in decision #4.

**General tool names in prompt body text** (e.g., "use the Bash tool to run..."): Cursor's agent generally handles these fine without conversion. Cursor tunes its tool-calling per model and interprets intent. No blanket search-and-replace needed for tool names in prose. If specific issues surface during testing, a `claudeToCursorTools` mapping can be added to the installer following the existing pattern.

### 7. AskUserQuestion → AskQuestion Conversion Specification (Area 4a)

**Decision:** Use a hybrid conversion strategy with structured `<cursor_interaction>` XML blocks. Pattern-based templates cover the 4 simple gate types; bespoke instruction blocks handle the 3 complex multi-step sequences. The installer's conversion function applies the appropriate pattern at each interaction point during Cursor installation.

**Why hybrid:** The 13 AskUserQuestion interaction points across the system fall into 6 gate pattern types. Most are structurally identical ("present options, get answer, route") and can share a template. But 3 complex sequences (debug's 5-question chain, settings' 5-chained config, discuss-phase's iterative deep-dive) have unique flow control that templates would dilute. Bespoke blocks for those 3 ensure Cursor's agent follows the precise multi-step interaction flow.

**Why structured XML blocks:** Cursor's agent needs explicit, self-contained instructions at each interaction point to reliably use `AskQuestion`. Inline directives are too easy to miss. A shared reference doc adds an external dependency that could be missed during install. Structured `<cursor_interaction>` blocks are consistent with the existing XML prompt style (`<step>`, `<process>`, `<critical_rules>`), self-contained at each interaction point, and programmatically insertable by the installer.

#### Complete AskUserQuestion Audit

**13 interaction points across 37 files:**

| # | Interaction | File(s) | Gate Type | Conversion |
|---|-------------|---------|-----------|------------|
| 1 | Discovery confidence gate | `workflows/discovery-phase.md` | Confidence | Template |
| 2 | Phase context existence check | `workflows/discuss-phase.md` | Decision | Template |
| 3 | Gray area multi-select | `workflows/discuss-phase.md` | Decision | Template |
| 4 | Per-area deep-dive (4 Qs + continuation) | `workflows/discuss-phase.md` | Continuation | **Bespoke** |
| 5 | Quick task description | `workflows/quick.md` | Action | Template |
| 6 | Todo duplicate check | `workflows/add-todo.md` | Decision | Template |
| 7 | Settings configuration (5 chained) | `workflows/settings.md` | Configuration | **Bespoke** |
| 8 | Milestone branch merge strategy | `workflows/complete-milestone.md` | Decision | Template |
| 9 | Brownfield mapping offer | `workflows/new-project.md` | Decision | Template |
| 10 | New project decision gate | `workflows/new-project.md` | Continuation | Template |
| 11 | New milestone research decision | `workflows/new-milestone.md` | Decision | Template |
| 12 | Todo action routing | `workflows/check-todos.md` | Action | Template |
| 13 | Debug symptom gathering (5 Qs) | `commands/gsd/debug.md` | Configuration | **Bespoke** |

**10 command files declare `AskUserQuestion` in `allowed-tools` frontmatter:** `quick.md`, `settings.md`, `execute-phase.md`, `discuss-phase.md`, `plan-milestone-gaps.md`, `new-project.md`, `debug.md`, `check-todos.md`, `new-milestone.md`, `reapply-patches.md`. All `allowed-tools` references are stripped during Cursor conversion (per Decision #6).

**2 reference files define AskUserQuestion patterns:** `references/questioning.md` (usage guidance), `references/checkpoints.md` (checkpoint protocol). These references are installed as-is for Cursor — they guide agent behavior through prompt content, not tool declarations.

#### Gate Pattern Templates

The installer maintains 4 reusable `<cursor_interaction>` templates, one per simple gate type:

**Confidence Gate Template** (used by: #1)
```xml
<cursor_interaction type="confidence_gate" id="{gate_id}">
IMPORTANT: You MUST use the AskQuestion tool here. Do NOT proceed without user input.

Present the following to the user via AskQuestion:
- Context: {what_was_just_completed}
- Options: {confidence_options}
- Wait for response before continuing

Based on user's choice:
- If "{option_a}": {action_a}
- If "{option_b}": {action_b}
- If user provides custom input: incorporate their guidance and proceed accordingly
</cursor_interaction>
```

**Decision Gate Template** (used by: #2, #3, #6, #8, #9, #11)
```xml
<cursor_interaction type="decision_gate" id="{gate_id}">
IMPORTANT: You MUST use the AskQuestion tool here. Do NOT proceed without user input.

Present the following choice to the user via AskQuestion:
- Context: {decision_context}
- Options:
  1. {option_1} — {description_1}
  2. {option_2} — {description_2}
  {3. {option_3} — {description_3} (if applicable)}
- Wait for response before continuing

Route based on user's choice:
- "{option_1}": {action_1}
- "{option_2}": {action_2}
- Custom input: {fallback_action}
</cursor_interaction>
```

**Continuation Gate Template** (used by: #10)
```xml
<cursor_interaction type="continuation_gate" id="{gate_id}">
IMPORTANT: You MUST use the AskQuestion tool here. Do NOT proceed without user input.

Ask the user via AskQuestion:
- Context: {current_state_summary}
- Options:
  1. {proceed_option} — {proceed_description}
  2. {continue_option} — {continue_description}
- Wait for response before continuing

If "{continue_option}": loop back to {loop_target_step}
If "{proceed_option}": continue to next step
</cursor_interaction>
```

**Action Gate Template** (used by: #5, #12)
```xml
<cursor_interaction type="action_gate" id="{gate_id}">
IMPORTANT: You MUST use the AskQuestion tool here. Do NOT proceed without user input.

Present available actions to the user via AskQuestion:
- Context: {action_context}
- Options:
  1. {action_1} — {description_1}
  2. {action_2} — {description_2}
  3. {action_3} — {description_3}
  {4. {action_4} — {description_4} (if applicable)}
- Wait for response before continuing

Execute the user's chosen action:
- "{action_1}": {execute_1}
- "{action_2}": {execute_2}
- "{action_3}": {execute_3}
- Custom input: {fallback_action}
</cursor_interaction>
```

#### Bespoke Conversion Specifications

**#4: Discuss-Phase Deep-Dive (iterative questioning)**

This interaction has unique flow control: 4 questions per selected area, with a continuation check between areas. The template would need to encode both the per-question and per-area loop.

```xml
<cursor_interaction type="deep_dive" id="discuss-area-questioning">
IMPORTANT: For EACH selected gray area, you MUST conduct a focused discussion using AskQuestion.

For each area in the selected list:
  1. Ask 4 specific decision questions about this area using AskQuestion
     - Each question should have 2-3 concrete options
     - Include a "You decide" option when the decision is genuinely discretionary
     - Wait for each response before asking the next question
  2. After all 4 questions for an area, use AskQuestion to ask:
     - "More questions about {area_name}?" / "Move to next area" / "Done discussing"
  3. If "More questions": ask additional questions about this area
  4. If "Move to next area": proceed to the next selected area
  5. If "Done discussing": stop discussion, move to CONTEXT.md creation

Record every user decision. Each answer populates a decision record in CONTEXT.md.
Do NOT skip areas. Do NOT proceed to CONTEXT.md creation until the user says "Done" or all areas are covered.
</cursor_interaction>
```

**#7: Settings Configuration (5 chained questions)**

This interaction chains 5 sequential AskUserQuestion calls, each independent. The template would need to encode the full sequence.

```xml
<cursor_interaction type="configuration_chain" id="settings-configuration">
IMPORTANT: You MUST ask ALL 5 configuration questions using AskQuestion, one at a time. Do NOT skip any.

Ask each question in sequence via AskQuestion. Wait for each response before asking the next.

1. Model Profile:
   - "Quality" — Opus-heavy, highest accuracy, highest cost
   - "Balanced (Recommended)" — Mixed models, good accuracy, moderate cost
   - "Budget" — Sonnet/Haiku, fastest, lowest cost

2. Plan Researcher (research before planning):
   - "Yes" — Run phase researcher before planner
   - "No" — Skip research, plan from existing context

3. Plan Checker (verify plans after creation):
   - "Yes" — Run plan checker after planner
   - "No" — Skip plan verification

4. Execution Verifier (verify after execution):
   - "Yes" — Run verifier after executor
   - "No" — Skip execution verification

5. Git Branching Strategy:
   - "None (Recommended)" — All work on current branch
   - "Per Phase" — Create branch per phase
   - "Per Milestone" — Create branch per milestone

After all 5 responses are collected, write the configuration to .blueprint/config.json.
</cursor_interaction>
```

**#13: Debug Symptom Gathering (5 sequential questions)**

This interaction collects 5 pieces of diagnostic information sequentially. Each builds on the previous.

```xml
<cursor_interaction type="symptom_gathering" id="debug-symptoms">
IMPORTANT: You MUST ask ALL 5 diagnostic questions using AskQuestion, one at a time. Do NOT skip any. Do NOT start debugging until all 5 are answered.

Ask each question in sequence via AskQuestion:

1. Expected behavior: "What should happen? Describe the correct behavior."
   (Freeform response — no predefined options)

2. Actual behavior: "What happens instead? Describe what you observe."
   (Freeform response)

3. Error messages: "Are there any error messages? Paste or describe them."
   (Freeform response — "None" is valid)

4. Timeline: "When did this start? Has it ever worked correctly?"
   (Freeform response)

5. Reproduction: "How do you trigger this issue? What steps reproduce it?"
   (Freeform response)

After collecting all 5 responses, populate the debug session file at .blueprint/debug/{slug}.md with the gathered information, then proceed to hypothesis formation.
</cursor_interaction>
```

#### How the Installer Applies Conversions

The `convertClaudeToCursorSkill()` and `convertClaudeToCursorAgent()` functions in the installer:

1. **Strip Claude Code frontmatter** (per Decision #6)
2. **Scan prompt body for `AskUserQuestion` references**
3. **For each reference, determine the gate type** from a lookup table (keyed by file path + interaction ID)
4. **If template-based:** Replace the `AskUserQuestion` reference with the appropriate gate template, filled with the instance-specific parameters (options, context, actions)
5. **If bespoke:** Replace the `AskUserQuestion` reference with the pre-written bespoke block for that specific interaction
6. **For frontmatter-only references** (files that only have `AskUserQuestion` in `allowed-tools`): no prompt body changes needed beyond the frontmatter strip — these files reference AskUserQuestion as a tool declaration only, and the corresponding workflow file (which IS converted) handles the actual interaction

The lookup table lives in the installer as a data structure, e.g.:

```javascript
const CURSOR_INTERACTION_MAP = {
  'workflows/discovery-phase.md': [
    { id: 'confidence_gate', type: 'confidence', params: { /* instance-specific */ } }
  ],
  'workflows/discuss-phase.md': [
    { id: 'context_check', type: 'decision', params: { /* ... */ } },
    { id: 'gray_area_select', type: 'decision', params: { /* ... */ } },
    { id: 'area_deep_dive', type: 'bespoke', block: DISCUSS_DEEP_DIVE_BLOCK }
  ],
  // ... etc for all 13 interaction points
};
```

### 8. All Blueprint Skills Use Explicit Invocation Only (Area 4b)

**Decision:** All Blueprint Cursor Skills use `disable-model-invocation: true`. The user must always type `/skill-name` to invoke a Blueprint skill. Cursor's agent will never auto-invoke a Blueprint skill based on context.

**Why:** Three reinforcing reasons:

1. **Commands don't auto-invoke each other.** The codebase investigation found that GSD/Blueprint commands are designed for explicit user invocation. Commands output "Next Up" markdown links suggesting the next step, but never auto-chain. The only exception is Yolo mode in `transition.md`, which is an opt-in non-interactive mode — the opposite of Blueprint's philosophy. Agent spawning happens *within* commands (planner spawns phase-researcher, executor, etc.), not *between* commands.

2. **Human-in-the-loop is Blueprint's core value.** Auto-invocation would let Cursor's agent decide to run `bp-plan-phase` or `bp-execute-phase` without the user explicitly choosing to advance. This directly contradicts the interaction model from Item 1 (pre-research interviews, post-creation verification gates). Every workflow transition should be a conscious user decision.

3. **Prevents unwanted invocation during unrelated work.** If a user is doing normal coding in a Blueprint project and mentions "planning," Cursor's agent should not auto-invoke `bp-plan-phase`. The skills are heavyweight workflow orchestrators, not lightweight utilities.

**What this means for the installer:**

```yaml
# Every Cursor Skill gets this frontmatter
---
name: bp-map-codebase
description: Map and analyze an existing codebase
disable-model-invocation: true
---
```

**What this means for cross-command discovery:** Since skills can't auto-invoke each other, the "Next Up" suggestions in command output become the primary discoverability mechanism. These should be clear and prominent in the Cursor output, formatted as recognizable `/skill-name` references that the user can type.

---

## What Stays the Same

- **Source of truth remains Claude Code format.** All commands, agents, workflows, templates, and references are authored in Claude Code format. The installer converts for each runtime.
- **Installer architecture.** The existing `install.js` pattern of reading source files, converting format, and writing to target directories extends naturally to Cursor.
- **Agent prompt bodies.** The XML-structured prompt content (`<role>`, `<process>`, `<critical_rules>`, etc.) works identically in both runtimes.
- **Subagent spawning.** Both runtimes use a `Task` tool to spawn subagents by name. Cursor auto-discovers agents from `.cursor/agents/`.
- **CLAUDE.md / AGENTS.md support.** Cursor reads both natively. Project-level guidance can be shared without conversion.

---

## Implications for Implementation Planning

### What's Mechanical (Can Be Batched)

- Add Cursor to the installer's runtime selection menu (`promptRuntime`, flag parsing)
- Add `getDirName('cursor')` → `.cursor` mapping
- Add `getGlobalDir('cursor')` logic (defaults to `~/.cursor`)
- Create `convertClaudeToCursorAgent()` function (strip `color`, strip `tools`/`allowed-tools`, add `model: inherit`)
- Create Cursor Skills directory structure generator (`commands/bp/*.md` → `.cursor/skills/bp-*/SKILL.md`)
- Create `convertClaudeToCursorSkill()` function (convert frontmatter, strip `allowed-tools`/`argument-hint`, set `disable-model-invocation: true`)
- Add Cursor to uninstall logic
- Add Cursor path prefix replacement (`~/.claude/` → `~/.cursor/`)

### What Requires Design Work

- ~~**AskQuestion conversion audit (Area 4a):**~~ **RESOLVED** — See Decision #7. Hybrid conversion strategy with 4 gate templates + 3 bespoke blocks. The `CURSOR_INTERACTION_MAP` data structure and templates are specified above.
- ~~**`disable-model-invocation` decision (Area 4b):**~~ **RESOLVED** — See Decision #8. All skills use `disable-model-invocation: true`.
- **Skills directory naming convention:** Determine naming convention for skill directories (e.g., `bp-map-codebase/SKILL.md` vs `map-codebase/SKILL.md`)
- **Implement `CURSOR_INTERACTION_MAP` in installer:** Build the lookup table and template-filling logic in `install.js`. Each of the 13 interaction points needs its instance-specific parameters populated (options text, context descriptions, action routing). The templates and bespoke blocks are specified in Decision #7.

### What's Its Own Phase

- **Cursor hooks support (v2):** When it's time, porting hooks to Cursor's `hooks.json` format is a separate effort requiring its own testing and validation

---

## Open Questions

### ~~Sub-Research Required (Areas 4a and 4b)~~ RESOLVED

- ~~**Area 4a: AskQuestion conversion audit.**~~ **COMPLETE** — See Decision #7. All 13 interaction points catalogued with conversion strategy specified.
- ~~**Area 4b: `disable-model-invocation` decision.**~~ **COMPLETE** — See Decision #8. All skills explicit-only (`disable-model-invocation: true`).

### For Other Research Areas

- Should Blueprint commands use numbered prefixes (01-, 02-) in skill names for sort order in Cursor's palette? (Area 5: Command Set)
- Do any templates or artifacts need Cursor-specific adjustments? (Area 6: Template/Artifact Design)
- When the migration strategy is designed, should Cursor be supported from the first Blueprint release or added as a fast-follow? (Area 7: Migration)
