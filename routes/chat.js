const express = require("express");
const { ollamaChatOnce, ollamaChatStream } = require("../services/ollama");
const { getDb } = require("../services/database");
const { buildSystemPrompt, sanitizeAssistantText } = require("../services/globalStyle");
const { generateDetailedPrompt } = require("../services/promptBuilder");

function chatRouter() {
  const router = express.Router();

  // POST /api/chat/stream { model, messages }
  router.post("/chat/stream", async (req, res) => {
    const { model, messages, persona, personaId: bodyPersonaId } = req.body;
    const personaId = persona?.id ?? bodyPersonaId;

    if (!model || !messages || !persona) {
      return res
        .status(400)
        .json({ error: "model, messages, et persona requis" });
    }

    if (!personaId) {
      return res.status(400).json({ error: "persona.id requis" });
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
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let clientClosed = false;
    const keepAliveIntervalMs = 15000;
    const keepAliveTimer = setInterval(() => {
      if (clientClosed) return;
      res.write(":\n\n");
      res.flush?.();
    }, keepAliveIntervalMs);
    req.on("close", () => {
      clientClosed = true;
      clearInterval(keepAliveTimer);
    });

    const sendEvent = (payload) => {
      if (clientClosed) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      res.flush?.();
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
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

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

      const sanitizedFull = sanitizeAssistantText(full);
      full = sanitizedFull || full;
      sendEvent({ type: "done" });

      try {
        const db = getDb();
        const stmt = db.prepare(
          "INSERT INTO conversations (persona_id, role, content) VALUES (?, ?, ?)"
        );
        if (lastUserMessage?.content) {
          stmt.run(personaId, "user", lastUserMessage.content);
        }
        if (full) {
          stmt.run(personaId, "assistant", full);
        }
      } catch (dbError) {
        console.error(`Failed to save conversation for persona ${personaId}:`, dbError);
      }
    } catch (e) {
      sendEvent({ type: "error", error: e.message });
    } finally {
      clearInterval(keepAliveTimer);
      if (!clientClosed) {
        res.end();
      }
    }
  });

  return router;
}

module.exports = { chatRouter };
