const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const DB_FILE = "chat.db";

let db;

// Function to migrate personas from the frontend file
function migratePersonas(db) {
  console.log("Vérification de la migration des personas...");
  const countStmt = db.prepare("SELECT COUNT(*) as count FROM personas");
  const { count } = countStmt.get();

  if (count === 0) {
    console.log("Table 'personas' vide. Démarrage de la migration...");
    const appJsPath = path.join(__dirname, "../public/app.js");
    const appJsContent = fs.readFileSync(appJsPath, "utf-8");

    const startIndex = appJsContent.indexOf("const personas = [");
    if (startIndex === -1) {
      console.error("Impossible de trouver le tableau 'personas' dans app.js");
      return;
    }
    const endIndex = appJsContent.indexOf("];", startIndex);
    const personasString = appJsContent.substring(
      startIndex + "const personas = ".length,
      endIndex + 1
    );

    let personasData;
    try {
      personasData = new Function("return " + personasString)();
    } catch (e) {
      console.error(
        "Erreur lors du parsing du tableau des personas depuis app.js:",
        e
      );
      return;
    }

    const insertPersona = db.prepare(`
      INSERT INTO personas (id, name, label, nsfw, tags, introduction, prompt)
      VALUES (@id, @name, @label, @nsfw, @tags, @introduction, @prompt)
    `);
    const insertConversation = db.prepare(`
      INSERT INTO conversations (persona_id, role, content)
      VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((personas) => {
      for (const persona of personas) {
        insertPersona.run({
          id: persona.id,
          name: persona.name,
          label: persona.label,
          nsfw: persona.nsfw ? 1 : 0,
          tags: JSON.stringify(persona.tags || []),
          introduction: persona.introduction,
          prompt: persona.prompt,
        });
        // Also add the introduction as the first message in the conversation
        insertConversation.run(persona.id, "assistant", persona.introduction);
      }
    });

    insertMany(personasData);
    console.log(`Migration réussie : ${personasData.length} personas insérés.`);
  } else {
    console.log("La table 'personas' contient déjà des données. Pas de migration nécessaire.");
  }
}

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
          prompt TEXT NOT NULL
        );

        CREATE TABLE conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (persona_id) REFERENCES personas (id)
        );
      `);
      console.log("Schéma créé.");
    }
    // Run migration after ensuring tables exist
    migratePersonas(db);
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
