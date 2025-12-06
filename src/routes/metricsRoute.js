const express = require("express");
const { getMetricsText } = require("../lib/metrics");

const router = express.Router();

router.get("/", (_req, res) => {
  const body = getMetricsText();
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.send(body);
});

module.exports = router;
