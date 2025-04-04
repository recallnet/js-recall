import { detectContentType, getFileExtension } from "./detect-content-type";
import { FilePreviewType } from "./types";

// Test cases for different file scenarios
const testCases = [
  // Test case 1: JSONL file with correct content type
  {
    fileName: "data.jsonl",
    contentType: "application/ld+json",
    expectedType: FilePreviewType.JSONL,
    description: "JSONL file with correct JSONL content type",
  },

  // Test case 2: JSONL file with generic content type (should use extension)
  {
    fileName: "data.jsonl",
    contentType: "application/octet-stream",
    expectedType: FilePreviewType.JSONL,
    description: "JSONL file with generic content type - should detect from extension",
  },

  // Test case 3: JSONL file with no content type (should use extension)
  {
    fileName: "data.jsonl",
    contentType: undefined,
    expectedType: FilePreviewType.JSONL,
    description: "JSONL file with no content type - should detect from extension",
  },

  // Test case 4: JSONL file with text/plain content type (should still prioritize extension)
  {
    fileName: "data.jsonl",
    contentType: "text/plain",
    expectedType: FilePreviewType.JSONL,
    description: "JSONL file with text/plain content type - should prioritize extension",
  },

  // Test case 5: Timestamped-named JSONL file with generic content type
  {
    fileName: "2025-04-02-20-10-00.jsonl",
    contentType: "application/octet-stream",
    expectedType: FilePreviewType.JSONL,
    description: "Timestamped JSONL file with generic content type",
  },

  // Test case 6: JSON file with correct content type
  {
    fileName: "data.json",
    contentType: "application/json",
    expectedType: FilePreviewType.JSON,
    description: "JSON file with correct content type",
  },

  // Test case 7: Plain text file
  {
    fileName: "data.txt",
    contentType: "text/plain",
    expectedType: FilePreviewType.PLAIN_TEXT,
    description: "Plain text file with correct content type",
  },

  // Test case 8: Markdown file
  {
    fileName: "README.md",
    contentType: "text/markdown",
    expectedType: FilePreviewType.MARKDOWN,
    description: "Markdown file with correct content type",
  },

  // Test case 9: Markdown file with plain text content type
  {
    fileName: "README.md",
    contentType: "text/plain",
    expectedType: FilePreviewType.MARKDOWN,
    description: "Markdown file with plain text content type - should prioritize extension",
  },

  // Test case 10: Unknown extension
  {
    fileName: "data.xyz",
    contentType: "application/octet-stream",
    expectedType: FilePreviewType.BINARY,
    description: "Unknown file extension with generic content type",
  },

  // Test case 11: No extension
  {
    fileName: "data",
    contentType: "application/octet-stream",
    expectedType: FilePreviewType.BINARY,
    description: "No file extension with generic content type",
  },

  // Test case 12: Code file
  {
    fileName: "script.js",
    contentType: "application/javascript",
    expectedType: FilePreviewType.PLAIN_TEXT,
    description: "JavaScript file - should be treated as text",
  },
];

// Run all test cases
function runTests() {
  console.log("Testing file detection logic:\n");

  // Test getFileExtension function
  console.log("Testing getFileExtension function:");
  const extensionTests = [
    { input: "file.txt", expected: "txt" },
    { input: "file.tar.gz", expected: "gz" },
    { input: "file", expected: "" },
    { input: ".gitignore", expected: "gitignore" },
    { input: "2025-04-02-20-10-00.jsonl", expected: "jsonl" },
  ];

  extensionTests.forEach(test => {
    const result = getFileExtension(test.input);
    const passed = result === test.expected;
    console.log(
      `${passed ? "✅" : "❌"} ${test.input} → ${result} ${passed ? "" : `(expected: ${test.expected})`}`
    );
  });

  console.log("\nTesting detectContentType function:");

  // Test all detection cases
  testCases.forEach((test, index) => {
    const result = detectContentType(test.contentType, test.fileName);
    const passed = result.type === test.expectedType;

    console.log(`\nTest #${index + 1}: ${test.description}`);
    console.log(`Filename: ${test.fileName}, Content-Type: ${test.contentType || "(none)"}`);
    console.log(`Expected: ${FilePreviewType[test.expectedType]}, Got: ${FilePreviewType[result.type]}`);
    console.log(`Detection context: ${JSON.stringify(result.context)}`);
    console.log(`Result: ${passed ? "✅ PASS" : "❌ FAIL"}`);
  });

  // Calculate overall results
  const passedTests = testCases.filter(
    (test) => detectContentType(test.contentType, test.fileName).type === test.expectedType
  ).length;

  console.log(`\nSummary: ${passedTests}/${testCases.length} tests passed`);
}

// Execute the tests
runTests();