// 짤 모자이크 — 모든 계산은 이 기기 브라우저 안에서만 (사진은 어디에도 안 올라감)
// dc-stats/mosaic_build.py · mosaic_assemble.py 를 그대로 옮김 (짤 고르기 · 색 맞추기 · 모이는 연출)
// 여러 모양(카드섹션 · 슬롯머신 · 변신 · 무한 줌 · 크기가 다른 짤 · 벌집)은 patterns.js
import { makePatterns } from './patterns.js?v=20261123c';   // 고치면 index.html 의 app.js?v= 와 같이 바꿈

const CFG = {
  SHIFT: 0.45, OVERLAY: 0.22, NEAR: 4, REUSE: 6.0,          // 짤 고르기 · 색 맞추기 (파이썬과 같음)
  CELLS: 8000,                                               // 칸 수 (폰 메모리 생각해서 9,000 → 8,000)
  START_TILES: 22, T_CAM0: 0.5, T_CAM1: 5.6, T_END: 5.9,     // 처음 화면 가로 짤 칸 수 · 화면 빠지기 시작 · 끝 · 마지막 짤
  HOLD: 3.5, FLIGHT: 0.85, FPS: 16,                          // 끝 멈춤(초, 11-22 사용자: 여운 있게 1초 더) · 짤 하나 날아오는 시간 · 초당 장수
  AREA: 860000, MAX_W: 1000, MAX_H: 1280,                    // 그림 재료(AI) 움짤 크기 — 폰 그래픽 메모리 때문에 그대로
  AREA_HI: 1280 * 1280, MAX_W_HI: 1280, MAX_H_HI: 1600,      // 짤로 만들기 · 다른 재료 움짤 크기 (11-23 사용자: 해상도 높여서 안 깨지게)
  Q_LAST: 0.9,                                               // 끝 장면(오래 멈춰 있는 그림)만 따로 높은 화질로
  SOFTS: [0, 0.85, 0.75, 0.65, 0.55, 0.45], Q_MIN: 0.54,  // 짤로 만들기: 움직이는 장면 화질이 Q_MIN 아래면 이 비율로 줄였다 늘려 부드럽게 (0 = 그대로)
  LIMIT: 19500000,                                           // 디시 20MB — 단위가 헷갈려 넉넉히 19.5MB
  MAX_SIDE: 1600,
};
const QS = [0.84, 0.78, 0.72, 0.66, 0.6, 0.54, 0.48, 0.42, 0.36, 0.3, 0.24];
const FRAMES = Math.floor(CFG.T_END * CFG.FPS) + 2;

const $ = (s) => document.querySelector(s);
const now = () => performance.now() / 1000;
const sleep0 = () => new Promise((r) => setTimeout(r, 0));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const _getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, opts) {   // 폰 메모리가 모자라면 null → 알아듣게
  const x = _getContext.call(this, type, opts);
  if (!x && type === '2d') throw new Error('폰 메모리가 모자라요. 다른 앱이나 탭을 닫고 다시 해 보세요.');
  return x;
};
function free(...cs) { for (const c of cs) if (c) { c.width = 0; c.height = 0; } }   // 아이폰은 캔버스 메모리를 늦게 돌려줘서 바로 비움
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ───────── 짤 묶음 불러오기
let assetsP = null;
function loadAssets() {
  if (!assetsP) assetsP = (async () => {
    const meta = await (await fetch('assets/meta.json')).json();
    const fb = new Uint8Array(await (await fetch('assets/feats.bin')).arrayBuffer());
    const n = meta.count, D = meta.feat_dims;
    const feats = new Float32Array(n * D);
    for (let i = 0; i < n * D; i++) feats[i] = (i % 3 === 0) ? fb[i] / 2.55 : fb[i] - 128;
    const sheets = await Promise.all(meta.sheets.map((src) => new Promise((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('짤 묶음을 못 받았어요. 인터넷 연결을 확인해 주세요.')); im.src = 'assets/' + src;
    })));
    return { n, D, T: meta.tile, PER: meta.per, feats, sheets, pix: null, mean: null };
  })().catch((e) => { assetsP = null; throw e; });
  return assetsP;
}

function tilePixels(A) {                    // 짤 픽셀 · 짤마다 평균 색 (처음 한 번)
  if (A.pix) return;
  A.pix = A.sheets.map((im) => {
    const c = canvas(im.naturalWidth, im.naturalHeight), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data, w = c.width; free(c); return { w, d };
  });
  const { n, T, PER } = A, per = PER * PER;
  A.mean = new Float32Array(n * 3);
  for (let t = 0; t < n; t++) {
    const sd = A.pix[(t / per) | 0], k = t % per, tx = (k % PER) * T, ty = ((k / PER) | 0) * T;
    let r = 0, g = 0, b = 0;
    for (let y = 0; y < T; y++) for (let x = 0, i = ((ty + y) * sd.w + tx) * 4; x < T; x++, i += 4) { r += sd.d[i]; g += sd.d[i + 1]; b += sd.d[i + 2]; }
    const m = T * T; A.mean[t * 3] = r / m; A.mean[t * 3 + 1] = g / m; A.mean[t * 3 + 2] = b / m;
  }
}

// ───────── 색 (sRGB → Lab, 파이썬 rgb2lab 과 같음)
function lin(v) { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }
function labInto(r, g, b, out, o) {
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B), fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  out[o] = 116 * fy - 16; out[o + 1] = 500 * (fx - fy); out[o + 2] = 200 * (fy - fz);
}

// ───────── 사진 읽기
async function readPhoto(file) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) {
    src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('이 사진은 열 수 없어요. JPG나 PNG 사진으로 골라 주세요.')); im.src = URL.createObjectURL(file); });
  }
  const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
  const k = Math.min(1, CFG.MAX_SIDE / Math.max(w0, h0));
  const c = canvas(Math.max(1, Math.round(w0 * k)), Math.max(1, Math.round(h0 * k)));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  return c;
}

const PX = Number(new URLSearchParams(location.search).get('px')) || 0;   // 시험용: ?px=1200 → 큰 움짤의 긴 쪽 크기
const SOFT = Number(new URLSearchParams(location.search).get('soft')) || 0;   // 시험용: ?soft=0.6 → 움직이는 장면만 그 비율로 줄였다 늘려 부드럽게(용량↓)
function layout(photo, T, big = true) {                     // big: 짤로 만들기 · 다른 재료 (그림 재료는 false)
  const W = photo.width, H = photo.height;
  const cols = clamp(Math.round(Math.sqrt(CFG.CELLS * W / H)), 30, 150);
  const rows = Math.max(12, Math.round(cols * H / W));
  const ar = cols / rows;
  const AREA = !big ? CFG.AREA : PX ? PX * PX : CFG.AREA_HI;
  const MW = !big ? CFG.MAX_W : PX || CFG.MAX_W_HI, MH = !big ? CFG.MAX_H : PX ? PX * 1.25 : CFG.MAX_H_HI;
  let VW = Math.sqrt(AREA * ar), VH = Math.sqrt(AREA / ar);
  if (VW > MW) { VW = MW; VH = VW / ar; }
  if (VH > MH) { VH = MH; VW = VH * ar; }
  VW = Math.round(VW / 2) * 2; VH = Math.round(VH / 2) * 2;
  return { cols, rows, VW, VH, Wm: cols * T, Hm: rows * T };
}

// ───────── 칸마다 짤 고르기 (파이썬 match 와 같음)
function cellsOf(photo, L) {
  const { cols, rows } = L, B = 4;
  const c = canvas(cols * 3 * B, rows * 3 * B), x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high'; x.drawImage(photo, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data, sw = cols * 3, cw = c.width;
  free(c);
  const small = new Float32Array(cols * 3 * rows * 3 * 3);
  for (let Y = 0; Y < rows * 3; Y++) for (let X = 0; X < sw; X++) {
    let r = 0, g = 0, b = 0;
    for (let yy = 0; yy < B; yy++) for (let xx = 0, i = ((Y * B + yy) * cw + X * B) * 4; xx < B; xx++, i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const o = (Y * sw + X) * 3; small[o] = r / 16; small[o + 1] = g / 16; small[o + 2] = b / 16;
  }
  const N = rows * cols, feat = new Float32Array(N * 27), mean = new Float32Array(N * 3);
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const cell = r * cols + q;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const o = ((r * 3 + i) * sw + q * 3 + j) * 3;
      labInto(small[o], small[o + 1], small[o + 2], feat, cell * 27 + (i * 3 + j) * 3);
      mean[cell * 3] += small[o] / 9; mean[cell * 3 + 1] += small[o + 1] / 9; mean[cell * 3 + 2] += small[o + 2] / 9;
    }
  }
  return { feat, mean, small };                             // small: 사진을 칸당 3×3 으로 줄인 것 (크기가 다른 짤 · 벌집이 씀)
}

// 칸 하나에 가장 맞는 짤 (많이 쓴 짤은 점수 깎고, cap 번 넘으면 X, 가까운 칸에 있는 짤 X)
function bestTile(cf, o, tf, n, used, cap, pen, stamp, q) {
  const D = 27;
  let best = -1, bs = Infinity;
  for (let t = 0; t < n; t++) {
    if (used[t] >= cap || stamp[t] === q) continue;
    const lb = pen * used[t]; if (lb >= bs) continue;
    const th = (bs - lb) * (bs - lb) * D;                    // 이것보다 멀면 더 볼 필요 없음
    let s = 0, k = 0;
    const to = t * D;
    for (; k < D; k++) { const v = cf[o + k] - tf[to + k]; s += v * v; if ((k % 9) === 8 && s >= th) break; }
    if (k < D) continue;
    const sc = Math.sqrt(s / D) + lb;
    if (sc < bs) { bs = sc; best = t; }
  }
  return best;
}

async function match(cf, A, L, onProg) {
  const { rows, cols } = L, N = rows * cols, n = A.n, D = 27;
  const used = new Float32Array(n), grid = new Int32Array(N).fill(-1), stamp = new Int32Array(n).fill(-1);
  const order = Array.from({ length: N }, (_, i) => i), rnd = mulberry32(7);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const cap = Math.ceil(N / n) + (n * 2 >= N ? 2 : 4);      // 한 짤은 cap 번까지만
  const pen = CFG.REUSE / Math.max(1, N / n);
  let last = now();
  for (let q = 0; q < N; q++) {
    const i = order[q], r = (i / cols) | 0, c = i % cols;
    for (let rr = Math.max(0, r - CFG.NEAR); rr <= Math.min(rows - 1, r + CFG.NEAR); rr++)
      for (let cc = Math.max(0, c - CFG.NEAR); cc <= Math.min(cols - 1, c + CFG.NEAR); cc++) { const g = grid[rr * cols + cc]; if (g >= 0) stamp[g] = q; }
    let best = bestTile(cf, i * D, A.feats, n, used, cap, pen, stamp, q);
    if (best < 0) best = (q * 7919) % n;
    grid[i] = best; used[best]++;
    if (now() - last > 0.06) { onProg(q / N); await sleep0(); last = now(); }
  }
  return grid;
}

// ───────── 모자이크 그리기 (파이썬 compose 와 같음)
function makeComposer(A, L, photo) {
  const { cols, rows, Wm } = L, T = A.T, per = A.PER * A.PER, PER = A.PER;
  const strip = canvas(Wm, T), sx = strip.getContext('2d', { willReadFrequently: true });
  sx.imageSmoothingQuality = 'high';
  const row = new ImageData(Wm, T), od = row.data, OV = CFG.OVERLAY, KEEP = 1 - OV;
  function drawRow(r, grid, cellMean) {
    sx.drawImage(photo, 0, r * photo.height / rows, photo.width, photo.height / rows, 0, 0, Wm, T);
    const tg = sx.getImageData(0, 0, Wm, T).data;
    for (let c = 0; c < cols; c++) {
      const cell = r * cols + c, t = grid ? grid[cell] : cell % A.n;
      const sd = A.pix[(t / per) | 0], k = t % per, tx = (k % PER) * T, ty = ((k / PER) | 0) * T, cm = cell * 3;
      const s0 = CFG.SHIFT * (cellMean[cm] - A.mean[t * 3]), s1 = CFG.SHIFT * (cellMean[cm + 1] - A.mean[t * 3 + 1]), s2 = CFG.SHIFT * (cellMean[cm + 2] - A.mean[t * 3 + 2]);
      for (let y = 0; y < T; y++) {
        let si = ((ty + y) * sd.w + tx) * 4, di = (y * Wm + c * T) * 4;
        for (let x = 0; x < T; x++, si += 4, di += 4) {
          od[di] = (sd.d[si] + s0) * KEEP + OV * tg[di];
          od[di + 1] = (sd.d[si + 1] + s1) * KEEP + OV * tg[di + 1];
          od[di + 2] = (sd.d[si + 2] + s2) * KEEP + OV * tg[di + 2];
          od[di + 3] = 255;
        }
      }
    }
    return row;
  }
  return { drawRow, done: () => free(strip) };
}

async function compose(A, grid, L, photo, cellMean, onProg) {
  const { rows, Wm, Hm } = L, T = A.T;
  const mos = canvas(Wm, Hm), mx = mos.getContext('2d');
  const C = makeComposer(A, L, photo);
  let last = now();
  for (let r = 0; r < rows; r++) {
    mx.putImageData(C.drawRow(r, grid, cellMean), 0, r * T);
    if (now() - last > 0.06) { onProg((r + 1) / rows); await sleep0(); last = now(); }
  }
  C.done();
  return mos;
}

function pyramid(base, T, blank) {          // 1, 1/2, 1/4 … (멀리서 볼 때 반짝임 막기)
  const out = { 1: blank ? whiteCanvas(base.width, base.height) : base };
  let k = 1, cur = base;
  while (k * 2 <= T && base.width / (k * 2) > 300) {
    k *= 2;
    const c = canvas(Math.round(base.width / k), Math.round(base.height / k)), x = c.getContext('2d');
    if (blank) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    else { x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, c.width, c.height); cur = c; }
    out[k] = c;
  }
  return out;
}
function whiteCanvas(w, h) { const c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); return c; }

// ───────── 모이는 연출 (파이썬 plan · render 와 같음)
function startBox(L, T, focus) {            // 처음 화면 (그림 밖으로 안 나가게)
  const { Wm, Hm, VW, VH } = L, w0 = T * CFG.START_TILES, h0 = w0 * VH / VW;
  return {
    w0, h0,
    x: clamp(focus[0], Math.min(w0 / 2, Wm / 2), Math.max(Wm - w0 / 2, Wm / 2)),
    y: clamp(focus[1], Math.min(h0 / 2, Hm / 2), Math.max(Hm - h0 / 2, Hm / 2)),
  };
}

function makePlan(L, T, focus) {
  const { rows, cols, Wm, Hm, VW, VH } = L, aspect = VW / VH, sb = startBox(L, T, focus), w0 = sb.w0;
  const cam = (t) => {
    const u = clamp((t - CFG.T_CAM0) / (CFG.T_CAM1 - CFG.T_CAM0), 0, 1), e = u * u * (3 - 2 * u);
    return [w0 * Math.pow(Wm / w0, e), sb.x + (Wm / 2 - sb.x) * e, sb.y + (Hm / 2 - sb.y) * e];
  };
  const STEPS = 600, ts = [], reach = [];
  for (let i = 0; i < STEPS; i++) { const t = CFG.T_END * i / (STEPS - 1); ts.push(t); reach.push(cam(t)); }
  const N = rows * cols, land = new Float32Array(N), ang = new Float32Array(N), dist = new Float32Array(N), spin = new Float32Array(N);
  const rnd = mulberry32(11);
  const normal = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = (c + 0.5) * T, cy = (r + 0.5) * T;
    let k = 0;
    for (; k < STEPS; k++) { const [w, x, y] = reach[k]; if (Math.abs(cx - x) < w / 2 * 0.92 && Math.abs(cy - y) < w / aspect / 2 * 0.92) break; }
    k = Math.min(k, STEPS - 1);
    const i = r * cols + c;
    land[i] = k <= 1 ? 0.15 + rnd() * 1.45 : clamp(ts[k] + normal() * 0.28 + 0.35, 0.15, CFG.T_END);
    ang[i] = rnd() * 2 * Math.PI; dist[i] = 0.45 + rnd() * 0.55; spin[i] = 1.3 + rnd() * 0.7;
  }
  const byLand = Array.from({ length: N }, (_, i) => i).sort((a, b) => land[a] - land[b]);
  return { cam, land, ang, dist, spin, byLand };
}

function drawClipped(ctx, img, sx, sy, sw, sh, dw, dh) {
  const x0 = sx, y0 = sy, x1 = sx + sw, y1 = sy + sh;
  const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(img.width, x1), cy1 = Math.min(img.height, y1);
  if (cx1 <= cx0 || cy1 <= cy0) return;
  const kx = dw / sw, ky = dh / sh;
  ctx.drawImage(img, cx0, cy0, cx1 - cx0, cy1 - cy0, (cx0 - x0) * kx, (cy0 - y0) * ky, (cx1 - cx0) * kx, (cy1 - cy0) * ky);
}

function makeRenderer(L, T, mos, P) {
  const { cols, VW, VH } = L;
  const mosL = pyramid(mos, T, false), done = pyramid(mos, T, true), levels = Object.keys(mosL).map(Number);
  const dctx = {}; for (const k of levels) dctx[k] = done[k].getContext('2d');
  const frame = canvas(VW, VH), fx = frame.getContext('2d', { alpha: false });
  fx.imageSmoothingQuality = 'high';
  let ptr = 0;
  function reset() { ptr = 0; for (const k of levels) { dctx[k].fillStyle = '#fff'; dctx[k].fillRect(0, 0, done[k].width, done[k].height); } }
  function settle(t) {                                      // 내려앉은 칸을 '자리 잡은 그림'에 옮김
    while (ptr < P.byLand.length && P.land[P.byLand[ptr]] <= t) {
      const i = P.byLand[ptr++], r = (i / cols) | 0, c = i % cols;
      for (const k of levels) { const s = T / k; dctx[k].drawImage(mosL[k], c * s, r * s, s, s, c * s, r * s, s, s); }
    }
  }
  function render(t) {
    settle(t);
    const [w, x, y] = P.cam(t), h = w * VH / VW, sc = VW / w, x0 = x - w / 2, y0 = y - h / 2;
    let k = 1; while (k * 2 <= w / VW && done[k * 2]) k *= 2;
    fx.fillStyle = '#fff'; fx.fillRect(0, 0, VW, VH);
    drawClipped(fx, done[k], x0 / k, y0 / k, w / k, h / k, VW, VH);
    for (let j = P.byLand.length - 1; j >= ptr; j--) {      // 날아오는 짤 (곧 내려앉을 짤이 위에)
      const i = P.byLand[j], lt = P.land[i];
      if (lt - CFG.FLIGHT >= t) continue;
      const p = 1 - (lt - t) / CFG.FLIGHT, e = 1 - Math.pow(1 - p, 3);
      const r = (i / cols) | 0, c = i % cols;
      const d = P.dist[i] * w * 0.8 * (1 - e);
      const px = (c + 0.5) * T + Math.cos(P.ang[i]) * d, py = (r + 0.5) * T + Math.sin(P.ang[i]) * d;
      const s = Math.max(1, Math.round(T * sc * (1 + (P.spin[i] - 1) * (1 - e))));
      const X = Math.round((px - x0) * sc - s / 2), Y = Math.round((py - y0) * sc - s / 2);
      if (X >= VW || Y >= VH || X + s <= 0 || Y + s <= 0) continue;
      fx.drawImage(mosL[1], c * T, r * T, T, T, X, Y, s, s);
    }
    return frame;
  }
  function finalFrame() {
    const [w, x, y] = P.cam(CFG.T_END + 1), h = w * VH / VW;
    let k = 1; while (k * 2 <= w / VW && mosL[k * 2]) k *= 2;
    fx.fillStyle = '#fff'; fx.fillRect(0, 0, VW, VH);
    drawClipped(fx, mosL[k], (x - w / 2) / k, (y - h / 2) / k, w / k, h / k, VW, VH);
    return frame;
  }
  function dispose() { free(frame, ...levels.map((k) => done[k]), ...levels.map((k) => mosL[k])); }
  return { render, reset, finalFrame, dispose };
}

// ───────── WebP 한 장씩 만들기 (안드로이드·PC = 브라우저 기능, 아이폰 = 변환 도구)
const toBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));
let encoderP = null;
function getEncoder() {
  if (!encoderP) encoderP = (async () => {
    const force = new URLSearchParams(location.search).get('enc');
    if (force !== 'wasm') {
      const b = await toBlob(canvas(8, 8), 'image/webp', 0.8);
      if (b && b.type === 'image/webp') return { kind: 'native', enc: async (c, q) => new Uint8Array(await (await toBlob(c, 'image/webp', q)).arrayBuffer()) };
    }
    const mod = await import('./vendor/jsquash-webp/encode.js');
    const enc = async (c, q) => {
      const id = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      return new Uint8Array(await mod.default(id, { quality: Math.round(q * 100), method: 4 }));
    };
    await enc(canvas(16, 16), 0.5);                         // 변환 도구 처음 켜기
    return { kind: 'wasm', enc };
  })().catch((e) => { encoderP = null; throw e; });
  return encoderP;
}

// ───────── 여러 장 → 움직이는 WebP 한 개 (RIFF · VP8X · ANIM · ANMF)
// hold: 끝 멈춤을 '긴 한 장' 대신 '같은 간격의 짧은 장면 여러 장'으로 (11-22: 디시에 올리면 장면별 시간이 사라져 멈춤이 없어졌음)
//       늘어나는 장면은 왼쪽 위 1×1 점을 같은 색으로 다시 칠하는 것 → 화면은 그대로, 한 장에 수십 바이트
function muxWebP(frames, W, H, durs, hold) {
  const le24 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
  const le32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const str = (s) => [...s].map((ch) => ch.charCodeAt(0));
  let body = 0, alpha = false;
  const parse = (f) => {
    const dv = new DataView(f.buffer, f.byteOffset, f.byteLength);
    if (String.fromCharCode(f[0], f[1], f[2], f[3]) !== 'RIFF' || String.fromCharCode(f[8], f[9], f[10], f[11]) !== 'WEBP') throw new Error('움짤 조각이 이상해요');
    const chunks = []; let p = 12;
    while (p + 8 <= f.length) {
      const id = String.fromCharCode(f[p], f[p + 1], f[p + 2], f[p + 3]), sz = dv.getUint32(p + 4, true), end = p + 8 + sz;
      if (id === 'ALPH' || id === 'VP8 ' || id === 'VP8L') {
        if (id === 'ALPH') alpha = true;
        let c = f.subarray(p, Math.min(end, f.length));
        if (sz & 1) { const pad = new Uint8Array(c.length + 1); pad.set(c); c = pad; }
        chunks.push(c);
      }
      p = end + (sz & 1);
    }
    return { chunks, len: chunks.reduce((a, c) => a + c.length, 0) };
  };
  const anmf = (d, w, h, dur) => {                          // 자리 (0,0) · 크기 w×h · 시간 · 섞지 않고 덮어쓰기(0b10)
    const head = new Uint8Array([...str('ANMF'), ...le32(16 + d.len), ...le24(0), ...le24(0), ...le24(w - 1), ...le24(h - 1), ...le24(dur), 0b10]);
    body += head.length + d.len;
    return [head, ...d.chunks];
  };
  const anmfs = frames.map((f, idx) => anmf(parse(f), W, H, durs[idx]));
  if (hold && hold.count > 0) {
    const d = parse(hold.data);
    for (let k = 0; k < hold.count; k++) anmfs.push(anmf(d, 1, 1, hold.dur));
  }
  const vp8x = new Uint8Array([...str('VP8X'), ...le32(10), 0x02 | (alpha ? 0x10 : 0), 0, 0, 0, ...le24(W - 1), ...le24(H - 1)]);
  const anim = new Uint8Array([...str('ANIM'), ...le32(6), 255, 255, 255, 255, 0, 0]);
  const riff = new Uint8Array([...str('RIFF'), ...le32(4 + vp8x.length + anim.length + body), ...str('WEBP')]);
  const parts = [riff, vp8x, anim]; for (const a of anmfs) parts.push(...a);
  return new Blob(parts, { type: 'image/webp' });
}

// ───────── 이 폰 속도 재기 → 걸릴 시간 (사진 고르면 바로, 1초쯤)
async function prepare(photo) {
  const A = await loadAssets();
  const L = layout(photo, A.T), Llo = layout(photo, A.T, false), N = L.rows * L.cols;
  const cells = cellsOf(photo, L);
  tilePixels(A);
  await sleep0();
  let t;
  // ① 짤 고르기: 칸 몇 개를 실제처럼 골라 봄
  const used = new Float32Array(A.n), stamp = new Int32Array(A.n).fill(-1), cap = Math.ceil(N / A.n) + 4, pen = CFG.REUSE / Math.max(1, N / A.n);
  const K = 220, WARM = 40, step = Math.max(1, Math.floor(N / K));
  let tm = 0;
  for (let j = 0; j < K; j++) {
    if (j === WARM) tm = now();
    bestTile(cells.feat, ((j * step) % N) * 27, A.feats, A.n, used, cap, pen, stamp, -2);
  }
  const perCell = (now() - tm) / (K - WARM);
  await sleep0();
  // ② 모자이크 그리기: 한 줄 그려 봄
  const C = makeComposer(A, L, photo);
  C.drawRow(0, null, cells.mean); t = now(); C.drawRow(1, null, cells.mean); C.drawRow(2, null, cells.mean);
  const perRow = (now() - t) / 2; C.done();
  await sleep0();
  // ③ 움짤 한 장: 짤이 빽빽한 화면을 그려서 한 번 저장해 봄
  const E = await getEncoder();
  const b = canvas(L.VW, L.VH), bx = b.getContext('2d', { alpha: false }), per = A.PER * A.PER, s = Math.ceil(L.VW / 40), rnd = mulberry32(5);
  bx.fillStyle = '#fff'; bx.fillRect(0, 0, L.VW, L.VH);
  t = now();
  bx.drawImage(A.sheets[0], 0, 0, L.VW, L.VH);
  for (let y = 0, k = 0; y < L.VH; y += s) for (let x = 0; x < L.VW; x += s, k++) {
    if (k % 2) continue;
    const ti = Math.floor(rnd() * A.n), k2 = ti % per;
    bx.drawImage(A.sheets[(ti / per) | 0], (k2 % A.PER) * A.T, ((k2 / A.PER) | 0) * A.T, A.T, A.T, x, y, s, s);
  }
  const tRender = now() - t;
  t = now(); await E.enc(b, 0.7); const tEnc = now() - t;
  free(b);
  // 재 본 값 → 실제 시간 (PC 크롬 · CPU 4배 느리게 한 아이폰 방식으로 맞춤: 짤 고르기는 이웃 검사 때문에 1.85배, 저장은 실제가 더 빠름)
  const est = {
    load: 0, match: perCell * N * 1.85, compose: perRow * L.rows,
    prep: 0.25 + N * 0.000015, probe: tEnc * 24 + tRender * 4,
    calc: 0,                                                 // 다른 재료로 만들기: 짤 고르기 대신 그림 계산 (아래에서 채움 · total 에는 안 넣음)
    frames: FRAMES * (E.kind === 'native' ? (Math.max(tEnc * 0.6, tRender * 1.3) + 0.004) * 0.55 : (tEnc + tRender * 1.3) * 0.78),
  };
  const total = Object.values(est).reduce((a, v) => a + v, 0);
  est.calc = 1 + est.match * 0.4;                            // 다른 재료로 만들기의 그림 계산 어림 (기기 속도에 비례 · total 에는 안 넣음)
  return { A, L, Llo, cells, E, est, total };
}

// 남은 시간 계산: 지금 단계는 실제 속도로, 뒤 단계는 잰 값으로
function makeTracker(est, show) {
  const ORDER = ['load', 'match', 'compose', 'prep', 'probe', 'frames'];
  const t0 = now();
  let cur = 'load', curT = t0, curP = 0, text = '', bar = 0, lastShown = 0, lastLeft = null;
  function left() {
    const e = now() - curT, i = ORDER.indexOf(cur);
    let rem = curP > 0.04 ? e / curP * (1 - curP) : Math.max(est[cur] - e, est[cur] * 0.2);
    for (let j = i + 1; j < ORDER.length; j++) rem += est[ORDER[j]];
    return Math.max(0, rem);
  }
  function update(force) {
    const rem = left(), el = now() - t0;
    bar = Math.max(bar, Math.min(0.99, el / (el + rem)));
    if (force || now() - lastShown > 0.5) { lastShown = now(); lastLeft = rem; }
    show(text, bar, lastLeft);
  }
  const times = {};
  return {
    times,
    stage(name, label) { times[cur] = (times[cur] || 0) + now() - curT; cur = name; curT = now(); curP = 0; text = label; update(true); },
    tick(p, label) { curP = clamp(p, 0, 1); if (label) text = label; update(false); },
    end() { times[cur] = (times[cur] || 0) + now() - curT; },
    label: () => text,
  };
}

// ───────── 모양들 (patterns.js)
const PATTERNS = makePatterns({ CFG, canvas, clamp, free, mulberry32, pyramid, drawClipped, makePlan, makeRenderer, labInto, bestTile, now, sleep0 });

// ───────── 전체 흐름
const areaK = (p, spec) => (spec && spec.lo ? (p.Llo.VW * p.Llo.VH) / (p.L.VW * p.L.VH) : 1);   // 작은 움짤(그림 재료)은 저장 시간도 그만큼 짧게 어림
async function build(prep, focusPhoto, show, opts = {}) {
  const t0 = now();
  const { A, cells, E, est } = prep;
  const spec = PATTERNS[opts.pattern] || PATTERNS.assemble;
  const small = !!(spec.lo || opts.small);
  const L = small ? prep.Llo : prep.L;                     // 그림 재료 · 메모리가 모자라 다시 할 때는 작은 움짤
  const tr = makeTracker({ ...est, frames: est.frames * (opts.estT || CFG.T_END) / CFG.T_END * areaK(prep, { lo: small }), ...(spec.calc ? { match: est.calc, compose: 0 } : {}) }, show);
  const focus = [focusPhoto[0] * L.Wm / prep.photo.width, focusPhoto[1] * L.Hm / prep.photo.height];
  const ctx = { A, L, T: A.T, cells, photo: prep.photo, focus, text: opts.text, tr };
  let mos = null, R = null, sc = null, up = null, scx = null, upx = null, softK = 0, probes = [];
  const soften = (f) => { if (!sc) return f; scx.drawImage(f, 0, 0, sc.width, sc.height); upx.drawImage(sc, 0, 0, up.width, up.height); return up; };
  try {
    tr.stage('match', spec.calc ? '그림 계산하는 중…' : '칸마다 어울리는 짤 고르는 중…');
    if (spec.layout) R = await spec.make(ctx);               // 크기가 다른 짤 · 벌집 · 그림 재료 · 다른 재료: 스스로 그림
    else {
      const grid = await match(cells.feat, A, L, (p) => tr.tick(p));
      tr.stage('compose', '모자이크 그리는 중…');
      mos = await compose(A, grid, L, prep.photo, cells.mean, (p) => tr.tick(p));
      await sleep0();
      R = spec.make({ ...ctx, mos, grid });
    }
    tr.stage('prep', '움짤 준비하는 중…');
    const OW = R.W || L.VW, OH = R.H || L.VH;                 // 움짤 크기 (동그란 판처럼 모양이 정하면 그 크기)
    const n = Math.floor(R.T_END * CFG.FPS) + 2, dt = Math.round(1000 / CFG.FPS);
    const holdN = Math.max(0, Math.round(CFG.HOLD * CFG.FPS) - 1);   // 끝 멈춤 = 마지막 장면 + 같은 간격의 짧은 장면 holdN장 (muxWebP 참고)
    const durs = new Array(n).fill(dt);
    // 화질 고르기: 끝 장면과 고르게 고른 다섯 장면 크기의 평균으로 전체 크기를 어림
    tr.stage('probe', '20MB 안에 들어가게 화질 맞추는 중…');
    const lastF = R.finalFrame();
    const px = lastF.getContext('2d').getImageData(0, 0, 1, 1).data;   // 끝 멈춤 장면에 다시 칠할 왼쪽 위 점 색
    for (const tt of [R.T_END + 1, ...[0.1, 0.3, 0.5, 0.7, 0.9].map((u) => R.T_END * u)]) {   // 끝 + 고르게 다섯 장 (11-23: 세 장이면 처음이 빈 모양을 너무 무겁게 어림)
      R.reset();
      const c2 = canvas(OW, OH); c2.getContext('2d', { alpha: false }).drawImage(R.render(tt), 0, 0); probes.push(c2);
    }
    const lastBytes = (await E.enc(probes[0], CFG.Q_LAST)).length;   // 끝 장면은 높은 화질로 따로 (11-23)
    const fits = async (q) => {
      let s = 0;                                              // 움직이는 장면 = 고르게 고른 다섯 장의 평균 (끝 장면은 lastBytes 로 따로 — 평균에 넣으면 늘 무겁게 어림됨, 11-23 실측)
      for (const c2 of probes.slice(1)) s += (await E.enc(soften(c2), q)).length;
      tr.tick(0.5);
      return lastBytes + s / (probes.length - 1) * (n - 1) <= CFG.LIMIT * 0.95;
    };
    const setSoft = (k) => {
      free(sc, up); sc = up = null; softK = k;
      if (!k) return;
      sc = canvas(Math.max(2, Math.round(OW * k)), Math.max(2, Math.round(OH * k))); up = canvas(OW, OH);
      scx = sc.getContext('2d'); upx = up.getContext('2d', { alpha: false }); scx.imageSmoothingQuality = 'high'; upx.imageSmoothingQuality = 'high';
    };
    // 짤로 만들기: 화질이 Q_MIN 아래로 떨어질 것 같으면 움직이는 장면만 필요한 만큼 부드럽게(줄였다 늘림) — 깍두기처럼 깨지는 것보다 나음 · 끝 장면은 그대로 또렷
    const softs = spec.lo || spec.calc ? [0] : SOFT ? [SOFT] : CFG.SOFTS, qm = QS.indexOf(CFG.Q_MIN);
    let ok = false;
    for (const k of softs) { setSoft(k); if (await fits(QS[qm])) { ok = true; break; } }
    let lo = ok ? 0 : qm + 1, hi = ok ? qm : QS.length - 1;   // 들어가는 가장 높은 화질 (QS 는 높은 순 · 반씩 좁혀 찾기)
    while (lo < hi) { const mid = (lo + hi) >> 1; if (await fits(QS[mid])) hi = mid; else lo = mid + 1; }
    let qi = lo;
    free(...probes);
    const dot = canvas(1, 1), dx = dot.getContext('2d', { alpha: false });
    dx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`; dx.fillRect(0, 0, 1, 1);
    const hold = { data: await E.enc(dot, QS[0]), count: holdN, dur: dt };
    free(dot);
    const room = CFG.LIMIT - holdN * (24 + hold.data.length);       // 짧은 장면 몫을 빼고 남는 용량
    for (let pass = 0; ; pass++) {
      const q = QS[qi], frames = new Array(n), pend = []; let total = 0, over = false;
      R.reset();
      tr.stage('frames', pass ? '20MB가 넘어서 화질을 낮춰 다시 만드는 중…' : `움짤 만드는 중 0/${n}장`);
      for (let i = 0; i < n; i++) {
        const f = R.render(i / CFG.FPS), last = i === n - 1;
        pend.push(E.enc(last ? f : soften(f), last ? Math.max(q, CFG.Q_LAST) : q).then((b) => { frames[i] = b; total += b.length; }));
        if (pend.length >= 3) await pend.shift();
        if (total > room) { over = true; break; }
        const x = (i + 1) / n;                                // 뒤 장면일수록 짤이 많아 오래 걸림 (재 보니 앞 0.7 : 뒤 1.3)
        tr.tick(0.7 * x + 0.3 * x * x, pass ? `화질 낮춰 다시 만드는 중 ${i + 1}/${n}장` : `움짤 만드는 중 ${i + 1}/${n}장`);
        if (i % 2 === 1) await sleep0();
      }
      await Promise.all(pend);
      if (!over && total <= room) {
        tr.tick(1, '파일로 묶는 중…');
        const blob = muxWebP(frames, OW, OH, durs, hold);
        tr.end();
        const r2 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(2)]));
        return { blob, pattern: spec.name, w: OW, h: OH, soft: softK, frames: n + holdN, q, pass, enc: E.kind, cells: [L.cols, L.rows], sec: now() - t0, est: prep.total, times: r2(tr.times), ests: r2(est) };
      }
      if (qi >= QS.length - 1) throw new Error('20MB 안에 넣지 못했어요. 다른 사진으로 해 주세요.');
      qi = Math.min(QS.length - 1, qi + 2);                  // 넘으면 화질 낮춰 다시
    }
  } catch (e) {
    if (e && typeof e === 'object' && !e.where) e.where = tr.label();   // 어느 단계에서 멈췄는지 (오류 안내에 붙임 · 11-23)
    throw e;
  } finally {
    R?.dispose(); free(mos, sc, up, ...probes);
  }
}

// ───────── 화면
const ui = {
  file: $('#file'), stepPick: $('#step-pick'), stepAim: $('#step-aim'), stepWork: $('#step-work'), stepDone: $('#step-done'),
  prev: $('#preview'), make: $('#make'), guess: $('#guess'), again1: $('#again1'), again2: $('#again2'),
  bar: $('#bar'), work: $('#work-text'), eta: $('#eta'),
  out: $('#result'), size: $('#size'), save: $('#save'), err: $('#err'),
  kinds: $('#kinds'), hint: $('#hint'), ex: $('#kind-ex'), exImg: $('#kind-ex-img'),
};
let photo = null, focus = null, busy = false, lastURL = null, prepP = null, token = 0;
const QP = new URLSearchParams(location.search);            // ?pattern=cards 로 모양을 미리 고를 수 있음 · ?focus=0.34,0.25 는 시험용

// 모양 고르기 (벌집은 11-22 사용자 요청으로 화면에서 뺌 · 그림 느낌은 시안만 — patterns.js 에는 남겨 둠)
// group: 'zzal' = 짤로 만들기 · 'art' = 그림으로 만들기(그림 AI 파일 하나를 같이 씀)
const AI_NOTE = '그림 AI 파일(약 4MB)을 처음 한 번만 받아요(그림 재료끼리 같이 써요).';
// 이름은 11-23 사용자 요청으로 다듬음: 띄어쓰기·가운뎃점 없는 짧은 이름 + '~요'로 끝나는 짧은 설명
//   설명은 폰에서 한 줄(12자 안)로 · (변신 → 자리찾기 · 무한 줌 → 무한줌 · 크기가 다른 짤 → 쪼개기 · 연필·목탄 → 소묘 · 실 공예 → 실공예 · 한 줄 그림 → 한붓그리기 · 글자 초상화 → 글자그림 · 큐브 모자이크 → 큐브아트)
const KINDS = [
  { key: 'assemble', group: 'zzal', name: '모이기', desc: '짤이 날아와 모여요', box: true, estT: CFG.T_END, hint: '점선 네모 안에서 시작해서 짤이 모이며 전체 사진이 돼요.' },
  { key: 'cards', group: 'zzal', name: '카드섹션', desc: '카드가 차례로 뒤집혀요', box: true, estT: CFG.T_END, hint: '점선 네모 안, 누른 곳부터 카드가 뒤집히며 전체 사진이 돼요.' },
  { key: 'slot', group: 'zzal', name: '슬롯머신', desc: '줄마다 돌다가 멈춰요', box: true, estT: CFG.T_END, hint: '점선 네모 안, 누른 곳 쪽 줄부터 멈추며 전체 사진이 돼요.' },
  { key: 'morph', group: 'zzal', name: '자리찾기', desc: '짤이 제자리를 찾아가요', box: false, estT: 4.7, hint: '색깔별로 놓인 짤이 누른 곳부터 제자리를 찾아가요.' },
  { key: 'droste', group: 'zzal', name: '무한줌', desc: '끝없이 빨려 들어가요', box: false, estT: 6.2, hint: '누른 곳은 가리지 않게 구석에 작은 사진을 넣어요.' },
  { key: 'quad', group: 'zzal', name: '쪼개기', desc: '큰 짤이 잘게 쪼개져요', box: false, estT: 4.2, hint: '누른 곳 둘레는 작은 짤로 또렷하게 만들어요.' },
  { key: 'sketch', group: 'zzal', name: '그려지기', desc: '스케치에 짤로 칠해요', box: false, estT: 5.7, hint: '누른 곳부터 연필 선이 그려지고, 그 위에 짤로 색칠돼요.' },
  { key: 'crayon', group: 'art', name: '크레파스', desc: '크레파스로 꾹꾹 칠해요', box: false, estT: 5.3, hint: `누른 곳부터 테두리를 그리고 크레파스로 칠해요. ${AI_NOTE}` },
  { key: 'watercolor', group: 'art', name: '수채화', desc: '물감이 맑게 번져요', box: false, estT: 5.3, hint: `누른 곳부터 맑은 물감으로 칠해요. ${AI_NOTE}` },
  { key: 'cpencil', group: 'art', name: '색연필', desc: '색연필로 곱게 칠해요', box: false, estT: 5.3, hint: `누른 곳부터 색연필로 칠해요. ${AI_NOTE}` },
  { key: 'oil', group: 'art', name: '유화', desc: '물감을 두껍게 발라요', box: false, estT: 5.3, hint: `누른 곳부터 물감을 두껍게 발라요. ${AI_NOTE}` },
  { key: 'charcoal', group: 'art', name: '소묘', desc: '연필과 목탄으로 그려요', box: false, estT: 5.3, hint: `누른 곳부터 연필과 목탄으로 흑백 그림을 그려요. ${AI_NOTE}` },
  { key: 'ink', group: 'art', name: '수묵화', desc: '한지에 먹으로 그려요', box: false, estT: 5.3, hint: `누른 곳부터 먹으로 그려요. ${AI_NOTE}` },
  { key: 'string', group: 'calc', name: '실공예', desc: '못 사이로 실을 감아요', box: false, estT: 5.5, hint: '누른 곳이 동그란 판 가운데에 오게 잘라요. 못 사이로 실이 한 줄씩 감기며 그림이 떠올라요.' },
  { key: 'spiral', group: 'calc', name: '한붓그리기', desc: '펜을 떼지 않고 그려요', box: false, estT: 5.5, hint: '누른 곳이 동그란 판 가운데에 오게 잘라요. 가운데부터 선 하나가 감겨 나가며 그려져요.' },
  { key: 'engrave', group: 'calc', name: '동판화', desc: '가는 선을 새겨 그려요', box: false, estT: 5.0, hint: '위에서부터 한 줄씩 가는 선이 새겨지며 지폐 그림 같은 판화가 돼요.' },
  { key: 'letters', group: 'calc', name: '글자그림', desc: '글자로 빼곡히 그려요', box: false, estT: 5.75, hint: "누른 곳에 '고마워사랑해응원해'가 크게 써지고, 뒤로 물러나면 글자로 된 그림이 보여요." },
  { key: 'cube', group: 'calc', name: '큐브아트', desc: '큐브를 맞춰 그려요', box: false, estT: 5.0, hint: '누른 곳부터 큐브가 하나씩 맞춰지며 그림이 돼요.' },
];
const GROUPS = [
  { key: 'zzal', title: '짤로 만들기' },
  { key: 'art', title: '그림으로 만들기', note: '짤 대신 그림 AI가 그려요. 처음 한 번 4MB를 받아요.' },
  { key: 'calc', title: '여러 재료로 만들기', note: '실·선·글자·큐브로 그려요. 짤도 AI도 안 써요.' },
];
const EXV = '4';                                             // 예시 움짤(ex/) 버전 — 다시 만들면 바꿈 (11-22: 400px · 초당 16장 · 3: 그림 재료 5종 추가)
const qpKey = QP.get('pattern');                              // 화면에 없는 모양(시험 중 · 벌집)도 주소로는 열림
let kind = KINDS.find((k) => k.key === qpKey)
  || (PATTERNS[qpKey] ? { key: qpKey, name: PATTERNS[qpKey].name, desc: '', box: false, estT: CFG.T_END, hint: '시험 중인 모양이에요.' } : KINDS[0]);
let lastPrep = null;
function guessText(p) {                                      // 모양마다 장수가 달라서 '움짤 만들기' 몫만 고쳐서 어림
  const spec = PATTERNS[kind.key], fr = p.est.frames * kind.estT / CFG.T_END * areaK(p, spec);
  const total = p.total - p.est.frames + fr - (spec && spec.calc ? p.est.match + p.est.compose - p.est.calc : 0);
  return total < 10 ? '이 폰에서는 10초 안에 끝날 것 같아요' : `이 폰에서는 약 ${fmtSec(total)} 걸릴 것 같아요`;
}
function setKind(k) {
  kind = k;
  for (const el of ui.kinds.querySelectorAll('.kind')) { const on = el.dataset.key === k.key; el.classList.toggle('on', on); el.querySelector('input').checked = on; }
  ui.hint.textContent = `${k.hint} 얼굴이 다른 곳에 있으면 얼굴을 눌러 주세요.`;
  if (photo && !ui.stepAim.hidden) drawPreview();
  if (lastPrep) ui.guess.textContent = guessText(lastPrep);
  const P = PATTERNS[k.key];                                 // 미리 받을 파일이 있는 모양(그림 재료 — AI 파일)은 고르자마자 받아 둠
  if (P?.prefetch) Promise.resolve().then(() => P.prefetch()).catch(() => { /* 만들 때 다시 시도 */ });
  showExample();
}
function showExample() {                                     // 고른 모양의 예시 움짤 (경복궁 사진) — 사진을 고른 뒤에만 받음
  if (!KINDS.includes(kind) || ui.stepAim.hidden) { ui.ex.hidden = true; return; }
  const src = `ex/${kind.key}.webp?v=${EXV}`;
  if (ui.exImg.getAttribute('src') !== src) { ui.exImg.src = src; ui.exImg.alt = `${kind.name} 예시 움짤`; ui.ex.hidden = false; }
  else ui.ex.hidden = ui.exImg.complete && !ui.exImg.naturalWidth;   // 같은 그림을 이미 못 받았으면 계속 숨김
}
ui.exImg.addEventListener('error', () => { ui.ex.hidden = true; });   // 예시가 아직 없거나 못 받으면 깨진 그림 대신 칸을 숨김
(function renderKinds() {
  for (const g of GROUPS) {
    const box = document.createElement('div'), head = document.createElement('p'), grid = document.createElement('div');
    box.className = 'kind-group'; box.setAttribute('role', 'group');
    head.className = 'kind-head'; head.id = `kind-head-${g.key}`; head.textContent = g.title;
    box.setAttribute('aria-labelledby', head.id); box.append(head);
    if (g.note) {
      const nt = document.createElement('p');
      nt.className = 'kind-note'; nt.id = `kind-note-${g.key}`; nt.textContent = g.note;
      box.setAttribute('aria-describedby', nt.id); box.append(nt);
    }
    grid.className = 'kind-grid';
    for (const k of KINDS.filter((x) => x.group === g.key)) {
      const lab = document.createElement('label'), inp = document.createElement('input'), nm = document.createElement('span'), ds = document.createElement('span');
      lab.className = 'kind'; lab.dataset.key = k.key;
      inp.type = 'radio'; inp.name = 'kind'; inp.value = k.key;
      inp.addEventListener('change', () => { if (inp.checked) setKind(k); });
      nm.className = 'kind-name'; nm.textContent = k.name;
      ds.className = 'kind-desc'; ds.textContent = k.desc;
      lab.append(inp, nm, ds); grid.append(lab);
    }
    box.append(grid); ui.kinds.append(box);
  }
  setKind(kind);
})();

const memErr = (e) => !!e && (e.name === 'InvalidStateError' || e.name === 'RangeError' || /메모리|out of memory/i.test(e.message || ''));   // 사파리는 메모리가 모자라면 그림 읽기에서 InvalidStateError
function show(step) { for (const s of [ui.stepPick, ui.stepAim, ui.stepWork, ui.stepDone]) s.hidden = s !== step; }
function error(msg) { ui.err.textContent = msg; ui.err.hidden = !msg; }
function fmtSec(s) {
  if (s < 60) return `${Math.max(10, Math.round(s / 5) * 5)}초`;
  const m = Math.floor(s / 60), r = Math.round((s - m * 60) / 10) * 10;
  return r >= 60 ? `${m + 1}분` : r ? `${m}분 ${r}초` : `${m}분`;
}

function drawPreview() {
  const c = ui.prev, maxW = Math.min(c.parentElement.clientWidth, 560), k = Math.min(maxW / photo.width, (window.innerHeight * 0.58) / photo.height);
  const dpr = window.devicePixelRatio || 1;
  c.style.width = Math.round(photo.width * k) + 'px'; c.style.height = Math.round(photo.height * k) + 'px';
  c.width = Math.round(photo.width * k * dpr); c.height = Math.round(photo.height * k * dpr);
  const x = c.getContext('2d'), s = c.width / photo.width;
  x.drawImage(photo, 0, 0, c.width, c.height);
  // 처음 화면 네모 (짤 22칸 너비) — 그림 좌표로 바꿔서
  const T = 32, L = layout(photo, T), kx = photo.width / L.Wm, ky = photo.height / L.Hm;
  const sb = startBox(L, T, [focus[0] / kx, focus[1] / ky]);
  x.save();
  x.lineWidth = 2 * dpr; x.strokeStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 4 * dpr;
  if (kind.box) {                                            // 점선 네모는 그 네모에서 시작하는 모양만
    x.setLineDash([6 * dpr, 5 * dpr]);
    x.strokeRect((sb.x - sb.w0 / 2) * kx * s, (sb.y - sb.h0 / 2) * ky * s, sb.w0 * kx * s, sb.h0 * ky * s);
  }
  x.setLineDash([]); x.beginPath(); x.arc(focus[0] * s, focus[1] * s, 9 * dpr, 0, Math.PI * 2); x.stroke();
  x.restore();
}

ui.file.addEventListener('change', async () => {
  const f = ui.file.files && ui.file.files[0]; if (!f) return;
  error('');
  const my = ++token;
  try { photo = await readPhoto(f); }
  catch (e) { error(e.message || '사진을 열 수 없어요.'); return; }
  const qf = (QP.get('focus') || '').split(',').map(Number);   // 시험용: ?focus=0.34,0.25 (사진 안 비율)
  focus = qf.length === 2 && qf.every((v) => v >= 0 && v <= 1) ? [qf[0] * photo.width, qf[1] * photo.height] : [photo.width / 2, photo.height / 3];
  show(ui.stepAim); drawPreview(); showExample();
  ui.guess.textContent = '이 폰에서 걸릴 시간 재는 중…';
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  const ph = photo;
  prepP = prepare(ph).then((p) => { p.photo = ph; return p; });
  lastPrep = null;
  prepP.then((p) => { if (my === token) { lastPrep = p; ui.guess.textContent = guessText(p); } })
    .catch((e) => { if (my === token) { ui.guess.textContent = ''; error(e.message || '준비하다 멈췄어요.'); } });
});
ui.prev.addEventListener('click', (ev) => {
  const r = ui.prev.getBoundingClientRect();
  focus = [(ev.clientX - r.left) / r.width * photo.width, (ev.clientY - r.top) / r.height * photo.height];
  drawPreview();
});
window.addEventListener('resize', () => { if (photo && !ui.stepAim.hidden) drawPreview(); });

function again() { if (busy) return; token++; ui.file.value = ''; photo = null; prepP = null; lastPrep = null; error(''); show(ui.stepPick); }
ui.again1.addEventListener('click', again); ui.again2.addEventListener('click', again);

ui.make.addEventListener('click', async () => {
  if (busy || !photo || !prepP) return;
  busy = true; error(''); show(ui.stepWork);
  ui.bar.style.width = '0%'; ui.work.textContent = '이 폰 속도 재는 중…'; ui.eta.textContent = '';
  let lock = null;
  try { lock = await navigator.wakeLock?.request('screen'); } catch (e) { /* 없어도 됨 */ }
  const showP = (text, p, left) => {
    ui.work.textContent = text; ui.bar.style.width = (p * 100).toFixed(1) + '%';
    ui.eta.textContent = left == null ? '' : left < 3 ? '거의 다 됐어요' : left < 10 ? '곧 끝나요' : `약 ${fmtSec(left)} 남았어요`;
  };
  const k = kind;
  try {
    const prep = await prepP;
    let r;
    try { r = await build(prep, focus, showP, { pattern: k.key, estT: k.estT }); }
    catch (e) {                                              // 폰 메모리가 모자라 멈췄으면 한 번만 조금 작게 다시 (11-23 아이폰 그려지기)
      if (!memErr(e) || PATTERNS[k.key]?.lo) throw e;
      console.warn('메모리가 모자라 작게 다시 만듦', e);
      showP('폰 메모리가 모자라서 조금 작게 다시 만드는 중…', 0, null);
      await new Promise((res) => setTimeout(res, 400));    // 비운 그림 메모리를 폰이 돌려받을 틈
      r = await build(prep, focus, showP, { pattern: k.key, estT: k.estT, small: true });
    }
    if (lastURL) URL.revokeObjectURL(lastURL);
    lastURL = URL.createObjectURL(r.blob);
    ui.out.src = lastURL; ui.out.width = r.w; ui.out.height = r.h;
    ui.size.textContent = `${(r.blob.size / 1e6).toFixed(1)}MB · ${r.w}×${r.h} · 디시에 그대로 올릴 수 있어요`;
    const d = new Date(), p2 = (v) => String(v).padStart(2, '0');
    ui.save.href = lastURL; ui.save.download = `짤모자이크_${k.name.replace(/\s/g, '')}_${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.webp`;
    window.__mosaic = { pattern: r.pattern, size: r.blob.size, w: r.w, h: r.h, soft: r.soft, frames: r.frames, q: r.q, pass: r.pass, enc: r.enc, cells: r.cells, sec: +r.sec.toFixed(1), est: +r.est.toFixed(1), times: r.times, ests: r.ests };
    show(ui.stepDone);
  } catch (e) {
    console.error(e);
    show(ui.stepAim); drawPreview(); showExample();
    const msg = e && e.message ? e.message : '만들다가 멈췄어요.', own = /주세요\.$/.test(msg);   // 이미 '…주세요.' 로 끝나는 안내엔 덧붙이지 않음
    const tag = ` (${[k.name, e && e.where && e.where.replace(/…$/, ''), e && e.name].filter(Boolean).join(' · ')})`;   // 어디서 멈췄는지 — 알려 주시면 고치기 쉬움
    error(memErr(e) ? '폰 메모리가 모자라서 멈췄어요. 다른 앱과 탭을 닫고 다시 눌러 보세요.' + tag : own ? msg : msg + ' 다시 눌러 보세요.' + tag);
  } finally {
    busy = false; try { await lock?.release(); } catch (e) { /* */ }
  }
});

// 맨 위 짤 띠 (짤 묶음을 미리 받아 두는 겸)
(async function strip() {
  const c = $('#wall'); if (!c) return;
  try {
    const A = await loadAssets();
    const dpr = window.devicePixelRatio || 1, cell = 30, w = c.clientWidth, cols = Math.ceil(w / cell), rows = 3;
    c.width = Math.round(w * dpr); c.height = Math.round(rows * cell * dpr);
    const x = c.getContext('2d'), per = A.PER * A.PER, rnd = mulberry32((Date.now() / 1000) | 0), s = cell * dpr;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const t = Math.floor(rnd() * A.n), im = A.sheets[(t / per) | 0], k = t % per;
      x.drawImage(im, (k % A.PER) * A.T, ((k / A.PER) | 0) * A.T, A.T, A.T, q * s, r * s, s, s);
    }
    c.classList.add('on');
  } catch (e) { /* 띠는 없어도 됨 */ }
  // 변환 도구까지 미리 받아 둠 → 페이지가 열린 뒤엔 인터넷이 끊겨도(비행기 모드) 만들 수 있음
  try { await loadAssets(); await getEncoder(); } catch (e) { /* 사진 고를 때 다시 시도 */ }
  for (const k of KINDS) if (k.group === 'calc') PATTERNS[k.key]?.prefetch?.().catch(() => { /* 고를 때 다시 시도 */ });
})();

show(ui.stepPick);
