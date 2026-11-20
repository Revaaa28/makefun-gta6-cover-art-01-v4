// main.js — NEON COAST editor wiring.
// Owns the cover state, the history stack (undo/redo), uploads, drag-drop,
// per-panel controls, and the export buttons. The drawing itself lives in
// cover.js; the ?shot= scenes live in shots.js.

import {
  LAYOUTS, LAYOUT_LABELS, GRADES, GRADE_LABELS, SAMPLE_PHOTOS,
  loadPhoto, renderCover, downloadCanvas, panelRects,
} from './cover.js';

export const EXPORT_SIZES = [
  { label: '1080 × 1080', w: 1080, h: 1080 },
  { label: '1080 × 1350', w: 1080, h: 1350 },
  { label: '1080 × 1920', w: 1080, h: 1920 },
  { label: '1920 × 1080', w: 1920, h: 1080 },
];

const $ = (id) => document.getElementById(id);

function blankPanel(photoId) {
  return { photoId, img: null, zoom: 1, offsetX: 0, offsetY: 0 };
}

export function freshState() {
  return {
    title: 'NEON COAST',
    subtitle: 'Sunset Heist',
    layout: 'mosaic9',
    grade: 'posterInk',
    panels: [blankPanel('boulevard'), blankPanel('pier'), blankPanel('rooftop'), blankPanel('friends')],
    selected: 0,
  };
}

// Serialize the parts of state that history needs (images stay by reference).
function snapshot(state) {
  return JSON.stringify({
    title: state.title, subtitle: state.subtitle,
    layout: state.layout, grade: state.grade, selected: state.selected,
    panels: state.panels.map((p) => ({ photoId: p.photoId, zoom: p.zoom, offsetX: p.offsetX, offsetY: p.offsetY })),
  });
}

export class Editor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = freshState();
    this.history = [];
    this.future = [];
    this.photos = new Map(); // photoId -> HTMLImageElement
    this.onChange = null;
  }

  async loadSamples() {
    for (const sample of SAMPLE_PHOTOS) {
      try {
        const img = await loadPhoto(sample.src);
        this.photos.set(sample.id, img);
      } catch (err) {
        console.warn('sample failed to load:', sample.id, err);
      }
    }
    this.state.panels.forEach((p) => { p.img = this.photos.get(p.photoId) || null; });
    this.draw();
  }

  draw() {
    const { width, height } = this.canvas;
    const rendered = renderCover(this.state, width, height);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(rendered, 0, 0);
    if (this.onChange) this.onChange(this.state);
  }

  commit() {
    this.history.push(snapshot(this.state));
    if (this.history.length > 60) this.history.shift();
    this.future = [];
  }

  restore(json) {
    const data = JSON.parse(json);
    this.state.title = data.title;
    this.state.subtitle = data.subtitle;
    this.state.layout = data.layout;
    this.state.grade = data.grade;
    this.state.selected = data.selected;
    this.state.panels = data.panels.map((p) => ({
      photoId: p.photoId, img: this.photos.get(p.photoId) || null,
      zoom: p.zoom, offsetX: p.offsetX, offsetY: p.offsetY,
    }));
    this.draw();
  }

  undo() {
    if (!this.history.length) return;
    this.future.push(snapshot(this.state));
    this.restore(this.history.pop());
  }

  redo() {
    if (!this.future.length) return;
    this.history.push(snapshot(this.state));
    this.restore(this.future.pop());
  }

  setLayout(layout) {
    if (!LAYOUTS.includes(layout)) return;
    this.commit();
    this.state.layout = layout;
    this.draw();
  }

  setGrade(grade) {
    if (!GRADES.includes(grade)) return;
    this.commit();
    this.state.grade = grade;
    this.draw();
  }

  setTitle(title) { this.state.title = title; this.draw(); }
  setSubtitle(subtitle) { this.state.subtitle = subtitle; this.draw(); }

  selectPanel(i) {
    this.state.selected = i;
    this.draw();
  }

  setPanelPhoto(i, photoId) {
    this.commit();
    const p = this.state.panels[i];
    p.photoId = photoId;
    p.img = this.photos.get(photoId) || null;
    p.zoom = 1; p.offsetX = 0; p.offsetY = 0;
    this.draw();
  }

  setPanelZoom(i, zoom) {
    this.state.panels[i].zoom = zoom;
    this.draw();
  }

  nudgePanel(i, dx, dy) {
    const p = this.state.panels[i];
    p.offsetX = Math.max(-1, Math.min(1, p.offsetX + dx));
    p.offsetY = Math.max(-1, Math.min(1, p.offsetY + dy));
    this.draw();
  }

  shuffle() {
    this.commit();
    const ids = [...this.photos.keys()];
    this.state.panels.forEach((p) => {
      p.photoId = ids[Math.floor(Math.random() * ids.length)];
      p.img = this.photos.get(p.photoId);
      p.zoom = 1 + Math.random() * 0.35;
      p.offsetX = (Math.random() - 0.5) * 0.6;
      p.offsetY = (Math.random() - 0.5) * 0.6;
    });
    this.draw();
  }

  spread() {
    this.commit();
    const sel = this.state.panels[this.state.selected];
    this.state.panels.forEach((p) => {
      p.photoId = sel.photoId;
      p.img = sel.img;
    });
    this.draw();
  }

  // Which panel (if any) sits under a point on the preview canvas.
  panelAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (clientY - rect.top) * (this.canvas.height / rect.height);
    const bandH = this.canvas.height * 0.17;
    if (y < bandH) return -1;
    const rects = panelRects(this.state.layout, this.canvas.width, this.canvas.height - bandH, Math.max(3, Math.round(this.canvas.width * 0.006)));
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y - bandH >= r.y && y - bandH <= r.y + r.h) return i;
    }
    return -1;
  }

  addUpload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const id = 'upload-' + Date.now();
          this.photos.set(id, img);
          this.commit();
          const p = this.state.panels[this.state.selected];
          p.photoId = id; p.img = img; p.zoom = 1; p.offsetX = 0; p.offsetY = 0;
          this.draw();
          resolve(id);
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  exportPNG(w, h, filename) {
    const canvas = renderCover(this.state, w, h);
    downloadCanvas(canvas, filename);
  }

  exportAllSizes() {
    EXPORT_SIZES.forEach((size, i) => {
      setTimeout(() => {
        this.exportPNG(size.w, size.h, `neon-coast-${size.w}x${size.h}.png`);
      }, i * 450);
    });
  }
}

// ---------------------------------------------------------------------------
// Page wiring. Kept thin: every control maps to one Editor method above.
// ---------------------------------------------------------------------------

export function wireEditor(editor) {
  const preview = editor.canvas;

  // Pickers.
  const layoutPicker = $('layout-picker');
  LAYOUTS.forEach((layout) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = LAYOUT_LABELS[layout];
    b.dataset.layout = layout;
    b.addEventListener('click', () => {
      editor.setLayout(layout);
      layoutPicker.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    });
    layoutPicker.appendChild(b);
  });

  const gradePicker = $('grade-picker');
  GRADES.forEach((grade) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = GRADE_LABELS[grade];
    b.dataset.grade = grade;
    b.addEventListener('click', () => {
      editor.setGrade(grade);
      gradePicker.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    });
    gradePicker.appendChild(b);
  });

  // Title + subtitle.
  $('title-input').addEventListener('input', (e) => editor.setTitle(e.target.value.toUpperCase() || 'NEON COAST'));
  $('subtitle-input').addEventListener('input', (e) => editor.setSubtitle(e.target.value || 'Sunset Heist'));

  // History + actions.
  $('undo-btn').addEventListener('click', () => editor.undo());
  $('redo-btn').addEventListener('click', () => editor.redo());
  $('shuffle-btn').addEventListener('click', () => editor.shuffle());
  $('spread-btn').addEventListener('click', () => editor.spread());
  $('export-btn').addEventListener('click', () => editor.exportPNG(1080, 1080, 'neon-coast-1080x1080.png'));

  const sizePicker = $('size-picker');
  EXPORT_SIZES.forEach((size) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = size.label;
    b.addEventListener('click', () => editor.exportPNG(size.w, size.h, `neon-coast-${size.w}x${size.h}.png`));
    sizePicker.appendChild(b);
  });
  $('export-all-btn').addEventListener('click', () => editor.exportAllSizes());

  // Sample library.
  const library = $('library');
  SAMPLE_PHOTOS.forEach((sample) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'library-item';
    const img = document.createElement('img');
    img.src = sample.src;
    img.alt = sample.label;
    const span = document.createElement('span');
    span.textContent = sample.label;
    b.append(img, span);
    b.addEventListener('click', () => editor.setPanelPhoto(editor.state.selected, sample.id));
    library.appendChild(b);
  });

  // Upload + drag-drop (photos stay on this machine, never uploaded).
  const fileInput = $('upload-input');
  $('upload-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      if (file.type.startsWith('image/')) await editor.addUpload(file);
    }
    fileInput.value = '';
  });
  const dropzone = $('dropzone');
  ['dragenter', 'dragover'].forEach((evt) => dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((evt) => dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
  }));
  dropzone.addEventListener('drop', async (e) => {
    for (const file of e.dataTransfer.files) {
      if (file.type.startsWith('image/')) await editor.addUpload(file);
    }
  });

  // Per-panel controls.
  $('zoom-slider').addEventListener('input', (e) => {
    editor.setPanelZoom(editor.state.selected, Number(e.target.value));
  });
  $('reset-panel-btn').addEventListener('click', () => {
    editor.commit();
    const p = editor.state.panels[editor.state.selected];
    p.zoom = 1; p.offsetX = 0; p.offsetY = 0;
    editor.draw();
  });

  // Click a panel to select it; drag it to reposition the photo inside.
  let dragging = null;
  preview.addEventListener('pointerdown', (e) => {
    const i = editor.panelAt(e.clientX, e.clientY);
    if (i < 0) return;
    editor.selectPanel(i);
    dragging = { i, x: e.clientX, y: e.clientY, moved: false };
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - dragging.x) / preview.getBoundingClientRect().width;
    const dy = (e.clientY - dragging.y) / preview.getBoundingClientRect().height;
    if (Math.abs(dx) + Math.abs(dy) > 0.004) dragging.moved = true;
    if (dragging.moved) {
      if (dragging.commitPending !== true) {
        editor.commit();
        dragging.commitPending = true;
      }
      editor.nudgePanel(dragging.i, dx * 2, dy * 2);
      dragging.x = e.clientX;
      dragging.y = e.clientY;
    }
  });
  preview.addEventListener('pointerup', () => { dragging = null; });

  // Keep the panel label + zoom slider in sync with the selection.
  editor.onChange = (state) => {
    $('panel-label').textContent = `Panel ${state.selected + 1} — ${state.panels[state.selected].photoId}`;
    $('zoom-slider').value = String(state.panels[state.selected].zoom);
  };
}
