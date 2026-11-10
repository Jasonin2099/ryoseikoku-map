#!/usr/bin/env python3
"""kuni-regions.json is now written by scripts/build-map.py together with map.json."""
from __future__ import annotations

import runpy
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parent / "build-map.py"), run_name="__main__")
