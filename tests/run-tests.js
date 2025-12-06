const assert = require("assert");

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    throw err;
  }
}

async function run() {
  // Validation tests
  await test("validateLogEntries accepts valid entries", async () => {
    const { validateLogEntries } = require("../src/lib/validation");
    const entries = [
      {
        timestamp: "2025-12-07T00:00:00Z",
        path: "/",
        userAgent: "curl/8.0.0",
      },
      {
        timestamp: "2025-12-07T00:01:00Z",
        path: "/home",
        userAgent: "Mozilla/5.0",
      },
    ];
    const result = validateLogEntries(entries);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.logs.length, 2);
  });

  await test("validateLogEntries rejects non-array root payload", async () => {
    const { validateLogEntries } = require("../src/lib/validation");
    const result = validateLogEntries({ not: "an array" });
    assert.strictEqual(result.ok, false);
    assert.ok(Array.isArray(result.errors));
    assert.strictEqual(result.errors[0].field, "root");
  });

  await test("validateLogEntries detects invalid timestamp", async () => {
    const { validateLogEntries } = require("../src/lib/validation");
    const entries = [
      { timestamp: "not-a-date", path: "/", userAgent: "curl/8.0.0" },
    ];
    const result = validateLogEntries(entries);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors[0].errors.some((e) => e.field === "timestamp"));
  });

  await test("parseCsv parses simple CSV into objects", async () => {
    const { parseCsv } = require("../src/lib/validation");
    const csv = "timestamp,path,userAgent\n2025-12-07T00:00:00Z,/ ,curl/8.0.0\n";
    const rows = parseCsv(csv);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].timestamp, "2025-12-07T00:00:00Z");
    // parseCsv trims whitespace, so '/ ' becomes '/'
    assert.strictEqual(rows[0].path, "/");
    assert.strictEqual(rows[0].userAgent, "curl/8.0.0");
  });

  // Aggregation tests
  await test("runAggregation processes raw batch files and computes aggregates", async () => {
    const fs = require("fs");
    const path = require("path");
    const { ensureStorageDirs, RAW_DIR, RAW_PROCESSED_DIR, AGGREGATED_DIR, writeBatchToBucket } =
      require("../src/lib/storage");
    const { runAggregation } = require("../src/services/aggregationService");

    ensureStorageDirs();

    // Clean directories
    [RAW_DIR, RAW_PROCESSED_DIR, AGGREGATED_DIR].forEach((dir) => {
      fs.readdirSync(dir).forEach((f) => {
        fs.unlinkSync(path.join(dir, f));
      });
    });

    // Create two batches
    writeBatchToBucket([
      { timestamp: "2025-12-07T00:00:00Z", path: "/", userAgent: "curl/8.0.0" },
      { timestamp: "2025-12-07T00:01:00Z", path: "/home", userAgent: "curl/8.0.0" },
    ]);
    writeBatchToBucket([
      { timestamp: "2025-12-07T00:02:00Z", path: "/", userAgent: "Mozilla/5.0" },
    ]);

    const summary = await runAggregation();

    assert.strictEqual(summary.totalLogs, 3);
    assert.strictEqual(summary.processedFiles.length, 2);
    assert.ok(summary.outputFile, "outputFile should be set");
    assert.ok(fs.existsSync(summary.outputFile), "aggregated output file should exist");

    // Check aggregates
    const aggregates = summary.aggregates;
    assert.strictEqual(aggregates.requestCountPerPath["/"], 2);
    assert.strictEqual(aggregates.requestCountPerPath["/home"], 1);
    assert.strictEqual(aggregates.requestCountPerUserAgent["curl/8.0.0"], 2);
    assert.strictEqual(aggregates.requestCountPerUserAgent["Mozilla/5.0"], 1);
  });

  console.log("\nAll tests passed.");
}

run().catch((err) => {
  console.error("\nTest run failed.");
  process.exit(1);
});
