# Modes

Agent offers different modes optimized for specific tasks. Each mode has different capabilities and tools enabled to match your workflow needs.

Understanding [how agents work](/learn/agents) and [tool calling fundamentals](/learn/tool-calling) will help you choose the right mode for your task.

ModeForCapabilitiesTools**[Agent](#agent)**Complex features, refactoringAutonomous exploration, multi-file editsAll tools enabled**[Ask](#ask)**Learning, planning, questionsRead-only exploration, no automatic changesSearch tools only**[Plan](#plan)**Complex features requiring planningCreates detailed plans before execution, asks clarifying questionsAll tools enabled**[Debug](#debug)**Tricky bugs, regressionsHypothesis generation, log instrumentation, runtime analysisAll tools + debug server
## Agent

The default mode for complex coding tasks. Agent autonomously explores your codebase, edits multiple files, runs commands, and fixes errors to complete your requests.

## Ask

Read-only mode for learning and exploration. Ask searches your codebase and provides answers without making any changes - perfect for understanding code before modifying it.

## Plan

Plan Mode creates detailed implementation plans before writing any code. Agent researches your codebase, asks clarifying questions, and generates a reviewable plan you can edit before building.

Press Shift+Tab from the chat input to rotate to Plan Mode. Cursor also suggests it automatically when you type keywords that indicate complex tasks.

### How it works

1. Agent asks clarifying questions to understand your requirements
2. Researches your codebase to gather relevant context
3. Creates a comprehensive implementation plan
4. You review and edit the plan through chat or markdown files
5. Click to build the plan when ready

Plans open as ephemeral virtual files that you can view and edit. To save a plan to your workspace, click "Save to workspace" to store it in `.cursor/plans/` for future reference, team sharing, and documentation.

### When to use Plan Mode

Plan Mode works best for:

- Complex features with multiple valid approaches
- Tasks that touch many files or systems
- Unclear requirements where you need to explore before understanding scope
- Architectural decisions where you want to review the approach first

For quick changes or tasks you've done many times before, jumping straight to Agent mode is fine.

### Starting over from a plan

Sometimes Agent builds something that doesn't match what you wanted. Instead of trying to fix it through follow-up prompts, go back to the plan.

Revert the changes, refine the plan to be more specific about what you need, and run it again. This is often faster than fixing an in-progress agent, and produces cleaner results.

For larger changes, spend extra time creating a precise, well-scoped plan. The hard part is often figuring out **what** change should be made—a task suited well for humans. With the right instructions, delegate implementation to Agent.

## Debug

Debug Mode helps you find root causes and fix tricky bugs that are hard to reproduce or understand. Instead of immediately writing code, the agent generates hypotheses, adds log statements, and uses runtime information to pinpoint the exact issue before making a targeted fix.

### When to use Debug Mode

Debug Mode works best for:

- **Bugs you can reproduce but can't figure out**: When you know something is wrong but the cause isn't obvious from reading the code
- **Race conditions and timing issues**: Problems that depend on execution order or async behavior
- **Performance problems and memory leaks**: Issues that require runtime profiling to understand
- **Regressions where something used to work**: When you need to trace what changed

When standard Agent interactions struggle with a bug, Debug Mode provides a different approach—using runtime evidence rather than guessing at fixes.

### How it works

1. **Explore and hypothesize**: The agent explores relevant files, builds context, and generates multiple hypotheses about potential root causes.
2. **Add instrumentation**: The agent adds log statements that send data to a local debug server running in a Cursor extension.
3. **Reproduce the bug**: Debug Mode asks you to reproduce the bug and provides specific steps. This keeps you in the loop and ensures the agent captures real runtime behavior.
4. **Analyze logs**: After reproduction, the agent reviews the collected logs to identify the actual root cause based on runtime evidence.
5. **Make targeted fix**: The agent makes a focused fix that directly addresses the root cause—often just a few lines of code.
6. **Verify and clean up**: You can re-run the reproduction steps to verify the fix. Once confirmed, the agent removes all instrumentation.

### Tips for Debug Mode

- **Provide detailed context**: The more you describe the bug and how to reproduce it, the better the agent's instrumentation will be. Include error messages, stack traces, and specific steps.
- **Follow reproduction steps exactly**: Execute the steps the agent provides to ensure logs capture the actual issue.
- **Reproduce multiple times if needed**: Reproducing the bug multiple times may help the agent identify particularly tricky problems like race conditions.
- **Be specific about expected vs. actual behavior**: Help the agent understand what should happen versus what is happening.

## Custom slash commands

For specialized workflows, you can create [custom slash commands](/docs/agent/chat/commands) that combine specific instructions with tool limitations.

Custom modes are deprecated in Cursor 2.1. Users with custom modes can select the "Export Custom Modes" option to transition their modes to [custom commands](/docs/agent/chat/commands).

### Examples

### Learn

### Refactor

### Debug

Create a `/debug` command that instructs the agent to investigate issues thoroughly before proposing fixes. Include in the prompt: "Investigate the issue using search tools and terminal commands first. Only propose fixes after thoroughly understanding the root cause."

See the [Commands documentation](/docs/agent/chat/commands) for details on creating custom slash commands.

## Switching modes

- Use the mode picker dropdown in Agent
- Press Cmd+.Ctrl+. for quick switching
- Set keyboard shortcuts in [settings](#settings)

## Settings

All modes share common configuration options:

SettingDescriptionModelChoose which AI model to useKeyboard shortcutsSet shortcuts to switch between modes
Mode-specific settings:

ModeSettingsDescription**Agent**Auto-run and Auto-fix ErrorsAutomatically run commands and fix errors**Ask**Search CodebaseAutomatically find relevant files
## Changelog

### Custom modes removed

Custom modes have been removed from Cursor. If you previously used custom modes to create specialized workflows with specific tool combinations, you can now achieve the same functionality using [custom slash commands](/docs/agent/chat/commands).

Custom slash commands allow you to:

- Define reusable workflows triggered with a `/` prefix
- Include instructions about tool usage directly in the command prompt
- Share commands across your team via team commands
- Store commands in your project's `.cursor/commands` directory

To limit which tools the agent uses, simply include those instructions as part of the command prompt. For example, a command that should only use search tools might include: "Use only search tools (read file, codebase search, grep) - do not make any edits or run terminal commands."

See the [Commands documentation](/docs/agent/chat/commands) for complete details on creating and using custom slash commands.