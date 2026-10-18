# Recipe site — project notes

Requirements gathered 2026-10-17. v1 site built 2026-10-17 (Eleventy); not yet on GitHub. Recipe format: see README.md.

## Goal

A free, lightweight static site hosted on GitHub Pages that shows all my recipes, with search, and a recipe view that works well on phone and desktop **while cooking** (as little scrolling as possible).

## Content

- One markdown file per recipe, all with the same structure.
- Recipes will come from: **my existing markdown files** (to be converted to the standard format) and **websites/blogs**. A converter/import tool comes later (not now).
- Fields per recipe:
  - title, tags, photo (optional)
  - servings (needed for the scaler), prep / cook / total time
  - source (URL, or cookbook/person credit)
  - ingredients, which can be grouped into sections ("For the sauce")
  - instructions, which can also be grouped into sections
  - notes
  - rating, plus a "made it" log (dates and tweaks)
- Units: mostly US volume (cups/tbsp).

## Browse / home page

- Toggle between a **photo card grid** and a **compact list** (remember the choice per device).
- Search over **title, tags and ingredients** (not full text of instructions).
- Clickable **tag filter chips**.

## Recipe page (cooking view)

- **Side-by-side layout** on wide screens (ingredients | steps); stacked on phones.
- **Keep screen awake** (Wake Lock API) while a recipe is open.
- **Serving scaler** (e.g. ½×, 1×, 2×, or a custom serving count).
- **Show grams** next to volume amounts:
  - if the recipe itself gives grams, show them as-is (marked as from the recipe)
  - otherwise compute from an ingredient density table and mark as estimated (e.g. "≈ 120 g", tooltip "calculated")
  - grams scale with the serving scaler
- Not requested for v1: tapping to check off ingredients/steps (easy to add later).

## Look

Clean and minimal: lots of whitespace, neutral colors, large readable type. Light and dark mode.

## Audience and privacy

- Users: me + my household, all on Apple devices.
- **Unlisted** is enough: public site but not advertised. Every page has a `noindex, nofollow` meta tag. (A `robots.txt` would do nothing here: on a `username.github.io/recipes/` project site it isn't at the domain root, so crawlers never read it.)
  - Caveat: the GitHub repo itself is public, so the markdown is viewable on github.com. If that becomes a problem, move to Cloudflare Pages or Netlify (free, private repo, same static site).

## Future features (not now)

- ~~**"Add ingredients to Apple Reminders" button**~~ Done 2026-10-18: checklist dialog (pantry items remembered per device, list name chosen per send), hands JSON `{list, items}` to the "Recipe to Reminders" Shortcut via `shortcuts://x-callback-url/run-shortcut`. Shortcut setup steps in README.
- **Meal planning** for the household. This needs shared state that syncs, which a static site doesn't have on its own. Options when we get there: (a) the plan lives in a markdown/JSON file in the repo, edited via commits; (b) a free hosted backend (e.g. Supabase or Firebase free tier); (c) keep the plan in a shared Reminders list or Apple Notes through Shortcuts.
- ~~**URL import tool**~~ Done 2026-10-17: `scripts/import-url.js` (usage in README). Reads schema.org Recipe JSON-LD (microdata fallback), plus ingredient groups and notes from WP Recipe Maker / Tasty Recipes / Dotdash Meredith recipe cards and NYT Cooking page data. Tested on Budget Bytes, King Arthur, NYT Cooking, Bon Appétit and Serious Eats. Serious Eats / AllRecipes (Dotdash Meredith) block non-browser requests, so for those, save the page from the browser and import the file.
- ~~**Convert existing markdown**~~ Done 2026-10-17: 5 recipes converted with `scripts/import-md.js`. Originals live in iCloud (`~/Library/Mobile Documents/com~apple~CloudDocs/Recipes/Recipes`). macOS blocks Claude from reading iCloud Drive, so new ones need to be copied into `_import/` first.
- ~~**Status from the website in one tap**~~ Done 2026-10-18: status menu on recipe pages commits via the GitHub API with a fine-grained token stored per browser (setup at the bottom of the home page; see README).
- Check-off for ingredients/steps; photo resizing at build time (`@11ty/eleventy-img`); fuzzy search (Fuse.js) if plain substring search gets limiting.

## How it's built (v1)

- **Eleventy 3** generates the site from markdown; `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`. The workflow sets the `/<repo-name>/` path prefix automatically.
- Repo name: `recipes` → site at `https://<username>.github.io/recipes/`, recipes at `.../recipes/<file-name>/`.
- `lib/recipe.js` splits each recipe into sections and parses ingredient lines (amount, unit, recipe-given grams). `lib/units.js` has the units and the density table used for estimated grams. Ounce/pound weights (unit, parenthetical or can size) are converted to grams; `1-1/2` is read as a mixed number; modifiers like "heaping" are kept with the unit. If a line says "X or Y", the estimate uses X.
- Grams: recipe-given weights are shown exactly; calculated ones are shown in italics with `≈`, and a legend appears only when a recipe has calculated weights. There's a Grams on/off switch, remembered per device.
- Scaler: −/+ steps one serving (half steps if a recipe has no servings), with ½×/1×/2×/3× shortcuts. Amounts are re-rendered as kitchen fractions.
- Phones (<860 px): sticky Ingredients / Steps / Notes tabs instead of one long page. Wider screens: sticky ingredient column beside the steps.
- Search: plain substring match over title, tags and ingredient names, with all search words required. Tag chips combine with AND; `/?tag=x` links preselect a tag.
- No framework; two small ES-module scripts in `assets/js/`.

## Next steps

1. Create the GitHub repo `recipes`, push, and set Settings → Pages → Source to "GitHub Actions".
2. ~~Build the URL import tool.~~ Done.
