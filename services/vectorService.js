const { ChromaClient } = require("chromadb");
const { getDb } = require("./database");
const { ollamaGenerateEmbedding } = require("./ollama");
const logger = require("./logger");

const EMBEDDING_MODEL = "nomic-embed-text";
const client = new ChromaClient();

// --- Helper Functions ---

/**
 * Recursively traverses a JSON object and splits it into text chunks.
 * @param {object} obj The object to chunk.
 * @param {string} prefix A prefix for nested keys.
 * @returns {string[]} An array of text chunks.
 */
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

/**
 * Generates embeddings for a list of documents in parallel.
 * @param {string[]} documents Array of text documents.
 * @returns {Promise<number[][]>} A promise that resolves to an array of embeddings.
 */
async function generateEmbeddings(documents) {
    if (!documents || documents.length === 0) return [];
    const embeddingPromises = documents.map(doc =>
        ollamaGenerateEmbedding({ model: EMBEDDING_MODEL, prompt: doc })
    );
    const responses = await Promise.all(embeddingPromises);
    return responses.map(res => res.embedding);
}

// --- Main Service Functions ---

/**
 * Initializes the vector database non-destructively.
 * It checks for existing data and only indexes if a collection is empty.
 */
async function initialize() {
  logger.info("Vector service initializing...");
  try {
    const db = getDb();
    const personas = db.prepare("SELECT id FROM personas").all();
    logger.info(`Checking indices for ${personas.length} personas.`);

    for (const persona of personas) {
      const collection = await client.getOrCreateCollection({ name: persona.id });
      const count = await collection.count();
      if (count === 0) {
        logger.info(`Collection for ${persona.id} is empty. Performing full index.`);
        await indexFullPersona(persona.id);
      }
    }
    logger.info("Vector service initialization complete.");
  } catch (error) {
    logger.error("Failed to initialize vector service", { error });
  }
}

/**
 * (Re)Indexes all data for a persona. Used for initialization.
 * @param {string} personaId The ID of the persona.
 */
async function indexFullPersona(personaId) {
    const db = getDb();
    const collection = await client.getOrCreateCollection({ name: personaId });

    // Index static data
    const staticDocs = getStaticDocs(db, personaId);
    if (staticDocs.length > 0) {
        const staticEmbeddings = await generateEmbeddings(staticDocs);
        const staticIds = staticDocs.map((_, i) => `static_${i}`);
        const staticMetadatas = staticDocs.map(() => ({ type: "static" }));
        await collection.add({ ids: staticIds, embeddings: staticEmbeddings, documents: staticDocs, metadatas: staticMetadatas });
    }

    // Index conversation data
    const convo = db.prepare("SELECT id, role, content FROM conversations WHERE persona_id = ?").all(personaId);
    const convoDocs = convo.map(msg => `${msg.role}: ${msg.content}`);
    if (convoDocs.length > 0) {
        const convoEmbeddings = await generateEmbeddings(convoDocs);
        const convoIds = convo.map(msg => `msg_${msg.id}`);
        const convoMetadatas = convo.map(() => ({ type: "conversation" }));
        await collection.add({ ids: convoIds, embeddings: convoEmbeddings, documents: convoDocs, metadatas: convoMetadatas });
    }
    logger.info(`Completed full index for persona: ${personaId}`);
}

/**
 * Helper to get static documents for a persona.
 * @param {*} db The database instance.
 * @param {string} personaId The persona ID.
 * @returns {string[]} Array of document strings.
 */
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

/**
 * Updates only the static character data in the vector store using metadata.
 * @param {string} personaId The ID of the persona to update.
 */
async function updateStaticPersonaData(personaId) {
  logger.info(`Updating static data for persona: ${personaId}`);
  try {
    const db = getDb();
    const collection = await client.getOrCreateCollection({ name: personaId });

    // 1. Delete old static documents using metadata
    await collection.delete({ where: { "type": "static" } });
    logger.info(`Deleted old static docs for persona ${personaId}.`);

    // 2. Get, chunk, and index new static data
    const documents = getStaticDocs(db, personaId);
    if (documents.length > 0) {
        const embeddings = await generateEmbeddings(documents);
        const ids = documents.map((_, i) => `static_${i}`);
        const metadatas = documents.map(() => ({ type: "static" }));
        await collection.add({ ids, embeddings, documents, metadatas });
        logger.info(`Successfully indexed ${documents.length} new static documents for persona: ${personaId}`);
    }
  } catch (error) {
    logger.error(`Failed to update static data for persona ${personaId}`, { error });
  }
}

/**
 * Adds a single message from a conversation to the vector collection with a stable ID.
 * @param {string} personaId The ID of the persona.
 * @param {object} message The message object ({ id, role, content }).
 */
async function addMessageToCollection(personaId, message) {
  try {
    const collection = await client.getOrCreateCollection({ name: personaId });
    const document = `${message.role}: ${message.content}`;
    const [embedding] = await generateEmbeddings([document]);

    if (embedding) {
        await collection.add({
            ids: [`msg_${message.id}`],
            embeddings: [embedding],
            documents: [document],
            metadatas: [{ type: "conversation" }],
        });
    }
  } catch (error) {
    logger.error(`Failed to add message to collection for persona ${personaId}`, { error });
  }
}

/**
 * Queries the vector database to find relevant context.
 * @param {string} personaId The ID of the persona's conversation.
 * @param {string} userMessage The user's message.
 * @returns {Promise<string[]>} A list of relevant context snippets.
 */
async function queryContext(personaId, userMessage) {
    try {
        const collection = await client.getOrCreateCollection({ name: personaId });
        const [queryEmbedding] = await generateEmbeddings([userMessage]);

        if (!queryEmbedding) return [];

        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: 5,
        });

        return results.documents[0] || [];
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
