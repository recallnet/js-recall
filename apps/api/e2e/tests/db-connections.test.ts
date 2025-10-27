import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { wait } from "@recallnet/test-utils";

import { db, dbRead } from "@/database/db.js";

describe("Database Connections", () => {
  beforeAll(async () => {
    await wait(2000);
    // Ensure database connections are ready
    await Promise.all([
      db.execute(sql`SELECT 1`),
      dbRead.execute(sql`SELECT 1`),
    ]);
  });

  afterAll(async () => {
    // Clean up connections
    await db.$client.end();
    await dbRead.$client.end();
  });

  describe("Primary Database Connection", () => {
    it("should be able to connect and execute queries", async () => {
      const result = await db.execute(sql`SELECT 1 as test_value`);
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(1);
    });

    it("should have access to schema tables", async () => {
      // Test that we can query schema information
      const result = await db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        LIMIT 1
      `);
      expect(result).toBeDefined();
    });

    it("should support write operations", async () => {
      // Create a temporary test table to verify write access
      await db.execute(sql`
        CREATE TEMPORARY TABLE test_write_access (
          id SERIAL PRIMARY KEY,
          test_data TEXT
        )
      `);

      // Insert test data
      await db.execute(sql`
        INSERT INTO test_write_access (test_data)
        VALUES ('test')
      `);

      // Verify the data was inserted
      const result = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM test_write_access
      `);

      expect(result.rows[0]?.count).toBe("1");
    });
  });

  describe("Read Replica Database Connection", () => {
    it("should be able to connect and execute queries", async () => {
      const result = await dbRead.execute(sql`SELECT 1 as test_value`);
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(1);
    });

    it("should have access to schema tables", async () => {
      // Test that we can query schema information
      const result = await dbRead.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        LIMIT 1
      `);
      expect(result).toBeDefined();
    });

    it("should support read operations", async () => {
      // Test a basic read operation
      const result = await dbRead.execute(sql`
        SELECT current_database() as db_name
      `);

      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(1);
      expect(result.rows[0]?.db_name).toBeDefined();
    });
  });

  describe("Connection Behavior", () => {
    it("should use different connection pools", () => {
      // Verify that the connections use different pool instances
      // This is important for load balancing and failover
      expect(db.$client).toBeDefined();
      expect(dbRead.$client).toBeDefined();

      // In development/testing, they might point to the same database
      // but should still be separate connection pool instances
      expect(db.$client !== dbRead.$client).toBe(true);
    });

    it("should handle concurrent operations correctly", async () => {
      // Test that both connections can handle concurrent operations
      const promises = [
        db.execute(sql`SELECT 'primary' as connection_type`),
        dbRead.execute(sql`SELECT 'replica' as connection_type`),
        db.execute(sql`SELECT NOW() as timestamp`),
        dbRead.execute(sql`SELECT NOW() as timestamp`),
      ];

      const results = await Promise.all(promises);

      // All queries should succeed
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
      });

      // Verify connection types
      expect(results[0]?.rows[0]?.connection_type).toBe("primary");
      expect(results[1]?.rows[0]?.connection_type).toBe("replica");
    });

    it("should maintain separate transaction contexts", async () => {
      // Verify that transactions on one connection don't affect the other
      await db.transaction(async (tx) => {
        // Create a temporary table in this transaction
        await tx.execute(sql`
          CREATE TEMPORARY TABLE tx_test (id INTEGER)
        `);

        // Insert data
        await tx.execute(sql`
          INSERT INTO tx_test VALUES (1)
        `);

        // The read replica should not see this temporary table
        // (and shouldn't error because it's in a different connection)
        const replicaResult = await dbRead.execute(sql`
          SELECT 1 as separate_connection
        `);

        expect(replicaResult.rows[0]?.separate_connection).toBe(1);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle connection errors gracefully", async () => {
      // Test invalid query handling
      await expect(
        db.execute(sql`SELECT * FROM non_existent_table_xyz`),
      ).rejects.toThrow();

      await expect(
        dbRead.execute(sql`SELECT * FROM non_existent_table_xyz`),
      ).rejects.toThrow();
    });

    it("should maintain connection after errors", async () => {
      // After an error, connections should still work
      try {
        await db.execute(sql`SELECT * FROM non_existent_table`);
      } catch {
        // Expected to fail
      }

      // Connection should still work
      const result = await db.execute(sql`SELECT 1 as recovery_test`);
      expect(result.rows[0]?.recovery_test).toBe(1);

      // Same for read replica
      try {
        await dbRead.execute(sql`SELECT * FROM non_existent_table`);
      } catch {
        // Expected to fail
      }

      const replicaResult = await dbRead.execute(
        sql`SELECT 1 as recovery_test`,
      );
      expect(replicaResult.rows[0]?.recovery_test).toBe(1);
    });
  });

  describe("Performance and Load Distribution", () => {
    it("should execute read queries efficiently on replica", async () => {
      const startTime = Date.now();

      // Execute multiple read queries on replica
      const queries = Array(5)
        .fill(0)
        .map(() =>
          dbRead.execute(sql`SELECT COUNT(*) FROM information_schema.tables`),
        );

      await Promise.all(queries);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds should be more than enough
    });

    it("should allow mixed read/write operations", async () => {
      // Create a temp table for testing
      await db.execute(sql`
        CREATE TEMPORARY TABLE mixed_ops_test (
          id SERIAL PRIMARY KEY,
          value TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Insert some data (write operation)
      await db.execute(sql`
        INSERT INTO mixed_ops_test (value)
        VALUES ('test1'), ('test2'), ('test3')
      `);

      // Read from primary (for consistency)
      const primaryResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM mixed_ops_test
      `);
      expect(primaryResult.rows[0]?.count).toBe("3");

      // Demonstrate that different connections work independently
      const systemQuery = await dbRead.execute(sql`
        SELECT current_user as username
      `);
      expect(systemQuery.rows[0]?.username).toBeDefined();
    });
  });
});
