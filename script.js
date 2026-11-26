/* Ahmedabad to Mumbai Bus Ride: animation, map, readouts and soundtrack */
(() => {
"use strict";
/* ---------- helpers ---------- */
const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
const $ = id => document.getElementById(id);
const setText = (el, v) => { if (el.textContent !== v) el.textContent = v; };

/* ---------- route data (typical day coach) ---------- */
const STOPS = [
  { name: "Ahmedabad", sub: "Paldi bus stand", lon: 72.565, lat: 23.012, t: 0, km: 0, major: true },
  { name: "Nadiad", lon: 72.861, lat: 22.693, t: 55, km: 58 },
  { name: "Vadodara", lon: 73.181, lat: 22.307, t: 105, dwell: 10, km: 112, major: true },
  { name: "Bharuch", lon: 72.991, lat: 21.705, t: 180, km: 186, major: true },
  { name: "Ankleshwar", lon: 73.003, lat: 21.626, t: 192, dwell: 20, km: 196, meal: true },
  { name: "Surat", lon: 72.831, lat: 21.170, t: 280, dwell: 10, km: 265, major: true },
  { name: "Navsari", lon: 72.952, lat: 20.951, t: 318, km: 296 },
  { name: "Valsad", lon: 72.928, lat: 20.599, t: 355, km: 336, major: true },
  { name: "Vapi", lon: 72.905, lat: 20.372, t: 383, dwell: 30, km: 362, meal: true, major: true },
  { name: "Achhad", lon: 72.855, lat: 20.165, t: 436, km: 388 },
  { name: "Charoti", lon: 72.870, lat: 19.930, t: 460, km: 416 },
  { name: "Manor", lon: 72.915, lat: 19.725, t: 482, km: 440 },
  { name: "Vasai–Virar", lon: 72.885, lat: 19.430, t: 515, km: 475 },
  { name: "Ghodbunder", lon: 72.905, lat: 19.290, t: 535, km: 493 },
  { name: "Borivali", lon: 72.860, lat: 19.230, t: 550, km: 502 },
  { name: "Andheri", lon: 72.855, lat: 19.115, t: 572, km: 516 },
  { name: "Bandra", lon: 72.845, lat: 19.060, t: 585, km: 523 },
  { name: "Mumbai Central", lon: 72.820, lat: 18.970, t: 600, km: 534, major: true }
];
STOPS.forEach(s => { s.dep = s.t + (s.dwell || 0); });
const TOTAL_MIN = 600, TOTAL_KM = 534;
const ACHHAD_KM = 388;

function stateAt(m) {
  for (let i = 0; i < STOPS.length; i++) {
    const s = STOPS[i];
    if (m < s.t) {
      const p = STOPS[i - 1];
      const f = (m - p.dep) / (s.t - p.dep);
      return { lon: lerp(p.lon, s.lon, f), lat: lerp(p.lat, s.lat, f), km: lerp(p.km, s.km, f),
               moving: true, from: i - 1, to: i, speed: (s.km - p.km) / (s.t - p.dep) * 60 };
    }
    if (m < s.dep) return { lon: s.lon, lat: s.lat, km: s.km, moving: false, halted: i, from: i, to: i + 1, speed: 0 };
  }
  const L = STOPS[STOPS.length - 1];
  return { lon: L.lon, lat: L.lat, km: L.km, moving: false, arrived: true, from: STOPS.length - 1, to: STOPS.length - 1, speed: 0 };
}

/* ---------- sun & weather (late November) ---------- */
const DEC = -19.9 * RAD, EOT = 14; // declination and equation of time, ~21 Nov
const solarNoon = lon => 12 + (82.5 - lon) * 4 / 60 - EOT / 60;
function sunElev(lat, lon, t) {
  const H = (t - solarNoon(lon)) * 15 * RAD, p = lat * RAD;
  return Math.asin(Math.sin(p) * Math.sin(DEC) + Math.cos(p) * Math.cos(DEC) * Math.cos(H)) / RAD;
}
function sunTimes(lat, lon) {
  const p = lat * RAD;
  const c = (Math.sin(-0.833 * RAD) - Math.sin(p) * Math.sin(DEC)) / (Math.cos(p) * Math.cos(DEC));
  const H0 = Math.acos(clamp(c, -1, 1)) / RAD / 15, n = solarNoon(lon);
  return [n - H0, n + H0, n];
}
function temperature(lat, lon, t) {
  const f = clamp((23.02 - lat) / (23.02 - 18.97), 0, 1);
  const tmin = 17 + 6 * f, tmax = 32 + 2 * f;
  const [sr] = sunTimes(lat, lon);
  const h = ((t % 24) + 24) % 24, peak = 14.5;
  if (h >= sr && h <= peak) return tmin + (tmax - tmin) * Math.sin(Math.PI / 2 * (h - sr) / (peak - sr));
  const x = ((h - peak) + 24) % 24;
  return tmin + (tmax - tmin) * Math.exp(-x / 4.8);
}
function mistAt(t, km, sr) {
  const h = ((t % 24) + 24) % 24;
  const m = h < sr + 0.5 ? smooth(2.5, sr + 0.5, h) : 1 - smooth(sr + 0.5, sr + 2.8, h);
  const region = km < 300 ? 1 : lerp(1, 0.45, smooth(300, 480, km));
  return 0.62 * m * region;
}
function hazeAt(t, km) {
  const h = ((t % 24) + 24) % 24;
  return (0.22 + 0.2 * smooth(470, 534, km)) * smooth(12.5, 15.5, h) * (1 - smooth(18.3, 19.6, h));
}
const SKY = [
  [-18, "#04060d", "#0a0f1f"], [-12, "#081029", "#17204a"], [-6, "#15234f", "#573e70"],
  [-2, "#29447f", "#d6765d"], [2, "#456fab", "#f1a25d"], [8, "#5a8fcb", "#f2cf9d"],
  [20, "#4b8ad2", "#c2ddef"], [50, "#3a7bcd", "#d2e7f6"]
].map(r => [r[0], hex(r[1]), hex(r[2])]);
function skyAt(e) {
  if (e <= SKY[0][0]) return { top: SKY[0][1], bot: SKY[0][2] };
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i], b = SKY[i + 1];
    if (e <= b[0]) { const f = (e - a[0]) / (b[0] - a[0]); return { top: mix(a[1], b[1], f), bot: mix(a[2], b[2], f) }; }
  }
  const z = SKY[SKY.length - 1]; return { top: z[1], bot: z[2] };
}
const lightOf = e => smooth(-7, 13, e);
const warmthOf = e => (e > -5 && e < 16) ? clamp(1 - Math.abs(e - 2) / 13, 0, 1) : 0;
function skyWords(e, h, mist, haze, temp) {
  const morning = h < 12.4;
  if (e < -12) return temp < 20 ? "Clear, cool night" : "Clear night";
  if (e < -0.8) return morning ? "Dawn twilight" : "Dusk";
  if (e < 7) return morning ? (mist > 0.25 ? "Misty sunrise" : "Sunrise, clear") : "Sunset glow";
  if (morning && mist > 0.18) return "Morning mist lifting";
  if (morning && e < 30) return "Clear, fresh morning";
  if (e < 16 && !morning) return "Golden hour";
  if (haze > 0.22) return "Warm, hazy afternoon";
  return "Sunny and dry";
}
function mealName(h) {
  h = ((h % 24) + 24) % 24;
  if (h >= 6 && h < 10.5) return "Breakfast";
  if (h >= 10.5 && h < 11.5) return "Tea";
  if (h >= 11.5 && h < 15.5) return "Lunch";
  if (h >= 15.5 && h < 18.5) return "Tea";
  if (h >= 18.5 && h < 23) return "Dinner";
  return "Rest";
}

/* ---------- time formatting ---------- */
function fmt(t, withAmPm = true) {
  const h24 = ((t % 24) + 24) % 24;
  let h = Math.floor(h24), m = Math.round((h24 - h) * 60);
  if (m === 60) { m = 0; h = (h + 1) % 24; }
  const ap = h < 12 ? "AM" : "PM", h12 = ((h + 11) % 12) + 1;
  return withAmPm ? `${h12}:${String(m).padStart(2, "0")} ${ap}` : [`${h12}:${String(m).padStart(2, "0")}`, ap];
}
const dur = m => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")} m`;

/* ---------- state ---------- */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let depHour = 6, simMin = 0, rate = 10, playing = !reduceMotion, lastTs = null;
let events = [], shownEvents = -1;

/* ---------- events (route + sunrise/sunset) ---------- */
function buildEvents() {
  const clockAt = m => depHour + m / 60;
  const ev = [
    [0, "Departed Ahmedabad, Paldi bus stand"],
    [28, "On the Ahmedabad–Vadodara Expressway"],
    [87, "Crossed the Mahi river near Vasad"],
    [105, "Stop at Vadodara, 10 min"],
    [186, "Crossed the Narmada, Bharuch to Ankleshwar"],
    [192, `${mealName(clockAt(192))} halt at Ankleshwar, 20 min`],
    [268, "Crossed the Tapi at Kamrej"],
    [280, "Stop at Surat, 10 min"],
    [383, `${mealName(clockAt(383))} halt at Vapi, 30 min`],
    [436, "Entered Maharashtra at Achhad"],
    [465, "Sahyadri foothills rise to the east"],
    [552, "Slow traffic on the Western Express Highway"],
    [600, "Arrived at Mumbai Central"]
  ];
  let prev = null;
  for (let m = 0; m <= TOTAL_MIN; m++) {
    const st = stateAt(m), e = sunElev(st.lat, st.lon, clockAt(m)) + 0.833;
    if (prev !== null && (prev < 0) !== (e < 0)) {
      const where = nearestName(st);
      ev.push([m, e >= 0 ? `Sunrise ${where}` : `Sunset ${where}`]);
    }
    prev = e;
  }
  ev.sort((a, b) => a[0] - b[0]);
  events = ev;
  shownEvents = -1;
}
function nearestName(st) {
  let best = STOPS[0], d = 1e9;
  for (const s of STOPS) { const dd = Math.abs(s.km - st.km); if (dd < d) { d = dd; best = s; } }
  return d < 6 ? `at ${best.name}` : `near ${best.name}`;
}

/* ---------- scene ---------- */
const cv = $("scene"), ctx = cv.getContext("2d");
let W = 0, H = 0, s = 1;
function resize() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  W = r.width; H = r.height; s = H / 300;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(() => { resize(); render(performance.now()); }).observe(cv);

const STARS = Array.from({ length: 150 }, (_, i) => [hash(i * 1.7), Math.pow(hash(i * 3.3 + 1), 1.4), 0.5 + hash(i * 5.1) * 1.2, hash(i * 9.9) * 6.28]);
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: hash(i * 3.1 + 2), y: 0.1 + hash(i * 5.7) * 0.3, sz: 0.6 + hash(i * 7.3) * 0.8, n: 4 + Math.floor(hash(i * 2.2) * 3) }));
const CITIES = [
  { km: 0, size: 1, r: 12 }, { km: 58, size: .35, r: 4 }, { km: 112, size: .85, r: 8 }, { km: 186, size: .5, r: 5 },
  { km: 196, size: .45, r: 4 }, { km: 265, size: .95, r: 9 }, { km: 296, size: .4, r: 4 }, { km: 336, size: .4, r: 4 },
  { km: 362, size: .6, r: 5 }
];
function urbanity(k) {
  let u = 0;
  for (const c of CITIES) u = Math.max(u, c.size * Math.exp(-Math.pow((k - c.km) / c.r, 2)));
  return Math.max(u, smooth(466, 486, k) * 1.05);
}
const NIGHT = [9, 15, 32];
function tint(c, L, warm) {
  const night = mix([c[0] * .13, c[1] * .13, c[2] * .16], NIGHT, .5);
  let o = mix(night, c, L);
  if (warm > 0) o = mix(o, [255, 150, 90], warm * .16 * L);
  return o;
}
const C = {
  hill: hex("#6f8a86"), fieldFar: hex("#a3a76c"), fieldNear: hex("#a99a63"), green: hex("#7f9a55"),
  tree: hex("#4f6b3a"), palm: hex("#5d6f33"), trunk: hex("#6b5038"), road: hex("#3a3d45"), edge: hex("#d7cfb8"),
  bldg: [hex("#cdbfa9"), hex("#b7a998"), hex("#d9d2c4"), hex("#a9b2b8")], accent: hex("#f2a541"),
  bus: hex("#f3f0e8"), skirt: hex("#464a56"), pole: hex("#8a8578")
};

function render(now) {
  if (!W) return;
  const st = stateAt(simMin);
  const clockT = depHour + simMin / 60;
  const e = sunElev(st.lat, st.lon, clockT);
  const sky = skyAt(e), L = lightOf(e), warm = warmthOf(e);
  const [sr, ss, noon] = sunTimes(st.lat, st.lon);
  const mist = mistAt(clockT, st.km, sr), haze = hazeAt(clockT, st.km);
  const km = st.km, rt = now / 1000;
  const hy = H * 0.58, roadTop = H * 0.80, busX = W * 0.40;

  /* sky */
  const bot = mix(sky.bot, [236, 228, 214], haze * .55 * L);
  let g = ctx.createLinearGradient(0, 0, 0, hy);
  g.addColorStop(0, css(sky.top)); g.addColorStop(1, css(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hy + 2);

  /* stars */
  const starA = clamp((-e - 5) / 8, 0, 1);
  if (starA > 0) {
    for (const [x, y, r, ph] of STARS) {
      const tw = reduceMotion ? 1 : 0.65 + 0.35 * Math.sin(rt * 2 + ph);
      ctx.fillStyle = `rgba(235,240,255,${starA * tw * (1 - y * .6)})`;
      ctx.fillRect(x * W, y * hy * .9, r * s * .9, r * s * .9);
    }
  }

  /* sun and moon on a stylised arc: east on the left, west on the right */
  let Hd = ((clockT - noon) * 15) % 360; if (Hd > 180) Hd -= 360; if (Hd < -180) Hd += 360;
  const arcX = h => W * (0.5 + clamp(h / 220, -0.5, 0.5) * 0.92);
  const arcY = el => hy - (el / 55) * (hy - H * 0.07);
  if (e < -3) {
    const mH = Hd > 0 ? Hd - 180 : Hd + 180, mE = clamp(-e * .75, -5, 45);
    const mx = arcX(mH), my = arcY(mE), mr = 9 * s, a = clamp((-e - 3) / 6, 0, 1);
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 6);
    mg.addColorStop(0, `rgba(200,215,255,${.25 * a})`); mg.addColorStop(1, "rgba(200,215,255,0)");
    ctx.fillStyle = mg; ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
    ctx.fillStyle = `rgba(236,238,245,${a})`; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(190,196,212,${a * .5})`; ctx.beginPath(); ctx.arc(mx - mr * .3, my - mr * .2, mr * .25, 0, 7); ctx.arc(mx + mr * .35, my + mr * .3, mr * .18, 0, 7); ctx.fill();
  }
  if (e > -4) {
    const sx = arcX(Hd), sy = arcY(e), sr2 = 13 * s;
    const low = 1 - smooth(0, 25, e);
    const glowC = mix([255, 244, 214], [255, 160, 90], low);
    const gg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr2 * (8 + low * 6));
    gg.addColorStop(0, css(glowC, .55)); gg.addColorStop(.25, css(glowC, .18)); gg.addColorStop(1, css(glowC, 0));
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, hy + 2);
    ctx.fillStyle = css(mix([255, 250, 236], [255, 196, 120], low));
    ctx.beginPath(); ctx.arc(sx, sy, sr2, 0, Math.PI * 2); ctx.fill();
  }

  /* clouds: more over the south Gujarat and Konkan coast */
  const coast = smooth(240, 320, km);
  const nClouds = Math.round(2 + 5 * coast);
  const cloudC = mix(mix([38, 46, 70], [250, 250, 252], L), [246, 168, 138], warm * .55);
  for (let i = 0; i < nClouds; i++) {
    const c = CLOUDS[i];
    const x = ((((c.x + rt * .004 * (reduceMotion ? 0 : 1) - km * .0012) % 1.4) + 1.4) % 1.4 - .2) * W;
    const y = c.y * hy, z = c.sz * s;
    ctx.fillStyle = css(cloudC, .78 * (1 - mist * .5));
    ctx.beginPath();
    for (let j = 0; j < c.n; j++) {
      const r = (11 + hash(i * 10 + j) * 10) * z;
      ctx.moveTo(x + (j - c.n / 2) * 15 * z + r, y - (j % 2) * 6 * z);
      ctx.arc(x + (j - c.n / 2) * 15 * z, y - (j % 2) * 6 * z, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  /* far hills (Pavagadh near Vadodara, Sahyadri south of the border) */
  const PXF = 6 * s;
  const hillC = mix(tint(C.hill, L, warm), bot, .38 + mist * .3);
  ctx.fillStyle = css(hillC);
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 4; x += 4) {
    const k = km + (x - busX) / PXF;
    const base = 5 + 9 * noise1(k / 7);
    const pav = 50 * Math.exp(-Math.pow((k - 122) / 8, 2)) * (.8 + .2 * noise1(k / 2));
    const sah = 78 * smooth(395, 450, k) * (.4 + .6 * noise1(k / 5.2)) * (1 - .35 * smooth(500, 534, k));
    ctx.lineTo(x, hy - (base + pav + sah) * s);
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

  /* mid ground fields */
  const fieldFar = tint(mix(C.fieldFar, C.green, smooth(280, 360, km)), L, warm);
  const fieldNear = tint(mix(C.fieldNear, C.green, smooth(280, 360, km) * .7), L, warm);
  g = ctx.createLinearGradient(0, hy, 0, roadTop);
  g.addColorStop(0, css(mix(fieldFar, bot, .3))); g.addColorStop(1, css(fieldNear));
  ctx.fillStyle = g; ctx.fillRect(0, hy, W, roadTop - hy + 1);

  /* back mist band */
  if (mist > 0.01) {
    const mc = mix(bot, [255, 255, 255], .35);
    g = ctx.createLinearGradient(0, hy - 50 * s, 0, roadTop);
    g.addColorStop(0, css(mc, 0)); g.addColorStop(.45, css(mc, mist * .8)); g.addColorStop(1, css(mc, mist * .25));
    ctx.fillStyle = g; ctx.fillRect(0, hy - 50 * s, W, roadTop - hy + 50 * s);
  }

  /* mid objects: trees, palms, buildings */
  const PXM = 16 * s, slot = 0.5, baseY = hy + 20 * s;
  const kMin = km + (-40 - busX) / PXM, kMax = km + (W + 40 - busX) / PXM;
  const trunkC = tint(C.trunk, L, warm), treeC = tint(C.tree, L, warm), palmC = tint(C.palm, L, warm);
  const bCols = C.bldg.map(b => mix(tint(b, L, warm), bot, .12));
  const nightA = 1 - L;
  for (let idx = Math.floor(kMin / slot); idx <= Math.ceil(kMax / slot); idx++) {
    const k = idx * slot, r1 = hash(idx * 1.37 + .1), r2 = hash(idx * 2.71 + .3), r3 = hash(idx * 4.13 + .7);
    const x = busX + (k - km) * PXM + (r3 - .5) * 6 * s;
    const urb = urbanity(k);
    if (r1 < urb * .95) {
      const tall = smooth(490, 530, k);
      const bw = (7 + r2 * 10) * s, bh = (12 + r3 * (26 + urb * 28) + tall * r3 * r3 * 120) * s;
      ctx.fillStyle = css(bCols[Math.floor(r2 * 4) % 4]);
      ctx.fillRect(x, baseY - bh, bw, bh);
      if (nightA > .35 && bh > 14 * s) {
        ctx.fillStyle = `rgba(255,210,122,${(nightA - .35) * 1.3})`;
        for (let wy = baseY - bh + 4 * s, row = 0; wy < baseY - 4 * s; wy += 5 * s, row++)
          for (let col = 0; col < 3; col++)
            if (hash(idx * 31 + row * 7 + col) < .32) ctx.fillRect(x + (1.5 + col * (bw / s - 3) / 3) * s, wy, 1.6 * s, 1.8 * s);
      }
    } else if (r2 < .55 + .2 * (1 - urb)) {
      const sz = (.8 + r3 * .6) * s;
      if (k > 250 && r3 < .55) {
        const top = baseY - 30 * sz, lean = (r1 - .5) * 8 * sz;
        ctx.strokeStyle = css(trunkC); ctx.lineWidth = 1.8 * sz;
        ctx.beginPath(); ctx.moveTo(x, baseY); ctx.quadraticCurveTo(x + lean * .2, baseY - 15 * sz, x + lean, top); ctx.stroke();
        ctx.strokeStyle = css(palmC); ctx.lineWidth = 2 * sz;
        for (let f = 0; f < 6; f++) {
          const a = -Math.PI / 2 + (f - 2.5) * .55;
          ctx.beginPath(); ctx.moveTo(x + lean, top);
          ctx.quadraticCurveTo(x + lean + Math.cos(a) * 8 * sz, top + Math.sin(a) * 8 * sz - 2 * sz, x + lean + Math.cos(a) * 13 * sz, top + Math.sin(a) * 6 * sz + 6 * sz);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = css(trunkC); ctx.fillRect(x - 1 * sz, baseY - 9 * sz, 2 * sz, 9 * sz);
        ctx.fillStyle = css(treeC); ctx.beginPath();
        ctx.ellipse(x, baseY - 14 * sz, 10 * sz, 7.5 * sz, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 5 * sz, baseY - 11 * sz, 6 * sz, 5 * sz, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* front mist veil on mid ground */
  if (mist > 0.01) {
    const mc = mix(bot, [255, 255, 255], .45);
    g = ctx.createLinearGradient(0, hy - 30 * s, 0, roadTop);
    g.addColorStop(0, css(mc, mist * .5)); g.addColorStop(1, css(mc, mist * .15));
    ctx.fillStyle = g; ctx.fillRect(0, hy - 30 * s, W, roadTop - hy + 30 * s);
  }

  /* near layer: poles with wires, NH milestones */
  const PXN = 34 * s;
  const nkMin = km + (-60 - busX) / PXN, nkMax = km + (W + 60 - busX) / PXN;
  const poleC = tint(C.pole, L, warm), pStep = 1.2;
  let prevTop = null;
  ctx.lineCap = "round";
  for (let i = Math.floor(nkMin / pStep); i <= Math.ceil(nkMax / pStep); i++) {
    const x = busX + (i * pStep - km) * PXN, top = roadTop - 58 * s;
    ctx.strokeStyle = css(poleC); ctx.lineWidth = 2.2 * s;
    ctx.beginPath(); ctx.moveTo(x, roadTop); ctx.lineTo(x, top); ctx.moveTo(x - 7 * s, top + 4 * s); ctx.lineTo(x + 7 * s, top + 4 * s); ctx.stroke();
    if (prevTop !== null) {
      ctx.strokeStyle = css(poleC, .65); ctx.lineWidth = .8 * s;
      for (const dx of [-6, 6]) {
        ctx.beginPath(); ctx.moveTo(prevTop + dx * s, top + 4 * s);
        ctx.quadraticCurveTo((prevTop + x) / 2 + dx * s, top + 14 * s, x + dx * s, top + 4 * s); ctx.stroke();
      }
    }
    prevTop = x;
    if (nightA > .3 && urbanity(i * pStep) > .3) {
      const a = (nightA - .3) * 1.2;
      const lg = ctx.createRadialGradient(x + 7 * s, top + 6 * s, 0, x + 7 * s, top + 6 * s, 30 * s);
      lg.addColorStop(0, `rgba(255,205,120,${.7 * a})`); lg.addColorStop(1, "rgba(255,205,120,0)");
      ctx.fillStyle = lg; ctx.fillRect(x - 25 * s, top - 25 * s, 64 * s, 64 * s);
    }
  }
  ctx.font = `600 ${Math.max(8, 8.5 * s)}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.textAlign = "center";
  for (let n = Math.floor((TOTAL_KM - nkMax) / 10); n <= Math.ceil((TOTAL_KM - nkMin) / 10); n++) {
    if (n < 0) continue;
    const k = TOTAL_KM - n * 10, x = busX + (k - km) * PXN;
    const w = 20 * s, h = 26 * s, y = roadTop - h + 1 * s;
    ctx.fillStyle = css(tint([236, 232, 222], Math.max(L, .25), warm));
    ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, [w / 2, w / 2, 1, 1]); ctx.fill();
    ctx.fillStyle = css(tint([238, 186, 40], Math.max(L, .25), warm));
    ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h * .38, [w / 2, w / 2, 0, 0]); ctx.fill();
    ctx.fillStyle = css(tint([30, 30, 34], 1, 0), L > .3 ? 1 : .7);
    ctx.fillText(String(n * 10), x, y + h * .82);
  }

  /* road */
  const roadC = tint(C.road, Math.max(L, .1), warm);
  ctx.fillStyle = css(roadC); ctx.fillRect(0, roadTop, W, H - roadTop);
  ctx.fillStyle = css(tint(C.edge, Math.max(L, .2), warm)); ctx.fillRect(0, roadTop, W, 2.2 * s);
  ctx.fillStyle = css(tint([226, 222, 210], Math.max(L, .25), warm), .85);
  const dashY = roadTop + (H - roadTop) * .32, dl = 28 * s, gap = 24 * s, off = (km * PXN) % (dl + gap);
  for (let x = -off; x < W; x += dl + gap) ctx.fillRect(x, dashY, dl, 2.4 * s);

  /* bus */
  const bob = st.moving && !reduceMotion ? Math.sin(rt * 17) * .7 * s : 0;
  drawBus(busX, H * .965, L, warm, sky, km * 9, bob);

  /* gentle mist over everything at dawn */
  if (mist > .05) { ctx.fillStyle = css(mix(bot, [255, 255, 255], .4), mist * .12); ctx.fillRect(0, 0, W, H); }

  /* page tint follows the sky */
  document.documentElement.style.setProperty("--sky", `rgb(${sky.top.map(v => v | 0).join(",")})`);

  updateMap(st, L, clockT);
  updateHud(st, clockT, e, L, sr, ss, mist, haze);
}

function drawBus(x, yRoad, L, warm, sky, ang, bob) {
  const Lb = Math.max(L, .22), night = 1 - L;
  const bw = 172 * s, bh = 60 * s, bx = x - bw / 2, by = yRoad - bh - 14 * s + bob;
  ctx.fillStyle = `rgba(0,0,0,${.12 + .2 * L})`;
  ctx.beginPath(); ctx.ellipse(x, yRoad - 1 * s, bw * .55, 5 * s, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, [12 * s, 16 * s, 6 * s, 6 * s]);
  ctx.fillStyle = css(tint(C.bus, Lb, warm)); ctx.fill();
  ctx.clip();
  ctx.fillStyle = css(tint(C.accent, Lb, warm)); ctx.fillRect(bx, by + bh * .58, bw, bh * .12);
  ctx.fillStyle = css(tint(C.skirt, Lb, warm)); ctx.fillRect(bx, by + bh * .80, bw, bh * .2);
  ctx.restore();

  const glassDay = mix([38, 56, 76], sky.bot, .25), glassNight = [255, 212, 138];
  const glass = mix(glassDay, glassNight, clamp((night - .35) * 1.6, 0, 1));
  const wy = by + 9 * s, wh = 21 * s, wend = bx + bw - 56 * s;
  ctx.fillStyle = css(glass);
  for (let wx = bx + 12 * s; wx + 18 * s <= wend; wx += 21 * s) {
    ctx.beginPath(); ctx.roundRect(wx, wy, 18 * s, wh, 2.5 * s); ctx.fill();
  }
  ctx.beginPath(); ctx.roundRect(bx + bw - 51 * s, wy, 14 * s, bh - 17 * s, 2 * s);
  ctx.fillStyle = css(mix(glass, [20, 24, 32], .35)); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bx + bw - 33 * s, wy); ctx.lineTo(bx + bw - 8 * s, wy);
  ctx.quadraticCurveTo(bx + bw - 2 * s, wy + 2 * s, bx + bw - 1.5 * s, wy + wh + 8 * s);
  ctx.lineTo(bx + bw - 33 * s, wy + wh + 8 * s); ctx.closePath();
  ctx.fillStyle = css(glass); ctx.fill();
  ctx.fillStyle = "#111318"; ctx.fillRect(bx + bw - 33 * s, by + 2.5 * s, 25 * s, 5 * s);
  ctx.fillStyle = `rgba(255,170,60,${.75 + .25 * night})`;
  for (let i = 0; i < 6; i++) ctx.fillRect(bx + bw - 31 * s + i * 4 * s, by + 3.7 * s, 2.6 * s, 2.6 * s);

  ctx.fillStyle = css(night > .45 ? [255, 246, 205] : tint([235, 232, 218], Lb, warm));
  ctx.fillRect(bx + bw - 6 * s, by + bh - 21 * s, 5 * s, 5 * s);
  ctx.fillStyle = `rgba(214,48,40,${.7 + .3 * night})`; ctx.fillRect(bx + 1 * s, by + bh - 23 * s, 3.5 * s, 7 * s);

  for (const cx of [bx + 34 * s, bx + bw - 40 * s]) {
    const cy = yRoad - 11.5 * s;
    ctx.fillStyle = "#1c1d22"; ctx.beginPath(); ctx.arc(cx, cy - 1 * s, 14 * s, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#17181c"; ctx.beginPath(); ctx.arc(cx, cy, 11.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = css(tint([178, 180, 188], Lb, 0)); ctx.beginPath(); ctx.arc(cx, cy, 5.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#2a2b31"; ctx.lineWidth = 1.2 * s; ctx.beginPath();
    for (let k = 0; k < 5; k++) { const a = ang + k * 1.2566; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 5 * s, cy + Math.sin(a) * 5 * s); }
    ctx.stroke();
  }

  if (night > .4) {
    const a = (night - .4) * 1.4, hx = bx + bw - 1 * s, hy2 = by + bh - 18 * s;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const bg = ctx.createLinearGradient(hx, 0, hx + 260 * s, 0);
    bg.addColorStop(0, `rgba(255,240,190,${.42 * a})`); bg.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = bg; ctx.beginPath();
    ctx.moveTo(hx, hy2 - 2 * s); ctx.lineTo(hx + 260 * s, hy2 - 26 * s); ctx.lineTo(hx + 260 * s, yRoad + 6 * s); ctx.lineTo(hx, hy2 + 4 * s);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
}

/* ---------- map ---------- */
const MB = { lon0: 71.5, lon1: 74.3, lat0: 18.75, lat1: 23.25 }, MS = 150, KX = Math.cos(21 * RAD);
const P = (lon, lat) => [((lon - MB.lon0) * KX * MS), ((MB.lat1 - lat) * MS)];
const MW = Math.round((MB.lon1 - MB.lon0) * KX * MS), MH = Math.round((MB.lat1 - MB.lat0) * MS);
const pts = arr => arr.map(([lo, la]) => P(lo, la).map(v => v.toFixed(1)).join(",")).join(" ");
const COAST = [[71.4,20.93],[71.53,20.97],[71.75,21.06],[71.95,21.18],[72.10,21.30],[72.18,21.42],[72.27,21.62],[72.24,21.78],[72.30,21.98],[72.38,22.16],[72.47,22.28],[72.56,22.33],[72.64,22.29],[72.66,22.18],[72.60,22.02],[72.57,21.85],[72.55,21.70],[72.62,21.60],[72.66,21.42],[72.63,21.22],[72.62,21.10],[72.70,21.00],[72.78,20.85],[72.86,20.66],[72.85,20.48],[72.82,20.38],[72.74,20.20],[72.71,20.00],[72.69,19.80],[72.70,19.62],[72.74,19.47],[72.79,19.33],[72.78,19.22],[72.81,19.08],[72.80,18.97],[72.81,18.90],[72.84,18.93],[72.87,19.00],[72.93,19.06],[72.97,19.16],[73.00,19.12],[72.98,18.98],[72.93,18.86],[72.90,18.72],[72.89,18.6]];
const SEA = COAST.concat([[72.9, 18.5], [71.3, 18.5], [71.3, 20.93]]);
const RIVERS = [
  ["Sabarmati", [[72.60,23.3],[72.58,23.02],[72.52,22.75],[72.45,22.40],[72.47,22.29]], [72.40, 22.62]],
  ["Mahi", [[73.70,23.05],[73.30,22.70],[73.05,22.45],[72.85,22.33],[72.66,22.24]], [73.50, 22.95]],
  ["Narmada", [[74.4,21.92],[73.9,21.84],[73.5,21.80],[73.10,21.70],[72.95,21.665],[72.80,21.64],[72.62,21.60]], [73.85, 21.78]],
  ["Tapi", [[74.4,21.22],[73.8,21.26],[73.3,21.25],[72.95,21.22],[72.80,21.15],[72.63,21.12]], [73.55, 21.18]]
];
const BORDER = [[72.74,20.19],[72.87,20.14],[73.05,20.17],[73.20,20.30],[73.40,20.45],[73.55,20.60],[73.65,20.85],[73.75,21.05],[73.85,21.20],[74.05,21.30],[74.3,21.5]];
const map = $("map");
(function buildMap() {
  map.setAttribute("viewBox", `0 0 ${MW} ${MH}`);
  let h = `<defs><radialGradient id="glow"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".95"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient></defs>`;
  h += `<rect id="mLand" x="0" y="0" width="${MW}" height="${MH}"/>`;
  h += `<polygon id="mSea" points="${pts(SEA)}"/>`;
  h += `<g id="mRivers" fill="none" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${RIVERS.map(r => `<polyline points="${pts(r[1])}"/>`).join("")}</g>`;
  let carets = "";
  for (let la = 18.85; la < 20.35; la += 0.17) {
    const lo = 73.5 + Math.sin(la * 3) * 0.06, [x, y] = P(lo, la);
    carets += `<path d="M${(x - 7).toFixed(1)} ${(y + 4).toFixed(1)} L${x.toFixed(1)} ${(y - 4).toFixed(1)} L${(x + 7).toFixed(1)} ${(y + 4).toFixed(1)}"/>`;
  }
  h += `<g id="mHills" fill="none" stroke-width="1.4" stroke-linejoin="round">${carets}</g>`;
  h += `<polyline id="mBorder" points="${pts(BORDER)}" fill="none" stroke-width="1.3" stroke-dasharray="5 4"/>`;
  h += `<g id="mGlows">${STOPS.filter(s => s.major).map(s => { const [x, y] = P(s.lon, s.lat); const r = s.name === "Mumbai Central" ? 34 : (s.name === "Ahmedabad" ? 28 : 18); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="url(#glow)"/>`; }).join("")}</g>`;
  h += `<polyline id="mRouteAll" points="${pts(STOPS.map(s => [s.lon, s.lat]))}" fill="none" stroke-width="2.4" stroke-dasharray="2 5" stroke-linecap="round" stroke-linejoin="round"/>`;
  h += `<polyline id="mRouteDone" fill="none" stroke="#f2a541" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  h += `<g id="mStops">${STOPS.map(s => { const [x, y] = P(s.lon, s.lat); const r = s.major || s.meal ? 4.6 : 2.6; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" stroke-width="1.8"/>`; }).join("")}</g>`;
  const lab = (lo, la, txt, cls, extra = "") => { const [x, y] = P(lo, la); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" ${extra}>${txt}</text>`; };
  let L = "";
  L += lab(73.82, 22.02, "GUJARAT", "region", 'text-anchor="middle"');
  L += lab(73.80, 19.35, "MAHARASHTRA", "region", 'text-anchor="middle"');
  L += lab(71.92, 21.72, "Saurashtra", "area", 'text-anchor="middle"');
  L += lab(72.40, 21.40, "Gulf of", "sea", 'text-anchor="middle"');
  L += lab(72.40, 21.30, "Khambhat", "sea", 'text-anchor="middle"');
  L += lab(72.05, 19.65, "Arabian Sea", "sea", 'text-anchor="middle"');
  L += lab(73.62, 20.05, "Sahyadri", "area", 'text-anchor="start"');
  for (const r of RIVERS) L += lab(r[2][0], r[2][1], r[0], "river", 'text-anchor="middle"');
  for (const s of STOPS) {
    if (!(s.major || s.meal)) continue;
    const nm = s.name === "Mumbai Central" ? "Mumbai" : s.name;
    const dy = s.name === "Ankleshwar" ? 12 : (s.name === "Bharuch" ? -4 : 4);
    L += lab(s.lon, s.lat, nm, "city", `dx="9" dy="${dy}"`);
  }
  h += `<g id="mLabels">${L}</g>`;
  h += `<g id="mBus"><circle class="pulse" r="10" fill="#f2a541"/><circle r="7.5" fill="#f2a541" stroke="#1a1206" stroke-width="2.5"/></g>`;
  h += `<text id="mBusLabel" text-anchor="end" dx="-14" dy="4" class="buslabel"></text>`;
  h += `<style>
    .region{font-size:12px;font-weight:600;letter-spacing:.18em;}
    .area{font-size:11.5px;font-style:italic;}
    .sea{font-size:12px;font-style:italic;}
    .river{font-size:10.5px;font-style:italic;}
    .city{font-size:13.5px;font-weight:600;}
    .buslabel{font-size:13px;font-weight:600;font-family:var(--mono);}
    #map text{stroke-width:3.2px}
  </style>`;
  map.innerHTML = h;
  if (reduceMotion) map.querySelector(".pulse").classList.remove("pulse");
})();
const mEl = id => map.querySelector("#" + id);
const M = { land: mEl("mLand"), sea: mEl("mSea"), rivers: mEl("mRivers"), hills: mEl("mHills"), border: mEl("mBorder"),
  glows: mEl("mGlows"), all: mEl("mRouteAll"), done: mEl("mRouteDone"), stops: mEl("mStops"), labels: mEl("mLabels"),
  bus: mEl("mBus"), busLabel: mEl("mBusLabel") };
function updateMap(st, L, clockT) {
  const land = mix(hex("#1b2131"), hex("#e7e0c9"), L), sea = mix(hex("#0e1a2f"), hex("#a8cfe2"), L);
  M.land.setAttribute("fill", css(land));
  M.sea.setAttribute("fill", css(sea));
  M.rivers.setAttribute("stroke", css(mix(hex("#2a4a78"), hex("#6fa8c9"), L)));
  M.hills.setAttribute("stroke", css(mix(hex("#3b4458"), hex("#a39272"), L)));
  M.border.setAttribute("stroke", css(mix(hex("#6b7591"), hex("#8c7a62"), L)));
  M.all.setAttribute("stroke", css(mix(hex("#8c97b3"), hex("#5c5446"), L)));
  M.glows.setAttribute("opacity", (clamp((1 - L - .3) * 1.4, 0, 1)).toFixed(2));
  M.stops.setAttribute("fill", css(mix(hex("#e9edf5"), hex("#ffffff"), L)));
  M.stops.setAttribute("stroke", css(mix(hex("#0d1322"), hex("#2b2a26"), L)));
  const ink = mix(hex("#e9edf5"), hex("#1f2430"), L), halo = mix(hex("#121828"), hex("#f3eedf"), L);
  map.style.setProperty("--ink", css(ink));
  M.labels.setAttribute("fill", css(ink)); M.labels.setAttribute("stroke", css(halo));
  M.busLabel.setAttribute("fill", css(ink)); M.busLabel.setAttribute("stroke", css(halo));
  const seaInk = mix(hex("#7d93bb"), hex("#3f6f8c"), L);
  M.labels.querySelectorAll(".sea").forEach(t => { t.setAttribute("fill", css(seaInk)); });
  M.labels.querySelectorAll(".river").forEach(t => { t.setAttribute("fill", css(mix(hex("#6e8fc2"), hex("#3c6f92"), L))); });

  const done = STOPS.slice(0, st.from + 1).map(s => [s.lon, s.lat]);
  if (st.moving) done.push([st.lon, st.lat]);
  M.done.setAttribute("points", pts(done.length > 1 ? done : [done[0], done[0]]));
  const [x, y] = P(st.lon, st.lat);
  M.bus.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`);
  M.busLabel.setAttribute("x", x.toFixed(1)); M.busLabel.setAttribute("y", y.toFixed(1));
  setText(M.busLabel, fmt(clockT));
}

/* ---------- HUD ---------- */
const hud = { clock: $("clock"), clockSub: $("clockSub"), daybar: $("daybar"), where: $("where"), whereSub: $("whereSub"),
  km: $("km"), kmSub: $("kmSub"), next: $("next"), nextSub: $("nextSub"), speed: $("speed"), speedSub: $("speedSub"),
  temp: $("temp"), tempSub: $("tempSub"), sky: $("sky"), skySub: $("skySub"), chipTime: $("chipTime"), chipPlace: $("chipPlace"),
  scrub: $("scrub"), log: $("log"), toast: $("toast"), play: $("play") };
let toastTimer = 0;
function updateHud(st, clockT, e, L, sr, ss, mist, haze) {
  const [hm, ap] = fmt(clockT, false);
  const clockHTML = `${hm}<small>${ap}</small>`;
  if (hud.clock.innerHTML !== clockHTML) hud.clock.innerHTML = clockHTML;
  const day = Math.floor(clockT / 24) + 1;
  setText(hud.clockSub, `Day ${day} · ${dur(simMin)} on the road`);
  hud.daybar.style.width = (simMin / TOTAL_MIN * 100).toFixed(2) + "%";
  setText(hud.chipTime, fmt(clockT));

  let where, whereSub;
  const state = st.km >= ACHHAD_KM ? "Maharashtra" : "Gujarat";
  if (st.arrived) { where = "Mumbai Central"; whereSub = "Arrived, Maharashtra"; }
  else if (st.halted !== undefined) {
    const sStop = STOPS[st.halted];
    if (st.halted === 0) { where = "Ahmedabad"; whereSub = "Boarding at Paldi"; }
    else {
      const left = Math.ceil(sStop.dep - simMin);
      where = `Halted at ${sStop.name}`;
      whereSub = sStop.meal ? `${mealName(depHour + sStop.t / 60)} halt · ${left} min left` : `Short stop · ${left} min left`;
    }
  } else {
    const a = STOPS[st.from], b = STOPS[st.to];
    if (st.km - a.km < 4) where = `Leaving ${a.name}`;
    else if (b.km - st.km < 4) where = `Nearing ${b.name}`;
    else where = `${a.name} → ${b.name}`;
    whereSub = st.km > 466 ? "Mumbai suburbs, " + state : "NH48, " + state;
  }
  setText(hud.where, where); setText(hud.whereSub, whereSub);
  setText(hud.chipPlace, st.arrived ? "Arrived in Mumbai" : where);

  setText(hud.km, `${Math.round(st.km)} km`);
  setText(hud.kmSub, st.arrived ? "Journey complete" : `${Math.round(TOTAL_KM - st.km)} km to go`);

  let nx = null;
  for (let i = Math.max(st.to, (st.halted ?? -1) + 1); i < STOPS.length; i++) if (STOPS[i].major || STOPS[i].meal) { nx = STOPS[i]; break; }
  if (nx && !st.arrived) {
    setText(hud.next, nx.name === "Mumbai Central" ? "Mumbai Central" : nx.name);
    const tag = nx.meal ? ` · ${mealName(depHour + nx.t / 60).toLowerCase()} halt` : "";
    setText(hud.nextSub, `ETA ${fmt(depHour + nx.t / 60)}${tag}`);
  } else { setText(hud.next, "None"); setText(hud.nextSub, `Arrived ${fmt(depHour + TOTAL_MIN / 60)}`); }

  setText(hud.speed, `${Math.round(st.speed)} km/h`);
  setText(hud.speedSub, st.moving ? (st.km > 490 ? "City traffic" : (st.km < 112 && st.km > 8 ? "Expressway" : "Highway")) :
    (st.arrived ? "Engine off" : (st.halted === 0 && simMin === 0 ? "Waiting to leave" : "Parked")));

  const temp = temperature(st.lat, st.lon, clockT);
  setText(hud.temp, `${Math.round(temp)}°C`);
  const rh = Math.round(lerp(38, 72, clamp((23 - st.lat) / 4, 0, 1)) + (L < .3 ? 15 : 0));
  setText(hud.tempSub, `Humidity about ${Math.min(rh, 90)}%`);

  const h = ((clockT % 24) + 24) % 24;
  setText(hud.sky, skyWords(e, h, mist, haze, temp));
  const elev = e + 0.6;
  setText(hud.skySub, elev > 0 ? `Sun ${Math.round(e)}° up · sets ${fmt(ss)}` : `Sun below horizon · rises ${fmt(sr)}`);

  if (document.activeElement !== hud.scrub) hud.scrub.value = Math.round(simMin);

  let n = 0; while (n < events.length && events[n][0] <= simMin + 1e-6) n++;
  if (n !== shownEvents) {
    if (n > shownEvents && shownEvents >= 0 && n > 0 && playing) showToast(`${fmt(depHour + events[n - 1][0] / 60)} · ${events[n - 1][1]}`);
    shownEvents = n;
    renderLog(n);
  }
}
function renderLog(n) {
  if (n === 0) { hud.log.innerHTML = `<li class="empty">Press Play to set off.</li>`; return; }
  hud.log.innerHTML = events.slice(0, n).map((ev, i) =>
    `<li class="${i === n - 1 ? "latest" : ""}"><time>${fmt(depHour + ev[0] / 60)}</time><span>${ev[1]}</span></li>`).join("");
  hud.log.scrollTop = hud.log.scrollHeight;
}
function showToast(text) {
  hud.toast.textContent = text; hud.toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => hud.toast.classList.remove("show"), 2800);
}

/* ---------- controls ---------- */
const PLAY_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>`;
const PAUSE_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>`;
function syncPlay() {
  const label = playing ? "Pause" : (simMin >= TOTAL_MIN ? "Replay" : "Play");
  hud.play.innerHTML = (playing ? PAUSE_ICON : PLAY_ICON) + label;
  hud.play.setAttribute("aria-label", label);
}
hud.play.addEventListener("click", () => {
  if (!playing && simMin >= TOTAL_MIN) { simMin = 0; shownEvents = -1; }
  playing = !playing; lastTs = null; syncPlay();
});
$("restart").addEventListener("click", () => { simMin = 0; shownEvents = -1; playing = true; lastTs = null; syncPlay(); });
$("dep").addEventListener("change", ev => {
  depHour = +ev.target.value; buildEvents(); buildStrip(); simMin = 0; playing = true; lastTs = null; syncPlay();
});
document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => { rate = +b.dataset.rate; syncRate(); }));
function syncRate() {
  document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.rate === rate)));
  const secs = TOTAL_MIN / rate;
  $("rateNote").textContent = `Each real second is ${rate} minutes of the trip. The whole 10 hours plays in ${secs >= 60 ? (secs / 60).toFixed(secs % 60 ? 1 : 0) + " min" : secs + " s"}.`;
}
hud.scrub.addEventListener("input", () => { simMin = +hud.scrub.value; lastTs = null; });
document.addEventListener("keydown", ev => {
  if (ev.code === "Space" && !["SELECT", "INPUT", "BUTTON"].includes(document.activeElement.tagName)) { ev.preventDefault(); hud.play.click(); }
});

function buildStrip() {
  const stops = [];
  for (let i = 0; i <= 30; i++) {
    const m = i / 30 * TOTAL_MIN, st = stateAt(m), e = sunElev(st.lat, st.lon, depHour + m / 60), sk = skyAt(e);
    stops.push(`${css(mix(sk.top, sk.bot, .55))} ${(i / 30 * 100).toFixed(1)}%`);
  }
  hud.scrub.style.setProperty("--strip", `linear-gradient(90deg, ${stops.join(",")})`);
  $("ticks").innerHTML = STOPS.filter(s => s.dwell).map(s => `<i style="left:${(s.t / TOTAL_MIN * 100).toFixed(2)}%" title="${s.name}"></i>`).join("");
  $("sStart").textContent = fmt(depHour);
  $("sMid").textContent = fmt(depHour + 5);
  $("sEnd").textContent = fmt(depHour + 10);
}


/* ---------- music: an original tune, synthesised live ---------- */
const Music = (() => {
  let ctx = null, master = null, fx = null, on = false, timer = null;
  let nextT = 0, matra = 0, bar = 0, raga = null, deg = 0, prevF = null, ended = false, noteUntil = 0, rng = 1;
  const SA = 138.59; // C#3, a common bansuri/tanpura tonic
  const RAGAS = {
    bhairav:  { name: "Raag Bhairav",  when: "a dawn raga",    scale: [0, 1, 4, 5, 7, 8, 11], drone: 7 },
    bhupali:  { name: "Raag Bhupali",  when: "bright and open", scale: [0, 2, 4, 7, 9],       drone: 7 },
    yaman:    { name: "Raag Yaman",    when: "a dusk raga",    scale: [0, 2, 4, 6, 7, 9, 11], drone: 7 },
    malkauns: { name: "Raag Malkauns", when: "a night raga",   scale: [0, 3, 5, 8, 10],       drone: 5 }
  };
  const ragaFor = h => { h = ((h % 24) + 24) % 24; return h >= 4 && h < 9.5 ? "bhairav" : h < 16 && h >= 9.5 ? "bhupali" : h >= 16 && h < 20.5 ? "yaman" : "malkauns"; };
  const KEHERWA = ["dha", "ge", "na", "ti", "na", "ka", "dhi", "na"];
  const RHYTHMS = [[2, 2, 2, 2], [3, 1, 2, 2], [1, 1, 2, 4], [2, 1, 1, 4], [4, 2, 2], [2, 2, 4], [1, 1, 1, 1, 4]];
  const MATRA = 0.3;
  let noise = null;
  const rand = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };
  let st = { moving: false, halted: true, arrived: false, clock: 6, playing: false };

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0; master.connect(comp);
    const d = ctx.createDelay(1); d.delayTime.value = 0.27; const fb = ctx.createGain(); fb.gain.value = 0.3;
    const wet = ctx.createGain(); wet.gain.value = 0.2; d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master); fx = d;
    const len = ctx.sampleRate; noise = ctx.createBuffer(1, len, ctx.sampleRate); const ch = noise.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  }
  const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  function out(node, send = 0.25) { node.connect(master); if (send) { const s = ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(fx); } }
  function pluck(t, f, vol = 0.05) { // tanpura string
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f * 1.003;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(500, t + 2.5);
    const g = ctx.createGain(); env(g, t, 0.02, vol, 2.8);
    o.connect(lp); o2.connect(lp); lp.connect(g); out(g, 0.3);
    o.start(t); o2.start(t); o.stop(t + 3); o2.stop(t + 3);
  }
  function flute(t, f, dur, vol = 0.12) { // bansuri-like voice with meend and vibrato
    const o = ctx.createOscillator(); o.type = "sine";
    const o2 = ctx.createOscillator(); o2.type = "triangle";
    if (prevF) { o.frequency.setValueAtTime(prevF, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); o2.frequency.setValueAtTime(prevF * 2, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.06); }
    else { o.frequency.setValueAtTime(f, t); o2.frequency.setValueAtTime(f * 2, t); }
    const vib = ctx.createOscillator(); vib.frequency.value = 5.3; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, dur * 0.6));
    vib.connect(vg); vg.connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.07);
    g.gain.setValueAtTime(vol, t + Math.max(0.08, dur - 0.12)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    o.connect(g); o2.connect(g2); g2.connect(g);
    const n = ctx.createBufferSource(); n.buffer = noise; const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f * 2.5; bp.Q.value = 2;
    const ng = ctx.createGain(); env(ng, t, 0.03, 0.025, 0.25); n.connect(bp); bp.connect(ng); out(ng, 0.2);
    out(g, 0.35);
    [o, o2, vib].forEach(x => { x.start(t); x.stop(t + dur + 0.15); }); n.start(t); n.stop(t + 0.35);
    prevF = f;
  }
  function bayan(t, vol = 0.4) { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(68, t + 0.28); const g = ctx.createGain(); env(g, t, 0.005, vol, 0.38); o.connect(g); out(g, 0.08); o.start(t); o.stop(t + 0.45); }
  function dayan(t, f = SA * 4, vol = 0.16, dec = 0.2) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.01;
    const g = ctx.createGain(); env(g, t, 0.003, vol, dec); const g2 = ctx.createGain(); g2.gain.value = 0.35; o.connect(g); o2.connect(g2); g2.connect(g); out(g, 0.12);
    const n = ctx.createBufferSource(); n.buffer = noise; const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500; const ng = ctx.createGain(); env(ng, t, 0.002, 0.05, 0.03); n.connect(hp); hp.connect(ng); out(ng, 0);
    o.start(t); o2.start(t); o.stop(t + dec + 0.05); o2.stop(t + dec + 0.05); n.start(t); n.stop(t + 0.05);
  }
  function ka(t) { const n = ctx.createBufferSource(); n.buffer = noise; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; const g = ctx.createGain(); env(g, t, 0.002, 0.14, 0.06); n.connect(lp); lp.connect(g); out(g, 0); n.start(t); n.stop(t + 0.1); }
  function stroke(name, t, soft) {
    const v = soft ? 0.6 : 1;
    if (name === "dha") { bayan(t, 0.4 * v); dayan(t, SA * 4, 0.16 * v); }
    else if (name === "dhi") { bayan(t, 0.3 * v); dayan(t, SA * 4, 0.12 * v); }
    else if (name === "ge") bayan(t, 0.28 * v);
    else if (name === "na") dayan(t, SA * 4, 0.13 * v, 0.16);
    else if (name === "ti") dayan(t, SA * 6, 0.09 * v, 0.07);
    else if (name === "ka") ka(t);
  }
  const freqOf = (r, d) => { const sc = RAGAS[r].scale, n = sc.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return SA * 2 * Math.pow(2, o + sc[i] / 12); };
  let plan = [];
  function planBar() { // melody for one 8-matra bar
    const n = RAGAS[raga].scale.length;
    if (st.halted && !st.arrived) { // dhaba break: slow alaap, one long note
      plan = [[0, 8, Math.round(rand() * 3) - 1]];
      return;
    }
    const rhythm = RHYTHMS[Math.floor(rand() * RHYTHMS.length)];
    plan = []; let pos = 0;
    rhythm.forEach((len, k) => {
      const last = k === rhythm.length - 1 && bar % 4 === 3;
      if (last) deg = rand() < 0.5 ? 0 : n;
      else { deg += [-2, -1, -1, 1, 1, 2, 0][Math.floor(rand() * 7)]; deg = Math.max(-2, Math.min(n + 3, deg)); }
      plan.push([pos, len, deg]); pos += len;
    });
  }
  function scheduleMatra(t) {
    const m = matra % 8;
    if (m === 0) {
      const r = ragaFor(st.clock);
      if (r !== raga) { raga = r; deg = 0; prevF = null; showRaga(); }
      planBar();
      if (bar % 4 === 0) deg = Math.min(deg, 2);
    }
    // tanpura: Pa (or Ma), Sa, Sa, low Sa over two matras each
    if (m % 2 === 0) { const k = (m / 2) % 4; const dr = RAGAS[raga].drone; pluck(t, k === 0 ? SA * Math.pow(2, dr / 12) : k === 3 ? SA / 2 : SA, 0.045); }
    if (st.moving) stroke(KEHERWA[m], t, false);
    for (const [pos, len, d] of plan) if (pos === m) flute(t, freqOf(raga, d), len * MATRA * (st.halted ? 1.2 : 0.95), st.halted ? 0.09 : 0.12);
    matra++; if (m === 7) bar++;
  }
  function tick() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.25) {
      if (st.arrived) { if (!ended) { ended = true; finale(nextT); } nextT += MATRA; continue; }
      ended = false; scheduleMatra(nextT); nextT += MATRA;
    }
  }
  function finale(t) { // land on Sa and let it ring
    prevF = null; flute(t, SA * 2, 2.6, 0.12); flute(t + 2.6, SA * 4, 3.2, 0.1); pluck(t, SA, 0.06); pluck(t + 1.2, SA / 2, 0.06); bayan(t, 0.4); dayan(t, SA * 4, 0.16);
  }
  function setGain(v, time = 0.4) { if (!ctx) return; const now = ctx.currentTime; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(v, now + time); }
  function showRaga() {
    const el = document.getElementById("musicNote"); if (!el || !raga) return;
    const R = RAGAS[raga];
    el.innerHTML = on ? `Now playing: <b>${R.name}</b>, ${R.when}. An original tune; the raga follows the clock (Bhairav at dawn, Bhupali by day, Yaman at dusk, Malkauns at night).`
                      : "An original tune in Hindustani style. The raga follows the clock: Bhairav at dawn, Bhupali by day, Yaman at dusk, Malkauns at night.";
  }
  function sync() {
    const lab = document.getElementById("musicLabel"), btn = document.getElementById("music"), tap = document.getElementById("tapMusic");
    lab.textContent = on ? "Music on" : "Music off"; btn.setAttribute("aria-pressed", String(on)); tap.hidden = on; showRaga();
  }
  return {
    toggle() {
      try {
        if (!ctx) init();
        on = !on;
        if (on) {
          ctx.resume(); raga = null; nextT = ctx.currentTime + 0.1; matra = 0; bar = 0; rng = 7;
          if (!timer) timer = setInterval(tick, 50);
          setGain(st.playing || st.arrived ? 0.8 : 0, 0.6);
        } else { setGain(0, 0.4); }
      } catch (e) { on = false; document.getElementById("musicNote").textContent = "Music couldn't start in this browser."; }
      sync();
    },
    isOn: () => on,
    update(s) {
      const wasPlaying = st.playing, wasArrived = st.arrived;
      st = s;
      if (!ctx || !on) return;
      if (s.playing !== wasPlaying || s.arrived !== wasArrived) {
        if (s.playing) { if (wasArrived && !s.arrived) { matra = 0; bar = 0; } nextT = Math.max(nextT, ctx.currentTime + 0.05); setGain(0.8, 0.5); }
        else if (s.arrived) setGain(0, 7);
        else setGain(0, 0.5);
      }
    },
    sync
  };
})();
document.getElementById("music").addEventListener("click", () => Music.toggle());
document.getElementById("tapMusic").addEventListener("click", () => { if (!Music.isOn()) Music.toggle(); if (!playing) { if (simMin >= TOTAL_MIN) { simMin = 0; shownEvents = -1; } playing = true; lastTs = null; syncPlay(); } });

function loop(ts) {
  if (playing) {
    if (lastTs !== null) {
      const dt = Math.min(0.1, (ts - lastTs) / 1000);
      simMin += dt * rate;
      if (simMin >= TOTAL_MIN) { simMin = TOTAL_MIN; playing = false; syncPlay(); }
    }
    lastTs = ts;
  } else lastTs = null;
  render(ts);
  { const st = stateAt(simMin); Music.update({ playing, moving: playing && st.moving, halted: !st.moving, arrived: simMin >= TOTAL_MIN, clock: depHour + simMin / 60 }); }
  requestAnimationFrame(loop);
}

buildEvents(); buildStrip(); syncRate(); syncPlay(); resize();
requestAnimationFrame(loop);
})();
