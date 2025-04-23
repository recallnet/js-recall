const fs = require('fs');
const path = require('path');

/**
 * Custom Jest reporter that logs test results to e2e-server.log file
 */
class LogReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options;
    this.logFile = path.resolve(__dirname, '../e2e-server.log');
  }

  onRunStart(results, options) {
    this.log('==== JEST TEST SUITE STARTED ====');
  }

  onTestStart(test) {
    this.log(`\n[TEST START] ${test.path}`);
  }

  onTestResult(test, testResult, aggregatedResult) {
    const { testResults, testFilePath } = testResult;

    this.log(`\n[TEST RESULTS] ${testFilePath}`);
    this.log(
      `Tests: ${testResult.numPassingTests} passed, ${testResult.numFailingTests} failed, ${testResult.numPendingTests} pending`,
    );

    // Log individual test results
    testResults.forEach((result) => {
      const status =
        result.status === 'passed' ? '✅ PASS' : result.status === 'failed' ? '❌ FAIL' : '⏸️ SKIP';
      this.log(`${status}: ${result.fullName}`);

      // Log failures in detail
      if (result.status === 'failed') {
        result.failureMessages.forEach((failure) => {
          this.log(`  Error: ${failure}`);
        });
      }
    });
  }

  onRunComplete(contexts, results) {
    this.log('\n==== JEST TEST SUITE COMPLETED ====');
    this.log(
      `Tests: ${results.numPassedTests} passed, ${results.numFailedTests} failed, ${results.numPendingTests} pending`,
    );
    this.log(
      `Test Suites: ${results.numPassedTestSuites} passed, ${results.numFailedTestSuites} failed, ${results.numPendingTestSuites} pending`,
    );
    this.log(`Time: ${results.startTime - results.endTime}ms`);
  }

  log(message) {
    fs.appendFileSync(this.logFile, message + '\n');
  }
}

module.exports = LogReporter;
