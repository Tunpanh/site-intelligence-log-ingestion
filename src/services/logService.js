const { writeBatchToBucket } = require("../lib/storage");
const { validateLogEntries, parseCsv } = require("../lib/validation");
const { inc } = require("../lib/metrics");

function ingestJsonPayload(payload) {
  const { ok, logs, errors } = validateLogEntries(payload);
  if (!ok) {
    inc("log_batches_invalid_total");
    const error = new Error("Invalid payload");
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  const { batchId } = writeBatchToBucket(logs);
  inc("log_batches_received_total");
  return { batchId };
}

function ingestCsvPayload(csvText) {
  const rows = parseCsv(csvText);
  const { ok, logs, errors } = validateLogEntries(rows);
  if (!ok) {
    inc("log_batches_invalid_total");
    const error = new Error("Invalid payload");
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  const { batchId } = writeBatchToBucket(logs);
  inc("log_batches_received_total");
  return { batchId };
}

module.exports = {
  ingestJsonPayload,
  ingestCsvPayload,
};
