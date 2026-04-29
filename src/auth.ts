import fs from "node:fs";
import path from "node:path";
import type { AuthType, Profile } from "./types.js";
import { retrieveSecret } from "./keyring.js";

export interface CredentialStatus {
  authenticated: boolean;
  authType: AuthType;
  email?: string;
  expiresAt?: number;
  expired?: boolean;
  method: "oauth" | "api-key" | "env-var" | "bedrock" | "vertex" | "foundry";
}

interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function readOAuthCredentials(
  configDir: string
): OAuthCredentials | null {
  const credPath = path.join(configDir, ".credentials.json");
  let raw: string;
  try {
    raw = fs.readFileSync(credPath, "utf-8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  // Try claudeAiOauth format first
  const oauthData = obj["claudeAiOauth"] ?? obj["oauthAccount"];
  if (typeof oauthData !== "object" || oauthData === null) {
    return null;
  }

  const creds = oauthData as Record<string, unknown>;
  const accessToken = creds["accessToken"];
  const refreshToken = creds["refreshToken"];
  const expiresAt = creds["expiresAt"];

  if (
    typeof accessToken !== "string" ||
    typeof refreshToken !== "string" ||
    typeof expiresAt !== "number"
  ) {
    return null;
  }

  return { accessToken, refreshToken, expiresAt };
}

export async function getCredentialStatus(
  profile: Profile
): Promise<CredentialStatus> {
  switch (profile.authType) {
    case "oauth": {
      const creds = readOAuthCredentials(profile.configDir);
      if (!creds) {
        return {
          authenticated: false,
          authType: "oauth",
          method: "oauth",
        };
      }
      const expired = creds.expiresAt < Date.now();
      return {
        authenticated: !expired,
        authType: "oauth",
        expiresAt: creds.expiresAt,
        expired,
        method: "oauth",
      };
    }

    case "api-key": {
      // Check env overrides first
      if (profile.envOverrides?.["ANTHROPIC_API_KEY"]) {
        return {
          authenticated: true,
          authType: "api-key",
          method: "env-var",
        };
      }
      // Check keyring
      const secret = await retrieveSecret(profile.configDir.split(path.sep).pop() ?? "");
      if (secret) {
        return {
          authenticated: true,
          authType: "api-key",
          method: "api-key",
        };
      }
      return {
        authenticated: false,
        authType: "api-key",
        method: "api-key",
      };
    }

    case "bedrock": {
      const hasOverrides =
        profile.envOverrides?.["AWS_ACCESS_KEY_ID"] !== undefined ||
        profile.envOverrides?.["AWS_PROFILE"] !== undefined;
      return {
        authenticated: hasOverrides,
        authType: "bedrock",
        method: "bedrock",
      };
    }

    case "vertex": {
      const hasOverrides =
        profile.envOverrides?.["GOOGLE_APPLICATION_CREDENTIALS"] !== undefined ||
        profile.envOverrides?.["CLOUD_ML_REGION"] !== undefined;
      return {
        authenticated: hasOverrides,
        authType: "vertex",
        method: "vertex",
      };
    }

    case "foundry": {
      const hasOverrides =
        profile.envOverrides?.["FOUNDRY_API_KEY"] !== undefined;
      return {
        authenticated: hasOverrides,
        authType: "foundry",
        method: "foundry",
      };
    }
  }
}

// Env vars that select Claude Code's auth mode — must be sanitized to prevent
// cross-profile contamination when the parent shell has leftovers from another profile.
const CLAUDE_AUTH_ENV_VARS = [
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_FOUNDRY_BASE_URL",
  "ANTHROPIC_FOUNDRY_RESOURCE",
] as const;

// Tmp-dir env vars. Some upstream tools (notably Claude Code CLI 2.1.x)
// can leak Windows-shaped paths like "C:\tmp\claude-cli-tmp" into the env
// even on macOS/Linux. Forwarding such a value to a child causes Node's
// os.tmpdir() to return a non-absolute string, which fs.* then resolves
// against cwd — creating a literal "C:\tmp\..." directory inside the project.
const TMP_ENV_VARS = [
  "TMPDIR",
  "TMP",
  "TEMP",
  "CLAUDE_CODE_TMPDIR",
  "CLAUDE_TMPDIR",
] as const;

// Matches a Windows-style absolute path (drive letter) or any path containing
// a backslash separator. Either is invalid as a tmp dir on POSIX.
const WINDOWS_PATH_RE = /^[A-Za-z]:[\\/]|\\/;

export async function buildProfileEnv(
  profile: Profile,
  profileName: string
): Promise<Record<string, string | undefined>> {
  const env: Record<string, string | undefined> = {
    CLAUDE_CONFIG_DIR: profile.configDir,
  };

  // Explicitly unset all auth-related env vars so parent-process values
  // from a different profile don't leak into the child process.
  for (const key of CLAUDE_AUTH_ENV_VARS) {
    env[key] = undefined;
  }

  // On non-Windows hosts, strip any tmp-dir env var whose value is a
  // Windows-shaped path. Letting the child inherit it would cause it to
  // create the path literally inside cwd. Unsetting forces the child to
  // fall back to the platform default (/tmp on macOS/Linux).
  if (process.platform !== "win32") {
    for (const key of TMP_ENV_VARS) {
      const value = process.env[key];
      if (value && WINDOWS_PATH_RE.test(value)) {
        env[key] = undefined;
      }
    }
  }

  switch (profile.authType) {
    case "api-key": {
      const secret = await retrieveSecret(profileName);
      if (secret) {
        env["ANTHROPIC_API_KEY"] = secret;
      }
      break;
    }
    case "bedrock":
      env["CLAUDE_CODE_USE_BEDROCK"] = "1";
      break;
    case "vertex":
      env["CLAUDE_CODE_USE_VERTEX"] = "1";
      break;
    case "foundry":
      env["CLAUDE_CODE_USE_FOUNDRY"] = "1";
      break;
    case "oauth":
      // OAuth uses credentials file in configDir, no extra env needed
      break;
  }

  if (profile.envOverrides) {
    for (const [key, value] of Object.entries(profile.envOverrides)) {
      env[key] = value;
    }
  }

  return env;
}
