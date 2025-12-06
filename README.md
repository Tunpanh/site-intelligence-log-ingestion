> This repository contains my solution to a backend code challenge for a Site Intelligence / log ingestion scenario, implemented in Node.js with Express.

# Site Intelligence Backend Engineer – Code Challenge (Node.js)

This project is a small log ingestion and aggregation service implemented in **Node.js** for the Site Intelligence Backend Engineer code challenge.

It simulates a simplified version of an ingestion pipeline:

- **POST /logs** receives batches of logs (JSON or CSV).
- Batches are written as files to a local `data/raw` folder (simulating a storage bucket).
- A background **aggregation task** periodically reads raw batches, aggregates them, and writes the results to `data/aggregated`.
- **GET /metrics** exposes simple Prometheus-style metrics for observability.
- **POST /aggregate** lets you manually trigger an aggregation run.

## 1. How to run

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Start the service

```bash
npm start
```

By default the server listens on `http://localhost:3000`.

You can control the aggregation interval (in milliseconds) with:

```bash
AGGREGATION_INTERVAL_MS=60000 npm start
```

## 2. Log format

Each log entry must contain:

- `timestamp` – ISO 8601 string, e.g. `2025-12-07T00:00:00Z`
- `path` – request path, e.g. `/home`
- `userAgent` – user agent string, e.g. `Mozilla/5.0 ...`

Example JSON batch:

```json
[
  {
    "timestamp": "2025-12-07T00:00:00Z",
    "path": "/",
    "userAgent": "Mozilla/5.0"
  },
  {
    "timestamp": "2025-12-07T00:01:00Z",
    "path": "/pricing",
    "userAgent": "curl/8.0.0"
  }
]
```

## 3. Endpoints

### POST /logs

Accepts a **JSON** or **CSV** array of log entries and writes them as a new batch file in `data/raw`.

- **Content-Type: application/json** – body is a JSON array of log entries.
- **Content-Type: text/csv** – body is CSV text. The first row is a header.

#### Example – JSON

```bash
curl -X POST "http://localhost:3000/logs"   -H "Content-Type: application/json"   -d '[
    { "timestamp": "2025-12-07T00:00:00Z", "path": "/", "userAgent": "curl/8.0.0" },
    { "timestamp": "2025-12-07T00:01:00Z", "path": "/home", "userAgent": "curl/8.0.0" }
  ]'
```

Expected response:

```json
{
  "message": "Log batch stored",
  "batchId": "batch-...json"
}
```

#### Example – CSV

```bash
curl -X POST "http://localhost:3000/logs"   -H "Content-Type: text/csv"   --data-binary $'timestamp,path,userAgent
2025-12-07T00:00:00Z,/,curl/8.0.0
2025-12-07T00:01:00Z,/home,curl/8.0.0
'
```
#### Windows / PowerShell example using Invoke-RestMethod

On Windows, especially in PowerShell, quoting JSON for `curl.exe` can be tricky. A very reliable way to send a batch is to let PowerShell build the JSON for you and use `Invoke-RestMethod`:

```powershell
$body = @(
  @{ timestamp = "2025-12-07T00:00:00Z"; path = "/";    userAgent = "curl/8.0.0" },
  @{ timestamp = "2025-12-07T00:01:00Z"; path = "/home"; userAgent = "curl/8.0.0" }
) | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/logs" `
  -ContentType "application/json" `
  -Body $body
```

You can also trigger aggregation and fetch metrics in PowerShell with:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/aggregate"

Invoke-RestMethod -Method Get -Uri "http://localhost:3000/metrics"
```


The service performs validation:

- Payload must be an array.
- Each entry must contain a valid `timestamp`, `path`, and `userAgent`.
- On invalid payloads it returns `400 Bad Request` with an `errors` structure.
- Invalid batches increment the `log_batches_invalid_total` metric.

On success the service returns `202 Accepted` and increments `log_batches_received_total`.

### POST /aggregate

Manually triggers an aggregation run. The background job uses the same logic.

- Reads all files in `data/raw`.
- For each log entry, counts:
  - number of requests per `path`
  - number of requests per `userAgent`
- Moves processed raw files to `data/raw_processed` to avoid double-counting.
- Writes an aggregated snapshot to `data/aggregated/aggregated-<timestamp>.json`.

Example request:

```bash
curl -X POST "http://localhost:3000/aggregate"
```

Example response:

```json
{
  "message": "Aggregation run completed",
  "processedFiles": ["batch-2025-12-07T00-00-00-000Z-xxxxx.json"],
  "totalLogs": 2,
  "outputFile": "data/aggregated/aggregated-2025-12-07T00-05-00-000Z-xxxxx.json"
}
```

If there are no files in `data/raw`, the service responds with an empty `processedFiles` array.

### GET /metrics

Exposes basic counters in Prometheus text format:

- `log_batches_received_total`
- `log_batches_invalid_total`
- `log_files_processed_total`
- `aggregation_runs_total`

Example:

```bash
curl "http://localhost:3000/metrics"
```

Sample output:

```text
# HELP log_batches_received_total Total number of successfully received log batches
# TYPE log_batches_received_total counter
log_batches_received_total 3

# HELP log_batches_invalid_total Total number of invalid log batch requests
# TYPE log_batches_invalid_total counter
log_batches_invalid_total 1

# HELP log_files_processed_total Total number of raw log files processed by aggregator
# TYPE log_files_processed_total counter
log_files_processed_total 2

# HELP aggregation_runs_total Total number of aggregation runs
# TYPE aggregation_runs_total counter
aggregation_runs_total 2
```

### GET /health

Simple health check:

```bash
curl "http://localhost:3000/health"
```

## 4. Error handling & resilience

- **Invalid payloads** on `/logs` return `400` with a structured `details` list.
- **Unsupported Content-Type** returns `415` with guidance.
- **Corrupted or malformed batch files**:
  - Logged to stderr.
  - Skipped without stopping the aggregator.
- **I/O errors** (e.g. read/write failures):
  - Logged and do not crash the service.
  - Aggregation continues with remaining files where possible.

This ensures partial failures are tolerated gracefully.

## 5. Scalability & production evolution (design notes)
### Known limitations of this proof-of-concept

- Uses local filesystem instead of a replicated object store, so there is no durability across machines.
- Runs API and aggregation in a single process; in production these would likely be separate services or jobs.
- Does not include authentication, authorization, or multi-tenant isolation (e.g. per-customer buckets or prefixes).
- Uses in-memory metrics only; a real system would export these to a central metrics backend (Prometheus + Grafana, etc.).
- Aggregation is simple and single-threaded; for large volumes it would need partitioning and parallel workers.


This implementation is intentionally simple but mirrors patterns used in production systems:

- **Decoupled ingestion & processing**: the API layer only validates and writes batches to a “bucket” (local filesystem). In production, this would typically be an object store (S3/GCS) or a message queue.
- **Idempotent aggregation**:
  - Raw batches are processed once and then moved to `raw_processed`.
  - In a real system we could use a checkpoint store (e.g. database, offsets in Kafka) instead of renaming files.
- **Horizontal scaling of ingestion**:
  - `POST /logs` is stateless; multiple replicas behind a load balancer can write to a shared bucket or queue.
- **Scaling aggregation**:
  - Shard processing by time window, customer ID, or bucket prefix.
  - Use a job queue system (e.g. Celery, Sidekiq, Kubernetes CronJobs) to run parallel workers.
  - For very large volumes, use big-data tools (Spark / Flink / BigQuery) to compute aggregates.
- **Observability**:
  - Basic Prometheus counters here could easily be extended with histograms, gauges, and structured logs.
  - Dashboards can be built to monitor ingestion rates, failure counts, and aggregation latency.

These trade-offs and evolution paths can be elaborated during the technical interview.


## 6. Tests

Basic unit tests are included for the **validation** and **aggregation** logic.

### Run tests

```bash
npm test
```

This will:

- Validate that `validateLogEntries` correctly accepts/rejects payloads.
- Validate that `parseCsv` parses simple CSV input into objects.
- Create a couple of synthetic batches in `data/raw`, run an aggregation, and assert that:
  - all batches are processed,
  - the aggregated counts per `path` and `userAgent` are correct,
  - an aggregated snapshot file is written to `data/aggregated`.


## 7. How the code is structured

At a high level the project is split into **routing**, **services**, **infrastructure helpers**, and **data folders**:

- `src/index.js` – application entrypoint
  - sets up the Express app
  - registers routes
  - starts the HTTP server
  - configures the background aggregation interval
- `src/routes/` – HTTP layer (no business logic)
  - `logsRoute.js` – implements `POST /logs`
  - `metricsRoute.js` – implements `GET /metrics`
  - `aggregateRoute.js` – implements `POST /aggregate`
- `src/services/` – core business logic
  - `logService.js` – validates and ingests batches, writes them to the simulated bucket
  - `aggregationService.js` – processes raw batch files, aggregates counts, writes analytics snapshots
- `src/lib/` – shared utilities
  - `storage.js` – filesystem-based storage abstraction (simulated bucket & analytics layer)
  - `metrics.js` – in-memory Prometheus-like counters and text formatting
  - `validation.js` – input validation and CSV parsing
- `tests/` – small test harness
  - `run-tests.js` – unit tests for validation and aggregation logic (run with `npm test`)
- `data/`
  - `raw/` – new incoming batches
  - `raw_processed/` – batches that were already aggregated
  - `aggregated/` – analytics snapshots written by the aggregator

This structure keeps the HTTP layer thin and makes it straightforward to replace the storage or aggregation strategy in a real production deployment.

## 8. Architecture diagram

The following diagram shows the main components and data flow of the service:

```mermaid
flowchart LR
  Client[NPM package / Website] -->|POST /logs| API[Log Ingestion API (Express POST /logs)]
  API -->|write batch files| Raw[data/raw - raw batches]
  Aggregator[Aggregator (interval or POST /aggregate)] -->|read & aggregate| Raw
  Aggregator -->|move processed| Processed[data/raw_processed - processed batches]
  Aggregator -->|write snapshots| Agg[data/aggregated - analytics snapshots]
  API -->|expose metrics| Metrics[GET /metrics - Prometheus counters]
```

- **Client**: customer website or NPM package sending batched logs.
- **API**: lightweight ingestion service that validates and stores batches to the simulated bucket (`data/raw`).
- **Aggregator**: background/triggered worker that turns raw batches into aggregated analytics snapshots.
- **Metrics endpoint**: exposes internal counters for observability and capacity planning.

## 9. AI tools used

I used AI tooling (ChatGPT – GPT-5.1 Thinking from OpenAI) to help with:

- Drafting the initial high-level design and project structure.
- Generating boilerplate Express/Node.js code and filesystem helpers.
- Writing and refining this README, including the architecture diagram and test descriptions.

All generated code and documentation were reviewed and adjusted to ensure they match the problem statement and my own implementation style.
