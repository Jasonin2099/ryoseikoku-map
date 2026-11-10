#!/usr/bin/env python3
"""Build data/map.json and data/kuni-regions.json.

68 令制国 polygons are dissolved from openly licensed bakumatsu village-territory
data (みるラボ's kuni GeoJSON, itself derived from Honda Kenichi / CODH
『幕末期近世村領域データセット』, CC BY-SA 4.0, based on MAFF 2015 agricultural
settlement boundaries). 陸奥 and 出羽 are reunited from the 1869 split (73→68).
Hokkaido (蝦夷) and the Okinawa inset (琉球) still come from Natural Earth
10m Admin-1 v5.1.1 (public domain). Amami / Tokara, which are absent from the
bakumatsu village coverage, are attached to 薩摩 so the south band stays intact
(Edo-period Satsuma domain; not a historical 令制国 claim).

Projection: Lambert conformal conic (lon0 137°E, standard parallels 33°N / 44°N).
Okinawa is drawn in a right-hand inset (the app then scales that path 1.5×).
"""
from __future__ import annotations

import json
import math
import urllib.request
import zipfile
from pathlib import Path

import shapefile
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
CACHE_NE = ROOT / ".cache" / "natural-earth"
CACHE_KUNI = ROOT / ".cache" / "ryoseikoku"
OUT_MAP = ROOT / "data" / "map.json"
OUT_REGIONS = ROOT / "data" / "kuni-regions.json"
PROVINCES = ROOT / "data" / "provinces.json"

NE_URL = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip"
NE_VERSION = "5.1.1"
KUNI_URL = "https://miru-lab.jp/data/ryoseikoku/kuni.geojson"

WIDTH, HEIGHT = 1100.0, 480.0
PAD = 16.0

# Bakumatsu (1869) split parts reunited into the traditional 68.
MERGE_TO = {
    "陸奥": "陸奥",
    "陸中": "陸奥",
    "陸前": "陸奥",
    "岩代": "陸奥",
    "磐城": "陸奥",
    "羽前": "出羽",
    "羽後": "出羽",
}


def download(url: str, dest: Path, min_size: int) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists() or dest.stat().st_size < min_size:
        print("downloading", url)
        req = urllib.request.Request(url, headers={"User-Agent": "ryoseikoku-map-build/2.0"})
        with urllib.request.urlopen(req, timeout=180) as r:
            dest.write_bytes(r.read())
    if dest.stat().st_size < min_size:
        raise SystemExit("download too small: %s (%s bytes)" % (dest, dest.stat().st_size))
    return dest


def download_ne(dest: Path) -> Path:
    zpath = download(NE_URL, dest / "ne_10m_admin_1_states_provinces.zip", 1_000_000)
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


def keep_tokyo_part(poly) -> bool:
    c = poly.centroid
    return c.x < 141.2 and c.y >= 32.0


def valid(geom):
    if geom is None or geom.is_empty:
        return geom
    if not geom.is_valid:
        try:
            geom = geom.make_valid()
        except Exception:
            geom = geom.buffer(0)
    return geom


def reassign(raw):
    """Filter Tokyo remote islands; collect Amami/Tokara (misattributed to Okinawa)."""
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
            # Amami / Tokara / Yoron: Kagoshima, not Okinawa, and not a 令制国.
            if iso == "JP-47" and c.y >= 27.1:
                amami.append(p)
                continue
            if iso == "JP-46" and c.y < 30.0:
                amami.append(p)
                continue
            kept.append(p)
        if not kept and iso not in ("JP-46",):
            raise SystemExit("no parts left for " + iso)
        if kept:
            out[iso] = dict(info, geom=unary_union(kept))
        else:
            out[iso] = dict(info, geom=info["geom"])
    return out, amami


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
    if geom is None or geom.is_empty:
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


def load_name_map():
    data = json.loads(PROVINCES.read_text())
    by_ja = {}
    for p in data["provinces"]:
        by_ja[p["ja"]] = p
    if len(by_ja) != 68:
        raise SystemExit("expected 68 provinces, got %s" % len(by_ja))
    return by_ja


def load_kuni_geojson(path: Path):
    fc = json.loads(path.read_text())
    grouped = {}
    for feat in fc["features"]:
        props = feat.get("properties") or {}
        name = props.get("name")
        if not name:
            raise SystemExit("kuni feature missing name: %s" % props)
        target = MERGE_TO.get(name, name)
        geom = valid(shape(feat["geometry"]))
        grouped.setdefault(target, []).append(geom)
    out = {}
    for name, geoms in grouped.items():
        out[name] = valid(unary_union(geoms))
    return out


def attach_amami(kuni, amami, by_ja):
    if not amami:
        return
    if "薩摩" not in kuni:
        raise SystemExit("薩摩 missing; cannot attach Amami")
    kuni["薩摩"] = valid(unary_union([kuni["薩摩"], *amami]))
    print("attached", len(amami), "Amami/Tokara parts to 薩摩")


def simplify_geoms(geoms, tol):
    out = {}
    for key, g in geoms.items():
        s = g.simplify(tol, preserve_topology=True)
        if s is None or s.is_empty:
            s = g
        out[key] = valid(s)
    return out


def label_point(geom, south_y=820.0):
    """Prefer a point on the main-island body, not a compressed south-band tail."""
    parts = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    parts = [p for p in parts if p.area > 0]
    if not parts:
        return geom.centroid
    main = [p for p in parts if p.centroid.y < south_y]
    pick = max(main or parts, key=lambda p: p.area)
    try:
        return pick.representative_point()
    except Exception:
        return pick.centroid


def rec_from_geom(geom, ja, pid, dao, kind):
    d = geom_to_path(geom)
    if not d:
        raise SystemExit("empty path for " + ja)
    minx, miny, maxx, maxy = geom.bounds
    rp = label_point(geom)
    return {
        "d": d,
        "cx": round(rp.x, 1),
        "cy": round(rp.y, 1),
        "bbox": [
            round(minx, 1),
            round(miny, 1),
            round(maxx - minx, 1),
            round(maxy - miny, 1),
        ],
        "area": round(geom.area, 1),
        "id": pid,
        "ja": ja,
        "dao": dao,
        "kind": kind,
    }


def build(kuni_geoms, hokkaido, ryukyu, scale, x0, y0, minx, maxy,
          y_cut_proj, y_cut_canvas, scale_south, inset, by_ja, south_dx=0.0):
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
    oki_p = apply_xy(ryukyu, PROJ_OKI)
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
    regions_kuni = {}
    missing = []
    for ja, meta in by_ja.items():
        geom = kuni_geoms.get(ja)
        if geom is None or geom.is_empty:
            missing.append(ja)
            continue
        projected = apply_xy(geom, proj_main)
        rec = rec_from_geom(projected, ja, meta["id"], meta["dao"], "kuni")
        paths[meta["id"]] = {
            "ja": ja,
            "d": rec["d"],
            "dao": meta["dao"],
            "kind": "kuni",
        }
        regions_kuni[meta["id"]] = {
            "d": rec["d"],
            "cx": rec["cx"],
            "cy": rec["cy"],
            "bbox": rec["bbox"],
            "area": rec["area"],
            "id": rec["id"],
            "ja": ja,
            "dao": meta["dao"],
        }
    if missing:
        raise SystemExit("missing kuni geometries: " + ", ".join(missing))
    if len(regions_kuni) != 68:
        raise SystemExit("expected 68 kuni paths, got %s" % len(regions_kuni))

    h_proj = apply_xy(hokkaido, proj_main)
    h_rec = rec_from_geom(h_proj, "北海道", "hokkaido", None, "outside")
    paths["hokkaido"] = {"ja": "北海道", "d": h_rec["d"], "kind": "outside"}

    r_proj = apply_xy(ryukyu, proj_oki)
    r_rec = rec_from_geom(r_proj, "琉球", "ryukyu", None, "outside")
    # bbox/cx for regions.outside.ryukyu are in pre-1.5× inset coordinates,
    # matching the previous pipeline; the app transforms them at display time.
    paths["ryukyu"] = {"ja": "琉球", "d": r_rec["d"], "kind": "outside"}

    outside = {
        "hokkaido": {
            "d": h_rec["d"],
            "cx": h_rec["cx"],
            "cy": h_rec["cy"],
            "bbox": h_rec["bbox"],
            "area": h_rec["area"],
            "id": "hokkaido",
            "ja": "北海道",
        },
        "ryukyu": {
            "d": r_rec["d"],
            "cx": r_rec["cx"],
            "cy": r_rec["cy"],
            "bbox": r_rec["bbox"],
            "area": r_rec["area"],
            "id": "ryukyu",
            "ja": "琉球",
        },
    }

    map_data = {
        "width": WIDTH,
        "height": HEIGHT,
        "inset": {"x": ix, "y": iy, "w": iw, "h": ih},
        "source": {
            "kuni": {
                "name": "みるラボ 令制国ポリゴン（幕末期近世村領域データセットを国単位に統合した派生データ）",
                "license": "CC BY-SA 4.0",
                "url": KUNI_URL,
                "page": "https://miru-lab.jp/contents/ryoseikoku-map",
                "upstream": [
                    {
                        "name": "幕末期近世村領域データセット（CODH）／幕末期近世村領域データ（本田謙一）",
                        "license": "CC BY-SA 4.0",
                        "url": "https://geoshape.ex.nii.ac.jp/av/",
                        "github": "https://github.com/yaoyue00085856/Kyudaka_agrivillage",
                        "doi": "https://doi.org/10.20676/00000454",
                    },
                    {
                        "name": "農業集落境界データ（2015年農林業センサス、農林水産省）",
                        "license": "出典を明示して利用可",
                        "url": "https://www.maff.go.jp/j/tokei/census/shuraku_data/2015/index.html",
                    },
                ],
                "note": "73 bakumatsu provinces merged back to the traditional 68 (陸奥, 出羽). Boundaries are modern agricultural-settlement approximations of bakumatsu village territories, not 7th-century survey lines.",
            },
            "hokkaido_ryukyu": {
                "name": "Natural Earth 10m Admin-1 States and Provinces",
                "version": NE_VERSION,
                "license": "public domain",
                "url": "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/",
                "terms": "https://www.naturalearthdata.com/about/terms-of-use/",
            },
            "projection": "Lambert conformal conic, lon0=137E, std parallels 33N/44N",
        },
        "paths": paths,
    }
    regions = {
        "note": "令制国界は幕末期村域データ（CC BY-SA 4.0）を68国に統合して投影したもの。北海道・琉球は Natural Earth（パブリックドメイン）。歴史上の正確な国境そのものではなく、典拠に基づく近似的な再構成である。",
        "kuni": regions_kuni,
        "outside": outside,
    }
    return map_data, regions


def canvas_layout(prefs):
    global WIDTH, HEIGHT
    fit = main_parts(prefs)
    minx, miny, maxx, maxy = projected_bounds(fit, PROJ)
    print("fit projected", minx, miny, maxx, maxy)

    WIDTH = 1100.0
    inset_w, inset_h = 300.0, 155.0
    gap = 20.0
    SOUTH_RESERVE = 72.0
    ix = WIDTH - PAD - inset_w * 1.25
    usable_w = WIDTH - PAD - 230.0 * 1.25 - gap - PAD
    scale = usable_w / (maxx - minx)
    drawn_h = (maxy - miny) * scale
    HEIGHT = PAD + drawn_h + SOUTH_RESERVE
    HEIGHT = float(int(round(HEIGHT)))
    x0 = PAD
    y0 = PAD
    y_cut_proj = miny
    y_cut_canvas = y0 + (maxy - y_cut_proj) * scale
    _, y_south_proj = PROJ(129.0, 27.05)
    y_bottom = HEIGHT - 8.0
    scale_south = (y_bottom - y_cut_canvas) / max(y_cut_proj - y_south_proj, 1e-6)
    iy = min(y_cut_canvas - inset_h - 8.0, HEIGHT - PAD - inset_h * 1.25)
    iy = max(PAD + 40.0, iy)
    inset = (ix, iy, inset_w, inset_h)
    south_xs = [PROJ(lon, 27.4)[0] for lon in (128.0, 128.6, 129.0, 129.5, 130.0)]
    south_x_min = x0 + (min(south_xs) - minx) * scale
    south_dx = max(0.0, PAD - south_x_min)
    print("canvas", WIDTH, HEIGHT, "scale", scale, "origin", x0, y0)
    print("south y_cut", round(y_cut_canvas, 1), "scale_south", round(scale_south, 2),
          "south_dx", round(south_dx, 1), "inset", inset)
    return scale, x0, y0, minx, maxy, y_cut_proj, y_cut_canvas, scale_south, inset, south_dx


def main():
    by_ja = load_name_map()
    shp = download_ne(CACHE_NE)
    prefs, amami = reassign(load_japan(shp))
    # Restore a Kagoshima geom that still includes mainland + Yakushima for the fit.
    # Amami was removed from JP-46/JP-47 above; mainland Kagoshima remains in prefs["JP-46"].

    kuni_path = download(KUNI_URL, CACHE_KUNI / "kuni.geojson", 100_000)
    kuni = load_kuni_geojson(kuni_path)
    print("loaded kuni names:", len(kuni), sorted(kuni))
    unexpected = [n for n in kuni if n not in by_ja]
    if unexpected:
        raise SystemExit("unexpected kuni names: " + ", ".join(unexpected))
    attach_amami(kuni, amami, by_ja)

    hokkaido = prefs["JP-01"]["geom"]
    ryukyu = prefs["JP-47"]["geom"]

    layout = canvas_layout(prefs)
    scale, x0, y0, minx, maxy, y_cut_proj, y_cut_canvas, scale_south, inset, south_dx = layout

    best = None
    # Geographic degrees. Start coarser than the old pref map so 68 detailed
    # borders stay under ~600 KB.
    for tol in (0.004, 0.005, 0.006, 0.008, 0.01, 0.012, 0.015, 0.018, 0.022):
        simp_kuni = simplify_geoms(kuni, tol)
        simp_h = simplify_geoms({"hokkaido": hokkaido}, tol)["hokkaido"]
        simp_r = simplify_geoms({"ryukyu": ryukyu}, min(tol, 0.006))["ryukyu"]
        data, regions = build(
            simp_kuni, simp_h, simp_r, scale, x0, y0, minx, maxy,
            y_cut_proj, y_cut_canvas, scale_south, inset, by_ja, south_dx,
        )
        size = len(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
        rsize = len(json.dumps(regions, ensure_ascii=False, separators=(",", ":")))
        print("  tol", tol, "map.json", size, "kuni-regions", rsize)
        if size > 600_000:
            continue
        # Prefer the most detailed file that still fits the budget.
        if best is None or size > best[0]:
            best = (size, tol, data, regions, rsize)
        # Good enough: detailed and comfortably under the cap.
        if size <= 550_000 and tol <= 0.008:
            break

    if best is None:
        raise SystemExit("could not simplify map.json under 600KB")

    size, tol, data, regions, rsize = best
    print("chosen tol", tol, "map.json", size, "kuni-regions", rsize)
    OUT_MAP.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    OUT_REGIONS.write_text(json.dumps(regions, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("saved", OUT_MAP, OUT_MAP.stat().st_size)
    print("saved", OUT_REGIONS, OUT_REGIONS.stat().st_size)


if __name__ == "__main__":
    main()
