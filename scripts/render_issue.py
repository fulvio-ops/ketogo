import json, os

ADMIN_PATH = "data/ketogo_admin.json"
CANDIDATES_PATH = "data/candidates.json"

HEADER = """# Ketogo — Backlog proposte

Qui trovi le proposte accumulate.
**Come funziona:**
1) Metti la spunta `[x]` sulle proposte da pubblicare
2) (Opzionale) modifica la riga `Titolo finale:`
3) Commenta `PUBBLICA` per pubblicare automaticamente

---
"""

def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    admin = load_json(ADMIN_PATH, {})
    issue_title = admin.get("issue_title", "Ketogo — Backlog proposte")
    max_items = int(admin.get("max_candidates_in_issue", 50))

    store = load_json(CANDIDATES_PATH, {"candidates": []})
    candidates = store.get("candidates", [])[:max_items]

    lines = [HEADER]
    if not candidates:
        lines.append("_Nessuna proposta al momento. Lo scout giornaliero riempirà questa lista._\n")
        print("".join(lines))
        return

    for c in candidates:
        cid = c.get("id","")
        title = c.get("title_suggested","")
        url = c.get("url","")
        source = c.get("source","")
        summary = c.get("summary","")
        title_final = c.get("title_final","")

        lines.append(f'- [ ] **(ID: {cid})** Titolo proposto: {title}\n')
        if source:
            lines.append(f'  - Fonte: {source}\n')
        lines.append(f'  - Link: {url}\n')
        if summary:
            lines.append(f'  - Nota: {summary}\n')
        lines.append(f'  - Titolo finale: {title_final}\n\n')

    print("".join(lines))

if __name__ == "__main__":
    main()
