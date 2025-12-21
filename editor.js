async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossibile leggere ${path} (${res.status})`);
  return await res.json();
}

function norm(s) {
  return (s || "").toString().toLowerCase();
}

function uniq(arr) {
  return Array.from(new Set(arr)).sort((a,b)=>a.localeCompare(b,'it'));
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

let state = {
  items: [],
  selected: new Set(),
  edits: new Map(), // id -> edited title
};

function getId(item, idx) {
  // id stabile: usa url se presente, altrimenti idx
  return item.url ? `u:${item.url}` : `i:${idx}`;
}

function renderTagOptions(items) {
  const tags = uniq(items.map(x => x.tag).filter(Boolean));
  const sel = document.getElementById("filterTag");
  sel.innerHTML = `<option value="">Tutti i tag</option>` + tags.map(t => `<option value="${t}">${t}</option>`).join("");
}

function applyFilters() {
  const q = norm(document.getElementById("q").value);
  const tag = document.getElementById("filterTag").value;
  const sortBy = document.getElementById("sortBy").value;

  let items = [...state.items];

  if (tag) items = items.filter(x => (x.tag || "") === tag);

  if (q) {
    items = items.filter(x =>
      norm(x.title).includes(q) ||
      norm(x.source).includes(q) ||
      norm(x.tag).includes(q)
    );
  }

  // sorting
  const byDate = (a,b) => (new Date(a.date || 0)).getTime() - (new Date(b.date || 0)).getTime();
  const byScore = (a,b) => (Number(a.score || 0)) - (Number(b.score || 0));

  if (sortBy === "date_desc") items.sort((a,b)=>byDate(b,a));
  if (sortBy === "date_asc") items.sort((a,b)=>byDate(a,b));
  if (sortBy === "score_desc") items.sort((a,b)=>byScore(b,a));

  return items;
}

function updateKPIs() {
  document.getElementById("kpiCandidates").textContent = `${state.items.length} proposte`;
  document.getElementById("kpiSelected").textContent = `${state.selected.size} selezionate`;
}

function cardHTML(item, idx) {
  const id = getId(item, idx);
  const checked = state.selected.has(id) ? "checked" : "";
  const edited = state.edits.get(id) ?? item.title ?? "";
  const date = item.date ? new Date(item.date).toLocaleDateString("it-IT") : "—";
  const score = (item.score !== undefined) ? `score: ${item.score}` : null;

  const meta = [
    item.tag ? `<span class="tag">${item.tag}</span>` : "",
    item.source ? `<span class="tag">${item.source}</span>` : "",
    `<span class="tag">${date}</span>`,
    score ? `<span class="tag">${score}</span>` : ""
  ].filter(Boolean).join("");

  const link = item.url ? `<a class="link" href="${item.url}" target="_blank" rel="noopener">Apri fonte</a>` : "";

  return `
    <div class="card" data-id="${id}">
      <div class="row">
        <input class="chk" type="checkbox" ${checked} />
        <div style="flex:1">
          <input class="title" value="${escapeHtml(edited)}" />
          <div class="meta">${meta}</div>
          <div style="margin-top:8px; display:flex; gap:10px; align-items:center;">
            ${link}
          </div>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return (str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderList() {
  const list = document.getElementById("list");
  const filtered = applyFilters();
  list.innerHTML = filtered.map((it, i) => cardHTML(it, i)).join("");

  // bind events
  list.querySelectorAll(".card").forEach((card, i) => {
    const id = card.getAttribute("data-id");
    const chk = card.querySelector(".chk");
    const title = card.querySelector(".title");

    chk.addEventListener("change", () => {
      if (chk.checked) state.selected.add(id);
      else state.selected.delete(id);
      updateKPIs();
    });

    title.addEventListener("input", () => {
      state.edits.set(id, title.value);
    });
  });

  updateKPIs();
}

function exportSelected() {
  const now = new Date().toISOString();
  const out = [];

  state.items.forEach((item, idx) => {
    const id = getId(item, idx);
    if (!state.selected.has(id)) return;

    out.push({
      ...item,
      title: (state.edits.get(id) ?? item.title ?? "").trim(),
      approved_at: now
    });
  });

  // preview
  const box = document.getElementById("exportBox");
  const pre = document.getElementById("exportPreview");
  box.classList.remove("hidden");
  pre.textContent = JSON.stringify(out, null, 2);

  // download
  download("publish_queue.json", JSON.stringify(out, null, 2));
}

function clearSelection() {
  state.selected.clear();
  renderList();
}

function selectAllVisible() {
  const filtered = applyFilters();
  filtered.forEach((item, idx) => state.selected.add(getId(item, idx)));
  renderList();
}

async function main() {
  try {
    // carico candidates
    const candidates = await loadJSON("data/candidates.json");
    state.items = Array.isArray(candidates) ? candidates : (candidates.items || []);
    renderTagOptions(state.items);
    renderList();
  } catch (e) {
    document.getElementById("list").innerHTML = `
      <div class="card">
        <b>Errore:</b> ${escapeHtml(e.message)}
        <div class="meta" style="margin-top:8px">
          Verifica che <code>data/candidates.json</code> esista e sia pubblicato su GitHub Pages.
        </div>
      </div>
    `;
  }

  document.getElementById("q").addEventListener("input", renderList);
  document.getElementById("filterTag").addEventListener("change", renderList);
  document.getElementById("sortBy").addEventListener("change", renderList);

  document.getElementById("btnExport").addEventListener("click", exportSelected);
  document.getElementById("btnClear").addEventListener("click", clearSelection);
  document.getElementById("btnSelectAll").addEventListener("click", selectAllVisible);
}

main();
