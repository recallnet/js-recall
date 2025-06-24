/* eslint-disable @typescript-eslint/no-unused-vars */
import { appendFileSync, readFileSync } from "fs";
import { resolve } from "path";
import type {
  Reporter,
  SerializedError,
  TestModule,
  TestRunEndReason,
} from "vitest/node";
import type { TestCase } from "vitest/node";

import { testContextManager } from "./test-context-manager.js";

/**
 * Custom Vitest reporter that logs test results to e2e-server.log file
 * and tracks test failures through Vitest's proper reporter API.
 */
class LogReporter implements Reporter {
  logFile: string;
  startTime: number;

  constructor(options?: Record<string, unknown>) {
    this.logFile = resolve(__dirname, "../e2e-server.log");
    this.startTime = Date.now();
  }

  onInit(): void {
    // Nothing needed on init
  }

  onTestRunStart(): void {
    this.log("==== VITEST TEST SUITE STARTED ====");
  }

  /**
   * Called when test case is ready to run.
   * We use this to log the start of each test.
   */
  onTestCaseReady(testCase: TestCase): void {
    this.log(`[Test] Starting test: ${testCase.fullName}`);

    // Update test context manager with current test name
    const testName = testCase.fullName || testCase.name || "";
    if (testName.includes("sandbox")) {
      testContextManager.setCurrentTestFile("sandbox.test");
    } else if (testName.includes("leaderboard")) {
      testContextManager.setCurrentTestFile("leaderboard-access.test");
    } else if (testName.includes("trading")) {
      testContextManager.setCurrentTestFile("trading.test");
    } else if (testName.includes("base-trades")) {
      testContextManager.setCurrentTestFile("base-trades.test");
    } else {
      testContextManager.setCurrentTestFile("other.test");
    }
  }

  /**
   * Called after the test and its hooks are finished running.
   * We use this to log test completion and track failures.
   */
  onTestCaseResult(testCase: TestCase): void {
    const result = testCase.result();

    // If the test failed, log the failure with error details
    if (result.state === "failed") {
      this.log(`[Test] Failed test: ${testCase.fullName}`);

      // Log the error details if available
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((error, index) => {
          if (error.message) {
            // Clean up the error message for better readability
            const cleanMessage = error.message
              .replace(/\n\s+/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            this.log(`[Test] Error ${index + 1}: ${cleanMessage}`);
          }

          // Also log the error type if available
          if (error.name && error.name !== "Error") {
            this.log(`[Test] Error Type: ${error.name}`);
          }

          // Log stack trace information if available
          if (error.stack) {
            // Extract relevant parts of the stack trace
            const stackLines = error.stack.split("\n");
            // Find the first line that contains our test file
            const testFileStack = stackLines.find(
              (line) => line.includes(".test.") || line.includes("e2e/tests/"),
            );

            if (testFileStack) {
              // Clean up the stack line to show just the relevant part
              const cleanStack = testFileStack
                .trim()
                .replace(/^\s*at\s+/, "") // Remove "at " prefix
                .replace(/file:\/\/[^)]+/, "") // Remove file:// URLs
                .replace(/\(.+node_modules.+\)/, "") // Remove node_modules references
                .trim();

              if (cleanStack) {
                this.log(`[Test] Location: ${cleanStack}`);
              }
            }
          }

          // Log source location if available (line/column numbers)
          if (
            error.loc &&
            typeof error.loc === "object" &&
            "line" in error.loc &&
            "column" in error.loc
          ) {
            this.log(
              `[Test] Source: Line ${error.loc.line}, Column ${error.loc.column}`,
            );
          }

          // If there's a diff (for assertion errors), log it
          if (error.diff) {
            this.log(`[Test] Diff: ${error.diff}`);
          }
        });
      }
    }

    // Always log test completion
    this.log(`[Test] Completed test: ${testCase.fullName}`);
  }

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    reason: TestRunEndReason,
  ): void {
    // Process the log file to count tests
    this.processLogFile();
  }

  // This function reads the current log file and counts tests
  processLogFile(): void {
    try {
      const logContent = readFileSync(this.logFile, "utf8");
      const lines = logContent.split("\n");

      // Count test results
      const testStartLines = lines.filter((line) =>
        line.includes("[Test] Starting test:"),
      );
      const testFailLines = lines.filter((line) =>
        line.includes("[Test] Failed test:"),
      );
      const testCompleteLines = lines.filter((line) =>
        line.includes("[Test] Completed test:"),
      );

      // Calculate counts
      const total = testStartLines.length;
      const failed = testFailLines.length;
      const passed = testCompleteLines.length - failed;
      const pending = total - passed - failed;

      // Count unique test files (using test names before the first '>')
      const testFiles = new Set<string>();
      for (const line of testStartLines) {
        const match = line.match(/\[Test\] Starting test: ([^>]+)/);
        if (match && match[1]) {
          testFiles.add(match[1].trim());
        }
      }

      // Determine file success/failure
      let filesFailed = 0;
      if (failed > 0) filesFailed = 1;

      const filesPassed = testFiles.size - filesFailed;
      const filesPending = testFiles.size === 0 ? 1 : 0;

      // Log the counts
      this.log("\n==== VITEST TEST SUITE COMPLETED ====");
      this.log(`Tests: ${passed} passed, ${failed} failed, ${pending} pending`);
      this.log(
        `Test Suites: ${filesPassed} passed, ${filesFailed} failed, ${filesPending} pending`,
      );
      this.log(`Time: ${Date.now()}ms`);

      // Add detailed test results
      this.log("\n==== DETAILED TEST RESULTS ====");

      // Group tests by their suite name
      const testsBySuite = new Map<
        string,
        { passed: string[]; failed: string[] }
      >();

      for (const line of testStartLines) {
        const testMatch = line.match(/\[Test\] Starting test: ([^>]+) > (.+)/);
        if (testMatch && testMatch[1] && testMatch[2]) {
          const suite = testMatch[1].trim();
          const testName = testMatch[2].trim();

          if (!testsBySuite.has(suite)) {
            testsBySuite.set(suite, { passed: [], failed: [] });
          }

          // Check if this test failed
          const testFailed = testFailLines.some((failLine) =>
            failLine.includes(`[Test] Failed test: ${suite} > ${testName}`),
          );

          if (testFailed) {
            testsBySuite.get(suite)?.failed.push(testName);
          } else if (
            testCompleteLines.some((completeLine) =>
              completeLine.includes(
                `[Test] Completed test: ${suite} > ${testName}`,
              ),
            )
          ) {
            testsBySuite.get(suite)?.passed.push(testName);
          }
        }
      }

      // Print results by suite
      for (const [suite, results] of testsBySuite.entries()) {
        this.log(`\nSuite: ${suite}`);
        this.log(
          `  Summary: ${results.passed.length} passed, ${results.failed.length} failed`,
        );

        // List passed tests
        for (const test of results.passed) {
          this.log(`  ✅ PASS: ${test}`);
        }

        // List failed tests
        for (const test of results.failed) {
          this.log(`  ❌ FAIL: ${test}`);
        }
      }
    } catch (error) {
      this.log(`Error processing log file: ${error}`);
    }
  }

  log(message: string) {
    appendFileSync(this.logFile, message + "\n");
  }
}

export default LogReporter;
