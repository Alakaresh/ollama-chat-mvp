const express = require("express");
const { getDb } = require("./services/database");

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
app.use(express.json());
app.use(express.static("public"));

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
app.listen(PORT, () => console.log(`✅ Server: http://localhost:${PORT}`));
