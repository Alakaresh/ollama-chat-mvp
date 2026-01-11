const lancedb = require('@lancedb/lancedb');
const path = require('path');
const { Schema, Field, Float32, FixedSizeList, Int32, Utf8 } = require('apache-arrow');
const { getDb } = require('./database');
const logger = require('./logger');

const DB_PATH = '.lancedb';
const OLLAMA_EMBED_MODEL = 'nomic-embed-text';
let db;
let table;

function getOllamaHost() {
    return process.env.OLLAMA_HOST || 'http://localhost:11434';
}

async function generateEmbedding(text) {
    const url = `${getOllamaHost()}/api/embeddings`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_EMBED_MODEL,
                prompt: text,
            }),
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.embedding;
    } catch (error) {
        logger.error('Failed to generate embedding via Ollama', { error: error.message, url });
        throw error;
    }
}

async function initialize() {
    if (table) return;
    try {
        const uri = path.join(__dirname, '..', DB_PATH);
        db = await lancedb.connect(uri);
        const tableNames = await db.tableNames();

        if (!tableNames.includes('vectors')) {
            logger.info('LanceDB table "vectors" not found, creating new one.');
            const schemaEmbedding = await generateEmbedding('schema probe');
            const schema = new Schema([
                new Field('vector', new FixedSizeList(schemaEmbedding.length, new Field('item', new Float32(), false)), false),
                new Field('id', new Int32(), false),
                new Field('persona_id', new Utf8(), false),
            ]);
            table = await db.createEmptyTable('vectors', schema);
        } else {
            table = await db.openTable('vectors');
        }
        logger.info('Vector service initialized successfully.');
        await synchronize();
    } catch (error) {
        logger.error('Failed to initialize LanceDB', { error });
        throw error;
    }
}

async function synchronize() {
    logger.info('Synchronizing SQLite memories with LanceDB...');
    const sqlite = getDb();
    const memories = sqlite.prepare('SELECT id, content, persona_id FROM memories').all();
    const indexedIds = new Set((await table.search().limit(10000).execute()).map(r => r.id));

    const unindexedMemories = memories.filter(m => !indexedIds.has(m.id));

    if (unindexedMemories.length > 0) {
        logger.info(`Found ${unindexedMemories.length} unindexed memories. Indexing now...`);
        const embeddings = await Promise.all(
            unindexedMemories.map(m => generateEmbedding(m.content))
        );
        const data = unindexedMemories.map((m, i) => ({
            vector: embeddings[i],
            id: m.id,
            persona_id: m.persona_id
        }));
        await table.add(data);
        logger.info('Synchronization complete.');
    } else {
        logger.info('No new memories to index. LanceDB is up to date.');
    }
}

async function addMemory({ persona_id, type, content }) {
    if (!table) await initialize();
    const sqlite = getDb();
    const stmt = sqlite.prepare('INSERT INTO memories (persona_id, type, content) VALUES (?, ?, ?)');
    const info = stmt.run(persona_id, type, content);
    const memoryId = info.lastInsertRowid;

    const embedding = await generateEmbedding(content);

    await table.add([{
        vector: embedding,
        id: memoryId,
        persona_id
    }]);
    logger.info(`Added new memory (ID: ${memoryId}) to both SQLite and LanceDB.`);
    return memoryId;
}

async function searchMemories({ queryText, persona_id, k = 5, type = null }) {
    if (!table) await initialize();
    const queryEmbedding = await generateEmbedding(queryText);

    let query = table.search(queryEmbedding)
                     .where(`persona_id = '${persona_id}'`)
                     .limit(k);

    const results = await query.execute();

    // The LanceDB Node.js SDK doesn't support complex WHERE clauses yet.
    // We'll have to do the type filtering manually after the initial search.
    const memoryIds = results.map(r => r.id);
    if (memoryIds.length === 0) return [];

    const sqlite = getDb();
    const placeholders = memoryIds.map(() => '?').join(',');
    let sqlQuery = `SELECT id, content, type FROM memories WHERE id IN (${placeholders})`;
    const params = [...memoryIds];

    if (type) {
        sqlQuery = `SELECT id, content, type FROM memories WHERE id IN (${placeholders}) AND type = ?`;
        params.push(type);
    }

    const stmt = sqlite.prepare(sqlQuery);
    const memories = stmt.all(...params);

    // Re-sort based on the original relevance from LanceDB
    const sortedMemories = memoryIds.map(id => memories.find(m => m.id === id)).filter(Boolean);

    return sortedMemories.map(m => m.content);
}

module.exports = {
    initialize,
    addMemory,
    searchMemories,
};
