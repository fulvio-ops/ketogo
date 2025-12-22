import rules from "../src/soul/gadget-rules.json" assert { type: "json" };

function scoreShareability(item) {
  let score = 0;
  if (item.thumbnail) score += 2;                 // immediate visual
  if ((item.title || "").length < 90) score += 1; // storytelling
  if (item.category === "OBJECT") score += 2;     // social identity
  if (!item.requiresExplanation) score += 1;      // low risk
  if (item.absurdity) score += 2;                  // controlled absurdity
  return score;
}

function priceAllowed(price) {
  if (price == null) return false;
  if (price >= rules.price_rules.core_range.min &&
      price <= rules.price_rules.core_range.max) return "core";
  if (price <= rules.price_rules.exception_max) return "exception";
  return false;
}

export function filterGadgets(items) {
  const accepted = [];
  const exceptions = [];

  for (const item of items) {
    const band = priceAllowed(item.price);
    if (!band) continue;

    const share = scoreShareability(item);
    if (share < rules.shareability.min_score) continue;

    item._shareability = share;

    if (band === "core") {
      accepted.push(item);
    } else {
      exceptions.push(item);
    }
  }

  const maxExceptions = Math.max(1, Math.floor(accepted.length * rules.price_rules.exception_ratio));
  return accepted.concat(exceptions.slice(0, maxExceptions));
}
