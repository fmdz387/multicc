import { loadConfig } from "../config.js";
import { getCredentialStatus } from "../auth.js";
import { info } from "../display.js";
import pc from "picocolors";

function formatExpiry(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let timeStr: string;
  if (days > 0) {
    timeStr = `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    timeStr = `${hours}h ${minutes % 60}m`;
  } else {
    timeStr = `${minutes}m`;
  }

  return diff > 0 ? `expires in ${timeStr}` : `expired ${timeStr} ago`;
}

function formatAuthStatus(
  authenticated: boolean,
  expired?: boolean
): string {
  if (authenticated) {
    return pc.green("authenticated");
  }
  if (expired) {
    return pc.yellow("expired");
  }
  return pc.red("not configured");
}

export async function handleStatus(): Promise<void> {
  const config = loadConfig();
  const names = Object.keys(config.profiles);

  if (names.length === 0) {
    info(
      'No profiles configured. Run "multicc profile create <name>" to get started.'
    );
    return;
  }

  const headers = ["Name", "Active", "Auth Type", "Status", "Expiry"];
  const rows: string[][] = [];

  for (const name of names) {
    const profile = config.profiles[name];
    const isActive = name === config.activeProfile;

    let status: ReturnType<typeof formatAuthStatus>;
    let expiry = "";

    try {
      const cred = await getCredentialStatus(profile);
      status = formatAuthStatus(cred.authenticated, cred.expired);
      if (cred.expiresAt !== undefined) {
        expiry = formatExpiry(cred.expiresAt);
      }
    } catch {
      status = pc.red("error");
    }

    rows.push([
      name,
      isActive ? "*" : "",
      profile.authType,
      status,
      expiry,
    ]);
  }

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => stripAnsi(r[i]).length))
  );

  const headerRow = headers
    .map((h, i) => h.padEnd(colWidths[i]))
    .join(" | ");
  const separator = colWidths.map((w) => "-".repeat(w)).join(" | ");
  const dataRows = rows.map((row) =>
    row
      .map((cell, i) => {
        const visible = stripAnsi(cell).length;
        const pad = colWidths[i] - visible;
        return cell + " ".repeat(Math.max(0, pad));
      })
      .join(" | ")
  );

  process.stdout.write([headerRow, separator, ...dataRows].join("\n") + "\n");
}

function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, "");
}
