// scripts/pick-featured.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { score } from "./editorial.mjs";
import { filterGadgets } from "./gadget-gate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Quanti elementi per sezione (4+4)
const PICK = 4;

// Sub considerati “shop/gadget” (tutto lowercase, confronto case-insensitive)
const SHOP_SUBS = new Set(["shutupandtakemymoney", "gadgets", "buyitforlife"]);

const subOf = (p) => String(p?.subreddit || "").toLowerCase();

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
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7)); // giovedì decide l'anno ISO
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  const isoYear = date.getUTCFullYear();
  return isoYear * 100 + weekNo;
}

function pickN(arr, n, rng) {
  const a = [...arr];
  // shuffle deterministico
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

// Level robusto: usa campi presenti se esistono, altrimenti deriva dal punteggio
function levelOf(p) {
  const direct =
    Number(p?.level) ||
    Number(p?.editorial?.level) ||
    Number(p?.editorialLevel) ||
    Number(p?.meta?.level);

  if (Number.isFinite(direct) && direct > 0) return direct;

  // Fallback: mappa score -> level (tieni semplice e stabile)
  const s = Number(score(p) || 0);
  if (s >= 7) return 5;
  if (s >= 5) return 4;
  if (s >= 3) return 3;
  if (s >= 1) return 2;
  return 1;
}

export async function main() {
  // dove stanno i file nel repo
  const dataDir = path.join(__dirname, "..", "src", "data");
  const postsPath = path.join(dataDir, "posts.json");
  const featuredPath = path.join(dataDir, "featured.json");

  const data = await readJsonSafe(postsPath);
  const posts = Array.isArray(data?.posts) ? data.posts : [];

  const seed = isoWeekSeed();
  const rng = mulberry32(seed);

  // HERO = quello col punteggio più alto
  const hero =
    [...posts].sort((a, b) => score(b) - score(a) || String(a.title).localeCompare(String(b.title)))[0] || null;

  // Pool articoli vs pool shop (case-insensitive)
  const articlesPool = posts.filter(
    (p) => p?.subreddit && !SHOP_SUBS.has(subOf(p)) && (!hero || p.id !== hero.id)
  );
  const odditiesPool = posts.filter(
    (p) => p?.subreddit && SHOP_SUBS.has(subOf(p)) && (!hero || p.id !== hero.id)
  );

  // 4 articoli random da pool
  const articles = pickN(articlesPool, PICK, rng);

  // 4 gadget random, ma filtrati con la gate prezzo (5–15 ideale, max 25)
  const gatedOddities = filterGadgets(odditiesPool);
  const pickedOdd = pickN(gatedOddities, PICK, rng);

  // Se i gadget filtrati non bastano, riempi con altri post “shop”
  const need = PICK - pickedOdd.length;
  const fill =
    need > 0
      ? pickN(
          odditiesPool.filter((p) => !pickedOdd.some((o) => o.id === p.id)),
          need,
          rng
        )
      : [];

  const featured = {
    generatedAt: new Date().toISOString(),
    seed,
    hero,
    articles,
    oddities: [...pickedOdd, ...fill],
  };

  // Bilanciamento editoriale: se possibile, almeno 1 elemento “level>=4” in vetrina
  const current = [featured.hero, ...featured.articles, ...featured.oddities].filter(Boolean);
  const l4 = current.filter((p) => levelOf(p) >= 4).length;

  if (l4 < 1) {
    const candidate = posts
      .filter((p) => !current.some((x) => x.id === p.id))
      .filter((p) => levelOf(p) >= 4)[0];

    if (candidate) {
      // sostituisco l'ultimo oddity (meno invasivo)
      featured.oddities = [...featured.oddities.slice(0, Math.max(0, featured.oddities.length - 1)), candidate];
    }
  }

  await writeJson(featuredPath, featured);

  console.log(`featured.json generated: ${featured.articles.length}+${featured.oddities.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
