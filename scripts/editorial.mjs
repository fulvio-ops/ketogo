import soul from "../src/editorial/soul.json" assert { type: "json" };

export function classify(post) {
  const title = (post?.title || "").toLowerCase();
  const subreddit = (post?.subreddit || "").toLowerCase();
  const domain = (post?.domain || "").toLowerCase();
  const url = (post?.url || "").toLowerCase();

  const has = (...words) => words.some(w => title.includes(w));

  if (["amazon.", "amzn.", "etsy.", "ebay.", "aliexpress.", "temu.", "shopify."].some(x => domain.includes(x) || url.includes(x))) {
    return "OBJECT";
  }
  if (["shutupandtakemymoney", "gadgets", "buyitforlife"].includes(subreddit)) {
    return "OBJECT";
  }
  if (has("seal","seals","whale","shark","crocodile","octopus","penguin","cat","dog","bird","spider","snake")) {
    return "NATURE";
  }
  if (has("ai","robot","research","scientists","prototype","device","engineers","vr","ar","battery","nasa","space","quantum")) {
    return "TECH_PROGRESS";
  }
  if (has("killed","murder","shot","crime","family","celebrity","politics","protest","scandal")) {
    return "HUMAN_BEHAVIOR";
  }
  if (has("leak","breach","outage","failure","crash","broken","malfunction","recall")) {
    return "SYSTEM_FAILURE";
  }
  return "HUMAN_BEHAVIOR";
}

export function isTooHeavy(post) {
  const t = (post?.title || "").toLowerCase();
  const heavy = ["murder","killed","dead","death","suicide","rape","terror","hostage","war","genocide","massacre","shooting","bomb","torture"];
  return heavy.some(w => t.includes(w));
}

export function approve(post) {
  if (!post?.title || !post?.url) return null;
  if (isTooHeavy(post)) return null;

  const category = classify(post);
  if (!soul.categories.includes(category)) return null;

  const options = soul.vocabulary[category] || [];
  if (!options.length) return null;

  const sorted = [...options].sort((a, b) => (a.en.length - b.en.length) || a.en.localeCompare(b.en));
  const judgment = sorted[0];

  return { ...post, category, judgment };
}
