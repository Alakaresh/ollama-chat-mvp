const express = require("express");
const fs = require("fs");
const path = require("path");
const { getDb, deleteConversation } = require("../services/database");
const logger = require("../services/logger");

const uploadDir = path.join(__dirname, "..", "public", "uploads");
const imageMimeExtensions = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

function personaRouter() {
  const router = express.Router();

  // GET /api/personas
  router.get("/personas", (req, res) => {
    const db = getDb();
    try {
      const stmt = db.prepare(
        "SELECT id, name, label, nsfw, tags, introduction, environment, image FROM personas"
      );
      const personas = stmt.all();
      // Parse the tags string back into an array
      personas.forEach(p => {
        if (p.tags) {
          try {
            p.tags = JSON.parse(p.tags);
          } catch (e) {
            logger.error(`Could not parse tags for persona ${p.id}`, { tags: p.tags });
            p.tags = [];
          }
        }
      });
      res.json(personas);
    } catch (error) {
      logger.error("Failed to fetch personas", { error });
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // GET /api/chats
  router.get("/chats", (req, res) => {
    const db = getDb();
    try {
      const stmt = db.prepare(
        `SELECT p.id as personaId, p.name, p.label, p.image,
                c.content as lastMessage, c.role as lastRole, c.timestamp as lastTimestamp
         FROM personas p
         JOIN conversations c
           ON c.id = (
             SELECT id
             FROM conversations
             WHERE persona_id = p.id
             ORDER BY timestamp DESC, id DESC
             LIMIT 1
           )
         WHERE EXISTS (
           SELECT 1
           FROM conversations
           WHERE persona_id = p.id AND role = 'user'
         )
         ORDER BY c.timestamp DESC, c.id DESC`
      );
      const chats = stmt.all();
      res.json(chats);
    } catch (error) {
      logger.error("Failed to fetch chat list", { error });
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // PUT /api/personas/:id/image
  router.put("/personas/:id/image", express.raw({ type: ["image/*"], limit: "10mb" }), (req, res) => {
    const personaId = req.params.id;
    const contentType = req.headers["content-type"];
    const extension = imageMimeExtensions[contentType];

    if (!extension) {
      return res.status(400).json({ error: "Unsupported image type" });
    }

    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: "Image file is required" });
    }

    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `persona-${personaId}-${Date.now()}${extension}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, req.body);

      const imagePath = `/uploads/${filename}`;
      const db = getDb();
      const stmt = db.prepare("UPDATE personas SET image = ? WHERE id = ?");
      const result = stmt.run(imagePath, personaId);

      if (result.changes === 0) {
        return res.status(404).json({ error: "Persona not found" });
      }

      res.status(200).json({ image: imagePath });
    } catch (error) {
      logger.error(`Failed to upload image for persona ${personaId}`, { error });
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
      logger.error(`Failed to fetch conversation for persona ${personaId}`, { error });
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
      logger.error(`Failed to save message for persona ${personaId}`, { error });
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
        "SELECT p.id, p.name, p.label, p.nsfw, p.tags, p.introduction, p.environment, p.image, c.data as character, r.data as relationship, o.data as outfit FROM personas p LEFT JOIN characters c ON p.id = c.persona_id LEFT JOIN relationships r ON p.id = r.persona_id LEFT JOIN outfits o ON p.id = o.persona_id WHERE p.id = ?"
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
            environment: data.environment,
            image: data.image,
        },
        character: data.character,
        relationship: data.relationship,
        outfit: data.outfit,
      }

      res.json(response);
    } catch (error) {
      logger.error(`Failed to fetch full data for persona ${personaId}`, { error });
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // GET /api/character-template
  router.get("/character-template", (req, res) => {
    const db = getDb();
    const blankTemplate = {
      persona: { name: "", label: "", nsfw: false, tags: [], introduction: "", environment: "", image: "" },
      character: {},
      relationship: {},
      outfit: {},
    };

    try {
        const meiInfo = db.prepare("SELECT id FROM personas WHERE name = ?").get("Mei");

        if (!meiInfo) {
            logger.warn("Could not find 'Mei' persona for template, returning blank template.");
            return res.json(blankTemplate);
        }

        const personaId = meiInfo.id;

        const stmt = db.prepare(
            "SELECT p.label, p.nsfw, p.tags, p.introduction, p.environment, p.image, c.data as character, r.data as relationship, o.data as outfit FROM personas p LEFT JOIN characters c ON p.id = c.persona_id LEFT JOIN relationships r ON p.id = r.persona_id LEFT JOIN outfits o ON p.id = o.persona_id WHERE p.id = ?"
        );
        const data = stmt.get(personaId);

        if (!data) {
            logger.error("Found 'Mei' ID but failed to fetch full data, returning blank template.");
            return res.json(blankTemplate);
        }

        // Parse JSON strings
        if (data.character) data.character = JSON.parse(data.character);
        if (data.relationship) data.relationship = JSON.parse(data.relationship);
        if (data.outfit) data.outfit = JSON.parse(data.outfit);
        if (data.tags) data.tags = JSON.parse(data.tags);

        const template = {
            persona: {
                name: "", // Clear name for new character
                label: data.label,
                nsfw: data.nsfw,
                tags: data.tags,
                introduction: data.introduction,
                environment: data.environment,
                image: data.image,
            },
            character: data.character || {},
            relationship: data.relationship || {},
            outfit: data.outfit || {},
        };

        res.json(template);

    } catch (error) {
        logger.error("Failed to fetch character template from Mei", { error });
        res.status(500).json(blankTemplate);
    }
  });

  // POST /api/character-data/update
  router.post("/character-data/update", (req, res) => {
    let { persona_id, persona, character, relationship, outfit } = req.body;

    const db = getDb();
    try {
      if (!persona_id) {
        // Create new persona
        const allowedFields = ['name', 'label', 'nsfw', 'tags', 'introduction', 'environment', 'image'];
        const newPersonaId = persona?.name?.trim();
        if (!newPersonaId) {
          return res.status(400).json({ error: "Persona name is required to create an id." });
        }
        const fields = Object.keys(persona).filter(field => allowedFields.includes(field));
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(field => {
            if (field === 'tags' && Array.isArray(persona[field])) {
                return JSON.stringify(persona[field]);
            }
            return persona[field];
        });

        const insertFields = ['id', ...fields];
        const insertPlaceholders = insertFields.map(() => '?').join(', ');
        const stmt = db.prepare(`INSERT INTO personas (${insertFields.join(', ')}) VALUES (${insertPlaceholders})`);
        try {
          stmt.run(newPersonaId, ...values);
          persona_id = newPersonaId;
        } catch (error) {
          if (error?.message?.includes("UNIQUE constraint failed: personas.id")) {
            return res.status(409).json({ error: "Persona id already exists." });
          }
          throw error;
        }
      } else {
        // Update existing persona
        if (persona) {
            const allowedFields = ['name', 'label', 'nsfw', 'tags', 'introduction', 'environment', 'image'];
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
      logger.error(`Failed to update character data for persona ${persona_id}`, { error });
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  return router;
}

module.exports = { personaRouter };
