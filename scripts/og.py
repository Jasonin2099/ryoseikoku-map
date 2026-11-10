#!/usr/bin/env python3
"""Build a 1200x630 OG image with no site URL in the picture."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
from playwright.sync_api import sync_playwright

m = json.loads((ROOT / "data/map.json").read_text())
pv = {p["id"]: p for p in json.loads((ROOT / "data/provinces.json").read_text())["provinces"]}
css = (ROOT / "src/style.css").read_text()
col = {}
for k in ["kinai","tokaido","tosando","hokurikudo","sanindo","sanyodo","nankaido","saikaido"]:
    mm = re.search(r"--dao-" + k + r":\s*([^;}]+)", css)
    if mm:
        col[k] = mm.group(1).strip()
none = "#4a4036"
mm = re.search(r"--dao-none:\s*([^;}]+)", css)
if mm:
    none = mm.group(1).strip()

ins = m.get("inset") or {"x": 771.5, "y": 258, "w": 250, "h": 88}
Z = 1.5
cx = ins["x"] + ins["w"] / 2
cy = ins["y"] + ins["h"] / 2
fx, fy, fw, fh = cx - ins["w"] * Z / 2, cy - ins["h"] * Z / 2, ins["w"] * Z, ins["h"] * Z

paths = ""
for k, i in m["paths"].items():
    first = (i.get("provs") or [None])[0]
    f = col[pv[first]["dao"]] if first else none
    t = ' transform="translate(%s %s) scale(%s) translate(%s %s)"' % (cx, cy, Z, -cx, -cy) if k == "47" else ""
    paths += '<path d="%s" fill="%s" stroke="#15100c" stroke-width=".8"%s/>' % (i["d"], f, t)
frame = '<rect x="%s" y="%s" width="%s" height="%s" rx="10" fill="none" stroke="rgba(200,169,110,.4)" stroke-dasharray="6 5"/>' % (fx, fy, fw, fh)

font = ROOT / "dist" / "jinghua-sub.woff2"
if not font.is_file():
    raise SystemExit("Run npm run build first so dist/jinghua-sub.woff2 exists.")
html = """<html><head><style>
@font-face{font-family:JH;src:url('%s')}
body{margin:0;width:1200px;height:630px;background:radial-gradient(ellipse at 70%% 40%%,#2a2018,#15100c);color:#ece3d4;font-family:'Noto Serif CJK JP','Yu Mincho',serif;overflow:hidden;position:relative}
.t{position:absolute;left:64px;top:70px;font-family:JH,serif;font-size:64px;line-height:1.25;letter-spacing:.04em}
.e{position:absolute;left:66px;top:40px;font:15px monospace;letter-spacing:.3em;color:#c8a96e}
.s{position:absolute;left:66px;bottom:58px;font-size:26px;color:#b8a88f}
svg{position:absolute;right:20px;top:120px;width:820px}
</style></head><body>
<svg viewBox="0 0 %s %s">%s%s</svg>
<div class="e">五畿七道 · 六十八国</div>
<div class="t">あなたの地元、<br>昔は何国？</div>
<div class="s">地図をタップすると、今の都道府県が<br>千年前の「令制国」の名前に。</div>
</body></html>""" % (font.as_uri(), m["width"], m["height"], paths, frame)

out_html = Path("/tmp/kuni-og.html")
out_html.write_text(html)
out_png = ROOT / "assets/og.png"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.goto(out_html.as_uri())
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(out_png))
    b.close()
print("wrote", out_png)
