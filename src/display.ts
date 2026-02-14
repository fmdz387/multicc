import pc from "picocolors";

export function success(msg: string): void {
  console.log(pc.green("\u2714") + " " + msg);
}

export function error(msg: string): void {
  process.stderr.write(pc.red("\u2716") + " " + msg + "\n");
}

export function warn(msg: string): void {
  process.stderr.write(pc.yellow("\u26A0") + " " + msg + "\n");
}

export function info(msg: string): void {
  console.log(pc.blue("\u2139") + " " + msg);
}

export function profileTable(
  profiles: Array<{
    name: string;
    active: boolean;
    authType: string;
    description?: string;
  }>
): string {
  const headers = ["Name", "Active", "Auth Type", "Description"];
  const rows = profiles.map((p) => [
    p.name,
    p.active ? "*" : "",
    p.authType,
    p.description ?? "",
  ]);

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  );

  const separator = colWidths.map((w) => "-".repeat(w)).join(" | ");
  const headerRow = headers
    .map((h, i) => h.padEnd(colWidths[i]))
    .join(" | ");
  const dataRows = rows.map((row) =>
    row.map((cell, i) => cell.padEnd(colWidths[i])).join(" | ")
  );

  return [headerRow, separator, ...dataRows].join("\n");
}

export function redact(value: string): string {
  if (value.length < 12) {
    return "****";
  }
  return value.slice(0, 8) + "..." + value.slice(-4);
}
