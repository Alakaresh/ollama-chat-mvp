const express = require("express");
const { getDb } = require("../services/database");

function personaRouter() {
  const router = express.Router();

  // GET /api/personas
  router.get("/personas", (req, res) => {
    const db = getDb();
    try {
      const stmt = db.prepare(
        "SELECT id, name, label, nsfw, tags, introduction, prompt FROM personas"
      );
      const personas = stmt.all();
      // Parse the tags string back into an array
      personas.forEach(p => {
        if (p.tags) {
          try {
            p.tags = JSON.parse(p.tags);
          } catch (e) {
            console.error(`Could not parse tags for persona ${p.id}:`, p.tags);
            p.tags = [];
          }
        }
      });
      res.json(personas);
    } catch (error) {
      console.error("Failed to fetch personas:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // GET /api/personas/:id/conversation
  router.get("/personas/:id/conversation", (req, res) => {
    const personaId = req.params.id;
    const db = getDb();
    try {
      const stmt = db.prepare(
        "SELECT role, content FROM conversations WHERE persona_id = ? ORDER BY timestamp ASC"
      );
      const conversation = stmt.all(personaId);
      res.json(conversation);
    } catch (error) {
      console.error(`Failed to fetch conversation for persona ${personaId}:`, error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // POST /api/personas/:id/conversation
  router.post("/personas/:id/conversation", (req, res) => {
    const personaId = req.params.id;
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: "role and content are required" });
    }

    const db = getDb();
    try {
      const stmt = db.prepare(
        "INSERT INTO conversations (persona_id, role, content) VALUES (?, ?, ?)"
      );
      const result = stmt.run(personaId, role, content);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (error) {
      console.error(`Failed to save message for persona ${personaId}:`, error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  return router;
}

module.exports = { personaRouter };
