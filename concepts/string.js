// 실 공예 (11-23): 동그란 판 둘레 못 288개 사이로 검은 실 한 가닥을 3600번 감아 얼굴을 그림 — lab/concepts/concepts.py string_art() 를 옮김
// 실이 겹친 곳일수록 진해짐 · 지금 못에서 '아직 덜 어두워진 곳을 가장 많이 지나는 줄'을 차례로 고름 (밝은 곳은 처음부터 손해로 쳐서 실이 피함)
export async function make(c, K) {
  const { L, photo, tr } = c, { canvas, clamp, free, now, sleep0, boxBlur, PI } = K;
  // 시안은 T 0.12 · 실 진하기 0.28 → 얼굴이 회색으로 뿌옜음 ("보통") → 줄 하나가 지우는 어둠을 줄여 어두운 곳에 실이 더 몰리게 · 실은 조금 진하게 (11-23)
  const R = 360, N = 288, NL = 3600, T = 0.05, GAP = 20, OFF = 0.13, POW = 1.6;   // 계산 판 · 못 · 줄 수 · 줄 하나가 지우는 어둠 · 이웃 못 건너뛰기 · 밝은 곳 손해 · 어두운 곳 강조
  const T_END = 5.5, ALPHA = 0.38, THICK = 1.0;                                   // 감기는 시간(끝 멈춤 빼고) · 실 한 줄 진하기 (두 배로 그릴 때) · 실 굵기 (시안 1000px = 1)
  const SHARP = 0.6;                                                              // 사진을 살짝 또렷하게
  const LABEL = '실 감는 순서 계산하는 중…';
  tr.tick(0, LABEL);

  // ① 판에 쓸 정사각형: 누른 곳(얼굴)이 가운데 오게, 사진 밖으로는 안 나가게
  const pw = photo.width, ph = photo.height, s = Math.min(pw, ph);
  const fx = clamp(c.focus[0] / L.Wm, 0, 1), fy = clamp(c.focus[1] / L.Hm, 0, 1);
  const sx = clamp(Math.round(fx * pw - s / 2), 0, pw - s), sy = clamp(Math.round(fy * ph - s / 2), 0, ph - s);
  const g = grayEnh(photo, sx, sy, s);

  // ② 남은 어둠 E: 어두운 곳을 더 강조 · 판 밖은 0 · 처음부터 0.13 을 빼 둠 (밝은 곳은 '손해' → 실이 피함, 0 에서 안 멈춤)
  const P = R * R, C = (R - 1) / 2, RIN = R / 2 - 1, E = new Float32Array(P);
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    const i = y * R + x;
    E[i] = (Math.hypot(x - C, y - C) <= RIN ? Math.pow(1 - g[i], POW) : 0) - OFF;
  }
  const PX = new Float64Array(N), PY = new Float64Array(N);            // 못 자리 (계산 판 좌표, 맨 위부터 시계 방향)
  for (let k = 0; k < N; k++) { const a = 2 * PI * k / N - PI / 2; PX[k] = C + RIN * Math.cos(a); PY[k] = C + RIN * Math.sin(a); }
  // 줄 a→b 가 지나는 칸: 긴 축으로 한 칸씩 (줄 3만여 개를 미리 다 저장하면 휴대폰 메모리가 커서 그때그때 셈)
  function lineMean(a, b) {
    const dx = PX[b] - PX[a], dy = PY[b] - PY[a], n = Math.round(Math.max(Math.abs(dx), Math.abs(dy))), sx = dx / n, sy = dy / n;
    let x = PX[a] + 0.5, y = PY[a] + 0.5, sum = 0;
    for (let k = 0; k <= n; k++, x += sx, y += sy) sum += E[(y | 0) * R + (x | 0)];
    return sum / (n + 1);
  }
  function lineSub(a, b) {
    const dx = PX[b] - PX[a], dy = PY[b] - PY[a], n = Math.round(Math.max(Math.abs(dx), Math.abs(dy))), sx = dx / n, sy = dy / n;
    let x = PX[a] + 0.5, y = PY[a] + 0.5;
    for (let k = 0; k <= n; k++, x += sx, y += sy) E[(y | 0) * R + (x | 0)] -= T;
  }
  // ③ 실 감기 (욕심쟁이): 지금 못에서 이웃 20개 안쪽 · 방금 온 못은 빼고, 남은 어둠 평균이 가장 큰 줄로
  const seq = new Uint16Array(NL + 1);
  let cur = 0, prev = -1, tl = now();
  for (let k = 0; k < NL; k++) {
    let best = -Infinity, bj = -1;
    for (let j = 0; j < N; j++) {
      const d = j > cur ? j - cur : cur - j;
      if (d < GAP || N - d < GAP || j === prev) continue;
      const m = lineMean(cur, j);
      if (m > best) { best = m; bj = j; }
    }
    lineSub(cur, bj); seq[k + 1] = bj; prev = cur; cur = bj;
    if ((k & 7) === 7 && now() - tl > 0.05) { tr.tick(k / NL, LABEL); await sleep0(); tl = now(); }
  }
  tr.tick(1, LABEL);

  // ④ 판 그리기: 두 배 크기에 실을 한 줄씩 겹쳐 그림 (겹칠수록 진해짐) → 줄여서 보여 줌 · 테두리와 못은 맨 위에
  //    판 크기는 1200px 까지: 가는 실이 빽빽해서 장면이 무거움 — 1440px 이면 화질이 맨 아래(0.24)인데도 18.8MB 라 20MB 를 넘는 사진이 나올 수 있음 · 1200px 은 크롬 0.6~0.66 · 사파리 0.42~0.54 (11-23 재 봄)
  const MAXW = 1200;
  const W = Math.max(64, Math.round(Math.min(Math.sqrt(L.VW * L.VH), MAXW) / 2) * 2), S2 = Math.min(W * 2, 4096), SC = S2 / W;
  const CX = W / 2, RN = W * 0.47, kk = RN / RIN;                    // 판 가운데 · 못 둘레 반지름 · 계산 판 → 그림 배율
  const X2 = new Float32Array(N), Y2 = new Float32Array(N);
  for (let k = 0; k < N; k++) { X2[k] = (CX + (PX[k] - C) * kk) * SC; Y2[k] = (CX + (PY[k] - C) * kk) * SC; }
  const big = canvas(S2, S2), bx = big.getContext('2d', { alpha: false });
  bx.lineWidth = THICK * RN * SC / 994;                                 // 시안(1000px)과 같은 굵기: 판 크기에 맞춰 늘어남
  bx.strokeStyle = `rgba(20,18,22,${ALPHA})`;
  const over = canvas(W, W), ox = over.getContext('2d');               // 테두리 + 못 (투명 바탕)
  ox.strokeStyle = 'rgb(200,196,190)'; ox.lineWidth = Math.max(1, W * 0.0016);
  ox.beginPath(); ox.arc(CX, CX, RN + W * 0.011, 0, 2 * PI); ox.stroke();
  const nr = Math.max(1.1, W * 0.0017);
  ox.fillStyle = 'rgb(120,116,110)'; ox.beginPath();
  for (let k = 0; k < N; k++) { const x = X2[k] / SC, y = Y2[k] / SC; ox.moveTo(x + nr, y); ox.arc(x, y, nr, 0, 2 * PI); }
  ox.fill();
  const frame = canvas(W, W), fc = frame.getContext('2d', { alpha: false });
  fc.imageSmoothingQuality = 'high';
  let drawn = 0;
  function reset() { bx.fillStyle = 'rgb(250,249,247)'; bx.fillRect(0, 0, S2, S2); drawn = 0; }
  function render(t) {
    const u = clamp(t / T_END, 0, 1), n = Math.floor(NL * Math.pow(u, 1.7));   // 처음엔 천천히, 갈수록 빨리
    if (n < drawn) reset();                                               // 시간이 되돌아가면 처음부터
    for (; drawn < n; drawn++) {                                          // 새 줄만 그림 (한 줄씩 따로 그려야 겹친 곳이 진해짐)
      const a = seq[drawn], b = seq[drawn + 1];
      bx.beginPath(); bx.moveTo(X2[a], Y2[a]); bx.lineTo(X2[b], Y2[b]); bx.stroke();
    }
    fc.drawImage(big, 0, 0, W, W);
    fc.drawImage(over, 0, 0);
    return frame;
  }
  reset();
  return { T_END, render, reset, finalFrame: () => render(T_END + 1), dispose: () => free(frame, big, over), W, H: W };

  // 대비를 키운 회색 (0=검정 · 1=흰색): 자동 대비(위아래 1% 자름) → 평평하게 편 것과 6:4 로 섞음 → 살짝 또렷하게 (파이썬 gray_enh(eq=0.6))
  function grayEnh(img, x0, y0, ss) {
    let src = img, tmp = null;
    if (ss > R * 3) {                                                     // 한 번에 많이 줄이면 거칠어서 두 번에
      const m = R * 2; tmp = canvas(m, m);
      const tx = tmp.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(img, x0, y0, ss, ss, 0, 0, m, m);
      src = tmp; x0 = 0; y0 = 0; ss = m;
    }
    const cv = canvas(R, R), x = cv.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(src, x0, y0, ss, ss, 0, 0, R, R);
    const d = x.getImageData(0, 0, R, R).data; free(cv, tmp);
    const n = R * R, v = new Uint8Array(n), h = new Float64Array(256);
    for (let i = 0; i < n; i++) { v[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]); h[v[i]]++; }
    const cut = Math.floor(n * 0.01);
    let lo = 0, hi = 255;
    for (let acc = 0; lo < 255; lo++) { acc += h[lo]; if (acc > cut) break; }
    for (let acc = 0; hi > 0; hi--) { acc += h[hi]; if (acc > cut) break; }
    const ac = new Uint8Array(n), h2 = new Float64Array(256);
    for (let i = 0; i < n; i++) { ac[i] = hi > lo ? clamp(Math.floor((v[i] - lo) * 255 / (hi - lo)), 0, 255) : v[i]; h2[ac[i]]++; }
    let last = 255; while (last > 0 && !h2[last]) last--;                // 평평하게 펴기 (PIL equalize 와 같은 방식)
    const step = Math.floor((n - h2[last]) / 255), lut = new Float32Array(256);
    for (let i = 0, acc = Math.floor(step / 2); i < 256; i++) { lut[i] = step ? Math.min(255, Math.floor(acc / step)) : i; acc += h2[i]; }
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = (ac[i] * 0.4 + lut[ac[i]] * 0.6) / 255;
    const bl = boxBlur(out, R, R, 1);                                     // 살짝 또렷하게 (언샤프)
    for (let i = 0; i < n; i++) { const df = out[i] - bl[i]; out[i] = clamp(out[i] + (Math.abs(df) * 255 >= 2 ? df * SHARP : 0), 0, 1); }
    return out;
  }
}
