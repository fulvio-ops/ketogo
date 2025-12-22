// scripts/pick-featured.mjs
// Builds data/featured.json selecting 4 articles + 4 gadgets (oddities) deterministically per ISO week.
// Applies editorial approval (manifesto/vocabulary gate) BEFORE scoring/picking.
// Applies gadget price gate via filterGadgets().

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { approve, score, levelOf } from "./editorial.mjs";
import { filterGadgets } from "./gadget-gate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Quanti elementi per sezione (4 articoli + 4 gadget)
const PICK = 4;

// Sottoreddit considerati "shop/gadget" (non unico criterio: usiamo anche category===OBJECT)
const SHOP_SUBS = new Set(["ShutUpAndTakeMyMoney", "gadgets", "BuyItForLife"]);

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoWeekSeed(d = new Date()) {
  // Seed stabile settimanale (ISO week) -> stesso featured per tutta la settimana
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // giovedì decide l'anno ISO
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return isoYear * 100 + weekNo;
}

function uniqById(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const id = x?.id || x?.postId || x?.url;
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(x);
  }
  return out;
}

function pickN(pool, n, rng) {
  const a = [...pool];
  // Fisher–Yates deterministic shuffle
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, n));
}

function safeLoadJSON(p) {
  return fs
    .readFile(p, "utf8")
    .then((s) => JSON.parse(s))
    .catch(() => null);
}

async function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const postsPath = path.join(dataDir, "posts.json");
  const outPath = path.join(dataDir, "featured.json");

  const seed = isoWeekSeed();
  const rng = mulberry32(seed);

  const data = (await safeLoadJSON(postsPath)) || {};
  const postsRaw = Array.isArray(data?.posts) ? data.posts : Array.isArray(data) ? data : [];
  const posts = uniqById(postsRaw);

  // 1) EDITORIAL APPROVAL (manifesto + vocabulary micro-judgment + heavy filter)
  // approve() returns null if rejected; also attaches category + judgment
  const approvedPosts = posts
    .map((p) => approve(p, String(seed)))
    .filter(Boolean);

  // If nothing approved, still write featured.json (empty), so the site builds.
  if (!approvedPosts.length) {
    const featuredEmpty = {
      generatedAt: new Date().toISOString(),
      seed,
      hero: null,
      articles: [],
      oddities: [],
      note: "No approved posts available.",
    };
    await fs.writeFile(outPath, JSON.stringify(featuredEmpty, null, 2), "utf8");
    console.log("featured.json generated (empty).");
    return;
  }

  // 2) HERO = best scored among approved
  const hero =
    [...approvedPosts].sort(
      (a, b) =>
        score(b) - score(a) ||
        String(a.title || "").localeCompare(String(b.title || ""))
    )[0] || null;

  // 3) Pools
  const isShop = (p) =>
    (p?.subreddit && SHOP_SUBS.has(p.subreddit)) || p?.category === "OBJECT";

  const articlesPool = approvedPosts.filter(
    (p) => !isShop(p) && (!hero || p.id !== hero.id)
  );

  // Gadgets: category OBJECT + price gate enforced by filterGadgets()
  const odditiesPoolRaw = approvedPosts.filter(
    (p) => isShop(p) && (!hero || p.id !== hero.id)
  );
  const odditiesPool = filterGadgets(odditiesPoolRaw);

  // 4) Picks (deterministic per week)
  const articles = pickN(articlesPool, PICK, rng);

  // pick gadgets
  let pickedOdd = pickN(odditiesPool, PICK, rng);

  // 5) Fill if gadgets are fewer than PICK:
  // Try to fill with OTHER approved OBJECT posts (even if not in SHOP_SUBS) but still gated by price filter.
  if (pickedOdd.length < PICK) {
    const already = new Set([hero?.id, ...articles.map((x) => x?.id), ...pickedOdd.map((x) => x?.id)].filter(Boolean));
    const moreObjects = filterGadgets(
      approvedPosts.filter((p) => p?.category === "OBJECT" && !already.has(p?.id))
    );
    const need = PICK - pickedOdd.length;
    pickedOdd = [...pickedOdd, ...pickN(moreObjects, need, rng)];
  }

  // 6) Final fallback fill (rare): keep build stable by filling from remaining approved (non-duplicates),
  // even if not gadgets; BUT we still keep section size.
  if (pickedOdd.length < PICK) {
    const already = new Set([hero?.id, ...articles.map((x) => x?.id), ...pickedOdd.map((x) => x?.id)].filter(Boolean));
    const remaining = approvedPosts.filter((p) => !already.has(p?.id));
    const need = PICK - pickedOdd.length;
    pickedOdd = [...pickedOdd, ...pickN(remaining, need, rng)];
  }

  // 7) Editorial balance: ensure at least one level>=4 among (hero + selected) if possible
  const current = [hero, ...articles, ...pickedOdd].filter(Boolean);
  const l4 = current.filter((p) => (typeof levelOf === "function" ? levelOf(p) : 0) >= 4).length;

  let oddities = pickedOdd;

  if (l4 < 1 && typeof levelOf === "function") {
    const taken = new Set(current.map((x) => x?.id).filter(Boolean));
    const candidate = approvedPosts
      .filter((p) => !taken.has(p?.id))
      .filter((p) => levelOf(p) >= 4)
      .sort((a, b) => score(b) - score(a))[0];

    if (candidate) {
      // swap last oddity with candidate (keeps section size)
      oddities = [...oddities.slice(0, Math.max(0, oddities.length - 1)), candidate];
    }
  }

  const featured = {
    generatedAt: new Date().toISOString(),
    seed,
    hero,
    articles,
    oddities,
  };

  await fs.writeFile(outPath, JSON.stringify(featured, null, 2), "utf8");

  // Helpful build logs (non-blocking)
  console.log(
    `featured.json generated: hero=${hero ? "yes" : "no"}, articles=${articles.length}, oddities=${oddities.length}, approved=${approvedPosts.length}`
  );
}

main().catch((err) => {
  console.error("pick-featured.mjs failed:", err);
  process.exitCode = 1;
});
