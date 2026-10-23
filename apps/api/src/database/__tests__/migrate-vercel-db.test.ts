import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { migrateDb } from "@recallnet/db/utils";

import { migrateVercelDatabase } from "../../../scripts/migrate-vercel-db.js";

const { end } = vi.hoisted(() => ({ end: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
vi.mock("pg", () => ({ Pool: vi.fn(() => ({ end })) }));
vi.mock("@recallnet/db/utils", () => ({ migrateDb: vi.fn() }));

const databaseUrl = "postgresql://compapp2:test@db.example.test:5432/postgres";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(migrateDb).mockResolvedValue(undefined);
  end.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("Vercel deployment migrations", () => {
  it("uses the downloaded primary database and CA with a single persistent connection", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://wrong:wrong@localhost/wrong");
    const certificate = "test certificate\n";
    vi.mocked(readFile).mockResolvedValue(
      Buffer.from(
        `DATABASE_URL="${databaseUrl}"\nDATABASE_CA_CERT="${Buffer.from(certificate).toString("base64")}"\nDATABASE_READ_REPLICA_URL="postgresql://replica/db"`,
      ),
    );

    await migrateVercelDatabase("../../.vercel/.env.production.local");

    expect(readFile).toHaveBeenCalledWith(
      "../../.vercel/.env.production.local",
    );
    expect(Pool).toHaveBeenCalledWith({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 10_000,
      max: 1,
      idleTimeoutMillis: 0,
      ssl: { ca: certificate, rejectUnauthorized: true },
    });
    expect(migrateDb).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ end }),
      expect.stringMatching(/apps\/api\/drizzle$/),
      expect.anything(),
    );
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("propagates migration failures and closes the connection", async () => {
    vi.mocked(readFile).mockResolvedValue(
      Buffer.from(`DATABASE_URL=${databaseUrl}`),
    );
    const failure = new Error("migration statement failed");
    vi.mocked(migrateDb).mockRejectedValueOnce(failure);

    await expect(migrateVercelDatabase("production.env")).rejects.toBe(failure);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it.each(["", "DATABASE_URL=invalid", "DATABASE_URL=https://example.test"])(
    "rejects missing or invalid database configuration without falling back to the shell environment: %s",
    async (contents) => {
      vi.stubEnv("DATABASE_URL", databaseUrl);
      vi.mocked(readFile).mockResolvedValue(Buffer.from(contents));

      await expect(migrateVercelDatabase("production.env")).rejects.toThrow();
      expect(Pool).not.toHaveBeenCalled();
      expect(migrateDb).not.toHaveBeenCalled();
    },
  );

  it("fails when the downloaded environment file is missing", async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    await expect(migrateVercelDatabase("missing.env")).rejects.toThrow(
      "ENOENT",
    );
    expect(Pool).not.toHaveBeenCalled();
  });
});
