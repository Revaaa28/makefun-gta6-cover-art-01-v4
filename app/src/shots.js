// NEON COAST — Vice Cover Studio: canned scenes for screenshot mode.
// Open the app with ?shot=<name> and the editor applies the scene, renders at
// the scene's full export size and hides its own chrome — except the editor
// scene, which keeps the full editor UI visible for the editor screenshot.
// Second pass: each scene now carries a short description (used by shots.json
// tooling and the README) and the editor scene pre-selects the centre panel,
// so the editor screenshot shows a mid-grid panel selected with its controls.
export const SHOT_SCENES = {
  cover: {
    layout: 'mosaic9', grade: 'posterInk',
    title: 'NEON COAST', subtitle: 'Sunset Heist', stars: 5,
    size: { w: 1920, h: 1080 },
    description: 'The exported nine-panel Poster Ink cover at landscape size.',
  },
  editor: {
    layout: 'mosaic9', grade: 'posterInk',
    title: 'NEON COAST', subtitle: 'Sunset Heist', stars: 5,
    size: { w: 1920, h: 1080 },
    chrome: true, selected: 4,
    description: 'The editor with the sample library loaded and the centre panel selected.',
  },
  portrait: {
    layout: 'mosaic9', grade: 'neonNights',
    title: 'Boulevard Queen', subtitle: 'Neon Nights', stars: 5,
    size: { w: 1080, h: 1350 },
    description: 'The exported portrait cover in the Neon Nights grade.',
  },
  square: {
    layout: 'tiltedShots', grade: 'goldenHour',
    title: 'Pier Pressure', subtitle: 'Golden Hour', stars: 5,
    size: { w: 1080, h: 1080 },
    description: 'The exported square cover in the tilted-snapshot layout.',
  },
};
