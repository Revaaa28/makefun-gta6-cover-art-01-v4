// NEON COAST — Vice Cover Studio: editor wiring.
// Loads the sample library, keeps the cover state, wires every control in
// index.html to it and re-renders the live preview on each change. Photos a
// visitor adds are read as data URLs in the browser and never uploaded.

import { renderCover, LAYOUTS, GRADE_RECIPES, layoutById, loadImage } from './cover.js';
import { SHOT_SCENES } from './shots.js';

const SAMPLE_PHOTOS = [
  { src: './samples/boulevard.jpg', name: 'Boulevard sample' },
  { src: './samples/pier.jpg', name: 'Pier sample' },
  { src: './assets/rooftop.jpg', name: 'Rooftop sample' },
  { src: './assets/friends.jpg', name: 'Friends sample' },
];

const POST_SIZES = [
  { id: 'landscape', name: '1920 x 1080 · Landscape', w: 1920, h: 1080 },
  { id: 'square', name: '1080 x 1080 · Square', w: 1080, h: 1080 },
  { id: 'portrait', name: '1080 x 1350 · Portrait', w: 1080, h: 1350 },
  { id: 'story', name: '1080 x 1920 · Story', w: 1080, h: 1920 },
];

const $ = (id) => document.getElementById(id);
const canvas = $('stageCanvas');

const state = {
  photos: [], // {src, name, img}
  layout: 'mosaic9',
  grade: 'posterInk',
  size: { w: 1920, h: 1080 },
  sizeId: 'landscape',
  title: 'NEON COAST',
  subtitle: 'Sunset Heist',
  stars: 5,
  panels: [],
  selected: 0,
};

function panelCount() {
  return layoutById(state.layout).panels(state.size.w, state.size.h).length;
}

// Panels always cycle the photo library distinctly: panel i holds photo
// i mod (number of photos), so a fresh cover never repeats a photo until the
// library runs out.
function ensurePanels() {
  const n = panelCount();
  while (state.panels.length < n) {
    state.panels.push({ photoIndex: state.panels.length % Math.max(1, state.photos.length), zoom: 1, offX: 0, offY: 0 });
  }
  state.panels.length = n;
  if (state.selected >= n) state.selected = 0;
}

function render() {
  ensurePanels();
  canvas.width = state.size.w;
  canvas.height = state.size.h;
  renderCover(canvas, {
    photos: state.photos.map((p) => p.img),
    panels: state.panels,
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    stars: state.stars,
  });
}

function setStatus(msg) { $('statusLine').textContent = msg; }

// ---- history (undo / redo) -------------------------------------------------

let history = [];
let historyIdx = -1;

function snapshot() {
  return JSON.stringify({
    photos: state.photos.map((p) => ({ src: p.src, name: p.name })),
    layout: state.layout, grade: state.grade,
    title: state.title, subtitle: state.subtitle, stars: state.stars,
    sizeId: state.sizeId, panels: state.panels, selected: state.selected,
  });
}

async function restore(json) {
  const s = JSON.parse(json);
  const loaded = [];
  for (const p of s.photos) loaded.push({ src: p.src, name: p.name, img: await loadImage(p.src) });
  state.photos = loaded;
  state.layout = s.layout; state.grade = s.grade;
  state.title = s.title; state.subtitle = s.subtitle; state.stars = s.stars;
  const size = POST_SIZES.find((z) => z.id === s.sizeId) || POST_SIZES[0];
  state.sizeId = size.id; state.size = { w: size.w, h: size.h };
  state.panels = s.panels; state.selected = s.selected;
  syncUI();
  render();
}

function commit() {
  history = history.slice(0, historyIdx + 1);
  history.push(snapshot());
  if (history.length > 50) history.shift();
  historyIdx = history.length - 1;
  syncHistoryButtons();
}

function syncHistoryButtons() {
  $('undoBtn').disabled = historyIdx <= 0;
  $('redoBtn').disabled = historyIdx >= history.length - 1;
}

// ---- UI sync ---------------------------------------------------------------

function buildChips(el, items, current, onPick) {
  el.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (item.id === current ? ' active' : '');
    b.textContent = item.name;
    b.addEventListener('click', () => onPick(item.id));
    el.appendChild(b);
  }
}

function syncThumbs() {
  const wrap = $('thumbs');
  wrap.innerHTML = '';
  const activePhoto = state.panels[state.selected]?.photoIndex;
  state.photos.forEach((p, i) => {
    const fig = document.createElement('figure');
    if (i === activePhoto) fig.className = 'active';
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    const cap = document.createElement('figcaption');
    cap.textContent = p.name;
    fig.appendChild(img); fig.appendChild(cap);
    fig.title = 'Put this photo in the selected panel';
    fig.addEventListener('click', () => {
      state.panels[state.selected].photoIndex = i;
      commit(); syncPanelControls(); syncThumbs(); render();
    });
    wrap.appendChild(fig);
  });
}

function syncPanelControls() {
  const n = panelCount();
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${n} — click a panel in the preview to select it, drag to reposition its photo.`;
  const sel = $('panelPhotoSelect');
  sel.innerHTML = '';
  state.photos.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = p.name;
    sel.appendChild(o);
  });
  const panel = state.panels[state.selected];
  if (panel) {
    sel.value = String(panel.photoIndex);
    $('panelZoom').value = String(panel.zoom || 1);
    $('zoomVal').textContent = `${(panel.zoom || 1).toFixed(2)}×`;
  }
}

function syncUI() {
  buildChips($('layoutChips'), LAYOUTS, state.layout, pickLayout);
  buildChips($('gradeChips'), GRADE_RECIPES, state.grade, pickGrade);
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('starsRange').value = String(state.stars);
  $('starsVal').textContent = String(state.stars);
  $('sizeSelect').value = state.sizeId;
  syncThumbs();
  syncPanelControls();
  syncHistoryButtons();
}

function pickLayout(id) { state.layout = id; state.selected = 0; ensurePanels(); commit(); syncUI(); render(); }
function pickGrade(id) { state.grade = id; commit(); syncUI(); render(); }

// ---- photo intake ----------------------------------------------------------

async function addPhotoFiles(files) {
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const src = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
    });
    const img = await loadImage(src);
    state.photos.push({ src, name: file.name.replace(/\.[^.]+$/, ''), img });
    added++;
  }
  if (added) {
    commit(); syncThumbs(); syncPanelControls(); render();
    setStatus(`Added ${added} photo${added > 1 ? 's' : ''} — ${state.photos.length} in the library. Nothing was uploaded.`);
  }
}

async function loadSamples() {
  const loaded = [];
  for (const p of SAMPLE_PHOTOS) loaded.push({ src: p.src, name: p.name, img: await loadImage(p.src) });
  return loaded;
}

// ---- export ----------------------------------------------------------------

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function exportPNG(size) {
  return new Promise((resolve) => {
    const off = document.createElement('canvas');
    off.width = size.w; off.height = size.h;
    renderCover(off, {
      photos: state.photos.map((p) => p.img),
      panels: state.panels,
      layout: state.layout,
      grade: state.grade,
      title: state.title,
      subtitle: state.subtitle,
      stars: state.stars,
    });
    off.toBlob((blob) => {
      if (blob) download(blob, `neon-coast-${size.id}-${size.w}x${size.h}.png`);
      resolve();
    }, 'image/png');
  });
}

// ---- wiring ----------------------------------------------------------------

function wire() {
  $('fileInput').addEventListener('change', (e) => { addPhotoFiles([...e.target.files]); e.target.value = ''; });
  const dz = $('dropZone');
  for (const ev of ['dragenter', 'dragover']) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragging'); });
  for (const ev of ['dragleave', 'drop']) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragging'); });
  dz.addEventListener('drop', (e) => addPhotoFiles([...e.dataTransfer.files]));

  $('sampleBtn').addEventListener('click', async () => {
    state.photos = await loadSamples();
    state.panels = [];
    ensurePanels();
    commit(); syncUI(); render();
    setStatus('Sample library restored — four photos, one per panel until they cycle.');
  });
  $('spreadBtn').addEventListener('click', () => {
    const idx = state.panels[state.selected]?.photoIndex || 0;
    for (const p of state.panels) p.photoIndex = idx;
    commit(); syncThumbs(); render();
    setStatus('One photo spread across every panel.');
  });

  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  $('titleInput').addEventListener('change', commit);
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('subtitleInput').addEventListener('change', commit);
  $('starsRange').addEventListener('input', (e) => { state.stars = Number(e.target.value); $('starsVal').textContent = e.target.value; render(); });
  $('starsRange').addEventListener('change', commit);

  $('panelPhotoSelect').addEventListener('change', (e) => {
    state.panels[state.selected].photoIndex = Number(e.target.value);
    commit(); syncThumbs(); render();
  });
  $('panelZoom').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    $('zoomVal').textContent = `${Number(e.target.value).toFixed(2)}×`;
    render();
  });
  $('panelZoom').addEventListener('change', commit);

  const sizeSel = $('sizeSelect');
  for (const z of POST_SIZES) {
    const o = document.createElement('option');
    o.value = z.id; o.textContent = z.name;
    sizeSel.appendChild(o);
  }
  sizeSel.addEventListener('change', (e) => {
    const z = POST_SIZES.find((s) => s.id === e.target.value) || POST_SIZES[0];
    state.sizeId = z.id; state.size = { w: z.w, h: z.h };
    commit(); render();
  });

  $('undoBtn').addEventListener('click', async () => { if (historyIdx > 0) { historyIdx--; await restore(history[historyIdx]); syncHistoryButtons(); } });
  $('redoBtn').addEventListener('click', async () => { if (historyIdx < history.length - 1) { historyIdx++; await restore(history[historyIdx]); syncHistoryButtons(); } });
  $('shuffleBtn').addEventListener('click', () => {
    for (const p of state.panels) p.photoIndex = Math.floor(Math.random() * state.photos.length);
    commit(); syncThumbs(); syncPanelControls(); render();
    setStatus('Panels shuffled.');
  });
  $('exportBtn').addEventListener('click', async () => {
    await exportPNG(state.size);
    setStatus(`Exported PNG at ${state.size.w} x ${state.size.h}.`);
  });
  $('exportAllBtn').addEventListener('click', async () => {
    for (const z of POST_SIZES) {
      await exportPNG(z);
      await new Promise((r) => setTimeout(r, 350));
    }
    setStatus('Exported all four post sizes.');
  });

  // Canvas: click selects a panel, drag repositions its photo.
  let drag = null;
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  };
  const hitPanel = (pt) => {
    const rects = layoutById(state.layout).panels(canvas.width, canvas.height);
    for (let i = rects.length - 1; i >= 0; i--) {
      const rc = rects[i];
      if (rc.cx !== undefined) {
        if (Math.abs(pt.x - rc.cx) <= rc.w / 2 && Math.abs(pt.y - rc.cy) <= rc.h / 2) return i;
      } else if (pt.x >= rc.x && pt.x <= rc.x + rc.w && pt.y >= rc.y && pt.y <= rc.y + rc.h) return i;
    }
    return -1;
  };
  canvas.addEventListener('pointerdown', (e) => {
    const pt = toCanvas(e);
    const idx = hitPanel(pt);
    if (idx < 0) return;
    state.selected = idx;
    syncPanelControls(); syncThumbs();
    drag = { x: pt.x, y: pt.y, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = toCanvas(e);
    const rects = layoutById(state.layout).panels(canvas.width, canvas.height);
    const rc = rects[state.selected];
    const panel = state.panels[state.selected];
    panel.offX = Math.max(-1.2, Math.min(1.2, (panel.offX || 0) + (pt.x - drag.x) / (rc.w * 0.3)));
    panel.offY = Math.max(-1.2, Math.min(1.2, (panel.offY || 0) + (pt.y - drag.y) / (rc.h * 0.3)));
    drag = { x: pt.x, y: pt.y, moved: true };
    render();
  });
  canvas.addEventListener('pointerup', () => { if (drag?.moved) commit(); drag = null; });
}

// ---- boot ------------------------------------------------------------------

async function boot() {
  state.photos = await loadSamples();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot && SHOT_SCENES[shot]) {
    const scene = SHOT_SCENES[shot];
    state.layout = scene.layout;
    state.grade = scene.grade;
    state.title = scene.title;
    state.subtitle = scene.subtitle;
    state.stars = scene.stars;
    state.size = { ...scene.size };
    const match = POST_SIZES.find((z) => z.w === scene.size.w && z.h === scene.size.h);
    if (match) state.sizeId = match.id;
    state.panels = [];
    ensurePanels();
    // A scene may pre-select a panel (the editor scene picks the centre one).
    if (typeof scene.selected === 'number') state.selected = Math.min(scene.selected, state.panels.length - 1);
    // The editor scene keeps the full editor chrome visible; every other
    // scene hides it and renders the cover full-frame.
    if (!scene.chrome) document.body.classList.add('shot');
    wire();
    syncUI();
    render();
    return;
  }
  wire();
  ensurePanels();
  syncUI();
  commit();
  render();
  setStatus('Ready — four sample photos loaded. Add your own or export straight away.');
}

boot().catch((err) => setStatus(`Something failed to load: ${err.message}`));
