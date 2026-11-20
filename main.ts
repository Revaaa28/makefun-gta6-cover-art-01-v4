// NEON COAST — Vice Cover Studio, a gta6-cover-art-01 entry (Node 22, standard library only).
// The app is this directory's app/ folder: plain static files a desktop browser loads fully offline
// (app/index.html and its ES modules, no library, no network request). It turns a visitor's own photos
// plus a caption into GTA-style multi-panel cover art — nine-panel mosaic by default, Poster Ink
// illustrated grade, per-panel crop and zoom, PNG export in the four common post sizes — and this
// program hands it in: it copies app/ and screenshots/ from beside this file to the output directory
// and writes dossier.json there, the summary the judge reads, with the vendored make.fun library.
//
// Serve it locally with any static file server rooted at app/, then open it in a browser.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry is judged from its screenshots (the first by name is the cover), so refuse to hand in
// anything but the expected 3 or 4 image files.
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing: the entry needs 3 or 4 screenshots');
const shotFiles = readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 image files, found ${shotFiles.length}`);
}
// Second pass: refuse an oversized screenshot here, before anything is
// copied — a screenshot over the scorer's 256 KiB cap would fail intake.
for (const f of shotFiles) {
  const bytes = statSync(join(shotsDir, f)).size;
  if (bytes > 262144) throw new Error(`screenshots/${f} is ${bytes} bytes, over the 256 KiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// Confirm the dossier landed and report its size, so a silent write failure
// can never masquerade as a handed-in entry.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`NEON COAST handed in: ${shotFiles.length} screenshots, dossier.json ${dossierBytes} bytes.`);
