/**
 * Test Context Manager
 *
 * This utility manages global test context and environment variables during test execution.
 * It allows tests to dynamically configure environment variables based on the current test context.
 */
import fs from "fs";
import path from "path";

/**
 * Interface for test-specific environment configurations
 */
interface TestEnvironmentConfig {
  [key: string]: string | undefined;
}

/**
 * Interface for test context information
 */
interface TestContext {
  testFile?: string;
  testName?: string;
  suiteName?: string;
  environmentOverrides?: TestEnvironmentConfig;
}

/**
 * Interface for debug information returned by getDebugInfo()
 */
interface TestContextDebugInfo {
  currentContext: TestContext;
  originalEnvValues: Record<string, string | undefined>;
  initialized: boolean;
  relevantEnvVars: {
    SANDBOX?: string;
    DISABLE_PARTICIPANT_LEADERBOARD_ACCESS?: string;
    MAX_TRADE_PERCENTAGE?: string;
    TEST_MODE?: string;
  };
}

/**
 * Global test context manager singleton
 */
class TestContextManager {
  private static instance: TestContextManager;
  private currentContext: TestContext = {};
  private originalEnvValues: Record<string, string | undefined> = {};
  private initialized = false;
  private currentTestFile: string | undefined = undefined;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): TestContextManager {
    if (!TestContextManager.instance) {
      TestContextManager.instance = new TestContextManager();
    }
    return TestContextManager.instance;
  }

  /**
   * Initialize the test context manager
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
  }

  /**
   * Set the current test context
   */
  setTestContext(context: TestContext): void {
    this.currentContext = { ...context };

    // Apply environment overrides if provided
    if (context.environmentOverrides) {
      this.applyEnvironmentOverrides(context.environmentOverrides);
    } else {
      // Auto-detect environment overrides based on test file patterns
      this.autoApplyEnvironmentOverrides();
    }
  }

  /**
   * Get the current test context
   */
  getCurrentContext(): TestContext {
    return { ...this.currentContext };
  }

  /**
   * Get a specific environment variable, considering any active overrides
   */
  getEnvironmentVariable(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(overrides: TestEnvironmentConfig): void {
    for (const [key, value] of Object.entries(overrides)) {
      // Store original value if we haven't already
      if (!(key in this.originalEnvValues)) {
        this.originalEnvValues[key] = process.env[key];
      }

      // Apply override
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }

      this.log(`Environment override applied: ${key}=${value || "undefined"}`);
    }
  }

  /**
   * Auto-detect and apply environment overrides based on test file patterns
   */
  private autoApplyEnvironmentOverrides(): void {
    const testFile = this.currentTestFile;
    this.log(
      `Auto-applying environment overrides for test file: ${testFile || "undefined"}`,
    );

    if (!testFile) {
      this.log("No test file detected, skipping environment overrides");
      return;
    }

    const overrides: TestEnvironmentConfig = {};

    // Pattern-based environment configuration
    if (testFile.includes("sandbox.test")) {
      overrides.SANDBOX = "true";
      this.log(
        `Detected sandbox test file: ${testFile} - setting SANDBOX=true`,
      );
    } else {
      overrides.SANDBOX = "false";
      this.log(`Non-sandbox test file: ${testFile} - setting SANDBOX=false`);
    }

    if (testFile.includes("leaderboard-access.test")) {
      overrides.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS = "true";
    } else {
      overrides.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS = "false";
    }

    if (testFile.includes("trading.test")) {
      overrides.MAX_TRADE_PERCENTAGE = "10";
    }

    if (testFile.includes("base-trades.test")) {
      overrides.MAX_TRADE_PERCENTAGE = "15";
    }

    // Apply the detected overrides
    if (Object.keys(overrides).length > 0) {
      this.applyEnvironmentOverrides(overrides);
    }
  }

  /**
   * Clear test context and restore original environment variables
   */
  clearTestContext(): void {
    // Restore original environment variables
    for (const [key, originalValue] of Object.entries(this.originalEnvValues)) {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }

    this.originalEnvValues = {};
    this.currentContext = {};
  }

  /**
   * Reset the manager (for testing purposes)
   */
  reset(): void {
    this.clearTestContext();
    this.initialized = false;
  }

  /**
   * Log messages with test context
   */
  private log(message: string): void {
    const logFile = path.resolve(__dirname, "../e2e-server.log");
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [TestContextManager] ${message}`;

    console.log(logMessage);

    // Append to log file if it exists
    try {
      if (fs.existsSync(logFile)) {
        fs.appendFileSync(logFile, logMessage + "\n");
      }
    } catch (error) {
      // Ignore file write errors
      console.error(
        `[TestContextManager] Failed to write to log file: ${error}`,
      );
    }
  }

  /**
   * Set the current test file (called by the reporter)
   */
  setCurrentTestFile(testFile: string): void {
    this.currentTestFile = testFile;
    this.log(`Current test file updated to: ${this.currentTestFile}`);
  }

  /**
   * Get the current test file
   */
  getCurrentTestFile(): string | undefined {
    return this.currentTestFile;
  }

  /**
   * Get debug information about the current state
   */
  getDebugInfo(): TestContextDebugInfo {
    return {
      currentContext: this.currentContext,
      originalEnvValues: this.originalEnvValues,
      initialized: this.initialized,
      relevantEnvVars: {
        SANDBOX: process.env.SANDBOX,
        DISABLE_PARTICIPANT_LEADERBOARD_ACCESS:
          process.env.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS,
        MAX_TRADE_PERCENTAGE: process.env.MAX_TRADE_PERCENTAGE,
        TEST_MODE: process.env.TEST_MODE,
      },
    };
  }
}

// Export singleton instance
export const testContextManager = TestContextManager.getInstance();

/**
 * Helper function to set up test context with automatic file detection
 */
export function setupTestContext(options: Partial<TestContext> = {}): void {
  const testFile = options.testFile || testContextManager.getCurrentTestFile();

  testContextManager.setTestContext({
    testFile,
    ...options,
  });
}

/**
 * Helper function to clear test context
 */
export function clearTestContext(): void {
  testContextManager.clearTestContext();
}
