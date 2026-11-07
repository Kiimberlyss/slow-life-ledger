"use strict";
/* ================= Content pages =================
   Home (reminders), Stamina, Guides, Wiki and any Markdown page listed in content/site.json. Everything they
   show comes from files in the content/ and data/ folders, so the site can be updated without touching code. */

const DEFAULT_SITE = {
  repo: "Kiimberlyss/slow-life-ledger", branch: "main", editors: [],
  nav: [
    { id: "home", label: "Home", icon: "home", type: "home" },
    { id: "stamina", label: "Stamina", icon: "bolt", type: "stamina" },
    { id: "guides", label: "Guides", icon: "book", type: "guides" },
    { id: "wiki", label: "Wiki", icon: "wiki", type: "wiki" },
    { id: "me", label: "My ledger", icon: "user", type: "ledger" },
  ],
  links: [],
};
let SITE = DEFAULT_SITE;

/* ---------- loading ---------- */
const contentCache = new Map();
function getContent(path, as = "json") {
  if (!contentCache.has(path)) {
    const p = fetch(path, { cache: "no-cache" })
      .then(r => r.ok ? (as === "json" ? r.json() : r.text()) : Promise.reject(new Error(`${path}: HTTP ${r.status}`)))
      .catch(e => { contentCache.delete(path); throw e; });
    contentCache.set(path, p);
  }
  return contentCache.get(path);
}
/* Markdown to safe HTML. Links to other sites open in a new tab. */
function md(text, inline = false) {
  if (!window.marked || !window.DOMPurify) return `<p>${esc(text)}</p>`;
  const html = DOMPurify.sanitize(inline ? marked.parseInline(String(text || "")) : marked.parse(String(text || "")));
  const t = document.createElement("template"); t.innerHTML = html;
  t.content.querySelectorAll("a[href^='http']").forEach(a => { a.target = "_blank"; a.rel = "noopener"; });
  return t.innerHTML;
}
function isEditor() { return !!(cloudUser && (SITE.editors || []).includes(cloudUser.uid)); }
function editButton(path, label = "Edit this page") {
  if (!isEditor()) return "";
  return `<a class="btn sm edit-btn" href="https://github.com/${esc(SITE.repo)}/edit/${esc(SITE.branch || "main")}/${esc(path)}" target="_blank" rel="noopener"><svg><use href="#i-pen"/></svg>${esc(label)}</a>`;
}
function loadingHtml(what) { return `<p class="muted">Loading ${esc(what)}…</p>`; }
function failHtml(what) { return `<div class="empty"><strong>Couldn't load ${esc(what)}</strong><p>Check your connection and reload the page.</p></div>`; }
/* Renders can overlap when someone clicks quickly: only the newest one for a target writes to the page. */
const renderSeq = {};
function claim(key) { renderSeq[key] = (renderSeq[key] || 0) + 1; const n = renderSeq[key]; return () => renderSeq[key] === n; }

/* ================= Home: reminders ================= */
const REM_TYPES = {
  maintenance: { label: "Maintenance", c: "var(--coral)", icon: "i-tool" },
  update: { label: "Coming next", c: "var(--sky)", icon: "i-bell" },
  event: { label: "Event", c: "var(--mint)", icon: "i-cal" },
  note: { label: "Note", c: "var(--gold)", icon: "i-bulb" },
  daily: { label: "Every day", c: "var(--lilac)", icon: "i-clock" },
  weekly: { label: "Every week", c: "var(--pink)", icon: "i-clock" },
};
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function utcAt(time, base) {   // "HH:MM" on the UTC day of base
  const [h, m] = String(time || "00:00").split(":").map(Number);
  const d = new Date(base); d.setUTCHours(h || 0, m || 0, 0, 0); return d;
}
function nextOccurrence(r, now) {
  if (r.type === "daily") { const d = utcAt(r.time, now); if (d <= now) d.setUTCDate(d.getUTCDate() + 1); return d; }
  if (r.type === "weekly") {
    const want = DAYS.indexOf(String(r.day || "monday").toLowerCase()), d = utcAt(r.time, now);
    let add = (want - d.getUTCDay() + 7) % 7; if (add === 0 && d <= now) add = 7;
    d.setUTCDate(d.getUTCDate() + add); return d;
  }
  return null;
}
function reminderGroups(items, now) {
  const g = { now: [], soon: [], repeat: [], notes: [] };
  for (const r of items) {
    if (r.draft && !isEditor()) continue;
    if (r.type === "daily" || r.type === "weekly") { const at = nextOccurrence(r, now); g.repeat.push({ r, at }); continue; }
    const start = r.start ? new Date(r.start) : null, end = r.end ? new Date(r.end) : start ? new Date(start.getTime() + 864e5) : null;
    if (!start || isNaN(start)) { g.notes.push({ r }); continue; }
    if (end && end <= now) continue;   // over
    // without an end, a reminder counts as "now" for a day after it starts, but no end time is shown
    if (start <= now) g.now.push({ r, at: r.end ? end : null, start, until: end }); else g.soon.push({ r, at: start, start, end: r.end ? end : null });
  }
  g.now.sort((a, b) => a.until - b.until); g.soon.sort((a, b) => a.at - b.at); g.repeat.sort((a, b) => a.at - b.at);
  return g;
}
function whenText(d) { return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function reminderCard({ r, at, start, end }, mode) {
  const t = REM_TYPES[r.type] || REM_TYPES.note;
  let when = "";
  if (mode === "now") when = at ? `<span class="rem-when">Ends ${esc(whenText(at))} · <b data-to="${at.toISOString()}">${esc(fmtLeft(at - Date.now()))}</b> left</span>` : "";
  else if (mode === "soon") when = `<span class="rem-when">${esc(whenText(start))}${end ? ` to ${esc(end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }))}` : ""} · in <b data-to="${at.toISOString()}">${esc(fmtLeft(at - Date.now()))}</b></span>`;
  else if (mode === "repeat") when = `<span class="rem-when">Next: ${esc(whenText(at))} · in <b data-to="${at.toISOString()}">${esc(fmtLeft(at - Date.now()))}</b></span>`;
  return `<article class="card rem" style="--c:${t.c}">
    <span class="bubble" style="--c:${t.c}"><svg><use href="#${t.icon}"/></svg></span>
    <div class="rem-main"><div class="tag">${esc(t.label)}${r.draft ? ` <span class="draft">Draft</span>` : ""}${mode === "now" ? ` <span class="live-dot">Now</span>` : ""}</div>
      <h3>${esc(r.title || "Untitled")}</h3>${when}${r.note ? `<div class="rem-note">${md(r.note, true)}</div>` : ""}</div>
  </article>`;
}
async function renderHome() {
  const fresh = claim("home"), el = $("#home-body");
  if (!el.dataset.loaded) el.innerHTML = loadingHtml("reminders");
  let intro = "", rem = { items: [] }, failed = false;
  try { [intro, rem] = await Promise.all([getContent("content/home.md", "text").catch(() => ""), getContent("content/reminders.json")]); }
  catch { failed = true; }
  if (!fresh()) return;
  el.dataset.loaded = "1";
  $("#home-intro").innerHTML = intro ? md(intro) : "";
  $("#home-edit").innerHTML = editButton("content/home.md", "Edit welcome text") + editButton("content/reminders.json", "Edit reminders");
  if (failed) { el.innerHTML = failHtml("reminders"); return; }
  const g = reminderGroups(rem.items || [], new Date());
  const section = (title, list, mode, empty) => list.length || empty ? `<section class="rem-group"><h3 class="rem-title">${title}</h3>${list.length ? `<div class="rems">${list.map(x => reminderCard(x, mode)).join("")}</div>` : `<p class="muted small" style="margin:0">${empty}</p>`}</section>` : "";
  const any = g.now.length + g.soon.length + g.repeat.length + g.notes.length;
  el.innerHTML = any ? section("Happening now", g.now, "now") + section("Coming up", g.soon, "soon") + section("Resets", g.repeat, "repeat") + section("Good to know", g.notes, "note")
    : `<div class="empty"><div class="orb" style="--c:var(--sky)"><svg><use href="#i-bell"/></svg></div><strong>No reminders right now</strong><p>Maintenance, resets and what's coming next show up here.</p></div>`;
  renderHomeLinks();
}
function renderHomeLinks() {
  const live = S.events.items.filter(e => evStatus(e) !== "ended" && !e.done).length;
  $("#home-links").innerHTML = [
    ["#stamina", "i-bolt", "var(--gold)", "Stamina planner", "Milestones, gem packs and ways to get a UR for every stamina event."],
    ["#guides", "i-book", "var(--sky)", "Guides", "Write-ups on events, family and more."],
    ["#wiki", "i-wiki", "var(--lilac)", "Wiki", `All ${ROSTER.length || ""} fellows and ${FAMILY_ROSTER.length || ""} family members, with skills and blessings.`],
    ["#me/events", "i-cal", "var(--mint)", "Your event timers", live ? `${live} event${live === 1 ? "" : "s"} running in your ledger.` : "Track the events you're doing and their end times."],
  ].map(([href, icon, c, title, text]) => `<a class="card link-card" href="${href}" style="--c:${c}"><span class="bubble" style="--c:${c}"><svg><use href="#${icon}"/></svg></span><span><b>${title}</b><span class="muted small">${esc(text)}</span></span></a>`).join("");
}
/* live countdowns on Home; a one-off reminder that just started or ended moves group */
setInterval(() => {
  const view = document.querySelector('[data-page="home"]'); if (!view || view.hidden) return;
  let stale = false;
  view.querySelectorAll("[data-to]").forEach(el => { const ms = new Date(el.dataset.to) - Date.now(); if (ms <= 0) stale = true; else el.textContent = fmtLeft(ms); });
  if (stale) renderHome();
}, 1000);

/* ================= Stamina ================= */
function cellHtml(v, i) {
  if (typeof v === "number") return `<td class="num${v < 0 ? " neg" : ""}">${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>`;
  return i === 0 ? `<th scope="row">${esc(v)}</th>` : `<td>${esc(v)}</td>`;
}
function tableHtml(t, cls = "") {
  const head = t.header && t.header.length ? `<thead><tr>${t.header.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>` : "";
  return `<div class="table-scroll ${cls}"><table class="data">${head}<tbody>${t.rows.map(r => `<tr>${r.map(cellHtml).join("")}</tr>`).join("")}</tbody></table></div>`;
}
/* A block with no header and one "number, sentence" row is a fact ("450 · This is with losing a bit…"). */
function blockHtml(b) {
  const facts = b.tables.length === 1 && !b.tables[0].header.length && b.tables[0].rows.length === 1 && b.tables[0].rows[0].length === 2 && typeof b.tables[0].rows[0][0] === "number";
  if (facts) {
    const [n, text] = b.tables[0].rows[0];
    return `<div class="card stat"><span class="lbl">${esc(b.title)}</span><span class="val">${n.toLocaleString()}</span><span class="sub">${esc(text)}</span></div>`;
  }
  return `<div class="st-block">${b.title ? `<h4>${esc(b.title)}</h4>` : ""}${b.subtitle ? `<p class="muted small st-sub">${esc(b.subtitle)}</p>` : ""}${b.notes.map(n => `<p class="small">${esc(n)}</p>`).join("")}${b.tables.map(t => tableHtml(t)).join("")}</div>`;
}
async function renderStamina(id) {
  const fresh = claim("stamina"), el = $("#stamina-body");
  if (!el.dataset.loaded) el.innerHTML = loadingHtml("the stamina tables");
  let d;
  try { d = await getContent("content/stamina.json"); } catch { if (fresh()) el.innerHTML = failHtml("the stamina tables"); return; }
  if (!fresh()) return;
  el.dataset.loaded = "1";
  const ev = d.events.find(e => e.id === id) || d.events[0];
  $("#stamina-edit").innerHTML = editButton("tools/build_stamina.py", "How to refresh");
  $("#stamina-picker").innerHTML = d.events.map(e => `<a class="pick" href="#stamina/${esc(e.id)}"${e === ev ? ' aria-current="page"' : ""}>${esc(e.name)}</a>`).join("");
  if (!ev) { el.innerHTML = failHtml("the stamina tables"); return; }
  const facts = ev.info.filter(b => b.tables.length === 1 && !b.tables[0].header.length && b.tables[0].rows.length === 1 && b.tables[0].rows[0].length === 2);
  const packs = ev.info.filter(b => !facts.includes(b));
  el.innerHTML = `
    <div class="card"><div class="card-head"><h3>${esc(ev.name)}</h3><span class="sub">${ev.plans.length} ways to get a UR</span></div>
      <div class="card-body st-intro">${ev.notes.map(n => `<p>${esc(n)}</p>`).join("")}
        <div class="grid-3">${facts.map(blockHtml).join("")}</div></div></div>
    <div class="st-cols">
      ${ev.milestones.map(b => `<div class="card"><div class="card-head"><h3>${esc(b.title || "Milestones")}</h3></div><div class="card-body">${b.subtitle ? `<p class="muted small st-sub">${esc(b.subtitle)}</p>` : ""}${b.tables.map(t => tableHtml(t, "tall")).join("")}</div></div>`).join("")}
    </div>
    ${packs.map(b => `<div class="card"><div class="card-head"><h3>${esc(b.title || "Gem packs")}</h3>${b.subtitle ? `<span class="sub">${esc(b.subtitle)}</span>` : ""}</div><div class="card-body st-packs">${b.notes.map(n => `<p class="small">${esc(n)}</p>`).join("")}${b.tables.map(t => tableHtml(t)).join("")}<p class="muted small" style="margin:0">1P: one pack · AO: every pack in one day · AP: every pack for the whole event</p></div></div>`).join("")}
    <div class="card"><div class="card-head"><h3>Ways to get 1 UR</h3><span class="sub">Tap a plan to see it run by run</span></div>
      <div class="card-body ways">${ev.plans.map(b => b.tables.length
        ? `<details${b === ev.plans.find(x => x.tables.length) ? " open" : ""}><summary><b>${esc(b.title)}</b><span class="muted">${esc(b.subtitle)}</span></summary>${b.notes.map(n => `<p class="small">${esc(n)}</p>`).join("")}${b.tables.map(t => tableHtml(t)).join("")}</details>`
        : `<div class="way-flat"><b>${esc(b.title)}</b><span class="muted">${esc(b.subtitle)}</span></div>`).join("")}</div></div>
    <p class="muted small">From the community <a href="${esc(d.source)}" target="_blank" rel="noopener">stamina spreadsheet</a>, last copied ${esc(d.builtAt)}. ${esc((d.intro || []).slice(-1)[0] || "")}</p>`;
}

/* ================= Guides and Markdown pages ================= */
async function renderGuides(slug) {
  const fresh = claim("guides"), el = $("#guides-body");
  let list;
  try { list = (await getContent("content/guides.json")).guides || []; } catch { if (fresh()) el.innerHTML = failHtml("the guides"); return; }
  if (!fresh()) return;
  list = list.filter(g => !g.draft || isEditor());
  const g = slug && list.find(x => x.slug === slug);
  $("#guides-head").hidden = !!g;
  if (!g) {
    $("#guides-edit").innerHTML = editButton("content/guides.json", "Edit the guide list");
    el.innerHTML = list.length ? `<div class="guide-grid">${list.map(x => `<a class="card guide-card" href="#guides/${esc(x.slug)}"><div class="tag" style="--c:var(--sky)">${(x.tags || []).map(esc).join(" · ")}${x.draft ? ` <span class="draft">Draft</span>` : ""}</div><h3>${esc(x.title)}</h3><p class="muted">${esc(x.summary || "")}</p>${x.updated ? `<span class="muted small">Updated ${esc(fmtDate(x.updated, false))}</span>` : ""}</a>`).join("")}</div>`
      : `<div class="empty"><strong>No guides yet</strong></div>`;
    return;
  }
  el.innerHTML = loadingHtml("the guide");
  let text;
  try { text = await getContent(g.file, "text"); } catch { if (fresh()) el.innerHTML = failHtml("this guide"); return; }
  if (!fresh()) return;
  el.innerHTML = `<div class="page-top"><a class="btn sm ghost" href="#guides">← All guides</a>${editButton(g.file)}</div><article class="card prose">${md(text)}</article>`;
}
async function renderPage(tab) {
  const fresh = claim("page"), el = $("#page-body");
  if (!tab.file) { el.innerHTML = failHtml("this page"); return; }
  el.innerHTML = loadingHtml(tab.label);
  let text;
  try { text = await getContent(tab.file, "text"); } catch { if (fresh()) el.innerHTML = failHtml("this page"); return; }
  if (!fresh()) return;
  el.innerHTML = `<div class="page-top"><span></span>${editButton(tab.file)}</div><article class="card prose">${md(text)}</article>`;
}

/* ================= Wiki: every fellow and family member ================= */
const wiki = { kind: "fellows", q: "", faction: "", rarity: "" };
function blessersOf(name) { const n = norm(name); return FAMILY_ROSTER.filter(m => (m.blesses || []).some(b => norm(b) === n)); }
function ownedItem(kind, ref) { return S[kind].items.find(x => x.ref === ref.id || norm(x.name) === norm(ref.name)); }
function wikiCard(kind, r) {
  const own = ownedItem(kind, r);
  return `<a class="card wiki-card" href="#wiki/${kind}/${esc(r.id)}" style="--c:var(${FACTION_VAR[r.faction] || "--muted"})">
    <span class="wiki-mono">${esc(initials(r.name))}</span>
    <span class="wiki-text"><b>${esc(r.name)}</b><span class="muted small">${esc(r.title || "")}</span><span class="wiki-tags">${factionTag(r.faction)}${(r.path || [r.rarity]).map(x => rarityChip(canonRarity(x))).join("")}${own ? `<span class="own">In your ledger</span>` : ""}</span></span></a>`;
}
function renderWiki(parts) {
  const [kind, id] = parts || [];
  const list = kind === "family" ? FAMILY_ROSTER : ROSTER;
  if (id && (kind === "fellows" || kind === "family")) {
    const r = list.find(x => x.id === id);
    $("#wiki-list-head").hidden = true;
    $("#wiki-body").innerHTML = r ? wikiDetail(kind, r) : (list.length ? `<div class="empty"><strong>Not found</strong><p><a href="#wiki">Back to the wiki</a></p></div>` : loadingHtml("the wiki"));
    return;
  }
  $("#wiki-list-head").hidden = false;
  if (kind === "fellows" || kind === "family") wiki.kind = kind;
  document.querySelectorAll("#wiki-kind button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kind === wiki.kind)));
  fillSelect($("#w-faction"), "All factions", FACTIONS); fillSelect($("#w-rarity"), "All rarities", RARITIES);
  const all = wiki.kind === "family" ? FAMILY_ROSTER : ROSTER;
  if (!all.length) { $("#wiki-body").innerHTML = loadingHtml("the wiki"); return; }
  const q = norm(wiki.q), fac = $("#w-faction").value, rar = $("#w-rarity").value;
  const rows = all.filter(r => (!q || norm(r.name).includes(q) || norm(r.title).includes(q)) && (!fac || r.faction === fac) && (!rar || (r.path || [r.rarity]).map(canonRarity).includes(rar)))
    .sort((a, b) => a.name.localeCompare(b.name));
  $("#wiki-count").textContent = `${rows.length} of ${all.length}`;
  $("#wiki-body").innerHTML = rows.length ? `<div class="wiki-grid">${rows.map(r => wikiCard(wiki.kind, r)).join("")}</div>` : `<p class="muted">Nothing matches.</p>`;
}
function wikiDetail(kind, r) {
  const own = ownedItem(kind, r);
  const back = `<a class="btn sm ghost" href="#wiki/${kind}">← All ${kind === "family" ? "family" : "fellows"}</a>`;
  const head = `<div class="card wiki-hero" style="--c:var(${FACTION_VAR[r.faction] || "--muted"})"><span class="wiki-mono big">${esc(initials(r.name))}</span>
    <div><div class="tag">${esc(kind === "family" ? "Family member" : "Fellow")}</div><h2>${esc(r.name)}</h2><p class="muted" style="margin:0">${esc(r.title || "")}</p>
    <div class="wiki-tags">${factionTag(r.faction)}${(r.path || [r.rarity]).map(x => rarityChip(canonRarity(x))).join(`<span class="muted">→</span>`)}</div></div>
    <div class="wiki-actions">${r.url ? `<a class="btn sm" href="${esc(r.url)}" target="_blank" rel="noopener">Open on the fan wiki</a>` : ""}${own ? `<button class="btn sm hot" type="button" data-edit="${kind}:${esc(own.id)}">Edit in my ledger</button>` : `<button class="btn sm" type="button" data-add-known="${kind}:${esc(r.id)}">Add to my ledger</button>`}</div></div>`;
  let body = "";
  if (own) {
    const stats = kind === "family" ? [["Intimacy", own.intimacy], ["Blessing", own.blessing], ["Stella", own.stella]] : [["Level", own.level], ["Aptitude", own.aptitude], ["Power", own.power], ["Stella", own.stella]];
    body += `<div class="card"><div class="card-head"><h3>In your ledger</h3></div><div class="card-body"><div class="pills">${stats.map(([l, v]) => `<span class="pill"><b>${show(v)}</b>${l}</span>`).join("")}</div></div></div>`;
  }
  if (kind === "fellows") {
    const by = blessersOf(r.name);
    body += `<div class="card"><div class="card-head"><h3>Blessed by</h3><span class="sub">Family members whose blessing helps ${esc(r.name)}</span></div><div class="card-body">${by.length ? `<div class="link-chips">${by.map(m => `<a href="#wiki/family/${esc(m.id)}">${esc(m.name)}</a>`).join("")}</div>` : `<p class="muted small" style="margin:0">No family member is listed as blessing ${esc(r.name)}.</p>`}</div></div>`;
    if (r.skills && r.skills.length) {
      const owned = own && own.skills || {};
      body += `<div class="card"><div class="card-head"><h3>Skills</h3><span class="sub">${r.skills.length} skill slots</span></div><div class="card-body"><div class="table-scroll"><table class="data"><thead><tr><th>Skill</th><th>Unlocks</th><th>Aptitude per level</th><th>Base cap</th>${own ? "<th>Your level</th>" : ""}</tr></thead><tbody>
        ${r.skills.map(s => `<tr><th scope="row">${esc(s.name)}</th><td>${esc(s.unlock || "")}</td><td class="num">${s.per != null ? "+" + s.per : "—"}</td><td class="num">${s.cap ?? "—"}</td>${own ? `<td class="num">${show(owned[s.id])}</td>` : ""}</tr>`).join("")}
        </tbody></table></div></div></div>`;
    }
  } else {
    const fellows = (r.blesses || []).map(n => ROSTER_BY.get(norm(n)) || { name: n });
    body += `<div class="card"><div class="card-head"><h3>Blesses</h3><span class="sub">Fellows that get ${esc(r.name)}'s blessing</span></div><div class="card-body">${fellows.length ? `<div class="link-chips">${fellows.map(f => f.id ? `<a href="#wiki/fellows/${esc(f.id)}">${esc(f.name)}</a>` : `<span>${esc(f.name)}</span>`).join("")}</div>` : `<p class="muted small" style="margin:0">The fan wiki doesn't list who ${esc(r.name)} blesses.</p>`}</div></div>`;
  }
  return `<div class="page-top">${back}</div>${head}${body}<p class="muted small">From the <a href="https://zik-ascend.github.io/isl-tools/wiki/" target="_blank" rel="noopener">fan wiki</a>${gameInfo && gameInfo.builtAt ? `, copied ${esc(gameInfo.builtAt)}` : ""}.</p>`;
}
