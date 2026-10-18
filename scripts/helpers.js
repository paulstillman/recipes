// Small helpers shared by the import scripts.

export const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const shortTime = (s) =>
  s.replace(/\bhours?\b|\bhrs\b/gi, "hr").replace(/\bminutes?\b|\bmins\b/gi, "min").replace(/\s+/g, " ").trim();
