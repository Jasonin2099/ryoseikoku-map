#!/usr/bin/env python3
"""Build data/map.json from Natural Earth 10m Admin-1 (public domain, v5.1.1).

The 47 prefecture keys (1–47), Japanese names, and 令制国 lists are copied
from the existing map so the app's coloring and click targets stay aligned.
Okinawa is drawn in a right-hand inset (the app then scales that path 1.5×).
Amami islands that Natural Earth attributes to Okinawa are moved back to
Kagoshima. Tokyo's Ogasawara / Marcus islands are dropped so they don't
explode the bounding box; the Izu chain is kept.
"""
from __future__ import annotations

import json
import math
import urllib.request
import zipfile
from pathlib import Path

import shapefile
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union
from shapely import affinity

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "natural-earth"
OUT = ROOT / "data" / "map.json"
LEGACY = ROOT / "data" / "map.json"

NE_URL = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip"
NE_VERSION = "5.1.1"
WIDTH, HEIGHT = 1100.0, 480.0
PAD = 16.0


def download_zip(dest: Path) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    zpath = dest / "ne_10m_admin_1_states_provinces.zip"
    if not zpath.exists() or zpath.stat().st_size < 1_000_000:
        print("downloading", NE_URL)
        req = urllib.request.Request(NE_URL, headers={"User-Agent": "ryoseikoku-map-build/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            zpath.write_bytes(r.read())
    shp_dir = dest / "ne10m"
    shp = shp_dir / "ne_10m_admin_1_states_provinces.shp"
    if not shp.exists():
        with zipfile.ZipFile(zpath) as z:
            z.extractall(shp_dir)
    return shp


def load_japan(shp: Path):
    sf = shapefile.Reader(str(shp))
    fields = [f[0] for f in sf.fields[1:]]
    raw = {}
    for sr in sf.iterShapeRecords():
        rec = dict(zip(fields, sr.record))
        if rec.get("admin") != "Japan":
            continue
        iso = rec["iso_3166_2"]
        geom = shape(sr.shape.__geo_interface__)
        raw[iso] = {
            "geom": geom,
            "ja": rec.get("name_ja") or rec.get("name"),
            "iso": iso,
        }
    if len(raw) != 47:
        raise SystemExit("expected 47 prefectures, got %s" % len(raw))
    return raw


def split_parts(geom):
    return list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]


def keep_tokyo_part(poly: Polygon) -> bool:
    c = poly.centroid
    return c.x < 141.2 and c.y >= 32.0


def reassign(raw):
    """Filter Tokyo remote islands; move Amami (misattributed to Okinawa) to Kagoshima."""
    out = {}
    amami = []
    for iso, info in raw.items():
        parts = split_parts(info["geom"])
        kept = []
        for p in parts:
            if p.is_empty or p.area <= 0:
                continue
            c = p.centroid
            if iso == "JP-13" and not keep_tokyo_part(p):
                continue
            # Amami / Tokara chain is Kagoshima, not Okinawa.
            if iso == "JP-47" and c.y >= 27.1:
                amami.append(p)
                continue
            kept.append(p)
        if not kept:
            raise SystemExit("no parts left for " + iso)
        out[iso] = dict(info, geom=unary_union(kept))
    if amami:
        out["JP-46"]["geom"] = unary_union([out["JP-46"]["geom"], *amami])
        print("reassigned", len(amami), "Amami/Tokara parts to Kagoshima")
    return out


def ring_to_path(coords, precision=1):
    pts = []
    prev = None
    for x, y in coords:
        xx = round(x, precision)
        yy = round(y, precision)
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
    if geom.is_empty:
        return ""
    parts = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    parts = sorted(parts, key=lambda p: p.area, reverse=True)
    chunks = []
    for p in parts:
        if p.area <= 0:
            continue
        ext = ring_to_path(list(p.exterior.coords))
        if ext:
            chunks.append(ext)
    return "".join(chunks)


def apply_xy(geom, fn):
    return transform(lambda x, y, z=None: fn(x, y), geom)


def simplify_all(prefs, tol):
    out = {}
    for iso, info in prefs.items():
        g = info["geom"].simplify(tol, preserve_topology=True)
        if g.is_empty:
            g = info["geom"]
        out[iso] = dict(info, geom=g)
    return out


def load_legacy():
    path = LEGACY
    old = json.loads(path.read_text())
    provs, ja = {}, {}
    for k, info in old.get("paths", {}).items():
        provs[k] = info.get("provs", [])
        ja[k] = info.get("ja")
    return old, provs, ja


def main_bounds(prefs):
    """Bounding box used to fit the main (non-inset) map.

    Southern island tails (Yakushima, Amami, far Izu) are still drawn, but
    they are left out of the *fit* so Hokkaido / Honshu stay at a readable size.
    """
    xs, ys = [], []
    for iso, info in prefs.items():
        if iso == "JP-47":
            continue
        for p in split_parts(info["geom"]):
            c = p.centroid
            if c.y < 30.8:  # Yakushima / Amami / Toshima tails
                continue
            minx, miny, maxx, maxy = p.bounds
            # clamp south for parts that straddle the cutoff
            miny = max(miny, 30.8)
            xs += [minx, maxx]
            ys += [miny, maxy]
    return min(xs), min(ys), max(xs), max(ys)


def build(prefs, sx, sy, lon0, lat1, x0, y0, inset, old_provs, old_ja, lat_cut, y_cut, sy_south):
    def proj(lon, lat):
        if lat >= lat_cut:
            y = y0 + (lat1 - lat) * sy
        else:
            y = y_cut + (lat_cut - lat) * sy_south
        return (x0 + (lon - lon0) * sx, y)

    ix, iy, iw, ih = inset
    oki = prefs["JP-47"]["geom"]
    ominx, ominy, omaxx, omaxy = oki.bounds
    mx, my = 8.0, 10.0
    # Fill the inset (independent X/Y) so the long Ryukyu chain stays readable.
    osx = (iw - 2 * mx) / max(omaxx - ominx, 1e-6)
    osy = (ih - 2 * my) / max(omaxy - ominy, 1e-6)

    def proj_oki(lon, lat):
        return (
            ix + mx + (lon - ominx) * osx,
            iy + my + (omaxy - lat) * osy,
        )

    paths = {}
    for iso, info in prefs.items():
        pid = str(int(iso.split("-")[1]))
        geom = apply_xy(info["geom"], proj_oki if iso == "JP-47" else proj)
        d = geom_to_path(geom)
        if not d:
            raise SystemExit("empty path for " + iso)
        paths[pid] = {
            "ja": old_ja.get(pid) or info["ja"],
            "d": d,
            "provs": old_provs.get(pid, []),
        }

    return {
        "width": WIDTH,
        "height": HEIGHT,
        "inset": {"x": ix, "y": iy, "w": iw, "h": ih},
        "source": {
            "name": "Natural Earth 10m Admin-1 States and Provinces",
            "version": NE_VERSION,
            "license": "public domain",
            "url": "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/",
            "terms": "https://www.naturalearthdata.com/about/terms-of-use/",
        },
        "paths": {str(i): paths[str(i)] for i in range(1, 48)},
    }


def main():
    shp = download_zip(CACHE)
    prefs = reassign(load_japan(shp))
    minx, miny, maxx, maxy = main_bounds(prefs)
    print("fit lon/lat", minx, miny, maxx, maxy)

    # Mild horizontal stretch (~1.35) keeps a familiar wide canvas without
    # flattening Hokkaido. Leave a right-hand bay for the Okinawa inset.
    dlon, dlat = maxx - minx, maxy - miny
    inset_w, inset_h = 250.0, 88.0
    gap = 24.0
    # Leave a band at the bottom for the compressed Satsunan tail.
    SOUTH_RESERVE = 62.0
    usable_h = HEIGHT - PAD - SOUTH_RESERVE
    sy = usable_h / dlat
    sx = sy * 1.35
    drawn_w = dlon * sx
    drawn_h = dlat * sy
    max_w = WIDTH - PAD - inset_w - gap
    if drawn_w > max_w:
        k = max_w / drawn_w
        sx *= k
        sy *= k
        drawn_w *= k
        drawn_h *= k
    x0 = PAD
    y0 = PAD
    lon0, lat1 = minx, maxy
    lat_cut = miny  # south edge of the fit box (~30.8N)
    y_cut = y0 + (lat1 - lat_cut) * sy
    lat_south = 27.05  # Amami / Yoron
    y_bottom = HEIGHT - 8.0
    sy_south = (y_bottom - y_cut) / (lat_cut - lat_south)
    print("south compress y_cut", round(y_cut,1), "sy_south", round(sy_south,2))

    # After the app's 1.5× scale, the frame must stay inside the viewBox:
    # ix + 1.25*inset_w + PAD <= WIDTH
    ix = WIDTH - PAD - inset_w * 1.25
    iy = 258.0
    inset = (ix, iy, inset_w, inset_h)
    print("scale sx,sy", sx, sy, "origin", x0, y0, "inset", inset)

    _, old_provs, old_ja = load_legacy()

    best = None
    for tol in (0.003, 0.004, 0.005, 0.006, 0.008, 0.01, 0.012):
        simp = simplify_all(prefs, tol)
        data = build(simp, sx, sy, lon0, lat1, x0, y0, inset, old_provs, old_ja, lat_cut, y_cut, sy_south)
        size = len(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
        print("  tol", tol, "bytes", size)
        score = abs(size - 73_000)
        if best is None or score < best[0]:
            best = (score, tol, data, size)
        if 60_000 <= size <= 90_000:
            # prefer first that lands in the window (less simplified = better)
            if size <= 85_000:
                best = (score, tol, data, size)
                break

    tol, data, size = best[1], best[2], best[3]
    print("chosen tol", tol, "size", size)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("saved", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
