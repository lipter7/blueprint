# Hooks

Hooks let you observe, control, and extend the agent loop using custom scripts. Hooks are spawned processes that communicate over stdio using JSON in both directions. They run before or after defined stages of the agent loop and can observe, block, or modify behavior.

With hooks, you can:

- Run formatters after edits
- Add analytics for events
- Scan for PII or secrets
- Gate risky operations (e.g., SQL writes)
- Control subagent (Task tool) execution
- Inject context at session start

Looking for ready-to-use integrations? See [Partner Integrations](#partner-integrations) for security, governance, and secrets management solutions from our ecosystem partners.

Cursor supports loading hooks from third-party tools like Claude Code. See [Third Party Hooks](/docs/agent/third-party-hooks) for details on compatibility and configuration.

## Agent and Tab Support

Hooks work with both **Cursor Agent** (Cmd+K/Agent Chat) and **Cursor Tab** (inline completions), but they use different hook events:

**Agent (Cmd+K/Agent Chat)** uses the standard hooks:

- `sessionStart` / `sessionEnd` - Session lifecycle management
- `preToolUse` / `postToolUse` / `postToolUseFailure` - Generic tool use hooks (fires for all tools)
- `subagentStart` / `subagentStop` - Subagent (Task tool) lifecycle
- `beforeShellExecution` / `afterShellExecution` - Control shell commands
- `beforeMCPExecution` / `afterMCPExecution` - Control MCP tool usage
- `beforeReadFile` / `afterFileEdit` - Control file access and edits
- `beforeSubmitPrompt` - Validate prompts before submission
- `preCompact` - Observe context window compaction
- `stop` - Handle agent completion
- `afterAgentResponse` / `afterAgentThought` - Track agent responses

**Tab (inline completions)** uses specialized hooks:

- `beforeTabFileRead` - Control file access for Tab completions
- `afterTabFileEdit` - Post-process Tab edits

These separate hooks allow different policies for autonomous Tab operations versus user-directed Agent operations.

## Quickstart

Create a `hooks.json` file. You can create it at the project level (`<project>/.cursor/hooks.json`) or in your home directory (`~/.cursor/hooks.json`). Project-level hooks apply only to that specific project, while home directory hooks apply globally.

User hooks (~/.cursor/)Project hooks (.cursor/)For user-level hooks that apply globally, create `~/.cursor/hooks.json`:

```
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [{ "command": "./hooks/format.sh" }]
  }
}
```

Create your hook script at `~/.cursor/hooks/format.sh`:

```
#!/bin/bash
# Read input, do something, exit 0
cat > /dev/null
exit 0
```

Make it executable:

```
chmod +x ~/.cursor/hooks/format.sh
```

Restart Cursor. Your hook now runs after every file edit.

## Hook Types

Hooks support two execution types: command-based (default) and prompt-based (LLM-evaluated).

### Command-Based Hooks

Command hooks execute shell scripts that receive JSON input via stdin and return JSON output via stdout.

```
{
  "hooks": {
    "beforeShellExecution": [
      {
        "command": "./scripts/approve-network.sh",
        "timeout": 30,
        "matcher": "curl|wget|nc"
      }
    ]
  }
}
```

**Exit code behavior:**

- Exit code `0` - Hook succeeded, use the JSON output
- Exit code `2` - Block the action (equivalent to returning `permission: "deny"`)
- Other exit codes - Hook failed, action proceeds (fail-open by default)

### Prompt-Based Hooks

Prompt hooks use an LLM to evaluate a natural language condition. They're useful for policy enforcement without writing custom scripts.

```
{
  "hooks": {
    "beforeShellExecution": [
      {
        "type": "prompt",
        "prompt": "Does this command look safe to execute? Only allow read-only operations.",
        "timeout": 10
      }
    ]
  }
}
```

**Features:**

- Returns structured `{ ok: boolean, reason?: string }` response
- Uses a fast model for quick evaluation
- `$ARGUMENTS` placeholder is auto-replaced with hook input JSON
- If `$ARGUMENTS` is absent, hook input is auto-appended
- Optional `model` field to override the default LLM model

## Examples

The examples below use `./hooks/...` paths, which work for **user hooks** (`~/.cursor/hooks.json`) where scripts run from `~/.cursor/`. For **project hooks** (`<project>/.cursor/hooks.json`), use `.cursor/hooks/...` paths instead since scripts run from the project root.

hooks.jsonaudit.shblock-git.sh```
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "command": "./hooks/session-init.sh"
      }
    ],
    "sessionEnd": [
      {
        "command": "./hooks/audit.sh"
      }
    ],
    "beforeShellExecution": [
      {
        "command": "./hooks/audit.sh"
      },
      {
        "command": "./hooks/block-git.sh"
      }
    ],
    "beforeMCPExecution": [
      {
        "command": "./hooks/audit.sh"
      }
    ],
    "afterShellExecution": [
      {
        "command": "./hooks/audit.sh"
      }
    ],
    "afterMCPExecution": [
      {
        "command": "./hooks/audit.sh"
      }
    ],
    "afterFileEdit": [
      {
        "command": "./hooks/audit.sh"
      }
    ],
    "beforeSubmitPrompt": [
      {
        "command": "./hooks/audit.sh"
      }
    ],
    "preCompact": [
      {
        "command": "./hooks/audit.sh"
      }
    ],
    "stop": [
      {
        "command": "./hooks/audit.sh"
      }
    ],
    "beforeTabFileRead": [
      {
        "command": "./hooks/redact-secrets-tab.sh"
      }
    ],
    "afterTabFileEdit": [
      {
        "command": "./hooks/format-tab.sh"
      }
    ]
  }
}
```

### TypeScript stop automation hook

Choose TypeScript when you need typed JSON, durable file I/O, and HTTP calls in the same hook. This Bun-powered `stop` hook tracks per-conversation failure counts on disk, forwards structured telemetry to an internal API, and can automatically schedule a retry when the agent fails twice in a row.

hooks.json.cursor/hooks/track-stop.ts```
{
  "version": 1,
  "hooks": {
    "stop": [
      {
        "command": "bun run .cursor/hooks/track-stop.ts --stop"
      }
    ]
  }
}
```

Set `AGENT_TELEMETRY_URL` to the internal endpoint that should receive run summaries.

### Python manifest guard hook

Python shines when you need rich parsing libraries. This hook uses `pyyaml` to inspect Kubernetes manifests before `kubectl apply` runs; Bash would struggle to parse multi-document YAML safely.

hooks.json.cursor/hooks/kube_guard.py```
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      {
        "command": "python3 .cursor/hooks/kube_guard.py"
      }
    ]
  }
}
```

Install PyYAML (for example, `pip install pyyaml`) wherever your hook scripts run so the parser import succeeds.

## Partner Integrations

We partner with ecosystem vendors who have built hooks support with Cursor. These integrations cover security scanning, governance, secrets management, and more.

### MCP governance and visibility

PartnerDescription[MintMCP](https://www.mintmcp.com/blog/mcp-governance-cursor-hooks)Build a complete inventory of MCP servers, monitor tool usage patterns, and scan responses for sensitive data before it reaches the AI model.[Oasis Security](https://www.oasis.security/blog/cursor-oasis-governing-agentic-access)Enforce least-privilege policies on AI agent actions and maintain full audit trails across enterprise systems.[Runlayer](https://www.runlayer.com/blog/cursor-hooks)Wrap MCP tools and integrate with their MCP broker for centralized control and visibility over agent-to-tool interactions.
### Code security and best practices

PartnerDescription[Corridor](https://corridor.dev/blog/corridor-cursor-hooks/)Get real-time feedback on code implementation and security design decisions as code is being written.[Semgrep](https://semgrep.dev/blog/2025/cursor-hooks-mcp-server)Automatically scan AI-generated code for vulnerabilities with real-time feedback to regenerate code until security issues are resolved.
### Dependency security

PartnerDescription[Endor Labs](https://www.endorlabs.com/learn/bringing-malware-detection-into-ai-coding-workflows-with-cursor-hooks)Intercept package installations and scan for malicious dependencies, preventing supply chain attacks before they enter your codebase.
### Agent security and safety

PartnerDescription[Snyk](https://snyk.io/blog/evo-agent-guard-cursor-integration/)Review agent actions in real-time with Evo Agent Guard, detecting and preventing issues like prompt injection and dangerous tool calls.
### Secrets management

PartnerDescription[1Password](https://marketplace.1password.com/integration/cursor-hooks)Validate that environment files from 1Password Environments are properly mounted before shell commands execute, enabling just-in-time secrets access without writing credentials to disk.
For more details about our hooks partners, see the [Hooks for security and platform teams](/blog/hooks-partners) blog post.

## Configuration

Define hooks in a `hooks.json` file. Configuration can exist at multiple levels; higher-priority sources override lower ones:

```
~/.cursor/
├── hooks.json
└── hooks/
    ├── audit.sh
    └── block-git.sh
```

- **Global** (Enterprise-managed):
- macOS: `/Library/Application Support/Cursor/hooks.json`
- Linux/WSL: `/etc/cursor/hooks.json`
- Windows: `C:\\ProgramData\\Cursor\\hooks.json`
- **Project Directory** (Project-specific):
- `<project-root>/.cursor/hooks.json`
- Project hooks run in any trusted workspace and are checked into version control with your project
- **Home Directory** (User-specific):
- `~/.cursor/hooks.json`

Priority order (highest to lowest): Enterprise → Team → Project → User

The `hooks` object maps hook names to arrays of hook definitions. Each definition currently supports a `command` property that can be a shell string, an absolute path, or a relative path. The working directory depends on the hook source:

- **Project hooks** (`.cursor/hooks.json` in a repository): Run from the **project root**
- **User hooks** (`~/.cursor/hooks.json`): Run from `~/.cursor/`
- **Enterprise hooks** (system-wide config): Run from the enterprise config directory
- **Team hooks** (cloud-distributed): Run from the managed hooks directory

For project hooks, use paths like `.cursor/hooks/script.sh` (relative to project root), not `./hooks/script.sh` (which would look for `<project>/hooks/script.sh`).

### Configuration file

This example shows a user-level hooks file (`~/.cursor/hooks.json`). For project-level hooks, change paths like `./hooks/script.sh` to `.cursor/hooks/script.sh`:

```
{
  "version": 1,
  "hooks": {
    "sessionStart": [{ "command": "./session-init.sh" }],
    "sessionEnd": [{ "command": "./audit.sh" }],
    "preToolUse": [
      {
        "command": "./hooks/validate-tool.sh",
        "matcher": "Shell|Read|Write"
      }
    ],
    "postToolUse": [{ "command": "./hooks/audit-tool.sh" }],
    "subagentStart": [{ "command": "./hooks/validate-subagent.sh" }],
    "subagentStop": [{ "command": "./hooks/audit-subagent.sh" }],
    "beforeShellExecution": [{ "command": "./script.sh" }],
    "afterShellExecution": [{ "command": "./script.sh" }],
    "afterMCPExecution": [{ "command": "./script.sh" }],
    "afterFileEdit": [{ "command": "./format.sh" }],
    "preCompact": [{ "command": "./audit.sh" }],
    "stop": [{ "command": "./audit.sh", "loop_limit": 10 }],
    "beforeTabFileRead": [{ "command": "./redact-secrets-tab.sh" }],
    "afterTabFileEdit": [{ "command": "./format-tab.sh" }]
  }
}
```

The Agent hooks (`sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`, `subagentStop`, `beforeShellExecution`, `afterShellExecution`, `beforeMCPExecution`, `afterMCPExecution`, `beforeReadFile`, `afterFileEdit`, `beforeSubmitPrompt`, `preCompact`, `stop`, `afterAgentResponse`, `afterAgentThought`) apply to Cmd+K and Agent Chat operations. The Tab hooks (`beforeTabFileRead`, `afterTabFileEdit`) apply specifically to inline Tab completions.

### Global Configuration Options

OptionTypeDefaultDescription`version`number`1`Config schema version
### Per-Script Configuration Options

OptionTypeDefaultDescription`command`stringrequiredScript path or command`type``"command"` | `"prompt"``"command"`Hook execution type`timeout`numberplatform defaultExecution timeout in seconds`loop_limit`number | null`5`Per-script loop limit for stop/subagentStop hooks. `null` means no limit. Default is `5` for Cursor hooks, `null` for Claude Code hooks.`matcher`object-Filter criteria for when hook runs
### Matcher Configuration

Matchers let you filter when a hook runs. Which field the matcher applies to depends on the hook:

```
{
  "hooks": {
    "preToolUse": [
      {
        "command": "./validate-shell.sh",
        "matcher": "Shell"
      }
    ],
    "subagentStart": [
      {
        "command": "./validate-explore.sh",
        "matcher": "explore|shell"
      }
    ],
    "beforeShellExecution": [
      {
        "command": "./approve-network.sh",
        "matcher": "curl|wget|nc "
      }
    ]
  }
}
```

- **subagentStart**: The matcher runs against the **subagent type** (e.g. `explore`, `shell`, `generalPurpose`). Use it to run hooks only when a specific kind of subagent is started. The example above runs `validate-explore.sh` only for explore or shell subagents.
- **beforeShellExecution**: The matcher runs against the **shell command** string. Use it to run hooks only when the command matches a pattern (e.g. network calls, file deletions). The example above runs `approve-network.sh` only when the command contains `curl`, `wget`, or `nc `.

**Available matchers by hook:**

- **preToolUse** (and other tool hooks): Filter by tool type — `Shell`, `Read`, `Write`, `Grep`, `LS`, `Delete`, `MCP`, `Task`, etc.
- **subagentStart**: Filter by subagent type — `generalPurpose`, `explore`, `shell`, etc.
- **beforeShellExecution**: Filter by the shell command text; the matcher is matched against the full command string.

## Team Distribution

Hooks can be distributed to team members using project hooks (via version control), MDM tools, or Cursor's cloud distribution system.

### Project Hooks (Version Control)

Project hooks are the simplest way to share hooks with your team. Place a `hooks.json` file at `<project-root>/.cursor/hooks.json` and commit it to your repository. When team members open the project in a trusted workspace, Cursor automatically loads and runs the project hooks.

Project hooks:

- Are stored in version control alongside your code
- Automatically load for all team members in trusted workspaces
- Can be project-specific (e.g., enforce formatting standards for a particular codebase)
- Require the workspace to be trusted to run (for security)

### MDM Distribution

Distribute hooks across your organization using Mobile Device Management (MDM) tools. Place the `hooks.json` file and hook scripts in the target directories on each machine.

**User home directory** (per-user distribution):

- `~/.cursor/hooks.json`
- `~/.cursor/hooks/` (for hook scripts)

**Global directories** (system-wide distribution):

- macOS: `/Library/Application Support/Cursor/hooks.json`
- Linux/WSL: `/etc/cursor/hooks.json`
- Windows: `C:\\ProgramData\\Cursor\\hooks.json`

Note: MDM-based distribution is fully managed by your organization. Cursor does not deploy or manage files through your MDM solution. Ensure your internal IT or security team handles configuration, deployment, and updates in accordance with your organization's policies.

### Cloud Distribution (Enterprise Only)

Enterprise teams can use Cursor's native cloud distribution to automatically sync hooks to all team members. Configure hooks in the [web dashboard](https://cursor.com/dashboard?tab=team-content&section=hooks). Cursor automatically delivers configured hooks to all client machines when team members log in.

Cloud distribution provides:

- Automatic synchronization to all team members (every thirty minutes)
- Operating system targeting for platform-specific hooks
- Centralized management through the dashboard

Enterprise administrators can create, edit, and manage team hooks from the dashboard without requiring access to individual machines.

## Reference

### Common schema

#### Input (all hooks)

All hooks receive a base set of fields in addition to their hook-specific fields:

```
{
  "conversation_id": "string",
  "generation_id": "string",
  "model": "string",
  "hook_event_name": "string",
  "cursor_version": "string",
  "workspace_roots": ["<path>"],
  "user_email": "string | null",
  "transcript_path": "string | null"
}
```

FieldTypeDescription`conversation_id`stringStable ID of the conversation across many turns`generation_id`stringThe current generation that changes with every user message`model`stringThe model configured for the composer that triggered the hook`hook_event_name`stringWhich hook is being run`cursor_version`stringCursor application version (e.g. "1.7.2")`workspace_roots`string[]The list of root folders in the workspace (normally just one, but multiroot workspaces can have multiple)`user_email`string | nullEmail address of the authenticated user, if available`transcript_path`string | nullPath to the main conversation transcript file (null if transcripts disabled)
### Hook events

#### preToolUse

Called before any tool execution. This is a generic hook that fires for all tool types (Shell, Read, Write, MCP, Task, etc.). Use matchers to filter by specific tools.

```
// Input
{
  "tool_name": "Shell",
  "tool_input": { "command": "npm install", "working_directory": "/project" },
  "tool_use_id": "abc123",
  "cwd": "/project",
  "model": "claude-sonnet-4-20250514",
  "agent_message": "Installing dependencies..."
}

// Output
{
  "decision": "allow" | "deny",
  "reason": "<reason shown to agent if denied>",
  "updated_input": { "command": "npm ci" }
}
```

Output FieldTypeDescription`decision`string`"allow"` to proceed, `"deny"` to block`reason`string (optional)Explanation shown to agent when denied`updated_input`object (optional)Modified tool input to use instead
#### postToolUse

Called after successful tool execution. Useful for auditing and analytics.

```
// Input
{
  "tool_name": "Shell",
  "tool_input": { "command": "npm test" },
  "tool_output": "All tests passed",
  "tool_use_id": "abc123",
  "cwd": "/project",
  "duration": 5432,
  "model": "claude-sonnet-4-20250514"
}

// Output
{
  "updated_mcp_tool_output": { "modified": "output" }
}
```

Input FieldTypeDescription`duration`numberExecution time in milliseconds`tool_output`stringFull output from the tool
Output FieldTypeDescription`updated_mcp_tool_output`object (optional)For MCP tools only: replaces the tool output seen by the model
#### postToolUseFailure

Called when a tool fails, times out, or is denied. Useful for error tracking and recovery logic.

```
// Input
{
  "tool_name": "Shell",
  "tool_input": { "command": "npm test" },
  "tool_use_id": "abc123",
  "cwd": "/project",
  "error_message": "Command timed out after 30s",
  "failure_type": "timeout" | "error" | "permission_denied",
  "duration": 5000,
  "is_interrupt": false
}

// Output
{
  // No output fields currently supported
}
```

Input FieldTypeDescription`error_message`stringDescription of the failure`failure_type`stringType of failure: `"error"`, `"timeout"`, or `"permission_denied"``duration`numberTime in milliseconds until the failure occurred`is_interrupt`booleanWhether this failure was caused by a user interrupt/cancellation
#### subagentStart

Called before spawning a subagent (Task tool). Can allow or deny subagent creation.

```
// Input
{
  "subagent_type": "generalPurpose",
  "prompt": "Explore the authentication flow",
  "model": "claude-sonnet-4-20250514"
}

// Output
{
  "decision": "allow" | "deny",
  "reason": "<reason if denied>"
}
```

#### subagentStop

Called when a subagent completes or errors. Can trigger follow-up actions.

```
// Input
{
  "subagent_type": "generalPurpose",
  "status": "completed" | "error",
  "result": "<subagent output>",
  "duration": 45000,
  "agent_transcript_path": "/path/to/subagent/transcript.txt"
}

// Output
{
  "followup_message": "<auto-continue with this message>"
}
```

Input FieldTypeDescription`subagent_type`stringType of subagent: `generalPurpose`, `explore`, `shell`, etc.`status`string`"completed"` or `"error"``result`stringOutput/result from the subagent`duration`numberExecution time in milliseconds`agent_transcript_path`string | nullPath to the subagent's own transcript file (separate from the parent conversation)
The `followup_message` field enables loop-style flows where subagent completion triggers the next iteration.

#### beforeShellExecution / beforeMCPExecution

Called before any shell command or MCP tool is executed. Return a permission decision.

`beforeMCPExecution` uses **fail-closed** behavior. If the hook script fails to execute (crashes, times out, or returns invalid JSON), the MCP tool call will be blocked. This ensures MCP operations cannot bypass configured hooks.

```
// beforeShellExecution input
{
  "command": "<full terminal command>",
  "cwd": "<current working directory>",
  "timeout": 30
}

// beforeMCPExecution input
{
  "tool_name": "<tool name>",
  "tool_input": "<json params>"
}
// Plus either:
{ "url": "<server url>" }
// Or:
{ "command": "<command string>" }

// Output
{
  "permission": "allow" | "deny" | "ask",
  "user_message": "<message shown in client>",
  "agent_message": "<message sent to agent>"
}
```

#### afterShellExecution

Fires after a shell command executes; useful for auditing or collecting metrics from command output.

```
// Input
{
  "command": "<full terminal command>",
  "output": "<full terminal output>",
  "duration": 1234
}
```

FieldTypeDescription`command`stringThe full terminal command that was executed`output`stringFull output captured from the terminal`duration`numberDuration in milliseconds spent executing the shell command (excludes approval wait time)
#### afterMCPExecution

Fires after an MCP tool executes; includes the tool's input parameters and full JSON result.

```
// Input
{
  "tool_name": "<tool name>",
  "tool_input": "<json params>",
  "result_json": "<tool result json>",
  "duration": 1234
}
```

FieldTypeDescription`tool_name`stringName of the MCP tool that was executed`tool_input`stringJSON params string passed to the tool`result_json`stringJSON string of the tool response`duration`numberDuration in milliseconds spent executing the MCP tool (excludes approval wait time)
#### afterFileEdit

Fires after the Agent edits a file; useful for formatters or accounting of agent-written code.

```
// Input
{
  "file_path": "<absolute path>",
  "edits": [{ "old_string": "<search>", "new_string": "<replace>" }]
}
```

#### beforeReadFile

Called before Agent reads a file. Use for access control to block sensitive files from being sent to the model.

This hook uses **fail-closed** behavior. If the hook script fails to execute (crashes, times out, or returns invalid JSON), the file read will be blocked. This provides security guarantees for sensitive file access.

```
// Input
{
  "file_path": "<absolute path>",
  "content": "<file contents>",
  "attachments": [
    {
      "type": "file" | "rule",
      "filePath": "<absolute path>"
    }
  ]
}

// Output
{
  "permission": "allow" | "deny",
  "user_message": "<message shown when denied>"
}
```

Input FieldTypeDescription`file_path`stringAbsolute path to the file being read`content`stringFull contents of the file`attachments`arrayContext attachments associated with the prompt
Output FieldTypeDescription`permission`string`"allow"` to proceed, `"deny"` to block`user_message`string (optional)Message shown to user when denied
#### beforeTabFileRead

Called before Tab (inline completions) reads a file. Enable redaction or access control before Tab accesses file contents.

**Key differences from `beforeReadFile`:**

- Only triggered by Tab, not Agent
- Does not include `attachments` field (Tab doesn't use prompt attachments)
- Useful for applying different policies to autonomous Tab operations

```
// Input
{
  "file_path": "<absolute path>",
  "content": "<file contents>"
}

// Output
{
  "permission": "allow" | "deny"
}
```

#### afterTabFileEdit

Called after Tab (inline completions) edits a file. Useful for formatters or auditing of Tab-written code.

**Key differences from `afterFileEdit`:**

- Only triggered by Tab, not Agent
- Includes detailed edit information: `range`, `old_line`, and `new_line` for precise edit tracking
- Useful for fine-grained formatting or analysis of Tab edits

```
// Input
{
  "file_path": "<absolute path>",
  "edits": [
    {
      "old_string": "<search>",
      "new_string": "<replace>",
      "range": {
        "start_line_number": 10,
        "start_column": 5,
        "end_line_number": 10,
        "end_column": 20
      },
      "old_line": "<line before edit>",
      "new_line": "<line after edit>"
    }
  ]
}

// Output
{
  // No output fields currently supported
}
```

#### beforeSubmitPrompt

Called right after user hits send but before backend request. Can prevent submission.

```
// Input
{
  "prompt": "<user prompt text>",
  "attachments": [
    {
      "type": "file" | "rule",
      "filePath": "<absolute path>"
    }
  ]
}

// Output
{
  "continue": true | false,
  "user_message": "<message shown to user when blocked>"
}
```

Output FieldTypeDescription`continue`booleanWhether to allow the prompt submission to proceed`user_message`string (optional)Message shown to the user when the prompt is blocked
#### afterAgentResponse

Called after the agent has completed an assistant message.

```
// Input
{
  "text": "<assistant final text>"
}
```

#### afterAgentThought

Called after the agent completes a thinking block. Useful for observing the agent's reasoning process.

```
// Input
{
  "text": "<fully aggregated thinking text>",
  "duration_ms": 5000
}

// Output
{
  // No output fields currently supported
}
```

FieldTypeDescription`text`stringFully aggregated thinking text for the completed block`duration_ms`number (optional)Duration in milliseconds for the thinking block
#### stop

Called when the agent loop ends. Can optionally auto-submit a follow-up user message to keep iterating.

```
// Input
{
  "status": "completed" | "aborted" | "error",
  "loop_count": 0
}
```

```
// Output
{
  "followup_message": "<message text>"
}
```

- The optional `followup_message` is a string. When provided and non-empty, Cursor will automatically submit it as the next user message. This enables loop-style flows (e.g., iterate until a goal is met).
- The `loop_count` field indicates how many times the stop hook has already triggered an automatic follow-up for this conversation (starts at 0). To prevent infinite loops, a maximum of 5 auto follow-ups is enforced.

#### sessionStart

Called when a new composer conversation is created. Use this hook to set up session-specific environment variables, inject additional context, or block session creation based on custom policies.

```
// Input
{
  "session_id": "<unique session identifier>",
  "is_background_agent": true | false,
  "composer_mode": "agent" | "ask" | "edit"
}
```

```
// Output
{
  "env": { "<key>": "<value>" },
  "additional_context": "<context to add to conversation>",
  "continue": true | false,
  "user_message": "<message shown if blocked>"
}
```

Input FieldTypeDescription`session_id`stringUnique identifier for this session (same as `conversation_id`)`is_background_agent`booleanWhether this is a background agent session vs interactive session`composer_mode`string (optional)The mode the composer is starting in (e.g., "agent", "ask", "edit")
Output FieldTypeDescription`env`object (optional)Environment variables to set for this session. Available to all subsequent hook executions`additional_context`string (optional)Additional context to add to the conversation's initial system context`continue`boolean (optional)Whether to continue with session creation. If false, the session will not be created. Default: true`user_message`string (optional)Message to show to the user if `continue` is false
#### sessionEnd

Called when a composer conversation ends. This is a fire-and-forget hook useful for logging, analytics, or cleanup tasks. The response is logged but not used.

```
// Input
{
  "session_id": "<unique session identifier>",
  "reason": "completed" | "aborted" | "error" | "window_close" | "user_close",
  "duration_ms": 45000,
  "is_background_agent": true | false,
  "final_status": "<status string>",
  "error_message": "<error details if reason is 'error'>"
}
```

```
// Output
{
  // No output fields - fire and forget
}
```

Input FieldTypeDescription`session_id`stringUnique identifier for the session that is ending`reason`stringHow the session ended: "completed", "aborted", "error", "window_close", or "user_close"`duration_ms`numberTotal duration of the session in milliseconds`is_background_agent`booleanWhether this was a background agent session`final_status`stringFinal status of the session`error_message`string (optional)Error message if reason is "error"
#### preCompact

Called before context window compaction/summarization occurs. This is an observational hook that cannot block or modify the compaction behavior. Useful for logging when compaction happens or notifying users.

```
// Input
{
  "trigger": "auto" | "manual",
  "context_usage_percent": 85,
  "context_tokens": 120000,
  "context_window_size": 128000,
  "message_count": 45,
  "messages_to_compact": 30,
  "is_first_compaction": true | false
}
```

```
// Output
{
  "user_message": "<message to show when compaction occurs>"
}
```

Input FieldTypeDescription`trigger`stringWhat triggered the compaction: "auto" or "manual"`context_usage_percent`numberCurrent context window usage as a percentage (0-100)`context_tokens`numberCurrent context window token count`context_window_size`numberMaximum context window size in tokens`message_count`numberNumber of messages in the conversation`messages_to_compact`numberNumber of messages that will be summarized`is_first_compaction`booleanWhether this is the first compaction for this conversation
Output FieldTypeDescription`user_message`string (optional)Message to show to the user when compaction occurs
## Environment Variables

Hook scripts receive environment variables when executed:

VariableDescriptionAlways Present`CURSOR_PROJECT_DIR`Workspace root directoryYes`CURSOR_VERSION`Cursor version stringYes`CURSOR_USER_EMAIL`Authenticated user emailIf logged in`CURSOR_CODE_REMOTE`Remote-aware project pathFor remote workspaces`CLAUDE_PROJECT_DIR`Alias for project dir (Claude compatibility)Yes
Session-scoped environment variables from `sessionStart` hooks are passed to all subsequent hook executions within that session.

## Troubleshooting

**How to confirm hooks are active**

There is a Hooks tab in Cursor Settings to debug configured and executed hooks, as well as a Hooks output channel to see errors.

**If hooks are not working**

- Restart Cursor to ensure the hooks service is running.
- Check that relative paths are correct for your hook source:
- For **project hooks**, paths are relative to the **project root** (e.g., `.cursor/hooks/script.sh`)
- For **user hooks**, paths are relative to `~/.cursor/` (e.g., `./hooks/script.sh` or `hooks/script.sh`)

**Exit code blocking**

Exit code `2` from command hooks blocks the action (equivalent to returning `decision: "deny"`). This matches Claude Code behavior for compatibility.