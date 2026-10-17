const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const q = document.getElementById("q");
const cards = document.getElementById("cards");
const items = [...cards.querySelectorAll(".card")];
const chips = [...document.querySelectorAll(".chip")];
const count = document.getElementById("count");
const empty = document.getElementById("empty");
const selected = new Set();

function filter() {
  const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const card of items) {
    const { title, tags, ings } = card.dataset;
    const cardTags = tags.split("|");
    const ok =
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
