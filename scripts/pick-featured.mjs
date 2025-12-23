// scripts/pick-featured.mjs
// Select weekly featured items (hero + 4 articles + 4 oddities).
// HARD GUARDS:
// - FAIL if posts.json missing/empty
// - FAIL if odditiesPool > 0 but selected oddities == 0
// - Ensure at least one level>=4 item if available

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { score, levelOf } from "./editorial.mjs";
import { filterGadgets, gadgetPriceBand } from "./gadget-gate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PICK = 4;
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

function oddityRank(p) {
  const { band } = gadgetPriceBand(p);
  const bandScore = band === "ideal" ? 3 : band === "ok" ? 2 : band === "unknown" ? 1 : 0;
  return bandScore * 100 + score(p);
}

export async function main() {
  const dataDir = path.join(__dirname, "..", "src", "data");
  const postsPath = path.join(dataDir, "posts.json");
  const featuredPath = path.join(dataDir, "featured.json");

  const data = await readJsonSafe(postsPath);
  const posts = Array.isArray(data?.posts) ? data.posts : [];

  if (posts.length === 0) {
    throw new Error("pick-featured: posts.json is missing or empty; cannot generate featured.json");
  }

  const seed = isoWeekSeed();
  const rng = mulberry32(seed);

  const hero =
    [...posts].sort((a, b) => score(b) - score(a) || String(a.title).localeCompare(String(b.title)))[0] || null;

  const articlesPool = posts.filter((p) => p?.subreddit && !SHOP_SUBS.has(p.subreddit) && (!hero || p.id !== hero.id));
  const odditiesPool = posts.filter((p) => p?.subreddit && SHOP_SUBS.has(p.subreddit) && (!hero || p.id !== hero.id));

  const articles = pickN(articlesPool, PICK, rng);

  const gatedOddities = filterGadgets(odditiesPool).sort((a, b) => oddityRank(b) - oddityRank(a));
  const pickedOdd = pickN(gatedOddities, PICK, rng);

  if (odditiesPool.length > 0 && pickedOdd.length === 0) {
    throw new Error(
      `pick-featured: odditiesPool=${odditiesPool.length} but selected=0. Gadget gate likely too strict or prices not parsable.`
    );
  }

  const need = PICK - pickedOdd.length;
  const fill =
    need > 0
      ? pickN(odditiesPool.filter((p) => !pickedOdd.some((o) => o.id === p.id)), need, rng)
      : [];

  const featured = {
    generatedAt: new Date().toISOString(),
    seed,
    hero,
    articles,
    oddities: [...pickedOdd, ...fill],
  };

  const current = [featured.hero, ...featured.articles, ...featured.oddities].filter(Boolean);
  const l4 = current.filter((p) => levelOf(p) >= 4).length;

  if (l4 < 1) {
    const candidate = posts
      .filter((p) => !current.some((x) => x.id === p.id))
      .filter((p) => levelOf(p) >= 4)[0];

    if (candidate) {
      featured.oddities = [...featured.oddities.slice(0, Math.max(0, featured.oddities.length - 1)), candidate];
    }
  }

  await writeJson(featuredPath, featured);
  console.log(`✅ featured.json generated: ${featured.articles.length}+${featured.oddities.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
