// scripts/editorial.mjs
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

// --- Classificazione (euristiche veloci) ---
export function classify(post) {
  const title = (post?.title || "").toLowerCase();
  const subreddit = (post?.subreddit || "").toLowerCase();
  const domain = (post?.domain || "").toLowerCase();
  const url = (post?.url || "").toLowerCase();
  const has = (...w) => w.some((x) => title.includes(x));

  // "Shop" domains -> oggetto
  if (["amazon.", "amzn.", "etsy.", "ebay.", "aliexpress.", "temu.", "shopify."].some((x) => domain.includes(x) || url.includes(x))) {
    return "OBJECT";
  }

  // Sub "shop/gadget" -> oggetto
  if (["shutupandtakemymoney", "gadgets", "buyitforlife"].includes(subreddit)) return "OBJECT";

  // Natura
  if (has("seal", "seals", "whale", "shark", "crocodile", "octopus", "penguin", "cat", "dog", "bird", "spider", "snake", "eagle")) return "NATURE";

  // Tech
  if (has("ai", "robot", "research", "scientists", "prototype", "device", "engineers", "vr", "ar", "battery", "nasa", "space", "quantum")) return "TECH_PROGRESS";

  // Failure / incidenti tecnici
  if (has("leak", "breach", "outage", "failure", "crash", "broken", "malfunction", "recall")) return "SYSTEM_FAILURE";

  // “Inevitabilità” (tema cupo/geopolitico) — poi comunque filtriamo pesante sotto
  if (has("war", "invasion", "genocide", "massacre", "hostage", "terror")) return "INEVITABILITY";

  return "HUMAN_BEHAVIOR";
}

// --- Sicurezza editoriale: taglia il “troppo pesante” ---
export function isTooHeavy(post) {
  const t = (post?.title || "").toLowerCase();
  const heavy = [
    "murder", "killed", "dead", "death", "suicide",
    "rape", "terror", "hostage", "war", "genocide",
    "massacre", "shooting", "bomb", "torture", "beheaded",
  ];
  return heavy.some((w) => t.includes(w));
}

function chooseJudgment(category) {
  const options = vocabByCat[category] || [];
  const sorted = [...options].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const en = sorted[0];
  const pair = allowedMap.get(en);
  return pair || null; // {en,it}
}

// --- “Approvazione” editoriale: decide se pubblichiamo e aggiunge giudizio ---
export function approve(post) {
  if (!post?.title || !post?.url) return null;
  if (isTooHeavy(post)) return null;

  const category = classify(post);
  if (!CATEGORIES.includes(category)) return null;

  const judgment = chooseJudgment(category);
  if (!judgment) return null;

  return { ...post, category, judgment };
}

// --- Punteggio di condivisibilità (semplice, stabile, orientato a “compagnia”) ---
export function score(post) {
  let s = 0;

  // presenza immagine/preview
  if (post?.thumbnail) s += 3;
  if (post?.image) s += 2;

  // micro-giudizio = firma editoriale
  if (post?.judgment?.en) s += 3;

  // categorie che tendono a “girare” meglio
  if (post?.category === "OBJECT") s += 1;
  if (post?.category === "NATURE") s += 1;

  const t = (post?.title || "").toLowerCase();

  // penalità per gore/violenza (anche se “non heavy”)
  if (["blood", "corpse", "assault", "mutilation"].some((w) => t.includes(w))) s -= 3;

  // titolo troppo lungo = meno share
  if ((post?.title || "").length < 90) s += 1;

  return s;
}

// --- Livello (1..5) per bilanciare il mix “piatto/non piatto” ---
// Nota: NON è “disturbante/colto/ironico” in astratto: è un proxy operativo
// che aiuta a comporre una selezione più viva (in base al punteggio share).
export function levelOf(post) {
  const s = score(post);

  if (s >= 8) return 5;
  if (s >= 6) return 4;
  if (s >= 4) return 3;
  if (s >= 2) return 2;
  return 1;
}
