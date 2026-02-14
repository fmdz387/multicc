import { spawn } from "node:child_process";
import { loadConfig, resolveProfileName } from "../config.js";
import { buildProfileEnv } from "../auth.js";
import { error, info } from "../display.js";

export async function handleLaunch(
  name?: string,
  passthrough?: string[]
): Promise<void> {
  const config = loadConfig();
  let profileName = resolveProfileName(config, name);
  const args = passthrough ? [...passthrough] : [];

  // If the resolved name isn't a valid profile, it was likely captured from
  // args after `--` by Commander. It's already in args via process.argv
  // slicing, so just fall back to active profile.
  if (name && !config.profiles[profileName]) {
    profileName = resolveProfileName(config);
  }

  const profile = config.profiles[profileName];

  if (!profile) {
    error(`Profile "${profileName}" not found. Run "multicc profile list" to see available profiles.`);
    process.exit(1);
  }

  const profileEnv = await buildProfileEnv(profile, profileName);

  info(`Launching claude with profile: ${profileName}`);

  const child = spawn("claude", args, {
    stdio: "inherit",
    env: { ...process.env, ...profileEnv },
    shell: true,
  });

  child.on("error", (err) => {
    error(`Failed to launch claude: ${err.message}`);
    process.exit(1);
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}
