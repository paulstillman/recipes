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
status: regularly                 # optional: not tried, rarely, regularly or staple
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

### Status

`status` is one of `not tried`, `rarely`, `regularly` or `staple` (or left out: "Status not set"). It's shown on the recipe page and the home page cards, and the home page can filter by it.

**Changing it from the website:** each recipe page has a status menu that saves straight to the recipe's markdown file (a commit on `main`); the site rebuilds a minute or two later, and in the meantime that browser already shows the new status. Each device needs a one-time setup, under **Editing from this device** at the bottom of the home page:

1. On GitHub: Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Repository access: **Only select repositories** → `recipes`. Permissions: **Contents: Read and write** (nothing else). Choose an expiry.
3. Paste the token into the box and press Save. It's checked against GitHub and kept only in that browser (localStorage), never in the repo. **Remove** deletes it from the device; revoking it on GitHub disables it everywhere.

Anyone with that browser can change statuses, so only set it up on your own devices. Because these saves are commits, **fetch/pull in GitHub Desktop before pushing** from your computer. The **Edit on GitHub** link next to the menu works without any setup.

### Instant Pot / slow cooker versions

If the instructions have two or more `###` sections named after a cooking method (Instant Pot or pressure cooker, slow cooker or crockpot, stovetop, oven, air fryer), the page shows a toggle between them, remembered per device:

```markdown
## Instructions

### Slow cooker

1. ...

### Instant Pot

1. ...
```

Ingredient groups named after a method switch along with the steps. If the ingredients are the same for both, use one list.

Section names that are recognised: `Ingredients`; `Instructions` / `Directions` / `Method` / `Steps`; `Notes`.

## Importing my old markdown notes

Recipes in my older notes format (`# Title`, `**Source:**` / `**Yield:**` / `**Tags:** #a #b` lines, `- [ ]` ingredients, `## Directions`) can be converted automatically:

```bash
node scripts/import-md.js _import/*.md
```

This writes `recipes/<slug>.md` and won't overwrite existing files unless you add `--force`. `_import/` is git-ignored. A yield range like `6 to 8 servings` becomes `servings: 6` (for the scaler) plus `yield: 6–8 servings` (shown on the page).

## Importing from a recipe website

```bash
node scripts/import-url.js https://www.budgetbytes.com/chicken-and-dumplings/
```

This writes `recipes/<slug>.md` and downloads the photo to `recipes/images/<slug>.<ext>`. Check the result before publishing.

Suggested tags come from the site's categories and keywords, mapped onto a fixed list (meal, diet, main protein, cuisine, cooking method; see `scripts/helpers.js`), so one-off tags like `mains` or `colombian-cuisine` don't clutter the home page.

What it picks up: title, intro (the site's description), servings/yield, prep/cook/total times, ingredients (with the site's group headings, e.g. "For the crust", and any grams it gives), numbered steps (in sections if the site has them), notes, source link and site name. It reads the schema.org Recipe data most recipe sites embed (JSON-LD, or microdata as a fallback). Price tags like Budget Bytes' `($0.22)` are removed, and NYT-style `1 cup/120 grams` becomes `1 cup (120 g)`.

Several URLs can be given at once. Options:

- `--tag <tag>`: add a tag (repeatable), e.g. `--tag instant-pot`.
- `--status <status>`: set the status, e.g. `--status "not tried"`.
- `--force`: overwrite an existing recipe file.
- `--no-image`: don't download the photo.
- `--dry-run`: print the result without writing anything.

Some sites (Serious Eats, AllRecipes and other Dotdash Meredith sites) only serve recipes to a real browser. The tool says so when this happens. Open the page in your browser, save it with **File → Save Page As…**, then import the saved file:

```bash
node scripts/import-url.js ~/Downloads/the-food-lab-chocolate-chip-cookies.html
```

The source link is taken from the saved page. If it's missing, add `--source <url>`.

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
