import { spawn } from "node:child_process";
import { loadConfig, resolveProfileName } from "../config.js";
import { buildProfileEnv } from "../auth.js";
import { error } from "../display.js";

export async function handleExec(
  name?: string,
  passthrough?: string[]
): Promise<void> {
  const config = loadConfig();
  const profileName = resolveProfileName(config, name);
  const profile = config.profiles[profileName];

  if (!profile) {
    error(`Profile "${profileName}" not found. Run "multicc profile list" to see available profiles.`);
    process.exit(1);
  }

  if (!passthrough || passthrough.length === 0) {
    error("No command specified. Usage: multicc exec [name] -- <command...>");
    process.exit(1);
  }

  const profileEnv = await buildProfileEnv(profile, profileName);
  const [cmd, ...args] = passthrough;

  const child = spawn(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...profileEnv },
    shell: true,
  });

  child.on("error", (err) => {
    error(`Failed to execute command: ${err.message}`);
    process.exit(1);
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}
