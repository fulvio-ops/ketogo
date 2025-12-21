import fs from "node:fs/promises";
import path from "node:path";
import { SITE } from "../src/lib/config.ts";

const UA = process.env.REDDIT_UA || "ketogo/1.0 (static build)";
const now = Date.now();
const maxAgeSec = SITE.maxAgeDays * 24 * 3600;

async function fetchListing(sub) {
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=40`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Reddit fetch failed ${sub}: ${res.status}`);
  return res.json();
}

function pickThumb(data) {
  const p = data?.preview?.images?.[0]?.resolutions;
  if (Array.isArray(p) && p.length) {
    const mid = p[Math.min(3, p.length - 1)];
    return mid?.url?.replaceAll("&amp;", "&");
  }
  const t = data?.thumbnail;
  if (typeof t === "string" && t.startsWith("http")) return t;
  return undefined;
}

function toPost(child) {
  const d = child?.data;
  if (!d?.id || !d?.title || !d?.permalink) return null;

  // filtri base
  if (d.stickied) return null;
  if (d.over_18) return null;

  // età massima
  if (typeof d.created_utc === "number") {
    const age = now / 1000 - d.created_utc;
    if (age > maxAgeSec) return null;
  }

  const url = typeof d.url === "string" ? d.url : `https://www.reddit.com${d.permalink}`;

  return {
    id: d.id,
    title: d.title,
    url,
    permalink: `https://www.reddit.com${d.permalink}`,
    subreddit: d.subreddit || "reddit",
    author: d.author || "unknown",
    createdUtc: d.created_utc || 0,
    score: d.score || 0,
    comments: d.num_comments || 0,
    thumb: pickThumb(d),
    isVideo: Boolean(d.is_video),
    domain: d.domain
  };
}

function dedupeById(posts) {
  const m = new Map();
  for (const p of posts) if (!m.has(p.id)) m.set(p.id, p);
  return [...m.values()];
}

function sortForMagazine(posts) {
  // “Editor” senza testo tuo: immagine > engagement > freschezza
  return posts.sort((a, b) => {
    const aImg = a.thumb ? 1 : 0;
    const bImg = b.thumb ? 1 : 0;
    if (aImg !== bImg) return bImg - aImg;

    const aEng = (a.score || 0) + (a.comments || 0) * 2;
    const bEng = (b.score || 0) + (b.comments || 0) * 2;
    if (aEng !== bEng) return bEng - aEng;

    return (b.createdUtc || 0) - (a.createdUtc || 0);
  });
}

async function main() {
  const results = [];

  for (const sub of SITE.subreddits) {
    try {
      const json = await fetchListing(sub);
      const children = json?.data?.children || [];
      for (const c of children) {
        const p = toPost(c);
        if (p) results.push(p);
      }
    } catch (e) {
      console.error(String(e));
    }
  }

  const posts = sortForMagazine(dedupeById(results)).slice(0, SITE.limit);

  const out = {
    generatedAt: new Date().toISOString(),
    subreddits: SITE.subreddits,
    posts
  };

  const outDir = path.join(process.cwd(), "src", "data");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "posts.json"), JSON.stringify(out, null, 2), "utf8");

  console.log(`✅ Built posts.json with ${posts.length} items`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
