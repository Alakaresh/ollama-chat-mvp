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
        "SELECT p.id, p.name, p.label, p.nsfw, p.tags, p.introduction, p.prompt, p.environment, c.data as character, r.data as relationship, o.data as outfit FROM personas p LEFT JOIN characters c ON p.id = c.persona_id LEFT JOIN relationships r ON p.id = r.persona_id LEFT JOIN outfits o ON p.id = o.persona_id WHERE p.id = ?"
      );
      const data = stmt.get(personaId);

      if (!data) {
        return res.status(404).json({ error: "Persona not found" });
      }

      // Parse the JSON strings before sending the response
      if (data) {
        if (data.character) data.character = JSON.parse(data.character);
        if (data.relationship) data.relationship = JSON.parse(data.relationship);
        if (data.outfit) data.outfit = JSON.parse(data.outfit);
        if (data.tags) data.tags = JSON.parse(data.tags);
      }

      const response = {
        persona: {
            id: data.id,
            name: data.name,
            label: data.label,
            nsfw: data.nsfw,
            tags: data.tags,
            introduction: data.introduction,
            prompt: data.prompt,
            environment: data.environment,
        },
        character: data.character,
        relationship: data.relationship,
        outfit: data.outfit,
      }

      res.json(response);
    } catch (error) {
      console.error(`Failed to fetch full data for persona ${personaId}:`, error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // GET /api/character-template
  router.get("/character-template", (req, res) => {
    const template = {
      persona: {
        name: "",
        label: "",
        nsfw: false,
        tags: [],
        introduction: "",
        prompt: "",
        environment: "",
      },
      character: {},
      relationship: {},
      outfit: {},
    };
    res.json(template);
  });

  // POST /api/character-data/update
  router.post("/character-data/update", (req, res) => {
    let { persona_id, persona, character, relationship, outfit } = req.body;

    const db = getDb();
    try {
      if (!persona_id) {
        // Create new persona
        const allowedFields = ['name', 'label', 'nsfw', 'tags', 'introduction', 'prompt', 'environment'];
        const fields = Object.keys(persona).filter(field => allowedFields.includes(field));
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(field => {
            if (field === 'tags' && Array.isArray(persona[field])) {
                return JSON.stringify(persona[field]);
            }
            return persona[field];
        });

        const stmt = db.prepare(`INSERT INTO personas (${fields.join(', ')}) VALUES (${placeholders})`);
        const result = stmt.run(...values);
        persona_id = result.lastInsertRowid;
      } else {
        // Update existing persona
        if (persona) {
            const allowedFields = ['name', 'label', 'nsfw', 'tags', 'introduction', 'prompt', 'environment'];
            const fields = Object.keys(persona).filter(field => allowedFields.includes(field));

            if (fields.length > 0) {
                const values = fields.map(field => {
                    if (field === 'tags' && Array.isArray(persona[field])) {
                        return JSON.stringify(persona[field]);
                    }
                    return persona[field];
                });

                const setClause = fields.map(field => `${field} = ?`).join(", ");
                const stmt = db.prepare(`UPDATE personas SET ${setClause} WHERE id = ?`);
                stmt.run(...values, persona_id);
            }
        }
      }

      db.transaction(() => {
        if (character) {
          db.prepare("INSERT OR REPLACE INTO characters (persona_id, data) VALUES (?, ?)").run(persona_id, JSON.stringify(character));
        }
        if (relationship) {
          db.prepare("INSERT OR REPLACE INTO relationships (persona_id, data) VALUES (?, ?)").run(persona_id, JSON.stringify(relationship));
        }
        if (outfit) {
          db.prepare("INSERT OR REPLACE INTO outfits (persona_id, data) VALUES (?, ?)").run(persona_id, JSON.stringify(outfit));
        }
      })();
      res.status(200).json({ success: true, persona_id });
    } catch (error) {
      console.error(`Failed to update character data for persona ${persona_id}:`, error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  return router;
}

module.exports = { personaRouter };
