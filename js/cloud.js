"use strict";
/* ================= Google sign-in & cloud saving ================= */
// Web API keys are public by design; access is controlled by firestore.rules (each user reads/writes only ledgers/<their uid>).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCS80aOSaOvk1Q3SRcQWKxdpdx3tpTZmGg",
  authDomain: "slow-life-ledger.firebaseapp.com",
  projectId: "slow-life-ledger",
  storageBucket: "slow-life-ledger.firebasestorage.app",
  messagingSenderId: "194724854502",
  appId: "1:194724854502:web:43bcfa9929991cf19f5927",
};
const SYNC_KEY = "slow-life-ledger:sync";
let fbReady = false, cloudUser = null, cloudDoc = null, cloudTimer = null, cloudState = "off", applyingRemote = false, lastWriteAt = null, unsubCloud = null;
const G_ICON = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
function hasData(d) { return !!(d && (d.fellows.items.length || d.family.items.length || d.events.items.length || (d.profile.history || []).length || Object.keys(d.profile.current || {}).length)); }
function syncInfo() { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || "{}"); } catch { return {}; } }
function setSyncInfo(o) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(o)); } catch { /* storage blocked */ } }
function summary(d) { return `${d.fellows.items.length} fellows, ${d.family.items.length} family members, ${d.events.items.length} events`; }

function initCloud() {
  if (!window.firebase || !firebase.initializeApp) { renderAccount(); return; }
  try { firebase.initializeApp(FIREBASE_CONFIG); fbReady = true; } catch { fbReady = false; renderAccount(); return; }
  firebase.auth().onAuthStateChanged(onAuth);
  firebase.auth().getRedirectResult().catch(authError);
  renderAccount();
}
async function onAuth(user) {
  if (unsubCloud) { unsubCloud(); unsubCloud = null; }
  cloudUser = user; cloudDoc = null;
  rerouteForAccount();   // editors see drafts and edit buttons
  if (!user) { cloudState = "off"; renderAccount(); return; }
  cloudDoc = firebase.firestore().collection("ledgers").doc(user.uid);
  cloudState = "loading"; renderAccount();
  try {
    const snap = await cloudDoc.get();
    const info = syncInfo();
    if (!snap.exists) {
      await pushCloud();
      if (hasData(S)) toast("Signed in. Your ledger is now saved to your Google account.");
    } else {
      const remote = shapeAll(snap.data()), remoteAt = snap.data().savedAt || "";
      const same = info.uid === user.uid;
      if (!hasData(S) || (same && !info.dirty)) applyRemote(remote, remoteAt);
      else if (same && info.dirty && (!remoteAt || remoteAt <= (info.syncedAt || ""))) await pushCloud();
      else askWhichData(remote, remoteAt);
    }
    listenCloud();
  } catch (e) {
    cloudState = "error"; renderAccount();
    toast("Couldn't reach your saved ledger. Your changes are still kept in this browser.");
  }
}
function applyRemote(remote, remoteAt) {
  applyingRemote = true;
  S = remote;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch { /* storage blocked */ }
  setSyncInfo({ uid: cloudUser.uid, syncedAt: remoteAt, dirty: false });
  renderAll();
  applyingRemote = false;
  cloudState = "saved"; renderAccount();
}
async function pushCloud() {
  if (!cloudDoc) return;
  cloudState = "saving"; renderAccount();
  const savedAt = new Date().toISOString();
  lastWriteAt = savedAt;
  const body = clone({ profile: S.profile, fellows: S.fellows, family: S.family, events: S.events });
  await cloudDoc.set(Object.assign(body, { savedAt, version: 1 }));
  setSyncInfo({ uid: cloudUser.uid, syncedAt: savedAt, dirty: false });
  cloudState = "saved"; renderAccount();
}
function cloudQueue() {
  if (applyingRemote || !cloudUser) return;
  setSyncInfo(Object.assign(syncInfo(), { uid: cloudUser.uid, dirty: true }));
  if (!cloudDoc || cloudState === "choose" || cloudState === "loading") return;
  cloudState = "pending"; renderAccount();
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => pushCloud().catch(() => { cloudState = "error"; renderAccount(); }), 1200);
}
function listenCloud() {
  if (!cloudDoc) return;
  unsubCloud = cloudDoc.onSnapshot(snap => {
    if (!snap.exists || snap.metadata.hasPendingWrites) return;
    const at = snap.data().savedAt || "";
    const info = syncInfo();
    if (at === lastWriteAt || at <= (info.syncedAt || "") || info.dirty || cloudState === "choose") return;
    applyRemote(shapeAll(snap.data()), at);
    toast("Updated with changes from your other device.");
  }, () => { cloudState = "error"; renderAccount(); });
}
function askWhichData(remote, remoteAt) {
  cloudState = "choose"; renderAccount();
  openSheet(sheetHead("Which ledger should we keep?") + `<div class="sheet-body">
    <p style="margin:0">This browser and your Google account both have saved data, and they're different.</p>
    <div class="grid-3">
      <div class="card stat"><span class="lbl">Saved in your Google account</span><span class="sub">${esc(summary(remote))}</span><span class="sub">Last saved ${esc(fmtDate(remoteAt) || "earlier")}</span></div>
      <div class="card stat"><span class="lbl">Saved in this browser</span><span class="sub">${esc(summary(S))}</span></div>
    </div>
    <p class="muted small" style="margin:0">The one you don't pick is replaced. If you're unsure, use Back up first to download this browser's data.</p></div>
    <div class="sheet-foot"><button class="btn" type="button" id="keep-local">Keep this browser's data</button><button class="btn hot" type="button" id="keep-remote">Use my Google account's data</button></div>`);
  $("#keep-remote").onclick = () => { closeSheet(); applyRemote(remote, remoteAt); toast("Loaded your ledger from your Google account."); };
  $("#keep-local").onclick = () => { closeSheet(); pushCloud().then(() => toast("Saved this browser's ledger to your Google account.")).catch(() => { cloudState = "error"; renderAccount(); }); };
}
async function signIn() {
  if (!fbReady) { toast("Google sign-in couldn't load. Check your connection and reload the page."); return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  try { await firebase.auth().signInWithPopup(provider); }
  catch (e) {
    if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return firebase.auth().signInWithRedirect(provider);
    authError(e);
  }
}
function authError(e) {
  if (!e) return;
  const c = e.code || "";
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return;
  toast(c === "auth/unauthorized-domain" || c === "auth/operation-not-allowed" ? "Google sign-in isn't switched on for this site yet." : c === "auth/network-request-failed" ? "Couldn't reach Google. Check your connection and try again." : "Sign-in didn't work. Please try again.");
}
const STATE_TEXT = { loading: "Loading…", saving: "Saving…", pending: "Saving…", saved: "Saved", choose: "Choose data", error: "Not synced" };
function renderAccount() {
  const b = $("#account-btn"); if (!b) return;
  b.hidden = !fbReady;
  if (!cloudUser) { b.innerHTML = `${G_ICON}<span>Sign in with Google</span>`; b.dataset.state = "off"; return; }
  const name = cloudUser.displayName || cloudUser.email || "Signed in";
  const mine = (S.profile.current || {}).avatar;
  const pic = mine ? `<img src="${esc(mine)}" alt="">` : cloudUser.photoURL ? `<img src="${esc(cloudUser.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="acct-initial">${esc(initials(name))}</span>`;
  b.innerHTML = `${pic}<span class="acct-state">${STATE_TEXT[cloudState] || ""}</span>`;
  b.dataset.state = cloudState;
  b.setAttribute("aria-label", `Account: ${name}. ${STATE_TEXT[cloudState] || ""}`);
}
function openAccount() {
  if (!cloudUser) return signIn();
  const name = cloudUser.displayName || "Your account";
  openSheet(sheetHead("Your account") + `<div class="sheet-body">
    <p style="margin:0">Signed in as <b>${esc(name)}</b>${cloudUser.email ? ` (${esc(cloudUser.email)})` : ""}.</p>
    <p class="muted" style="margin:0">Your ledger saves to your Google account automatically. Sign in with the same account on another phone or computer to see it there.</p>
    <p style="margin:0"><b>Status:</b> ${esc(cloudState === "error" ? "Not synced right now. Your changes are kept in this browser and will save when the connection is back." : cloudState === "choose" ? "Waiting for you to choose which data to keep." : STATE_TEXT[cloudState] || "")}</p>
    <label class="check"><input type="checkbox" id="so-clear">When I sign out, also remove my ledger from this browser (useful on a shared device)</label></div>
    <div class="sheet-foot"><button class="btn" type="button" data-close>Close</button><button class="btn" type="button" id="do-signout">Sign out</button></div>`);
  $("#do-signout").onclick = async () => {
    const clear = $("#so-clear").checked;
    clearTimeout(cloudTimer);
    if (cloudState === "pending") { try { await pushCloud(); } catch { /* kept locally */ } }
    await firebase.auth().signOut();
    setSyncInfo({});
    if (clear) { S = EMPTY(); try { localStorage.removeItem(STORE_KEY); } catch { /* storage blocked */ } renderAll(); }
    closeSheet(); toast("Signed out.");
  };
}
