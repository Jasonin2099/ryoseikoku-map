#!/usr/bin/env python3
"""Subset 京華老宋体 into dist/jinghua-sub.woff2 from the official v3.0 file.

The official TTF is not in the repository (it is ~33 MB). Place a copy at
one of the paths below (see FONT-NOTICE.md), then run this script or
`npm run build`, which calls it. The character set is collected from
data/*.json and src/* so that CI can reproduce the subset.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PINNED_SHA256 = "f7fef9fc413e9e2343f0bb432c51cca41c44b8fe37f071dc86b050896ae9f9e2"
PINNED_NAME = "京華老宋体v3.0.ttf"

SEARCH_PATHS = [
    os.environ.get("FONT_FILE"),
    ROOT / ".cache" / "fonts" / PINNED_NAME,
    ROOT / "vendor" / "fonts" / PINNED_NAME,
    Path.home() / "fonts" / PINNED_NAME,
]


def find_font() -> Path | None:
    for raw in SEARCH_PATHS:
        if not raw:
            continue
        p = Path(raw).expanduser()
        if p.is_file():
            return p
    sys.stderr.write(
        "Official 京華老宋体 v3.0 was not found.\n"
        "Download the original file from the author (see FONT-NOTICE.md),\n"
        "place it at .cache/fonts/京華老宋体v3.0.ttf (or set FONT_FILE),\n"
        "and confirm sha256 is %s\n" % PINNED_SHA256
    )
    if os.environ.get("FONT_OPTIONAL"):
        sys.stderr.write(
            "FONT_OPTIONAL is set; skipping subset and falling back to system fonts.\n"
        )
        return None
    raise SystemExit(2)


def verify(path: Path) -> None:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    got = h.hexdigest()
    if got != PINNED_SHA256:
        raise SystemExit(
            "sha256 mismatch for %s\n  expected %s\n  got      %s\n"
            "Refusing to subset an unverified file." % (path, PINNED_SHA256, got)
        )
    print("font ok:", path, "sha256 verified")


def collect_chars() -> str:
    chars = set()
    # JSON data (kuni names, shrine names, readings, copy, pref names, map labels)
    for p in (ROOT / "data").glob("*.json"):
        walk(json.loads(p.read_text()), chars)
    # UI source (strings in JS / HTML / CSS ::content)
    for folder in (ROOT / "src",):
        for p in folder.rglob("*"):
            if p.suffix.lower() in {".js", ".html", ".css"}:
                chars.update(p.read_text(errors="ignore"))
    # Always keep a basic Latin / punctuation / kana / CJK punctuation kit
    # so the subset stays usable even if a string is built at runtime.
    extras = (
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
        " .,;:!?/\\()[]{}'\"“”‘’「」『』（）〔〕・ー—–…％%&+-*=@#~^_|<>"
        "　、。，．・：；？！ー—「」『』（）〔〕［］｛｝〈〉《》【】"
        "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞ"
        "ただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽ"
        "まみむめもゃやゅゆょよらりるれろゎわゐゑをん゛゜ゝゞ"
        "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾ"
        "タダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポ"
        "マミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶーヽヾ"
        "〇々〆〤"
        "诸說諸説一宮一宫"
        # Japanese shinjitai often missing from a Chinese-first subset
        "国辺沢竜巣県広対壱浜亀穂浄労駅髪庁児円亜楽黒様経総関戦残発仮会伝図写処台気"
    )
    chars.update(extras)
    # drop controls, keep whitespace
    out = []
    for ch in chars:
        if ch in "\n\r\t ":
            continue
        cat = unicodedata.category(ch)
        if cat.startswith("C"):
            continue
        out.append(ch)
    text = "".join(sorted(out, key=ord))
    return text


def walk(obj, chars: set) -> None:
    if isinstance(obj, dict):
        # skip machine-only geometry
        for k, v in obj.items():
            if k in {"d", "paths", "width", "height", "x", "y", "w", "h", "source"}:
                if k == "d" or k in {"width", "height", "x", "y", "w", "h"}:
                    continue
                if k == "paths":
                    # still collect ja names under paths
                    if isinstance(v, dict):
                        for info in v.values():
                            walk({kk: vv for kk, vv in info.items() if kk != "d"}, chars)
                    continue
                if k == "source":
                    walk(v, chars)
                    continue
            walk(k, chars)
            walk(v, chars)
    elif isinstance(obj, list):
        for it in obj:
            walk(it, chars)
    elif isinstance(obj, str):
        chars.update(obj)


def subset(font: Path, text: str, dest: Path) -> None:
    try:
        from fontTools.subset import main as subset_main
    except ImportError:
        raise SystemExit(
            "fontTools is required (pip install fonttools brotli). "
            "See docs/HANDOFF.md."
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_txt = dest.parent / ".charset.txt"
    tmp_txt.write_text(text, encoding="utf-8")
    args = [
        str(font),
        f"--text-file={tmp_txt}",
        f"--output-file={dest}",
        "--flavor=woff2",
        "--layout-features=",
        "--no-hinting",
    ]
    print("pyftsubset", " ".join(args[1:3]), "chars", len(text))
    rc = subset_main(args)
    tmp_txt.unlink(missing_ok=True)
    if rc not in (None, 0):
        raise SystemExit("pyftsubset failed: %s" % rc)
    if not dest.is_file() or dest.stat().st_size < 1000:
        raise SystemExit("subset was not written: %s" % dest)
    print("wrote", dest, dest.stat().st_size, "bytes")


def main():
    font = find_font()
    if font is None:
        return
    verify(font)
    text = collect_chars()
    print("charset size:", len(text), "code points")
    dest = Path(os.environ.get("FONT_SUBSET_OUT", DIST / "jinghua-sub.woff2"))
    subset(font, text, dest)


if __name__ == "__main__":
    main()
