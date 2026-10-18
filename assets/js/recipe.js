import { formatQty, formatGrams } from "./format.js";
import { getToken, pending, saveStatus } from "./edit.js";
import { setupReminders } from "./reminders.js";

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

// Cooking method (e.g. Instant Pot / Slow cooker), remembered per device
const methodButtons = [...document.querySelectorAll(".variant-toggle button")];
if (methodButtons.length) {
  const setMethod = (key) => {
    body.dataset.variant = key;
    methodButtons.forEach((b) => b.setAttribute("aria-pressed", b.dataset.variant === key));
    document.querySelectorAll(".variant").forEach((el) => (el.hidden = el.dataset.variant !== key));
  };
  methodButtons.forEach((b) =>
    b.addEventListener("click", () => {
      setMethod(b.dataset.variant);
      store.set("recipes:method", b.dataset.variant);
    })
  );
  const saved = store.get("recipes:method");
  setMethod(methodButtons.some((b) => b.dataset.variant === saved) ? saved : methodButtons[0].dataset.variant);
}

// Status: saved straight to the recipe's markdown file on GitHub
const statusSelect = document.getElementById("status");
const statusMsg = document.getElementById("status-msg");
const setupUrl = document.querySelector(".back").getAttribute("href") + "?setup#editing";
const showStatus = (value) => {
  statusSelect.value = value;
  statusSelect.dataset.status = value;
};
const waiting = pending()[statusSelect.dataset.path];
if (waiting) {
  showStatus(waiting.status);
  statusMsg.textContent = "Saved; the site updates in a minute or two";
}
let current = statusSelect.value;
statusSelect.addEventListener("change", async () => {
  const value = statusSelect.value;
  if (!getToken()) {
    showStatus(current);
    statusMsg.innerHTML = `To save from here, <a href="${setupUrl}">set up editing on this device</a> first.`;
    return;
  }
  statusSelect.disabled = true;
  statusMsg.textContent = "Saving…";
  try {
    await saveStatus(statusSelect.dataset.path, value, statusSelect.dataset.title);
    current = value;
    showStatus(value);
    statusMsg.textContent = "Saved; the site updates in a minute or two";
  } catch (e) {
    showStatus(current);
    statusMsg.textContent = `Not saved: ${e.message}.`;
  } finally {
    statusSelect.disabled = false;
  }
});

setupReminders();
