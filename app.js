/* India Bus Journey: route engine, scenery, music and infographics */
(() => {
"use strict";
const G = window.GEO;
/* ---------------- helpers ---------------- */
const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
const $ = id => document.getElementById(id);
const setText = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
function hav(lo1, la1, lo2, la2) { const dla = (la2 - la1) * RAD, dlo = (lo2 - lo1) * RAD; const a = Math.sin(dla / 2) ** 2 + Math.cos(la1 * RAD) * Math.cos(la2 * RAD) * Math.sin(dlo / 2) ** 2; return 12742 * Math.asin(Math.sqrt(a)); }
function pip(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function segX(p1, p2, p3, p4) { const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]); if (Math.abs(d) < 1e-12) return null; const u = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d; const v = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d; return (u >= 0 && u <= 1 && v >= 0 && v <= 1) ? u : null; }
function distToLine(lo, la, line) { let best = 1e9; const k = Math.cos(la * RAD); for (let i = 1; i < line.length; i++) { const [x1, y1] = line[i - 1], [x2, y2] = line[i]; const ax = (x2 - x1) * k, ay = y2 - y1, px = (lo - x1) * k, py = la - y1; const t = clamp((px * ax + py * ay) / (ax * ax + ay * ay || 1), 0, 1); const dx = px - ax * t, dy = py - ay * t; best = Math.min(best, Math.hypot(dx, dy) * 111); } return best; }
const inSea = (lo, la) => pip(lo, la, G.SEA);
const inNogo = (lo, la) => G.NOGO.some(n => pip(lo, la, n.poly));
const zoneAt = (lo, la) => G.ZONES.find(z => pip(lo, la, z.poly)) || null;

/* ---------------- cities & graph ---------------- */
const C = G.CITIES.map(([name, st, lon, lat, size, ind], i) => ({ i, name, st, lon, lat, size, ind: !!ind }));
const norm = s => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const byName = new Map(C.map(c => [norm(c.name), c]));
function lev(a, b) { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
function findCity(q) {
  const s = norm(q || ""); if (!s) return { err: "empty" };
  if (byName.has(s)) return { city: byName.get(s) };
  const al = G.ALIASES[s] || G.ALIASES[s.replace(/ /g, "_")]; if (al) return { city: byName.get(norm(al)), alias: al };
  const pre = C.filter(c => norm(c.name).startsWith(s)); if (pre.length === 1) return { city: pre[0] };
  const ranked = C.map(c => ({ c, d: lev(s, norm(c.name)) })).sort((a, b) => a.d - b.d);
  if (ranked[0].d <= 2 && (ranked.length < 2 || ranked[1].d > ranked[0].d)) return { city: ranked[0].c, fuzzy: true };
  return { err: "notfound", suggest: (pre.length ? pre : ranked.slice(0, 4).map(r => r.c)).slice(0, 4).map(c => c.name) };
}
const EDGES = C.map(() => []);
(function buildGraph() {
  const valid = (a, b) => { let hill = 0; const dd = hav(a.lon, a.lat, b.lon, b.lat); for (let k = 1; k < 24; k++) { const t = k / 24, lo = lerp(a.lon, b.lon, t), la = lerp(a.lat, b.lat, t); if ((t > .06 && t < .94 && inSea(lo, la)) || inNogo(lo, la)) return -1; const z = zoneAt(lo, la); if (z && (z.kind === "mountain" || z.kind === "hills")) hill += z.kind === "mountain" ? 1 : .5; } const hf = hill / 23; if (hf > .45 && dd > 260) return -1; return hf; };
  const add = (i, j, d, h) => { if (EDGES[i].some(e => e.j === j)) return; const cost = d * (1 + 1.6 * h); EDGES[i].push({ j, d, cost }); EDGES[j].push({ j: i, d, cost }); };
  C.forEach(a => {
    const near = C.filter(b => b !== a).map(b => ({ b, d: hav(a.lon, a.lat, b.lon, b.lat) })).sort((x, y) => x.d - y.d);
    let n = 0;
    for (const { b, d } of near) { if (n >= 6 || d > 420) break; const h = valid(a, b); if (h >= 0) { add(a.i, b.i, d, h); n++; } }
    if (EDGES[a.i].length < 2) for (const { b, d } of near) { if (EDGES[a.i].length >= 2 || d > 800) break; const h = valid(a, b); if (h >= 0) add(a.i, b.i, d, h); }
  });
  // national-highway corridors: always linked, and cheaper to travel
  const missing = [];
  (G.HIGHWAYS || []).forEach(([nh, chain]) => { const names = chain.split(","); for (let k = 1; k < names.length; k++) { const a = byName.get(norm(names[k - 1])), b = byName.get(norm(names[k])); if (!a || !b) { missing.push(nh + ":" + (a ? names[k] : names[k - 1])); continue; } const d = hav(a.lon, a.lat, b.lon, b.lat); let hill = 0; for (let q = 1; q < 12; q++) { const z = zoneAt(lerp(a.lon, b.lon, q / 12), lerp(a.lat, b.lat, q / 12)); if (z && (z.kind === "mountain" || z.kind === "hills")) hill += z.kind === "mountain" ? 1 : .5; } const cost = d * (1 + .6 * hill / 11) * .72; const ex = EDGES[a.i].find(e => e.j === b.i); if (ex) { ex.cost = Math.min(ex.cost, cost); ex.nh = nh; const r = EDGES[b.i].find(e => e.j === a.i); r.cost = ex.cost; r.nh = nh; } else { EDGES[a.i].push({ j: b.i, d, cost, nh }); EDGES[b.i].push({ j: a.i, d, cost, nh }); } } });
  if (missing.length) console.warn("Highway cities not found:", missing);
})();
function shortest(a, b) {
  const dist = new Float64Array(C.length).fill(Infinity), prev = new Int32Array(C.length).fill(-1), done = new Uint8Array(C.length);
  dist[a] = 0;
  for (;;) { let u = -1, best = Infinity; for (let i = 0; i < C.length; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; } if (u < 0 || u === b) break; done[u] = 1; for (const e of EDGES[u]) { const nd = dist[u] + e.cost + (e.j === b ? 0 : [0, 34, 12, 0][C[e.j].size]); if (nd < dist[e.j]) { dist[e.j] = nd; prev[e.j] = u; } } }
  if (!isFinite(dist[b])) return null; const path = []; for (let v = b; v >= 0; v = prev[v]) path.unshift(v); return path;
}

/* ---------------- terrain classification ---------------- */
const TER = {
  farmland: { label: "Farmland", color: "#7FB35E", speed: 58 }, city: { label: "City", color: "#B9B2A6", speed: 28 }, industry: { label: "Industrial belt", color: "#8C8F99", speed: 36 },
  mountain: { label: "Mountains", color: "#9FB3C8", speed: 26 }, hills: { label: "Hills & ghats", color: "#4E8A5A", speed: 38 }, forest: { label: "Forest", color: "#2F6B43", speed: 46 },
  desert: { label: "Desert", color: "#E0B56A", speed: 60 }, saltflat: { label: "Salt flats", color: "#E8E4DA", speed: 60 }, coast: { label: "Coast", color: "#3FA7C9", speed: 48 }
};
const STYLE_OF_STATE = { PB: "punjabi", HR: "punjabi", CH: "punjabi", RJ: "rajasthani", GJ: "garba", MH: "lavani", GA: "lavani", KA: "carnatic", KL: "carnatic", TN: "carnatic", PY: "carnatic", AP: "carnatic", TS: "carnatic", WB: "eastern", OD: "eastern", BR: "eastern", JH: "eastern", AS: "northeast", ML: "northeast", TR: "northeast", MN: "northeast", NL: "northeast", MZ: "northeast", AR: "northeast", JK: "pahadi", LA: "pahadi", HP: "pahadi", UK: "pahadi", SK: "pahadi", DL: "hindustani", UP: "hindustani", MP: "hindustani", CG: "hindustani" };
function cropFor(st, month, lon, lat) {
  const winter = month >= 11 || month <= 3, mons = month >= 6 && month <= 10;
  if (["PB", "HR", "CH", "DL"].includes(st)) return winter ? "wheat" : mons ? "paddy" : "stubble";
  if (st === "UP") return winter ? "wheat" : mons ? (lon > 80 ? "paddy" : "sugarcane") : "stubble";
  if (st === "BR" || st === "WB" || st === "OD" || st === "JH") return mons || month === 11 ? "paddy" : winter ? "mustard" : "stubble";
  if (st === "RJ") return winter ? "mustard" : "millet";
  if (st === "GJ") return month >= 8 || month <= 1 ? "cotton" : "groundnut";
  if (st === "MH") return lon > 76 ? (month >= 8 || month <= 1 ? "cotton" : "stubble") : "sugarcane";
  if (st === "MP") return mons ? "soybean" : winter ? "wheat" : "stubble";
  if (st === "CG") return mons || month === 11 ? "paddy" : "stubble";
  if (st === "KL" || st === "GA") return "coconut";
  if (st === "AS") return lon > 93.5 ? "tea" : "paddy";
  if (["TN", "AP", "TS", "PY"].includes(st)) return mons || month >= 10 || month <= 1 ? "paddy" : "cotton";
  if (st === "KA") return lat < 13.5 ? "sugarcane" : (mons ? "cotton" : "millet");
  return "paddy";
}
const CROP = { wheat: ["Wheat", "#6FA347"], stubble: ["Harvested fields", "#C9A75E"], paddy: ["Paddy", "#7CC04B"], mustard: ["Mustard", "#E9CF3A"], millet: ["Millet", "#B9A66A"], cotton: ["Cotton", "#8FB06A"], groundnut: ["Groundnut", "#93A85A"], sugarcane: ["Sugarcane", "#5FA552"], soybean: ["Soybean", "#82B456"], coconut: ["Coconut groves", "#4E9A55"], tea: ["Tea gardens", "#3E8C4A"] };

/* ---------------- state ---------------- */
let R = null; // current route
let depHour = 6, simMin = 0, rate = 5, speedMul = 1, playing = false, lastTs = null, shownEvents = -1, jDate = new Date();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const doyOf = d => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);

/* ---------------- build a journey ---------------- */
function buildJourney(cA, cB, cV) {
  let path = shortest(cA.i, (cV || cB).i); if (!path) return null;
  if (cV) { const p2 = shortest(cV.i, cB.i); if (!p2) return null; path = path.concat(p2.slice(1)); }
  const month = jDate.getMonth() + 1;
  // geometry with gentle road wiggle
  const pts = [], nodeKmIdx = [];
  for (let k = 0; k < path.length - 1; k++) {
    const a = C[path[k]], b = C[path[k + 1]], d = hav(a.lon, a.lat, b.lon, b.lat), n = Math.max(4, Math.ceil(d / 6));
    const dx = b.lon - a.lon, dy = b.lat - a.lat, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const midZ = zoneAt((a.lon + b.lon) / 2, (a.lat + b.lat) / 2), hilly = midZ && (midZ.kind === "mountain" || midZ.kind === "hills");
    const amp = Math.min(hilly ? .09 : .05, L * (hilly ? .07 : .035)), fq = hilly ? 3 + Math.floor(d / 40) : 1 + Math.floor(d / 120), ph = hash(path[k] * 7 + path[k + 1]) * 6.28;
    for (let s = (k ? 1 : 0); s <= n; s++) {
      const u = s / n; let off = amp * Math.sin(Math.PI * u) * Math.sin(u * fq * Math.PI + ph);
      let lo = a.lon + dx * u + nx * off, la = a.lat + dy * u + ny * off;
      if ((u > .05 && u < .95) && (inSea(lo, la) || inNogo(lo, la))) { lo = a.lon + dx * u; la = a.lat + dy * u; }
      pts.push([lo, la]);
    }
    nodeKmIdx.push(pts.length - 1);
  }
  // cumulative distance (road factor for bends not captured by the line)
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) * 1.07);
  const total = cum[cum.length - 1];
  const N = Math.max(2, Math.round(total));
  const posAt = km => { let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= km) lo = m; else hi = m; } const f = (km - cum[lo]) / ((cum[hi] - cum[lo]) || 1); return [lerp(pts[lo][0], pts[hi][0], f), lerp(pts[lo][1], pts[hi][1], f)]; };
  const pathCities = path.map(i => C[i]);
  const cityKm = pathCities.map((c, k) => k === 0 ? 0 : cum[nodeKmIdx[k - 1]]);
  // samples per km
  const S = [];
  for (let k = 0; k <= N; k++) {
    const km = k * total / N, [lo, la] = posAt(km);
    let near = null, nd = 1e9; for (const c of C) { const d = hav(lo, la, c.lon, c.lat); if (d < nd) { nd = d; near = c; } }
    let ter = null, zone = null, place = null;
    const r = [0, 5, 9, 16][near.size];
    if (nd < r) { ter = nd < r * .55 || !near.ind ? "city" : "industry"; place = near.name; }
    const z = zoneAt(lo, la);
    if (!ter && z) { ter = z.kind; zone = z; }
    if (!ter && distToLine(lo, la, G.COAST) < 10) ter = "coast";
    if (!ter) ter = "farmland";
    if (z && !zone) zone = z;
    const st = near.st;
    let style = STYLE_OF_STATE[st] || "hindustani"; if (zone && (zone.id === "himalaya" || zone.id === "ehimalaya")) style = "pahadi";
    S.push({ km, lon: lo, lat: la, ter, zone, place, st, near: near.name, nearD: nd, style, crop: cropFor(st, month, lo, la), coastD: distToLine(lo, la, G.COAST), snow: !!(zone && zone.snow) });
  }
  // smooth out one-sample flickers
  for (let k = 1; k < S.length - 1; k++) if (S[k - 1].ter === S[k + 1].ter && S[k].ter !== S[k - 1].ter) S[k].ter = S[k - 1].ter;
  for (let k = 2; k < S.length; k++) if (S[k].st !== S[k - 1].st) { let run = 1; while (k + run < S.length && S[k + run].st === S[k].st && run < 6) run++; if (run < 5 && S[k - 1].st === (S[k + run] || {}).st) for (let q = 0; q < run; q++) S[k + q].st = S[k - 1].st; }
  // river crossings
  const rivers = [];
  for (const [name, line] of Object.entries(G.RIVERS)) for (let i = 1; i < pts.length; i++) for (let j = 1; j < line.length; j++) {
    const u = segX(pts[i - 1], pts[i], line[j - 1], line[j]);
    if (u !== null) { const km = lerp(cum[i - 1], cum[i], u); if (!rivers.some(r => r.name === name && Math.abs(r.km - km) < 150)) rivers.push({ name, km, st: S[Math.round(km / total * N)].st }); }
  }
  rivers.sort((a, b) => a.km - b.km);
  // timeline: minutes per km by terrain, meal halts every ~3 h, short city stops
  const arr = new Float64Array(S.length), dep = new Float64Array(S.length), halts = [];
  let t = 0, drive = 0;
  const cityStop = new Map(); pathCities.forEach((c, k) => { if (k > 0 && k < pathCities.length - 1 && c.size >= 2) cityStop.set(Math.round(cityKm[k] / total * N), c); });
  for (let k = 0; k < S.length; k++) {
    arr[k] = t;
    if (k > 0 && k < S.length - 3) {
      if (drive > 175) { const c = S[k].near, h = depHour + t / 60; halts.push({ k, start: t, dur: 25, name: c, meal: mealName(h), kind: "meal" }); t += 25; drive = 0; }
      else if (cityStop.has(k)) { const c = cityStop.get(k); halts.push({ k, start: t, dur: 10, name: c.name, kind: "stop" }); t += 10; }
    }
    dep[k] = t;
    if (k < S.length - 1) { const sp = TER[S[k].ter].speed * (S[k].ter === "farmland" && S[k].st && ["UP", "BR", "WB"].includes(S[k].st) ? .9 : 1); const m = (total / N) / sp * 60; t += m; drive += m; }
  }
  const R = { A: cA, B: cB, V: cV, pts, cum, total, N, S, pathCities, cityKm, rivers, arr, dep, halts, totalMin: arr[S.length - 1], month, posAt };
  R.events = buildEvents(R);
  R.comp = composition(R);
  R.states = [...new Set(S.map(s => s.st))];
  return R;
}
function mealName(h) { h = ((h % 24) + 24) % 24; if (h >= 6 && h < 10.5) return "Breakfast"; if (h >= 10.5 && h < 11.5) return "Tea"; if (h >= 11.5 && h < 15.5) return "Lunch"; if (h >= 15.5 && h < 18.5) return "Tea"; if (h >= 18.5 && h < 23) return "Dinner"; return "Rest"; }
function composition(R) { const c = {}; for (let k = 0; k < R.S.length - 1; k++) { const t = R.S[k].ter; c[t] = (c[t] || 0) + R.total / R.N; } return Object.entries(c).sort((a, b) => b[1] - a[1]); }
function buildEvents(R) {
  const S = R.S, ev = [], tAt = k => R.arr[k];
  ev.push([0, `Departed ${R.A.name}`, "start"]);
  // terrain & state transitions
  let prevT = S[0].ter, prevSt = S[0].st, runStart = 0;
  for (let k = 1; k < S.length; k++) {
    if (S[k].st !== prevSt) { ev.push([tAt(k), `Entered ${G.STATES[S[k].st] || S[k].st}`, "state"]); prevSt = S[k].st; }
    if (S[k].ter !== prevT) {
      let len = 0; while (k + len < S.length && S[k + len].ter === S[k].ter) len++;
      if (len >= 5) {
        const s = S[k], zn = s.zone ? s.zone.name : "";
        const msg = { mountain: `Climbing into the ${zn || "mountains"}`, hills: `Into the ${zn || "hills"}`, desert: `The ${zn || "desert"} begins`, saltflat: `Crossing the ${zn || "salt flats"}`, coast: "Sea views along the coast", forest: `Through the ${zn || "forest"}`, industry: `Industrial belt near ${s.place}`, city: `Entering ${s.place}`, farmland: `Open farmland: ${CROP[s.crop][0].toLowerCase()}` }[s.ter];
        ev.push([tAt(k), msg, s.ter]); prevT = s.ter;
      }
    }
  }
  R.rivers.forEach(r => ev.push([tAt(Math.round(r.km / R.total * R.N)), `Crossed the ${r.name}`, "river"]));
  R.halts.forEach(h => ev.push([h.start, h.kind === "meal" ? `${h.meal} halt near ${h.name}, ${h.dur} min` : `Stop at ${h.name}, ${h.dur} min`, "halt"]));
  ev.push([R.totalMin, `Arrived at ${R.B.name}`, "end"]);
  ev.sort((a, b) => a[0] - b[0]);
  // de-duplicate near-simultaneous repeats
  return ev.filter((e, i) => !(i && e[1] === ev[i - 1][1]));
}
function stateAt(m) {
  const { arr, dep, S } = R; let lo = 0, hi = S.length - 1;
  if (m >= arr[hi]) return { k: hi, f: 0, km: R.total, moving: false, arrived: true };
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid] <= m) lo = mid; else hi = mid; }
  if (m < dep[lo]) return { k: lo, f: 0, km: S[lo].km, moving: false, halted: R.halts.find(h => h.k === lo) || null, atStart: lo === 0 };
  const f = (m - dep[lo]) / ((arr[lo + 1] - dep[lo]) || 1);
  const km = lerp(S[lo].km, S[lo + 1].km, f);
  const sp = (S[lo + 1].km - S[lo].km) / ((arr[lo + 1] - dep[lo]) / 60);
  return { k: lo, f, km, moving: true, speed: sp };
}
const sampleAtKm = km => R.S[clamp(Math.round(km / R.total * R.N), 0, R.N)];

/* ---------------- sun, sky, weather ---------------- */
function sunParams(doy) { const dec = -23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10)); const B = 2 * Math.PI * (doy - 81) / 364; const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); return { dec: dec * RAD, eot }; }
const solarNoon = (lon, eot) => 12 + (82.5 - lon) * 4 / 60 - eot / 60;
function sunElev(lat, lon, t, sp) { const H = (t - solarNoon(lon, sp.eot)) * 15 * RAD, p = lat * RAD; return Math.asin(Math.sin(p) * Math.sin(sp.dec) + Math.cos(p) * Math.cos(sp.dec) * Math.cos(H)) / RAD; }
function sunTimes(lat, lon, sp) { const p = lat * RAD; const c = (Math.sin(-0.833 * RAD) - Math.sin(p) * Math.sin(sp.dec)) / (Math.cos(p) * Math.cos(sp.dec)); const H0 = Math.acos(clamp(c, -1, 1)) / RAD / 15, n = solarNoon(lon, sp.eot); return [n - H0, n + H0, n]; }
const SKY = [[-18, "#04060d", "#0a0f1f"], [-12, "#081029", "#17204a"], [-6, "#15234f", "#573e70"], [-2, "#29447f", "#d6765d"], [2, "#456fab", "#f1a25d"], [8, "#5a8fcb", "#f2cf9d"], [20, "#4b8ad2", "#c2ddef"], [50, "#3a7bcd", "#d2e7f6"]].map(r => [r[0], hex(r[1]), hex(r[2])]);
function skyAt(e) { if (e <= SKY[0][0]) return { top: SKY[0][1], bot: SKY[0][2] }; for (let i = 0; i < SKY.length - 1; i++) { const a = SKY[i], b = SKY[i + 1]; if (e <= b[0]) { const f = (e - a[0]) / (b[0] - a[0]); return { top: mix(a[1], b[1], f), bot: mix(a[2], b[2], f) }; } } const z = SKY[SKY.length - 1]; return { top: z[1], bot: z[2] }; }
const lightOf = e => smooth(-7, 13, e);
const warmthOf = e => (e > -5 && e < 16) ? clamp(1 - Math.abs(e - 2) / 13, 0, 1) : 0;
const STCODE = s => [...s].reduce((a, ch) => a + ch.charCodeAt(0), 0);
function rainProb(st, month, ter, coastD) {
  const mons = month >= 6 && month <= 9;
  if (["TN", "PY"].includes(st) && month >= 10 && month <= 12) return .45;
  if (!mons) return month === 10 || month === 5 ? .06 : .012;
  let p = .35;
  if (["KL", "GA"].includes(st) || (["MH", "KA"].includes(st) && (coastD < 60 || ter === "hills"))) p = .75;
  else if (["AS", "ML", "TR", "MN", "NL", "MZ", "AR", "SK", "WB"].includes(st)) p = .6;
  else if (st === "RJ" || ter === "desert") p = .12;
  else if (["TN", "PY"].includes(st)) p = .15;
  else if (ter === "mountain") p = .5;
  return p;
}
function weatherAt(s, clockT) {
  const h = ((clockT % 24) + 24) % 24, dayIdx = Math.floor((clockT + 2400) / 2);
  const rain = hash(dayIdx * 13.1 + STCODE(s.st)) < rainProb(s.st, R.month, s.ter, s.coastD);
  const igp = ["PB", "HR", "CH", "DL", "UP", "BR"].includes(s.st);
  const fog = igp && (R.month === 12 || R.month === 1) ? (h < 10.5 ? 1 - smooth(8.5, 10.5, h) : smooth(21, 24, h)) * .8 : 0;
  return { rain, fog };
}
function temperature(s, clockT, sr, rain) {
  const doy = doyOf(jDate), lat = s.lat;
  let Tm = 28 - 0.35 * Math.max(0, lat - 12) + Math.max(1.5, 0.5 * (lat - 8)) * Math.cos(2 * Math.PI * (doy - 140) / 365);
  if (R.month >= 7 && R.month <= 9 && lat > 20) Tm -= 2;
  let DR = { desert: 15, coast: 6, mountain: 12, forest: 9 }[s.ter] || 10;
  if (s.ter === "mountain") Tm -= s.zone && s.zone.id === "himalaya" && s.st === "LA" ? 20 : 13;
  else if (s.ter === "hills") Tm -= 5;
  if (rain) { DR *= .5; Tm -= 2; }
  const h = ((clockT % 24) + 24) % 24, peak = 14.5, tmin = Tm - DR / 2, tmax = Tm + DR / 2;
  if (h >= sr && h <= peak) return tmin + (tmax - tmin) * Math.sin(Math.PI / 2 * (h - sr) / (peak - sr));
  const x = ((h - peak) + 24) % 24; return tmin + (tmax - tmin) * Math.exp(-x / 4.8);
}
function fmt(t, parts) { const h24 = ((t % 24) + 24) % 24; let h = Math.floor(h24), m = Math.round((h24 - h) * 60); if (m === 60) { m = 0; h = (h + 1) % 24; } const ap = h < 12 ? "AM" : "PM", h12 = ((h + 11) % 12) + 1; return parts ? [`${h12}:${String(m).padStart(2, "0")}`, ap] : `${h12}:${String(m).padStart(2, "0")} ${ap}`; }
const dur = m => { const t = Math.round(m); return `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, "0")} m`; };

/* ---------------- scene ---------------- */
const cv = $("scene"), ctx = cv.getContext("2d");
let W = 0, H = 0, s = 1;
function resize() { const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; s = H / 300; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
new ResizeObserver(() => { resize(); if (R) render(performance.now()); }).observe(cv);
const STARS = Array.from({ length: 140 }, (_, i) => [hash(i * 1.7), Math.pow(hash(i * 3.3 + 1), 1.4), .5 + hash(i * 5.1) * 1.2, hash(i * 9.9) * 6.28]);
const NIGHT = [9, 15, 32];
function tint(c, L, warm) { let o = mix(mix([c[0] * .13, c[1] * .13, c[2] * .16], NIGHT, .5), c, L); if (warm > 0) o = mix(o, [255, 150, 90], warm * .16 * L); return o; }
const GROUND = { farmland: "#9FAE68", city: "#8E8A80", industry: "#7D7B76", mountain: "#6F7F6A", hills: "#5E8A55", forest: "#3F6B40", desert: "#D9B57A", saltflat: "#E7E3D8", coast: "#D8C79A" };
function farHeight(sm) {
  const t = sm.ter;
  if (t === "mountain") return 150; if (t === "hills") return 75; if (t === "forest") return 32; if (t === "desert") return 14; if (t === "coast" || t === "saltflat") return 0;
  if (t === "farmland" && sm.lat > 14 && sm.lat < 21.5 && sm.lon > 74 && sm.lon < 80.5) return 24;
  return 8;
}
function render(now) {
  if (!R || !W) return;
  const st = stateAt(simMin), sm = sampleAtKm(st.km), km = st.km;
  const clockT = depHour + simMin / 60, sp = sunParams(doyOf(jDate));
  const e = sunElev(sm.lat, sm.lon, clockT, sp), [sr, ss, noon] = sunTimes(sm.lat, sm.lon, sp);
  const wx = weatherAt(sm, clockT);
  let sky = skyAt(e); const L = lightOf(e) * (wx.rain ? .72 : 1), warm = warmthOf(e) * (wx.rain ? .3 : 1);
  if (wx.rain) sky = { top: mix(sky.top, [90, 100, 112], .55 * lightOf(e)), bot: mix(sky.bot, [150, 158, 168], .55 * lightOf(e)) };
  const rt = now / 1000, hy = H * .58, roadTop = H * .80, busX = W * .40;
  const bot = mix(sky.bot, [236, 236, 236], wx.fog * .6);
  let g = ctx.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, css(sky.top)); g.addColorStop(1, css(bot)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, hy + 2);
  const starA = clamp((-e - 5) / 8, 0, 1) * (wx.rain ? .1 : 1);
  if (starA > 0) for (const [x, y, r, ph] of STARS) { ctx.fillStyle = `rgba(235,240,255,${starA * (reduceMotion ? 1 : .65 + .35 * Math.sin(rt * 2 + ph)) * (1 - y * .6)})`; ctx.fillRect(x * W, y * hy * .9, r * s * .9, r * s * .9); }
  let Hd = ((clockT - noon) * 15) % 360; if (Hd > 180) Hd -= 360; if (Hd < -180) Hd += 360;
  const arcX = h => W * (.5 + clamp(h / 220, -.5, .5) * .92), arcY = el => hy - (el / 60) * (hy - H * .07);
  if (e < -3 && !wx.rain) { const mH = Hd > 0 ? Hd - 180 : Hd + 180, mx = arcX(mH), my = arcY(clamp(-e * .75, -5, 45)), a = clamp((-e - 3) / 6, 0, 1); ctx.fillStyle = `rgba(236,238,245,${a})`; ctx.beginPath(); ctx.arc(mx, my, 9 * s, 0, 7); ctx.fill(); }
  if (e > -4) { const sx = arcX(Hd), sy = arcY(e), low = 1 - smooth(0, 25, e), gc = mix([255, 244, 214], [255, 160, 90], low), sa = wx.rain ? .25 : 1; const gg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 13 * s * (8 + low * 6)); gg.addColorStop(0, css(gc, .55 * sa)); gg.addColorStop(.25, css(gc, .18 * sa)); gg.addColorStop(1, css(gc, 0)); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, hy + 2); ctx.fillStyle = css(mix([255, 250, 236], [255, 196, 120], low), sa); ctx.beginPath(); ctx.arc(sx, sy, 13 * s, 0, 7); ctx.fill(); }
  // clouds
  const nC = wx.rain ? 12 : sm.coastD < 80 ? 6 : 3, cloudC = wx.rain ? mix([40, 46, 60], [120, 128, 140], L) : mix(mix([38, 46, 70], [250, 250, 252], L), [246, 168, 138], warm * .55);
  for (let i = 0; i < nC; i++) { const x = ((((hash(i * 3.1) + rt * .004 * (reduceMotion ? 0 : 1) - km * .0012) % 1.4) + 1.4) % 1.4 - .2) * W, y = (.08 + hash(i * 5.7) * (wx.rain ? .2 : .32)) * hy, z = (.6 + hash(i * 7.3) * (wx.rain ? 1.4 : .8)) * s; ctx.fillStyle = css(cloudC, wx.rain ? .9 : .78); ctx.beginPath(); for (let j = 0; j < 5; j++) { const r = (11 + hash(i * 10 + j) * 10) * z; ctx.moveTo(x + (j - 2.5) * 15 * z + r, y - (j % 2) * 6 * z); ctx.arc(x + (j - 2.5) * 15 * z, y - (j % 2) * 6 * z, r, 0, 7); } ctx.fill(); }
  // far layer: mountains / hills / dunes / plateau, or sea on the coast
  const PXF = 6 * s, cols = [];
  for (let x = 0; x <= W + 4; x += 4) { const k = km + (x - busX) / PXF; let h = 0, n = 0, snow = 0, coast = 0, desert = 0; for (let d = -4; d <= 4; d += 2) { const q = sampleAtKm(clamp(k + d, 0, R.total)); h += farHeight(q); snow += q.snow ? 1 : 0; coast += q.ter === "coast" ? 1 : 0; desert += q.ter === "desert" ? 1 : 0; n++; } cols.push({ x, k, h: h / n, snow: snow / n, coast: coast / n, desert: desert / n }); }
  const hillC = mix(tint(hex("#6f8a86"), L, warm), bot, .38 + wx.fog * .4);
  ctx.fillStyle = css(hillC); ctx.beginPath(); ctx.moveTo(0, H);
  const ridge = c => { const n = c.desert > .5 ? .5 + .5 * Math.sin(c.k / 2.2) : (.45 + .55 * noise1(c.k / 5.2)) * (.7 + .3 * noise1(c.k / 1.7)); const flat = c.h > 18 && c.h < 30 ? Math.min(1, Math.round(noise1(c.k / 9) * 3) / 3 + .2) : n; return hy - (4 + c.h * (c.h > 18 && c.h < 30 ? flat : n)) * s; };
  for (const c of cols) ctx.lineTo(c.x, ridge(c)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  // snow caps
  if (cols.some(c => c.snow > .3)) { ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); for (const c of cols) ctx.lineTo(c.x, ridge(c)); ctx.lineTo(W, H); ctx.closePath(); ctx.clip(); ctx.fillStyle = css(mix([240, 244, 250], bot, .25), .9 * L + .1); for (const c of cols) if (c.snow > .3) ctx.fillRect(c.x, 0, 4, hy - 95 * s); ctx.restore(); }
  // sea
  for (const c of cols) if (c.coast > .4) { const a = smooth(.4, .8, c.coast); ctx.fillStyle = css(mix(tint(hex("#2b6f93"), L, warm), bot, .25), a); ctx.fillRect(c.x, hy - 3 * s, 4.5, 26 * s); if (hash(Math.floor(c.k * 3) + Math.floor(rt * 2)) > .93) { ctx.fillStyle = `rgba(255,255,255,${.35 * L * a})`; ctx.fillRect(c.x, hy + (hash(c.k) * 18) * s, 4, 1.5 * s); } }
  // boats on the sea
  for (const c of cols) if (c.coast > .8 && hash(Math.floor(c.k / 3) * 3.3) > .93 && Math.abs(c.k / 3 - Math.floor(c.k / 3) - .5) < .02) { ctx.fillStyle = css(tint(hex("#7a5a3a"), L, warm)); ctx.fillRect(c.x - 8 * s, hy + 6 * s, 16 * s, 3 * s); ctx.fillRect(c.x - 1 * s, hy - 8 * s, 1.5 * s, 14 * s); }
  // mid ground: per-terrain colour with beach strip on the coast
  for (const c of cols) { const q = sampleAtKm(clamp(c.k * 0 + km + (c.x - busX) / (16 * s), 0, R.total)); let base = q.ter === "farmland" ? CROP[q.crop][1] : GROUND[q.ter]; const gcol = mix(tint(hex(base), L, warm), bot, .28 + wx.fog * .4); ctx.fillStyle = css(gcol); ctx.fillRect(c.x, hy + (c.coast > .4 ? 22 * s : 0), 4.5, roadTop - hy); }
  // rivers: a channel running from the horizon to the road
  for (const r of R.rivers) {
    const xm1 = busX + (r.km - 1 - km) * 16 * s, xm2 = busX + (r.km + 1 - km) * 16 * s, xn1 = busX + (r.km - 2.2 - km) * 34 * s, xn2 = busX + (r.km + 2.2 - km) * 34 * s;
    if (xn2 < -40 || xn1 > W + 40) continue;
    ctx.fillStyle = css(mix(tint(hex("#3d86b0"), L, warm), bot, .2)); ctx.beginPath(); ctx.moveTo(xm1, hy + 2 * s); ctx.lineTo(xm2, hy + 2 * s); ctx.lineTo(xn2, roadTop); ctx.lineTo(xn1, roadTop); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${.25 * L})`; for (let i = 0; i < 10; i++) { const u = hash(i * 3 + r.km), y = lerp(hy + 4 * s, roadTop - 4 * s, u), xa = lerp(xm1, xn1, u), xb = lerp(xm2, xn2, u); ctx.fillRect(lerp(xa, xb, hash(i * 7 + Math.floor(rt))), y, 10 * s * (.3 + u), 1.4 * s); }
    const la = clamp(1 - Math.abs(r.km - km) / 6, 0, 1);
    if (la > 0) { ctx.font = `700 ${Math.max(11, 13 * s)}px ${FONT}`; const tw = ctx.measureText(r.name).width + 20; const cx = (xm1 + xm2) / 2; ctx.fillStyle = `rgba(8,12,22,${.75 * la})`; ctx.beginPath(); ctx.roundRect(cx - tw / 2, hy - 30 * s, tw, 20 * s, 10 * s); ctx.fill(); ctx.fillStyle = `rgba(120,200,240,${la})`; ctx.textAlign = "center"; ctx.fillText(r.name, cx, hy - 16 * s); }
  }
  // mid objects
  const PXM = 16 * s, slot = .5, baseY = hy + 20 * s, nightA = 1 - L;
  const kMin = km + (-40 - busX) / PXM, kMax = km + (W + 40 - busX) / PXM;
  for (let idx = Math.floor(kMin / slot); idx <= Math.ceil(kMax / slot); idx++) {
    const k = idx * slot; if (k < -20 || k > R.total + 20) continue;
    const q = sampleAtKm(clamp(k, 0, R.total)); if (R.rivers.some(r => Math.abs(r.km - k) < 1.2)) continue;
    const r1 = hash(idx * 1.37 + .1), r2 = hash(idx * 2.71 + .3), r3 = hash(idx * 4.13 + .7), x = busX + (k - km) * PXM + (r3 - .5) * 6 * s;
    drawObject(q, x, baseY, r1, r2, r3, idx, L, warm, bot, nightA, rt);
  }
  // fog / mist veil
  if (wx.fog > .02) { const mc = mix(bot, [255, 255, 255], .4); g = ctx.createLinearGradient(0, hy - 60 * s, 0, roadTop); g.addColorStop(0, css(mc, 0)); g.addColorStop(.4, css(mc, wx.fog * .85)); g.addColorStop(1, css(mc, wx.fog * .4)); ctx.fillStyle = g; ctx.fillRect(0, hy - 60 * s, W, roadTop - hy + 60 * s); }
  // near layer: poles + milestones to destination
  const PXN = 34 * s; const nkMin = km + (-60 - busX) / PXN, nkMax = km + (W + 60 - busX) / PXN; const poleC = tint(hex("#8a8578"), L, warm);
  let prev = null; ctx.lineCap = "round";
  for (let i = Math.floor(nkMin / 1.2); i <= Math.ceil(nkMax / 1.2); i++) { const kk = i * 1.2; if (R.rivers.some(r => Math.abs(r.km - kk) < 2.3)) { prev = null; continue; } const x = busX + (kk - km) * PXN, top = roadTop - 58 * s; ctx.strokeStyle = css(poleC); ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(x, roadTop); ctx.lineTo(x, top); ctx.moveTo(x - 7 * s, top + 4 * s); ctx.lineTo(x + 7 * s, top + 4 * s); ctx.stroke(); if (prev !== null) { ctx.strokeStyle = css(poleC, .65); ctx.lineWidth = .8 * s; for (const dx of [-6, 6]) { ctx.beginPath(); ctx.moveTo(prev + dx * s, top + 4 * s); ctx.quadraticCurveTo((prev + x) / 2 + dx * s, top + 14 * s, x + dx * s, top + 4 * s); ctx.stroke(); } } prev = x; }
  ctx.font = `600 ${Math.max(8, 8 * s)}px ${FONT}`; ctx.textAlign = "center";
  for (let n = Math.floor((R.total - nkMax) / 10); n <= Math.ceil((R.total - nkMin) / 10); n++) { if (n < 0) continue; const k = R.total - n * 10, x = busX + (k - km) * PXN, w = 22 * s, h = 26 * s, y = roadTop - h + s; ctx.fillStyle = css(tint([236, 232, 222], Math.max(L, .25), warm)); ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, [w / 2, w / 2, 1, 1]); ctx.fill(); ctx.fillStyle = css(tint([238, 186, 40], Math.max(L, .25), warm)); ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h * .38, [w / 2, w / 2, 0, 0]); ctx.fill(); ctx.fillStyle = "#1e1e22"; ctx.fillText(String(n * 10), x, y + h * .84); }
  // road and bridges
  ctx.fillStyle = css(tint(hex("#3a3d45"), Math.max(L, .1), warm)); ctx.fillRect(0, roadTop, W, H - roadTop);
  ctx.fillStyle = css(tint(hex("#d7cfb8"), Math.max(L, .2), warm)); ctx.fillRect(0, roadTop, W, 2.2 * s);
  ctx.fillStyle = css(tint([226, 222, 210], Math.max(L, .25), warm), .85); const dashY = roadTop + (H - roadTop) * .32, dl = 28 * s, gp = 24 * s, off = (km * PXN) % (dl + gp); for (let x = -off; x < W; x += dl + gp) ctx.fillRect(x, dashY, dl, 2.4 * s);
  for (const r of R.rivers) { const x1 = busX + (r.km - 2.2 - km) * PXN, x2 = busX + (r.km + 2.2 - km) * PXN; if (x2 < 0 || x1 > W) continue; const rc = css(tint(hex("#c9ccd2"), Math.max(L, .3), warm)); ctx.fillStyle = rc; ctx.fillRect(x1, roadTop - 16 * s, x2 - x1, 3 * s); ctx.fillRect(x1, roadTop - 4 * s, x2 - x1, 3 * s); for (let x = x1; x < x2; x += 14 * s) ctx.fillRect(x, roadTop - 16 * s, 2 * s, 15 * s); ctx.strokeStyle = rc; ctx.lineWidth = 1.5 * s; ctx.beginPath(); for (let x = x1; x < x2 - 28 * s; x += 28 * s) { ctx.moveTo(x, roadTop - 4 * s); ctx.lineTo(x + 14 * s, roadTop - 16 * s); ctx.lineTo(x + 28 * s, roadTop - 4 * s); } ctx.stroke(); }
  // bus
  drawBus(busX, H * .965, L, warm, sky, km * 9, st.moving && !reduceMotion ? Math.sin(rt * 17) * .7 * s : 0, R.B.name);
  // rain
  if (wx.rain) { ctx.strokeStyle = `rgba(200,215,235,${.35 + .25 * L})`; ctx.lineWidth = 1.2 * s; ctx.beginPath(); for (let i = 0; i < 160; i++) { const x = (hash(i * 3.7) * W + (reduceMotion ? 0 : rt * 120 * s)) % W, y = (hash(i * 9.1) * H + (reduceMotion ? 0 : rt * 900 * s)) % H; ctx.moveTo(x, y); ctx.lineTo(x - 4 * s, y + 14 * s); } ctx.stroke(); ctx.fillStyle = "rgba(30,40,55,.12)"; ctx.fillRect(0, 0, W, H); }
  if (wx.fog > .05) { ctx.fillStyle = css(mix(bot, [255, 255, 255], .4), wx.fog * .18); ctx.fillRect(0, 0, W, H); }
  document.documentElement.style.setProperty("--sky", `rgb(${sky.top.map(v => v | 0).join(",")})`);
  updateHud(st, sm, clockT, e, sr, ss, wx, L);
  updateMap(st);
  Music.update({ playing, moving: playing && st.moving, halted: !st.moving, arrived: !!st.arrived, clock: clockT, style: sm.style, sample: sm });
}
const FONT = "'IBM Plex Sans', system-ui, sans-serif";
function drawObject(q, x, baseY, r1, r2, r3, idx, L, warm, bot, nightA, rt) {
  const t = q.ter, sz = (.8 + r3 * .6) * s;
  const T = c => css(mix(tint(hex(c), L, warm), bot, .12));
  if (t === "city" || t === "industry") {
    const city = C.find(c => c.name === q.place) || { size: 1 }, big = city.size;
    if (t === "industry" && r1 < .55) { // factory: shed, chimney, smoke, tank
      const bw = (26 + r2 * 26) * s, bh = (14 + r3 * 12) * s; ctx.fillStyle = T("#8d8f96"); ctx.fillRect(x, baseY - bh, bw, bh); ctx.fillStyle = T("#6e7078"); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * bw / 3, baseY - bh); ctx.lineTo(x + (i + .5) * bw / 3, baseY - bh - 7 * s); ctx.lineTo(x + (i + 1) * bw / 3, baseY - bh); ctx.fill(); }
      if (r2 < .7) { const cx = x + bw * .8, ch = (34 + r1 * 30) * s; ctx.fillStyle = T("#9a8f86"); ctx.fillRect(cx, baseY - ch, 5 * s, ch); ctx.fillStyle = "rgba(200,40,40,.8)"; ctx.fillRect(cx, baseY - ch, 5 * s, 3 * s); for (let p = 0; p < 4; p++) { const ph = ((rt * .3 + p / 4 + r3) % 1); ctx.fillStyle = `rgba(190,190,195,${.45 * (1 - ph)})`; ctx.beginPath(); ctx.arc(cx + 2.5 * s + ph * 26 * s, baseY - ch - ph * 30 * s, (4 + ph * 10) * s, 0, 7); ctx.fill(); } }
      if (r3 > .6) { ctx.fillStyle = T("#c7c3b8"); ctx.beginPath(); ctx.ellipse(x - 10 * s, baseY - 8 * s, 9 * s, 8 * s, 0, 0, 7); ctx.fill(); }
      if (nightA > .35) { ctx.fillStyle = `rgba(255,200,110,${(nightA - .35) * 1.2})`; ctx.fillRect(x + 4 * s, baseY - bh * .5, 3 * s, 2 * s); ctx.fillRect(x + bw - 8 * s, baseY - bh * .5, 3 * s, 2 * s); }
      return;
    }
    if (r1 < .85) { const bw = (7 + r2 * 10) * s, bh = (12 + r3 * (20 + big * 14) + (big === 3 ? r3 * r3 * 70 : 0)) * s; ctx.fillStyle = T(["#cdbfa9", "#b7a998", "#d9d2c4", "#a9b2b8"][Math.floor(r2 * 4) % 4]); ctx.fillRect(x, baseY - bh, bw, bh); if (nightA > .35 && bh > 14 * s) { ctx.fillStyle = `rgba(255,210,122,${(nightA - .35) * 1.3})`; for (let wy = baseY - bh + 4 * s, row = 0; wy < baseY - 4 * s; wy += 5 * s, row++) for (let col = 0; col < 3; col++) if (hash(idx * 31 + row * 7 + col) < .32) ctx.fillRect(x + (1.5 + col * (bw / s - 3) / 3) * s, wy, 1.6 * s, 1.8 * s); } }
    return;
  }
  if (t === "mountain") { if (r2 < .55) { const h = (22 + r3 * 18) * s; ctx.fillStyle = T("#2f5a45"); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - (7 - i * 1.5) * s, baseY - i * h / 3.2); ctx.lineTo(x, baseY - h - i * 2 * s); ctx.lineTo(x + (7 - i * 1.5) * s, baseY - i * h / 3.2); ctx.fill(); } ctx.fillStyle = T("#5b4532"); ctx.fillRect(x - s, baseY - 3 * s, 2 * s, 3 * s); } return; }
  if (t === "hills" || t === "forest") { const dens = t === "forest" ? .85 : .6; if (r2 < dens) { const big = t === "forest" ? 1.35 : 1; ctx.fillStyle = T("#5b4532"); ctx.fillRect(x - 1 * sz, baseY - 12 * sz * big, 2 * sz, 12 * sz * big); ctx.fillStyle = T(t === "forest" ? "#24502f" : "#3f7a45"); ctx.beginPath(); ctx.ellipse(x, baseY - 18 * sz * big, 10 * sz * big, 9 * sz * big, 0, 0, 7); ctx.ellipse(x + 6 * sz, baseY - 14 * sz * big, 7 * sz * big, 6 * sz * big, 0, 0, 7); ctx.fill(); } return; }
  if (t === "desert") { if (r2 < .14) { ctx.strokeStyle = T("#6b5038"); ctx.lineWidth = 2 * sz; ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, baseY - 14 * sz); ctx.stroke(); ctx.fillStyle = T("#7e8f4a"); ctx.beginPath(); ctx.ellipse(x, baseY - 17 * sz, 9 * sz, 5 * sz, 0, 0, 7); ctx.fill(); } else if (r2 > .965) { drawCamel(x, baseY, sz, T("#a87a4a"), rt); } return; }
  if (t === "saltflat") { if (r2 < .05) { ctx.fillStyle = T("#ffffff"); ctx.beginPath(); ctx.moveTo(x - 8 * s, baseY); ctx.lineTo(x, baseY - 6 * s); ctx.lineTo(x + 8 * s, baseY); ctx.fill(); } return; }
  // farmland & coast
  const coconut = q.crop === "coconut" || t === "coast" || (q.lat < 16 && q.coastD < 90);
  if (coconut && r2 < .55) { drawPalm(x, baseY, sz, T("#6b5038"), T("#4f7a33"), rt, r1); return; }
  if (q.crop === "sugarcane" && r2 < .7) { ctx.strokeStyle = T("#5aa04e"); ctx.lineWidth = 1.4 * s; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * 3 * s, baseY); ctx.lineTo(x + i * 3 * s + Math.sin(rt + i) * 2 * s, baseY - 22 * s); ctx.stroke(); } return; }
  if (q.crop === "tea" && r2 < .9) { ctx.fillStyle = T("#2f7a3e"); ctx.beginPath(); ctx.ellipse(x, baseY - 4 * s, 9 * s, 5 * s, 0, 0, 7); ctx.fill(); return; }
  if (r2 < .3 + .2 * (1 - r1)) { ctx.fillStyle = T("#6b5038"); ctx.fillRect(x - 1 * sz, baseY - 9 * sz, 2 * sz, 9 * sz); ctx.fillStyle = T("#4f6b3a"); ctx.beginPath(); ctx.ellipse(x, baseY - 14 * sz, 10 * sz, 7.5 * sz, 0, 0, 7); ctx.ellipse(x + 5 * sz, baseY - 11 * sz, 6 * sz, 5 * sz, 0, 0, 7); ctx.fill(); }
  else if (q.crop === "cotton") { ctx.fillStyle = "rgba(255,255,255,.75)"; for (let i = 0; i < 4; i++) ctx.fillRect(x + hash(idx + i) * 12 * s, baseY + (2 + hash(idx * 2 + i) * 10) * s, 2 * s, 2 * s); }
  else if (q.crop === "mustard") { ctx.fillStyle = css(tint(hex("#f2d23a"), L, warm)); for (let i = 0; i < 5; i++) ctx.fillRect(x + hash(idx + i) * 12 * s, baseY + (hash(idx * 3 + i) * 14) * s, 2.4 * s, 2.4 * s); }
}
function drawPalm(x, by, sz, trunk, leaf, rt, r1) { const top = by - 32 * sz, lean = (r1 - .5) * 8 * sz; ctx.strokeStyle = trunk; ctx.lineWidth = 1.8 * sz; ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + lean * .2, by - 16 * sz, x + lean, top); ctx.stroke(); ctx.strokeStyle = leaf; ctx.lineWidth = 2 * sz; for (let f = 0; f < 6; f++) { const a = -Math.PI / 2 + (f - 2.5) * .55 + Math.sin(rt * 1.3 + f) * .04; ctx.beginPath(); ctx.moveTo(x + lean, top); ctx.quadraticCurveTo(x + lean + Math.cos(a) * 8 * sz, top + Math.sin(a) * 8 * sz - 2 * sz, x + lean + Math.cos(a) * 13 * sz, top + Math.sin(a) * 6 * sz + 6 * sz); ctx.stroke(); } }
function drawCamel(x, by, sz, col, rt) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, by - 14 * sz, 9 * sz, 5 * sz, 0, 0, 7); ctx.ellipse(x - 1 * sz, by - 19 * sz, 4 * sz, 3.5 * sz, 0, 0, 7); ctx.fill(); ctx.lineWidth = 1.6 * sz; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x + 8 * sz, by - 15 * sz); ctx.lineTo(x + 12 * sz, by - 24 * sz); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x + 13.5 * sz, by - 24.5 * sz, 3 * sz, 1.8 * sz, 0, 0, 7); ctx.fill(); for (const lx of [-6, -3, 4, 7]) { ctx.beginPath(); ctx.moveTo(x + lx * sz, by - 11 * sz); ctx.lineTo(x + lx * sz + Math.sin(rt * 3 + lx) * sz, by); ctx.stroke(); } }
function drawBus(x, yRoad, L, warm, sky, ang, bob, dest) {
  const Lb = Math.max(L, .22), night = 1 - L, bw = 172 * s, bh = 60 * s, bx = x - bw / 2, by = yRoad - bh - 14 * s + bob;
  ctx.fillStyle = `rgba(0,0,0,${.12 + .2 * L})`; ctx.beginPath(); ctx.ellipse(x, yRoad - s, bw * .55, 5 * s, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, [12 * s, 16 * s, 6 * s, 6 * s]); ctx.fillStyle = css(tint(hex("#f3f0e8"), Lb, warm)); ctx.fill(); ctx.clip();
  ctx.fillStyle = css(tint(hex("#f2a541"), Lb, warm)); ctx.fillRect(bx, by + bh * .58, bw, bh * .12); ctx.fillStyle = css(tint(hex("#464a56"), Lb, warm)); ctx.fillRect(bx, by + bh * .8, bw, bh * .2); ctx.restore();
  const glass = mix(mix([38, 56, 76], sky.bot, .25), [255, 212, 138], clamp((night - .35) * 1.6, 0, 1)); const wy = by + 9 * s, wh = 21 * s, wend = bx + bw - 56 * s;
  ctx.fillStyle = css(glass); for (let wx = bx + 12 * s; wx + 18 * s <= wend; wx += 21 * s) { ctx.beginPath(); ctx.roundRect(wx, wy, 18 * s, wh, 2.5 * s); ctx.fill(); }
  ctx.beginPath(); ctx.roundRect(bx + bw - 51 * s, wy, 14 * s, bh - 17 * s, 2 * s); ctx.fillStyle = css(mix(glass, [20, 24, 32], .35)); ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx + bw - 33 * s, wy); ctx.lineTo(bx + bw - 8 * s, wy); ctx.quadraticCurveTo(bx + bw - 2 * s, wy + 2 * s, bx + bw - 1.5 * s, wy + wh + 8 * s); ctx.lineTo(bx + bw - 33 * s, wy + wh + 8 * s); ctx.closePath(); ctx.fillStyle = css(glass); ctx.fill();
  ctx.fillStyle = "#111318"; ctx.fillRect(bx + bw - 34 * s, by + 2 * s, 27 * s, 6 * s); ctx.fillStyle = `rgba(255,170,60,${.8 + .2 * night})`; ctx.font = `700 ${4.6 * s}px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(dest.toUpperCase().slice(0, 10), bx + bw - 20.5 * s, by + 6.6 * s);
  ctx.fillStyle = css(night > .45 ? [255, 246, 205] : tint([235, 232, 218], Lb, warm)); ctx.fillRect(bx + bw - 6 * s, by + bh - 21 * s, 5 * s, 5 * s); ctx.fillStyle = `rgba(214,48,40,${.7 + .3 * night})`; ctx.fillRect(bx + s, by + bh - 23 * s, 3.5 * s, 7 * s);
  for (const cx of [bx + 34 * s, bx + bw - 40 * s]) { const cy = yRoad - 11.5 * s; ctx.fillStyle = "#1c1d22"; ctx.beginPath(); ctx.arc(cx, cy - s, 14 * s, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#17181c"; ctx.beginPath(); ctx.arc(cx, cy, 11.5 * s, 0, 7); ctx.fill(); ctx.fillStyle = css(tint([178, 180, 188], Lb, 0)); ctx.beginPath(); ctx.arc(cx, cy, 5.5 * s, 0, 7); ctx.fill(); ctx.strokeStyle = "#2a2b31"; ctx.lineWidth = 1.2 * s; ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = ang + k * 1.2566; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 5 * s, cy + Math.sin(a) * 5 * s); } ctx.stroke(); }
  if (night > .4) { const a = (night - .4) * 1.4, hx = bx + bw - s, hy2 = by + bh - 18 * s; ctx.save(); ctx.globalCompositeOperation = "lighter"; const bg = ctx.createLinearGradient(hx, 0, hx + 260 * s, 0); bg.addColorStop(0, `rgba(255,240,190,${.42 * a})`); bg.addColorStop(1, "rgba(255,240,190,0)"); ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(hx, hy2 - 2 * s); ctx.lineTo(hx + 260 * s, hy2 - 26 * s); ctx.lineTo(hx + 260 * s, yRoad + 6 * s); ctx.lineTo(hx, hy2 + 4 * s); ctx.closePath(); ctx.fill(); ctx.restore(); }
}

/* ---------------- HUD ---------------- */
const hud = {}; ["clock", "clockSub", "daybar", "where", "whereSub", "km", "kmSub", "next", "nextSub", "speed", "speedSub", "temp", "tempSub", "sky", "skySub", "chipTime", "chipPlace", "terChip", "scrub", "log", "toast", "play", "profileMarker"].forEach(id => hud[id] = $(id));
let toastTimer = 0;
function updateHud(st, sm, clockT, e, sr, ss, wx, L) {
  const [hm, ap] = fmt(clockT, true), html = `${hm}<small>${ap}</small>`; if (hud.clock.innerHTML !== html) hud.clock.innerHTML = html;
  setText(hud.clockSub, `Day ${Math.floor(clockT / 24) + 1} · ${dur(simMin)} on the road`); hud.daybar.style.width = (simMin / R.totalMin * 100).toFixed(2) + "%";
  setText(hud.chipTime, fmt(clockT));
  const stName = G.STATES[sm.st] || sm.st;
  let where, whereSub;
  if (st.arrived) { where = R.B.name; whereSub = `Arrived · ${G.STATES[R.B.st]}`; }
  else if (st.halted || st.atStart) { const h = st.halted; where = h ? `Halted near ${h.name}` : R.A.name; whereSub = h ? (h.kind === "meal" ? `${h.meal} halt` : "Short stop") : "Boarding"; }
  else { where = sm.nearD < 12 ? `Near ${sm.near}` : `${Math.round(sm.nearD)} km from ${sm.near}`; whereSub = stName; }
  setText(hud.where, where); setText(hud.whereSub, whereSub); setText(hud.chipPlace, st.arrived ? `Arrived in ${R.B.name}` : where);
  const terLabel = sm.ter === "farmland" ? `${CROP[sm.crop][0]} fields` : (sm.zone && (sm.ter === sm.zone.kind) ? sm.zone.name : TER[sm.ter].label);
  setText(hud.terChip, terLabel); hud.terChip.style.setProperty("--tc", TER[sm.ter].color);
  setText(hud.km, `${Math.round(st.km)} km`); setText(hud.kmSub, st.arrived ? "Journey complete" : `${Math.round(R.total - st.km)} km to go`);
  const nextR = R.rivers.find(r => r.km > st.km + .5), nextC = R.pathCities.find((c, i) => R.cityKm[i] > st.km + 1);
  if (nextC && !st.arrived) { const i = R.pathCities.indexOf(nextC), kIdx = Math.round(R.cityKm[i] / R.total * R.N); setText(hud.next, nextC.name); setText(hud.nextSub, `ETA ${fmt(depHour + R.arr[kIdx] / 60)}${nextR && nextR.km < R.cityKm[i] ? ` · ${nextR.name} first` : ""}`); }
  else { setText(hud.next, "—"); setText(hud.nextSub, `Arrived ${fmt(depHour + R.totalMin / 60)}`); }
  setText(hud.speed, `${Math.round(st.moving ? st.speed : 0)} km/h`); setText(hud.speedSub, st.moving ? TER[sm.ter].label : st.arrived ? "Engine off" : "Parked");
  const temp = temperature(sm, clockT, sr, wx.rain); setText(hud.temp, `${Math.round(temp)}°C`); setText(hud.tempSub, sm.ter === "mountain" ? "Cold mountain air" : sm.coastD < 30 ? "Humid sea breeze" : "Typical for the season");
  const h = ((clockT % 24) + 24) % 24;
  let words = e < -6 ? "Night" : e < -.8 ? (h < 12 ? "Dawn" : "Dusk") : e < 7 ? (h < 12 ? "Sunrise" : "Sunset") : h < 12 ? "Morning" : e < 16 ? "Golden hour" : "Daytime";
  if (wx.rain) words += ", rain"; else if (wx.fog > .3) words += ", dense fog"; else if (e > 7) words += ", clear";
  setText(hud.sky, words); setText(hud.skySub, e > 0 ? `Sun ${Math.round(e)}° up · sets ${fmt(ss)}` : `Sun below horizon · rises ${fmt(sr)}`);
  if (document.activeElement !== hud.scrub) hud.scrub.value = Math.round(simMin / R.totalMin * 1000);
  hud.profileMarker.style.left = (st.km / R.total * 100).toFixed(2) + "%";
  let n = 0; while (n < R.events.length && R.events[n][0] <= simMin + 1e-6) n++;
  if (n !== shownEvents) { if (n > shownEvents && shownEvents >= 0 && playing && n > 0) showToast(`${fmt(depHour + R.events[n - 1][0] / 60)} · ${R.events[n - 1][1]}`); shownEvents = n; renderLog(n); }
}
const EVICON = { river: "≈", state: "⌂", mountain: "▲", hills: "▴", desert: "∴", saltflat: "◇", coast: "~", forest: "♣", industry: "▤", city: "■", farmland: "≡", halt: "☕", start: "●", end: "◆" };
function renderLog(n) {
  if (n === 0) { hud.log.innerHTML = `<li class="empty">Press Play to set off.</li>`; return; }
  hud.log.innerHTML = R.events.slice(0, n).map((ev, i) => `<li class="${i === n - 1 ? "latest" : ""} k-${ev[2]}"><time>${fmt(depHour + ev[0] / 60)}</time><i aria-hidden="true">${EVICON[ev[2]] || "•"}</i><span>${ev[1]}</span></li>`).join("");
  hud.log.scrollTop = hud.log.scrollHeight;
}
function showToast(t) { hud.toast.textContent = t; hud.toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => hud.toast.classList.remove("show"), 2800); }

/* ---------------- infographics ---------------- */
function renderInfographics() {
  $("tripTitle").textContent = `${R.A.name} → ${R.B.name}`;
  const legs = R.pathCities.map(c => c.name);
  $("tripVia").textContent = legs.length > 2 ? `via ${legs.slice(1, -1).join(", ")}` : "Direct";
  $("sumKm").textContent = `${Math.round(R.total)} km`;
  $("sumTime").textContent = dur(R.totalMin);
  { const endH = depHour + R.totalMin / 60, dd = Math.floor(endH / 24); $("sumArr").textContent = `Arrives ${fmt(endH)}${dd === 1 ? " next day" : dd > 1 ? ` on day ${dd + 1}` : ""}`; }
  $("sumStates").textContent = R.states.length; $("sumRivers").textContent = R.rivers.length;
  $("stateChips").innerHTML = R.states.map(s => `<span class="chip2">${G.STATES[s] || s}</span>`).join("");
  // composition
  const tot = R.total;
  $("compBar").innerHTML = R.comp.map(([t, k]) => `<span style="flex:${k};background:${TER[t].color}" title="${TER[t].label} ${Math.round(k)} km"></span>`).join("");
  $("compLegend").innerHTML = R.comp.map(([t, k]) => `<li><i style="background:${TER[t].color}"></i><b>${TER[t].label}</b><span>${Math.round(k / tot * 100)}% · ${Math.round(k)} km</span></li>`).join("");
  const crops = {}; R.S.forEach(x => { if (x.ter === "farmland") crops[x.crop] = (crops[x.crop] || 0) + 1; });
  const cropTxt = Object.entries(crops).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => CROP[c][0].toLowerCase());
  $("cropNote").textContent = cropTxt.length ? `Fields you'll pass this season: ${cropTxt.join(", ")}.` : "";
  // profile strip
  const pc = $("profile"), pr = pc.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); pc.width = pr.width * dpr; pc.height = pr.height * dpr; const p = pc.getContext("2d"); p.setTransform(dpr, 0, 0, dpr, 0, 0);
  const PW = pr.width, PH = pr.height; p.clearRect(0, 0, PW, PH);
  for (let k = 0; k < R.S.length - 1; k++) { const x0 = k / R.N * PW, x1 = (k + 1) / R.N * PW; p.fillStyle = TER[R.S[k].ter].color; p.fillRect(x0, 18, x1 - x0 + .6, PH - 36); }
  p.fillStyle = "rgba(10,14,24,.85)"; p.font = "600 10px 'IBM Plex Sans', sans-serif"; p.textAlign = "center";
  R.rivers.forEach(r => { const x = r.km / R.total * PW; p.fillStyle = "#6CC4F0"; p.fillRect(x - 1, 14, 2, PH - 28); });
  let lastX = -99; p.fillStyle = "#C9D3E6"; p.textAlign = "left";
  for (let k = 0; k < R.S.length; k++) if (k === 0 || R.S[k].st !== R.S[k - 1].st) { const x = k / R.N * PW; p.fillStyle = "rgba(255,255,255,.7)"; p.fillRect(x, 0, 1, 16); if (x - lastX > 60) { p.fillStyle = "#C9D3E6"; p.fillText(G.STATES[R.S[k].st] || R.S[k].st, x + 3, 11); lastX = x; } }
  R.halts.forEach(h => { const x = R.S[h.k].km / R.total * PW; p.fillStyle = "#F2A541"; p.beginPath(); p.arc(x, PH - 8, 3.5, 0, 7); p.fill(); });
  p.fillStyle = "#9BA6BD"; p.textAlign = "left"; p.fillText(R.A.name, 0, PH - 1); p.textAlign = "right"; p.fillText(R.B.name, PW, PH - 1);
  // rivers list
  $("riverList").innerHTML = R.rivers.length ? R.rivers.map(r => `<li><b>${r.name}</b><span>km ${Math.round(r.km)} · ${G.STATES[r.st] || r.st}</span></li>`).join("") : `<li class="empty">No major river crossings on this route.</li>`;
  buildMap();
  buildStrip();
}
/* ---------------- map ---------------- */
let MP = null;
function buildMap() {
  const svg = $("map"); const lons = R.pts.map(p => p[0]), lats = R.pts.map(p => p[1]);
  let x0 = Math.min(...lons), x1 = Math.max(...lons), y0 = Math.min(...lats), y1 = Math.max(...lats);
  const pad = Math.max(.8, (x1 - x0) * .15, (y1 - y0) * .15); x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const kx = Math.cos((y0 + y1) / 2 * RAD); let w = (x1 - x0) * kx, h = y1 - y0;
  if (w / h < .8) { const add = (.8 * h - w) / kx / 2; x0 -= add; x1 += add; w = .8 * h; } else if (w / h > 1.4) { const add = (w / 1.4 - h) / 2; y0 -= add; y1 += add; h = w / 1.4; }
  const S = 600 / w, VW = 600, VH = Math.round(h * S);
  const P = (lo, la) => [((lo - x0) * kx * S).toFixed(1), ((y1 - la) * S).toFixed(1)];
  const pts = a => a.map(p => P(p[0], p[1]).join(",")).join(" ");
  let o = `<rect width="${VW}" height="${VH}" fill="#1D2638"/>`;
  o += `<polygon points="${pts(G.SEA)}" fill="#12304A"/>`;
  G.NOGO.forEach(n => o += `<polygon points="${pts(n.poly)}" fill="#192132" stroke="#2A344A" stroke-dasharray="3 3"/>`);
  G.ZONES.forEach(z => { const col = { mountain: "#6B7C93", hills: "#3E6E4A", desert: "#8A7346", saltflat: "#8E8B83", forest: "#2B5536" }[z.kind]; o += `<polygon points="${pts(z.poly)}" fill="${col}" fill-opacity=".35"/>`; });
  Object.values(G.RIVERS).forEach(l => o += `<polyline points="${pts(l)}" fill="none" stroke="#4FA3D6" stroke-width="${Math.max(1, 1.4 * S / 120)}" stroke-linejoin="round" opacity=".85"/>`);
  o += `<polyline points="${pts(R.pts)}" fill="none" stroke="#8C97B3" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>`;
  o += `<polyline id="mDone" fill="none" stroke="#F2A541" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  R.rivers.forEach(r => { const [lo, la] = R.posAt(r.km), [x, y] = P(lo, la); o += `<circle cx="${x}" cy="${y}" r="4" fill="#6CC4F0" stroke="#0d1322" stroke-width="1.5"/>`; });
  const shown = C.filter(c => c.lon > x0 && c.lon < x1 && c.lat > y0 && c.lat < y1);
  shown.forEach(c => { const onR = R.pathCities.includes(c), [x, y] = P(c.lon, c.lat); if (!onR && c.size < 2) return; o += `<circle cx="${x}" cy="${y}" r="${onR ? 4.5 : 2.5}" fill="${onR ? "#E9EDF5" : "#7C879E"}" stroke="#0d1322" stroke-width="1.5"/>`; if (onR || c.size >= 3) o += `<text x="${(+x + 8).toFixed(1)}" y="${(+y + 4).toFixed(1)}" class="${onR ? "mc" : "mc2"}">${c.name}</text>`; });
  o += `<g id="mBus"><circle class="pulse" r="10" fill="#F2A541"/><circle r="7" fill="#F2A541" stroke="#1a1206" stroke-width="2.5"/></g>`;
  svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`); svg.innerHTML = o + `<style>.mc{font:600 ${Math.max(11, VW / 45)}px 'IBM Plex Sans',sans-serif;fill:#E9EDF5;paint-order:stroke;stroke:#0d1322;stroke-width:3px}.mc2{font:500 ${Math.max(10, VW / 55)}px 'IBM Plex Sans',sans-serif;fill:#9BA6BD;paint-order:stroke;stroke:#0d1322;stroke-width:3px}</style>`;
  if (reduceMotion) svg.querySelector(".pulse").classList.remove("pulse");
  MP = { P, done: svg.querySelector("#mDone"), bus: svg.querySelector("#mBus") };
}
function updateMap(st) {
  if (!MP) return; const [lo, la] = R.posAt(st.km), [x, y] = MP.P(lo, la); MP.bus.setAttribute("transform", `translate(${x},${y})`);
  const k = Math.min(R.cum.length - 1, R.cum.findIndex(c => c > st.km)); const done = R.pts.slice(0, k < 0 ? R.pts.length : k).concat([[lo, la]]);
  MP.done.setAttribute("points", done.map(p => MP.P(p[0], p[1]).join(",")).join(" "));
}
function buildStrip() {
  const stops = [], sp = sunParams(doyOf(jDate));
  for (let i = 0; i <= 30; i++) { const m = i / 30 * R.totalMin, st = stateAt(m), sm = sampleAtKm(st.km), e = sunElev(sm.lat, sm.lon, depHour + m / 60, sp), sk = skyAt(e); stops.push(`${css(mix(sk.top, sk.bot, .55))} ${(i / 30 * 100).toFixed(1)}%`); }
  hud.scrub.style.setProperty("--strip", `linear-gradient(90deg, ${stops.join(",")})`);
  $("sStart").textContent = fmt(depHour); $("sMid").textContent = fmt(depHour + R.totalMin / 120); $("sEnd").textContent = fmt(depHour + R.totalMin / 60);
}

/* ---------------- music: regional styles, synthesised live ---------------- */
const Music = (() => {
  let ac = null, master = null, fx = null, noise = null, on = false, timer = null, nextT = 0, matra = 0, bar = 0, deg = 0, prevF = null, ended = false, rng = 7, curStyle = null, raga = null, plan = [];
  let st = { playing: false, moving: false, halted: true, arrived: false, clock: 6, style: "hindustani" };
  const SA = 138.59;
  const KEH = ["dha", "ge", "na", "ti", "na", "ka", "dhi", "na"], DAD = ["dha", "dhi", "na", "dha", "ti", "na"];
  const STY = {
    hindustani: { label: "Hindustani (raga follows the clock)", lead: "flute", kit: "tabla", tala: KEH, matra: .3, timeRaga: true },
    punjabi: { label: "Punjabi bhangra", lead: "tumbi", kit: "dhol", tala: ["B", "-", "T", "B", "-", "T", "B", "T"], matra: .2, ragas: [["Khamaj (folk)", [0, 2, 4, 5, 7, 9, 10]]] },
    rajasthani: { label: "Rajasthani folk", lead: "bowed", kit: "dholak", tala: KEH, matra: .27, khartal: true, ragas: [["Raag Maand", [0, 2, 4, 5, 7, 9, 11]]] },
    garba: { label: "Gujarati garba", lead: "flute", kit: "dhol", tala: ["B", "T", "T", "B", "T", "T"], matra: .19, ragas: [["Bilawal", [0, 2, 4, 5, 7, 9, 11]]] },
    lavani: { label: "Marathi lavani", lead: "flute", kit: "dholki", tala: ["D", "G", "T", "N", "D", "D", "T", "N"], matra: .19, ragas: [["Raag Bhupali", [0, 2, 4, 7, 9]]] },
    carnatic: { label: "Carnatic", lead: "veena", kit: "mridangam", tala: ["TH", "NA", "TA", "DHI", "TH", "NA", "TA", "KA"], matra: .25, timeRagaC: true },
    eastern: { label: "Bengali boatman (bhatiyali)", lead: "flute", kit: "khol", tala: DAD, matra: .32, ektara: true, ragas: [["Bhatiyali (folk)", [0, 2, 3, 5, 7, 9, 10]]] },
    northeast: { label: "North-East bamboo flute", lead: "flutehi", kit: "light", tala: ["L", "-", "H", "-", "L", "L", "H", "-"], matra: .3, ragas: [["Pentatonic folk", [0, 2, 4, 7, 9]]] },
    pahadi: { label: "Pahadi (hill folk)", lead: "flute", kit: "tablasoft", tala: DAD, matra: .3, ragas: [["Raag Pahadi", [0, 2, 4, 5, 7, 9]]] }
  };
  const HRAGA = h => { h = ((h % 24) + 24) % 24; return h >= 4 && h < 9.5 ? ["Raag Bhairav", [0, 1, 4, 5, 7, 8, 11]] : h < 16 && h >= 9.5 ? ["Raag Bhupali", [0, 2, 4, 7, 9]] : h >= 16 && h < 20.5 ? ["Raag Yaman", [0, 2, 4, 6, 7, 9, 11]] : ["Raag Malkauns", [0, 3, 5, 8, 10]]; };
  const CRAGA = h => { h = ((h % 24) + 24) % 24; return h >= 4 && h < 12 ? ["Raga Mohanam", [0, 2, 4, 7, 9]] : h < 18 ? ["Raga Hamsadhwani", [0, 2, 4, 7, 11]] : ["Raga Kalyani", [0, 2, 4, 6, 7, 9, 11]]; };
  const rand = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };
  function init() { ac = new (window.AudioContext || window.webkitAudioContext)(); const comp = ac.createDynamicsCompressor(); comp.connect(ac.destination); master = ac.createGain(); master.gain.value = 0; master.connect(comp); const d = ac.createDelay(1); d.delayTime.value = .27; const fb = ac.createGain(); fb.gain.value = .28; const wet = ac.createGain(); wet.gain.value = .2; d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master); fx = d; noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const ch = noise.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  const env = (g, t, a, pk, dec) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); };
  const out = (n, send = .25) => { n.connect(master); if (send) { const sg = ac.createGain(); sg.gain.value = send; n.connect(sg); sg.connect(fx); } };
  const osc = (type, f, t, stop) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(stop); return o; };
  const nz = (t, stop) => { const n = ac.createBufferSource(); n.buffer = noise; n.start(t); n.stop(stop); return n; };
  function pluck(t, f, vol = .045) { const o = osc("sawtooth", f, t, t + 3), o2 = osc("sawtooth", f * 1.003, t, t + 3), lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(500, t + 2.5); const g = ac.createGain(); env(g, t, .02, vol, 2.8); o.connect(lp); o2.connect(lp); lp.connect(g); out(g, .3); }
  function lead(kind, t, f, d, vol) {
    if (kind === "tumbi") { const o = osc("square", f * 2, t, t + .35), bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f * 4; bp.Q.value = 1.2; const g = ac.createGain(); env(g, t, .004, vol * .7, .28); o.connect(bp); bp.connect(g); out(g, .2); prevF = f; return; }
    if (kind === "veena") { const o = osc("sawtooth", prevF && Math.abs(prevF - f) < f * .2 ? prevF : f * .944, t, t + d + .9); o.frequency.exponentialRampToValueAtTime(f, t + .09); const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(700, t + d + .6); const g = ac.createGain(); env(g, t, .006, vol * .8, d + .7); o.connect(lp); lp.connect(g); out(g, .35); prevF = f; return; }
    if (kind === "bowed") { const o = osc("sawtooth", prevF || f, t, t + d + .2); o.frequency.exponentialRampToValueAtTime(f, t + .1); const vib = osc("sine", 6, t, t + d + .2), vg = ac.createGain(); vg.gain.value = f * .012; vib.connect(vg); vg.connect(o.frequency); const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1700; const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol * .55, t + .14); g.gain.setValueAtTime(vol * .55, t + Math.max(.15, d - .1)); g.gain.exponentialRampToValueAtTime(.0001, t + d + .15); o.connect(lp); lp.connect(g); out(g, .35); prevF = f; return; }
    const ff = kind === "flutehi" ? f * 2 : f;
    const o = osc("sine", prevF ? (kind === "flutehi" ? prevF * 2 : prevF) : ff, t, t + d + .15); o.frequency.exponentialRampToValueAtTime(ff, t + .06); const o2 = osc("triangle", ff * 2, t, t + d + .15);
    const vib = osc("sine", 5.3, t, t + d + .15), vg = ac.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(ff * .007, t + Math.min(.35, d * .6)); vib.connect(vg); vg.connect(o.frequency);
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .07); g.gain.setValueAtTime(vol, t + Math.max(.08, d - .12)); g.gain.exponentialRampToValueAtTime(.0001, t + d + .1);
    const g2 = ac.createGain(); g2.gain.value = .12; o.connect(g); o2.connect(g2); g2.connect(g);
    const n = nz(t, t + .35), bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = ff * 2.5; bp.Q.value = 2; const ng = ac.createGain(); env(ng, t, .03, .025, .25); n.connect(bp); bp.connect(ng); out(ng, .2); out(g, .35); prevF = f;
  }
  const drum = (t, f0, f1, dec, vol, type = "sine") => { const o = osc(type, f0, t, t + dec + .1); o.frequency.exponentialRampToValueAtTime(f1, t + dec * .8); const g = ac.createGain(); env(g, t, .004, vol, dec); o.connect(g); out(g, .08); };
  const click = (t, fc, vol, dec = .03, hp = true) => { const n = nz(t, t + dec + .05), fl = ac.createBiquadFilter(); fl.type = hp ? "highpass" : "lowpass"; fl.frequency.value = fc; const g = ac.createGain(); env(g, t, .002, vol, dec); n.connect(fl); fl.connect(g); out(g, 0); };
  const ring = (t, f, vol, dec) => { const o = osc("sine", f, t, t + dec + .05), o2 = osc("sine", f * 2.01, t, t + dec + .05), g = ac.createGain(); env(g, t, .003, vol, dec); const g2 = ac.createGain(); g2.gain.value = .35; o.connect(g); o2.connect(g2); g2.connect(g); out(g, .12); };
  function stroke(kit, s, t) {
    if (s === "-") return;
    if (kit === "tabla" || kit === "tablasoft") { const v = kit === "tablasoft" ? .6 : 1; if (s === "dha") { drum(t, 120, 68, .38, .4 * v); ring(t, SA * 4, .16 * v, .2); } else if (s === "dhi") { drum(t, 120, 68, .3, .3 * v); ring(t, SA * 4, .12 * v, .2); } else if (s === "ge") drum(t, 120, 68, .3, .28 * v); else if (s === "na") ring(t, SA * 4, .13 * v, .16); else if (s === "ti") ring(t, SA * 6, .09 * v, .07); else if (s === "ka") click(t, 900, .14, .06, false); return; }
    if (kit === "dhol") { if (s === "B") { drum(t, 95, 48, .38, .55); click(t, 300, .08, .04, false); } else { click(t, 2200, .16, .035); drum(t, 680, 600, .07, .08); } return; }
    if (kit === "dholak" || kit === "dholki" || kit === "khol") { const lo = kit === "khol" ? 105 : 140; if (s === "D" || s === "dha" || s === "dhi") { drum(t, lo, lo * .58, .28, .38); ring(t, kit === "khol" ? 420 : 620, .1, .1); } else if (s === "G" || s === "ge") drum(t, lo, lo * .58, .24, .28); else if (s === "T" || s === "ti" || s === "ka") { click(t, 1800, .12, .03); ring(t, 900, .08, .05); } else ring(t, kit === "khol" ? 480 : 640, .11, .12); return; }
    if (kit === "mridangam") { if (s === "TH") drum(t, 105, 82, .34, .42); else if (s === "NA") ring(t, 430, .16, .34); else if (s === "TA") ring(t, 640, .1, .08); else if (s === "DHI") { drum(t, 105, 82, .3, .34); ring(t, 430, .13, .3); } else click(t, 700, .13, .05, false); return; }
    if (kit === "light") { if (s === "L") drum(t, 160, 110, .2, .22); else ring(t, 1150, .08, .05); }
  }
  const freqOf = (sc, d) => { const n = sc.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return SA * 2 * Math.pow(2, o + sc[i] / 12); };
  function pickRaga() { const S = STY[curStyle]; raga = S.timeRaga ? HRAGA(st.clock) : S.timeRagaC ? CRAGA(st.clock) : S.ragas[0]; }
  function planBar(len) {
    const n = raga[1].length; plan = [];
    if (st.halted && !st.arrived) { plan = [[0, len, Math.round(rand() * 3) - 1]]; return; }
    const R8 = [[2, 2, 2, 2], [3, 1, 2, 2], [1, 1, 2, 4], [2, 1, 1, 4], [4, 2, 2], [2, 2, 4], [1, 1, 1, 1, 4]], R6 = [[2, 1, 3], [3, 3], [1, 1, 1, 3], [2, 2, 2], [1, 2, 3]];
    const rh = (len === 6 ? R6 : R8)[Math.floor(rand() * (len === 6 ? R6 : R8).length)]; let pos = 0;
    rh.forEach((l, k) => { const last = k === rh.length - 1 && bar % 4 === 3; if (last) deg = rand() < .5 ? 0 : n; else { deg += [-2, -1, -1, 1, 1, 2, 0][Math.floor(rand() * 7)]; deg = Math.max(-2, Math.min(n + 3, deg)); } plan.push([pos, l, deg]); pos += l; });
  }
  function scheduleMatra(t) {
    const S = STY[curStyle], len = S.tala.length, m = matra % len;
    if (m === 0) { if (st.style !== curStyle) { curStyle = st.style; matra = 0; prevF = null; deg = 0; pickRaga(); showNow(); return scheduleMatra(t); } const old = raga && raga[0]; pickRaga(); if (raga[0] !== old) { prevF = null; showNow(); } planBar(len); }
    if (m % 2 === 0) { const k = (m / 2) % 4, dr = raga[1].includes(7) ? 7 : 5; pluck(t, k === 0 ? SA * Math.pow(2, dr / 12) : k === 3 ? SA / 2 : SA); }
    if (st.moving) { stroke(S.kit, S.tala[m], t); if (S.khartal && m % 2 === 1) click(t, 3500, .07, .02); if (S.ektara && m % 3 === 0) lead("tumbi", t, SA * 2, .2, .05); }
    for (const [pos, l, d] of plan) if (pos === m) lead(S.lead, t, freqOf(raga[1], d), l * S.matra * (st.halted ? 1.2 : .95), st.halted ? .09 : .12);
    matra++; if (m === len - 1) bar++;
  }
  function tick() { if (!ac) return; while (nextT < ac.currentTime + .25) { const S = STY[curStyle || st.style]; if (st.arrived) { if (!ended) { ended = true; prevF = null; lead("flute", nextT, SA * 2, 2.6, .12); lead("flute", nextT + 2.6, SA * 4, 3.2, .1); pluck(nextT, SA, .06); } nextT += S.matra; continue; } ended = false; if (!curStyle) { curStyle = st.style; pickRaga(); showNow(); } scheduleMatra(nextT); nextT += STY[curStyle].matra; } }
  function setGain(v, time = .4) { if (!ac) return; const now = ac.currentTime; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(v, now + time); }
  function showNow() { const el = $("musicNote"); if (!el) return; if (!on || !curStyle) { el.innerHTML = "Original music synthesised live. The style changes with the region: Punjabi dhol, Rajasthani folk, garba, lavani, Carnatic, Bengali, North-East and Pahadi."; return; } el.innerHTML = `Now playing: <b>${STY[curStyle].label}</b> · ${raga ? raga[0] : ""}`; }
  function sync() { $("musicLabel").textContent = on ? "Music on" : "Music off"; $("music").setAttribute("aria-pressed", String(on)); $("tapMusic").hidden = on; showNow(); }
  return {
    toggle() { try { if (!ac) init(); on = !on; if (on) { ac.resume(); curStyle = null; nextT = ac.currentTime + .1; matra = 0; bar = 0; rng = 7; if (!timer) timer = setInterval(tick, 50); setGain(st.playing ? .8 : 0, .6); } else setGain(0, .4); } catch (e) { on = false; $("musicNote").textContent = "Music couldn't start in this browser."; } sync(); },
    isOn: () => on,
    update(n) { const wp = st.playing, wa = st.arrived; st = n; if (!ac || !on) return; if (n.playing !== wp || n.arrived !== wa) { if (n.playing) { if (wa && !n.arrived) { matra = 0; bar = 0; } nextT = Math.max(nextT, ac.currentTime + .05); setGain(.8, .5); } else if (n.arrived) setGain(0, 7); else setGain(0, .5); } },
    reset() { curStyle = null; matra = 0; bar = 0; showNow(); }, sync
  };
})();

/* ---------------- controls ---------------- */
const PLAY_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>`, PAUSE_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>`;
function syncPlay() { if (!R) return; const label = playing ? "Pause" : (simMin >= R.totalMin ? "Replay" : "Play"); hud.play.innerHTML = (playing ? PAUSE_ICON : PLAY_ICON) + label; hud.play.setAttribute("aria-label", label); }
hud.play.addEventListener("click", () => { if (!R) return; if (!playing && simMin >= R.totalMin) { simMin = 0; shownEvents = -1; } playing = !playing; lastTs = null; syncPlay(); });
$("restart").addEventListener("click", () => { simMin = 0; shownEvents = -1; playing = true; lastTs = null; syncPlay(); });
$("music").addEventListener("click", () => Music.toggle());
$("tapMusic").addEventListener("click", () => { if (!Music.isOn()) Music.toggle(); if (R && !playing) { if (simMin >= R.totalMin) { simMin = 0; shownEvents = -1; } playing = true; lastTs = null; syncPlay(); } });
document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => { speedMul = +b.dataset.mul; syncRate(); }));
function syncRate() { if (!R) return; document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.mul === speedMul))); const secs = 120 / speedMul; rate = R.totalMin / secs; $("rateNote").textContent = `The whole ${dur(R.totalMin)} trip plays in ${secs >= 60 ? (secs / 60).toFixed(secs % 60 ? 1 : 0) + " min" : secs + " s"}.`; }
hud.scrub.addEventListener("input", () => { if (!R) return; simMin = +hud.scrub.value / 1000 * R.totalMin; lastTs = null; });
document.addEventListener("keydown", ev => { if (ev.code === "Space" && !["SELECT", "INPUT", "BUTTON", "TEXTAREA"].includes(document.activeElement.tagName)) { ev.preventDefault(); hud.play.click(); } });

/* ---------------- planner ---------------- */
const dl = $("cityList"); dl.innerHTML = C.map(c => `<option value="${c.name}">${G.STATES[c.st]}</option>`).join("");
const today = new Date(); $("jdate").value = today.toISOString().slice(0, 10);
function plan(ev) {
  if (ev) ev.preventDefault();
  const msg = $("formMsg"); msg.textContent = "";
  const a = findCity($("from").value), b = findCity($("to").value), vRaw = $("via").value.trim(), v = vRaw ? findCity(vRaw) : null;
  const bad = (r, label) => r.err === "empty" ? `Enter a ${label} city.` : `Couldn't find “${label === "start" ? $("from").value : label === "end" ? $("to").value : vRaw}”.${r.suggest ? " Try: " + r.suggest.join(", ") + "." : ""}`;
  if (!a.city) { msg.textContent = bad(a, "start"); return; } if (!b.city) { msg.textContent = bad(b, "end"); return; } if (v && !v.city) { msg.textContent = bad(v, "via"); return; }
  if (a.city === b.city) { msg.textContent = "Start and end are the same city. Pick two different places."; return; }
  const [hh, mm] = ($("dtime").value || "06:00").split(":").map(Number); depHour = hh + (mm || 0) / 60;
  const dv = $("jdate").value; jDate = dv ? new Date(dv + "T12:00:00") : new Date();
  const r = buildJourney(a.city, b.city, v && v.city);
  if (!r) { msg.textContent = `No road route found between ${a.city.name} and ${b.city.name} in this map.`; return; }
  R = r; simMin = 0; shownEvents = -1; hud.toast.classList.remove("show"); playing = !reduceMotion; lastTs = null; Music.reset();
  const notes = [a, b, v].filter(x => x && (x.alias || x.fuzzy)).map(x => x.city.name); if (notes.length) msg.textContent = `Using ${notes.join(", ")}.`;
  $("from").value = a.city.name; $("to").value = b.city.name; if (v) $("via").value = v.city.name;
  document.body.classList.add("has-trip");
  renderInfographics(); syncRate(); syncPlay(); resize(); render(performance.now());
  try { history.replaceState(null, "", "#" + encodeURIComponent(`${a.city.name}-to-${b.city.name}`).replace(/%20/g, "-")); } catch (e) {}
}
$("planner").addEventListener("submit", plan);
document.querySelectorAll("[data-route]").forEach(btn => btn.addEventListener("click", () => { const [f, t] = btn.dataset.route.split("|"); $("from").value = f; $("to").value = t; $("via").value = ""; plan(); }));
$("swap").addEventListener("click", () => { const f = $("from").value; $("from").value = $("to").value; $("to").value = f; });
window.addEventListener("resize", () => { if (R) renderInfographics(); });

function loop(ts) {
  if (R && playing) { if (lastTs !== null) { simMin += Math.min(.1, (ts - lastTs) / 1000) * rate; if (simMin >= R.totalMin) { simMin = R.totalMin; playing = false; syncPlay(); } } lastTs = ts; } else lastTs = null;
  if (R) render(ts);
  requestAnimationFrame(loop);
}
$("from").value = "Ahmedabad"; $("to").value = "Mumbai";
plan();
requestAnimationFrame(loop);
window.__journey = { get R() { return R; }, setMin: m => { simMin = m; }, findCity, buildJourney };
})();
