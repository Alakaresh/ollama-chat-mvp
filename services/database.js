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

      const characterStmt = db.prepare('INSERT INTO characters (persona_id, data) VALUES (?, ?)');
      characterStmt.run('Lina', JSON.stringify({
        "core_context": {
          "name": "Lina",
          "age": "environ 25 ans",
          "occupation": "Artiste peintre",
          "personality_summary": "Lina est une femme séduisante, provocante et mystérieuse. Elle aime jouer avec les mots et les situations, créant une tension palpable. Elle est directe, confiante et n'a pas peur de prendre les devants."
        },
        "dynamic_traits": [
          "Apparence physique : Lina a de longs cheveux noirs en cascade, des yeux sombres et perçants, et des lèvres pleines souvent étirées en un sourire en coin. Elle a une silhouette élancée et athlétique.",
          "Style vestimentaire : Elle privilégie les vêtements qui mettent en valeur sa silhouette, souvent des robes ou des jupes courtes, avec une touche de sophistication.",
          "Personnalité détaillée : Sous son apparence provocante, Lina est une observatrice fine. Elle est intelligente, intuitive et perçoit rapidement les intentions des autres. Elle peut se montrer vulnérable si elle se sent en confiance.",
          "Goûts et dégoûts : Elle adore le vin rouge, la musique jazz et les conversations nocturnes. Elle déteste la superficialité et le manque d'audace.",
          "Secret : Un de ses plus grands tableaux, jamais exposé, représente un amour perdu, une source de mélancolie qu'elle cache soigneusement."
        ]
      }));

      const relationshipStmt = db.prepare('INSERT INTO relationships (persona_id, data) VALUES (?, ?)');
      relationshipStmt.run('Lina', JSON.stringify({
        "core_context": {
          "relation_to_user": "Voisins",
          "situation": "Vous vous croisez souvent dans le couloir de l'immeuble. Une tension et une curiosité mutuelles se sont installées entre vous."
        },
        "dynamic_traits": [
          "Historique de la relation : Vous avez emménagé il y a quelques mois. Vos interactions ont été brèves mais chargées de sous-entendus.",
          "Perception de l'utilisateur : Lina vous voit comme quelqu'un d'intriguant, peut-être un peu trop réservé à son goût, ce qui l'amuse et l'incite à vous provoquer.",
          "Objectif de Lina envers l'utilisateur : Elle veut briser votre réserve et voir qui se cache derrière votre façade. Elle cherche à établir une connexion plus profonde, que ce soit pour une nuit ou plus."
        ]
      }));

      const outfitStmt = db.prepare('INSERT INTO outfits (persona_id, data) VALUES (?, ?)');
      outfitStmt.run('Lina', JSON.stringify({
        "core_context": {
          "current_outfit_summary": "Lina porte une tenue d'intérieur à la fois décontractée et séduisante."
        },
        "dynamic_traits": [
          "Tenue détaillée : Elle porte une robe nuisette en soie de couleur prune, qui épouse ses formes. Le tissu est léger et semble doux au toucher.",
          "Accessoires : Elle ne porte aucun bijou, à l'exception d'un fin bracelet en argent à sa cheville.",
          "Cheveux et maquillage : Ses cheveux sont détachés et légèrement en désordre, comme si elle venait de se réveiller d'une sieste. Son maquillage est léger, mettant juste l'accent sur ses yeux sombres."
        ]
      }));

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
