// Small helpers shared by the import scripts.

export const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const shortTime = (s) =>
  s.replace(/\bhours?\b|\bhrs\b/gi, "hr").replace(/\bminutes?\b|\bmins\b/gi, "min").replace(/\s+/g, " ").trim();

// Tags suggested by recipe sites, mapped onto the site's own short vocabulary.
// Anything not in TAGS (ingredients, "american", the recipe's own name...) is dropped.
const TAG_MAP = {
  "main-course": "dinner", "main-dish": "dinner", "main-dishes": "dinner", mains: "dinner", main: "dinner",
  "main-meal": "dinner", "lunch-dinner": "dinner", entree: "dinner", entrees: "dinner", dinners: "dinner",
  "poultry-dish": "dinner", "quick-dinners": "quick", "quick-and-easy": "quick", easy: "quick",
  side: "side-dish", sides: "side-dish", "side-dishes": "side-dish", desserts: "dessert", soups: "soup",
  "soups-and-stews": "soup", salads: "salad", breakfasts: "breakfast", brunch: "breakfast",
  "breakfast-and-brunch": "breakfast", snacks: "snack", appetizers: "appetizer", cookie: "cookies",
  "pasta-dish": "pasta", "baked-pasta": "pasta", "italian-american": "italian", "colombian-cuisine": "latin-american",
  colombia: "latin-american", "crock-pot": "slow-cooker", crockpot: "slow-cooker", "pressure-cooker": "instant-pot",
  whole30: "paleo",
};
const TAGS = new Set([
  "dinner", "lunch", "breakfast", "side-dish", "salad", "soup", "stew", "chili", "pasta", "curry", "bowls",
  "dessert", "cookies", "baking", "appetizer", "snack", "quick", "one-pot", "one-pan",
  "vegan", "vegetarian", "gluten-free", "dairy-free", "paleo",
  "chicken", "beef", "pork", "turkey", "fish", "seafood", "eggs", "beans", "lentils",
  "italian", "mexican", "indian", "thai", "chinese", "japanese", "korean", "mediterranean", "greek",
  "middle-eastern", "french", "cajun", "cuban", "hungarian", "latin-american",
  "instant-pot", "slow-cooker", "stovetop", "oven", "cast-iron", "grill", "air-fryer",
]);

export function normalizeTags(raw, limit = 6) {
  const out = [];
  for (const t of raw) {
    let tag = slugify(String(t)).replace(/-recipes?$|^recipes?-|^recipes?$/, "");
    tag = TAG_MAP[tag] || tag;
    if (TAGS.has(tag) && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, limit);
}
