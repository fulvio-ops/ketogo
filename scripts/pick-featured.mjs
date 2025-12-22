// scripts/pick-featured.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { score, levelOf } from "./editorial.mjs";
import { filterGadgets } from "./gadget-gate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Quanti elementi per sezione (4+4)
const PICK = 4;

// Sottoreddit considerati "shop/gadget"
const SHOP_SUBS = new Set([
  "ShutUpAndTakeMyMoney",
  "gadgets",
  "BuyItForLife",
]);

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
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  const isoYear = date.getUTCFullYear();
  // trasformo in numero deterministico
  return isoYear * 100 + weekNo;
}

function pickN(arr, n, rng) {
  const a = Array.isArray(arr) ? [...arr] : [];
  // shuffle deterministico
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, n));
}

function uniqById(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || !it.id) continue;
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

async function main() {
  const dataPath = path.join(__dirname, "..", "data", "posts.json");
  const outPath = path.join(__dirname, "..", "data", "featured.json");

  let raw;
  try {
    raw = await fs.readFile(dataPath, "utf-8");
  } catch (e) {
    throw new Error(`Missing data/posts.json. Run build-posts first. (${e?.message || e})`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in data/posts.json (${e?.message || e})`);
  }

  const posts = Array.isArray(data?.posts) ? data.posts : [];

  const seed = isoWeekSeed();
  const rng = mulberry32(seed);

  // HERO: il post con score più alto (tie-break su title)
  const hero =
    [...posts].sort(
      (a, b) =>
        (score(b) - score(a)) ||
        String(a?.title || "").localeCompare(String(b?.title || ""))
    )[0] || null;

  // Pool articoli (non shop)
  const articlesPool = posts.filter(
    (p) =>
      p?.subreddit &&
      !SHOP_SUBS.has(p.subreddit) &&
      (!hero || p.id !== hero.id)
  );

  // Pool oggetti shop (shop subs)
  const odditiesPool = posts.filter(
    (p) =>
      p?.subreddit &&
      SHOP_SUBS.has(p.subreddit) &&
      (!hero || p.id !== hero.id)
  );

  // Selezione articoli
  const articles = pickN(articlesPool, PICK, rng);

  // Gate gadget (prezzo 5–15, eccezione <=25, score >= soglia)
  const gatedOdditiesAll = filterGadgets(odditiesPool);

  // Selezione oggetti
  const pickedOdd = pickN(gatedOdditiesAll, PICK, rng);

  // Fill SOLO da gatedOddities (mai da posts generico)
  const needOdd = PICK - pickedOdd.length;
  const fillOdd =
    needOdd > 0
      ? pickN(
          gatedOdditiesAll.filter((p) => !pickedOdd.some((o) => o.id === p.id)),
          needOdd,
          rng
        )
      : [];

  let featured = {
    generatedAt: new Date().toISOString(),
    seed,
    hero,
    articles: uniqById(articles),
    oddities: uniqById([...pickedOdd, ...fillOdd]),
  };

  // --- Editorial balance: almeno un elemento "livello >= 4" nel featured.
  // Importante: NON deve mai bucare il gate degli oggetti.
  const current = [featured.hero, ...featured.articles, ...featured.oddities].filter(Boolean);
  const l4 = current.filter((p) => levelOf(p) >= 4).length;

  if (l4 < 1) {
    // Prima provo a trovare un candidato livello 4 tra gli ARTICOLI (così non tocchiamo gli oggetti)
    const candidateArticle =
      articlesPool
        .filter((p) => !current.some((x) => x.id === p.id))
        .filter((p) => levelOf(p) >= 4)[0] || null;

    if (candidateArticle) {
      // sostituisco l'ultimo articolo (o push se vuoto)
      if (featured.articles.length > 0) {
        featured.articles = uniqById([
          ...featured.articles.slice(0, featured.articles.length - 1),
          candidateArticle,
        ]);
      } else {
        featured.articles = uniqById([candidateArticle]);
      }
    } else {
      // Altrimenti cerco un candidato livello 4 tra gli OGGETTI GATED (quindi sempre filtrati)
      const candidateOdd =
        gatedOdditiesAll
          .filter((p) => !current.some((x) => x.id === p.id))
          .filter((p) => levelOf(p) >= 4)[0] || null;

      if (candidateOdd) {
        if (featured.oddities.length > 0) {
          featured.oddities = uniqById([
            ...featured.oddities.slice(0, Math.max(0, featured.oddities.length - 1)),
            candidateOdd,
          ]);
        } else {
          featured.oddities = uniqById([candidateOdd]);
        }
      }
    }
  }

  await fs.writeFile(outPath, JSON.stringify(featured, null, 2), "utf-8");
  console.log(`featured.json generated: ${featured.articles.length}+${featured.oddities.length} (seed=${seed})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
