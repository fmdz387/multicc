import fs from "node:fs";
import type { AuthType } from "../types.js";
import { loadConfig, saveConfig } from "../config.js";
import { getProfileDir } from "../paths.js";
import { success, error, info } from "../display.js";

const VALID_AUTH_TYPES = new Set<string>([
  "oauth",
  "api-key",
  "bedrock",
  "vertex",
  "foundry",
]);

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;
const MAX_NAME_LENGTH = 32;

function validateProfileName(name: string): string | null {
  if (name.length === 0) {
    return "Profile name cannot be empty.";
  }
  if (name.length > MAX_NAME_LENGTH) {
    return `Profile name must be ${MAX_NAME_LENGTH} characters or less.`;
  }
  if (!NAME_PATTERN.test(name)) {
    return "Profile name must be alphanumeric with hyphens only (no spaces or special characters). Must start with a letter or number.";
  }
  return null;
}

function isValidAuthType(value: string): value is AuthType {
  return VALID_AUTH_TYPES.has(value);
}

async function promptAuthType(): Promise<AuthType> {
  try {
    const { select } = await import("@inquirer/prompts");
    const authType = await select<AuthType>({
      message: "Select authentication type:",
      choices: [
        { value: "oauth" as const, name: "OAuth (claude.ai account)" },
        { value: "api-key" as const, name: "API Key (Anthropic API)" },
        { value: "bedrock" as const, name: "AWS Bedrock" },
        { value: "vertex" as const, name: "Google Vertex AI" },
        { value: "foundry" as const, name: "Foundry" },
      ],
    });
    return authType;
  } catch {
    return "oauth";
  }
}

async function promptDescription(): Promise<string | undefined> {
  try {
    const { input } = await import("@inquirer/prompts");
    const desc = await input({
      message: "Profile description (optional):",
    });
    return desc || undefined;
  } catch {
    return undefined;
  }
}

export async function handleCreate(
  name: string,
  opts: { authType?: string; description?: string }
): Promise<void> {
  const nameError = validateProfileName(name);
  if (nameError) {
    error(nameError);
    process.exit(1);
  }

  const config = loadConfig();

  if (config.profiles[name]) {
    error(`Profile "${name}" already exists.`);
    process.exit(1);
  }

  let authType: AuthType;
  if (opts.authType) {
    if (!isValidAuthType(opts.authType)) {
      error(
        `Invalid auth type "${opts.authType}". Must be one of: oauth, api-key, bedrock, vertex, foundry.`
      );
      process.exit(1);
    }
    authType = opts.authType;
  } else {
    authType = await promptAuthType();
  }

  const description = opts.description ?? (await promptDescription());

  const profileDir = getProfileDir(name);
  fs.mkdirSync(profileDir, { recursive: true });

  config.profiles[name] = {
    authType,
    configDir: profileDir,
    description,
    createdAt: new Date().toISOString(),
  };

  const isFirstProfile = Object.keys(config.profiles).length === 1;
  if (isFirstProfile) {
    config.activeProfile = name;
  }

  saveConfig(config);

  success(`Profile "${name}" created.`);
  info(`Config directory: ${profileDir}`);

  if (isFirstProfile) {
    info(`Set as active profile.`);
  }

  if (authType === "oauth") {
    info(`Run "multicc login ${name}" to authenticate.`);
  } else if (authType === "api-key") {
    info(`Run "multicc set-key ${name}" to store your API key.`);
  }
}

export async function handleList(): Promise<void> {
  throw new Error("Not implemented");
}

export async function handleShow(_name?: string): Promise<void> {
  throw new Error("Not implemented");
}

export async function handleSwitch(_name: string): Promise<void> {
  throw new Error("Not implemented");
}

export async function handleDelete(_name: string): Promise<void> {
  throw new Error("Not implemented");
}

export async function handleImport(
  _opts: { name: string; from?: string; force?: boolean }
): Promise<void> {
  throw new Error("Not implemented");
}
