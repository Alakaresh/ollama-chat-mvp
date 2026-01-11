const { connect } = require("vectordb");
const { getDb } = require("./database");
const { ollamaGenerateEmbedding } = require("./ollama");
const logger = require("./logger");
const path = require("path");

const EMBEDDING_MODEL = "nomic-embed-text";
const DB_DIR = path.join(__dirname, "..", ".lancedb");

// --- Helper Functions ---

function chunkObject(obj, prefix = "") {
  let chunks = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const newPrefix = prefix ? `${prefix} - ${key}` : key;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        chunks = chunks.concat(chunkObject(value, newPrefix));
      } else if (Array.isArray(value)) {
        chunks.push(`${newPrefix}: ${value.join(", ")}`);
      } else if (value) {
        chunks.push(`${newPrefix}: ${value}`);
      }
    }
  }
  return chunks;
}

async function generateEmbeddings(documents) {
    if (!documents || documents.length === 0) return [];
    const embeddingPromises = documents.map(doc =>
        ollamaGenerateEmbedding({ model: EMBEDDING_MODEL, prompt: doc })
    );
    const responses = await Promise.all(embeddingPromises);
    return responses.map(res => res.embedding);
}

async function getTable(personaId) {
    const db = await connect(DB_DIR);
    const tables = await db.tableNames();
    if (!tables.includes(personaId)) {
        const initialVector = await generateEmbeddings(["initial"]);
        return await db.createTable(personaId, [{ vector: initialVector[0], text: "initial", type: "initial", id: "0" }]);
    }
    return await db.openTable(personaId);
}

// --- Main Service Functions ---

async function initialize() {
  logger.info("Vector service initializing (LanceDB)...");
  try {
    const db = getDb();
    const personas = db.prepare("SELECT id FROM personas").all();
    logger.info(`Checking indices for ${personas.length} personas.`);

    for (const persona of personas) {
      const table = await getTable(persona.id);
      const count = await table.countRows();
      if (count <= 1) { // Only initial data
        logger.info(`Collection for ${persona.id} is empty. Performing full index.`);
        await indexFullPersona(persona.id);
      }
    }
    logger.info("Vector service initialization complete.");
  } catch (error) {
    logger.error("Failed to initialize vector service", { error });
  }
}

async function indexFullPersona(personaId) {
    const db = getDb();
    const table = await getTable(personaId);

    const staticDocs = getStaticDocs(db, personaId);
    if (staticDocs.length > 0) {
        const staticEmbeddings = await generateEmbeddings(staticDocs);
        const data = staticDocs.map((doc, i) => ({
            vector: staticEmbeddings[i],
            text: doc,
            type: "static",
            id: `static_${i}`
        }));
        await table.add(data);
    }

    const convo = db.prepare("SELECT id, role, content FROM conversations WHERE persona_id = ?").all(personaId);
    if (convo.length > 0) {
        const convoDocs = convo.map(msg => `${msg.role}: ${msg.content}`);
        const convoEmbeddings = await generateEmbeddings(convoDocs);
        const data = convo.map((msg, i) => ({
            vector: convoEmbeddings[i],
            text: convoDocs[i],
            type: "conversation",
            id: `msg_${msg.id}`
        }));
        await table.add(data);
    }
    logger.info(`Completed full index for persona: ${personaId}`);
}

function getStaticDocs(db, personaId) {
    const stmt = db.prepare(
        "SELECT c.data as character, r.data as relationship, o.data as outfit FROM personas p LEFT JOIN characters c ON p.id = c.persona_id LEFT JOIN relationships r ON p.id = r.persona_id LEFT JOIN outfits o ON p.id = o.persona_id WHERE p.id = ?"
    );
    const data = stmt.get(personaId);
    const documents = [];
    if (data) {
        if (data.character) documents.push(...chunkObject(JSON.parse(data.character), "character"));
        if (data.relationship) documents.push(...chunkObject(JSON.parse(data.relationship), "relationship"));
        if (data.outfit) documents.push(...chunkObject(JSON.parse(data.outfit), "outfit"));
    }
    return documents;
}

async function updateStaticPersonaData(personaId) {
  logger.info(`Updating static data for persona: ${personaId}`);
  try {
    const db = getDb();
    const table = await getTable(personaId);
    await table.delete('type = "static"');
    logger.info(`Deleted old static docs for persona ${personaId}.`);

    const documents = getStaticDocs(db, personaId);
    if (documents.length > 0) {
        const embeddings = await generateEmbeddings(documents);
        const data = documents.map((doc, i) => ({
            vector: embeddings[i],
            text: doc,
            type: "static",
            id: `static_${i}`
        }));
        await table.add(data);
        logger.info(`Successfully indexed ${documents.length} new static documents for persona: ${personaId}`);
    }
  } catch (error) {
    logger.error(`Failed to update static data for persona ${personaId}`, { error });
  }
}

async function addMessageToCollection(personaId, message) {
  try {
    const table = await getTable(personaId);
    const document = `${message.role}: ${message.content}`;
    const [embedding] = await generateEmbeddings([document]);

    if (embedding) {
        await table.add([{
            vector: embedding,
            text: document,
            type: "conversation",
            id: `msg_${message.id}`
        }]);
    }
  } catch (error) {
    logger.error(`Failed to add message to collection for persona ${personaId}`, { error });
  }
}

async function queryContext(personaId, userMessage) {
    try {
        const table = await getTable(personaId);
        const [queryEmbedding] = await generateEmbeddings([userMessage]);
        if (!queryEmbedding) return [];

        const results = await table.search(queryEmbedding).limit(5).execute();
        return results.map(r => r.text) || [];
    } catch (error) {
        logger.error(`Failed to query context for persona ${personaId}`, { error: error.message });
        return [];
    }
}

module.exports = {
  initialize,
  indexPersonaData: updateStaticPersonaData,
  addMessageToCollection,
  queryContext,
};
