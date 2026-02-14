export type AuthType = "oauth" | "api-key" | "bedrock" | "vertex" | "foundry";

export interface Profile {
  authType: AuthType;
  configDir: string;
  description?: string;
  createdAt: string;
  apiKeyStorage?: "keyring" | "file";
  envOverrides?: Record<string, string>;
}

export interface MulticcConfig {
  version: 1;
  activeProfile: string;
  profiles: Record<string, Profile>;
}
