import { spawn } from "node:child_process";
import { loadConfig, resolveProfileName } from "../config.js";
import { buildProfileEnv, getCredentialStatus } from "../auth.js";
import { error, info, success } from "../display.js";

export async function handleLogin(name?: string): Promise<void> {
  const config = loadConfig();
  const profileName = resolveProfileName(config, name);
  const profile = config.profiles[profileName];

  if (!profile) {
    error(`Profile "${profileName}" not found. Run "multicc profile list" to see available profiles.`);
    process.exit(1);
  }

  if (profile.authType !== "oauth") {
    error(`Profile "${profileName}" uses auth type "${profile.authType}". Login is only for OAuth profiles. Use "multicc set-key" for API key profiles.`);
    process.exit(1);
  }

  const profileEnv = await buildProfileEnv(profile, profileName);

  info(`Starting OAuth login for profile: ${profileName}`);
  info("Follow the prompts in the claude CLI to complete authentication.");

  const child = spawn("claude", ["auth", "login"], {
    stdio: "inherit",
    env: { ...process.env, ...profileEnv },
    shell: true,
  });

  await new Promise<void>((resolve, reject) => {
    child.on("error", (err) => {
      reject(err);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Login process exited with code ${code}`));
      } else {
        resolve();
      }
    });
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    error(`Login failed: ${message}`);
    process.exit(1);
  });

  const status = await getCredentialStatus(profile);
  if (status.authenticated) {
    success(`Login successful for profile: ${profileName}`);
  } else {
    error(`Login did not complete. Credentials not found for profile: ${profileName}`);
    process.exit(1);
  }
}
