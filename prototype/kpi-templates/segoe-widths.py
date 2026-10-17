"""PROTOTYPE, throwaway (KAN-41). Measure Segoe UI advance widths for the headless renders.

Headless Vega has no canvas, so it estimates text widths and truncates text a browser would fit.
This writes segoe-widths.json: per weight, the width of each character at 1 px font size, read
from the Windows font files with Pillow. prepare.mjs plugs it into vega.textMetrics.

    py prototype/kpi-templates/segoe-widths.py
"""
import json
from pathlib import Path

from PIL import ImageFont

FONTS = Path("C:/Windows/Fonts")
FILES = {"normal": "segoeui.ttf", "600": "seguisb.ttf", "bold": "segoeuib.ttf", "italic": "segoeuii.ttf"}
EXTRA = "\u25B2\u25BC\u25BA\u2212\u00B7\u2003\u2026\u00A0"
CHARS = [chr(c) for c in range(32, 127)] + list(EXTRA)
SIZE = 200

table = {}
for weight, name in FILES.items():
    font = ImageFont.truetype(str(FONTS / name), SIZE)
    table[weight] = {ch: round(font.getlength(ch) / SIZE, 4) for ch in CHARS}
out = Path(__file__).with_name("segoe-widths.json")
out.write_text(json.dumps(table, ensure_ascii=False), encoding="utf-8")
print(f"wrote {out.name}: {len(CHARS)} characters x {len(FILES)} weights")
