import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { score } from "./editorial.mjs";
import { filterGadgets } from "./gadget-gate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PICK = 4;

// Sub considered shop/gadget (lowercase; case-insensitive compare)
const SHOP_SUBS = new Set(["shutupandtakemymoney", "gadgets", "buyitforlife"]);

function subOf(p) {
  const s = String(p?.subreddit || p?.subreddit_name_prefixed || "").toLowerCase();
  return s.startsWith("r/") ? s.slice(2) : s;
}

function looksCommerce(p) {
  const d = String(p?.domain || "").toLowerCase();
  const u = String(p?.url || "").toLowerCase();
  return ["amazon.", "amzn.", "etsy.", "ebay.", "aliexpress.", "temu.", "shopify."].some((x) => d.includes(x) || u.includes(x));
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoWeekSeed(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  const isoYear = date.getUTCFullYear();
  return isoYear * 100 + weekNo;
}

function pickN(arr, n, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

async function readJsonSafe(p) {
  try {
    const s = await fs.readFile(p, "utf8");
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function writeJson(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, 2), "utf8");
}

export async function main() {
  const dataDir = path.join(__dirname, "..", "src", "data");
  const postsPath = path.join(dataDir, "posts.json");
  const featuredPath = path.join(dataDir, "featured.json");

  const data = await readJsonSafe(postsPath);
  const posts = Array.isArray(data?.posts) ? data.posts : [];

  const seed = isoWeekSeed();
  const rng = mulberry32(seed);

  const hero =
    [...posts].sort((a, b) => score(b) - score(a) || String(a.title).localeCompare(String(b.title)))[0] || null;

  const articlesPool = posts.filter(
    (p) =>
      (p?.subreddit || p?.subreddit_name_prefixed) &&
      !SHOP_SUBS.has(subOf(p)) &&
      !looksCommerce(p) &&
      (!hero || p.id !== hero.id)
  );

  const odditiesPool = posts
    .filter(
      (p) =>
        ((p?.subreddit || p?.subreddit_name_prefixed) && SHOP_SUBS.has(subOf(p))) || looksCommerce(p)
    )
    .filter((p) => (!hero || p.id !== hero.id));

  const articles = pickN(articlesPool, PICK, rng);

  // Apply gadget gate; if it yields 0 due to missing prices, fall back to raw odditiesPool
  const gatedOddities = filterGadgets(odditiesPool);
  const baseOddities = gatedOddities.length ? gatedOddities : odditiesPool;

  const oddities = pickN(baseOddities, PICK, rng);

  const featured = {
    generatedAt: new Date().toISOString(),
    seed,
    hero,
    articles,
    oddities,
    debug: {
      posts: posts.length,
      articlesPool: articlesPool.length,
      odditiesPool: odditiesPool.length,
      gatedOddities: gatedOddities.length
    }
  };

  await writeJson(featuredPath, featured);

  console.log(
    `featured.json generated: articles=${featured.articles.length}, oddities=${featured.oddities.length} (oddities pool=${odditiesPool.length}, gated=${gatedOddities.length})`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
