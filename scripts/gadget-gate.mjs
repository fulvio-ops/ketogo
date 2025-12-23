// scripts/gadget-gate.mjs
// Gadget price gate: ideal 5–15 EUR, allow up to 25 EUR.
// If price is unknown, keep it (soft gate).

import rules from "../src/soul/gadget-rules.json" with { type: "json" };

const IDEAL_MIN = 5;
const IDEAL_MAX = 15;
const HARD_MAX = 25;

function parsePriceEUR(text = "") {
  const t = String(text);
  const m =
    t.match(/(?:€\s*|eur\s*)(\d{1,4})(?:[.,](\d{2}))?/i) ||
    t.match(/(\d{1,4})(?:[.,](\d{2}))?\s*(?:€|eur)/i);
  if (!m) return null;
  const euros = Number(m[1]);
  const cents = m[2] ? Number(m[2]) : 0;
  if (!Number.isFinite(euros) || euros <= 0) return null;
  return euros + cents / 100;
}

export function filterGadgets(posts) {
  const allowUnknown = rules?.allowUnknownPrice !== false;
  return (posts || []).filter((p) => {
    const title = (p?.title || "");
    const url = (p?.url || "");
    const domain = (p?.domain || "");
    const price = parsePriceEUR(title) ?? parsePriceEUR(url) ?? parsePriceEUR(domain);
    if (price == null) return allowUnknown;
    if (price > HARD_MAX) return false;
    return true;
  });
}

export function gadgetPriceBand(post) {
  const title = (post?.title || "");
  const url = (post?.url || "");
  const domain = (post?.domain || "");
  const price = parsePriceEUR(title) ?? parsePriceEUR(url) ?? parsePriceEUR(domain);
  if (price == null) return { price: null, band: "unknown" };
  if (price >= IDEAL_MIN && price <= IDEAL_MAX) return { price, band: "ideal" };
  if (price <= HARD_MAX) return { price, band: "ok" };
  return { price, band: "reject" };
}
