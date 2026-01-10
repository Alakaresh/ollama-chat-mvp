const express = require("express");
const path = require("path");
const { getDb } = require("./services/database");
const logger = require("./services/logger");

const { modelsRouter } = require("./routes/models");
const { chatRouter } = require("./routes/chat");
const { personaRouter } = require("./routes/persona");

const app = express();
const appMode = (process.env.APP_MODE || "dev").toLowerCase();

function isCloudflareRequest(req) {
  const cfRay = req.headers["cf-ray"];
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  const cfVisitor = req.headers["cf-visitor"];
  const cdnLoop = req.headers["cdn-loop"];

  return Boolean(
    cfRay ||
      cfConnectingIp ||
      cfVisitor ||
      (typeof cdnLoop === "string" && cdnLoop.toLowerCase().includes("cloudflare"))
  );
}
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info("HTTP request completed", {
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });
  next();
});

app.get("/management", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "management.html"));
});

app.get("/api/config", (req, res) => {
  const isCloudflare = isCloudflareRequest(req);
  const resolvedMode = isCloudflare ? "prod" : appMode;
  res.json({ appMode: resolvedMode, isCloudflare });
});

app.use("/api/models", modelsRouter());
app.use("/api", chatRouter()); // keep for streaming
app.use("/api", personaRouter());

const PORT = 8080;
getDb();
app.listen(PORT, () => logger.info(`✅ Server: http://localhost:${PORT}`));
