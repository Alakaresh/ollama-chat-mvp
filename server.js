const express = require("express");

const { modelsRouter } = require("./routes/models");
const { chatRouter } = require("./routes/chat"); // nouveau: chat sans DB

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.use("/api/models", modelsRouter());
app.use("/api", chatRouter());

const PORT = 8080;
app.listen(PORT, () => console.log(`✅ Server: http://localhost:${PORT}`));
