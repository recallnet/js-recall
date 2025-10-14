import fs from "fs";
import path from "path";

import { swaggerSpec } from "../src/config/swagger.js";

const outputPath = path.join(process.cwd(), "openapi", "openapi.json");
fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
console.log(`OpenAPI spec written to ${outputPath}`);
