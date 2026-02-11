#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const crypto = require('crypto');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Get version from package.json
const pkg = require('../package.json');

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasOpencode = args.includes('--opencode');
const hasClaude = args.includes('--claude');
const hasGemini = args.includes('--gemini');
const hasCursor = args.includes('--cursor');
const hasBoth = args.includes('--both'); // Legacy flag, keeps working
const hasAll = args.includes('--all');
const hasUninstall = args.includes('--uninstall') || args.includes('-u');

// Runtime selection - can be set by flags or interactive prompt
let selectedRuntimes = [];
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

// Helper to get directory name for a runtime (used for local/project installs)
function getDirName(runtime) {
  if (runtime === 'opencode') return '.opencode';
  if (runtime === 'gemini') return '.gemini';
  if (runtime === 'cursor') return '.cursor';
  return '.claude';
}

/**
 * Get the global config directory for OpenCode
 * OpenCode follows XDG Base Directory spec and uses ~/.config/opencode/
 * Priority: OPENCODE_CONFIG_DIR > dirname(OPENCODE_CONFIG) > XDG_CONFIG_HOME/opencode > ~/.config/opencode
 */
function getOpencodeGlobalDir() {
  // 1. Explicit OPENCODE_CONFIG_DIR env var
  if (process.env.OPENCODE_CONFIG_DIR) {
    return expandTilde(process.env.OPENCODE_CONFIG_DIR);
  }
  
  // 2. OPENCODE_CONFIG env var (use its directory)
  if (process.env.OPENCODE_CONFIG) {
    return path.dirname(expandTilde(process.env.OPENCODE_CONFIG));
  }
  
  // 3. XDG_CONFIG_HOME/opencode
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(expandTilde(process.env.XDG_CONFIG_HOME), 'opencode');
  }
  
  // 4. Default: ~/.config/opencode (XDG default)
  return path.join(os.homedir(), '.config', 'opencode');
}

/**
 * Get the global config directory for a runtime
 * @param {string} runtime - 'claude', 'opencode', or 'gemini'
 * @param {string|null} explicitDir - Explicit directory from --config-dir flag
 */
function getGlobalDir(runtime, explicitDir = null) {
  if (runtime === 'opencode') {
    // For OpenCode, --config-dir overrides env vars
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    return getOpencodeGlobalDir();
  }
  
  if (runtime === 'gemini') {
    // Gemini: --config-dir > GEMINI_CONFIG_DIR > ~/.gemini
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.GEMINI_CONFIG_DIR) {
      return expandTilde(process.env.GEMINI_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.gemini');
  }

  if (runtime === 'cursor') {
    // Cursor: --config-dir > CURSOR_CONFIG_DIR > ~/.cursor
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.CURSOR_CONFIG_DIR) {
      return expandTilde(process.env.CURSOR_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.cursor');
  }

  // Claude Code: --config-dir > CLAUDE_CONFIG_DIR > ~/.claude
  if (explicitDir) {
    return expandTilde(explicitDir);
  }
  if (process.env.CLAUDE_CONFIG_DIR) {
    return expandTilde(process.env.CLAUDE_CONFIG_DIR);
  }
  return path.join(os.homedir(), '.claude');
}

const banner = '\n' +
  cyan + '  ██████╗ ██╗     ██╗   ██╗███████╗██████╗ ██████╗ ██╗███╗   ██╗████████╗\n' +
  '  ██╔══██╗██║     ██║   ██║██╔════╝██╔══██╗██╔══██╗██║████╗  ██║╚══██╔══╝\n' +
  '  ██████╔╝██║     ██║   ██║█████╗  ██████╔╝██████╔╝██║██╔██╗ ██║   ██║\n' +
  '  ██╔══██╗██║     ██║   ██║██╔══╝  ██╔═══╝ ██╔══██╗██║██║╚██╗██║   ██║\n' +
  '  ██████╔╝███████╗╚██████╔╝███████╗██║     ██║  ██║██║██║ ╚████║   ██║\n' +
  '  ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝   ╚═╝' + reset + '\n' +
  '\n' +
  '  Blueprint ' + dim + 'v' + pkg.version + reset + '\n' +
  '  A meta-prompting, context engineering and spec-driven\n' +
  '  development system for Claude Code, OpenCode, Gemini, and Cursor by TÂCHES.\n';

// Parse --config-dir argument
function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    // Error if --config-dir is provided without a value or next arg is another flag
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  // Also handle --config-dir=value format
  const configDirArg = args.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) {
    const value = configDirArg.split('=')[1];
    if (!value) {
      console.error(`  ${yellow}--config-dir requires a non-empty path${reset}`);
      process.exit(1);
    }
    return value;
  }
  return null;
}
const explicitConfigDir = parseConfigDirArg();
const hasHelp = args.includes('--help') || args.includes('-h');
const forceStatusline = args.includes('--force-statusline');

console.log(banner);

// Show help if requested
if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx @lipter7/blueprint [options]\n\n  ${yellow}Options:${reset}\n    ${cyan}-g, --global${reset}              Install globally (to config directory)\n    ${cyan}-l, --local${reset}               Install locally (to current directory)\n    ${cyan}--claude${reset}                  Install for Claude Code only\n    ${cyan}--opencode${reset}                Install for OpenCode only\n    ${cyan}--gemini${reset}                  Install for Gemini only\n    ${cyan}--cursor${reset}                  Install for Cursor only\n    ${cyan}--all${reset}                     Install for all runtimes\n    ${cyan}-u, --uninstall${reset}           Uninstall Blueprint (remove all Blueprint files)\n    ${cyan}-c, --config-dir <path>${reset}   Specify custom config directory\n    ${cyan}-h, --help${reset}                Show this help message\n    ${cyan}--force-statusline${reset}        Replace existing statusline config\n\n  ${yellow}Examples:${reset}\n    ${dim}# Interactive install (prompts for runtime and location)${reset}\n    npx @lipter7/blueprint\n\n    ${dim}# Install for Claude Code globally${reset}\n    npx @lipter7/blueprint --claude --global\n\n    ${dim}# Install for Gemini globally${reset}\n    npx @lipter7/blueprint --gemini --global\n\n    ${dim}# Install for Cursor globally${reset}\n    npx @lipter7/blueprint --cursor --global\n\n    ${dim}# Install for all runtimes globally${reset}\n    npx @lipter7/blueprint --all --global\n\n    ${dim}# Install to custom config directory${reset}\n    npx @lipter7/blueprint --claude --global --config-dir ~/.claude-bc\n\n    ${dim}# Install to current project only${reset}\n    npx @lipter7/blueprint --claude --local\n\n    ${dim}# Uninstall Blueprint from Claude Code globally${reset}\n    npx @lipter7/blueprint --claude --global --uninstall\n\n  ${yellow}Notes:${reset}\n    The --config-dir option is useful when you have multiple configurations.\n    It takes priority over CLAUDE_CONFIG_DIR / GEMINI_CONFIG_DIR / CURSOR_CONFIG_DIR environment variables.\n`);
  process.exit(0);
}

/**
 * Expand ~ to home directory (shell doesn't expand in env vars passed to node)
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Build a hook command path using forward slashes for cross-platform compatibility.
 * On Windows, $HOME is not expanded by cmd.exe/PowerShell, so we use the actual path.
 */
function buildHookCommand(configDir, hookName) {
  // Use forward slashes for Node.js compatibility on all platforms
  const hooksPath = configDir.replace(/\\/g, '/') + '/hooks/' + hookName;
  return `node "${hooksPath}"`;
}

/**
 * Read and parse settings.json, returning empty object if it doesn't exist
 */
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

/**
 * Write settings.json with proper formatting
 */
function writeSettings(settingsPath, settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

// Cache for attribution settings (populated once per runtime during install)
const attributionCache = new Map();

/**
 * Get commit attribution setting for a runtime
 * @param {string} runtime - 'claude', 'opencode', or 'gemini'
 * @returns {null|undefined|string} null = remove, undefined = keep default, string = custom
 */
function getCommitAttribution(runtime) {
  // Return cached value if available
  if (attributionCache.has(runtime)) {
    return attributionCache.get(runtime);
  }

  let result;

  if (runtime === 'opencode') {
    const config = readSettings(path.join(getGlobalDir('opencode', null), 'opencode.json'));
    result = config.disable_ai_attribution === true ? null : undefined;
  } else if (runtime === 'gemini') {
    // Gemini: check gemini settings.json for attribution config
    const settings = readSettings(path.join(getGlobalDir('gemini', explicitConfigDir), 'settings.json'));
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  } else if (runtime === 'cursor') {
    // Cursor: check cursor settings.json for attribution config
    const settings = readSettings(path.join(getGlobalDir('cursor', explicitConfigDir), 'settings.json'));
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  } else {
    // Claude Code
    const settings = readSettings(path.join(getGlobalDir('claude', explicitConfigDir), 'settings.json'));
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  }

  // Cache and return
  attributionCache.set(runtime, result);
  return result;
}

/**
 * Process Co-Authored-By lines based on attribution setting
 * @param {string} content - File content to process
 * @param {null|undefined|string} attribution - null=remove, undefined=keep, string=replace
 * @returns {string} Processed content
 */
function processAttribution(content, attribution) {
  if (attribution === null) {
    // Remove Co-Authored-By lines and the preceding blank line
    return content.replace(/(\r?\n){2}Co-Authored-By:.*$/gim, '');
  }
  if (attribution === undefined) {
    return content;
  }
  // Replace with custom attribution (escape $ to prevent backreference injection)
  const safeAttribution = attribution.replace(/\$/g, '$$$$');
  return content.replace(/Co-Authored-By:.*$/gim, `Co-Authored-By: ${safeAttribution}`);
}

/**
 * Convert Claude Code frontmatter to opencode format
 * - Converts 'allowed-tools:' array to 'permission:' object
 * @param {string} content - Markdown file content with YAML frontmatter
 * @returns {string} - Content with converted frontmatter
 */
// Color name to hex mapping for opencode compatibility
const colorNameToHex = {
  cyan: '#00FFFF',
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  yellow: '#FFFF00',
  magenta: '#FF00FF',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#808080',
  grey: '#808080',
};

// Tool name mapping from Claude Code to OpenCode
// OpenCode uses lowercase tool names; special mappings for renamed tools
const claudeToOpencodeTools = {
  AskUserQuestion: 'question',
  SlashCommand: 'skill',
  TodoWrite: 'todowrite',
  WebFetch: 'webfetch',
  WebSearch: 'websearch',  // Plugin/MCP - keep for compatibility
};

// Tool name mapping from Claude Code to Gemini CLI
// Gemini CLI uses snake_case built-in tool names
const claudeToGeminiTools = {
  Read: 'read_file',
  Write: 'write_file',
  Edit: 'replace',
  Bash: 'run_shell_command',
  Glob: 'glob',
  Grep: 'search_file_content',
  WebSearch: 'google_web_search',
  WebFetch: 'web_fetch',
  TodoWrite: 'write_todos',
  AskUserQuestion: 'ask_user',
};

// Cursor skill ordering — numbered prefixes for palette sorting
const CURSOR_SKILL_ORDER = {
  'map-codebase':           1,
  'new-project':            2,
  'new-milestone':          3,
  'discuss-phase':          4,
  'research-phase':         5,
  'plan-phase':             6,
  'execute-phase':          7,
  'verify-work':            8,
  'audit-milestone':        9,
  'plan-milestone-gaps':    10,
  'complete-milestone':     11,
  'add-phase':              12,
  'insert-phase':           13,
  'remove-phase':           14,
  'progress':               15,
  'resume-work':            16,
  'pause-work':             17,
  'quick':                  18,
  'debug':                  19,
  'list-phase-assumptions': 20,
  'add-todo':               21,
  'check-todos':            22,
  'settings':               23,
  'set-profile':            24,
  'update':                 25,
  'reapply-patches':        26,
  'help':                   27,
  'join-discord':           28,
};

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

// Cursor interaction map — defines where AskUserQuestion blocks appear in workflow files
// and how to convert them to Cursor-compatible AskQuestion interaction blocks.
// Each entry has: id, type (gate template or bespoke), marker (regex matching the source block),
// and either params (for gate templates) or block (for bespoke replacements).
const CURSOR_INTERACTION_MAP = {
  'workflows/discovery-phase.md': [
    {
      id: 'discovery-confidence',
      type: 'confidence_gate',
      marker: /If confidence is LOW:\nUse AskUserQuestion:[\s\S]*?- "Pause" - I need to think about this/,
      params: {
        gate_id: 'discovery-confidence',
        what_was_just_completed: 'Discovery research completed but confidence is LOW',
        confidence_options: '"Dig deeper" to do more research, or "Proceed anyway" to accept uncertainty',
        option_a: 'Dig deeper',
        action_a: 'Do more research before planning',
        option_b: 'Proceed anyway',
        action_b: 'Accept uncertainty, plan with caveats'
      }
    }
  ],
  'workflows/discuss-phase.md': [
    {
      id: 'discuss-check-existing',
      type: 'decision_gate',
      marker: /\*\*If exists:\*\*\nUse AskUserQuestion:[\s\S]*?If "Skip": Exit workflow/,
      params: {
        gate_id: 'discuss-check-existing',
        decision_context: 'Phase already has existing context (CONTEXT.md found)',
        option_1: 'Update it',
        description_1: 'Review and revise existing context',
        option_2: 'View it',
        description_2: 'Show me what\'s there',
        option_3_line: '3. Skip — Use existing context as-is',
        action_1: 'Load existing context, continue to analyze_phase',
        action_2: 'Display CONTEXT.md, then offer update/skip',
        fallback_action: 'Exit workflow (treat as skip)'
      }
    },
    {
      id: 'discuss-deep-dive',
      type: 'bespoke',
      marker: /\*\*Then use AskUserQuestion \(multiSelect: true\):\*\*[\s\S]*?Continue to discuss_areas with selected areas\.\n<\/step>\n\n<step name="discuss_areas">[\s\S]*?Track deferred ideas internally\.\n<\/step>/,
      block: DISCUSS_DEEP_DIVE_BLOCK
    },
    {
      id: 'discuss-verify-context',
      type: 'confidence_gate',
      marker: /AskUserQuestion:\n- header: "Context"\n- question: "Does this accurately capture what you described\?"\n- options:[\s\S]*?- "Review full file" — Show me the raw file first/,
      params: {
        gate_id: 'discuss-verify-context',
        what_was_just_completed: 'CONTEXT.md has been created with your implementation decisions',
        confidence_options: '"Approve" to proceed, "Corrections" to change things, or "Review full file" to see the raw file',
        option_a: 'Approve',
        action_a: 'Proceed to git commit',
        option_b: 'Corrections',
        action_b: 'Ask what to change, apply edits, re-present for approval'
      }
    }
  ],
  'workflows/quick.md': [
    {
      id: 'quick-task-description',
      type: 'action_gate',
      marker: /AskUserQuestion\(\n\s*header: "Quick Task",\n\s*question: "What do you want to do\?",\n\s*followUp: null\n\)/,
      params: {
        gate_id: 'quick-task-description',
        action_context: 'Starting a quick task — need task description',
        action_1: 'Describe your task',
        description_1: 'Type what you want to do (freeform)',
        action_2: 'Cancel',
        description_2: 'Exit quick task mode',
        action_3: 'View recent tasks',
        description_3: 'See previously completed quick tasks',
        action_4_line: '',
        execute_1: 'Store response as task description and proceed to initialization',
        execute_2: 'Exit workflow',
        execute_3: 'Show quick task history from STATE.md',
        fallback_action: 'Use input as the task description'
      }
    }
  ],
  'workflows/add-todo.md': [
    {
      id: 'add-todo-duplicate',
      type: 'decision_gate',
      marker: /If overlapping, use AskUserQuestion:[\s\S]*?- "Add anyway" — create as separate todo/,
      params: {
        gate_id: 'add-todo-duplicate',
        decision_context: 'A similar todo already exists',
        option_1: 'Skip',
        description_1: 'Keep existing todo',
        option_2: 'Replace',
        description_2: 'Update existing with new context',
        option_3_line: '3. Add anyway — Create as separate todo',
        action_1: 'Keep existing todo, exit without creating new one',
        action_2: 'Update existing todo file with new context',
        fallback_action: 'Create as separate todo alongside existing one'
      }
    }
  ],
  'workflows/settings.md': [
    {
      id: 'settings-configuration',
      type: 'bespoke',
      marker: /Use AskUserQuestion with current values pre-selected:[\s\S]*?\]\)\n```/,
      block: SETTINGS_CONFIG_BLOCK
    }
  ],
  'workflows/complete-milestone.md': [
    {
      id: 'complete-milestone-branches',
      type: 'action_gate',
      marker: /AskUserQuestion with options: Squash merge[\s\S]*?Keep branches\./,
      params: {
        gate_id: 'complete-milestone-branches',
        action_context: 'Git branches detected for completed milestone. Choose how to handle them.',
        action_1: 'Squash merge (Recommended)',
        description_1: 'Merge branches into main with a single squash commit',
        action_2: 'Merge with history',
        description_2: 'Merge branches preserving full commit history',
        action_3: 'Delete without merging',
        description_3: 'Remove branches (already merged or not needed)',
        action_4_line: '4. Keep branches — Leave for manual handling',
        execute_1: 'Squash merge each branch into main',
        execute_2: 'Merge each branch with --no-ff into main',
        execute_3: 'Delete the branch(es)',
        fallback_action: 'Report "Branches preserved for manual handling"'
      }
    }
  ],
  'workflows/new-project.md': [
    {
      id: 'new-project-brownfield',
      type: 'decision_gate',
      marker: /Use AskUserQuestion:\n- header: "Existing Code"[\s\S]*?- "Skip mapping" — Proceed with project initialization/,
      params: {
        gate_id: 'new-project-brownfield',
        decision_context: 'Existing code detected in this directory but no codebase map exists',
        option_1: 'Map codebase first',
        description_1: 'Run /bp:map-codebase to understand existing architecture (Recommended)',
        option_2: 'Skip mapping',
        description_2: 'Proceed with project initialization',
        option_3_line: '',
        action_1: 'Exit and run /bp:map-codebase first, then return to /bp:new-project',
        action_2: 'Continue with project initialization without codebase mapping',
        fallback_action: 'Continue with project initialization'
      }
    },
    {
      id: 'new-project-ready',
      type: 'continuation_gate',
      marker: /When you could write a clear PROJECT\.md, use AskUserQuestion:[\s\S]*?- "Keep exploring" — I want to share more \/ ask me more/,
      params: {
        gate_id: 'new-project-ready',
        current_state_summary: 'Deep questioning phase — enough context gathered to write PROJECT.md',
        proceed_option: 'Create PROJECT.md',
        proceed_description: 'Let\'s move forward with what we have',
        continue_option: 'Keep exploring',
        continue_description: 'I want to share more / ask me more',
        loop_target_step: 'deep questioning (ask what they want to add, or identify gaps and probe naturally)'
      }
    }
  ],
  'workflows/new-milestone.md': [
    {
      id: 'new-milestone-staleness',
      type: 'decision_gate',
      marker: /Present to the user via `AskUserQuestion`:[\s\S]*?\*\*Options:\*\*\n1\. \*\*Full remap\*\*[\s\S]*?2\. \*\*Skip\*\* — Continue with current codebase docs/,
      params: {
        gate_id: 'new-milestone-staleness',
        decision_context: 'Codebase mapping may be stale — significant changes since last mapping',
        option_1: 'Full remap',
        description_1: 'Re-run all 4 mapping agents (recommended if significant structural changes)',
        option_2: 'Skip',
        description_2: 'Continue with current codebase docs',
        option_3_line: '',
        action_1: 'Spawn 4 bp-codebase-mapper agents in parallel and update mapping metadata',
        action_2: 'Continue to the next step with existing codebase docs',
        fallback_action: 'Continue with existing codebase docs'
      }
    }
  ],
  'workflows/check-todos.md': [
    {
      id: 'check-todos-action',
      type: 'action_gate',
      marker: /Use AskUserQuestion:\n- header: "Action"\n- question: "This todo relates to Phase[\s\S]*?"Put it back" — return to list/,
      params: {
        gate_id: 'check-todos-action',
        action_context: 'Todo selected — choose what to do with it',
        action_1: 'Work on it now',
        description_1: 'Move to done, start working',
        action_2: 'Add to phase plan',
        description_2: 'Include when planning the related phase',
        action_3: 'Brainstorm approach',
        description_3: 'Think through before deciding',
        action_4_line: '4. Put it back — Return to list',
        execute_1: 'Move todo to done/ directory, update STATE.md, begin work',
        execute_2: 'Note todo reference in phase planning notes, keep in pending',
        execute_3: 'Keep in pending, start discussion about problem and approaches',
        fallback_action: 'Return to todo list'
      }
    }
  ],
  'commands/bp/debug.md': [
    {
      id: 'debug-symptoms',
      type: 'bespoke',
      marker: /## 2\. Gather Symptoms \(if new issue\)\n\nUse AskUserQuestion for each:[\s\S]*?After all gathered, confirm ready to investigate\./,
      block: DEBUG_SYMPTOMS_BLOCK
    }
  ]
};

function applyInteractionConversions(content, relativePath) {
  const normalizedPath = relativePath
    .replace(/^blueprint\//, '')
    .replace(/^commands\/bp\//, 'commands/bp/');

  const interactions = CURSOR_INTERACTION_MAP[normalizedPath];
  if (!interactions || interactions.length === 0) {
    return content.replace(/\bAskUserQuestion\b/g, 'AskQuestion');
  }

  let result = content;

  for (const interaction of interactions) {
    if (interaction.type === 'bespoke') {
      result = result.replace(interaction.marker, interaction.block);
    } else {
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

function convertCommandReferences(content) {
  return content.replace(/\/bp:([a-z-]+)/g, (match, name) => {
    const num = CURSOR_SKILL_ORDER[name];
    if (num != null) {
      return `/bp-${String(num).padStart(2, '0')}-${name}`;
    }
    return match;
  });
}

/**
 * Convert a Claude Code tool name to OpenCode format
 * - Applies special mappings (AskUserQuestion -> question, etc.)
 * - Converts to lowercase (except MCP tools which keep their format)
 */
function convertToolName(claudeTool) {
  // Check for special mapping first
  if (claudeToOpencodeTools[claudeTool]) {
    return claudeToOpencodeTools[claudeTool];
  }
  // MCP tools (mcp__*) keep their format
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  // Default: convert to lowercase
  return claudeTool.toLowerCase();
}

/**
 * Convert a Claude Code tool name to Gemini CLI format
 * - Applies Claude→Gemini mapping (Read→read_file, Bash→run_shell_command, etc.)
 * - Filters out MCP tools (mcp__*) — they are auto-discovered at runtime in Gemini
 * - Filters out Task — agents are auto-registered as tools in Gemini
 * @returns {string|null} Gemini tool name, or null if tool should be excluded
 */
function convertGeminiToolName(claudeTool) {
  // MCP tools: exclude — auto-discovered from mcpServers config at runtime
  if (claudeTool.startsWith('mcp__')) {
    return null;
  }
  // Task: exclude — agents are auto-registered as callable tools
  if (claudeTool === 'Task') {
    return null;
  }
  // Check for explicit mapping
  if (claudeToGeminiTools[claudeTool]) {
    return claudeToGeminiTools[claudeTool];
  }
  // Default: lowercase
  return claudeTool.toLowerCase();
}

/**
 * Strip HTML <sub> tags for Gemini CLI output
 * Terminals don't support subscript — Gemini renders these as raw HTML.
 * Converts <sub>text</sub> to italic *(text)* for readable terminal output.
 */
function stripSubTags(content) {
  return content.replace(/<sub>(.*?)<\/sub>/g, '*($1)*');
}

/**
 * Convert Claude Code agent frontmatter to Gemini CLI format
 * Gemini agents use .md files with YAML frontmatter, same as Claude,
 * but with different field names and formats:
 * - tools: must be a YAML array (not comma-separated string)
 * - tool names: must use Gemini built-in names (read_file, not Read)
 * - color: must be removed (causes validation error)
 * - mcp__* tools: must be excluded (auto-discovered at runtime)
 */
function convertClaudeToGeminiAgent(content) {
  if (!content.startsWith('---')) return content;

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) return content;

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3);

  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  const tools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Convert allowed-tools YAML array to tools list
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Handle inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        const parsed = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        for (const t of parsed) {
          const mapped = convertGeminiToolName(t);
          if (mapped) tools.push(mapped);
        }
      } else {
        // tools: with no value means YAML array follows
        inAllowedTools = true;
      }
      continue;
    }

    // Strip color field (not supported by Gemini CLI, causes validation error)
    if (trimmed.startsWith('color:')) continue;

    // Collect allowed-tools/tools array items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        const mapped = convertGeminiToolName(trimmed.substring(2).trim());
        if (mapped) tools.push(mapped);
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        inAllowedTools = false;
      }
    }

    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // Add tools as YAML array (Gemini requires array format)
  if (tools.length > 0) {
    newLines.push('tools:');
    for (const tool of tools) {
      newLines.push(`  - ${tool}`);
    }
  }

  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${stripSubTags(body)}`;
}

function convertClaudeToOpencodeFrontmatter(content) {
  // Replace tool name references in content (applies to all files)
  let convertedContent = content;
  convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'question');
  convertedContent = convertedContent.replace(/\bSlashCommand\b/g, 'skill');
  convertedContent = convertedContent.replace(/\bTodoWrite\b/g, 'todowrite');
  // Replace /bp:command with /bp-command for opencode (flat command structure)
  convertedContent = convertedContent.replace(/\/bp:/g, '/bp-');
  // Replace ~/.claude with ~/.config/opencode (OpenCode's correct config location)
  convertedContent = convertedContent.replace(/~\/\.claude\b/g, '~/.config/opencode');

  // Check if content has frontmatter
  if (!convertedContent.startsWith('---')) {
    return convertedContent;
  }

  // Find the end of frontmatter
  const endIndex = convertedContent.indexOf('---', 3);
  if (endIndex === -1) {
    return convertedContent;
  }

  const frontmatter = convertedContent.substring(3, endIndex).trim();
  const body = convertedContent.substring(endIndex + 3);

  // Parse frontmatter line by line (simple YAML parsing)
  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  const allowedTools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect start of allowed-tools array
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Detect inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        // Parse comma-separated tools
        const tools = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        allowedTools.push(...tools);
      }
      continue;
    }

    // Remove name: field - opencode uses filename for command name
    if (trimmed.startsWith('name:')) {
      continue;
    }

    // Convert color names to hex for opencode
    if (trimmed.startsWith('color:')) {
      const colorValue = trimmed.substring(6).trim().toLowerCase();
      const hexColor = colorNameToHex[colorValue];
      if (hexColor) {
        newLines.push(`color: "${hexColor}"`);
      } else if (colorValue.startsWith('#')) {
        // Validate hex color format (#RGB or #RRGGBB)
        if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {
          // Already hex and valid, keep as is
          newLines.push(line);
        }
        // Skip invalid hex colors
      }
      // Skip unknown color names
      continue;
    }

    // Collect allowed-tools items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        allowedTools.push(trimmed.substring(2).trim());
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        // End of array, new field started
        inAllowedTools = false;
      }
    }

    // Keep other fields (including name: which opencode ignores)
    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // Add tools object if we had allowed-tools or tools
  if (allowedTools.length > 0) {
    newLines.push('tools:');
    for (const tool of allowedTools) {
      newLines.push(`  ${convertToolName(tool)}: true`);
    }
  }

  // Rebuild frontmatter (body already has tool names converted)
  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${body}`;
}

/**
 * Convert Claude Code markdown command to Gemini TOML format
 * @param {string} content - Markdown file content with YAML frontmatter
 * @returns {string} - TOML content
 */
function convertClaudeToGeminiToml(content) {
  // Check if content has frontmatter
  if (!content.startsWith('---')) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3).trim();
  
  // Extract description from frontmatter
  let description = '';
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('description:')) {
      description = trimmed.substring(12).trim();
      break;
    }
  }

  // Construct TOML
  let toml = '';
  if (description) {
    toml += `description = ${JSON.stringify(description)}\n`;
  }
  
  toml += `prompt = ${JSON.stringify(body)}\n`;
  
  return toml;
}

/**
 * Convert Claude Code command file to Cursor Skill format
 * Strips disallowed frontmatter fields and converts name format
 * @param {string} content - Markdown file content with YAML frontmatter
 * @param {string} pathPrefix - Path prefix to replace ~/.claude/ with
 * @returns {string} - Converted content
 */
function convertClaudeToCursorSkill(content, pathPrefix) {
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

    // Strip allowed-tools YAML array
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

/**
 * Convert Claude Code agent file to Cursor agent format
 * Strips disallowed frontmatter fields and adds model: inherit
 * @param {string} content - Markdown file content with YAML frontmatter
 * @param {string} pathPrefix - Path prefix to replace ~/.claude/ with
 * @returns {string} - Converted content
 */
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

/**
 * Copy commands to Cursor's nested skills directory structure
 * Cursor expects: skills/bp-01-commandname/SKILL.md
 * Source structure: commands/bp/commandname.md
 *
 * @param {string} srcDir - Source directory (e.g., commands/bp/)
 * @param {string} destDir - Destination directory (e.g., skills/)
 * @param {string} pathPrefix - Path prefix for file references
 * @param {string} runtime - Target runtime
 * @returns {number} - Number of skills installed
 */
function copySkillsFromCommands(srcDir, destDir, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) return 0;

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

/**
 * Copy commands to a flat structure for OpenCode
 * OpenCode expects: command/bp-help.md (invoked as /bp-help)
 * Source structure: commands/bp/help.md
 * 
 * @param {string} srcDir - Source directory (e.g., commands/bp/)
 * @param {string} destDir - Destination directory (e.g., command/)
 * @param {string} prefix - Prefix for filenames (e.g., 'bp')
 * @param {string} pathPrefix - Path prefix for file references
 * @param {string} runtime - Target runtime ('claude' or 'opencode')
 */
function copyFlattenedCommands(srcDir, destDir, prefix, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) {
    return;
  }
  
  // Remove old bp-*.md files before copying new ones
  if (fs.existsSync(destDir)) {
    for (const file of fs.readdirSync(destDir)) {
      if (file.startsWith(`${prefix}-`) && file.endsWith('.md')) {
        fs.unlinkSync(path.join(destDir, file));
      }
    }
  } else {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    
    if (entry.isDirectory()) {
      // Recurse into subdirectories, adding to prefix
      // e.g., commands/bp/debug/start.md -> command/bp-debug-start.md
      copyFlattenedCommands(srcPath, destDir, `${prefix}-${entry.name}`, pathPrefix, runtime);
    } else if (entry.name.endsWith('.md')) {
      // Flatten: help.md -> bp-help.md
      const baseName = entry.name.replace('.md', '');
      const destName = `${prefix}-${baseName}.md`;
      const destPath = path.join(destDir, destName);

      let content = fs.readFileSync(srcPath, 'utf8');
      const claudeDirRegex = /~\/\.claude\//g;
      const opencodeDirRegex = /~\/\.opencode\//g;
      content = content.replace(claudeDirRegex, pathPrefix);
      content = content.replace(opencodeDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeToOpencodeFrontmatter(content);

      fs.writeFileSync(destPath, content);
    }
  }
}

/**
 * Recursively copy directory, replacing paths in .md files
 * Deletes existing destDir first to remove orphaned files from previous versions
 * @param {string} srcDir - Source directory
 * @param {string} destDir - Destination directory
 * @param {string} pathPrefix - Path prefix for file references
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini')
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime) {
  const isOpencode = runtime === 'opencode';
  const dirName = getDirName(runtime);

  // Clean install: remove existing destination to prevent orphaned files
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pathPrefix, runtime);
    } else if (entry.name.endsWith('.md')) {
      // Always replace ~/.claude/ as it is the source of truth in the repo
      let content = fs.readFileSync(srcPath, 'utf8');
      const claudeDirRegex = /~\/\.claude\//g;
      content = content.replace(claudeDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));

      // Convert for runtime compatibility
      if (isOpencode) {
        content = convertClaudeToOpencodeFrontmatter(content);
        fs.writeFileSync(destPath, content);
      } else if (runtime === 'gemini') {
        // Convert to TOML for Gemini (strip <sub> tags — terminals can't render subscript)
        content = stripSubTags(content);
        const tomlContent = convertClaudeToGeminiToml(content);
        // Replace extension with .toml
        const tomlPath = destPath.replace(/\.md$/, '.toml');
        fs.writeFileSync(tomlPath, tomlContent);
      } else if (runtime === 'cursor') {
        // Apply Cursor interaction conversions and command reference conversions
        const relativePath = srcPath.replace(/^.*?\/blueprint\//, 'blueprint/').replace(/^.*?\/commands\//, 'commands/');
        content = applyInteractionConversions(content, relativePath);
        content = convertCommandReferences(content);
        fs.writeFileSync(destPath, content);
      } else {
        fs.writeFileSync(destPath, content);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Clean up orphaned files from previous Blueprint versions
 */
function cleanupOrphanedFiles(configDir) {
  const orphanedFiles = [
    // Old GSD artifacts (clean up if user upgrades from GSD to Blueprint)
    'hooks/gsd-notify.sh',       // GSD hook removed in v1.6.x
    'hooks/gsd-statusline.js',   // GSD hook renamed to bp-statusline.js
    'hooks/gsd-check-update.js', // GSD hook renamed to bp-check-update.js
    'hooks/gsd-check-update.sh', // GSD hook renamed to bp-check-update.sh
    // Blueprint orphaned files
    'hooks/bp-notify.sh',   // Removed in v1.6.x
    'hooks/statusline.js',  // Renamed to bp-statusline.js in v1.9.0
  ];

  for (const relPath of orphanedFiles) {
    const fullPath = path.join(configDir, relPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`  ${green}✓${reset} Removed orphaned ${relPath}`);
    }
  }
}

/**
 * Clean up orphaned hook registrations from settings.json
 */
function cleanupOrphanedHooks(settings) {
  const orphanedHookPatterns = [
    // Old GSD artifacts (clean up if user upgrades from GSD to Blueprint)
    'gsd-notify.sh',         // GSD hook
    'gsd-statusline.js',     // GSD hook
    'gsd-check-update.js',   // GSD hook
    'gsd-check-update.sh',   // GSD hook
    'gsd-intel-index.js',    // GSD hook
    'gsd-intel-session.js',  // GSD hook
    'gsd-intel-prune.js',    // GSD hook
    // Blueprint orphaned hooks
    'bp-notify.sh',          // Removed in v1.6.x
    'hooks/statusline.js',   // Renamed to bp-statusline.js in v1.9.0
    'bp-intel-index.js',     // Removed in v1.9.2
    'bp-intel-session.js',   // Removed in v1.9.2
    'bp-intel-prune.js',     // Removed in v1.9.2
  ];

  let cleanedHooks = false;

  // Check all hook event types (Stop, SessionStart, etc.)
  if (settings.hooks) {
    for (const eventType of Object.keys(settings.hooks)) {
      const hookEntries = settings.hooks[eventType];
      if (Array.isArray(hookEntries)) {
        // Filter out entries that contain orphaned hooks
        const filtered = hookEntries.filter(entry => {
          if (entry.hooks && Array.isArray(entry.hooks)) {
            // Check if any hook in this entry matches orphaned patterns
            const hasOrphaned = entry.hooks.some(h =>
              h.command && orphanedHookPatterns.some(pattern => h.command.includes(pattern))
            );
            if (hasOrphaned) {
              cleanedHooks = true;
              return false;  // Remove this entry
            }
          }
          return true;  // Keep this entry
        });
        settings.hooks[eventType] = filtered;
      }
    }
  }

  if (cleanedHooks) {
    console.log(`  ${green}✓${reset} Removed orphaned hook registrations`);
  }

  // Fix #330: Update statusLine if it points to old statusline.js path
  if (settings.statusLine && settings.statusLine.command &&
      settings.statusLine.command.includes('statusline.js') &&
      !settings.statusLine.command.includes('bp-statusline.js')) {
    // Replace old path with new path
    settings.statusLine.command = settings.statusLine.command.replace(
      /statusline\.js/,
      'bp-statusline.js'
    );
    console.log(`  ${green}✓${reset} Updated statusline path (statusline.js → bp-statusline.js)`);
  }

  return settings;
}

/**
 * Uninstall Blueprint from the specified directory for a specific runtime
 * Removes only Blueprint-specific files/directories, preserves user content
 * @param {boolean} isGlobal - Whether to uninstall from global or local
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini')
 */
function uninstall(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const dirName = getDirName(runtime);

  // Get the target directory based on runtime and install type
  const targetDir = isGlobal
    ? getGlobalDir(runtime, explicitConfigDir)
    : path.join(process.cwd(), dirName);

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  let runtimeLabel = 'Claude Code';
  if (runtime === 'opencode') runtimeLabel = 'OpenCode';
  if (runtime === 'gemini') runtimeLabel = 'Gemini';
  if (runtime === 'cursor') runtimeLabel = 'Cursor';

  console.log(`  Uninstalling Blueprint from ${cyan}${runtimeLabel}${reset} at ${cyan}${locationLabel}${reset}\n`);

  // Check if target directory exists
  if (!fs.existsSync(targetDir)) {
    console.log(`  ${yellow}⚠${reset} Directory does not exist: ${locationLabel}`);
    console.log(`  Nothing to uninstall.\n`);
    return;
  }

  let removedCount = 0;

  // 1. Remove Blueprint commands/skills directory
  const isCursor = runtime === 'cursor';
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
    // OpenCode: remove command/bp-*.md files
    const commandDir = path.join(targetDir, 'command');
    if (fs.existsSync(commandDir)) {
      const files = fs.readdirSync(commandDir);
      for (const file of files) {
        if (file.startsWith('bp-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(commandDir, file));
          removedCount++;
        }
      }
      console.log(`  ${green}✓${reset} Removed Blueprint commands from command/`);
    }
  } else {
    // Claude Code & Gemini: remove commands/bp/ directory
    const bpCommandsDir = path.join(targetDir, 'commands', 'bp');
    if (fs.existsSync(bpCommandsDir)) {
      fs.rmSync(bpCommandsDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed commands/bp/`);
    }
  }

  // 2. Remove blueprint directory
  const bpDir = path.join(targetDir, 'blueprint');
  if (fs.existsSync(bpDir)) {
    fs.rmSync(bpDir, { recursive: true });
    removedCount++;
    console.log(`  ${green}✓${reset} Removed blueprint/`);
  }

  // 3. Remove Blueprint agents (bp-*.md files only)
  const agentsDir = path.join(targetDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const files = fs.readdirSync(agentsDir);
    let agentCount = 0;
    for (const file of files) {
      if (file.startsWith('bp-') && file.endsWith('.md')) {
        fs.unlinkSync(path.join(agentsDir, file));
        agentCount++;
      }
    }
    if (agentCount > 0) {
      removedCount++;
      console.log(`  ${green}✓${reset} Removed ${agentCount} Blueprint agents`);
    }
  }

  // 4. Remove Blueprint hooks
  const hooksDir = path.join(targetDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const bpHooks = ['bp-statusline.js', 'bp-check-update.js', 'bp-check-update.sh'];
    let hookCount = 0;
    for (const hook of bpHooks) {
      const hookPath = path.join(hooksDir, hook);
      if (fs.existsSync(hookPath)) {
        fs.unlinkSync(hookPath);
        hookCount++;
      }
    }
    if (hookCount > 0) {
      removedCount++;
      console.log(`  ${green}✓${reset} Removed ${hookCount} Blueprint hooks`);
    }
  }

  // 5. Clean up settings.json (remove Blueprint hooks and statusline)
  const settingsPath = path.join(targetDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    let settings = readSettings(settingsPath);
    let settingsModified = false;

    // Remove Blueprint statusline if it references our hook
    if (settings.statusLine && settings.statusLine.command &&
        settings.statusLine.command.includes('bp-statusline')) {
      delete settings.statusLine;
      settingsModified = true;
      console.log(`  ${green}✓${reset} Removed Blueprint statusline from settings`);
    }

    // Remove Blueprint hooks from SessionStart
    if (settings.hooks && settings.hooks.SessionStart) {
      const before = settings.hooks.SessionStart.length;
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry => {
        if (entry.hooks && Array.isArray(entry.hooks)) {
          // Filter out Blueprint hooks
          const hasBpHook = entry.hooks.some(h =>
            h.command && (h.command.includes('bp-check-update') || h.command.includes('bp-statusline'))
          );
          return !hasBpHook;
        }
        return true;
      });
      if (settings.hooks.SessionStart.length < before) {
        settingsModified = true;
        console.log(`  ${green}✓${reset} Removed Blueprint hooks from settings`);
      }
      // Clean up empty array
      if (settings.hooks.SessionStart.length === 0) {
        delete settings.hooks.SessionStart;
      }
      // Clean up empty hooks object
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
    }

    if (settingsModified) {
      writeSettings(settingsPath, settings);
      removedCount++;
    }
  }

  // 6. For OpenCode, clean up permissions from opencode.json
  if (isOpencode) {
    const opencodeConfigDir = getOpencodeGlobalDir();
    const configPath = path.join(opencodeConfigDir, 'opencode.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        let modified = false;

        // Remove Blueprint permission entries
        if (config.permission) {
          for (const permType of ['read', 'external_directory']) {
            if (config.permission[permType]) {
              const keys = Object.keys(config.permission[permType]);
              for (const key of keys) {
                if (key.includes('blueprint')) {
                  delete config.permission[permType][key];
                  modified = true;
                }
              }
              // Clean up empty objects
              if (Object.keys(config.permission[permType]).length === 0) {
                delete config.permission[permType];
              }
            }
          }
          if (Object.keys(config.permission).length === 0) {
            delete config.permission;
          }
        }

        if (modified) {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
          removedCount++;
          console.log(`  ${green}✓${reset} Removed Blueprint permissions from opencode.json`);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  }

  if (removedCount === 0) {
    console.log(`  ${yellow}⚠${reset} No Blueprint files found to remove.`);
  }

  console.log(`
  ${green}Done!${reset} Blueprint has been uninstalled from ${runtimeLabel}.
  Your other files and settings have been preserved.
`);
}

/**
 * Parse JSONC (JSON with Comments) by stripping comments and trailing commas.
 * OpenCode supports JSONC format via jsonc-parser, so users may have comments.
 * This is a lightweight inline parser to avoid adding dependencies.
 */
function parseJsonc(content) {
  // Strip BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  // Remove single-line and block comments while preserving strings
  let result = '';
  let inString = false;
  let i = 0;
  while (i < content.length) {
    const char = content[i];
    const next = content[i + 1];

    if (inString) {
      result += char;
      // Handle escape sequences
      if (char === '\\' && i + 1 < content.length) {
        result += next;
        i += 2;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      i++;
    } else {
      if (char === '"') {
        inString = true;
        result += char;
        i++;
      } else if (char === '/' && next === '/') {
        // Skip single-line comment until end of line
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
      } else if (char === '/' && next === '*') {
        // Skip block comment
        i += 2;
        while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) {
          i++;
        }
        i += 2; // Skip closing */
      } else {
        result += char;
        i++;
      }
    }
  }

  // Remove trailing commas before } or ]
  result = result.replace(/,(\s*[}\]])/g, '$1');

  return JSON.parse(result);
}

/**
 * Configure OpenCode permissions to allow reading Blueprint reference docs
 * This prevents permission prompts when Blueprint accesses the blueprint directory
 */
function configureOpencodePermissions() {
  // OpenCode config file is at ~/.config/opencode/opencode.json
  const opencodeConfigDir = getOpencodeGlobalDir();
  const configPath = path.join(opencodeConfigDir, 'opencode.json');

  // Ensure config directory exists
  fs.mkdirSync(opencodeConfigDir, { recursive: true });

  // Read existing config or create empty object
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      config = parseJsonc(content);
    } catch (e) {
      // Cannot parse - DO NOT overwrite user's config
      console.log(`  ${yellow}⚠${reset} Could not parse opencode.json - skipping permission config`);
      console.log(`    ${dim}Reason: ${e.message}${reset}`);
      console.log(`    ${dim}Your config was NOT modified. Fix the syntax manually if needed.${reset}`);
      return;
    }
  }

  // Ensure permission structure exists
  if (!config.permission) {
    config.permission = {};
  }

  // Build the Blueprint path using the actual config directory
  // Use ~ shorthand if it's in the default location, otherwise use full path
  const defaultConfigDir = path.join(os.homedir(), '.config', 'opencode');
  const bpPath = opencodeConfigDir === defaultConfigDir
    ? '~/.config/opencode/blueprint/*'
    : `${opencodeConfigDir.replace(/\\/g, '/')}/blueprint/*`;

  let modified = false;

  // Configure read permission
  if (!config.permission.read || typeof config.permission.read !== 'object') {
    config.permission.read = {};
  }
  if (config.permission.read[bpPath] !== 'allow') {
    config.permission.read[bpPath] = 'allow';
    modified = true;
  }

  // Configure external_directory permission (the safety guard for paths outside project)
  if (!config.permission.external_directory || typeof config.permission.external_directory !== 'object') {
    config.permission.external_directory = {};
  }
  if (config.permission.external_directory[bpPath] !== 'allow') {
    config.permission.external_directory[bpPath] = 'allow';
    modified = true;
  }

  if (!modified) {
    return; // Already configured
  }

  // Write config back
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`  ${green}✓${reset} Configured read permission for Blueprint docs`);
}

/**
 * Verify a directory exists and contains files
 */
function verifyInstalled(dirPath, description) {
  if (!fs.existsSync(dirPath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory not created`);
    return false;
  }
  try {
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) {
      console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory is empty`);
      return false;
    }
  } catch (e) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: ${e.message}`);
    return false;
  }
  return true;
}

/**
 * Verify a file exists
 */
function verifyFileInstalled(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: file not created`);
    return false;
  }
  return true;
}

/**
 * Install to the specified directory for a specific runtime
 * @param {boolean} isGlobal - Whether to install globally or locally
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini')
 */

// ──────────────────────────────────────────────────────
// Local Patch Persistence
// ──────────────────────────────────────────────────────

const PATCHES_DIR_NAME = 'bp-local-patches';
const MANIFEST_NAME = 'bp-file-manifest.json';

/**
 * Compute SHA256 hash of file contents
 */
function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Recursively collect all files in dir with their hashes
 */
function generateManifest(dir, baseDir) {
  if (!baseDir) baseDir = dir;
  const manifest = {};
  if (!fs.existsSync(dir)) return manifest;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      Object.assign(manifest, generateManifest(fullPath, baseDir));
    } else {
      manifest[relPath] = fileHash(fullPath);
    }
  }
  return manifest;
}

/**
 * Write file manifest after installation for future modification detection
 */
function writeManifest(configDir) {
  const bpDir = path.join(configDir, 'blueprint');
  const commandsDir = path.join(configDir, 'commands', 'bp');
  const agentsDir = path.join(configDir, 'agents');
  const manifest = { version: pkg.version, timestamp: new Date().toISOString(), files: {} };

  const bpHashes = generateManifest(bpDir);
  for (const [rel, hash] of Object.entries(bpHashes)) {
    manifest.files['blueprint/' + rel] = hash;
  }
  if (fs.existsSync(commandsDir)) {
    const cmdHashes = generateManifest(commandsDir);
    for (const [rel, hash] of Object.entries(cmdHashes)) {
      manifest.files['commands/bp/' + rel] = hash;
    }
  }
  if (fs.existsSync(agentsDir)) {
    for (const file of fs.readdirSync(agentsDir)) {
      if (file.startsWith('bp-') && file.endsWith('.md')) {
        manifest.files['agents/' + file] = fileHash(path.join(agentsDir, file));
      }
    }
  }

  fs.writeFileSync(path.join(configDir, MANIFEST_NAME), JSON.stringify(manifest, null, 2));
  return manifest;
}

/**
 * Detect user-modified Blueprint files by comparing against install manifest.
 * Backs up modified files to bp-local-patches/ for reapply after update.
 */
function saveLocalPatches(configDir) {
  const manifestPath = path.join(configDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) return [];

  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { return []; }

  const patchesDir = path.join(configDir, PATCHES_DIR_NAME);
  const modified = [];

  for (const [relPath, originalHash] of Object.entries(manifest.files || {})) {
    const fullPath = path.join(configDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const currentHash = fileHash(fullPath);
    if (currentHash !== originalHash) {
      const backupPath = path.join(patchesDir, relPath);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(fullPath, backupPath);
      modified.push(relPath);
    }
  }

  if (modified.length > 0) {
    const meta = {
      backed_up_at: new Date().toISOString(),
      from_version: manifest.version,
      files: modified
    };
    fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify(meta, null, 2));
    console.log('  ' + yellow + 'i' + reset + '  Found ' + modified.length + ' locally modified Blueprint file(s) — backed up to ' + PATCHES_DIR_NAME + '/');
    for (const f of modified) {
      console.log('     ' + dim + f + reset);
    }
  }
  return modified;
}

/**
 * After install, report backed-up patches for user to reapply.
 */
function reportLocalPatches(configDir) {
  const patchesDir = path.join(configDir, PATCHES_DIR_NAME);
  const metaPath = path.join(patchesDir, 'backup-meta.json');
  if (!fs.existsSync(metaPath)) return [];

  let meta;
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { return []; }

  if (meta.files && meta.files.length > 0) {
    console.log('');
    console.log('  ' + yellow + 'Local patches detected' + reset + ' (from v' + meta.from_version + '):');
    for (const f of meta.files) {
      console.log('     ' + cyan + f + reset);
    }
    console.log('');
    console.log('  Your modifications are saved in ' + cyan + PATCHES_DIR_NAME + '/' + reset);
    console.log('  Run ' + cyan + '/bp:reapply-patches' + reset + ' to merge them into the new version.');
    console.log('  Or manually compare and merge the files.');
    console.log('');
  }
  return meta.files || [];
}

function install(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isGemini = runtime === 'gemini';
  const isCursor = runtime === 'cursor';
  const dirName = getDirName(runtime);
  const src = path.join(__dirname, '..');

  // Get the target directory based on runtime and install type
  const targetDir = isGlobal
    ? getGlobalDir(runtime, explicitConfigDir)
    : path.join(process.cwd(), dirName);

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  // Path prefix for file references in markdown content
  // For global installs: use full path
  // For local installs: use relative
  const pathPrefix = isGlobal
    ? `${targetDir.replace(/\\/g, '/')}/`
    : `./${dirName}/`;

  let runtimeLabel = 'Claude Code';
  if (isOpencode) runtimeLabel = 'OpenCode';
  if (isGemini) runtimeLabel = 'Gemini';
  if (isCursor) runtimeLabel = 'Cursor';

  console.log(`  Installing for ${cyan}${runtimeLabel}${reset} to ${cyan}${locationLabel}${reset}\n`);

  // Track installation failures
  const failures = [];

  // Save any locally modified Blueprint files before they get wiped
  saveLocalPatches(targetDir);

  // Clean up orphaned files from previous versions
  cleanupOrphanedFiles(targetDir);

  // Runtime-specific command installation
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
    // OpenCode: flat structure in command/ directory
    const commandDir = path.join(targetDir, 'command');
    fs.mkdirSync(commandDir, { recursive: true });

    // Copy commands/bp/*.md as command/bp-*.md (flatten structure)
    const bpSrc = path.join(src, 'commands', 'bp');
    copyFlattenedCommands(bpSrc, commandDir, 'bp', pathPrefix, runtime);
    if (verifyInstalled(commandDir, 'command/bp-*')) {
      const count = fs.readdirSync(commandDir).filter(f => f.startsWith('bp-')).length;
      console.log(`  ${green}✓${reset} Installed ${count} commands to command/`);
    } else {
      failures.push('command/bp-*');
    }
  } else {
    // Claude Code & Gemini: nested structure in commands/ directory
    const commandsDir = path.join(targetDir, 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    const bpSrc = path.join(src, 'commands', 'bp');
    const bpDest = path.join(commandsDir, 'bp');
    copyWithPathReplacement(bpSrc, bpDest, pathPrefix, runtime);
    if (verifyInstalled(bpDest, 'commands/bp')) {
      console.log(`  ${green}✓${reset} Installed commands/bp`);
    } else {
      failures.push('commands/bp');
    }
  }

  // Copy blueprint skill with path replacement
  const skillSrc = path.join(src, 'blueprint');
  const skillDest = path.join(targetDir, 'blueprint');
  copyWithPathReplacement(skillSrc, skillDest, pathPrefix, runtime);
  if (verifyInstalled(skillDest, 'blueprint')) {
    console.log(`  ${green}✓${reset} Installed blueprint`);
  } else {
    failures.push('blueprint');
  }

  // Copy agents to agents directory
  const agentsSrc = path.join(src, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentsDest = path.join(targetDir, 'agents');
    fs.mkdirSync(agentsDest, { recursive: true });

    // Remove old Blueprint agents (bp-*.md) before copying new ones
    if (fs.existsSync(agentsDest)) {
      for (const file of fs.readdirSync(agentsDest)) {
        if (file.startsWith('bp-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(agentsDest, file));
        }
      }
    }

    // Copy new agents
    const agentEntries = fs.readdirSync(agentsSrc, { withFileTypes: true });
    for (const entry of agentEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        let content = fs.readFileSync(path.join(agentsSrc, entry.name), 'utf8');
        // Always replace ~/.claude/ as it is the source of truth in the repo
        const dirRegex = /~\/\.claude\//g;
        content = content.replace(dirRegex, pathPrefix);
        content = processAttribution(content, getCommitAttribution(runtime));
        // Convert frontmatter for runtime compatibility
        if (isOpencode) {
          content = convertClaudeToOpencodeFrontmatter(content);
        } else if (isGemini) {
          content = convertClaudeToGeminiAgent(content);
        } else if (isCursor) {
          content = convertClaudeToCursorAgent(content, pathPrefix);
        }
        fs.writeFileSync(path.join(agentsDest, entry.name), content);
      }
    }
    if (verifyInstalled(agentsDest, 'agents')) {
      console.log(`  ${green}✓${reset} Installed agents`);
    } else {
      failures.push('agents');
    }
  }

  // Copy CHANGELOG.md
  const changelogSrc = path.join(src, 'CHANGELOG.md');
  const changelogDest = path.join(targetDir, 'blueprint', 'CHANGELOG.md');
  if (fs.existsSync(changelogSrc)) {
    fs.copyFileSync(changelogSrc, changelogDest);
    if (verifyFileInstalled(changelogDest, 'CHANGELOG.md')) {
      console.log(`  ${green}✓${reset} Installed CHANGELOG.md`);
    } else {
      failures.push('CHANGELOG.md');
    }
  }

  // Write VERSION file
  const versionDest = path.join(targetDir, 'blueprint', 'VERSION');
  fs.writeFileSync(versionDest, pkg.version);
  if (verifyFileInstalled(versionDest, 'VERSION')) {
    console.log(`  ${green}✓${reset} Wrote VERSION (${pkg.version})`);
  } else {
    failures.push('VERSION');
  }

  // Copy hooks from dist/ (bundled with dependencies)
  // Skip for Cursor — hooks deferred to v2
  if (!isCursor) {
    const hooksSrc = path.join(src, 'hooks', 'dist');
    if (fs.existsSync(hooksSrc)) {
      const hooksDest = path.join(targetDir, 'hooks');
      fs.mkdirSync(hooksDest, { recursive: true });
      const hookEntries = fs.readdirSync(hooksSrc);
      for (const entry of hookEntries) {
        const srcFile = path.join(hooksSrc, entry);
        if (fs.statSync(srcFile).isFile()) {
          const destFile = path.join(hooksDest, entry);
          fs.copyFileSync(srcFile, destFile);
        }
      }
      if (verifyInstalled(hooksDest, 'hooks')) {
        console.log(`  ${green}✓${reset} Installed hooks (bundled)`);
      } else {
        failures.push('hooks');
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
    process.exit(1);
  }

  // Configure statusline and hooks in settings.json
  // Gemini shares same hook system as Claude Code for now
  const settingsPath = path.join(targetDir, 'settings.json');
  const settings = cleanupOrphanedHooks(readSettings(settingsPath));
  const statuslineCommand = isGlobal
    ? buildHookCommand(targetDir, 'bp-statusline.js')
    : 'node ' + dirName + '/hooks/bp-statusline.js';
  const updateCheckCommand = isGlobal
    ? buildHookCommand(targetDir, 'bp-check-update.js')
    : 'node ' + dirName + '/hooks/bp-check-update.js';

  // Enable experimental agents for Gemini CLI (required for custom sub-agents)
  if (isGemini) {
    if (!settings.experimental) {
      settings.experimental = {};
    }
    if (!settings.experimental.enableAgents) {
      settings.experimental.enableAgents = true;
      console.log(`  ${green}✓${reset} Enabled experimental agents`);
    }
  }

  // Configure SessionStart hook for update checking (skip for opencode and cursor)
  if (!isOpencode && !isCursor) {
    if (!settings.hooks) {
      settings.hooks = {};
    }
    if (!settings.hooks.SessionStart) {
      settings.hooks.SessionStart = [];
    }

    const hasBpUpdateHook = settings.hooks.SessionStart.some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('bp-check-update'))
    );

    if (!hasBpUpdateHook) {
      settings.hooks.SessionStart.push({
        hooks: [
          {
            type: 'command',
            command: updateCheckCommand
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured update check hook`);
    }
  }

  // Write file manifest for future modification detection
  writeManifest(targetDir);
  console.log(`  ${green}✓${reset} Wrote file manifest (${MANIFEST_NAME})`);

  // Report any backed-up local patches
  reportLocalPatches(targetDir);

  return { settingsPath, settings, statuslineCommand, runtime };
}

/**
 * Apply statusline config, then print completion message
 */
function finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';

  if (shouldInstallStatusline && !isOpencode) {
    settings.statusLine = {
      type: 'command',
      command: statuslineCommand
    };
    console.log(`  ${green}✓${reset} Configured statusline`);
  }

  // Always write settings
  writeSettings(settingsPath, settings);

  // Configure OpenCode permissions
  if (isOpencode) {
    configureOpencodePermissions();
  }

  let program = 'Claude Code';
  if (runtime === 'opencode') program = 'OpenCode';
  if (runtime === 'gemini') program = 'Gemini';
  if (runtime === 'cursor') program = 'Cursor';

  const isCursor = runtime === 'cursor';
  const command = isOpencode ? '/bp-help' : isCursor ? '/bp-27-help' : '/bp:help';
  console.log(`
  ${green}Done!${reset} Launch ${program} and run ${cyan}${command}${reset}.

  ${cyan}Join the community:${reset} https://discord.gg/5JJgD5svVS
`);
}

/**
 * Handle statusline configuration with optional prompt
 */
function handleStatusline(settings, isInteractive, callback) {
  const hasExisting = settings.statusLine != null;

  if (!hasExisting) {
    callback(true);
    return;
  }

  if (forceStatusline) {
    callback(true);
    return;
  }

  if (!isInteractive) {
    console.log(`  ${yellow}⚠${reset} Skipping statusline (already configured)`);
    console.log(`    Use ${cyan}--force-statusline${reset} to replace\n`);
    callback(false);
    return;
  }

  const existingCmd = settings.statusLine.command || settings.statusLine.url || '(custom)';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`
  ${yellow}⚠${reset} Existing statusline detected\n
  Your current statusline:
    ${dim}command: ${existingCmd}${reset}

  Blueprint includes a statusline showing:
    • Model name
    • Current task (from todo list)
    • Context window usage (color-coded)

  ${cyan}1${reset}) Keep existing
  ${cyan}2${reset}) Replace with Blueprint statusline
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    callback(choice === '2');
  });
}

/**
 * Prompt for runtime selection
 */
function promptRuntime(callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let answered = false;

  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
      process.exit(0);
    }
  });

  console.log(`  ${yellow}Which runtime(s) would you like to install for?${reset}\n\n  ${cyan}1${reset}) Claude Code ${dim}(~/.claude)${reset}
  ${cyan}2${reset}) OpenCode    ${dim}(~/.config/opencode)${reset} - open source, free models
  ${cyan}3${reset}) Gemini      ${dim}(~/.gemini)${reset}
  ${cyan}4${reset}) Cursor      ${dim}(~/.cursor)${reset}
  ${cyan}5${reset}) All
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    if (choice === '5') {
      callback(['claude', 'opencode', 'gemini', 'cursor']);
    } else if (choice === '4') {
      callback(['cursor']);
    } else if (choice === '3') {
      callback(['gemini']);
    } else if (choice === '2') {
      callback(['opencode']);
    } else {
      callback(['claude']);
    }
  });
}

/**
 * Prompt for install location
 */
function promptLocation(runtimes) {
  if (!process.stdin.isTTY) {
    console.log(`  ${yellow}Non-interactive terminal detected, defaulting to global install${reset}\n`);
    installAllRuntimes(runtimes, true, false);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let answered = false;

  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
      process.exit(0);
    }
  });

  const pathExamples = runtimes.map(r => {
    const globalPath = getGlobalDir(r, explicitConfigDir);
    return globalPath.replace(os.homedir(), '~');
  }).join(', ');

  const localExamples = runtimes.map(r => `./${getDirName(r)}`).join(', ');

  console.log(`  ${yellow}Where would you like to install?${reset}\n\n  ${cyan}1${reset}) Global ${dim}(${pathExamples})${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(${localExamples})${reset} - this project only
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    installAllRuntimes(runtimes, isGlobal, true);
  });
}

/**
 * Install Blueprint for all selected runtimes
 */
function installAllRuntimes(runtimes, isGlobal, isInteractive) {
  const results = [];

  for (const runtime of runtimes) {
    const result = install(isGlobal, runtime);
    results.push(result);
  }

  // Handle statusline for Claude & Gemini (OpenCode uses themes)
  const claudeResult = results.find(r => r.runtime === 'claude');
  const geminiResult = results.find(r => r.runtime === 'gemini');

  // Logic: if both are present, ask once if interactive? Or ask for each?
  // Simpler: Ask once and apply to both if applicable.
  
  if (claudeResult || geminiResult) {
    // Use whichever settings exist to check for existing statusline
    const primaryResult = claudeResult || geminiResult;
    
    handleStatusline(primaryResult.settings, isInteractive, (shouldInstallStatusline) => {
      if (claudeResult) {
        finishInstall(claudeResult.settingsPath, claudeResult.settings, claudeResult.statuslineCommand, shouldInstallStatusline, 'claude');
      }
      if (geminiResult) {
         finishInstall(geminiResult.settingsPath, geminiResult.settings, geminiResult.statuslineCommand, shouldInstallStatusline, 'gemini');
      }

      const opencodeResult = results.find(r => r.runtime === 'opencode');
      if (opencodeResult) {
        finishInstall(opencodeResult.settingsPath, opencodeResult.settings, opencodeResult.statuslineCommand, false, 'opencode');
      }

      // Cursor doesn't use statusline — finishInstall with shouldInstallStatusline=false
      const cursorResult = results.find(r => r.runtime === 'cursor');
      if (cursorResult) {
        finishInstall(cursorResult.settingsPath, cursorResult.settings, cursorResult.statuslineCommand, false, 'cursor');
      }
    });
  } else {
    // Only runtimes without statusline (OpenCode and/or Cursor)
    const opencodeResult = results.find(r => r.runtime === 'opencode');
    if (opencodeResult) {
      finishInstall(opencodeResult.settingsPath, opencodeResult.settings, opencodeResult.statuslineCommand, false, 'opencode');
    }
    const cursorResult = results.find(r => r.runtime === 'cursor');
    if (cursorResult) {
      finishInstall(cursorResult.settingsPath, cursorResult.settings, cursorResult.statuslineCommand, false, 'cursor');
    }
  }
}

// Main logic
if (hasGlobal && hasLocal) {
  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
  process.exit(1);
} else if (explicitConfigDir && hasLocal) {
  console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
  process.exit(1);
} else if (hasUninstall) {
  if (!hasGlobal && !hasLocal) {
    console.error(`  ${yellow}--uninstall requires --global or --local${reset}`);
    process.exit(1);
  }
  const runtimes = selectedRuntimes.length > 0 ? selectedRuntimes : ['claude'];
  for (const runtime of runtimes) {
    uninstall(hasGlobal, runtime);
  }
} else if (selectedRuntimes.length > 0) {
  if (!hasGlobal && !hasLocal) {
    promptLocation(selectedRuntimes);
  } else {
    installAllRuntimes(selectedRuntimes, hasGlobal, false);
  }
} else if (hasGlobal || hasLocal) {
  // Default to Claude if no runtime specified but location is
  installAllRuntimes(['claude'], hasGlobal, false);
} else {
  // Interactive
  if (!process.stdin.isTTY) {
    console.log(`  ${yellow}Non-interactive terminal detected, defaulting to Claude Code global install${reset}\n`);
    installAllRuntimes(['claude'], true, false);
  } else {
    promptRuntime((runtimes) => {
      promptLocation(runtimes);
    });
  }
}
