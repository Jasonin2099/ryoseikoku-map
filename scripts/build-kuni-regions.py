#!/usr/bin/env python3
"""Build approximate 令制国 hit regions from the current prefecture map.

The visible map stays on modern prefecture boundaries (Natural Earth).
This script only splits those paths into tappable areas for each 令制国,
using island components where they are distinct, and Voronoi cells around
representative points where several countries share a prefecture.
These are NOT historical borders.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

from shapely.geometry import MultiPoint, MultiPolygon, Polygon, mapping
from shapely.ops import unary_union, voronoi_diagram

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / "data" / "map.json"
PROV = ROOT / "data" / "provinces.json"
OUT = ROOT / "data" / "kuni-regions.json"

# Relative sites inside each prefecture bbox (fx, fy); y grows south on the canvas.
# Used only when two or more 令制国 share the same mainland component.
SITES = {
    "27": {  # 大阪府
        "settsu": (0.45, 0.20),
        "kawachi": (0.80, 0.50),
        "izumi": (0.40, 0.82),
    },
    "26": {  # 京都府
        "tango": (0.40, 0.10),
        "tamba": (0.40, 0.42),
        "yamashiro": (0.62, 0.84),
    },
    "28": {  # 兵庫県 mainland (淡路 is split off)
        "tajima": (0.40, 0.12),
        "tamba": (0.85, 0.35),
        "settsu": (0.92, 0.55),
        "harima": (0.35, 0.68),
    },
    "32": {  # 島根県 mainland (隠岐 is split off)
        "izumo": (0.78, 0.32),
        "iwami": (0.25, 0.58),
    },
    "33": {  # 岡山県
        "mimasaka": (0.50, 0.18),
        "bitchu": (0.22, 0.65),
        "bizen": (0.78, 0.65),
    },
    "34": {  # 広島県
        "bingo": (0.80, 0.50),
        "aki": (0.28, 0.52),
    },
    "35": {  # 山口県
        "nagato": (0.20, 0.42),
        "suo": (0.72, 0.58),
    },
    "40": {  # 福岡県
        "buzen": (0.85, 0.32),
        "chikuzen": (0.42, 0.38),
        "chikugo": (0.45, 0.84),
    },
    "44": {  # 大分県
        "buzen": (0.40, 0.14),
        "bungo": (0.52, 0.62),
    },
    "23": {  # 愛知県
        "owari": (0.22, 0.48),
        "mikawa": (0.70, 0.52),
    },
    "22": {  # 静岡県
        "totomi": (0.16, 0.55),
        "suruga": (0.45, 0.42),
        "izu": (0.84, 0.62),
    },
    "12": {  # 千葉県
        "shimosa": (0.42, 0.18),
        "kazusa": (0.48, 0.55),
        "awa-boso": (0.48, 0.88),
    },
    "8": {  # 茨城県
        "hitachi": (0.55, 0.38),
        "shimosa": (0.30, 0.88),
    },
    "21": {  # 岐阜県
        "hida": (0.50, 0.18),
        "mino": (0.50, 0.72),
    },
    "18": {  # 福井県
        "echizen": (0.68, 0.38),
        "wakasa": (0.22, 0.72),
    },
    "17": {  # 石川県
        "noto": (0.58, 0.18),
        "kaga": (0.42, 0.78),
    },
    "31": {  # 鳥取県
        "inaba": (0.78, 0.50),
        "hoki": (0.26, 0.50),
    },
    "24": {  # 三重県
        "iga": (0.28, 0.12),
        "ise": (0.50, 0.38),
        "shima": (0.84, 0.42),
        "kii": (0.45, 0.86),
    },
    "46": {  # 鹿児島県 (Amami chain is attached to 大隅 for hit testing)
        "satsuma": (0.32, 0.42),
        "osumi": (0.75, 0.52),
    },
    "14": {  # 神奈川県
        "musashi": (0.86, 0.28),
        "sagami": (0.40, 0.58),
    },
}


def parse_path(d: str) -> list[Polygon]:
    tokens = re.findall(r"[MLZ]|-?\d+\.?\d*", d)
    polys = []
    i = 0
    ring: list[tuple[float, float]] = []
    while i < len(tokens):
        t = tokens[i]
        if t == "M":
            if len(ring) >= 3:
                p = Polygon(ring)
                if p.is_valid and p.area > 0:
                    polys.append(p)
                elif p.area > 0:
                    p = p.buffer(0)
                    if not p.is_empty:
                        if p.geom_type == "Polygon":
                            polys.append(p)
                        else:
                            polys.extend([g for g in p.geoms if g.area > 0])
            ring = [(float(tokens[i + 1]), float(tokens[i + 2]))]
            i += 3
        elif t == "L":
            ring.append((float(tokens[i + 1]), float(tokens[i + 2])))
            i += 3
        elif t == "Z":
            i += 1
        else:
            i += 1
    if len(ring) >= 3:
        p = Polygon(ring)
        if p.is_valid and p.area > 0:
            polys.append(p)
        elif p.area > 0:
            p = p.buffer(0)
            if not p.is_empty:
                if p.geom_type == "Polygon":
                    polys.append(p)
                else:
                    polys.extend([g for g in p.geoms if g.area > 0])
    return polys


def as_multi(geoms):
    geoms = [g for g in geoms if g is not None and not g.is_empty]
    if not geoms:
        return None
    u = unary_union(geoms)
    if u.is_empty:
        return None
    if u.geom_type == "Polygon":
        return MultiPolygon([u])
    if u.geom_type == "MultiPolygon":
        return u
    return unary_union([g for g in getattr(u, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")])


def ring_path(coords, precision=1):
    pts = []
    prev = None
    for x, y in coords:
        xx, yy = round(x, precision), round(y, precision)
        if prev == (xx, yy):
            continue
        pts.append((xx, yy))
        prev = (xx, yy)
    if len(pts) < 4:
        return ""
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    cmd = "M{:.1f},{:.1f}".format(pts[0][0], pts[0][1])
    for x, y in pts[1:]:
        cmd += "L{:.1f},{:.1f}".format(x, y)
    return cmd + "Z"


def geom_to_path(geom):
    if geom is None or geom.is_empty:
        return ""
    parts = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    parts = sorted(parts, key=lambda p: p.area, reverse=True)
    chunks = []
    for p in parts:
        if p.area <= 0:
            continue
        ext = ring_path(list(p.exterior.coords))
        if ext:
            chunks.append(ext)
    return "".join(chunks)


def classify_component(pref_id: str, poly: Polygon) -> str | None:
    """Return a kuni id when a whole component belongs to one island/country."""
    minx, miny, maxx, maxy = poly.bounds
    cx, cy = poly.centroid.x, poly.centroid.y
    if pref_id == "42":  # 長崎
        if cy < 655:
            return "tsushima"
        if cy < 682 and cx >= 66:
            return "iki"
        return None  # 肥前
    if pref_id == "32":  # 島根
        if cy < 565:
            return "oki"
        return None
    if pref_id == "15":  # 新潟
        if 460 <= cx <= 495 and 415 <= cy <= 465 and poly.area < 2000:
            return "sado"
        return None
    if pref_id == "28":  # 兵庫
        if miny >= 630 or cy >= 636:
            return "awaji"
        return None
    if pref_id == "13":  # 東京
        if cy >= 600:
            return "izu"
        return None
    return None


def split_voronoi(poly, sites: dict[str, tuple[float, float]]):
    minx, miny, maxx, maxy = poly.bounds
    w, h = maxx - minx, maxy - miny
    pts = {}
    for kid, (fx, fy) in sites.items():
        x, y = minx + fx * w, miny + fy * h
        p = poly.representative_point() if not poly.contains(__import__("shapely").geometry.Point(x, y)) else None
        pt = __import__("shapely").geometry.Point(x, y)
        if not poly.contains(pt):
            # pull inside along a short buffer
            pt = poly.intersection(pt.buffer(max(w, h))).representative_point() if poly.intersects(pt.buffer(max(w, h))) else poly.representative_point()
            # Still try to keep the intended direction: pick nearest point in poly
            pt = __import__("shapely").ops.nearest_points(poly, __import__("shapely").geometry.Point(x, y))[0]
        pts[kid] = pt
    if len(pts) == 1:
        return {list(pts)[0]: poly}
    mp = MultiPoint(list(pts.values()))
    env = poly.envelope.buffer(max(w, h) * 0.6)
    vd = voronoi_diagram(mp, envelope=env)
    cells = {}
    for kid, pt in pts.items():
        found = None
        for cell in vd.geoms:
            if cell.contains(pt) or cell.intersects(pt):
                found = cell
                break
        if found is None:
            found = min(vd.geoms, key=lambda c: c.distance(pt))
        piece = found.intersection(poly)
        if not piece.is_empty:
            cells[kid] = piece
    # Any leftover of the pref (gaps) goes to the nearest site
    covered = unary_union(list(cells.values())) if cells else None
    if covered is not None:
        leftover = poly.difference(covered)
        if not leftover.is_empty and leftover.area > 1e-3:
            for part in split_parts(leftover):
                nearest = min(pts.items(), key=lambda kv: kv[1].distance(part.representative_point()))[0]
                cells[nearest] = unary_union([cells[nearest], part]) if nearest in cells else part
    return cells


def split_parts(geom):
    if geom is None or geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom]
    if geom.geom_type == "MultiPolygon":
        return list(geom.geoms)
    return [g for g in getattr(geom, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")]


def geom_info(geom):
    minx, miny, maxx, maxy = geom.bounds
    c = geom.representative_point()
    # Prefer a point near the visual center of the largest piece for labels
    parts = split_parts(geom)
    main = max(parts, key=lambda p: p.area) if parts else geom
    c = main.representative_point()
    return {
        "d": geom_to_path(geom),
        "cx": round(c.x, 1),
        "cy": round(c.y, 1),
        "bbox": [round(minx, 1), round(miny, 1), round(maxx - minx, 1), round(maxy - miny, 1)],
        "area": round(geom.area, 1),
    }


def main():
    from shapely.geometry import Point
    from shapely.ops import nearest_points

    # rebind split_voronoi helpers already imported at top... used inside via local

    m = json.loads(MAP.read_text())
    p = json.loads(PROV.read_text())
    pref_of = {}
    for pref_id, info in m["paths"].items():
        pref_of[pref_id] = {
            "ja": info["ja"],
            "provs": list(info.get("provs") or []),
            "polys": parse_path(info["d"]),
        }

    pieces: dict[str, list] = defaultdict(list)
    outside = {}

    for pref_id, rec in pref_of.items():
        polys = rec["polys"]
        if not polys:
            raise SystemExit("no polygons for pref " + pref_id)
        if pref_id == "1":
            outside["hokkaido"] = as_multi(polys)
            continue
        if pref_id == "47":
            outside["ryukyu"] = as_multi(polys)
            continue

        leftover = []
        for poly in polys:
            assigned = classify_component(pref_id, poly)
            if assigned:
                pieces[assigned].append(poly)
            else:
                leftover.append(poly)
        if not leftover:
            continue
        land = as_multi(leftover)
        land_ids = [k for k in rec["provs"] if k not in ("tsushima", "iki", "oki", "sado", "awaji") or pref_id not in ("42", "32", "15", "28")]
        # For Tokyo, izu already taken from island components; land is musashi only
        # For Nagasaki, leftover land is hizen; Iki/Tsushima already classified
        # For Hyogo, leftover is tajima/tamba/settsu/harima (awaji classified)
        # Don't include island-only kuni in land_ids if they were classified
        island_taken = set()
        for k, lst in pieces.items():
            # only consider this pref's island assignment: we can't easily know.
            pass
        # Filter land_ids to kuni that should be on this leftover land
        if pref_id == "42":
            land_ids = ["hizen"]
        elif pref_id == "32":
            land_ids = ["izumo", "iwami"]
        elif pref_id == "15":
            land_ids = ["echigo"]
        elif pref_id == "28":
            land_ids = ["tajima", "tamba", "settsu", "harima"]
        elif pref_id == "13":
            land_ids = ["musashi"]
        else:
            land_ids = list(rec["provs"])
            # 伊豆 islands already taken from Tokyo; Izu still has Shizuoka land

        if len(land_ids) == 1:
            pieces[land_ids[0]].append(land)
            continue

        sites = SITES.get(pref_id)
        if not sites:
            raise SystemExit("need sites for pref %s (%s) kuni %s" % (pref_id, rec["ja"], land_ids))
        use = {k: sites[k] for k in land_ids if k in sites}
        missing = [k for k in land_ids if k not in use]
        if missing:
            raise SystemExit("missing sites in pref %s: %s" % (pref_id, missing))
        # run voronoi per leftover polygon then union
        for poly in leftover:
            cells = split_voronoi_safe(poly, use)
            for kid, g in cells.items():
                pieces[kid].append(g)

    # Every 令制国 must have geometry
    missing = [pr["id"] for pr in p["provinces"] if not pieces.get(pr["id"])]
    if missing:
        raise SystemExit("no geometry for: " + ", ".join(missing))

    kuni = {}
    for pr in p["provinces"]:
        g = as_multi(pieces[pr["id"]])
        if g is None:
            raise SystemExit("empty union for " + pr["id"])
        info = geom_info(g)
        info["id"] = pr["id"]
        info["ja"] = pr["ja"]
        info["dao"] = pr["dao"]
        kuni[pr["id"]] = info

    out_info = {}
    for key, g in outside.items():
        info = geom_info(g)
        info["id"] = key
        info["ja"] = "北海道" if key == "hokkaido" else "琉球"
        out_info[key] = info

    data = {
        "note": "Approximate tappable areas split from modern prefecture boundaries; not historical borders.",
        "kuni": kuni,
        "outside": out_info,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("wrote", OUT, "kuni", len(kuni), "outside", list(out_info), "bytes", OUT.stat().st_size)

    # preview
    try:
        render_preview(m, kuni, out_info, p)
    except Exception as e:
        print("preview skipped:", e)


def split_voronoi_safe(poly, sites):
    from shapely.geometry import Point
    from shapely.ops import nearest_points

    minx, miny, maxx, maxy = poly.bounds
    w, h = max(maxx - minx, 1e-6), max(maxy - miny, 1e-6)
    pts = {}
    for kid, (fx, fy) in sites.items():
        raw = Point(minx + fx * w, miny + fy * h)
        if poly.contains(raw) or poly.touches(raw):
            pts[kid] = raw
        else:
            pts[kid] = nearest_points(poly, raw)[0]
    if len(pts) == 1:
        return {list(pts)[0]: poly}
    mp = MultiPoint(list(pts.values()))
    env = poly.envelope.buffer(max(w, h) * 0.8)
    vd = voronoi_diagram(mp, envelope=env)
    cells = {}
    for kid, pt in pts.items():
        found = None
        for cell in vd.geoms:
            if cell.intersects(pt):
                found = cell
                break
        if found is None:
            found = min(vd.geoms, key=lambda c: c.distance(pt))
        piece = found.intersection(poly)
        if not piece.is_empty:
            cells[kid] = piece
    covered = unary_union(list(cells.values())) if cells else None
    if covered is not None:
        leftover = poly.difference(covered)
        if not leftover.is_empty and leftover.area > 1e-3:
            for part in split_parts(leftover):
                nearest = min(pts.items(), key=lambda kv: kv[1].distance(part.representative_point()))[0]
                cells[nearest] = unary_union([cells.get(nearest, part), part])
    return cells


def render_preview(m, kuni, outside, prov):
    # Simple SVG preview
    dao_color = {
        "kinai": "#a87d24",
        "tokaido": "#b86a32",
        "tosando": "#82763a",
        "hokurikudo": "#5a6e64",
        "sanindo": "#546774",
        "sanyodo": "#a86e42",
        "nankaido": "#94763a",
        "saikaido": "#a6563e",
    }
    W, H = m["width"], m["height"]
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="1100" height="909">',
        '<rect width="100%" height="100%" fill="#f3eadc"/>',
    ]
    for kid, info in kuni.items():
        fill = dao_color.get(info["dao"], "#888")
        parts.append(f'<path d="{info["d"]}" fill="{fill}" fill-opacity="0.85" stroke="#efe6d6" stroke-width="0.6"/>')
    for info in outside.values():
        parts.append(f'<path d="{info["d"]}" fill="#8d8276" fill-opacity="0.7" stroke="#efe6d6" stroke-width="0.6"/>')
    for kid, info in kuni.items():
        parts.append(
            f'<text x="{info["cx"]}" y="{info["cy"]}" text-anchor="middle" font-size="7" fill="#2a2218">{info["ja"]}</text>'
        )
    parts.append("</svg>")
    svg = "\n".join(parts)
    out = Path("/workspace/kuni-shots/kuni-regions-preview.svg")
    out.write_text(svg)
    print("preview", out)


if __name__ == "__main__":
    main()
