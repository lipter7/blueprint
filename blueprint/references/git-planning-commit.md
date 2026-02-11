# Git Planning Commit

Commit planning artifacts using the blueprint-tools CLI, which automatically checks `commit_docs` config and gitignore status.

## Commit via CLI

Always use `blueprint-tools.js commit` for `.blueprint/` files — it handles `commit_docs` and gitignore checks automatically:

```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "docs({scope}): {description}" --files .blueprint/STATE.md .blueprint/ROADMAP.md
```

The CLI will return `skipped` (with reason) if `commit_docs` is `false` or `.blueprint/` is gitignored. No manual conditional checks needed.

## Amend previous commit

To fold `.blueprint/` file changes into the previous commit:

```bash
node ~/.claude/blueprint/bin/blueprint-tools.js commit "" --files .blueprint/codebase/*.md --amend
```

## Commit Message Patterns

| Command | Scope | Example |
|---------|-------|---------|
| plan-phase | phase | `docs(phase-03): create authentication plans` |
| execute-phase | phase | `docs(phase-03): complete authentication phase` |
| new-milestone | milestone | `docs: start milestone v1.1` |
| remove-phase | chore | `chore: remove phase 17 (dashboard)` |
| insert-phase | phase | `docs: insert phase 16.1 (critical fix)` |
| add-phase | phase | `docs: add phase 07 (settings page)` |

## When to Skip

- `commit_docs: false` in config
- `.blueprint/` is gitignored
- No changes to commit (check with `git status --porcelain .blueprint/`)
