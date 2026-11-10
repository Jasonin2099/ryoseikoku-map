#!/usr/bin/env python3
"""Build data/map.json from Natural Earth 10m Admin-1 (public domain, v5.1.1).

The 47 prefecture keys (1–47), Japanese names, and 令制国 lists are copied
from the existing map so the app's coloring and click targets stay aligned.
Okinawa is drawn in a right-hand inset (the app then scales that path 1.5×).
Amami islands that Natural Earth attributes to Okinawa are moved back to
Kagoshima. Tokyo's Ogasawara / Marcus islands are dropped so they don't
explode the bounding box; the Izu chain is kept.
Coordinates are projected with a Lambert conformal conic
(central meridian 137°E, standard parallels 33°N / 44°N) so
Honshu keeps familiar proportions instead of looking squashed.
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


def lcc_setup(lon0=137.0, lat1=33.0, lat2=44.0, lat0=38.0, R=1.0):
    """Lambert conformal conic; x east, y north, in the same units as R."""
    phi0, phi1, phi2, lam0 = (math.radians(v) for v in (lat0, lat1, lat2, lon0))

    def t(phi):
        return math.tan(math.pi / 4 + phi / 2)

    n = math.log(math.cos(phi1) / math.cos(phi2)) / math.log(t(phi2) / t(phi1))
    F = math.cos(phi1) * (t(phi1) ** n) / n
    rho0 = R * F / (t(phi0) ** n)

    def proj(lon, lat):
        phi = math.radians(lat)
        lam = math.radians(lon)
        rho = R * F / (t(phi) ** n)
        x = rho * math.sin(n * (lam - lam0))
        y = rho0 - rho * math.cos(n * (lam - lam0))
        return x, y

    return proj


PROJ = lcc_setup()
# Local cone for the Ryukyu inset so the chain keeps its proportions.
PROJ_OKI = lcc_setup(lon0=127.8, lat1=24.5, lat2=26.8, lat0=26.0)


def main_parts(prefs):
    """Prefecture parts used to fit the main map (no Okinawa, no far-south tails)."""
    out = []
    for iso, info in prefs.items():
        if iso == "JP-47":
            continue
        for p in split_parts(info["geom"]):
            if p.centroid.y < 30.8:
                continue
            out.append(p)
    return out


def projected_bounds(geoms, proj):
    xs, ys = [], []
    for g in geoms:
        pg = apply_xy(g, proj)
        minx, miny, maxx, maxy = pg.bounds
        xs += [minx, maxx]
        ys += [miny, maxy]
    return min(xs), min(ys), max(xs), max(ys)


def build(prefs, scale, x0, y0, minx, maxy, y_cut_proj, y_cut_canvas, scale_south,
          inset, old_provs, old_ja, south_dx=0.0):
    def proj_main(lon, lat):
        X, Y = PROJ(lon, lat)
        x = x0 + (X - minx) * scale
        if Y >= y_cut_proj:
            y = y0 + (maxy - Y) * scale
        else:
            y = y_cut_canvas + (y_cut_proj - Y) * scale_south
            x += south_dx
        return (x, y)

    ix, iy, iw, ih = inset
    oki = prefs["JP-47"]["geom"]
    oki_p = apply_xy(oki, PROJ_OKI)
    ominx, ominy, omaxx, omaxy = oki_p.bounds
    mx, my = 10.0, 14.0
    os = min(
        (iw - 2 * mx) / max(omaxx - ominx, 1e-6),
        (ih - 2 * my) / max(omaxy - ominy, 1e-6),
    )
    ox = ix + (iw - (omaxx - ominx) * os) / 2
    oy = iy + (ih - (omaxy - ominy) * os) / 2

    def proj_oki(lon, lat):
        X, Y = PROJ_OKI(lon, lat)
        return (ox + (X - ominx) * os, oy + (omaxy - Y) * os)

    paths = {}
    for iso, info in prefs.items():
        pid = str(int(iso.split("-")[1]))
        geom = apply_xy(info["geom"], proj_oki if iso == "JP-47" else proj_main)
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
            "projection": "Lambert conformal conic, lon0=137E, std parallels 33N/44N",
        },
        "paths": {str(i): paths[str(i)] for i in range(1, 48)},
    }


def main():
    global WIDTH, HEIGHT
    shp = download_zip(CACHE)
    prefs = reassign(load_japan(shp))
    fit = main_parts(prefs)
    minx, miny, maxx, maxy = projected_bounds(fit, PROJ)
    print("fit projected", minx, miny, maxx, maxy)

    WIDTH = 1100.0
    inset_w, inset_h = 300.0, 155.0
    gap = 20.0
    SOUTH_RESERVE = 72.0
    # After the app's 1.5× scale, the frame must stay inside the viewBox:
    # scaled right edge = ix + 1.25*inset_w <= WIDTH - PAD
    ix = WIDTH - PAD - inset_w * 1.25
    # Fit the main islands to a ~760px column so the canvas stays around
    # 1100×900. The inset may sit farther left in the lower-right ocean
    # (it does not overlap Hokkaido in Y).
    usable_w = WIDTH - PAD - 230.0 * 1.25 - gap - PAD
    scale = usable_w / (maxx - minx)
    drawn_h = (maxy - miny) * scale
    HEIGHT = PAD + drawn_h + SOUTH_RESERVE
    # Round to a stable canvas size
    HEIGHT = float(int(round(HEIGHT)))
    x0 = PAD
    y0 = PAD
    y_cut_proj = miny
    y_cut_canvas = y0 + (maxy - y_cut_proj) * scale
    # Southern reference: Amami / Yoron (~27.05N, west Kyushu longitude)
    _, y_south_proj = PROJ(129.0, 27.05)
    y_bottom = HEIGHT - 8.0
    scale_south = (y_bottom - y_cut_canvas) / max(y_cut_proj - y_south_proj, 1e-6)
    # Place the inset in the lower-right bay, above the south reserve
    iy = min(y_cut_canvas - inset_h - 8.0, HEIGHT - PAD - inset_h * 1.25)
    iy = max(PAD + 40.0, iy)
    inset = (ix, iy, inset_w, inset_h)
    # Keep south-band islands (Amami etc.) from running off the left edge.
    # Sample the west of the south box at a few longitudes.
    south_xs = [PROJ(lon, 27.4)[0] for lon in (128.0, 128.6, 129.0, 129.5, 130.0)]
    south_x_min = x0 + (min(south_xs) - minx) * scale
    south_dx = max(0.0, PAD - south_x_min)
    print("canvas", WIDTH, HEIGHT, "scale", scale, "origin", x0, y0)
    print("south y_cut", round(y_cut_canvas, 1), "scale_south", round(scale_south, 2),
          "south_dx", round(south_dx, 1), "inset", inset)

    _, old_provs, old_ja = load_legacy()

    best = None
    for tol in (0.003, 0.004, 0.005, 0.006, 0.008, 0.01, 0.012):
        simp = simplify_all(prefs, tol)
        data = build(
            simp, scale, x0, y0, minx, maxy, y_cut_proj, y_cut_canvas, scale_south,
            inset, old_provs, old_ja, south_dx,
        )
        size = len(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
        print("  tol", tol, "bytes", size)
        score = abs(size - 73_000)
        if best is None or score < best[0]:
            best = (score, tol, data, size)
        if 60_000 <= size <= 90_000 and size <= 85_000:
            best = (score, tol, data, size)
            break

    tol, data, size = best[1], best[2], best[3]
    print("chosen tol", tol, "size", size)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("saved", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
