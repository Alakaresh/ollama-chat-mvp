const express = require("express");
const { getDb, deleteConversation } = require("../services/database");

function personaRouter() {
  const router = express.Router();

  // GET /api/personas
  router.get("/personas", (req, res) => {
    const db = getDb();
    try {
      const stmt = db.prepare(
        "SELECT id, name, label, nsfw, tags, introduction, prompt, environment FROM personas"
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

  // DELETE /api/personas/:id/conversation
  router.delete("/personas/:id/conversation", (req, res) => {
    const personaId = req.params.id;
    const result = deleteConversation(personaId);

    if (result.success) {
      res.status(204).send();
    } else {
      res.status(500).json({ error: result.error });
    }
  });

  // GET /api/personas/:id/full-data
  router.get("/personas/:id/full-data", (req, res) => {
    const personaId = req.params.id;
    const db = getDb();
    try {
      const stmt = db.prepare(
        "SELECT c.data as character, r.data as relationship, o.data as outfit FROM personas p LEFT JOIN characters c ON p.id = c.persona_id LEFT JOIN relationships r ON p.id = r.persona_id LEFT JOIN outfits o ON p.id = o.persona_id WHERE p.id = ?"
      );
      const data = stmt.get(personaId);

      // Parse the JSON strings before sending the response
      if (data) {
        if (data.character) data.character = JSON.parse(data.character);
        if (data.relationship) data.relationship = JSON.parse(data.relationship);
        if (data.outfit) data.outfit = JSON.parse(data.outfit);
      }

      res.json(data);
    } catch (error) {
      console.error(`Failed to fetch full data for persona ${personaId}:`, error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // GET /api/character-template
  router.get("/character-template", (req, res) => {
    const template = {
      character: {},
      relationship: {},
      outfit: {},
    };
    res.json(template);
  });

  // POST /api/character-data/update
  router.post("/character-data/update", (req, res) => {
    const { persona_id, character, relationship, outfit } = req.body;

    if (!persona_id) {
      return res.status(400).json({ error: "persona_id is required" });
    }

    const db = getDb();
    const transaction = db.transaction(() => {
      try {
        if (character) {
          const stmt = db.prepare(
            "INSERT OR REPLACE INTO characters (persona_id, data) VALUES (?, ?)"
          );
          stmt.run(persona_id, JSON.stringify(character));
        }
        if (relationship) {
          const stmt = db.prepare(
            "INSERT OR REPLACE INTO relationships (persona_id, data) VALUES (?, ?)"
          );
          stmt.run(persona_id, JSON.stringify(relationship));
        }
        if (outfit) {
          const stmt = db.prepare(
            "INSERT OR REPLACE INTO outfits (persona_id, data) VALUES (?, ?)"
          );
          stmt.run(persona_id, JSON.stringify(outfit));
        }
        res.status(200).json({ success: true });
      } catch (error) {
        console.error(`Failed to update character data for persona ${persona_id}:`, error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
    transaction();
  });

  return router;
}

module.exports = { personaRouter };
