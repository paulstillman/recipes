import { getToken, setToken, testToken, pending } from "./edit.js";

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const q = document.getElementById("q");

// Statuses saved from this browser that this build doesn't include yet
const waiting = pending();
for (const card of document.querySelectorAll(".card")) {
  const e = waiting[card.dataset.path];
  if (!e) continue;
  card.dataset.status = e.status;
  const badge = card.querySelector(".status");
  badge.dataset.status = e.status;
  badge.textContent = e.status.charAt(0).toUpperCase() + e.status.slice(1);
  badge.hidden = !e.status;
}
const cards = document.getElementById("cards");
const items = [...cards.querySelectorAll(".card")];
const chips = [...document.querySelectorAll("#chips .chip")];
const count = document.getElementById("count");
const empty = document.getElementById("empty");
const selected = new Set();
const statusChips = [...document.querySelectorAll(".status-chips .chip")];
const statuses = new Set();

function filter() {
  const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const card of items) {
    const { title, tags, ings } = card.dataset;
    const cardTags = tags.split("|");
    const ok =
      (!statuses.size || statuses.has(card.dataset.status)) &&
      [...selected].every((t) => cardTags.includes(t)) &&
      terms.every((t) => title.includes(t) || tags.includes(t) || ings.includes(t));
    card.hidden = !ok;
    if (ok) shown++;
  }
  count.textContent = `${shown} ${shown === 1 ? "recipe" : "recipes"}`;
  empty.hidden = shown > 0;
}

q.addEventListener("input", filter);
for (const chip of chips) {
  chip.addEventListener("click", () => {
    const t = chip.dataset.tag;
    selected.has(t) ? selected.delete(t) : selected.add(t);
    chip.setAttribute("aria-pressed", selected.has(t));
    filter();
  });
}

// Status chips: any of the chosen statuses
for (const chip of statusChips) {
  chip.addEventListener("click", () => {
    const s = chip.dataset.status;
    statuses.has(s) ? statuses.delete(s) : statuses.add(s);
    chip.setAttribute("aria-pressed", statuses.has(s));
    filter();
  });
}

const viewButtons = [...document.querySelectorAll("[data-view]")].filter((b) => b.tagName === "BUTTON");
function setView(view) {
  cards.dataset.view = view;
  viewButtons.forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === view));
  store.set("recipes:view", view);
}
viewButtons.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
setView(store.get("recipes:view") || "grid");

const startTag = new URLSearchParams(location.search).get("tag");
if (startTag) chips.find((c) => c.dataset.tag === startTag.toLowerCase())?.click();

// Editing setup: the GitHub token for saving statuses
const editing = document.getElementById("editing");
const tokenInput = document.getElementById("token");
const tokenMsg = document.getElementById("token-msg");
const showTokenState = () =>
  (tokenMsg.textContent = getToken() ? "This device can save changes." : "No token on this device yet.");
if (new URLSearchParams(location.search).has("setup")) {
  editing.open = true;
  editing.scrollIntoView();
}
showTokenState();
document.getElementById("token-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) return;
  const previous = getToken();
  setToken(token);
  tokenMsg.textContent = "Checking…";
  try {
    await testToken();
    tokenInput.value = "";
    tokenMsg.textContent = "Saved. This device can now change statuses from recipe pages.";
  } catch (err) {
    setToken(previous);
    tokenMsg.textContent = `Not saved: ${err.message}.`;
  }
});
document.getElementById("token-forget").addEventListener("click", () => {
  setToken(null);
  tokenInput.value = "";
  showTokenState();
});
