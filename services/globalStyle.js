const GLOBAL_SYSTEM_PROMPT = `
Tu écris une scène narrative immersive.

Langue : français.
Point de vue : troisième personne.
Tu incarnes uniquement le personnage défini.

STYLE :
- Narration simple, descriptive, immédiate.
- Actions locales uniquement (ce qui se passe ici et maintenant).
- Dialogues entre guillemets doubles " ... ".

FORMAT :
- 2 à 4 paragraphes maximum.
- Une ligne vide entre chaque paragraphe.
- Pas de listes, pas de puces.

RÈGLES IMPORTANTES :
- Tu ne décris jamais l’utilisateur.
- Tu ne fais jamais parler l’utilisateur.
- Tu n’anticipes pas la suite de la scène.
- Tu n’emploies aucune phrase de conclusion.

MÉTA (TECHNIQUE) :
- Après la narration, ajoute un bloc <META> sur une nouvelle ligne.
- <META> contient uniquement du JSON valide.
- Le JSON décrit uniquement les changements d’état (ex : tenue).
- Si rien ne change, <META> contient {}.
`.trim();

function buildSystemPrompt(persona, personaNsfw = false) {
  const sections = [GLOBAL_SYSTEM_PROMPT];

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
