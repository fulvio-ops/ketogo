import fs from "node:fs/promises";
import path from "node:path";

const SOURCE = "src/data/posts.json";
const OUT = "src/data/featured.json";
const PICK = 4;

// RNG deterministico
function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoWeekSeed(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return parseInt(`${date.getUTCFullYear()}${String(weekNo).padStart(2, "0")}`, 10);
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isShop(post) {
  const u = (post?.url || "").toLowerCase();
  const d = (post?.domain || "").toLowerCase();

  const shopDomains = [
    "amazon.", "amzn.", "ebay.", "etsy.", "aliexpress.", "alibaba.",
    "temu.", "shopify.", "store.", "walmart.", "bestbuy.", "ikea.",
    "subito.", "vinted.", "zalando.", "unieuro.", "mediaworld.", "boulanger."
  ];

  // segnali “shop”
  if (shopDomains.some(x => d.includes(x) || u.includes(x))) return true;
  if (u.includes("/dp/") || u.includes("/gp/") || u.includes("product") || u.includes("cart")) return true;
  return false;
}

async function main() {
  const raw = await fs.readFile(path.join(process.cwd(), SOURCE), "utf8");
  const data = JSON.parse(raw);

  const posts = Array.isArray(data?.posts) ? data.posts : [];
  const rng = mulberry32(isoWeekSeed());

  const shop = posts.filter(isShop);
  const nonShop = posts.filter(p => !isShop(p));

  const pickedShop = shuffle(shop, rng).slice(0, PICK);

  // se non bastano “shop”, riempi con altri post (meglio non rimanere vuoti)
  const needMore = PICK - pickedShop.length;
  const pickedArticles = shuffle(nonShop, rng).slice(0, PICK);

  const shopFill = needMore > 0
    ? shuffle(nonShop.filter(p => !pickedArticles.find(a => a.id === p.id)), rng).slice(0, needMore)
    : [];

  const featured = {
    generatedAt: new Date().toISOString(),
    seed: isoWeekSeed(),
    articles: pickedArticles,
    oddities: [...pickedShop, ...shopFill] // 4 elementi garantiti
  };

  await fs.mkdir(path.join(process.cwd(), "src", "data"), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), OUT), JSON.stringify(featured, null, 2), "utf8");

  console.log(`✅ featured.json: articles=${featured.articles.length} oddities=${featured.oddities.length} seed=${featured.seed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
