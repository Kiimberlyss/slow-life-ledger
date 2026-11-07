"use strict";
/* ================= Sheets ================= */
const overlay = $("#overlay"), sheet = $("#sheet");
let busy = null;
function openSheet(html) { sheet.innerHTML = html; overlay.hidden = false; document.body.style.overflow = "hidden"; const f = sheet.querySelector("input:not([type=radio]):not([type=file]), select, textarea"); if (f) f.focus(); }
function closeSheet() { if (busy) { busy.abort(); busy = null; } overlay.hidden = true; sheet.innerHTML = ""; document.body.style.overflow = ""; }
overlay.addEventListener("click", e => { if (e.target === overlay) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !overlay.hidden) closeSheet(); });
function sheetHead(title) { return `<div class="sheet-head"><h2 id="sheet-title">${title}</h2><button class="btn ghost sm" type="button" data-close>Close</button></div>`; }

const FIELDS = {
  fellows: [["name", "Name"], ["faction", "Faction", FACTIONS], ["rarity", "Rarity", RARITIES], ["level", "Level"], ["aptitude", "Aptitude"], ["power", "Power"], ["stella", "Stella"], ["notes", "Notes", "area"]],
  family: [["name", "Name"], ["faction", "Faction", FACTIONS], ["rarity", "Rarity", RARITIES], ["intimacy", "Intimacy"], ["blessing", "Blessing"], ["stella", "Stella"], ["blessed", "Fellow they bless"], ["notes", "Notes", "area"]],
  events: [["name", "Event name"], ["startsAt", "Starts", "dt"], ["endsAt", "Ends", "dt"], ["rewards", "Rewards", "area"], ["goal", "My goal", "area"], ["notes", "Notes", "area"]],
};
function formHtml(fields, obj) {
  return `<div class="form">${fields.map(([k, label, opt]) => {
    const id = "fm-" + k, v = obj[k] ?? "";
    if (Array.isArray(opt)) return `<label for="${id}">${label}<select id="${id}" name="${k}"><option value="">Unknown</option>${opt.map(o => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
    if (opt === "area") return `<label class="wide" for="${id}">${label}<textarea id="${id}" name="${k}">${esc(v)}</textarea></label>`;
    if (opt === "dt") return `<label for="${id}">${label}<input id="${id}" name="${k}" type="datetime-local" value="${esc(toLocalInput(v))}"></label>`;
    return `<label for="${id}">${label}<input id="${id}" name="${k}" value="${esc(v)}" autocomplete="off"${k === "name" && obj === EMPTY_OBJ ? "" : ""}></label>`;
  }).join("")}</div>`;
}
const EMPTY_OBJ = {};
function readForm(fields) {
  const o = {};
  for (const [k, , opt] of fields) { const el = sheet.querySelector(`[name="${k}"]`); if (!el) continue; const v = el.value.trim(); o[k] = opt === "dt" ? fromLocalInput(v) : (v || null); }
  return o;
}
function armDelete(btn, label, onConfirm) {
  btn.addEventListener("click", () => {
    if (btn.dataset.armed) return onConfirm();
    btn.dataset.armed = "1"; btn.textContent = "Click again to confirm";
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = label; } }, 3500);
  });
}
function editItem(kind, id, preset) {
  const fields = FIELDS[kind], list = S[kind].items;
  const ex = id ? list.find(x => x.id === id) : null, obj = ex || preset || {};
  const noun = { fellows: "fellow", family: "family member", events: "event" }[kind];
  const other = Object.entries(obj.other || {}).filter(([, v]) => !blank(v));
  const ref = kind === "events" ? null : refFor(kind, obj);
  const skills = kind === "fellows" && ref && ref.skills ? ref.skills : [];
  const skillHtml = skills.length ? `<div class="skills"><div class="skills-head"><h3>Skill slots</h3><span class="muted small">Type each skill's current level. Leave locked skills empty.</span><span class="sk-total">Aptitude from skills: <b id="sk-total">—</b></span></div>
    <div class="table-scroll"><table><thead><tr><th>Skill</th><th>Unlocks at</th><th>Per level</th><th>Base cap</th><th>Level</th></tr></thead><tbody>
    ${skills.map((s, i) => `<tr><td><b>${esc(s.name)}</b></td><td class="muted">${esc(s.unlock)}</td><td>+${s.per ?? "?"} apt</td><td>${s.cap ?? "—"}</td><td><input type="number" inputmode="numeric" min="0" id="sk-${i}" data-skill="${esc(s.id)}" data-per="${s.per || 0}" value="${esc((obj.skills || {})[s.id] ?? "")}" aria-label="Level of ${esc(s.name)}"></td></tr>`).join("")}
    </tbody></table></div><p class="muted small" style="margin:0">Skill list from the fan wiki. Caps can be raised by bonds and events, so the base cap is a guide.</p></div>` : "";
  openSheet(sheetHead(ex ? esc(ex.name) : "Add " + noun) + `<form class="sheet-body" id="edit-form">${formHtml(fields, obj)}${skillHtml}
    ${kind === "events" ? `<div class="form"><label class="wide" for="fm-left">Or set the end from the in-game countdown<input id="fm-left" placeholder="For example 3d 14h" autocomplete="off"></label></div>` : ""}
    ${other.length ? `<div><p class="muted small" style="margin:0 0 6px">Other stats read from your recordings</p><dl class="kv">${other.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>` : ""}
    <p class="err" id="fm-err" hidden></p></form>
    <div class="sheet-foot">${ex ? `<button class="btn danger" type="button" id="fm-del">Remove</button><span style="margin-right:auto"></span>` : ""}<button class="btn" type="button" data-close>Cancel</button><button class="btn hot" type="submit" form="edit-form">Save</button></div>`);
  $("#edit-form").addEventListener("submit", ev => {
    ev.preventDefault();
    const o = readForm(fields);
    if (kind === "events") { const left = parseRemaining($("#fm-left").value); if (left != null) { o.endsAt = new Date(Date.now() + left).toISOString(); if (!o.startsAt) o.startsAt = new Date().toISOString(); } }
    if (!o.name) { const e = $("#fm-err"); e.hidden = false; e.textContent = "Add a name first."; return; }
    if (skills.length) { o.skills = {}; sheet.querySelectorAll("[data-skill]").forEach(inp => { if (inp.value.trim() !== "") o.skills[inp.dataset.skill] = inp.value.trim(); }); }
    if (kind !== "events") { const r = refFor(kind, o) || ref; if (r && norm(r.name) === norm(o.name)) o.ref = r.id; }
    if (ex) Object.assign(ex, o, kind === "events" ? {} : { updatedAt: new Date().toISOString() });
    else list.push(Object.assign({ id: newId() }, kind === "events" ? { done: false } : { other: {}, updatedAt: new Date().toISOString() }, o));
    save(kind); closeSheet(); toast(ex ? "Saved." : `Added ${o.name}.`);
  });
  const del = $("#fm-del");
  if (del) armDelete(del, "Remove", () => { S[kind].items = list.filter(x => x !== ex); save(kind); closeSheet(); toast(`Removed ${ex.name}.`); });
  if (skills.length) {
    const total = () => { let s = 0, any = false; sheet.querySelectorAll("[data-skill]").forEach(i => { const v = parseFloat(i.value); if (isFinite(v)) { s += v * (+i.dataset.per); any = true; } }); $("#sk-total").textContent = any ? "+" + s.toLocaleString() : "—"; };
    sheet.querySelectorAll("[data-skill]").forEach(i => i.addEventListener("input", total)); total();
  }
}
/* ================= Backup & restore ================= */
$("#btn-backup").onclick = () => {
  const blob = new Blob([JSON.stringify({ app: "slow-life-ledger", version: 1, savedAt: new Date().toISOString(), data: S }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `slow-life-ledger-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Backup saved to your downloads.");
};
$("#btn-restore").onclick = () => $("#restore-file").click();
$("#restore-file").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  let data;
  try { const j = JSON.parse(await f.text()); data = shapeAll(j.data || j); } catch { toast("That file isn't a Slow Life Ledger backup."); return; }
  openSheet(sheetHead("Restore backup") + `<div class="sheet-body"><p>This backup has <b>${data.fellows.items.length}</b> fellows, <b>${data.family.items.length}</b> family members, <b>${data.events.items.length}</b> events and your profile.</p><p class="muted">Restoring replaces everything currently saved in this browser.</p></div>
    <div class="sheet-foot"><button class="btn" type="button" data-close>Cancel</button><button class="btn hot" type="button" id="do-restore">Replace my data</button></div>`);
  $("#do-restore").onclick = () => { S = data; save(); closeSheet(); toast("Backup restored."); };
};
