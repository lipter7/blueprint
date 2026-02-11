# Installation

## Installation

### macOS, Linux and Windows (WSL)

Install Cursor CLI with a single command:

```
curl https://cursor.com/install -fsS | bash
```

### Windows (native)

Install Cursor CLI on Windows using PowerShell:

```
irm 'https://cursor.com/install?win32=true' | iex
```

### Verification

After installation, verify that Cursor CLI is working correctly:

```
agent --version
```

## Post-installation setup

1. **Add ~/.local/bin to your PATH:**

For bash:

```
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

For zsh:

```
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```
2. **Start using Cursor Agent:**

```
agent
```

## Updates

Cursor CLI will try to auto-update by default to ensure you always have the latest version.

To manually update Cursor CLI to the latest version:

```
agent update
# or
agent upgrade
```

Both commands will update Cursor Agent to the latest version.