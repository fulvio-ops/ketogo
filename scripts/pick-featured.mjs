import fs from "node:fs/promises";
import path from "node:path";

// === CONFIG: scegli qui il file sorgente già popolato ===
// Se il tuo file è diverso, cambia solo questo:
const SOURCE = "src/data/weekly.json"; // oppure "src/data/posts.json"
const OUT = "src/data/featured.json";

// RNG deterministico (mulberry32) + seed settimanale
function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoWeekSeed(d = new Date()) {
  // seed stabile per settimana: YYYYWW
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return parseInt(`${date.getUTCFullYear()}${String(weekNo).padStart(2, "0")}`, 10);
}

function pickN(arr, n, rng) {
  const a = [...arr];
  // Fisher-Yates shuffle
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

async function main() {
  const srcPath = path.join(process.cwd(), SOURCE);
  const raw = await fs.readFile(srcPath, "utf8");
  const data = JSON.parse(raw);

  // Adatta qui ai tuoi campi reali:
  // Caso A) weekly.json con news/products
  const articles = data?.news?.items ?? data?.articles ?? [];
  const products = data?.products?.items ?? data?.products ?? [];

  const rng = mulberry32(isoWeekSeed());

  const featured = {
    generatedAt: new Date().toISOString(),
    seed: isoWeekSeed(),
    articles: pickN(articles, 4, rng),
    products: pickN(products, 4, rng)
  };

  const outPath = path.join(process.cwd(), OUT);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(featured, null, 2), "utf8");

  console.log(`✅ featured.json: ${featured.articles.length} articles, ${featured.products.length} products (seed=${featured.seed})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
