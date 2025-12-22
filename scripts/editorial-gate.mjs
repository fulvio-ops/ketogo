import vocab from "../src/soul/vocabulary.json" assert { type: "json" };
import scale from "../src/soul/editorial-scale.json" assert { type: "json" };

function wordCount(s){
  return String(s||"")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

const allowedByEn = new Map(vocab.allowed.map(v => [v.en, v]));

function levelOf(judgment){
  if (!judgment) return 0;
  const key = typeof judgment === "string" ? judgment : judgment.en;
  const v = allowedByEn.get(key);
  return v?.level ?? 0;
}

function assertNoForbidden(text, ctx){
  const t = String(text||"");
  for (const f of (vocab.forbidden_phrases || [])) {
    if (t.includes(f)) {
      throw new Error(`Editorial gate: forbidden phrase detected (${ctx}): "${f}"`);
    }
  }
}

function validateOne(post, where){
  if (!post?.title || !post?.url) throw new Error(`Editorial gate: missing title/url in ${where}`);
  if (!post?.judgment?.en || !post?.judgment?.it) throw new Error(`Editorial gate: missing judgment in ${where}`);

  const wc = wordCount(post.judgment.en);
  if (wc > (vocab.max_words || 7)) throw new Error(`Editorial gate: judgment too long (${wc} words) in ${where}`);

  // "No spiegazioni": blocchiamo pattern didascalici / moralisti (sul testo del giudizio)
  assertNoForbidden(post.judgment.it, `${where} (it)`);
  assertNoForbidden(post.judgment.en, `${where} (en)`);

  const lvl = levelOf(post.judgment);
  if (lvl < 2) throw new Error(`Editorial gate: judgment level ${lvl} not allowed in ${where}`);
  if (lvl === 2 && scale.levels?.["2"]?.allowed === "short_only" && wc > 3) {
    throw new Error(`Editorial gate: level-2 judgment must be ultra-short (<=3 words) in ${where}`);
  }
  return lvl;
}

export function validateFeatured(featured){
  const items = [
    ...(featured?.hero ? [{...featured.hero, __where:"hero"}] : []),
    ...((featured?.articles || []).map((p,i)=>({...p,__where:`article#${i+1}`}))),
    ...((featured?.oddities || []).map((p,i)=>({...p,__where:`oddity#${i+1}`})))
  ];

  const levels = [];
  for (const p of items) {
    levels.push(validateOne(p, p.__where));
  }

  // Vincoli di equilibrio (per evitare feed piatto)
  const minL4 = scale.featured_constraints?.min_level4_in_featured ?? 1;
  const l4 = levels.filter(l => l >= 4).length;
  if (l4 < minL4) throw new Error(`Editorial gate: need at least ${minL4} level-4 judgment(s) in featured, found ${l4}`);

  const maxL2Ratio = scale.featured_constraints?.max_level2_ratio ?? 0.6;
  const l2 = levels.filter(l => l === 2).length;
  if (items.length > 0 && (l2 / items.length) > maxL2Ratio) {
    throw new Error(`Editorial gate: too many level-2 judgments (${l2}/${items.length}). Feed would feel "piatto".`);
  }

  return true;
}
