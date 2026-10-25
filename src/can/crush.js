// Crushing the can: one deformation field, evaluated for every vertex of the
// crushable can (see buildCan({ crushable: true })). The field works in the
// can's rest coordinates (mm, Y up, front label at +Z): the rims at either end
// stay stiff while the body flattens, folds, pinches, twists, bends, creases
// and dents. Normals come from the deformation itself, by finite differences
// along each vertex's rest tangent plane, so creases stay crisp.
import { R, C, BODY_BOTTOM as BB, BODY_TOP as BT } from './label.js';
import { LID_Y, FLAP_HINGE_Z, TAB_HINGE } from './can.js';

const H = BT - BB;
const DEG = Math.PI / 180;
const MM = 0.001;

export const DEFAULTS = {
  // flatten: stepped on from the side
  flatten: 0, thickness: 3.5, flattenAxis: 0, endStiffness: 0.8,
  // axial crush: stomped from above, folds up like an accordion
  crush: 0, crushAt: 0.5, crushFocus: 0.5, foldPitch: 10, lobes: 4, foldSkew: 0.4,
  lean: 0, leanDir: 90,
  // squeeze in the hand
  pinch: 0, pinchAt: 0.5, pinchWidth: 22, pinchAngle: 90, twist: 0,
  // bending
  bend: 0, topFold: 0, bottomFold: 0,
  // surface damage
  crumple: 0, creases: 80, creaseWidth: 4, dents: 0, dentDepth: 3,
  seed: 1,
  // the lid
  open: false, tabAngle: 0, flapAngle: 70,
  pose: 'auto', // 'auto' | 'upright' | 'lying'
};

export const PRESETS = {
  intact: {},
  stomped: {
    crush: 0.34, crushAt: 0.66, crushFocus: 0.9, foldPitch: 12, lobes: 3, foldSkew: 0.8,
    lean: 6, leanDir: 70, bend: 4, crumple: 0.55, creases: 80, dents: 1, dentDepth: 2.5,
    open: true, tabAngle: 12, seed: 3,
  },
  flattened: {
    flatten: 1, thickness: 3.2, endStiffness: 0.75,
    topFold: 65, bottomFold: 45, crumple: 1.0, creases: 180, creaseWidth: 3.5,
    dents: 2, dentDepth: 1.5, open: true, tabAngle: 8, seed: 7,
  },
  squeezed: {
    pinch: 0.55, pinchAt: 0.52, pinchWidth: 24, pinchAngle: 80, twist: 28,
    bend: 8, crumple: 0.85, creases: 130, creaseWidth: 3.5, dents: 3, dentDepth: 4,
    open: true, tabAngle: 88, seed: 11,
  },
  dented: {
    dents: 6, dentDepth: 4.5, crumple: 0.35, creases: 40, creaseWidth: 5,
    bend: 2, open: true, tabAngle: 0, seed: 5,
  },
  wrecked: {
    flatten: 0.8, thickness: 5, flattenAxis: 25, crush: 0.25, crushAt: 0.35, crushFocus: 0.6,
    foldSkew: 0.7, twist: -15, topFold: -20, bottomFold: 18, crumple: 1, creases: 150,
    creaseWidth: 3, dents: 4, dentDepth: 3, open: true, tabAngle: 35, seed: 21,
  },
};

export const presetParams = (name) => ({ ...DEFAULTS, ...PRESETS[name] });

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

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrapS = (s) => (s > C / 2 ? s - C : s < -C / 2 ? s + C : s);
const wrapA = (a) => (a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a);

// Where the wall is free to deform: zero on the rims, the domed bottom and
// the lid (by height and by distance from the axis), one on the body.
const bodyMask = (y, r) => smooth(3, 13, y) * (1 - smooth(148, 158, y)) * smooth(R - 6, R - 1, r);

// Bend about the local X axis: material above y0 curves towards +Z (for a
// positive angle) through [y0, y1] and continues straight beyond y1.
function bend(y, z, y0, y1, angle, out) {
  if (y <= y0 || Math.abs(angle) < 1e-5) {
    out[0] = y;
    out[1] = z;
    return;
  }
  const k = angle / (y1 - y0);
  const rho = 1 / k;
  const l = Math.min(y, y1) - y0;
  const phi = k * l;
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  let ny = y0 + (rho - z) * sp;
  let nz = rho - (rho - z) * cp;
  if (y > y1) {
    const e = y - y1;
    ny += e * cp;
    nz += e * sp;
  }
  out[0] = ny;
  out[1] = nz;
}

// Builds the deformation for one parameter set. Returns f(x, y, z, out) in mm.
export function makeField(p, userDents = []) {
  const flatten = p.flatten;
  const endOval = 1 - p.endStiffness;
  const flatMask = (y) =>
    endOval + (1 - endOval) * smooth(BB - 2, BB + 22, y) * (1 - smooth(BT - 26, BT + 8, y));
  const flatA = p.flattenAxis * DEG;
  const cosF = Math.cos(flatA);
  const sinF = Math.sin(flatA);

  // Axial crush: local compression k(t) concentrated around crushAt; the lost
  // height goes into zigzag folds whose depth keeps the wall length constant.
  const N = 512;
  const Ytab = new Float64Array(N);
  const Atab = new Float64Array(N);
  const Ktab = new Float64Array(N);
  let drop = 0;
  const crushOn = p.crush > 0.001;
  if (crushOn) {
    const g = (t) => 1 - p.crushFocus + p.crushFocus * 3 * Math.exp(-(((t - p.crushAt) / 0.16) ** 2));
    let mean = 0;
    for (let i = 0; i < N; i++) mean += g(i / (N - 1));
    mean /= N;
    let y = BB;
    for (let i = 0; i < N; i++) {
      const k = Math.min(0.85, (p.crush * g(i / (N - 1))) / mean);
      Ktab[i] = k;
      Ytab[i] = y;
      Atab[i] = 0.5 * p.foldPitch * Math.sqrt(1 - (1 - k) ** 2);
      y += (H / (N - 1)) * (1 - k);
    }
    drop = H - (Ytab[N - 1] - BB);
  }
  const lookup = (tab, y) => {
    const fi = ((y - BB) / H) * (N - 1);
    const i = Math.min(N - 2, Math.max(0, Math.floor(fi)));
    const fr = Math.min(1, Math.max(0, fi - i));
    return tab[i] + (tab[i + 1] - tab[i]) * fr;
  };
  const mapY = (y) => (!crushOn || y <= BB ? y : y >= BT ? y - drop : lookup(Ytab, y));

  const rand = rng(p.seed * 9973 + 17);
  const ph0 = rand() * 6.28;
  const ph1 = rand() * 6.28;
  const ph2 = rand() * 6.28;

  const pinchOn = p.pinch > 0.001;
  const pinchY = BB + p.pinchAt * H;
  const pinchA = p.pinchAngle * DEG;
  const twist = p.twist * DEG;
  const twistAmt = Math.min(1, Math.abs(p.twist) / 60) * 1.6;
  const twistDir = Math.sign(p.twist);

  // How hard the metal is worked at height y: creases gather there.
  const strain = (y) => {
    let s = 0.25;
    if (flatten > 0) {
      const d = (flatMask(y + 1) - flatMask(y - 1)) / 2;
      s += flatten * (0.4 * flatMask(y) + 14 * Math.abs(d));
    }
    if (crushOn && y > BB && y < BT) s += 1.5 * lookup(Ktab, y);
    if (pinchOn) s += 2 * p.pinch * Math.exp(-(((y - pinchY) / p.pinchWidth) ** 2));
    s += Math.abs(p.twist) / 60;
    return s;
  };

  // Creases: random tent-shaped ridges and valleys in the unrolled wall,
  // placed where the strain is, binned for quick lookup.
  const creases = [];
  const nCreases = p.crumple > 0.001 ? Math.round(p.creases) : 0;
  let maxStrain = 0;
  for (let y = 4; y < 160; y += 2) maxStrain = Math.max(maxStrain, strain(y));
  for (let i = 0; i < nCreases; i++) {
    let cy = 0;
    for (let tries = 0; tries < 40; tries++) {
      cy = 6 + rand() * 150;
      if (rand() * maxStrain < strain(cy)) break;
    }
    const cs = (rand() - 0.5) * C;
    // orientation: pleats run along the can where it is flattened into the
    // rims, folds run around it where it is crushed, diagonals where twisted
    const wFlat = flatten * Math.abs(flatMask(cy + 1) - flatMask(cy - 1)) * 20;
    const wAx = crushOn && cy > BB && cy < BT ? lookup(Ktab, cy) * 2 : 0;
    const wTw = Math.abs(p.twist) / 45;
    const pick = rand() * (wFlat + wAx + wTw + 0.6);
    let ang;
    if (pick < wFlat) ang = Math.PI / 2 + (rand() - 0.5) * 0.9;
    else if (pick < wFlat + wAx) ang = (rand() - 0.5) * 0.8;
    else if (pick < wFlat + wAx + wTw) ang = -twistDir * Math.PI / 4 + (rand() - 0.5) * 0.6;
    else ang = rand() * Math.PI;
    const amp =
      p.crumple * 1.3 * (0.4 + 0.8 * rand()) * (rand() < 0.6 ? -1 : 1) * (0.45 + strain(cy) / maxStrain);
    creases.push({
      s: cs, y: cy, dx: Math.cos(ang), dy: Math.sin(ang),
      len: 8 + rand() * 24, w: p.creaseWidth * (0.6 + 0.8 * rand()), amp,
    });
  }
  const dents = [];
  const drand = rng(p.seed * 7919 + 3);
  for (let i = 0; i < Math.round(p.dents); i++) {
    dents.push({
      s: (drand() - 0.5) * C, y: 25 + drand() * 115,
      r: 7 + drand() * 10, depth: p.dentDepth * (0.6 + 0.4 * drand()),
    });
  }
  dents.push(...userDents);
  // a dent buckles the wall around it: short creases radiating from it
  for (const dn of dents) {
    const crand = rng(Math.round(dn.s * 1000 + dn.y * 7) ^ 0x5bd1e995);
    const n = 3 + Math.floor(crand() * 3);
    for (let i = 0; i < n; i++) {
      const ang = ((i + crand() * 0.6) / n) * Math.PI * 2;
      const dist = dn.r * (0.55 + crand() * 0.3);
      creases.push({
        s: wrapS(dn.s + Math.cos(ang) * dist), y: dn.y + Math.sin(ang) * dist,
        dx: Math.cos(ang), dy: Math.sin(ang),
        len: dn.r * (0.45 + crand() * 0.35), w: 1.6 + crand() * 1.4,
        amp: dn.depth * (crand() < 0.5 ? -0.35 : 0.25),
      });
    }
  }

  const CELL = 10;
  const NX = Math.ceil(C / CELL);
  const NY = 18;
  const bins = Array.from({ length: NX * NY }, () => []);
  for (const c of creases) {
    const reach = Math.max(c.len, c.w);
    const x0 = Math.floor((c.s + C / 2 - reach) / CELL);
    const x1 = Math.floor((c.s + C / 2 + reach) / CELL);
    const y0 = Math.max(0, Math.floor((c.y - reach) / CELL));
    const y1 = Math.min(NY - 1, Math.floor((c.y + reach) / CELL));
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) bins[(((gx % NX) + NX) % NX) + gy * NX].push(c);
    }
  }


  const leanX = p.lean * Math.sin(p.leanDir * DEG);
  const leanZ = p.lean * Math.cos(p.leanDir * DEG);
  const leanY = BB + p.crushAt * H;
  const bendY = BB + (pinchOn ? p.pinchAt : p.crushAt) * H;
  const regions = {
    mid: [mapY(bendY - 18), mapY(bendY + 18)],
    top: [mapY(118), mapY(146)],
    bottom: [mapY(18), mapY(40)],
  };
  const tmp = [0, 0];

  return function field(x, y, z, out) {
    const r = Math.hypot(x, z);
    const th = Math.atan2(x, z);
    const s = R * th;
    const m = bodyMask(y, r);

    let yy = y;
    let dr = 0;
    if (crushOn) {
      if (y >= BT) yy = y - drop;
      else if (y > BB) {
        yy = lookup(Ytab, y);
        const A = lookup(Atab, y) * m;
        if (A > 1e-4) {
          // fold rings, tilted and warped differently from ring to ring
          const u0 = (y - BB) / p.foldPitch;
          const u = u0 + p.foldSkew * (0.8 * Math.sin(th + ph0) + 0.3 * Math.sin(2 * th + ph1)
            + 0.45 * Math.sin(th + u0 * 2.1 + ph2));
          // triangle wave with slightly rounded peaks, so ridges stay sharp
          // without sawtoothing between vertices
          const tri = (2 / Math.PI) * Math.asin(0.97 * Math.sin(2 * Math.PI * (u - 0.25)));
          const row = Math.floor(u);
          const rowAmp = 0.65 + 0.35 * Math.sin(row * 12.9898 + ph1 * 3.1);
          // diamond buckling: lobes alternate in and out from ring to ring
          const lobe = Math.cos(p.lobes * th + row * Math.PI + ph2 + 0.6 * Math.sin(th * 2 + row));
          dr += A * rowAmp * (tri * (0.45 + 0.55 * lobe) - 0.12);
        }
      }
    }

    if (m > 0) {
      let d = 0;
      if (pinchOn) {
        const g = Math.exp(-(((y - pinchY) / p.pinchWidth) ** 2));
        const c = 0.5 + 0.5 * Math.cos(2 * (th - pinchA));
        d -= p.pinch * R * 0.9 * g * c * Math.sqrt(c);
      }
      if (twistAmt > 0) {
        const q = (s - twistDir * (y - BB)) / 14;
        const fq = q - Math.floor(q);
        d += twistAmt * (1 - 4 * Math.abs(fq - 0.5)) * Math.sin((Math.PI * (y - BB)) / H);
      }
      if (creases.length) {
        const gx = Math.min(NX - 1, Math.floor((s + C / 2) / CELL));
        const gy = Math.min(NY - 1, Math.max(0, Math.floor(y / CELL)));
        const list = bins[gx + gy * NX];
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          const ds = wrapS(s - c.s);
          const dy = y - c.y;
          const along = ds * c.dx + dy * c.dy;
          if (along > c.len || along < -c.len) continue;
          const perp = Math.abs(dy * c.dx - ds * c.dy);
          if (perp > c.w) continue;
          const a = along / c.len;
          const fall = (1 - a * a) * (1 - a * a);
          // tent profile, rounded over ~0.6 mm at the ridge
          const tent = Math.max(0, 1 - Math.sqrt(perp * perp + 0.36) / c.w);
          d += c.amp * tent * fall;
        }
      }
      for (let i = 0; i < dents.length; i++) {
        const dn = dents[i];
        const ds = wrapS(s - dn.s);
        const dy = y - dn.y;
        const q = (ds * ds + dy * dy) / (dn.r * dn.r);
        // pointed centre and a crisp edge, like a knuckle or a kerb
        if (q < 1) {
          const k = Math.max(0, 1 - Math.sqrt(q + 0.002));
          d -= dn.depth * k * Math.sqrt(k);
        }
      }
      // large shallow buckles in the flattened faces
      if (flatten > 0) {
        d += flatten * flatMask(y) * 1.3 *
          Math.sin(s * 0.19 + y * 0.05 + ph0) * Math.sin(y * 0.11 - s * 0.04 + ph1);
      }
      dr += d * m;
    }

    // Cross-section: the circle becomes a stadium of half-thickness b with the
    // same perimeter, mapped by arc length so the label does not stretch.
    const thl = wrapA(th - flatA);
    const scale = r / R;
    let px;
    let pz;
    let nx;
    let nz;
    const w = flatten * flatMask(y);
    if (w > 1e-4) {
      const b = R - w * (R - p.thickness);
      if (dr < -0.85 * b) dr = -0.85 * b;
      const L2 = (Math.PI * (R - b)) / 2;
      const sl = R * thl;
      const as = Math.abs(sl);
      const sg = sl < 0 ? -1 : 1;
      if (as <= L2) {
        px = sl; pz = b; nx = 0; nz = 1;
      } else if (as <= L2 + Math.PI * b) {
        const ph = (as - L2) / b;
        const sp = Math.sin(ph);
        const cp = Math.cos(ph);
        px = sg * (L2 + b * sp); pz = b * cp; nx = sg * sp; nz = cp;
      } else {
        px = sg * (L2 - (as - L2 - Math.PI * b)); pz = -b; nx = 0; nz = -1;
      }
      // Near the stiff rims a smooth ellipse (same perimeter, roughly) reads
      // better than a stadium, whose curvature jumps where flat meets round.
      const ell = 1 - smooth(0.3, 0.85, flatten > 0 ? w / flatten : 0);
      if (ell > 0) {
        const ea = 2 * R - b;
        const st = Math.sin(thl);
        const ct = Math.cos(thl);
        let enx = st / ea;
        let enz = ct / b;
        const el = Math.hypot(enx, enz);
        enx /= el;
        enz /= el;
        px += (ea * st - px) * ell;
        pz += (b * ct - pz) * ell;
        nx += (enx - nx) * ell;
        nz += (enz - nz) * ell;
        const nl = Math.hypot(nx, nz);
        nx /= nl;
        nz /= nl;
      }
    } else {
      nx = Math.sin(thl);
      nz = Math.cos(thl);
      px = R * nx;
      pz = R * nz;
    }
    let xl = px * scale + nx * dr;
    let zl = pz * scale + nz * dr;

    if (p.lean) {
      const sm = smooth(leanY - 12, leanY + 12, y);
      xl += leanX * sm;
      zl += leanZ * sm;
    }
    if (twist) {
      const a = twist * smooth(BB, BT, y);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nxl = xl * ca + zl * sa;
      zl = -xl * sa + zl * ca;
      xl = nxl;
    }
    if (p.bend) {
      bend(yy, zl, regions.mid[0], regions.mid[1], p.bend * DEG, tmp);
      yy = tmp[0];
      zl = tmp[1];
    }
    if (p.topFold) {
      bend(yy, zl, regions.top[0], regions.top[1], p.topFold * DEG, tmp);
      yy = tmp[0];
      zl = tmp[1];
    }
    if (p.bottomFold) {
      bend(-yy, zl, -regions.bottom[1], -regions.bottom[0], p.bottomFold * DEG, tmp);
      yy = -tmp[0];
      zl = tmp[1];
    }

    out[0] = xl * cosF + zl * sinF;
    out[1] = yy;
    out[2] = -xl * sinF + zl * cosF;
  };
}

// Rotation about the X axis through (y0, z0); positive angles move +Z down.
function rotX(pos, i, y0, z0, ca, sa) {
  const y = pos[i + 1] - y0;
  const z = pos[i + 2] - z0;
  pos[i + 1] = y0 + y * ca - z * sa;
  pos[i + 2] = z0 + y * sa + z * ca;
}

// Wraps the meshes of a crushable can so a parameter set can be applied to it.
export class Crusher {
  constructor(group) {
    this.parts = [];
    group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry;
      const pos = g.attributes.position.array;
      const nrm = g.attributes.normal.array;
      const rest = new Float32Array(pos.length);
      for (let i = 0; i < pos.length; i++) rest[i] = pos[i] / MM;
      this.parts.push({
        mesh: o,
        rest,
        restNormal: Float32Array.from(nrm),
        // the flap and tab hinge open; everything else keeps its rest pose
        hinge: o.name === 'lid_flap' ? 'flap' : o.name === 'tab' ? 'tab' : null,
      });
    });
    this.vertexCount = this.parts.reduce((n, p) => n + p.rest.length / 3, 0);
  }

  apply(params, userDents = []) {
    const t0 = performance.now();
    const field = makeField(params, userDents);
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    const c = [0, 0, 0];
    const h = 0.2;
    for (const part of this.parts) {
      let rest = part.rest;
      let restN = part.restNormal;
      if (part.hinge && params.open) {
        const ang = (part.hinge === 'flap' ? params.flapAngle : params.tabAngle) * DEG;
        const [y0, z0] = part.hinge === 'flap' ? [LID_Y, FLAP_HINGE_Z] : [TAB_HINGE.y, TAB_HINGE.z];
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        rest = Float32Array.from(rest);
        restN = Float32Array.from(restN);
        for (let i = 0; i < rest.length; i += 3) {
          rotX(rest, i, y0, z0, ca, sa);
          rotX(restN, i, 0, 0, ca, sa);
        }
      }
      const pos = part.mesh.geometry.attributes.position;
      const nrm = part.mesh.geometry.attributes.normal;
      const P = pos.array;
      const Nn = nrm.array;
      for (let i = 0; i < rest.length; i += 3) {
        const x = rest[i];
        const y = rest[i + 1];
        const z = rest[i + 2];
        field(x, y, z, a);
        // tangent frame from the rest normal
        const nx = restN[i];
        const ny = restN[i + 1];
        const nz = restN[i + 2];
        let t1x;
        let t1y;
        let t1z;
        if (Math.abs(ny) < 0.9) {
          // n × Y
          t1x = -nz; t1y = 0; t1z = nx;
        } else {
          // n × X
          t1x = 0; t1y = nz; t1z = -ny;
        }
        const tl = Math.hypot(t1x, t1y, t1z) || 1;
        t1x /= tl; t1y /= tl; t1z /= tl;
        // t2 = n × t1, so that t1 × t2 = n
        const t2x = ny * t1z - nz * t1y;
        const t2y = nz * t1x - nx * t1z;
        const t2z = nx * t1y - ny * t1x;
        field(x + h * t1x, y + h * t1y, z + h * t1z, b);
        field(x + h * t2x, y + h * t2y, z + h * t2z, c);
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const uz = b[2] - a[2];
        const vx = c[0] - a[0];
        const vy = c[1] - a[1];
        const vz = c[2] - a[2];
        let cx = uy * vz - uz * vy;
        let cy = uz * vx - ux * vz;
        let cz = ux * vy - uy * vx;
        const cl = Math.hypot(cx, cy, cz);
        if (cl > 1e-12) {
          cx /= cl; cy /= cl; cz /= cl;
        } else {
          cx = nx; cy = ny; cz = nz;
        }
        P[i] = a[0] * MM;
        P[i + 1] = a[1] * MM;
        P[i + 2] = a[2] * MM;
        Nn[i] = cx;
        Nn[i + 1] = cy;
        Nn[i + 2] = cz;
      }
      pos.needsUpdate = true;
      nrm.needsUpdate = true;
      part.mesh.geometry.computeBoundingBox();
      part.mesh.geometry.computeBoundingSphere();
    }
    this.lastMs = performance.now() - t0;
  }
}

// Whether a parameter set should be shown lying on its flat side.
export const isLying = (params) =>
  params.pose === 'lying' || (params.pose === 'auto' && params.flatten > 0.5);
