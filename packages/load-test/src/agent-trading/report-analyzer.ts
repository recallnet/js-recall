#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";

interface ArtilleryReport {
  aggregate: {
    counters: Record<string, number>;
    rates: Record<string, number>;
    summaries: Record<
      string,
      {
        min: number;
        max: number;
        mean: number;
        median: number;
        p50: number;
        p75: number;
        p90: number;
        p95: number;
        p99: number;
        p999: number;
        count: number;
      }
    >;
  };
  intermediate?: Array<{
    counters: Record<string, number>;
    rates: Record<string, number>;
    summaries: Record<
      string,
      {
        min: number;
        max: number;
        mean: number;
        median: number;
        p95: number;
        p99: number;
      }
    >;
  }>;
}

interface PerformanceThresholds {
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxErrorRate: number;
  minThroughput: number;
}

interface ConsolidatedAnalysis {
  reports: Array<{
    name: string;
    timestamp: string;
    analysis: ReturnType<typeof analyzeReport>;
  }>;
  testProfile: string;
  aggregates: {
    p95: { min: number; max: number; avg: number; stddev: number };
    p99: { min: number; max: number; avg: number; stddev: number };
    errorRate: { min: number; max: number; avg: number; stddev: number };
    throughput: { min: number; max: number; avg: number; stddev: number };
  };
  trend: {
    p95Change: number;
    errorRateChange: number;
    throughputChange: number;
  };
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  p95ResponseTime: 500, // ms
  p99ResponseTime: 1000, // ms
  maxErrorRate: 0.01, // 1%
  minThroughput: 5, // req/s
};

function loadReport(filePath: string): ArtilleryReport {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

interface ResponseTimeMetrics {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  p50?: number;
  p75?: number;
  p90?: number;
  p95?: number;
  p99?: number;
  [key: string]: number | undefined;
}

function analyzeReport(
  report: ArtilleryReport,
  thresholds = DEFAULT_THRESHOLDS,
): {
  passed: boolean;
  metrics: {
    responseTime: ResponseTimeMetrics;
    errorRate: number;
    throughput: number;
    totalRequests: number;
    successfulRequests: number;
    clientErrors: number;
    serverErrors: number;
    failedVUsers: number;
    completedVUsers: number;
  };
  issues: string[];
} {
  const responseTimeSummary = report.aggregate.summaries["http.response_time"];
  const responseTime: ResponseTimeMetrics = responseTimeSummary || {};

  const metrics = {
    throughput: report.aggregate.rates["http.request_rate"] || 0,
    totalRequests: report.aggregate.counters["http.requests"] || 0,
    successfulRequests: report.aggregate.counters["http.codes.200"] || 0,
    clientErrors: report.aggregate.counters["http.codes.4xx"] || 0,
    serverErrors: report.aggregate.counters["http.codes.5xx"] || 0,
    failedVUsers: report.aggregate.counters["vusers.failed"] || 0,
    completedVUsers: report.aggregate.counters["vusers.completed"] || 0,
    responseTime,
  };

  const errorRate =
    (metrics.clientErrors + metrics.serverErrors) /
    Math.max(1, metrics.totalRequests);
  const issues: string[] = [];

  // Check thresholds
  const p95 = metrics.responseTime.p95;
  if (p95 !== undefined && p95 > thresholds.p95ResponseTime) {
    issues.push(
      `❌ P95 response time (${p95}ms) exceeds threshold (${thresholds.p95ResponseTime}ms)`,
    );
  }

  const p99 = metrics.responseTime.p99;
  if (p99 !== undefined && p99 > thresholds.p99ResponseTime) {
    issues.push(
      `❌ P99 response time (${p99}ms) exceeds threshold (${thresholds.p99ResponseTime}ms)`,
    );
  }

  if (errorRate > thresholds.maxErrorRate) {
    issues.push(
      `❌ Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(thresholds.maxErrorRate * 100).toFixed(2)}%)`,
    );
  }

  if (metrics.throughput < thresholds.minThroughput) {
    issues.push(
      `❌ Throughput (${metrics.throughput} req/s) below minimum (${thresholds.minThroughput} req/s)`,
    );
  }

  return {
    passed: issues.length === 0,
    metrics: {
      ...metrics,
      errorRate,
    },
    issues,
  };
}

function generateMarkdown(
  analysis: ReturnType<typeof analyzeReport>,
  reportName: string,
  comparison?: ReturnType<typeof analyzeReport>,
): string {
  const date = new Date().toISOString().split("T")[0];
  const { passed, metrics, issues } = analysis;

  let markdown = `# Load Test Report - ${date}\n\n`;
  markdown += `## ${passed ? "✅ PASSED" : "❌ FAILED"}\n\n`;

  // Executive Summary
  markdown += `### Executive Summary\n\n`;
  markdown += `- **Test Profile**: ${reportName}\n`;
  markdown += `- **Total Requests**: ${metrics.totalRequests.toLocaleString()}\n`;
  markdown += `- **Throughput**: ${metrics.throughput} req/s\n`;
  markdown += `- **Error Rate**: ${(metrics.errorRate * 100).toFixed(2)}%\n`;
  markdown += `- **Virtual Users**: ${metrics.completedVUsers} completed, ${metrics.failedVUsers} failed\n\n`;

  // Performance Metrics
  markdown += `### Performance Metrics\n\n`;
  markdown += `#### Response Times\n`;
  markdown += `| Percentile | Time (ms) | ${comparison ? "Previous (ms) | Change |" : ""}\n`;
  markdown += `|------------|-----------|${comparison ? "--------------|--------|" : ""}\n`;

  const percentiles = ["p50", "p75", "p90", "p95", "p99"];
  for (const p of percentiles) {
    const current = metrics.responseTime[p] || 0;
    markdown += `| ${p.toUpperCase()} | ${current.toFixed(0)} |`;

    if (comparison) {
      const prev = comparison.metrics.responseTime[p] || 0;
      const change = (((current - prev) / prev) * 100).toFixed(1);
      const arrow = current > prev ? "↑" : current < prev ? "↓" : "→";
      markdown += ` ${prev.toFixed(0)} | ${arrow} ${Math.abs(parseFloat(change))}% |`;
    }
    markdown += "\n";
  }

  markdown += `\n#### Error Breakdown\n`;
  markdown += `- **2xx Success**: ${metrics.successfulRequests}\n`;
  markdown += `- **4xx Client Errors**: ${metrics.clientErrors}\n`;
  markdown += `- **5xx Server Errors**: ${metrics.serverErrors}\n\n`;

  // Issues
  if (issues.length > 0) {
    markdown += `### Issues Found\n\n`;
    for (const issue of issues) {
      markdown += `- ${issue}\n`;
    }
    markdown += "\n";
  }

  // Recommendations
  markdown += `### Recommendations\n\n`;
  if (!passed) {
    const p95 = metrics.responseTime.p95;
    if (p95 !== undefined && p95 > 500) {
      markdown += `- **Investigate slow endpoints**: P95 latency is high. Check Sentry traces for bottlenecks.\n`;
    }
    if (metrics.errorRate > 0.01) {
      markdown += `- **Review error logs**: High error rate detected. Check application logs and Sentry for root causes.\n`;
    }
    if (metrics.throughput < 5) {
      markdown += `- **Scale infrastructure**: Throughput is below target. Consider scaling or optimizing the backend.\n`;
    }
  } else {
    markdown += `- All performance metrics are within acceptable thresholds.\n`;
    markdown += `- Consider tightening thresholds for continuous improvement.\n`;
  }

  // Sentry Integration Note
  markdown += `\n### Distributed Tracing\n\n`;
  markdown += `Traces from this load test have been sent to Sentry for detailed analysis.\n`;
  markdown += `View them at: [Sentry Performance Dashboard](https://recallnet.sentry.io/performance/)\n`;

  return markdown;
}

// Extract test profile from filename (e.g., "baseline-20250930-102812" -> "baseline")
function extractTestProfile(filename: string): string {
  const basename = path.basename(filename, ".json");
  const match = basename.match(/^([a-z]+)-\d{8}-\d{6}$/);
  return match?.[1] || basename;
}

// Extract timestamp from filename (e.g., "baseline-20250930-102812" -> "20250930-102812")
function extractTimestamp(filename: string): string {
  const basename = path.basename(filename, ".json");
  const match = basename.match(/(\d{8}-\d{6})$/);
  return match?.[1] || "unknown";
}

// Calculate standard deviation
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

// Consolidate multiple reports of the same test type
function consolidateReports(reportPaths: string[]): ConsolidatedAnalysis {
  if (reportPaths.length === 0) {
    throw new Error("No report files provided");
  }

  // Load all reports and extract profiles
  const reportsData = reportPaths.map((filePath) => {
    const report = loadReport(filePath);
    const analysis = analyzeReport(report);
    const basename = path.basename(filePath, ".json");

    return {
      name: basename,
      timestamp: extractTimestamp(filePath),
      profile: extractTestProfile(filePath),
      analysis,
    };
  });

  // Verify all reports are same type
  const profiles = [...new Set(reportsData.map((r) => r.profile))];
  if (profiles.length > 1) {
    throw new Error(
      `Cannot consolidate mixed test types: ${profiles.join(", ")}. All reports must be the same test profile.`,
    );
  }

  const testProfile = profiles[0] || "unknown";

  // Extract metrics
  const p95Values = reportsData
    .map((r) => r.analysis.metrics.responseTime.p95 || 0)
    .filter((v) => v > 0);
  const p99Values = reportsData
    .map((r) => r.analysis.metrics.responseTime.p99 || 0)
    .filter((v) => v > 0);
  const errorRates = reportsData.map((r) => r.analysis.metrics.errorRate);
  const throughputs = reportsData.map((r) => r.analysis.metrics.throughput);

  // Calculate aggregates
  const aggregates = {
    p95: {
      min: Math.min(...p95Values),
      max: Math.max(...p95Values),
      avg: p95Values.reduce((sum, v) => sum + v, 0) / p95Values.length,
      stddev: calculateStdDev(p95Values),
    },
    p99: {
      min: Math.min(...p99Values),
      max: Math.max(...p99Values),
      avg: p99Values.reduce((sum, v) => sum + v, 0) / p99Values.length,
      stddev: calculateStdDev(p99Values),
    },
    errorRate: {
      min: Math.min(...errorRates),
      max: Math.max(...errorRates),
      avg: errorRates.reduce((sum, v) => sum + v, 0) / errorRates.length,
      stddev: calculateStdDev(errorRates),
    },
    throughput: {
      min: Math.min(...throughputs),
      max: Math.max(...throughputs),
      avg: throughputs.reduce((sum, v) => sum + v, 0) / throughputs.length,
      stddev: calculateStdDev(throughputs),
    },
  };

  // Calculate trends (first vs last)
  const firstP95 = p95Values[0] || 1;
  const lastP95 = p95Values[p95Values.length - 1] || 1;
  const firstErrorRate = errorRates[0] || 0.0001;
  const lastErrorRate = errorRates[errorRates.length - 1] || 0.0001;
  const firstThroughput = throughputs[0] || 1;
  const lastThroughput = throughputs[throughputs.length - 1] || 1;

  const trend = {
    p95Change: ((lastP95 - firstP95) / firstP95) * 100,
    errorRateChange: ((lastErrorRate - firstErrorRate) / firstErrorRate) * 100,
    throughputChange:
      ((lastThroughput - firstThroughput) / firstThroughput) * 100,
  };

  return {
    reports: reportsData.map((r) => ({
      name: r.name,
      timestamp: r.timestamp,
      analysis: r.analysis,
    })),
    testProfile,
    aggregates,
    trend,
  };
}

// Generate consolidated markdown report
function generateConsolidatedMarkdown(
  consolidated: ConsolidatedAnalysis,
): string {
  const { reports, testProfile, aggregates, trend } = consolidated;
  const date = new Date().toISOString().split("T")[0];

  let markdown = `# Load Test Trend Analysis - ${testProfile.charAt(0).toUpperCase() + testProfile.slice(1)} Tests\n`;
  markdown += `Generated: ${date}\n`;
  markdown += `Reports Analyzed: ${reports.length}\n\n`;

  // Summary
  markdown += `## Summary\n\n`;

  const bestRun = reports.reduce((best, r) =>
    (r.analysis.metrics.responseTime.p95 || Infinity) <
    (best.analysis.metrics.responseTime.p95 || Infinity)
      ? r
      : best,
  );
  const worstRun = reports.reduce((worst, r) =>
    (r.analysis.metrics.responseTime.p95 || 0) >
    (worst.analysis.metrics.responseTime.p95 || 0)
      ? r
      : worst,
  );

  const trendIndicator =
    Math.abs(trend.p95Change) < 5
      ? "→ Stable"
      : trend.p95Change > 0
        ? "↑ Degrading ⚠️"
        : "↓ Improving ✅";

  markdown += `- **Trend**: ${trendIndicator} (${trend.p95Change > 0 ? "+" : ""}${trend.p95Change.toFixed(1)}% P95 change)\n`;
  markdown += `- **Best Run**: ${bestRun.name} (P95: ${bestRun.analysis.metrics.responseTime.p95?.toFixed(0)}ms)\n`;
  markdown += `- **Worst Run**: ${worstRun.name} (P95: ${worstRun.analysis.metrics.responseTime.p95?.toFixed(0)}ms)\n`;
  markdown += `- **Average P95**: ${aggregates.p95.avg.toFixed(0)}ms (±${aggregates.p95.stddev.toFixed(0)}ms)\n\n`;

  // Detailed metrics comparison
  markdown += `## Metrics Comparison\n\n`;
  markdown += `| Metric | ${reports.map((_, i) => `Run ${i + 1}`).join(" | ")} | Trend | Avg | StdDev |\n`;
  markdown += `|--------|${reports.map(() => "-------").join("|")}|-------|-----|--------|\n`;

  // P95 row
  markdown += `| P95 (ms) |`;
  reports.forEach((r) => {
    markdown += ` ${r.analysis.metrics.responseTime.p95?.toFixed(0) || "N/A"} |`;
  });
  const p95Arrow =
    Math.abs(trend.p95Change) < 5 ? "→" : trend.p95Change > 0 ? "↑" : "↓";
  markdown += ` ${p95Arrow} ${Math.abs(trend.p95Change).toFixed(0)}% | ${aggregates.p95.avg.toFixed(0)} | ${aggregates.p95.stddev.toFixed(0)} |\n`;

  // P99 row
  markdown += `| P99 (ms) |`;
  reports.forEach((r) => {
    markdown += ` ${r.analysis.metrics.responseTime.p99?.toFixed(0) || "N/A"} |`;
  });
  markdown += ` | ${aggregates.p99.avg.toFixed(0)} | ${aggregates.p99.stddev.toFixed(0)} |\n`;

  // Error rate row
  markdown += `| Error Rate |`;
  reports.forEach((r) => {
    markdown += ` ${(r.analysis.metrics.errorRate * 100).toFixed(2)}% |`;
  });
  const errorArrow =
    Math.abs(trend.errorRateChange) < 5
      ? "→"
      : trend.errorRateChange > 0
        ? "↑"
        : "↓";
  markdown += ` ${errorArrow} ${Math.abs(trend.errorRateChange).toFixed(0)}% | ${(aggregates.errorRate.avg * 100).toFixed(2)}% | ${(aggregates.errorRate.stddev * 100).toFixed(2)}% |\n`;

  // Throughput row
  markdown += `| Throughput (req/s) |`;
  reports.forEach((r) => {
    markdown += ` ${r.analysis.metrics.throughput.toFixed(1)} |`;
  });
  const throughputArrow =
    Math.abs(trend.throughputChange) < 5
      ? "→"
      : trend.throughputChange > 0
        ? "↑"
        : "↓";
  markdown += ` ${throughputArrow} ${Math.abs(trend.throughputChange).toFixed(0)}% | ${aggregates.throughput.avg.toFixed(1)} | ${aggregates.throughput.stddev.toFixed(1)} |\n\n`;

  // Recommendations
  markdown += `## Recommendations\n\n`;
  if (trend.p95Change > 10) {
    markdown += `⚠️ **Performance Degrading**: P95 response time increased ${trend.p95Change.toFixed(1)}% over ${reports.length} runs\n`;
    markdown += `→ **Action Required**: Investigate recent changes, check for memory leaks or resource exhaustion\n\n`;
  } else if (trend.p95Change < -10) {
    markdown += `✅ **Performance Improving**: P95 response time decreased ${Math.abs(trend.p95Change).toFixed(1)}% over ${reports.length} runs\n\n`;
  } else {
    markdown += `✅ **Performance Stable**: P95 response time variance within acceptable range (${Math.abs(trend.p95Change).toFixed(1)}%)\n\n`;
  }

  if (trend.errorRateChange > 50) {
    markdown += `⚠️ **Error Rate Increasing**: Error rate increased ${trend.errorRateChange.toFixed(0)}%\n`;
    markdown += `→ **Action Required**: Review application logs and Sentry for root causes\n\n`;
  }

  if (aggregates.p95.stddev > aggregates.p95.avg * 0.2) {
    markdown += `⚠️ **High Variance**: P95 standard deviation is ${((aggregates.p95.stddev / aggregates.p95.avg) * 100).toFixed(0)}% of average\n`;
    markdown += `→ **Consider**: Performance is inconsistent, investigate environmental factors\n\n`;
  }

  // Individual run details
  markdown += `## Individual Run Details\n\n`;
  reports.forEach((report) => {
    const passed = report.analysis.passed ? "✅" : "❌";
    markdown += `### ${passed} ${report.name}\n`;
    markdown += `- **Timestamp**: ${report.timestamp}\n`;
    markdown += `- **Total Requests**: ${report.analysis.metrics.totalRequests.toLocaleString()}\n`;
    markdown += `- **Error Rate**: ${(report.analysis.metrics.errorRate * 100).toFixed(2)}%\n`;
    markdown += `- **P95**: ${report.analysis.metrics.responseTime.p95?.toFixed(0)}ms\n`;
    markdown += `- **P99**: ${report.analysis.metrics.responseTime.p99?.toFixed(0)}ms\n\n`;
  });

  return markdown;
}

// CLI Usage - Check if this file is being run directly
// Using require.main for CommonJS compatibility
if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse CLI flags
  let consolidateMode = false;
  const reportPaths: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "--consolidate") {
      consolidateMode = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Load Test Report Analyzer

Usage:
  tsx report-analyzer.ts <report.json> [baseline.json]
  tsx report-analyzer.ts --consolidate <report1.json> <report2.json> ...

Options:
  --consolidate              Consolidate multiple reports (same test type only)
  -h, --help                 Show this help

Examples:
  # Single report analysis
  tsx report-analyzer.ts reports/baseline-20250930-102812.json

  # Compare against baseline
  tsx report-analyzer.ts reports/baseline-new.json reports/baseline-ref.json

  # Consolidate multiple reports (same type only)
  tsx report-analyzer.ts --consolidate reports/baseline-*.json

  # Consolidate last 5 baseline reports (shell)
  tsx report-analyzer.ts --consolidate $(ls -t reports/baseline-*.json | head -5)
`);
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      reportPaths.push(arg);
    }
  }

  // Consolidation mode
  if (consolidateMode) {
    if (reportPaths.length < 2) {
      console.error("Error: Consolidation requires at least 2 report files");
      process.exit(1);
    }

    // Verify all files exist
    const missingFiles = reportPaths.filter((p) => !fs.existsSync(p));
    if (missingFiles.length > 0) {
      console.error(
        `Error: Report files not found:\n${missingFiles.join("\n")}`,
      );
      process.exit(1);
    }

    console.log(`\n📊 Consolidating ${reportPaths.length} reports...\n`);

    try {
      const consolidated = consolidateReports(reportPaths);
      const markdown = generateConsolidatedMarkdown(consolidated);

      // Save to reports/consolidated-{profile}-{timestamp}.md
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .split("T")[0];
      const outputPath = `reports/consolidated-${consolidated.testProfile}-${timestamp}.md`;

      fs.writeFileSync(outputPath, markdown);

      console.log(markdown);
      console.log(`\n📄 Consolidated report saved to: ${outputPath}`);

      // Exit with success (consolidation doesn't fail on threshold violations)
      process.exit(0);
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }

  // Single report mode (original behavior)
  if (reportPaths.length === 0) {
    console.log("Usage: tsx report-analyzer.ts <report.json> [baseline.json]");
    console.log(
      "       tsx report-analyzer.ts --consolidate <report1> <report2> ...",
    );
    console.log("  Use --help for more options");
    process.exit(1);
  }

  const reportPath = reportPaths[0];
  if (!reportPath || !fs.existsSync(reportPath)) {
    console.error(`Error: Report file not found: ${reportPath}`);
    process.exit(1);
  }

  const report = loadReport(reportPath);
  const analysis = analyzeReport(report);

  let baseline: ReturnType<typeof analyzeReport> | undefined;
  const baselinePath = reportPaths[1];
  if (baselinePath && fs.existsSync(baselinePath)) {
    const baselineReport = loadReport(baselinePath);
    baseline = analyzeReport(baselineReport);
  }

  const reportName = path.basename(reportPath, ".json");
  const markdown = generateMarkdown(analysis, reportName, baseline);

  // Save markdown report
  const outputPath = reportPath.replace(".json", ".md");
  fs.writeFileSync(outputPath, markdown);

  // Print to console
  console.log(markdown);
  console.log(`\n📄 Report saved to: ${outputPath}`);

  // Exit with proper code for CI/CD
  process.exit(analysis.passed ? 0 : 1);
}

export { analyzeReport, generateMarkdown, loadReport };
