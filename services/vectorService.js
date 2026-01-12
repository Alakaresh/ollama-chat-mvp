const lancedb = require('@lancedb/lancedb');
const path = require('path');
const { Schema, Field, Float32, FixedSizeList, Int32, Utf8 } = require('apache-arrow');
const { getDb } = require('./database');
const logger = require('./logger');

const DB_PATH = '.lancedb';
const OLLAMA_EMBED_MODEL = 'nomic-embed-text';
let db;
let table;
let vectorSearchEnabled = true;

function getOllamaHost() {
    return process.env.OLLAMA_HOST || 'http://localhost:11434';
}

async function generateEmbedding(text) {
    const baseUrl = getOllamaHost().replace(/\/(api|v1)\/?$/, '');
    const endpoints = [
        {
            url: `${baseUrl}/api/embeddings`,
            payload: { model: OLLAMA_EMBED_MODEL, prompt: text },
            getEmbedding: data => data?.embedding,
        },
        {
            url: `${baseUrl}/v1/embeddings`,
            payload: { model: OLLAMA_EMBED_MODEL, input: text },
            getEmbedding: data => data?.data?.[0]?.embedding,
        },
    ];
    try {
        let lastError;
        for (const endpoint of endpoints) {
            const response = await fetch(endpoint.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(endpoint.payload),
            });
            const responseText = await response.text();
            let data;
            if (responseText) {
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    lastError = new Error(`Ollama API error (${response.status}): ${responseText}`);
                    lastError.status = response.status;
                    continue;
                }
            }
            if (!response.ok) {
                const errorMessage = data?.error || responseText || response.statusText;
                lastError = new Error(`Ollama API error (${response.status}): ${errorMessage}`);
                lastError.status = response.status;
                if (response.status !== 404) {
                    break;
                }
                continue;
            }
            const embedding = endpoint.getEmbedding(data);
            if (!embedding) {
                throw new Error('Ollama API error: embedding missing from response');
            }
            return embedding;
        }
        throw lastError || new Error('Ollama API error: no embeddings endpoint available');
    } catch (error) {
        logger.error('Failed to generate embedding via Ollama', { error: error.message, baseUrl });
        throw error;
    }
}

async function initialize() {
    if (table || !vectorSearchEnabled) return;
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
        await synchronizePersonaData();
        await synchronize();
    } catch (error) {
        logger.error('Failed to initialize LanceDB', { error });
        vectorSearchEnabled = false;
        logger.warn('Vector search disabled due to initialization failure.');
    }
}

async function synchronizePersonaData() {
    logger.info('Synchronizing persona data to memories table...');
    const sqlite = getDb();
    try {
        const transaction = sqlite.transaction(() => {
            // Clear old persona traits to avoid duplicates
            sqlite.prepare(`DELETE FROM memories WHERE type = 'static_persona'`).run();

            const tables = ['characters', 'relationships', 'outfits'];
            const insertStmt = sqlite.prepare(`
                INSERT INTO memories (persona_id, type, content) VALUES (?, 'static_persona', ?)
            `);

            let traitsIndexed = 0;
            for (const table of tables) {
                const rows = sqlite.prepare(`SELECT persona_id, data FROM ${table}`).all();
                for (const row of rows) {
                    const data = JSON.parse(row.data);
                    if (data.dynamic_traits && Array.isArray(data.dynamic_traits)) {
                        for (const trait of data.dynamic_traits) {
                            insertStmt.run(row.persona_id, trait);
                            traitsIndexed++;
                        }
                    }
                }
            }
            logger.info(`Indexed ${traitsIndexed} dynamic persona traits into memories.`);
        });
        transaction();
    } catch (error) {
        logger.error('Failed to synchronize persona data into memories table.', { error });
    }
}

async function synchronize() {
    logger.info('Synchronizing SQLite memories with LanceDB...');
    if (!table) return;
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

    if (!table) {
        logger.warn('Skipping vector index update; LanceDB is unavailable.');
        return memoryId;
    }

    try {
        const embedding = await generateEmbedding(content);

        await table.add([{
            vector: embedding,
            id: memoryId,
            persona_id
        }]);
        logger.info(`Added new memory (ID: ${memoryId}) to both SQLite and LanceDB.`);
    } catch (error) {
        logger.warn('Failed to add memory to LanceDB; stored only in SQLite.', { error: error.message });
    }
    return memoryId;
}

async function searchMemories({ queryText, persona_id, k = 5, type = null }) {
    if (!table) await initialize();
    if (!table) return [];
    let queryEmbedding;
    try {
        queryEmbedding = await generateEmbedding(queryText);
    } catch (error) {
        logger.warn('Skipping vector search; embedding generation failed.', { error: error.message });
        return [];
    }

    let query = table.search(queryEmbedding)
                     .where(`persona_id = '${persona_id}'`)
                     .limit(k);

    const results = await query.toArray();

    const memoryIds = results.map(r => r.id);
    if (memoryIds.length === 0) return [];

    const sqlite = getDb();
    const placeholders = memoryIds.map(() => '?').join(',');
    let sqlQuery = `SELECT id, content, type FROM memories WHERE id IN (${placeholders})`;
    let params = [...memoryIds];

    if (type) {
        const types = Array.isArray(type) ? type : [type];
        if (types.length > 0) {
            const typePlaceholders = types.map(() => '?').join(',');
            sqlQuery += ` AND type IN (${typePlaceholders})`;
            params.push(...types);
        }
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
