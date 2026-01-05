const express = require("express");
const { ollamaChatOnce, ollamaChatStream } = require("../services/ollama");
const {
  GLOBAL_SYSTEM_PROMPT,
  sanitizeAssistantText,
  looksNarrativeOk,
  REWRITE_INSTRUCTION,
} = require("../services/globalStyle");

function chatRouter() {
  const router = express.Router();

  // POST /api/chat { model, message }
  router.post("/chat", async (req, res) => {
    const { model, message } = req.body;

    if (!model || !message) {
      return res.status(400).json({ error: "model et message requis" });
    }

    const options = { temperature: 0.7, top_p: 0.9, repeat_penalty: 1.15 };

    try {
      // 1) première réponse
      let text = await ollamaChatOnce({
        model,
        options,
        messages: [
          { role: "system", content: GLOBAL_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
      });

      text = sanitizeAssistantText(text);

      // 2) rewrite si besoin (format Linky/Lilly)
      if (!looksNarrativeOk(text)) {
        text = await ollamaChatOnce({
          model,
          options,
          messages: [
            { role: "system", content: GLOBAL_SYSTEM_PROMPT },
            { role: "user", content: REWRITE_INSTRUCTION + "\n\nTEXTE:\n" + text },
          ],
        });

        text = sanitizeAssistantText(text);
      }

      res.json({ content: text });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/chat/stream { model, message }
  router.post("/chat/stream", async (req, res) => {
    const { model, message } = req.body;

    if (!model || !message) {
      return res.status(400).json({ error: "model et message requis" });
    }

    const options = { temperature: 0.7, top_p: 0.9, repeat_penalty: 1.15 };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendEvent = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    let full = "";

    try {
      await ollamaChatStream({
        model,
        options,
        messages: [
          { role: "system", content: GLOBAL_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        onDelta: (delta) => {
          full += delta;
          sendEvent({ type: "delta", delta });
        },
      });

      let cleaned = sanitizeAssistantText(full);

      if (!looksNarrativeOk(cleaned)) {
        cleaned = await ollamaChatOnce({
          model,
          options,
          messages: [
            { role: "system", content: GLOBAL_SYSTEM_PROMPT },
            { role: "user", content: REWRITE_INSTRUCTION + "\n\nTEXTE:\n" + cleaned },
          ],
        });

        cleaned = sanitizeAssistantText(cleaned);
        sendEvent({ type: "replace", content: cleaned });
      }

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
