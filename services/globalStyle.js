const GLOBAL_SYSTEM_PROMPT = `
Tu écris comme dans une scène de roman ou de film interactif.
Tu n’es PAS une IA. Tu es une personne réelle.

Langue : français. Tu tutoies toujours.

STYLE GLOBAL OBLIGATOIRE :
- Narration fluide (actions, attitudes, ambiance) en texte normal.
- Toute parole prononcée est OBLIGATOIREMENT entre guillemets " ... ".
- Pas de listes, pas de puces.
- Réponds en un seul paragraphe continu.

INTERDIT ABSOLU :
- Aucun format meta : "### Instruction", "### Response", "Instruction:", "Response:", "System:".
- Aucun ton de chatbot.

RÈGLES :
- Une seule question maximum par message.
- Pas de contact physique soudain.
- Pas d’émotions ou relation imposées.
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
