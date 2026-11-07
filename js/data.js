"use strict";
/* ================= Game reference (fan wiki: zik-ascend.github.io/isl-tools, patch 8105) ================= */

const FACTION_CODES = { Dil: "Diligent", Ins: "Inspiring", Bra: "Brave", Inf: "Informed", Unf: "Unfettered" };
const FACTIONS = Object.values(FACTION_CODES);
const FACTION_VAR = { Diligent: "--f-dil", Inspiring: "--f-ins", Brave: "--f-bra", Informed: "--f-inf", Unfettered: "--f-unf" };
const RARITIES = ["N", "R", "SR", "SSR", "SSR+", "UR", "UR*", "LR"];
const RARITY_VAR = { "N": "--r-n", "R": "--r-r", "SR": "--r-sr", "SSR": "--r-ssr", "SSR+": "--r-ssrp", "UR": "--r-ur", "UR*": "--r-urs", "LR": "--r-lr" };

const norm = s => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
/* Fellow and family lists come from data/game.json, built from the fan wiki by tools/build_game_data.py */
let ROSTER = [], FAMILY_ROSTER = [];
const ROSTER_BY = new Map(), FAMILY_BY = new Map();
let gameInfo = null;
function useGameData(g) {
  gameInfo = g;
  const shape = e => {
    const path = (e.path && e.path.length ? e.path : [e.rarity]).map(canonRarity);
    return Object.assign({}, e, { faction: canonFaction(e.faction), rarity: path[0], maxRarity: path[path.length - 1], prog: path.join(" → ") });
  };
  ROSTER = (g.fellows || []).map(shape);
  FAMILY_ROSTER = (g.family || []).map(shape);
  ROSTER_BY.clear(); FAMILY_BY.clear();
  for (const r of ROSTER) if (!ROSTER_BY.has(norm(r.name))) ROSTER_BY.set(norm(r.name), r);
  for (const r of FAMILY_ROSTER) if (!FAMILY_BY.has(norm(r.name))) FAMILY_BY.set(norm(r.name), r);
}
function refFor(kind, item) {
  const list = kind === "fellows" ? ROSTER : FAMILY_ROSTER;
  if (item.ref) { const r = list.find(x => x.id === item.ref); if (r) return r; }
  return (kind === "fellows" ? ROSTER_BY : FAMILY_BY).get(norm(item.name)) || null;
}
function skillApt(item) {
  const ref = refFor("fellows", item); if (!ref || !ref.skills || !item.skills) return null;
  let sum = 0, any = false;
  for (const s of ref.skills) { const lv = parseNum(item.skills[s.id]); if (isFinite(lv) && s.per) { sum += lv * s.per; any = true; } }
  return any ? sum : null;
}
