# Terminal

Agent runs shell commands directly in your terminal, with safe sandbox execution on macOS and Linux. Command history persists across sessions. Click skip to interrupt running commands with `Ctrl+C`.

## Sandbox

Sandbox is available on macOS (>v2.0) and Linux (>v2.3.0-pre). Windows users can use WSL or devcontainers for sandboxed command execution.

Auto mode is not currently compatible with Sandbox.

By default, Agent runs terminal commands in a restricted environment that blocks unauthorized file access and network activity. Commands execute automatically while staying confined to your workspace.

- **macOS**: Implemented using `sandbox-exec` (seatbelt)
- **Linux**: Implemented using Landlock v3 (kernel 6.2+), seccomp, and user namespaces

### Linux Requirements

Linux sandbox requires:

- **Kernel 6.2 or later** with Landlock v3 support (`CONFIG_SECURITY_LANDLOCK=y`)
- **Unprivileged user namespaces** enabled (most modern distributions have this by default)

If your Linux kernel doesn't meet these requirements, Agent will fall back to asking for approval before running commands.

### How the sandbox works

The sandbox prevents unauthorized access while allowing workspace operations:

Access TypeDescription**File access**Read access to the filesystem
Read and write access to workspace directories**Network access**Blocked by default (configurable in settings)**Temporary files**Full access to `/tmp/` or equivalent system temp directories
The `.cursor` configuration directory stays protected regardless of allowlist settings.

### Allowlist

Commands on the allowlist skip sandbox restrictions and run immediately. You can add commands to the allowlist by choosing "Add to allowlist" when prompted after a sandboxed command fails.

When a sandboxed command fails due to restrictions, you can:

OptionDescription**Skip**Cancel the command and let Agent try something else**Run**Execute the command without sandbox restrictions**Add to allowlist**Run without restrictions and automatically approve it for future use
## Editor Configuration

Configure how Agent runs terminal commands in the editor by navigating to Settings -> Cursor Settings -> Agents -> Auto-Run.

Editor SettingDescription**Auto-Run Mode**Choose how Agent runs tools like command execution, MCP, and file writes. Users can select from three options: 

• **Run in Sandbox**: Tools and commands will auto-run in sandbox where possible. Available on macOS and Linux. 
• **Ask Every Time**: All tools and commands require user approval before running. 
• **Run Everything**: The agent runs all tools and commands automatically without asking for user input.**Auto-Run Network Access**Choose whether commands that run in the sandbox have network access.**Allow Git Writes Without Approval**When enabled, git write operations (commit, push, etc.) run without approval in the sandbox. When disabled, they require approval. Note that git push and similar actions will require network access to run.**Command Allowlist**Commands that can run automatically outside of the sandbox.**MCP Allowlist**MCP tools that can run automatically outside of the sandbox.**Browser Protection**Prevent Agent from automatically running [Browser](https://cursor.com/docs/agent/browser) tools.**File-Deletion Protection**Prevent Agent from deleting files automatically.**Dotfile Protection**Prevent Agent from modifying dot files like .gitignore automatically.**External-File Protection**Prevent Agent from creating or modifying files outside of the workspace automatically.
## Enterprise Controls

Only available for Enterprise subscriptions.

Enterprise admins can override editor configurations or change which settings are visible for end users. Navigate to Settings -> Auto-Run in the [web dashboard](https://cursor.com/dashboard?tab=settings) to view and change these settings.

Admin SettingDescription**Auto-Run Controls**Enable controls for auto-run and sandbox mode. If disabled, the default behavior for all end users is that commands will auto-run in the sandbox when available, otherwise they will ask for permission to run.**Sandboxing Mode**Control whether sandbox is available for end users. When enabled, commands will run automatically in the sandbox even if they are not on the allowlist.**Sandbox Networking**Choose whether commands that run in the sandbox have network access.**Sandbox Git Access**When enabled, git write operations (commit, push, etc.) run without approval in the sandbox. When disabled, they require approval. Note that git push and similar actions will require network access to run.**Delete File Protection**Prevent Agent from deleting files automatically.**MCP Tool Protection**When enabled, prevents the agent from automatically running MCP tools.**Terminal Command Allowlist**Specify which terminal commands can run automatically without sandboxing. If empty, all commands require manual approval. When sandbox is enabled, commands not on this list will auto-run in sandbox mode.**Enable Run Everything**Give end users the ability to enable the `Run Everything` Auto-Run-Mode.
## Troubleshooting

Some shell themes (for example, Powerlevel9k/Powerlevel10k) can interfere with
the inline terminal output. If your command output looks truncated or
misformatted, disable the theme or switch to a simpler prompt when Agent runs.

### Disable heavy prompts for Agent sessions

Use the `CURSOR_AGENT` environment variable in your shell config to detect when
the Agent is running and skip initializing fancy prompts/themes.

```
# ~/.zshrc — disable Powerlevel10k when Cursor Agent runs
if [[ -n "$CURSOR_AGENT" ]]; then
  # Skip theme initialization for better compatibility
else
  [[ -r ~/.p10k.zsh ]] && source ~/.p10k.zsh
fi
```

```
# ~/.bashrc — fall back to a simple prompt in Agent sessions
if [[ -n "$CURSOR_AGENT" ]]; then
  PS1='\u@\h \W \$ '
fi
```