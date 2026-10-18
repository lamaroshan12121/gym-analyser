import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Which model to use. Set GEMINI_MODEL in .env to switch without editing code.
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

const prompt = `You are reading a screenshot of someone's gym workout notes.
Lines are written in different styles, for example:
- "Exercise name: 40kg 2set 9reps"
- "Incline Bench 70*2*8" (weight * sets * reps)
- "Chest fly 22kg*2*7,8" (weight * sets * reps for each set)
A single line may wrap onto two lines in the screenshot. Treat a wrapped line as one entry.
Extract every exercise. For each one return:
- exercise: ONLY the exercise name, written as in the note. Do not include the
  weight, sets, reps, a colon, or any line break. If the name wraps across two
  lines, join it into one name with a single space.
- weight_kg: the weight in kilograms, as a number (assume kg if no unit is written)
- sets: the number of sets
- reps_per_set: an array with one rep number for each set.
  If one rep number is given for all sets, repeat it for every set
  (2 sets of 8 reps gives [8, 8]).
  If different reps are given per set (like 7,8), list each one ([7, 8]).
Read the numbers carefully.`;

// Alternative names -> one standard name. Add your own over time.
// Keys must be lowercase. Names not in this list are left as written.
const nameAliases = {
  "db curl": "Dumbbell Curl",
  "db curls": "Dumbbell Curl",
  "bp": "Bench Press",
  "incline bench": "Incline Bench Press",
};

// Clean an exercise name: join wrapped lines, drop anything after a colon,
// then swap in the standard name if we have one
function cleanName(name) {
  const cleaned = name.replace(/\s*\n\s*/g, " ").split(":")[0].trim();
  return nameAliases[cleaned.toLowerCase()] || cleaned;
}

// Look for numbers that can't be right. Returns a list of problems (empty = fine)
function findProblems(item) {
  const problems = [];

  if (!(item.weight_kg > 0 && item.weight_kg <= 500)) {
    problems.push(`weight of ${item.weight_kg}kg looks wrong`);
  }
  if (!(item.sets >= 1 && item.sets <= 20)) {
    problems.push(`${item.sets} sets looks wrong`);
  }
  for (const reps of item.reps_per_set) {
    if (!(reps >= 1 && reps <= 100)) {
      problems.push(`${reps} reps looks wrong`);
    }
  }
  if (item.reps_per_set.length !== item.sets) {
    problems.push(
      `${item.sets} sets but ${item.reps_per_set.length} rep entries`
    );
  }

  return problems;
}

// This function runs every time someone sends a request to /api/extract
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Please use POST" });
  }

  const { imageBase64, mimeType } = req.body || {};

  if (!imageBase64 || !allowedTypes.includes(mimeType)) {
    return res.status(400).json({
      error:
        "Send imageBase64 and a mimeType of image/png, image/jpeg or image/webp",
    });
  }

  try {
    const interaction = await client.interactions.create({
      model,
      input: [
        { type: "text", text: prompt },
        { type: "image", data: imageBase64, mime_type: mimeType },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            exercises: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  exercise: { type: "string" },
                  weight_kg: { type: "number" },
                  sets: { type: "integer" },
                  reps_per_set: {
                    type: "array",
                    items: { type: "integer" },
                  },
                },
                required: ["exercise", "weight_kg", "sets", "reps_per_set"],
              },
            },
          },
          required: ["exercises"],
        },
      },
    });

    const result = JSON.parse(interaction.output_text);

    for (const item of result.exercises) {
      item.exercise = cleanName(item.exercise);
      item.problems = findProblems(item);
      item.needs_review = item.problems.length > 0;
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Could not read the screenshot. Try again." });
  }
}