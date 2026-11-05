"""Build data/game.json from the Isekai: Slow Life fan wiki (https://zik-ascend.github.io/isl-tools/).

Run:  python tools/build_game_data.py
It reads the wiki's manifest, then each fellow and family page, with a short pause between requests.
"""
import html
import json
import pathlib
import re
import sys
import time
import urllib.request

BASE = "https://zik-ascend.github.io/isl-tools/wiki/"
UA = "SlowLifeLedger-databuild (+https://github.com/Kiimberlyss/slow-life-ledger)"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "game.json"
PAUSE = 0.35


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def page_tokens(src):
    """Flatten a wiki page's main content into a list of text tokens."""
    src = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", src, flags=re.S)
    i = src.find("<main")
    if i >= 0:
        src = src[i:]
    text = re.sub(r"<[^>]+>", "\x00", src)
    return [html.unescape(t).strip() for t in text.split("\x00") if html.unescape(t).strip()]


def after(tokens, label):
    try:
        return tokens[tokens.index(label) + 1]
    except (ValueError, IndexError):
        return None


def rarity_path(tokens):
    """Rarity, plus any '->' upgrade steps that follow it."""
    try:
        i = tokens.index("Rarity")
    except ValueError:
        return []
    steps, j = [tokens[i + 1]], i + 2
    while j + 1 < len(tokens) and tokens[j] == "->":
        steps.append(tokens[j + 1])
        j += 2
    return steps


def fellow_skills(tokens):
    skills = []
    for i, t in enumerate(tokens):
        if t.startswith("Unlock:") and i + 3 < len(tokens) and tokens[i + 1].startswith("Base cap:"):
            name = tokens[i - 1]
            per = re.search(r"\+(\d+)", tokens[i + 2])
            cap = re.search(r"(\d+)", tokens[i + 1])
            code = tokens[i + 3] if re.match(r"^[A-Za-z0-9_]+$", tokens[i + 3]) else None
            skills.append({
                "id": code or name,
                "name": name,
                "unlock": t.replace("Unlock:", "").strip(),
                "cap": int(cap.group(1)) if cap else None,
                "per": int(per.group(1)) if per else None,
            })
    return skills


def blessed_list(tokens):
    for label in ("Blessed Fellows", "Blessed fellows"):
        if label in tokens:
            i = tokens.index(label) + 1
            out = []
            while i < len(tokens) and len(out) < 12 and tokens[i] not in ("Progression", "Stella Rewards", "Bond", "Skills"):
                if re.match(r"^[A-Z][\w .&'-]{1,30}$", tokens[i]):
                    out.append(tokens[i])
                i += 1
            return out
    return []


def clean_blesses(fellows, family):
    """Keep only real fellow names in each family member's blessed list (drops page footer text)."""
    names = {f["name"] for f in fellows}
    for m in family:
        m["blesses"] = [n for n in m.get("blesses", []) if n in names]


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    manifest = json.loads(get(BASE + "wiki_manifest.json"))
    fellows, family = [], []
    entries = [e for e in manifest["entries"] if e["category"] in ("fellows", "family")]
    for n, e in enumerate(entries, 1):
        try:
            tokens = page_tokens(get(BASE + e["url"]))
        except Exception as exc:  # keep going; the entry still gets its manifest fields
            print("  failed", e["url"], exc)
            tokens = []
        path = rarity_path(tokens) or [e.get("rarity")]
        common = {
            "id": e["internal_id"],
            "name": e["title"],
            "faction": after(tokens, "Type") or e.get("country_label"),
            "rarity": path[0],
            "path": path,
            "title": after(tokens, "Title"),
            "url": BASE + e["url"],
        }
        if e["category"] == "fellows":
            common["skills"] = fellow_skills(tokens)
            fellows.append(common)
        else:
            common["blesses"] = blessed_list(tokens)
            family.append(common)
        print(f"{n}/{len(entries)} {e['category']}: {e['title']}")
        time.sleep(PAUSE)
    clean_blesses(fellows, family)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source": "https://zik-ascend.github.io/isl-tools/",
        "wikiGeneratedAt": manifest.get("generated_at"),
        "builtAt": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
        "fellows": fellows,
        "family": family,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, len(fellows), "fellows", len(family), "family")


if __name__ == "__main__":
    main()
