"use strict";
/* ================= Fellows & family ================= */
function fillSelect(sel, label, opts) { const cur = sel.value; sel.innerHTML = `<option value="">${label}</option>` + opts.map(o => `<option>${esc(o)}</option>`).join(""); sel.value = cur; }
function sortBy(rows, key) {
  const numeric = ["power", "level", "aptitude", "stella", "intimacy", "blessing"].includes(key);
  return rows.sort((a, b) => {
    if (key === "rarity") return RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || norm(a.name).localeCompare(norm(b.name));
    if (key === "name") return String(a.name).localeCompare(String(b.name));
    if (key === "updatedAt") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    const x = parseNum(a[key]), y = parseNum(b[key]);
    if (!isFinite(x) && !isFinite(y)) return 0; if (!isFinite(x)) return 1; if (!isFinite(y)) return -1;
    return numeric ? y - x : 0;
  });
}
const viewMode = { fellows: "cards", family: "cards" };
const QCOLS = {
  fellows: [["level", "Level"], ["aptitude", "Aptitude"], ["power", "Power"], ["stella", "Stella"]],
  family: [["intimacy", "Intimacy"], ["blessing", "Blessing"], ["stella", "Stella"], ["blessed", "Blesses"]],
};
const removedCache = {};
function ownedRefs(kind) { return new Set(S[kind].items.map(i => { const r = refFor(kind, i); return r ? r.id : null; }).filter(Boolean)); }
function rosterRows(kind, includeMissing) {
  let rows = S[kind].items.map(f => ({ ...f }));
  if (includeMissing) {
    const own = ownedRefs(kind);
    rows = rows.concat((kind === "fellows" ? ROSTER : FAMILY_ROSTER).filter(r => !own.has(r.id)).map(r => ({ name: r.name, faction: r.faction, rarity: r.rarity, ref: r.id, _missing: true })));
  }
  return rows;
}
function charCard(r, kind) {
  const fc = `var(${FACTION_VAR[r.faction] || "--muted"})`, rc = `var(${RARITY_VAR[r.rarity] || "--line-2"})`;
  const ref = refFor(kind, r);
  const stats = kind === "fellows" ? [["Level", r.level], ["Aptitude", r.aptitude], ["Power", r.power]] : [["Intimacy", r.intimacy], ["Blessing", r.blessing], ["Stella", r.stella]];
  let foot;
  if (r._missing) foot = `<span>${kind === "fellows" ? "Not recruited" : "Not in your family"}</span><span class="prog">${esc(ref ? ref.prog : "")}</span>`;
  else if (kind === "fellows") { const sa = skillApt(r); foot = `<span>${[blank(r.stella) ? "" : "Stella " + esc(r.stella), sa == null ? "" : "Skills +" + fmtNum(sa) + " apt"].filter(Boolean).join(" · ")}</span><span>${esc(ago(r.updatedAt))}</span>`; }
  else { const bl = !blank(r.blessed) ? r.blessed : ref && ref.blesses && ref.blesses.length ? ref.blesses.join(", ") : ""; foot = `<span>${bl ? "Blesses " + esc(bl) : ""}</span><span>${esc(ago(r.updatedAt))}</span>`; }
  const attr = r._missing ? `data-add-known="${kind}:${esc(r.ref)}"` : `data-edit="${kind}:${esc(r.id)}"`;
  return `<button type="button" class="char ${r._missing ? "missing" : ""}" style="--fc:${fc};--rc:${rc}" ${attr} aria-label="${esc(r.name)}">
    <div class="char-top"><span class="avatar">${esc(initials(r.name))}</span><div class="char-name"><b>${esc(r.name)}</b><span>${rarityChip(r.rarity)}${factionTag(r.faction)}</span></div></div>
    ${r._missing ? "" : `<div class="char-stats">${stats.map(([l, v]) => `<div class="cs"><i>${l}</i><b>${show(v)}</b></div>`).join("")}</div>`}
    <div class="char-foot">${foot}</div></button>`;
}
function quickTable(kind, rows) {
  const cols = QCOLS[kind];
  return `<p class="muted small" style="margin:0 0 10px">Tick the ones you have and type their numbers. Changes save as you go. Press Tab to jump to the next box.</p>
  <div class="table-scroll"><table class="quick"><thead><tr><th>Have</th><th>Name</th><th>Rarity</th>${cols.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>
  ${rows.map(r => {
    const ref = refFor(kind, r);
    const ph = kind === "family" && ref && ref.blesses && ref.blesses.length ? ref.blesses.join(", ") : "";
    return `<tr data-q="${kind}" data-id="${esc(r.id || "")}" data-ref="${esc(r.ref || (ref ? ref.id : ""))}" data-name="${esc(r.name)}" class="${r._missing ? "q-missing" : ""}">
      <td><input type="checkbox" class="q-own" ${r._missing ? "" : "checked"} aria-label="I have ${esc(r.name)}"></td>
      <td class="qn"><b>${esc(r.name)}</b>${factionTag(r.faction)}</td>
      <td><select class="q-f" data-f="rarity" aria-label="Rarity of ${esc(r.name)}">${RARITIES.map(x => `<option${x === r.rarity ? " selected" : ""}>${x}</option>`).join("")}</select></td>
      ${cols.map(([f, l]) => `<td><input class="q-f" data-f="${f}" value="${esc(r._missing ? "" : r[f] ?? "")}" placeholder="${f === "blessed" ? esc(ph) : ""}" aria-label="${l} of ${esc(r.name)}"></td>`).join("")}</tr>`;
  }).join("")}</tbody></table></div>`;
}
function renderFellowSummary() {
  const items = S.fellows.items;
  const have = ownedRefs("fellows").size;
  const powers = items.map(f => parseNum(f.power)).filter(isFinite);
  const total = powers.reduce((a, b) => a + b, 0);
  const urUp = items.filter(f => RARITIES.indexOf(f.rarity) >= RARITIES.indexOf("UR")).length;
  $("#fellow-pills").innerHTML = `<span class="pill"><b>${items.length}</b>recruited</span><span class="pill" style="--c:var(--muted)"><b>${have}/${ROSTER.length || "—"}</b>of the wiki roster</span><span class="pill"><b>${powers.length ? fmtNum(total) : "—"}</b>total power</span><span class="pill" style="--c:var(--gold)"><b>${urUp}</b>UR or higher</span>`;
  const byF = FACTIONS.map(f => { const l = items.filter(x => x.faction === f); return { f, n: l.length, p: l.map(x => parseNum(x.power)).filter(isFinite).reduce((a, b) => a + b, 0) }; });
  const maxP = Math.max(1, ...byF.map(x => x.p));
  $("#fellow-factions").innerHTML = items.length ? byF.map(x => `<div class="fbar" style="--c:var(${FACTION_VAR[x.f]})"><span class="fac">${x.f}</span><div class="track"><div class="fill" style="width:${(x.p / maxP * 100).toFixed(1)}%"></div></div><span class="tnum">${x.n} · ${total ? Math.round(x.p / total * 100) + "%" : "—"}</span></div>`).join("")
    : `<p class="muted small" style="margin:0">Your faction balance shows up once you add fellows.</p>`;
}
function renderFamilySummary() {
  const items = S.family.items;
  const sum = k => items.map(x => parseNum(x[k])).filter(isFinite).reduce((a, b) => a + b, 0);
  const has = k => items.some(x => isFinite(parseNum(x[k])));
  $("#family-pills").innerHTML = `<span class="pill"><b>${items.length}</b>members</span><span class="pill" style="--c:var(--muted)"><b>${ownedRefs("family").size}/${FAMILY_ROSTER.length || "—"}</b>of the wiki list</span><span class="pill"><b>${has("intimacy") ? fmtNum(sum("intimacy")) : "—"}</b>total Intimacy</span><span class="pill" style="--c:var(--gold)"><b>${has("blessing") ? fmtNum(sum("blessing")) : "—"}</b>total Blessing</span>`;
}
function renderRoster(kind) {
  const p = kind === "fellows" ? "f" : "m";
  fillSelect($(`#${p}-faction`), "All factions", FACTIONS);
  fillSelect($(`#${p}-rarity`), "All rarities", RARITIES);
  const mode = viewMode[kind];
  document.querySelectorAll(`[data-mode-for="${kind}"] button`).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  $(`#${p}-missing-wrap`).hidden = mode === "quick";
  $(`#${p}-sort`).hidden = mode === "quick";
  const q = norm($(`#${p}-search`).value), fac = $(`#${p}-faction`).value, rar = $(`#${p}-rarity`).value;
  const includeMissing = mode === "quick" || $(`#${p}-missing`).checked;
  let rows = rosterRows(kind, includeMissing).filter(r => (!q || norm(r.name).includes(q)) && (!fac || r.faction === fac) && (!rar || r.rarity === rar));
  if (mode === "quick") rows.sort((a, b) => (a._missing ? 1 : 0) - (b._missing ? 1 : 0) || String(a.name).localeCompare(String(b.name)));
  else { sortBy(rows, $(`#${p}-sort`).value); if (includeMissing) rows.sort((a, b) => (a._missing ? 1 : 0) - (b._missing ? 1 : 0)); }
  const g = $(kind === "fellows" ? "#fellow-grid" : "#family-grid");
  g.classList.toggle("chars", mode === "cards");
  if (mode === "cards" && !S[kind].items.length && !includeMissing) {
    g.innerHTML = kind === "fellows"
      ? emptyState("i-sword", "var(--pink)", "No fellows yet", "The fastest way to start is Quick edit: tick the fellows you have and type in their numbers. You can also paste rows from a spreadsheet or import a screen recording.", "fellows")
      : emptyState("i-heart", "var(--lilac)", "No family members yet", "Use Quick edit to tick the family members you have and type their Intimacy and Blessing, or paste them from a spreadsheet.", "family");
    return;
  }
  if (!rows.length) { g.innerHTML = `<p class="muted">Nothing matches these filters.</p>`; return; }
  g.innerHTML = mode === "quick" ? quickTable(kind, rows) : rows.map(r => charCard(r, kind)).join("");
}
function renderFellows() { renderFellowSummary(); renderRoster("fellows"); }
function renderFamily() { renderFamilySummary(); renderRoster("family"); }
function emptyState(icon, color, title, text, kind) {
  return `<div class="empty" style="grid-column:1/-1"><div class="orb" style="--c:${color}"><svg><use href="#${icon}"/></svg></div><strong>${title}</strong><p>${text}</p>
    <div class="toolbar" style="justify-content:center"><button class="btn hot" type="button" data-set-mode="${kind}:quick">Open Quick edit</button><button class="btn" type="button" data-paste="${kind}">Paste from a spreadsheet</button><button class="btn" type="button" data-open-import="${kind}"><svg><use href="#i-film"/></svg>Import a recording</button></div></div>`;
}
function persistQuiet() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch { if (storageOk) toast("This browser is blocking storage, so changes won't be kept."); storageOk = false; }
  cloudQueue();
}
function quickChange(el) {
  const tr = el.closest("tr[data-q]"); if (!tr) return;
  const kind = tr.dataset.q, list = S[kind].items;
  let item = tr.dataset.id ? list.find(x => x.id === tr.dataset.id) : null;
  const cacheKey = kind + ":" + (tr.dataset.ref || norm(tr.dataset.name));
  if (el.classList.contains("q-own")) {
    if (!el.checked) {
      if (item) { removedCache[cacheKey] = item; S[kind].items = list.filter(x => x !== item); tr.dataset.id = ""; tr.classList.add("q-missing"); }
      persistQuiet(); afterQuick(kind); return;
    }
    if (!item && removedCache[cacheKey]) { item = removedCache[cacheKey]; delete removedCache[cacheKey]; list.push(item); tr.dataset.id = item.id; tr.classList.remove("q-missing"); persistQuiet(); afterQuick(kind); return; }
  }
  if (!item) {
    const ref = (kind === "fellows" ? ROSTER : FAMILY_ROSTER).find(r => r.id === tr.dataset.ref);
    item = { id: newId(), name: tr.dataset.name, ref: ref ? ref.id : undefined, faction: ref ? ref.faction : null, rarity: ref ? ref.rarity : null, other: {} };
    tr.querySelectorAll(".q-f").forEach(inp => { const v = inp.value.trim(); if (v && inp.dataset.f !== "rarity") item[inp.dataset.f] = v; });
    list.push(item); tr.dataset.id = item.id; tr.querySelector(".q-own").checked = true; tr.classList.remove("q-missing");
  }
  if (el.classList.contains("q-f")) { const v = el.value.trim(); if (v) item[el.dataset.f] = v; else delete item[el.dataset.f]; }
  item.updatedAt = new Date().toISOString();
  S[kind].updatedAt = item.updatedAt;
  persistQuiet(); afterQuick(kind);
}
function afterQuick(kind) {
  if (kind === "fellows") renderFellowSummary(); else renderFamilySummary();
  renderTips(); navCounts();
}

/* ================= Events ================= */
let evFilter = "active";
const STATUS = { live: ["Live", "var(--mint)"], soon: ["Ending soon", "var(--coral)"], upcoming: ["Upcoming", "var(--sky)"], ended: ["Ended", "var(--dim)"] };
function evStatus(e, now = Date.now()) {
  const s = e.startsAt ? new Date(e.startsAt).getTime() : null, end = e.endsAt ? new Date(e.endsAt).getTime() : null;
  if (s && now < s) return "upcoming"; if (end && now >= end) return "ended"; if (end && end - now < 864e5) return "soon"; return "live";
}
function evCount(e) {
  const now = Date.now(), st = evStatus(e, now);
  if (st === "upcoming") return ["Starts in", fmtLeft(new Date(e.startsAt) - now), false];
  if (st === "ended") return ["Ended", fmtDate(e.endsAt), false];
  if (!e.endsAt) return ["Ends", "No end date", false];
  return ["Ends in", fmtLeft(new Date(e.endsAt) - now), st === "soon"];
}
function evProgress(e) {
  const s = e.startsAt ? new Date(e.startsAt).getTime() : null, end = e.endsAt ? new Date(e.endsAt).getTime() : null;
  if (!s || !end || end <= s) return null;
  return Math.max(0, Math.min(1, (Date.now() - s) / (end - s)));
}
function renderEvents() {
  const items = S.events.items, now = Date.now();
  const st = items.map(e => evStatus(e, now));
  const live = st.filter(s => s === "live" || s === "soon").length, soon = st.filter(s => s === "soon").length, up = st.filter(s => s === "upcoming").length;
  $("#event-pills").innerHTML = `<span class="pill"><b>${live}</b>live now</span><span class="pill" style="--c:var(--coral)"><b>${soon}</b>ending within a day</span><span class="pill" style="--c:var(--sky)"><b>${up}</b>upcoming</span>`;
  $("#live-count").textContent = `${live} live`;
  document.querySelectorAll("#ev-filter button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === evFilter)));
  const match = s => evFilter === "all" || (evFilter === "active" && s !== "ended") || (evFilter === "live" && (s === "live" || s === "soon")) || evFilter === s;
  const rank = { soon: 0, live: 1, upcoming: 2, ended: 3 };
  const rows = items.map((e, i) => ({ e, s: st[i] })).filter(x => match(x.s)).sort((a, b) => {
    if (rank[a.s] !== rank[b.s]) return rank[a.s] - rank[b.s];
    const ka = a.s === "upcoming" ? a.e.startsAt : a.e.endsAt, kb = b.s === "upcoming" ? b.e.startsAt : b.e.endsAt;
    const x = ka ? new Date(ka).getTime() : Infinity, y = kb ? new Date(kb).getTime() : Infinity;
    return a.s === "ended" ? y - x : x - y;
  });
  const g = $("#event-grid");
  if (!items.length) { g.innerHTML = `<div class="card" style="grid-column:1/-1">${emptyState("i-cal", "var(--mint)", "No events tracked yet", "Record the game's event list or an event page showing its countdown and import it. You can also add an event by hand and type in its countdown.", "events")}</div>`; return; }
  if (!rows.length) { g.innerHTML = `<p class="muted" style="grid-column:1/-1">No events in this view.</p>`; return; }
  g.innerHTML = rows.map(({ e, s }) => {
    const [lbl, val, urgent] = evCount(e), p = evProgress(e), [sl, sc] = STATUS[s];
    return `<article class="ev" data-s="${s}" style="--sc:${sc}">
      <div class="ev-top"><h3>${esc(e.name)}</h3><span class="status"><span class="dot"></span>${sl}</span></div>
      <div class="big-count ${urgent ? "urgent" : ""}"><small>${lbl}</small><span data-count="${esc(e.id)}">${esc(val)}</span></div>
      ${p == null ? "" : `<div class="track" title="${Math.round(p * 100)}% of the event has passed"><div class="fill" data-prog="${esc(e.id)}" style="width:${(p * 100).toFixed(1)}%"></div></div>`}
      <div class="meta"><span>${e.startsAt ? esc(fmtDate(e.startsAt)) : "Start not set"}</span><span>${e.endsAt ? esc(fmtDate(e.endsAt)) : "End not set"}</span></div>
      ${blank(e.rewards) ? "" : `<div class="note-b"><i>Rewards</i>${esc(e.rewards)}</div>`}
      ${blank(e.goal) ? "" : `<div class="note-b"><i>My goal</i>${esc(e.goal)}</div>`}
      ${blank(e.notes) ? "" : `<div class="note-b"><i>Notes</i>${esc(e.notes)}</div>`}
      <div class="ev-foot"><label class="check"><input type="checkbox" data-done="${esc(e.id)}" ${e.done ? "checked" : ""}>Goal done</label><button class="btn ghost sm" type="button" data-edit="events:${esc(e.id)}">Edit</button></div>
    </article>`;
  }).join("");
}

/* ================= Tips ================= */
function buildTips() {
  const tips = [];
  const F = S.fellows.items, M = S.family.items, E = S.events.items, now = Date.now();
  if (!F.length && !M.length) {
    tips.push({ c: "var(--gold)", tag: "Start here", icon: "i-film", title: "Add your fellows", body: "<p>Open Fellows, switch to Quick edit, tick the ones you have and type their numbers. Tips about upgrades, skills and faction balance appear once the ledger knows your fellows.</p>" });
    return tips;
  }
  const soon = E.filter(e => evStatus(e, now) === "soon" && !e.done);
  if (soon.length) tips.push({ c: "var(--coral)", tag: "Urgent", icon: "i-cal", title: `${soon.length} event${soon.length > 1 ? "s end" : " ends"} within a day`, body: `<ul>${soon.map(e => `<li><b>${esc(e.name)}</b>: ${esc(fmtLeft(new Date(e.endsAt) - now))} left${blank(e.goal) ? "" : " · goal: " + esc(e.goal)}</li>`).join("")}</ul>` });
  const withP = F.filter(f => isFinite(parseNum(f.power)));
  const total = withP.reduce((a, f) => a + parseNum(f.power), 0);
  if (withP.length >= 5) {
    const byF = FACTIONS.map(f => ({ f, p: withP.filter(x => x.faction === f).reduce((a, x) => a + parseNum(x.power), 0) })).filter(x => F.some(y => y.faction === x.f));
    if (byF.length >= 2) {
      byF.sort((a, b) => a.p - b.p);
      const weak = byF[0], share = total ? weak.p / total : 0;
      if (share < 0.15) tips.push({ c: `var(${FACTION_VAR[weak.f]})`, tag: "Balance", icon: "i-sword", title: `${weak.f} is your weakest faction`, body: `<p>${weak.f} fellows hold only ${Math.round(share * 100)}% of your fellow power. Faction-based bonuses and challenges reward a stronger ${weak.f} line-up, so it can be worth putting your next upgrades there.</p>` });
    }
    const sorted = [...withP].sort((a, b) => parseNum(b.power) - parseNum(a.power));
    const top3 = sorted.slice(0, 3).reduce((a, f) => a + parseNum(f.power), 0);
    if (total && top3 / total > 0.6) tips.push({ c: "var(--gold)", tag: "Focus", icon: "i-sword", title: "Most of your power sits in three fellows", body: `<p>${sorted.slice(0, 3).map(f => esc(f.name)).join(", ")} hold ${Math.round(top3 / total * 100)}% of your fellow power. Strengthening them pays off fastest; raising the next few closes the gap if you need wider coverage.</p>` });
  }
  const withSkills = F.map(f => ({ f, ref: refFor("fellows", f) })).filter(x => x.ref && x.ref.skills && x.ref.skills.length && x.f.skills && Object.keys(x.f.skills).length);
  if (withSkills.length) {
    const picks = withSkills.sort((a, b) => (parseNum(b.f.power) || 0) - (parseNum(a.f.power) || 0)).slice(0, 5).map(({ f, ref }) => {
      const open = ref.skills.filter(s => s.per && isFinite(parseNum(f.skills[s.id])) && (!s.cap || parseNum(f.skills[s.id]) < s.cap)).sort((a, b) => b.per - a.per)[0];
      return open ? `<li><b>${esc(f.name)}</b>: ${esc(open.name)} (+${open.per} aptitude per level, now Lv ${esc(f.skills[open.id])})</li>` : "";
    }).filter(Boolean);
    if (picks.length) tips.push({ c: "var(--pink)", tag: "Skills", icon: "i-up", title: "Best skill slots to level next", body: `<p>For your strongest fellows, these unlocked skills give the most aptitude per level and are still below their base cap.</p><ul>${picks.join("")}</ul>` });
  } else if (F.some(f => { const r = refFor("fellows", f); return r && r.skills && r.skills.length; })) {
    tips.push({ c: "var(--sky)", tag: "Skills", icon: "i-sword", title: "Add skill levels for your top fellows", body: "<p>Open a fellow's card and type their skill levels. The ledger then shows which skill slot gives the most aptitude for your next upgrade.</p>" });
  }
  const upgradable = F.map(f => ({ f, ref: refFor("fellows", f) })).filter(x => x.ref && x.f.rarity && RARITIES.indexOf(x.f.rarity) >= 0 && RARITIES.indexOf(x.f.rarity) < RARITIES.indexOf(x.ref.maxRarity));
  if (upgradable.length) {
    upgradable.sort((a, b) => (parseNum(b.f.power) || 0) - (parseNum(a.f.power) || 0));
    tips.push({ c: "var(--pink)", tag: "Upgrade", icon: "i-up", title: `${upgradable.length} fellow${upgradable.length > 1 ? "s" : ""} can still rise in rarity`, body: `<p>Rarity upgrades cost Crystal Fragments and add 5 Aptitude per level, with milestones at Lv 20, 40 and 80.</p><ul>${upgradable.slice(0, 6).map(x => `<li><b>${esc(x.f.name)}</b>: ${esc(x.f.rarity)} → ${esc(x.ref.maxRarity)}</li>`).join("")}</ul>` });
  }
  const noPower = F.filter(f => blank(f.power));
  if (F.length && noPower.length / F.length > 0.3) tips.push({ c: "var(--sky)", tag: "Data", icon: "i-film", title: `${noPower.length} fellows have no power saved`, body: "<p>Record the fellows screen again, pausing a moment on each row, so the ledger can read their power. Better data means better tips.</p>", action: "fellows" });
  const noBless = M.filter(m => blank(m.blessed));
  if (noBless.length) tips.push({ c: "var(--lilac)", tag: "Family", icon: "i-heart", title: "Note who each family member blesses", body: `<p>Blessings add aptitude and power to specific fellows. Add the blessed fellow to ${noBless.length} member${noBless.length > 1 ? "s" : ""} so you can see which fellows get the most support.</p>` });
  const lowInt = M.filter(m => isFinite(parseNum(m.intimacy))).sort((a, b) => parseNum(a.intimacy) - parseNum(b.intimacy)).slice(0, 3);
  if (lowInt.length >= 2 && M.length >= 4) tips.push({ c: "var(--lilac)", tag: "Family", icon: "i-heart", title: "Lowest Intimacy", body: `<p>Intimacy raises Blessing. These members are furthest behind:</p><ul>${lowInt.map(m => `<li><b>${esc(m.name)}</b>: ${esc(m.intimacy)}${blank(m.blessed) ? "" : " · blesses " + esc(m.blessed)}</li>`).join("")}</ul>` });
  if (!tips.length) tips.push({ c: "var(--mint)", tag: "All good", icon: "i-sprout", title: "Nothing needs attention", body: "<p>Keep your fellows and family up to date and new suggestions will show up here.</p>" });
  return tips;
}
function renderTips() {
  const tips = buildTips();
  $("#nav-tips").textContent = tips.length;
  $("#tip-pills").innerHTML = `<span class="pill"><b>${tips.length}</b>suggestion${tips.length === 1 ? "" : "s"}</span>`;
  $("#tip-grid").innerHTML = tips.map(t => `<article class="card tip" style="--c:${t.c}"><div class="tip-top"><span class="bubble" style="--c:${t.c}"><svg><use href="#${t.icon}"/></svg></span><div><div class="tag">${t.tag}</div><h3>${t.title}</h3></div></div>${t.body}${t.action ? `<div><button class="btn sm" type="button" data-open-import="${t.action}">Import a recording</button></div>` : ""}</article>`).join("");
}

function renderAll() {
  renderProfile(); renderFellows(); renderFamily(); renderEvents(); renderTips(); navCounts();
  // pages that show ledger data too: the wiki's "In your ledger" and Home's event count
  const { tab, rest } = currentRoute();
  if (tab && tab.type === "wiki") renderWiki(rest);
  renderHomeLinks();
}
function navCounts() {
  $("#nav-fellows").textContent = S.fellows.items.length;
  $("#nav-family").textContent = S.family.items.length;
  $("#nav-events").textContent = S.events.items.filter(e => evStatus(e) !== "ended").length;
}

/* ================= Clock & countdowns ================= */
setInterval(() => {
  $("#clock").textContent = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if ($("[data-view='events']").hidden) return;
  document.querySelectorAll("[data-count]").forEach(el => { const e = S.events.items.find(x => x.id === el.dataset.count); if (e) { const [, val, urgent] = evCount(e); el.textContent = val; el.parentElement.classList.toggle("urgent", urgent); } });
  document.querySelectorAll("[data-prog]").forEach(el => { const e = S.events.items.find(x => x.id === el.dataset.prog); const p = e && evProgress(e); if (p != null) el.style.width = (p * 100).toFixed(1) + "%"; });
}, 1000);
