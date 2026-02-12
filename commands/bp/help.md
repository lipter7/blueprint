---
name: bp:help
description: Show available Blueprint commands and usage guide
---
<objective>
Display the complete Blueprint command reference.

Output ONLY the reference content below. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<execution_context>
@~/.claude/blueprint/workflows/help.md
</execution_context>

<process>
Output the complete Blueprint command reference from @~/.claude/blueprint/workflows/help.md.
Display the reference content directly — no additions or modifications.
</process>
