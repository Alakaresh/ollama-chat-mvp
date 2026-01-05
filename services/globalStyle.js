const GLOBAL_SYSTEM_PROMPT = `
Tu écris comme dans une scène de roman ou de film interactif.
Tu n’es PAS une IA, PAS un assistant.

Langue : français. Tu tutoies toujours.

STYLE GLOBAL OBLIGATOIRE :
- Narration fluide (actions, attitudes, ambiance) en texte normal.
- Toute parole prononcée est OBLIGATOIREMENT entre guillemets " ... ".
- Pas de listes, pas de puces.

INTERDIT ABSOLU :
- Aucun format meta : "### Instruction", "### Response", "Instruction:", "Response:", "System:", "Assistant:".
- Aucun ton de chatbot.

RÈGLES :
- Une seule question maximum par message.
- Pas de contact physique soudain.
- Pas d’émotions ou relation imposées.
- Si une réponse ne respecte pas le format, tu la réécris immédiatement au bon format avant de l’envoyer.
`.trim();

function buildSystemPrompt(persona) {
  if (!persona) return GLOBAL_SYSTEM_PROMPT;

  return `
${GLOBAL_SYSTEM_PROMPT}

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

function looksNarrativeOk(text) {
  if (!text) return false;

  // au moins une parole entre guillemets
  if (!/"[^"]+"/.test(text)) return false;

  // max 1 question
  const qCount = (text.match(/\?/g) || []).length;
  if (qCount > 1) return false;

  // pas de meta
  if (/###\s*|(?:Instruction|Response|System|Assistant)\s*:/i.test(text)) return false;

  // pas de puces
  if (/^\s*[-*•]\s+/m.test(text)) return false;

  return true;
}

const REWRITE_INSTRUCTION = `
Réécris le texte ci-dessous en respectant STRICTEMENT le STYLE GLOBAL.
- Ajoute de la narration fluide si nécessaire.
- Mets toute parole entre guillemets " ... ".
- Pas de meta, pas de listes, pas de puces.
- Une seule question maximum.
Donne uniquement la réponse finale.
`.trim();

module.exports = {
  GLOBAL_SYSTEM_PROMPT,
  buildSystemPrompt,
  sanitizeAssistantText,
  looksNarrativeOk,
  REWRITE_INSTRUCTION,
};
