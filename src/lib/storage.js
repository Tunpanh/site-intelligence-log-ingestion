const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const RAW_PROCESSED_DIR = path.join(DATA_DIR, "raw_processed");
const AGGREGATED_DIR = path.join(DATA_DIR, "aggregated");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureStorageDirs() {
  ensureDir(DATA_DIR);
  ensureDir(RAW_DIR);
  ensureDir(RAW_PROCESSED_DIR);
  ensureDir(AGGREGATED_DIR);
}

function generateBatchFileName() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 10);
  return `batch-${ts}-${rand}.json`;
}

function writeBatchToBucket(logs) {
  const batchId = generateBatchFileName();
  const filePath = path.join(RAW_DIR, batchId);
  const payload = {
    batchId,
    receivedAt: new Date().toISOString(),
    logs,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  return { batchId, filePath };
}

function listRawBatchFiles() {
  ensureDir(RAW_DIR);
  return fs
    .readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(RAW_DIR, f));
}

function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

function moveToProcessed(filePath) {
  const fileName = path.basename(filePath);
  const destPath = path.join(RAW_PROCESSED_DIR, fileName);
  fs.renameSync(filePath, destPath);
  return destPath;
}

function writeAggregatedSnapshot(result) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `aggregated-${ts}.json`;
  const filePath = path.join(AGGREGATED_DIR, fileName);
  const payload = {
    generatedAt: new Date().toISOString(),
    ...result,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  return filePath;
}

module.exports = {
  DATA_DIR,
  RAW_DIR,
  RAW_PROCESSED_DIR,
  AGGREGATED_DIR,
  ensureStorageDirs,
  writeBatchToBucket,
  listRawBatchFiles,
  readJsonFile,
  moveToProcessed,
  writeAggregatedSnapshot,
};
