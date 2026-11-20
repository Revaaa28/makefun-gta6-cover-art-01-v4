// shots.js — deterministic ?shot= scenes for screenshots.
// The page reads its own query string, so every screenshot is a plain render
// of the app itself: no compositing, no borrowed images.
//   ?shot=cover    full cover, mosaic9 + Poster Ink (the cover shot)
//   ?shot=editor   the editor UI with a photo loaded (the editor shot)
//   ?shot=portrait tall cover, Neon Nights (the portrait shot)
//   ?shot=square   square cover, tiltedShots + Golden Hour (the square shot)
// Optional overrides: layout, grade, title, subtitle, photo (sample id).

import { Editor, wireEditor } from './main.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot') || '';

function sceneCanvas(w, h) {
  const canvas = document.getElementById('preview');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function applyOverrides(editor) {
  const layout = params.get('layout');
  if (layout) editor.state.layout = layout;
  const grade = params.get('grade');
  if (grade) editor.state.grade = grade;
  const title = params.get('title');
  if (title) editor.state.title = title.toUpperCase();
  const subtitle = params.get('subtitle');
  if (subtitle) editor.state.subtitle = subtitle;
  const photo = params.get('photo');
  if (photo) {
    const p = editor.state.panels[editor.state.selected];
    p.photoId = photo;
    p.img = editor.photos.get(photo) || p.img;
  }
}

function flagReady(scene) {
  document.title = 'NEON COAST — ' + scene;
  document.body.dataset.shot = scene;
  window.__neonReady = true;
}

async function runCoverScene(scene, w, h) {
  // Hide only the chrome around the stage — the canvas lives inside #stage,
  // so hiding #editor-ui would hide the cover itself.
  document.querySelector('.topbar').style.display = 'none';
  document.getElementById('controls').style.display = 'none';
  document.getElementById('stage').classList.add('cover-only');
  const canvas = sceneCanvas(w, h);
  const editor = new Editor(canvas);
  await editor.loadSamples();
  applyOverrides(editor);
  editor.draw();
  // Wait for the title/subtitle fonts so the screenshot never catches a
  // fallback face mid-swap.
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  flagReady(scene);
}

async function runEditorScene() {
  const canvas = sceneCanvas(1080, 1080);
  const editor = new Editor(canvas);
  await editor.loadSamples();
  applyOverrides(editor);
  wireEditor(editor);
  editor.draw();
  flagReady('editor');
}

async function boot() {
  // Surface page errors into the DOM so a headless check can see them.
  window.addEventListener('error', (e) => {
    const diag = document.getElementById('diag');
    if (diag) diag.textContent += 'ERROR: ' + e.message + '\n';
  });

  if (shot === 'cover') {
    await runCoverScene('cover', 1280, 720);
  } else if (shot === 'portrait') {
    await runCoverScene('portrait', 1024, 1280);
  } else if (shot === 'square') {
    await runCoverScene('square', 1080, 1080);
  } else if (shot === 'editor') {
    await runEditorScene();
  } else {
    // Plain visit: the editor, square preview, defaults.
    const canvas = sceneCanvas(1080, 1080);
    const editor = new Editor(canvas);
    await editor.loadSamples();
    wireEditor(editor);
    editor.draw();
    flagReady('editor');
  }
}

boot();
