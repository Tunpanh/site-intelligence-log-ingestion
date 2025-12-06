const express = require("express");
const path = require("path");
const { ensureStorageDirs } = require("./lib/storage");
const logsRouter = require("./routes/logsRoute");
const metricsRouter = require("./routes/metricsRoute");
const aggregateRouter = require("./routes/aggregateRoute");
const { runAggregation } = require("./services/aggregationService");

const PORT = process.env.PORT || 3000;
const AGGREGATION_INTERVAL_MS = Number(process.env.AGGREGATION_INTERVAL_MS || 30000);

async function main() {
  ensureStorageDirs();

  const app = express();

  // Body parsers
  app.use(express.json({ limit: "5mb" }));
  app.use(express.text({ type: ["text/plain", "text/csv"], limit: "5mb" }));

  // Routes
  app.use("/logs", logsRouter);
  app.use("/metrics", metricsRouter);
  app.use("/aggregate", aggregateRouter);

  // Simple health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });

  // Background aggregation loop
  setInterval(async () => {
    try {
      const summary = await runAggregation();
      if (summary && summary.processedFiles && summary.processedFiles.length > 0) {
        console.log(
          `[aggregator] Processed ${summary.processedFiles.length} files, wrote ${summary.outputFile}`
        );
      }
    } catch (err) {
      console.error("[aggregator] Aggregation failed:", err);
    }
  }, AGGREGATION_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
