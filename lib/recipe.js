// Splits a recipe's markdown body into sections and parses ingredient lines
// into quantity / unit / grams so the page can scale them.
import fs from "node:fs";
import matter from "gray-matter";
import markdownIt from "markdown-it";
import { findUnit, estimateGrams } from "./units.js";
import { formatGrams } from "../assets/js/format.js";

const md = markdownIt({ html: true, linkify: true, typographer: true });
const cache = new Map();

export function parseRecipe(inputPath) {
  const mtime = fs.statSync(inputPath).mtimeMs;
  const hit = cache.get(inputPath);
  if (hit?.mtime === mtime) return hit.recipe;

  const { content } = matter(fs.readFileSync(inputPath, "utf8"));
  const recipe = { intro: "", ingredients: [], steps: [], notes: "", extra: [] };
  for (const { title, lines } of splitSections(content)) {
    const body = lines.join("\n");
    const kind = sectionKind(title);
    if (kind === "intro") recipe.intro = md.render(body);
    else if (kind === "ingredients") recipe.ingredients.push(...parseIngredients(lines));
    else if (kind === "instructions") recipe.steps.push(...parseSteps(lines));
    else if (kind === "notes") recipe.notes += md.render(body);
    else recipe.extra.push({ title, html: md.render(body) });
  }
  recipe.ingredientNames = recipe.ingredients.flatMap((g) => g.items.map((i) => i.name));
  recipe.variants = markVariants(recipe);
  cache.set(inputPath, { mtime, recipe });
  return recipe;
}

function splitSections(body) {
  const sections = [];
  let current = { title: null, lines: [] };
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (m) {
      sections.push(current);
      current = { title: m[1], lines: [] };
    } else current.lines.push(line);
  }
  sections.push(current);
  return sections.filter((s) => s.title || s.lines.join("").trim());
}

function sectionKind(title) {
  if (!title) return "intro";
  const t = title.toLowerCase();
  if (/^ingredients?\b/.test(t)) return "ingredients";
  if (/^(instructions|directions|method|steps|preparation)\b/.test(t)) return "instructions";
  if (/^notes?\b/.test(t)) return "notes";
  return "other";
}

// "Instant Pot Method", "For your Slow Cooker", "Crockpot" -> a cooking method.
const METHODS = [
  { key: "instant-pot", label: "Instant Pot", re: /\b(instant ?pot|pressure cooker|ip)\b/i },
  { key: "slow-cooker", label: "Slow cooker", re: /\b(slow ?cooker|crock ?-?pot)\b/i },
  { key: "stovetop", label: "Stovetop", re: /\b(stove ?-?top|on the stove)\b/i },
  { key: "oven", label: "Oven", re: /\boven\b/i },
  { key: "air-fryer", label: "Air fryer", re: /\bair ?fryer\b/i },
];
export const methodOf = (title) => (title && title.length <= 40 && METHODS.find((m) => m.re.test(title))) || null;

// Steps split at "### " headings: [{ title, html }].
function parseSteps(lines) {
  const blocks = [];
  let block = { title: null, lines: [] };
  for (const line of lines) {
    const heading = line.trim().match(/^#{3,}\s+(.+?)\s*#*$/);
    if (heading) {
      if (block.title || block.lines.join("").trim()) blocks.push(block);
      block = { title: heading[1], lines: [] };
    } else block.lines.push(line);
  }
  if (block.title || block.lines.join("").trim()) blocks.push(block);
  return blocks.map((b) => ({ title: b.title, html: md.render(b.lines.join("\n")) }));
}

// Recipes with e.g. both "### Instant Pot" and "### Slow cooker" steps get a
// toggle: each such block (and matching ingredient groups) is tagged with its
// method. A lone method heading ("Slow Cooker Method" over the only ingredient
// list) is just dropped.
function markVariants(recipe) {
  const distinct = (list) => new Set(list.map((x) => methodOf(x.title)?.key).filter(Boolean));
  const stepMethods = distinct(recipe.steps);
  const ingMethods = distinct(recipe.ingredients);
  if (stepMethods.size < 2) return [];
  // In the order the recipe gives them
  const variants = [...stepMethods].map((key) => METHODS.find((m) => m.key === key));
  for (const block of recipe.steps) block.variant = methodOf(block.title)?.key || null;
  for (const g of recipe.ingredients) {
    const m = methodOf(g.title);
    if (!m) continue;
    if (ingMethods.size >= 2) g.variant = m.key;
    else g.title = null;
  }
  return variants.map(({ key, label }) => ({ key, label }));
}

function parseIngredients(lines) {
  const groups = [];
  let group = { title: null, items: [] };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^#{3,}\s+(.+?)\s*#*$/);
    const item = line.match(/^[-*+]\s+(.+)$/);
    if (heading) {
      if (group.title || group.items.length) groups.push(group);
      group = { title: heading[1], items: [] };
    } else if (item) group.items.push(parseIngredient(item[1]));
  }
  if (group.title || group.items.length) groups.push(group);
  return groups;
}

const GLYPHS = { "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8 };
const G = Object.keys(GLYPHS).join("");
// "1-1/2" (US recipe style) is a mixed number, not a range, so it is tried first.
const NUM = `(?:\\d+[\\s-]+\\d+/\\d+|\\d+/\\d+|\\d+\\s*[${G}]|\\d*\\.\\d+|\\d+|[${G}])`;
const LEAD = new RegExp(`^(${NUM})(?:\\s*(?:-|–|to)\\s*(${NUM}))?(?=[\\s(a-zA-Z]|$)\\s*`);
const GRAMS = /(\d+(?:\.\d+)?)\s*(kg|g|grams?)\b/i;
const WEIGHT = new RegExp(`(${NUM})[\\s-]*(oz|ounces?|lbs?|pounds?|kg|g|grams?)\\b\\.?(\\s+each)?`, "i");
const MODIFIER = /^(heaping|heaped|level|scant|generous|rounded|large|medium|small)\s+/i;

function parseNumber(s) {
  s = s.trim();
  const glyph = s.match(new RegExp(`^(\\d*)\\s*([${G}])$`));
  if (glyph) return Number(glyph[1] || 0) + GLYPHS[glyph[2]];
  const mixed = s.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + mixed[2] / mixed[3];
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return frac[1] / frac[2];
  return Number(s);
}

const toGrams = (m) => Number(m[1]) * (m[2].toLowerCase() === "kg" ? 1000 : 1);
const GRAMS_PER = { o: 28.35, l: 453.59, p: 453.59, k: 1000, g: 1 };
// "15-1/2 ounces each" -> { g: 439.4, each: true }
function weightIn(text) {
  const m = text.match(WEIGHT);
  return m && { g: parseNumber(m[1]) * GRAMS_PER[m[2][0].toLowerCase()], each: Boolean(m[3]) };
}

function matchUnit(rest) {
  const u =
    rest.match(/^(fl\.?\s*oz\.?|fluid ounces?)(?=[\s,)]|$)\s*/i) ||
    rest.match(/^([A-Za-z]+)\.?(?=[\s,)]|$)\s*/);
  const unit = u && findUnit(u[1]);
  return unit ? { unit, word: u[1], length: u[0].length } : null;
}

// "2 ¼ cups (280 g) all-purpose flour, sifted"
export function parseIngredient(text) {
  const item = { qty: null, qty2: null, mid: "", unitSing: "", unitPlur: "", metric: false, grams: null, gsrc: null };
  let rest = text;

  const lead = rest.match(LEAD);
  if (lead) {
    item.qty = parseNumber(lead[1]);
    if (lead[2]) item.qty2 = parseNumber(lead[2]);
    rest = rest.slice(lead[0].length);

    const mid = rest.match(/^\(([^)]*)\)\s*/); // "2 (15 oz) cans"
    if (mid) {
      item.mid = `(${mid[1]})`;
      rest = rest.slice(mid[0].length);
    }
    // "2 heaping tablespoons", "1 large handful": keep the word only if a unit follows
    const mod = rest.match(MODIFIER);
    let u = matchUnit(rest);
    if (!u && mod && (u = matchUnit(rest.slice(mod[0].length)))) {
      item.mid = [item.mid, mod[1]].filter(Boolean).join(" ");
      rest = rest.slice(mod[0].length);
    }
    if (u) {
      item.unit = u.unit;
      const abbr = !u.unit.words.includes(u.word.toLowerCase());
      item.unitSing = abbr ? u.word : u.unit.words[0];
      item.unitPlur = abbr ? u.word : u.unit.words[1] || u.unit.words[0];
      item.metric = Boolean(u.unit.metric);
      rest = rest.slice(u.length);
    }
    item.amount = text.slice(0, text.length - rest.length).trim();
    rest = rest.replace(/^of\s+/i, "");
  }

  // Grams the recipe itself gives: "(280 g)", "(2 cups / 280 g)", "/ 280 g".
  // Other weights in parentheses ("(8 ounces)", "(15-1/2 ounces each)") are kept
  // in the text and converted below.
  let recipeGrams = null;
  let parenWeight = null;
  rest = rest
    .replace(/^\/\s*(\d+(?:\.\d+)?)\s*(kg|g|grams?)\b\s*/i, (...m) => {
      recipeGrams = toGrams(m);
      return "";
    })
    .replace(/\s*\(([^)]*)\)/g, (whole, inner) => {
      const m = recipeGrams == null && inner.match(GRAMS);
      if (!m) {
        parenWeight ??= weightIn(inner);
        return whole;
      }
      recipeGrams = toGrams(m);
      const left = inner.replace(m[0], "").replace(/^[\s/,;]+|[\s/,;]+$/g, "");
      return left ? ` (${left})` : "";
    })
    .trim();

  item.html = md.renderInline(rest);
  item.name = rest.replace(/\([^)]*\)/g, "").replace(/[*_`[\]]/g, "").split(",")[0].trim();

  if (recipeGrams != null) {
    item.grams = recipeGrams;
    item.gsrc = "recipe";
  } else if (item.qty != null && item.qty2 == null && !(item.unit?.g && item.metric)) {
    const size = weightIn(item.mid); // "2 (15 oz) cans"
    const isCount = item.unit && !item.unit.g && !item.unit.ml;
    let g = null;
    if (item.unit?.g) g = item.qty * item.unit.g;
    else if (size) g = item.qty * size.g;
    else if (parenWeight) g = parenWeight.each || isCount ? item.qty * parenWeight.g : parenWeight.g;
    if (g) item.gsrc = "converted";
    else if ((g = estimateGrams(item.qty, item.unit, item.name))) item.gsrc = "est";
    item.grams = g || null;
  }
  if (item.grams != null)
    item.gramsText = item.gsrc === "recipe" ? formatGrams(item.grams, true) : `≈${formatGrams(item.grams)}`;
  delete item.unit;
  return item;
}
