#!/usr/bin/env node
 
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Load coverage configuration
const coverageConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../coverage.config.json"), "utf8"),
);

// Path to previous report (passed as CLI argument)
const pathToPreviousReport = process.argv[2];

/**
 * Finds all coverage-summary.json files in the monorepo
 * Handles both Vitest and c8 coverage report formats
 */
function findCoverageSummaries() {
  const summaries = {};
  const rootDir = path.join(__dirname, "..");

  // Get all apps and packages
  const apps = fs
    .readdirSync(path.join(rootDir, "apps"), { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `apps/${dirent.name}`);

  const packages = fs
    .readdirSync(path.join(rootDir, "packages"), { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `packages/${dirent.name}`);

  [...apps, ...packages].forEach((packagePath) => {
    // Check for coverage-summary.json (Vitest format)
    const vitestSummary = path.join(
      rootDir,
      packagePath,
      "coverage/coverage-summary.json",
    );
    // Check for coverage/coverage-summary.json (c8 format)
    const c8Summary = path.join(
      rootDir,
      packagePath,
      "coverage/coverage-summary.json",
    );

    if (fs.existsSync(vitestSummary)) {
      summaries[packagePath] = vitestSummary;
    } else if (fs.existsSync(c8Summary)) {
      summaries[packagePath] = c8Summary;
    }
  });

  return summaries;
}

/**
 * Reads and aggregates all coverage summaries
 */
function aggregateCoverage(summaryPaths) {
  const aggregated = {};
  const totals = {
    lines: { total: 0, covered: 0 },
    statements: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
  };

  Object.entries(summaryPaths).forEach(([packageName, summaryPath]) => {
    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
      const packageTotal = summary.total;

      aggregated[packageName] = packageTotal;

      // Aggregate totals
      Object.keys(totals).forEach((key) => {
        totals[key].total += packageTotal[key].total;
        totals[key].covered += packageTotal[key].covered;
      });
    } else {
      console.warn(`Coverage summary not found for ${packageName}`);
      aggregated[packageName] = {
        lines: { pct: 0, total: 0, covered: 0 },
        statements: { pct: 0, total: 0, covered: 0 },
        functions: { pct: 0, total: 0, covered: 0 },
        branches: { pct: 0, total: 0, covered: 0 },
      };
    }
  });

  // Calculate total percentages
  const total = {};
  Object.keys(totals).forEach((key) => {
    const pct =
      totals[key].total > 0
        ? (totals[key].covered / totals[key].total) * 100
        : 0;
    total[key] = {
      ...totals[key],
      pct: parseFloat(pct.toFixed(2)),
    };
  });

  return { total, ...aggregated };
}

/**
 * Reads previous coverage report if provided
 */
function readPreviousCoverage(pathToReport) {
  if (!pathToReport || !fs.existsSync(pathToReport)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(pathToReport, "utf8"));
}

/**
 * Calculates the difference between current and previous coverage
 */
function calculateDiff(current, previous) {
  if (!previous) return current;

  const diff = {};
  Object.keys(current).forEach((packageName) => {
    diff[packageName] = {};
    const metrics = ["lines", "statements", "functions", "branches"];

    metrics.forEach((metric) => {
      const currPct = current[packageName]?.[metric]?.pct || 0;
      const prevPct = previous[packageName]?.[metric]?.pct || 0;

      diff[packageName][metric] = {
        ...current[packageName][metric],
        diff: parseFloat((currPct - prevPct).toFixed(2)),
      };
    });
  });

  return diff;
}

/**
 * Checks coverage against thresholds
 */
function checkThresholds(coverage) {
  const failures = [];

  // Check global thresholds for total
  const globalThresholds = coverageConfig.global.thresholds;
  Object.entries(globalThresholds).forEach(([metric, threshold]) => {
    const actual = coverage.total[metric].pct;
    if (actual < threshold) {
      failures.push({
        package: "total",
        metric,
        threshold,
        actual,
      });
    }
  });

  // Check per-package thresholds
  Object.entries(coverage).forEach(([packageName, metrics]) => {
    if (packageName === "total") return;

    const packageConfig = coverageConfig.packages[packageName];
    const thresholds = packageConfig?.thresholds || globalThresholds;

    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const actual = metrics[metric].pct;
      if (actual < threshold) {
        failures.push({
          package: packageName,
          metric,
          threshold,
          actual,
        });
      }
    });
  });

  return failures;
}

/**
 * Formats coverage for console output
 */
function formatCoverageTable(coverage) {
  const table = {};

  Object.entries(coverage).forEach(([packageName, metrics]) => {
    table[packageName] = {
      lines: formatMetric(metrics.lines),
      statements: formatMetric(metrics.statements),
      functions: formatMetric(metrics.functions),
      branches: formatMetric(metrics.branches),
    };
  });

  return table;
}

function formatMetric(metric) {
  const pct = metric.pct.toFixed(2);
  if (metric.diff !== undefined && metric.diff !== 0) {
    const sign = metric.diff > 0 ? "+" : "";
    return `${pct}% (${sign}${metric.diff}%)`;
  }
  return `${pct}%`;
}

/**
 * Saves coverage report with timestamp
 */
function saveCoverageReport(coverage) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

  const dir = path.join(__dirname, "../coverage-reports");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = `coverage-total.${timestamp}.json`;
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, JSON.stringify(coverage, null, 2));
  fs.writeFileSync(
    path.join(dir, "coverage-total.latest.json"),
    JSON.stringify(coverage, null, 2),
  );

  console.log(`\nCoverage report saved to: ${filepath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log("🔍 Collecting coverage reports...\n");

  // Find all coverage summaries
  const summaryPaths = findCoverageSummaries();

  // Aggregate coverage
  const currentCoverage = aggregateCoverage(summaryPaths);

  // Read previous coverage if provided
  const previousCoverage = readPreviousCoverage(pathToPreviousReport);

  // Calculate diff
  const coverageWithDiff = calculateDiff(currentCoverage, previousCoverage);

  // Format for display
  const table = formatCoverageTable(coverageWithDiff);

  // Display table
  console.log("📊 Coverage Report");
  console.table(table);

  // Check thresholds
  const failures = checkThresholds(currentCoverage);

  if (failures.length > 0) {
    console.error("\n❌ Coverage thresholds not met:");
    failures.forEach(({ package: pkg, metric, threshold, actual }) => {
      console.error(
        `   ${pkg} - ${metric}: ${actual.toFixed(2)}% (required: ${threshold}%)`,
      );
    });

    // Save report before exiting
    saveCoverageReport(currentCoverage);
    process.exit(1);
  } else {
    console.log("\n✅ All coverage thresholds met!");
  }

  // Save report
  saveCoverageReport(currentCoverage);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

module.exports = { checkThresholds, aggregateCoverage };
