/**
 * ABOUTME: Comprehensive test for multi-competition balance isolation feature
 * ABOUTME: Tests migration #57 by running migrations up to #56, inserting test data, then running #57
 *
 * NOTE: The temporary migrations directory approach is necessary because Drizzle ORM currently:
 * - Has no built-in rollback or "down" migration feature
 * - Has no way to run migrations up to a specific version
 * - Provides no testing utilities for migrations
 * The migrate() function only accepts migrationsFolder, migrationsTable, and migrationsSchema parameters.
 */
import { sql } from "drizzle-orm";
import { NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import schema from "@recallnet/db/schema";

import { config } from "@/config/index.js";
import { createLogger } from "@/lib/logger.js";

const logger = createLogger("MultiCompetitionBalancesTest");

/**
 * Type definition for Drizzle migration journal entry
 */
interface MigrationJournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

describe("Multi-Competition Balance Isolation", () => {
  let testPool: Pool;
  let testDb: NodePgDatabase<typeof schema>;
  let tempMigrationsDir: string;
  let testCompetition1Id: string;
  let testCompetition2Id: string;
  let testCompetition3Id: string;
  let testUserId: string;
  let testAgent1Id: string;
  let testAgent2Id: string;
  let testAgent3Id: string;
  let testAgent4Id: string;

  beforeAll(async () => {
    // Create a separate test database
    const testDbUrl = config.database.url;
    const testDbName = `test_multi_comp_${Date.now()}`;

    const adminPool = new Pool({ connectionString: testDbUrl });
    await adminPool.query(`CREATE DATABASE ${testDbName}`);
    await adminPool.end();

    const testDbConnection = testDbUrl.replace(/\/[^/]+$/, `/${testDbName}`);
    testPool = new Pool({ connectionString: testDbConnection });
    testDb = drizzle({ client: testPool, schema });

    logger.info(`Created test database: ${testDbName}`);

    // Create temp migrations directory with migrations up to #56
    tempMigrationsDir = path.join(
      process.cwd(),
      `.tmp-migrations-${Date.now()}`,
    );
    fs.mkdirSync(tempMigrationsDir, { recursive: true });

    const originalMigrationsDir = path.join(process.cwd(), "drizzle");
    const allMigrations = fs
      .readdirSync(originalMigrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Copy migrations up to (but not including) 0057
    const migrationsToRun = allMigrations.filter(
      (f) => !f.startsWith("0057_") && parseInt(f) < 57,
    );

    logger.info(`Found ${allMigrations.length} total migrations`);
    logger.info(
      `Copying ${migrationsToRun.length} migrations (up to #56) to temp directory`,
    );
    if (migrationsToRun.length === 0) {
      throw new Error("No migrations found to copy!");
    }

    for (const migration of migrationsToRun) {
      fs.copyFileSync(
        path.join(originalMigrationsDir, migration),
        path.join(tempMigrationsDir, migration),
      );
    }

    // Copy meta files if they exist
    const metaDir = path.join(originalMigrationsDir, "meta");
    if (fs.existsSync(metaDir)) {
      const tempMetaDir = path.join(tempMigrationsDir, "meta");
      fs.mkdirSync(tempMetaDir, { recursive: true });

      const metaFiles = fs.readdirSync(metaDir);
      for (const metaFile of metaFiles) {
        // Only copy meta files for migrations we're running
        const migrationNumber = metaFile.match(/^(\d+)_/)?.[1];
        if (migrationNumber && parseInt(migrationNumber) < 57) {
          fs.copyFileSync(
            path.join(metaDir, metaFile),
            path.join(tempMetaDir, metaFile),
          );
        }
      }

      // Copy _journal.json if it exists
      const journalPath = path.join(metaDir, "_journal.json");
      if (fs.existsSync(journalPath)) {
        const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
        // Filter entries to only include migrations up to #56
        journal.entries = journal.entries.filter(
          (entry: MigrationJournalEntry) => entry.idx < 57,
        );
        fs.writeFileSync(
          path.join(tempMetaDir, "_journal.json"),
          JSON.stringify(journal, null, 2),
        );
      }
    }

    // Run migrations up to #56
    logger.info("Running migrations up to #56...");
    await migrate(testDb, { migrationsFolder: tempMigrationsDir });

    const migrations = await testDb.execute(sql`
      SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at
    `);
    logger.info(`Ran ${migrations.rows.length} migrations`);

    // Create test data in pre-migration state
    logger.info("Creating test data in pre-migration state...");

    const userResult = await testDb.execute(sql`
      INSERT INTO "public"."users" (id, wallet_address, name, email)
      VALUES (
        gen_random_uuid(),
        '0x' || substring(md5(random()::text), 1, 40),
        'Multi-Comp Test User',
        'multi-comp@example.com'
      )
      RETURNING id
    `);
    testUserId = String(userResult.rows[0]!.id);

    const comp1Result = await testDb.execute(sql`
      INSERT INTO "public"."competitions" (id, name, type, status, start_date, end_date)
      VALUES (
        gen_random_uuid(),
        'Competition 1 (Oldest)',
        'trading',
        'ended',
        NOW() - INTERVAL '30 days',
        NOW() - INTERVAL '23 days'
      )
      RETURNING id
    `);
    testCompetition1Id = String(comp1Result.rows[0]!.id);

    const comp2Result = await testDb.execute(sql`
      INSERT INTO "public"."competitions" (id, name, type, status, start_date, end_date)
      VALUES (
        gen_random_uuid(),
        'Competition 2 (Recent)',
        'trading',
        'active',
        NOW() - INTERVAL '7 days',
        NOW() + INTERVAL '7 days'
      )
      RETURNING id
    `);
    testCompetition2Id = String(comp2Result.rows[0]!.id);

    const comp3Result = await testDb.execute(sql`
      INSERT INTO "public"."competitions" (id, name, type, status, start_date, end_date)
      VALUES (
        gen_random_uuid(),
        'Competition 3 (Future)',
        'trading',
        'pending',
        NOW() + INTERVAL '1 day',
        NOW() + INTERVAL '14 days'
      )
      RETURNING id
    `);
    testCompetition3Id = String(comp3Result.rows[0]!.id);

    await testDb.execute(sql`
      INSERT INTO "trading_comps"."trading_competitions" ("competitionId", cross_chain_trading_type)
      VALUES
        (${testCompetition1Id}::uuid, 'allow'),
        (${testCompetition2Id}::uuid, 'allow'),
        (${testCompetition3Id}::uuid, 'allow')
    `);

    const agent1Result = await testDb.execute(sql`
      INSERT INTO "public"."agents" (id, owner_id, wallet_address, name, api_key, handle)
      VALUES (
        gen_random_uuid(),
        ${testUserId}::uuid,
        '0xa1' || substring(md5(random()::text), 1, 38),
        'Agent 1 (Multi-comp)',
        'apikey1_' || gen_random_uuid()::text,
        'agent1-' || floor(random() * 10000)::text
      )
      RETURNING id
    `);
    testAgent1Id = String(agent1Result.rows[0]!.id);

    const agent2Result = await testDb.execute(sql`
      INSERT INTO "public"."agents" (id, owner_id, wallet_address, name, api_key, handle)
      VALUES (
        gen_random_uuid(),
        ${testUserId}::uuid,
        '0xa2' || substring(md5(random()::text), 1, 38),
        'Agent 2 (Single-comp)',
        'apikey2_' || gen_random_uuid()::text,
        'agent2-' || floor(random() * 10000)::text
      )
      RETURNING id
    `);
    testAgent2Id = String(agent2Result.rows[0]!.id);

    const agent3Result = await testDb.execute(sql`
      INSERT INTO "public"."agents" (id, owner_id, wallet_address, name, api_key, handle)
      VALUES (
        gen_random_uuid(),
        ${testUserId}::uuid,
        '0xa3' || substring(md5(random()::text), 1, 38),
        'Agent 3 (Different comp)',
        'apikey3_' || gen_random_uuid()::text,
        'agent3-' || floor(random() * 10000)::text
      )
      RETURNING id
    `);
    testAgent3Id = String(agent3Result.rows[0]!.id);

    const agent4Result = await testDb.execute(sql`
      INSERT INTO "public"."agents" (id, owner_id, wallet_address, name, api_key, handle)
      VALUES (
        gen_random_uuid(),
        ${testUserId}::uuid,
        '0xa4' || substring(md5(random()::text), 1, 38),
        'Agent 4 (Orphaned)',
        'apikey4_' || gen_random_uuid()::text,
        'agent4-' || floor(random() * 10000)::text
      )
      RETURNING id
    `);
    testAgent4Id = String(agent4Result.rows[0]!.id);

    await testDb.execute(sql`
      INSERT INTO "public"."competition_agents" (competition_id, agent_id, status, created_at)
      VALUES
        (${testCompetition1Id}::uuid, ${testAgent1Id}::uuid, 'active', NOW() - INTERVAL '29 days'),
        (${testCompetition2Id}::uuid, ${testAgent1Id}::uuid, 'active', NOW() - INTERVAL '6 days'),
        (${testCompetition1Id}::uuid, ${testAgent2Id}::uuid, 'active', NOW() - INTERVAL '28 days'),
        (${testCompetition3Id}::uuid, ${testAgent3Id}::uuid, 'active', NOW() - INTERVAL '1 day')
    `);

    await testDb.execute(sql`
      INSERT INTO "trading_comps"."balances" (agent_id, token_address, amount, specific_chain, symbol)
      VALUES
        (${testAgent1Id}::uuid, '0xUSDC', '10000.5', 'mainnet', 'USDC'),
        (${testAgent1Id}::uuid, '0xSOL', '50.25', 'mainnet', 'SOL'),
        (${testAgent1Id}::uuid, '0xETH', '5.0', 'mainnet', 'ETH'),
        (${testAgent2Id}::uuid, '0xUSDC', '5000.0', 'mainnet', 'USDC'),
        (${testAgent2Id}::uuid, '0xBTC', '0.25', 'mainnet', 'BTC'),
        (${testAgent3Id}::uuid, '0xUSDC', '8000.0', 'mainnet', 'USDC'),
        (${testAgent4Id}::uuid, '0xUSDC', '1000.0', 'mainnet', 'USDC')
    `);

    logger.info("✓ Test data created in pre-migration state");
  });

  afterAll(async () => {
    if (testPool) {
      const dbName = testPool.options.database;
      await testPool.end();

      const adminPool = new Pool({
        connectionString: config.database.url,
      });
      await adminPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await adminPool.end();

      logger.info(`Dropped test database: ${dbName}`);
    }

    // Clean up temp migrations directory
    if (tempMigrationsDir && fs.existsSync(tempMigrationsDir)) {
      fs.rmSync(tempMigrationsDir, { recursive: true, force: true });
      logger.info(`Cleaned up temp migrations directory`);
    }
  });

  describe("Pre-Migration State", () => {
    it("should have single-competition balance structure", async () => {
      const columnCheck = await testDb.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'trading_comps'
          AND table_name = 'balances'
          AND column_name = 'competition_id'
      `);
      expect(columnCheck.rows).toHaveLength(0);

      const constraintCheck = await testDb.execute(sql`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'trading_comps'
          AND table_name = 'balances'
          AND constraint_name = 'balances_agent_id_token_address_key'
      `);
      expect(constraintCheck.rows).toHaveLength(1);

      const balanceCount = await testDb.execute(sql`
        SELECT COUNT(*) as total FROM "trading_comps"."balances"
      `);
      expect(balanceCount.rows).toHaveLength(1);
      expect(balanceCount.rows[0]!.total).toBe("7");
    });
  });

  describe("Migration #57 Execution", () => {
    it("should successfully run migration #57", async () => {
      logger.info("Adding migration #57 to temp directory and running it...");

      // Copy migration #57 to temp directory
      const originalMigrationsDir = path.join(process.cwd(), "drizzle");
      const migration57File = fs
        .readdirSync(originalMigrationsDir)
        .find((f) => f.startsWith("0057_"));

      if (!migration57File) {
        throw new Error("Migration #57 not found!");
      }

      fs.copyFileSync(
        path.join(originalMigrationsDir, migration57File),
        path.join(tempMigrationsDir, migration57File),
      );

      // Copy corresponding meta file
      const metaDir = path.join(originalMigrationsDir, "meta");
      if (fs.existsSync(metaDir)) {
        const tempMetaDir = path.join(tempMigrationsDir, "meta");
        const meta57File = fs
          .readdirSync(metaDir)
          .find((f) => f.startsWith("0057_"));

        if (meta57File) {
          fs.copyFileSync(
            path.join(metaDir, meta57File),
            path.join(tempMetaDir, meta57File),
          );
        }

        // Update _journal.json
        const journalPath = path.join(metaDir, "_journal.json");
        const tempJournalPath = path.join(tempMetaDir, "_journal.json");
        if (fs.existsSync(journalPath)) {
          const originalJournal = JSON.parse(
            fs.readFileSync(journalPath, "utf-8"),
          );
          const migration57Entry = originalJournal.entries.find(
            (e: MigrationJournalEntry) => e.idx === 57,
          );

          if (migration57Entry) {
            const tempJournal = JSON.parse(
              fs.readFileSync(tempJournalPath, "utf-8"),
            );
            tempJournal.entries.push(migration57Entry);
            fs.writeFileSync(
              tempJournalPath,
              JSON.stringify(tempJournal, null, 2),
            );
          }
        }
      }

      // Run migration #57
      // Migration automatically deletes orphaned balances
      await migrate(testDb, { migrationsFolder: tempMigrationsDir });
      logger.info(
        "✓ Migration #57 completed (orphaned balances automatically deleted)",
      );
    });
  });

  describe("Post-Migration Schema", () => {
    it("should have multi-competition schema structure", async () => {
      const columnCheck = await testDb.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'trading_comps'
          AND table_name = 'balances'
          AND column_name = 'competition_id'
      `);
      expect(columnCheck.rows).toHaveLength(1);
      expect(columnCheck.rows[0]!.is_nullable).toBe("NO");

      const newConstraint = await testDb.execute(sql`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'trading_comps'
          AND table_name = 'balances'
          AND constraint_name = 'balances_agent_id_token_address_competition_id_key'
      `);
      expect(newConstraint.rows).toHaveLength(1);

      const oldConstraint = await testDb.execute(sql`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'trading_comps'
          AND table_name = 'balances'
          AND constraint_name = 'balances_agent_id_token_address_key'
      `);
      expect(oldConstraint.rows).toHaveLength(0);

      const indexes = await testDb.execute(sql`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'trading_comps'
          AND tablename = 'balances'
          AND indexname IN ('idx_balances_competition_id', 'idx_balances_agent_competition')
      `);
      expect(indexes.rows).toHaveLength(2);

      const fkCheck = await testDb.execute(sql`
        SELECT rc.delete_rule
        FROM information_schema.referential_constraints rc
        WHERE rc.constraint_schema = 'trading_comps'
          AND rc.constraint_name = 'balances_competition_id_fkey'
      `);
      expect(fkCheck.rows).toHaveLength(1);
      expect(fkCheck.rows[0]!.delete_rule).toBe("CASCADE");
    });

    it("should have zero NULL competition_id values", async () => {
      const result = await testDb.execute(sql`
        SELECT COUNT(*) as null_count
        FROM "trading_comps"."balances"
        WHERE competition_id IS NULL
      `);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.null_count).toBe("0");
    });
  });

  describe("Backfill Correctness", () => {
    it("should assign multi-competition agent balances to most recent competition", async () => {
      const result = await testDb.execute(sql`
        SELECT DISTINCT competition_id
        FROM "trading_comps"."balances"
        WHERE agent_id = ${testAgent1Id}::uuid
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.competition_id).toBe(testCompetition2Id);

      const tokenCount = await testDb.execute(sql`
        SELECT COUNT(*) as count
        FROM "trading_comps"."balances"
        WHERE agent_id = ${testAgent1Id}::uuid
          AND competition_id = ${testCompetition2Id}::uuid
      `);
      expect(tokenCount.rows).toHaveLength(1);
      expect(tokenCount.rows[0]!.count).toBe("3");
    });

    it("should assign single-competition agent balances correctly", async () => {
      const result = await testDb.execute(sql`
        SELECT DISTINCT competition_id
        FROM "trading_comps"."balances"
        WHERE agent_id = ${testAgent2Id}::uuid
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.competition_id).toBe(testCompetition1Id);
    });

    it("should have handled orphaned balances", async () => {
      const result = await testDb.execute(sql`
        SELECT COUNT(*) as count
        FROM "trading_comps"."balances"
        WHERE agent_id = ${testAgent4Id}::uuid
      `);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.count).toBe("0");
    });

    it("should preserve all balance amounts", async () => {
      const agent1Usdc = await testDb.execute(sql`
        SELECT amount
        FROM "trading_comps"."balances"
        WHERE agent_id = ${testAgent1Id}::uuid
          AND token_address = '0xUSDC'
      `);
      expect(agent1Usdc.rows).toHaveLength(1);
      expect(agent1Usdc.rows[0]!.amount).toBe("10000.5");

      const agent2Btc = await testDb.execute(sql`
        SELECT amount
        FROM "trading_comps"."balances"
        WHERE agent_id = ${testAgent2Id}::uuid
          AND token_address = '0xBTC'
      `);
      expect(agent2Btc.rows).toHaveLength(1);
      expect(agent2Btc.rows[0]!.amount).toBe("0.25");
    });
  });

  describe("Multi-Competition Balance Isolation", () => {
    it("should allow same agent to have same token in different competitions", async () => {
      await testDb.execute(sql`
        INSERT INTO "trading_comps"."balances" (agent_id, token_address, competition_id, amount, specific_chain, symbol)
        VALUES (
          ${testAgent1Id}::uuid,
          '0xUSDC',
          ${testCompetition1Id}::uuid,
          '15000.0',
          'mainnet',
          'USDC'
        )
      `);

      const balances = await testDb.execute(sql`
        SELECT competition_id, amount
        FROM "trading_comps"."balances"
        WHERE agent_id = ${testAgent1Id}::uuid
          AND token_address = '0xUSDC'
        ORDER BY amount
      `);

      expect(balances.rows).toHaveLength(2);
      expect(balances.rows[0]!.amount).toBe("10000.5");
      expect(balances.rows[0]!.competition_id).toBe(testCompetition2Id);
      expect(balances.rows[1]!.amount).toBe("15000.0");
      expect(balances.rows[1]!.competition_id).toBe(testCompetition1Id);
    });

    it("should prevent duplicate balance for same agent + token + competition", async () => {
      await expect(
        testDb.execute(sql`
          INSERT INTO "trading_comps"."balances" (agent_id, token_address, competition_id, amount, specific_chain, symbol)
          VALUES (
            ${testAgent1Id}::uuid,
            '0xSOL',
            ${testCompetition2Id}::uuid,
            '999.0',
            'mainnet',
            'SOL'
          )
        `),
      ).rejects.toThrow(/duplicate key value violates unique constraint/i);
    });

    it("should isolate balance updates between competitions", async () => {
      await testDb.execute(sql`
        UPDATE "trading_comps"."balances"
        SET amount = '20000.0'
        WHERE agent_id = ${testAgent1Id}::uuid
          AND token_address = '0xUSDC'
          AND competition_id = ${testCompetition1Id}::uuid
      `);

      const comp2Balance = await testDb.execute(sql`
        SELECT amount
        FROM "trading_comps"."balances"
        WHERE agent_id = ${testAgent1Id}::uuid
          AND token_address = '0xUSDC'
          AND competition_id = ${testCompetition2Id}::uuid
      `);
      expect(comp2Balance.rows).toHaveLength(1);
      expect(comp2Balance.rows[0]!.amount).toBe("10000.5");

      const comp1Balance = await testDb.execute(sql`
        SELECT amount
        FROM "trading_comps"."balances"
        WHERE agent_id = ${testAgent1Id}::uuid
          AND token_address = '0xUSDC'
          AND competition_id = ${testCompetition1Id}::uuid
      `);
      expect(comp1Balance.rows).toHaveLength(1);
      expect(comp1Balance.rows[0]!.amount).toBe("20000.0");
    });

    it("should cascade delete balances when competition is deleted", async () => {
      const beforeDelete = await testDb.execute(sql`
        SELECT COUNT(*) as count
        FROM "trading_comps"."balances"
        WHERE competition_id = ${testCompetition3Id}::uuid
      `);
      expect(beforeDelete.rows).toHaveLength(1);
      expect(parseInt(String(beforeDelete.rows[0]!.count))).toBeGreaterThan(0);

      await testDb.execute(sql`
        DELETE FROM "public"."competitions"
        WHERE id = ${testCompetition3Id}::uuid
      `);

      const afterDelete = await testDb.execute(sql`
        SELECT COUNT(*) as count
        FROM "trading_comps"."balances"
        WHERE competition_id = ${testCompetition3Id}::uuid
      `);
      expect(afterDelete.rows).toHaveLength(1);
      expect(afterDelete.rows[0]!.count).toBe("0");
    });
  });

  describe("Data Integrity", () => {
    it("should enforce NOT NULL on competition_id", async () => {
      await expect(
        testDb.execute(sql`
          INSERT INTO "trading_comps"."balances" (agent_id, token_address, amount, specific_chain, symbol)
          VALUES (
            ${testAgent1Id}::uuid,
            '0xNEW_TOKEN',
            '100.0',
            'mainnet',
            'NEW'
          )
        `),
      ).rejects.toThrow(/null value in column "competition_id"/i);
    });

    it("should enforce foreign key to competitions", async () => {
      const fakeCompId = "00000000-0000-0000-0000-000000000000";

      await expect(
        testDb.execute(sql`
          INSERT INTO "trading_comps"."balances" (agent_id, token_address, competition_id, amount, specific_chain, symbol)
          VALUES (
            ${testAgent1Id}::uuid,
            '0xFAKE_TOKEN',
            ${fakeCompId}::uuid,
            '100.0',
            'mainnet',
            'FAKE'
          )
        `),
      ).rejects.toThrow(/foreign key constraint/i);
    });
  });
});
