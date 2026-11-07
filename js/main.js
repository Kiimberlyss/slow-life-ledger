"use strict";
/* ================= Routing =================
   #home, #stamina/<event>, #guides/<guide>, #wiki/<fellows|family>/<id>, #me/<profile|fellows|family|events|tips>,
   and #<id> for any Markdown page added to content/site.json. */
const LEDGER_TABS = ["profile", "fellows", "family", "events", "tips"];
const LEGACY = { profile: "me/profile", fellows: "me/fellows", family: "me/family", events: "me/events", tips: "me/tips" };
const TAB_COLORS = ["var(--gold)", "var(--coral)", "var(--sky)", "var(--lilac)", "var(--mint)", "var(--pink)"];

function currentRoute() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const parts = h.split("/").filter(Boolean);
  const tab = SITE.nav.find(n => n.id === parts[0]) || SITE.nav[0];
  return { tab, rest: tab && tab.id === parts[0] ? parts.slice(1) : [] };
}
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (LEGACY[h]) { location.replace("#" + LEGACY[h]); return; }
  const { tab, rest } = currentRoute();
  if (!tab) return;
  document.querySelectorAll("[data-page]").forEach(v => v.hidden = v.dataset.page !== tab.type);
  document.querySelectorAll("#nav [data-tab]").forEach(a => { if (a.dataset.tab === tab.id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  document.title = tab.type === "home" ? "Slow Life Ledger" : `${tab.label} · Slow Life Ledger`;
  if (tab.type === "home") renderHome();
  else if (tab.type === "stamina") renderStamina(rest[0]);
  else if (tab.type === "guides") renderGuides(rest[0]);
  else if (tab.type === "wiki") renderWiki(rest);
  else if (tab.type === "page") renderPage(tab);
  else if (tab.type === "ledger") showLedger(rest[0]);
}
function showLedger(sub) {
  const s = LEDGER_TABS.includes(sub) ? sub : "profile";
  document.querySelectorAll("[data-view]").forEach(v => v.hidden = v.dataset.view !== s);
  document.querySelectorAll("#subnav [data-sub]").forEach(a => { if (a.dataset.sub === s) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}
function buildNav() {
  $("#nav").innerHTML = SITE.nav.map((n, i) => `<a href="#${esc(n.id)}" data-tab="${esc(n.id)}" style="--c:${TAB_COLORS[i % TAB_COLORS.length]}"><svg><use href="#i-${esc(n.icon || "sprout")}"/></svg>${esc(n.label)}</a>`).join("");
  $("#foot-links").innerHTML = (SITE.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join(" · ");
}
window.addEventListener("hashchange", () => { route(); window.scrollTo({ top: 0 }); });
/* signing in or out can change what an editor sees (drafts, edit buttons) */
function rerouteForAccount() { const { tab } = currentRoute(); if (tab && tab.type !== "ledger") route(); }

/* ================= Wiring ================= */
document.addEventListener("click", e => {
  const t = e.target.closest("button, [data-open-import]"); if (!t) return;
  if (t.matches("[data-close]")) return closeSheet();
  if (t.hasAttribute("data-open-import")) return openImport(t.getAttribute("data-open-import") || undefined);
  if (t.dataset.edit) { const [kind, id] = t.dataset.edit.split(":"); return editItem(kind, id); }
  if (t.dataset.addKnown) {
    const [kind, refId] = t.dataset.addKnown.split(":");
    const r = (kind === "family" ? FAMILY_ROSTER : ROSTER).find(x => x.id === refId);
    return editItem(kind, null, r ? { name: r.name, faction: r.faction, rarity: r.rarity, ref: r.id } : {});
  }
  if (t.dataset.paste) return openPaste(t.dataset.paste);
  if (t.dataset.setMode) { const [kind, mode] = t.dataset.setMode.split(":"); viewMode[kind] = mode; return kind === "fellows" ? renderFellows() : renderFamily(); }
  const seg = t.closest("[data-mode-for]");
  if (seg && t.dataset.mode) { const kind = seg.dataset.modeFor; viewMode[kind] = t.dataset.mode; return kind === "fellows" ? renderFellows() : renderFamily(); }
});
document.addEventListener("change", e => {
  if (e.target.matches(".q-own, .q-f")) return quickChange(e.target);
  const id = e.target.dataset && e.target.dataset.done;
  if (id) { const ev = S.events.items.find(x => x.id === id); if (ev) { ev.done = e.target.checked; save("events"); } }
});
$("#btn-add-fellow").onclick = () => editItem("fellows", null);
$("#btn-add-family").onclick = () => editItem("family", null);
$("#btn-add-event").onclick = () => editItem("events", null);
$("#live-pill").onclick = () => { evFilter = "live"; location.hash = "#me/events"; renderEvents(); };
["#f-faction", "#f-rarity", "#f-sort", "#f-missing", "#f-search"].forEach(s => $(s).addEventListener("input", renderFellows));
["#m-faction", "#m-rarity", "#m-sort", "#m-missing", "#m-search"].forEach(s => $(s).addEventListener("input", renderFamily));
$("#ev-filter").addEventListener("click", e => { const b = e.target.closest("button[data-f]"); if (b) { evFilter = b.dataset.f; renderEvents(); } });

// Profile
$("#profile-form").addEventListener("input", profileInput);
$("#avatar-btn").onclick = () => $("#avatar-file").click();
$("#avatar-file").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) setAvatar(f); };
$("#avatar-remove").onclick = removeAvatar;

// Wiki: the banner search looks through every fellow and family member
$("#global-search").addEventListener("input", e => {
  wiki.q = e.target.value;
  if (currentRoute().tab.type !== "wiki" || currentRoute().rest[1]) location.hash = "#wiki/" + wiki.kind; else renderWiki([wiki.kind]);
});
$("#wiki-kind").addEventListener("click", e => { const b = e.target.closest("button[data-kind]"); if (b) location.hash = "#wiki/" + b.dataset.kind; });
["#w-faction", "#w-rarity"].forEach(s => $(s).addEventListener("input", () => renderWiki([wiki.kind])));

$("#account-btn").onclick = openAccount;

load();
renderAll();
initCloud();
fetch("data/game.json")
  .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
  .then(g => { useGameData(g); renderAll(); const { tab, rest } = currentRoute(); if (tab && (tab.type === "wiki" || tab.type === "home")) route(); })
  .catch(() => toast("Couldn't load the fellow and family lists. Reload the page to try again."));
getContent("content/site.json")
  .then(s => { SITE = Object.assign({}, DEFAULT_SITE, s, { nav: Array.isArray(s.nav) && s.nav.length ? s.nav : DEFAULT_SITE.nav }); })
  .catch(() => { SITE = DEFAULT_SITE; })
  .finally(() => { buildNav(); route(); });
buildNav();
$("#clock").textContent = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
