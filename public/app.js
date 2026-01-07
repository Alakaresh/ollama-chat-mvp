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
const bottomNav = document.querySelector(".bottom-nav");
const chatPersonaName = document.getElementById("chatPersonaName");
const backToChatsBtn = document.getElementById("backToChats");
const navButtons = document.querySelectorAll("[data-nav-target]");
const screens = document.querySelectorAll("[data-screen]");
const resetModal = document.getElementById("resetModal");
const confirmResetBtn = document.getElementById("confirmResetBtn");
const cancelResetBtn = document.getElementById("cancelResetBtn");


let chatHistory = [];
let activePersonaId = null;
let personaIdToReset = null;
let currentAppMode = "prod";
let serverAppMode = "prod";
const appModeStorageKey = "appModeOverride";
const nsfwStorageKey = "showNsfw";
const chatSessions = new Map();
let hasInitializedHistory = false;
let allowAppExit = false;
let exitAttemptTimer = null;

let personas = [];

function setActiveScreen(screen, { skipHistory = false, replaceHistory = false } = {}) {
  screens.forEach((el) => {
    el.classList.toggle("is-active", el.dataset.screen === screen);
  });
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.navTarget === screen);
  });
  if (appShell) {
    appShell.classList.toggle("is-hidden", screen === "chat");
  }
  if (bottomNav) {
    bottomNav.classList.toggle("is-hidden", screen === "chat");
  }
  if (screen === "chats") {
    updateChatList();
  }
  if (skipHistory) {
    return;
  }
  if (!hasInitializedHistory) {
    history.replaceState({ screen }, "", window.location.pathname);
    history.pushState({ screen }, "", window.location.pathname);
    hasInitializedHistory = true;
    return;
  }
  if (history.state?.screen === screen) {
    return;
  }
  if (replaceHistory) {
    history.replaceState({ screen }, "", window.location.pathname);
  } else {
    history.pushState({ screen }, "", window.location.pathname);
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

    const menuBtn = document.createElement("button");
    menuBtn.className = "persona-menu-btn";
    menuBtn.innerHTML = "&#8942;"; // Vertical ellipsis
    menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        personaIdToReset = persona.id;
        resetModal.classList.add("is-visible");
    });
    card.appendChild(menuBtn);

    const clickableWrapper = document.createElement("div");
    clickableWrapper.className = "persona-card-clickable";
    clickableWrapper.addEventListener("click", () => {
      setActivePersona(persona.id);
      setActiveScreen("chat");
    });

    const cover = document.createElement("div");
    cover.className = "persona-cover";
    cover.textContent = persona.name;
    clickableWrapper.appendChild(cover);

    const tags = document.createElement("div");
    tags.className = "persona-tags";
    (persona.tags || []).slice(0, 3).forEach((tag) => {
      const tagEl = document.createElement("span");
      tagEl.className = "persona-tag";
      tagEl.textContent = `#${tag}`;
      tags.appendChild(tagEl);
    });
    clickableWrapper.appendChild(tags);

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
    clickableWrapper.appendChild(content);

    card.appendChild(clickableWrapper);
    personaGrid.appendChild(card);
  });
}

function updateChatList() {
  // This function needs a proper implementation that fetches last messages for all personas.
  // For now, it's disabled to prevent errors. A full implementation would require a new API endpoint.
  if (!chatList) return;
  chatList.innerHTML = "";
   const emptyState = document.createElement("div");
  emptyState.className = "persona-subtitle";
  emptyState.textContent = "La liste des chats récents sera bientôt disponible.";
  chatList.appendChild(emptyState);
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

function appendStreamingAssistantWithIndicator() {
  const messageContainer = document.createElement("div");
  messageContainer.className = "message-container assistant-message";

  const messageBubble = document.createElement("div");
  messageBubble.className = "message-bubble";

  const typingIndicator = document.createElement("div");
  typingIndicator.className = "typing-indicator";

  for (let i = 0; i < 3; i += 1) {
    const dot = document.createElement("span");
    dot.className = "typing-dot";
    typingIndicator.appendChild(dot);
  }

  const message = document.createElement("span");
  message.className = "chat-text";

  messageBubble.appendChild(typingIndicator);
  messageBubble.appendChild(message);
  messageContainer.appendChild(messageBubble);
  chatBox.appendChild(messageContainer);
  chatBox.scrollTop = chatBox.scrollHeight;

  return { message, typingIndicator, messageContainer };
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

async function loadPersonas() {
  try {
    const response = await fetch("/api/personas");
    if (!response.ok) {
      throw new Error("Failed to fetch personas");
    }
    const data = await response.json();
    personas = data; // Update the global personas array

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
  } catch (error) {
    console.error("Failed to load personas:", error);
    // Handle error in UI
  }
}


personaSelect.addEventListener("change", async () => {
  const selectedId = personaSelect.value;
  const selectedPersona = personas.find((p) => p.id === selectedId);

  if (!selectedPersona) return;

  try {
    const response = await fetch(`/api/personas/${selectedId}/conversation`);
    if (!response.ok) {
      throw new Error("Failed to fetch conversation history");
    }
    const conversation = await response.json();
    chatHistory = conversation;
    renderChatHistory(chatHistory);
    updateChatHeader(selectedPersona);
    // updateChatList(); // This might need adjustment as it relies on chatSessions
  } catch (error) {
    console.error("Failed to load conversation:", error);
  }
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

  const { message: assistantTextNode, typingIndicator, messageContainer } = appendStreamingAssistantWithIndicator();
  let activeTypingIndicator = typingIndicator;
  msgInput.value = "";
  msgInput.focus();

  // Logs
  logRequestEl.textContent = "Génération en cours...";
  logResponseEl.textContent = "";

  sendBtn.disabled = true;
  let fullAssistantResponse = "";
  let rawResponse = "";

  const clearTypingIndicator = () => {
    if (!activeTypingIndicator) return;
    activeTypingIndicator.remove();
    activeTypingIndicator = null;
  };

  const cleanupEmptyAssistantMessage = () => {
    if (fullAssistantResponse) return;
    messageContainer.remove();
  };

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
      clearTypingIndicator();
      cleanupEmptyAssistantMessage();
      append("error", data?.error || "Erreur serveur");
      return;
    }

    if (!r.body) {
      clearTypingIndicator();
      cleanupEmptyAssistantMessage();
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
          clearTypingIndicator();
          fullAssistantResponse += event.delta || "";
          rawResponse += event.delta || "";
          logResponseEl.textContent = rawResponse;
          setQuotedContent(assistantTextNode, fullAssistantResponse);
          chatBox.scrollTop = chatBox.scrollHeight;
        } else if (event.type === "error") {
          clearTypingIndicator();
          cleanupEmptyAssistantMessage();
          append("error", event.error || "Erreur serveur");
        }
      }
    }
    clearTypingIndicator();
    chatHistory.push({ role: "assistant", content: fullAssistantResponse });

    // Save user and assistant messages to DB
    try {
      await fetch(`/api/personas/${selectedId}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: userMessage })
      });
      await fetch(`/api/personas/${selectedId}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'assistant', content: fullAssistantResponse })
      });
    } catch (dbError) {
      console.error("Failed to save conversation:", dbError);
      append("error", "Failed to save message.");
    }

    // updateChatList(); // Needs rework
  } catch (e) {
    clearTypingIndicator();
    cleanupEmptyAssistantMessage();
    append("error", e.message);
  } finally {
    clearTypingIndicator();
    cleanupEmptyAssistantMessage();
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
    if (history.length > 1) {
      history.back();
      return;
    }
    setActiveScreen("home", { replaceHistory: true });
  });
}

window.addEventListener("popstate", (event) => {
  const targetScreen = event.state?.screen;
  if (targetScreen) {
    setActiveScreen(targetScreen, { skipHistory: true });
    allowAppExit = false;
    if (exitAttemptTimer) {
      clearTimeout(exitAttemptTimer);
      exitAttemptTimer = null;
    }
    return;
  }
  const activeScreen = document.querySelector(".screen.is-active")?.dataset.screen || "home";
  if (allowAppExit) {
    allowAppExit = false;
    if (exitAttemptTimer) {
      clearTimeout(exitAttemptTimer);
      exitAttemptTimer = null;
    }
    history.back();
    return;
  }
  allowAppExit = true;
  if (exitAttemptTimer) {
    clearTimeout(exitAttemptTimer);
  }
  exitAttemptTimer = setTimeout(() => {
    allowAppExit = false;
    exitAttemptTimer = null;
  }, 1500);
  setActiveScreen(activeScreen, { skipHistory: true });
  history.pushState({ screen: activeScreen }, "", window.location.pathname);
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.navTarget;
    if (target) {
      setActiveScreen(target);
    }
  });
});

if (resetModal) {
  cancelResetBtn.addEventListener("click", () => {
    resetModal.classList.remove("is-visible");
    personaIdToReset = null;
  });

  resetModal.addEventListener("click", (e) => {
    if (e.target === resetModal) {
      resetModal.classList.remove("is-visible");
      personaIdToReset = null;
    }
  });

  confirmResetBtn.addEventListener("click", async () => {
    if (!personaIdToReset) return;

    try {
      const response = await fetch(`/api/personas/${personaIdToReset}/conversation`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to reset conversation');
      }

      // If the reset persona is the active one, reload its view
      if (personaIdToReset === activePersonaId) {
        // Force a reload of the conversation history
        const selectedPersona = personas.find((p) => p.id === activePersonaId);
        const convResponse = await fetch(`/api/personas/${activePersonaId}/conversation`);
        const conversation = await convResponse.json();
        chatHistory = conversation;
        renderChatHistory(chatHistory);
        updateChatHeader(selectedPersona);
      }

      console.log(`Conversation for ${personaIdToReset} has been reset.`);

    } catch (error) {
      console.error("Error resetting conversation:", error);
      // Optionally, show an error message to the user
    } finally {
      resetModal.classList.remove("is-visible");
      personaIdToReset = null;
    }
  });
}

async function init() {
  await loadConfig();
  await loadModels();
  await loadPersonas();
  if (!activePersonaId && personas.length > 0) {
    setActivePersona(personas[0].id);
  }
}

init();
