const fs = require("fs");
const { TextDecoder } = require("util");

const filePath = "backend/src/controllers/admin.js";
const backupPath = filePath + ".bak-encoding";

const cp1252Reverse = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f]
]);

function hasMojibake(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const next = text.charCodeAt(i + 1);

    if (
      code === 0x00c3 ||
      code === 0x00c2 ||
      code === 0x00c4 ||
      code === 0x00c5 ||
      code === 0x00c6 ||
      code === 0x00e2
    ) {
      return true;
    }

    if (code === 0x00e1 && (next === 0x00ba || next === 0x00bb)) {
      return true;
    }
  }

  return false;
}

function toWindows1252Bytes(text) {
  const bytes = [];

  for (const char of text) {
    const codePoint = char.codePointAt(0);

    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    if (cp1252Reverse.has(codePoint)) {
      bytes.push(cp1252Reverse.get(codePoint));
      continue;
    }

    bytes.push(...Buffer.from(char, "utf8"));
  }

  return Uint8Array.from(bytes);
}

const source = fs.readFileSync(filePath, "utf8");

if (!hasMojibake(source)) {
  console.log("[OK] no mojibake pattern found in admin.js");
  process.exit(0);
}

fs.copyFileSync(filePath, backupPath);

const fixed = new TextDecoder("utf-8", { fatal: false }).decode(toWindows1252Bytes(source));

fs.writeFileSync(filePath, fixed, "utf8");

console.log("[DONE] fixed admin.js encoding");
console.log("[BACKUP] " + backupPath);
