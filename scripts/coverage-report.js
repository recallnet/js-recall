#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const COVERAGE_REPORTS_DIR = path.join(__dirname, "../coverage-reports");
const LATEST_REPORT_PATH = path.join(
  COVERAGE_REPORTS_DIR,
  "coverage-total.latest.json",
);
const COVERAGE_METRICS = ["lines", "statements", "functions", "branches"];

const coverageConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../coverage.config.json"), "utf8"),
);

const previousReportPath = process.argv[2] || LATEST_REPORT_PATH;

function aggregateCoverage() {
  const coverage = {};
  const warnings = [];
  const rootDir = path.join(__dirname, "..");

  const appDirs = fs
    .readdirSync(path.join(rootDir, "apps"), { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `apps/${dirent.name}`);

  const packageDirs = fs
    .readdirSync(path.join(rootDir, "packages"), { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `packages/${dirent.name}`);

  [...appDirs, ...packageDirs].forEach((packageName) => {
    const summaryPath = path.join(
      rootDir,
      packageName,
      "coverage/coverage-summary.json",
    );

    if (fs.existsSync(summaryPath)) {
      try {
        const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
        coverage[packageName] = summary.total;
      } catch (error) {
        warnings.push(
          `Failed to read coverage for ${packageName}: ${error.message}`,
        );
        coverage[packageName] = {
          lines: { pct: "ERROR", total: "ERROR", covered: "ERROR" },
          statements: { pct: "ERROR", total: "ERROR", covered: "ERROR" },
          functions: { pct: "ERROR", total: "ERROR", covered: "ERROR" },
          branches: { pct: "ERROR", total: "ERROR", covered: "ERROR" },
        };
      }
    }
  });

  return { coverage, warnings };
}

function readPreviousCoverage(reportPath) {
  if (!reportPath || !fs.existsSync(reportPath)) {
    return null;
  }
  const data = JSON.parse(fs.readFileSync(reportPath, "utf8"));

  // Handle both old and new JSON structure
  return data.coverage || data;
}

function calculateDiff(currentCoverage, previousCoverage) {
  if (!previousCoverage) return currentCoverage;

  const coverageWithDiff = {};
  Object.keys(currentCoverage).forEach((packageName) => {
    coverageWithDiff[packageName] = {};

    COVERAGE_METRICS.forEach((metric) => {
      const currentMetric = currentCoverage[packageName][metric];

      if (currentMetric.pct === "ERROR") {
        coverageWithDiff[packageName][metric] = currentMetric;
        return;
      }

      const current = currentMetric.pct;
      const previous = previousCoverage[packageName]?.[metric]?.pct || 0;

      coverageWithDiff[packageName][metric] = {
        ...currentMetric,
        diff: parseFloat((current - previous).toFixed(2)),
      };
    });
  });

  return coverageWithDiff;
}
function checkThresholds(coverage) {
  const failures = [];

  Object.entries(coverage).forEach(([packageName, packageMetrics]) => {
    const packageConfig = coverageConfig.packages[packageName];

    let thresholds;
    if (packageConfig?.thresholds) {
      thresholds = packageConfig.thresholds;
    } else if (!packageConfig) {
      failures.push({
        package: packageName,
        metric: "config",
        threshold: "must be added to coverage.config.json",
        actual: "missing",
      });
      return;
    } else {
      return;
    }

    Object.entries(thresholds).forEach(([metricName, threshold]) => {
      const actualCoverage = packageMetrics[metricName].pct;
      if (actualCoverage === "ERROR") return;

      if (actualCoverage < threshold) {
        failures.push({
          package: packageName,
          metric: metricName,
          threshold,
          actual: actualCoverage,
        });
      }
    });
  });

  return failures;
}

function formatCoverageTable(coverage) {
  const formattedTable = {};

  Object.entries(coverage).forEach(([packageName, packageMetrics]) => {
    formattedTable[packageName] = {
      lines: formatMetric(packageMetrics.lines),
      statements: formatMetric(packageMetrics.statements),
      functions: formatMetric(packageMetrics.functions),
      branches: formatMetric(packageMetrics.branches),
    };
  });

  return formattedTable;
}

function formatMetric(metric) {
  if (metric.pct === "ERROR") {
    return "ERROR";
  }
  const percentage = metric.pct.toFixed(2);
  if (metric.diff !== undefined && metric.diff !== 0) {
    const sign = metric.diff > 0 ? "+" : "";
    return `${percentage}% (${sign}${metric.diff}%)`;
  }
  return `${percentage}%`;
}
function saveCoverageReport(coverage, warnings = [], violations = []) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

  if (!fs.existsSync(COVERAGE_REPORTS_DIR)) {
    fs.mkdirSync(COVERAGE_REPORTS_DIR, { recursive: true });
  }

  const timestampedFile = `coverage-total.${timestamp}.json`;
  const timestampedPath = path.join(COVERAGE_REPORTS_DIR, timestampedFile);

  const reportData = {
    coverage,
    warnings,
    violations,
  };

  const coverageJson = JSON.stringify(reportData, null, 2);
  fs.writeFileSync(timestampedPath, coverageJson);
  fs.writeFileSync(LATEST_REPORT_PATH, coverageJson);

  console.log(`\nCoverage report saved to: ${timestampedPath}`);
}

function main() {
  console.log("🔍 Collecting coverage reports...\n");

  const { coverage: currentCoverage, warnings } = aggregateCoverage();

  let previousCoverage = null;
  try {
    previousCoverage = readPreviousCoverage(previousReportPath);
  } catch (error) {
    warnings.push(`Failed to read previous coverage report: ${error.message}`);
  }

  const coverageWithDiff = calculateDiff(currentCoverage, previousCoverage);
  const formattedTable = formatCoverageTable(coverageWithDiff);

  console.log("📊 Coverage Report");
  console.table(formattedTable);

  if (warnings.length > 0) {
    console.warn("\n⚠️ Warnings:");
    warnings.forEach((warning) => console.warn(`   ${warning}`));
  }

  const thresholdFailures = checkThresholds(currentCoverage);

  if (thresholdFailures.length > 0) {
    console.error("\n❌ Coverage thresholds not met:");
    thresholdFailures.forEach(({ package: pkg, metric, threshold, actual }) => {
      const displayValue =
        typeof actual === "number" ? `${actual.toFixed(2)}%` : actual;
      console.error(
        `   ${pkg} - ${metric}: ${displayValue} (required: ${threshold})`,
      );
    });

    saveCoverageReport(coverageWithDiff, warnings, thresholdFailures);
    process.exit(1);
  } else {
    console.log("\n✅ All coverage thresholds met!");
  }

  saveCoverageReport(coverageWithDiff, warnings, []);
}

// Run if called directly
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

module.exports = { checkThresholds, aggregateCoverage };
