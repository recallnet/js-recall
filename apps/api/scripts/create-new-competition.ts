#!/usr/bin/env tsx
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import * as path from "path";
import { stdin as input, stdout as output } from "process";
import { Interface, createInterface } from "readline/promises";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import { z } from "zod/v4";

import { AdminCreateCompetitionSchema } from "@recallnet/services/types";

type CreateCompetitionPayload = z.infer<typeof AdminCreateCompetitionSchema>;

interface ScriptOptions {
  startDate?: string;
  endDate?: string;
  apiBaseUrl: string;
  payloadFile: string;
  yes: boolean;
  dryRun: boolean;
}

interface RegistrationFailure {
  agentId: string;
  error: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_PAYLOAD_FILE = path.join(SCRIPT_DIR, "data", "new-comp.json");
const DEFAULT_API_BASE_URL = "https://api.competitions.recall.network";
const FALLBACK_TEMPLATE_TIME = new Date("1970-01-01T14:00:00.000Z");

dotenv.config({ path: path.join(API_ROOT, ".env") });

function usage(): string {
  return [
    "Usage:",
    "  pnpm comp:create -- --start-date 2026-06-10 --end-date 2026-06-16",
    "  pnpm comp:create -- --start-date 2026-06-10T14:00:00Z --end-date 2026-06-16T14:00:00Z --yes",
    "",
    "Environment:",
    "  ADMIN_API_KEY must be set.",
    "  API_BASE_URL may override the production API base URL.",
    "",
    "Options:",
    "  --start-date, -s       Competition start date. Date-only values use the template UTC time.",
    "  --end-date, -e         Competition end date. Date-only values use the template UTC time.",
    "  --api-base-url         API base URL.",
    "  --payload-file         JSON template file.",
    "  --yes, -y              Skip confirmation prompt.",
    "  --dry-run, -d          Print the payload and skip API calls.",
    "  --help, -h             Show this help.",
  ].join("\n");
}

function parseCliOptions(): ScriptOptions {
  const args = process.argv.slice(2);
  if (args[0] === "--") {
    args.shift();
  }

  const { values } = parseArgs({
    args,
    options: {
      "start-date": { type: "string", short: "s" },
      "end-date": { type: "string", short: "e" },
      "api-base-url": { type: "string" },
      "payload-file": { type: "string" },
      yes: { type: "boolean", short: "y", default: false },
      "dry-run": { type: "boolean", short: "d", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  return {
    startDate: values["start-date"],
    endDate: values["end-date"],
    apiBaseUrl:
      values["api-base-url"] ??
      process.env.API_BASE_URL ??
      DEFAULT_API_BASE_URL,
    payloadFile: values["payload-file"]
      ? path.resolve(process.cwd(), values["payload-file"])
      : DEFAULT_PAYLOAD_FILE,
    yes: values.yes ?? false,
    dryRun: values["dry-run"] ?? false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "input";
      return `${pathLabel}: ${issue.message}`;
    })
    .join("; ");
}

async function readTemplate(
  filePath: string,
): Promise<CreateCompetitionPayload> {
  const contents = await readFile(filePath, "utf8");
  const raw = JSON.parse(contents) as unknown;
  const result = AdminCreateCompetitionSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      `Template payload is invalid: ${formatZodError(result.error)}`,
    );
  }

  return result.data;
}

function formatUtcTime(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${milliseconds}Z`;
}

function parseCompetitionDate(
  value: string,
  label: string,
  templateDate: Date,
): Date {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T${formatUtcTime(templateDate)}`);
  }

  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    throw new Error(
      `${label} must be YYYY-MM-DD or an ISO datetime with an explicit timezone`,
    );
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is not a valid date`);
  }

  return parsed;
}

async function promptRequired(
  rl: Interface,
  label: string,
  existingValue?: string,
): Promise<string> {
  if (existingValue) {
    return existingValue;
  }

  if (!input.isTTY) {
    throw new Error(
      `${label} is required when running without an interactive terminal`,
    );
  }

  const answer = await rl.question(`${label}: `);
  if (!answer.trim()) {
    throw new Error(`${label} is required`);
  }

  return answer;
}

function buildPayload(
  template: CreateCompetitionPayload,
  startDate: Date,
  endDate: Date,
): CreateCompetitionPayload {
  if (endDate.getTime() <= startDate.getTime()) {
    throw new Error("endDate must be after startDate");
  }

  const candidate = {
    ...template,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    boostStartDate: new Date(startDate.getTime() - DAY_MS).toISOString(),
    boostEndDate: new Date(endDate.getTime() - 4 * DAY_MS).toISOString(),
  };

  const result = AdminCreateCompetitionSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `Final payload is invalid: ${formatZodError(result.error)}`,
    );
  }

  return result.data;
}

function getAdminApiKey(): string {
  const apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) {
    throw new Error("ADMIN_API_KEY must be set");
  }

  return apiKey;
}

function extractErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.error === "string") {
    return value.error;
  }

  if (typeof value.message === "string") {
    return value.message;
  }

  return undefined;
}

function parseJsonResponse(text: string): unknown {
  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text) as unknown;
}

async function requestJson(
  apiBaseUrl: string,
  apiKey: string,
  method: "POST",
  requestPath: string,
  body?: unknown,
): Promise<unknown> {
  const url = new URL(requestPath, apiBaseUrl).toString();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = parseJsonResponse(text);
  const responseError = extractErrorMessage(parsed);

  if (!response.ok) {
    throw new Error(
      `${method} ${requestPath} failed with ${response.status}: ${
        responseError ?? text
      }`,
    );
  }

  if (isRecord(parsed) && parsed.success === false) {
    throw new Error(
      `${method} ${requestPath} failed: ${responseError ?? text}`,
    );
  }

  return parsed;
}

function getCompetitionId(response: unknown): string {
  if (!isRecord(response) || !isRecord(response.competition)) {
    throw new Error(
      "Create competition response did not include competition data",
    );
  }

  const { id } = response.competition;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(
      "Create competition response did not include competition.id",
    );
  }

  return id;
}

async function createCompetition(
  apiBaseUrl: string,
  apiKey: string,
  payload: CreateCompetitionPayload,
): Promise<string> {
  const response = await requestJson(
    apiBaseUrl,
    apiKey,
    "POST",
    "/api/admin/competition/create",
    payload,
  );

  return getCompetitionId(response);
}

async function registerAgent(
  apiBaseUrl: string,
  apiKey: string,
  competitionId: string,
  agentId: string,
): Promise<void> {
  await requestJson(
    apiBaseUrl,
    apiKey,
    "POST",
    `/api/admin/competitions/${encodeURIComponent(
      competitionId,
    )}/agents/${encodeURIComponent(agentId)}`,
  );
}

async function confirmRun(
  rl: Interface,
  options: ScriptOptions,
  payload: CreateCompetitionPayload,
): Promise<void> {
  if (options.yes || options.dryRun) {
    return;
  }

  const allowlistCount = payload.allowlist?.length ?? 0;
  console.log("");
  console.log(`API: ${options.apiBaseUrl}`);
  console.log(`Competition: ${payload.name}`);
  console.log(`Start: ${payload.startDate?.toISOString()}`);
  console.log(`End: ${payload.endDate?.toISOString()}`);
  console.log(`Boost start: ${payload.boostStartDate?.toISOString()}`);
  console.log(`Boost end: ${payload.boostEndDate?.toISOString()}`);
  console.log(`Agents to register: ${allowlistCount}`);

  const answer = await rl.question(
    "Create competition and register agents? (y/N): ",
  );
  if (answer.trim().toLowerCase() !== "y") {
    throw new Error("Cancelled");
  }
}

function printDryRun(
  payload: CreateCompetitionPayload,
  agentIds: string[],
): void {
  console.log(
    JSON.stringify(
      {
        ...payload,
        startDate: payload.startDate?.toISOString(),
        endDate: payload.endDate?.toISOString(),
        boostStartDate: payload.boostStartDate?.toISOString(),
        boostEndDate: payload.boostEndDate?.toISOString(),
      },
      null,
      2,
    ),
  );

  console.log("");
  console.log(`Would register ${agentIds.length} allowlisted agent(s):`);
  for (const agentId of agentIds) {
    console.log(`- ${agentId}`);
  }
}

async function registerAllowlistedAgents(
  apiBaseUrl: string,
  apiKey: string,
  competitionId: string,
  agentIds: string[],
): Promise<RegistrationFailure[]> {
  const failures: RegistrationFailure[] = [];

  for (const agentId of agentIds) {
    try {
      await registerAgent(apiBaseUrl, apiKey, competitionId, agentId);
      console.log(`Registered agent ${agentId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ agentId, error: message });
      console.error(`Failed to register agent ${agentId}: ${message}`);
    }
  }

  return failures;
}

async function main(): Promise<void> {
  const options = parseCliOptions();
  const template = await readTemplate(options.payloadFile);
  const rl = createInterface({ input, output });

  try {
    const startInput = await promptRequired(
      rl,
      "Competition start date",
      options.startDate,
    );
    const endInput = await promptRequired(
      rl,
      "Competition end date",
      options.endDate,
    );

    const templateStartDate = template.startDate ?? FALLBACK_TEMPLATE_TIME;
    const templateEndDate = template.endDate ?? FALLBACK_TEMPLATE_TIME;
    const startDate = parseCompetitionDate(
      startInput,
      "Competition start date",
      templateStartDate,
    );
    const endDate = parseCompetitionDate(
      endInput,
      "Competition end date",
      templateEndDate,
    );
    const payload = buildPayload(template, startDate, endDate);
    const agentIds = payload.allowlist ?? [];

    if (agentIds.length === 0) {
      throw new Error("Template payload has no allowlist agents to register");
    }

    await confirmRun(rl, options, payload);

    if (options.dryRun) {
      printDryRun(payload, agentIds);
      return;
    }

    const apiKey = getAdminApiKey();
    console.log("Creating competition...");
    const competitionId = await createCompetition(
      options.apiBaseUrl,
      apiKey,
      payload,
    );
    console.log(`Created competition ${competitionId}`);
    console.log(`Registering ${agentIds.length} allowlisted agents...`);

    const failures = await registerAllowlistedAgents(
      options.apiBaseUrl,
      apiKey,
      competitionId,
      agentIds,
    );

    if (failures.length > 0) {
      throw new Error(
        `Created competition ${competitionId}, but ${failures.length} agent registration(s) failed`,
      );
    }

    console.log(
      `Competition ${competitionId} is pending with ${agentIds.length} agents`,
    );
  } finally {
    rl.close();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
