"""Build content/stamina.json from the community stamina spreadsheet.

Run:  python tools/build_stamina.py
It downloads the sheet as .xlsx (it must stay shared as "anyone with the link can view"), then turns each
event tab into notes and tables the site shows on its Stamina page. Run it again whenever the sheet changes.

Each tab has the same rough layout: milestone tables down the left (columns A to D) and notes, pack costs and
"Ways to get 1 UR" plans down the right. The script splits each side into blocks at blank rows and titles,
and works out a header row for each block.
"""
import io
import json
import pathlib
import re
import sys
import time
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

SHEET_ID = "1Yc0zwTUAS1y9-Rguju0jEd2Aex5s0Z6KYbM_IcerEOE"
SHEET_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit"
OUT = pathlib.Path(__file__).resolve().parent.parent / "content" / "stamina.json"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
LEFT_COLS = 4   # milestone tables live in columns A-D


# ---------- reading the .xlsx (standard library only) ----------
def col_index(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_xlsx(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    sheets = []
    for sh in wb.find("m:sheets", NS):
        path = rels[sh.get("{%s}id" % NS["r"])].lstrip("/")
        path = path if path.startswith("xl/") else "xl/" + path
        rows = []
        for row in ET.fromstring(z.read(path)).iter("{%s}row" % NS["m"]):
            r = int(row.get("r")) - 1
            while len(rows) < r:
                rows.append([])
            cells = {}
            for c in row.findall("m:c", NS):
                v, t = c.find("m:v", NS), c.get("t")
                if t == "s" and v is not None:
                    val = shared[int(v.text)]
                elif t == "inlineStr":
                    val = "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
                else:
                    val = v.text if v is not None else ""
                cells[col_index(c.get("r"))] = (val or "").strip()
            rows.append([cells.get(i, "") for i in range(max(cells) + 1)] if cells else [])
        sheets.append((sh.get("name"), rows))
    return sheets


# ---------- tidying values ----------
def tidy(v):
    """'125.0' -> 125, '94.4' -> 94.4, text stays text."""
    s = str(v).strip()
    if re.fullmatch(r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", s):
        f = float(s)
        return int(f) if f == int(f) else round(f, 2)
    return re.sub(r"\s+", " ", s)


def is_num(v):
    return isinstance(v, (int, float))


# ---------- splitting a side of the tab into blocks ----------
WAY_RE = re.compile(r"^way\s*\d+", re.I)
TITLE_RE = re.compile(r"^(milestones|way\s*\d+|gems stamina|free stamina|free points|calculator)", re.I)


def side_rows(rows, lo, hi):
    out = []
    for r in rows:
        cells = [tidy(c) for c in r[lo:hi]] if hi else [tidy(c) for c in r[lo:]]
        while cells and cells[-1] == "":
            cells.pop()
        out.append(cells)
    return out


def blocks_of(rows):
    blocks, cur = [], []
    for r in rows:
        if not any(c != "" for c in r):
            if cur:
                blocks.append(cur)
            cur = []
            continue
        first = next((c for c in r if c != ""), "")
        if cur and isinstance(first, str) and TITLE_RE.match(first) and r.index(first) == next(i for i, c in enumerate(r) if c != ""):
            blocks.append(cur)
            cur = []
        cur.append(r)
    if cur:
        blocks.append(cur)
    return blocks


def looks_header(r, nxt):
    filled = [c for c in r if c != ""]
    if len(filled) < 2 or any(is_num(c) for c in filled[1:]):
        return False
    # column names are all different ("run 1", "run 2"); a row like "Packs bought | S AP | S AP" is data
    if len(set(map(str, filled[1:]))) != len(filled[1:]):
        return False
    return nxt is not None and any(is_num(c) for c in nxt)


def to_tables(block):
    """One block -> a title, notes, and one or more tables."""
    title, subtitle, notes, tables = "", "", [], []
    rows = [r for r in block]
    first = [c for c in rows[0] if c != ""]
    if first and isinstance(first[0], str) and (TITLE_RE.match(first[0]) or (len(first) <= 2 and not any(is_num(c) for c in first) and len(rows) > 1)):
        title = first[0]
        subtitle = " · ".join(str(c) for c in first[1:])
        rows = rows[1:]
        # "7 runs" style line under a Way title
        if rows and WAY_RE.match(title):
            f2 = [c for c in rows[0] if c != ""]
            if f2 and isinstance(f2[0], str) and re.match(r"^\d+\s*runs?$", f2[0], re.I):
                subtitle = (f2[0] + (" · " + subtitle if subtitle else "") + ("" if len(f2) == 1 else " · " + " · ".join(str(c) for c in f2[1:]))).strip(" ·")
                rows = rows[1:]
    cur = None
    for i, r in enumerate(rows):
        filled = [c for c in r if c != ""]
        nxt = rows[i + 1] if i + 1 < len(rows) else None
        if len(filled) == 1 and isinstance(filled[0], str) and (cur is None or len(filled[0]) > 40):
            notes.append(filled[0])
            continue
        if looks_header(r, nxt) or cur is None:
            cur = {"header": [str(c) for c in r] if looks_header(r, nxt) else [], "rows": []}
            tables.append(cur)
            if cur["header"]:
                continue
        cur["rows"].append(r)
    # square up each table and drop empty columns
    for t in tables:
        width = max([len(t["header"])] + [len(r) for r in t["rows"]] or [0])
        t["header"] = (t["header"] + [""] * width)[:width]
        t["rows"] = [(r + [""] * width)[:width] for r in t["rows"]]
        keep = [j for j in range(width) if t["header"][j] != "" or any(r[j] != "" for r in t["rows"])]
        t["header"] = [t["header"][j] for j in keep]
        t["rows"] = [[r[j] for j in keep] for r in t["rows"]]
        if not any(t["header"]):
            t["header"] = []
    tables = [t for t in tables if t["rows"]]
    return {"title": title, "subtitle": subtitle, "notes": notes, "tables": tables}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def build_event(name, rows):
    if not any(rows):
        return None
    # notes in the first rows that run across the top (e.g. Casino's floor bonus)
    intro = []
    head = rows[0] if rows else []
    for c in head[1:]:
        if isinstance(c, str) and len(c) > 40:
            intro.append(c.strip())
    if len(rows) > 1:
        for c in rows[1]:
            if isinstance(c, str) and len(c) > 40 and not any(c.strip() == x for x in intro):
                intro.append(c.strip())
    body = rows[1:]
    if intro:
        body = [r if not any(isinstance(c, str) and c.strip() in intro for c in r) else [] for r in body]
    keep = lambda b: b["tables"] or b["notes"] or b["subtitle"]
    left = [b for b in (to_tables(x) for x in blocks_of(side_rows(body, 0, LEFT_COLS))) if keep(b)]
    right = [b for b in (to_tables(x) for x in blocks_of(side_rows(body, LEFT_COLS, None))) if keep(b)]
    for b in right:   # the "Ways to get 1 ur" label becomes the page's own heading for the plans
        b["notes"] = [n for n in b["notes"] if not re.match(r"^ways? to get", str(n), re.I)]
    right = [b for b in right if keep(b)]
    # "Milestones without free stamina" has no column names of its own: reuse the first table's
    first_head = next((t["header"] for b in left for t in b["tables"] if t["header"]), [])
    for b in left:
        for t in b["tables"]:
            if not t["header"] and first_head and len(t["rows"][0]) <= len(first_head):
                t["header"] = first_head[:len(t["rows"][0])]
    # left-side blocks are milestone tables; a title-only block ("Milestones") names the table after it
    def merge_titles(bs):
        out = []
        for b in bs:
            if out and not out[-1]["tables"] and not out[-1]["notes"]:
                b["title"] = b["title"] or out.pop()["title"]
            out.append(b)
        return out
    return {
        "id": slug(name), "name": name, "notes": intro,
        "milestones": merge_titles(left),
        "plans": [b for b in right if WAY_RE.match(b["title"] or "")],
        "info": [b for b in right if not WAY_RE.match(b["title"] or "")],
    }


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    req = urllib.request.Request(f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx",
                                 headers={"User-Agent": "SlowLifeLedger-databuild"})
    data = urllib.request.urlopen(req, timeout=60).read()
    sheets = read_xlsx(data)
    intro = []
    events = []
    for name, rows in sheets:
        if name.strip().lower() == "intro":
            for r in rows:
                for c in r:
                    if len(c) > 30:
                        intro.append(c.strip())
            continue
        ev = build_event(name, [[tidy(c) for c in r] for r in rows])
        if ev:
            events.append(ev)
            print(f"{name}: {len(ev['milestones'])} milestone tables, {len(ev['info'])} info blocks, {len(ev['plans'])} plans")
        else:
            print(f"{name}: empty, skipped")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source": SHEET_URL,
        "builtAt": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
        "intro": intro,
        "events": events,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
