import os from "node:os";
import path from "node:path";

export function getMulticcDir(): string {
  const envDir = process.env["MULTICC_DIR"];
  if (envDir) {
    return envDir;
  }
  return path.join(os.homedir(), ".multicc");
}

export function getConfigPath(): string {
  return path.join(getMulticcDir(), "config.json");
}

export function getProfilesDir(): string {
  return path.join(getMulticcDir(), "profiles");
}

export function getProfileDir(name: string): string {
  return path.join(getMulticcDir(), "profiles", name);
}

export function getClaudeDefaultDir(): string {
  return path.join(os.homedir(), ".claude");
}
