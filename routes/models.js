const express = require("express");

function modelsRouter() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const r = await fetch("http://localhost:11434/api/tags");
      if (!r.ok) return res.status(500).json({ error: "Ollama /api/tags error" });

      const data = await r.json();
      const models = (data.models || []).map(m => m.name);
      res.json(models);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = { modelsRouter };
