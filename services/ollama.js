async function ollamaChatStream({ model, messages, options, onDelta }) {
  const payload = { model, messages, stream: true, options };

  const r = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok || !r.body) throw new Error(`Ollama HTTP ${r.status}`);

  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let full = "";

  outerLoop: while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter(Boolean);

    for (const line of lines) {
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      const delta = obj?.message?.content || "";
      if (delta.includes("#")) break outerLoop;

      if (delta) {
        full += delta;
        onDelta?.(delta);
      }

      if (obj?.done) break outerLoop;
    }
  }

  return full;
}

async function ollamaChatOnce({ model, messages, options }) {
  const payload = { model, messages, stream: false, options };

  const r = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
  const data = await r.json();
  return data?.message?.content || "";
}

module.exports = { ollamaChatStream, ollamaChatOnce };
