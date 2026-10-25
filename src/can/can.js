// Builds the 50cl can as a three.js Group (Y up, metres, front label facing +Z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, BODY_BOTTOM, BODY_TOP, LABEL_H, paintLabel } from './label.js';

const SEGMENTS = 192;
const MM = 0.001;

// Outer profile (radius, height) in mm, bottom dome to stand ring to body.
const BOTTOM_PROFILE = [
  [0, 10.5], [6, 10.2], [12, 9.0], [17, 6.9], [20.5, 4.6], [22.6, 2.6],
  [23.6, 1.0], [24.4, 0.15], [25.4, 0], [26.4, 0.25], [27.4, 1.0],
  [29.0, 2.6], [30.8, 4.6], [32.2, 6.6], [32.9, 8.0], [R, BODY_BOTTOM],
];

// Shoulder, neck, double seam and recessed lid panel, ending at the lid centre.
const TOP_PROFILE = [
  [R, BODY_TOP], [32.9, 153.4], [32.2, 155.2], [30.8, 157.6], [29.2, 159.9],
  [27.9, 161.9], [27.3, 163.2], [27.2, 164.3], [27.6, 165.1], [28.05, 165.9],
  [28.15, 166.9], [27.95, 167.7], [27.45, 168.05], [26.9, 167.9], [26.55, 167.3],
  [26.3, 166.2], [25.8, 164.4], [25.2, 163.2], [24.6, 163.25], [24.1, 163.9],
  [23.4, 164.35], [12, 164.5], [0, 164.55],
];
export const LID_Y = 164.5;

function lathe(profile, segments = SEGMENTS) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r * MM, y * MM));
  // Start at a hair above zero radius so the pole gets sensible normals.
  if (pts[0].x === 0) pts[0].x = 1e-6;
  if (pts.at(-1).x === 0) pts.at(-1).x = 1e-6;
  return new THREE.LatheGeometry(pts, segments);
}

// Splits profile segments so none is longer than `step` mm (crushing needs
// vertices everywhere the metal can bend).
function resample(profile, step) {
  const out = [profile[0]];
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    const n = Math.max(1, Math.ceil(Math.hypot(r1 - r0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([r0 + ((r1 - r0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

// Opening in the lid, in lid coordinates (x right, z towards the front):
// wide end towards the rim, narrow end towards the rivet.
function teardrop(n = 96) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 - 0.35 * Math.cos(a);
    pts.push([Math.sin(a) * 9.2 * r, 13.5 - Math.cos(a) * 8.5]);
  }
  return pts;
}
export const FLAP_HINGE_Z = 5.2; // narrow end of the opening, mm
export const TAB_HINGE = { y: LID_Y + 0.6, z: -1.2 };

// Flat lid panel (inside the countersink) with the opening cut out, and the
// matching flap that gets pushed into the can when it is opened.
function lidPanel() {
  const PANEL_R = 23.4;
  const outer = new THREE.Shape();
  outer.absarc(0, 0, PANEL_R, 0, Math.PI * 2, false);
  // ShapeGeometry lies in XY facing +Z; rotateX(-90°) maps shape y to world -z.
  const hole = new THREE.Path(teardrop().map(([x, z]) => new THREE.Vector2(x, -z)).reverse());
  outer.holes.push(hole);
  const panel = new THREE.ShapeGeometry(outer, 96);
  const flapShape = new THREE.Shape(teardrop().map(([x, z]) => new THREE.Vector2(x * 0.97, -(13.5 + (z - 13.5) * 0.97))));
  const flap = new THREE.ShapeGeometry(flapShape);
  for (const g of [panel, flap]) {
    g.rotateX(-Math.PI / 2);
    g.translate(0, LID_Y, 0);
    g.scale(MM, MM, MM);
  }
  flap.translate(0, -0.03 * MM, 0);
  return { panel, flap };
}

// Dark lining of the can's inside, seen through the opening. Its normals face
// inwards, so from outside it is back-facing and never shows, even where a
// dent pushes the outer wall through it.
function interiorGeometry() {
  const profile = resample([
    [26.0, 164.0], [26.6, 162.0], [28.2, 159.5], [31.2, 155.0], [32.5, 151.0],
    [32.5, 12.0], [30.5, 6.0], [25.0, 3.5], [20.0, 6.0], [12.0, 9.8], [0, 11.2],
  ], 3);
  return lathe(profile, 64);
}

async function labelTextures() {
  const colorCanvas = document.createElement('canvas');
  const mrCanvas = document.createElement('canvas');
  await paintLabel(colorCanvas, mrCanvas);
  return labelTexturesFrom(colorCanvas, mrCanvas);
}

// Wraps a pair of label canvases (base colour, metallic-roughness) as textures
// for the body. Also used when another label is swapped in (see skin.js).
export function labelTexturesFrom(colorCanvas, mrCanvas) {
  const color = new THREE.CanvasTexture(colorCanvas);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;
  color.name = 'label_basecolor';
  const mr = new THREE.CanvasTexture(mrCanvas);
  mr.name = 'label_metallic_roughness';
  for (const t of [color, mr]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }
  return { color, mr, colorCanvas, mrCanvas };
}

// The opening tab, flat on the lid: nose over the opening (+Z), finger ring behind.
function tabGeometry() {
  const s = new THREE.Shape();
  // Shape coords: x right, y = -worldZ (rotated onto the lid below).
  s.moveTo(-6.0, -6.5);
  s.quadraticCurveTo(0, -9.2, 6.0, -6.5);
  s.lineTo(8.2, 4);
  s.quadraticCurveTo(9.2, 14, 7.4, 18.5);
  s.quadraticCurveTo(0, 23.5, -7.4, 18.5);
  s.quadraticCurveTo(-9.2, 14, -8.2, 4);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-5.4, 9);
  hole.quadraticCurveTo(0, 6.6, 5.4, 9);
  hole.quadraticCurveTo(6.6, 14, 5.0, 17);
  hole.quadraticCurveTo(0, 20.2, -5.0, 17);
  hole.quadraticCurveTo(-6.6, 14, -5.4, 9);
  s.holes.push(hole);
  // U-shaped slit around the rivet.
  const slit = new THREE.Path();
  slit.moveTo(-3.4, -2.6);
  slit.lineTo(-3.4, 3.4);
  slit.quadraticCurveTo(0, 5.4, 3.4, 3.4);
  slit.lineTo(3.4, -2.6);
  slit.lineTo(2.8, -2.6);
  slit.lineTo(2.8, 2.9);
  slit.quadraticCurveTo(0, 4.6, -2.8, 2.9);
  slit.lineTo(-2.8, -2.6);
  slit.closePath();
  s.holes.push(slit);

  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.35,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.25,
    bevelSegments: 2,
    curveSegments: 24,
  });
  g.rotateX(-Math.PI / 2);
  // Slight upward bend so the ring catches the light.
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < -8) pos.setY(i, pos.getY(i) + (-z - 8) * 0.04);
  }
  g.computeVertexNormals();
  g.translate(0, LID_Y + 0.6, 0);
  g.scale(MM, MM, MM);
  return g;
}

function rivetGeometry() {
  return lathe([
    [2.1, LID_Y], [2.0, LID_Y + 1.0], [1.8, LID_Y + 1.25], [1.2, LID_Y + 1.5],
    [0, LID_Y + 1.55],
  ]);
}

// Score line of the opening and the stiffening bead, as thin raised tubes.
function lidLines() {
  const tear = [];
  const n = 96;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // teardrop: wide end towards the rim (+Z), narrow towards the rivet
    const r = 1 - 0.35 * Math.cos(a);
    const x = Math.sin(a) * 9.2 * r;
    const z = 13.5 - Math.cos(a) * 8.5;
    tear.push(new THREE.Vector3(x * MM, (LID_Y + 0.05) * MM, z * MM));
  }
  const score = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(tear, true), 160, 0.22 * MM, 6, true,
  );
  const bead = [];
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    bead.push(new THREE.Vector3(Math.sin(a) * 21.5 * MM, LID_Y * MM, Math.cos(a) * 21.5 * MM));
  }
  const ring = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(bead, true), 256, 0.45 * MM, 8, true,
  );
  return mergeGeometries([score, ring]);
}

// `crushable` builds the variant used for crushing: a dense mesh everywhere
// the metal can fold, a lid panel with a real opening plus its flap, and an
// interior lining. The default build is the lightweight intact can.
export async function buildCan({ crushable = false } = {}) {
  const tex = await labelTextures();

  const aluminium = new THREE.MeshStandardMaterial({
    name: 'aluminium',
    color: 0xd6d8db,
    metalness: 1,
    roughness: 0.26,
  });
  const lidAluminium = new THREE.MeshStandardMaterial({
    name: 'lid_aluminium',
    color: 0xc9ccd0,
    metalness: 1,
    roughness: 0.32,
  });
  const label = new THREE.MeshStandardMaterial({
    name: 'label',
    map: tex.color,
    metalnessMap: tex.mr,
    roughnessMap: tex.mr,
    metalness: 1,
    roughness: 1,
  });

  const group = new THREE.Group();
  group.name = 'DeKlokBierCan50cl';

  const body = crushable
    ? new THREE.CylinderGeometry(R * MM, R * MM, LABEL_H * MM, 192, Math.round(LABEL_H / 0.8), true, -Math.PI)
    : new THREE.CylinderGeometry(R * MM, R * MM, LABEL_H * MM, SEGMENTS, 8, true, -Math.PI);
  body.translate(0, ((BODY_BOTTOM + BODY_TOP) / 2) * MM, 0);
  const bodyMesh = new THREE.Mesh(body, label);
  bodyMesh.name = 'body';

  const bottomMesh = new THREE.Mesh(
    crushable ? lathe(resample(BOTTOM_PROFILE, 1), 192) : lathe(BOTTOM_PROFILE),
    aluminium,
  );
  bottomMesh.name = 'bottom';
  const topMesh = new THREE.Mesh(
    crushable
      // stop at the edge of the flat panel; the panel itself is a separate mesh
      ? lathe(resample([...TOP_PROFILE.slice(0, -3), [23.4, LID_Y]], 0.7), 192)
      : lathe(TOP_PROFILE),
    aluminium,
  );
  topMesh.name = 'top';

  const tabMesh = new THREE.Mesh(tabGeometry(), aluminium);
  tabMesh.name = 'tab';
  const rivetMesh = new THREE.Mesh(rivetGeometry(), aluminium);
  rivetMesh.name = 'rivet';
  const linesMesh = new THREE.Mesh(lidLines(), lidAluminium);
  linesMesh.name = 'lid_score';

  group.add(bodyMesh, bottomMesh, topMesh, tabMesh, rivetMesh, linesMesh);

  if (crushable) {
    const { panel, flap } = lidPanel();
    const panelMesh = new THREE.Mesh(panel, aluminium);
    panelMesh.name = 'lid_panel';
    const flapMesh = new THREE.Mesh(flap, new THREE.MeshStandardMaterial({
      name: 'flap_aluminium',
      color: 0x9fa2a6, // pushed into the can, mostly in shadow
      metalness: 1,
      roughness: 0.32,
      side: THREE.DoubleSide,
    }));
    flapMesh.name = 'lid_flap';
    const interior = new THREE.Mesh(interiorGeometry(), new THREE.MeshStandardMaterial({
      name: 'interior',
      color: 0x1b1a18,
      metalness: 0.4,
      roughness: 0.65,
    }));
    interior.name = 'interior';
    group.add(panelMesh, flapMesh, interior);
  }
  return { group, tex };
}
