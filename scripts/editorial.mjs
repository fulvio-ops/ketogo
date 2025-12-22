// /scripts/editorial.mjs
// “Anima editoriale”: classificazione + filtro + micro-giudizio + punteggio
// Usa /src/soul/vocabulary.json come fonte immutabile di frasi APPROVATE.

import vocab from "../src/soul/vocabulary.json" assert { type: "json" };

export const CATEGORIES = [
  "NATURE",
  "HUMAN_BEHAVIOR",
  "TECH_PROGRESS",
  "OBJECT",
  "SYSTEM_FAILURE",
  "INEVITABILITY",
];

// Fallback minimale se vocabulary.json non avesse abbastanza frasi per categoria
const fallbackByCat = {
  NATURE: ["Nature remains undefeated.", "Probably fine."],
  HUMAN_BEHAVIOR: ["Humanity is trying.", "Someone approved this.", "And yet, here we are."],
  TECH_PROGRESS: ["Progress update.", "No one asked for this.", "This felt like a good idea at the time."],
  OBJECT: ["This exists.", "Someone thought this through.", "No one asked for this."],
  SYSTEM_FAILURE: ["The system is working as intended.", "This didn’t need to happen."],
  INEVITABILITY: ["And yet, here we are.", "This will not be the last time."],
};

// ---------- Utility deterministica (così non ripete sempre la stessa frase) ----------
function hashStringToUint32(str) {
  // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickDeterministic(list, key) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const rng = mulberry32(hashStringToUint32(String(key)));
  const idx = Math.floor(rng() * list.length);
  return list[idx];
}

// ---------- Vocabolario: indicizzazione tollerante ----------
const allowed = Array.isArray(vocab?.allowed) ? vocab.allowed : [];

// allowedMap: key=en → entry
const allowedMap = new Map(
  allowed
    .filter((o) => o && typeof o.en === "string" && typeof o.it === "string")
    .map((o) => [o.en, o])
);

// Raggruppa per categoria se presente (opzionale)
const allowedByCategory = new Map();
for (const entry of allowedMap.values()) {
  const cat = entry.category;
  if (!cat || typeof cat !== "string") continue;
  if (!allowedByCategory.has(cat)) allowedByCategory.set(cat, []);
  allowedByCategory.get(cat).push(entry);
}

// ---------- Classificazione ----------
export function classify(post) {
  const title = (post?.title || "").toLowerCase();
  const subreddit = (post?.subreddit || "").toLowerCase();
  const domain = (post?.domain || "").toLowerCase();
  const url = (post?.url || "").toLowerCase();
  const has = (...w) => w.some((x) => title.includes(x));

  // “OBJECT” se sembra commerce o viene dai sub gadget
  if (["amazon.", "amzn.", "etsy.", "ebay.", "aliexpress.", "temu.", "shopify."].some((x) => domain.includes(x) || url.includes(x))) {
    return "OBJECT";
  }
  if (["shutupandtakemymoney", "gadgets", "buyitforlife"].includes(subreddit)) return "OBJECT";

  // NATURE
  if (has("seal", "seals", "whale", "shark", "crocodile", "octopus", "penguin", "cat", "dog", "bird", "spider", "snake", "eagle", "bear", "wolf")) {
    return "NATURE";
  }

  // TECH
  if (has("ai", "robot", "research", "scientists", "prototype", "device", "engineers", "vr", "ar", "battery", "nasa", "space", "quantum", "chip", "lab")) {
    return "TECH_PROGRESS";
  }

  // SYSTEM FAILURE
  if (has("leak", "breach", "outage", "failure", "crash", "broken", "malfunction", "recall", "bug", "downtime")) {
    return "SYSTEM_FAILURE";
  }

  // INEVITABILITY (argomenti “pesanti” geopolitici ecc.) — spesso li scarteremo dopo
  if (has("war", "invasion", "genocide", "massacre", "hostage", "terror", "bombing")) return "INEVITABILITY";

  return "HUMAN_BEHAVIOR";
}

// ---------- Filtro “troppo pesante” ----------
export function isTooHeavy(post) {
  const t = (post?.title || "").toLowerCase();
  const heavy = [
    "murder","killed","dead","death","suicide","rape","terror","hostage","war",
    "genocide","massacre","shooting","bomb","torture","beheaded","child abuse","assault"
  ];
  return heavy.some((w) => t.includes(w));
}

// ---------- Micro-giudizio: prende da vocabulary.json (se c’è), altrimenti fallback ----------
function chooseJudgment(category, post, seed = "default") {
  // 1) prova frasi “allowed” per categoria (se presenti nel json)
  const pool = allowedByCategory.get(category);
  if (Array.isArray(pool) && pool.length) {
    // scelta deterministica per settimana/post (così varia ma non “balla” a ogni build)
    const chosen = pickDeterministic(pool, `${seed}:${post?.id || post?.url || post?.title || "x"}`);
    if (chosen) return chosen; // {en,it,...}
  }

  // 2) fallback: usa le stringhe hardcoded e cerca la coppia en/it nel json, se esiste
  const fb = fallbackByCat[category] || [];
  const en = pickDeterministic(fb, `${seed}:${category}:${post?.id || post?.url || post?.title || "x"}`);
  if (!en) return null;

  // se nel vocabulary esiste la stessa en, usa quella (con it coerente)
  const fromAllowed = allowedMap.get(en);
  if (fromAllowed) return fromAllowed;

  // altrimenti crea una coppia base (IT minimale)
  return { en, it: en };
}

// ---------- Approva: qui avviene il “controllo editore” ----------
export function approve(post, seed = "default") {
  if (!post?.title || !post?.url) return null;
  if (isTooHeavy(post)) return null;

  const category = classify(post);
  if (!CATEGORIES.includes(category)) return null;

  const judgment = chooseJudgment(category, post, seed);
  if (!judgment || !judgment.en || !judgment.it) return null;

  return { ...post, category, judgment };
}

// ---------- Score (shareability) ----------
export function score(post) {
  let s = 0;

  // segnali di “cliccabilità”
  if (post.thumbnail) s += 3;
  if (post.judgment?.en) s += 3;

  // categorie che performano bene nel tuo modello “compagnia + share”
  if (post.category === "OBJECT") s += 2;
  if (post.category === "NATURE") s += 2;
  if (post.category === "TECH_PROGRESS") s += 1;

  // titolo troppo lungo = meno share
  if ((post.title || "").length < 90) s += 1;

  // penalità “gore/violenza” anche se non è scattato il filtro heavy
  const t = (post.title || "").toLowerCase();
  if (["blood", "corpse", "assault", "mutilation"].some((w) => t.includes(w))) s -= 5;

  return s;
}

