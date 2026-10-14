import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Which model to use. Set GEMINI_MODEL in .env to switch without editing code.
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// Get the image filename from the command line, e.g. node extract.js test2.png
const imagePath = process.argv[2];

if (!imagePath) {
  console.log("Please give an image file, e.g. node extract.js test1.png");
  process.exit(1);
}

// Pick the image type from the file extension
const ext = path.extname(imagePath).toLowerCase();
const mimeTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const mimeType = mimeTypes[ext];

if (!mimeType) {
  console.log("Unsupported file type. Use a .png, .jpg, .jpeg or .webp file.");
  process.exit(1);
}

const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });

const prompt = `You are reading a screenshot of someone's gym workout notes.
Lines are written in different styles, for example:
- "Exercise name: 40kg 2set 9reps"
- "Incline Bench 70*2*8" (weight * sets * reps)
- "Chest fly 22kg*2*7,8" (weight * sets * reps for each set)
Extract every exercise. For each one return:
- exercise: the name exactly as written
- weight_kg: the weight in kilograms, as a number (assume kg if no unit is written)
- sets: the number of sets
- reps_per_set: an array with one rep number for each set.
  If one rep number is given for all sets, repeat it for every set
  (2 sets of 8 reps gives [8, 8]).
  If different reps are given per set (like 7,8), list each one ([7, 8]).
Read the numbers carefully.`;

console.log(`Using model: ${model}`);

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

// Safety check: number of sets should match the number of rep entries
for (const item of result.exercises) {
  if (item.reps_per_set.length !== item.sets) {
    console.log(
      `Warning: ${item.exercise} has ${item.sets} sets but ${item.reps_per_set.length} rep entries`
    );
  }
}

// Print everything, including the nested arrays
console.log(JSON.stringify(result, null, 2));