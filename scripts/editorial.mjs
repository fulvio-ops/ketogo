// scripts/editorial.mjs
// Editorial "soul": classify, veto heavy content, attach micro-judgments, score & level.

import vocab from "../src/soul/vocabulary.json" with { type: "json" };

export const CATEGORIES = [
  "NATURE",
  "HUMAN_BEHAVIOR",
  "TECH_PROGRESS",
  "OBJECT",
  "SYSTEM_FAILURE",
  "INEVITABILITY",
];

const vocabByCat = {
  NATURE: ["Nature remains undefeated.", "Probably fine."],
  HUMAN_BEHAVIOR: ["Humanity is trying.", "Someone approved this.", "And yet, here we are."],
  TECH_PROGRESS: ["Progress update.", "No one asked for this.", "This felt like a good idea at the time."],
  OBJECT: ["This exists.", "Someone thought this through.", "No one asked for this."],
  SYSTEM_FAILURE: ["The system is working as intended.", "This didn’t need to happen."],
  INEVITABILITY: ["And yet, here we are.", "This will not be the last time."],
};

const allowedMap = new Map((vocab?.allowed || []).map((o) => [o.en, o]));

export function classify(post) {
  const title = (post?.title || "").toLowerCase();
  const subreddit = (post?.subreddit || "").toLowerCase();
  const domain = (post?.domain || "").toLowerCase();
  const url = (post?.url || "").toLowerCase();
  const has = (...w) => w.some((x) => title.includes(x));

  if (["amazon.", "amzn.", "etsy.", "ebay.", "aliexpress.", "temu.", "shopify."].some((x) => domain.includes(x) || url.includes(x))) return "OBJECT";
  if (["shutupandtakemymoney", "gadgets", "buyitforlife"].includes(subreddit)) return "OBJECT";
  if (has("seal", "seals", "whale", "shark", "crocodile", "octopus", "penguin", "cat", "dog", "bird", "spider", "snake", "eagle")) return "NATURE";
  if (has("ai", "robot", "research", "scientists", "prototype", "device", "engineers", "vr", "ar", "battery", "nasa", "space", "quantum")) return "TECH_PROGRESS";
  if (has("leak", "breach", "outage", "failure", "crash", "broken", "malfunction", "recall")) return "SYSTEM_FAILURE";
  if (has("war", "invasion", "genocide", "massacre", "hostage", "terror")) return "INEVITABILITY";
  return "HUMAN_BEHAVIOR";
}

export function isTooHeavy(post) {
  const t = (post?.title || "").toLowerCase();
  const heavy = [
    "murder","killed","dead","death","suicide","rape","terror","hostage",
    "war","genocide","massacre","shooting","bomb","torture","beheaded",
  ];
  return heavy.some((w) => t.includes(w));
}

function chooseJudgment(category) {
  const options = vocabByCat[category] || [];
  const sorted = [...options].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const en = sorted[0];
  const pair = allowedMap.get(en);
  return pair || null;
}

export function approve(post) {
  if (!post?.title || !post?.url) return null;
  if (isTooHeavy(post)) return null;
  const category = classify(post);
  if (!CATEGORIES.includes(category)) return null;
  const judgment = chooseJudgment(category);
  if (!judgment) return null;
  return { ...post, category, judgment };
}

export function score(post) {
  let s = 0;
  if (post?.thumbnail) s += 3;
  if (post?.judgment?.en) s += 3;
  if (post?.category === "OBJECT") s += 1;
  if (post?.category === "NATURE") s += 1;

  const t = (post?.title || "").toLowerCase();
  if (["blood","corpse","assault","mutilation"].some((w) => t.includes(w))) s -= 3;
  if ((post?.title || "").length < 90) s += 1;

  return s;
}

export function levelOf(post) {
  const s = score(post);
  if (post?.category === "OBJECT" && s >= 6) return 5;
  if (s >= 7) return 5;
  if (s >= 5) return 4;
  if (s >= 3) return 3;
  if (s >= 1) return 2;
  return 1;
}
