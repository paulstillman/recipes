// Imports a recipe from a web page into the site format.
//
//   node scripts/import-url.js <url>                # writes recipes/<slug>.md (+ photo)
//   node scripts/import-url.js --force <url>        # overwrite an existing file
//   node scripts/import-url.js --no-image <url>     # don't download the photo
//   node scripts/import-url.js --dry-run <url>      # print the result, write nothing
//   node scripts/import-url.js page.html            # a page saved from the browser
//   node scripts/import-url.js --source <url> page.html  # ...if it has no canonical link
//
// Reads the schema.org Recipe JSON-LD most recipe sites embed, falling back to
// schema.org microdata. Ingredient group headings and recipe notes come from the
// page's recipe card (WP Recipe Maker, Tasty Recipes, Dotdash Meredith sites)
// when it has them.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { slugify, shortTime } from "./helpers.js";

const USAGE = "Usage: node scripts/import-url.js [--force] [--no-image] [--dry-run] [--source <url>] <url | page.html>";
const UA = "Mozilla/5.0 (compatible; recipe-import/1.0)";
const outDir = new URL("../recipes/", import.meta.url).pathname;

const args = process.argv.slice(2);
const opts = { force: false, image: true, dryRun: false, source: null };
const inputs = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--force") opts.force = true;
  else if (a === "--no-image") opts.image = false;
  else if (a === "--dry-run") opts.dryRun = true;
  else if (a === "--source") opts.source = args[++i];
  else if (a.startsWith("--")) fail(`unknown option ${a}\n${USAGE}`);
  else inputs.push(a);
}
if (inputs.length !== 1) fail(USAGE);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// ---------- text helpers ----------

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", deg: "°", times: "×", frasl: "⁄", middot: "·",
  frac12: "½", frac13: "⅓", frac23: "⅔", frac14: "¼", frac34: "¾", frac18: "⅛", frac38: "⅜", frac58: "⅝", frac78: "⅞",
  eacute: "é", egrave: "è", ecirc: "ê", aacute: "á", agrave: "à", acirc: "â", iacute: "í", icirc: "î", oacute: "ó",
  ocirc: "ô", uacute: "ú", ntilde: "ñ", ccedil: "ç", auml: "ä", ouml: "ö", uuml: "ü", szlig: "ß", reg: "®", trade: "™", copy: "©",
};
const decodeOnce = (s) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+\d*));/gi, (whole, dec, hex, name) =>
    dec ? String.fromCodePoint(+dec) : hex ? String.fromCodePoint(parseInt(hex, 16)) : ENTITIES[name.toLowerCase()] ?? whole
  );
// Some sites double-encode ("&amp;#39;").
const decode = (s) => decodeOnce(decodeOnce(s));

// HTML fragment -> one line of plain text.
const text = (s) =>
  decode(String(s ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/[\s ]+/g, " ")
    .trim();

// "<b> 3 cups</b>" -> " **3 cups**"
const wrap = (inner, mark) => {
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : inner;
};

// HTML fragment -> light markdown (paragraphs, lists, bold, italics).
function htmlToMd(html) {
  return decode(
    html
      .replace(/<(script|style|svg|button)[\s\S]*?<\/\1>/gi, "")
      .replace(/[*_]/g, "\\$&") // literal footnote asterisks etc.
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|ul|ol|h\d)>/gi, "\n\n")
      .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, t, inner) => wrap(inner, "**"))
      .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, t, inner) => wrap(inner, "*"))
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ +([,.;:)])/g, "$1")
    .replace(/,\s*$/gm, "")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const types = (o) => list(o?.["@type"]).map((t) => String(t).replace(/^.*[/:]/, ""));

// ---------- fetching ----------

async function load(input) {
  if (!/^https?:\/\//i.test(input)) {
    if (!fs.existsSync(input)) fail(`No such file: ${input}`);
    return { html: fs.readFileSync(input, "utf8"), url: opts.source };
  }
  let res;
  try {
    res = await fetch(input, { headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" } });
  } catch (e) {
    fail(`Couldn't fetch ${input}: ${e.cause?.message || e.message}`);
  }
  const html = await res.text();
  const blocked = /<title>(Just a moment|Attention Required|Access denied|Simple Page)/i.test(html);
  if (!res.ok && !blocked && ![401, 403, 429, 503].includes(res.status)) fail(`${input} returned ${res.status} ${res.statusText}.`);
  if (!res.ok || blocked) {
    fail(
      `${input} returned ${res.status}${blocked ? " (a bot check page)" : ""}.\n` +
        "Some sites only serve recipes to a real browser. Open the page in your browser, use\n" +
        "File → Save Page As… (\"Page Source\" / \"HTML Only\"), and run:\n" +
        `  node scripts/import-url.js --source ${input} ~/Downloads/<saved file>.html`
    );
  }
  return { html, url: opts.source || res.url || input };
}

// ---------- JSON-LD ----------

function jsonLd(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    let raw = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        data = JSON.parse(raw.replace(/[\u0000-\u001f]+/g, " ")); // raw newlines/tabs inside strings
      } catch {
        continue;
      }
    }
    (function walk(v) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        nodes.push(v);
        if (v["@graph"]) walk(v["@graph"]);
        if (v.mainEntity) walk(v.mainEntity);
      }
    })(data);
  }
  const byId = new Map(nodes.filter((n) => n["@id"]).map((n) => [n["@id"], n]));
  const resolve = (v) => (v && typeof v === "object" && !Array.isArray(v) && v["@id"] && Object.keys(v).length === 1 ? byId.get(v["@id"]) || v : v);
  const recipe = nodes.find((n) => types(n).includes("Recipe"));
  const site = nodes.find((n) => types(n).includes("WebSite"));
  return recipe && { recipe, resolve, siteName: site?.name };
}

// ---------- microdata ----------

// Values of every itemprop="name" element after `from` in the page.
function microValues(html, name, from = 0) {
  const out = [];
  const re = new RegExp(`<([a-z0-9]+)\\b([^>]*\\bitemprop=["'][^"']*\\b${name}\\b[^"']*["'][^>]*)>`, "gi");
  re.lastIndex = from;
  for (let m; (m = re.exec(html)); ) {
    const [tag, attrs] = [m[1].toLowerCase(), m[2]];
    const attr = (a) => attrs.match(new RegExp(`\\b${a}=["']([^"']*)["']`, "i"))?.[1];
    if (attr("content") != null) out.push(attr("content"));
    else if (["img", "source"].includes(tag)) out.push(attr("src") || attr("data-src"));
    else if (["link", "a"].includes(tag) && /image/i.test(name)) out.push(attr("href"));
    else if (tag === "time" && attr("datetime")) out.push(attr("datetime"));
    else if (!/\/$/.test(attrs)) out.push(innerHtml(html, tag, re.lastIndex));
  }
  return out.filter((v) => v != null);
}

// The contents of the element whose opening tag ends at `start`.
function innerHtml(html, tag, start) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 1;
  for (let m; (m = re.exec(html)); ) {
    depth += m[1] ? -1 : 1;
    if (!depth) return html.slice(start, m.index);
  }
  return html.slice(start);
}

function microdata(html) {
  const at = html.search(/itemtype=["']https?:\/\/schema\.org\/Recipe["']/i);
  if (at < 0) return null;
  const get = (n) => microValues(html, n, at);
  const steps = get("recipeInstructions");
  const recipe = {
    name: get("name")[0],
    description: get("description")[0],
    image: get("image")[0],
    recipeYield: get("recipeYield")[0],
    prepTime: get("prepTime")[0],
    cookTime: get("cookTime")[0],
    totalTime: get("totalTime")[0],
    recipeCategory: get("recipeCategory"),
    recipeCuisine: get("recipeCuisine"),
    keywords: get("keywords")[0],
    recipeIngredient: [...get("recipeIngredient"), ...get("ingredients")].map(text),
    recipeInstructions: steps.length === 1 ? steps[0] : steps.map(text),
  };
  return { recipe, resolve: (v) => v };
}

// ---------- recipe fields ----------

// "PT1H5M" -> "1 hr 5 min"; anything else is shortened as written.
function duration(v) {
  if (!v) return undefined;
  const s = String(v).trim();
  const m = s.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return shortTime(s) || undefined;
  const mins = Math.round((+(m[1] || 0) * 24 + +(m[2] || 0)) * 60 + +(m[3] || 0) + +(m[4] || 0) / 60);
  if (!mins) return undefined;
  const h = Math.floor(mins / 60);
  return [h && `${h} hr`, mins % 60 && `${mins % 60} min`].filter(Boolean).join(" ");
}

// recipeYield -> { servings, yield } in the site's front-matter form.
function yields(v) {
  const all = list(v).map((y) => text(y)).filter(Boolean);
  // ["24", "24 cookies"]: prefer the one that says what it is
  const y = (all.find((s) => /\d/.test(s) && /[a-z]/i.test(s.replace(/servings?|serves|makes|yield/gi, ""))) || all[0] || "")
    .replace(/^(serves|makes|yields?:?|servings?:?)\s*/i, "")
    .trim();
  if (!y) return {};
  const range = y.match(/^(\d+)\s*(?:to|-|–)\s*\d+\s*(.*)$/);
  const single = y.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  const generic = (label) => !label || /^(servings?|people|persons|portions?)$/i.test(label);
  if (range) {
    const label = range[2].trim();
    return { servings: generic(label) ? Number(range[1]) : `${range[1]} ${label}`, yield: y.replace(/\s*(?:to|-|–)\s*/, "–") };
  }
  if (single) {
    // "6 servings (about 1.5 cups each)" -> servings: 6, yield: as written
    const label = single[2].replace(/\s*\(.*\)\s*/g, " ").trim();
    const servings = generic(label) ? Number(single[1]) : `${single[1]} ${label}`;
    return label === single[2].trim() ? { servings } : { servings, yield: y };
  }
  return { yield: y };
}

const TAG_MAP = {
  "main-course": "dinner", "main-dish": "dinner", "main-dishes": "dinner", entree: "dinner", entrees: "dinner", dinners: "dinner", main: "dinner",
  side: "side-dish", sides: "side-dish", "side-dishes": "side-dish", desserts: "dessert", soups: "soup", salads: "salad",
  breakfasts: "breakfast", snacks: "snack", appetizers: "appetizer", cookie: "cookies", vegetarian: "vegetarian",
};

function suggestTags(r, title) {
  const titleSlug = slugify(title);
  const raw = [r.recipeCategory, r.recipeCuisine, r.keywords].flatMap((v) =>
    list(v).flatMap((s) => (typeof s === "string" ? s.split(/[,;|]/) : []))
  );
  const tags = [];
  for (const t of raw) {
    let tag = slugify(text(t)).replace(/-recipes?$|^recipes?-|^recipes?$/, "");
    tag = TAG_MAP[tag] || tag;
    if (!tag || tag.length > 20 || tag.split("-").length > 2 || tag === titleSlug || /^\d+$/.test(tag)) continue;
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, 5);
}

// Ingredient strings tidied for lib/recipe.js.
function cleanIngredient(s) {
  return text(s)
    .replace(/^[▢□☐•*-]\s*/, "")
    // Budget Bytes-style prices: "($0.22)", "(diced, $0.70)", "$3.48*"
    .replace(/,?\s*\$\d+(?:\.\d+)?\**/g, "")
    .replace(/\(\s*,?\s*\)/g, "")
    .replace(/\(\s*,\s*/g, "(")
    // NYT: "1 cup/120 grams flour" -> "1 cup (120 g) flour"
    .replace(/^([^(/]*?[a-z.])\s*\/\s*(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/i, "$1 ($2 g)")
    .replace(/\s+([,)])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Steps, grouped into sections when the site uses HowToSection.
function instructions(v, resolve) {
  const sections = [];
  let current = { title: null, steps: [] };
  const push = (s) => {
    const t = text(s).replace(/^(step\s*)?\d+[.):]\s+/i, "");
    if (t) current.steps.push(t);
  };
  const splitHtml = (s) => {
    s = String(s);
    const items = [...s.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
    if (items.length) return items;
    return s.split(/<\/p>|<br\s*\/?>|\n+/i);
  };
  (function walk(node) {
    node = resolve(node);
    if (node == null) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "string") return splitHtml(node).forEach(push);
    const t = types(node);
    if (t.includes("HowToSection") || (t.includes("ItemList") && node.name)) {
      if (current.title || current.steps.length) sections.push(current);
      current = { title: text(node.name) || null, steps: [] };
      walk(node.itemListElement);
      sections.push(current);
      current = { title: null, steps: [] };
    } else if (node.itemListElement) walk(node.itemListElement);
    else if (node.text || node.name) splitHtml(node.text || node.name).forEach(push);
  })(v);
  if (current.steps.length) sections.push(current);
  return sections.filter((s) => s.steps.length);
}

// The image URL whose width is closest to 1600px (big enough, not huge).
function imageUrl(v, resolve) {
  const widthIn = (url) => +(url.match(/[/_,-]w_?(\d{3,4})\b|\/(\d{3,4})x\d*\/|(\d{3,4})(?=\.\w+$)/) || []).slice(1).find(Boolean) || 0;
  const cands = list(resolve(v))
    .map(resolve)
    .map((i) => (typeof i === "string" ? { url: i } : i && { url: list(i.url || i.contentUrl)[0], w: +i.width || 0 }))
    .filter((i) => typeof i?.url === "string")
    .map((i) => ({ ...i, w: i.w || widthIn(i.url) }));
  const score = (i) => (i.w ? Math.abs(Math.log(i.w / 1600)) : 1);
  return cands.sort((a, b) => score(a) - score(b))[0]?.url;
}

// ---------- recipe-card HTML (groups and notes) ----------

// Ingredient groups as [{ title, count }], from the recipe card's markup.
function htmlGroups(html) {
  const cards = [
    // WP Recipe Maker (Budget Bytes and many blogs)
    { group: /class="wprm-recipe-ingredient-group"/g, title: /wprm-recipe-group-name[^>]*>([\s\S]*?)<\//, item: /<li class="wprm-recipe-ingredient"/g },
    // Tasty Recipes
    { group: /<h4[^>]*>(?=[\s\S]*?<\/h4>\s*<ul)/g, title: /^([\s\S]*?)<\/h4>/, item: /<li\b/g, scope: /class="tasty-recipes-ingredients[\s\S]*?(?=class="tasty-recipes-instructions)/ },
    // Dotdash Meredith (Serious Eats, AllRecipes, Simply Recipes)
    { group: /<p class="[^"]*structured-ingredients__list-heading[^"]*"[^>]*>|<ul class="[^"]*structured-ingredients__list /g, title: /^([\s\S]*?)<\/p>/, item: /<li class="[^"]*structured-ingredients__list-item/g },
  ];
  for (const c of cards) {
    const scope = c.scope ? html.match(c.scope)?.[0] : html;
    if (!scope) continue;
    const starts = [...scope.matchAll(c.group)].map((m) => m.index + m[0].length);
    if (!starts.length) continue;
    const groups = starts.map((s, i) => {
      const chunk = scope.slice(s, starts[i + 1] ?? scope.length);
      const isUl = /<ul[^>]*$/.test(scope.slice(Math.max(0, s - 200), s));
      return { title: isUl ? null : text(chunk.match(c.title)?.[1]) || null, count: (chunk.match(c.item) || []).length };
    });
    // A heading directly followed by its list counts once.
    const merged = [];
    for (const g of groups) {
      const prev = merged.at(-1);
      if (prev && prev.title && !prev.count && !g.title) prev.count = g.count;
      else merged.push(g);
    }
    const out = merged.filter((g) => g.count);
    if (out.some((g) => g.title)) return out;
  }
  return null;
}

// NYT Cooking keeps groups and tips in its Next.js page data as rich-text docs.
function nytData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  let r;
  try {
    r = JSON.parse(m[1]).props.pageProps.scoopRecipe;
  } catch {
    return null;
  }
  if (!r) return null;
  const textOf = (n) => (n.text ?? "") + (n.content || []).map(textOf).join("");
  const groups = [];
  (function walk(n) {
    if (!n || typeof n !== "object") return;
    if (/^h\d$|heading/.test(n.type)) groups.push({ title: text(textOf(n)), count: 0 });
    else if (n.type === "list_item") {
      if (!groups.length) groups.push({ title: null, count: 0 });
      groups.at(-1).count++;
    } else (n.content || []).forEach(walk);
  })(r.ingredients?.doc);
  const tips = list(r.tips).map((t) => text(textOf(t.details?.doc || {}))).filter(Boolean);
  return { groups: groups.some((g) => g.title) ? groups.filter((g) => g.count) : null, notes: tips.map((t) => `- ${t}`).join("\n") || null };
}

// Notes and similar short sections after the recipe card, as [{ title, md }].
const EXTRA = /^(notes?|recipe notes|tips|special equipment|equipment|make-ahead(?: and storage)?|storage|variations?)$/i;

function htmlNotes(html) {
  const out = [];
  // Dotdash Meredith: "<h2 class="... mntl-sc-block-heading">Notes</h2>" blocks after the steps
  const steps = html.search(/class="[^"]*(?:mm-recipes-steps|structured-project__steps)/);
  if (steps >= 0) {
    const after = html.slice(steps);
    const heads = [...after.matchAll(/<h2\b[^>]*mntl-sc-block-heading[^>]*>([\s\S]*?)<\/h2>/g)];
    heads.forEach((h) => {
      const title = text(h[1]);
      if (!EXTRA.test(title)) return;
      const start = h.index + h[0].length;
      const end = after.indexOf("<h2", start);
      const md = htmlToMd(after.slice(start, end < 0 ? undefined : end));
      if (md) out.push({ title, md });
    });
    if (out.length) return out;
  }
  const md = cardNotes(html);
  return md ? [{ title: "Notes", md }] : [];
}

function cardNotes(html) {
  const patterns = [
    /<div class="wprm-recipe-notes[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/,
    /<div class="tasty-recipes-notes-body"[^>]*>([\s\S]*?)<\/div>/,
    /<div class="tasty-recipes-notes"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const md = htmlToMd(m[1].replace(/<h\d[^>]*>\s*Notes?\s*<\/h\d>/i, ""));
      if (md) return md;
    }
  }
  return null;
}

// "FOR THE CRUST:" -> "For the crust"
function groupTitle(t) {
  t = t.replace(/:\s*$/, "").trim();
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

// ---------- assemble ----------

function meta(html, prop) {
  const m =
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
  return m && decode(m[1]);
}

function build(html, pageUrl) {
  const found = jsonLd(html) || microdata(html);
  if (!found) fail("No schema.org Recipe found on this page (neither JSON-LD nor microdata).");
  const { recipe: r, resolve } = found;

  const title = text(r.name || r.headline || meta(html, "og:title")).replace(/\s+Recipe$/i, "");
  if (!title) fail("The recipe has no name.");
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] || meta(html, "og:url");
  const source = pageUrl || (canonical && decode(canonical));
  let host = "";
  try {
    host = new URL(source).hostname.replace(/^www\./, "");
  } catch {}
  const publisher = resolve(list(r.publisher)[0]);

  const data = { title };
  const tags = suggestTags(r, title);
  if (tags.length) data.tags = tags;
  Object.assign(data, yields(r.recipeYield ?? r.yield));
  for (const k of ["prep", "cook", "total"]) {
    const d = duration(r[`${k}Time`]);
    if (d) data[k] = d;
  }
  if (source) data.source = source;
  const sourceName = meta(html, "og:site_name") || publisher?.name || found.siteName || host;
  if (sourceName) data.source_name = text(sourceName);

  const ingredients = list(r.recipeIngredient || r.ingredients).map(cleanIngredient).filter(Boolean);
  if (!ingredients.length) console.warn("warning: no ingredients found");
  const nyt = nytData(html);
  const groups = nyt?.groups || htmlGroups(html);
  let ingMd = "";
  if (groups && groups.reduce((n, g) => n + g.count, 0) === ingredients.length) {
    let i = 0;
    ingMd = groups
      .map((g) => (g.title ? `### ${groupTitle(g.title)}\n\n` : "") + ingredients.slice(i, (i += g.count)).map((l) => `- ${l}`).join("\n"))
      .join("\n\n");
  } else ingMd = ingredients.map((l) => `- ${l}`).join("\n");

  const steps = instructions(r.recipeInstructions, resolve);
  if (!steps.length) console.warn("warning: no instructions found");
  const stepsMd = steps
    .map((s) => (s.title && steps.length > 1 ? `### ${groupTitle(s.title)}\n\n` : "") + s.steps.map((t, i) => `${i + 1}. ${t}`).join("\n"))
    .join("\n\n");

  let intro = text(r.description);
  const author = text(resolve(list(r.author)[0])?.name);
  if (author && intro.endsWith(` ${author}`)) intro = intro.slice(0, -author.length).trim();

  let body = "";
  if (intro) body += `${intro}\n\n`;
  body += `## Ingredients\n\n${ingMd}\n\n## Instructions\n\n${stepsMd}\n`;
  const extras = nyt?.notes ? [{ title: "Notes", md: nyt.notes }] : htmlNotes(html);
  // Notes first; "Special Equipment" etc. become their own sections.
  extras.sort((a, b) => /^notes?$/i.test(b.title) - /^notes?$/i.test(a.title));
  for (const { title, md } of extras) body += `\n## ${/^(notes?|recipe notes)$/i.test(title) ? "Notes" : title}\n\n${md}\n`;

  return { data, body, image: imageUrl(r.image, resolve) || meta(html, "og:image") };
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

async function downloadImage(url, slug) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "image/webp,image/*,*/*;q=0.8" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  const ext = EXT[type] || path.extname(new URL(url).pathname).slice(1).toLowerCase().replace("jpeg", "jpg");
  if (!/^(jpg|png|webp|gif|avif)$/.test(ext)) throw new Error(`not an image (${type || "unknown type"})`);
  const rel = `images/${slug}.${ext}`;
  fs.mkdirSync(path.join(outDir, "images"), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(outDir, rel), buf);
  if (buf.length > 800_000) console.warn(`note: the photo is ${(buf.length / 1e6).toFixed(1)} MB; consider shrinking recipes/${rel}`);
  return rel;
}

const { html, url } = await load(inputs[0]);
const { data, body, image } = build(html, url);
const slug = slugify(data.title);
const out = path.join(outDir, `${slug}.md`);
const rel = path.relative(process.cwd(), out);

if (opts.dryRun) {
  if (image) data.image = image;
  process.stdout.write(matter.stringify(body, data));
  process.exit(0);
}
if (fs.existsSync(out) && !opts.force) fail(`exists ${rel} (use --force to overwrite)`);
if (image && opts.image) {
  try {
    data.image = await downloadImage(new URL(image, url || undefined).href, slug);
  } catch (e) {
    console.warn(`warning: couldn't download the photo (${e.message}); linking to it instead`);
    data.image = image;
  }
}
fs.writeFileSync(out, matter.stringify(body, data));
console.log(`wrote  ${rel}${data.image && !/^https?:/.test(data.image) ? ` + recipes/${data.image}` : ""}`);
