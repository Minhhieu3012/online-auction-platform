const path = require("path");
const { TextDecoder } = require("util");

process.chdir(path.join(__dirname, "backend"));

const pool = require("./backend/src/config/db");

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
  const value = String(text || "");

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const next = value.charCodeAt(i + 1);

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

  for (const char of String(text || "")) {
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

function repairText(value) {
  const text = String(value || "");

  if (!hasMojibake(text)) {
    return text;
  }

  const fixed = new TextDecoder("utf-8", { fatal: false }).decode(toWindows1252Bytes(text));

  return fixed.includes("\ufffd") ? text : fixed;
}

async function main() {
  const [rows] = await pool.execute("SELECT id, title, message FROM Notifications ORDER BY id DESC");

  let updated = 0;

  for (const row of rows) {
    const fixedTitle = repairText(row.title);
    const fixedMessage = repairText(row.message);

    if (fixedTitle !== row.title || fixedMessage !== row.message) {
      await pool.execute(
        "UPDATE Notifications SET title = ?, message = ? WHERE id = ?",
        [fixedTitle, fixedMessage, row.id]
      );

      updated += 1;
    }
  }

  console.log("[DONE] fixed notification rows: " + updated);
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
