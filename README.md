# multicc

[![npm version](https://img.shields.io/npm/v/multicc.svg)](https://www.npmjs.com/package/multicc)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/multicc.svg)](https://nodejs.org)

Fast, cross-platform multi-account manager for Claude Code. Maintains isolated config directories per profile and sets `CLAUDE_CONFIG_DIR` before launching Claude.

<p align="center">
  <img src="assets/multicc.png" alt="multicc" width="700">
</p>

## Features

- **Named Profiles** - Create and switch between multiple Claude Code accounts
- **Auth Flexibility** - Supports OAuth, API key, Bedrock, Vertex and Foundry
- **Secure Storage** - API keys stored in OS keyring with plaintext fallback
- **Shell Integration** - Works with bash, zsh, fish and PowerShell
- **Cross-Platform** - Works on Windows, macOS and Linux

## Installation

```bash
npm install -g multicc
```

### Requirements

- **Node.js 18+**
- **Build tools** for native keyring module (optional):
  - **Windows**: Visual C++ Build Tools
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `build-essential` and `libsecret-1-dev`

## Quick Start

```bash
# Create a profile
multicc create work --auth-type oauth

# Launch Claude Code (authenticates on first run)
multicc launch work
```

## Usage

### Profile Management

```bash
multicc create <name>          # Create a new profile
multicc list                   # List all profiles
multicc use <name>             # Switch active profile
multicc profile show [name]    # Show profile details
multicc profile delete <name>  # Delete a profile
multicc profile import         # Import existing Claude config
```

### Session Commands

```bash
multicc launch [name]          # Launch Claude Code with a profile
multicc set-key [name]         # Store an API key
multicc status                 # Show status of all profiles
```

### Advanced

```bash
multicc exec [name] -- <cmd>   # Run a command with profile environment
multicc shell [name]           # Open a subshell with profile environment
multicc shell-init             # Output shell integration code
```

### Shell Integration

Add to your shell profile for automatic profile activation:

```bash
eval "$(multicc shell-init)"
```

## Data Layout

```
~/.multicc/
  config.json              # Profile registry and active profile
  profiles/
    <name>/                # Each profile becomes a CLAUDE_CONFIG_DIR
      .credentials.json    # OAuth tokens
      .api-key             # Plaintext API key fallback
      settings.json        # Claude Code settings
```

## Development

```bash
# Clone the repository
git clone https://github.com/fmdz387/multicc.git
cd multicc

# Install dependencies
pnpm install

# Build
pnpm build

# Run from source
pnpm dev

# Type checking
pnpm typecheck

# Link globally for testing
pnpm link:global

# Unlink when done
pnpm unlink:global
```

## License

[MIT](LICENSE) - Copyright (c) 2025 fmdz387
