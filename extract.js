import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
Each line looks like: "Exercise name: 40kg 2set 9reps".
Extract every exercise. For each one return:
- exercise: the name exactly as written
- weight_kg: the weight in kilograms, as a number
- sets: the number before "set"
- reps: the number before "rep" or "reps"
Every line has all four values. Read the numbers carefully.`;

const interaction = await client.interactions.create({
  model: "gemini-3.8-flash",
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
              reps: { type: "integer" },
            },
            required: ["exercise", "weight_kg", "sets", "reps"],
          },
        },
      },
      required: ["exercises"],
    },
  },
});

console.log(JSON.parse(interaction.output_text));