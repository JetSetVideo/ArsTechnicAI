/**
 * subjects.js — characters, places and objects, on Home.
 *
 * The library answers "how was this photographed". Nothing answered "who is
 * this, and what must not change about them" — and that is the question a
 * restoration of your grandmother's wedding, or fifty generated variations of
 * one character, actually turns on. A subject is a name, the traits that must
 * not drift, a description in your own words, and whatever material you have:
 * something you drew here, a photograph, a clip you shot on your phone.
 *
 * Everything written here is versioned by the host (`bridge/entity_store.ts`):
 * every save is a new `entity.v{N}.json` and every drawing or upload claims its
 * own directory, so nothing you make can be replaced by a later edit.
 *
 * The drawing surface is deliberately small — pen, size, colour, eraser, undo,
 * clear. It is for "the scar is here, the coat is this blue", not for painting.
 */

const KINDS = [
  { id: "character", label: "Character", hint: "A person the work is about." },
  { id: "place", label: "Place", hint: "A room, a street, a landscape." },
  { id: "prop", label: "Object", hint: "A dress, a car, an instrument." },
];

export function mountSubjects(options) {
  const { toast, workshopHref } = options;
  const grid = document.getElementById("subject-grid");
  const emptyNote = document.getElementById("subjects-empty");
  const overlay = document.getElementById("subject-overlay");
  const form = document.getElementById("subject-form");
  if (!grid || !overlay || !form) return { load: async () => {}, count: () => 0, paint: () => {} };

  let entities = [];
  let editing = null; // the entity being edited, or null for a new one
  let traits = [];
  let strokes = []; // committed strokes, for undo
  let current = null; // the stroke being drawn
  let filter = "";

  const el = (id) => document.getElementById(id);
  const canvas = el("subject-canvas");
  const ctx = canvas.getContext("2d");

  // ---------------------------------------------------------------- drawing

  function paintCanvas() {
    ctx.fillStyle = "#f7f5f0"; // paper, not the app's dark ground
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) drawStroke(stroke);
    if (current) drawStroke(current);
  }

  function drawStroke(stroke) {
    if (stroke.points.length === 0) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.erase ? "#f7f5f0" : stroke.colour;
    ctx.lineWidth = stroke.width * (stroke.erase ? 2.5 : 1);
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
    if (stroke.points.length === 1) ctx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y);
    ctx.stroke();
    ctx.restore();
  }

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    current = {
      colour: el("subject-colour").value,
      width: Number(el("subject-size").value),
      erase: el("subject-erase").getAttribute("aria-pressed") === "true",
      points: [pointFrom(event)],
    };
    paintCanvas();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!current) return;
    current.points.push(pointFrom(event));
    paintCanvas();
  });
  const endStroke = () => {
    if (!current) return;
    strokes.push(current);
    current = null;
    paintCanvas();
  };
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("pointerleave", endStroke);

  el("subject-erase").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const on = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!on));
    button.classList.toggle("is-on", !on);
  });
  el("subject-undo").addEventListener("click", () => {
    strokes.pop();
    paintCanvas();
  });
  el("subject-clear").addEventListener("click", () => {
    strokes = [];
    paintCanvas();
  });

  function canvasIsBlank() {
    return strokes.length === 0;
  }

  async function canvasBlob() {
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  // ----------------------------------------------------------------- traits

  function paintTraits() {
    const host = el("subject-trait-list");
    host.replaceChildren();
    traits.forEach((trait, index) => {
      const chip = document.createElement("span");
      chip.className = "trait-chip";
      chip.textContent = trait;
      const drop = document.createElement("button");
      drop.type = "button";
      drop.textContent = "✕";
      drop.title = `Remove “${trait}”`;
      drop.addEventListener("click", () => {
        traits.splice(index, 1);
        paintTraits();
      });
      chip.append(drop);
      host.append(chip);
    });
  }

  el("subject-trait").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = event.currentTarget.value.trim();
    if (!value) return;
    if (traits.length >= 24) {
      toast("Twenty-four traits is plenty — the rest belongs in the description.", true);
      return;
    }
    traits.push(value);
    event.currentTarget.value = "";
    paintTraits();
  });

  // ------------------------------------------------------------------ form

  function openEditor(entity) {
    editing = entity;
    traits = entity ? [...entity.traits] : [];
    strokes = [];
    paintCanvas();
    paintTraits();
    el("subject-title").textContent = entity ? `Edit ${entity.name}` : "New subject";
    el("subject-name").value = entity?.name ?? "";
    el("subject-summary").value = entity?.summary ?? "";
    el("subject-description").value = entity?.description ?? "";
    for (const button of document.querySelectorAll("[data-subject-kind]")) {
      const on = button.dataset.subjectKind === (entity?.kind ?? "character");
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", String(on));
    }
    paintMedia(entity);
    overlay.hidden = false;
    el("subject-name").focus();
  }

  function closeEditor() {
    overlay.hidden = true;
    editing = null;
  }

  function chosenKind() {
    const on = document.querySelector("[data-subject-kind].is-on");
    return on?.dataset.subjectKind ?? "character";
  }

  function paintMedia(entity) {
    const host = el("subject-media");
    host.replaceChildren();
    const media = entity?.media ?? [];
    if (media.length === 0) {
      const note = document.createElement("p");
      note.className = "muted small";
      note.textContent = entity
        ? "Nothing attached yet. Draw something, or attach a photograph or a clip."
        : "Save the subject first, then attach drawings, photographs or clips to it.";
      host.append(note);
      return;
    }
    for (const item of media) {
      const box = document.createElement("figure");
      box.className = "subject-media-item";
      if (item.kind === "image" || item.kind === "drawing") {
        const img = document.createElement("img");
        img.src = `/workspace-media/${item.path}`;
        img.alt = item.caption ?? item.kind;
        img.loading = "lazy";
        box.append(img);
      } else if (item.kind === "video") {
        const video = document.createElement("video");
        video.src = `/workspace-media/${item.path}`;
        video.controls = true;
        video.preload = "metadata";
        box.append(video);
      } else if (item.kind === "audio") {
        const audio = document.createElement("audio");
        audio.src = `/workspace-media/${item.path}`;
        audio.controls = true;
        box.append(audio);
      } else {
        const link = document.createElement("a");
        link.href = `/workspace-media/${item.path}`;
        link.textContent = item.path.split("/").pop();
        link.target = "_blank";
        link.rel = "noopener";
        box.append(link);
      }
      const caption = document.createElement("figcaption");
      caption.textContent = item.caption || item.kind;
      box.append(caption);
      host.append(box);
    }
  }

  async function save(event) {
    event.preventDefault();
    const name = el("subject-name").value.trim();
    if (!name) {
      toast("A subject needs a name — it is how the canvas refers to it.", true);
      return;
    }
    const body = {
      id: editing?.id,
      entity: {
        kind: chosenKind(),
        name,
        summary: el("subject-summary").value.trim(),
        description: el("subject-description").value,
        traits,
        references: editing?.references ?? [],
      },
    };
    try {
      const response = await fetch("/entities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? `HTTP ${response.status}`);
      let entity = data.entity;

      // A drawing made in this sitting is attached to the subject it was drawn for.
      if (!canvasIsBlank()) {
        const blob = await canvasBlob();
        const attached = await fetch(
          `/entities/${encodeURIComponent(entity.id)}/media?drawn=1&name=drawing.png`,
          { method: "POST", headers: { "content-type": "image/png" }, body: blob },
        );
        const result = await attached.json();
        if (attached.ok) entity = result.entity;
        else toast(result.detail ?? "The drawing could not be attached.", true);
      }

      toast(`${entity.name} saved.`);
      editing = entity;
      strokes = [];
      paintCanvas();
      await load();
      paintMedia(entity);
      el("subject-title").textContent = `Edit ${entity.name}`;
    } catch (error) {
      toast(String(error.message ?? error), true);
    }
  }

  form.addEventListener("submit", save);
  el("subject-close").addEventListener("click", closeEditor);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeEditor();
  });
  document.addEventListener("keydown", (event) => {
    if (!overlay.hidden && event.key === "Escape") closeEditor();
  });
  for (const button of document.querySelectorAll("[data-subject-kind]")) {
    button.addEventListener("click", () => {
      for (const other of document.querySelectorAll("[data-subject-kind]")) {
        const on = other === button;
        other.classList.toggle("is-on", on);
        other.setAttribute("aria-pressed", String(on));
      }
    });
  }

  el("subject-upload").addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (!editing) {
      toast("Save the subject first — material is attached to it, not to a form.", true);
      return;
    }
    for (const file of files) {
      try {
        const response = await fetch(
          `/entities/${encodeURIComponent(editing.id)}/media?name=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            headers: { "content-type": file.type || "application/octet-stream" },
            body: file,
          },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail ?? `HTTP ${response.status}`);
        editing = data.entity;
      } catch (error) {
        toast(`${file.name}: ${error.message ?? error}`, true);
      }
    }
    paintMedia(editing);
    await load();
    toast(`${files.length} attached.`);
  });

  document.getElementById("subject-new")?.addEventListener("click", () => openEditor(null));

  // ------------------------------------------------------------------ shelf

  function paint() {
    const needle = filter.trim().toLowerCase();
    const shown = entities.filter((e) =>
      !needle ||
      e.name.toLowerCase().includes(needle) ||
      e.summary.toLowerCase().includes(needle) ||
      e.traits.some((t) => t.toLowerCase().includes(needle))
    );
    grid.replaceChildren();
    for (const entity of shown) {
      const card = document.createElement("article");
      card.className = "subject-card";
      const visual = entity.media.find((m) => m.kind === "drawing" || m.kind === "image");
      const cover = document.createElement("div");
      cover.className = "subject-cover";
      if (visual) cover.style.backgroundImage = `url("/workspace-media/${visual.path}")`;
      else cover.textContent = KINDS.find((k) => k.id === entity.kind)?.label ?? entity.kind;
      const body = document.createElement("div");
      body.className = "subject-body";
      const title = document.createElement("h3");
      title.textContent = entity.name;
      const meta = document.createElement("p");
      meta.className = "subject-meta";
      meta.textContent = [
        KINDS.find((k) => k.id === entity.kind)?.label ?? entity.kind,
        entity.traits.length ? `${entity.traits.length} traits` : "",
        entity.media.length ? `${entity.media.length} media` : "",
      ].filter(Boolean).join(" · ");
      const summary = document.createElement("p");
      summary.className = "subject-summary";
      summary.textContent = entity.summary || entity.description.split("\n")[0] || "";
      const actions = document.createElement("div");
      actions.className = "subject-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "chip";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openEditor(entity));
      const use = document.createElement("a");
      use.className = "chip";
      use.textContent = "Use in Workshop";
      use.href = workshopHref({ subject: entity.id });
      actions.append(edit, use);
      body.append(title, meta, summary, actions);
      card.append(cover, body);
      grid.append(card);
    }
    if (emptyNote) emptyNote.hidden = shown.length > 0;
    const count = document.querySelector('[data-count="subjects"]');
    if (count) count.textContent = String(entities.length);
  }

  async function load() {
    try {
      const response = await fetch("/entities");
      const data = await response.json();
      entities = data.entities ?? [];
    } catch {
      entities = [];
    }
    paint();
  }

  paintCanvas();

  return {
    load,
    paint,
    count: () => entities.length,
    setFilter(value) {
      filter = value;
      paint();
    },
    openNew: () => openEditor(null),
  };
}
