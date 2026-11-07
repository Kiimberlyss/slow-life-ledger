"use strict";
/* ================= Helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const blank = v => v === null || v === undefined || String(v).trim() === "";
const show = v => blank(v) ? "—" : esc(v);
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function parseNum(v) {
  if (blank(v)) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "").replace(/\s+/g, "").replace(/^[^\d.]+/, "");
  const m = s.match(/^(\d+(?:\.\d+)?)([a-zA-Z]{0,2})/);
  if (!m) return NaN;
  const n = parseFloat(m[1]), suf = m[2].toUpperCase();
  const mult = { "": 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15 };
  if (suf in mult) return n * mult[suf];
  if (/^[A-Z]{2}$/.test(suf)) { const i = (suf.charCodeAt(0) - 65) * 26 + (suf.charCodeAt(1) - 65); return n * Math.pow(10, 15 + 3 * i); }
  return n;
}
function fmtNum(n) {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e15) {
    const exp = Math.floor(Math.log10(a) / 3) * 3, i = (exp - 15) / 3;
    const suf = String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26));
    return trimDec(n / Math.pow(10, exp)) + suf;
  }
  for (const [v, u] of [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]]) if (a >= v) return trimDec(n / v) + u;
  return Math.round(n).toLocaleString();
}
function trimDec(x) { const a = Math.abs(x); return String(+x.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2)); }
function ago(iso) {
  if (!iso) return ""; const d = new Date(iso); if (isNaN(d)) return "";
  const s = (Date.now() - d) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago"; if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 604800) return Math.floor(s / 86400) + "d ago";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtDate(iso, withTime = true) {
  const d = new Date(iso); if (!iso || isNaN(d)) return "";
  return d.toLocaleString(undefined, withTime ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" });
}
function fmtLeft(ms) {
  if (ms <= 0) return "0m";
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
function parseRemaining(str) {
  if (blank(str)) return null;
  let ms = 0, hit = false, m;
  const re = /(\d+(?:\.\d+)?)\s*(d|day|days|h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|seconds)(?![a-z])/gi;
  while ((m = re.exec(str))) { hit = true; const n = parseFloat(m[1]), u = m[2].toLowerCase()[0]; ms += n * (u === "d" ? 864e5 : u === "h" ? 36e5 : u === "m" ? 6e4 : 1e3); }
  const clock = String(str).match(/(\d{1,3}):(\d{2})(?::(\d{2}))?/);
  if (clock) { const c = (+clock[1] * 3600 + +clock[2] * 60 + +(clock[3] || 0)) * 1000; if (!hit) { hit = true; ms = c; } else if (/\d+\s*d/i.test(str) && !/\d+\s*h/i.test(str)) ms += c; }
  return hit ? ms : null;
}
function toLocalInput(iso) {
  const d = new Date(iso); if (!iso || isNaN(d)) return "";
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v) { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); }
function rarityChip(r) { return blank(r) ? "" : `<span class="chip" style="--c:var(${RARITY_VAR[r] || "--muted"})">${esc(r)}</span>`; }
function factionTag(f) { return blank(f) ? "" : `<span class="fac" style="--c:var(${FACTION_VAR[f] || "--muted"})">${esc(f)}</span>`; }
function canonFaction(f) { if (blank(f)) return null; const n = norm(f); return FACTIONS.find(x => norm(x) === n || (n.length >= 3 && norm(x).startsWith(n.slice(0, 3)))) || String(f); }
function canonRarity(r) { if (blank(r)) return null; const s = String(r).toUpperCase().replace(/\s/g, ""); return RARITIES.find(x => x === s) || String(r); }
function initials(name) { const w = String(name || "?").replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/); return ((w[0] || "?")[0] + (w.length > 1 ? w[w.length - 1][0] : (w[0] || "")[1] || "")).toUpperCase(); }
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; $("#toasts").append(t); setTimeout(() => t.remove(), 4200); }
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
