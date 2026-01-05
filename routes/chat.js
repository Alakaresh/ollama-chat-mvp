const express = require("express");
const { ollamaChatOnce } = require("../services/ollama");
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

  return router;
}

module.exports = { chatRouter };
