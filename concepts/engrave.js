// 동판화 (11-23): 지폐 초상화처럼 물결치는 평행선 — 어두울수록 선이 굵고, 가장 어두운 곳만 엇갈린 선이 하나 더
//   승인된 시안 lab/concepts/concepts.py 의 engrave() 그대로 · 시안은 1000px 판이라 픽셀 숫자는 모두 s(= 짧은 변 / 1000)배
//   움직임: 위 줄부터 차례로, 줄마다 왼쪽 → 오른쪽으로 새겨짐 · 계산은 처음 한 번, 장면마다 새로 드러난 점만 칠함
const PAPER = [247, 244, 236], INK = [24, 34, 40], LABEL = '판화 선 계산하는 중…';
const T_END = 5;                                              // 움직이는 시간 (끝 멈춤은 app.js 가 붙임)
const QN = 2048;                                              // 드러나는 시각을 2048 조각으로 나눠 줄 세움

function autoLut(h, n) {                                      // 1% 잘라 늘리기 (PIL ImageOps.autocontrast(cutoff=1) 과 같음)
  const hh = Int32Array.from(h), lut = new Uint8Array(256);
  let cut = Math.floor(n / 100);
  for (let k = 0; k < 256 && cut > 0; k++) { const t = Math.min(cut, hh[k]); hh[k] -= t; cut -= t; }
  cut = Math.floor(n / 100);
  for (let k = 255; k >= 0 && cut > 0; k--) { const t = Math.min(cut, hh[k]); hh[k] -= t; cut -= t; }
  let lo = 0, hi = 255;
  while (lo < 256 && !hh[lo]) lo++;
  while (hi >= 0 && !hh[hi]) hi--;
  for (let k = 0; k < 256; k++) lut[k] = hi <= lo ? k : Math.min(255, Math.max(0, Math.trunc((k - lo) * 255 / (hi - lo))));
  return lut;
}
function eqLut(h) {                                           // 고르게 펴기 (PIL ImageOps.equalize 와 같음)
  const lut = new Uint8Array(256);
  let sum = 0, lastNz = 0, nz = 0;
  for (let k = 0; k < 256; k++) if (h[k]) { sum += h[k]; lastNz = h[k]; nz++; }
  const step = Math.floor((sum - lastNz) / 255);
  if (nz <= 1 || !step) { for (let k = 0; k < 256; k++) lut[k] = k; return lut; }
  let n = Math.floor(step / 2);
  for (let k = 0; k < 256; k++) { lut[k] = Math.min(255, Math.floor(n / step)); n += h[k]; }
  return lut;
}
// 선 하나가 한 점을 덮는 정도 (hw = 선 반폭 · dd = 선 가운데까지 거리, 둘 다 픽셀) — 가장자리만 1px 부드럽게 (계단·물결무늬 없이)
const cover = (hw, dd) => { const a = Math.min(2 * hw, hw + 0.5 - dd); return a <= 0 ? 0 : a >= 1 ? 1 : a; };

export async function make(c, K) {
  const { L, photo, tr } = c, { now, sleep0 } = K;
  const [frame, fx] = K.frameCanvas(L), W = frame.width, H = frame.height, N = W * H, s = Math.min(W, H) / 1000;
  let last = now();
  const pause = async (p) => { if (now() - last > 0.05) { tr.tick(p, LABEL); await sleep0(); last = now(); } };
  tr.tick(0, LABEL); await sleep0();

  // ① 대비 키운 회색 (시안 gray_enh): 1% 잘라 늘린 것 + 고르게 편 것 반반 → 살짝 또렷하게 (unsharp 반경 2 · 140% · 문턱 2)
  const [gray] = K.grayOf(photo, W, H), hist = new Int32Array(256);
  for (let i = 0; i < N; i++) { const v = Math.round(gray[i]); gray[i] = v; hist[v]++; }
  const ac = autoLut(hist, N), h2 = new Int32Array(256), mix = new Float32Array(256);
  for (let k = 0; k < 256; k++) h2[ac[k]] += hist[k];
  const eq = eqLut(h2);
  for (let k = 0; k < 256; k++) mix[k] = 0.5 * ac[k] + 0.5 * eq[ac[k]];
  for (let i = 0; i < N; i++) gray[i] = mix[gray[i]];
  const rad = (sig) => Math.max(1, Math.round(Math.sqrt(sig * sig + 0.25) - 0.5));   // 상자 흐림 세 번의 반경 (σ² ≈ r(r+1))
  let bl = K.boxBlur(gray, W, H, rad(2.35 * s));             // 시안은 850px 사진에서 반경 2 → 1000px 판에서 2.35
  for (let i = 0; i < N; i++) { const df = gray[i] - bl[i]; if (df > 2 || df < -2) gray[i] = Math.min(255, Math.max(0, gray[i] + 1.4 * df)); }
  bl = null;
  tr.tick(0.12, LABEL); await sleep0();
  const gb = K.boxBlur(gray, W, H, rad(14 * s));             // 크게 흐린 명암 → 선이 명암 따라 살짝 휨 (조각한 느낌)
  tr.tick(0.22, LABEL); await sleep0(); last = now();

  // ② 점마다 잉크 진하기 (0~255) · 줄 번호
  //    v = y + 5s·sin(x/38s) + 30s·(gb − 0.5) 의 같은 값 = 한 줄 · 간격 6s · 굵기 = 간격 × 어둡기^0.85
  //    u = 0.5x + 0.866y + 4s·sin(y/45s) = 엇갈린 선 (어둡기 0.55 넘는 곳만)
  //    거리는 v·u 의 기울기로 나눠 픽셀 단위로 → 선이 몰리거나 벌어지는 곳도 가장자리가 똑같이 또렷함
  //    아주 작게 만들 때(?px= 예시 등)는 선 간격이 3.6px 아래로 안 내려가게 (더 촘촘하면 물결무늬만 남음)
  const sl = Math.max(s, 0.6), SP = 6 * sl, HF = SP / 2, A1 = 5 * sl, B1 = 38 * sl, C1 = 30 * sl / 255, A2 = 4 * sl, B2 = 45 * sl;
  const sw = new Float32Array(W), dw = new Float32Array(W);  // 가로 물결 높이 · 기울기
  for (let x = 0; x < W; x++) { sw[x] = A1 * Math.sin(x / B1); dw[x] = A1 / B1 * Math.cos(x / B1); }
  const ink = new Uint8Array(N), lno = new Int16Array(N);
  let lnMin = 32767, lnMax = -32768;
  for (let y = 0; y < H; y++) {
    const uy = 0.866 * y + A2 * Math.sin(y / B2), duy = 0.866 + A2 / B2 * Math.cos(y / B2), gu = Math.sqrt(0.25 + duy * duy);
    const o = y * W, up = y > 0 ? -W : 0, dn = y < H - 1 ? W : 0, ky = up && dn ? 0.5 : 1;
    for (let x = 0; x < W; x++) {
      const i = o + x, v = y + sw[x] + C1 * (gb[i] - 127.5);
      const gx = (gb[x < W - 1 ? i + 1 : i] - gb[x > 0 ? i - 1 : i]) * (x > 0 && x < W - 1 ? 0.5 : 1), gy = (gb[i + dn] - gb[i + up]) * ky;
      const vx = dw[x] + C1 * gx, vy = 1 + C1 * gy, gv = Math.max(0.1, Math.sqrt(vx * vx + vy * vy));
      const d = 1 - gray[i] / 255;
      let hw = HF * Math.pow(d, 0.85) / gv;
      if (hw < 0.5) hw = (hw + 0.5) * (hw + 0.5) / 2;         // 아주 가는 선: 시안 수식과 같은 진하기로, 끊긴 점선 대신 고른 실선
      const m1 = v - SP * Math.floor(v / SP);
      let a = cover(hw, Math.abs(m1 - HF) / gv);
      if (d > 0.55 && a < 1) {
        const u = 0.5 * x + uy, m2 = u - SP * Math.floor(u / SP);
        a = Math.max(a, cover(HF * Math.min(1, (d - 0.55) / 0.45) / gu, Math.abs(m2 - HF) / gu));
      }
      ink[i] = Math.round(a * 255);
      const l = Math.floor(v / SP);
      lno[i] = l; if (l < lnMin) lnMin = l; if (l > lnMax) lnMax = l;
    }
    if ((y & 7) === 7) await pause(0.22 + 0.6 * y / H);
  }

  // ③ 드러나는 시각: 줄 ln 은 (t′ − 0.6·ln/줄 수)·폭 보다 왼쪽이 보임 (t′ = t / T_END × 1.6) → 시각 순서로 줄 세움 (조각별 세기)
  tr.tick(0.85, LABEL); await sleep0();
  const kx = QN / (1.6 * W), kl = 0.6 * QN / (1.6 * (lnMax - lnMin + 1)), start = new Int32Array(QN + 1);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) if (ink[i]) start[1 + Math.min(QN - 1, Math.floor(x * kx + (lno[i] - lnMin) * kl))]++;
  for (let b = 0; b < QN; b++) start[b + 1] += start[b];
  const order = new Int32Array(start[QN]), put = start.slice(0, QN);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) if (ink[i]) order[put[Math.min(QN - 1, Math.floor(x * kx + (lno[i] - lnMin) * kl))]++] = i;
  tr.tick(1, LABEL); await sleep0();

  // ④ 그리기: 진하기마다 색 (종이 → 잉크) · 시간이 앞으로 가면 새로 드러난 점만, 뒤로 가면 빈 종이부터 다시
  const img = fx.createImageData(W, H), px = new Uint32Array(img.data.buffer);
  const pal8 = new Uint8ClampedArray(256 * 4);
  for (let k = 0; k < 256; k++) { for (let ch = 0; ch < 3; ch++) pal8[k * 4 + ch] = Math.round(PAPER[ch] + (INK[ch] - PAPER[ch]) * k / 255); pal8[k * 4 + 3] = 255; }
  const pal = new Uint32Array(pal8.buffer);
  let qCur = -1;                                              // 지금 칠해진 조각 수 (-1 = 종이부터 다시)
  function render(t) {
    const q = Math.max(0, Math.min(QN, Math.floor(t / T_END * QN)));
    if (qCur < 0 || q < qCur) { px.fill(pal[0]); qCur = 0; }
    for (let k = start[qCur], e = start[q]; k < e; k++) { const i = order[k]; px[i] = pal[ink[i]]; }
    qCur = q;
    fx.putImageData(img, 0, 0);
    return frame;
  }
  return { T_END, W, H, render, reset() { qCur = -1; }, finalFrame: () => render(T_END + 1), dispose: () => K.free(frame) };
}
