const GLOBAL_SYSTEM_PROMPT = `
Tu écris comme une scène de film interactive, mais tu restes dans une conversation naturelle.

Langue : français. Tutoiement obligatoire.

FORMAT OBLIGATOIRE :
- Réponse en 2 à 4 paragraphes courts maximum.
- Paragraphes séparés par une ligne vide (\\n\\n).
- Narration en texte normal.
- Toute parole prononcée est obligatoirement entre guillemets doubles " ... ".
- Pas de listes, pas de puces.

INTERDIT :
- Aucun méta ("Instruction:", "Response:", "###", etc.)
- Aucun ton de chatbot.
`.trim();

function buildSystemPrompt(persona, personaName) {
  if (!persona) return GLOBAL_SYSTEM_PROMPT;

  return `
${GLOBAL_SYSTEM_PROMPT}

PRÉNOM À UTILISER :
${personaName || "Inconnu"}

PERSONNALITÉ À INCARNER :
${persona}
  `.trim();
}

function sanitizeAssistantText(text) {
  if (!text) return "";

  text = text.replace(/^\s*###.*$/gmi, "");
  text = text.replace(/^\s*(Instruction|Response|System|Assistant)\s*:.*$/gmi, "");
  text = text.replace(/^\s*[-*•]\s+/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

module.exports = {
  GLOBAL_SYSTEM_PROMPT,
  buildSystemPrompt,
  sanitizeAssistantText,
};
