const { getDb } = require("./database");

/**
 * Generates a detailed system prompt for a given persona.
 * It fetches detailed data from the database and formats it.
 * If no detailed data is found, it falls back to the persona's default prompt.
 * @param {object} persona - The persona object, must contain an 'id' and a 'prompt'.
 * @returns {string} The generated system prompt.
 */
function generateDetailedPrompt(persona) {
  const db = getDb();
  const personaId = persona.id;

  try {
    const charStmt = db.prepare("SELECT data FROM characters WHERE persona_id = ?");
    const characterRow = charStmt.get(personaId);

    // If no character data, assume no detailed data exists and use fallback
    if (!characterRow) {
      return persona.prompt;
    }

    const relStmt = db.prepare("SELECT data FROM relationships WHERE persona_id = ?");
    const relationshipRow = relStmt.get(personaId);

    const outfitStmt = db.prepare("SELECT data FROM outfits WHERE persona_id = ?");
    const outfitRow = outfitStmt.get(personaId);

    const character = JSON.parse(characterRow.data);
    const relationship = relationshipRow ? JSON.parse(relationshipRow.data) : null;
    const outfit = outfitRow ? JSON.parse(outfitRow.data) : null;

    const context = {
      character,
      relationship,
      outfit,
    };

    const promptFrame = `[PROMPT CADRE]\n${persona.prompt}\n[/PROMPT CADRE]`;
    const contextFrame = `[PROMPT CONTEXTE]\n${JSON.stringify(context, null, 2)}\n[/PROMPT CONTEXTE]`;

    return `${promptFrame}\n\n${contextFrame}`;

  } catch (error) {
    console.error(`Erreur lors de la génération du prompt détaillé pour ${personaId}:`, error);
    // In case of error (e.g., JSON parsing failed), fallback to the original prompt
    return persona.prompt;
  }
}

module.exports = { generateDetailedPrompt };
