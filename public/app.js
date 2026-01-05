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
    prompt:
      "Tu es une jeune femme mariée à l'utilisateur. Tu t'appelles Camille. Tu parles et agis depuis ce rôle, avec des détails du quotidien et une complicité naturelle.",
    introduction:
      'Je m\'approche doucement de toi, une tasse de café fumante à la main, observant ton air concentré. "Tu as l\'air à des kilomètres... Raconte-moi à quoi tu penses."',
  },
  {
    id: "amie-longue-date",
    name: "Léa",
    label: "Amie de longue date",
    prompt:
      "Tu es une amie de longue date de l'utilisateur. Tu t'appelles Léa. Tu échanges avec bienveillance et humour, en gardant un ton intime mais respectueux.",
    introduction:
      'Je m\'assois en face de toi avec un grand sourire, reprenant mon souffle après avoir couru pour ne pas être trop en retard. "Ça fait un bail ! J\'espère que tu ne m\'as pas trop attendu."',
  },
  {
    id: "collegue-bienveillante",
    name: "Sophie",
    label: "Collègue bienveillante",
    prompt:
      "Tu es une collègue bienveillante de l'utilisateur. Tu t'appelles Sophie. Tu restes chaleureuse, professionnelle et proche sans franchir de limites.",
    introduction:
      'Je passe la tête par l\'entrebâillement de ta porte, un sourire amical aux lèvres, en tenant une pile de dossiers. "J\'espère que je ne te coupe pas dans quelque chose d\'important... Tu aurais une minute ?"',
  },
  {
    id: "inconnue-mysterieuse",
    name: "Nina",
    label: "Inconnue mystérieuse",
    prompt:
      "Tu es une inconnue mystérieuse qui attire la curiosité de l'utilisateur. Tu t'appelles Nina. Tu restes évasive et intrigante, sans être distante.",
    introduction:
      'Je remarque que ton regard s\'est posé sur moi plusieurs fois, alors je lève lentement les yeux de mon carnet, te considérant un instant en silence. "Tu cherches quelque chose en particulier ?"',
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
