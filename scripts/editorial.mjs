// scripts/editorial.mjs
import vocab from "../src/soul/vocabulary.json" with { type: "json" };

// Categorie editoriali (utili per etichette/filtri futuri)
export const CATEGORIES = [
  "NATURE",
  "HUMAN_BEHAVIOR",
  "TECH_PROGRESS",
  "OBJECT",
  "SYSTEM_FAILURE",
  "INEVITABILITY",
];

// Fallback micro-giudizi se nel vocabulary non troviamo match
const vocabByCat = {
  NATURE: ["Nature remains undefeated.", "Probably fine."],
  HUMAN_BEHAVIOR: ["Humanity is trying.", "Someone approved this.", "And yet, here we are."],
  TECH_PROGRESS: ["Progress update.", "No one asked for this.", "This felt like a good idea at the time."],
  OBJECT: ["This exists.", "Someone thought this through.", "No one asked for this."],
  SYSTEM_FAILURE: ["The system is working as intended.", "This didn’t need to happen."],
  INEVITABILITY: ["And yet, here we are.", "This will not be the last time."],
};

// Mappa EN -> oggetto completo {en,it,level,share,...}
const allowed = Array.isArray(vocab?.allowed) ? vocab.allowed : [];
const allowedMap = new Map(allowed.map((o) => [o.en, o]));

// Heaviness guard (taglia roba troppo dark)
export function isTooHeavy(post) {
  const t = (post?.title || "").toLowerCase();
  const heavy = [
    "murder", "killed", "dead", "death", "suicide", "rape",
    "terror", "hostage", "war", "genocide", "massacre",
    "shooting", "bomb", "torture", "beheaded",
  ];
  return heavy.some((w) => t.includes(w));
}

// Classificazione light (regole “editor”)
export function classify(post) {
  const title = (post?.title || "").toLowerCase();
  const subreddit = (post?.subreddit || "").toLowerCase();
  const domain = (post?.domain || "").toLowerCase();
  const url = (post?.url || "").toLowerCase();
  const has = (...w) => w.some((x) => title.includes(x));

  // euristica shop
  if (["amazon.", "amzn.", "etsy.", "ebay.", "aliexpress.", "temu.", "shopify."].some((x) => domain.includes(x) || url.includes(x))) {
    return "OBJECT";
  }
  if (["shutupandtakemymoney", "gadgets", "buyitforlife"].includes(subreddit)) return "OBJECT";

  // natura / animali
  if (has("seal", "seals", "whale", "shark", "crocodile", "octopus", "penguin", "cat", "dog", "bird", "spider", "snake", "eagle")) {
    return "NATURE";
  }

  // tecnologia / scienza
  if (has("ai", "robot", "research", "scientists", "prototype", "device", "engineers", "vr", "ar", "battery", "nasa", "space", "quantum")) {
    return "TECH_PROGRESS";
  }

  // fallimenti / incidenti (non gore)
  if (has("leak", "breach", "outage", "failure", "crash", "broken", "malfunction", "recall")) {
    return "SYSTEM_FAILURE";
  }

  // inevitabilità pesante (ma filtriamo già con isTooHeavy)
  if (has("war", "invasion", "genocide", "massacre", "hostage", "terror")) return "INEVITABILITY";

  return "HUMAN_BEHAVIOR";
}

// Prende un giudizio (EN/IT) dal vocabolario “anima”
// Priorità: match in vocabulary.json, altrimenti fallback per categoria.
function chooseJudgment(category) {
  const options = vocabByCat[category] || [];
  const sorted = [...options].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const en = sorted[0];
  const pair = allowedMap.get(en);

  // Se non esiste nel vocabolario, creiamo un oggetto minimale
  if (!pair) {
    return {
      en,
      it: en,       // se non abbiamo traduzione, duplico; meglio che null
      level: 3,     // neutro
      share: 3,     // neutro
    };
  }
  return pair; // contiene {en,it,level,share,...}
}

// APPROVAZIONE (il “gate” editoriale)
export function approve(post) {
  if (!post?.title || !post?.url) return null;
  if (isTooHeavy(post)) return null;

  const category = classify(post);
  if (!CATEGORIES.includes(category)) return null;

  const judgment = chooseJudgment(category);
  if (!judgment?.en) return null;

  // normalizzo
  const out = {
    ...post,
    category,
    judgment: {
      en: judgment.en,
      it: judgment.it || judgment.en,
      level: Number.isFinite(judgment.level) ? judgment.level : 3,
      share: Number.isFinite(judgment.share) ? judgment.share : 3,
    },
  };

  return out;
}

// LIVELLO editoriale (serve a pick-featured per “equilibrio”)
export function levelOf(post) {
  const v = post?.judgment?.level ?? post?.level ?? 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

// SCORE di selezione (shareability + presenza visual + compattezza titolo)
export function score(post) {
  let s = 0;
  if (post?.thumbnail) s += 3;
  if (post?.judgment?.en) s += 3;

  if (post?.category === "OBJECT") s += 1;
  if (post?.category === "NATURE") s += 1;

  const t = (post?.title || "").toLowerCase();
  if (["blood", "corpse", "assault", "mutilation"].some((w) => t.includes(w))) s -= 3;
  if ((post?.title || "").length < 90) s += 1;

  // spinta “condivisibilità” se presente nel vocabolario
  const sh = Number(post?.judgment?.share);
  if (Number.isFinite(sh)) s += Math.max(0, Math.min(5, sh)) * 0.6;

  return s;
}
