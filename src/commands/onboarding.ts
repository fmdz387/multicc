import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { getClaudeDefaultDir } from "../paths.js";
import {
  getLargeBanner,
  cmd,
  subtle,
  sectionHeader,
  stepLine,
} from "../display.js";
import type { AuthType } from "../types.js";

/**
 * Attempt to load @inquirer/prompts. Returns null if not installed.
 * This allows the onboarding to degrade gracefully in minimal installs.
 */
async function tryLoadInquirer(): Promise<typeof import("@inquirer/prompts") | null> {
  try {
    return await import("@inquirer/prompts");
  } catch {
    return null;
  }
}

/**
 * Check if stdin is a TTY (interactive terminal).
 * Onboarding prompts should only run interactively.
 */
function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY);
}

/**
 * Check if existing Claude Code config exists at ~/.claude
 */
function hasExistingClaudeConfig(): boolean {
  const claudeDir = getClaudeDefaultDir();
  return (
    fs.existsSync(path.join(claudeDir, ".credentials.json")) ||
    fs.existsSync(path.join(claudeDir, "settings.json"))
  );
}

/**
 * Run the first-run onboarding wizard.
 * Called when `multicc` is invoked with no args and no profiles exist.
 */
export async function runOnboarding(): Promise<void> {
  // --- Banner ---
  console.log();
  console.log(getLargeBanner());
  console.log();

  // Check if we can run interactively
  const inquirer = await tryLoadInquirer();
  if (!inquirer || !isInteractive()) {
    // Non-interactive fallback: show guidance with highlighted commands
    console.log(
      "  " + pc.bold("Welcome to multicc!") + " No profiles configured yet."
    );
    console.log();
    console.log("  To get started, create your first profile:");
    console.log();
    console.log("    " + cmd("multicc profile create <name> --auth-type oauth"));
    console.log();
    if (hasExistingClaudeConfig()) {
      console.log("  Or import your existing Claude Code config:");
      console.log();
      console.log("    " + cmd("multicc profile import --name default"));
      console.log();
    }
    console.log(
      "  " +
        subtle("Run ") +
        cmd("multicc --help") +
        subtle(" for all available commands.")
    );
    console.log();
    return;
  }

  // Interactive wizard starts here
  try {
    console.log(
      "  " + pc.bold("Welcome!") + " Let's set up your first profile."
    );
    console.log();

    // --- Step 1: Detect existing config & offer import ---
    if (hasExistingClaudeConfig()) {
      const claudeDir = getClaudeDefaultDir();
      console.log(
        "  Found existing Claude Code config at " + pc.cyan(claudeDir)
      );
      console.log();

      const shouldImport = await inquirer.confirm({
        message: "Import existing config into multicc?",
        default: true,
      });

      if (shouldImport) {
        const { handleImport } = await import("./profile.js");
        await handleImport({ name: "default", from: claudeDir });
        console.log();
        printNextSteps("default", "oauth");
        return;
      }

      console.log();
    }

    // --- Step 2: Profile name ---
    const profileName = await inquirer.input({
      message: "Profile name:",
      default: "default",
      validate: (value: string) => {
        if (value.length === 0) return "Profile name cannot be empty.";
        if (value.length > 32)
          return "Profile name must be 32 characters or less.";
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(value)) {
          return "Must be alphanumeric with hyphens only, starting with a letter or number.";
        }
        return true;
      },
    });

    // --- Step 3: Auth type ---
    const authType = await inquirer.select<AuthType>({
      message: "Authentication type:",
      choices: [
        {
          value: "oauth" as const,
          name: "OAuth (claude.ai account)",
          description: "Sign in via browser",
        },
        {
          value: "api-key" as const,
          name: "API Key (Anthropic API)",
          description: "Use an API key",
        },
        {
          value: "bedrock" as const,
          name: "AWS Bedrock",
          description: "Use AWS credentials",
        },
        {
          value: "vertex" as const,
          name: "Google Vertex AI",
          description: "Use Google Cloud credentials",
        },
        {
          value: "foundry" as const,
          name: "Foundry",
          description: "Use Foundry API key",
        },
      ],
      default: "oauth",
    });

    // --- Step 4: Optional description ---
    const description = await inquirer.input({
      message: "Description (optional, press Enter to skip):",
    });

    // --- Step 5: Create the profile ---
    console.log();
    const { handleCreate } = await import("./profile.js");
    await handleCreate(profileName, {
      authType,
      description: description || undefined,
    });

    // --- Step 6: Next steps ---
    console.log();
    printNextSteps(profileName, authType);
  } catch (err) {
    // Handle Ctrl+C gracefully during prompts
    if (err instanceof Error && err.name === "ExitPromptError") {
      console.log();
      return;
    }
    throw err;
  }
}

/**
 * Print post-setup guidance with contextual next steps.
 */
function printNextSteps(profileName: string, authType: string): void {
  sectionHeader("Next Steps");
  console.log();

  let stepNum = 1;

  if (authType === "api-key") {
    stepLine(stepNum, "Set API key", `multicc set-key ${profileName}`);
    stepNum++;
  } else if (
    authType === "bedrock" ||
    authType === "vertex" ||
    authType === "foundry"
  ) {
    console.log(
      pc.dim(`  ${stepNum}. `) +
        "Configure".padEnd(16) +
        subtle(`See docs for ${authType} environment variables`)
    );
    stepNum++;
  }

  stepLine(stepNum, "Launch Claude", `multicc launch ${profileName}`);
  stepNum++;
  stepLine(stepNum, "Shell setup", 'eval "$(multicc shell-init)"');

  console.log();
  console.log(
    "  " +
      subtle("Run ") +
      cmd("multicc --help") +
      subtle(" for all available commands.")
  );
  console.log();
}
