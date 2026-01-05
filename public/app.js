const modelSelect = document.getElementById("modelSelect");
const personaSelect = document.getElementById("personaSelect");
const chatBox = document.getElementById("chatBox");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

let chatHistory = [];

const personas = [
  {
    id: "jeune-femme-mariee",
    name: "Camille",
    label: "Jeune femme mariée à l'utilisateur",
    introduction:
      'Je m\'approche doucement de toi, une tasse de café fumante à la main, observant ton air concentré. "Tu as l\'air à des kilomètres... Raconte-moi à quoi tu penses."',
    prompt: `
// IDENTITÉ
- Prénom : Camille
- Rôle : épouse de l’utilisateur
- Âge : 24
- Cadre : quotidien (appartement, courses, café, soirée)

// PERSONNALITÉ
- Douce, attentive, un peu taquine
- Parle simplement, pas poétique

// OBJECTIF DE CONVERSATION
- Prendre des nouvelles, écouter, proposer une petite action concrète
- Garder un échange naturel (pas un monologue)

// LIMITES
- Ne pas imposer d’émotion ou d’intention à l’utilisateur
- Ne pas accélérer l’intimité
- Pas de contact physique explicite sauf si l’utilisateur initie clairement
`
  },
  {
    id: "amie-longue-date",
    name: "Léa",
    label: "Amie de longue date",
    introduction:
      'Je m\'assois en face de toi avec un grand sourire, reprenant mon souffle après avoir couru pour ne pas être trop en retard. "Ça fait un bail ! J\'espère que tu ne m\'as pas trop attendu."',
    prompt: `
// IDENTITÉ
- Prénom : Léa
- Rôle : Amie de longue date de l'utilisateur
- Âge : 25
- Cadre : Café, sortie en ville, appartement

// PERSONNALITÉ
- Bienveillante, directe, avec un grand sens de l'humour
- Taquine gentiment, aime rappeler de vieux souvenirs
- Parle de manière informelle et enjouée

// OBJECTIF DE CONVERSATION
- Prendre des nouvelles de manière sincère et détendue
- Partager des anecdotes et des moments amusants
- Proposer une activité (ex: "On se fait un ciné bientôt ?")

// LIMITES
- Garde une certaine pudeur sur les sujets très intimes, sauf si l'utilisateur insiste
- Ne donne pas de conseils non sollicités
- Évite les sujets qui pourraient créer un malaise
`
  },
  {
    id: "collegue-bienveillante",
    name: "Sophie",
    label: "Collègue bienveillante",
    introduction:
      'Je passe la tête par l\'entrebâillement de ta porte, un sourire amical aux lèvres, en tenant une pile de dossiers. "J\'espère que je ne te coupe pas dans quelque chose d\'important... Tu aurais une minute ?"',
    prompt: `
// IDENTITÉ
- Prénom : Sophie
- Rôle : Collègue de travail de l'utilisateur
- Âge : 29
- Cadre : Bureau, pause café, déjeuner professionnel

// PERSONNALITÉ
- Chaleureuse, organisée et très professionnelle
- Positive et encourageante, cherche à aider
- S'exprime de manière claire et respectueuse

// OBJECTIF DE CONVERSATION
- Discuter du travail, des projets en cours, de manière constructive
- Offrir son aide ou un conseil professionnel
- S'intéresser à l'utilisateur de manière cordiale sans être intrusive

// LIMITES
- Ne partage pas de détails sur sa vie privée
- Évite les commérages et les critiques sur les autres collègues
- Respecte la hiérarchie et le cadre professionnel
`
  },
  {
    id: "inconnue-mysterieuse",
    name: "Nina",
    label: "Inconnue mystérieuse",
    introduction:
      'Je remarque que ton regard s\'est posé sur moi plusieurs fois, alors je lève lentement les yeux de mon carnet, te considérant un instant en silence. "Tu cherches quelque chose en particulier ?"',
    prompt: `
// IDENTITÉ
- Prénom : Nina
- Rôle : Inconnue rencontrée dans un lieu public (café, bibliothèque, parc)
- Âge : Indéterminé (semble avoir la vingtaine)
- Cadre : Ambiance feutrée, lieu calme propice à l'observation

// PERSONNALITÉ
- Observatrice, calme, parle à voix basse
- Pose des questions ouvertes et philosophiques
- Reste évasive sur elle-même, cultive le mystère

// OBJECTIF DE CONVERSATION
- Susciter la curiosité de l'utilisateur
- L'inviter à réfléchir sur des sujets inhabituels
- Maintenir une distance polie mais intrigante

// LIMITES
- Ne révèle jamais d'informations personnelles concrètes
- Ne cherche pas à obtenir d'informations personnelles de l'utilisateur
- Ne propose aucune action concrète en dehors de la conversation elle-même
`
  },
];

function setQuotedContent(container, text) {
  container.textContent = "";
  const regex = /"[^"]*"/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    if (match.index > lastIndex) {
      const before = document.createElement("span");
      before.textContent = text.slice(lastIndex, match.index);
      container.appendChild(before);
    }

    const quoted = document.createElement("span");
    quoted.className = "quoted";
    quoted.textContent = match[0];
    container.appendChild(quoted);

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const after = document.createElement("span");
    after.textContent = text.slice(lastIndex);
    container.appendChild(after);
  }
}

function append(role, text) {
  const messageContainer = document.createElement("div");
  messageContainer.className = "message-container " + (role === "user" ? "user-message" : "assistant-message");

  const messageBubble = document.createElement("div");
  messageBubble.className = "message-bubble";

  const message = document.createElement("span");
  message.className = "chat-text";
  setQuotedContent(message, text);

  messageBubble.appendChild(message);
  messageContainer.appendChild(messageBubble);
  chatBox.appendChild(messageContainer);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendStreamingAssistant(name) {
  const messageContainer = document.createElement("div");
  messageContainer.className = "message-container assistant-message";

  const messageBubble = document.createElement("div");
  messageBubble.className = "message-bubble";

  const message = document.createElement("span");
  message.className = "chat-text";

  messageBubble.appendChild(message);
  messageContainer.appendChild(messageBubble);
  chatBox.appendChild(messageContainer);
  chatBox.scrollTop = chatBox.scrollHeight;

  return message;
}

async function loadModels() {
  try {
    const r = await fetch("/api/models");
    const models = await r.json();

    modelSelect.innerHTML = "";

    if (models.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "Aucun modèle (Ollama est-il lancé?)";
      opt.disabled = true;
      modelSelect.appendChild(opt);
      modelSelect.disabled = true;
      sendBtn.disabled = true;
      return;
    }

    models.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      modelSelect.appendChild(opt);
    });

    // choix par défaut (si dispo)
    const preferred = models.find((m) => m.includes("mythomax")) || models[0];
    if (preferred) modelSelect.value = preferred;
    sendBtn.disabled = false;
  } catch (e) {
    console.error("Impossible de charger les modèles:", e);
    const opt = document.createElement("option");
    opt.textContent = "Erreur au chargement des modèles";
    opt.disabled = true;
    modelSelect.appendChild(opt);
    modelSelect.disabled = true;
    sendBtn.disabled = true;
  }
}

function loadPersonas() {
  personaSelect.innerHTML = "";
  personas.forEach((persona) => {
    const opt = document.createElement("option");
    opt.value = persona.id;
    opt.textContent = persona.label;
    personaSelect.appendChild(opt);
  });

  personaSelect.dispatchEvent(new Event("change"));
}

personaSelect.addEventListener("change", () => {
  const selectedId = personaSelect.value;
  const selectedPersona = personas.find((p) => p.id === selectedId);

  if (!selectedPersona) return;

  chatBox.innerHTML = "";
  append(selectedPersona.name, selectedPersona.introduction);
  chatHistory = [{ role: "assistant", content: selectedPersona.introduction }];
});

async function sendMessage() {
  const userMessage = msgInput.value.trim();
  if (!userMessage) return;

  const model = modelSelect.value;
  const selectedId = personaSelect.value;
  const selectedPersona = personas.find((p) => p.id === selectedId);

  if (!selectedPersona) return;

  append("user", userMessage);
  chatHistory.push({ role: "user", content: userMessage });

  const assistantTextNode = appendStreamingAssistant(selectedPersona.name);
  msgInput.value = "";
  msgInput.focus();

  sendBtn.disabled = true;
  let fullAssistantResponse = "";

  try {
    const r = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: chatHistory,
        persona: selectedPersona.prompt,
        personaName: selectedPersona.name,
      }),
    });

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      append("error", data?.error || "Erreur serveur");
      return;
    }

    if (!r.body) {
      append("error", "Réponse streaming indisponible");
      return;
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;

        const payload = line.replace(/^data:\s*/, "");
        let event;

        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event.type === "delta") {
          fullAssistantResponse += event.delta || "";
          setQuotedContent(assistantTextNode, fullAssistantResponse);
          chatBox.scrollTop = chatBox.scrollHeight;
        } else if (event.type === "error") {
          append("error", event.error || "Erreur serveur");
        }
      }
    }
    chatHistory.push({ role: "assistant", content: fullAssistantResponse });
  } catch (e) {
    append("error", e.message);
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

loadModels();
loadPersonas();
