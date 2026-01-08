const { getDb } = require("./database");

/**
 * Generates a detailed system prompt for a given persona.
 * It fetches detailed data (character, relationship, outfit) from the database
 * and formats it into a single context block.
 * If no detailed data is found, it returns an empty string.
 * @param {object} persona - The persona object, must contain an 'id'.
 * @returns {string} The generated system prompt or an empty string.
 */
function generateDetailedPrompt(persona) {
  const db = getDb();
  const personaId = persona.id;

  try {
    const charStmt = db.prepare("SELECT data FROM characters WHERE persona_id = ? LIMIT 1");
    const characterRow = charStmt.get(personaId);

    // If no character data, assume no detailed data exists and return empty.
    if (!characterRow) {
      return "";
    }

    const relStmt = db.prepare("SELECT data FROM relationships WHERE persona_id = ? LIMIT 1");
    const relationshipRow = relStmt.get(personaId);

    const outfitStmt = db.prepare("SELECT data FROM outfits WHERE persona_id = ? LIMIT 1");
    const outfitRow = outfitStmt.get(personaId);

    const character = JSON.parse(characterRow.data);
    const relationship = relationshipRow ? JSON.parse(relationshipRow.data) : null;
    const outfit = outfitRow ? JSON.parse(outfitRow.data) : null;

    const context = {
      character,
      relationship,
      outfit,
    };

    const contextFrame = `[PROMPT CONTEXTE]\n${JSON.stringify(context, null, 2)}\n[/PROMPT CONTEXTE]`;

    return contextFrame;

  } catch (error) {
    console.error(`Erreur lors de la génération du prompt détaillé pour ${personaId}:`, error);
    // In case of error (e.g., JSON parsing failed), return empty string.
    return "";
  }
}

module.exports = { generateDetailedPrompt };
