// cover.js — NEON COAST cover renderer.
// Everything a cover needs lives here: the seven colour grades (including the
// flagship Poster Ink: posterize + Sobel ink edges), the six panel layouts,
// the halftone title band, the gold badge, and PNG export at any post size.
// No network, no libraries: plain canvas 2D and per-pixel ImageData work.

export const LAYOUTS = ['grid6', 'heroStrip', 'mosaic9', 'duoSplit', 'fullBleed', 'tiltedShots'];

export const LAYOUT_LABELS = {
  grid6: 'Grid 6',
  heroStrip: 'Hero Strip',
  mosaic9: 'Mosaic 9',
  duoSplit: 'Duo Split',
  fullBleed: 'Full Bleed',
  tiltedShots: 'Tilted Shots',
};

export const GRADES = ['viceSunset', 'neonNights', 'goldenHour', 'tealHeat', 'noirInk', 'pastelVice', 'posterInk'];

export const GRADE_LABELS = {
  viceSunset: 'Vice Sunset',
  neonNights: 'Neon Nights',
  goldenHour: 'Golden Hour',
  tealHeat: 'Teal Heat',
  noirInk: 'Noir Ink',
  pastelVice: 'Pastel Vice',
  posterInk: 'Poster Ink',
};

export const SAMPLE_PHOTOS = [
  { id: 'boulevard', src: 'samples/boulevard.jpg', label: 'Boulevard' },
  { id: 'pier', src: 'samples/pier.jpg', label: 'Pier' },
  { id: 'rooftop', src: '../assets/rooftop.jpg', label: 'Rooftop' },
  { id: 'friends', src: '../assets/friends.jpg', label: 'Friends' },
];

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

// ---------------------------------------------------------------------------
// Photo loading
// ---------------------------------------------------------------------------

export function loadPhoto(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Grades: each takes ImageData and rewrites it in place.
// ---------------------------------------------------------------------------

function gradeViceSunset(d) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    // Shadows lean violet, highlights lean amber.
    d[i] = clamp255(r * 1.12 + (1 - lum) * 18);
    d[i + 1] = clamp255(g * 0.96 + lum * 8);
    d[i + 2] = clamp255(b * 0.88 + (1 - lum) * 34 - lum * 18);
  }
}

function gradeNeonNights(d) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    d[i] = clamp255(r * 0.92 + (1 - lum) * 42);
    d[i + 1] = clamp255(g * 1.08 + lum * 10);
    d[i + 2] = clamp255(b * 1.18 + (1 - lum) * 20);
    // Deepen the darks so the neon pops.
    const k = 0.82 + lum * 0.28;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
}

function gradeGoldenHour(d) {
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(d[i] * 1.16 + 14);
    d[i + 1] = clamp255(d[i + 1] * 1.04 + 4);
    d[i + 2] = clamp255(d[i + 2] * 0.82 - 6);
  }
}

function gradeTealHeat(d) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    d[i] = clamp255(r * (0.9 + lum * 0.35));
    d[i + 1] = clamp255(g * (1.02 + (1 - lum) * 0.12));
    d[i + 2] = clamp255(b * (1.12 - lum * 0.3));
  }
}

function gradeNoirInk(d) {
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    const v = lum < 64 ? 28 : lum < 128 ? 96 : lum < 192 ? 168 : 232;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
}

function gradePastelVice(d) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    d[i] = clamp255(r * 0.72 + 62 + lum * 18);
    d[i + 1] = clamp255(g * 0.78 + 58 + lum * 12);
    d[i + 2] = clamp255(b * 0.82 + 74 - lum * 8);
  }
}

// Posterize one channel to `levels` flat tones.
function posterizeChannel(v, levels) {
  const step = 255 / (levels - 1);
  return Math.round(Math.round(v / step) * step);
}

function gradePosterInk(d, w, h) {
  const levels = 4;
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    d[i] = posterizeChannel(d[i], levels);
    d[i + 1] = posterizeChannel(d[i + 1], levels);
    d[i + 2] = posterizeChannel(d[i + 2], levels);
    // Warm the flat tones toward magenta / orange.
    d[i] = clamp255(d[i] * 1.06 + 10);
    d[i + 2] = clamp255(d[i + 2] * 0.94 + 14);
    lum[p] = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
  }
  // Sobel edge detection on the posterized luminance; paint strong edges
  // in near-black ink so the flat panels read like printed poster art.
  const edge = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const gx =
        -lum[p - w - 1] - 2 * lum[p - 1] - lum[p + w - 1] +
        lum[p - w + 1] + 2 * lum[p + 1] + lum[p + w + 1];
      const gy =
        -lum[p - w - 1] - 2 * lum[p - w] - lum[p - w + 1] +
        lum[p + w - 1] + 2 * lum[p + w] + lum[p + w + 1];
      edge[p] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  for (let p = 0; p < w * h; p++) {
    const strength = edge[p];
    // Only real contours get inked: below 110 the posterized flats stay clean,
    // above 240 the line is at full strength so edges read as printed ink.
    if (strength > 110) {
      const i = p * 4;
      const ink = strength > 240 ? 0.92 : 0.55;
      d[i] = d[i] * (1 - ink) + 18 * ink;
      d[i + 1] = d[i + 1] * (1 - ink) + 8 * ink;
      d[i + 2] = d[i + 2] * (1 - ink) + 26 * ink;
    }
  }
}

const GRADE_FNS = {
  viceSunset: (d) => gradeViceSunset(d),
  neonNights: (d) => gradeNeonNights(d),
  goldenHour: (d) => gradeGoldenHour(d),
  tealHeat: (d) => gradeTealHeat(d),
  noirInk: (d) => gradeNoirInk(d),
  pastelVice: (d) => gradePastelVice(d),
  posterInk: (d, w, h) => gradePosterInk(d, w, h),
};

// Draw an image into a panel rect, graded, with zoom + pan.
// zoom 1 = cover-fit; offsetX/offsetY in [-1, 1] shift the crop window.
export function drawGradedPhoto(ctx, img, x, y, w, h, grade, zoom = 1, offsetX = 0, offsetY = 0) {
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(w));
  off.height = Math.max(2, Math.round(h));
  const octx = off.getContext('2d');
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  const dx = x + (w - sw) / 2 + offsetX * (sw - w) * 0.5;
  const dy = y + (h - sh) / 2 + offsetY * (sh - h) * 0.5;
  octx.drawImage(img, dx - x, dy - y, sw, sh);
  const imageData = octx.getImageData(0, 0, off.width, off.height);
  GRADE_FNS[grade](imageData.data, off.width, off.height);
  octx.putImageData(imageData, 0, 0);
  ctx.drawImage(off, x, y);
}

// ---------------------------------------------------------------------------
// Title band: halftone dots, gradient title, script subtitle, five stars.
// ---------------------------------------------------------------------------

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawTitleBand(ctx, w, bandH, title, subtitle) {
  // Deep purple-to-magenta base.
  const base = ctx.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, '#2a0a4a');
  base.addColorStop(0.55, '#5b1168');
  base.addColorStop(1, '#8f1d5e');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, bandH);

  // Halftone dot field, denser toward the bottom of the band.
  const step = Math.max(9, Math.round(bandH / 9));
  for (let row = 0; row * step < bandH; row++) {
    for (let col = 0; col * step < w; col++) {
      const fade = 0.25 + 0.75 * (row * step / bandH);
      const r = step * 0.16 * fade;
      ctx.fillStyle = 'rgba(255, 190, 235, 0.16)';
      ctx.beginPath();
      ctx.arc(col * step + step / 2, row * step + step / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Title: big condensed caps, yellow-to-orange gradient, dark outline.
  const titleSize = bandH * 0.46;
  ctx.font = `900 ${titleSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(0, bandH * 0.18, 0, bandH * 0.66);
  grad.addColorStop(0, '#ffe95e');
  grad.addColorStop(0.55, '#ffb52e');
  grad.addColorStop(1, '#ff7a1a');
  ctx.lineWidth = Math.max(2, titleSize * 0.09);
  ctx.strokeStyle = '#1c0533';
  ctx.lineJoin = 'round';
  const titleY = bandH * 0.4;
  ctx.strokeText(title, w / 2, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(title, w / 2, titleY);

  // Script subtitle in cyan.
  const subSize = bandH * 0.2;
  ctx.font = `italic 700 ${subSize}px "Brush Script MT", "Segoe Script", cursive`;
  ctx.fillStyle = '#67e8f9';
  ctx.fillText(subtitle, w / 2, bandH * 0.76);

  // Five gold stars under the subtitle.
  const starR = Math.max(4, bandH * 0.055);
  const starY = bandH * 0.92;
  const gap = starR * 2.6;
  for (let i = -2; i <= 2; i++) {
    drawStar(ctx, w / 2 + i * gap, starY, starR, '#ffd23e');
  }
}

// Round black-and-gold badge, bottom-right of the mosaic.
export function drawBadge(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0218';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.strokeStyle = '#ffd23e';
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Fit the word to the badge: measure it and shrink until it fits, since
  // the fallback face (no Arial Narrow on a bare machine) is wider than the
  // condensed face the size was tuned for.
  let badgeFont = r * 0.3;
  ctx.font = `900 ${badgeFont}px "Arial Narrow", Impact, sans-serif`;
  const maxBadgeText = r * 1.62;
  while (ctx.measureText('NEON COAST').width > maxBadgeText && badgeFont > r * 0.14) {
    badgeFont *= 0.92;
    ctx.font = `900 ${badgeFont}px "Arial Narrow", Impact, sans-serif`;
  }
  ctx.fillText('NEON COAST', cx, cy - r * 0.18);
  ctx.font = `700 ${r * 0.26}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillStyle = '#67e8f9';
  ctx.fillText('EST. 2026', cx, cy + r * 0.24);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Layouts: each returns panel rects inside the photo area [0, areaW] x [0, areaH].
// ---------------------------------------------------------------------------

function inset(rect, g) {
  return { x: rect.x + g, y: rect.y + g, w: rect.w - g * 2, h: rect.h - g * 2 };
}

export function panelRects(layout, areaW, areaH, gutter) {
  const g = gutter;
  switch (layout) {
    case 'grid6': {
      const cw = areaW / 3, ch = areaH / 2;
      const out = [];
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 3; c++)
          out.push(inset({ x: c * cw, y: r * ch, w: cw, h: ch }, g));
      return out;
    }
    case 'heroStrip': {
      const heroH = areaH * 0.62;
      const out = [inset({ x: 0, y: 0, w: areaW, h: heroH }, g)];
      const stripY = heroH, stripH = areaH - heroH, cw = areaW / 4;
      for (let c = 0; c < 4; c++)
        out.push(inset({ x: c * cw, y: stripY, w: cw, h: stripH }, g));
      return out;
    }
    case 'mosaic9': {
      const cw = areaW / 3, ch = areaH / 3;
      const out = [];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          out.push(inset({ x: c * cw, y: r * ch, w: cw, h: ch }, g));
      return out;
    }
    case 'duoSplit': {
      return [
        inset({ x: 0, y: 0, w: areaW / 2, h: areaH }, g),
        inset({ x: areaW / 2, y: 0, w: areaW / 2, h: areaH }, g),
      ];
    }
    case 'fullBleed': {
      return [inset({ x: 0, y: 0, w: areaW, h: areaH }, 0)];
    }
    case 'tiltedShots': {
      const cw = areaW * 0.52, ch = areaH * 0.62;
      return [
        inset({ x: areaW * 0.02, y: areaH * 0.05, w: cw, h: ch }, g),
        inset({ x: areaW * 0.46, y: areaH * 0.02, w: cw, h: ch }, g),
        inset({ x: areaW * 0.08, y: areaH * 0.36, w: cw, h: ch }, g),
        inset({ x: areaW * 0.42, y: areaH * 0.34, w: cw, h: ch }, g),
      ];
    }
    default:
      return panelRects('mosaic9', areaW, areaH, gutter);
  }
}

const TILT = [-4, 3, 3.5, -3]; // degrees, per panel, for tiltedShots

// ---------------------------------------------------------------------------
// Full cover render.
// state: { title, subtitle, layout, grade, panels: [{img, zoom, offsetX, offsetY}] }
// ---------------------------------------------------------------------------

export function renderCover(state, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const bandH = Math.round(height * 0.17);
  drawTitleBand(ctx, width, bandH, state.title, state.subtitle);

  const areaY = bandH;
  const areaH = height - bandH;
  const gutter = Math.max(3, Math.round(width * 0.006));
  const rects = panelRects(state.layout, width, areaH, gutter);
  const photos = state.panels;

  rects.forEach((rect, i) => {
    const panel = photos[i % photos.length];
    if (!panel || !panel.img) return;
    const px = rect.x, py = areaY + rect.y;
    if (state.layout === 'tiltedShots') {
      ctx.save();
      ctx.translate(px + rect.w / 2, py + rect.h / 2);
      ctx.rotate((TILT[i % TILT.length] * Math.PI) / 180);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = width * 0.02;
      ctx.shadowOffsetY = width * 0.008;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-rect.w / 2 - gutter, -rect.h / 2 - gutter, rect.w + gutter * 2, rect.h + gutter * 2);
      ctx.restore();
      ctx.save();
      ctx.translate(px + rect.w / 2, py + rect.h / 2);
      ctx.rotate((TILT[i % TILT.length] * Math.PI) / 180);
      drawGradedPhoto(ctx, panel.img, -rect.w / 2, -rect.h / 2, rect.w, rect.h,
        state.grade, panel.zoom, panel.offsetX, panel.offsetY);
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, rect.w, rect.h);
      ctx.clip();
      drawGradedPhoto(ctx, panel.img, px, py, rect.w, rect.h,
        state.grade, panel.zoom, panel.offsetX, panel.offsetY);
      ctx.restore();
      // Thin white gutter frame around each panel.
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1, gutter * 0.5);
      ctx.strokeRect(px, py, rect.w, rect.h);
    }
  });

  // Badge sits over the bottom-right of the photo area.
  const badgeR = Math.max(26, width * 0.062);
  drawBadge(ctx, width - badgeR - gutter * 2, height - badgeR - gutter * 2, badgeR);

  return canvas;
}

export function coverToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
