/* eslint-disable @typescript-eslint/no-unused-vars */
import { appendFileSync } from "fs";
import { resolve } from "path";
import { Awaitable } from "vitest";
import type {
  Reporter,
  SerializedError,
  TestModule,
  TestRunEndReason,
  TestSpecification,
} from "vitest/node";

/**
 * Custom Vitest reporter that logs test results to e2e-server.log file.
 */
class LogReporter implements Reporter {
  logFile: string;
  constructor() {
    this.logFile = resolve(__dirname, "../e2e-server.log");
  }

  onTestRunStart(
    specifications: ReadonlyArray<TestSpecification>,
  ): Awaitable<void> {
    this.log("==== VITEST RUN STARTED ====");
  }

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    reason: TestRunEndReason,
  ): Awaitable<void> {
    this.log("\n==== VITEST TEST SUITE COMPLETED ====");
  }

  log(message: string) {
    appendFileSync(this.logFile, message + "\n");
  }
}

export default LogReporter;
