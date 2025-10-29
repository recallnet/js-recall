import * as fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const abi = JSON.parse(
  fs.readFileSync(
    join(__dirname, "../contracts/abi/RewardAllocation.json"),
    "utf8",
  ),
);
