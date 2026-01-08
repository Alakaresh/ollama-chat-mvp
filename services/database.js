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
          prompt TEXT NOT NULL,
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
    }
    // Run migration after ensuring tables exist
    migratePersonas(db);
    migrateMeiData(db);
  }
  return db;
}

// Function to migrate Mei's detailed data
function migrateMeiData(db) {
  console.log("Vérification de la migration des données de Mei...");
  const personaId = "mei";

  // 1. Check if Mei persona exists, if not, create it.
  const personaExistsStmt = db.prepare("SELECT COUNT(*) as count FROM personas WHERE id = ?");
  let { count } = personaExistsStmt.get(personaId);

  if (count === 0) {
    console.log("Persona 'Mei' non trouvé. Création...");
    const insertPersona = db.prepare(`
      INSERT INTO personas (id, name, label, nsfw, tags, introduction, prompt, environment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPersona.run(
      personaId,
      "Mei",
      "Jeune étudiante timide",
      0, // nsfw = false
      JSON.stringify(["timide", "étudiante", "asiatique"]),
      "Je te vois t'approcher et baisse un peu les yeux, un léger rougissement sur les joues. \"S-salut...\"",
      `// IDENTITÉ
- Prénom : Mei
- Rôle : Camarade de classe
- Âge : 18
- Cadre : Bibliothèque, salle de classe

// PERSONNALITÉ
- Timide, réservée, parle peu
- Intelligente et observatrice
- Rougit facilement

// OBJECTIF DE CONVERSATION
- Répondre aux questions sans prendre l'initiative
- Garder un échange simple et court

// LIMITES
- Ne pose pas de questions personnelles
- N'initie jamais le contact physique`,
      "Tu es dans une bibliothèque. Le silence est seulement rompu par le bruit des pages qui tournent. Mei est assise seule à une table, plongée dans un livre."
    );
     // Also add the introduction as the first message in the conversation
    const insertConversation = db.prepare(`
      INSERT INTO conversations (persona_id, role, content)
      VALUES (?, ?, ?)
    `);
    insertConversation.run(personaId, "assistant", "Je te vois t'approcher et baisse un peu les yeux, un léger rougissement sur les joues. \"S-salut...\"");
    console.log("Persona 'Mei' créé.");
  }

  // 2. Check if character data exists for Mei, if not, insert it.
  const characterExistsStmt = db.prepare("SELECT COUNT(*) as count FROM characters WHERE persona_id = ?");
  count = characterExistsStmt.get(personaId).count;

  if (count === 0) {
    console.log("Données de 'character' pour Mei non trouvées. Insertion...");
    const characterData = {
      id: "mei",
      name: "Mei",
      age: 18,
      profile: {
        origin: "asiatique",
        voice: { tone: "doux", pace: "lent", style: "phrases simples" }
      },
      appearance: {
        height_cm: 158,
        build: "fine",
        skin: "claire",
        face: {
          shape: "ovale",
          eyes: "marron",
          expression_default: "timide"
        },
        hair: {
          color: "noir",
          length: "mi-long",
          style: "lisse",
          fringe: "légère",
          tied: "queue de cheval basse"
        }
      }
    };
    const insertCharacter = db.prepare("INSERT INTO characters (persona_id, data) VALUES (?, ?)");
    insertCharacter.run(personaId, JSON.stringify(characterData));
    console.log("Données de 'character' pour Mei insérées.");

    // Insert relationship data
    const relationshipData = {
      status: "camarade",
      dynamics: { trust: 3, comfort: 4, interest: 2, shyness: 7 },
      boundaries: { pace: "lent", physical_initiative: "faible", public_affection: "faible" }
    };
    const insertRelationship = db.prepare("INSERT INTO relationships (persona_id, data) VALUES (?, ?)");
    insertRelationship.run(personaId, JSON.stringify(relationshipData));
    console.log("Données de 'relationship' pour Mei insérées.");

    // Insert outfit data
    const outfitData = {
      upper_body: {
        underwear: { top: { item: "soutien-gorge", color: "blanc", style: "simple", material: "coton" }},
        main_top: { item: "chemise", color: "blanc cassé", sleeves: "longues", fit: "ajusté", material: "coton" },
        mid_layer: { item: "gilet", color: "beige clair", sleeves: "longues", fit: "ample", open: true },
        outer_layer: { item: "manteau", color: "gris", length: "mi-cuisse", open: false }
      },
      lower_body: {
        underwear: { bottom: { item: "culotte", color: "blanc", style: "simple", material: "coton" }},
        main_bottom: { item: "jupe plissée", color: "bleu marine", length: "genoux", fit: "classique" }
      },
      footwear: { item: "baskets", color: "blanches", condition: "propres" },
      accessories: ["barrette argentée", "badge de la bibliothèque"],
      condition: { clean: true, wrinkled: false, wet: false, temperature_effect: "neutre" }
    };
    const insertOutfit = db.prepare("INSERT INTO outfits (persona_id, data) VALUES (?, ?)");
    insertOutfit.run(personaId, JSON.stringify(outfitData));
    console.log("Données de 'outfit' pour Mei insérées.");
  }
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
