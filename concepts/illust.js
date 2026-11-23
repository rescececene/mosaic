// 인물 일러스트 (11-23): 셀애니(90년대 셀 애니) · 목판화(에도 목판화)
//   승인된 시안 lab/concepts/illust_styles.py 의 ANIME90 · UKIYO 를 옮김 — MediaPipe(Apache-2.0, vendor/mediapipe)로
//   부위(0 배경 · 1 머리 · 2 몸 피부 · 3 얼굴 피부 · 4 옷 · 5 기타)와 얼굴 점 478개를 찾아 부위마다 칠하고, 눈·눈썹·입은 점으로 새로 그림
//   시안은 긴 쪽 1200px 판 → 픽셀 숫자는 긴 쪽/1200 배 (선 굵기는 긴 쪽/1000 배)
//   사람이 없는 사진(풍경)은 장면 전체를 애니 배경 · 목판화로 (배경을 지우지 않음)
//   움직임: 셀애니 = 누른 곳부터 선화 → 부위별 색칠(피부 → 머리 → 옷 → 배경 → 눈·입·볼) · 목판화 = 먹선 판 → 색 판을 하나씩 찍음
const MP = new URL('../vendor/mediapipe/', import.meta.url).href;
const AI_FAIL = '얼굴 AI 파일(약 25MB)을 받지 못했어요. 인터넷 연결을 확인해 주세요.';
const NO_GL = '이 기기에서는 얼굴 AI를 쓸 수 없어요(브라우저의 그래픽 가속이 꺼져 있어요). 다른 모양을 골라 주세요.';
const AI_LABEL = '얼굴 AI 준비하는 중… (처음 한 번 약 25MB)';
const AI_SIZE = 14665716 + 16371837 + 3758596;                 // 받을 파일 크기 합 (진행 막대용)
const T_END = 5.5;
const BG = 0, HAIR = 1, BODY = 2, FACE = 3, CLOTH = 4, OTHER = 5;

// 얼굴 점 번호 (MediaPipe face mesh · illust_base.py 와 같음)
const R_EYE_UP = [33, 246, 161, 160, 159, 158, 157, 173, 133], R_EYE_LO = [33, 7, 163, 144, 145, 153, 154, 155, 133];
const L_EYE_UP = [263, 466, 388, 387, 386, 385, 384, 398, 362], L_EYE_LO = [263, 249, 390, 373, 374, 380, 381, 382, 362];
const R_IRIS = [468, 469, 470, 471, 472], L_IRIS = [473, 474, 475, 476, 477];
const LIPS_OUT = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIPS_IN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const R_BROW = [70, 63, 105, 66, 107], L_BROW = [300, 293, 334, 296, 336], R_BROW_LO = [46, 53, 52, 65, 55], L_BROW_LO = [276, 283, 282, 295, 285];
const NOSE_TIP = 4;

// 스타일 (시안 숫자 그대로)
const CEL = {
  skin: (c) => [0, 1, 2].map((k) => Math.min(255, c[k] * 0.45 + [255, 226, 210][k] * 0.55 + 4)), skinCuts: [16], skinTones: [[0.9, 0.8, 0.82], [1, 1, 1]],
  hair: (c) => c, hairCuts: [30, 90], hairTones: [[0.58, 0], [1, 0], [1, 40]], hairSm: 0.03, hairClean: 0.07,   // 앞머리 얼룩 줄이려고 시안(0.02 · 0.05)보다 조금 넓게
  clothK: 4, lineW: 2.6, lineCol: [52, 32, 30], hairLine: 0.9, clothLine: 0.7, xdogA: 0.75, xdogS: 0.9,
  ink: [45, 28, 26], brow: [70, 45, 38], browA: 0.9, eyeWhite: [250, 248, 246], pupilCol: [25, 15, 12], pupil: 0.42, irisK: 1.08,
  iris: (c) => c.map((v) => v * 0.9), highlights: [[-0.38, -0.38, 0.30, 0.95], [0.33, 0.30, 0.13, 0.9]],
  lidW: 0.10, lidLo: [120, 80, 70], crease: true, nose: [170, 110, 100], mouth: [120, 50, 50],
  lip: (c) => [Math.min(255, c[0] * 1.12 + 8), Math.min(255, c[1] * 0.9 + 8), Math.min(255, c[2] * 0.92 + 8)], blush: 0.35, blushCol: [240, 120, 130],
  teeth: [250, 246, 240], mouthIn: [95, 40, 40],
};
const WOOD = {
  skin: () => [246, 236, 222], skinCuts: [5], skinTones: [[0.97, 0.95, 0.94], [1, 1, 1]],
  hair: () => [24, 24, 30], hairCuts: [92], hairTones: [[1, 0], [1, 25]], hairSm: 0.02, hairClean: 0.05,
  clothK: 3, lineW: 1.8, lineCol: [20, 18, 20], hairLine: 0.55, clothLine: 0.8, xdogA: 0.85, xdogS: 0.8,
  ink: [20, 18, 20], brow: [30, 28, 30], browA: 0.7, eyeWhite: [244, 236, 222], pupilCol: [20, 18, 20], pupil: 0.75, irisK: 0.8,
  iris: () => [30, 28, 30], highlights: [],
  lidW: 0.05, lidLo: [60, 50, 50], crease: false, nose: [120, 90, 80], mouth: [110, 30, 30],
  lip: () => [190, 45, 45], blush: 0.12, blushCol: [230, 150, 140],
  teeth: [248, 242, 230], mouthIn: [70, 25, 25],
};
// 목판화 옛 색: 쪽빛 · 주홍 · 황토 · 풀색 · 먹 · 한지 · 검붉은색 (+ 풍경용 엷은 먹 · 엷은 쪽빛)
const UKI_PAL = [[40, 60, 110], [200, 75, 50], [205, 160, 80], [95, 125, 85], [25, 25, 30], [235, 225, 205], [150, 60, 70]];
const UKI_SCENE = UKI_PAL.concat([[120, 116, 108], [100, 130, 165]]);
const PAPER_W = [238, 226, 200], INDIGO = [45, 70, 120];

// ───────── 얼굴 AI: 파일은 고를 때 미리 받아 두고(브라우저가 저장), AI 는 만들 때만 켰다가 사진을 읽으면 바로 끔
//   11-23: 고르기만 해도 AI 를 켜 두면 다른 모양으로 바꿔도 아이폰 메모리를 붙잡아서 (그려지기 메모리 오류 뒤라 조심)
let aiP = null, aiGot = 0, warmP = null;
const AI_FILES = ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm', 'models/selfie_multiclass_256x256.tflite', 'models/face_landmarker.task'];
async function fetchBytes(url, keep = true) {                  // keep=false: 받기만 하고 버림 (미리 받기)
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  if (!r.body || !r.body.getReader) { const b = new Uint8Array(await r.arrayBuffer()); aiGot += b.length; return keep ? b : null; }
  const rd = r.body.getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; if (keep) parts.push(value); n += value.length; aiGot += value.length; }
  if (!keep) return null;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function loadAI() {
  if (!aiP) aiP = (async () => {
    if (warmP) { await warmP.catch(() => {}); aiGot = 0; }      // 미리 받는 중이면 끝나길 기다림 (두 번 받지 않게) — 그다음은 브라우저 저장본에서 읽음
    const [vision, wasm, segB, lmB] = await Promise.all([import(MP + 'vision_bundle.mjs'), fetchBytes(MP + 'wasm/vision_wasm_internal.wasm'),
      fetchBytes(MP + 'models/selfie_multiclass_256x256.tflite'), fetchBytes(MP + 'models/face_landmarker.task')]);
    const wurl = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));   // 두 AI 가 같은 실행 파일을 한 번만 받게
    const ce = console.error, cw = console.warn, hush = (f) => (...a) => { if (typeof a[0] === 'string' && /^(INFO|WARNING|[IW]\d{4})/.test(a[0])) return; f.apply(console, a); };
    console.error = hush(ce); console.warn = hush(cw);         // AI 안쪽의 알림 글(INFO …)은 오류가 아니라서 숨김 (AI 가 이때 잡은 출력에만 걸림)
    try {
      const files = { wasmLoaderPath: MP + 'wasm/vision_wasm_internal.js', wasmBinaryPath: wurl };
      const seg = await vision.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetBuffer: segB, delegate: 'CPU' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
      const lm = await vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetBuffer: lmB, delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 6 });
      return { seg, lm };
    } finally { URL.revokeObjectURL(wurl); console.error = ce; console.warn = cw; }
  })().catch((e) => { aiP = null; aiGot = 0; throw e; });
  return aiP;
}
export function prefetch() {                                   // 고르면 파일만 미리 받아 둠 (AI 는 안 켬)
  if (!warmP) warmP = Promise.all(AI_FILES.map((f) => fetchBytes(MP + f, false))).then(() => undefined).catch((e) => { warmP = null; throw e; });
  return warmP;
}
function closeAI(ai) { try { ai.seg.close(); } catch (e) { /* */ } try { ai.lm.close(); } catch (e) { /* */ } aiP = null; }   // 다 읽었으면 AI 를 꺼서 메모리를 돌려줌
function hasGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

// ───────── 계산 도구
function gauss(src, w, h, s, K) {                              // 가우스 흐림 (작은 σ 는 진짜 가우스, 큰 σ 는 상자 흐림 세 번)
  if (s < 0.3) return Float32Array.from(src);
  if (s > 3.5) return K.boxBlur(src, w, h, Math.max(1, Math.round((Math.sqrt(1 + 4 * s * s) - 1) / 2)));
  const r = Math.ceil(s * 3), ker = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let k = -r; k <= r; k++) { ker[k + r] = Math.exp(-k * k / (2 * s * s)); sum += ker[k + r]; }
  for (let k = 0; k < ker.length; k++) ker[k] /= sum;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      if (x >= r && x < w - r) for (let k = -r; k <= r; k++) acc += src[o + x + k] * ker[k + r];
      else for (let k = -r; k <= r; k++) { const xx = x + k < 0 ? 0 : x + k >= w ? w - 1 : x + k; acc += src[o + xx] * ker[k + r]; }
      tmp[o + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let k = -r; k <= r; k++) {
      const yy = y + k < 0 ? 0 : y + k >= h ? h - 1 : y + k, wk = ker[k + r], oo = yy * w;
      for (let x = 0; x < w; x++) out[o + x] += tmp[oo + x] * wk;
    }
  }
  return out;
}
function distTo(mask, w, h) {                                 // 가장 가까운 mask 점까지 거리 (3×3 근사)
  const d = new Float32Array(w * h), S2 = Math.SQRT2;
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : 1e9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i]; if (!v) continue;
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    if (y > 0) { v = Math.min(v, d[i - w] + 1); if (x > 0) v = Math.min(v, d[i - w - 1] + S2); if (x < w - 1) v = Math.min(v, d[i - w + 1] + S2); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i]; if (!v) continue;
    if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
    if (y < h - 1) { v = Math.min(v, d[i + w] + 1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + S2); if (x > 0) v = Math.min(v, d[i + w - 1] + S2); }
    d[i] = v;
  }
  return d;
}
function pctOf(hist, n, q) { const tg = q / 100 * (n - 1); let acc = 0; for (let k = 0; k < hist.length; k++) { acc += hist[k]; if (acc > tg) return k; } return hist.length - 1; }
function colorPct(d, sel, q, fb) {                            // 고른 점들의 채널별 q 백분위 색 (sel(i) 가 참인 점)
  const h = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]; let n = 0;
  for (let i = 0, N = d.length / 4; i < N; i++) if (sel(i)) { h[0][d[i * 4]]++; h[1][d[i * 4 + 1]]++; h[2][d[i * 4 + 2]]++; n++; }
  return n ? [0, 1, 2].map((k) => pctOf(h[k], n, q)) : fb;
}
function kmeans(px, n, K, rnd, iters = 20) {                  // px: n×3 · k-means++ 로 시작
  if (n < K * 10) return null;
  const C = new Float32Array(K * 3), D = new Float32Array(n);
  const d2 = (i, k) => { const a = px[i * 3] - C[k * 3], b = px[i * 3 + 1] - C[k * 3 + 1], c = px[i * 3 + 2] - C[k * 3 + 2]; return a * a + b * b + c * c; };
  let f = Math.floor(rnd() * n); C[0] = px[f * 3]; C[1] = px[f * 3 + 1]; C[2] = px[f * 3 + 2];
  for (let i = 0; i < n; i++) D[i] = d2(i, 0);
  for (let k = 1; k < K; k++) {
    let sum = 0; for (let i = 0; i < n; i++) sum += D[i];
    let r = rnd() * sum; f = Math.floor(rnd() * n);
    if (sum > 0) for (let i = 0; i < n; i++) { r -= D[i]; if (r <= 0) { f = i; break; } }
    C[k * 3] = px[f * 3]; C[k * 3 + 1] = px[f * 3 + 1]; C[k * 3 + 2] = px[f * 3 + 2];
    for (let i = 0; i < n; i++) D[i] = Math.min(D[i], d2(i, k));
  }
  const S = new Float64Array(K * 3), cnt = new Float64Array(K);
  for (let it = 0; it < iters; it++) {
    S.fill(0); cnt.fill(0);
    for (let i = 0; i < n; i++) {
      let b = 0, bd = 1e18; for (let k = 0; k < K; k++) { const v = d2(i, k); if (v < bd) { bd = v; b = k; } }
      S[b * 3] += px[i * 3]; S[b * 3 + 1] += px[i * 3 + 1]; S[b * 3 + 2] += px[i * 3 + 2]; cnt[b]++;
    }
    let mv = 0;
    for (let k = 0; k < K; k++) if (cnt[k]) for (let c = 0; c < 3; c++) { const v = S[k * 3 + c] / cnt[k]; mv += Math.abs(v - C[k * 3 + c]); C[k * 3 + c] = v; }
    if (mv < 0.5) break;
  }
  return C;
}
function nearestC(C, K, r, g, b) { let best = 0, bd = 1e18; for (let k = 0; k < K; k++) { const x = r - C[k * 3], y = g - C[k * 3 + 1], z = b - C[k * 3 + 2], v = x * x + y * y + z * z; if (v < bd) { bd = v; best = k; } } return best; }
function modeFilter(lab, w, h, K, r, Kt) {                    // 작은 얼룩 없애기: 이름표마다 상자 흐림 → 가장 많은 것 (255 = 빈 곳, 투표 안 함)
  const best = new Float32Array(w * h).fill(-1), out = new Uint8Array(lab), one = new Float32Array(w * h);
  for (let k = 0; k < K; k++) {
    for (let i = 0; i < w * h; i++) one[i] = lab[i] === k ? 1 : 0;
    const b = Kt.boxBlur(one, w, h, r);
    for (let i = 0; i < w * h; i++) if (lab[i] !== 255 && b[i] > best[i]) { best[i] = b[i]; out[i] = k; }
  }
  return out;
}
function labOf(c) {                                           // sRGB → Lab
  const lin = (v) => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
  const R = lin(c[0]), G = lin(c[1]), B = lin(c[2]), f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B), fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function palPick(c, pal, boost = 1) {                                    // 옛 색 고르기: 밝기 차이는 0.4배만 · 채도가 분명한 색은 무채색(먹·한지)으로 안 보냄 (빨간 옷이 검게 안 되게)
  const [l, a0, b0] = labOf(c), a = a0 * boost, b = b0 * boost, ch = Math.hypot(a, b);   // boost: 풍경은 흐린 덩어리 색이라 채도를 키워서 고름
  let best = 0, bd = 1e18;
  pal.forEach((p, k) => {
    const [pl, pa, pb] = labOf(p);
    if (ch > 22 && Math.hypot(pa, pb) < 12) return;
    const v = (0.4 * (l - pl)) ** 2 + (a - pa) ** 2 + (b - pb) ** 2;
    if (v < bd) { bd = v; best = k; }
  });
  return best;
}
function lineStamp(A, w, h, isEdge, width) {                  // 경계 점마다 동그란 붓 도장 (가운데 진하고 가장자리 1px 부드럽게)
  const R = Math.ceil(width / 2 + 0.5), offs = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const a = Math.min(1, width / 2 - Math.hypot(dx, dy) + 0.5); if (a > 0) offs.push(dx, dy, a); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!isEdge(y * w + x, x, y)) continue;
    for (let k = 0; k < offs.length; k += 3) {
      const xx = x + offs[k], yy = y + offs[k + 1];
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx; if (A[j] < offs[k + 2]) A[j] = offs[k + 2];
    }
  }
}
function xdog(L, w, h, s, K, tau = 0.985, eps = -0.02, phi = 60) {   // 1 = 진한 선
  const g1 = gauss(L, w, h, s, K), g2 = gauss(L, w, h, s * 1.6, K), out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const d = (g1[i] - tau * g2[i]) / 255; out[i] = d >= eps ? 0 : Math.tanh(phi * (eps - d)); }
  return out;
}
function tones(L, w, h, inM, cuts, sm, clean, K) {            // 밝기를 몇 단계로 (경계 매끈 · 작은 얼룩은 다수결로 지움) → 0..cuts.length
  const N = w * h, Ls = gauss(L, w, h, sm, K), hist = new Uint32Array(1024); let n = 0;
  for (let i = 0; i < N; i++) if (inM(i)) { hist[Math.min(1023, Math.max(0, Ls[i] * 4 | 0))]++; n++; }
  const lv = new Uint8Array(N);
  if (!n) return lv;
  const th = cuts.map((q) => (pctOf(hist, n, q) + 0.5) / 4);
  for (const t of th) for (let i = 0; i < N; i++) if (Ls[i] > t) lv[i]++;
  const k = Math.round(clean) | 1;
  if (k < 3) return lv;
  const r = Math.max(1, Math.round((Math.sqrt(1 + 4 * (k * k - 1) / 12) - 1) / 2)), out = new Uint8Array(N), ind = new Float32Array(N);
  for (let j = 1; j <= th.length; j++) {
    for (let i = 0; i < N; i++) ind[i] = lv[i] >= j ? 1 : 0;
    const b = K.boxBlur(ind, w, h, r);
    for (let i = 0; i < N; i++) if (b[i] > 0.5) out[i]++;
  }
  return out;
}
const smoothstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

// ───────── 얼굴 그리기 (Canvas 2D 경로)
const pt = (F, j) => [F[j * 2], F[j * 2 + 1]];
const pts = (F, idx) => idx.map((j) => pt(F, j));
function smoothCurve(P, n = 40) {                             // 점 몇 개 → 매끈한 곡선 (캣멀롬, 시안 smooth_curve 와 같음)
  const m = P.length, Q = [P[0], ...P, P[m - 1]], out = [], steps = Math.max(2, Math.floor(n / (m - 1)));
  for (let i = 1; i < Q.length - 2; i++) {
    const p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(P[m - 1]);
  return out;
}
const rgb = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
function trace(x, P, close) { x.moveTo(P[0][0], P[0][1]); for (let k = 1; k < P.length; k++) x.lineTo(P[k][0], P[k][1]); if (close) x.closePath(); }
function strokeLine(x, P, col, w, a = 1) { x.save(); x.globalAlpha = a; x.strokeStyle = rgb(col); x.lineWidth = Math.max(0.3, w); x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); trace(x, P, false); x.stroke(); x.restore(); }
function fillPath(x, P, col, a = 1) { x.save(); x.globalAlpha = a; x.fillStyle = rgb(col); x.beginPath(); trace(x, P, true); x.fill(); x.restore(); }
const area = (P) => { let s = 0; for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
function inPoly(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function polyColor(d, W, H, P, q, fb) {                       // 다각형 안 사진 색 (채널별 q 백분위)
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
  const h = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]; let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inPoly(P, x + 0.5, y + 0.5)) { const o = (y * W + x) * 4; h[0][d[o]]++; h[1][d[o + 1]]++; h[2][d[o + 2]]++; n++; }
  return n ? [0, 1, 2].map((k) => pctOf(h[k], n, q)) : fb;
}
function faceGeo(F, d, W, H, S) {                             // 얼굴 하나의 모양 (한 번 계산)
  const fw = Math.hypot(F[454 * 2] - F[234 * 2], F[454 * 2 + 1] - F[234 * 2 + 1]), nt = pt(F, NOSE_TIP);
  const eyes = [[R_EYE_UP, R_EYE_LO, R_IRIS], [L_EYE_UP, L_EYE_LO, L_IRIS]].map(([u, l, ir]) => {
    const up = smoothCurve(pts(F, u)), lo = smoothCurve(pts(F, l)), ew = Math.hypot(up[0][0] - up[up.length - 1][0], up[0][1] - up[up.length - 1][1]);
    const ic = pt(F, ir[0]); let r = 0; for (const j of ir.slice(1)) r += Math.hypot(F[j * 2] - ic[0], F[j * 2 + 1] - ic[1]); r = r / 4 * S.irisK;
    const outer = Math.hypot(up[0][0] - nt[0], up[0][1] - nt[1]) > Math.hypot(up[up.length - 1][0] - nt[0], up[up.length - 1][1] - nt[1]);
    const disk = []; for (let k = 0; k < 16; k++) disk.push([ic[0] + Math.cos(k * Math.PI / 8) * r * 0.8, ic[1] + Math.sin(k * Math.PI / 8) * r * 0.8]);
    return { up, lo, ew, ic, r, outer, eye: up.concat(lo.slice().reverse()), icol: S.iris(polyColor(d, W, H, disk, 50, [70, 50, 40])) };
  });
  const brows = [[R_BROW, R_BROW_LO], [L_BROW, L_BROW_LO]].map(([u, l]) => {
    const P = smoothCurve(pts(F, u)).concat(smoothCurve(pts(F, l)).reverse());
    let cx = 0, cy = 0; for (const p of P) { cx += p[0]; cy += p[1]; } cx /= P.length; cy /= P.length;
    return P.map(([x, y]) => [x, cy + (y - cy) * 0.75]);
  });
  const outerP = pts(F, LIPS_OUT), innerP = pts(F, LIPS_IN), lips = smoothCurve(outerP.concat([outerP[0]]), 60);
  const open = area(innerP) > 0.08 * area(outerP) && area(innerP) > (fw * 0.012) ** 2;   // 입을 벌림 (웃는 입)
  const inner = smoothCurve(innerP.concat([innerP[0]]), 60);
  const lumIn = open ? polyColor(d, W, H, innerP, 50, [0, 0, 0]).reduce((s, v, k) => s + v * [0.299, 0.587, 0.114][k], 0) : 0;
  return { fw, nt, eyes, brows, lips, inner, open, teeth: lumIn > 105, mid: smoothCurve(innerP.slice(0, 11), 40), lipc: S.lip(polyColor(d, W, H, outerP, 50, [200, 120, 120])), lo: [F[34] * 0.6 + F[28] * 0.4, F[35] * 0.6 + F[29] * 0.4] };
}
// 그릴 것 고르기: final(셀 끝 그림) · white(목판 흰자) · over(목판 입술) · key(목판 먹선) · sketch(셀 선화)
function drawFace(x, G, S, what) {
  const { fw, nt, eyes, brows } = G;
  const all = what === 'final', key = what === 'key', sk = what === 'sketch';
  if (key) {                                                  // 시안처럼 눈·입은 맨 위 → 그 자리 먹선은 지움
    x.save(); x.globalCompositeOperation = 'destination-out';
    for (const e of eyes) fillPath(x, e.eye, [0, 0, 0]);
    fillPath(x, G.lips, [0, 0, 0]);
    x.restore();
  }
  if (all || key) for (const b of brows) fillPath(x, b, S.brow, S.browA);
  if (sk) for (const b of brows) fillPath(x, b, S.ink, 0.55);
  for (const e of eyes) {
    const { up, lo, ew, ic, r } = e;
    if (all || what === 'white') fillPath(x, e.eye, S.eyeWhite);
    if (all || key || sk) {
      x.save(); x.beginPath(); trace(x, e.eye, true); x.clip();
      if (sk) {
        x.globalAlpha = 0.75; x.strokeStyle = rgb(S.ink); x.lineWidth = Math.max(0.8, ew * 0.02); x.beginPath(); x.arc(ic[0], ic[1], r, 0, Math.PI * 2); x.stroke();
        x.fillStyle = rgb(S.ink); x.beginPath(); x.arc(ic[0], ic[1], r * S.pupil, 0, Math.PI * 2); x.fill();
      } else {
        const gr = x.createLinearGradient(0, ic[1] - r, 0, ic[1] + r);   // 눈동자: 위는 진하게 아래는 밝게
        for (const s of [0, 0.25, 0.5, 0.75, 1]) gr.addColorStop(s, rgb(e.icol.map((v) => Math.min(255, v * (0.55 + 0.6 * s)))));
        x.fillStyle = gr; x.beginPath(); x.arc(ic[0], ic[1], r, 0, Math.PI * 2); x.fill();
        x.fillStyle = rgb(S.pupilCol); x.beginPath(); x.arc(ic[0], ic[1], r * S.pupil, 0, Math.PI * 2); x.fill();
        for (const [ox, oy, rr, a] of S.highlights) { x.fillStyle = `rgba(255,255,255,${a})`; x.beginPath(); x.arc(ic[0] + ox * r, ic[1] + oy * r, r * rr, 0, Math.PI * 2); x.fill(); }
      }
      x.restore();
      // 윗눈꺼풀 굵은 선(가운데 굵게) + 바깥 꼬리 · 아랫눈꺼풀 · 쌍꺼풀
      const n = up.length;
      x.save(); x.strokeStyle = rgb(S.ink); x.lineCap = 'round';
      for (let k = 0; k < n - 1; k++) {
        const t0 = Math.sin(0.15 + (Math.PI - 0.3) * k / (n - 1)) * 0.7 + 0.3, t1 = Math.sin(0.15 + (Math.PI - 0.3) * (k + 1) / (n - 1)) * 0.7 + 0.3;
        x.lineWidth = Math.max(0.5, ew * S.lidW * (t0 + t1) / 2); x.beginPath(); x.moveTo(up[k][0], up[k][1]); x.lineTo(up[k + 1][0], up[k + 1][1]); x.stroke();
      }
      x.restore();
      const o = e.outer ? up[0] : up[n - 1], p1 = e.outer ? up[1] : up[n - 2];
      let tx = o[0] - p1[0], ty = o[1] - p1[1]; const tl = Math.hypot(tx, ty) + 1e-6; tx /= tl; ty /= tl;
      strokeLine(x, [o, [o[0] + tx * ew * 0.12, o[1] + ty * ew * 0.12 - ew * 0.06]], S.ink, ew * S.lidW * 0.6);
      const lp = e.outer ? lo.slice(0, Math.floor(lo.length * 0.7)) : lo.slice(Math.floor(lo.length * 0.3));
      strokeLine(x, lp, sk ? S.ink : S.lidLo, ew * 0.025, sk ? 0.55 : 0.8);
      if (S.crease) {
        const cr = up.map(([a, b]) => [a, b - ew * 0.16]), m = cr.length;
        strokeLine(x, e.outer ? cr.slice(Math.floor(m * 0.25), Math.floor(m * 0.95)) : cr.slice(Math.floor(m * 0.05), Math.floor(m * 0.75)), sk ? S.ink : S.lidLo, ew * 0.02, sk ? 0.45 : 0.6);
      }
    }
  }
  if (all || key || sk) strokeLine(x, [[nt[0] - fw * 0.03, nt[1] + fw * 0.035], [nt[0] + fw * 0.005, nt[1] + fw * 0.045]], sk ? S.ink : S.nose, fw * 0.008, 0.7);
  // 입술: 벌린 입은 입술 띠만 칠하고 안쪽은 이(위가 살짝 어둡게) 또는 어두운 입속 + 가는 테두리
  if (all || what === 'over') {
    x.save(); x.globalAlpha = 0.85; x.fillStyle = rgb(G.lipc); x.beginPath(); trace(x, G.lips, true);
    if (G.open) { trace(x, G.inner, true); x.fill('evenodd'); } else x.fill();
    x.restore();
    if (G.open) {
      let y0 = 1e9, y1 = -1e9; for (const p of G.inner) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      const base = G.teeth ? S.teeth : S.mouthIn, gr = x.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, rgb(base.map((v) => v * 0.8))); gr.addColorStop(0.35, rgb(base)); gr.addColorStop(1, rgb(base.map((v) => v * (G.teeth ? 0.94 : 1))));
      x.save(); x.fillStyle = gr; x.beginPath(); trace(x, G.inner, true); x.fill(); x.restore();
    }
    const lc = G.lo, gr = x.createRadialGradient(0, 0, 0, 0, 0, 1);   // 아랫입술 반짝임
    gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.save(); x.translate(lc[0], lc[1]); x.scale(fw * 0.045, fw * 0.02); x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 1, 0, Math.PI * 2); x.fill(); x.restore();
  }
  if (all || key) {
    strokeLine(x, G.mid, S.mouth, fw * 0.007, 0.9);
    if (G.open) strokeLine(x, G.inner, S.mouth, fw * 0.005, 0.85);
  }
  if (sk) {
    strokeLine(x, G.lips, S.ink, fw * 0.006, 0.8);
    strokeLine(x, G.mid, S.ink, fw * 0.007, 0.9);
    if (G.open) strokeLine(x, G.inner, S.ink, fw * 0.005, 0.7);
  }
}
function blushInto(arr, W, H, G, F, S, K) {                   // 볼 터치 (흐린 타원 · 시안처럼 픽셀로)
  const { fw } = G, A = fw * 0.11, B = fw * 0.06, s = fw * 0.035, col = S.blushCol;
  for (const j of [50, 280]) {
    const cx = F[j * 2], cy = F[j * 2 + 1] + fw * 0.02, m = A + 3 * s;
    const x0 = Math.max(0, Math.floor(cx - m)), x1 = Math.min(W - 1, Math.ceil(cx + m)), y0 = Math.max(0, Math.floor(cy - B - 3 * s)), y1 = Math.min(H - 1, Math.ceil(cy + B + 3 * s));
    const pw = x1 - x0 + 1, ph = y1 - y0 + 1; if (pw < 2 || ph < 2) continue;
    const pm = new Float32Array(pw * ph);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const u = (x + x0 - cx) / A, v = (y + y0 - cy) / B; pm[y * pw + x] = u * u + v * v <= 1 ? 1 : 0; }
    const b = gauss(pm, pw, ph, s, K);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const a = b[y * pw + x] * S.blush; if (a < 0.002) continue;
      const o = ((y + y0) * W + x + x0) * 4;
      for (let c = 0; c < 3; c++) arr[o + c] = arr[o + c] * (1 - a) + col[c] * a;
    }
  }
}

// ───────── 만들기
export async function make(c, K, style) {
  const { L, photo, tr } = c, { now, sleep0, clamp } = K;
  const wood = style === 'woodcut', S = wood ? WOOD : CEL;
  const [frame, fx] = K.frameCanvas(L), W = frame.width, H = frame.height, N = W * H, FS = Math.max(W, H) / 1200, SC = Math.max(W, H) / 1000;
  let last = now(), label = AI_LABEL;
  const pause = async (p, lb) => { if (lb) label = lb; if (lb || now() - last > 0.05) { tr.tick(p, label); await sleep0(); last = now(); } };

  // ① 얼굴 AI (받는 동안 진행 막대)
  tr.tick(0.02, AI_LABEL); await sleep0();
  let ai;
  {
    const p = loadAI(); let done = false;
    p.then(() => { done = true; }, () => { done = true; });
    while (!done) { tr.tick(0.02 + 0.25 * Math.min(1, aiGot / AI_SIZE), AI_LABEL); await new Promise((r) => setTimeout(r, 120)); }
    try { ai = await p; } catch (e) { console.error(e); throw new Error(hasGL() ? AI_FAIL : NO_GL); }
  }
  await pause(0.3, '얼굴과 머리카락 찾는 중…');
  const [Lum, d] = K.grayOf(photo, W, H);
  const ks = Math.min(1, 640 / Math.max(W, H)), sw = Math.max(8, Math.round(W * ks)), sh = Math.max(8, Math.round(H * ks));
  const scv = K.canvas(sw, sh), sx = scv.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(photo, 0, 0, sw, sh);
  let conf = null, mw = sw, mh = sh, faces = [];
  try {
    const r = ai.seg.segment(scv);
    try { const ms = r.confidenceMasks || []; if (ms.length >= 6) { mw = ms[0].width; mh = ms[0].height; conf = ms.slice(0, 6).map((m) => m.getAsFloat32Array().slice()); } }
    finally { r.close(); }
    const fr = ai.lm.detect(photo);
    faces = (fr.faceLandmarks || []).filter((fl) => fl.length >= 478).map((fl) => { const P = new Float32Array(fl.length * 2); for (let j = 0; j < fl.length; j++) { P[j * 2] = fl[j].x * W; P[j * 2 + 1] = fl[j].y * H; } return P; });
  } catch (e) { console.error(e); throw new Error(hasGL() ? '얼굴 AI가 사진을 읽지 못했어요. 다른 사진으로 해 주세요.' : NO_GL); }
  finally { K.free(scv); closeAI(ai); }
  await pause(0.36);

  // ② 부위 지도: 확률을 살짝 흐리고 → 큰 판으로 늘려서 가장 큰 쪽 · 사람에게서 먼 '기타'(소품)는 배경으로
  const cat = new Uint8Array(N);
  if (conf) {
    const ms = mw * mh, sg = 2 * FS * mw / W;
    for (let k = 0; k < 6; k++) conf[k] = gauss(conf[k], mw, mh, sg, K);
    const cs = new Uint8Array(ms), person = new Uint8Array(ms);
    const amax = (i) => { let b = 0, bv = conf[0][i]; for (let k = 1; k < 6; k++) if (conf[k][i] > bv) { bv = conf[k][i]; b = k; } return b; };
    let anyP = false, anyO = false;
    for (let i = 0; i < ms; i++) { const b = amax(i); cs[i] = b; if (b >= 1 && b <= 4) { person[i] = 1; anyP = true; } if (b === OTHER) anyO = true; }
    if (anyP && anyO) {
      const dp = distTo(person, mw, mh), thr = Math.max(mw, mh) * 0.03;
      for (let i = 0; i < ms; i++) if (dp[i] > thr) { conf[BG][i] += conf[OTHER][i]; conf[OTHER][i] = 0; if (cs[i] === OTHER) cs[i] = amax(i); }
    }
    const fxs = mw / W, fys = mh / H;
    for (let y = 0; y < H; y++) {
      let sy = (y + 0.5) * fys - 0.5; sy = sy < 0 ? 0 : sy > mh - 1 ? mh - 1 : sy;
      const y0 = Math.min(mh - 2, sy | 0) < 0 ? 0 : Math.min(mh - 2, sy | 0), ty = sy - y0;
      for (let x = 0; x < W; x++) {
        let sxx = (x + 0.5) * fxs - 0.5; sxx = sxx < 0 ? 0 : sxx > mw - 1 ? mw - 1 : sxx;
        const x0 = Math.max(0, Math.min(mw - 2, sxx | 0)), tx = sxx - x0, i0 = y0 * mw + x0, c0 = cs[i0];
        if (c0 === cs[i0 + 1] && c0 === cs[i0 + mw] && c0 === cs[i0 + mw + 1]) { cat[y * W + x] = c0; continue; }
        let b = 0, bv = -1;
        for (let k = 0; k < 6; k++) { const q = conf[k], v = (q[i0] * (1 - tx) + q[i0 + 1] * tx) * (1 - ty) + (q[i0 + mw] * (1 - tx) + q[i0 + mw + 1] * tx) * ty; if (v > bv) { bv = v; b = k; } }
        cat[y * W + x] = b;
      }
      if ((y & 63) === 63) await pause(0.36 + 0.04 * y / H);
    }
  }
  conf = null;
  const cnt = new Float64Array(6); for (let i = 0; i < N; i++) cnt[cat[i]]++;
  const personN = cnt[HAIR] + cnt[BODY] + cnt[FACE] + cnt[CLOTH];
  const scene = !faces.length && personN < N * 0.03;          // 사람이 없는 사진 → 장면 전체를 그림
  if (scene) cat.fill(BG);
  const geos = faces.map((F) => faceGeo(F, d, W, H, S));
  const fw = geos.length ? Math.max(...geos.map((g) => g.fw)) : Math.max(W, H) / 4;
  await pause(0.4, '그림 그리는 중…');

  // ③ 부위마다 칠하기 → col (RGBA) · 목판화는 판 번호 blk
  const col = new Uint8ClampedArray(N * 4), blk = new Uint8Array(N), rnd = K.mulberry32(7);
  const lineA = new Float32Array(N);                          // 부위 경계선 + 안쪽 결 선 (0~1)
  let clusters = null, nClu = 0;                              // 풍경: 칠 덩어리 번호 (색칠 순서)
  const setC = (i, r, g, b) => { const o = i * 4; col[o] = r; col[o + 1] = g; col[o + 2] = b; col[o + 3] = 255; };
  if (!scene) {
    // 배경
    if (wood) {
      for (let y = 0; y < H; y++) {
        const t = Math.pow(clamp(1 - y / (H * 0.35), 0, 1), 1.5) * 0.85;
        for (let x = 0; x < W; x++) { const i = y * W + x; setC(i, PAPER_W[0] * (1 - t) + INDIGO[0] * t, PAPER_W[1] * (1 - t) + INDIGO[1] * t, PAPER_W[2] * (1 - t) + INDIGO[2] * t); }
      }
    } else await celBg(d, cat, W, H, K, col, pause);
    await pause(0.5);
    // 피부 (얼굴+몸): 기본색 + 그림자 단계 · 목은 턱 밑 그림자
    const isSkin = (i) => cat[i] === FACE || cat[i] === BODY;
    const faceBig = cnt[FACE] > 500 * FS * FS;
    const base = S.skin(colorPct(d, faceBig ? (i) => cat[i] === FACE : isSkin, 55, [220, 180, 160]));
    const lv = tones(Lum, W, H, isSkin, S.skinCuts, fw * 0.03, fw * 0.05, K);
    await pause(0.55);
    let neck = null;
    if (faceBig && cnt[BODY] > 500 * FS * FS) {
      const fm = new Uint8Array(N); for (let i = 0; i < N; i++) fm[i] = cat[i] === FACE ? 1 : 0;
      const df = distTo(fm, W, H), nm = new Float32Array(N);
      for (let i = 0; i < N; i++) nm[i] = cat[i] === BODY && df[i] < fw * 0.12 ? 1 : 0;
      neck = gauss(nm, W, H, 2 * FS, K);
    }
    const t0 = S.skinTones[0];
    for (let i = 0; i < N; i++) {
      if (!isSkin(i)) continue;
      const k = S.skinTones[Math.min(lv[i], S.skinTones.length - 1)], m = cat[i] === BODY ? 0.96 : 1, nw = neck ? neck[i] : 0;
      setC(i, ...[0, 1, 2].map((c2) => base[c2] * k[c2] * m * (1 - nw) + base[c2] * t0[c2] * nw));
    }
    await pause(0.6);
    // 머리: 단계
    const hc = S.hair(colorPct(d, (i) => cat[i] === HAIR, 50, [40, 30, 28]));
    const lvh = tones(Lum, W, H, (i) => cat[i] === HAIR, S.hairCuts, fw * S.hairSm, fw * S.hairClean, K);
    for (let i = 0; i < N; i++) if (cat[i] === HAIR) { const k = S.hairTones[Math.min(lvh[i], S.hairTones.length - 1)]; setC(i, hc[0] * k[0] + k[1], hc[1] * k[0] + k[1], hc[2] * k[0] + k[1]); }
    await pause(0.66);
    // 옷 · 기타: 단색 몇 가지 (목판화는 옛 색으로)
    const sm = [0, 1, 2].map((c2) => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = d[i * 4 + c2]; return K.boxBlur(a, W, H, Math.max(1, Math.round(1.5 * FS))); });
    let nb = 3;
    for (const r of [CLOTH, OTHER]) {
      if (cnt[r] <= 50 * FS * FS) continue;
      const idx = []; for (let i = 0; i < N; i++) if (cat[i] === r) idx.push(i);
      const ns = Math.min(idx.length, 30000), px = new Float32Array(ns * 3);
      for (let k = 0; k < ns; k++) { const i = idx[Math.floor(rnd() * idx.length)]; px[k * 3] = sm[0][i]; px[k * 3 + 1] = sm[1][i]; px[k * 3 + 2] = sm[2][i]; }
      const C = kmeans(px, ns, S.clothK, rnd);
      if (!C) { for (const i of idx) setC(i, d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); continue; }
      const lab = new Uint8Array(N).fill(255);
      for (const i of idx) lab[i] = nearestC(C, S.clothK, sm[0][i], sm[1][i], sm[2][i]);
      const lab2 = modeFilter(lab, W, H, S.clothK, Math.max(1, Math.round(2 * FS)), K);
      const cc = [], bid = [];
      for (let k = 0; k < S.clothK; k++) {
        const c3 = [C[k * 3], C[k * 3 + 1], C[k * 3 + 2]];
        if (wood) { const p = palPick(c3, UKI_PAL); cc.push(UKI_PAL[p]); bid.push(3 + p); } else { cc.push(c3); bid.push(3); }
      }
      for (const i of idx) { const k = lab2[i] === 255 ? lab[i] : lab2[i]; setC(i, ...cc[k]); blk[i] = bid[k]; }
      nb = Math.max(nb, ...bid);
      await pause(0.7);
    }
    for (let i = 0; i < N; i++) { const k = cat[i]; blk[i] = k === BG ? 1 : k === FACE || k === BODY ? 2 : k === HAIR ? 0 : blk[i]; }
    // 선: 부위 경계 + 머리·옷 안쪽 결 (XDoG)
    lineStamp(lineA, W, H, (i, x, y) => (x < W - 1 && cat[i] !== cat[i + 1]) || (y < H - 1 && cat[i] !== cat[i + W]), S.lineW * SC);
    await pause(0.75);
    const xd = xdog(Lum, W, H, S.xdogS * SC, K);
    for (let i = 0; i < N; i++) { const k = cat[i], m = k === HAIR ? S.hairLine : k === CLOTH ? S.clothLine : 0; if (m) lineA[i] = Math.max(lineA[i], Math.min(1, m) * xd[i] * S.xdogA); }
  } else {
    // 풍경: 색을 몇 가지로 나눠 평평하게 (작은 얼룩은 지움) → 셀애니는 애니 배경 · 목판화는 옛 색 판
    const q = 2, bw = Math.ceil(W / q), bh = Math.ceil(H / q), n = bw * bh, R = [new Float32Array(n), new Float32Array(n), new Float32Array(n)], ct = new Float32Array(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, j = ((y / q) | 0) * bw + ((x / q) | 0); R[0][j] += d[i * 4]; R[1][j] += d[i * 4 + 1]; R[2][j] += d[i * 4 + 2]; ct[j]++; }
    for (let j = 0; j < n; j++) for (let c2 = 0; c2 < 3; c2++) R[c2][j] /= ct[j] || 1;
    const Rb = R.map((a) => K.boxBlur(a, bw, bh, 1)), KK = wood ? 7 : 8, ns = Math.min(n, 30000), px = new Float32Array(ns * 3);
    for (let k = 0; k < ns; k++) { const j = Math.floor(rnd() * n); px[k * 3] = Rb[0][j]; px[k * 3 + 1] = Rb[1][j]; px[k * 3 + 2] = Rb[2][j]; }
    const C = kmeans(px, ns, KK, rnd) || new Float32Array(KK * 3).fill(128);
    await pause(0.55);
    let lab = new Uint8Array(n); for (let j = 0; j < n; j++) lab[j] = nearestC(C, KK, Rb[0][j], Rb[1][j], Rb[2][j]);
    lab = modeFilter(lab, bw, bh, KK, Math.max(1, Math.round(2 * FS)), K);
    await pause(0.62);
    // 덩어리 색 · 순서 (밝은 색부터)
    const cols = [], order = [];
    for (let k = 0; k < KK; k++) {
      let c3 = [C[k * 3], C[k * 3 + 1], C[k * 3 + 2]];
      if (wood) c3 = UKI_SCENE[palPick(c3, UKI_SCENE, 1.8)];
      else { const g = (c3[0] + c3[1] + c3[2]) / 3; c3 = c3.map((v) => clamp((g + (v - g) * 1.35) * 0.94 + 18, 0, 255)); }   // 애니 배경: 조금 맑고 밝게
      cols.push(c3); order.push(k);
    }
    order.sort((a, b) => (cols[b][0] + cols[b][1] + cols[b][2]) - (cols[a][0] + cols[a][1] + cols[a][2]));
    const rank = new Uint8Array(KK); order.forEach((k, r) => { rank[k] = r; });
    clusters = new Uint8Array(N); nClu = KK;
    const pIdx = wood ? cols.map((c3) => UKI_SCENE.findIndex((p) => p === c3)) : null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = lab[Math.min(bh - 1, (y / q) | 0) * bw + Math.min(bw - 1, (x / q) | 0)];
      clusters[i] = rank[k];
      let c3 = cols[k];
      if (wood) {
        const pi = pIdx[k];
        if (pi === 5) {                                       // 한지 색: 위쪽은 쪽빛 바림 (하늘)
          const t = Math.pow(clamp(1 - y / (H * 0.35), 0, 1), 1.5) * 0.85;
          c3 = [PAPER_W[0] * (1 - t) + INDIGO[0] * t, PAPER_W[1] * (1 - t) + INDIGO[1] * t, PAPER_W[2] * (1 - t) + INDIGO[2] * t];
          blk[i] = t > 0.01 ? 1 : 0;
        } else blk[i] = pi === 4 ? 0 : 3 + pi;                // 먹색은 먹선 판으로
      }
      setC(i, c3[0], c3[1], c3[2]);
    }
    if (!wood) {                                              // 셀: 경계를 살짝 부드럽게
      for (let c2 = 0; c2 < 3; c2++) { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = col[i * 4 + c2]; const b = gauss(a, W, H, 1.2 * FS, K); for (let i = 0; i < N; i++) col[i * 4 + c2] = b[i]; }
    }
    await pause(0.7);
    // 선: 셀은 부드러운 결 선만 · 목판화는 색 경계 + 굵은 결 선
    const xd = xdog(Lum, W, H, (wood ? 1.0 : 1.1) * SC, K, wood ? 0.98 : 0.985, wood ? -0.012 : -0.02);
    for (let i = 0; i < N; i++) lineA[i] = xd[i] * (wood ? 0.9 : 0.5);
    if (wood) {
      const pk = (i) => (blk[i] === 0 && col[i * 4] < 60 ? 255 : clusters[i]);
      lineStamp(lineA, W, H, (i, x, y) => (x < W - 1 && pk(i) !== pk(i + 1)) || (y < H - 1 && pk(i) !== pk(i + W)), 1.4 * SC);
    }
    await pause(0.75);
  }

  // ④ 층 만들기
  let bx = 0, by = 0, bw2 = 0, bh2 = 0;                       // 얼굴들을 감싼 네모 (얼굴 그림은 이 안에서만)
  if (faces.length) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    faces.forEach((F, k) => { const m = geos[k].fw * 0.2 + 4; for (let j = 0; j < 478; j++) { x0 = Math.min(x0, F[j * 2] - m); y0 = Math.min(y0, F[j * 2 + 1] - m); x1 = Math.max(x1, F[j * 2] + m); y1 = Math.max(y1, F[j * 2 + 1] + m); } });
    bx = clamp(Math.floor(x0), 0, W - 1); by = clamp(Math.floor(y0), 0, H - 1); bw2 = clamp(Math.ceil(x1), bx + 1, W) - bx; bh2 = clamp(Math.ceil(y1), by + 1, H) - by;
  }
  const fcv = faces.length ? K.canvas(bw2, bh2) : null, fcx = fcv ? fcv.getContext('2d', { willReadFrequently: true }) : null;
  const viaCanvas = (arr, draw, clear) => {                   // arr(RGBA 전체) 의 얼굴 네모를 캔버스에 올려 그리고 다시 읽음
    fcx.setTransform(1, 0, 0, 1, 0, 0);
    if (clear) fcx.clearRect(0, 0, bw2, bh2); else fcx.putImageData(new ImageData(arr, W, H), -bx, -by, bx, by, bw2, bh2);
    fcx.setTransform(1, 0, 0, 1, -bx, -by);
    draw(fcx);
    const got = fcx.getImageData(0, 0, bw2, bh2).data;
    return got;
  };
  const putBox = (arr, got, fn) => { for (let y = 0; y < bh2; y++) for (let x = 0; x < bw2; x++) { const o = ((y + by) * W + x + bx) * 4, g = (y * bw2 + x) * 4; fn(o, g); } };
  const fpx = c.focus[0] / L.Wm * W, fpy = c.focus[1] / L.Hm * H;
  let dmax = 1; for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) dmax = Math.max(dmax, Math.hypot(x - fpx, y - fpy));
  const nz = K.smoothNoise(W, H, Math.max(18, Math.round(W / 22)), 51), nz2 = K.smoothNoise(W, H, Math.max(10, Math.round(W / 45)), 52);
  const img = fx.createImageData(W, H), dd = img.data;
  let render;

  if (!wood) {
    // 셀: 선화(종이+선) → 색(M) → 눈·입·볼까지 다 된 그림(F) · 뒤처리(따뜻하게 · 가장자리 어둡게 · 필름 입자)는 장면마다 똑같이
    const LC = S.lineCol, Mc = col;                            // Mc: 색 + 선 (+ 얼굴 선화)
    for (let i = 0; i < N; i++) { const a = lineA[i]; if (a > 0) { const o = i * 4; Mc[o] += (LC[0] - Mc[o]) * a; Mc[o + 1] += (LC[1] - Mc[o + 1]) * a; Mc[o + 2] += (LC[2] - Mc[o + 2]) * a; } }
    const Fc = new Uint8ClampedArray(Mc);
    const Al = new Uint8Array(N); for (let i = 0; i < N; i++) Al[i] = Math.round(Math.min(1, lineA[i]) * 255);
    if (faces.length) {
      faces.forEach((F, k) => blushInto(Fc, W, H, geos[k], F, S, K));
      const got = viaCanvas(Fc, (x) => geos.forEach((G) => drawFace(x, G, S, 'final')));
      putBox(Fc, got, (o, g) => { Fc[o] = got[g]; Fc[o + 1] = got[g + 1]; Fc[o + 2] = got[g + 2]; });
      const sk = viaCanvas(null, (x) => geos.forEach((G) => drawFace(x, G, S, 'sketch')), true);
      putBox(Mc, sk, (o, g) => { const a = sk[g + 3] / 255; if (!a) return; const i = o / 4; Al[i] = Math.max(Al[i], sk[g + 3]); Mc[o] += (LC[0] - Mc[o]) * a; Mc[o + 1] += (LC[1] - Mc[o + 1]) * a; Mc[o + 2] += (LC[2] - Mc[o + 2]) * a; });
    }
    await pause(0.85);
    // 뒤처리 (시안 anime90_post): o·0.95+8 · 따뜻하게 · 가장자리 어둡게 · 입자
    const vx = new Float32Array(W), vy = new Float32Array(H), gr = new Int8Array(N), TN = [1.02, 1, 0.97];
    for (let x = 0; x < W; x++) { const u = (x - W / 2) / (W / 2); vx[x] = -0.1 * u * u; }
    for (let y = 0; y < H; y++) { const u = (y - H / 2) / (H / 2); vy[y] = 1 - 0.1 * u * u; }
    for (let i = 0; i < N; i += 2) { let u = rnd(); if (u < 1e-9) u = 1e-9; const r0 = Math.sqrt(-2 * Math.log(u)) * 4, th = 2 * Math.PI * rnd(); gr[i] = clamp(Math.round(r0 * Math.cos(th)), -127, 127); if (i + 1 < N) gr[i + 1] = clamp(Math.round(r0 * Math.sin(th)), -127, 127); }
    const post = (A) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, o = i * 4, v = vx[x] + vy[y], g = gr[i]; for (let c2 = 0; c2 < 3; c2++) A[o + c2] = (A[o + c2] * 0.95 + 8) * TN[c2] * v + g; A[o + 3] = 255; } };
    post(Mc); post(Fc);
    // 보이는 시각 (1/40초 단위): 선 = 누른 곳부터 얼룩지게 · 색 = 피부 → 머리 → 옷 → 배경 (부위마다 누른 곳부터) → 눈·입·볼
    const tl = new Uint8Array(N), tc = new Uint8Array(N), td = new Uint8Array(N);
    const grp = (i) => (scene ? 0 : cat[i] === FACE || cat[i] === BODY ? 0 : cat[i] === HAIR ? 1 : cat[i] === BG ? 3 : 2);
    const gmax = new Float32Array(4).fill(1);
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const g = grp(y * W + x), dd2 = Math.hypot(x - fpx, y - fpy); if (dd2 > gmax[g]) gmax[g] = dd2; }
    const ST = [2.0, 2.6, 3.2, 3.8];
    let fmax = 1; if (faces.length) for (const [x, y] of [[bx, by], [bx + bw2, by], [bx, by + bh2], [bx + bw2, by + bh2]]) fmax = Math.max(fmax, Math.hypot(x - fpx, y - fpy));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, dist = Math.hypot(x - fpx, y - fpy), dn = Math.pow(dist / dmax, 0.8);
      tl[i] = Math.round((0.15 + 1.7 * (0.75 * dn + 0.25 * nz[i])) * 40);
      if (scene) tc[i] = Math.round((2.0 + 2.8 * (0.5 * dn + 0.35 * clusters[i] / Math.max(1, nClu - 1) + 0.15 * nz2[i])) * 40);
      else { const g = grp(i); tc[i] = Math.round((ST[g] + 0.75 * (0.8 * Math.min(1, dist / gmax[g]) + 0.2 * nz[i])) * 40); }
      td[i] = Math.round((4.5 + 0.35 * Math.min(1, dist / fmax) + 0.05 * nz2[i]) * 40);
    }
    await pause(0.95);
    const PAP = [250, 248, 243], P0 = [0, 1, 2].map((c2) => (PAP[c2] * 0.95 + 8) * TN[c2]), D0 = [0, 1, 2].map((c2) => (LC[c2] - PAP[c2]) * 0.95 * TN[c2]);
    const LF = 0.3, CF = 0.3;
    let doneFinal = false;
    render = (t) => {
      if (t >= T_END) { if (!doneFinal) { dd.set(Fc); doneFinal = true; } fx.putImageData(img, 0, 0); return frame; }
      doneFinal = false;
      const T = t * 40, lf = 1 / (LF * 40), cf = 1 / (CF * 40);
      for (let y = 0; y < H; y++) {
        const vrow = vy[y];
        for (let x = 0; x < W; x++) {
          const i = y * W + x, o = i * 4, v = vx[x] + vrow, g = gr[i];
          let la = (T - tl[i]) * lf; la = la < 0 ? 0 : la > 1 ? 1 : la;
          let ka = (T - tc[i]) * cf; ka = ka < 0 ? 0 : ka > 1 ? 1 : ka;
          let kd = (T - td[i]) * cf; kd = kd < 0 ? 0 : kd > 1 ? 1 : kd;
          const a = Al[i] / 255 * la;
          for (let c2 = 0; c2 < 3; c2++) {
            const s = (P0[c2] + D0[c2] * a) * v + g, m = s + (Mc[o + c2] - s) * ka;
            dd[o + c2] = m + (Fc[o + c2] - m) * kd;
          }
          dd[o + 3] = 255;
        }
      }
      fx.putImageData(img, 0, 0);
      return frame;
    };
  } else {
    // 목판화: 한지 → 먹선 판(선 · 머리 · 눈·눈썹·입 선) → 색 판 하나씩(배경 바림 → 피부 → 옷 색마다 → 입술·볼) · 한지 결은 늘 보임
    const KC = new Uint8ClampedArray(N * 4), LC = S.lineCol;
    for (let i = 0; i < N; i++) {
      const o = i * 4, a = Math.min(1, lineA[i]);
      if ((!scene && cat[i] === HAIR) || (scene && blk[i] === 0 && col[o] < 60)) { KC[o] = col[o] + (LC[0] - col[o]) * a; KC[o + 1] = col[o + 1] + (LC[1] - col[o + 1]) * a; KC[o + 2] = col[o + 2] + (LC[2] - col[o + 2]) * a; KC[o + 3] = 255; }
      else if (a > 0) { KC[o] = LC[0]; KC[o + 1] = LC[1]; KC[o + 2] = LC[2]; KC[o + 3] = Math.round(a * 255); }
    }
    const C2 = new Uint8ClampedArray(col), ov = new Uint8Array(N);
    if (faces.length) {
      const g1 = viaCanvas(col, (x) => geos.forEach((G) => drawFace(x, G, S, 'white')));
      putBox(col, g1, (o, g) => { col[o] = g1[g]; col[o + 1] = g1[g + 1]; col[o + 2] = g1[g + 2]; });
      C2.set(col);
      faces.forEach((F, k) => blushInto(C2, W, H, geos[k], F, S, K));
      const g2 = viaCanvas(C2, (x) => geos.forEach((G) => drawFace(x, G, S, 'over')));
      putBox(C2, g2, (o, g) => { C2[o] = g2[g]; C2[o + 1] = g2[g + 1]; C2[o + 2] = g2[g + 2]; });
      for (let y = by; y < by + bh2; y++) for (let x = bx; x < bx + bw2; x++) { const i = y * W + x, o = i * 4; if (Math.abs(C2[o] - col[o]) + Math.abs(C2[o + 1] - col[o + 1]) + Math.abs(C2[o + 2] - col[o + 2]) > 3) ov[i] = 1; }
      const g3 = viaCanvas(KC, (x) => geos.forEach((G) => drawFace(x, G, S, 'key')));
      putBox(KC, g3, (o, g) => { KC[o] = g3[g]; KC[o + 1] = g3[g + 1]; KC[o + 2] = g3[g + 2]; KC[o + 3] = g3[g + 3]; });
    }
    await pause(0.85);
    // 한지 결: 고운 얼룩 + 큰 얼룩 + 섬유 점 (시안 washi)
    const wa = new Int8Array(N), n1 = K.smoothNoise(W, H, Math.max(2, Math.round(2 * FS)), 61), n2 = K.smoothNoise(W, H, Math.max(20, Math.round(40 * FS)), 62);
    for (let i = 0; i < N; i++) wa[i] = Math.round((n1[i] - 0.5) * 7 + (n2[i] - 0.5) * 9);
    const nf = Math.round(N * 0.0012), fr2 = Math.max(1, 1.2 * FS);
    for (let k = 0; k < nf; k++) {
      const cx = rnd() * W, cy = rnd() * H;
      for (let y = Math.max(0, Math.floor(cy - fr2 - 1)); y <= Math.min(H - 1, Math.ceil(cy + fr2 + 1)); y++) for (let x = Math.max(0, Math.floor(cx - fr2 - 1)); x <= Math.min(W - 1, Math.ceil(cx + fr2 + 1)); x++) {
        const a = clamp(fr2 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5, 0, 1); if (a > 0) wa[y * W + x] = clamp(wa[y * W + x] - Math.round(12 * a), -127, 127);
      }
    }
    const nz3 = K.smoothNoise(W, H, Math.max(3, Math.round(W / 220)), 53), pn = new Uint8Array(N); for (let i = 0; i < N; i++) pn[i] = Math.round(clamp(0.7 * nz3[i] + 0.3 * rnd(), 0, 1) * 255);   // 찍을 때 먹이 고르지 않게 묻는 결
    // 찍는 순서와 시각
    const ids = [...new Set(blk)].filter((b) => b > 0).sort((a, b) => a - b);
    const hasOv = ov.some((v) => v);
    const seq = ids.slice(); if (hasOv) seq.push(-1);           // -1 = 입술·볼
    const FD = 0.28, OD = 0.42, K0 = 0.3, S0 = 1.15, step = seq.length > 1 ? Math.min(0.95, (4.75 - S0) / (seq.length - 1)) : 0;
    const R0 = 4 * SC;
    const mk = (t0, k) => { const a = rnd() * Math.PI * 2; return { t0, ox: Math.cos(a) * R0, oy: Math.sin(a) * R0 }; };
    const keyB = mk(K0, 0), plates = new Map(); seq.forEach((b, k) => plates.set(b, mk(S0 + step * k, k)));
    const stateOf = (p, t) => { const f = clamp((t - p.t0) / FD, 0, 1), e = easeOut(clamp((t - p.t0) / OD, 0, 1)); return { f, ox: Math.round(p.ox * (1 - e)), oy: Math.round(p.oy * (1 - e)), done: t >= p.t0 + OD, on: t > p.t0 }; };
    const PW = PAPER_W, TN = [1, 0.98, 0.93];
    let doneFinal = false;
    render = (t) => {
      const tt = t >= T_END ? 99 : t;
      if (tt === 99 && doneFinal) { fx.putImageData(img, 0, 0); return frame; }
      doneFinal = tt === 99;
      const done = new Uint8Array(256), act = [];
      for (const [b, p] of plates) { const s = stateOf(p, tt); if (b < 0) continue; if (s.done) done[b] = 1; else if (s.on) act.push({ b, ...s }); }
      const os = hasOv ? stateOf(plates.get(-1), tt) : null, ks2 = stateOf(keyB, tt);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, o = i * 4;
        let r = PW[0], g = PW[1], b = PW[2];
        const bi = blk[i];
        if (bi && done[bi]) { r = col[o]; g = col[o + 1]; b = col[o + 2]; }
        for (let k = 0; k < act.length; k++) {
          const A = act[k], xx = x - A.ox, yy = y - A.oy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx; if (blk[j] !== A.b) continue;
          let f = (A.f - 0.5 * pn[j] / 255) / 0.5; f = f < 0 ? 0 : f > 1 ? 1 : f;
          const q = j * 4; r += (col[q] - r) * f; g += (col[q + 1] - g) * f; b += (col[q + 2] - b) * f;
        }
        if (os && os.on) {
          if (os.done) { if (ov[i]) { r = C2[o]; g = C2[o + 1]; b = C2[o + 2]; } }
          else { const xx = x - os.ox, yy = y - os.oy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { const j = yy * W + xx; if (ov[j]) { let f = (os.f - 0.5 * pn[j] / 255) / 0.5; f = f < 0 ? 0 : f > 1 ? 1 : f; const q = j * 4; r += (C2[q] - r) * f; g += (C2[q + 1] - g) * f; b += (C2[q + 2] - b) * f; } } }
        }
        if (ks2.on) {
          let j = i, f = 1;
          if (!ks2.done) { const xx = x - ks2.ox, yy = y - ks2.oy; j = xx >= 0 && yy >= 0 && xx < W && yy < H ? yy * W + xx : -1; f = ks2.f; }
          if (j >= 0) {
            const q = j * 4; let a = KC[q + 3] / 255;
            if (a > 0) { if (f < 1) { let ff = (f - 0.5 * pn[j] / 255) / 0.5; ff = ff < 0 ? 0 : ff > 1 ? 1 : ff; a *= ff; } r += (KC[q] - r) * a; g += (KC[q + 1] - g) * a; b += (KC[q + 2] - b) * a; }
          }
        }
        const w = wa[i];
        dd[o] = (r + w) * TN[0]; dd[o + 1] = (g + w) * TN[1]; dd[o + 2] = (b + w) * TN[2]; dd[o + 3] = 255;
      }
      fx.putImageData(img, 0, 0);
      return frame;
    };
  }
  K.free(fcv);
  tr.tick(1); await sleep0();
  return { T_END, render, reset() { /* 장면마다 처음부터 계산 */ }, finalFrame: () => render(T_END + 1), dispose: () => K.free(frame) };
}

// 셀 배경 (사람이 있을 때): 사람을 빼고 크게 흐린 뒤 3~4가지 색으로 · 작은 섬은 합침 · 조금 밝고 엷게 (사람이 돋보이게)
async function celBg(d, cat, W, H, K, col, pause) {
  const q = 4, bw = Math.max(8, Math.ceil(W / q)), bh = Math.max(8, Math.ceil(H / q)), n = bw * bh;
  const R = [new Float32Array(n), new Float32Array(n), new Float32Array(n)], M = new Float32Array(n), ct = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, j = Math.min(bh - 1, (y / q) | 0) * bw + Math.min(bw - 1, (x / q) | 0), m = cat[i] === BG ? 1 : 0;
    R[0][j] += d[i * 4] * m; R[1][j] += d[i * 4 + 1] * m; R[2][j] += d[i * 4 + 2] * m; M[j] += m; ct[j]++;
  }
  let gm = [0, 0, 0], gn = 0;
  for (let j = 0; j < n; j++) { gm[0] += R[0][j]; gm[1] += R[1][j]; gm[2] += R[2][j]; gn += M[j]; M[j] /= ct[j] || 1; for (let c2 = 0; c2 < 3; c2++) R[c2][j] /= ct[j] || 1; }
  gm = gn ? gm.map((v) => v / gn) : [200, 195, 190];
  const r = Math.max(1, Math.round(Math.max(W, H) / 40 / q)), mb = K.boxBlur(M, bw, bh, r), Rb = R.map((a) => K.boxBlur(a, bw, bh, r));
  const E = 0.02, C3 = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let j = 0; j < n; j++) for (let c2 = 0; c2 < 3; c2++) C3[c2][j] = (Rb[c2][j] + E * gm[c2]) / (mb[j] + E);
  await pause(0.45);
  const rnd = K.mulberry32(11), idx = []; for (let j = 0; j < n; j++) if (M[j] > 0.5) idx.push(j);
  const pool = idx.length > 50 ? idx : Array.from({ length: n }, (_, j) => j), KK = pool.length > n * 0.25 ? 4 : 3;
  const ns = Math.min(pool.length, 20000), px = new Float32Array(ns * 3);
  for (let k = 0; k < ns; k++) { const j = pool[Math.floor(rnd() * pool.length)]; px[k * 3] = C3[0][j]; px[k * 3 + 1] = C3[1][j]; px[k * 3 + 2] = C3[2][j]; }
  const C = kmeans(px, ns, KK, rnd);
  let lab = new Uint8Array(n); if (C) for (let j = 0; j < n; j++) lab[j] = nearestC(C, KK, C3[0][j], C3[1][j], C3[2][j]);
  if (C) { lab = modeFilter(lab, bw, bh, KK, Math.max(2, Math.round(Math.max(bw, bh) / 30)), K); lab = modeFilter(lab, bw, bh, KK, Math.max(2, Math.round(Math.max(bw, bh) / 30)), K); }
  const out = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let j = 0; j < n; j++) {
    let c3 = C ? [C[lab[j] * 3], C[lab[j] * 3 + 1], C[lab[j] * 3 + 2]] : [C3[0][j], C3[1][j], C3[2][j]];
    const g = (c3[0] + c3[1] + c3[2]) / 3; c3 = c3.map((v) => (g + (v - g) * 0.6) * 0.86 + 255 * 0.14);
    out[0][j] = c3[0]; out[1][j] = c3[1]; out[2][j] = c3[2];
  }
  const so = out.map((a) => K.boxBlur(a, bw, bh, Math.max(1, Math.round(Math.max(W, H) / 300 / q))));
  for (let y = 0; y < H; y++) {
    let sy = (y + 0.5) / q - 0.5; sy = sy < 0 ? 0 : sy > bh - 1 ? bh - 1 : sy; const y0 = Math.min(bh - 2, sy | 0), ty = sy - y0;
    for (let x = 0; x < W; x++) {
      let sx = (x + 0.5) / q - 0.5; sx = sx < 0 ? 0 : sx > bw - 1 ? bw - 1 : sx; const x0 = Math.min(bw - 2, sx | 0), tx = sx - x0, j = y0 * bw + x0, o = (y * W + x) * 4;
      for (let c2 = 0; c2 < 3; c2++) { const a = so[c2]; col[o + c2] = (a[j] * (1 - tx) + a[j + 1] * tx) * (1 - ty) + (a[j + bw] * (1 - tx) + a[j + bw + 1] * tx) * ty; }
      col[o + 3] = 255;
    }
  }
}
