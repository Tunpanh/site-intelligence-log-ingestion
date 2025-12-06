const express = require("express");
const { ingestJsonPayload, ingestCsvPayload } = require("../services/logService");

const router = express.Router();

router.post("/", async (req, res) => {
  const contentType = (req.headers["content-type"] || "").toLowerCase();

  try {
    if (contentType.includes("application/json")) {
      const payload = req.body;
      const result = ingestJsonPayload(payload);
      return res.status(202).json({
        message: "Log batch stored",
        batchId: result.batchId,
      });
    }

    if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
      const textBody = typeof req.body === "string" ? req.body : "";
      const result = ingestCsvPayload(textBody);
      return res.status(202).json({
        message: "Log batch stored",
        batchId: result.batchId,
      });
    }

    return res.status(415).json({
      error: "Unsupported Content-Type. Use application/json or text/csv",
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) {
      console.error("[/logs] Failed to ingest logs:", err);
    }
    return res.status(status).json({
      error: err.message || "Failed to ingest logs",
      details: err.details || undefined,
    });
  }
});

module.exports = router;
