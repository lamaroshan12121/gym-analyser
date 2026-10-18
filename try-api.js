import fs from "node:fs";

// Usage: node try-api.js test4.png
const imagePath = process.argv[2];

if (!imagePath) {
  console.log("Please give an image file, e.g. node try-api.js test4.png");
  process.exit(1);
}

const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });

const response = await fetch("http://localhost:3000/api/extract", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ imageBase64, mimeType: "image/png" }),
});

const data = await response.json();

console.log("Status:", response.status);
console.log(JSON.stringify(data, null, 2));