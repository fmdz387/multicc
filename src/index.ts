import { createProgram } from "./cli.js";
import { error } from "./display.js";

const program = createProgram();

try {
  await program.parseAsync(process.argv);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  error(message);
  process.exit(1);
}
