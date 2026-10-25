// Swapping what the can is made of: the wrap-around label artwork and the
// colour of the bare metal (rims, lid, tab). The De Klok label painted by
// label.js stays the default; any image can replace it.
//
// Label images wrap once around the printed body, left edge to right edge,
// with the middle of the image facing the front. Transparent pixels show
// bare metal, opaque pixels are printed ink.
import * as THREE from 'three';
import { C, LABEL_H } from './label.js';
import { labelTexturesFrom } from './can.js';

export const LABEL_ASPECT = C / LABEL_H; // width / height of a label that wraps exactly once

export const METALS = {
  silver: '#d6d8db',
  gold: '#d4ad6c',
  copper: '#c98a62',
  black: '#3b3c3f',
  blue: '#6f8db3',
  red: '#b4504a',
};

// Bare metal under the print: [roughness, metalness], as in the De Klok label.
const BARE = [0.3, 1.0];

export function loadImage(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  return img.decode().then(() => img);
}

// Lays an image out on the label and builds the matching material map.
//   fit: 'stretch' (wrap exactly once), 'cover' (fill, crop the excess),
//        'contain' (whole image, bare metal around it)
//   ink: { metalness, roughness } of the opaque print
export function composeLabel(image, { fit = 'stretch', metal = METALS.silver, ink = {} } = {}) {
  const inkMetal = ink.metalness ?? 0;
  const inkRough = ink.roughness ?? 0.35;
  const sw = image.naturalWidth ?? image.width;
  const sh = image.naturalHeight ?? image.height;
  const W = Math.min(4096, Math.max(1024, Math.round(Math.max(sw, sh * LABEL_ASPECT))));
  const H = Math.round(W / LABEL_ASPECT);

  let [dx, dy, dw, dh] = [0, 0, W, H];
  if (fit !== 'stretch') {
    const s = fit === 'cover' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
    dw = sw * s;
    dh = sh * s;
    dx = (W - dw) / 2;
    dy = (H - dh) / 2;
  }
  const canvas = () => Object.assign(document.createElement('canvas'), { width: W, height: H });

  const art = canvas();
  const actx = art.getContext('2d', { willReadFrequently: true });
  actx.drawImage(image, dx, dy, dw, dh);

  const colorCanvas = canvas();
  const cctx = colorCanvas.getContext('2d');
  cctx.fillStyle = metal;
  cctx.fillRect(0, 0, W, H);
  cctx.drawImage(art, 0, 0);

  // Material follows the artwork's alpha: bare metal where it is clear.
  const src = actx.getImageData(0, 0, W, H).data;
  const mrCanvas = canvas();
  const mctx = mrCanvas.getContext('2d');
  const mr = mctx.createImageData(W, H);
  const d = mr.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = src[i + 3] / 255;
    d[i + 1] = 255 * (BARE[0] + (inkRough - BARE[0]) * a);
    d[i + 2] = 255 * (BARE[1] + (inkMetal - BARE[1]) * a);
    d[i + 3] = 255;
  }
  mctx.putImageData(mr, 0, 0);
  return { colorCanvas, mrCanvas };
}

const bodyMaterial = (group) => group.getObjectByName('body').material;

// Puts a composed label on the can. The default label's textures are kept
// so restoreDefaultLabel() can bring them back without repainting.
export function setLabel(group, { colorCanvas, mrCanvas }) {
  const m = bodyMaterial(group);
  m.userData.defaultMaps ??= { map: m.map, mr: m.metalnessMap };
  if (m.map !== m.userData.defaultMaps.map) {
    m.map.dispose();
    m.metalnessMap.dispose();
  }
  const { color, mr } = labelTexturesFrom(colorCanvas, mrCanvas);
  m.map = color;
  m.metalnessMap = m.roughnessMap = mr;
  m.needsUpdate = true;
}

export function restoreDefaultLabel(group) {
  const m = bodyMaterial(group);
  const def = m.userData.defaultMaps;
  if (!def || m.map === def.map) return;
  m.map.dispose();
  m.metalnessMap.dispose();
  m.map = def.map;
  m.metalnessMap = m.roughnessMap = def.mr;
  m.needsUpdate = true;
}

// Turns the label around the can's axis by `degrees` (positive moves the
// artwork to the right, seen from the front). Only the textures move.
export function setLabelShift(group, degrees) {
  const m = bodyMaterial(group);
  const u = -degrees / 360;
  for (const t of new Set([m.map, m.metalnessMap, m.roughnessMap])) if (t) t.offset.x = u;
}

// Colours the bare-metal parts. The lid is pressed from slightly duller
// stock, and the flap sits in the can's shadow once pushed in.
export function setMetalColor(group, hex) {
  const c = new THREE.Color(hex);
  group.traverse((o) => {
    const m = o.material;
    if (!m) return;
    if (m.name === 'aluminium') m.color.copy(c);
    else if (m.name === 'lid_aluminium') m.color.copy(c).multiplyScalar(0.94);
    else if (m.name === 'flap_aluminium') m.color.copy(c).multiplyScalar(0.75);
  });
}

// A guide for making labels: the wrap-around layout at the right proportions.
export function labelTemplate(width = 2048) {
  const W = width;
  const H = Math.round(W / LABEL_ASPECT);
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = cv.getContext('2d');
  const mm = W / C;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  // 10 mm grid
  ctx.strokeStyle = '#eceff3';
  ctx.lineWidth = 1;
  for (let x = 0; x <= C; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x * mm, 0);
    ctx.lineTo(x * mm, H);
    ctx.stroke();
  }
  for (let y = 0; y <= LABEL_H; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y * mm);
    ctx.lineTo(W, y * mm);
    ctx.stroke();
  }
  // where the body starts to neck in: keep important artwork away from here
  ctx.fillStyle = 'rgba(230,120,60,0.12)';
  ctx.fillRect(0, 0, W, 5 * mm);
  ctx.fillRect(0, H - 5 * mm, W, 5 * mm);
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.round(W / 70)}px system-ui, sans-serif`;
  const guides = [
    [0, 'BACK · seam'], [0.25, 'LEFT SIDE'], [0.5, 'FRONT'], [0.75, 'RIGHT SIDE'], [1, 'BACK · seam'],
  ];
  for (const [u, name] of guides) {
    const x = Math.min(W - 1, Math.max(1, u * W));
    ctx.strokeStyle = u === 0.5 ? '#2f9e3a' : '#9aa3ad';
    ctx.lineWidth = u === 0.5 ? 3 : 2;
    ctx.setLineDash(u === 0.5 ? [] : [12, 10]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = u === 0.5 ? '#2f9e3a' : '#6b7480';
    ctx.textAlign = u === 0 ? 'left' : u === 1 ? 'right' : 'center';
    ctx.fillText(name, u === 0 ? 12 : u === 1 ? W - 12 : x, H * 0.07 + 5 * mm);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4b5560';
  ctx.font = `${Math.round(W / 85)}px system-ui, sans-serif`;
  const lines = [
    `Wraps once around the can: ${C.toFixed(1)} × ${LABEL_H} mm (width ${LABEL_ASPECT.toFixed(3)} × height).`,
    'Transparent pixels show bare metal; opaque pixels are printed.',
    'Shaded bands: the body curves in here, keep text out of them.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.55 + i * W / 55));
  return cv;
}
