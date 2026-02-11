# Phase 5: Cursor Runtime Support — Detailed Implementation Plan

**Parent:** `00-phase-overview.md`
**Status:** Complete
**Dependencies:** Phase 1 (complete), Phase 2 (npm distribution)
**Research Sources:** `research-results/item-4.md` (Cursor compatibility), `research-results/item-5.md` (command set), `docs/cursor/` (Cursor documentation)

---

## Overview

Make Cursor a first-class installer target alongside Claude Code, OpenCode, and Gemini. This involves: adding `--cursor` to the installer, converting 28 commands to Cursor Skills, converting 11 agents to Cursor's frontmatter schema, transforming 13 `AskUserQuestion` interaction points into explicit `AskQuestion` instruction blocks, implementing per-agent model configuration, and building a Cursor-specific settings workflow.

The source of truth remains Claude Code format. The installer converts on write, following the same pattern established by OpenCode (`convertClaudeToOpencodeFrontmatter`) and Gemini (`convertClaudeToGeminiAgent`, `convertClaudeToGeminiToml`).

**Key decisions from research (Items 4, 4a, 4b, 5):**

| Decision | Summary |
|----------|---------|
| Cursor is a full installer target | `--cursor` flag, `getDirName('cursor')` → `.cursor`, global dir `~/.cursor` |
| Commands → Cursor Skills | `.cursor/skills/{name}/SKILL.md` with numbered prefixes |
| Agent frontmatter adapts | Strip `color`, `tools`, `allowed-tools`; add `model: inherit` |
| AskUserQuestion → AskQuestion | Hybrid: 4 gate templates + 3 bespoke blocks via `<cursor_interaction>` XML |
| All skills explicit invocation | `disable-model-invocation: true` on every Blueprint skill |
| Hooks deferred | Statusline impossible; update checker deferred to v2 |
| Per-agent model config | Cursor replaces profiles with per-agent `model` selection in `config.json` |
| Settings bifurcates by runtime | Claude Code keeps 5-question setup; Cursor gets per-agent model flow |

---

## Execution Order

The steps below are ordered by dependency. Infrastructure changes (CLI flags, directory mapping, conversion functions) must land before any files are converted. The `CURSOR_INTERACTION_MAP` data structure must be built before conversion functions can apply interaction point transformations. Testing validates everything at the end.

---

## Step 1: Installer Infrastructure — CLI Flags and Directory Mapping

Add Cursor to the installer's runtime selection, directory mapping, and global path resolution.

### 1a. CLI Flag Parsing (~line 19-40)

Add `--cursor` flag alongside `--claude`, `--opencode`, `--gemini`:

```javascript
const hasCursor = args.includes('--cursor');

// Update selectedRuntimes
if (hasAll) {
  selectedRuntimes = ['claude', 'opencode', 'gemini', 'cursor'];
} else if (hasBoth) {
  selectedRuntimes = ['claude', 'opencode'];
} else {
  if (hasOpencode) selectedRuntimes.push('opencode');
  if (hasClaude) selectedRuntimes.push('claude');
  if (hasGemini) selectedRuntimes.push('gemini');
  if (hasCursor) selectedRuntimes.push('cursor');
}
```

### 1b. `getDirName()` (~line 43-47)

```javascript
function getDirName(runtime) {
  if (runtime === 'opencode') return '.opencode';
  if (runtime === 'gemini') return '.gemini';
  if (runtime === 'cursor') return '.cursor';
  return '.claude';
}
```

### 1c. `getGlobalDir()` (~line 79-107)

Add Cursor case before the Claude Code default:

```javascript
if (runtime === 'cursor') {
  if (explicitDir) {
    return expandTilde(explicitDir);
  }
  if (process.env.CURSOR_CONFIG_DIR) {
    return expandTilde(process.env.CURSOR_CONFIG_DIR);
  }
  return path.join(os.homedir(), '.cursor');
}
```

### 1d. Runtime Selection Menu (`promptRuntime()`, ~line 1594-1630)

Add Cursor as option 4, shift "All" to option 5:

```
1) Claude Code   (~/.claude)
2) OpenCode      (~/.config/opencode) - open source, free models
3) Gemini        (~/.gemini)
4) Cursor        (~/.cursor)
5) All
```

### 1e. Banner and Help Text (~line 109-153)

- Update banner: `"...for Claude Code, OpenCode, Gemini, and Cursor by TÂCHES."`
- Add `--cursor` to help output examples
- Update `--all` description to include Cursor

### 1f. Runtime Labels

Add Cursor label in all `runtimeLabel` assignments (~lines 1306-1308, 803-805, 1528-1530):

```javascript
if (runtime === 'cursor') runtimeLabel = 'Cursor';
```

**After this step:** The installer recognizes `--cursor`, resolves paths correctly, and shows Cursor in the interactive menu. No files are converted yet.

---

## Step 2: Conversion Functions

Build the three new conversion functions that transform Claude Code source files into Cursor-compatible output.

### 2a. `convertClaudeToCursorSkill()` — Commands → Skills

**Purpose:** Convert a Claude Code command file (`.md` with YAML frontmatter) into a Cursor Skill file (`SKILL.md`).

**Conversion rules:**

| Source Field | Action | Target Field |
|-------------|--------|-------------|
| `name: bp:map-codebase` | Keep, strip `bp:` prefix, prepend `bp-` | `name: bp-map-codebase` |
| `description: ...` | Keep as-is | `description: ...` |
| `allowed-tools:` (YAML array) | **Remove entirely** | *(none)* |
| `argument-hint: ...` | **Remove** | *(none)* |
| `agent: bp-planner` | **Remove** | *(none — agent spawning happens in prompt body)* |
| *(none)* | **Add** | `disable-model-invocation: true` |

**Prompt body transformations:**
1. Replace `~/.claude/` with `~/.cursor/` (or relative `.cursor/` for local installs)
2. Apply `CURSOR_INTERACTION_MAP` substitutions (see Step 3) — replace `AskUserQuestion` references with `<cursor_interaction>` blocks
3. Process attribution (same as other runtimes)

**Implementation pattern** (follows `convertClaudeToOpencodeFrontmatter` structure):

```javascript
function convertClaudeToCursorSkill(content, pathPrefix) {
  let converted = content;

  // Path replacement
  converted = converted.replace(/~\/\.claude\//g, pathPrefix);

  // AskUserQuestion → AskQuestion in prompt body
  // (Template/bespoke insertion handled by applyInteractionConversions — see Step 3)

  if (!converted.startsWith('---')) return converted;

  const endIndex = converted.indexOf('---', 3);
  if (endIndex === -1) return converted;

  const frontmatter = converted.substring(3, endIndex).trim();
  const body = converted.substring(endIndex + 3);

  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Strip allowed-tools
    if (trimmed.startsWith('allowed-tools:')) { inAllowedTools = true; continue; }
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) continue;
      if (trimmed && !trimmed.startsWith('-')) inAllowedTools = false;
    }

    // Strip argument-hint
    if (trimmed.startsWith('argument-hint:')) continue;

    // Strip agent
    if (trimmed.startsWith('agent:')) continue;

    // Strip tools (comma-separated string format)
    if (trimmed.startsWith('tools:')) continue;

    // Convert name from bp:command to bp-command
    if (trimmed.startsWith('name:')) {
      const name = trimmed.substring(5).trim().replace(/^bp:/, 'bp-');
      newLines.push(`name: ${name}`);
      continue;
    }

    if (!inAllowedTools) newLines.push(line);
  }

  // Add disable-model-invocation
  newLines.push('disable-model-invocation: true');

  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${body}`;
}
```

**~150 lines of code** including error handling.

### 2b. `convertClaudeToCursorAgent()` — Agent Frontmatter Adaptation

**Purpose:** Convert a Claude Code agent file into Cursor's agent format.

**Conversion rules:**

| Source Field | Action | Target Field |
|-------------|--------|-------------|
| `name: bp-planner` | Keep as-is | `name: bp-planner` |
| `description: ...` | Keep as-is | `description: ...` |
| `tools: Read, Write, ...` | **Remove** | *(none)* |
| `allowed-tools:` (YAML array) | **Remove** | *(none)* |
| `color: green` | **Remove** | *(none)* |
| *(none)* | **Add** | `model: inherit` |

**Prompt body stays the same** — Cursor's agent handles standard tool names (Read, Write, Bash, etc.) without conversion. The only prompt body change is path prefix replacement (`~/.claude/` → `~/.cursor/`).

**Implementation pattern** (follows `convertClaudeToGeminiAgent` structure):

```javascript
function convertClaudeToCursorAgent(content, pathPrefix) {
  let converted = content;
  converted = converted.replace(/~\/\.claude\//g, pathPrefix);

  if (!converted.startsWith('---')) return converted;

  const endIndex = converted.indexOf('---', 3);
  if (endIndex === -1) return converted;

  const frontmatter = converted.substring(3, endIndex).trim();
  const body = converted.substring(endIndex + 3);

  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Strip allowed-tools array
    if (trimmed.startsWith('allowed-tools:')) { inAllowedTools = true; continue; }
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) continue;
      if (trimmed && !trimmed.startsWith('-')) inAllowedTools = false;
    }

    // Strip tools (comma-separated)
    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) continue; // inline tools: value
      inAllowedTools = true; // tools: with YAML array following
      continue;
    }

    // Strip color
    if (trimmed.startsWith('color:')) continue;

    if (!inAllowedTools) newLines.push(line);
  }

  // Add model: inherit
  newLines.push('model: inherit');

  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${body}`;
}
```

**~80 lines of code.**

### 2c. `copySkillsFromCommands()` — Skill Directory Generator

**Purpose:** Convert the flat command directory structure into Cursor's nested skills directory structure with numbered prefixes.

```
# Source (Claude Code format)
commands/bp/map-codebase.md
commands/bp/new-project.md
commands/bp/debug.md

# Target (Cursor Skills format)
.cursor/skills/bp-01-map-codebase/SKILL.md
.cursor/skills/bp-02-new-project/SKILL.md
.cursor/skills/bp-19-debug/SKILL.md
```

**Implementation:**

```javascript
function copySkillsFromCommands(srcDir, destDir, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) return;

  // Clean up old skills
  if (fs.existsSync(destDir)) {
    for (const dir of fs.readdirSync(destDir)) {
      if (dir.startsWith('bp-') && fs.statSync(path.join(destDir, dir)).isDirectory()) {
        fs.rmSync(path.join(destDir, dir), { recursive: true });
      }
    }
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  let installedCount = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

    const commandName = entry.name.replace('.md', '');
    const skillNumber = CURSOR_SKILL_ORDER[commandName];
    const skillDirName = skillNumber != null
      ? `bp-${String(skillNumber).padStart(2, '0')}-${commandName}`
      : `bp-${commandName}`;

    const skillDir = path.join(destDir, skillDirName);
    fs.mkdirSync(skillDir, { recursive: true });

    let content = fs.readFileSync(path.join(srcDir, entry.name), 'utf8');
    content = convertClaudeToCursorSkill(content, pathPrefix);
    content = applyInteractionConversions(content, `commands/bp/${entry.name}`);
    content = processAttribution(content, getCommitAttribution(runtime));

    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    installedCount++;
  }

  return installedCount;
}
```

**~60 lines of code.**

**After this step:** All three conversion functions exist. They can be tested in isolation with sample input.

---

## Step 3: `CURSOR_INTERACTION_MAP` and Interaction Conversion Logic

This is the most complex piece of Phase 5. It transforms the 13 `AskUserQuestion` interaction points into explicit `AskQuestion` instruction blocks for Cursor.

### 3a. Data Structure: `CURSOR_INTERACTION_MAP`

A lookup table keyed by source file path, mapping to interaction point specifications:

```javascript
const CURSOR_INTERACTION_MAP = {
  // Template-based gates (10 interaction points)
  'workflows/discovery-phase.md': [
    {
      id: 'discovery-confidence',
      type: 'confidence_gate',
      marker: /* regex or string to locate the AskUserQuestion reference */,
      params: {
        gate_id: 'discovery-confidence',
        what_was_just_completed: 'Initial codebase discovery scan',
        confidence_options: '"Looks good, proceed" / "I have concerns — let me share"',
        option_a: 'Looks good',
        action_a: 'Continue to full mapping',
        option_b: 'Concerns',
        action_b: 'Incorporate user feedback and re-evaluate approach'
      }
    }
  ],
  'workflows/discuss-phase.md': [
    {
      id: 'context-existence-check',
      type: 'decision_gate',
      marker: /* ... */,
      params: { /* instance-specific options, context, actions */ }
    },
    {
      id: 'gray-area-select',
      type: 'decision_gate',
      marker: /* ... */,
      params: { /* ... */ }
    },
    {
      id: 'area-deep-dive',
      type: 'bespoke',
      marker: /* ... */,
      block: DISCUSS_DEEP_DIVE_BLOCK  // Pre-written XML block
    }
  ],
  'workflows/quick.md': [
    { id: 'quick-task', type: 'action_gate', marker: /* ... */, params: { /* ... */ } }
  ],
  'workflows/add-todo.md': [
    { id: 'todo-duplicate', type: 'decision_gate', marker: /* ... */, params: { /* ... */ } }
  ],
  'workflows/settings.md': [
    { id: 'settings-config', type: 'bespoke', marker: /* ... */, block: SETTINGS_CONFIG_BLOCK }
  ],
  'workflows/complete-milestone.md': [
    { id: 'merge-strategy', type: 'decision_gate', marker: /* ... */, params: { /* ... */ } }
  ],
  'workflows/new-project.md': [
    { id: 'brownfield-offer', type: 'decision_gate', marker: /* ... */, params: { /* ... */ } },
    { id: 'project-decision', type: 'continuation_gate', marker: /* ... */, params: { /* ... */ } }
  ],
  'workflows/new-milestone.md': [
    { id: 'research-decision', type: 'decision_gate', marker: /* ... */, params: { /* ... */ } }
  ],
  'workflows/check-todos.md': [
    { id: 'todo-action', type: 'action_gate', marker: /* ... */, params: { /* ... */ } }
  ],
  // Bespoke: debug command (the only command file, not workflow, with interaction)
  'commands/bp/debug.md': [
    { id: 'debug-symptoms', type: 'bespoke', marker: /* ... */, block: DEBUG_SYMPTOMS_BLOCK }
  ]
};
```

### 3b. Gate Templates (4 templates)

Pre-defined XML template strings with `{placeholder}` tokens:

```javascript
const GATE_TEMPLATES = {
  confidence_gate: `
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
</cursor_interaction>`,

  decision_gate: `
<cursor_interaction type="decision_gate" id="{gate_id}">
IMPORTANT: You MUST use the AskQuestion tool here. Do NOT proceed without user input.

Present the following choice to the user via AskQuestion:
- Context: {decision_context}
- Options:
  1. {option_1} — {description_1}
  2. {option_2} — {description_2}
  {option_3_line}
- Wait for response before continuing

Route based on user's choice:
- "{option_1}": {action_1}
- "{option_2}": {action_2}
- Custom input: {fallback_action}
</cursor_interaction>`,

  continuation_gate: `
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
</cursor_interaction>`,

  action_gate: `
<cursor_interaction type="action_gate" id="{gate_id}">
IMPORTANT: You MUST use the AskQuestion tool here. Do NOT proceed without user input.

Present available actions to the user via AskQuestion:
- Context: {action_context}
- Options:
  1. {action_1} — {description_1}
  2. {action_2} — {description_2}
  3. {action_3} — {description_3}
  {action_4_line}
- Wait for response before continuing

Execute the user's chosen action:
- "{action_1}": {execute_1}
- "{action_2}": {execute_2}
- "{action_3}": {execute_3}
- Custom input: {fallback_action}
</cursor_interaction>`
};
```

### 3c. Bespoke Blocks (3 blocks)

Pre-written complete XML blocks for the three complex interaction sequences. These are defined as string constants (see `research-results/item-4.md` Decision #7 for the full text):

```javascript
const DISCUSS_DEEP_DIVE_BLOCK = `
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
</cursor_interaction>`;

const SETTINGS_CONFIG_BLOCK = `
<cursor_interaction type="configuration_chain" id="settings-configuration">
IMPORTANT: You MUST ask ALL configuration questions using AskQuestion, one at a time. Do NOT skip any.

Ask each question in sequence via AskQuestion. Wait for each response before asking the next.

1. Per-Agent Model Configuration:
   For each of the 11 agent roles, present available models and let the user select:
   - bp-planner, bp-executor, bp-verifier, bp-debugger, bp-codebase-mapper
   - bp-phase-researcher, bp-project-researcher, bp-research-synthesizer
   - bp-roadmapper, bp-plan-checker, bp-integration-checker

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

After all responses are collected, write the configuration to .blueprint/config.json with both agent_models and workflow settings.
</cursor_interaction>`;

const DEBUG_SYMPTOMS_BLOCK = `
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
</cursor_interaction>`;
```

### 3d. `applyInteractionConversions()` — The Replacement Engine

```javascript
/**
 * Apply Cursor interaction conversions to a file's content.
 * Looks up the file in CURSOR_INTERACTION_MAP and replaces AskUserQuestion
 * references with the appropriate gate template or bespoke block.
 *
 * @param {string} content - File content
 * @param {string} relativePath - Relative path from repo root (e.g., 'workflows/discuss-phase.md')
 * @returns {string} - Content with interaction conversions applied
 */
function applyInteractionConversions(content, relativePath) {
  // Normalize path — source files live under blueprint/workflows/ but map keys use workflows/
  const normalizedPath = relativePath
    .replace(/^blueprint\//, '')
    .replace(/^commands\/bp\//, 'commands/bp/');

  const interactions = CURSOR_INTERACTION_MAP[normalizedPath];
  if (!interactions || interactions.length === 0) {
    // No interaction points in this file — just rename AskUserQuestion to AskQuestion
    return content.replace(/\bAskUserQuestion\b/g, 'AskQuestion');
  }

  let result = content;

  for (const interaction of interactions) {
    if (interaction.type === 'bespoke') {
      // Replace the marker region with the bespoke block
      result = result.replace(interaction.marker, interaction.block);
    } else {
      // Fill template with instance-specific parameters
      let filled = GATE_TEMPLATES[interaction.type];
      for (const [key, value] of Object.entries(interaction.params)) {
        filled = filled.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
      result = result.replace(interaction.marker, filled);
    }
  }

  // Catch any remaining AskUserQuestion references
  result = result.replace(/\bAskUserQuestion\b/g, 'AskQuestion');

  return result;
}
```

**~50 lines of code** for the engine, plus **~200 lines** for the data structure and templates.

### 3e. Populating Instance-Specific Parameters

Each of the 13 interaction points needs its specific parameters filled in. This requires reading the source workflow files to understand the exact context of each `AskUserQuestion` usage, then populating the `params` object with the correct options, descriptions, and routing actions.

**Files requiring parameter extraction:**

| File | Interaction Points | Work Required |
|------|-------------------|---------------|
| `blueprint/workflows/discovery-phase.md` | 1 | Read confidence gate context |
| `blueprint/workflows/discuss-phase.md` | 3 | Read context check, gray area select, deep dive |
| `blueprint/workflows/quick.md` | 1 | Read task description flow |
| `blueprint/workflows/add-todo.md` | 1 | Read duplicate check logic |
| `blueprint/workflows/settings.md` | 1 | Read config chain (replaced by Cursor-specific flow) |
| `blueprint/workflows/complete-milestone.md` | 1 | Read merge strategy options |
| `blueprint/workflows/new-project.md` | 2 | Read brownfield offer + decision gate |
| `blueprint/workflows/new-milestone.md` | 1 | Read research decision |
| `blueprint/workflows/check-todos.md` | 1 | Read action routing options |
| `commands/bp/debug.md` | 1 | Read symptom gathering flow |

**This is design work** — each interaction point needs a human to read the source file, understand the context, and write appropriate parameters. It cannot be automated.

**After this step:** The interaction conversion system is complete. All 13 points have templates or bespoke blocks ready for insertion.

---

## Step 4: `CURSOR_SKILL_ORDER` — Numbered Prefix Mapping

Define the ordered mapping from command names to Cursor palette numbers:

```javascript
const CURSOR_SKILL_ORDER = {
  // Core Pipeline
  'map-codebase':           1,
  'new-project':            2,
  'new-milestone':          3,
  'discuss-phase':          4,
  'research-phase':         5,
  'plan-phase':             6,
  'execute-phase':          7,
  'verify-work':            8,
  // Milestone Lifecycle
  'audit-milestone':        9,
  'plan-milestone-gaps':    10,
  'complete-milestone':     11,
  // Phase Manipulation
  'add-phase':              12,
  'insert-phase':           13,
  'remove-phase':           14,
  // Utility
  'progress':               15,
  'resume-work':            16,
  'pause-work':             17,
  'quick':                  18,
  // Debugging
  'debug':                  19,
  // More Utility
  'list-phase-assumptions': 20,
  'add-todo':               21,
  'check-todos':            22,
  // Configuration
  'settings':               23,
  'set-profile':            24,
  'update':                 25,
  'reapply-patches':        26,
  // Help & Community
  'help':                   27,
  'join-discord':           28,
};
```

**Naming result:** `commands/bp/map-codebase.md` → `.cursor/skills/bp-01-map-codebase/SKILL.md`

The numbering follows workflow order: core pipeline first, then lifecycle, then manipulation, then utilities, then configuration. This puts the most-used commands at the top of Cursor's palette.

**~30 lines of code.**

---

## Step 5: Install Logic — Cursor Path in `install()` Function

### 5a. Cursor Detection in `install()` (~line 1284+)

Add `isCursor` flag alongside `isOpencode` and `isGemini`:

```javascript
const isCursor = runtime === 'cursor';
```

### 5b. Command Installation — Skills Path

In the command installation section (~line 1321-1350), add Cursor branch:

```javascript
if (isCursor) {
  // Cursor: Skills in skills/ directory with nested structure
  const skillsDir = path.join(targetDir, 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  const bpSrc = path.join(src, 'commands', 'bp');
  const count = copySkillsFromCommands(bpSrc, skillsDir, pathPrefix, runtime);
  if (count > 0) {
    console.log(`  ${green}✓${reset} Installed ${count} skills to skills/`);
  } else {
    failures.push('skills');
  }
} else if (isOpencode) {
  // ... existing OpenCode path
} else {
  // ... existing Claude Code & Gemini path
}
```

### 5c. Blueprint Core Directory — Workflow Conversion

The `blueprint/` directory (workflows, templates, references) installs to `.cursor/blueprint/` with Cursor-specific transformations. The existing `copyWithPathReplacement` needs extension:

```javascript
// Inside copyWithPathReplacement or a new Cursor-aware copy function:
if (isCursor) {
  content = applyInteractionConversions(content, relativePath);
}
```

This ensures workflows get their `AskUserQuestion` → `<cursor_interaction>` conversions applied.

### 5d. Agent Installation — Cursor Conversion

In the agent installation section (~line 1362-1400), add Cursor branch:

```javascript
if (isOpencode) {
  content = convertClaudeToOpencodeFrontmatter(content);
} else if (isGemini) {
  content = convertClaudeToGeminiAgent(content);
} else if (isCursor) {
  content = convertClaudeToCursorAgent(content, pathPrefix);
}
```

### 5e. Hooks — Skip for Cursor

In the hooks installation section (~line 1423-1441), skip for Cursor:

```javascript
// Copy hooks from dist/ (skip for Cursor — hooks deferred to v2)
if (!isCursor) {
  const hooksSrc = path.join(src, 'hooks', 'dist');
  // ... existing hook copy logic
}
```

### 5f. Settings/Config — Skip Hook Registration for Cursor

In the settings configuration section (~line 1448-1494), skip hook registration for Cursor:

```javascript
// Skip hook and statusline configuration for Cursor (deferred to v2)
if (!isCursor) {
  // ... existing SessionStart hook and statusline logic
}
```

### 5g. Finish Install — Cursor Completion Message

In `finishInstall()` (~line 1509-1537), add Cursor label and command format:

```javascript
if (runtime === 'cursor') program = 'Cursor';

const command = isOpencode ? '/bp-help' : isCursor ? '/bp-27-help' : '/bp:help';
```

### 5h. `installAllRuntimes()` — Handle Cursor in Statusline Logic

In `installAllRuntimes()` (~line 1680-1717), Cursor doesn't need statusline handling:

```javascript
const cursorResult = results.find(r => r.runtime === 'cursor');

// Cursor doesn't use statusline — finishInstall with shouldInstallStatusline=false
if (cursorResult) {
  finishInstall(cursorResult.settingsPath, cursorResult.settings,
    cursorResult.statuslineCommand, false, 'cursor');
}
```

**After this step:** `node bin/install.js --cursor --global` installs all Blueprint files in Cursor format.

---

## Step 6: Uninstall Logic — Cursor Path

### 6a. Add Cursor to `uninstall()` (~line 790-910)

Add Cursor-specific removal for the skills directory structure:

```javascript
if (isCursor) {
  // Cursor: remove skills/bp-*/ directories
  const skillsDir = path.join(targetDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    const dirs = fs.readdirSync(skillsDir);
    let skillCount = 0;
    for (const dir of dirs) {
      const fullPath = path.join(skillsDir, dir);
      if (dir.startsWith('bp-') && fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true });
        skillCount++;
      }
    }
    if (skillCount > 0) {
      removedCount++;
      console.log(`  ${green}✓${reset} Removed ${skillCount} Blueprint skills`);
    }
  }
} else if (isOpencode) {
  // ... existing OpenCode removal
} else {
  // ... existing Claude Code & Gemini removal
}
```

Agents and blueprint directory removal logic already works for Cursor (same `agents/` and `blueprint/` paths). Hooks are skipped (not installed for Cursor).

---

## Step 7: Per-Agent Model Configuration

### 7a. `config.json` Template Update

Add `agent_models` block to the config template in `blueprint/templates/config.json`:

```json
{
  "model_profile": "balanced",
  "agent_models": {},
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  },
  "git": {
    "branching_strategy": "none"
  },
  "gates": { /* ... existing gates ... */ }
}
```

When `agent_models` has entries, they take precedence over `model_profile` for the specified agents.

### 7b. Model Resolution Fallback in `blueprint-tools.js`

Update `resolveModelInternal()` (~18 call sites, lines 3576-4168) to check `agent_models` first:

```javascript
function resolveModelInternal(agentName, config) {
  // Check per-agent override first (Cursor per-agent model config)
  if (config.agent_models && config.agent_models[agentName]) {
    return config.agent_models[agentName];
  }
  // Fall back to profile-based resolution
  const profile = config.model_profile || 'balanced';
  const agentProfile = MODEL_PROFILES[agentName];
  if (agentProfile && agentProfile[profile]) {
    return agentProfile[profile];
  }
  return 'sonnet'; // default fallback
}
```

**Note:** This change benefits Claude Code users too — any user who manually populates `agent_models` in their `config.json` gets per-agent control regardless of runtime.

### 7c. Cursor Settings Workflow — Per-Agent Model Selection

Create a Cursor-specific variant of the settings workflow. Two implementation approaches:

**Option A: Runtime-branching in `workflows/settings.md`** (single file, branches on detection)
**Option B: Separate `workflows/settings-cursor.md`** (Cursor-specific workflow, installed only for Cursor)

**Recommendation:** Option B — cleaner separation. The installer copies `settings-cursor.md` as the settings workflow for Cursor installs, and `settings.md` for all other runtimes. The command file `commands/bp/settings.md` remains the same entry point.

The Cursor settings workflow:
1. Reads available models (presents known model IDs — Cursor doesn't have a programmatic model discovery API, so we present a curated list)
2. For each of 11 agent roles, asks the user to select a model via `AskQuestion`
3. Asks workflow toggles (research, plan_check, verifier)
4. Asks git branching strategy
5. Writes `agent_models` + `workflow` + `git` sections to `config.json`
6. Updates agent frontmatter files with selected models (`model: <selected-id>`)

### 7d. `/bp:set-profile` Adaptation for Cursor

For Cursor, `set-profile` acts as a preset applier:
- "Quality" → sets all agents to opus-tier models
- "Balanced" → sets all agents to a mixed selection matching the `MODEL_PROFILES` balanced column
- "Budget" → sets all agents to haiku-tier models

This writes to `agent_models` in config, then updates agent frontmatter files. Provides a quick on-ramp before fine-tuning with `/bp:settings`.

---

## Step 8: Workflow and Command Conversions — Cursor-Specific Adjustments

### 8a. Command Path References

Throughout workflows and templates, `/bp:command-name` references need to remain unchanged for Cursor since the Cursor skill invocation format is `/bp-NN-command-name`. The installer should convert these references:

```javascript
// In Cursor conversion, convert command references to Cursor skill names
function convertCommandReferences(content) {
  return content.replace(/\/bp:([a-z-]+)/g, (match, name) => {
    const num = CURSOR_SKILL_ORDER[name];
    if (num != null) {
      return `/bp-${String(num).padStart(2, '0')}-${name}`;
    }
    return match; // Unknown command, leave as-is
  });
}
```

This applies to:
- Workflow files referencing "Next Up" commands (~30 files)
- Template files with command suggestions
- Reference files mentioning command names

### 8b. Workflow File Interaction Conversions

The 8 workflow files containing `AskUserQuestion` interaction points (see Step 3e table) get their content transformed by `applyInteractionConversions()` during the copy step. No manual editing needed — the installer handles it.

### 8c. Reference Files

Two reference files mention `AskUserQuestion` as guidance:
- `blueprint/references/questioning.md` — usage guidance for the tool
- `blueprint/references/checkpoints.md` — checkpoint protocol

These install as-is for Cursor — they guide agent behavior through prompt content. A simple rename of `AskUserQuestion` → `AskQuestion` in the prompt body is sufficient (handled by the catch-all in `applyInteractionConversions()`).

---

## Step 9: Test Suite

### 9a. New Test File: Cursor Conversion Tests

Add a new test section to `blueprint/bin/blueprint-tools.test.js` (or a separate test file) covering:

**Conversion function tests (~15 tests):**

| Test | What It Verifies |
|------|-----------------|
| `convertClaudeToCursorSkill` strips `allowed-tools` | Frontmatter stripping |
| `convertClaudeToCursorSkill` strips `argument-hint` | Frontmatter stripping |
| `convertClaudeToCursorSkill` strips `agent` | Frontmatter stripping |
| `convertClaudeToCursorSkill` adds `disable-model-invocation: true` | Frontmatter addition |
| `convertClaudeToCursorSkill` converts `name: bp:X` to `name: bp-X` | Name format conversion |
| `convertClaudeToCursorSkill` preserves `description` | Field preservation |
| `convertClaudeToCursorSkill` replaces path prefix | Path replacement |
| `convertClaudeToCursorAgent` strips `color` | Frontmatter stripping |
| `convertClaudeToCursorAgent` strips `tools` | Frontmatter stripping |
| `convertClaudeToCursorAgent` strips `allowed-tools` array | Frontmatter stripping |
| `convertClaudeToCursorAgent` adds `model: inherit` | Frontmatter addition |
| `convertClaudeToCursorAgent` preserves `name` and `description` | Field preservation |
| `convertClaudeToCursorAgent` replaces path prefix | Path replacement |
| `copySkillsFromCommands` creates numbered directories | Directory naming |
| `copySkillsFromCommands` writes SKILL.md files | File structure |

**Interaction conversion tests (~8 tests):**

| Test | What It Verifies |
|------|-----------------|
| Template-based gate fills parameters correctly | Template substitution |
| Decision gate with 3 options renders correctly | Optional parameter handling |
| Bespoke block replaces marker correctly | Bespoke substitution |
| Remaining `AskUserQuestion` references are caught | Catch-all rename |
| File with no interaction points gets simple rename | Passthrough behavior |
| Multiple interaction points in one file all convert | Multi-point conversion |
| Settings workflow gets Cursor-specific bespoke block | Settings conversion |
| Debug command gets symptom gathering block | Command conversion |

**Integration tests (~5 tests):**

| Test | What It Verifies |
|------|-----------------|
| Full skill install creates correct directory structure | End-to-end skills |
| Full agent install produces valid Cursor frontmatter | End-to-end agents |
| CURSOR_SKILL_ORDER covers all 28 commands | Completeness check |
| Per-agent model config overrides profile | Model resolution |
| `config.json` template includes `agent_models` | Config template |

**Estimated: ~28 new test cases, ~500 lines of test code.**

### 9b. Existing Test Regression

Run the full existing test suite to ensure Cursor changes don't break Claude Code, OpenCode, or Gemini paths. The new code is additive (new `if (isCursor)` branches), so regressions should be minimal.

---

## Step 10: Verification

### 10a. Cursor Install Test

```bash
node bin/install.js --cursor --global
```

Verify:
- Skills installed to `~/.cursor/skills/bp-01-map-codebase/SKILL.md` through `bp-28-*/SKILL.md`
- Each SKILL.md has correct frontmatter: `name`, `description`, `disable-model-invocation: true`
- No SKILL.md contains `allowed-tools`, `argument-hint`, or `agent` fields
- Agents installed to `~/.cursor/agents/bp-*.md`
- Each agent has `name`, `description`, `model: inherit` — no `color`, `tools`, or `allowed-tools`
- `blueprint/` directory installed with Cursor-converted workflows
- No hooks installed (deferred)
- No `settings.json` hook registration (deferred)
- `~/.cursor/blueprint/VERSION` contains correct version

### 10b. Interaction Point Audit

For each of the 13 interaction points, verify the installed Cursor file contains:
1. A `<cursor_interaction>` block (not raw `AskUserQuestion`)
2. Explicit `AskQuestion` tool instruction
3. The correct gate type (confidence/decision/continuation/action/bespoke)
4. Instance-specific parameters filled in (not `{placeholder}` tokens remaining)

```bash
# Should return 0 results from Cursor-installed files:
grep -r "AskUserQuestion" ~/.cursor/skills/ ~/.cursor/agents/ ~/.cursor/blueprint/

# Should return 13 results (one per interaction point):
grep -r "cursor_interaction" ~/.cursor/blueprint/workflows/ ~/.cursor/skills/
```

### 10c. Skill Naming Audit

Verify all 28 skills exist with correct numbered prefixes:

```bash
ls ~/.cursor/skills/ | sort
# Expected: bp-01-map-codebase through bp-28-join-discord (or whatever the final count)
```

### 10d. Cross-Runtime Regression

Install for all runtimes and verify none are broken:

```bash
node bin/install.js --all --global
```

Verify Claude Code, OpenCode, and Gemini installs are unaffected by the new Cursor code paths.

### 10e. Uninstall Test

```bash
node bin/install.js --cursor --global --uninstall
```

Verify:
- All `bp-*` skill directories removed from `~/.cursor/skills/`
- All `bp-*.md` agent files removed from `~/.cursor/agents/`
- `blueprint/` directory removed from `~/.cursor/`
- No non-Blueprint files affected

### 10f. Test Suite Pass

```bash
npm test
```

All existing tests + all new Cursor tests must pass.

---

## Replacement Summary Table

Unlike Phase 1 (which was ~3,600 find-replace operations), Phase 5 is primarily new code with targeted file transformations during installation. There are no codebase-wide string replacements.

| Component | Type | ~Volume | Notes |
|-----------|------|---------|-------|
| Installer infrastructure | New code | ~100 lines | CLI flags, getDirName, getGlobalDir, labels |
| `convertClaudeToCursorSkill()` | New function | ~150 lines | Frontmatter conversion + path replacement |
| `convertClaudeToCursorAgent()` | New function | ~80 lines | Frontmatter stripping + model addition |
| `copySkillsFromCommands()` | New function | ~60 lines | Nested directory structure generator |
| `CURSOR_INTERACTION_MAP` | New data structure | ~200 lines | 13 interaction points × params |
| Gate templates | New constants | ~80 lines | 4 XML template strings |
| Bespoke blocks | New constants | ~80 lines | 3 pre-written XML blocks |
| `applyInteractionConversions()` | New function | ~50 lines | Template filling + marker replacement |
| `CURSOR_SKILL_ORDER` | New constant | ~30 lines | 28-entry lookup table |
| `convertCommandReferences()` | New function | ~15 lines | `/bp:X` → `/bp-NN-X` |
| Install path (`install()`) | Modified function | ~80 lines | New `isCursor` branches |
| Uninstall path (`uninstall()`) | Modified function | ~30 lines | Skills directory removal |
| `installAllRuntimes()` | Modified function | ~15 lines | Cursor statusline skip |
| `promptRuntime()` | Modified function | ~10 lines | Add Cursor option |
| `settings-cursor.md` | New workflow file | ~100 lines | Per-agent model settings flow |
| Model resolution update | Modified logic | ~20 lines | `agent_models` fallback in resolveModelInternal |
| `config.json` template | Modified template | ~5 lines | Add `agent_models` block |
| Test suite | New tests | ~500 lines | ~28 test cases |

**Total new/modified code: ~1,700 lines**

---

## Files with Highest Concentration of Changes

| File | ~Lines Changed | Primary Work |
|------|---------------|-------------|
| `bin/install.js` (~1,755 lines) | +800 new | All conversion functions, CURSOR_INTERACTION_MAP, CURSOR_SKILL_ORDER, install/uninstall paths |
| `blueprint/bin/blueprint-tools.js` (~4,600 lines) | ~20 modified | `resolveModelInternal` agent_models fallback |
| `blueprint/bin/blueprint-tools.test.js` (~2,000 lines) | +500 new | 28 new test cases |
| `blueprint/templates/config.json` | ~5 modified | Add `agent_models` block |
| `blueprint/workflows/settings-cursor.md` | +100 new | New Cursor-specific settings workflow |

---

## Risk Mitigation

**Risk: AskQuestion not reliably invoked by Cursor's agent despite explicit instructions.**
Mitigation: The `<cursor_interaction>` blocks use emphatic `IMPORTANT: You MUST use the AskQuestion tool` phrasing. This is the established pattern from Cursor's own documentation for ensuring tool usage. If testing reveals unreliable invocation, the blocks can be strengthened with additional instruction reinforcement without architectural changes.

**Risk: CURSOR_INTERACTION_MAP markers don't match actual file content.**
Mitigation: Step 10b audit verifies every interaction point. The markers are developed by reading the actual source files during parameter population (Step 3e). Integration tests verify marker matching.

**Risk: Skill numbered prefixes create confusion when commands are added/removed.**
Mitigation: The ordering is defined in a single constant (`CURSOR_SKILL_ORDER`). Adding a new command means adding one entry. Re-ordering is a single-constant change. The numbers are for palette sort order only — they don't affect functionality.

**Risk: Per-agent model config introduces complexity in model resolution.**
Mitigation: The `agent_models` check is a single `if` statement before the existing profile-based fallback. The two systems are compatible — `agent_models` overrides, `model_profile` is the default. No existing behavior changes unless `agent_models` is populated.

**Risk: Cursor's agent schema changes break installed files.**
Mitigation: Cursor's agent/skill schema is documented and stable. The conversion strips unknown fields (defensive) rather than adding unknown ones. If Cursor adds new required fields, a single update to the conversion function fixes all installations.

**Risk: Installer grows too large (already 1,755 lines).**
Mitigation: The conversion functions follow the established pattern (existing `convertClaudeToOpencodeFrontmatter` is ~100 lines, `convertClaudeToGeminiAgent` is ~70 lines). The new functions are proportional. If the file exceeds ~2,500 lines, the conversion functions can be extracted to a `lib/converters.js` module, but this refactoring is not required for Phase 5.

**Risk: Settings workflow bifurcation causes maintenance burden.**
Mitigation: The Cursor settings workflow (`settings-cursor.md`) differs substantially from the Claude Code version (per-agent model selection vs. profile selection). These are genuinely different features, not duplicated code. The shared parts (workflow toggles, branching strategy) are small enough that duplication is acceptable.

---

## Estimated Scope

- **New functions:** 6 (convertClaudeToCursorSkill, convertClaudeToCursorAgent, copySkillsFromCommands, applyInteractionConversions, convertCommandReferences, and the settings-cursor workflow)
- **New data structures:** 3 (CURSOR_INTERACTION_MAP, CURSOR_SKILL_ORDER, GATE_TEMPLATES + bespoke blocks)
- **Modified functions:** 5 (install, uninstall, installAllRuntimes, promptRuntime, resolveModelInternal)
- **Modified files:** 3 (bin/install.js, blueprint/bin/blueprint-tools.js, blueprint/templates/config.json)
- **New files:** 1 (blueprint/workflows/settings-cursor.md)
- **New tests:** ~28 test cases
- **Design work items:** 2 (interaction point parameter population, Cursor model list curation)
- **Verification steps:** 6 (install test, interaction audit, skill naming, cross-runtime regression, uninstall test, test suite)

---

## Dependency Graph

Steps have ordering constraints. This graph shows what blocks what:

```
Step 1: Installer Infrastructure (CLI flags, getDirName, getGlobalDir, menu)
  │
  ├──→ Step 2: Conversion Functions (skill, agent, directory)
  │      │
  │      ├──→ Step 3: CURSOR_INTERACTION_MAP + Templates ◄── MOST COMPLEX
  │      │      │
  │      │      └──→ Step 3e: Parameter Population (design work, reads source files)
  │      │
  │      └──→ Step 4: CURSOR_SKILL_ORDER (numbered prefix mapping)
  │
  │  ┌──── Steps 2, 3, 4 must all complete before Step 5 ────┐
  │  │                                                         │
  │  ▼                                                         │
  │  Step 5: Install Logic (wire up conversion functions) ◄────┘
  │    │
  │    ├──→ Step 6: Uninstall Logic
  │    │
  │    ├──→ Step 7: Per-Agent Model Configuration
  │    │      │
  │    │      ├──→ 7a: config.json template
  │    │      ├──→ 7b: resolveModelInternal update
  │    │      ├──→ 7c: settings-cursor.md workflow
  │    │      └──→ 7d: set-profile adaptation
  │    │
  │    └──→ Step 8: Workflow/Command Conversions
  │
  │  ┌──── Steps 5-8 must all complete ────┐
  │  ▼                                      │
  Step 9: Test Suite ◄─────────────────────┘
  │
  ▼
  Step 10: Verification ◄── GATE: final
```

### Blocking Summary

| Step | Blocks | Blocked By | Can Parallelize? |
|------|--------|------------|-----------------|
| 1 | 2, 3, 4 | nothing | No (foundation) |
| 2 | 5 | 1 | **Yes** — 2a, 2b, 2c are independent |
| 3 | 5 | 1 | **Yes** — 3a-3d are independent from Step 2 |
| 3e | 5 | 3a-3d | No (requires templates to exist for parameter filling) |
| 4 | 5 | 1 | **Yes** — independent of Steps 2, 3 |
| 5 | 6, 7, 8, 9 | 2, 3, 4 | **No** — integrates all conversion work |
| 6 | 9 | 5 | **Yes** — independent of 7, 8 |
| 7 | 9 | 5 | **Yes** — independent of 6, 8 |
| 8 | 9 | 5 | **Yes** — independent of 6, 7 |
| 9 | 10 | 5, 6, 7, 8 | No (single test run) |
| 10 | nothing | 9 | Sub-checks are independent |

---

## Sub-Agent Decomposition

### What the Orchestrator Does Directly

**Step 1 is orchestrator work.** It's a small set of targeted edits to `bin/install.js` — adding CLI flags, a `getDirName` case, a `getGlobalDir` case, and a menu option. Fast and sequential.

**Step 5 is orchestrator work.** It wires up the conversion functions into the install/uninstall paths — adding `if (isCursor)` branches. This requires the full picture of how install() works.

**Step 9c (running tests) and Step 10 (verification) are orchestrator work.** They need the full picture.

### What Sub-Agents Do (Steps 2-4 + 6-8 — Parallel Groups)

After Step 1 completes, the orchestrator can spawn sub-agents for the independent work. After Step 5, another round of parallel sub-agents handles Steps 6, 7, and 8.

---

#### Round 1: After Step 1 (Parallel — 3 Sub-Agents)

##### Sub-Agent A: Conversion Functions

**File:** `bin/install.js`
**Handles:** Steps 2a, 2b, 2c
**Estimated additions:** ~290 lines

**Prompt for spawning:**

```
You are adding three Cursor conversion functions to bin/install.js. Add them
after the existing convertClaudeToGeminiToml() function (~line 584).

1. convertClaudeToCursorSkill(content, pathPrefix):
   - Strip frontmatter fields: allowed-tools (YAML array), argument-hint, agent, tools
   - Convert name: from bp:X to bp-X format
   - Keep: name, description
   - Add: disable-model-invocation: true
   - Replace ~/.claude/ with pathPrefix in body
   - Return converted content

2. convertClaudeToCursorAgent(content, pathPrefix):
   - Strip: color, tools (comma-separated), allowed-tools (YAML array)
   - Keep: name, description
   - Add: model: inherit
   - Replace ~/.claude/ with pathPrefix in body
   - Follow the exact pattern of convertClaudeToGeminiAgent()

3. copySkillsFromCommands(srcDir, destDir, pathPrefix, runtime):
   - Read command files from srcDir
   - For each .md file, look up CURSOR_SKILL_ORDER for numbered prefix
   - Create directory: destDir/bp-NN-commandname/SKILL.md
   - Apply convertClaudeToCursorSkill + processAttribution
   - Return count of installed skills

Reference convertClaudeToGeminiAgent() (~line 371-439) and
convertClaudeToOpencodeFrontmatter() (~line 441-543) for the established
patterns. Match their coding style exactly.

Do NOT edit any other file. Only edit bin/install.js.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

##### Sub-Agent B: Interaction Map and Templates

**File:** `bin/install.js`
**Handles:** Steps 3a-3d, 4
**Estimated additions:** ~430 lines

**Important:** This sub-agent must NOT edit the same region of `bin/install.js` as Sub-Agent A. Add the data structures and functions ABOVE the conversion functions (near the top of the file, after the existing constants) or in a clearly separate section.

**Prompt for spawning:**

```
You are building the CURSOR_INTERACTION_MAP data structure, gate templates,
bespoke blocks, CURSOR_SKILL_ORDER lookup table, and applyInteractionConversions()
function in bin/install.js.

Add these as constants near the top of the file (after the existing tool mapping
constants like claudeToOpencodeTools, ~line 294).

1. GATE_TEMPLATES object with 4 XML template strings:
   - confidence_gate, decision_gate, continuation_gate, action_gate
   (Full template text is in research-results/item-4.md Decision #7)

2. Three bespoke block constants:
   - DISCUSS_DEEP_DIVE_BLOCK
   - SETTINGS_CONFIG_BLOCK (Cursor-specific: per-agent model selection)
   - DEBUG_SYMPTOMS_BLOCK
   (Full block text is in research-results/item-4.md Decision #7)

3. CURSOR_INTERACTION_MAP — keyed by relative file path, each entry has:
   - id, type, marker (regex or string to find the AskUserQuestion reference), params
   READ each source workflow file to determine the correct marker for each
   interaction point. The marker must uniquely identify where the AskUserQuestion
   reference is in the source file.

   Files to read and map:
   - blueprint/workflows/discovery-phase.md (1 point)
   - blueprint/workflows/discuss-phase.md (3 points)
   - blueprint/workflows/quick.md (1 point)
   - blueprint/workflows/add-todo.md (1 point)
   - blueprint/workflows/settings.md (1 point)
   - blueprint/workflows/complete-milestone.md (1 point)
   - blueprint/workflows/new-project.md (2 points)
   - blueprint/workflows/new-milestone.md (1 point)
   - blueprint/workflows/check-todos.md (1 point)
   - commands/bp/debug.md (1 point)

4. CURSOR_SKILL_ORDER — 28-entry lookup (command name → number):
   map-codebase:1, new-project:2, ..., join-discord:28
   (Full list in research-results/item-5.md Decision #4)

5. applyInteractionConversions(content, relativePath):
   - Normalize path
   - Look up in CURSOR_INTERACTION_MAP
   - For template types: fill GATE_TEMPLATES[type] with params
   - For bespoke types: substitute the bespoke block
   - Catch-all: rename remaining AskUserQuestion → AskQuestion

6. convertCommandReferences(content):
   - Replace /bp:X with /bp-NN-X using CURSOR_SKILL_ORDER lookup

Do NOT edit the conversion functions section (convertClaudeToCursor*) — another
agent is writing those. Only add your constants and functions in the designated
section.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

##### Sub-Agent C: Settings Cursor Workflow

**File:** `blueprint/workflows/settings-cursor.md` (NEW FILE)
**Handles:** Step 7c
**Estimated:** ~100 lines

**Prompt for spawning:**

```
You are creating a new file: blueprint/workflows/settings-cursor.md

This is the Cursor-specific settings workflow. It replaces the standard
settings.md workflow when installed for Cursor.

Read blueprint/workflows/settings.md first to understand the current settings
workflow structure (5-question AskUserQuestion chain).

For Cursor, the workflow changes to:
1. Per-agent model configuration (replaces the model profile question):
   - Present known model options for the user to select per agent role
   - 11 agent roles: bp-planner, bp-roadmapper, bp-executor, bp-phase-researcher,
     bp-project-researcher, bp-research-synthesizer, bp-debugger, bp-codebase-mapper,
     bp-verifier, bp-plan-checker, bp-integration-checker
   - Use AskQuestion for each selection (can batch similar roles)

2. Plan Researcher toggle (same as Claude Code)
3. Plan Checker toggle (same as Claude Code)
4. Execution Verifier toggle (same as Claude Code)
5. Git Branching Strategy (same as Claude Code)

After all selections:
- Write agent_models object to .blueprint/config.json
- Write workflow and git settings to .blueprint/config.json
- Update each agent's frontmatter with the selected model

Use the same XML prompt structure (<role>, <process>, <critical_rules>) as the
existing settings.md workflow. Include <cursor_interaction> blocks for the
AskQuestion interactions.

Create ONLY this one new file.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

#### Round 2: After Step 5 (Orchestrator wires up install paths, then spawns parallel agents)

The orchestrator manually adds the `if (isCursor)` branches in `install()` and `uninstall()` using the functions created by Sub-Agents A and B. Then:

##### Sub-Agent D: Test Suite

**File:** `blueprint/bin/blueprint-tools.test.js`
**Handles:** Step 9a, 9b
**Estimated additions:** ~500 lines

**Prompt for spawning:**

```
You are adding Cursor conversion tests to blueprint/bin/blueprint-tools.test.js.

Add a new test section at the end of the file (before the final closing bracket)
titled 'Cursor Conversion Tests'. Use the same test patterns as the existing tests
(node:test module with node:assert).

Write ~28 test cases covering:

1. convertClaudeToCursorSkill tests (~7):
   - Strips allowed-tools YAML array
   - Strips argument-hint
   - Strips agent field
   - Adds disable-model-invocation: true
   - Converts name from bp:X to bp-X
   - Preserves description
   - Replaces ~/.claude/ with provided pathPrefix

2. convertClaudeToCursorAgent tests (~6):
   - Strips color field
   - Strips tools (comma-separated)
   - Strips allowed-tools array
   - Adds model: inherit
   - Preserves name and description
   - Replaces path prefix

3. Interaction conversion tests (~8):
   - Template fills parameters correctly
   - Decision gate with optional 3rd option
   - Bespoke block replaces marker
   - Remaining AskUserQuestion caught
   - File with no interactions gets simple rename
   - Multiple points in one file
   - Settings workflow gets Cursor bespoke
   - Debug command gets symptom block

4. Integration tests (~5):
   - CURSOR_SKILL_ORDER covers all commands (compare against commands/bp/ directory)
   - Numbered directory naming produces correct format
   - Per-agent model config overrides profile in resolveModelInternal
   - config.json template includes agent_models
   - convertCommandReferences converts /bp:X to /bp-NN-X

Read the existing test patterns in the file. Match the style exactly.
Do NOT edit any other file.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

##### Sub-Agent E: Model Resolution + Config Template

**Files:** `blueprint/bin/blueprint-tools.js`, `blueprint/templates/config.json`
**Handles:** Steps 7a, 7b, 7d
**Estimated changes:** ~25 lines

**Prompt for spawning:**

```
You are making two small changes for per-agent model configuration:

1. blueprint/bin/blueprint-tools.js — Update resolveModelInternal() to check
   agent_models first. Find the function (search for 'resolveModelInternal' or
   the MODEL_PROFILES usage). Add a check at the top:

   if (config.agent_models && config.agent_models[agentName]) {
     return config.agent_models[agentName];
   }

   This must happen BEFORE the profile-based lookup.

   Also verify: are there multiple resolveModelInternal implementations or call
   patterns? Update all of them consistently.

2. blueprint/templates/config.json — Add an empty agent_models object to the
   default config template:

   "agent_models": {},

   Place it after model_profile and before workflow.

Do NOT edit any other file. Only edit these two files.
```

**Spawn as:** `subagent_type: "general-purpose"`, `mode: "dontAsk"`

---

### Orchestrator Flow: Putting It All Together

```
ORCHESTRATOR: Step 1 — Installer infrastructure edits
  │  Add --cursor flag, getDirName, getGlobalDir, promptRuntime menu, labels.
  │  ~15 targeted edits in bin/install.js.
  │
  ▼
ORCHESTRATOR: Spawn 3 sub-agents in parallel ◄── SINGLE MESSAGE with 3 Task calls
  │
  │  ┌────────────────────────────────────────────────────────────┐
  │  │  Sub-Agent A: Conversion functions (convertClaudeToCursor*) │
  │  │  Sub-Agent B: Interaction map + templates + skill order      │
  │  │  Sub-Agent C: settings-cursor.md workflow                    │
  │  └────────────────────────────────────────────────────────────┘
  │       All 3 run simultaneously. A and B edit different sections of install.js.
  │       C creates a new file.
  │
  ▼  (wait for all 3 to complete)
ORCHESTRATOR: Step 5 — Wire up install/uninstall paths
  │  Add isCursor branches in install(), uninstall(), installAllRuntimes(),
  │  finishInstall(). Uses functions from Sub-Agents A and B.
  │  ~15 targeted edits in bin/install.js.
  │
  ▼
ORCHESTRATOR: Spawn 2 sub-agents in parallel ◄── SINGLE MESSAGE with 2 Task calls
  │
  │  ┌────────────────────────────────────────────────────────────┐
  │  │  Sub-Agent D: Test suite (28 new tests)                     │
  │  │  Sub-Agent E: Model resolution + config template             │
  │  └────────────────────────────────────────────────────────────┘
  │       Both run simultaneously. No file conflicts.
  │
  ▼  (wait for both to complete)
ORCHESTRATOR: Step 9c — Run tests
  │  npm test
  │  If failures: analyze, fix, re-run.
  │
  ▼
ORCHESTRATOR: Step 10 — Verification
  │  10a: Cursor install test (node bin/install.js --cursor --global)
  │  10b: Interaction point audit (grep for AskUserQuestion/cursor_interaction)
  │  10c: Skill naming audit (ls ~/.cursor/skills/)
  │  10d: Cross-runtime regression (node bin/install.js --all --global)
  │  10e: Uninstall test
  │  10f: Confirm tests pass
  │
  ▼
DONE — Phase 5 complete.
```

### How to Spawn the Sub-Agents

Use a **single message** with parallel Task tool calls for each round.

**Round 1 (3 agents):**
```
Task(description: "Cursor conversion functions", subagent_type: "general-purpose", mode: "dontAsk", prompt: [Sub-Agent A prompt])
Task(description: "Interaction map and templates", subagent_type: "general-purpose", mode: "dontAsk", prompt: [Sub-Agent B prompt])
Task(description: "Cursor settings workflow", subagent_type: "general-purpose", mode: "dontAsk", prompt: [Sub-Agent C prompt])
```

**Round 2 (2 agents):**
```
Task(description: "Cursor test suite", subagent_type: "general-purpose", mode: "dontAsk", prompt: [Sub-Agent D prompt])
Task(description: "Model resolution + config", subagent_type: "general-purpose", mode: "dontAsk", prompt: [Sub-Agent E prompt])
```

### Failure Recovery

**If Sub-Agents A and B have edit conflicts in install.js:**
They shouldn't — A writes in the conversion functions section (~line 585+) and B writes in the constants section (~line 294+). If there's a merge conflict, the orchestrator resolves it manually.

**If `npm test` fails:**
Read the test output, identify the failing test, determine which file has the issue. Most failures will be in conversion function logic or interaction map marker mismatches. Fix directly and re-run.

**If the Cursor install test produces malformed files:**
Read the problematic installed file, trace the issue to the conversion function, fix, re-install, re-test.

**If interaction point markers don't match:**
Sub-Agent B reads the source files to determine markers. If a marker doesn't match, the `applyInteractionConversions` catch-all ensures `AskUserQuestion` is at least renamed to `AskQuestion`. The orchestrator can then manually adjust the marker in the interaction map.

---

## Work Breakdown Summary

| Who | Steps | Nature | Complexity |
|-----|-------|--------|-----------|
| Orchestrator | 1 | Targeted edits to bin/install.js (CLI, dirs, menu) | Low |
| Sub-Agent A | 2a, 2b, 2c | New conversion functions in bin/install.js | Medium |
| Sub-Agent B | 3a-3e, 4 | Interaction map + templates + skill order in bin/install.js | **High** (most complex) |
| Sub-Agent C | 7c | New settings-cursor.md workflow | Medium |
| Orchestrator | 5 | Wire up isCursor branches in install/uninstall | Medium |
| Sub-Agent D | 9a, 9b | ~28 new test cases | Medium |
| Sub-Agent E | 7a, 7b | Model resolution + config template | Low |
| Orchestrator | 6, 9c, 10 | Uninstall logic, run tests, full verification | Medium |

---

## What's Excluded (Deferred to v2)

| Feature | Why Deferred | Dependency |
|---------|-------------|-----------|
| Cursor hooks (update checker) | Low priority; statusline impossible | Cursor hooks.json support stabilization |
| Cursor model discovery API | No stable API; curated list sufficient | Cursor exposing model listing |
| Cursor `.rules/` integration | Blueprint uses CLAUDE.md pattern which Cursor reads | Testing whether `.cursor/rules/` adds value |
| Cursor Teams support | Paid Cursor feature, limited audience | Cursor team adoption signals |
