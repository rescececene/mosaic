// 큐브 모자이크 (11-23, lab/concepts/concepts.py 의 cube_mosaic 를 옮김): 3×3 스티커 큐브 6색으로 사진을 그림
//   밝기 6단계 → 파랑 · 빨강 · 초록 · 주황 · 노랑 · 흰색 (큐브 초상화에서 흔히 쓰는 순서) · 점 퍼뜨리기는 약하게
//   뒤섞인 큐브가 얼굴부터 하나씩 맞춰짐 · 뒤섞인 큐브는 몇 장마다 한 줄씩 돌아감
//   스티커 · 틈을 모두 4픽셀 칸에 맞춰 그림 → WebP 가 4×4 칸 단위로 압축해서 장면이 아주 가벼워짐 (안 맞추면 2배 넘게 무거워 화질이 0.4대로 떨어짐)
//   그래서 움짤 크기(W·H)는 기본 화면 크기에 가장 가까운 '4의 배수 판'으로 스스로 정함
export async function make(c, K) {
  const { L, photo, tr } = c, { VW, VH } = L, F = K.CFG.FPS, LABEL = '큐브 색 맞추는 중…';
  tr.tick(0, LABEL);
  const PAL = [[245, 245, 245], [255, 213, 0], [196, 30, 58], [255, 88, 0], [0, 81, 186], [0, 158, 96]];   // 흰 · 노랑 · 빨강 · 주황 · 파랑 · 초록
  const ORDER = [4, 2, 5, 3, 1, 0];                      // 어두운 쪽부터
  const BODY = [34, 34, 38], SEAM = [3, 3, 4];           // 큐브 몸통(스티커 사이) · 큐브와 큐브 사이 이음매
  // 판: 큐브 가로 26개 · 세로는 화면 비율대로 (큐브 통째로만) · 너무 길쭉한 사진은 가운데를 잘라 씀
  const CX = 26, CY = K.clamp(Math.round(CX * VH / VW), 9, 52), NX = CX * 3, NY = CY * 3, NC = CX * CY;
  const G = 4, GC = 4;                                    // 스티커 사이 틈 · 큐브 사이 이음매 (4픽셀)
  const sizeOf = (s) => [CX * (3 * s + 2 * G) + (CX + 1) * GC, CY * (3 * s + 2 * G) + (CY + 1) * GC];
  let S = 8;                                              // 스티커 크기 (4의 배수) — 판 가로가 기본 화면 가로에 가장 가깝게
  for (let s = 12; s <= 40; s += 4) {
    const [w, h] = sizeOf(s);
    if (w > 4000 || h > 4000 || w * h > 12e6) break;
    if (Math.abs(Math.log(w / VW)) < Math.abs(Math.log(sizeOf(S)[0] / VW))) S = s;
  }
  const [W, H] = sizeOf(S), CORE = 3 * S + 2 * G;
  const posX = new Int32Array(NX), posY = new Int32Array(NY);   // 스티커 왼쪽 위 (모두 4의 배수)
  for (let b = 0; b < CX; b++) for (let k = 0; k < 3; k++) posX[b * 3 + k] = GC + b * (CORE + GC) + k * (S + G);
  for (let b = 0; b < CY; b++) for (let k = 0; k < 3; k++) posY[b * 3 + k] = GC + b * (CORE + GC) + k * (S + G);

  // 사진 → 스티커마다 밝기: 큐브 판 비율로 가운데를 잘라 4배 크기로 그린 뒤 4×4 평균
  const pw = photo.width, ph = photo.height, ar = CX / CY;
  let sx = 0, sy = 0, sw = pw, sh = ph;
  if (pw / ph > ar) { sw = Math.max(1, Math.min(pw, Math.round(ph * ar))); sx = Math.floor((pw - sw) / 2); }
  else { sh = Math.max(1, Math.min(ph, Math.round(pw / ar))); sy = Math.floor((ph - sh) / 2); }
  const U = 4, gw = NX * U, gh = NY * U, cv = K.canvas(gw, gh), cvx = cv.getContext('2d', { willReadFrequently: true });
  cvx.imageSmoothingQuality = 'high'; cvx.drawImage(photo, sx, sy, sw, sh, 0, 0, gw, gh);
  const d = cvx.getImageData(0, 0, gw, gh).data; K.free(cv);
  const Y = new Float32Array(gw * gh), hist = new Float64Array(256);
  for (let i = 0; i < gw * gh; i++) { const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; Y[i] = v; hist[Math.min(255, Math.round(v))]++; }
  let lo = 0, hi = 255;                                   // 대비 늘이기: 어두운 쪽 · 밝은 쪽 1% 씩 잘라냄 (PIL autocontrast cutoff=1)
  { const cut = gw * gh * 0.01; let s = 0; for (lo = 0; lo < 255; lo++) { s += hist[lo]; if (s > cut) break; } s = 0; for (hi = 255; hi > 0; hi--) { s += hist[hi]; if (s > cut) break; } }
  const sc = hi > lo ? 1 / (hi - lo) : 1 / 255, off = hi > lo ? lo : 0;
  const g = new Float32Array(NX * NY);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    let s = 0;
    for (let v = 0; v < U; v++) { const o = (y * U + v) * gw + x * U; for (let u = 0; u < U; u++) s += K.clamp((Y[o + u] - off) * sc, 0, 1); }
    g[y * NX + x] = K.clamp((s / (U * U) - 0.5) * 1.15 + 0.5, 0, 1);   // 대비 조금 더
  }
  tr.tick(0.3, LABEL); await K.sleep0();
  // 밝기만 6단계로 점 퍼뜨리기 (플로이드–스타인버그, 오차는 0.75배만)
  const lab = new Uint8Array(NX * NY);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const i = y * NX + x, old = g[i], k = K.clamp(Math.round(old * 5), 0, 5), err = (old - k / 5) * 0.75;
    lab[i] = ORDER[k];
    if (x + 1 < NX) g[i + 1] += err * 7 / 16;
    if (y + 1 < NY) { if (x > 0) g[i + NX - 1] += err * 3 / 16; g[i + NX] += err * 5 / 16; if (x + 1 < NX) g[i + NX + 1] += err / 16; }
  }
  tr.tick(0.6, LABEL); await K.sleep0();

  // 큐브마다 맞춰지는 시각: 얼굴(누른 곳)에서 멀수록 늦게 + 조금 흔들림
  const rnd = K.mulberry32(26), S0 = 0.2, S1 = 4.6, T_END = 5.0;
  const fcx = K.clamp((c.focus[0] / L.Wm * pw - sx) / sw * CX, 0, CX), fcy = K.clamp((c.focus[1] / L.Hm * ph - sy) / sh * CY, 0, CY);
  let dmax = 1; for (const [x, y] of [[0, 0], [CX, 0], [0, CY], [CX, CY]]) dmax = Math.max(dmax, Math.hypot(x - fcx, y - fcy));
  const raw = new Float32Array(NC), tau = new Float32Array(NC);
  for (let b = 0; b < NC; b++) raw[b] = 0.86 * Math.hypot((b % CX) + 0.5 - fcx, ((b / CX) | 0) + 0.5 - fcy) / dmax + 0.14 * rnd();
  const rk = Array.from({ length: NC }, (_, i) => i).sort((a, b) => raw[a] - raw[b]), rmax = raw[rk[NC - 1]] || 1;
  rk.forEach((b, r) => { tau[b] = S0 + (S1 - S0) * (0.45 * raw[b] / rmax + 0.55 * r / Math.max(1, NC - 1)); });   // 거리 반 + 순서 반 → 처음부터 끝까지 고르게 맞춰짐
  // 뒤섞인 색: 처음 색 + 큐브마다 2~4장에 한 번씩 한 줄(가로 또는 세로 3칸)이 돌아가며 바뀜 — 미리 정해 둠 (어느 시각이든 같은 그림)
  const scr0 = new Uint8Array(NX * NY); for (let i = 0; i < scr0.length; i++) scr0[i] = Math.floor(rnd() * 6);
  const evs = [];
  for (let b = 0; b < NC; b++) {
    const fEnd = tau[b] * F;
    for (let f = 1 + Math.floor(rnd() * 3); f < fEnd; f += 2 + Math.floor(rnd() * 3)) evs.push([f, b, Math.floor(rnd() * 6), Math.floor(rnd() * 216)]);
  }
  evs.sort((a, b) => a[0] - b[0]);
  const nEv = evs.length, evF = new Int32Array(nEv), evB = new Int32Array(nEv), evL = new Uint8Array(nEv), evC = new Uint8Array(nEv);
  evs.forEach((e, i) => { evF[i] = e[0]; evB[i] = e[1]; evL[i] = e[2]; evC[i] = e[3]; });
  tr.tick(0.8, LABEL); await K.sleep0();

  // 스티커 그림 6색 (픽셀을 직접 찍어 정확히 4픽셀 칸에 맞춤)
  const spr = PAL.map((col) => {
    const s = K.canvas(S, S), x = s.getContext('2d'), im = x.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { im.data[i * 4] = col[0]; im.data[i * 4 + 1] = col[1]; im.data[i * 4 + 2] = col[2]; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0);
    return s;
  });
  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  const frame = K.canvas(W, H), fx = frame.getContext('2d', { alpha: false });
  const scr = new Uint8Array(NX * NY), drawn = new Uint8Array(NX * NY);
  let ep = 0, scrF = -1;
  function reset() {
    fx.fillStyle = rgb(SEAM); fx.fillRect(0, 0, W, H);
    fx.fillStyle = rgb(BODY);
    for (let by = 0; by < CY; by++) for (let bx = 0; bx < CX; bx++) fx.fillRect(posX[bx * 3], posY[by * 3], CORE, CORE);
    drawn.fill(255); scr.set(scr0); ep = 0; scrF = -1;
  }
  function render(t) {
    const f = Math.floor(t * F + 1e-6);
    if (f < scrF) { scr.set(scr0); ep = 0; }               // 앞 시각으로 돌아가면 처음부터 다시 돌림
    for (; ep < nEv && evF[ep] <= f; ep++) {               // 한 줄 돌리기: 0~2 = 가로줄 · 3~5 = 세로줄
      const b = evB[ep], l = evL[ep], cc = evC[ep], x0 = (b % CX) * 3, y0 = ((b / CX) | 0) * 3, col = [cc % 6, ((cc / 6) | 0) % 6, (cc / 36) | 0];
      for (let k = 0; k < 3; k++) scr[l < 3 ? (y0 + l) * NX + x0 + k : (y0 + k) * NX + x0 + l - 3] = col[k];
    }
    scrF = f;
    for (let b = 0; b < NC; b++) {                         // 바뀐 스티커만 다시 그림
      const src = tau[b] <= t ? lab : scr, x0 = (b % CX) * 3, y0 = ((b / CX) | 0) * 3;
      for (let v = 0; v < 3; v++) for (let u = 0; u < 3; u++) {
        const i = (y0 + v) * NX + x0 + u, k = src[i];
        if (drawn[i] !== k) { drawn[i] = k; fx.drawImage(spr[k], posX[x0 + u], posY[y0 + v]); }
      }
    }
    return frame;
  }
  reset();
  tr.tick(1, LABEL);
  return { T_END, render, reset, finalFrame: () => render(T_END + 1), dispose: () => K.free(frame, ...spr), W, H };
}
