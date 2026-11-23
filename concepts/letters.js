// 글자 초상화 (11-23): '고마워사랑해응원해' 를 한 줄에 150자씩 빼곡히 — 밝은 곳은 굵은 글자 · 어두운 곳은 가는 글자 · 글자 속은 사진 색
// lab/concepts/textportrait.py 를 옮김 (사용자가 고른 판: GAM 0.7 · BOOST 1.2 · BGK 0.2 · FILL 1.06)
// 움짤: 아주 가까이서 '고마워사랑해응원해' 가 한 글자씩 써지고 → 그 줄부터 화면이 채워지고 → 뒤로 물러나며 글자가 번져 얼굴이 보임
// 글꼴: vendor/fonts/letters-kr.woff2 (Noto Sans KR 8글자 가변 글꼴 · OFL, vendor/fonts/LICENSE-OFL.txt)
//   굵기가 안 바뀌는 엔진(윈도 웹킷 등)이나 글꼴을 못 받았을 때는 맨 아래 묶음 글꼴(같은 글꼴의 굵기 16개를 한 파일에)로 그림

const TEXT = '고마워사랑해응원해', CH = '고마워사랑해응원', KOF = [0, 1, 2, 3, 4, 5, 6, 7, 5];   // 9글자 → 8글자 번호
const N = 150, FILL = 1.06, GAM = 0.7, BOOST = 1.2, BGK = 0.2;   // 한 줄 글자 수 · 칸 대비 글자 크기 · 글자 색 · 바탕 밝기
const NW = 16, WT = (w) => 150 + 50 * w;                         // 굵기 150 ~ 900 (50 단위)
const REF = 100;                                                 // 잉크 상자 재는 글자 크기
const S16 = 1 / 16;
const TA = 3 * S16, DL = 3 * S16;                                // 첫 글자 · 한 글자마다
const TB = TA + 8 * DL + 11 * S16;                               // 9글자 다 쓰고 잠깐 멈춘 뒤 둘레 채우기
const DB = 14 * S16, TC = TB + DB;                               // 채우기 (점점 빨리) → 물러나기 시작
const DC = 40 * S16, T_END = TC + DC, EZ = 1.6;                  // 물러나기 (얼굴 전체까지) · 큰 글자에서 천천히 → 빽빽한 끝은 빨리 (촘촘한 장면이 용량을 많이 먹어서)

// ── 글꼴: 모듈을 받자마자 미리 받아 둠 (비행기 모드용)
const VAR_URL = new URL('../vendor/fonts/letters-kr.woff2', import.meta.url).href;
let varP = null, packP = null;
function loadVar() {
  if (!varP) varP = (async () => {
    const f = new FontFace('LettersKR', `url(${VAR_URL})`, { weight: '100 900' });
    await f.load(); document.fonts.add(f); return f;
  })().catch((e) => { varP = null; throw e; });
  return varP;
}
function loadPack() {
  if (!packP) packP = (async () => {
    const s = atob(PACK), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    const f = new FontFace('LettersKRW', u.buffer); await f.load(); document.fonts.add(f); return f;
  })().catch((e) => { packP = null; throw e; });
  return packP;
}
if (typeof FontFace !== 'undefined') loadVar().catch(() => {});
const FONTS = {
  var: { font: (w, px) => `${WT(w)} ${px.toFixed(2)}px LettersKR`, ch: (w, k) => CH[k] },
  pack: { font: (w, px) => `${px.toFixed(2)}px LettersKRW`, ch: (w, k) => String.fromCharCode(0xE000 + w * 8 + k) },   // 굵기 w · 글자 k
};

// 굵기마다 · 글자마다 잉크 가운데 (칸 가운데에 맞추려고 — measureText 는 엔진마다 달라서 직접 잼) + 굵기가 정말 바뀌는지
function inkTable(K, F) {
  const S = 168, AX = 34, AY = 130, c = K.canvas(S, S), x = c.getContext('2d', { willReadFrequently: true });
  const box = new Float32Array(NW * 8 * 2), sum = new Float64Array(NW);
  for (let w = 0; w < NW; w++) {
    x.font = '10px serif'; x.font = F.font(w, REF);
    x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff';
    for (let k = 0; k < 8; k++) {
      x.clearRect(0, 0, S, S); x.fillText(F.ch(w, k), AX, AY);
      const d = x.getImageData(0, 0, S, S).data;
      let x0 = S, x1 = -1, y0 = S, y1 = -1, s = 0;
      for (let y = 0, o = 3; y < S; y++) for (let xx = 0; xx < S; xx++, o += 4) {
        const a = d[o]; if (!a) continue;
        s += a;
        if (a > 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      sum[w] += s;
      const j = (w * 8 + k) * 2;
      box[j] = x1 < 0 ? REF / 2 : (x0 + x1 + 1) / 2 - AX; box[j + 1] = y1 < 0 ? -REF * 0.38 : (y0 + y1 + 1) / 2 - AY;
    }
  }
  K.free(c);
  let ok = sum[0] > 0;
  for (let w = 1; w < NW; w++) if (!(sum[w] > sum[w - 1] * 1.01)) ok = false;   // 굵기마다 잉크가 늘어야 함
  return { box, ok };
}
async function pickFont(K) {
  try {
    let tm = 0;
    await Promise.race([loadVar(), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error('글꼴 받기 시간 초과')), 6000); })]).finally(() => clearTimeout(tm));
    const t = inkTable(K, FONTS.var);
    if (t.ok) return { ...FONTS.var, box: t.box, kind: 'var' };
  } catch (e) { console.warn(e); }
  try {
    await loadPack();
    const t = inkTable(K, FONTS.pack);
    if (t.ok) return { ...FONTS.pack, box: t.box, kind: 'pack' };
  } catch (e) { console.warn(e); }
  throw new Error('글자 모양(글꼴)을 불러오지 못했어요. 새로고침하고 다시 해 보세요.');
}

function drawCrop(x, img, sx, sy, sw, sh, dw, dh) {        // 사파리: 원본 밖으로 나간 자르기는 안 그려져서 직접 잘라 맞춤
  const cx0 = Math.max(0, sx), cy0 = Math.max(0, sy), cx1 = Math.min(img.width, sx + sw), cy1 = Math.min(img.height, sy + sh);
  if (cx1 <= cx0 || cy1 <= cy0) return;
  const kx = dw / sw, ky = dh / sh;
  x.drawImage(img, cx0, cy0, cx1 - cx0, cy1 - cy0, (cx0 - sx) * kx, (cy0 - sy) * ky, (cx1 - cx0) * kx, (cy1 - cy0) * ky);
}

export async function make(c, K) {
  const { L, photo } = c, { VW, VH } = L, { clamp, canvas, free, now, sleep0 } = K;
  const tick = (p) => { if (c.tr) c.tr.tick(p, '글자 놓는 중…'); };
  tick(0);
  const FT = await pickFont(K), box = FT.box;

  // ── 판: 가로 150칸 · 세로는 화면 비율대로 (정사각형 칸) — 사진은 판 비율만큼 가운데를 씀
  const NR = Math.max(12, Math.round(N * VH / VW)), AR = NR / N, NC = N * NR;
  const pw = photo.width, ph = photo.height;
  let cw = pw, chh = ph;
  if (pw * NR > ph * N) cw = ph * N / NR; else chh = pw * NR / N;
  const ox = (pw - cw) / 2, oy = (ph - chh) / 2;
  const GW = Math.max(2 * N, Math.round(cw)), GH = Math.max(2 * NR, Math.round(GW * AR)), P = GW * GH;
  const base = canvas(GW, GH), bx = base.getContext('2d', { willReadFrequently: true });
  bx.imageSmoothingQuality = 'high'; bx.drawImage(photo, ox, oy, cw, chh, 0, 0, GW, GH);
  const img = bx.getImageData(0, 0, GW, GH), d = img.data;
  free(base);

  // 사진 손질 (파이썬과 같음): 채널마다 0.5% 자동 대비 → 살짝 선명하게 (반경 2 · 80% · 문턱 2)
  const chans = [];
  for (let k = 0; k < 3; k++) {
    const h = new Float64Array(256);
    for (let o = k; o < d.length; o += 4) h[d[o]]++;
    const cut0 = Math.floor(P * 0.5 / 100);
    let cut = cut0;
    for (let v = 0; v < 256 && cut > 0; v++) { if (cut > h[v]) { cut -= h[v]; h[v] = 0; } else { h[v] -= cut; cut = 0; } }
    cut = cut0;
    for (let v = 255; v >= 0 && cut > 0; v--) { if (cut > h[v]) { cut -= h[v]; h[v] = 0; } else { h[v] -= cut; cut = 0; } }
    let lo = 0, hi = 255;
    while (lo < 255 && !h[lo]) lo++;
    while (hi > 0 && !h[hi]) hi--;
    const m = new Float32Array(256);
    for (let v = 0; v < 256; v++) m[v] = hi <= lo ? v : clamp(Math.trunc(v * 255 / (hi - lo) - lo * 255 / (hi - lo)), 0, 255);
    const a = new Float32Array(P);
    for (let i = 0, o = k; i < P; i++, o += 4) a[i] = m[d[o]];
    const b = K.boxBlur(a, GW, GH, 2);
    for (let i = 0; i < P; i++) { const df = a[i] - b[i]; if (df >= 2 || df <= -2) a[i] = clamp(a[i] + 0.8 * df, 0, 255); }
    chans.push(a);
    tick(0.05 + 0.07 * k);
    await sleep0();
  }

  // 칸마다 밝기 → 굵기 · 글자 색 판 · 바탕(어둡게 깔린 사진) 판
  const LG = new Uint8Array(256), LB = new Uint8Array(256);
  for (let v = 0; v < 256; v++) { LG[v] = Math.min(255, Math.trunc(255 * Math.pow(v / 255, GAM) * BOOST + 0.5)); LB[v] = Math.trunc(v * BGK + 0.5); }
  const lsum = new Float64Array(NC), lcnt = new Float64Array(NC), ydark = new Float32Array(NC).fill(255), colOf = new Int32Array(GW);
  for (let x = 0; x < GW; x++) colOf[x] = Math.min(N - 1, Math.floor(x * N / GW));
  const dk = new ImageData(GW, GH), dd = dk.data, [R, G, B] = chans;
  for (let y = 0; y < GH; y++) {
    const row = Math.min(NR - 1, Math.floor(y * NR / GH)) * N;
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x, o = i * 4, r = (R[i] + 0.5) | 0, g = (G[i] + 0.5) | 0, b = (B[i] + 0.5) | 0, j = row + colOf[x];
      const Y = (r * 299 + g * 587 + b * 114) / 1000;
      lsum[j] += Y; lcnt[j]++; if (Y < ydark[j]) ydark[j] = Y;
      d[o] = LG[r]; d[o + 1] = LG[g]; d[o + 2] = LG[b]; d[o + 3] = 255;
      dd[o] = LB[r]; dd[o + 1] = LB[g]; dd[o + 2] = LB[b]; dd[o + 3] = 255;
    }
  }
  chans.length = 0;
  const lum = new Float32Array(NC);
  let lmin = 1e9, lmax = -1e9;
  for (let j = 0; j < NC; j++) { lum[j] = lsum[j] / Math.max(1, lcnt[j]) / 255; lmin = Math.min(lmin, lum[j]); lmax = Math.max(lmax, lum[j]); }
  const wi = new Uint8Array(NC);
  for (let j = 0; j < NC; j++) {
    lum[j] = (lum[j] - lmin) / (lmax - lmin + 1e-6);
    wi[j] = clamp(Math.round((150 + 750 * Math.pow(lum[j], 0.85)) / 50) - 3, 0, NW - 1);
  }
  const gcan = canvas(GW, GH), dcan = canvas(GW, GH);
  gcan.getContext('2d').putImageData(img, 0, 0); dcan.getContext('2d').putImageData(dk, 0, 0);
  const gx = GW / N, gy = GH / NR;
  tick(0.3);
  await sleep0();

  // ── 처음 다가갈 곳: 고른 곳 줄에 '고마워사랑해응원해' 9글자 (그곳이 어두우면 가까운 밝은 곳으로 — 글자가 안 보여서)
  const bxF = (c.focus[0] / L.Wm * pw - ox) / cw * N, byF = (c.focus[1] / L.Hm * ph - oy) / chh * NR;
  const clR = (r) => clamp(r, Math.min(7, NR >> 1), Math.max(NR - 8, NR >> 1)), clC = (s) => clamp(s, 3, N - 12);
  const rowLum = (r, s) => { let m = 0, lo = 1; for (let k = 0; k < 9; k++) { const j = r * N + s + k; m += lum[j]; lo = Math.min(lo, ydark[j] / 255); } return [m / 9, lo]; };   // 평균 밝기 · 가장 어두운 점 (글자를 가로지르는 어두운 선도 피함)
  let rm = clR(Math.floor(byF)), cs = clC(Math.floor(bxF) - 4);
  const [m0, lo0] = rowLum(rm, cs);
  if (m0 < 0.45 || lo0 < 0.2) {
    const RAD = 0.1 * Math.max(N, NR), RI = Math.ceil(RAD);
    let best = null, bestD = 1e9, bri = null, briM = m0;
    for (let dr = -RI; dr <= RI; dr++) for (let dc = -RI; dc <= RI; dc++) {
      const dist = Math.hypot(dr, dc), r = rm + dr, s = cs + dc;
      if (dist > RAD || r !== clR(r) || s !== clC(s)) continue;
      const [m, lo] = rowLum(r, s);
      if (m >= 0.45 && lo >= 0.2 && dist < bestD) { bestD = dist; best = [r, s]; }
      if (m > briM) { briM = m; bri = [r, s]; }
    }
    if (best) [rm, cs] = best; else if (bri) [rm, cs] = bri;
  }
  const OFF = rm * N + cs, FX = cs + 4.5, FY = rm + 0.5, V0 = 14;   // (rm, cs) 칸이 '고' · 9글자 한가운데
  const kOf = (r, q) => KOF[(((r * N + q - OFF) % 9) + 9) % 9];

  // ── 화면 (판 칸 단위): 처음엔 14칸 넓이 → 로그 눈금으로 부드럽게 판 전체까지
  const viewAt = (vw, cx, cy) => { const vh = vw * AR; return [clamp(cx, vw / 2, N - vw / 2) - vw / 2, clamp(cy, vh / 2, NR - vh / 2) - vh / 2, vw, vh]; };
  const camU = (u) => { const w = Math.pow(u, EZ), e = w * w * (3 - 2 * w); return viewAt(V0 * Math.pow(N / V0, e), FX + (N / 2 - FX) * e, FY + (NR / 2 - FY) * e); };
  const v0 = camU(0);
  const RT = new Float32Array(1001);                         // 물러나는 동안 글자가 번진 반경 (줄지 않게)
  for (let k = 0, rmx = 0; k <= 1000; k++) {
    const u = k / 1000, [vx, vy, vw, vh] = camU(u);
    let dmx = 0;
    for (const [x, y] of [[vx, vy], [vx + vw, vy], [vx, vy + vh], [vx + vw, vy + vh]]) dmx = Math.max(dmx, Math.hypot(x - FX, y - FY));
    rmx = Math.max(rmx, dmx * (0.85 + 0.2 * u * u)); RT[k] = rmx;
  }
  let D2ALL = 0;
  for (const [x, y] of [[0.5, 0.5], [N - 0.5, 0.5], [0.5, NR - 0.5], [N - 0.5, NR - 0.5]]) D2ALL = Math.max(D2ALL, (x - FX) ** 2 + (y - FY) ** 2);

  // 채우는 순서: 9글자 → 첫 화면 칸 (9글자 줄에서 가까운 순) → 그 밖은 얼굴에서 동그랗게
  const ra = Math.max(0, Math.floor(v0[1])), rb = Math.min(NR, Math.ceil(v0[1] + v0[3]));
  const ca = Math.max(0, Math.floor(v0[0])), cb = Math.min(N, Math.ceil(v0[0] + v0[2]));
  const ord = new Int32Array(NC).fill(1 << 30), rest = [];
  for (let k = 0; k < 9; k++) ord[rm * N + cs + k] = k;
  for (let r = ra; r < rb; r++) for (let q = ca; q < cb; q++) if (ord[r * N + q] >= 9) rest.push(r * N + q);
  const near9 = (i) => { const r = (i / N) | 0, q = i - r * N; return Math.hypot(Math.max(cs - q, 0, q - (cs + 8)), r - rm); };
  rest.sort((a, b) => near9(a) - near9(b) || a - b).forEach((i, j) => { ord[i] = 9 + j; });

  function state(t) {
    const typed = t < TA ? 0 : Math.min(9, 1 + Math.floor((t - TA) / DL + 1e-9));
    const cnt = t <= TB ? 0 : Math.floor(rest.length * Math.pow(Math.min(1, (t - TB) / DB), 1.6));
    const R = t <= TC ? -1 : RT[Math.round(clamp((t - TC) / DC, 0, 1) * 1000)];
    return { typed, cnt, R, R2: R < 0 ? -1 : R * R };
  }
  const filled = (i, st) => {
    const o = ord[i];
    if (o < 9 ? o < st.typed : o - 9 < st.cnt) return true;
    if (st.R2 < 0) return false;
    const r = (i / N) | 0, dx = i - r * N + 0.5 - FX, dy = r + 0.5 - FY;
    return dx * dx + dy * dy <= st.R2;
  };

  // ── 멀리서 볼 판: 화면 2배쯤 크기로 한 번 다 그려 둠 (아이폰: 16MP · 한 변 4096 이하)
  const MW = Math.max(16, Math.min(Math.round(2 * VW), 4096, Math.floor(4096 / AR), Math.floor(Math.sqrt(15.9e6 / AR))));
  const MH = Math.round(MW * AR), mcx = MW / N, mcy = MH / NR;
  const master = canvas(MW, MH), mc = master.getContext('2d');
  mc.imageSmoothingQuality = 'high';
  const byW = Array.from({ length: NW }, () => []);
  for (let j = 0; j < NC; j++) byW[wi[j]].push(j);
  mc.fillStyle = '#fff'; mc.textAlign = 'left'; mc.textBaseline = 'alphabetic';
  const ms = mcx * FILL / REF;
  let nDone = 0, tl = now();
  for (let w = 0; w < NW; w++) {
    mc.font = FT.font(w, mcx * FILL);
    for (const j of byW[w]) {
      const r = (j / N) | 0, q = j - r * N, k = kOf(r, q), b = (w * 8 + k) * 2;
      mc.fillText(FT.ch(w, k), (q + 0.5) * mcx - box[b] * ms, (r + 0.5) * mcy - box[b + 1] * ms);
      if ((++nDone & 255) === 0 && now() - tl > 0.05) { tick(0.3 + 0.65 * nDone / NC); await sleep0(); tl = now(); }
    }
  }
  mc.globalCompositeOperation = 'source-in'; mc.drawImage(gcan, 0, 0, MW, MH);        // 글자 속 = 사진 색
  mc.globalCompositeOperation = 'destination-over'; mc.drawImage(dcan, 0, 0, MW, MH); // 글자 사이 = 어둡게 깔린 사진
  mc.globalCompositeOperation = 'source-over';
  tick(1);

  // ── 장면
  const [frame, fx] = K.frameCanvas(L);
  const mask = canvas(VW, VH), mx = mask.getContext('2d');
  mx.imageSmoothingQuality = 'high';
  const groups = Array.from({ length: NW }, () => []);
  function drawNear(v, st) {                                 // 가까이: 보이는 글자만 화면 크기로 바로 그림 (큰 글자도 선명)
    const [vx, vy, vw, vh] = v, sx = VW / vw, sy = VH / vh, fs = sx * FILL, s = fs / REF;
    drawCrop(fx, dcan, vx * gx, vy * gy, vw * gx, vh * gy, VW, VH);
    const r0 = Math.max(0, Math.floor(vy - 0.6)), r1 = Math.min(NR, Math.ceil(vy + vh + 0.6));
    const c0 = Math.max(0, Math.floor(vx - 0.6)), c1 = Math.min(N, Math.ceil(vx + vw + 0.6));
    for (const g of groups) g.length = 0;
    let any = false;
    for (let r = r0; r < r1; r++) for (let q = c0; q < c1; q++) { const j = r * N + q; if (filled(j, st)) { groups[wi[j]].push(j); any = true; } }
    if (!any) return;
    mx.clearRect(0, 0, VW, VH);
    mx.fillStyle = '#fff'; mx.textAlign = 'left'; mx.textBaseline = 'alphabetic';
    for (let w = 0; w < NW; w++) {
      const g = groups[w];
      if (!g.length) continue;
      mx.font = FT.font(w, fs);
      for (const j of g) {
        const r = (j / N) | 0, q = j - r * N, k = kOf(r, q), b = (w * 8 + k) * 2;
        mx.fillText(FT.ch(w, k), (q + 0.5 - vx) * sx - box[b] * s, (r + 0.5 - vy) * sy - box[b + 1] * s);
      }
    }
    mx.globalCompositeOperation = 'source-in';
    drawCrop(mx, gcan, vx * gx, vy * gy, vw * gx, vh * gy, VW, VH);
    mx.globalCompositeOperation = 'source-over';
    fx.drawImage(mask, 0, 0);
  }
  function drawFar(v, st) {                                  // 멀리: 다 그려 둔 판에서 잘라 줄임 · 아직 안 번진 곳은 어두운 사진
    const [vx, vy, vw, vh] = v;
    if (st.R2 >= D2ALL) { drawCrop(fx, master, vx * mcx, vy * mcy, vw * mcx, vh * mcy, VW, VH); return; }
    const sx = VW / vw, sy = VH / vh;
    drawCrop(fx, dcan, vx * gx, vy * gy, vw * gx, vh * gy, VW, VH);
    fx.save(); fx.beginPath();
    const r0 = Math.max(0, Math.floor(vy)), r1 = Math.min(NR, Math.ceil(vy + vh)), R = Math.sqrt(st.R2);
    for (let r = r0; r < r1; r++) {                          // 줄마다 동그라미 안 칸들
      const dy = r + 0.5 - FY, h2 = st.R2 - dy * dy;
      if (h2 < 0) continue;
      const h = Math.sqrt(h2), a = Math.max(0, Math.ceil(FX - h - 0.5)), b = Math.min(N - 1, Math.floor(FX + h - 0.5));
      if (b >= a) fx.rect((a - vx) * sx, (r - vy) * sy, (b - a + 1) * sx, sy);
    }
    if (R >= 0) fx.rect((ca - vx) * sx, (ra - vy) * sy, (cb - ca) * sx, (rb - ra) * sy);   // 첫 화면 (다 채워짐)
    fx.clip();
    drawCrop(fx, master, vx * mcx, vy * mcy, vw * mcx, vh * mcy, VW, VH);
    fx.restore();
  }
  function render(t) {
    const st = state(t), v = t <= TC ? v0 : camU(clamp((t - TC) / DC, 0, 1));
    if (VW / v[2] > mcx * 1.0001 || st.R2 < 0) drawNear(v, st); else drawFar(v, st);
    return frame;
  }
  return {
    T_END, W: VW, H: VH, render,
    reset() {},
    finalFrame: () => render(T_END + 1),
    dispose: () => free(frame, mask, master, gcan, dcan),
    font: FT.kind,
  };
}

// 묶음 글꼴 (letters-kr.woff2 를 굵기 150~900 16개로 고정해 한 파일에 · 굵기 w 글자 k = U+E000 + w*8 + k · OFL, © Adobe, Reserved Font Name 'Source')
const PACK = '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';
