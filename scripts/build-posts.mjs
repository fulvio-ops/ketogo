import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sources from "../src/soul/sources.json" with { type: "json" };

// Minimal RSS fetch + parse (no external deps)
function strip(s) { return String(s || "").trim(); }
function decodeHtml(s){
  return strip(s)
    .replace(/&amp;/g,"&")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">")
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'");
}

function pickBetween(hay, a, b){
  const i = hay.indexOf(a);
  if (i < 0) return "";
  const j = hay.indexOf(b, i + a.length);
  if (j < 0) return "";
  return hay.slice(i + a.length, j);
}

function parseRss(xml, subredditName){
  const items = [];
  const parts = xml.split("<entry>");
  for (let k=1;k<parts.length;k++){
    const entry = parts[k];
    const title = decodeHtml(pickBetween(entry, "<title>", "</title>"));
    const linkTag = pickBetween(entry, '<link rel="alternate" type="text/html" href="', '"');
    const url = linkTag || decodeHtml(pickBetween(entry, "<link>", "</link>"));
    const id = decodeHtml(pickBetween(entry, "<id>", "</id>")) || url;
    const updated = decodeHtml(pickBetween(entry, "<updated>", "</updated>"));
    // Reddit RSS content sometimes contains an <img ... src="...">
    const content = entry;
    let thumb = "";
    const imgSrc = pickBetween(content, 'src="', '"');
    if (imgSrc && imgSrc.startsWith("http")) thumb = imgSrc;

    if (!title || !url) continue;
    items.push({
      id,
      title,
      url,
      subreddit: subredditName,
      subreddit_name_prefixed: "r/" + subredditName,
      domain: (() => { try { return new URL(url).hostname; } catch { return ""; } })(),
      thumbnail: thumb || "",
      created_utc: updated ? Date.parse(updated)/1000 : undefined
    });
  }
  return items;
}

async function fetchText(url){
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ketogo-bot/1.0 (RSS)"
    }
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`);
  return await res.text();
}

async function readJsonSafe(p){
  try{ return JSON.parse(await fs.readFile(p, "utf8")); } catch { return null; }
}

function uniqByUrl(arr){
  const seen = new Set();
  const out = [];
  for (const p of arr){
    const key = p?.url || p?.id;
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

async function main(){
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const dataDir = path.join(__dirname, "..", "src", "data");
  const outPath = path.join(dataDir, "posts.json");

  const prev = await readJsonSafe(outPath);
  const prevPosts = Array.isArray(prev?.posts) ? prev.posts : [];

  const subs = sources?.reddit?.subreddits || [];
  const feeds = sources?.rss_fallback?.feeds || [];

  let posts = [];
  let used = [];

  // RSS fallback (stable and public)
  for (const f of feeds){
    try{
      const xml = await fetchText(f.url);
      const parsed = parseRss(xml, f.name);
      posts.push(...parsed);
      used.push(f.name);
    } catch (e){
      console.error("RSS error:", f.url, e?.message || e);
    }
  }

  posts = uniqByUrl(posts);

  // If everything failed, DO NOT overwrite with empty: keep last good file.
  if (posts.length === 0 && prevPosts.length > 0){
    console.warn("No new posts fetched; keeping previous posts.json");
    return;
  }

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    subreddits: used.length ? used : subs,
    posts
  }, null, 2), "utf8");

  console.log(`posts.json written: ${posts.length} posts from ${used.join(", ")}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
