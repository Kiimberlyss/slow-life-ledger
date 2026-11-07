"use strict";
/* ================= Profile =================
   Typed in by hand: in-game name, level, earnings and power, plus a profile picture. Shows the ratio between
   earnings and power. The picture is cropped square and shrunk so it fits in the saved ledger. */
const PROFILE_FIELDS = [["name", "In-game name", "Kim"], ["level", "Level", "54"], ["earnings", "Earnings per second", "11.21T"], ["power", "Power", "1.035T"]];
const AVATAR_PX = 192;

function avatarHtml(cls = "avatar") {
  const cur = S.profile.current || {};
  if (cur.avatar) return `<img class="${cls}" src="${esc(cur.avatar)}" alt="">`;
  return `<span class="${cls} avatar-blank">${cur.name ? esc(initials(cur.name)) : `<svg><use href="#i-user"/></svg>`}</span>`;
}

function renderProfile() {
  const cur = S.profile.current || {};
  $("#profile-avatar").innerHTML = avatarHtml("avatar avatar-lg");
  $("#avatar-remove").hidden = !cur.avatar;
  $("#profile-name").textContent = cur.name || "Your profile";
  $("#profile-sub").textContent = [blank(cur.level) ? "" : `Level ${cur.level}`, S.profile.updatedAt ? `updated ${ago(S.profile.updatedAt)}` : ""].filter(Boolean).join(" · ");
  const form = $("#profile-form");
  if (!form.contains(document.activeElement)) {   // don't overwrite what someone is typing
    form.innerHTML = PROFILE_FIELDS.map(([k, label, ph]) => `<label for="pf-${k}">${label}<input id="pf-${k}" name="${k}" value="${esc(cur[k] ?? "")}" placeholder="For example ${esc(ph)}" autocomplete="off"${k === "level" ? ' inputmode="numeric"' : ""}></label>`).join("");
  }
  renderRatio();
  renderAccount();
}

/* Earnings ÷ power and power ÷ earnings, from the numbers as typed ("11.21T", "1.035T", "750.1ab"). */
function renderRatio() {
  const cur = S.profile.current || {}, e = parseNum(cur.earnings), p = parseNum(cur.power);
  const box = $("#profile-ratio");
  if (!(isFinite(e) && isFinite(p) && e > 0 && p > 0)) {
    box.innerHTML = `<div class="card stat wide-stat"><span class="lbl">Earnings to power</span><span class="val">—</span><span class="sub">Type your earnings and power above to see how they compare.</span></div>`;
    return;
  }
  const r = e / p, E = esc(cur.earnings), P = esc(cur.power);
  box.innerHTML = `
    <div class="card stat"><span class="lbl"><span class="dot" style="color:var(--mint)"></span>Earnings per 1 power</span><span class="val">${esc(ratioText(r))}/s</span><span class="sub">${E}/s ÷ ${P}</span></div>
    <div class="card stat"><span class="lbl"><span class="dot" style="color:var(--pink)"></span>Power per 1 earnings</span><span class="val">${esc(ratioText(1 / r))}</span><span class="sub">${P} ÷ ${E}/s</span></div>
    <div class="card stat"><span class="lbl"><span class="dot" style="color:var(--gold)"></span>Ratio</span><span class="val">1 : ${esc(ratioText(r))}</span><span class="sub">power : earnings per second</span></div>`;
}
function ratioText(x) {
  if (!isFinite(x)) return "—";
  if (x >= 1000) return fmtNum(x);
  if (x >= 1) return String(+x.toFixed(2));
  return String(+x.toPrecision(3));
}

let profileTimer = null;
function profileInput() {
  clearTimeout(profileTimer);
  profileTimer = setTimeout(() => {
    const next = Object.assign({}, S.profile.current || {});
    $("#profile-form").querySelectorAll("input[name]").forEach(i => { const v = i.value.trim(); if (v) next[i.name] = v; else delete next[i.name]; });
    S.profile.current = next;
    save("profile");
  }, 500);
}

/* Profile picture: crop the middle square, shrink to AVATAR_PX, save as a small JPEG. */
async function setAvatar(file) {
  if (!file || !/^image\//.test(file.type)) { toast("Choose an image file."); return; }
  try {
    const bmp = await createImageBitmap(file);
    const side = Math.min(bmp.width, bmp.height);
    const c = document.createElement("canvas"); c.width = c.height = AVATAR_PX;
    const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
    if (bmp.close) bmp.close();
    S.profile.current = Object.assign({}, S.profile.current || {}, { avatar: c.toDataURL("image/jpeg", 0.85) });
    save("profile");
    toast("Profile picture updated.");
  } catch { toast("That image couldn't be opened. Try a PNG or JPG."); }
}
function removeAvatar() {
  const next = Object.assign({}, S.profile.current || {}); delete next.avatar;
  S.profile.current = next; save("profile"); toast("Profile picture removed.");
}
