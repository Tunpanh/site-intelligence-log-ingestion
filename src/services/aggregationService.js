const path = require("path");
const fs = require("fs");
const { listRawBatchFiles, readJsonFile, moveToProcessed, writeAggregatedSnapshot } = require("../lib/storage");
const { inc } = require("../lib/metrics");

async function runAggregation() {
  const files = listRawBatchFiles();
  if (files.length === 0) {
    return {
      processedFiles: [],
      totalLogs: 0,
      outputFile: null,
      aggregates: null,
    };
  }

  const requestCountPerPath = {};
  const requestCountPerUserAgent = {};
  const processedFiles = [];
  let totalLogs = 0;

  for (const filePath of files) {
    try {
      const content = readJsonFile(filePath);
      if (!content || !Array.isArray(content.logs)) {
        console.error(`[aggregator] File ${filePath} missing 'logs' array, skipping`);
        continue;
      }

      for (const log of content.logs) {
        if (!log || typeof log !== "object") continue;
        const pathKey = typeof log.path === "string" ? log.path : "UNKNOWN";
        const uaKey = typeof log.userAgent === "string" ? log.userAgent : "UNKNOWN";

        requestCountPerPath[pathKey] = (requestCountPerPath[pathKey] || 0) + 1;
        requestCountPerUserAgent[uaKey] = (requestCountPerUserAgent[uaKey] || 0) + 1;
        totalLogs += 1;
      }

      moveToProcessed(filePath);
      processedFiles.push(path.basename(filePath));
      inc("log_files_processed_total");
    } catch (err) {
      console.error(`[aggregator] Failed to process file ${filePath}:`, err);
      // continue with other files
    }
  }

  inc("aggregation_runs_total");

  const aggregates = {
    requestCountPerPath,
    requestCountPerUserAgent,
    totalLogs,
  };

  let outputFile = null;
  if (processedFiles.length > 0) {
    outputFile = writeAggregatedSnapshot({
      requestCountPerPath,
      requestCountPerUserAgent,
      totalLogs,
      processedFiles,
    });
  }

  return {
    processedFiles,
    totalLogs,
    outputFile,
    aggregates,
  };
}

module.exports = {
  runAggregation,
};
