const fs = require("fs");
const path = require("path");

const required = [
  "brand/voice.md",
  "brand/positioning.md",
  "brand/audience.md",
  "brand/claims.md",
  "brand/examples.md",
  "brand/glossary.md",
  "product/notes.md",
];

const root = __dirname;
const missing = [];
for (const rel of required) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs) || fs.readFileSync(abs, "utf8").trim().length < 40) {
    missing.push(rel);
  }
}

if (missing.length) {
  console.error("dreamit-brand: incomplete —", missing.join(", "));
  process.exit(1);
}

console.log("dreamit-brand: ok (brand pack + product notes)");
