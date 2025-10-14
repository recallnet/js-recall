import fs from "fs";
import path from "path";

import { swaggerSpec } from "../src/config/swagger.js";

const outputPath = path.join(process.cwd(), "openapi", "openapi.json");

try {
  fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
  console.log(`OpenAPI spec written to ${outputPath}`);
} catch (err) {
  console.error(
    `Failed to write OpenAPI spec to ${outputPath}:`,
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}
