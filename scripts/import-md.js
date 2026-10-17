// Converts recipes from my old markdown notes format into the site format.
//
//   node scripts/import-md.js _import/*.md          # writes recipes/<slug>.md
//   node scripts/import-md.js --force _import/*.md  # overwrite existing files
//
// Old format: "# Title", "**Key:** value" metadata lines, a "> " quote as the
// intro, "---" separators, "- [ ]" checklist ingredients, "## Directions".
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const args = process.argv.slice(2);
const force = args.includes("--force");
const files = args.filter((a) => a !== "--force");
const outDir = new URL("../recipes/", import.meta.url).pathname;

if (!files.length) {
  console.error("Usage: node scripts/import-md.js [--force] <file.md>...");
  process.exit(1);
}

const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const shortTime = (s) =>
  s.replace(/\bhours?\b/gi, "hr").replace(/\bminutes?\b|\bmins\b/gi, "min").replace(/\s+/g, " ").trim();

function convert(text) {
  const lines = text.split(/\r?\n/);
  const data = {};
  const meta = {};
  const intro = [];
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (/^\s*---+\s*$/.test(line)) continue;
    const h1 = line.match(/^#\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const kv = !current && line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (h1 && !data.title) data.title = h1[1].trim().replace(/\s+Recipe$/i, "");
    else if (h2) sections.push((current = { title: h2[1].trim(), lines: [] }));
    else if (kv) meta[kv[1].trim().toLowerCase()] = kv[2].trim();
    else if (current) current.lines.push(line.replace(/^(\s*)[-*]\s+\[[ xX]\]\s+/, "$1- "));
    else if (/^>?\s*[—–]/.test(line)) intro.push("", line.replace(/^>\s?/, "")); // quote attribution on its own line
    else if (line.trim()) intro.push(line.replace(/^>\s?/, ""));
    else intro.push("");
  }

  if (meta.tags) {
    data.tags = meta.tags
      .split(/\s+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter((t) => t && t.toLowerCase() !== "recipe");
  }
  const yieldText = meta.yield || meta.servings || meta.serves;
  if (yieldText) {
    const range = yieldText.match(/^(\d+)\s*(?:to|-|–)\s*\d+\s*(.*)$/);
    const single = yieldText.match(/^(\d+)\s*(.*)$/);
    if (range) {
      data.servings = `${range[1]} ${range[2] || "servings"}`.trim();
      data.yield = yieldText.replace(/\s*(?:to|-)\s*/, "–");
    } else if (single) data.servings = single[2] && single[2] !== "servings" ? yieldText : Number(single[1]);
    else data.yield = yieldText;
  }
  if (meta["prep time"]) data.prep = shortTime(meta["prep time"]);
  if (meta["cook time"]) data.cook = shortTime(meta["cook time"]);
  if (meta["total time"]) data.total = shortTime(meta["total time"]);
  if (meta.source) {
    if (/^https?:\/\//.test(meta.source)) data.source = meta.source;
    else data.source_name = meta.source;
  }
  if (meta.url) data.source = meta.url;
  if (meta.rating) {
    const stars = (meta.rating.match(/★/g) || []).length || Number.parseInt(meta.rating, 10);
    if (stars) data.rating = stars;
  }
  const known = ["tags", "yield", "servings", "serves", "prep time", "cook time", "total time", "source", "url", "rating"];
  const unknown = Object.keys(meta).filter((k) => !known.includes(k));

  const tidy = (ls) => ls.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  let body = "";
  const introText = tidy(intro);
  if (introText) body += introText + "\n\n";
  for (const s of sections) {
    const content = tidy(s.lines);
    if (content) body += `## ${s.title}\n\n${content}\n\n`;
  }
  return { data, body: body.trim() + "\n", unknown };
}

for (const file of files) {
  const { data, body, unknown } = convert(fs.readFileSync(file, "utf8"));
  if (!data.title) {
    console.warn(`skip   ${file}: no "# Title" line`);
    continue;
  }
  const out = path.join(outDir, `${slugify(data.title)}.md`);
  if (fs.existsSync(out) && !force) {
    console.warn(`exists ${path.relative(process.cwd(), out)} (use --force to overwrite)`);
    continue;
  }
  fs.writeFileSync(out, matter.stringify(body, data));
  const note = unknown.length ? `  [ignored metadata: ${unknown.join(", ")}]` : "";
  console.log(`wrote  ${path.relative(process.cwd(), out)}${note}`);
}
