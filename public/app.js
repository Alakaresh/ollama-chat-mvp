const modelSelect = document.getElementById("modelSelect");
const personaSelect = document.getElementById("personaSelect");
const chatBox = document.getElementById("chatBox");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

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
  const p = document.createElement("p");
  p.style.margin = "6px 0";

  const who = document.createElement("b");
  who.textContent = role + ": ";
  p.appendChild(who);

  const message = document.createElement("span");
  message.className = "chat-text";
  setQuotedContent(message, text);
  p.appendChild(message);
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendStreamingAssistant(name) {
  const p = document.createElement("p");
  p.style.margin = "6px 0";

  const who = document.createElement("b");
  who.textContent = `${name || "assistant"}: `;
  p.appendChild(who);

  const message = document.createElement("span");
  message.className = "chat-text";
  p.appendChild(message);
  chatBox.appendChild(p);
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
  const personas = [
    {
      id: "jeune-femme-mariee",
      name: "Camille",
      label: "Jeune femme mariée à l'utilisateur",
      prompt:
        "Tu es une jeune femme mariée à l'utilisateur. Tu t'appelles Camille. Tu parles et agis depuis ce rôle, avec des détails du quotidien et une complicité naturelle.",
    },
    {
      id: "amie-longue-date",
      name: "Léa",
      label: "Amie de longue date",
      prompt:
        "Tu es une amie de longue date de l'utilisateur. Tu t'appelles Léa. Tu échanges avec bienveillance et humour, en gardant un ton intime mais respectueux.",
    },
    {
      id: "collegue-bienveillante",
      name: "Sophie",
      label: "Collègue bienveillante",
      prompt:
        "Tu es une collègue bienveillante de l'utilisateur. Tu t'appelles Sophie. Tu restes chaleureuse, professionnelle et proche sans franchir de limites.",
    },
    {
      id: "inconnue-mysterieuse",
      name: "Nina",
      label: "Inconnue mystérieuse",
      prompt:
        "Tu es une inconnue mystérieuse qui attire la curiosité de l'utilisateur. Tu t'appelles Nina. Tu restes évasive et intrigante, sans être distante.",
    },
  ];

  personaSelect.innerHTML = "";
  personas.forEach((persona) => {
    const opt = document.createElement("option");
    opt.value = persona.prompt;
    opt.textContent = persona.label;
    opt.dataset.name = persona.name;
    personaSelect.appendChild(opt);
  });

  personaSelect.value = personas[0]?.prompt || "";
}

async function sendMessage() {
  const message = msgInput.value.trim();
  if (!message) return;

  const model = modelSelect.value;
  const personaOption = personaSelect.selectedOptions[0];
  const persona = personaOption?.value || "";
  const personaName = personaOption?.dataset?.name || "assistant";

  append("user", message);
  const assistantTextNode = appendStreamingAssistant(personaName);
  msgInput.value = "";
  msgInput.focus();

  sendBtn.disabled = true;

  try {
    const r = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        message,
        persona,
        personaName,
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
    let current = "";

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
          current += event.delta || "";
          setQuotedContent(assistantTextNode, current);
          chatBox.scrollTop = chatBox.scrollHeight;
        } else if (event.type === "replace") {
          current = event.content || "";
          setQuotedContent(assistantTextNode, current);
          chatBox.scrollTop = chatBox.scrollHeight;
        } else if (event.type === "error") {
          append("error", event.error || "Erreur serveur");
        }
      }
    }
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
