"use strict";
/* ================= Import: frames ================= */
const KIND_INFO = {
  fellows: { label: "Fellows", c: "var(--pink)", hint: "Your fellows list or a fellow's page", steps: ["Open your Fellows screen in the game.", "Start your phone's screen recorder.", "Scroll slowly through the whole list, pausing a moment on each screen.", "Stop recording and choose the video below."] },
  family: { label: "Family", c: "var(--lilac)", hint: "Your family list or a member's page", steps: ["Open your Family screen.", "Start recording and scroll slowly through every member.", "For Intimacy and Blessing, tap into each member's page while recording.", "Stop recording and choose the video below."] },
  events: { label: "Events", c: "var(--mint)", hint: "Event list or an event's page", steps: ["Open the events list, or an event's page showing its countdown.", "Record while you tap through each event you care about.", "Choose the video below. Countdowns become end times."] },
};
let importKind = "fellows";
const MAX_FRAMES = 60;

function openImport(kind) {
  if (kind) importKind = kind;
  openSheet(sheetHead("Import a recording") + `<div class="sheet-body" id="imp-body">
    <div class="kinds" role="radiogroup" aria-label="What does the recording show?">${Object.entries(KIND_INFO).map(([k, v]) => `<label class="kind" style="--c:${v.c}"><input type="radio" name="kind" value="${k}" ${k === importKind ? "checked" : ""}><b>${v.label}</b><span>${v.hint}</span></label>`).join("")}</div>
    <div class="howto" id="imp-tip"></div>
    <label class="drop" id="imp-drop" for="imp-file"><svg width="34" height="34" style="color:var(--gold)"><use href="#i-film"/></svg><strong>Choose a screen recording or screenshots</strong><span>Or drop them here. MP4, MOV and WebM videos and PNG or JPG images all work.</span><input type="file" id="imp-file" accept="video/*,image/*" multiple hidden></label>
    <p class="muted small" style="margin:0">Everything is read on your own device. Nothing is uploaded. The first import downloads a text reader (about 10 MB), so it takes a little longer.</p>
    <div id="imp-stage" hidden></div></div>`);
  const tip = () => { const v = KIND_INFO[importKind]; $("#imp-tip").innerHTML = `<b>How to record your ${v.label.toLowerCase()}</b><ol>${v.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>`; };
  tip();
  sheet.querySelectorAll('input[name="kind"]').forEach(r => r.addEventListener("change", () => { importKind = r.value; tip(); }));
  const input = $("#imp-file"), drop = $("#imp-drop");
  input.addEventListener("change", () => { if (input.files.length) runImport([...input.files]); });
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); const fs = [...(e.dataTransfer?.files || [])]; if (fs.length) runImport(fs); });
}
function stage(title, pct, detail, extra = "") {
  const st = $("#imp-stage"); if (!st) return;
  st.innerHTML = `<div style="display:grid;gap:10px"><b style="font-family:var(--font-display);font-size:1.1rem">${esc(title)}</b><div class="bar"><div style="width:${Math.round(pct * 100)}%"></div></div><p class="muted small" style="margin:0" id="imp-detail">${esc(detail)}</p>${extra}<div><button class="btn sm" type="button" id="imp-stop">Stop</button></div></div>`;
  $("#imp-stop").onclick = () => busy && busy.abort();
}
function setBar(p, detail) { const b = sheet.querySelector(".bar div"); if (b) b.style.width = Math.round(p * 100) + "%"; if (detail != null) { const d = $("#imp-detail"); if (d) d.textContent = detail; } }

async function runImport(files) {
  const kind = importKind;
  sheet.querySelectorAll(".kinds, #imp-tip, #imp-drop, #imp-body > p").forEach(el => el.hidden = true);
  $("#imp-stage").hidden = false;
  const ctl = new AbortController(); busy = ctl;
  try {
    stage("Finding the screens in your recording", 0, "Looking for distinct screens…");
    const frames = await collectFrames(files, ctl.signal, (p, n) => setBar(p, `${n} distinct screen${n === 1 ? "" : "s"} found so far`));
    if (ctl.signal.aborted) throw { code: "cancelled" };
    if (!frames.length) throw { code: "no_frames" };
    const thumbs = `<div class="thumbs">${frames.slice(0, 12).map(b => `<img alt="" src="${URL.createObjectURL(b)}">`).join("")}</div>`;
    stage("Getting the text reader ready", 0, "Loading the reader. The first time takes a little longer.", thumbs);
    const worker = await getWorker(ctl.signal);
    const pages = [];
    for (let i = 0; i < frames.length; i++) {
      if (ctl.signal.aborted) throw { code: "cancelled" };
      stage(`Reading your ${KIND_INFO[kind].label.toLowerCase()}`, i / frames.length, `Reading screen ${i + 1} of ${frames.length}…`, thumbs);
      pages.push(await readFrame(worker, frames[i], ctl.signal, kind));
    }
    busy = null;
    showReview(kind, parsePages(kind, pages), frames.length, pages);
  } catch (e) {
    busy = null;
    if (e && e.code === "cancelled") { closeSheet(); toast("Import stopped. Nothing was saved."); return; }
    const st = $("#imp-stage"); if (!st) return;
    st.innerHTML = `<p class="err">${esc(importError(e))}</p><div><button class="btn" type="button" id="imp-retry">Try another file</button></div>`;
    $("#imp-retry").onclick = () => openImport(kind);
  }
}
function importError(e) {
  const c = e && e.code;
  if (c === "no_frames") return "No usable screens were found in that file. Try a different recording or a screenshot.";
  if (c === "video_decode") return "This browser can't open that video. On iPhone, set Settings › Camera › Formats to Most Compatible and record again, or open this site on the phone that made the recording.";
  if (c === "ocr_load") return "The text reader couldn't be downloaded. Check your internet connection and try again.";
  return "Something went wrong while reading the recording. Try again, or try a screenshot instead.";
}
async function collectFrames(files, signal, onProgress) {
  const out = [];
  for (const f of files) {
    if (signal.aborted) break;
    const isVideo = (f.type || "").startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name);
    if (isVideo) out.push(...await videoFrames(f, signal, p => onProgress(p, out.length)));
    else if ((f.type || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)) { out.push(f); onProgress(1, out.length); }
  }
  if (out.length > MAX_FRAMES) { const keep = [], step = out.length / MAX_FRAMES; for (let i = 0; i < MAX_FRAMES; i++) keep.push(out[Math.floor(i * step)]); return keep; }
  return out;
}
function seek(v, t) { return new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; v.removeEventListener("seeked", fin); res(); }; v.addEventListener("seeked", fin); v.currentTime = t; setTimeout(fin, 4000); }); }
async function videoFrames(file, signal, onProgress) {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  try {
    await new Promise((res, rej) => { v.addEventListener("loadeddata", res, { once: true }); v.addEventListener("error", () => rej({ code: "video_decode" }), { once: true }); setTimeout(() => rej({ code: "video_decode" }), 25000); });
    const dur = v.duration; if (!isFinite(dur) || dur <= 0 || !v.videoWidth) throw { code: "video_decode" };
    const w = v.videoWidth, h = v.videoHeight;
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d");
    const sw = 48, sh = Math.max(24, Math.round(48 * h / w));
    const small = document.createElement("canvas"); small.width = sw; small.height = sh; const sctx = small.getContext("2d", { willReadFrequently: true });
    const grab = () => { sctx.drawImage(v, 0, 0, sw, sh); const px = sctx.getImageData(0, 0, sw, sh).data, g = new Float32Array(sw * sh); for (let i = 0; i < g.length; i++) g[i] = px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11; return g; };
    const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
    const keep = async () => { ctx.drawImage(v, 0, 0, w, h); return new Promise(r => c.toBlob(r, "image/png")); };
    // Keep a frame once the screen has stopped moving (two samples in a row look the same) and it shows
    // something new. Mid-scroll frames are blurred and read badly, so they're only used when a stretch of
    // the recording never settles.
    const step = Math.max(0.2, dur / 300), kept = [];
    let prev = null, lastKept = null, movingSince = null;
    for (let t = Math.min(0.05, dur / 2); t < dur; t += step) {
      if (signal.aborted) break;
      await seek(v, Math.min(t, dur - 0.05));
      const g = grab(), motion = prev ? dist(g, prev) : 0;
      const fresh = !lastKept || dist(g, lastKept) > 4;
      if (motion < 1.5 && fresh) { const b = await keep(); if (b) { kept.push(b); lastKept = g; } movingSince = null; }
      else if (motion >= 1.5) {
        if (movingSince == null) movingSince = t;
        else if (t - movingSince > 1.2 && (!lastKept || dist(g, lastKept) > 12)) { const b = await keep(); if (b) { kept.push(b); lastKept = g; } movingSince = t; }
      }
      prev = g;
      onProgress(Math.min(1, t / dur));
    }
    return kept;
  } finally { v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url); }
}

/* ================= Import: on-device text reading ================= */
let workerPromise = null;
function waitForTesseract(signal) {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    (function poll() { if (window.Tesseract) return res(); if (signal.aborted) return rej({ code: "cancelled" }); if (Date.now() - t0 > 20000) return rej({ code: "ocr_load" }); setTimeout(poll, 200); })();
  });
}
async function getWorker(signal) {
  await waitForTesseract(signal);
  // classify_enable_learning off: otherwise the reader adapts to each screen it reads and the next one reads differently
  if (!workerPromise) workerPromise = Tesseract.createWorker("eng", 1, { logger: m => { if (m.status && m.status.includes("load") && typeof m.progress === "number") setBar(m.progress, "Loading the text reader… " + Math.round(m.progress * 100) + "%"); } }, { classify_enable_learning: "0" })
    .catch(e => { workerPromise = null; throw { code: "ocr_load", e }; });
  return workerPromise;
}
/* Whole-screen pass: grey, flipped to dark-on-light when the screen is mostly dark, mild contrast boost. */
function prepForOcr(bmp) {
  const target = 1400, sc = Math.max(1, Math.min(2.2, target / bmp.width));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  let sum = 0; for (let i = 0; i < d.length; i += 16) sum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
  const invert = sum / (d.length / 16) < 120;
  for (let i = 0; i < d.length; i += 4) {
    let g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    if (invert) g = 255 - g;
    g = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128));
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, sc };
}
/* Text strips. Game text sits on flat-coloured plates (name ribbons, level banners, stat bars) next to busy
   artwork, and the reader skips most of it when it looks at the whole screen. Find the plates and read each
   row of them on its own. Plates show up as runs of flat, same-coloured pixels that the letters split into
   pieces; pieces on the same row with the same height make one strip. */
const BAND_W = 540;
function findBands(bmp) {
  const W = BAND_W, sc = W / bmp.width, H = Math.max(8, Math.round(bmp.height * sc));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data, N = W * H;
  const g = new Float32Array(N); for (let i = 0; i < N; i++) g[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
  const flat = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx = g[i - W + 1] + 2 * g[i + 1] + g[i + W + 1] - g[i - W - 1] - 2 * g[i - 1] - g[i + W - 1];
    const gy = g[i + W - 1] + 2 * g[i + W] + g[i + W + 1] - g[i - W - 1] - 2 * g[i - W] - g[i - W + 1];
    flat[i] = Math.abs(gx) + Math.abs(gy) < 30 ? 1 : 0;
  }
  const par = new Int32Array(N); for (let i = 0; i < N; i++) par[i] = i;
  const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const near = (i, j) => Math.abs(d[i * 4] - d[j * 4]) + Math.abs(d[i * 4 + 1] - d[j * 4 + 1]) + Math.abs(d[i * 4 + 2] - d[j * 4 + 2]) < 14;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!flat[i]) continue;
    if (x > 0 && flat[i - 1] && near(i, i - 1)) { const a = find(i), b = find(i - 1); if (a !== b) par[a] = b; }
    if (y > 0 && flat[i - W] && near(i, i - W)) { const a = find(i), b = find(i - W); if (a !== b) par[a] = b; }
  }
  const R = new Map();
  for (let i = 0; i < N; i++) {
    if (!flat[i]) continue;
    const r = find(i), x = i % W, y = (i / W) | 0;
    let o = R.get(r); if (!o) R.set(r, o = { n: 0, x0: x, x1: x, y0: y, y1: y });
    o.n++; if (x < o.x0) o.x0 = x; if (x > o.x1) o.x1 = x; if (y < o.y0) o.y0 = y; if (y > o.y1) o.y1 = y;
  }
  const frags = [];
  for (const o of R.values()) {
    const w = o.x1 - o.x0 + 1, h = o.y1 - o.y0 + 1;
    if (o.n < 40 || w < W * 0.02 || h < W * 0.015 || h > W * 0.12 || w / h < 1.6 || o.n / (w * h) < 0.35) continue;
    frags.push(o);
  }
  // group pieces into rows: strong vertical overlap and similar height
  frags.sort((a, b) => a.y0 - b.y0);
  const rows = [];
  for (const f of frags) {
    const fh = f.y1 - f.y0 + 1;
    const row = rows.find(r => { const ov = Math.min(r.y1, f.y1) - Math.max(r.y0, f.y0) + 1, rh = r.y1 - r.y0 + 1; return ov > 0.6 * Math.min(fh, rh) && Math.max(fh, rh) < 1.6 * Math.min(fh, rh); });
    if (row) { row.y0 = Math.min(row.y0, f.y0); row.y1 = Math.max(row.y1, f.y1); row.x0 = Math.min(row.x0, f.x0); row.x1 = Math.max(row.x1, f.x1); }
    else rows.push({ x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1 });
  }
  return rows.slice(0, 30).map(r => {
    const h = r.y1 - r.y0 + 1, pad = h * 0.12;
    return { x0: 0, x1: bmp.width,  // full width: a plate whose text fills it leaves no flat pieces of its own, but sits on a row with others
       y0: Math.max(0, (r.y0 - pad) / sc), y1: Math.min(bmp.height, (r.y1 + 1 + pad) / sc) };
  });
}
function bandCanvas(bmp, b) {
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0, k = Math.max(1, Math.min(4, 64 / bh));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bw * k)); c.height = Math.max(1, Math.round(bh * k));
  const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, b.x0, b.y0, bw, bh, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 4) { const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(40, hi - lo);
  for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, (d[i] - lo) * 255 / span));
  ctx.putImageData(img, 0, 0);
  return { canvas: c, k };
}
const box = b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
function linesFrom(data) {
  return (data.lines || []).map(l => ({
    text: l.text.replace(/\s+/g, " ").trim(), b: box(l.bbox), conf: l.confidence,
    words: (l.words || []).filter(w => w.text && w.text.trim()).map(w => ({ t: w.text.trim(), b: box(w.bbox), conf: w.confidence })),
  })).filter(l => l.text);
}
/* One strip often holds several plates (three name ribbons in a row): split its words at wide gaps. */
function stripLines(words, h) {
  words.sort((a, b) => a.b.x0 - b.b.x0);
  const out = []; let cur = null;
  for (const w of words) {
    if (!cur || w.b.x0 - cur.b.x1 > h * 1.1) { cur = { words: [], b: box(w.b) }; out.push(cur); }
    cur.words.push(w); cur.b.x1 = Math.max(cur.b.x1, w.b.x1); cur.b.y0 = Math.min(cur.b.y0, w.b.y0); cur.b.y1 = Math.max(cur.b.y1, w.b.y1);
  }
  return out.map(l => ({ text: l.words.map(w => w.t).join(" "), b: l.b, conf: l.words.reduce((s, w) => s + w.conf, 0) / l.words.length, words: l.words, strip: true }));
}
/* Close-up number reading. Some numbers sit on busy or coloured badges (the yellow level in the green diamond,
   the orange power figure, the small numbers on family cards) and the whole-screen pass garbles them. Crop just
   that spot, turn it into black digits on white a few different ways, read digits only, and keep the most
   confident reading that looks like a real game number. */
const LUM = (r, g, b) => r * 0.3 + g * 0.59 + b * 0.11;
const NUM_VARIANTS = [                       // badges: yellow on green, orange on dark
  { f: LUM, otsu: true },
  { f: LUM, otsu: true, dark: true },
  { f: r => r, th: 180 },
  { f: r => r, th: 150 },
];
const ORANGE = t => (r, g, b) => r > 180 && r - b > t ? 255 : 0;   // a fellow's power: orange digits with a dark outline
const ORANGE_TEXT = [{ f: ORANGE(120), th: 128 }, { f: ORANGE(90), th: 128 }, { f: ORANGE(60), th: 128 }, { f: r => r, th: 180 }];
const LIGHT_TEXT = [{ gray: true }, { f: LUM, th: 170 }, { f: LUM, th: 130 }];   // pale numbers on a dark strip
/* Skip an icon at the left of the box (the pink heart and blue angel next to family card numbers): move the left
   edge past the last column in the first part of the box that holds icon-coloured pixels. */
function pastIcon(bmp, r, isIcon) {
  const x0 = Math.max(0, Math.round(r.x0)), y0 = Math.max(0, Math.round(r.y0)), w = Math.max(1, Math.round(r.x1) - x0), h = Math.max(1, Math.round(r.y1) - y0);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(bmp, x0, y0, w, h, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  let last = -1;
  for (let x = 0; x < w * 0.4; x++) { let n = 0; for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; if (isIcon(d[i], d[i + 1], d[i + 2])) n++; } if (n >= 2) last = x; }
  return last < 0 ? r : Object.assign({}, r, { x0: x0 + last + 2 });
}
async function readNumber(worker, bmp, r, check, variants = NUM_VARIANTS, strict = false) {
  const x0 = Math.max(0, Math.round(r.x0)), y0 = Math.max(0, Math.round(r.y0)), x1 = Math.min(bmp.width, Math.round(r.x1)), y1 = Math.min(bmp.height, Math.round(r.y1));
  if (x1 - x0 < 6 || y1 - y0 < 6) return null;
  const k = Math.max(1, Math.min(6, 100 / (y1 - y0))), P = 30;
  const c = document.createElement("canvas"); c.width = Math.round((x1 - x0) * k) + 2 * P; c.height = Math.round((y1 - y0) * k) + 2 * P;
  const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, x0, y0, x1 - x0, y1 - y0, P, P, c.width - 2 * P, c.height - 2 * P);
  const src = ctx.getImageData(0, 0, c.width, c.height);
  let best = null; const cands = [];
  await worker.setParameters({ tessedit_pageseg_mode: "7", tessedit_char_whitelist: "0123456789,." });
  try {
    for (const v of variants) {
      const img = new ImageData(new Uint8ClampedArray(src.data), c.width, c.height), d = img.data;
      const L = new Float32Array(d.length / 4);
      for (let i = 0; i < L.length; i++) L[i] = (v.f || LUM)(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      let th = v.th, bright = true;
      if (v.otsu) {
        const hist = new Array(256).fill(0); let n = 0, sum = 0;
        for (let y = P; y < c.height - P; y++) for (let x = P; x < c.width - P; x++) { hist[Math.max(0, Math.min(255, L[y * c.width + x] | 0))]++; n++; }
        for (let i = 0; i < 256; i++) sum += i * hist[i];
        let sB = 0, wB = 0, bv = 0; th = 128;
        for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += i * hist[i]; const m = (sB / wB - (sum - sB) / wF) ** 2 * wB * wF; if (m > bv) { bv = m; th = i; } }
        bright = !v.dark;
      }
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = y * c.width + x, inside = x >= P && x < c.width - P && y >= P && y < c.height - P;
        // gray: keep the shading, just flip light text to dark on light; otherwise make it pure black on white
        const g = !inside ? 255 : v.gray ? 255 - Math.max(0, Math.min(255, (L[i] - 60) * 1.5)) : (bright ? L[i] > th : L[i] <= th) ? 0 : 255;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g; d[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const { data } = await worker.recognize(c);
      const raw = data.text.replace(/\s+/g, ""), val = check(raw);
      if (val) cands.push({ val, conf: data.confidence, trims: raw.replace(/\D/g, "").length - String(val).replace(/\D/g, "").length });
      if (!strict && cands.length >= 2 && cands.filter(x => x.val === val).length >= 2) break;   // two ways agree: good enough
    }
  } finally { await worker.setParameters({ tessedit_char_whitelist: "" }); }
  // strict: every reading that made sense must agree, and at least two did (a wrong big number is worse than none)
  if (strict) return cands.length >= 2 && cands.every(x => x.val === cands[0].val) ? cands[0].val : null;
  // Prefer a value several of the ways agree on, then a confident one that needed no trimming.
  const score = x => cands.filter(y => y.val === x.val).length * 50 + x.conf - x.trims * 25;
  for (const x of cands) if (!best || score(x) > score(best)) best = x;
  // comma groups that add up are a strong check on their own; short readings need the reader to be fairly sure
  return best && (best.conf >= 20 || /,\d{3}/.test(best.val)) ? best.val : null;
}
/* Big numbers are always printed with thousands commas ("153,826,054,348"). The reader sometimes misses a comma
   or reads an icon as a leading 1, so accept a reading when its groups still add up, trimming stray leading digits. */
function groupedNum(s) {
  s = String(s || "").replace(/\./g, ",").replace(/^,+|,+$/g, "");   // a comma often reads as a full stop
  if (!/^\d[\d,]*$/.test(s)) return null;
  for (let k = 0; k <= 4; k++) {
    const cut = [0, 1, 0, 2, 0][k], end = [0, 0, 1, 0, 2][k];   // stray icon digits at either end
    const t = s.slice(cut, s.length - end).replace(/^,|,$/g, ""); if (!t || t[0] === "0") continue;
    const parts = t.split(","), trimmed = cut + end > 0;
    // no commas: fine when nothing was trimmed and it's short ("63323" is printed that way); trimming one down is a guess
    if (parts.length === 1) { if (!trimmed && t.length <= 6) return t.replace(/\B(?=(\d{3})+(?!\d))/g, ","); continue; }
    if (parts[0].length >= 1 && parts[0].length <= 3 && parts.slice(1).every(g => g.length === 3)) {
      const digits = parts.join(""); return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
  }
  return null;
}
/* A stat as read from the screen: "1.655T" style values pass through, comma numbers must have sane groups. */
function cleanNum(v) {
  if (blank(v)) return null;
  v = String(v).trim().replace(/[.,]$/, "");
  if (/^\d+(?:\.\d+)?\s?(?:[kmbtq]|[a-z]{2})$/i.test(v)) return v.replace(/\s/g, "");
  return groupedNum(v);
}
const DETAIL_RE = /\b(?:cultivate|family\s*training)\b/i;
const POPUP_RE = /power\s*details?|bond\s*detail|total\s*apt|level\s*cap|stella\s*level|current\s*bond/i;
async function refineFrame(worker, bmp, p, kind) {
  const sc = p.sc, toB = b => ({ x0: b.x0 / sc, y0: b.y0 / sc, x1: b.x1 / sc, y1: b.y1 / sc });
  const all = p.lines.map(l => l.text).join("\n");
  p.extra = {};
  if (kind === "fellows" && DETAIL_RE.test(all)) {
    // Fellow page: the big orange power figure sits right above "Lv. 750 ★★★★★", which sits above "Aptitude"
    const lv = p.lines.find(l => levelHits(l).length && !/stella|[—~]/i.test(l.text) && p.lines.some(o => /aptitude/i.test(o.text) && cyb(o.b) - cyb(l.b) > lh(l) * 0.4 && cyb(o.b) - cyb(l.b) < lh(l) * 4));
    if (lv) {
      const b = toB(levelHits(lv)[0].b), h = b.y1 - b.y0;
      const v = await readNumber(worker, bmp, { x0: bmp.width * 0.11, x1: bmp.width * 0.53, y0: b.y0 - 2.7 * h, y1: b.y0 - 0.3 * h }, t => { const g = groupedNum(t); return g && g.length >= 5 ? g : null; }, ORANGE_TEXT, true);
      if (v) p.extra.power = v;
    }
  }
  if (kind === "family" && !DETAIL_RE.test(all)) {
    // Family list: each card shows intimacy (left) and blessing (right) just above the name ribbon
    const idx = nameIndex("family"), best = new Map();
    for (const l of p.lines) for (const m of findNames(l, idx)) { const o = best.get(m.k); if (!o || m.conf > o.conf) best.set(m.k, m); }
    if (best.size >= 2) {
      p.extra.cards = {};
      // sizes follow the screen width (measured on a 911px-wide phone screenshot)
      const U = bmp.width / 911, cw = bmp.width * 0.29;
      const heart = (r, g, b) => r > 170 && r - g > 50 && b - g > 20, angel = (r, g, b) => b > 150 && b - r > 35;
      for (const m of best.values()) {
        const b = toB(m.b), cxm = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2 - 36 * U, y0 = cy - 14 * U, y1 = cy + 14 * U;
        const intimacy = await readNumber(worker, bmp, pastIcon(bmp, { x0: cxm - 0.33 * cw, x1: cxm - 0.02 * cw, y0, y1 }, heart), groupedNum, LIGHT_TEXT);
        const blessing = await readNumber(worker, bmp, pastIcon(bmp, { x0: cxm + 0.12 * cw, x1: cxm + 0.46 * cw, y0, y1 }, angel), groupedNum, LIGHT_TEXT);
        p.extra.cards[m.k] = { intimacy, blessing };
      }
    }
  }
}
/* Screenshots come in every size. Scale each one to the same width first so the reader sees text at the size
   it was tuned on, whatever the phone. */
const FRAME_W = 911;   // the width the reader was tuned and checked on
async function frameBitmap(blob) {
  const b = await createImageBitmap(blob);
  if (Math.abs(b.width - FRAME_W) < 20) return b;
  try { const r = await createImageBitmap(b, { resizeWidth: FRAME_W, resizeHeight: Math.round(b.height * FRAME_W / b.width), resizeQuality: "high" }); if (b.close) b.close(); return r; }
  catch { return b; }
}
async function readFrame(worker, blob, signal, kind) {
  const bmp = await frameBitmap(blob);
  try {
    const full = prepForOcr(bmp), sc = full.sc;
    await worker.setParameters({ tessedit_pageseg_mode: "11" });
    const lines = linesFrom((await worker.recognize(full.canvas)).data);
    await worker.setParameters({ tessedit_pageseg_mode: "7" });
    for (const b of findBands(bmp)) {
      if (signal.aborted) throw { code: "cancelled" };
      const { canvas, k } = bandCanvas(bmp, b);
      const { data } = await worker.recognize(canvas);
      const words = (data.lines || []).flatMap(l => l.words || []).concat((data.lines || []).length ? [] : (data.words || []))
        .filter(w => w.text && w.text.trim())
        .map(w => ({ t: w.text.trim(), conf: w.confidence, b: { x0: (b.x0 + w.bbox.x0 / k) * sc, x1: (b.x0 + w.bbox.x1 / k) * sc, y0: (b.y0 + w.bbox.y0 / k) * sc, y1: (b.y0 + w.bbox.y1 / k) * sc } }));
      lines.push(...stripLines(words, (b.y1 - b.y0) * sc));
    }
    const page = { w: full.canvas.width, h: full.canvas.height, sc, lines };
    if (signal.aborted) throw { code: "cancelled" };
    try { await refineFrame(worker, bmp, page, kind); } catch { page.extra = page.extra || {}; }
    return page;
  } finally { if (bmp.close) bmp.close(); }
}

/* ================= Import: turning text into entries ================= */
const NUM = "(\\d[\\d,.]*(?:[kmbtq](?![a-z])|[a-z]{2}(?![a-z]))?)";
const LABELS = {
  level: /\b(?:lv|lvl|level)\s*[.:]?\s*(\d{1,4})\b/i,
  power: new RegExp("(?:power|pwr)\\s*[:：]?\\s*" + NUM, "i"),
  aptitude: new RegExp("(?:aptitude|apt)\\s*[:：]?\\s*" + NUM, "i"),
  stella: /\bstella\s*[:：]?\s*(?:s\s*)?(\d{1,2})\b/i,
  intimacy: new RegExp("intimacy\\s*[:：]?\\s*" + NUM, "i"),
  blessing: new RegExp("blessing\\s*[:：]?\\s*" + NUM, "i"),
  earnings: new RegExp("(?:earnings?|income)\\s*[:：]?\\s*" + NUM, "i"),
};
const SUFFIXED = /\b(\d[\d,.]*\s?[KMBT])\b/;
const COUNTDOWN = /(\d+\s*d(?:ays?)?\s*\d+\s*h(?:rs?|ours?)?(?:\s*\d+\s*m(?:in)?)?|\d+\s*h(?:rs?|ours?)?\s*\d+\s*m(?:in)?(?:\s*\d+\s*s)?|\d+\s*d(?:ays?)?|\d{1,2}:\d{2}:\d{2})/i;
const RARITY_RE = /\b(LR|UR\*?|SSR\+?|SR|R|N)\b/;
const cy = l => (l.b.y0 + l.b.y1) / 2, lh = l => Math.max(8, l.b.y1 - l.b.y0);  // l is a line

/* Names. OCR mixes up some letters, so compare names after folding common confusions, word by word. */
const cnorm = s => norm(s).replace(/0/g, "o").replace(/1/g, "l").replace(/5/g, "s").replace(/rn/g, "m").replace(/vv/g, "w");
function nameIndex(kind) {
  const names = new Map();
  const add = n => { const k = norm(n), c = cnorm(n); if (k.length >= 3 && !names.has(k)) names.set(k, { k, c, n, words: String(n).trim().split(/\s+/).length }); };
  // Titles ("Goddess of Revelry", "The Omni-Shapeshifter") are printed big on detail pages and read better than the small name under them.
  const addTitle = (t, n) => { if (!t) return; const c = cnorm(t), key = "t:" + c; if (c.length >= 8 && !names.has(key)) names.set(key, { k: norm(n), c, n, words: String(t).trim().split(/\s+/).length }); };
  const roster = kind === "fellows" ? ROSTER : FAMILY_ROSTER;
  roster.forEach(r => add(r.name)); S[kind === "fellows" ? "fellows" : "family"].items.forEach(f => add(f.name));
  roster.forEach(r => addTitle(r.title, r.name));
  const exact = new Map(), byLen = new Map();
  for (const e of names.values()) { if (!exact.has(e.c)) exact.set(e.c, e); const L = e.c.length; if (!byLen.has(L)) byLen.set(L, []); byLen.get(L).push(e); }
  return { exact, byLen, maxWords: Math.max(1, ...[...names.values()].map(e => e.words)) };
}
/* Edit distance where swaps the reader commonly makes (y/v, l/i, e/c…) cost half. Short names allow only
   those; longer names allow a real slip or two. Keeps "Drake" (from Drakenberg) from becoming "Arake". */
const NEAR = new Set(["yv", "vy", "li", "il", "lt", "tl", "ec", "ce", "oa", "ao", "nh", "hn", "un", "nu", "rn", "nr", "ij", "ji", "bh", "hb", "ao", "oe", "eo", "gq", "qg", "sz", "zs", "uv", "vu", "kx", "xk", "ft", "tf"]);
function ocrDist(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) { const x = a[i - 1], y = b[j - 1]; cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x === y ? 0 : NEAR.has(x + y) ? 0.5 : 1)); }
    prev = cur;
  }
  return prev[b.length];
}
const nameTol = L => L >= 12 ? 2.5 : L >= 8 ? 1.5 : L >= 5 ? 0.5 : 0;
function matchName(t, idx) {
  if (t.length < 3) return null;
  const ex = idx.exact.get(t); if (ex) return { e: ex, d: 0 };
  let best = null;
  for (let L = t.length - 3; L <= t.length + 2; L++) for (const e of idx.byLen.get(L) || []) {
    let d;
    if (L >= 6 && L < t.length && t.includes(e.c)) d = 0.5;           // name with stray letters stuck on
    else if (L >= 5 && Math.abs(L - t.length) <= nameTol(L)) { d = ocrDist(t, e.c); if (d > nameTol(L)) continue; }
    else continue;
    if (!best || d / L < best.d / best.e.c.length || (d / L === best.d / best.e.c.length && L > best.e.c.length)) best = { e, d };
  }
  return best;
}
function lineWords(l) { return l.words && l.words.length ? l.words : [{ t: l.text, b: l.b, conf: l.conf }]; }
function unionBox(ws) { return { x0: Math.min(...ws.map(w => w.b.x0)), y0: Math.min(...ws.map(w => w.b.y0)), x1: Math.max(...ws.map(w => w.b.x1)), y1: Math.max(...ws.map(w => w.b.y1)) }; }
/* Every name in a line (a whole-screen line can run across several cards). */
function findNames(line, idx) {
  const ws = lineWords(line), cands = [];
  for (let i = 0; i < ws.length; i++) for (let j = i; j < Math.min(ws.length, i + idx.maxWords + 1); j++) {
    const m = matchName(cnorm(ws.slice(i, j + 1).map(w => w.t).join(" ")), idx);
    if (m) cands.push({ i, j, ...m, score: m.d / m.e.c.length });
  }
  cands.sort((a, b) => a.score - b.score || b.e.c.length - a.e.c.length);
  const used = new Set(), out = [];
  for (const c of cands) {
    let free = true; for (let k = c.i; k <= c.j; k++) if (used.has(k)) free = false;
    if (!free) continue;
    for (let k = c.i; k <= c.j; k++) used.add(k);
    const sub = ws.slice(c.i, c.j + 1);
    out.push({ n: c.e.n, k: c.e.k, b: unionBox(sub), conf: sub.reduce((s, w) => s + (w.conf ?? 70), 0) / sub.length - c.score * 100 });
  }
  return out;
}
/* "Lv.750", also as the reader tends to garble it: "LEv:650", "Ev:806", "bv.750", "Lv. 724". */
const LV_RE = /(?:^|[^A-Za-z])(?:[LlIi1|][Ee]?|[Ee]|[Bb])?[vV][.:,;'"]?\s*([0-9OoIlS|][0-9OoIlS|'\-]{0,4})/;
const fixDigits = s => s.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/S/g, "5").replace(/['\-]/g, "");
function levelHits(line) {
  const ws = lineWords(line), out = [];
  for (let i = 0; i < ws.length; i++) {
    let m = ws[i].t.match(LV_RE), b = ws[i].b, raw = m && m[1];
    if (!m && /^[^A-Za-z0-9]*(?:[LlIi1|][Ee]?|[Ee])?[vV][.:,;]?$/.test(ws[i].t) && ws[i + 1] && /^[0-9OoIl|]{1,4}[^A-Za-z0-9]*$/.test(ws[i + 1].t)) { raw = ws[i + 1].t; b = unionBox([ws[i], ws[i + 1]]); }
    if (!raw) continue;
    const v = fixDigits(raw).replace(/\D.*$/, "");
    if (/^\d{1,4}$/.test(v) && +v >= 1 && !(ws[i].t.length > 12)) out.push({ lv: String(+v), b, conf: ws[i].conf ?? line.conf ?? 70 });
  }
  return out;
}
function readStats(text, keys) {
  const o = {};
  for (const k of keys) { const m = text.match(LABELS[k]); if (m) o[k] = m[1].replace(/[.,]$/, ""); }
  return o;
}
/* Values printed under their label, or further along the row in their own box ("Power" … "12.3M"). */
const LABEL_WORD = { power: /^(?:power|pwr|pow)$/i, aptitude: /^(?:aptitude|apt)$/i, stella: /^stella$/i, intimacy: /^intimacy$/i, blessing: /^blessing$/i, earnings: /^earnings?$/i };
const NUM_WORD = /^\d[\d,.]*(?:[kmbtq]|[a-z]{2})?$/i;
function pairStats(lines, keys) {
  const words = lines.flatMap(l => lineWords(l).map(w => ({ ...w, c: w.t.replace(/^[^\w+]+|[^\w.]+$/g, "").replace(/[:：.]$/, "") })));
  // "+73.5M" style numbers are bonuses, not the stat itself
  const nums = words.filter(w => !w.c.startsWith("+") && NUM_WORD.test(w.c) && /\d/.test(w.c)), o = {}, used = new Set();
  for (const k of keys) {
    if (!LABEL_WORD[k]) continue;
    for (const lw of words.filter(w => LABEL_WORD[k].test(w.c))) {
      const h = Math.max(8, lw.b.y1 - lw.b.y0), lwid = lw.b.x1 - lw.b.x0;
      let best = null, bd = Infinity;
      for (const n of nums) {
        if (used.has(n)) continue;
        const dy = cyb(n.b) - cyb(lw.b), dxc = cx(n.b) - cx(lw.b);
        let d = Infinity;
        if (Math.abs(dy) < h * 0.6 && n.b.x0 > lw.b.x1 - h * 0.3 && n.b.x0 - lw.b.x1 < h * 12) d = (n.b.x0 - lw.b.x1) / h;            // same row, to the right
        else if (dy > h * 0.4 && dy < h * 2.6 && n.b.x0 < lw.b.x1 + lwid * 0.6 && n.b.x1 > lw.b.x0 - lwid * 0.6) d = dy / h + Math.abs(dxc) / Math.max(lwid, h);  // underneath
        if (d < bd) { bd = d; best = n; }
      }
      if (best) { used.add(best); o[k] = best.c.replace(/[.,]$/, ""); break; }
    }
  }
  return o;
}
function vote(map, key, field, val, w = 1) {
  if (blank(val)) return;
  const e = map.get(key) || {}; e[field] = e[field] || {}; e[field][val] = (e[field][val] || 0) + w; map.set(key, e);
}
function winners(votes) { const o = {}; for (const [f, c] of Object.entries(votes)) o[f] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; return o; }
const cx = b => (b.x0 + b.x1) / 2, cyb = b => (b.y0 + b.y1) / 2;

/* A fellow's or family member's own page (and the popups opened from it): one person, so every stat on it is theirs. */
function detailStats(p, kind, ref) {
  const L = p.lines.filter(l => cyb(l.b) > p.h * 0.085), o = {};   // the top bar holds account totals
  for (const l of L) {
    if (/stella|[—~]/i.test(l.text)) continue;
    const hs = levelHits(l); if (!hs.length) continue;
    if (L.some(x => x !== l && /aptitude/i.test(x.text) && cyb(x.b) - cyb(l.b) > lh(l) * 0.4 && cyb(x.b) - cyb(l.b) < lh(l) * 4)) { o.level = hs[0].lv; break; }
  }
  for (const l of L) {
    const pw = l.text.match(/\bpower\s*[:：]?\s*(\d[\d,.]*\d)(?!\s*[%+])/i); if (pw && !o.power) { const v = cleanNum(pw[1]); if (v) o.power = v; }
    const ap = l.text.match(/\b(?:total\s+)?aptitude\s*[:：]?\s*(\d[\d,.]*\d)(?!\s*%)/i); if (ap && !o.aptitude) { const v = cleanNum(ap[1]); if (v) o.aptitude = v; }
    const sl = l.text.match(/stella\s*level\s*[:：]?\s*(?:l?v\.?)?\s*(\d{1,2})\b/i); if (sl) o.stella = String(+sl[1]);
  }
  if (p.extra && p.extra.power) o.power = p.extra.power;
  if (kind === "family") for (const [k, v] of Object.entries(Object.assign(pairStats(L, ["intimacy", "blessing"]), readStats(L.map(l => l.text).join("\n"), ["intimacy", "blessing"])))) { const c = cleanNum(v); if (c) o[k] = c; }
  // Skill slots: "Tipsy Level 716/716"
  if (ref && ref.skills && ref.skills.length) for (const l of L) {
    const m = l.text.match(/([A-Za-z][A-Za-z' ]{1,30}?)\s+Level\s*(\d{1,4})\s*\/\s*\d{1,4}/i); if (!m) continue;
    const t = cnorm(m[1]);
    const sk = ref.skills.map(s => ({ s, d: ocrDist(t, cnorm(s.name)) })).filter(x => x.d <= nameTol(x.s.name.length) || t.endsWith(cnorm(x.s.name))).sort((a, b) => a.d - b.d)[0];
    if (sk) (o.skills = o.skills || {})[sk.s.id] = String(+m[2]);
  }
  return o;
}
function parsePages(kind, pages) {
  if (kind === "events") return parseEvents(pages);
  const idx = nameIndex(kind);
  const keys = kind === "fellows" ? ["power", "aptitude", "stella"] : ["intimacy", "blessing", "stella"];
  const BY = kind === "fellows" ? ROSTER_BY : FAMILY_BY;
  const found = new Map(), order = [], skills = new Map();
  const seen = (key, name) => { if (!found.has(key)) { found.set(key, {}); order.push({ key, name }); } };
  let current = null;   // the person whose own page we're on, for popups opened from it
  for (const p of pages) {
    const all = p.lines.map(l => l.text).join("\n");
    // 1. names, one anchor per name per spot on screen
    let anchors = [];
    for (const l of p.lines) for (const m of findNames(l, idx)) anchors.push({ n: m.n, key: m.k, b: m.b, conf: m.conf, l });
    anchors.sort((a, b) => b.conf - a.conf);
    anchors = anchors.filter((a, i) => !anchors.slice(0, i).some(o => o.key === a.key && Math.abs(cx(o.b) - cx(a.b)) < p.w * 0.1 && Math.abs(cyb(o.b) - cyb(a.b)) < p.w * 0.1));
    // Same name twice on one screen (whole-screen pass + strip pass in different spots) keeps the most confident.
    anchors = anchors.filter((a, i) => !anchors.slice(0, i).some(o => o.key === a.key));

    // A single person's page: their name or title is near the top. Popups opened from it carry no name.
    const detail = DETAIL_RE.test(all);
    let solo = null;
    if (detail) solo = anchors.find(a => cyb(a.b) < p.h * 0.25) || null;
    else if (!anchors.length && current && POPUP_RE.test(all)) solo = current;
    if (solo || detail) {
      current = solo;
      if (!solo) continue;
      seen(solo.key, solo.n);
      const st = detailStats(p, kind, BY.get(solo.key));
      if (st.skills) { skills.set(solo.key, Object.assign(skills.get(solo.key) || {}, st.skills)); delete st.skills; }
      for (const [f, v] of Object.entries(st)) vote(found, solo.key, f, v, 2);
      const fac = FACTIONS.find(f => new RegExp("\\b" + f + "\\b", "i").test(all)); if (fac) vote(found, solo.key, "faction", fac);
      continue;
    }
    if (anchors.length) current = null;   // a list screen; a nameless popup (like an artifact) keeps the person

    if (kind === "family" && !anchors.length) {
      // No known name: use a short wordy line just above an Intimacy/Blessing label as the name.
      p.lines.forEach(l => {
        if (!/intimacy|blessing/i.test(l.text)) return;
        const cand = p.lines.filter(o => o !== l && cyb(o.b) < cyb(l.b) && cyb(l.b) - cyb(o.b) < lh(l) * 5 && /^[A-Za-z][A-Za-z '&.-]{2,24}$/.test(o.text) && !/intimacy|blessing|stella|level|power|interact|bonds|skills|gift|story|travel|cosplay|favorite|info|hide/i.test(o.text)).sort((a, b) => cyb(b.b) - cyb(a.b))[0];
        if (cand && !anchors.some(a => a.l === cand)) anchors.push({ n: cand.text.trim(), key: norm(cand.text), b: cand.b, conf: cand.conf, l: cand });
      });
    }
    if (!anchors.length) continue;
    // list in screen order: row by row, left to right
    const row = a => Math.round(cyb(a.b) / (p.w * 0.08));
    for (const a of [...anchors].sort((a, b) => row(a) - row(b) || cx(a.b) - cx(b.b))) seen(a.key, a.n);
    const W = p.w, wt = a => 0.5 + Math.max(0, Math.min(100, a.conf ?? 70)) / 100;
    const body = p.lines.filter(l => cyb(l.b) > p.h * 0.085);   // the top bar holds account totals
    // 2. levels. On the fellow list "Lv.750" sits at the top of the card and the name ribbon at the bottom,
    //    so a level belongs to the closest name below it in the same column. Next to the name also counts.
    const hits = body.flatMap(l => levelHits(l));
    const taken = new Set();
    if (anchors.length === 1) { const h = hits.sort((a, b) => b.conf - a.conf)[0]; if (h) vote(found, anchors[0].key, "level", h.lv, wt(h)); }
    else {
      const pairs = [];
      for (const h of hits) for (const a of anchors) {
        const dx = Math.abs(cx(h.b) - cx(a.b)) / W, dy = (cyb(a.b) - cyb(h.b)) / W, ah = (a.b.y1 - a.b.y0) / W;
        if (dx < 0.12 && dy > 0 && dy < 0.6) pairs.push({ h, a, cost: dy + dx });
        else if (dx < 0.3 && Math.abs(dy) < ah * 2.5) pairs.push({ h, a, cost: 1 + Math.abs(dy) + dx });   // beside / just under the name
      }
      pairs.sort((x, y) => x.cost - y.cost);
      const usedA = new Set();
      for (const { h, a } of pairs) { if (taken.has(h) || usedA.has(a)) continue; taken.add(h); usedA.add(a); vote(found, a.key, "level", h.lv, wt(h)); }
    }
    // 3. close-up reads of the numbers on family cards
    const cards = (p.extra && p.extra.cards) || {};
    for (const a of anchors) { const c = cards[a.key]; if (c) { if (c.intimacy) vote(found, a.key, "intimacy", c.intimacy, 3); if (c.blessing) vote(found, a.key, "blessing", c.blessing, 3); } }
    // 4. other stats from the lines around each name
    const groups = new Map(anchors.map(a => [a, [a.l]]));
    if (anchors.length === 1) groups.set(anchors[0], body.slice());
    else body.forEach(l => {
      if (anchors.some(a => a.l === l)) return;
      let best = null, bd = Infinity;
      for (const a of anchors) {
        const dy = cyb(l.b) - cyb(a.b), h = Math.max(8, a.b.y1 - a.b.y0);
        if (dy < -h * 1.2 || dy > h * 4.5) continue;
        const dx = Math.abs(cx(l.b) - cx(a.b)) / W;
        const d = Math.abs(dy) / h + dx * 4;
        if (d < bd) { bd = d; best = a; }
      }
      if (best) groups.get(best).push(l);
    });
    for (const [a, lines] of groups) {
      let text = lines.map(l => l.text).join("\n");
      text = text.replace(new RegExp(escRe(a.n), "i"), " ");
      const st = Object.assign(pairStats(lines, keys), readStats(text, keys));
      if (kind === "fellows" && !st.power && anchors.length === 1) { const m = text.match(SUFFIXED); if (m) st.power = m[1].replace(/\s/g, ""); }
      const r = a.l.text.match(RARITY_RE) || text.match(/\b(LR|UR\*?|SSR\+?)\b/);
      if (r) st.rarity = r[1];
      for (const [f, v0] of Object.entries(st)) {
        const v = ["power", "aptitude", "intimacy", "blessing"].includes(f) ? cleanNum(v0) : v0;
        if (v) vote(found, a.key, f, v, wt(a));
      }
      const fac = FACTIONS.find(f => new RegExp("\\b" + f + "\\b", "i").test(text)); if (fac) vote(found, a.key, "faction", fac);
    }
  }
  return order.map(({ key, name }) => {
    const o = Object.assign({ name }, winners(found.get(key) || {}));
    if (o.rarity) o.rarity = canonRarity(o.rarity);
    const ref = BY.get(key);
    if (ref) {
      o.name = ref.name; o.faction = o.faction || ref.faction;
      // a rarity the fellow can never have is a misread
      if (o.rarity && ref.path && ref.path.length && !ref.path.map(canonRarity).includes(o.rarity)) delete o.rarity;
      o.rarity = o.rarity || ref.rarity;
    }
    if (skills.has(key)) o.skills = skills.get(key);
    return o;
  });
}
function parseEvents(pages) {
  const out = new Map();
  for (const p of pages) {
    p.lines.forEach(l => {
      const m = l.text.match(COUNTDOWN); if (!m) return;
      const left = parseRemaining(m[1]); if (left == null || left <= 0) return;
      let name = l.text.slice(0, m.index).replace(/(ends?|ending|remaining|time left|left|in|:)\s*$/i, "").replace(/(ends?|ending|remaining|time left)\s*(in)?\s*$/i, "").trim();
      if (!/[A-Za-z]{3}/.test(name)) {
        const cand = p.lines.filter(o => o !== l && cy(o) < cy(l) && cy(l) - cy(o) < lh(l) * 4 && /[A-Za-z]{3}/.test(o.text) && !COUNTDOWN.test(o.text) && !/^(ends?|remaining|time left)/i.test(o.text)).sort((a, b) => cy(b) - cy(a))[0];
        name = cand ? cand.text.trim() : "";
      }
      name = name.replace(/[^\p{L}\p{N} '&:!-]/gu, "").trim();
      if (name.length < 3) return;
      const key = norm(name);
      if (!out.has(key)) out.set(key, { name, endsAt: new Date(Date.now() + left).toISOString(), timeRemaining: m[1] });
    });
  }
  return [...out.values()];
}

/* ================= Import: review ================= */
function skillText(it) {
  const ref = refFor("fellows", it), names = new Map(((ref && ref.skills) || []).map(s => [s.id, s.name]));
  return Object.entries(it.skills).map(([id, lv]) => `${names.get(id) || id} Lv ${lv}`).join(", ");
}
function showReview(kind, data, nFrames, pages) {
  const st = $("#imp-stage");
  const rawText = pages.map((p, i) => `— Screen ${i + 1} —\n` + p.lines.map(l => l.text).join("\n")).join("\n\n");
  const raw = pages.length ? `<details class="raw"><summary>Show all the text that was read</summary><pre>${esc(rawText)}</pre></details>` : "";
  const fromWhere = pages.length ? `in ${nFrames} screen${nFrames === 1 ? "" : "s"}` : "in your pasted rows";
  const cols = kind === "fellows" ? [["rarity", "Rarity"], ["level", "Level"], ["aptitude", "Aptitude"], ["power", "Power"], ["stella", "Stella"]]
    : kind === "family" ? [["rarity", "Rarity"], ["intimacy", "Intimacy"], ["blessing", "Blessing"], ["stella", "Stella"]]
    : [["timeRemaining", "Time left"]];
  const list = S[kind].items;
  const rows = data.map(it => {
    const ex = list.find(x => norm(x.name) === norm(it.name));
    const changed = ex ? cols.some(([f]) => f !== "timeRemaining" && !blank(it[f]) && String(it[f]) !== String(ex[f] ?? "")) || (kind === "events") : false;
    return { it, ex, status: !ex ? "new" : changed ? "chg" : "same" };
  });
  if (!rows.length) {
    st.innerHTML = `<p class="err" style="margin:0">No ${kind === "family" ? "family members" : kind} were recognised in ${nFrames} screen${nFrames === 1 ? "" : "s"}.</p>
      <p class="muted small" style="margin:0">Make sure the recording shows the ${KIND_INFO[kind].label} screen and that names are readable. You can open the text below to see what the reader picked up, then add entries by hand.</p>${raw}
      <div class="toolbar"><button class="btn" type="button" id="imp-retry">Try another file</button></div>`;
    $("#imp-retry").onclick = () => openImport(kind); return;
  }
  const counts = { new: 0, chg: 0, same: 0 }; rows.forEach(r => counts[r.status]++);
  st.innerHTML = `<p style="margin:0"><b>Found ${rows.length} ${kind === "family" ? "family members" : kind} ${fromWhere}.</b> ${counts.new} new, ${counts.chg} updated, ${counts.same} unchanged.</p>
    <p class="muted small" style="margin:0">${pages.length ? "The reader can misread small text. Check the numbers, fix anything in the boxes, and untick rows that are wrong." : "Check the rows, fix anything in the boxes, and untick any you don't want to save."}</p>
    <div class="table-scroll"><table><thead><tr><th><input type="checkbox" id="rv-all" checked aria-label="Select all"></th><th>Name</th><th></th>${cols.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr data-row="${i}"><td><input type="checkbox" class="rv-on" ${r.status === "same" ? "" : "checked"} aria-label="Save this row"></td>
      <td><input class="name-in" data-f="name" value="${esc(r.it.name)}" aria-label="Name"></td><td><span class="badge ${r.status}">${r.status === "new" ? "New" : r.status === "chg" ? "Update" : "Same"}</span>${r.it.skills ? `<div class="muted small">${esc(skillText(r.it))}</div>` : ""}</td>
      ${cols.map(([f, l]) => `<td><input data-f="${f}" value="${esc(r.it[f] ?? "")}" placeholder="${r.ex && !blank(r.ex[f]) ? esc(r.ex[f]) : "—"}" aria-label="${l}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${raw}
    <div class="toolbar" style="justify-content:flex-end"><button class="btn" type="button" data-close>Discard</button><button class="btn hot" type="button" id="rv-save">Save selected</button></div>`;
  $("#rv-all").onchange = e => st.querySelectorAll(".rv-on").forEach(c => c.checked = e.target.checked);
  $("#rv-save").onclick = () => {
    const now = new Date().toISOString(); let n = 0;
    st.querySelectorAll("tr[data-row]").forEach(tr => {
      if (!tr.querySelector(".rv-on").checked) return;
      const r = rows[+tr.dataset.row], o = { ...r.it };
      tr.querySelectorAll("input[data-f]").forEach(inp => { const v = inp.value.trim(); if (v) o[inp.dataset.f] = v; else if (inp.dataset.f !== "name") delete o[inp.dataset.f]; });
      if (blank(o.name)) return;
      if (kind === "events") { const left = parseRemaining(o.timeRemaining); if (left != null) o.endsAt = new Date(Date.now() + left).toISOString(); delete o.timeRemaining; }
      if (o.faction) o.faction = canonFaction(o.faction); if (o.rarity) o.rarity = canonRarity(o.rarity);
      if (kind !== "events") { const ref = refFor(kind, o); if (ref) { o.ref = ref.id; o.name = ref.name; o.faction = o.faction || ref.faction; o.rarity = o.rarity || ref.rarity; } }
      const ex = list.find(x => norm(x.name) === norm(o.name));
      if (o.skills) o.skills = Object.assign({}, (ex && ex.skills) || {}, o.skills);   // add to the skill slots already saved
      if (ex) { Object.assign(ex, o); if (kind !== "events") ex.updatedAt = now; }
      else list.push(Object.assign({ id: newId() }, kind === "events" ? { done: false, startsAt: now } : { other: {}, updatedAt: now }, o));
      n++;
    });
    save(kind); closeSheet(); toast(n ? `Saved ${n} ${n === 1 ? "entry" : "entries"}.` : "Nothing was selected, so nothing was saved."); location.hash = "#me/" + kind;
  };
}

/* ================= Paste from a spreadsheet ================= */
const PASTE_KEYS = { fellows: ["name", "level", "aptitude", "power", "stella"], family: ["name", "intimacy", "blessing", "stella"] };
const HEADER_WORDS = { name: ["name", "fellow", "member", "family"], level: ["level", "lv", "lvl"], aptitude: ["aptitude", "apt"], power: ["power", "pwr"], stella: ["stella", "star", "stars"], intimacy: ["intimacy"], blessing: ["blessing", "bless"], rarity: ["rarity"], faction: ["faction", "type"], blessed: ["blesses", "blessed"] };
function splitRow(line) {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  if (line.includes("|")) return line.split("|");
  return line.split(/\s*,\s+|\s{2,}/);
}
function parsePaste(kind, text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  let keys = PASTE_KEYS[kind];
  const first = splitRow(lines[0]).map(c => norm(c));
  const mapped = first.map(c => Object.keys(HEADER_WORDS).find(k => HEADER_WORDS[k].includes(c)) || null);
  if (mapped.includes("name")) { keys = mapped; lines.shift(); }
  const idx = nameIndex(kind);
  return lines.map(line => {
    const cells = splitRow(line).map(c => c.trim());
    const o = {};
    keys.forEach((k, i) => { if (k && !blank(cells[i])) o[k] = cells[i]; });
    if (blank(o.name)) return null;
    const known = findName(o.name, idx); if (known) o.name = known;
    return o;
  }).filter(Boolean);
}
function openPaste(kind) {
  const keys = PASTE_KEYS[kind].map(k => k[0].toUpperCase() + k.slice(1));
  const noun = kind === "fellows" ? "fellow" : "family member";
  openSheet(sheetHead("Paste from a spreadsheet") + `<div class="sheet-body" id="imp-body">
    <p style="margin:0">Copy rows from Google Sheets, Excel or a notes app and paste them below, one ${noun} per line. Put the columns in this order: <b>${keys.join(", ")}</b>. A header row with those names also works, in any order. Leave a column empty if you don't know it.</p>
    <div class="form"><label class="wide" for="paste-box">Your rows<textarea id="paste-box" style="min-height:200px;font-family:ui-monospace,Consolas,monospace" placeholder="${kind === "fellows" ? "Ais Wallenstein\t120\t3450\t412M\t5\nAqua\t110\t2980\t365M\t3" : "Crysta\t1200\t950\t3\nHestia\t800\t640\t1"}"></textarea></label></div>
    <div class="toolbar"><button class="btn hot" type="button" id="paste-go">Check these rows</button><span class="err" id="paste-err" hidden></span></div>
    <div id="imp-stage" hidden></div></div>`);
  $("#paste-go").onclick = () => {
    const data = parsePaste(kind, $("#paste-box").value);
    if (!data.length) { const e = $("#paste-err"); e.hidden = false; e.textContent = "No rows with a name were found. Paste at least one line that starts with a name."; return; }
    sheet.querySelectorAll("#imp-body > p, #imp-body > .form, #imp-body > .toolbar").forEach(el => el.hidden = true);
    $("#imp-stage").hidden = false;
    showReview(kind, data, 0, []);
  };
}
