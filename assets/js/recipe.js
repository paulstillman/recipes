import { formatQty, formatGrams } from "./format.js";

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

// Serving scaler
const scaler = document.querySelector(".scaler");
const output = scaler.querySelector("output");
const quick = [...scaler.querySelectorAll("[data-factor]")];
const base = Number(scaler.dataset.base) || null;
const ings = [...document.querySelectorAll(".ing")];
let factor = 1;

function amountText(li) {
  const metric = li.dataset.metric === "true";
  const q = Number(li.dataset.qty) * factor;
  const q2 = li.dataset.qty2 ? Number(li.dataset.qty2) * factor : null;
  const unit = (q2 ?? q) > 1 ? li.dataset.plur : li.dataset.sing;
  return [formatQty(q, metric) + (q2 != null ? `–${formatQty(q2, metric)}` : ""), li.dataset.mid, unit]
    .filter(Boolean)
    .join(" ");
}

function render() {
  output.textContent = base ? `${formatQty(base * factor)} ${scaler.dataset.label}` : `${formatQty(factor)}×`;
  quick.forEach((b) => b.setAttribute("aria-pressed", Number(b.dataset.factor) === factor));
  for (const li of ings) {
    const amt = li.querySelector(".amt");
    if (amt && li.dataset.qty) amt.textContent = factor === 1 ? amt.dataset.orig : amountText(li);
    const g = li.querySelector(".g");
    const exact = li.dataset.gsrc === "recipe";
    if (g) g.textContent = (exact ? "" : "≈") + formatGrams(Number(li.dataset.grams) * factor, exact);
  }
}

scaler.addEventListener("click", (e) => {
  const step = Number(e.target.dataset.step);
  if (e.target.dataset.factor) factor = Number(e.target.dataset.factor);
  else if (step && base) factor = Math.max(1, Math.round(base * factor) + step) / base;
  else if (step) factor = Math.max(0.5, factor + step * 0.5);
  else return;
  render();
});

// Grams on/off
const grams = document.getElementById("grams-toggle");
grams.checked = store.get("recipes:grams") !== "off";
const applyGrams = () => {
  document.body.classList.toggle("hide-grams", !grams.checked);
  store.set("recipes:grams", grams.checked ? "on" : "off");
};
grams.addEventListener("change", applyGrams);
applyGrams();

// Keep the screen awake while cooking
if ("wakeLock" in navigator) {
  const wake = document.getElementById("wake-toggle");
  document.getElementById("wake-label").hidden = false;
  wake.checked = store.get("recipes:wake") !== "off";
  let lock = null;
  const acquire = async () => {
    if (!wake.checked || lock || document.visibilityState !== "visible") return;
    try {
      lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => (lock = null));
    } catch {}
  };
  wake.addEventListener("change", () => {
    store.set("recipes:wake", wake.checked ? "on" : "off");
    wake.checked ? acquire() : lock?.release();
  });
  document.addEventListener("visibilitychange", acquire);
  // Some browsers only grant the lock after a tap.
  document.addEventListener("pointerdown", acquire);
  acquire();
}

// Phone tabs
const body = document.querySelector(".r-body");
const tabs = [...document.querySelectorAll(".tabs button")];
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    body.dataset.active = tab.dataset.pane;
    tabs.forEach((t) => t.setAttribute("aria-pressed", t === tab));
    window.scrollTo({ top: Math.min(window.scrollY, document.querySelector(".tabs").offsetTop) });
  });
}
