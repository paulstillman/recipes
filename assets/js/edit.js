// Saving edits from the website back to the markdown files, by committing
// through the GitHub API with a token kept only in this browser.
const { repo, branch, built } = document.body.dataset;
const TOKEN = "recipes:github-token";
const PENDING = "recipes:pending";

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

export const getToken = () => store.get(TOKEN);
export const setToken = (t) => store.set(TOKEN, t || null);

// Edits saved from this browser that this build of the site doesn't include
// yet: { "recipes/x.md": { status, t } }. Older entries are already built in.
export function pending() {
  let all = {};
  try { all = JSON.parse(store.get(PENDING)) || {}; } catch {}
  const fresh = Object.fromEntries(Object.entries(all).filter(([, e]) => e.t > Date.parse(built)));
  if (Object.keys(fresh).length !== Object.keys(all).length) store.set(PENDING, JSON.stringify(fresh));
  return fresh;
}
function remember(path, status) {
  store.set(PENDING, JSON.stringify({ ...pending(), [path]: { status, t: Date.now() } }));
}

async function gh(path, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/vnd.github+json", ...opts.headers },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401 ? "GitHub rejected the token (expired or mistyped?)"
      : res.status === 403 || res.status === 404 ? "this token doesn't have write access to the recipes repo"
      : res.status === 409 ? "the file changed in the meantime; try again"
      : `GitHub error ${res.status}`
    );
  }
  return res.json();
}

const fromB64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
function toB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Sets one front-matter field (or removes it when value is empty).
export function setField(text, key, value) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error("the recipe file has no front matter");
  let lines = m[1].split(/\r?\n/).filter((l) => !l.startsWith(`${key}:`));
  if (value) {
    // keep it next to the other short fields, before rating/log if present
    const at = lines.findIndex((l) => /^(rating|log|image):/.test(l));
    lines.splice(at < 0 ? lines.length : at, 0, `${key}: ${value}`);
  }
  return `---\n${lines.join("\n")}\n---` + text.slice(m[0].length);
}

// Checks the token can write to the repo.
export async function testToken() {
  const r = await gh("");
  if (!r.permissions?.push) throw new Error("this token can read the repo but not change it");
}

export async function saveStatus(path, status, title) {
  const file = await gh(`/contents/${path}?ref=${branch}`);
  const updated = setField(fromB64(file.content), "status", status);
  await gh(`/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `${title}: status ${status ? `"${status}"` : "cleared"}`,
      content: toB64(updated),
      sha: file.sha,
      branch,
    }),
  });
  remember(path, status);
}
