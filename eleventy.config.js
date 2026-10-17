import { HtmlBasePlugin } from "@11ty/eleventy";
import { parseRecipe } from "./lib/recipe.js";

const tagList = (tags) =>
  (Array.isArray(tags) ? tags : String(tags || "").split(","))
    .map((t) => String(t).trim())
    .filter(Boolean);

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("recipes/images");
  eleventyConfig.addWatchTarget("lib/");
  ["PROJECT.md", "README.md"].forEach((f) => eleventyConfig.ignores.add(f));

  eleventyConfig.addCollection("recipes", (api) =>
    api
      .getFilteredByGlob("recipes/*.md")
      .sort((a, b) => a.data.title.localeCompare(b.data.title))
  );

  eleventyConfig.addFilter("recipe", parseRecipe);
  eleventyConfig.addFilter("tagList", tagList);
  eleventyConfig.addFilter("allTags", (recipes) =>
    [...new Set(recipes.flatMap((r) => tagList(r.data.tags)))].sort()
  );

  // "4", 4 or "24 cookies" -> { n: 24, label: "cookies" }
  eleventyConfig.addFilter("servings", (s) => {
    const m = String(s ?? "").match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
    return m ? { n: Number(m[1]), label: m[2].trim() || "servings" } : null;
  });

  eleventyConfig.addFilter("imgUrl", (src) =>
    /^https?:\/\//.test(src) ? src : `/recipes/${String(src).replace(/^\/+/, "")}`
  );
  eleventyConfig.addFilter("host", (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  });
  eleventyConfig.addFilter("stars", (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n)));
  eleventyConfig.addFilter("fmtDate", (d) => {
    const date = d instanceof Date ? d : new Date(d);
    return isNaN(date)
      ? d
      : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  });
}

export const config = {
  dir: { input: ".", includes: "_includes", output: "_site" },
  pathPrefix: process.env.PATH_PREFIX || "/",
  markdownTemplateEngine: false,
  htmlTemplateEngine: "njk",
};
