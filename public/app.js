const modelSelect = document.getElementById("modelSelect");
const personaSelect = document.getElementById("personaSelect");
const chatBox = document.getElementById("chatBox");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const logRequestEl = document.getElementById("log-request");
const logResponseEl = document.getElementById("log-response");
const appModeToggle = document.getElementById("appModeToggle");
const appModeLabel = document.getElementById("appModeLabel");

let chatHistory = [];
let currentAppMode = "prod";
let serverAppMode = "prod";
const appModeStorageKey = "appModeOverride";

function setAppMode(mode) {
  const normalizedMode = mode?.toLowerCase() === "dev" ? "dev" : "prod";
  currentAppMode = normalizedMode;
  document.body.dataset.appMode = normalizedMode;
  if (appModeToggle) {
    appModeToggle.checked = normalizedMode === "prod";
  }
  if (appModeLabel) {
    appModeLabel.textContent = normalizedMode;
  }
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();
    serverAppMode = data.appMode?.toLowerCase() === "dev" ? "dev" : "prod";
    const isCloudflare = Boolean(data.isCloudflare);
    if (isCloudflare) {
      setAppMode("prod");
      if (appModeToggle) {
        appModeToggle.disabled = true;
        appModeToggle.closest(".mode-row")?.setAttribute("hidden", "hidden");
      }
      if (appModeLabel) {
        appModeLabel.setAttribute("hidden", "hidden");
      }
      return;
    }
    if (serverAppMode === "prod") {
      setAppMode("prod");
      if (appModeToggle) {
        appModeToggle.disabled = true;
      }
      return;
    }
    const override = localStorage.getItem(appModeStorageKey);
    setAppMode(override || serverAppMode);
  } catch (error) {
    console.warn("Impossible de charger la config:", error);
    setAppMode("prod");
  }
}

const personas = [
  {
    id: "mei",
    name: "Mei",
    label: "Mei — camarade de classe (bibliothèque)",
    introduction: `La bibliothèque est presque silencieuse, seulement ponctuée par le froissement des pages et le bruit lointain d’une chaise qu’on déplace. Mei est installée derrière le comptoir depuis un moment, concentrée sur le rangement des livres, quand elle remarque que tu viens t’asseoir à une table non loin d’elle.

Elle relève discrètement les yeux vers toi, hésite une seconde, puis s’approche avec un petit carnet à la main, visiblement un peu nerveuse. "Euh… si tu as besoin d’aide pour trouver quelque chose, dis-le moi."`,
    prompt: `
// IDENTITÉ
- Prénom : Mei
- Âge : 18 ans
- Rôle : camarade de classe de l’utilisateur
- Travail : aide à la bibliothèque
- Cadre : études, bibliothèque, moments calmes

// PERSONNALITÉ
- Timide mais sensuelle, joueuse quand l’ambiance s’y prête
- Parle doucement, phrases simples, souffle proche
- Peut hésiter avant de parler, puis se laisse aller
- Sourit facilement, regard insistant, approche prudente
- Capable de flirter et de guider vers des échanges érotiques explicites

// STYLE
- Narration à la troisième personne
- Actions locales et immédiates, détails sensoriels (souffle, peau, frissons)
- Réponses courtes à moyennes
- Langage NSFW accepté : descriptions charnelles explicites, désir, tension sexuelle

// LIMITES
- Interaction respectueuse, consentement explicite et continu
- Ne jamais imposer, toujours proposer et attendre un signe clair
`
  }
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

    const preferred = models.find((m) => m.includes("mythomax")) || models[0];
    if (preferred) modelSelect.value = preferred;
    if (currentAppMode === "prod") {
      modelSelect.value = preferred || modelSelect.value;
      modelSelect.disabled = true;
    } else {
      modelSelect.disabled = false;
    }
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

  // Logs
  logRequestEl.textContent = "Génération en cours...";
  logResponseEl.textContent = "";

  sendBtn.disabled = true;
  let fullAssistantResponse = "";
  let rawResponse = "";

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

        if (event.type === "params") {
          logRequestEl.textContent = JSON.stringify(event.params, null, 2);
        } else if (event.type === "delta") {
          fullAssistantResponse += event.delta || "";
          rawResponse += event.delta || "";
          logResponseEl.textContent = rawResponse;
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
if (appModeToggle) {
  appModeToggle.addEventListener("change", (event) => {
    const nextMode = event.target.checked ? "prod" : "dev";
    if (serverAppMode === "prod") {
      setAppMode("prod");
      appModeToggle.checked = true;
      return;
    }
    if (nextMode === "dev") {
      localStorage.removeItem(appModeStorageKey);
    } else {
      localStorage.setItem(appModeStorageKey, nextMode);
    }
    setAppMode(nextMode);
    loadModels();
  });
}

async function init() {
  await loadConfig();
  loadModels();
  loadPersonas();
}

init();
