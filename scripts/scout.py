import feedparser, json, os
from bs4 import BeautifulSoup

def load(p, d):
    return json.load(open(p)) if os.path.exists(p) else d

admin = load("data/ketogo_admin.json", {})
feeds = admin.get("feeds", [])
store = load("data/candidates.json", {"candidates":[]})
cands = store["candidates"]
urls = {c.get("url") for c in cands}

for f in feeds:
    d = feedparser.parse(f["url"])
    for e in d.entries[:20]:
        url = getattr(e, "link", None)
        if not url or url in urls: continue
        title = getattr(e, "title", "")
        cands.insert(0, {"id": url[-10:], "title_suggested": title, "url": url})
        urls.add(url)

json.dump({"candidates": cands[:500]}, open("data/candidates.json","w"), indent=2)
print("Scout completed")
