# Recipes

A static recipe site built with [Eleventy](https://www.11ty.dev/) and published to GitHub Pages. Add or edit a markdown file in `recipes/`, push to `main`, and the site rebuilds automatically.

## Recipe format

One file per recipe in `recipes/`, named like `weeknight-chickpea-curry.md` (the file name becomes the URL).

```markdown
---
title: Weeknight Chickpea Curry
tags: [dinner, vegetarian, quick]
servings: 4                # or "24 cookies", "2 loaves"; needed for the scaler
prep: 10 min
cook: 25 min
total: 35 min
source: https://example.com/curry   # optional
source_name: Grandma              # optional; shown instead of the link's domain
image: images/chickpea-curry.jpg  # optional; file goes in recipes/images/ (or a full URL)
rating: 4                         # optional, 1–5
log:                              # optional "made it" log
  - date: 2026-10-03
    note: Added extra spinach.
---

Optional short intro paragraph.

## Ingredients

### For the sauce          <- optional group headings
- 2 tbsp olive oil
- 2 1/4 cups (280 g) all-purpose flour
- 2 (15 oz) cans chickpeas, drained
- salt, to taste

## Instructions

1. First step.
2. Second step.

## Notes

Anything else. Other `##` sections (e.g. `## Variations`) are shown with the notes.
```

### Ingredient lines

Each ingredient is a `- ` list item that starts with an amount, then a unit, then the ingredient name:

- Amounts: `2`, `1/2`, `1 1/2`, `½`, `1½`, `0.5`, ranges like `2-3` or `2 to 3`.
- Amounts like `1-1/2` (US recipe style) mean 1½, not a range.
- Units: cup, tbsp/tablespoon, tsp/teaspoon, fl oz, pint, quart, ml, l, g, kg, oz, lb, stick, plus count words like clove, can, pinch, bunch.
- Grams from the recipe go in parentheses: `1 cup (120 g) flour` or `1 cup (about 120 g / 4 oz) flour`. These are shown as written.
- Weights in ounces/pounds are converted to grams and marked **≈**: the unit itself (`8 ounces spinach`), a parenthetical (`1 cup (8 ounces) sour cream`), or a package size (`2 (15 oz) cans`, `2 cans (15-1/2 ounces each)`).
- If a line has no grams, the site estimates them for common ingredients from a density table (`lib/units.js`). Estimates are shown in italics with **≈**.
- Lines without an amount (`salt, to taste`) are shown as-is and are not scaled.

Section names that are recognised: `Ingredients`; `Instructions` / `Directions` / `Method` / `Steps`; `Notes`.

## Importing my old markdown notes

Recipes in my older notes format (`# Title`, `**Source:**` / `**Yield:**` / `**Tags:** #a #b` lines, `- [ ]` ingredients, `## Directions`) can be converted automatically:

```bash
node scripts/import-md.js _import/*.md
```

This writes `recipes/<slug>.md` and won't overwrite existing files unless you add `--force`. `_import/` is git-ignored. A yield range like `6 to 8 servings` becomes `servings: 6` (for the scaler) plus `yield: 6–8 servings` (shown on the page).

## Running locally

Requires Node 18+.

```bash
npm install
```

```bash
npm start
```

Then open http://localhost:8080.

## Publishing

In the GitHub repo's **Settings → Pages**, set **Source** to **GitHub Actions**. Every push to `main` then builds and deploys via `.github/workflows/deploy.yml`.
