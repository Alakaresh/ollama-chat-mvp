const modelSelect = document.getElementById("modelSelect");
const personaSelect = document.getElementById("personaSelect");
const chatBox = document.getElementById("chatBox");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

function append(role, text) {
  const p = document.createElement("p");
  p.style.margin = "6px 0";

  const who = document.createElement("b");
  who.textContent = role + ": ";
  p.appendChild(who);

  p.appendChild(document.createTextNode(text));
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendStreamingAssistant() {
  const p = document.createElement("p");
  p.style.margin = "6px 0";

  const who = document.createElement("b");
  who.textContent = "assistant: ";
  p.appendChild(who);

  const textNode = document.createTextNode("");
  p.appendChild(textNode);
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;

  return textNode;
}

async function loadModels() {
  const r = await fetch("/api/models");
  const models = await r.json();

  modelSelect.innerHTML = "";
  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    modelSelect.appendChild(opt);
  });

  // choix par défaut (si dispo)
  const preferred = models.find(m => m.includes("mythomax")) || models[0];
  if (preferred) modelSelect.value = preferred;
}

function loadPersonas() {
  const personas = [
    {
      id: "jeune-femme-mariee",
      label: "Jeune femme mariée à l'utilisateur",
      prompt:
        "Tu es une jeune femme mariée à l'utilisateur. Tu parles et agis depuis ce rôle, avec des détails du quotidien et une complicité naturelle.",
    },
    {
      id: "amie-longue-date",
      label: "Amie de longue date",
      prompt:
        "Tu es une amie de longue date de l'utilisateur. Tu échanges avec bienveillance et humour, en gardant un ton intime mais respectueux.",
    },
    {
      id: "collegue-bienveillante",
      label: "Collègue bienveillante",
      prompt:
        "Tu es une collègue bienveillante de l'utilisateur. Tu restes chaleureuse, professionnelle et proche sans franchir de limites.",
    },
    {
      id: "inconnue-mysterieuse",
      label: "Inconnue mystérieuse",
      prompt:
        "Tu es une inconnue mystérieuse qui attire la curiosité de l'utilisateur. Tu restes évasive et intrigante, sans être distante.",
    },
  ];

  personaSelect.innerHTML = "";
  personas.forEach((persona) => {
    const opt = document.createElement("option");
    opt.value = persona.prompt;
    opt.textContent = persona.label;
    personaSelect.appendChild(opt);
  });

  personaSelect.value = personas[0]?.prompt || "";
}

async function sendMessage() {
  const message = msgInput.value.trim();
  if (!message) return;

  const model = modelSelect.value;
  const persona = personaSelect.value;

  append("user", message);
  const assistantTextNode = appendStreamingAssistant();
  msgInput.value = "";
  msgInput.focus();

  sendBtn.disabled = true;

  try {
    const r = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, message, persona }),
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
          assistantTextNode.textContent = current;
          chatBox.scrollTop = chatBox.scrollHeight;
        } else if (event.type === "replace") {
          current = event.content || "";
          assistantTextNode.textContent = current;
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
