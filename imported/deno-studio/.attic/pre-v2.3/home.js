/**
 * home.js — mission control for projects, assets, workflows, and references.
 *
 * Home is the shelf. Workshop is the graph. New writes a studio project, then
 * opens its blueprint. Extracting a reel stays Open video / ?open=1.
 */

const healthEl = document.getElementById("health");
const projectGrid = document.getElementById("project-grid");
const assetGrid = document.getElementById("asset-grid");
const refGrid = document.getElementById("ref-grid");
const flowGrid = document.getElementById("flow-grid");
const empty = document.getElementById("empty");
const assetsEmpty = document.getElementById("assets-empty");
const refsEmpty = document.getElementById("refs-empty");
const workflowsEmpty = document.getElementById("workflows-empty");
const searchInput = document.getElementById("home-search");
const toastEl = document.getElementById("toast");
const projectsPanel = document.getElementById("projects-panel");
const assetsPanel = document.getElementById("assets-panel");
const refsPanel = document.getElementById("refs-panel");
const workflowsPanel = document.getElementById("workflows-panel");
const resultCount = document.getElementById("result-count");
const starChip = document.getElementById("star-chip");
const sortBtn = document.getElementById("sort-btn");
const sortMenu = document.getElementById("sort-menu");
const sortLabel = document.getElementById("sort-label");

/** @type {Array<Record<string, unknown>>} */
let projects = [];
/** @type {Array<Record<string, unknown>>} */
let references = [];
/** @type {Array<Record<string, unknown>>} */
let flows = [];
/** @type {Array<Record<string, unknown>>} */
let modelCatalog = [];
/** @type {string} */
let currentTab = "projects";
/** @type {string | null} */
let selectedId = null;
/** @type {string} */
let refKind = "all";
let toastTimer = 0;
let filterFav = false;
/** @type {string[]} */
let facetDecade = [];
/** @type {string[]} */
let facetSpace = [];
/** @type {string[]} */
let facetStyle = [];
let sortKey = "recent";
let sortDir = "desc";
const TAG_KEY = "ars-technicai-project-tags";
let openMenuId = null;
let newMedia = "movie";
/** @type {File[]} */
let newFiles = [];

const KINDS = ["all", "movie", "comic", "script", "star"];
const MEDIA_TYPES = [
  ["movie", "Movie"],
  ["tv", "TV"],
  ["reel", "Reel"],
  ["comic", "Comic"],
  ["manga", "Manga"],
  ["music", "Music"],
  ["book", "Book"],
];
const DECADE_RE = /^(Pre_?\d+|\d{4}s|Modern|contemporary)$/i;
const SPACE_TAGS = new Set([
  "urban", "interior", "exterior", "western", "chamber", "chamber-drama",
  "institutional", "american", "european", "japanese", "korean", "british",
  "wide", "close-up", "two-shot", "print",
]);

function loadTagMap() {
  try {
    const raw = localStorage.getItem(TAG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** @type {Record<string, string[]>} */
let tagMap = loadTagMap();

function saveTagMap() {
  try {
    localStorage.setItem(TAG_KEY, JSON.stringify(tagMap));
  } catch { /* */ }
}

function tagsFor(pOrId) {
  if (pOrId && typeof pOrId === "object") {
    if (Array.isArray(pOrId.tags) && pOrId.tags.length) return pOrId.tags;
    return tagsFor(projectId(pOrId));
  }
  const id = String(pOrId ?? "");
  return Array.isArray(tagMap[id]) ? tagMap[id] : [];
}

function projectId(p) {
  return String(p.project_id ?? p.id ?? "");
}

function projectName(p) {
  return String(p.source_name ?? p.name ?? projectId(p)).replace(/\.[^.]+$/, "") || projectId(p);
}

function frameCount(p) {
  const n = p.frame_count ?? p.frames ?? p.extraction?.frame_count ?? p.source?.frame_count;
  return Number.isFinite(Number(n)) ? Number(n) : 0;
}

function createdAt(p) {
  const t = Date.parse(String(p.created_at ?? p.createdAt ?? ""));
  if (Number.isFinite(t) && t > 0) return t;
  const unix = Number(p.created_at);
  return Number.isFinite(unix) && unix > 0 ? (unix < 1e12 ? unix * 1000 : unix) : 0;
}

function thumbUrl(pid, frame = 0, edge = 360) {
  return `/api/project/${encodeURIComponent(pid)}/frame/${frame}?max_edge=${edge}`;
}

function toast(message, bad = false) {
  toastEl.textContent = message;
  toastEl.className = bad ? "toast bad" : "toast";
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, bad ? 5200 : 3200);
}

function activeProjectId() {
  if (selectedId && projects.some((p) => projectId(p) === selectedId)) return selectedId;
  return projects.length ? projectId(projects[0]) : null;
}

function workshopHref(opts = {}) {
  const u = new URL("/blueprint/", location.origin);
  const id = opts.project ?? null;
  if (id) u.searchParams.set("project", id);
  if (opts.pane) u.searchParams.set("pane", opts.pane);
  if (opts.open) u.searchParams.set("open", "1");
  if (opts.export) u.searchParams.set("export", "1");
  if (opts.tool) u.searchParams.set("tool", opts.tool);
  if (opts.flow) u.searchParams.set("flow", opts.flow);
  if (opts.ref) u.searchParams.set("ref", opts.ref);
  return u.pathname + u.search;
}

async function refreshHealth() {
  try {
    const r = await fetch("/api/health", { signal: AbortSignal.timeout(2500) });
    if (!r.ok) throw new Error(String(r.status));
    const h = await r.json();
    healthEl.textContent = `engine ok · opencv ${h.opencv ?? "?"}`;
    healthEl.className = "status ok";
  } catch {
    healthEl.textContent = "engine offline";
    healthEl.className = "status down";
  }
}

function sortKeysForTab() {
  if (currentTab === "refs") {
    return [["year", "Year"], ["score", "Score"], ["kind", "Kind"], ["name", "Name"]];
  }
  if (currentTab === "workflows") {
    return [["recent", "Recent"], ["name", "Name"], ["nodes", "Nodes"], ["kind", "Media"]];
  }
  if (currentTab === "assets") return [["frames", "Index"], ["name", "Name"]];
  return [
    ["recent", "Recent"],
    ["name", "Name"],
    ["kind", "Media"],
    ["frames", "Frames"],
    ["favorite", "Starred first"],
  ];
}

function dirMark() {
  return sortDir === "asc" ? "↑" : "↓";
}

function paintSortMenu() {
  const keys = sortKeysForTab();
  if (!keys.some(([k]) => k === sortKey)) {
    sortKey = keys[0][0];
    sortDir = sortKey === "name" || sortKey === "kind" ? "asc" : "desc";
  }
  sortLabel.textContent = keys.find(([k]) => k === sortKey)?.[1] ?? "Sort";
  document.querySelector(".sort-dir").textContent = dirMark();
  sortMenu.replaceChildren();
  for (const [key, label] of keys) {
    const li = document.createElement("li");
    li.role = "option";
    li.dataset.key = key;
    li.textContent = label;
    li.setAttribute("aria-selected", String(key === sortKey));
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      if (sortKey === key && key !== "favorite") {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDir = key === "name" || key === "kind" ? "asc" : "desc";
      }
      sortMenu.hidden = true;
      sortBtn.setAttribute("aria-expanded", "false");
      paintSortMenu();
      paint();
    });
    sortMenu.append(li);
  }
}

function cmp(a, b) {
  return sortDir === "asc" ? a - b : b - a;
}

function sortProjects(list) {
  const copy = [...list];
  if (sortKey === "name") {
    copy.sort((a, b) => {
      const d = projectName(a).localeCompare(projectName(b));
      return sortDir === "asc" ? d : -d;
    });
  } else if (sortKey === "kind") {
    copy.sort((a, b) => {
      const d = String(a.media_type ?? "").localeCompare(String(b.media_type ?? "")) ||
        projectName(a).localeCompare(projectName(b));
      return sortDir === "asc" ? d : -d;
    });
  } else if (sortKey === "frames") {
    copy.sort((a, b) => cmp(frameCount(a), frameCount(b)));
  } else if (sortKey === "favorite") {
    copy.sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || createdAt(b) - createdAt(a));
  } else {
    copy.sort((a, b) => cmp(createdAt(a), createdAt(b)));
  }
  return copy;
}

function filterProjects(list) {
  const q = searchInput.value.trim().toLowerCase();
  return list.filter((p) => {
    const id = projectId(p);
    const tags = tagsFor(p);
    if (filterFav && !p.favorite) return false;
    if (!q) return true;
    const hay = `${projectName(p)} ${id} ${tags.join(" ")} ${p.media_type ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function closeMenus() {
  openMenuId = null;
  document.querySelectorAll(".pcard-menu").forEach((el) => {
    el.hidden = true;
  });
}

function setResult(text) {
  if (resultCount) resultCount.textContent = text;
}

function assetTotal() {
  return projects.reduce((n, p) => n + frameCount(p), 0);
}

function updateTabCounts() {
  const map = {
    projects: String(projects.length),
    assets: String(assetTotal()),
    workflows: String(flows.length),
    refs: String(references.length),
  };
  for (const el of document.querySelectorAll("[data-count]")) {
    el.textContent = map[el.dataset.count] ?? "0";
  }
}

function relatedLine(p) {
  const frames = frameCount(p);
  const bits = [];
  if (p.media_type) bits.push(String(p.media_type));
  if (frames) bits.push(`${frames} frames`);
  if (p.length) bits.push(String(p.length));
  if (p.has_graph) bits.push("graph");
  if (p.has_analysis) bits.push("analysed");
  if (p.has_export) bits.push("film");
  if (p.origin === "studio") bits.push("studio");
  return bits.join(" · ") || "no derived media yet";
}

function renderProjects() {
  const list = sortProjects(filterProjects(projects));
  projectGrid.replaceChildren();
  closeMenus();

  if (!projects.length) {
    empty.hidden = false;
    empty.textContent = "No projects yet. New opens a blank one, or Open video extracts a reel.";
    setResult("0 projects");
    return;
  }

  if (!list.length) {
    empty.hidden = false;
    empty.textContent = "No projects match this search.";
    setResult(`0 of ${projects.length} projects`);
    return;
  }

  empty.hidden = true;
  setResult(list.length === projects.length
    ? `${list.length} project${list.length === 1 ? "" : "s"}`
    : `${list.length} of ${projects.length} projects`);

  for (const p of list) {
    const id = projectId(p);
    if (!id) continue;
    const frames = frameCount(p);
    const name = projectName(p);
    const workHref = workshopHref({ project: id });
    const tags = tagsFor(p);
    const fav = Boolean(p.favorite);

    const card = document.createElement("article");
    card.className = "pcard" + (selectedId === id ? " is-selected" : "");
    card.dataset.id = id;

    const head = document.createElement("header");
    head.className = "pcard-head";
    head.innerHTML = `
      <span class="pcard-swatch"></span>
      <h3 class="pcard-title"></h3>
      <button type="button" class="icon-btn" data-fav title="Star">★</button>
      <button type="button" class="icon-btn" data-menu title="More">⋯</button>
    `;
    head.querySelector(".pcard-title").textContent = name;

    const cover = document.createElement("a");
    cover.className = "pcard-cover";
    cover.href = workHref;
    cover.title = `Open ${name} in Workshop`;
    if (frames > 0) {
      cover.style.backgroundImage = `url("${thumbUrl(id, 0, 420)}")`;
    } else {
      cover.classList.add("is-empty");
      cover.textContent = p.media_type ? String(p.media_type) : "no frames";
    }
    const tagHost = document.createElement("div");
    tagHost.className = "pcard-cover-tags";
    for (const tag of tags.slice(0, 6)) {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = tag;
      tagHost.append(span);
    }
    cover.append(tagHost);

    const body = document.createElement("div");
    body.className = "pcard-body";
    const meta = document.createElement("p");
    meta.className = "pcard-meta";
    meta.textContent = id;
    const rel = document.createElement("p");
    rel.className = "pcard-rel";
    rel.textContent = relatedLine(p);
    const badges = document.createElement("div");
    badges.className = "pcard-badges";
    const kind = document.createElement("span");
    kind.className = "badge video";
    kind.textContent = String(p.media_type ?? (frames ? "video" : "project"));
    badges.append(kind);
    if (frames) {
      const b = document.createElement("span");
      b.className = "badge frames";
      b.textContent = `${frames} frames`;
      badges.append(b);
    }
    body.append(meta, rel, badges);

    const menu = document.createElement("div");
    menu.className = "pcard-menu";
    menu.hidden = true;
    menu.innerHTML = `
      <a data-open="workshop">Open in Workshop</a>
      <a data-open="graph">Graph</a>
      <a data-open="grade">Grade</a>
      <label class="tag-edit">
        <span class="sr-only">Tags</span>
        <input type="text" data-tag-input placeholder="tags, comma separated">
      </label>
      <button type="button" class="danger" data-del>Delete project</button>
    `;
    menu.querySelector('[data-open="workshop"]').href = workHref;
    menu.querySelector('[data-open="graph"]').href = workshopHref({ project: id, pane: "graph" });
    menu.querySelector('[data-open="grade"]').href = workshopHref({ project: id, pane: "grade" });
    const tagInput = menu.querySelector("[data-tag-input]");
    tagInput.value = tags.join(", ");
    tagInput.addEventListener("click", (e) => e.stopPropagation());
    tagInput.addEventListener("change", async () => {
      const next = tagInput.value.split(",").map((t) => t.trim()).filter(Boolean);
      p.tags = next;
      tagMap[id] = next;
      saveTagMap();
      try {
        await fetch(`/api/project/${encodeURIComponent(id)}/meta`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tags: next }),
        });
      } catch {
        toast("Could not save tags to disk.", true);
      }
      renderProjects();
    });

    const favBtn = head.querySelector("[data-fav]");
    favBtn.classList.toggle("is-on", fav);
    favBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      p.favorite = !p.favorite;
      try {
        await fetch(`/api/project/${encodeURIComponent(id)}/meta`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ favorite: p.favorite }),
        });
      } catch {
        toast("Could not save favorite.", true);
      }
      renderProjects();
    });
    head.querySelector("[data-menu]").addEventListener("click", (e) => {
      e.stopPropagation();
      setSettingsOpen(false);
      const willOpen = openMenuId !== id;
      closeMenus();
      if (willOpen) {
        openMenuId = id;
        menu.hidden = false;
      }
    });
    menu.querySelector("[data-del]").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete ${name}? This removes the extracted frames from the workspace.`)) return;
      try {
        const r = await fetch(`/api/project/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!r.ok) throw new Error(String(r.status));
        projects = projects.filter((x) => projectId(x) !== id);
        if (selectedId === id) selectedId = projects[0] ? projectId(projects[0]) : null;
        updateTabCounts();
        renderProjects();
      } catch {
        toast("Could not delete this project.", true);
      }
    });

    card.addEventListener("click", () => {
      selectedId = id;
      document.querySelectorAll(".pcard").forEach((el) => {
        el.classList.toggle("is-selected", el.dataset.id === id);
      });
    });

    card.append(head, cover, body, menu);
    projectGrid.append(card);
  }
}

async function renderAssets() {
  assetGrid.replaceChildren();
  const list = sortProjects(filterProjects(projects)).slice(0, 12);
  if (!list.length) {
    assetsEmpty.hidden = false;
    setResult("0 frames");
    return;
  }
  assetsEmpty.hidden = true;

  const frag = document.createDocumentFragment();
  let count = 0;
  for (const p of list) {
    const id = projectId(p);
    const frames = frameCount(p);
    if (!id || frames <= 0) continue;
    const name = projectName(p);
    const sample = [0, Math.floor(frames / 2), Math.max(0, frames - 1)]
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, frames >= 3 ? 3 : frames);

    for (const frame of sample) {
      const a = document.createElement("a");
      a.className = "acard" + (id === activeProjectId() ? " is-related" : "");
      a.href = workshopHref({ project: id, pane: "grade" });
      a.title = `${name} · frame ${frame}`;
      const thumb = document.createElement("span");
      thumb.className = "acard-thumb";
      thumb.style.backgroundImage = `url("${thumbUrl(id, frame, 240)}")`;
      const meta = document.createElement("div");
      meta.className = "acard-meta";
      const strong = document.createElement("strong");
      strong.textContent = name;
      const span = document.createElement("span");
      span.textContent = `frame ${frame}`;
      meta.append(strong, span);
      a.append(thumb, meta);
      frag.append(a);
      count += 1;
    }
  }

  if (!frag.childNodes.length) {
    assetsEmpty.hidden = false;
    setResult("0 frames");
    return;
  }
  setResult(`${count} frames · linked to projects`);
  assetGrid.append(frag);
}

function decadeFromRef(ref) {
  if (Number.isFinite(Number(ref.year))) {
    return `${Math.floor(Number(ref.year) / 10) * 10}s`;
  }
  return (ref.tags ?? []).find((t) => DECADE_RE.test(String(t))) ?? null;
}

function facetOf(tag) {
  if (DECADE_RE.test(tag)) return "decade";
  if (SPACE_TAGS.has(String(tag).toLowerCase())) return "space";
  return "style";
}

function kindPool() {
  return refKind === "all"
    ? references
    : references.filter((r) => r.kind === refKind);
}

function filterRefs(list) {
  const q = searchInput.value.trim().toLowerCase();
  return list.filter((ref) => {
    if (refKind !== "all" && ref.kind !== refKind) return false;
    const tags = (ref.tags ?? []).map(String);
    const decade = decadeFromRef(ref);
    if (facetDecade.length && !facetDecade.some((d) => d === decade || tags.includes(d))) return false;
    if (facetSpace.length && !facetSpace.some((s) => tags.includes(s))) return false;
    if (facetStyle.length && !facetStyle.some((s) => tags.includes(s))) return false;
    if (!q) return true;
    const hay = `${ref.name ?? ""} ${ref.kind ?? ""} ${tags.join(" ")} ${ref.summary ?? ""} ${ref.where ?? ""} ${ref.when ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function sortRefs(list) {
  const copy = [...list];
  copy.sort((a, b) => {
    let d = 0;
    if (sortKey === "kind") {
      d = String(a.kind).localeCompare(String(b.kind)) || String(a.name).localeCompare(String(b.name));
    } else if (sortKey === "year") {
      d = Number(a.year ?? 0) - Number(b.year ?? 0) || String(a.name).localeCompare(String(b.name));
    } else if (sortKey === "score") {
      d = Number(a.score ?? 0) - Number(b.score ?? 0) || String(a.name).localeCompare(String(b.name));
    } else {
      d = String(a.name).localeCompare(String(b.name));
    }
    return sortDir === "asc" ? d : -d;
  });
  return copy;
}

function paintKindChips() {
  const host = document.getElementById("ref-kinds");
  if (!host) return;
  host.hidden = currentTab !== "refs";
  host.replaceChildren();
  if (currentTab !== "refs") return;
  for (const kind of KINDS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kind-chip" + (refKind === kind ? " is-on" : "");
    btn.dataset.kind = kind;
    btn.textContent = kind;
    btn.addEventListener("click", () => {
      refKind = kind;
      paintKindChips();
      paintFacets();
      renderRefs();
    });
    host.append(btn);
  }
}

function paintFacets() {
  const stack = document.getElementById("facet-stack");
  if (!stack) return;
  const show = currentTab === "refs";
  stack.hidden = !show;
  if (!show) return;
  const pool = kindPool();
  const buckets = { decade: new Set(), space: new Set(), style: new Set() };
  for (const ref of pool) {
    const d = decadeFromRef(ref);
    if (d) buckets.decade.add(d);
    for (const raw of ref.tags ?? []) {
      const tag = String(raw);
      buckets[facetOf(tag)].add(tag);
    }
  }
  const paintRow = (id, set, selected, onChange) => {
    const host = document.getElementById(id);
    const row = host?.closest(".facet-row");
    if (!host || !row) return;
    const values = [...set].sort((a, b) => a.localeCompare(b));
    row.hidden = values.length === 0;
    host.replaceChildren();
    const cap = id === "facet-style" ? 16 : 40;
    for (const tag of values.slice(0, cap)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-chip" + (selected.includes(tag) ? " is-on" : "");
      btn.textContent = tag;
      btn.addEventListener("click", () => {
        onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
      });
      host.append(btn);
    }
    if (values.length > cap) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "tag-chip";
      more.textContent = `+${values.length - cap}`;
      more.addEventListener("click", () => {
        host.replaceChildren();
        for (const tag of values) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tag-chip" + (selected.includes(tag) ? " is-on" : "");
          btn.textContent = tag;
          btn.addEventListener("click", () => {
            onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
          });
          host.append(btn);
        }
      });
      host.append(more);
    }
  };
  paintRow("facet-decade", buckets.decade, facetDecade, (next) => {
    facetDecade = next;
    paintFacets();
    renderRefs();
  });
  paintRow("facet-space", buckets.space, facetSpace, (next) => {
    facetSpace = next;
    paintFacets();
    renderRefs();
  });
  paintRow("facet-style", buckets.style, facetStyle, (next) => {
    facetStyle = next;
    paintFacets();
    renderRefs();
  });
}

function renderRefs() {
  const list = sortRefs(filterRefs(references));
  refGrid.replaceChildren();
  if (!list.length) {
    refsEmpty.hidden = false;
    setResult(references.length ? `0 of ${references.length} references` : "0 references");
    return;
  }
  refsEmpty.hidden = true;
  setResult(list.length === references.length
    ? `${list.length} references`
    : `${list.length} of ${references.length} references`);

  for (const ref of list) {
    const card = document.createElement("article");
    card.className = "rcard";
    card.dataset.kind = String(ref.kind ?? "");
    card.dataset.id = String(ref.id ?? "");
    const head = document.createElement("header");
    head.className = "rcard-head";
    const swatch = document.createElement("span");
    swatch.className = "rcard-swatch";
    const title = document.createElement("h3");
    title.className = "rcard-title";
    title.textContent = String(ref.name ?? ref.id);
    head.append(swatch, title);

    const cover = document.createElement("div");
    cover.className = "rcard-cover";
    if (ref.thumb) {
      const src = String(ref.thumb).startsWith("/") ? ref.thumb : `/library/${ref.thumb}`;
      cover.style.backgroundImage = `url("${src}")`;
    }

    const body = document.createElement("div");
    body.className = "rcard-body";
    const kind = document.createElement("div");
    kind.className = "rcard-kind";
    kind.textContent = String(ref.kind ?? "ref");
    const sum = document.createElement("div");
    sum.textContent = String(ref.when ?? ref.summary ?? ref.detail ?? "");
    body.append(kind, sum);

    card.append(head, cover, body);
    card.addEventListener("click", () => openRefOverlay(ref));
    refGrid.append(card);
  }
}

function fact(dl, label, value) {
  if (!value) return;
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = Array.isArray(value) ? value.join(" · ") : String(value);
  dl.append(dt, dd);
}

function openRefOverlay(ref) {
  const root = document.getElementById("ref-overlay");
  const card = document.getElementById("ref-overlay-card");
  if (!root || !card) return;
  card.dataset.kind = String(ref.kind ?? "");
  document.getElementById("ref-ov-kind").textContent = String(ref.kind ?? "ref");
  document.getElementById("ref-ov-title").textContent = String(ref.name ?? ref.id);
  const cover = document.getElementById("ref-ov-cover");
  if (ref.thumb) {
    const src = String(ref.thumb).startsWith("/") ? ref.thumb : `/library/${ref.thumb}`;
    cover.style.backgroundImage = `url("${src}")`;
    cover.classList.remove("is-empty");
  } else {
    cover.style.backgroundImage = "";
    cover.classList.add("is-empty");
  }
  const body = document.getElementById("ref-ov-body");
  body.replaceChildren();
  const summary = document.createElement("p");
  summary.className = "overlay-summary";
  summary.textContent = String(ref.summary ?? "");
  body.append(summary);
  const dl = document.createElement("dl");
  dl.className = "overlay-facts";
  fact(dl, "Where", ref.where);
  fact(dl, "When", ref.when ?? (ref.year ? String(ref.year) : ""));
  fact(dl, "Why", ref.why);
  fact(dl, "How", ref.how);
  fact(dl, "Characters", ref.characters);
  fact(dl, "Actors", ref.actors);
  fact(dl, "Studio", ref.studio);
  fact(dl, "Length", ref.length);
  fact(dl, "Score", Number.isFinite(Number(ref.score)) ? String(ref.score) : "");
  if (dl.childNodes.length) body.append(dl);
  if (Array.isArray(ref.tags) && ref.tags.length) {
    const tags = document.createElement("div");
    tags.className = "pcard-badges";
    for (const t of ref.tags) {
      const span = document.createElement("span");
      span.className = "badge";
      span.textContent = String(t);
      tags.append(span);
    }
    body.append(tags);
  }
  if (ref.detail) {
    const pre = document.createElement("pre");
    pre.className = "overlay-detail";
    pre.textContent = String(ref.detail);
    body.append(pre);
  }
  const related = Array.isArray(ref.related) ? ref.related : [];
  if (related.length) {
    const wrap = document.createElement("div");
    wrap.className = "overlay-related";
    for (const rel of related) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = rel.name ?? rel.id;
      btn.addEventListener("click", () => {
        const next = references.find((r) => r.id === rel.id);
        if (next) openRefOverlay(next);
      });
      wrap.append(btn);
    }
    body.append(wrap);
  }
  const grant = ref.grant ?? {};
  if (Array.isArray(grant.prompt) && grant.prompt.length) {
    const sec = document.createElement("section");
    sec.className = "overlay-grant";
    const h = document.createElement("h3");
    h.textContent = "Grant";
    const ul = document.createElement("ul");
    for (const line of grant.prompt) {
      const li = document.createElement("li");
      li.textContent = line;
      ul.append(li);
    }
    sec.append(h, ul);
    if (Array.isArray(grant.negative) && grant.negative.length) {
      const neg = document.createElement("p");
      neg.className = "overlay-neg";
      neg.textContent = `Avoid: ${grant.negative.join(", ")}`;
      sec.append(neg);
    }
    body.append(sec);
  }
  document.getElementById("ref-ov-workshop").href = workshopHref({ ref: ref.id });
  root.hidden = false;
  root.classList.add("is-open");
}

function closeRefOverlay() {
  const root = document.getElementById("ref-overlay");
  if (!root) return;
  root.hidden = true;
  root.classList.remove("is-open");
}

function sortFlows(list) {
  const copy = [...list];
  copy.sort((a, b) => {
    let d = 0;
    if (sortKey === "name") d = String(a.name).localeCompare(String(b.name));
    else if (sortKey === "nodes") d = Number(a.nodes ?? 0) - Number(b.nodes ?? 0);
    else if (sortKey === "kind") d = String(a.media_type ?? "").localeCompare(String(b.media_type ?? ""));
    else d = Number(a.savedAt ?? 0) - Number(b.savedAt ?? 0);
    return sortDir === "asc" ? d : -d;
  });
  return copy;
}

function renderWorkflows() {
  const q = searchInput.value.trim().toLowerCase();
  const list = sortFlows(flows.filter((f) => {
    if (!q) return true;
    return `${f.name ?? ""} ${f.note ?? ""} ${f.media_type ?? ""}`.toLowerCase().includes(q);
  }));
  flowGrid.replaceChildren();
  if (!list.length) {
    workflowsEmpty.hidden = false;
    setResult(flows.length ? "0 of " + flows.length + " workflows" : "0 workflows");
    return;
  }
  workflowsEmpty.hidden = true;
  setResult(`${list.length} workflow${list.length === 1 ? "" : "s"}`);
  for (const flow of list) {
    const a = document.createElement("a");
    a.className = "fcard";
    a.href = workshopHref({ flow: flow.id });
    const h = document.createElement("h3");
    h.textContent = String(flow.name ?? flow.id);
    const p = document.createElement("p");
    p.textContent = String(flow.note ?? "Saved graph");
    const meta = document.createElement("div");
    meta.className = "fcard-meta";
    const when = Number(flow.savedAt) ? new Date(Number(flow.savedAt)).toLocaleDateString() : "";
    meta.textContent = [flow.media_type, `${flow.nodes ?? 0} nodes`, when].filter(Boolean).join(" · ");
    a.append(h, p, meta);
    flowGrid.append(a);
  }
}

function paint() {
  paintSortMenu();
  starChip.hidden = currentTab === "workflows";
  starChip.classList.toggle("is-on", filterFav);
  starChip.setAttribute("aria-pressed", String(filterFav));
  paintKindChips();
  paintFacets();
  if (currentTab === "assets") void renderAssets();
  else if (currentTab === "refs") renderRefs();
  else if (currentTab === "workflows") renderWorkflows();
  else renderProjects();
}

function mergeProjects(engineList, studioList) {
  const byId = new Map();
  for (const p of studioList) {
    const id = projectId(p);
    if (id) byId.set(id, p);
  }
  for (const p of engineList) {
    const id = projectId(p);
    if (!id) continue;
    const studio = byId.get(id);
    byId.set(id, studio ? { ...studio, ...p } : p);
  }
  return [...byId.values()];
}

async function migrateLocalTags() {
  for (const p of projects) {
    const id = projectId(p);
    const local = tagMap[id];
    if (!id || !local?.length) continue;
    if (Array.isArray(p.tags) && p.tags.length) {
      tagMap[id] = p.tags;
      continue;
    }
    p.tags = local;
    try {
      await fetch(`/api/project/${encodeURIComponent(id)}/meta`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags: local }),
      });
    } catch { /* keep local copy */ }
  }
  saveTagMap();
}

async function loadProjects() {
  let engine = [];
  let studio = [];
  try {
    const r = await fetch("/api/projects");
    if (r.ok) {
      const data = await r.json();
      engine = Array.isArray(data) ? data : (data.projects ?? []);
    }
  } catch { /* engine down */ }
  try {
    const r = await fetch("/studio/projects");
    if (r.ok) {
      const data = await r.json();
      studio = data.projects ?? [];
    }
  } catch { /* no studio yet */ }
  projects = mergeProjects(engine, studio);
  if (!selectedId && projects.length) selectedId = projectId(projects[0]);
  await migrateLocalTags();
  updateTabCounts();
  if (!projects.length) {
    empty.hidden = false;
    empty.textContent = engine.length || studio.length
      ? "No projects match."
      : "No projects yet. New opens a blank one, or Open video extracts a reel.";
  }
  paint();
}

async function loadReferences() {
  try {
    const r = await fetch("/library");
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    references = Array.isArray(data.references) ? data.references : [];
    updateTabCounts();
    if (currentTab === "refs") paint();
  } catch {
    references = [];
  }
}

async function loadFlows() {
  try {
    const r = await fetch("/flows");
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    flows = Array.isArray(data.flows) ? data.flows : [];
    updateTabCounts();
    if (currentTab === "workflows") renderWorkflows();
  } catch {
    flows = [];
  }
}

function setTab(tab) {
  currentTab = tab;
  projectsPanel.hidden = tab !== "projects";
  assetsPanel.hidden = tab !== "assets";
  refsPanel.hidden = tab !== "refs";
  workflowsPanel.hidden = tab !== "workflows";
  for (const btn of document.querySelectorAll(".shelf-tab")) {
    const on = btn.dataset.tab === tab;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", String(on));
  }
  paint();
}

function runUtil(kind) {
  const id = activeProjectId();
  const free = new Set(["open", "blueprint", "gen-image", "gen-video", "gen-audio", "gen-mesh", "ask"]);
  if (!free.has(kind) && !id) {
    toast("Pick a project first — or New to start one.", true);
    return;
  }
  switch (kind) {
    case "open":
      location.href = id
        ? workshopHref({ project: id, open: true })
        : "/blueprint/?open=1";
      return;
    case "grade":
    case "grade-mode":
      location.href = workshopHref({ project: id, pane: "grade" });
      return;
    case "stabilize":
      location.href = workshopHref({ project: id, pane: "graph", tool: "stabilize" });
      return;
    case "export":
      location.href = workshopHref({ project: id, pane: "grade", export: true });
      return;
    case "analyse":
      location.href = workshopHref({ project: id, tool: "analyse" });
      return;
    case "mask":
      location.href = workshopHref({ project: id, tool: "mask" });
      return;
    case "enhance":
      location.href = workshopHref({ project: id, tool: "enhance" });
      return;
    case "repair":
      location.href = workshopHref({ project: id, tool: "repair" });
      return;
    case "blueprint":
      location.href = id
        ? workshopHref({ project: id, pane: "graph" })
        : "/blueprint/";
      return;
    case "stack":
      location.href = workshopHref({ project: id, pane: "graph", tool: "stack" });
      return;
    case "gen-image":
      location.href = workshopHref({ project: id, pane: "graph", tool: "gen-image" });
      return;
    case "gen-video":
      location.href = workshopHref({ project: id, pane: "graph", tool: "gen-video" });
      return;
    case "gen-audio":
      location.href = workshopHref({ project: id, pane: "graph", tool: "gen-audio" });
      return;
    case "gen-mesh":
      location.href = workshopHref({ project: id, pane: "graph", tool: "gen-mesh" });
      return;
    case "ask":
      location.href = workshopHref({ project: id, pane: "graph", tool: "ask" });
      return;
    default:
      toast("Unknown utility.", true);
  }
}

function setSettingsOpen(open) {
  const ctl = document.getElementById("settings-ctl");
  const btn = document.getElementById("btn-settings");
  const menu = document.getElementById("settings-menu");
  if (!ctl || !btn || !menu) return;
  ctl.classList.toggle("is-open", open);
  btn.setAttribute("aria-expanded", String(open));
  menu.hidden = !open;
}

function lengthMeta(media) {
  if (media === "comic" || media === "manga" || media === "book") {
    return { label: "Pages", placeholder: "pages" };
  }
  if (media === "music") return { label: "Duration", placeholder: "mm:ss or tracks" };
  return { label: "Runtime", placeholder: "minutes" };
}

function producesFor(media) {
  if (media === "music") return new Set(["audio", "music"]);
  if (media === "comic" || media === "manga" || media === "book") return new Set(["image", "text"]);
  return new Set(["video", "image"]);
}

function paintNewMedia() {
  const host = document.getElementById("new-media");
  if (!host) return;
  host.replaceChildren();
  for (const [id, label] of MEDIA_TYPES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kind-chip" + (newMedia === id ? " is-on" : "");
    btn.dataset.media = id;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      newMedia = id;
      paintNewMedia();
      paintNewModels();
      const meta = lengthMeta(id);
      document.getElementById("new-length-label").textContent = meta.label;
      document.getElementById("new-length").placeholder = meta.placeholder;
    });
    host.append(btn);
  }
}

function paintNewModels() {
  const host = document.getElementById("new-models");
  if (!host) return;
  host.replaceChildren();
  const allow = producesFor(newMedia);
  const shown = modelCatalog.filter((m) => allow.has(m.produces)).slice(0, 12);
  if (!shown.length) {
    host.textContent = "No models listed for this media yet. Create still works.";
    return;
  }
  for (const m of shown) {
    const lab = document.createElement("label");
    if (m.configured === false) lab.className = "off";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = m.id;
    box.dataset.model = m.id;
    const span = document.createElement("span");
    span.textContent = `${m.name} · ${m.provider ?? m.id.split(":")[0]}`;
    lab.append(box, span);
    host.append(lab);
  }
}

function paintNewFiles() {
  const list = document.getElementById("new-file-list");
  if (!list) return;
  list.replaceChildren();
  for (const f of newFiles) {
    const li = document.createElement("li");
    li.textContent = `${f.name} · ${Math.round(f.size / 1024)} KB`;
    list.append(li);
  }
}

function openNewOverlay() {
  const root = document.getElementById("new-overlay");
  if (!root) return;
  paintNewMedia();
  paintNewModels();
  const meta = lengthMeta(newMedia);
  document.getElementById("new-length-label").textContent = meta.label;
  document.getElementById("new-length").placeholder = meta.placeholder;
  root.hidden = false;
  root.classList.add("is-open");
  document.getElementById("new-name")?.focus();
}

function closeNewOverlay() {
  const root = document.getElementById("new-overlay");
  if (!root) return;
  root.hidden = true;
  root.classList.remove("is-open");
}

async function loadModels() {
  try {
    const r = await fetch("/models");
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    const configured = new Map((data.providers ?? []).map((p) => [p.id, p.configured !== false]));
    modelCatalog = (data.models ?? []).map((m) => ({
      ...m,
      configured: configured.get(m.provider) ?? true,
    }));
  } catch {
    modelCatalog = [];
  }
}

document.querySelectorAll(".shelf-tab").forEach((btn) => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab ?? "projects"));
});

document.querySelectorAll("[data-util]").forEach((btn) => {
  btn.addEventListener("click", () => runUtil(btn.dataset.util ?? ""));
});

searchInput.addEventListener("input", () => paint());
starChip.addEventListener("click", () => {
  filterFav = !filterFav;
  paint();
});
sortBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = sortMenu.hidden;
  sortMenu.hidden = !open;
  sortBtn.setAttribute("aria-expanded", String(open));
});

document.getElementById("btn-settings")?.addEventListener("click", (event) => {
  event.preventDefault();
  const ctl = document.getElementById("settings-ctl");
  setSettingsOpen(!ctl?.classList.contains("is-open"));
});
document.getElementById("cta-new")?.addEventListener("click", (e) => {
  e.preventDefault();
  openNewOverlay();
});
document.getElementById("ref-overlay")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-ref]")) closeRefOverlay();
});
document.getElementById("new-overlay")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-new]")) closeNewOverlay();
});
document.getElementById("new-files")?.addEventListener("change", (e) => {
  newFiles = [...(e.target.files ?? [])];
  paintNewFiles();
});
document.getElementById("new-drop")?.addEventListener("dragover", (e) => {
  e.preventDefault();
});
document.getElementById("new-drop")?.addEventListener("drop", (e) => {
  e.preventDefault();
  newFiles = [...(e.dataTransfer?.files ?? [])];
  paintNewFiles();
});
document.getElementById("new-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("new-name").value.trim() || "Untitled";
  const length = document.getElementById("new-length").value.trim();
  const tags = document.getElementById("new-tags").value.split(",").map((t) => t.trim()).filter(Boolean);
  const models = [...document.querySelectorAll("#new-models input:checked")].map((el) => el.value);
  const create = document.getElementById("new-create");
  create.disabled = true;
  create.textContent = "Creating…";
  try {
    const r = await fetch("/studio/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        media_type: newMedia,
        length,
        tags,
        models,
        assets: newFiles.map((f) => f.name),
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.project_id) throw new Error(data.detail ?? String(r.status));
    location.href = workshopHref({ project: data.project_id });
  } catch (err) {
    toast(err instanceof Error ? err.message : "Could not create that project.", true);
    create.disabled = false;
    create.textContent = "Create";
  }
});

document.addEventListener("click", (event) => {
  const t = event.target;
  if (!(t instanceof Node)) return;
  const settings = document.getElementById("settings-ctl");
  if (settings && !settings.contains(t)) setSettingsOpen(false);
  if (!(t instanceof Element) || !t.closest(".sort-ctl")) {
    sortMenu.hidden = true;
    sortBtn.setAttribute("aria-expanded", "false");
  }
  if (!(t instanceof Element) || !t.closest(".pcard-menu, [data-menu]")) closeMenus();
});

const ONBOARD_STEPS = [
  {
    title: "Projects, assets, workflows, references",
    text: "Home is the shelf. Projects are the work. Assets are the frames they made. Workflows are saved graphs. Media references are the films, comics, and forms you steal from.",
  },
  {
    title: "Relations stay visible",
    text: "Select a project and its frames light up on Assets. Tags travel with the card. Click a reference for where, when, why, and how — then place it in Workshop.",
  },
  {
    title: "New starts a project",
    text: "New names the work, the media, the length, and the models. Create opens its blueprint. Open video still extracts a reel.",
  },
];

function startOnboarding() {
  if (localStorage.getItem("ars:onboarding-complete") === "1") return;
  const root = document.getElementById("onboard");
  if (!root) return;
  let step = 1;
  const body = document.getElementById("onboard-body");
  const progress = document.getElementById("onboard-progress");
  const back = document.getElementById("onboard-back");
  const next = document.getElementById("onboard-next");
  const paintStep = () => {
    const s = ONBOARD_STEPS[step - 1];
    body.replaceChildren();
    const h = document.createElement("h2");
    h.textContent = s.title;
    const p = document.createElement("p");
    p.textContent = s.text;
    body.append(h, p);
    progress.textContent = `Step ${step} of 3`;
    back.hidden = step === 1;
    next.textContent = step === 3 ? "Start" : "Next";
    root.querySelectorAll(".onboard-dots i").forEach((dot) => {
      const n = Number(dot.dataset.step);
      dot.classList.toggle("is-on", n === step);
      dot.classList.toggle("is-done", n < step);
    });
  };
  const close = () => {
    root.hidden = true;
    localStorage.setItem("ars:onboarding-complete", "1");
  };
  document.getElementById("onboard-skip").addEventListener("click", close);
  back.addEventListener("click", () => { step = Math.max(1, step - 1); paintStep(); });
  next.addEventListener("click", () => {
    if (step >= 3) close();
    else { step += 1; paintStep(); }
  });
  root.hidden = false;
  paintStep();
}

function bindHelp() {
  const sheet = document.getElementById("shortcuts");
  const toggle = (on) => {
    if (!sheet) return;
    sheet.hidden = on === undefined ? !sheet.hidden : !on;
    if (!sheet.hidden) setSettingsOpen(false);
  };
  document.getElementById("btn-help")?.addEventListener("click", () => toggle());
  sheet?.addEventListener("click", (e) => {
    if (e.target.id === "shortcuts" || e.target.closest("[data-close-shortcuts]")) toggle(false);
  });
  document.addEventListener("keydown", (e) => {
    const typing = e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement;
    if (typing) {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      toggle();
    } else if (e.key === "/") {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      openNewOverlay();
    } else if (e.key === "1") setTab("projects");
    else if (e.key === "2") setTab("assets");
    else if (e.key === "3") setTab("workflows");
    else if (e.key === "4") setTab("refs");
    else if (e.key === "Escape") {
      toggle(false);
      setSettingsOpen(false);
      closeMenus();
      closeRefOverlay();
      closeNewOverlay();
    }
  });
}

bindHelp();
startOnboarding();
paintSortMenu();

await refreshHealth();
await Promise.all([loadProjects(), loadReferences(), loadFlows(), loadModels()]);
