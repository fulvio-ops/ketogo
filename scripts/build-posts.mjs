// scripts/build-posts.mjs
// Fetch posts from Reddit via public RSS (works when JSON is blocked).
// HARD GUARDS:
// - FAIL the build if we would write an empty posts.json (never deploy empty silently)
// - NEVER overwrite a previously non-empty posts.json with an empty one
//
// Output: src/data/posts.json  { generatedAt, sourcesUsed, subreddits, posts: [...] }

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SUBS = [
  "Damnthatsinteresting",
  "oddlysatisfying",
  "InternetIsBeautiful",
  "DesignPorn",
  "ShutUpAndTakeMyMoney",
  "gadgets",
  "BuyItForLife",
];

function rssUrl(sub) {
  return `https://www.reddit.com/r/${sub}/.rss`;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "ketogo-bot/1.0 (+github-actions)",
      "accept": "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Fetch failed ${res.status} for ${url}`);
    err.status = res.status;
    err.body = body?.slice?.(0, 200) || "";
    throw err;
  }
  return await res.text();
}

function parseRss(xml, subreddit) {
  const items = [];
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/g) || [];
  for (const e of entries) {
    const title = (e.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    const link = e.match(/<link[^>]*href="([^"]+)"/)?.[1] || "";
    const id = e.match(/<id[^>]*>([\s\S]*?)<\/id>/)?.[1]?.trim() || link;
    const published = e.match(/<published[^>]*>([\s\S]*?)<\/published>/)?.[1]?.trim() || "";
    const updated = e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1]?.trim() || published;

    if (!title || !link) continue;

    const url = link.replace(/^http:\/\//, "https://");
    items.push({
      id,
      title,
      url,
      subreddit,
      source: "reddit-rss",
      created_utc: updated ? Date.parse(updated) / 1000 : null,
      date: updated || published || null,
      domain: (() => { try { return new URL(url).hostname; } catch { return ""; } })(),
      thumbnail: null,
    });
  }
  return items;
}

function uniqByUrl(posts) {
  const seen = new Set();
  const out = [];
  for (const p of posts) {
    const key = p?.url || p?.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
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
  const outPath = path.join(dataDir, "posts.json");

  const prev = await readJsonSafe(outPath);
  const prevPosts = Array.isArray(prev?.posts) ? prev.posts : [];

  const subreddits = (process.env.KETOGO_SUBS ? process.env.KETOGO_SUBS.split(",") : DEFAULT_SUBS)
    .map((s) => s.trim())
    .filter(Boolean);

  let posts = [];
  const used = [];

  for (const sub of subreddits) {
    const url = rssUrl(sub);
    try {
      const xml = await fetchText(url);
      const parsed = parseRss(xml, sub);
      if (parsed.length > 0) {
        posts.push(...parsed);
        used.push(`rss:${sub}`);
      }
    } catch (e) {
      console.warn(`RSS failed for ${sub}: ${e?.status || ""} ${e?.message || e}`);
    }
  }

  posts = uniqByUrl(posts);

  if (posts.length === 0) {
    const reason = prevPosts.length > 0
      ? `No posts fetched; refusing to overwrite existing posts.json (${prevPosts.length} items).`
      : "No posts fetched; posts.json would be empty.";
    console.error(`❌ build-posts: ${reason}`);
    throw new Error(reason);
  }

  await writeJson(outPath, {
    generatedAt: new Date().toISOString(),
    sourcesUsed: used,
    subreddits,
    posts,
  });

  console.log(`✅ Built posts.json with ${posts.length} items`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
