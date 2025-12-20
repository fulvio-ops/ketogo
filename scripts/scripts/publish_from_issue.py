import os, re, json, datetime

CANDIDATES_PATH = "data/candidates.json"
NUMERI_PATH = "data/numeri.json"

def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def parse_selected(issue_body: str):
    selected = []
    lines = issue_body.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"^- \[(x|X)\] \*\*\(ID: ([a-zA-Z0-9]{6,20})\)\*\*", line.strip())
        if m:
            cid = m.group(2)
            title_final = ""
            for j in range(i, min(i+10, len(lines))):
                m2 = re.search(r"Titolo finale:\s*(.*)$", lines[j])
                if m2:
                    title_final = m2.group(1).strip()
                    break
            selected.append((cid, title_final))
    return selected

def weekly_issue_id():
    today = datetime.date.today()
    y, w, _ = today.isocalendar()
    return int(f"{y}{w:02d}"), today.isoformat(), w, y

def main():
    issue_body_path = os.environ.get("ISSUE_BODY_PATH", "ISSUE_BODY.md")
    if not os.path.exists(issue_body_path):
        raise SystemExit("ISSUE_BODY.md not found")

    with open(issue_body_path, "r", encoding="utf-8") as f:
        body = f.read()

    chosen = parse_selected(body)
    if not chosen:
        print("No selected items.")
        return

    store = load_json(CANDIDATES_PATH, {"candidates": []})
    candidates = store.get("candidates", [])
    by_id = {c.get("id"): c for c in candidates}

    numeri = load_json(NUMERI_PATH, {"numeri": []})
    if "numeri" not in numeri:
        numeri = {"numeri": []}

    nid, date_iso, week, year = weekly_issue_id()
    numero = next((n for n in numeri["numeri"] if n.get("id") == nid), None)
    if not numero:
        numero = {"id": nid, "titolo": f"Ketogo #{week} ({year})", "tema": "Numero della settimana", "data": date_iso, "articoli": []}
        numeri["numeri"].insert(0, numero)

    published_ids = set()

    for cid, title_final in chosen:
        c = by_id.get(cid)
        if not c:
            continue
        titolo = title_final.strip() or c.get("title_suggested","")
        articolo = {
            "id": cid,
            "titolo": titolo,
            "testo": (c.get("summary") or "").strip(),
            "fonte": {"nome": c.get("source",""), "url": c.get("url","")}
        }
        if any(a.get("id") == cid for a in numero["articoli"]):
            continue
        numero["articoli"].append(articolo)
        published_ids.add(cid)

    # remove published from candidates
    candidates = [c for c in candidates if c.get("id") not in published_ids]
    save_json(CANDIDATES_PATH, {"candidates": candidates})
    save_json(NUMERI_PATH, numeri)

    print(f"Published {len(published_ids)} items. Backlog now {len(candidates)}.")

if __name__ == "__main__":
    main()
