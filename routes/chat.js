const express = require("express");
const { ollamaChatOnce, ollamaChatStream } = require("../services/ollama");
const {
  buildSystemPrompt,
  sanitizeAssistantText,
} = require("../services/globalStyle");

function chatRouter() {
  const router = express.Router();

  // POST /api/chat/stream { model, messages }
  router.post("/chat/stream", async (req, res) => {
    const { model, messages, persona, personaName, personaNsfw } = req.body;

    if (!model || !messages) {
      return res.status(400).json({ error: "model et messages requis" });
    }

    let temperature = 1.0;
    if (model.includes("mythomax") || model.includes("dolphin")) {
      temperature = 0.45;
    }
    const options = { temperature, top_p: 0.9, repeat_penalty: 1.15, num_ctx: 8192 };
    const systemPrompt = buildSystemPrompt(persona, personaName, personaNsfw);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendEvent = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const finalMessages = [{ role: "system", content: systemPrompt }, ...messages];

    sendEvent({
      type: "params",
      params: { model, options, messages: finalMessages },
    });

    let full = "";

    try {
      await ollamaChatStream({
        model,
        options,
        messages: finalMessages,
        onDelta: (delta) => {
          full += delta;
          sendEvent({ type: "delta", delta });
        },
      });

      sanitizeAssistantText(full);
      sendEvent({ type: "done" });
    } catch (e) {
      sendEvent({ type: "error", error: e.message });
    } finally {
      res.end();
    }
  });

  return router;
}

module.exports = { chatRouter };
