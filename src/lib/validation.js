function isIsoDateString(value) {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/**
 * Validates an array of incoming log entries.
 * A log entry must include:
 *   - timestamp: ISO8601 string
 *   - path: non-empty string
 *   - userAgent: non-empty string
 *
 * Returns { ok: boolean, logs?: any[], errors?: any[] }
 */
function validateLogEntries(entries) {
  const errors = [];
  const validLogs = [];

  if (!Array.isArray(entries)) {
    return {
      ok: false,
      errors: [{ index: null, field: "root", message: "Payload must be an array of log entries" }],
    };
  }

  entries.forEach((entry, index) => {
    const entryErrors = [];

    if (!entry || typeof entry !== "object") {
      entryErrors.push({ field: "entry", message: "Entry must be an object" });
    } else {
      if (!entry.timestamp || !isIsoDateString(entry.timestamp)) {
        entryErrors.push({
          field: "timestamp",
          message: "timestamp is required and must be a valid ISO8601 string",
        });
      }

      if (typeof entry.path !== "string" || entry.path.trim() === "") {
        entryErrors.push({
          field: "path",
          message: "path is required and must be a non-empty string",
        });
      }

      if (typeof entry.userAgent !== "string" || entry.userAgent.trim() === "") {
        entryErrors.push({
          field: "userAgent",
          message: "userAgent is required and must be a non-empty string",
        });
      }
    }

    if (entryErrors.length > 0) {
      errors.push({ index, errors: entryErrors });
    } else {
      validLogs.push({
        timestamp: entry.timestamp,
        path: entry.path,
        userAgent: entry.userAgent,
      });
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, logs: validLogs };
}

function parseCsv(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error("CSV body is empty");
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV must contain a header and at least one data row");
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",");
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || "").trim();
    });
    rows.push(obj);
  }

  return rows;
}

module.exports = {
  validateLogEntries,
  parseCsv,
};
