// LP판 (11-23 사용자: "LP판 돌아가다가 사진 맞춰지는 느낌"): 짤 모자이크가 LP판처럼 돌다가, 바깥 띠부터 하나씩 멈추며 사진이 맞춰짐
//   판 가운데 = 누른 곳(얼굴) · 동심원 띠 12~18개 — 띠마다 모자이크를 가운데 기준으로 돌려 그 띠 안에만 그림 (원 두 개 + evenodd 로 자름)
//   0~1.5초: 판 전체가 같이 돎 (띠마다 처음 각도가 달라 뒤섞임 · 살짝 끌림) + 레코드 느낌: 어둡게 · 소리골 · 가만히 있는 빛 반사 두 줄기 · 가운데 라벨 · 구멍
//   1.5~5.35초: 바깥 띠부터 느려지다 제자리(0도)에 '착' (살짝 지나쳤다 돌아옴) · 멈춘 띠는 레코드 느낌이 걷힘 → 가운데 라벨(얼굴)이 마지막
//   끝 장면 = 자르지 않은 모자이크 한 장 (띠 이음매 없음 · 모이기의 끝 장면과 같은 그림)
//   판이 돌면 사진 밖이 보이므로, 사진 둘레를 거울처럼 뒤집어 이어 붙인 큰 판(pad)을 돌려 그림 (뒤섞인 동안이라 티 안 남)
//   어느 시각이든 바로 그림 (앞 장면에 기대지 않음) — app.js 가 시각을 건너뛰며 미리 그려 봄
const T_END = 5.6;                                             // 마지막 띠가 멈추고 착까지 끝나는 때 (그 뒤는 app.js 의 끝 멈춤 3.5초 — 같은 장면을 더 넣으면 용량만 커짐)
const SPIN = 26;                                               // 같이 돌 때 빠르기 (장면마다 도)
const T0 = 1.5, TL1 = 5.35, D = 1.0;                           // 처음 띠가 느려지기 시작 · 마지막(가운데) 띠가 멈춤 · 느려지는 시간
const EPS = 0.22, PW = 1.0, CLICK = 0.24;                      // 멈출 때 남은 빠르기 비율(착) · 느려지는 모양 · 지나쳤다 돌아오는 시간
const SM = 0.11;                                               // 끌림: 흐린 그림 간격 (한 장면에 도는 각도의 비율)
const FADE0 = 0, FADE = 0.2;                                   // 멈추는 띠의 레코드 느낌이 걷히는 때 (멈춘 시각 기준) · 걸리는 시간

export async function make(c, K) {
  const { L, focus, tr } = c, { VW, VH, Wm, Hm } = L, { canvas, clamp, free, mulberry32, PI } = K, FPS = K.CFG.FPS;
  const MIN = Math.min(VW, VH), rnd = mulberry32(71), LABEL = 'LP판 준비하는 중…';
  const ss = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  tr?.tick(1, LABEL); await K.sleep0();

  // 1) 짤 모자이크 → 화면 크기 (반씩 줄여서 반짝임 없게) · 큰 그림은 바로 비움 (아이폰 메모리 — 그려지기와 같음)
  const img = canvas(VW, VH);
  {
    let cur = c.mos;
    while (cur.width / 2 >= VW) {
      const n = canvas(Math.round(cur.width / 2), Math.round(cur.height / 2)), x = n.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, n.width, n.height);
      if (cur !== c.mos) free(cur);
      cur = n;
    }
    const x = img.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, VW, VH);
    if (cur !== c.mos) free(cur);
    free(c.mos);
  }

  // 2) 판 가운데 = 누른 곳 (가장자리에 너무 붙지 않게) · 띠는 가장 먼 모서리까지 (네모 화면을 다 덮음)
  const Cx = Math.round(clamp(focus[0] / Wm * VW, VW * 0.22, VW * 0.78)), Cy = Math.round(clamp(focus[1] / Hm * VH, VH * 0.22, VH * 0.78));
  const RO = Math.max(Math.hypot(Cx, Cy), Math.hypot(VW - Cx, Cy), Math.hypot(Cx, VH - Cy), Math.hypot(VW - Cx, VH - Cy)) + 2;
  const N = clamp(Math.round(RO / (MIN / 15.5)), 12, 18);
  const rLab = Math.min(MIN * 0.14, RO * 0.2);                 // 가운데 라벨 (얼굴이 통째로 돌다가 맨 마지막에 멈춤)
  const wd = Array.from({ length: N - 1 }, () => 0.8 + 0.45 * rnd());   // 띠 굵기 (곡 길이처럼 조금씩 다르게)
  const wsum = wd.reduce((a, b) => a + b, 0), rr = [0, rLab];
  for (let i = 0; i < N - 1; i++) rr.push(rr[i + 1] + wd[i] * (RO - rLab) / wsum);
  rr[N] = RO;

  // 3) 돌릴 큰 판: 화면 사진을 가운데 두고, 둘레는 거울처럼 뒤집어 이어 붙임 (짤 칸 줄이 그대로 이어짐)
  const S = 2 * Math.ceil(RO) + 4, H = S / 2, ox = H - Cx, oy = H - Cy;
  const pad = canvas(S, S), pc = pad.getContext('2d');
  for (let j = Math.floor(-oy / VH); oy + j * VH < S; j++) for (let i = Math.floor(-ox / VW); ox + i * VW < S; i++) {
    const sx = i & 1 ? -1 : 1, sy = j & 1 ? -1 : 1;
    pc.setTransform(sx, 0, 0, sy, ox + i * VW + (sx < 0 ? VW : 0), oy + j * VH + (sy < 0 ? VH : 0));
    pc.drawImage(img, 0, 0);
  }
  pc.setTransform(1, 0, 0, 1, 0, 0);
  await K.sleep0();

  // 4) 시간표: 바깥 띠부터 느려져서 멈춤 (i = 0 이 가운데 · N-1 이 가장 바깥)
  //    남은 각도를 '멈추는 시각에서 거꾸로' 정함 → 꼭 0도에 멈춤 · 같이 도는 동안 띠마다 처음 각도가 저절로 뒤섞임 (+ 조금 흔들어 더 섞음)
  //    라벨(얼굴)은 더 늦게까지 빨리 돌다가 짧게 멈추고, 착도 조금 크게
  const W0 = SPIN * PI / 180 * FPS, DD = Array.from({ length: N }, (_, i) => (i === 0 ? D * 0.8 : D));
  const FD = DD.map((d) => W0 * d * (EPS + (1 - EPS) / (PW + 1))), BO = DD.map((d, i) => W0 * EPS * CLICK / PI * (i === 0 ? 1.5 : 1));
  //    멈추는 간격: 화면에 많이 보이는 띠일수록 길게 (모서리에 조금만 걸친 바깥 띠는 빨리빨리) · 가운데(얼굴)는 한 박자 더 쉬고
  const TL = new Float64Array(N), CJ = new Float64Array(N), OFF = new Float64Array(N), gapW = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const rm = (rr[i] + rr[i + 1]) / 2;
    let vis = 0; for (let k = 0; k < 96; k++) { const a = 2 * PI * k / 96, x = Cx + rm * Math.cos(a), y = Cy + rm * Math.sin(a); if (x >= 0 && x < VW && y >= 0 && y < VH) vis++; }
    gapW[i] = (0.4 + 0.6 * vis / 96) * (i === 0 ? 1.5 : 1);
  }
  let gsum = 0; for (let i = 0; i < N - 1; i++) gsum += gapW[i];
  TL[N - 1] = T0 + D;
  for (let i = N - 2; i >= 0; i--) TL[i] = TL[i + 1] + (TL1 - T0 - D) * gapW[i] / gsum;
  for (let i = 0; i < N; i++) {
    CJ[i] = (rnd() * 2 - 1) * 0.15 * W0 * DD[i];
    OFF[i] = -(FD[i] + CJ[i] + W0 * (TL[i] - DD[i]));
  }
  const TB = TL[N - 1] - DD[N - 1];                            // 이때까지는 판 전체가 같이 돎
  function ang(i, t) {                                         // 띠 i 의 [각도, 빠르기(초당)] · 0 = 제자리
    const tau = TL[i] - t, d = DD[i];
    if (tau >= d) return [OFF[i] + W0 * t, W0];
    if (tau >= 0) {
      const u = tau / d;
      return [-(W0 * d * (EPS * u + (1 - EPS) * Math.pow(u, PW + 1) / (PW + 1)) + CJ[i] * u * u * (3 - 2 * u)),
        W0 * (EPS + (1 - EPS) * Math.pow(u, PW)) + CJ[i] * 6 * u * (1 - u) / d];
    }
    const s = -tau / CLICK;                                    // 착: 살짝 지나쳤다 돌아옴
    return s < 1 ? [BO[i] * Math.sin(PI * s) * (1 - s), 0] : [0, 0];
  }

  function ring(x, cx, cy, i, disc) {                          // 띠 i 모양 (바깥은 1px 넉넉히 → 나중에 그리는 안쪽 띠가 이음매를 덮음) · disc: 가운데부터 통째로
    x.beginPath(); x.arc(cx, cy, rr[i + 1] + 1, 0, 2 * PI);
    if (i > 0 && !disc) { x.moveTo(cx + rr[i], cy); x.arc(cx, cy, rr[i], 0, 2 * PI); }
  }
  function rot(x, im, cx, cy, a, alpha) {                      // 큰 판(가운데 = H,H)을 (cx, cy) 기준으로 a 만큼 돌려 그림
    const co = Math.cos(a), si = Math.sin(a);
    x.globalAlpha = alpha; x.setTransform(co, si, -si, co, cx, cy); x.drawImage(im, -H, -H);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
  }

  // 5) 뒤섞인 판 (같이 돌 때 모습): 띠마다 처음 각도로 돌려 붙여 둠 → 같이 도는 동안은 이 판 한 장만 돌리면 됨
  const rec = canvas(S, S), rc = rec.getContext('2d');
  rc.imageSmoothingQuality = 'high';
  for (let i = N - 1; i >= 0; i--) { rc.save(); ring(rc, H, H, i, false); rc.clip('evenodd'); rot(rc, pad, H, H, OFF[i], 1); rc.restore(); }
  await K.sleep0();

  // 6) 레코드 느낌 (가만히 있는 그림 한 장 — 소리골은 동그래서 돌아도 같고, 빛 반사는 원래 안 돎)
  //    어둡게 · 소리골(가는 동심원) · 곡 사이 틈(띠 경계) · 빛 반사 두 줄기(나비 모양) · 가운데 라벨(얼굴)은 매끈하게 · 가운데 구멍
  const vin = canvas(VW, VH);
  {
    const PG = Math.max(4, MIN / 200), GW = Math.max(1.4, MIN / 560), RH = Math.max(5, MIN * 0.0095), wAvg = RO / N;
    const Q = 4, M = Math.ceil((RO + 4) * Q), aR = new Float32Array(M), shR = new Float32Array(M), glR = new Float32Array(M);
    for (let q = 0; q < M; q++) {                              // 반지름마다 (1/4 px 간격)
      const r = q / Q, lab = r < rr[1];
      let db = 1e9; for (let i = 1; i < N; i++) db = Math.min(db, Math.abs(r - rr[i]));
      const gap = ss(1 - db / GW), g = 0.5 + 0.5 * Math.cos(2 * PI * r / PG), gr = lab ? 0 : 1 - gap;
      const gw = lab ? 0.3 : ss((r - rr[1]) / (2.5 * wAvg)) * (1 - 0.3 * r / RO);
      aR[q] = (lab ? 0.26 : 0.48) + 0.07 * (1 - g) * gr + 0.2 * gap;
      shR[q] = 0.03 * g * gr;
      glR[q] = gw * (lab ? 1 : (0.35 + 0.65 * g) * gr + 1.6 * gap);
    }
    const GA = -0.95, GX = Math.cos(GA), GY = Math.sin(GA), TC = [6, 6, 9];
    const vx = vin.getContext('2d'), im = vx.createImageData(VW, VH), d = im.data;
    for (let y = 0, o = 0; y < VH; y++) for (let x = 0; x < VW; x++, o += 4) {
      const dx = x + 0.5 - Cx, dy = y + 0.5 - Cy, r = Math.hypot(dx, dy), q = Math.min(M - 1, (r * Q) | 0);
      const ct = r > 0 ? (dx * GX + dy * GY) / r : 0, s2 = 1 - ct * ct;
      const lobe = (ct > 0 ? 1 : 0.75) * (0.55 * Math.exp(-s2 / 0.035) + 0.14 * Math.exp(-s2 / 0.25));
      const a = aR[q], l = Math.min(0.72, shR[q] + lobe * glR[q] + 0.3 * Math.exp(-(((r - RH - 1.2) / 1.1) ** 2)));
      let A = 1 - (1 - a) * (1 - l), P0 = TC[0] * a * (1 - l) + 255 * l, P1 = TC[1] * a * (1 - l) + 255 * l, P2 = TC[2] * a * (1 - l) + 255 * l;
      const h = 1 - ss(r - RH + 0.5);                          // 구멍
      if (h > 0) { A = A * (1 - h) + h; P0 = P0 * (1 - h) + 10 * h; P1 = P1 * (1 - h) + 10 * h; P2 = P2 * (1 - h) + 12 * h; }
      d[o] = P0 / A; d[o + 1] = P1 / A; d[o + 2] = P2 / A; d[o + 3] = A * 255;
    }
    vx.putImageData(im, 0, 0);
  }

  // 7) 그리기
  const [frame, fx] = K.frameCanvas(L);
  const ov = canvas(VW, VH), oc = ov.getContext('2d'), m = new Float64Array(N);
  function spun(im, a, v, rmax) {                              // 돌려 그리기 · 빠르면 뒤에 흐린 그림 두 장 (끌림)
    const s = v / FPS * SM;
    if (s * rmax > 1.5) { rot(fx, im, Cx, Cy, a - 2 * s, 1); rot(fx, im, Cx, Cy, a - s, 0.62); rot(fx, im, Cx, Cy, a, 0.6); }
    else rot(fx, im, Cx, Cy, a, 1);
  }
  function overlay(t) {                                        // 레코드 느낌 — 띠마다 멈추면 걷힘 (동그란 그라데이션으로 띠마다 진하기)
    let lo = 1, hi = 0;
    for (let i = 0; i < N; i++) { m[i] = 1 - ss((t - TL[i] - FADE0) / FADE); lo = Math.min(lo, m[i]); hi = Math.max(hi, m[i]); }
    if (hi < 0.002) return;
    if (lo > 0.998) { fx.drawImage(vin, 0, 0); return; }
    oc.clearRect(0, 0, VW, VH); oc.drawImage(vin, 0, 0);
    const RG = RO + 2, g = oc.createRadialGradient(Cx, Cy, 0, Cx, Cy, RG);
    for (let i = 0; i < N; i++) {
      const col = `rgba(0,0,0,${m[i].toFixed(4)})`;
      g.addColorStop(i ? Math.min(1, (rr[i] + 1) / RG) : 0, col);
      g.addColorStop(Math.min(1, (rr[i + 1] - 1) / RG), col);
    }
    oc.globalCompositeOperation = 'destination-in'; oc.fillStyle = g; oc.fillRect(0, 0, VW, VH); oc.globalCompositeOperation = 'source-over';
    fx.drawImage(ov, 0, 0);
  }
  function render(t) {
    if (t >= T_END) { fx.drawImage(img, 0, 0); return frame; }   // 끝 = 자르지 않은 모자이크 한 장
    if (t < TB) spun(rec, W0 * t, W0, RO);                     // 판 전체가 같이 도는 중
    else {
      fx.drawImage(img, 0, 0);                                 // 멈춘 띠 = 사진 그대로
      for (let i = N - 1; i >= 0; i--) {                       // 바깥 띠부터 (안쪽 띠가 경계를 덮음)
        if (TL[i] - t >= DD[i]) {                              // 여기부터 안쪽은 아직 같이 도는 중 → 뒤섞인 판 한 장으로
          fx.save(); ring(fx, Cx, Cy, i, true); fx.clip(); spun(rec, W0 * t, W0, rr[i + 1]); fx.restore();
          break;
        }
        const [a, v] = ang(i, t);
        if (Math.abs(a) < 1e-4) continue;
        fx.save(); ring(fx, Cx, Cy, i, false); fx.clip('evenodd'); spun(pad, a, v, rr[i + 1]); fx.restore();
      }
    }
    overlay(t);
    return frame;
  }
  tr?.tick(1, LABEL);
  return { T_END, render, reset() {}, finalFrame: () => render(T_END + 1), dispose: () => free(frame, img, pad, rec, vin, ov) };
}
