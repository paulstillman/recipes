// Units recognised at the start of an ingredient line, after the quantity.
// `words` are the spelled-out forms; any other alias is an abbreviation and is
// displayed exactly as written.
const UNITS = [
  { key: "cup", words: ["cup", "cups"], aliases: ["c"], ml: 236.59 },
  { key: "tbsp", words: ["tablespoon", "tablespoons"], aliases: ["tbsp", "tbsps", "tbs", "tbl", "T"], ml: 14.787 },
  { key: "tsp", words: ["teaspoon", "teaspoons"], aliases: ["tsp", "tsps", "t"], ml: 4.929 },
  { key: "floz", words: ["fluid ounce", "fluid ounces"], aliases: ["fl oz", "fl. oz", "fl. oz.", "fl oz."], ml: 29.574 },
  { key: "pint", words: ["pint", "pints"], aliases: ["pt"], ml: 473.18 },
  { key: "quart", words: ["quart", "quarts"], aliases: ["qt"], ml: 946.35 },
  { key: "ml", words: ["milliliter", "milliliters", "millilitre", "millilitres"], aliases: ["ml", "mL"], ml: 1, metric: true },
  { key: "l", words: ["liter", "liters", "litre", "litres"], aliases: ["l", "L"], ml: 1000, metric: true },
  { key: "g", words: ["gram", "grams"], aliases: ["g", "gr"], g: 1, metric: true },
  { key: "kg", words: ["kilogram", "kilograms"], aliases: ["kg"], g: 1000, metric: true },
  { key: "oz", words: ["ounce", "ounces"], aliases: ["oz"], g: 28.35 },
  { key: "lb", words: ["pound", "pounds"], aliases: ["lb", "lbs"], g: 453.59 },
  { key: "stick", words: ["stick", "sticks"], aliases: [] },
  ...[
    ["pinch", "pinches"], ["dash", "dashes"], ["clove", "cloves"], ["can", "cans"],
    ["jar", "jars"], ["package", "packages"], ["bunch", "bunches"], ["sprig", "sprigs"],
    ["slice", "slices"], ["handful", "handfuls"], ["head", "heads"], ["stalk", "stalks"],
    ["piece", "pieces"], ["sheet", "sheets"], ["bag", "bags"], ["box", "boxes"],
  ].map((words) => ({ key: words[0], words, aliases: words[0] === "package" ? ["pkg"] : [] })),
];

const exact = new Map();
const loose = new Map();
for (const u of UNITS) {
  for (const a of [...u.words, ...u.aliases]) {
    exact.set(a, u);
    if (a !== "T") loose.set(a.toLowerCase(), u);
  }
}

export function findUnit(word) {
  const w = word.replace(/\s+/g, " ");
  return exact.get(w) || loose.get(w.toLowerCase()) || null;
}

// Grams per US cup. The longest matching keyword wins; null means "known to be
// too variable to estimate" (e.g. kosher salt brands differ by ~2x).
const PER_CUP = {
  "all-purpose flour": 125, "all purpose flour": 125, "ap flour": 125, "bread flour": 127,
  "cake flour": 114, "pastry flour": 106, "whole wheat flour": 120, "whole-wheat flour": 120,
  "almond flour": 96, "rye flour": 102, "flour": 125,
  "granulated sugar": 200, "brown sugar": 213, "powdered sugar": 120, "confectioners sugar": 120,
  "confectioners' sugar": 120, "icing sugar": 120, "sugar": 200, "sugar snap": null,
  "honey": 340, "maple syrup": 320, "molasses": 337, "corn syrup": 328,
  "peanut butter": 258, "almond butter": 250, "buttermilk": 242, "butter": 227,
  "olive oil": 216, "vegetable oil": 218, "canola oil": 218, "coconut oil": 218, "oil": 218,
  "heavy cream": 238, "whipping cream": 238, "sour cream": 242, "cream cheese": 232,
  "greek yogurt": 255, "yogurt": 245, "coconut milk": 226, "milk": 242,
  "water": 236, "water chestnut": null, "broth": 240, "stock": 240,
  "lemon juice": 242, "lime juice": 242, "vinegar": 238, "soy sauce": 255, "mayonnaise": 220,
  "cocoa powder": 85, "cocoa": 85, "cornstarch": 128, "corn starch": 128,
  "baking soda": 288, "baking powder": 192, "table salt": 288, "fine salt": 288, "salt": 288,
  "kosher salt": null, "flaky salt": null, "sea salt": null,
  "instant yeast": 149, "active dry yeast": 149, "yeast": 149, "vanilla extract": 202, "vanilla": 202,
  "chocolate chips": 170, "chocolate chip": 170, "milk chocolate": null, "rolled oats": 90, "oats": 90,
  "rice": 195, "quinoa": 170, "lentils": 192, "cornmeal": 138, "panko": 50, "breadcrumbs": 112,
  "walnuts": 120, "pecans": 113, "almonds": 143, "peanuts": 146, "raisins": 149,
  "shredded coconut": 85, "grated parmesan": 100, "parmesan": 100, "shredded cheese": 113,
};

// Grams per item when there is no unit ("2 large eggs").
const PER_EACH = { "egg yolk": 18, "egg white": 30, "egg": 50 };

function lookup(table, name) {
  let best = null;
  for (const [key, value] of Object.entries(table)) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\']/g, "\\$&")}(s|es)?\\b`, "i");
    if (re.test(name) && (!best || key.length > best[0].length)) best = [key, value];
  }
  return best ? best[1] : null;
}

// Estimated grams for a quantity of `unit` of the ingredient `name`, or null.
export function estimateGrams(qty, unit, fullName) {
  // "honey or granulated sugar" -> estimate for honey; fall back to the whole name
  // so "chicken or vegetable stock" still matches stock.
  const first = fullName.split(/\s+or\s+/i)[0];
  const name = lookup(PER_CUP, first) || lookup(PER_EACH, first) ? first : fullName;
  if (!unit) {
    const each = lookup(PER_EACH, name);
    return each ? qty * each : null;
  }
  if (unit.key === "stick") return /\bbutter\b/i.test(name) ? qty * 113 : null;
  if (!unit.ml) return null;
  const perCup = lookup(PER_CUP, name);
  return perCup ? (qty * unit.ml * perCup) / 236.59 : null;
}
