import rules from "../src/soul/gadget-rules.json" with { type: "json" };

// Reddit posts almost never contain a numeric price.
// So we enforce strict price gates when price exists,
// and allow a limited quota of "unknown price" items (still must be highly shareable).

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// Minimal, cheap shareability proxy (0..8)
function scoreShareability(item) {
  let score = 0;

  // 1) immediate visual
  if (item.thumbnail || item.image) score += 2;

  // 2) storytelling (short-ish title)
  const titleLen = (item.title || "").length;
  if (titleLen > 0 && titleLen < 90) score += 1;

  // 3) social identity / gadgetness
  if (item.category === "OBJECT") score += 2;

  // 4) low risk
  if (!item.isHeavy) score += 1;

  // 5) controlled absurdity (if provided upstream)
  if (item.absurdity === true) score += 2;

  return score;
}

function priceBand(price) {
  if (price == null) return "unknown";
  if (price >= rules.price_rules.core_range.min && price <= rules.price_rules.core_range.max) return "core";
  if (price <= rules.price_rules.exception_max) return "exception";
  return "reject";
}

export function filterGadgets(items) {
  const core = [];
  const exception = [];
  const unknown = [];

  for (const item of items || []) {
    const p = num(item.price);
    const band = priceBand(p);
    if (band === "reject") continue;

    const share = scoreShareability(item);
    if (share < rules.shareability.min_score) continue;

    item._shareability = share;

    if (band === "core") core.push(item);
    else if (band === "exception") exception.push(item);
    else unknown.push(item);
  }

  const maxExceptions = Math.max(1, Math.floor(core.length * rules.price_rules.exception_ratio));
  const maxUnknown = Math.max(1, Math.floor((core.length + maxExceptions) * rules.price_rules.unknown_price_ratio));

  return core
    .concat(exception.slice(0, maxExceptions))
    .concat(unknown.slice(0, maxUnknown));
}
