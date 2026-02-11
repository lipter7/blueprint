# Cursor Agent

Agent is Cursor's assistant that can complete complex coding tasks independently, run terminal commands, and edit code. Access in sidepane with Cmd+ICtrl+I.

Learn more about [how agents work](/learn/agents) and help your build faster.

## How Agent works

An agent is built on three components:

1. **Instructions**: The system prompt and [rules](/docs/context/rules) that guide agent behavior
2. **Tools**: File editing, codebase search, terminal execution, and more
3. **User messages**: Your prompts and follow-ups that direct the work

Cursor's agent orchestrates these components for each model we support, tuning instructions and tools specifically for every frontier model. As new models are released, you can focus on building software while Cursor handles the model-specific optimizations.

## Tools

Tools are the building blocks of Agent. They are used to search your codebase and the web to find relevant information, make edits to your files, run terminal commands, and more.

To understand how tool calling works under the hood, see our [tool calling fundamentals](/learn/tool-calling).

There is no limit on the number of tool calls Agent can make during a task.

### Semantic search

### Search files and folders

### Web

### Fetch Rules

### Read files

### Edit files

### Run shell commands

### browserBrowser

### Image generation

### message-questionAsk questions

Ask clarifying questions during a task. While waiting for your response, the agent continues reading files, making edits, or running commands. Your answer is incorporated as soon as it arrives.

## Message summarization

As conversations grow longer, Cursor automatically summarizes and manages context to keep your chats efficient. Learn how to use the context menu and understand how files are condensed to fit within model context windows.

### Using the /summarize command

You can manually trigger summarization using the `/summarize` command in chat. This command helps manage context when conversations become too long, allowing you to continue working efficiently without losing important information.

New to Cursor? Learn more about [Context](/learn/context).

## Checkpoints

Checkpoints are automatic snapshots of Agent's changes to your codebase, letting you undo modifications if needed. Restore from the `Restore Checkpoint` button on previous requests or the + button when hovering over a message.

Checkpoints are stored locally and separate from Git. Only use them for undoing Agent changes—use Git for permanent version control.

## Export & Share

Export Agent chats as markdown files via the context menu → "Export Chat", or share them as read-only links. Shared chats let recipients view and fork the conversation to continue in their own Cursor.

Sharing requires a paid plan. Common secrets are auto-redacted and sharing is disabled in Privacy Mode.

## Queued messages

Queue follow-up messages while Agent is working on the current task. Your instructions wait in line and execute automatically when ready.

### Using the queue

1. While Agent is working, type your next instruction
2. Press Enter to add it to the queue
3. Messages appear in order below the active task
4. Drag to reorder queued messages as needed
5. Agent processes them sequentially after finishing

### Keyboard shortcuts

While Agent is working:

- Press Enter to queue your message (it waits until Agent finishes the current task)
- Press Cmd+EnterCtrl+Enter to send immediately, bypassing the queue

### Immediate messaging

When you use Cmd+EnterCtrl+Enter to send immediately, your message is appended to the most recent user message in the chat and processed right away without waiting in the queue.

- Your message attaches to tool results and sends immediately
- This creates a more responsive experience for urgent follow-ups
- Use this when you need to interrupt or redirect Agent's current work