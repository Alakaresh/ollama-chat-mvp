const modelSelect = document.getElementById("modelSelect");
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

async function sendMessage() {
  const message = msgInput.value.trim();
  if (!message) return;

  const model = modelSelect.value;

  append("user", message);
  const assistantTextNode = appendStreamingAssistant();
  msgInput.value = "";
  msgInput.focus();

  sendBtn.disabled = true;

  try {
    const r = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, message }),
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
