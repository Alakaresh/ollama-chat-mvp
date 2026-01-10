const express = require("express");
const { ollamaChatOnce, ollamaChatStream } = require("../services/ollama");
const { buildSystemPrompt, processAssistantOutput } = require("../services/globalStyle");
const { generateDetailedPrompt } = require("../services/promptBuilder");
const logger = require("../services/logger");

function chatRouter() {
  const router = express.Router();

  // POST /api/chat/stream { model, messages }
  router.post("/chat/stream", async (req, res) => {
    const { model, messages, persona } = req.body;

    if (!model || !messages || !persona) {
      return res
        .status(400)
        .json({ error: "model, messages, et persona requis" });
    }

    let temperature = 1.0;
    if (model.includes("mythomax") || model.includes("dolphin")) {
      temperature = 0.45;
    }
    const options = {
      temperature,
      top_p: 0.9,
      repeat_penalty: 1.15,
      num_ctx: 8192,
    };
    const baseSystemPrompt = buildSystemPrompt(
      persona.introduction,
      persona.name,
      persona.nsfw
    );
    const detailedPrompt = generateDetailedPrompt(persona);
    const systemPrompt = [baseSystemPrompt, detailedPrompt]
      .filter(Boolean)
      .join("\n\n");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendEvent = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const finalMessages = [{ role: "system", content: systemPrompt }];

    if (persona.environment) {
      finalMessages.push({ role: "system", content: persona.environment });
    }

    finalMessages.push(...messages);

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

      processAssistantOutput(full);
      sendEvent({ type: "done" });
    } catch (e) {
      logger.error("Streaming chat failed", { error: e, model });
      sendEvent({ type: "error", error: e.message });
    } finally {
      res.end();
    }
  });

  return router;
}

module.exports = { chatRouter };
