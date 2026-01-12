const express = require("express");
const { ollamaChatOnce, ollamaChatStream } = require("../services/ollama");
const { buildSystemPrompt, processAssistantOutput } = require("../services/globalStyle");
const { searchMemories, addMemory } = require("../services/vectorService");
const { getDb } = require("../services/database");
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

    // Dynamic Persona Context Loading
    const db = getDb();
    const charStmt = db.prepare("SELECT data FROM characters WHERE persona_id = ?");
    const relStmt = db.prepare("SELECT data FROM relationships WHERE persona_id = ?");
    const outfitStmt = db.prepare("SELECT data FROM outfits WHERE persona_id = ?");

    const charData = charStmt.get(persona.id);
    const relData = relStmt.get(persona.id);
    const outfitData = outfitStmt.get(persona.id);

    const coreContexts = [];
    if (charData) coreContexts.push(JSON.parse(charData.data).core_context);
    if (relData) coreContexts.push(JSON.parse(relData.data).core_context);
    if (outfitData) coreContexts.push(JSON.parse(outfitData.data).core_context);

    const personaContext = coreContexts.length > 0
      ? `\n\n[PERSONA CONTEXT]\n${JSON.stringify(coreContexts.filter(Boolean), null, 2)}\n[/PERSONA CONTEXT]`
      : "";

    let systemPrompt = [baseSystemPrompt, personaContext]
      .filter(Boolean)
      .join("\n\n");

    // RAG - Step 1: Search for relevant memories (conversation + persona traits)
    const userMessage = messages[messages.length - 1].content;
    const memories = await searchMemories({
      queryText: userMessage,
      persona_id: persona.id,
      type: ['conversation', 'static_persona'],
      k: 10
    });

    if (memories.length > 0) {
      const memoryBlock = `
--- DYNAMIC MEMORY (most relevant first) ---
${memories.map(m => `- ${m}`).join('\n')}
--- END OF DYNAMIC MEMORY ---
      `;
      systemPrompt += `\n\n${memoryBlock}`;
    }

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

    let fullResponse = "";

    try {
      await ollamaChatStream({
        model,
        options,
        messages: finalMessages,
        onDelta: (delta) => {
          fullResponse += delta;
          sendEvent({ type: "delta", delta });
        },
      });

      // RAG - Step 2 & 3: Process output and update memory
      let finalContent = fullResponse;
      const metaRegex = /<META>([\s\S]*?)<\/META>/;
      const metaMatch = fullResponse.match(metaRegex);

      if (metaMatch) {
          try {
              const metaContent = metaMatch[1].trim();
              logger.info('META tag found, adding to static memory.', { meta: metaContent });
              await addMemory({
                  persona_id: persona.id,
                  type: 'static',
                  content: metaContent
              });
              finalContent = finalContent.replace(metaRegex, '').trim();
          } catch (e) {
              logger.error('Failed to process META tag.', { error: e });
          }
      }

      await addMemory({
          persona_id: persona.id,
          type: 'conversation',
          content: `User: ${userMessage}\n${persona.name}: ${finalContent}`
      });

      processAssistantOutput(finalContent); // This is a fire-and-forget function
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
