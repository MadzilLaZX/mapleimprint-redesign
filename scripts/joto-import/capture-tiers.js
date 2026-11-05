// "Save Joto tiers" bookmarklet — readable source. The one-line bookmark version is in
// bookmarklet.txt (regenerate with: node scripts/joto-import/make-bookmarklet.mjs).
//
// Joto's "Buy more, save more" boxes come from a discount app that only answers real shoppers'
// browsers, so they can't be fetched directly. On a Joto product page you already have open,
// click the bookmark: it steps through each option (colour/size), copies the tier boxes the page
// shows, and downloads joto-tiers-<handle>.json to your Downloads folder. It makes no requests
// of its own — it only reads what the page has already loaded and clicks the page's own options.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const handle = location.pathname.split("/products/")[1]?.split(/[/?#]/)[0];
  if (!handle) return note("Open a Joto product page first.", true);

  const readCards = () =>
    [...document.querySelectorAll(".hulk-tier-card")].map((c) => c.innerText.replace(/\s+/g, " ").trim());
  const currentVariant = () =>
    new URLSearchParams(location.search).get("variant") ||
    document.querySelector('form[action*="/cart/add"] [name="id"]')?.value ||
    null;
  const waitForCards = async (prev) => {
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      const now = readCards();
      if (now.length && JSON.stringify(now) !== prev) return now;
    }
    return readCards();
  };

  // Option controls: radio groups (swatches/buttons) or <select>s inside the product form area.
  const scope = document.querySelector('form[action*="/cart/add"]')?.closest("section, .product, main") || document;
  const radioGroups = {};
  for (const r of scope.querySelectorAll('input[type="radio"]')) {
    if (!r.name || /quantity|selling_plan/i.test(r.name)) continue;
    (radioGroups[r.name] ||= []).push(r);
  }
  const groups = Object.values(radioGroups).filter((g) => g.length > 1);
  const selects = [...scope.querySelectorAll("select")].filter((s) => /option/i.test(s.name || s.id || "") && s.options.length > 1);

  const result = { handle, url: location.href, capturedAt: new Date().toISOString(), variants: [] };
  const record = async (label) => {
    const prev = JSON.stringify(result.variants.at(-1)?.cards ?? null);
    const cards = await waitForCards(prev);
    result.variants.push({ label, variantId: currentVariant(), cards });
  };

  if (groups.length) {
    for (const input of groups[0]) {
      (input.labels?.[0] || input).click();
      await sleep(400);
      await record(input.value);
    }
  } else if (selects.length) {
    const s = selects[0];
    for (const o of [...s.options]) {
      s.value = o.value;
      s.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(400);
      await record(o.value);
    }
  } else {
    await sleep(800);
    result.variants.push({ label: null, variantId: currentVariant(), cards: readCards() });
  }

  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `joto-tiers-${handle}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  const withTiers = result.variants.filter((v) => v.cards.length).length;
  note(`Saved joto-tiers-${handle}.json — ${result.variants.length} option(s), ${withTiers ? withTiers + " with price tiers" : "no price tiers on this product"}.`);

  function note(msg, bad) {
    const d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = `position:fixed;z-index:2147483647;top:16px;right:16px;max-width:360px;padding:12px 16px;border-radius:10px;font:600 14px system-ui;color:#fff;background:${bad ? "#b91c1c" : "#15803d"};box-shadow:0 6px 24px rgba(0,0,0,.25)`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 6000);
  }
})();
