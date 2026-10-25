// Paints the De Klok 50cl can artwork onto two canvases:
//   color – base colour (sRGB)
//   mr    – glTF metallicRoughness map (G = roughness, B = metalness)
// All drawing is in millimetres on the unrolled can body; x runs around the
// circumference (front of the can at x = C/2), y runs down from the top of the
// printed body.

export const R = 33.1; // body radius, mm
export const C = 2 * Math.PI * R; // circumference, mm
export const BODY_BOTTOM = 9; // world y (mm) where the printed body starts
export const BODY_TOP = 152; // world y (mm) where it ends at the shoulder
export const LABEL_H = BODY_TOP - BODY_BOTTOM;
// Label resolution: 4096 px around the can, 2048 on touch devices to spare
// their memory. `?tex=` on the page URL overrides it.
export const TEX_W =
  Number(new URLSearchParams(location.search).get('tex')) ||
  (matchMedia('(pointer: coarse)').matches ? 2048 : 4096);
export const PX = TEX_W / C;
export const TEX_H = Math.round(LABEL_H * PX);

const FRONT = C / 2;

// Material channels for the metallicRoughness map: [roughness, metalness].
const MAT = {
  alu: [0.3, 1.0],
  goldInk: [0.32, 1.0],
  greyInk: [0.36, 1.0],
  white: [0.42, 0.0],
  ink: [0.38, 0.0],
  inkOnMetal: [0.32, 0.55],
};
const mrStyle = ([r, m]) => `rgb(0,${Math.round(r * 255)},${Math.round(m * 255)})`;

const SERIF = '"DejaVu Serif", serif';
const SANS = '"DejaVu Sans", sans-serif';

const COL = {
  green: '#2f9e3a',
  greenLight: '#56b947',
  greenDark: '#0d5a2a',
  klok: '#0f4f2a',
  gold: '#c9a34e',
  goldDeep: '#a77b2a',
  bier: '#c08a2b',
  red: '#c3242d',
  ink: '#2a2620',
  white: '#fbfaf5',
};

// Small deterministic RNG so the artwork is identical on every build.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draws `fn(ctx, style)` into both canvases: once with the visible colour,
// once with the material it is printed in. `color` may be a function of ctx
// (for gradients). Drawing is repeated at x ± C so artwork wraps the seam.
class Painter {
  constructor(color, mr) {
    this.ctxs = [color.getContext('2d'), mr.getContext('2d')];
    for (const ctx of this.ctxs) {
      ctx.setTransform(PX, 0, 0, PX, 0, 0);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
    }
  }
  layer(color, mat, fn, { wrap = false } = {}) {
    const [cc, mc] = this.ctxs;
    const offsets = wrap ? [-C, 0, C] : [0];
    for (const dx of offsets) {
      for (const [ctx, style] of [
        [cc, typeof color === 'function' ? color(cc) : color],
        [mc, mrStyle(mat)],
      ]) {
        ctx.save();
        ctx.translate(dx, 0);
        fn(ctx, style);
        ctx.restore();
      }
    }
  }
  // Draws a pre-rendered image pair (colour + material) into the two canvases.
  image(colorImg, mrImg, x, y, w, h) {
    this.ctxs[0].drawImage(colorImg, x, y, w, h);
    this.ctxs[1].drawImage(mrImg, x, y, w, h);
  }
  // Only touches the colour canvas (shading that does not change material).
  colorOnly(fn) {
    const ctx = this.ctxs[0];
    ctx.save();
    fn(ctx);
    ctx.restore();
  }
}

// --- shapes -----------------------------------------------------------------

// A curved, pointed leaf (barley / wheat blade) from base (x, y) along angle a.
function leafPath(ctx, { x, y, a, L, w, bend = 0.12 }) {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const nx = -dy;
  const ny = dx;
  const tipX = x + dx * L + nx * bend * L;
  const tipY = y + dy * L + ny * bend * L;
  const at = (t, side) => {
    // point along the curved spine at t, offset by `side` along the normal
    const sx = x + dx * L * t + nx * bend * L * t * t;
    const sy = y + dy * L * t + ny * bend * L * t * t;
    return [sx + nx * side, sy + ny * side];
  };
  ctx.moveTo(x, y);
  const [a1x, a1y] = at(0.3, w * 0.9);
  const [a2x, a2y] = at(0.72, w * 0.75);
  ctx.bezierCurveTo(a1x, a1y, a2x, a2y, tipX, tipY);
  const [b2x, b2y] = at(0.72, -w * 0.55);
  const [b1x, b1y] = at(0.3, -w * 0.8);
  ctx.bezierCurveTo(b2x, b2y, b1x, b1y, x, y);
  ctx.closePath();
}

// Badge outline traced from the bottle label: an arched top that rises around
// the crest, a pinched waist, bulging lower sides and a broad rounded base.
// Right half as cubic segments [c1u, c1v, c2u, c2v, u, v] in the unit box,
// starting at the top centre; the left half is its mirror image.
const BADGE_RIGHT = [
  [0.6, 0.0, 0.62, 0.07, 0.68, 0.075],
  [0.76, 0.08, 0.86, 0.09, 0.91, 0.12],
  [0.955, 0.145, 0.975, 0.18, 0.975, 0.22],
  [0.975, 0.32, 0.915, 0.38, 0.915, 0.48],
  [0.915, 0.6, 1.0, 0.66, 1.0, 0.76],
  [1.0, 0.83, 0.97, 0.87, 0.93, 0.89],
  [0.8, 0.95, 0.65, 1.0, 0.5, 1.0],
];
const BADGE_ASPECT = 0.92; // height / width (the bottle label is 0.87; the can's is a touch taller)

function badgePath(ctx, x0, y0, w, h) {
  const P = (u, v) => [x0 + u * w, y0 + v * h];
  ctx.moveTo(...P(0.5, 0));
  for (const [a, b, c, d, e, f] of BADGE_RIGHT) ctx.bezierCurveTo(...P(a, b), ...P(c, d), ...P(e, f));
  for (let i = BADGE_RIGHT.length - 1; i >= 0; i--) {
    const [a, b, c, d] = BADGE_RIGHT[i];
    const [pu, pv] = i > 0 ? BADGE_RIGHT[i - 1].slice(4) : [0.5, 0];
    ctx.bezierCurveTo(...P(1 - c, d), ...P(1 - a, b), ...P(1 - pu, pv));
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Text squeezed horizontally to `maxW` mm (keeps the condensed label lettering).
function fitText(ctx, text, x, y, size, font, maxW, mode = 'fill') {
  ctx.font = font.replace('$', `${size}px`);
  const w = ctx.measureText(text).width;
  const sx = maxW && w > maxW ? maxW / w : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  if (mode === 'fill') ctx.fillText(text, 0, 0);
  else ctx.strokeText(text, 0, 0);
  ctx.restore();
}

// Text laid on a circular arc centred on (cx, cy), reading left to right over the top.
function arcText(ctx, text, cx, cy, radius, size, font, spacing = 0) {
  ctx.font = font.replace('$', `${size}px`);
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((s, w) => s + w, 0) - spacing;
  let ang = -Math.PI / 2 - total / radius / 2;
  for (let i = 0; i < text.length; i++) {
    const w = widths[i];
    const mid = ang + (w - spacing) / 2 / radius;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * radius, cy + Math.sin(mid) * radius);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    ang += w / radius;
  }
}

// Vertical text reading bottom-to-top, starting at (x, y).
function vText(ctx, text, x, y, size, font) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.font = font.replace('$', `${size}px`);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Block of small vertical (bottom-to-top) text wrapped into columns.
function vParagraph(ctx, text, x, yBottom, length, size, font, lineGap = 1.3) {
  ctx.font = font.replace('$', `${size}px`);
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > length && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => vText(ctx, l, x + i * size * lineGap, yBottom, size, font));
  return lines.length * size * lineGap;
}

// --- artwork ----------------------------------------------------------------

function background(p) {
  // Brushed aluminium: faint horizontal streaks around the can.
  p.layer('#d9dbdd', MAT.alu, (ctx, s) => {
    ctx.fillStyle = s;
    ctx.fillRect(-1, -1, C + 2, LABEL_H + 2);
  });
  const rand = rng(7);
  p.colorOnly((ctx) => {
    for (let i = 0; i < 900; i++) {
      const y = rand() * LABEL_H;
      const l = 200 + rand() * 40;
      ctx.strokeStyle = `rgba(${l},${l},${l + 4},${0.08 + rand() * 0.12})`;
      ctx.lineWidth = 0.05 + rand() * 0.15;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(C, y);
      ctx.stroke();
    }
  });
}

const goldFill = (ctx) => {
  const g = ctx.createLinearGradient(0, 0, 40, LABEL_H);
  g.addColorStop(0, '#d9b664');
  g.addColorStop(0.45, '#c79d45');
  g.addColorStop(1, '#d6b15c');
  return g;
};

function goldSwathe(p) {
  // The broad gold field that wraps from the right of the shield round to the back.
  p.layer(goldFill, MAT.goldInk, (ctx, s) => {
    ctx.fillStyle = s;
    ctx.beginPath();
    ctx.moveTo(FRONT + 26, -2);
    ctx.bezierCurveTo(FRONT + 34, 40, FRONT + 18, 90, FRONT + 30, LABEL_H + 2);
    ctx.lineTo(C - 18, LABEL_H + 2);
    ctx.bezierCurveTo(C - 10, 100, C - 30, 60, C - 12, -2);
    ctx.closePath();
    ctx.fill();
  });

  // Big sweeping gold leaves.
  const big = [
    // across the front top-left, behind the shield
    { x: FRONT - 60, y: 70, a: -1.05, L: 95, w: 11, bend: 0.18 },
    { x: FRONT - 48, y: 30, a: -0.55, L: 70, w: 8, bend: 0.2 },
    { x: FRONT - 5, y: 12, a: -0.35, L: 60, w: 7, bend: 0.1 },
    // bottom-left of the front
    { x: FRONT - 66, y: 150, a: -0.95, L: 70, w: 10, bend: 0.15 },
    { x: FRONT - 40, y: 150, a: -1.2, L: 48, w: 7, bend: 0.22 },
    // leaves breaking up the left edge of the gold field
    { x: FRONT + 40, y: 120, a: -2.2, L: 40, w: 6, bend: 0.2 },
    { x: FRONT + 38, y: 70, a: -2.5, L: 30, w: 5, bend: -0.25 },
    { x: FRONT + 34, y: 30, a: -2.0, L: 34, w: 5, bend: 0.2 },
    { x: FRONT + 36, y: 142, a: -2.7, L: 26, w: 4, bend: 0.1 },
    // gold reaching onto the back
    { x: C - 22, y: 150, a: -1.15, L: 120, w: 13, bend: -0.12 },
    { x: 4, y: 150, a: -1.45, L: 55, w: 8, bend: -0.2 },
    { x: 18, y: 30, a: -0.6, L: 40, w: 6, bend: 0.25 },
    { x: 34, y: 18, a: -0.25, L: 36, w: 5, bend: 0.3 },
  ];
  for (const leaf of big) {
    p.layer(goldFill, MAT.goldInk, (ctx, s) => {
      ctx.fillStyle = s;
      ctx.beginPath();
      leafPath(ctx, leaf);
      ctx.fill();
    }, { wrap: true });
  }

  // Silver leaves cut out of the gold, and pale grey leaves on bare silver.
  const rand = rng(1809);
  for (let i = 0; i < 46; i++) {
    const x = rand() * C;
    const y = 40 + rand() * 120;
    const leaf = {
      x,
      y,
      a: -0.7 - rand() * 0.8,
      L: 25 + rand() * 55,
      w: 3 + rand() * 6,
      bend: (rand() - 0.5) * 0.5,
    };
    const onGold = x > FRONT + 28 && x < C - 14;
    p.layer(
      onGold ? 'rgba(222,224,226,0.92)' : 'rgba(150,154,160,0.28)',
      onGold ? MAT.alu : MAT.greyInk,
      (ctx, s) => {
        ctx.fillStyle = s;
        ctx.beginPath();
        leafPath(ctx, leaf);
        ctx.fill();
      },
      { wrap: true },
    );
  }

  // Thin darker veins give the gold leaves some depth.
  p.colorOnly((ctx) => {
    ctx.strokeStyle = 'rgba(140,100,30,0.35)';
    ctx.lineWidth = 0.35;
    for (const { x, y, a, L, bend } of big) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      ctx.quadraticCurveTo(
        x + Math.cos(a) * L * 0.5 + nx * bend * L * 0.25,
        y + Math.sin(a) * L * 0.5 + ny * bend * L * 0.25,
        x + Math.cos(a) * L * 0.95 + nx * bend * L * 0.9,
        y + Math.sin(a) * L * 0.95 + ny * bend * L * 0.9,
      );
      ctx.stroke();
    }
  });
}

// The brewery line drawing, centred on x = 0 with its ground line at y = 0
// (about 60 units wide, 25 tall). Callers set the transform and colours.
function drawBuilding(ctx) {
  // ground swash
  ctx.beginPath();
  ctx.moveTo(-30, 2);
  ctx.quadraticCurveTo(0, 6, 30, 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-26, 0.5);
  ctx.lineTo(26, 0.5);
  ctx.stroke();
  // long wings
  ctx.strokeRect(-22, -7, 15, 7.5);
  ctx.strokeRect(7, -7, 15, 7.5);
  for (const sgn of [-1, 1]) {
    // wing roofs
    ctx.beginPath();
    ctx.moveTo(sgn * 23, -7);
    ctx.lineTo(sgn * 20, -10.5);
    ctx.lineTo(sgn * 7, -10.5);
    ctx.lineTo(sgn * 7, -7);
    ctx.stroke();
    // windows
    for (let i = 0; i < 4; i++) ctx.fillRect(sgn * (9 + i * 3.4) - 0.7, -5.5, 1.4, 2.2);
    // trees
    ctx.beginPath();
    ctx.ellipse(sgn * 27, -5, 2.6, 4.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sgn * 27, -1);
    ctx.lineTo(sgn * 27, 0.5);
    ctx.stroke();
  }
  // central gabled block with clock tower
  ctx.strokeRect(-7, -11, 14, 11.5);
  ctx.beginPath();
  ctx.moveTo(-8, -11);
  ctx.lineTo(0, -16);
  ctx.lineTo(8, -11);
  ctx.stroke();
  ctx.strokeRect(-1.6, -21, 3.2, 5.5);
  ctx.beginPath();
  ctx.moveTo(-2.2, -21);
  ctx.lineTo(0, -25);
  ctx.lineTo(2.2, -21);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -18.5, 1.0, 0, Math.PI * 2);
  ctx.stroke();
  // door and windows
  ctx.beginPath();
  ctx.moveTo(-1.6, 0.5);
  ctx.lineTo(-1.6, -3.5);
  ctx.arc(0, -3.5, 1.6, Math.PI, 0);
  ctx.lineTo(1.6, 0.5);
  ctx.stroke();
  for (const sx of [-4.5, 4.5]) ctx.fillRect(sx - 0.8, -8, 1.6, 2.4);
  ctx.beginPath();
  ctx.arc(0, -12.7, 1.1, 0, Math.PI * 2);
  ctx.stroke();
}

// Text on the bottom of a circle (a smile), reading left to right, letters upright.
function arcTextBelow(ctx, text, cx, yBottom, radius, size, font, spacing = 0) {
  ctx.font = font.replace('$', `${size}px`);
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((s, w) => s + w, 0) - spacing;
  const cy = yBottom - radius;
  let ang = Math.PI / 2 + total / radius / 2;
  for (let i = 0; i < text.length; i++) {
    const w = widths[i];
    const mid = ang - (w - spacing) / 2 / radius;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * radius, cy + Math.sin(mid) * radius);
    ctx.rotate(mid - Math.PI / 2);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    ang -= w / radius;
  }
}

// Red roundel at the top of the badge: brewery drawing, name around the top, wreath below.
function crest(p, cx, cy, r) {
  const disc = (rr) => (ctx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  };
  p.layer(goldFill, MAT.goldInk, (ctx, s) => { ctx.fillStyle = s; disc(r)(ctx); });
  p.layer(COL.white, MAT.white, (ctx, s) => { ctx.fillStyle = s; disc(r * 0.93)(ctx); });
  p.layer(
    (ctx) => {
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      g.addColorStop(0, '#e0343a');
      g.addColorStop(1, '#b51d27');
      return g;
    },
    MAT.ink,
    (ctx, s) => { ctx.fillStyle = s; disc(r * 0.86)(ctx); },
  );
  p.layer(COL.white, MAT.white, (ctx, s) => {
    ctx.fillStyle = s;
    ctx.strokeStyle = s;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    arcText(ctx, 'DE KLOK-GROENLO', cx, cy, r * 0.62, r * 0.19, `bold $ ${SERIF}`, r * 0.02);
    // building
    ctx.save();
    ctx.translate(cx, cy + r * 0.2);
    const s2 = (r * 0.5) / 30;
    ctx.scale(s2, s2);
    ctx.lineWidth = 1.6;
    drawBuilding(ctx);
    ctx.restore();
    // wreath: two curved sprays meeting under the building
    ctx.lineWidth = r * 0.03;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sgn * r * 0.05, cy + r * 0.62);
      ctx.quadraticCurveTo(cx + sgn * r * 0.45, cy + r * 0.6, cx + sgn * r * 0.62, cy + r * 0.3);
      ctx.stroke();
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const lx = cx + sgn * r * (0.05 + 0.55 * t);
        const ly = cy + r * (0.62 - 0.3 * t * t);
        ctx.beginPath();
        ctx.ellipse(lx, ly - r * 0.04, r * 0.07, r * 0.03, sgn * (-0.6 - t * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

// Faint grey hop cone and leaves behind the bottom of BIER, as on the bottle label.
function hopOrnament(p, cx, cy, s) {
  p.layer('rgba(160,166,172,0.45)', MAT.ink, (ctx, st) => {
    ctx.fillStyle = st;
    ctx.strokeStyle = st;
    for (const leaf of [
      { x: cx - 1 * s, y: cy + 1.2 * s, a: -2.6, L: 6 * s, w: 2.2 * s, bend: 0.2 },
      { x: cx - 0.6 * s, y: cy + 1.4 * s, a: -1.9, L: 4.5 * s, w: 1.8 * s, bend: -0.2 },
    ]) {
      ctx.beginPath();
      leafPath(ctx, leaf);
      ctx.fill();
    }
    // the cone: rows of pointed bracts, narrowing towards the tip
    const hx = cx + 3.2 * s;
    const hy = cy + 0.6 * s;
    const rows = [[-0.55, 0.55], [-0.85, 0, 0.85], [-0.55, 0.55], [-0.75, 0, 0.75], [-0.4, 0.4], [0]];
    rows.forEach((cols, row) => {
      for (const col of cols) {
        ctx.beginPath();
        leafPath(ctx, {
          x: hx + col * s * (1 - row * 0.1),
          y: hy - 1.9 * s + row * 0.62 * s,
          a: Math.PI / 2 - col * 0.35,
          L: 1.15 * s,
          w: 0.5 * s,
          bend: 0,
        });
        ctx.fill();
      }
    });
    ctx.lineWidth = 0.12 * s;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 2.1 * s);
    ctx.quadraticCurveTo(hx - 0.5 * s, hy - 3 * s, hx - 1.4 * s, hy - 3.2 * s);
    ctx.stroke();
  });
}

const bandGreen = (x0, w) => (ctx) => {
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, '#3a9d34');
  g.addColorStop(0.25, '#5cc04a');
  g.addColorStop(0.5, '#47ae3c');
  g.addColorStop(0.75, '#5cc04a');
  g.addColorStop(1, '#3a9d34');
  return g;
};

// The badge from the bottle label, with the supplied wordmark inside it.
function shield(p, cx, top, w, logo, { small = false } = {}) {
  const h = w * BADGE_ASPECT;
  const x0 = cx - w / 2;
  const k = w / 640; // the bottle label reference is 640 px wide
  // Border bands, outermost last: each is a stroke clipped to the outline, so a
  // stroke of width 2d paints everything within distance d of the edge.
  const bands = [
    [Infinity, COL.white, MAT.white],
    [62, '#b9bec4', MAT.inkOnMetal], // thin silver line inside the white
    [59.5, COL.white, MAT.white],
    [47, goldFill, MAT.goldInk],
    [41, COL.greenDark, MAT.ink],
    [35, bandGreen(x0, w), MAT.ink],
    [13, goldFill, MAT.goldInk],
    [6.5, COL.greenDark, MAT.ink],
  ];
  for (const [d, color, mat] of bands) {
    p.layer(color, mat, (ctx, s) => {
      ctx.beginPath();
      badgePath(ctx, x0, top, w, h);
      ctx.clip();
      if (d === Infinity) {
        ctx.fillStyle = s;
        ctx.fill();
      } else {
        ctx.strokeStyle = s;
        ctx.lineWidth = 2 * d * k;
        ctx.stroke();
      }
    });
  }

  if (!small) hopOrnament(p, cx + 0.03 * w, top + 0.75 * h, w / 64 * 1.5);

  // Wordmark, scaled to the space the bottle label gives it.
  const boxW = 0.6 * w;
  const boxH = (small ? 0.62 : 0.55) * h;
  const scale = Math.min(boxW / logo.width, boxH / logo.height);
  const lw = logo.width * scale;
  const lh = logo.height * scale;
  p.image(logo.color, logo.mr, cx - lw / 2, top + (small ? 0.22 : 0.205) * h, lw, lh);

  crest(p, cx, top + 0.115 * h, 0.08 * w);

  if (small) return;
  p.layer('#868b92', MAT.inkOnMetal, (ctx, s) => {
    ctx.fillStyle = s;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    arcTextBelow(ctx, '-KONINKLIJKE GROLSCH-', cx, top + 0.845 * h, 1.6 * w, 30 * k, `bold $ ${SANS}`, 2.5 * k);
  });
}

function brewery(p, cx, y) {
  // "DE KLOK-GROENLO" arching over a line drawing of the old brewery.
  p.layer(COL.goldDeep, MAT.inkOnMetal, (ctx, s) => {
    ctx.fillStyle = s;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    arcText(ctx, 'DE KLOK-GROENLO', cx, y + 28, 30, 4.4, `bold $ ${SERIF}`, 0.35);
  });

  p.layer(COL.goldDeep, MAT.inkOnMetal, (ctx, s) => {
    ctx.strokeStyle = s;
    ctx.fillStyle = s;
    ctx.lineWidth = 0.45;
    ctx.translate(cx, y + 22);
    drawBuilding(ctx);
  });

  p.layer('#3a3630', MAT.inkOnMetal, (ctx, s) => {
    ctx.fillStyle = s;
    ctx.textAlign = 'center';
    fitText(ctx, 'GEBOUWEN ALS EERBETOON AAN', cx, y + 31, 2.9, `$ ${SANS}`, 46);
    fitText(ctx, 'BROUWERIJ DE KLOK (1809-1954)', cx, y + 35.5, 2.9, `$ ${SANS}`, 50);
  });
}

function sidePanel(p) {
  const x = FRONT + 45; // just right of the front shield, on the gold
  p.layer('#2b2116', MAT.inkOnMetal, (ctx, s) => {
    ctx.fillStyle = s;
    vText(ctx, '50CL ℮ • BIER • ALC 4,8% VOL', x, 128, 3.4, `bold $ ${SANS}`);
    const small = `500 $ ${SANS}`;
    let cx = x + 5;
    cx += vParagraph(
      ctx,
      'Ingrediënten: water, gerstemout, hop. Koel en donker bewaren. Ten minste houdbaar tot: zie bodem.',
      cx, 128, 62, 1.7, small,
    );
    cx += 1.5;
    vParagraph(
      ctx,
      'Gebrouwen voor De Klok Bier, Nederland. Geniet, maar drink met mate. Statiegeld: zie verpakking.',
      cx, 128, 62, 1.7, small,
    );
  });
}

function backPanel(p, logo) {
  // Small back shield.
  shield(p, C - 24, 15, 26, logo, { small: true });

  // Legal / nutrition text columns on the back.
  const x0 = 8;
  p.layer('#2c2a27', MAT.inkOnMetal, (ctx, s) => {
    ctx.fillStyle = s;
    const font = `$ ${SANS}`;
    let x = x0;
    const paras = [
      'Voedingswaarde per 100 ml: energie 176 kJ / 42 kcal; vet 0 g; koolhydraten 3,1 g; waarvan suikers 0 g; eiwitten 0,4 g; zout 0 g.',
      'Ingrediënten: water, GERSTEMOUT, hop. Pils. Alcohol 4,8% vol. Inhoud 50 cl.',
      'Gebrouwen en verpakt in Nederland. Ten minste houdbaar tot einde: zie bodem van het blik.',
      'Niet verkopen aan personen onder de 18 jaar. Geniet, maar drink met mate.',
    ];
    for (const t of paras) {
      x += vParagraph(ctx, t, x, 120, 82, 1.75, font) + 1.2;
    }
  });

  // Recycling roundel near the top of the back.
  const rx = 14;
  const ry = 16;
  p.layer('#2c2a27', MAT.inkOnMetal, (ctx, s) => {
    ctx.strokeStyle = s;
    ctx.fillStyle = s;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(rx, ry, 4.2, 0, Math.PI * 2);
    ctx.stroke();
    // two chasing arrows
    for (const a0 of [0, Math.PI]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 2.6, a0 + 0.3, a0 + Math.PI - 0.4);
      ctx.stroke();
      const ax = rx + Math.cos(a0 + Math.PI - 0.4) * 2.6;
      const ay = ry + Math.sin(a0 + Math.PI - 0.4) * 2.6;
      ctx.beginPath();
      ctx.arc(ax, ay, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  p.layer(COL.green, MAT.ink, (ctx, s) => {
    ctx.fillStyle = s;
    ctx.beginPath();
    ctx.arc(rx, ry, 1.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // www.overAlcohol.nl on a white strip, plus the warning icons.
  const sx = x0 + 34;
  p.layer(COL.white, MAT.white, (ctx, s) => {
    ctx.fillStyle = s;
    ctx.beginPath();
    roundRect(ctx, sx - 3.2, 76, 4.6, 34, 0.8);
    ctx.fill();
  });
  p.layer('#111', MAT.ink, (ctx, s) => {
    ctx.fillStyle = s;
    vText(ctx, 'www.overAlcohol.nl', sx + 0.3, 108.5, 2.9, `bold $ ${SANS}`);
  });

  const icons = [
    { y: 116, kind: '18+' },
    { y: 123, kind: 'pregnant' },
    { y: 130, kind: 'car' },
  ];
  for (const { y, kind } of icons) {
    const ix = sx - 1;
    p.layer(COL.white, MAT.white, (ctx, s) => {
      ctx.fillStyle = s;
      ctx.beginPath();
      ctx.arc(ix, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    p.layer('#111', MAT.ink, (ctx, s) => {
      ctx.fillStyle = s;
      ctx.strokeStyle = s;
      ctx.lineWidth = 0.35;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (kind === '18+') {
        fitText(ctx, '18+', ix, y + 0.2, 2.5, `bold $ ${SANS}`, 4.2);
      } else if (kind === 'pregnant') {
        ctx.beginPath();
        ctx.arc(ix - 0.2, y - 1.6, 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ix - 0.4, y - 0.9);
        ctx.quadraticCurveTo(ix + 1.6, y + 0.3, ix - 0.1, y + 1.1);
        ctx.lineTo(ix - 0.5, y + 2.2);
        ctx.stroke();
      } else {
        roundRect(ctx, ix - 1.8, y - 0.6, 3.6, 1.3, 0.4);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ix - 1.1, y - 0.6);
        ctx.lineTo(ix - 0.6, y - 1.5);
        ctx.lineTo(ix + 0.8, y - 1.5);
        ctx.lineTo(ix + 1.2, y - 0.6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        for (const wx of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(ix + wx * 1.0, y + 0.8, 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
    if (kind !== '18+') {
      p.layer(COL.red, MAT.ink, (ctx, s) => {
        ctx.strokeStyle = s;
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.arc(ix, y, 2.7, 0, Math.PI * 2);
        ctx.moveTo(ix - 1.9, y - 1.9);
        ctx.lineTo(ix + 1.9, y + 1.9);
        ctx.stroke();
      });
    } else {
      p.layer(COL.red, MAT.ink, (ctx, s) => {
        ctx.strokeStyle = s;
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.arc(ix, y, 2.7, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  // Barcode near the bottom of the back panel.
  const rand = rng(44);
  const bx = x0 + 40;
  p.layer(COL.white, MAT.white, (ctx, s) => {
    ctx.fillStyle = s;
    ctx.fillRect(bx, 96, 20, 13);
  });
  p.layer('#111', MAT.ink, (ctx, s) => {
    ctx.fillStyle = s;
    let x = bx + 1.5;
    while (x < bx + 18.5) {
      const w = 0.15 + Math.floor(rand() * 3) * 0.15;
      ctx.fillRect(x, 97, w, 9.5);
      x += w + 0.15 + Math.floor(rand() * 3) * 0.15;
    }
    ctx.textAlign = 'center';
    fitText(ctx, '8 712000 018090', bx + 10, 108.4, 1.6, `$ ${SANS}`);
  });
}

// Subtle darkening at the very top and bottom of the print, where the can necks in.
function edgeShading(p) {
  p.colorOnly((ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, LABEL_H);
    g.addColorStop(0, 'rgba(0,0,0,0.10)');
    g.addColorStop(0.03, 'rgba(0,0,0,0)');
    g.addColorStop(0.97, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C, LABEL_H);
  });
}

// Loads the wordmark, knocks its white background out to transparency, crops
// it to the artwork and builds a matching material image (gold lettering is
// printed as metallic ink, the rest as opaque ink).
async function loadLogo(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const src = document.createElement('canvas');
  src.width = img.width;
  src.height = img.height;
  const sctx = src.getContext('2d');
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, img.width, img.height);
  const d = data.data;
  const mr = new ImageData(img.width, img.height);
  let [x0, y0, x1, y1] = [img.width, img.height, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a0] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    // Colour-to-alpha against white, steepened so only the near-white fringe of
    // the artwork becomes see-through and mid tones (the gold BIER) stay solid.
    const a = Math.min(1, ((255 - Math.min(r, g, b)) / 255) * 3.5);
    const alpha = a * a0;
    if (a > 0) {
      d[i] = (r - 255 * (1 - a)) / a;
      d[i + 1] = (g - 255 * (1 - a)) / a;
      d[i + 2] = (b - 255 * (1 - a)) / a;
    }
    d[i + 3] = alpha;
    const gold = d[i] - d[i + 2] > 40 && d[i] > d[i + 1] - 10;
    const [rough, metal] = gold ? MAT.inkOnMetal : MAT.ink;
    mr.data[i + 1] = rough * 255;
    mr.data[i + 2] = metal * 255;
    mr.data[i + 3] = alpha;
    if (alpha > 25) {
      const px = (i / 4) % img.width;
      const py = Math.floor(i / 4 / img.width);
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
  }
  const crop = (imageData) => {
    const c = document.createElement('canvas');
    c.width = x1 - x0 + 1;
    c.height = y1 - y0 + 1;
    c.getContext('2d').putImageData(imageData, -x0, -y0);
    return c;
  };
  return { color: crop(data), mr: crop(mr), width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

export async function paintLabel(colorCanvas, mrCanvas) {
  const logo = await loadLogo(new URL('./assets/logo-wordmark.png', import.meta.url));
  for (const c of [colorCanvas, mrCanvas]) {
    c.width = TEX_W;
    c.height = TEX_H;
  }
  const p = new Painter(colorCanvas, mrCanvas);
  background(p);
  goldSwathe(p);
  sidePanel(p);
  backPanel(p, logo);
  shield(p, FRONT, 12, 70, logo);
  brewery(p, FRONT, 88);
  edgeShading(p);
}
