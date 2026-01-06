const express = require("express");

const { modelsRouter } = require("./routes/models");
const { chatRouter } = require("./routes/chat"); // nouveau: chat sans DB

const app = express();
const appMode = (process.env.APP_MODE || "dev").toLowerCase();
app.use(express.json());
app.use(express.static("public"));

app.get("/api/config", (_req, res) => {
  res.json({ appMode });
});

app.use("/api/models", modelsRouter());
app.use("/api", chatRouter());

const PORT = 8080;
app.listen(PORT, () => console.log(`✅ Server: http://localhost:${PORT}`));
