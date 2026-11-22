// 짤 모자이크 — 여러 모양 (2026-11-22, 사용자: "다른 패턴 … 다 선택해서 할 수 있게, 일단 예시부터")
// 모든 계산은 이 기기 안에서만. app.js 의 도구를 받아서 씀: makePatterns(H)
// 모양마다 make(c) → { T_END, render(t), finalFrame(), reset(), dispose() }
//   c = { A, L, T, mos, grid, cells, photo, focus, text, tr }
//   layout: true 인 모양(크기가 다른 짤 · 벌집)은 mos 없이 받아서 스스로 짤을 고르고 그림

export function makePatterns(H) {
  const { CFG, canvas, clamp, free, mulberry32, pyramid, drawClipped, makePlan, makeRenderer, labInto, bestTile, now, sleep0 } = H;
  const PI = Math.PI;
  const easeIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const backOut = (p) => { const a = 1.70158, b = a + 1; return 1 + b * Math.pow(p - 1, 3) + a * Math.pow(p - 1, 2); };
  const FONT = "'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR','Noto Sans CJK KR',system-ui,sans-serif";

  function frameCanvas(L) { const f = canvas(L.VW, L.VH), x = f.getContext('2d', { alpha: false }); x.imageSmoothingQuality = 'high'; return [f, x]; }
  function view(P, t, L) { const [w, x, y] = P.cam(t), h = w * L.VH / L.VW; return { w, h, x0: x - w / 2, y0: y - h / 2, sc: L.VW / w }; }
  function levelFor(pyr, src, dst) { let k = 1; while (k * 2 <= src / dst && pyr[k * 2]) k *= 2; return k; }
  function blankLike(pyr) {
    const out = {}, ctx = {};
    for (const k of Object.keys(pyr).map(Number)) { out[k] = canvas(pyr[k].width, pyr[k].height); ctx[k] = out[k].getContext('2d'); }
    return [out, ctx];
  }
  const levelsOf = (pyr) => Object.keys(pyr).map(Number);
  function roundRect(x, X, Y, W, Hh, r) { x.beginPath(); if (x.roundRect) x.roundRect(X, Y, W, Hh, r); else x.rect(X, Y, W, Hh); }
  function hexAdd(x, X, Y, rad) { for (let k = 0; k < 6; k++) { const a = PI / 6 + k * PI / 3, px = X + rad * Math.cos(a), py = Y + rad * Math.sin(a); if (k) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); }
  function hexPath(x, X, Y, rad) { x.beginPath(); hexAdd(x, X, Y, rad); }
  // 칸마다 채워지는 시각: 얼굴에서 동그랗게 번지는 물결(점점 빨라짐)과, 화면이 그 칸에 닿는 시각 중 늦은 쪽 (+ 흔들림)
  function landTimes(P, L, xs, ys, focus, seed) {
    const STEPS = 600, reach = [], aspect = L.VW / L.VH, N = xs.length, land = new Float32Array(N), rl = mulberry32(seed);
    for (let k = 0; k < STEPS; k++) reach.push(P.cam(CFG.T_END * k / (STEPS - 1)));
    const normal = () => { let u = 0; while (u === 0) u = rl(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * PI * rl()); };
    let dmax = 1;
    for (const [x, y] of [[0, 0], [L.Wm, 0], [0, L.Hm], [L.Wm, L.Hm]]) dmax = Math.max(dmax, Math.hypot(x - focus[0], y - focus[1]));
    for (let i = 0; i < N; i++) {
      let k = 0;
      for (; k < STEPS; k++) { const [w, x, y] = reach[k]; if (Math.abs(xs[i] - x) < w / 2 * 0.92 && Math.abs(ys[i] - y) < w / aspect / 2 * 0.92) break; }
      k = Math.min(k, STEPS - 1);
      const ring = 0.25 + (CFG.T_END - 0.6) * Math.pow(Math.hypot(xs[i] - focus[0], ys[i] - focus[1]) / dmax, 0.6);
      const seen = k <= 1 ? 0 : CFG.T_END * k / (STEPS - 1) + 0.35;
      land[i] = clamp(Math.max(ring, seen) + (k <= 1 ? rl() * 0.12 : normal() * 0.18), 0.25, CFG.T_END);
    }
    return { land, byLand: Array.from({ length: N }, (_, i) => i).sort((a, b) => land[a] - land[b]) };
  }

  // ── 모이기 (원래 것): 짤이 사방에서 날아와 자리 잡는 동안 화면이 뒤로 빠짐
  const assemble = {
    name: '모이기',
    make(c) { const R = makeRenderer(c.L, c.T, c.mos, makePlan(c.L, c.T, c.focus)); R.T_END = CFG.T_END; return R; },
  };

  // ── 카드섹션: 얼굴부터 물결처럼 카드가 뒤집히며 사진이 드러남 (화면은 모이기처럼 뒤로 빠짐)
  const cards = {
    name: '카드섹션',
    make(c) {
      const { L, T, mos } = c, { cols, rows, VW, VH } = L, FLIP = 0.6;
      const P0 = makePlan(L, T, c.focus), xs = new Float32Array(cols * rows), ys = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) { xs[i] = ((i % cols) + 0.5) * T; ys[i] = (((i / cols) | 0) + 0.5) * T; }
      const P = { cam: P0.cam, ...landTimes(P0, L, xs, ys, c.focus, 13) };   // 처음 화면은 얼굴에서 물결처럼
      const mosL = pyramid(mos, T, false), levels = levelsOf(mosL);
      const [done, dctx] = blankLike(mosL);
      const [frame, fx] = frameCanvas(L);
      const GAP = '#d3d7df', BACK = '#f5f6f8';
      const card = canvas(T, T), cx = card.getContext('2d');
      cx.fillStyle = GAP; cx.fillRect(0, 0, T, T);
      cx.fillStyle = BACK; roundRect(cx, T * 0.06, T * 0.06, T * 0.88, T * 0.88, T * 0.12); cx.fill();
      const pat = fx.createPattern(card, 'repeat');
      let ptr = 0;
      const reset = () => { ptr = 0; for (const k of levels) dctx[k].clearRect(0, 0, done[k].width, done[k].height); };
      function settle(t) {
        while (ptr < P.byLand.length && P.land[P.byLand[ptr]] <= t) {
          const i = P.byLand[ptr++], r = (i / cols) | 0, q = i % cols;
          for (const k of levels) { const s = T / k; dctx[k].drawImage(mosL[k], q * s, r * s, s, s, q * s, r * s, s, s); }
        }
      }
      function render(t) {
        settle(t);
        const v = view(P, t, L), k = levelFor(done, v.w, VW);
        pat.setTransform(new DOMMatrix([v.sc, 0, 0, v.sc, -v.x0 * v.sc, -v.y0 * v.sc]));
        fx.fillStyle = pat; fx.fillRect(0, 0, VW, VH);
        drawClipped(fx, done[k], v.x0 / k, v.y0 / k, v.w / k, v.h / k, VW, VH);
        const S = T * v.sc;
        for (let j = ptr; j < P.byLand.length; j++) {             // 뒤집히는 중인 카드
          const i = P.byLand[j], lt = P.land[i];
          if (lt - FLIP > t) break;
          const r = (i / cols) | 0, q = i % cols, X = (q * T - v.x0) * v.sc, Y = (r * T - v.y0) * v.sc;
          if (X > VW || Y > VH || X + S < 0 || Y + S < 0) continue;
          const p = 1 - (lt - t) / FLIP, sx = Math.abs(Math.cos(p * PI)), lift = 1 + 0.16 * Math.sin(p * PI);
          const w = S * Math.max(sx, 0.03) * lift, h = S * lift, mx = X + S / 2 - w / 2, my = Y + S / 2 - h / 2;
          fx.fillStyle = GAP; fx.fillRect(X, Y, S, S);
          if (p < 0.5) { fx.fillStyle = BACK; fx.fillRect(mx + w * 0.06, my + h * 0.06, w * 0.88, h * 0.88); }
          else fx.drawImage(mosL[1], q * T, r * T, T, T, mx, my, w, h);
          const shade = 0.42 * (1 - sx);
          if (shade > 0.02) { fx.fillStyle = `rgba(20,24,32,${shade.toFixed(3)})`; fx.fillRect(mx, my, w, h); }
        }
        return frame;
      }
      return { T_END: CFG.T_END, render, reset, finalFrame: () => render(CFG.T_END + 1), dispose: () => free(frame, card, ...levels.map((k) => done[k]), ...levels.map((k) => mosL[k])) };
    },
  };

  // ── 슬롯머신: 세로줄마다 짤이 돌다가 얼굴 쪽 줄부터 '착' 멈춤 (화면은 뒤로 빠짐)
  const slot = {
    name: '슬롯머신',
    make(c) {
      const { L, T, mos } = c, { cols, VW, VH, Hm } = L;
      const P = makePlan(L, T, c.focus);
      const mosL = pyramid(mos, T, false), levels = levelsOf(mosL);
      const [frame, fx] = frameCanvas(L);
      const STEPS = 400, rnd = mulberry32(23), stop = new Float32Array(cols), cam0 = P.cam(0);
      for (let q = 0; q < cols; q++) {                          // 처음 화면 안 줄은 가운데부터, 나머지는 화면이 그 줄에 닿을 때
        const xc = (q + 0.5) * T;
        let k = 0;
        for (; k < STEPS; k++) { const [w, x] = P.cam(CFG.T_END * k / (STEPS - 1)); if (Math.abs(xc - x) < w / 2 * 0.9) break; }
        const tReach = CFG.T_END * Math.min(k, STEPS - 1) / (STEPS - 1);
        const s0 = k === 0 ? 0.8 + 1.3 * Math.abs(xc - cam0[1]) / (cam0[0] / 2) : Math.max(2.1, tReach + 0.45);
        stop[q] = clamp(s0 + (rnd() - 0.5) * 0.12, 0.7, CFG.T_END - 0.3);
      }
      const V = 28 * T, TAU0 = 0.65, BOUNCE = 0.32;
      function column(q, shift, v, k) {
        const X = (q * T - v.x0) * v.sc, S = T * v.sc;
        if (X > VW || X + S < 0) return;
        const src = mosL[k], sx = q * T / k, sw = T / k, yEnd = v.y0 + v.h;
        let y = v.y0, guard = 0;
        while (y < yEnd - 0.01 && guard++ < 8) {
          const sy = (((y - shift) % Hm) + Hm) % Hm, run = Math.min(Hm - sy, yEnd - y);
          fx.drawImage(src, sx, sy / k, sw, run / k, X, (y - v.y0) * v.sc, S, run * v.sc);
          y += run;
        }
      }
      function render(t) {
        const v = view(P, t, L), k = levelFor(mosL, v.w, VW);
        fx.fillStyle = '#fff'; fx.fillRect(0, 0, VW, VH);
        drawClipped(fx, mosL[k], v.x0 / k, v.y0 / k, v.w / k, v.h / k, VW, VH);
        const q0 = Math.max(0, Math.floor(v.x0 / T)), q1 = Math.min(cols - 1, Math.floor((v.x0 + v.w) / T));
        for (let q = q0; q <= q1; q++) {
          const tau = stop[q] - t;
          if (tau <= -BOUNCE) continue;
          let shift, speed = 0;
          if (tau > 0) { shift = -(tau < TAU0 ? V * tau * tau / (2 * TAU0) : V * (tau - TAU0 / 2)); speed = tau < TAU0 ? V * tau / TAU0 : V; }
          else { const u = -tau / BOUNCE; shift = 0.22 * T * Math.sin(PI * u) * (1 - u); }
          column(q, shift, v, k);
          if (speed > T * 2) {                                  // 빨리 도는 줄: 흐림 + 칸막이
            const d = speed / CFG.FPS / 3;
            fx.globalAlpha = 0.45; column(q, shift - d, v, k); fx.globalAlpha = 0.3; column(q, shift - 2 * d, v, k); fx.globalAlpha = 1;
            const X = (q * T - v.x0) * v.sc;
            fx.fillStyle = `rgba(0,0,0,${(0.3 * Math.min(1, speed / V)).toFixed(3)})`; fx.fillRect(X, 0, Math.max(1, T * v.sc * 0.05), VH);
          }
        }
        return frame;
      }
      return { T_END: CFG.T_END, render, reset() {}, finalFrame: () => render(CFG.T_END + 1), dispose: () => free(frame, ...levels.map((k) => mosL[k])) };
    },
  };

  // ── 변신: 짤들이 먼저 색깔별로 정리돼 있다가(위 밝음 → 아래 어두움, 줄마다 차가운 색 → 따뜻한 색), 전부 자리를 바꿔서 사진이 됨
  //    (11-22 사용자: 처음에 "아무 글자도 없으면 좋겠어" → 글자 대신 색깔 판)
  const morph = {
    name: '변신',
    make(c) {
      const { L, T, mos } = c, { cols, rows, VW, VH } = L, N = cols * rows;
      const mosL = pyramid(mos, T, false), levels = levelsOf(mosL);
      const [frame, fx] = frameCanvas(L);
      const kmin = Math.max(...levels), lm = canvas(cols, rows), lx = lm.getContext('2d', { willReadFrequently: true });   // 칸마다 짤 밝기
      lx.imageSmoothingQuality = 'high'; lx.drawImage(mosL[kmin], 0, 0, cols, rows);
      const ld = lx.getImageData(0, 0, cols, rows).data; free(lm);
      const lum = new Float32Array(N), warm = new Float32Array(N);
      for (let i = 0; i < N; i++) { lum[i] = 0.299 * ld[i * 4] + 0.587 * ld[i * 4 + 1] + 0.114 * ld[i * 4 + 2]; warm[i] = ld[i * 4] - ld[i * 4 + 2]; }
      const rnd = mulberry32(31);
      const byLum = Array.from({ length: N }, (_, i) => i).sort((a, b) => lum[b] - lum[a]);   // 밝은 짤부터 → 위 줄
      const from = new Int32Array(N);                           // from[칸] = 처음 색깔 판에서 이 칸 짤이 있던 자리
      for (let r = 0; r < rows; r++) {
        const seg = byLum.slice(r * cols, (r + 1) * cols).sort((a, b) => warm[a] - warm[b]);   // 줄 안: 차가운 색 → 따뜻한 색
        seg.forEach((cell, j) => { from[cell] = r * cols + j; });
      }
      const HOLD0 = 1.2, SPREAD = 1.7, JIT = 0.35, DUR = 1.25;  // 얼굴 가까운 자리 짤부터 출발
      const start = new Float32Array(N), arc = new Float32Array(N), fx0 = c.focus[0] / T, fy0 = c.focus[1] / T;
      let maxD = 1;
      for (let i = 0; i < N; i++) { start[i] = Math.hypot((i % cols) + 0.5 - fx0, ((i / cols) | 0) + 0.5 - fy0); maxD = Math.max(maxD, start[i]); }
      for (let i = 0; i < N; i++) { start[i] = HOLD0 + SPREAD * start[i] / maxD + rnd() * JIT; arc[i] = (rnd() - 0.5) * 0.8; }
      const T_END = HOLD0 + SPREAD + JIT + DUR + 0.15;
      const ks = mosL[2] ? 2 : 1, src = mosL[ks], s = T / ks, cw = VW / cols, ch = VH / rows, moving = [];
      function render(t) {
        fx.fillStyle = '#fff'; fx.fillRect(0, 0, VW, VH);
        moving.length = 0;
        for (let i = 0; i < N; i++) {
          const p = (t - start[i]) / DUR;
          if (p > 0 && p < 1) { moving.push(i); continue; }
          const cell = p >= 1 ? i : from[i];
          fx.drawImage(src, (i % cols) * s, ((i / cols) | 0) * s, s, s, (cell % cols) * cw, ((cell / cols) | 0) * ch, cw + 0.6, ch + 0.6);
        }
        for (const i of moving) {
          const p = easeIO((t - start[i]) / DUR), a = from[i];
          const ax = (a % cols) * cw, ay = ((a / cols) | 0) * ch, bx = (i % cols) * cw, by = ((i / cols) | 0) * ch;
          const dx = bx - ax, dy = by - ay, bend = Math.sin(PI * p) * arc[i], z = 1 + 0.8 * Math.sin(PI * p);
          const x = ax + dx * p - dy * bend, y = ay + dy * p + dx * bend;
          fx.drawImage(src, (i % cols) * s, ((i / cols) | 0) * s, s, s, x - cw * (z - 1) / 2, y - ch * (z - 1) / 2, cw * z, ch * z);
        }
        return frame;
      }
      return { T_END, render, reset() {}, finalFrame: () => render(T_END + 1), dispose: () => free(frame, ...levels.map((k) => mosL[k])) };
    },
  };

  // ── 무한 줌: 사진 속 작은 사진 속으로 끝없이 들어감 (끝 화면 = 처음 화면 → 이어 붙여도 끊김 없음)
  const droste = {
    name: '무한 줌',
    make(c) {
      const { L, T, mos, cells } = c, { cols, rows, VW, VH, Wm, Hm } = L, Z = 9, TZ = 6.2;
      const mosL = pyramid(mos, T, false), levels = levelsOf(mosL);
      const [frame, fx] = frameCanvas(L);
      const bw = Wm / Z, bh = Hm / Z;
      let best = null;                                          // 작은 사진 자리: 얼굴에서 멀고 밋밋한 곳
      for (let gy = 0; gy <= 12; gy++) for (let gx = 0; gx <= 12; gx++) {
        const bx = (Wm - bw) * gx / 12, by = (Hm - bh) * gy / 12;
        const c0 = Math.floor(bx / T), c1 = Math.min(cols - 1, Math.floor((bx + bw) / T)), r0 = Math.floor(by / T), r1 = Math.min(rows - 1, Math.floor((by + bh) / T));
        let s = 0, s2 = 0, n = 0;
        for (let r = r0; r <= r1; r++) for (let q = c0; q <= c1; q++) { const o = (r * cols + q) * 3, y = 0.299 * cells.mean[o] + 0.587 * cells.mean[o + 1] + 0.114 * cells.mean[o + 2]; s += y; s2 += y * y; n++; }
        const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)), my = s / n;
        const dFace = Math.hypot((bx + bw / 2 - c.focus[0]) / Wm, (by + bh / 2 - c.focus[1]) / Hm);
        const dc = Math.hypot((bx + bw / 2) / Wm - 0.5, (by + bh / 2) / Hm - 0.5) / Math.SQRT1_2;   // 0 = 가운데 · 1 = 모서리
        const cost = 0.5 * sd + 100 * (1 - dc) + (dFace < 0.3 ? 300 : 0) + Math.max(0, 115 - my) * 1.5;   // 사람(가운데)을 가리지 않는 가장자리 · 어두운 곳은 피함
        if (!best || cost < best.cost) best = { bx, by, cost };
      }
      const { bx, by } = best, px = bx * Z / (Z - 1), py = by * Z / (Z - 1);   // 이 점을 향해 확대하면 끝 화면 = 처음 화면
      function paint(x, y, w, h, depth) {                        // 화면 사각형에 전체 그림 + 그 안의 작은 그림 (끝없이)
        if (w < 1.5 || depth > 6 || x > VW || y > VH || x + w < 0 || y + h < 0) return;
        const k = levelFor(mosL, Wm, w), img = mosL[k];
        const vx0 = Math.max(0, x), vy0 = Math.max(0, y), vx1 = Math.min(VW, x + w), vy1 = Math.min(VH, y + h);
        const kx = img.width / w, ky = img.height / h;
        if (vx1 > vx0 && vy1 > vy0) fx.drawImage(img, (vx0 - x) * kx, (vy0 - y) * ky, (vx1 - vx0) * kx, (vy1 - vy0) * ky, vx0, vy0, vx1 - vx0, vy1 - vy0);
        paint(x + bx * w / Wm, y + by * h / Hm, w / Z, h / Z, depth + 1);
      }
      function render(t) {
        const u = clamp(t / TZ, 0, 1), e = u * u * (3 - 2 * u), z = Math.pow(Z, e);
        const x0 = px - px / z, y0 = py - py / z, scX = z * VW / Wm, scY = z * VH / Hm;
        fx.fillStyle = '#fff'; fx.fillRect(0, 0, VW, VH);
        paint(-x0 * scX, -y0 * scY, z * VW, z * VH, 0);
        return frame;
      }
      return { T_END: TZ, render, reset() {}, finalFrame: () => render(0), dispose: () => free(frame, ...levels.map((k) => mosL[k])) };
    },
  };

  // ── 크기가 다른 짤: 큰 짤이 쪼개지면서 얼굴부터 또렷해짐 (밋밋한 곳은 큰 짤로 남음)
  const quad = {
    name: '크기가 다른 짤', layout: true,
    async make(c) {
      const { A, L, cells, photo, tr } = c, { cols, rows, VW, VH } = L, TC = 16, Wc = cols * TC, Hc = rows * TC;
      const sm = cells.small, sw = cols * 3, T = A.T;
      const fcx = c.focus[0] / T, fcy = c.focus[1] / T, faceR = 0.2 * Math.max(cols, rows);
      const lumAt = (x, y) => { const o = (y * sw + x) * 3; return 0.299 * sm[o] + 0.587 * sm[o + 1] + 0.114 * sm[o + 2]; };
      function spread(r0, q0, s) {                              // 복잡한 정도: 밝기·색 흩어짐 + 윤곽선, 사진 가운데일수록 더 (사람은 보통 가운데)
        const st = [[0, 0], [0, 0], [0, 0], [0, 0]];
        let n = 0, edge = 0, ne = 0;
        for (let y = r0 * 3; y < (r0 + s) * 3; y++) for (let x = q0 * 3; x < (q0 + s) * 3; x++) {
          const o = (y * sw + x) * 3, v = lumAt(x, y);
          for (const [k, val] of [[0, v], [1, sm[o]], [2, sm[o + 1]], [3, sm[o + 2]]]) { st[k][0] += val; st[k][1] += val * val; }
          n++;
          if (x + 1 < (q0 + s) * 3) { edge += Math.abs(lumAt(x + 1, y) - v); ne++; }
          if (y + 1 < (r0 + s) * 3) { edge += Math.abs(lumAt(x, y + 1) - v); ne++; }
        }
        const sd = st.map(([a, a2]) => Math.sqrt(Math.max(0, a2 / n - (a / n) ** 2)));
        const dc = Math.hypot((q0 + s / 2) / cols - 0.5, (r0 + s / 2) / rows - 0.5) / 0.5;
        return (sd[0] + 0.5 * (sd[1] + sd[2] + sd[3]) / 3 + 1.5 * edge / Math.max(1, ne)) * (1 + 1.6 * Math.pow(Math.max(0, 1 - dc), 2));
      }
      const nodes = [];
      const node = (r, q, s, parent) => { const nd = { r, q, s, kids: null, tile: -1, t: 0, parent, mean: null }; nodes.push(nd); return nd; };
      const top = [];
      function cover(r, q, s) {                                 // 4×4 로 덮고, 가장자리는 맞는 크기로
        if (r >= rows || q >= cols) return;
        if (r + s <= rows && q + s <= cols) { top.push(node(r, q, s, null)); return; }
        const h = s / 2; if (h < 1) return;
        cover(r, q, h); cover(r, q + h, h); cover(r + h, q, h); cover(r + h, q + h, h);
      }
      for (let r = 0; r < rows; r += 4) for (let q = 0; q < cols; q += 4) cover(r, q, 4);
      const near = (n) => Math.hypot(n.q + n.s / 2 - fcx, n.r + n.s / 2 - fcy) < faceR;
      function split(list, frac) {                              // 복잡한 쪽 frac 만큼 + 얼굴 근처는 쪼갬
        const cand = list.filter((n) => n.s > 1), sc = cand.map((n) => spread(n.r, n.q, n.s));
        const sorted = sc.slice().sort((a, b) => a - b), th = sorted.length ? sorted[Math.floor(sorted.length * (1 - frac))] : Infinity;
        const next = [];
        cand.forEach((n, i) => {
          if (!(near(n) || sc[i] >= th)) return;
          const h = n.s / 2; n.kids = [];
          for (const [dr, dq] of [[0, 0], [0, h], [h, 0], [h, h]]) { const k = node(n.r + dr, n.q + dq, h, n); n.kids.push(k); next.push(k); }
        });
        return next;
      }
      const lv2 = split(top.filter((n) => n.s === 4), 0.7);
      split(lv2.concat(top.filter((n) => n.s === 2)), 0.6);
      const stA = top, stB = [], stC = [];
      for (const n of stA) { if (n.kids) stB.push(...n.kids); else stB.push(n); }
      for (const n of stB) { if (n.kids) stC.push(...n.kids); else stC.push(n); }
      // 짤 고르기 (크기마다, 가까운 같은 크기 칸에 같은 짤 X)
      const feat = new Float32Array(27);
      function featOf(n) {
        const s = n.s, m = [0, 0, 0];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          let r = 0, g = 0, b = 0, k = 0;
          for (let y = n.r * 3 + i * s; y < n.r * 3 + (i + 1) * s; y++) for (let x = n.q * 3 + j * s; x < n.q * 3 + (j + 1) * s; x++) { const o = (y * sw + x) * 3; r += sm[o]; g += sm[o + 1]; b += sm[o + 2]; k++; }
          r /= k; g /= k; b /= k; labInto(r, g, b, feat, (i * 3 + j) * 3); m[0] += r / 9; m[1] += g / 9; m[2] += b / 9;
        }
        n.mean = m;
      }
      const used = new Float32Array(A.n), stamp = new Int32Array(A.n).fill(-1);
      const maps = { 4: new Int32Array(cols * rows).fill(-1), 2: new Int32Array(cols * rows).fill(-1), 1: new Int32Array(cols * rows).fill(-1) };
      const all = nodes.slice(), rnd = mulberry32(7);
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      const cap = Math.ceil(all.length / A.n) + 4, pen = CFG.REUSE / Math.max(1, all.length / A.n);
      let last = now(), qi = 0;
      for (const n of all) {
        qi++;
        const mp = maps[n.s], R = CFG.NEAR + n.s;
        for (let rr = Math.max(0, n.r - R); rr < Math.min(rows, n.r + n.s + R); rr++) for (let cc = Math.max(0, n.q - R); cc < Math.min(cols, n.q + n.s + R); cc++) { const g = mp[rr * cols + cc]; if (g >= 0) stamp[g] = qi; }
        featOf(n);
        let b = bestTile(feat, 0, A.feats, A.n, used, cap, pen, stamp, qi);
        if (b < 0) b = (qi * 7919) % A.n;
        n.tile = b; used[b]++;
        for (let rr = n.r; rr < n.r + n.s; rr++) for (let cc = n.q; cc < n.q + n.s; cc++) mp[rr * cols + cc] = b;
        if (now() - last > 0.06) { tr.tick(qi / all.length); await sleep0(); last = now(); }
      }
      // 그리기: 단계마다 한 장 (A: 4×4 · B: 한 번 쪼갠 것 · C: 끝)
      tr.stage('compose', '모자이크 그리는 중…');
      const ph = canvas(Wc, Hc), phx = ph.getContext('2d', { willReadFrequently: true });
      phx.imageSmoothingQuality = 'high'; phx.drawImage(photo, 0, 0, Wc, Hc);
      const pd = phx.getImageData(0, 0, Wc, Hc).data; free(ph);
      const per = A.PER * A.PER, OV = CFG.OVERLAY, KEEP = 1 - OV;
      const tmp = canvas(4 * TC, 4 * TC), tmx = tmp.getContext('2d', { willReadFrequently: true });
      tmx.imageSmoothingQuality = 'high';
      async function stage(list, p0, p1) {
        const cv = canvas(Wc, Hc), cx = cv.getContext('2d');
        let j = 0;
        for (const n of list) {
          const S = n.s * TC, t = n.tile, im = A.sheets[(t / per) | 0], k = t % per;
          tmx.drawImage(im, (k % A.PER) * T, ((k / A.PER) | 0) * T, T, T, 0, 0, S, S);
          const id = tmx.getImageData(0, 0, S, S), d = id.data, X0 = n.q * TC, Y0 = n.r * TC;
          const s0 = CFG.SHIFT * (n.mean[0] - A.mean[t * 3]), s1 = CFG.SHIFT * (n.mean[1] - A.mean[t * 3 + 1]), s2 = CFG.SHIFT * (n.mean[2] - A.mean[t * 3 + 2]);
          for (let y = 0; y < S; y++) for (let x = 0, i = y * S * 4, o = ((Y0 + y) * Wc + X0) * 4; x < S; x++, i += 4, o += 4) {
            d[i] = (d[i] + s0) * KEEP + OV * pd[o]; d[i + 1] = (d[i + 1] + s1) * KEEP + OV * pd[o + 1]; d[i + 2] = (d[i + 2] + s2) * KEEP + OV * pd[o + 2]; d[i + 3] = 255;
          }
          cx.putImageData(id, X0, Y0);
          if (++j % 400 === 0) { tr.tick(p0 + (p1 - p0) * j / list.length); await sleep0(); }
        }
        return cv;
      }
      const imA = await stage(stA, 0, 0.2), imB = await stage(stB, 0.2, 0.5), imC = await stage(stC, 0.5, 1);
      free(tmp);
      // 쪼개지는 시각: 얼굴에서 가까운 것부터
      const maxD = Math.hypot(cols, rows), rt = mulberry32(41), POP = 0.32, ev = [];
      const dist = (n) => Math.hypot(n.q + n.s / 2 - fcx, n.r + n.s / 2 - fcy) / maxD;
      for (const n of stA) if (n.kids) { n.t = 0.6 + 2.0 * dist(n) + rt() * 0.3; ev.push(n); }
      for (const n of stB) if (n.kids) { const base = n.parent ? n.parent.t + POP + 0.25 : 0.6 + 2.0 * dist(n); n.t = base + 0.9 * dist(n) + rt() * 0.3; ev.push(n); }
      ev.sort((a, b) => a.t - b.t);
      const T_END = (ev.length ? ev[ev.length - 1].t : 0) + POP + 0.15;
      const [frame, fx] = frameCanvas(L);
      const set = canvas(Wc, Hc), sx = set.getContext('2d'), kx = VW / Wc, ky = VH / Hc;
      let ptr = 0;
      const srcOf = (n) => (n.s === 4 ? imB : imC);
      function reset() { ptr = 0; sx.drawImage(imA, 0, 0); }
      function settle(t) {
        while (ptr < ev.length && ev[ptr].t + POP <= t) { const n = ev[ptr++], X = n.q * TC, Y = n.r * TC, S = n.s * TC; sx.drawImage(srcOf(n), X, Y, S, S, X, Y, S, S); }
      }
      function render(t) {
        if (t >= T_END) { fx.drawImage(imC, 0, 0, VW, VH); return frame; }
        settle(t);
        fx.drawImage(set, 0, 0, VW, VH);
        for (let j = ptr; j < ev.length && ev[j].t <= t; j++) {   // 쪼개지는 중: 작은 짤 4장이 튀어나옴
          const n = ev[j], p = (t - n.t) / POP; if (p >= 1) continue;
          const im = srcOf(n), z = 0.55 + 0.45 * backOut(p);
          for (const k of n.kids) {
            const X = k.q * TC, Y = k.r * TC, S = k.s * TC, w = S * kx * z, h = S * ky * z;
            fx.drawImage(im, X, Y, S, S, (X + S / 2) * kx - w / 2, (Y + S / 2) * ky - h / 2, w, h);
          }
        }
        return frame;
      }
      reset();
      return { T_END, render, reset, finalFrame: () => render(T_END + 1), dispose: () => free(frame, set, imA, imB, imC) };
    },
  };

  // ── 벌집: 육각형 짤이 얼굴부터 벌집을 채움 (화면은 모이기처럼 뒤로 빠짐)
  const hex = {
    name: '벌집', layout: true,
    async make(c) {
      const { A, L, cells, photo, tr } = c, { cols, rows, VW, VH, Wm, Hm } = L, T = A.T;
      const sm = cells.small, sw = cols * 3, sh = rows * 3;
      const hw = T, hh = 2 * T / Math.sqrt(3), vs = hh * 0.75, rad = hh / 2;
      const HR = Math.ceil(Hm / vs) + 1, HC = cols + 1, N = HR * HC;
      const cx = new Float32Array(N), cy = new Float32Array(N);
      for (let r = 0; r < HR; r++) for (let q = 0; q < HC; q++) { const i = r * HC + q; cx[i] = q * hw + (r % 2 ? hw / 2 : 0); cy[i] = r * vs; }
      const rgb = new Float32Array(3), feat = new Float32Array(27), means = new Float32Array(N * 3);
      function samp(x, y) {                                     // 사진(칸당 3×3) 양선형
        x = clamp(x - 0.5, 0, sw - 1.001); y = clamp(y - 0.5, 0, sh - 1.001);
        const x0 = x | 0, y0 = y | 0, ax = x - x0, ay = y - y0;
        for (let ch = 0; ch < 3; ch++) {
          const a = sm[(y0 * sw + x0) * 3 + ch], b = sm[(y0 * sw + x0 + 1) * 3 + ch], c2 = sm[((y0 + 1) * sw + x0) * 3 + ch], d = sm[((y0 + 1) * sw + x0 + 1) * 3 + ch];
          rgb[ch] = (a * (1 - ax) + b * ax) * (1 - ay) + (c2 * (1 - ax) + d * ax) * ay;
        }
      }
      function featOf(i) {
        let m0 = 0, m1 = 0, m2 = 0;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          samp((cx[i] + (b - 1) * hw / 3) * 3 / T, (cy[i] + (a - 1) * hh / 3) * 3 / T);
          labInto(rgb[0], rgb[1], rgb[2], feat, (a * 3 + b) * 3); m0 += rgb[0] / 9; m1 += rgb[1] / 9; m2 += rgb[2] / 9;
        }
        means[i * 3] = m0; means[i * 3 + 1] = m1; means[i * 3 + 2] = m2;
      }
      const used = new Float32Array(A.n), stamp = new Int32Array(A.n).fill(-1), tile = new Int32Array(N).fill(-1);
      const order = Array.from({ length: N }, (_, i) => i), rnd = mulberry32(7);
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const cap = Math.ceil(N / A.n) + (A.n * 2 >= N ? 2 : 4), pen = CFG.REUSE / Math.max(1, N / A.n);
      let last = now();
      for (let qq = 0; qq < N; qq++) {
        const i = order[qq], r = (i / HC) | 0, q = i % HC;
        for (let rr = Math.max(0, r - CFG.NEAR); rr <= Math.min(HR - 1, r + CFG.NEAR); rr++) for (let cc = Math.max(0, q - CFG.NEAR); cc <= Math.min(HC - 1, q + CFG.NEAR); cc++) { const g = tile[rr * HC + cc]; if (g >= 0) stamp[g] = qq; }
        featOf(i);
        let b = bestTile(feat, 0, A.feats, A.n, used, cap, pen, stamp, qq);
        if (b < 0) b = (qq * 7919) % A.n;
        tile[i] = b; used[b]++;
        if (now() - last > 0.06) { tr.tick(qq / N); await sleep0(); last = now(); }
      }
      // 그리기: 육각형으로 잘라 붙이고, 흰 벽
      tr.stage('compose', '벌집 그리는 중…');
      const mos = canvas(Wm, Hm), mx = mos.getContext('2d');
      mx.fillStyle = '#fff'; mx.fillRect(0, 0, Wm, Hm);
      const TS = Math.ceil(hh) + 2, tmp = canvas(TS, TS), tx = tmp.getContext('2d', { willReadFrequently: true });
      tx.imageSmoothingQuality = 'high';
      const ph = canvas(Math.round(Wm / 2), Math.round(Hm / 2)), phx = ph.getContext('2d', { willReadFrequently: true });
      phx.imageSmoothingQuality = 'high'; phx.drawImage(photo, 0, 0, ph.width, ph.height);
      const pd = phx.getImageData(0, 0, ph.width, ph.height).data, pw = ph.width, phh = ph.height; free(ph);
      const per = A.PER * A.PER, OV = CFG.OVERLAY, KEEP = 1 - OV;
      last = now();
      for (let i = 0; i < N; i++) {
        const t = tile[i], im = A.sheets[(t / per) | 0], k = t % per;
        tx.drawImage(im, (k % A.PER) * T, ((k / A.PER) | 0) * T, T, T, 0, 0, TS, TS);
        const id = tx.getImageData(0, 0, TS, TS), d = id.data, X0 = cx[i] - TS / 2, Y0 = cy[i] - TS / 2;
        const s0 = CFG.SHIFT * (means[i * 3] - A.mean[t * 3]), s1 = CFG.SHIFT * (means[i * 3 + 1] - A.mean[t * 3 + 1]), s2 = CFG.SHIFT * (means[i * 3 + 2] - A.mean[t * 3 + 2]);
        for (let y = 0; y < TS; y++) {
          const py = clamp(((Y0 + y) / 2) | 0, 0, phh - 1);
          for (let x = 0, o = y * TS * 4; x < TS; x++, o += 4) {
            const j = (py * pw + clamp(((X0 + x) / 2) | 0, 0, pw - 1)) * 4;
            d[o] = (d[o] + s0) * KEEP + OV * pd[j]; d[o + 1] = (d[o + 1] + s1) * KEEP + OV * pd[j + 1]; d[o + 2] = (d[o + 2] + s2) * KEEP + OV * pd[j + 2]; d[o + 3] = 255;
          }
        }
        tx.putImageData(id, 0, 0);
        mx.save(); hexPath(mx, cx[i], cy[i], rad + 0.5); mx.clip(); mx.drawImage(tmp, X0, Y0); mx.restore();
        if (now() - last > 0.06) { tr.tick(i / N); await sleep0(); last = now(); }
      }
      free(tmp);
      mx.beginPath(); for (let i = 0; i < N; i++) hexAdd(mx, cx[i], cy[i], rad);
      mx.strokeStyle = '#fff'; mx.lineWidth = 2.4; mx.lineJoin = 'round'; mx.stroke();
      // 채워지는 시각 (처음 화면 안은 얼굴에서 동그랗게 번짐, 밖은 화면이 닿을 때)
      const P = makePlan(L, T, c.focus), { land, byLand } = landTimes(P, L, cx, cy, c.focus, 11);
      const mosL = pyramid(mos, T, false), levels = levelsOf(mosL);
      const [done, dctx] = blankLike(mosL);
      const [frame, fx] = frameCanvas(L);
      const POP = 0.45;
      let ptr = 0;
      function reset() { ptr = 0; for (const k of levels) dctx[k].clearRect(0, 0, done[k].width, done[k].height); }
      function settle(t) {
        while (ptr < N && land[byLand[ptr]] <= t) {
          const i = byLand[ptr++];
          for (const k of levels) {
            const x = dctx[k], X = (cx[i] - rad - 1) / k, Y = (cy[i] - rad - 1) / k, S = (2 * rad + 2) / k;
            x.save(); hexPath(x, cx[i] / k, cy[i] / k, (rad + 1) / k); x.clip(); x.drawImage(mosL[k], X, Y, S, S, X, Y, S, S); x.restore();
          }
        }
      }
      function render(t) {
        settle(t);
        const v = view(P, t, L), k = levelFor(done, v.w, VW), R = rad * v.sc;
        fx.fillStyle = '#fff'; fx.fillRect(0, 0, VW, VH);
        if (ptr < N) {                                          // 아직 빈 벌집 칸 테두리
          fx.beginPath();
          for (let j = ptr; j < N; j++) { const i = byLand[j], X = (cx[i] - v.x0) * v.sc, Y = (cy[i] - v.y0) * v.sc; if (X < -R || Y < -R || X > VW + R || Y > VH + R) continue; hexAdd(fx, X, Y, R * 0.93); }
          fx.strokeStyle = '#dfe2e8'; fx.lineWidth = Math.max(0.6, 1.6 * v.sc); fx.stroke();
        }
        drawClipped(fx, done[k], v.x0 / k, v.y0 / k, v.w / k, v.h / k, VW, VH);
        for (let j = ptr; j < N; j++) {                         // 톡 하고 채워지는 칸
          const i = byLand[j], lt = land[i];
          if (lt - POP > t) break;
          const p = 1 - (lt - t) / POP, z = Math.max(0.05, backOut(p)), X = (cx[i] - v.x0) * v.sc, Y = (cy[i] - v.y0) * v.sc;
          if (X < -R * 1.2 || Y < -R * 1.2 || X > VW + R * 1.2 || Y > VH + R * 1.2) continue;
          fx.save(); hexPath(fx, X, Y, R * z); fx.clip();
          fx.drawImage(mosL[1], cx[i] - rad, cy[i] - rad, 2 * rad, 2 * rad, X - R * z, Y - R * z, 2 * R * z, 2 * R * z);
          fx.restore();
        }
        return frame;
      }
      return { T_END: CFG.T_END, render, reset, finalFrame: () => render(CFG.T_END + 1), dispose: () => free(frame, ...levels.map((k) => done[k]), ...levels.map((k) => mosL[k])) };
    },
  };

  return { assemble, cards, slot, morph, droste, quad, hex };
}
