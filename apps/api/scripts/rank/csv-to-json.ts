#!/usr/bin/env tsx
/**
 * CSV to JSON Converter for all_ratings_tidy.csv
 *
 * Usage:
 *   pnpm tsx scripts/rank/csv-to-json.ts
 *
 * Output:
 *   all_ratings_tidy.json in the same directory
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple CSV line splitter that handles quoted fields
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCsvContent(csvContent: string): Record<string, string>[] {
  const lines = csvContent
    .trim()
    .split("\n")
    .filter((l): l is string => typeof l === "string" && l.trim() !== "");
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  if (!firstLine) return [];

  const headersRaw = splitCsvLine(firstLine);
  const headers: string[] = headersRaw.map((h, idx) =>
    h !== undefined && h !== "" ? h.trim() : `col${idx}`,
  );
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = splitCsvLine(line);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key: string = String(headers[j] ?? `col${j}`);
      obj[key] = String(cols[j] ?? "");
    }
    records.push(obj);
  }
  return records;
}

function main() {
  const csvPath = path.join(__dirname, "all_ratings_tidy.csv");
  const jsonPath = path.join(__dirname, "all_ratings_tidy.json");
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const records = parseCsvContent(csvContent);
  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), "utf-8");
  console.log(`Converted ${records.length} rows to JSON: ${jsonPath}`);
}

main();
