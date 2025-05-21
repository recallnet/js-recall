#!/usr/bin/env node
import { run } from "./cli.js";

// Re-export components for programmatic usage
export * from "./server.js";
export * from "./types.js";

// Run the CLI when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
