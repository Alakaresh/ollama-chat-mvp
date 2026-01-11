const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const DB_FILE = "chat.db";

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_FILE); // removed verbose logging
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    const stmt = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='personas'`
    );
    const tableExists = stmt.get();

    if (!tableExists) {
      logger.info("Création du schéma de la base de données...");
      db.exec(`
        CREATE TABLE personas (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          label TEXT NOT NULL,
          nsfw INTEGER NOT NULL,
          tags TEXT,
          introduction TEXT NOT NULL,
          environment TEXT,
          image TEXT
        );

        CREATE TABLE conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (persona_id) REFERENCES personas (id)
        );

        CREATE TABLE characters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id TEXT NOT NULL UNIQUE,
          data TEXT NOT NULL,
          FOREIGN KEY (persona_id) REFERENCES personas (id)
        );

        CREATE TABLE memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id TEXT NOT NULL,
          type TEXT NOT NULL, -- 'static', 'conversation'
          content TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (persona_id) REFERENCES personas (id)
        );

        CREATE TABLE relationships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id TEXT NOT NULL UNIQUE,
          data TEXT NOT NULL,
          FOREIGN KEY (persona_id) REFERENCES personas (id)
        );

        CREATE TABLE outfits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id TEXT NOT NULL UNIQUE,
          data TEXT NOT NULL,
          FOREIGN KEY (persona_id) REFERENCES personas (id)
        );
      `);
      logger.info("Schéma créé.");

      logger.info("Insertion des données de test (seed)...");
      const stmt = db.prepare(
        `INSERT INTO personas (id, name, label, nsfw, tags, introduction, environment, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run(
        'Lina',
        'Lina',
        'Lina (voisine)',
        1,
        JSON.stringify(['voisine', 'séduisante', 'provocante', 'adulte']),
        'Lina entrouvre la porte de son appartement, appuyée contre l’encadrement. Un sourire en coin se dessine sur ses lèvres. "Oh… c’est toi. Tu tombes bien."',
        'La scène se déroule dans un immeuble résidentiel en début de soirée. Le couloir est calme, éclairé par une lumière chaude. On entend au loin le bruit feutré de la ville. Lina se tient à la porte de son appartement, visiblement détendue, comme si elle attendait une interaction.',
        '/uploads/persona-Lina-1767891711768.png'
      );
      logger.info("Données de test insérées.");

    } else {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name);
      if (!tables.includes("conversations")) {
        logger.info("Création de la table 'conversations'...");
        db.exec(`
          CREATE TABLE conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            persona_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (persona_id) REFERENCES personas (id)
          );
        `);
      }
      let columns = db.prepare("PRAGMA table_info(personas)").all();
      const hasPrompt = columns.some((column) => column.name === "prompt");
      if (hasPrompt) {
        logger.info("Suppression de la colonne 'prompt' de la table personas...");
        db.exec("PRAGMA foreign_keys = OFF;");
        db.exec(`
          CREATE TABLE personas_new (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            label TEXT NOT NULL,
            nsfw INTEGER NOT NULL,
            tags TEXT,
            introduction TEXT NOT NULL,
            environment TEXT,
            image TEXT
          );

          INSERT INTO personas_new (id, name, label, nsfw, tags, introduction, environment, image)
          SELECT id, name, label, nsfw, tags, introduction, environment, image
          FROM personas;

          DROP TABLE personas;
          ALTER TABLE personas_new RENAME TO personas;
        `);
        db.exec("PRAGMA foreign_keys = ON;");
        columns = db.prepare("PRAGMA table_info(personas)").all();
      }
      const hasEnvironment = columns.some((column) => column.name === "environment");
      if (!hasEnvironment) {
        logger.info("Ajout de la colonne 'environment' à la table personas...");
        db.exec("ALTER TABLE personas ADD COLUMN environment TEXT");
      }
      const hasImage = columns.some((column) => column.name === "image");
      if (!hasImage) {
        logger.info("Ajout de la colonne 'image' à la table personas...");
        db.exec("ALTER TABLE personas ADD COLUMN image TEXT");
      }

      db.exec(`
        DELETE FROM characters
        WHERE id NOT IN (SELECT MAX(id) FROM characters GROUP BY persona_id);
        DELETE FROM relationships
        WHERE id NOT IN (SELECT MAX(id) FROM relationships GROUP BY persona_id);
        DELETE FROM outfits
        WHERE id NOT IN (SELECT MAX(id) FROM outfits GROUP BY persona_id);

        CREATE UNIQUE INDEX IF NOT EXISTS characters_persona_id_unique
        ON characters(persona_id);
        CREATE UNIQUE INDEX IF NOT EXISTS relationships_persona_id_unique
        ON relationships(persona_id);
        CREATE UNIQUE INDEX IF NOT EXISTS outfits_persona_id_unique
        ON outfits(persona_id);
      `);
    }
  }
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
    logger.info("Base de données fermée.");
  }
}

function deleteConversation(personaId) {
  const db = getDb();
  try {
    const stmt = db.prepare("DELETE FROM conversations WHERE persona_id = ?");
    stmt.run(personaId);
    // Also re-insert the introduction message to truly "reset" the chat
    const personaStmt = db.prepare("SELECT introduction FROM personas WHERE id = ?");
    const persona = personaStmt.get(personaId);
    if (persona) {
      const insertIntroStmt = db.prepare("INSERT INTO conversations (persona_id, role, content) VALUES (?, 'assistant', ?)");
      insertIntroStmt.run(personaId, persona.introduction);
    }
    return { success: true };
  } catch (error) {
    logger.error(`Failed to delete conversation for persona ${personaId}`, { error });
    return { success: false, error: "Internal Server Error" };
  }
}

module.exports = { getDb, closeDb, deleteConversation };
