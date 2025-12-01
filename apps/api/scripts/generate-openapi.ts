import fs from "fs";
import path from "path";

import { swaggerSpec } from "../src/config/swagger.js";

const outputPath = path.join(process.cwd(), "openapi", "openapi.json");

interface OpenAPISpec {
  tags?: Array<{ name: string }>;
  paths?: Record<string, Record<string, { tags?: string[] }>>;
}

function validateTags(spec: OpenAPISpec): string[] {
  const definedTags = new Set(spec.tags?.map((t) => t.name) ?? []);
  const referencedTags = new Set<string>();

  for (const methods of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(methods)) {
      if (
        operation &&
        typeof operation === "object" &&
        "tags" in operation &&
        Array.isArray(operation.tags)
      ) {
        for (const tag of operation.tags) {
          referencedTags.add(tag as string);
        }
      }
    }
  }

  return [...referencedTags].filter((tag) => !definedTags.has(tag));
}

try {
  const undefinedTags = validateTags(swaggerSpec as OpenAPISpec);
  if (undefinedTags.length > 0) {
    console.error(
      `Error: Operations reference undefined tags: ${undefinedTags.join(", ")}`,
    );
    console.error("Add these tags to the tags array in src/config/swagger.ts");
    process.exit(1);
  }

  fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
  console.log(`OpenAPI spec written to ${outputPath}`);
} catch (err) {
  console.error(
    `Failed to write OpenAPI spec to ${outputPath}:`,
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}
