const { getDb } = require("./database");

/**
 * Formats the detailed character, relationship, and outfit data into a single text prompt.
 * @param {object} character - The character data object.
 * @param {object} relationship - The relationship data object.
 * @param {object} outfit - The outfit data object.
 * @returns {string} A formatted prompt string.
 */
function formatDataToText(character, relationship, outfit) {
    let prompt = "// PERSONNAGE DÉTAILLÉ\n";

    if (character) {
        prompt += "\n// IDENTITÉ ET APPARENCE\n";
        prompt += `- Nom: ${character.name}, ${character.age} ans\n`;
        prompt += `- Origine: ${character.profile.origin}\n`;
        prompt += `- Voix: ${character.profile.voice.tone}, ${character.profile.voice.pace}, style de phrases ${character.profile.voice.style}\n`;
        prompt += `- Apparence: ${character.appearance.height_cm}cm, corpulence ${character.appearance.build}, peau ${character.appearance.skin}\n`;
        prompt += `- Visage: ${character.appearance.face.shape}, yeux ${character.appearance.face.eyes}, expression par défaut ${character.appearance.face.expression_default}\n`;
        prompt += `- Cheveux: ${character.appearance.hair.color}, ${character.appearance.hair.length}, ${character.appearance.hair.style}\n`;
    }

    if (relationship) {
        prompt += "\n// RELATION AVEC L'UTILISATEUR\n";
        prompt += `- Statut: ${relationship.status}\n`;
        prompt += `- Dynamique: Confiance ${relationship.dynamics.trust}/10, Aisance ${relationship.dynamics.comfort}/10, Intérêt ${relationship.dynamics.interest}/10, Timidité ${relationship.dynamics.shyness}/10\n`;
        prompt += `- Limites: Rythme ${relationship.boundaries.pace}, Initiative physique ${relationship.boundaries.physical_initiative}\n`;
    }

    if (outfit) {
        prompt += "\n// TENUE ACTUELLE\n";
        prompt += `- Haut: ${outfit.upper_body.main_top.item} ${outfit.upper_body.main_top.color}\n`;
        if (outfit.upper_body.mid_layer) {
             prompt += `- Couche intermédiaire: ${outfit.upper_body.mid_layer.item} ${outfit.upper_body.mid_layer.color}\n`;
        }
        if (outfit.upper_body.outer_layer) {
             prompt += `- Manteau: ${outfit.upper_body.outer_layer.item} ${outfit.upper_body.outer_layer.color}\n`;
        }
        prompt += `- Bas: ${outfit.lower_body.main_bottom.item} ${outfit.lower_body.main_bottom.color}\n`;
        prompt += `- Chaussures: ${outfit.footwear.item} ${outfit.footwear.color}\n`;
        if (outfit.accessories && outfit.accessories.length > 0) {
            prompt += `- Accessoires: ${outfit.accessories.join(', ')}\n`;
        }
    }

    prompt += "\n// DIRECTIVES GLOBALES\n";
    prompt += "Tu dois te comporter comme le personnage décrit ci-dessus. Ne sors jamais de ton rôle. Tes réponses doivent être narratives, à la première personne. Décris les actions, les pensées et les émotions du personnage. Les dialogues doivent être entre guillemets. Ne résume pas, ne propose pas de choix, incarne le personnage.";

    return prompt;
}

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

    return formatDataToText(character, relationship, outfit);

  } catch (error) {
    console.error(`Erreur lors de la génération du prompt détaillé pour ${personaId}:`, error);
    // In case of error (e.g., JSON parsing failed), fallback to the original prompt
    return persona.prompt;
  }
}

module.exports = { generateDetailedPrompt };
