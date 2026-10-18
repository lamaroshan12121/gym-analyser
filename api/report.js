import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({});
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const reportSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    progress: { type: "array", items: { type: "string" } },
    flags: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "progress", "flags", "suggestions"],
};

const prompt = `You are a friendly, practical strength coach.
Below is a lifter's training stats as JSON. All numbers were calculated by code, so treat them as correct. Do not invent numbers, exercises or dates that are not in the data.

Write a short weekly report with:
- summary: 2 to 3 sentences on how the week went.
- progress: 1 to 4 short bullet points on what is going well (personal bests, volume, consistency).
- flags: 0 to 4 short bullet points on problems (stalled lifts, muscle groups with very few or no sets this week, exercises not trained for a long time). Use an empty list if there are none.
- suggestions: 2 to 4 specific, actionable things to do next week.

Keep it encouraging but honest. If there is very little data (for example only one session), say so and keep claims modest. Weights are in kg.

Stats:
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Please use POST" });
  }

  const { stats } = req.body || {};

  if (!stats || typeof stats !== "object") {
    return res.status(400).json({ error: "Missing stats object" });
  }

  try {
    const interaction = await client.interactions.create({
      model,
      input: [{ type: "text", text: prompt + JSON.stringify(stats, null, 2) }],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: reportSchema,
      },
    });

    const report = JSON.parse(interaction.output_text);
    return res.status(200).json(report);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Could not generate the report. Try again in a minute." });
  }
}