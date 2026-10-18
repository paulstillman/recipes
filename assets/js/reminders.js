// "Add to Reminders": pick which ingredients you need, then hand them to an
// Apple Shortcut (see README), which adds one reminder per item to a list.
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const PANTRY = "recipes:pantry";
const LISTS = "recipes:reminder-lists";

// Unticked by default until you say otherwise.
const STAPLES = new RegExp(
  [
    "\\bsalt\\b", "^(black |white |ground |freshly ground )*pepper$", "\\b(black|white) pepper", "peppercorns",
    "\\b(olive|vegetable|canola|avocado|coconut|sesame|cooking) oil\\b", "^oil$", "\\bghee\\b", "vinegar",
    "^(all-purpose )?flour$", "^(granulated |white |brown |light brown |dark brown )?sugar$", "baking (soda|powder)", "vanilla",
    "\\b(cumin|paprika|turmeric|tumeric|cinnamon|nutmeg|cayenne|chili powder|curry powder|garam masala|coriander|cardamom|allspice|star anise|mace)\\b",
    "(red )?(pepper|chile|chili) flakes", "^dried (oregano|thyme|basil|parsley|rosemary|sage|dill|herbs|italian seasoning)",
    "italian seasoning", "bay lea(f|ves)", "garlic powder", "onion powder", "ground (ginger|cloves|mustard)",
    "soy sauce", "coconut aminos", "fish sauce", "^honey$", "maple syrup", "cornstarch", "arrowroot", "^water$", "^ice\\b",
  ].join("|"),
  "i"
);

// "2 pounds" + "boneless, skinless chicken breasts, (cut into 1½-inch pieces)"
// -> "2 pounds boneless, skinless chicken breasts"
const PREP = /^(chopped|diced|minced|sliced|thinly|finely|roughly|coarsely|cut|peeled|grated|shredded|crushed|drained|rinsed|divided|softened|melted|at room|to taste|optional|for (serving|garnish)|plus more|or more|cubed|julienned|trimmed|halved|quartered|seeded|beaten|packed|washed|spiralized|cored|zested|juiced)/i;
function itemText(li) {
  const amount = li.querySelector(".amt")?.textContent.trim() || "";
  const parts = li.querySelector(".name").textContent.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim().split(/,\s*/);
  while (parts.length > 1 && PREP.test(parts.at(-1))) parts.pop();
  const name = parts.join(", ").replace(/[,;:]\s*$/, "");
  // The name (without amount or prep) is what pantry choices are remembered by.
  return { text: [amount, name].filter(Boolean).join(" "), key: name.toLowerCase() };
}

export function setupReminders() {
  const button = document.getElementById("reminders-btn");
  const dialog = document.getElementById("reminders");
  if (!button || !dialog?.showModal) {
    if (button) button.hidden = true;
    return;
  }
  const list = document.getElementById("reminders-items");
  const listInput = document.getElementById("reminders-list");
  const datalist = document.getElementById("reminders-lists");
  let pantry = new Set();
  let lists = [];
  try { pantry = new Set(JSON.parse(store.get(PANTRY)) || []); } catch {}
  try { lists = JSON.parse(store.get(LISTS)) || []; } catch {}

  button.addEventListener("click", () => {
    // Only the ingredients on show (e.g. the chosen Instant Pot / slow cooker version)
    const ings = [...document.querySelectorAll("#pane-ingredients .ing")].filter((li) => !li.closest(".variant[hidden]"));
    list.replaceChildren(
      ...ings.map((li) => {
        const { text, key: k } = itemText(li);
        const row = document.createElement("li");
        row.dataset.key = k;
        const box = Object.assign(document.createElement("input"), { type: "checkbox", checked: !(pantry.has(k) || (STAPLES.test(k) && !pantry.has(`!${k}`))) });
        box.setAttribute("aria-label", `Add ${text}`);
        const field = Object.assign(document.createElement("input"), { type: "text", value: text });
        field.setAttribute("aria-label", "Reminder text");
        row.append(box, field);
        return row;
      })
    );
    datalist.replaceChildren(...lists.map((l) => Object.assign(document.createElement("option"), { value: l })));
    listInput.value = lists[0] || "Groceries";
    dialog.showModal();
  });

  dialog.querySelector(".bulk").addEventListener("click", (e) => {
    if (!e.target.dataset.all) return;
    list.querySelectorAll("input[type=checkbox]").forEach((b) => (b.checked = e.target.dataset.all === "1"));
  });

  dialog.querySelector("form").addEventListener("submit", (e) => {
    if (e.submitter?.value !== "send") return;
    const rows = [...list.children];
    const items = rows.filter((r) => r.querySelector("input[type=checkbox]").checked).map((r) => r.querySelector("input[type=text]").value.trim()).filter(Boolean);
    // Remember choices: unticked -> pantry; ticked staple -> "!" marks it as wanted
    for (const r of rows) {
      const k = r.dataset.key;
      const ticked = r.querySelector("input[type=checkbox]").checked;
      pantry.delete(k);
      pantry.delete(`!${k}`);
      if (!ticked && !STAPLES.test(k)) pantry.add(k);
      if (ticked && STAPLES.test(k)) pantry.add(`!${k}`);
    }
    store.set(PANTRY, JSON.stringify([...pantry]));
    const listName = listInput.value.trim() || "Groceries";
    lists = [listName, ...lists.filter((l) => l !== listName)].slice(0, 8);
    store.set(LISTS, JSON.stringify(lists));
    if (!items.length) return;

    const input = JSON.stringify({ list: listName, items });
    // Shortcuts wants %20 for spaces, not the "+" URLSearchParams would use.
    const params = { name: dialog.dataset.shortcut, input: "text", text: input, "x-success": location.href };
    location.href =
      "shortcuts://x-callback-url/run-shortcut?" +
      Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  });
}
