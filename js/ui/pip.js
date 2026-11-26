// Pip — One Find's original pixel companion (16×16, hand-drawn for this app).
import { html } from '../vendor/preact-htm.js';

const PAL = {"o": "#2b2440", "b": "#beacff", "l": "#e2d8ff", "s": "#9680e8", "c": "#ff96aa", "e": "#2b2440", "w": "#ffffff", "g": "#6ec878", "d": "#348250", "m": "#2b2440", "z": "#78b4ff"};
const MOODS = {
 "happy": [
  "................",
  "........dd......",
  ".......dggd.....",
  "......dgd.......",
  ".......d........",
  "....oooooooo....",
  "...obbllbbbbo...",
  "..oblllbbbbbbo..",
  ".obllbbbbbbbbbo.",
  ".obbwebbbbwebbo.",
  "obbbeebbbbeebbbo",
  "obccbbmbbmbbccbo",
  "obbbbbbmmbbbbbso",
  ".obbbbbbbbbbbso.",
  "..ossbbbbbbsso..",
  "...oooooooooo..."
 ],
 "wow": [
  "................",
  "........dd......",
  ".......dggd.....",
  "......dgd.......",
  ".......d........",
  "....oooooooo....",
  "...obbllbbbbo...",
  "..oblllbbbbbbo..",
  ".obleebbbbeebbo.",
  ".obbwebbbbwebbo.",
  "obbbeebbbbeebbbo",
  "obccbbbmmbbbccbo",
  "obbbbbbmmbbbbbso",
  ".obbbbbbbbbbbso.",
  "..ossbbbbbbsso..",
  "...oooooooooo..."
 ],
 "sleepy": [
  "............zzzz",
  "........dd....z.",
  ".......dggd..z..",
  "......dgd...zzzz",
  ".......d........",
  "....oooooooo....",
  "...obbllbbbbo...",
  "..oblllbbbbbbo..",
  ".obllbbbbbbbbbo.",
  ".obbbbbbbbbbbbo.",
  "obbbeebbbbeebbbo",
  "obccbbmbbmbbccbo",
  "obbbbbbmmbbbbbso",
  ".obbbbbbbbbbbso.",
  "..ossbbbbbbsso..",
  "...oooooooooo..."
 ],
 "worried": [
  "................",
  "........dd......",
  ".......dggd.....",
  "......dgd.......",
  ".......d........",
  "....oooooooo....",
  "...obbllbbbbo...",
  "..oblllbbbbbbz..",
  ".obllbbbbbbbzzo.",
  ".obbwebbbbwebbo.",
  "obbbeebbbbeebbbo",
  "obccbbbbbbbbccbo",
  "obbbbbbmmbbbbbso",
  ".obbbbmbbmbbbso.",
  "..ossbbbbbbsso..",
  "...oooooooooo..."
 ]
};

// Merge horizontal runs of the same colour into one <rect> to keep the SVG tiny.
const cache = {};
function rects(mood) {
  if (cache[mood]) return cache[mood];
  const out = [];
  (MOODS[mood] || MOODS.happy).forEach((row, y) => {
    let x = 0;
    while (x < 16) {
      const c = row[x];
      let w = 1;
      while (x + w < 16 && row[x + w] === c) w++;
      if (c !== '.') out.push([x, y, w, PAL[c]]);
      x += w;
    }
  });
  return (cache[mood] = out);
}

export const Pip = ({ mood = 'happy', size = 64, bounce }) => html`
  <svg class=${'pip' + (bounce ? ' bounce' : '')} width=${size} height=${size} viewBox="0 0 16 16" shape-rendering="crispEdges" role="img" aria-label="Pip the helper">
    ${rects(mood).map(([x, y, w, f]) => html`<rect x=${x} y=${y} width=${w} height="1" fill=${f} />`)}
  </svg>`;

// A tiny 5×7 pixel font for the desk clock — crisp and unambiguous digits.
const DIGITS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['0', '0', '1', '0', '1', '0', '0']
};
export function PixelClock({ text, color = '#ffe7a3' }) {
  const cells = [];
  let x = 0;
  for (const ch of text) {
    const g = DIGITS[ch];
    if (!g) continue;
    g.forEach((row, y) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') cells.push([x + i, y]); });
    x += g[0].length + 1;
  }
  const w = x - 1;
  return html`<svg class="pclock" viewBox=${`0 0 ${w} 7`} shape-rendering="crispEdges" role="img" aria-label=${'Time ' + text}>
    ${cells.map(([cx, cy]) => html`<rect x=${cx} y=${cy} width="1" height="1" fill=${color} />`)}</svg>`;
}
