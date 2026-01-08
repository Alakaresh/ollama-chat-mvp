const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const DB_FILE = "chat.db";

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_FILE); // removed verbose logging
    const stmt = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='personas'`
    );
    const tableExists = stmt.get();

    if (!tableExists) {
      console.log("Création du schéma de la base de données...");
      db.exec(`
        CREATE TABLE personas (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          label TEXT NOT NULL,
          nsfw INTEGER NOT NULL,
          tags TEXT,
          introduction TEXT NOT NULL,
          environment TEXT
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
          persona_id TEXT NOT NULL,
          data TEXT NOT NULL,
          FOREIGN KEY (persona_id) REFERENCES personas (id)
        );

        CREATE TABLE relationships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id TEXT NOT NULL,
          data TEXT NOT NULL,
          FOREIGN KEY (persona_id) REFERENCES personas (id)
        );

        CREATE TABLE outfits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id TEXT NOT NULL,
          data TEXT NOT NULL,
          FOREIGN KEY (persona_id) REFERENCES personas (id)
        );
      `);
      console.log("Schéma créé.");
    } else {
      const columns = db.prepare("PRAGMA table_info(personas)").all();
      const hasEnvironment = columns.some((column) => column.name === "environment");
      if (!hasEnvironment) {
        console.log("Ajout de la colonne 'environment' à la table personas...");
        db.exec("ALTER TABLE personas ADD COLUMN environment TEXT");
      }
    }
  }
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log("Base de données fermée.");
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
    console.error(`Failed to delete conversation for persona ${personaId}:`, error);
    return { success: false, error: "Internal Server Error" };
  }
}

module.exports = { getDb, closeDb, deleteConversation };
