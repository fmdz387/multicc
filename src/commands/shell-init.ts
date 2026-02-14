import path from "node:path";

type ShellType = "bash" | "zsh" | "fish" | "powershell";

function detectShell(): ShellType {
  const shellEnv = process.env["SHELL"];
  if (shellEnv) {
    const base = path.basename(shellEnv);
    if (base === "zsh") return "zsh";
    if (base === "fish") return "fish";
    if (base === "bash") return "bash";
  }
  if (process.platform === "win32") {
    return "powershell";
  }
  return "bash";
}

function isValidShellType(value: string): value is ShellType {
  return value === "bash" || value === "zsh" || value === "fish" || value === "powershell";
}

function generateBash(): string {
  return `# Add to your shell profile: eval "$(multicc shell-init)"
# multicc shell integration (bash/zsh)

claude() {
  local config_dir
  config_dir=$(multicc _resolve-config-dir 2>/dev/null)
  if [ -n "$config_dir" ]; then
    CLAUDE_CONFIG_DIR="$config_dir" command claude "$@"
  else
    command claude "$@"
  fi
}

export MULTICC_PROFILE="\${MULTICC_PROFILE:-}"
`;
}

function generateFish(): string {
  return `# Add to your shell profile: multicc shell-init | source
# multicc shell integration (fish)

function claude
  set -l config_dir (multicc _resolve-config-dir 2>/dev/null)
  if test -n "$config_dir"
    set -x CLAUDE_CONFIG_DIR $config_dir
    command claude $argv
    set -e CLAUDE_CONFIG_DIR
  else
    command claude $argv
  end
end
`;
}

function generatePowershell(): string {
  return `# Add to your PowerShell profile: multicc shell-init --shell powershell | Invoke-Expression
# multicc shell integration (powershell)

function claude {
  $configDir = & multicc _resolve-config-dir 2>$null
  if ($configDir) {
    $env:CLAUDE_CONFIG_DIR = $configDir
    & (Get-Command claude -CommandType Application).Source @args
    Remove-Item Env:\\CLAUDE_CONFIG_DIR
  } else {
    & (Get-Command claude -CommandType Application).Source @args
  }
}
`;
}

export async function handleShellInit(
  opts: { shell?: string }
): Promise<void> {
  let shellType: ShellType;

  if (opts.shell) {
    if (!isValidShellType(opts.shell)) {
      process.stderr.write(
        `Unknown shell type "${opts.shell}". Supported: bash, zsh, fish, powershell\n`
      );
      process.exit(1);
    }
    shellType = opts.shell;
  } else {
    shellType = detectShell();
  }

  let output: string;
  switch (shellType) {
    case "bash":
    case "zsh":
      output = generateBash();
      break;
    case "fish":
      output = generateFish();
      break;
    case "powershell":
      output = generatePowershell();
      break;
  }

  process.stdout.write(output);
}
