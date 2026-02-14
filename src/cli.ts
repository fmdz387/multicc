import { Command } from "commander";
import { loadConfig } from "./config.js";
import { info } from "./display.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("multicc")
    .description("Manage multiple Claude Code accounts")
    .version("0.1.0")
    .action(() => {
      const config = loadConfig();
      const active = config.activeProfile;
      const profile = config.profiles[active];
      if (profile) {
        info(`Active profile: ${active} (${profile.authType})`);
      } else {
        info('No profiles configured. Run "multicc profile create <name>" to get started.');
      }
    });

  // === Command Registration ===

  const profile = program.command("profile").description("Manage profiles");

  profile
    .command("create <name>")
    .description("Create a new profile")
    .option("--auth-type <type>", "Auth type (oauth, api-key, bedrock, vertex, foundry)")
    .option("--description <desc>", "Profile description")
    .action(async (name: string, opts: { authType?: string; description?: string }) => {
      const mod = await import("./commands/profile.js");
      await mod.handleCreate(name, opts);
    });

  profile
    .command("list")
    .description("List all profiles")
    .action(async () => {
      const mod = await import("./commands/profile.js");
      await mod.handleList();
    });

  profile
    .command("show [name]")
    .description("Show profile details")
    .action(async (name?: string) => {
      const mod = await import("./commands/profile.js");
      await mod.handleShow(name);
    });

  profile
    .command("switch <name>")
    .description("Switch active profile")
    .action(async (name: string) => {
      const mod = await import("./commands/profile.js");
      await mod.handleSwitch(name);
    });

  profile
    .command("delete <name>")
    .description("Delete a profile")
    .action(async (name: string) => {
      const mod = await import("./commands/profile.js");
      await mod.handleDelete(name);
    });

  profile
    .command("import")
    .description("Import existing Claude config into a profile")
    .option("--name <name>", "Profile name", "default")
    .option("--from <path>", "Source config directory")
    .option("--force", "Overwrite existing profile")
    .action(async (opts: { name: string; from?: string; force?: boolean }) => {
      const mod = await import("./commands/profile.js");
      await mod.handleImport(opts);
    });

  program
    .command("launch [name]")
    .description("Launch claude with a profile")
    .allowUnknownOption(true)
    .action(async (name?: string, _opts?: Record<string, unknown>, cmd?: Command) => {
      const mod = await import("./commands/launch.js");
      const passthrough = cmd?.args?.slice(name ? 1 : 0) ?? [];
      await mod.handleLaunch(name, passthrough);
    });

  program
    .command("exec [name]")
    .description("Run a command with profile environment")
    .allowUnknownOption(true)
    .action(async (name?: string, _opts?: Record<string, unknown>, cmd?: Command) => {
      const mod = await import("./commands/exec.js");
      const passthrough = cmd?.args?.slice(name ? 1 : 0) ?? [];
      await mod.handleExec(name, passthrough);
    });

  program
    .command("shell [name]")
    .description("Open a subshell with profile environment")
    .action(async (name?: string) => {
      const mod = await import("./commands/shell.js");
      await mod.handleShell(name);
    });

  program
    .command("shell-init")
    .description("Output shell integration code")
    .option("--shell <type>", "Shell type (bash, zsh, fish, powershell)")
    .action(async (opts: { shell?: string }) => {
      const mod = await import("./commands/shell-init.js");
      await mod.handleShellInit(opts);
    });

  program
    .command("_resolve-config-dir")
    .description("Resolve the config directory for the active profile (internal)")
    .action(async () => {
      const mod = await import("./commands/resolve.js");
      await mod.handleResolveConfigDir();
    });

  program
    .command("status")
    .description("Show status of all profiles")
    .action(async () => {
      const mod = await import("./commands/status.js");
      await mod.handleStatus();
    });

  program
    .command("login [name]")
    .description("Log in to Claude with a profile")
    .action(async (name?: string) => {
      const mod = await import("./commands/login.js");
      await mod.handleLogin(name);
    });

  program
    .command("set-key [name]")
    .description("Store an API key for a profile")
    .option("--from-env <var>", "Read key from environment variable")
    .action(async (name?: string, opts?: { fromEnv?: string }) => {
      const mod = await import("./commands/set-key.js");
      await mod.handleSetKey(name, opts ?? {});
    });

  return program;
}
