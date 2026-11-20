// NEON COAST — Vice Cover Studio: cover renderer.
// Pure canvas 2D. Every panel photo is pushed through a gradient-map colour
// grade (luminance -> colour ramp). Poster Ink goes further: saturation lift,
// 6-level posterize and Sobel ink edges multiplied back over the panel, so a
// photo reads as flat illustrated key art instead of a tinted photograph.
// No network, no fonts, no libraries: lettering is drawn with system fonts.

function hexRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Each grade is a luminance ramp: [luminance 0..1, colour] stops.
export const GRADE_RECIPES = [
  {
    id: 'posterInk', name: 'Poster Ink',
    stops: [[0, '#12041f'], [0.22, '#3d1160'], [0.45, '#8f1d7a'], [0.68, '#e83e6b'], [0.85, '#ff8a3c'], [1, '#ffe9b0']],
  },
  {
    id: 'viceSunset', name: 'Vice Sunset',
    stops: [[0, '#1a0533'], [0.25, '#5b1a8f'], [0.5, '#c22a7d'], [0.72, '#ff5e3a'], [0.88, '#ffb347'], [1, '#fff3c4']],
  },
  {
    id: 'neonNights', name: 'Neon Nights',
    stops: [[0, '#050a24'], [0.28, '#0b3b5e'], [0.52, '#0e7f8c'], [0.72, '#e83e8c'], [0.9, '#ff9ecf'], [1, '#eafcff']],
  },
  {
    id: 'goldenHour', name: 'Golden Hour',
    stops: [[0, '#1c0d04'], [0.3, '#5e2f0e'], [0.55, '#b45f16'], [0.78, '#f09a2e'], [1, '#ffedb8']],
  },
  {
    id: 'tealHeat', name: 'Teal Heat',
    stops: [[0, '#02181c'], [0.3, '#065a60'], [0.55, '#0fa3a3'], [0.78, '#ff7a59'], [1, '#ffe8c9']],
  },
  {
    id: 'noirInk', name: 'Noir Ink',
    stops: [[0, '#060409'], [0.35, '#241a33'], [0.62, '#6b5b84'], [0.85, '#b9aec9'], [1, '#f4f0fa']],
  },
  {
    id: 'pastelVice', name: 'Pastel Vice',
    stops: [[0, '#2c1836'], [0.3, '#7a4a86'], [0.55, '#e88bb0'], [0.78, '#ffb98a'], [1, '#fdf3d8']],
  },
];

const lutCache = new Map();
function lutFor(grade) {
  if (lutCache.has(grade.id)) return lutCache.get(grade.id);
  const stops = grade.stops.map(([p, c]) => [p, hexRGB(c)]);
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0], b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = (b[0] - a[0]) || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    for (let ch = 0; ch < 3; ch++) lut[i * 3 + ch] = Math.round(a[1][ch] + (b[1][ch] - a[1][ch]) * f);
  }
  lutCache.set(grade.id, lut);
  return lut;
}

export function gradeById(id) {
  return GRADE_RECIPES.find((g) => g.id === id) || GRADE_RECIPES[0];
}

// ---- panel geometry -------------------------------------------------------

export function layoutGrid6(W, H) {
  const rects = [];
  const cw = W / 3, ch = H / 2;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) rects.push({ x: c * cw, y: r * ch, w: cw, h: ch });
  return rects;
}

export function layoutMosaic9(W, H) {
  const rects = [];
  const cw = W / 3, ch = H / 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rects.push({ x: c * cw, y: r * ch, w: cw, h: ch });
  return rects;
}

export function layoutHeroStrip(W, H) {
  const hw = W * 0.38;
  const rects = [{ x: 0, y: 0, w: hw, h: H }];
  const rh = H / 3;
  for (let i = 0; i < 3; i++) rects.push({ x: hw, y: i * rh, w: W - hw, h: rh });
  return rects;
}

export function layoutDuoSplit(W, H) {
  return [
    { x: 0, y: 0, w: W * 0.56, h: H },
    { x: W * 0.44, y: 0, w: W * 0.56, h: H },
  ];
}

export function layoutFullBleed(W, H) {
  return [{ x: 0, y: 0, w: W, h: H }];
}

export function layoutTiltedShots(W, H) {
  // Second pass: rows nudged down and snapshots slimmed (0.40H -> 0.38H) so
  // the top row clears the compact title band and the bottom row leaves the
  // round badge in the corner some breathing room.
  const sw = W * 0.46, sh = H * 0.38;
  const cy0 = H * 0.43, cy1 = H * 0.75;
  return [
    { x: W * 0.255, y: cy0, w: sw, h: sh, rot: -0.055, cx: W * 0.255, cy: cy0 },
    { x: W * 0.745, y: cy0, w: sw, h: sh, rot: 0.05, cx: W * 0.745, cy: cy0 },
    { x: W * 0.255, y: cy1, w: sw, h: sh, rot: 0.045, cx: W * 0.255, cy: cy1 },
    { x: W * 0.745, y: cy1, w: sw, h: sh, rot: -0.05, cx: W * 0.745, cy: cy1 },
  ];
}

export const LAYOUTS = [
  { id: 'mosaic9', name: 'Mosaic 9 — nine-panel cover', panels: layoutMosaic9 },
  { id: 'grid6', name: 'Grid 6 — two rows of three', panels: layoutGrid6 },
  { id: 'heroStrip', name: 'Hero Strip — tall hero + stack', panels: layoutHeroStrip },
  { id: 'duoSplit', name: 'Duo Split — diagonal pair', panels: layoutDuoSplit },
  { id: 'fullBleed', name: 'Full Bleed — one big shot', panels: layoutFullBleed },
  { id: 'tiltedShots', name: 'Tilted Shots — snapshot scatter', panels: layoutTiltedShots },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

// ---- photo fitting --------------------------------------------------------

export function coverFit(img, w, h, zoom = 1, offX = 0, offY = 0) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale, dh = img.height * scale;
  return {
    dx: (w - dw) / 2 + offX * w * 0.3,
    dy: (h - dh) / 2 + offY * h * 0.3,
    dw, dh,
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---- grading pipeline -----------------------------------------------------

const imgIds = new WeakMap();
let imgSeq = 0;
function imgId(img) {
  if (!imgIds.has(img)) imgIds.set(img, ++imgSeq);
  return imgIds.get(img);
}

const gradedCache = new Map();
function gradedCanvasFor(img, grade, w, h) {
  w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
  const key = `${imgId(img)}|${grade.id}|${w}x${h}`;
  if (gradedCache.has(key)) return gradedCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const fit = coverFit(img, w, h, 1, 0, 0);
  ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
  const imageData = ctx.getImageData(0, 0, w, h);
  applyGrade(imageData, grade, w, h);
  ctx.putImageData(imageData, 0, 0);
  if (gradedCache.size > 48) gradedCache.clear();
  gradedCache.set(key, c);
  return c;
}

function applyGrade(imageData, grade, w, h) {
  const d = imageData.data;
  const n = w * h;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    lum[i] = 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
  }
  const lut = lutFor(grade);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const li = Math.max(0, Math.min(255, Math.round(lum[i]))) * 3;
    d[o] = lut[li]; d[o + 1] = lut[li + 1]; d[o + 2] = lut[li + 2];
  }
  if (grade.id === 'posterInk') {
    // Saturation lift, then a hard 6-level posterize per channel.
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const avg = (d[o] + d[o + 1] + d[o + 2]) / 3;
      for (let ch = 0; ch < 3; ch++) {
        let v = avg + (d[o + ch] - avg) * 1.28;
        v = Math.round((v / 255) * 5) / 5 * 255;
        d[o + ch] = Math.max(0, Math.min(255, v));
      }
    }
    darkenInkEdges(d, lum, w, h);
  } else if (grade.id === 'noirInk') {
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.round((d[o + ch] / 255) * 3) / 3 * 255;
    }
  }
}

// Sobel edges on the source luminance, blended back as multiply: flat areas
// stay clean, contours pick up the dark ink line that sells the illustration.
// Second pass: the edge threshold is normalised to the panel's own luminance
// range (mag / 340) and ink strength raised to 0.68, so fine detail reads on
// large panels without hairlines on flat sky; pixels already near-black are
// left alone so shadows do not crush to a solid block.
function darkenInkEdges(d, lum, w, h) {
  const strength = 0.68;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (lum[i] < 18) continue;
      const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1]
        + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
      const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1]
        + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      const edge = Math.min(1, mag / 340);
      if (edge <= 0.02) continue;
      const f = 1 - strength * edge;
      const o = i * 4;
      d[o] *= f; d[o + 1] *= f; d[o + 2] *= f;
    }
  }
}

// ---- lettering ------------------------------------------------------------

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawHeatStarMeter(ctx, cx, cy, r, stars) {
  const gap = r * 2.5;
  const x0 = cx - gap * 2;
  for (let i = 0; i < 5; i++) {
    starPath(ctx, x0 + i * gap, cy, r);
    if (i < stars) {
      const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
      g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#f59e0b');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.strokeStyle = i < stars ? '#7c4a03' : 'rgba(255,224,130,0.55)';
    ctx.stroke();
  }
}

export function paintHalftoneTitleBlock(ctx, W, H, title, subtitle, stars, dense = false, compact = false) {
  const band = H * (compact ? 0.155 : 0.21);
  const grad = ctx.createLinearGradient(0, 0, 0, band);
  grad.addColorStop(0, '#2a0a4a');
  grad.addColorStop(0.7, '#57165f');
  grad.addColorStop(1, '#7b1e6e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, band);

  // Halftone dots: radius breathes across the band; mosaic covers get a
  // denser pink field plus an offset cyan row, like cheap print ink.
  const spacing = dense ? Math.max(10, W / 110) : Math.max(14, W / 72);
  const dotR = spacing * (dense ? 0.30 : 0.24);
  ctx.fillStyle = dense ? 'rgba(255,92,168,0.5)' : 'rgba(255,120,200,0.34)';
  let row = 0;
  for (let y = spacing * 0.6; y < band; y += spacing, row++) {
    for (let x = spacing * 0.5 + (row % 2 ? spacing / 2 : 0); x < W; x += spacing) {
      const r = dotR * (0.55 + 0.45 * Math.sin((x / W) * Math.PI * 3 + row * 0.7));
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.6, r), 0, Math.PI * 2); ctx.fill();
    }
  }
  if (dense) {
    ctx.fillStyle = 'rgba(80,230,255,0.35)';
    for (let y = spacing * 0.6 + spacing / 2; y < band; y += spacing) {
      for (let x = spacing; x < W; x += spacing) {
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, dotR * 0.4), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, band - Math.max(2, H * 0.0035), W, Math.max(2, H * 0.0035));

  // Title: condensed heavy lettering, gradient fill, black outline, white edge.
  const text = (title || 'NEON COAST').toUpperCase();
  let px = band * 0.46;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const setFont = () => { ctx.font = `900 ${px}px "Arial Narrow", "Liberation Sans Narrow", Impact, sans-serif`; };
  setFont();
  while (ctx.measureText(text).width > W * 0.94 && px > 10) { px *= 0.94; setFont(); }
  const titleY = band * 0.38;
  const fill = ctx.createLinearGradient(0, titleY - px / 2, 0, titleY + px / 2);
  fill.addColorStop(0, '#ffe259');
  fill.addColorStop(0.55, '#ffa751');
  fill.addColorStop(1, '#ff5e8a');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0d0218';
  ctx.lineWidth = px * 0.17;
  ctx.strokeText(text, W / 2, titleY);
  ctx.fillStyle = fill;
  ctx.fillText(text, W / 2, titleY);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1, px * 0.028);
  ctx.strokeText(text, W / 2, titleY);

  // Subtitle: neon script with a cyan glow.
  const sub = subtitle || '';
  if (sub) {
    const spx = band * 0.21;
    ctx.font = `italic 700 ${spx}px "Segoe Script", "Brush Script MT", "Comic Sans MS", cursive`;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = band * 0.07;
    ctx.fillStyle = '#a5f3fc';
    ctx.fillText(sub, W / 2, band * 0.70);
    ctx.shadowBlur = 0;
  }

  drawHeatStarMeter(ctx, W / 2, band * 0.885, band * 0.062, stars || 0);
}

export function stampRoundBadge(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(14,3,28,0.92)';
  ctx.fill();
  ctx.lineWidth = r * 0.09;
  ctx.strokeStyle = '#f5c542';
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
  ctx.lineWidth = r * 0.03;
  ctx.strokeStyle = 'rgba(245,197,66,0.65)';
  ctx.stroke();
  starPath(ctx, x, y - r * 0.48, r * 0.17);
  ctx.fillStyle = '#f5c542';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `800 ${r * 0.27}px "Arial Narrow", sans-serif`;
  ctx.fillText('NEON COAST', x, y + r * 0.02);
  ctx.fillStyle = '#f0a6c8';
  ctx.font = `700 ${r * 0.23}px "Arial Narrow", sans-serif`;
  ctx.fillText('EST. 2026', x, y + r * 0.34);
  ctx.restore();
}

// ---- grain + vignette -----------------------------------------------------

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function paintGrain(ctx, W, H) {
  const rand = lcg(987654321);
  const count = Math.floor((W * H) / 650);
  for (let i = 0; i < count; i++) {
    const x = rand() * W, y = rand() * H;
    const a = 0.03 + rand() * 0.06;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }
}

function paintVignette(ctx, W, H) {
  const r = Math.hypot(W, H) / 2;
  const g = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
  g.addColorStop(0, 'rgba(8,0,16,0)');
  g.addColorStop(1, 'rgba(8,0,16,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---- the cover ------------------------------------------------------------

function panelClipPath(ctx, layoutId, rect, W, H) {
  ctx.beginPath();
  if (layoutId === 'duoSplit') {
    const top = W * 0.56, bot = W * 0.44;
    if (rect.x === 0) {
      ctx.moveTo(0, 0); ctx.lineTo(top, 0); ctx.lineTo(bot, H); ctx.lineTo(0, H);
    } else {
      ctx.moveTo(top, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(bot, H);
    }
    ctx.closePath();
  } else {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
  }
}

function drawPanel(ctx, img, grade, rect, panel, layoutId, W, H) {
  const graded = gradedCanvasFor(img, grade, rect.w, rect.h);
  const z = panel.zoom || 1;
  const dw = rect.w * z, dh = rect.h * z;
  const dx = rect.x + (rect.w - dw) / 2 + (panel.offX || 0) * rect.w * 0.3;
  const dy = rect.y + (rect.h - dh) / 2 + (panel.offY || 0) * rect.h * 0.3;
  ctx.save();
  panelClipPath(ctx, layoutId, rect, W, H);
  ctx.clip();
  ctx.drawImage(graded, dx, dy, dw, dh);
  ctx.restore();
  ctx.save();
  panelClipPath(ctx, layoutId, rect, W, H);
  ctx.lineWidth = Math.max(3, Math.round(W * 0.0035));
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
}

function drawTiltedPanel(ctx, img, grade, rect, panel) {
  const graded = gradedCanvasFor(img, grade, rect.w, rect.h);
  ctx.save();
  ctx.translate(rect.cx, rect.cy);
  ctx.rotate(rect.rot || 0);
  const frame = Math.max(8, rect.w * 0.022);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-rect.w / 2 - frame, -rect.h / 2 - frame, rect.w + frame * 2, rect.h + frame * 2.6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
  ctx.clip();
  const z = panel.zoom || 1;
  const dw = rect.w * z, dh = rect.h * z;
  ctx.drawImage(graded, -dw / 2 + (panel.offX || 0) * rect.w * 0.3, -dh / 2 + (panel.offY || 0) * rect.h * 0.3, dw, dh);
  ctx.restore();
  ctx.restore();
}

export function renderCover(canvas, state) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const layout = layoutById(state.layout);
  const grade = gradeById(state.grade);
  const rects = layout.panels(W, H);
  const tilted = layout.id === 'tiltedShots';

  // Backdrop.
  if (tilted) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#2a0a4a');
    g.addColorStop(0.55, '#7b1e6e');
    g.addColorStop(1, '#ff7a3c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#160830');
    g.addColorStop(1, '#2b0f45');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photoIndex: i % Math.max(1, state.photos.length), zoom: 1, offX: 0, offY: 0 };
    const img = state.photos[panel.photoIndex] || state.photos[0];
    if (!img) return;
    if (tilted) drawTiltedPanel(ctx, img, grade, rect, panel);
    else drawPanel(ctx, img, grade, rect, panel, layout.id, W, H);
  });

  paintVignette(ctx, W, H);
  paintHalftoneTitleBlock(ctx, W, H, state.title, state.subtitle, state.stars, layout.id === 'mosaic9', tilted);
  const br = Math.min(W, H) * 0.058;
  stampRoundBadge(ctx, W - br - W * 0.018, H - br - H * 0.022, br);
  paintGrain(ctx, W, H);
}
