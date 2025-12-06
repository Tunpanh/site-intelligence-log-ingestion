const counters = {
  log_batches_received_total: 0,
  log_batches_invalid_total: 0,
  log_files_processed_total: 0,
  aggregation_runs_total: 0,
};

function inc(metricName, value = 1) {
  if (!Object.prototype.hasOwnProperty.call(counters, metricName)) {
    counters[metricName] = 0;
  }
  counters[metricName] += value;
}

function getMetricsText() {
  const lines = [];

  lines.push("# HELP log_batches_received_total Total number of successfully received log batches");
  lines.push("# TYPE log_batches_received_total counter");
  lines.push(`log_batches_received_total ${counters.log_batches_received_total}`);
  lines.push("");

  lines.push("# HELP log_batches_invalid_total Total number of invalid log batch requests");
  lines.push("# TYPE log_batches_invalid_total counter");
  lines.push(`log_batches_invalid_total ${counters.log_batches_invalid_total}`);
  lines.push("");

  lines.push("# HELP log_files_processed_total Total number of raw log files processed by aggregator");
  lines.push("# TYPE log_files_processed_total counter");
  lines.push(`log_files_processed_total ${counters.log_files_processed_total}`);
  lines.push("");

  lines.push("# HELP aggregation_runs_total Total number of aggregation runs");
  lines.push("# TYPE aggregation_runs_total counter");
  lines.push(`aggregation_runs_total ${counters.aggregation_runs_total}`);
  lines.push("");

  return lines.join("\n");
}

module.exports = {
  inc,
  getMetricsText,
  counters,
};
