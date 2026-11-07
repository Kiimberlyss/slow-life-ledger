"use strict";
/* ================= Storage (this browser) ================= */
const KEYS = ["profile", "fellows", "family", "events"];
const STORE_KEY = "slow-life-ledger:v1";
const EMPTY = () => ({ profile: { current: {}, history: [] }, fellows: { items: [] }, family: { items: [] }, events: { items: [] } });
let S = EMPTY();
let storageOk = true;
function shapeAll(d) {
  const e = EMPTY(); d = d || {};
  e.profile.current = (d.profile && d.profile.current) || {};
  e.profile.history = Array.isArray(d.profile && d.profile.history) ? d.profile.history : [];
  for (const k of ["fellows", "family", "events"]) e[k].items = Array.isArray(d[k] && d[k].items) ? d[k].items.filter(x => x && typeof x === "object") : [];
  for (const k of ["fellows", "family", "events"]) for (const it of e[k].items) if (!it.id) it.id = newId();
  return e;
}
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) S = shapeAll(JSON.parse(raw)); }
  catch { storageOk = false; }
}
function save(key) {
  if (key) S[key].updatedAt = new Date().toISOString();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch { if (storageOk) toast("This browser is blocking storage, so changes won't be kept after you close the page."); storageOk = false; }
  cloudQueue();
  renderAll();
}
