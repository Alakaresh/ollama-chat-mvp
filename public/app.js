const modelSelect = document.getElementById("modelSelect");
const personaSelect = document.getElementById("personaSelect");
const chatBox = document.getElementById("chatBox");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const logRequestEl = document.getElementById("log-request");
const logResponseEl = document.getElementById("log-response");
const appModeToggle = document.getElementById("appModeToggle");
const appModeLabel = document.getElementById("appModeLabel");
const personaGrid = document.getElementById("personaGrid");
const chatList = document.getElementById("chatList");
const personaSearch = document.getElementById("personaSearch");
const nsfwToggle = document.getElementById("nsfwToggle");
const appShell = document.querySelector(".app-shell");
const chatPersonaName = document.getElementById("chatPersonaName");
const backToChatsBtn = document.getElementById("backToChats");
const navButtons = document.querySelectorAll("[data-nav-target]");
const screens = document.querySelectorAll("[data-screen]");

let chatHistory = [];
let activePersonaId = null;
let currentAppMode = "prod";
let serverAppMode = "prod";
const appModeStorageKey = "appModeOverride";
const nsfwStorageKey = "showNsfw";
const chatSessions = new Map();

function setActiveScreen(screen) {
  screens.forEach((el) => {
    el.classList.toggle("is-active", el.dataset.screen === screen);
  });
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.navTarget === screen);
  });
  if (appShell) {
    appShell.classList.toggle("is-hidden", screen === "chat");
  }
}

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
  setActiveScreen(normalizedMode === "prod" ? "home" : "chat");
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();
    serverAppMode = data.appMode?.toLowerCase() === "dev" ? "dev" : "prod";
    const isCloudflare = Boolean(data.isCloudflare);
    if (isCloudflare) {
      document.body.dataset.cloudflare = "true";
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
    nsfw: true,
    tags: ["Timide", "Bibliothèque", "Flirt"],
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

// LIMITES
- Interaction respectueuse, consentement explicite et continu
- Ne jamais imposer, toujours proposer et attendre un signe clair
`
  }
];

function getSession(persona) {
  if (!chatSessions.has(persona.id)) {
    chatSessions.set(persona.id, {
      history: [{ role: "assistant", content: persona.introduction }],
      lastMessage: persona.introduction,
    });
  }
  return chatSessions.get(persona.id);
}

function renderChatHistory(history) {
  chatBox.innerHTML = "";
  history.forEach((message) => {
    append(message.role, message.content);
  });
}

function updateChatHeader(persona) {
  if (chatPersonaName) {
    chatPersonaName.textContent = persona ? persona.name : "";
  }
}

function renderPersonaGrid(filter = "") {
  if (!personaGrid) return;
  const term = filter.trim().toLowerCase();
  const showNsfw = nsfwToggle ? nsfwToggle.checked : false;
  personaGrid.innerHTML = "";
  const filtered = personas.filter((persona) => {
    if (!showNsfw && persona.nsfw) return false;
    return persona.name.toLowerCase().includes(term);
  });

  filtered.forEach((persona) => {
    const card = document.createElement("div");
    card.className = "persona-card";
    card.addEventListener("click", () => {
      setActivePersona(persona.id);
      setActiveScreen("chat");
    });

    const cover = document.createElement("div");
    cover.className = "persona-cover";
    cover.textContent = persona.name;
    card.appendChild(cover);

    const tags = document.createElement("div");
    tags.className = "persona-tags";
    (persona.tags || []).slice(0, 3).forEach((tag) => {
      const tagEl = document.createElement("span");
      tagEl.className = "persona-tag";
      tagEl.textContent = `#${tag}`;
      tags.appendChild(tagEl);
    });
    card.appendChild(tags);

    const content = document.createElement("div");
    content.className = "persona-content";

    const title = document.createElement("p");
    title.className = "persona-title";
    title.textContent = persona.name;

    const subtitle = document.createElement("span");
    subtitle.className = "persona-subtitle";
    subtitle.textContent = persona.label;

    content.appendChild(title);
    content.appendChild(subtitle);
    card.appendChild(content);

    personaGrid.appendChild(card);
  });
}

function updateChatList() {
  if (!chatList) return;
  chatList.innerHTML = "";
  const activeChats = personas.filter((persona) => {
    const session = chatSessions.get(persona.id);
    return session && session.history.length > 1;
  });

  if (activeChats.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "persona-subtitle";
    emptyState.textContent = "Aucun chat en cours pour le moment.";
    chatList.appendChild(emptyState);
    return;
  }

  activeChats.forEach((persona) => {
    const session = chatSessions.get(persona.id);
    const item = document.createElement("div");
    item.className = "chat-item";
    item.addEventListener("click", () => {
      setActivePersona(persona.id);
      setActiveScreen("chat");
    });

    const avatar = document.createElement("div");
    avatar.className = "chat-avatar";
    avatar.textContent = persona.name.slice(0, 1);

    const preview = document.createElement("div");
    preview.className = "chat-preview";

    const title = document.createElement("strong");
    title.textContent = persona.name;

    const snippet = document.createElement("span");
    snippet.textContent = session?.lastMessage || "Nouveau chat";

    preview.appendChild(title);
    preview.appendChild(snippet);

    item.appendChild(avatar);
    item.appendChild(preview);
    chatList.appendChild(item);
  });
}

function setActivePersona(personaId) {
  if (!personaId) return;
  activePersonaId = personaId;
  if (personaSelect) {
    personaSelect.value = personaId;
    personaSelect.dispatchEvent(new Event("change"));
  }
}


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
  renderPersonaGrid();
  updateChatList();
}

personaSelect.addEventListener("change", () => {
  const selectedId = personaSelect.value;
  const selectedPersona = personas.find((p) => p.id === selectedId);

  if (!selectedPersona) return;

  const session = getSession(selectedPersona);
  chatHistory = session.history;
  renderChatHistory(chatHistory);
  updateChatHeader(selectedPersona);
  updateChatList();
});

async function sendMessage() {
  const userMessage = msgInput.value.trim();
  if (!userMessage) return;

  const model = modelSelect.value;
  const selectedId = personaSelect.value;
  const selectedPersona = personas.find((p) => p.id === selectedId);

  if (!selectedPersona) return;
  const session = getSession(selectedPersona);

  append("user", userMessage);
  chatHistory.push({ role: "user", content: userMessage });
  session.lastMessage = userMessage;

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
        personaNsfw: Boolean(selectedPersona.nsfw),
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
    session.lastMessage = fullAssistantResponse;
    updateChatList();
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

if (personaSearch) {
  personaSearch.addEventListener("input", (event) => {
    renderPersonaGrid(event.target.value);
  });
}

if (nsfwToggle) {
  const storedPreference = localStorage.getItem(nsfwStorageKey);
  nsfwToggle.checked = storedPreference === "true";
  nsfwToggle.addEventListener("change", (event) => {
    localStorage.setItem(nsfwStorageKey, String(event.target.checked));
    renderPersonaGrid(personaSearch?.value || "");
  });
}

if (backToChatsBtn) {
  backToChatsBtn.addEventListener("click", () => {
    setActiveScreen("chats");
  });
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.navTarget;
    if (target) {
      setActiveScreen(target);
      if (target === "chats") {
        updateChatList();
      }
    }
  });
});

async function init() {
  await loadConfig();
  loadModels();
  loadPersonas();
  if (!activePersonaId && personas[0]) {
    setActivePersona(personas[0].id);
  }
}

init();
