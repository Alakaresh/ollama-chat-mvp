const GLOBAL_SYSTEM_PROMPT = `
Tu écris comme une scène de film interactive, mais tu restes dans une conversation naturelle.

Langue : français. Tutoiement obligatoire dans les dialogues.

FORMAT OBLIGATOIRE :
- Réponse en 2 à 4 paragraphes courts maximum.
- Paragraphes séparés par une ligne vide.

- Narration en texte normal.
- Toute parole prononcée est obligatoirement entre guillemets doubles " ... ".
- Pas de listes, pas de puces.

RÈGLE FONDAMENTALE DE NARRATION :
- Tu décris uniquement des actions locales, progressives et immédiates.
- Tu n’emploies jamais d’ellipses globales ou conclusives.
- Tu ne résumes jamais une scène.
- Chaque action décrite doit être physiquement localisable et limitée dans le temps.

POINT DE VUE STRICT — RÈGLE ABSOLUE :
- Tu écris TOUJOURS à la troisième personne.
- Tu incarnes UNIQUEMENT le personnage défini.
- Tu peux utiliser son prénom ou "elle / il" dans la narration.

- Tu ne décris JAMAIS :
  - les pensées de l’utilisateur
  - les intentions de l’utilisateur
  - les émotions de l’utilisateur
  - les actions de l’utilisateur (sauf celles déjà écrites par lui entre guillemets)

- Tu ne fais JAMAIS parler l’utilisateur.
- Tu ne complètes JAMAIS ses actions.
- Tu ne supposes JAMAIS ce qu’il ressent.

INTERDIT ABSOLU :
- Aucun ton de chatbot.
- Aucun "nous", "on", "ensemble".
- Toute phrase qui donne une impression de fin, de pause ou de conclusion.

EXCEPTION TECHNIQUE :
- Après la narration, tu DOIS produire un bloc <META> sur une nouvelle ligne.
- Le bloc <META> contient UNIQUEMENT du JSON strictement valide.
- Le JSON décrit uniquement les changements d’état du personnage.
- Il ne contient aucune narration, aucune phrase, aucune émotion.
- Si rien ne change, le bloc <META> contient {}.
- Le contenu de <META> n’est jamais destiné à l’utilisateur.
`.trim();

function buildSystemPrompt(persona, personaNsfw = false) {
  const sections = [GLOBAL_SYSTEM_PROMPT];

  // Persona (optionnel) : si tu veux l'injecter ici, garde-le court et lisible.
  // Si tu n'en as pas l'usage, supprime ce bloc.
  if (persona && String(persona).trim().length > 0) {
    sections.push(
      `
[PERSONA]
${String(persona).trim()}
[/PERSONA]
`.trim()
    );
  }

  if (personaNsfw) {
    sections.push(
      `
SECTION NSFW :
- Le ton peut être explicite, sensuel ou sexuel uniquement si l’utilisateur initie clairement ce registre.
- Aucune escalade automatique.
- Respect strict du cadre narratif et du personnage incarné.
`.trim()
    );
  }

  return sections.join("\n\n");
}

/**
 * Extrait la narration et le JSON META.
 * - narration: texte sans le bloc <META>...</META>
 * - meta: objet JSON parsé, ou {} si absent
 * - metaError: string si JSON invalide (optionnel)
 */
function extractMeta(text) {
  const raw = (text ?? "").toString();
  const match = raw.match(/<META>\s*([\s\S]*?)\s*<\/META>/i);

  if (!match) {
    return { narration: raw.trim(), meta: {}, metaError: null };
  }

  const metaRaw = match[1];
  let meta = {};
  let metaError = null;

  try {
    meta = JSON.parse(metaRaw);
    // META doit être un objet (pas une string, pas un array)
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      metaError = "META n'est pas un objet JSON.";
      meta = {};
    }
  } catch (e) {
    metaError = "JSON META invalide.";
    meta = {};
  }

  const narration = raw.replace(match[0], "").trim();
  return { narration, meta, metaError };
}

/**
 * Nettoie uniquement la narration (ne JAMAIS passer le texte complet incluant META).
 */
function sanitizeNarration(text) {
  if (!text) return "";

  let t = String(text);

  // Supprime les en-têtes méta style "###"
  t = t.replace(/^\s*###.*$/gmi, "");

  // Supprime les lignes "Instruction:", "System:", etc.
  t = t.replace(/^\s*(Instruction|Response|System|Assistant)\s*:.*$/gmi, "");

  // Supprime les puces en début de ligne (si le modèle en met malgré tout)
  t = t.replace(/^\s*[-*•]\s+/gm, "");

  // Normalise les sauts de ligne
  t = t.replace(/\n{3,}/g, "\n\n").trim();

  return t;
}

/**
 * Validation minimale du META pour éviter de casser ton état canonique.
 * Autorise uniquement: outfit_patch (object) et events (array) si présent.
 */
function validateMeta(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;

  const allowedKeys = new Set(["outfit_patch", "events"]);
  for (const k of Object.keys(meta)) {
    if (!allowedKeys.has(k)) return false;
  }

  if (meta.outfit_patch !== undefined) {
    if (!meta.outfit_patch || typeof meta.outfit_patch !== "object" || Array.isArray(meta.outfit_patch)) {
      return false;
    }
  }

  if (meta.events !== undefined) {
    if (!Array.isArray(meta.events)) return false;
  }

  return true;
}

/**
 * Merge récursif simple (patch -> target). Supporte null pour supprimer une clé.
 * Retourne un nouvel objet (ne mute pas l'original).
 */
function deepMerge(target, patch) {
  const out = Array.isArray(target) ? [...target] : { ...(target || {}) };

  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return out;
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      // suppression
      delete out[key];
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = deepMerge(out[key], value);
      continue;
    }

    out[key] = value;
  }

  return out;
}

/**
 * Applique un outfit_patch à un outfit courant (merge patch).
 */
function applyOutfitPatch(currentOutfit, outfitPatch) {
  return deepMerge(currentOutfit || {}, outfitPatch || {});
}

/**
 * Pipeline utilitaire : à partir d'une réponse brute LLM,
 * - extrait meta
 * - sanitize narration
 * - valide meta
 * Retourne narration affichable + meta exploitable.
 */
function processAssistantOutput(rawText) {
  const { narration, meta, metaError } = extractMeta(rawText);
  const cleanNarration = sanitizeNarration(narration);

  const ok = metaError ? false : validateMeta(meta);
  return {
    narration: cleanNarration,
    meta: ok ? meta : {},
    metaError: metaError || (ok ? null : "META invalide (validation)."),
  };
}

module.exports = {
  GLOBAL_SYSTEM_PROMPT,
  buildSystemPrompt,

  extractMeta,
  sanitizeNarration,
  validateMeta,
  deepMerge,
  applyOutfitPatch,
  processAssistantOutput,
};
