import fs from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

// Inline config (avoids TS import issues)
const SITE = {
  title: "KETOGO",
  subtitle: "Weekly visual selection",
  subreddits: [
    "Damnthatsinteresting",
    "oddlysatisfying",
    "InternetIsBeautiful",
    "DesignPorn",
    "ShutUpAndTakeMyMoney",
    "gadgets",
    "BuyItForLife"
  ],
  limit: 30,
  maxAgeDays: 14
};

const UA = process.env.REDDIT_UA || "ketogo/1.0 (github-pages-build)";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function daysAgo(d) {
  const ms = Date.now() - d.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function clean(str) {
  return (str || "").toString().trim();
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json,text/plain,*/*"
    }
  });
  return res;
}

async function fetchRss(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/rss+xml,application/xml,text/xml,*/*"
    }
  });
  return res;
}

async function getFromRedditJson(sub) {
  const url = `https://www.reddit.com/r/${sub}/top.json?t=week&limit=50`;
  const res = await fetchJson(url);
  if (!res.ok) throw new Error(`Reddit fetch failed ${sub}: ${res.status}`);
  const data = await res.json();
  const children = data?.data?.children || [];
  return children.map((c) => {
    const p = c.data;
    return {
      id: p.id,
      title: p.title,
      url: p.url_overridden_by_dest || p.url,
      permalink: `https://www.reddit.com${p.permalink}`,
      subreddit: p.subreddit,
      author: p.author,
      createdUtc: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
      score: p.score ?? null,
      numComments: p.num_comments ?? null,
      thumbnail: (p.thumbnail && p.thumbnail.startsWith("http")) ? p.thumbnail : null,
      domain: p.domain ?? null
    };
  });
}

async function getFromRedditRss(sub) {
  // RSS is often less restricted than JSON endpoints
  const url = `https://www.reddit.com/r/${sub}/top/.rss?t=week`;
  const res = await fetchRss(url);
  if (!res.ok) throw new Error(`Reddit RSS failed ${sub}: ${res.status}`);
  const xml = await res.text();
  const data = parser.parse(xml);
  const entries = data?.feed?.entry || [];
  const arr = Array.isArray(entries) ? entries : [entries];

  return arr.map((e) => {
    const title = clean(e.title);
    const link = clean(e.link?.["@_href"] || e.link);
    const updated = clean(e.updated || e.published);
    const author = clean(e.author?.name);
    const id = clean(e.id) || link;

    // RSS link points to reddit comments, try to extract outbound link if present in content
    const content = clean(e.content?.["#text"] || e.content);
    let outbound = null;
    const m = content.match(/href="(https?:\/\/[^"]+)"/i);
    if (m && m[1]) outbound = m[1];

    return {
      id,
      title,
      url: outbound || link,
      permalink: link,
      subreddit: sub,
      author: author || null,
      createdUtc: updated || null,
      score: null,
      numComments: null,
      thumbnail: null,
      domain: null
    };
  });
}

async function fetchSubreddit(sub) {
  try {
    return await getFromRedditJson(sub);
  } catch (e) {
    // If JSON is blocked (403), try RSS
    const msg = String(e);
    if (msg.includes(": 403") || msg.includes(" 403")) {
      console.error(`⚠️ JSON blocked for ${sub} (403). Trying RSS...`);
      return await getFromRedditRss(sub);
    }
    throw e;
  }
}

async function main() {
  const all = [];
  for (const sub of SITE.subreddits) {
    try {
      const items = await fetchSubreddit(sub);
      all.push(...items);
    } catch (e) {
      console.error(String(e));
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  // filter recency if we have dates
  const filtered = all.filter((p) => {
    if (!p.createdUtc) return true;
    const d = new Date(p.createdUtc);
    if (Number.isNaN(d.getTime())) return true;
    return daysAgo(d) <= SITE.maxAgeDays;
  });

  const posts = uniqBy(filtered, (p) => p.url || p.permalink || p.id).slice(0, SITE.limit);

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
