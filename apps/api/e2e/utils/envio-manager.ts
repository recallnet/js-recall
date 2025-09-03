/**
 * Envio Manager for E2E Tests
 *
 * This utility manages the Envio HyperIndex indexer lifecycle for end-to-end tests.
 * It starts the real Envio indexer setup exactly as in development.
 *
 * Features:
 * - Runs Envio codegen to setup GraphQL schema
 * - Starts the actual Envio indexer (which manages its own Docker containers)
 * - Provides health checks and cleanup
 *
 * Important Notes:
 * - Envio's `pnpm dev` command internally manages PostgreSQL and Hasura containers
 * - We don't need to manage Docker containers or RPC endpoints manually
 * - Envio handles all blockchain connectivity via its own configured RPC endpoints
 * - We simply query the indexed data via Envio's GraphQL endpoint
 */
import axios from "axios";
import { ChildProcess, execSync, spawn } from "child_process";
import path from "path";

export class EnvioManager {
  private static instance: EnvioManager;
  private envioProcess: ChildProcess | null = null;
  private dockerStarted = false;
  private readonly indexerPath: string;
  private readonly graphqlEndpoint = "http://localhost:8080/v1/graphql";
  private readonly hasuraHealthEndpoint = "http://localhost:8080/healthz";

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Path to envio-indexer from the api directory
    this.indexerPath = path.resolve(process.cwd(), "../envio-indexer");
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): EnvioManager {
    if (!EnvioManager.instance) {
      EnvioManager.instance = new EnvioManager();
    }
    return EnvioManager.instance;
  }

  /**
   * Start the Envio indexer infrastructure
   * Note: Envio dev command manages its own Docker containers
   */
  async start(): Promise<void> {
    console.log("🚀 Starting Envio indexer for E2E tests...");

    try {
      // 1. Ensure Docker is running (Envio needs it)
      await this.checkDocker();

      // 2. Handle codegen appropriately for each environment
      if (process.env.CI) {
        // In CI: codegen was already run during the build phase
        console.log("🔧 Skipping codegen (already done in CI build)");
      } else {
        // Locally: we need to run codegen before starting dev:latest
        console.log("🔧 Running Envio codegen...");
        await this.runCodegen();
      }

      // 3. Start the Envio indexer (it will manage its own Docker containers)
      console.log(
        "🎯 Starting Envio indexer (with built-in Docker management)...",
      );
      await this.startIndexer();
      this.dockerStarted = true;

      // 4. Wait for Hasura to be ready (started by envio dev)
      console.log("⏳ Waiting for Hasura GraphQL Engine...");
      await this.waitForHasura();

      // 5. Wait for indexer to be ready
      console.log("⏳ Waiting for indexer to sync...");
      await this.waitForIndexer();

      console.log("✅ Envio indexer is ready!");
    } catch (error) {
      console.error("❌ Failed to start Envio indexer:", error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop the Envio indexer and clean up resources
   * Note: We need to explicitly clean up Docker containers as Envio doesn't always clean them up
   */
  async stop(): Promise<void> {
    console.log("🧹 Stopping Envio indexer...");

    // Kill the indexer process
    if (this.envioProcess) {
      try {
        this.envioProcess.kill("SIGTERM");
        this.envioProcess = null;
      } catch (error) {
        console.error("Error killing Envio process:", error);
      }
    }

    // Clean up Docker containers that Envio creates
    // These containers start with "generated-" prefix
    try {
      console.log("🐳 Cleaning up Docker containers...");

      // Stop containers (they have names like generated-envio-postgres-1, generated-graphql-engine-1)
      execSync(
        "sh -c 'docker ps -q --filter \"name=generated-\" 2>/dev/null | xargs -r docker stop 2>/dev/null || true'",
        { stdio: "pipe" },
      );

      // Remove the stopped containers
      execSync(
        "sh -c 'docker ps -aq --filter \"name=generated-\" 2>/dev/null | xargs -r docker rm 2>/dev/null || true'",
        { stdio: "pipe" },
      );

      console.log("✅ Docker containers cleaned up");
    } catch {
      // Ignore errors during cleanup - containers might not exist
    }

    this.dockerStarted = false;
    console.log("✅ Envio indexer stopped");
  }

  /**
   * Check if Docker is running
   */
  private async checkDocker(): Promise<void> {
    try {
      execSync("docker --version", { stdio: "pipe" });
      // docker-compose is not needed since envio manages its own containers
    } catch {
      throw new Error(
        "Docker is not installed or not running. Please install Docker Desktop.",
      );
    }
  }

  // Removed startDockerContainers method - Envio manages its own containers

  /**
   * Wait for Hasura GraphQL Engine to be ready
   */
  private async waitForHasura(
    maxRetries = 60, // Increased from 30 to 60 for CI
    retryDelay = 1000,
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(this.hasuraHealthEndpoint);
        if (response.status === 200) {
          console.log(`✅ Hasura is ready after ${i + 1} attempts`);
          return;
        }
      } catch {
        // Expected to fail until Hasura is ready
        if (i % 10 === 0 && i > 0) {
          console.log(
            `⏳ Still waiting for Hasura... (${i}/${maxRetries} attempts)`,
          );
        }
      }

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error("Hasura failed to start within timeout");
  }

  /**
   * Run Envio codegen to setup GraphQL schema
   */
  private async runCodegen(): Promise<void> {
    try {
      execSync("pnpm codegen", {
        cwd: this.indexerPath,
        stdio: "pipe", // Changed from inherit to avoid blocking terminal
        env: {
          ...process.env,
          // Envio manages its own database connections
        },
      });
    } catch (error) {
      throw new Error(`Failed to run Envio codegen: ${error}`);
    }
  }

  /**
   * Start the Envio indexer process
   */
  private async startIndexer(): Promise<void> {
    return new Promise((resolve, reject) => {
      // In CI, blocks were already updated during build phase, use regular dev
      // Locally, use dev:latest to update blocks in generated files
      const command = process.env.CI ? "dev" : "dev:latest";

      this.envioProcess = spawn("pnpm", [command], {
        cwd: this.indexerPath,
        stdio: ["pipe", "pipe", "pipe"], // Changed from inherit to avoid blocking terminal
        env: {
          ...process.env,
          // Envio manages its own RPC connections and database
          // No need to provide RPC endpoints - they're configured in config.yaml
        },
      });

      this.envioProcess.on("error", (error) => {
        reject(new Error(`Failed to start Envio indexer: ${error}`));
      });

      // Give it a moment to start
      setTimeout(resolve, 2000);
    });
  }

  /**
   * Wait for the indexer to be ready and syncing
   */
  private async waitForIndexer(
    maxRetries = 30,
    retryDelay = 1000,
  ): Promise<void> {
    // First, give the indexer time to initialize
    await new Promise((resolve) => setTimeout(resolve, 3000));

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Try to query for any data (even if empty)
        const response = await axios.post(
          this.graphqlEndpoint,
          {
            query: `
              query TestConnection {
                Trade(limit: 1) {
                  id
                }
              }
            `,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        // If we get a response (even empty data), the schema is ready
        if (response.data) {
          console.log("✅ GraphQL schema is ready");
          return;
        }
      } catch {
        // Expected to fail until schema is ready
      }

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error("Envio indexer failed to start within timeout");
  }

  /**
   * Get the GraphQL endpoint URL
   */
  getGraphQLEndpoint(): string {
    return this.graphqlEndpoint;
  }

  /**
   * Check if the indexer is running
   */
  isRunning(): boolean {
    return this.envioProcess !== null && !this.envioProcess.killed;
  }
}

// Export singleton instance
export const envioManager = EnvioManager.getInstance();
