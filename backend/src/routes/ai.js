const express = require("express");
const Groq = require("groq-sdk");
const { Medicine, Inventory } = require("../models");
const { authenticateJWT } = require("../middleware/security");

const router = express.Router();
let groq = null;
const getGroq = () => {
  const key = process.env.GROQ_API_KEY;
  console.log("GROQ KEY:", key ? key.substring(0, 10) + "..." : "MISSING");
  if (!groq) groq = new Groq({ apiKey: key });
  return groq;
};
const SYSTEM_PROMPT = `You are Dr. MediLink AI, a friendly and professional medical assistant for an Indian pharmacy app.

YOUR ONLY PURPOSE: Health, medicine, symptoms, dosages, side effects, drug interactions, wellness advice.
If asked about ANYTHING else, respond ONLY: "I can only help with health and medicine related questions."

CONSULTATION STYLE — follow this flow:
1. When user describes a symptom, FIRST ask 1-2 follow-up questions to understand better:
   - Ask about duration (how long?)
   - Ask about severity (mild/moderate/severe?)
   - Ask about age group if relevant (child/adult/elderly?)
   - Ask about any known allergies if suggesting medicine
2. After getting enough info, suggest medicines with:
   - Medicine name (generic preferred)
   - Dosage guidance
   - When to take
   - Any warnings
3. Always end with: "Please consult a doctor if symptoms persist or worsen."

RULES:
- Be warm and empathetic like a real doctor
- Keep responses under 200 words
- Respond in same language as user (Hindi, English, Tamil, Punjabi, Marathi)
- Never definitively diagnose
- For emergencies say: "This sounds serious — please visit a hospital immediately"

At end of EVERY response output:
MEDICINES:["medicine1","medicine2"]
If no medicines: MEDICINES:[]`;
router.post("/chat", authenticateJWT, async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || message.trim().length < 2) {
      return res.status(400).json({ error: "Message too short" });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: "Message too long" });
    }

    // Build conversation history for context (last 6 messages)
    const recentHistory = history.slice(-6).map(h => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.content,
    }));

    const messages = [
      ...recentHistory,
      { role: "user", content: message },
    ];

    // Call Groq API
    const completion = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const rawReply = completion.choices[0]?.message?.content || "Sorry, I could not process that.";

    // Extract medicine names from MEDICINES:[...] block
    let medicines = [];
    const medicineMatch = rawReply.match(/MEDICINES:\[(.*?)\]/);
    if (medicineMatch) {
      try {
        medicines = JSON.parse(`[${medicineMatch[1]}]`);
      } catch {
        medicines = [];
      }
    }

    // Clean reply — remove the MEDICINES:[...] part from displayed text
    const reply = rawReply.replace(/MEDICINES:\[.*?\]/, "").trim();

    // Check which suggested medicines are actually in the database
    let availableMedicines = [];
    if (medicines.length > 0) {
      const found = await Medicine.find({
        isActive: true,
        $or: medicines.map(name => ({
          $or: [
            { name: { $regex: name, $options: "i" } },
            { genericName: { $regex: name, $options: "i" } },
          ]
        }))
      }).select("name genericName").limit(5).lean();

      availableMedicines = found.length > 0 ? found.map(m => m.name) : medicines.slice(0, 4);
    }

    res.json({
      reply,
      medicines: availableMedicines,
      raw_suggestions: medicines,
    });

  } catch (err) {
    if (err?.status === 401) {
      return res.status(500).json({ error: "AI service configuration error" });
    }
    next(err);
  }
});

module.exports = router;