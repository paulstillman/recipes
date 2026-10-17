// Shared by the build (lib/recipe.js) and the browser (recipe.js).

const FRACTIONS = [
  [0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"],
  [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"], [1, ""],
];

export function formatQty(q, metric = false) {
  if (metric) {
    if (q >= 100) return String(Math.round(q / 5) * 5);
    if (q >= 10) return String(Math.round(q));
    return String(Math.round(q * 10) / 10);
  }
  if (q >= 20) return String(Math.round(q));
  let whole = Math.floor(q);
  const rest = q - whole;
  let [value, glyph] = FRACTIONS.reduce((best, f) =>
    Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best
  );
  if (value === 1) whole += 1;
  if (!whole && !glyph) return q > 0 ? "⅛" : "0";
  return `${whole || ""}${glyph}`;
}

// `exact` keeps weights the recipe itself gives at 1 g precision.
export function formatGrams(g, exact = false) {
  if (g < 10) return `${Math.round(g * 2) / 2} g`;
  if (g < 100 || exact) return `${Math.round(g)} g`;
  if (g < 1000) return `${Math.round(g / 5) * 5} g`;
  return `${Math.round(g / 10) * 10} g`;
}
