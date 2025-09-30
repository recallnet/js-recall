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

// CLI Usage - Check if this file is being run directly
// Using require.main for CommonJS compatibility
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: tsx report-analyzer.ts <report.json> [baseline.json]");
    console.log(
      "  Analyzes Artillery JSON report and generates markdown summary",
    );
    console.log("  Optional: provide baseline.json for comparison");
    process.exit(1);
  }

  const reportPath = args[0];
  const baselinePath = args[1];

  if (!reportPath || !fs.existsSync(reportPath)) {
    console.error(`Error: Report file not found: ${reportPath}`);
    process.exit(1);
  }

  const report = loadReport(reportPath);
  const analysis = analyzeReport(report);

  let baseline: ReturnType<typeof analyzeReport> | undefined;
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
