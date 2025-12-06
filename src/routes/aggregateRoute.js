const express = require("express");
const { runAggregation } = require("../services/aggregationService");

const router = express.Router();

router.post("/", async (_req, res) => {
  try {
    const summary = await runAggregation();
    return res.status(200).json({
      message: "Aggregation run completed",
      processedFiles: summary.processedFiles,
      totalLogs: summary.totalLogs,
      outputFile: summary.outputFile,
    });
  } catch (err) {
    console.error("[/aggregate] Aggregation failed:", err);
    return res.status(500).json({
      error: "Aggregation failed",
    });
  }
});

module.exports = router;
