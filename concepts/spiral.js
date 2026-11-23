// 한 줄 그림 (11-23): 가운데에서 밖으로 감기는 소용돌이 선 하나(약 95바퀴) — 굵기만 바뀌어 얼굴이 보임 · lab/concepts/concepts.py spiral() 을 옮김
// 선은 점마다 그리지 않고 화면 점마다 '가장 가까운 두 바퀴까지 거리'로 칠함 → 굵기가 매끄럽고 이음매·틈이 없음 (시안은 세 배로 그려서 줄였음)
// 그려지는 순서: 점마다 '펜이 지나가는 선 길이'를 적어 두고, t 까지 그린 길이보다 짧은 점만 칠함 (앞 장면에 이어서 칠함)
const LABEL = '선 하나로 그리는 길 계산하는 중…';
const PAPER = 250, INK = 22, T_END = 5.5, POW = 1.25;          // 종이 · 먹 · 그리는 시간 · 점 n·u^1.25 개까지 (시안 그대로)

export async function make(c, K) {
  const { L, tr } = c, { canvas, clamp, free, sleep0 } = K;
  const S = clamp(Math.round(Math.sqrt(L.VW * L.VH) / 2) * 2, 200, 4096);   // 정사각형 판 (화면 넓이와 같게)
  tr.tick(0, LABEL); await sleep0();
  const { A8, SL, nInk, S_TOT } = await inkMap(c, K, S);

  // 선 길이 순서로 나눠 담기 (칸 NB개) + 칸마다 화면에서 차지하는 네모 → 장면마다 새로 칠할 점만 칠함
  const NB = 4096, bk = (s) => clamp(Math.floor(s / S_TOT * NB), 0, NB - 1);
  const start = new Uint32Array(NB + 1), bx0 = new Int32Array(NB).fill(S), by0 = new Int32Array(NB).fill(S), bx1 = new Int32Array(NB).fill(-1), by1 = new Int32Array(NB).fill(-1);
  for (let i = 0; i < S * S; i++) if (A8[i]) start[bk(SL[i]) + 1]++;
  for (let k = 0; k < NB; k++) start[k + 1] += start[k];
  tr.tick(0.95, LABEL); await sleep0();
  const ord = new Uint32Array(nInk), sO = new Float32Array(nInk), aO = new Uint8Array(nInk), fill = start.slice(0, NB);
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) {
    if (!A8[i]) continue;
    const b = bk(SL[i]), k = fill[b]++;
    ord[k] = i; sO[k] = SL[i]; aO[k] = A8[i];
    if (x < bx0[b]) bx0[b] = x; if (x > bx1[b]) bx1[b] = x; if (y < by0[b]) by0[b] = y; if (y > by1[b]) by1[b] = y;
  }
  tr.tick(1, LABEL); await sleep0();

  // 그리기: 종이에 먹 · 장면마다 앞 장면에 이어서 칠함, 시간이 거꾸로 가면 처음부터
  const frame = canvas(S, S), fx = frame.getContext('2d', { alpha: false });
  const img = fx.createImageData(S, S), px = new Uint32Array(img.data.buffer), LUT = new Uint32Array(256);
  for (let a = 0; a < 256; a++) { const g = Math.round(PAPER - (PAPER - INK) * a / 255); LUT[a] = (0xff000000 | (g << 16) | (g << 8) | g) >>> 0; }
  let curS = 0, doneS = -1, full = true;
  function reset() { px.fill(LUT[0]); curS = 0; doneS = -1; full = true; }
  function drawTo(st) {                                         // 선 길이 st 까지 그린 그림
    if (st < curS) reset();
    let x0 = S, y0 = S, x1 = -1, y1 = -1;
    for (let b = bk(Math.max(0, doneS - 1)), be = bk(st + 1); b <= be; b++) {
      const k1 = start[b + 1];
      if (start[b] === k1) continue;
      for (let k = start[b]; k < k1; k++) {
        const tip = st - sO[k] + 0.5;                           // 펜 끝은 1px 에 걸쳐 부드럽게
        if (tip <= 0) continue;
        px[ord[k]] = LUT[tip >= 1 ? aO[k] : Math.round(aO[k] * tip)];
      }
      if (bx0[b] < x0) x0 = bx0[b]; if (bx1[b] > x1) x1 = bx1[b]; if (by0[b] < y0) y0 = by0[b]; if (by1[b] > y1) y1 = by1[b];
    }
    curS = st; doneS = st - 0.5;
    if (full) { fx.putImageData(img, 0, 0); full = false; }
    else if (x1 >= x0) fx.putImageData(img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }
  function render(t) {
    const u = clamp(t / T_END, 0, 1);
    drawTo(u >= 1 ? S_TOT + 2 : u <= 0 ? -1 : S_TOT * Math.pow(u, POW));   // 첫 장면은 빈 종이
    return frame;
  }
  reset();
  return { T_END, render, reset, finalFrame: () => render(T_END + 1), dispose: () => free(frame), W: S, H: S };
}

// 화면 점마다 선이 덮는 몫(A8, 0~255) · 펜이 그 점을 지나갈 때까지 그은 선 길이(SL)
async function inkMap(c, K, S) {
  const { L, photo, tr } = c, { canvas, clamp, free, now, sleep0, boxBlur, PI } = K;
  const U = S / 1000, SP = 5.2 * U, B = SP / (2 * PI), RMAX = S / 2 - 8 * U, TH_MAX = RMAX / B;   // 시안 1000px 기준 · 줄 간격 · r = B·θ

  // ① 사진: 누른 곳 둘레 정사각형 → 대비 키운 회색 (자동 대비 1% · 고른 분포 40% 섞기 · 살짝 선명하게) → 어둠 0~1
  const pw = photo.width, ph = photo.height, side = Math.min(pw, ph), M = Math.max(2, Math.min(side, S));
  const sx = clamp(Math.round(c.focus[0] / L.Wm * pw - side / 2), 0, pw - side), sy = clamp(Math.round(c.focus[1] / L.Hm * ph - side / 2), 0, ph - side);
  const N = M * M, g8 = new Uint8Array(N);
  {
    const cv = canvas(M, M), x = cv.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(photo, sx, sy, side, side, 0, 0, M, M);
    const d = x.getImageData(0, 0, M, M).data; free(cv);
    for (let i = 0, o = 0; i < N; i++, o += 4) g8[i] = Math.round(0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]);
  }
  const histOf = (a) => { const h = new Float64Array(256); for (let i = 0; i < a.length; i++) h[a[i]]++; return h; };
  const ac = autoContrast(g8, histOf(g8), N), eq = equalize(ac, histOf(ac)), v = new Float32Array(N);
  for (let i = 0; i < N; i++) v[i] = ac[i] + 0.4 * (eq[i] - ac[i]);
  const sg = 2.35 * M / 1000, br = Math.max(1, Math.round((Math.sqrt(1 + 4 * sg * sg) - 1) / 2));   // 시안: 850px 사진에 반지름 2 → 1000px 판에서 2.35
  const bl = boxBlur(v, M, M, br), D0 = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const df = v[i] - bl[i], g = Math.abs(df) >= 2 ? clamp(v[i] + 1.4 * df, 0, 255) : v[i];   // 선명하게 (140% · 문턱 2)
    D0[i] = Math.pow(1 - g / 255, 1.1);
  }
  // 어둠을 줄 간격의 0.3 만큼 살짝 흐림 (시안에 없던 것, 11-23): 얼굴은 그대로인데 잔무늬 많은 사진(궁궐)에서 선이 점점이 끊기지 않음 · 움짤 화질 0.42 → 0.66
  const sd = 0.3 * 5.2 * S / 1000 * M / S, D = boxBlur(D0, M, M, Math.max(1, Math.round((Math.sqrt(1 + 4 * sd * sd) - 1) / 2)));
  tr.tick(0.1, LABEL); await sleep0();
  const ks = M / S, MX = M - 1.001;
  const widthAt = (xo, yo) => {                                 // 판 좌표 → 선 굵기 (어둠은 부드럽게 사이값)
    const mx = clamp(xo * ks - 0.5, 0, MX), my = clamp(yo * ks - 0.5, 0, MX), x0 = mx | 0, y0 = my | 0, tx = mx - x0, ty = my - y0, i = y0 * M + x0;
    const dk = (D[i] * (1 - tx) + D[i + 1] * tx) * (1 - ty) + (D[i + M] * (1 - tx) + D[i + M + 1] * tx) * ty;
    return SP * (0.07 + 0.9 * dk);
  };
  const arcLen = (th) => B / 2 * (th * Math.sqrt(1 + th * th) + Math.asinh(th));   // 가운데서 θ 까지 선 길이

  // ② 화면 점마다: 같은 방향의 안쪽·바깥쪽 바퀴까지 거리 → 선이 덮는 몫 · 펜이 지나가는 선 길이
  //    선 가장자리는 가우스로 살짝 흐림 (시안은 세 배로 그려서 줄였음 → 1000px 판에서 σ 0.38px 과 비슷) · 판이 크면 같이 커져서 움짤 화질도 덜 떨어짐
  const SG = Math.max(0.35, 0.38 * U), KS = 1 / (SG * Math.SQRT2), REACH = 3 * SG;
  const cover = (d, hw) => 0.5 * (erf((hw - d) * KS) + erf((hw + d) * KS));   // 칸이 굵기 2·hw 선에 덮이는 몫 (0~1)
  const P = S * S, A8 = new Uint8Array(P), SL = new Float32Array(P), TAU = 2 * PI, C0 = S / 2;
  const HWMAX = SP * 0.97 / 2, RLIM = RMAX + HWMAX + REACH + 1, hw0 = widthAt(C0, C0) / 2;
  let nInk = 0, tY = now();
  for (let y = 0; y < S; y++) {
    const Y = y + 0.5 - C0;
    if (Math.abs(Y) <= RLIM) {
      for (let x = 0; x < S; x++) {
        const X = x + 0.5 - C0, r = Math.sqrt(X * X + Y * Y);
        if (r > RLIM) continue;
        let a = Math.atan2(Y, X); if (a < 0) a += TAU;
        const k0 = Math.floor((r / B - a) / TAU);
        let sum = 0, best = 0, bth = 0;
        for (let j = 0; j < 2; j++) {
          const th = a + TAU * (k0 + j);
          if (th < 0 || th > TH_MAX) continue;
          const rj = B * th, d = Math.abs(r - rj) * (rj > SP ? rj / Math.sqrt(rj * rj + B * B) : 1);   // 바퀴가 살짝 기운 만큼 보정
          if (d >= HWMAX + REACH) continue;
          const q = rj / r, cv = cover(d, widthAt(C0 + X * q, C0 + Y * q) / 2);
          sum += cv; if (cv > best) { best = cv; bth = th; }
        }
        if (r < hw0 + REACH) { const cv = cover(r, hw0); if (cv > sum) sum = cv; if (cv > best) { best = cv; bth = 0; } }   // 시작점 (둥근 끝)
        const a8 = Math.round(Math.min(1, sum) * 255);
        if (!a8) continue;
        const i = y * S + x; A8[i] = a8; SL[i] = arcLen(bth); nInk++;
      }
    }
    if (now() - tY > 0.05) { tY = now(); tr.tick(0.1 + 0.8 * y / S, LABEL); await sleep0(); }
  }
  return { A8, SL, nInk, S_TOT: arcLen(TH_MAX) };
}

// 오차 함수 (Abramowitz–Stegun 7.1.26, 오차 1.5e-7)
function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}
// 자동 대비 (PIL ImageOps.autocontrast cutoff=1 과 같음): 양 끝 1% 를 버리고 0~255 로 늘림
function autoContrast(g8, h, n) {
  const cut0 = Math.floor(n / 100);
  let cut = cut0, lo = 0, hi = 255;
  for (lo = 0; lo < 256; lo++) { if (cut > h[lo]) { cut -= h[lo]; h[lo] = 0; } else { h[lo] -= cut; cut = 0; } if (cut <= 0) break; }
  cut = cut0;
  for (hi = 255; hi >= 0; hi--) { if (cut > h[hi]) { cut -= h[hi]; h[hi] = 0; } else { h[hi] -= cut; cut = 0; } if (cut <= 0) break; }
  for (lo = 0; lo < 256 && !h[lo]; lo++);
  for (hi = 255; hi >= 0 && !h[hi]; hi--);
  const lut = new Uint8Array(256), out = new Uint8Array(g8.length);
  if (hi <= lo) for (let i = 0; i < 256; i++) lut[i] = i;
  else { const sc = 255 / (hi - lo); for (let i = 0; i < 256; i++) lut[i] = Math.max(0, Math.min(255, Math.trunc(i * sc - lo * sc))); }
  for (let i = 0; i < g8.length; i++) out[i] = lut[g8[i]];
  return out;
}
// 고른 분포 (PIL ImageOps.equalize 와 같음)
function equalize(g8, h) {
  const nz = []; for (let i = 0; i < 256; i++) if (h[i]) nz.push(h[i]);
  const lut = new Uint8Array(256);
  let step = 0;
  if (nz.length > 1) step = Math.floor((nz.reduce((a, b) => a + b, 0) - nz[nz.length - 1]) / 255);
  if (!step) for (let i = 0; i < 256; i++) lut[i] = i;
  else { let n = Math.floor(step / 2); for (let i = 0; i < 256; i++) { lut[i] = Math.min(255, Math.floor(n / step)); n += h[i]; } }
  const out = new Uint8Array(g8.length);
  for (let i = 0; i < g8.length; i++) out[i] = lut[g8[i]];
  return out;
}
