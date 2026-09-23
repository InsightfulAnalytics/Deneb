#!/usr/bin/env python3
"""Crop the showcase's Desktop captures into README previews and template thumbnails.

Capture every page first, with the showcase open in Power BI Desktop:

    cd showcase
    pbir desktop screenshot "Deneb Template Showcase.Report" --all --scale 2 --output-dir <shots>
    cd ..

Then, from the repository root:

    python tools/showcase/crop_previews.py <shots>            # preview.png per template, dashboard.png
    python tools/showcase/crop_previews.py <shots> --embed    # also embed the thumbnails in usermeta
    python tools/showcase/crop_previews.py <shots> --embed --only australia-choropleth   # one template

It reads tools/showcase/out/capture-map.json, which build_showcase.py writes. Needs Pillow.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
CAPTURE_MAP = REPO / "tools" / "showcase" / "out" / "capture-map.json"
DASHBOARD_OUT = REPO / "showcase" / "dashboard.png"

PANE = (248, 250, 252)   # the collapsed Filters pane on the right of every capture
PAD = 16                 # page pixels kept around the template's visuals
PREVIEW_SCALE = 2        # preview pixels per page pixel
PREVIEW_MAX = 2400       # long side cap for a preview
DASHBOARD_MAX = 2400
THUMB_MAX = 300          # long side of the embedded thumbnail
THUMB_BYTES = 30_000     # Background Designer's budget per thumbnail
WIDE = 1000              # a visual wider than this (page pixels) is thumbnailed by its corner
CORNER = (640, 400)      # the top-left corner a wide visual's thumbnail keeps


def viewport_width(im: Image.Image) -> int:
    """Width of the canvas viewport: the capture minus the Filters pane strip."""
    w, h = im.size
    y = h // 2
    x = w
    while x > 0 and im.getpixel((x - 1, y))[:3] == PANE:
        x -= 1
    return x if x < w else w


def page_box(im: Image.Image, pw: int, ph: int) -> tuple[float, float, float]:
    """Desktop fits the page into the viewport and centres it: return (zoom, x0, y0)."""
    vw = viewport_width(im)
    h = im.size[1]
    zoom = min(vw / pw, h / ph)
    return zoom, (vw - pw * zoom) / 2, (h - ph * zoom) / 2


def crop(im: Image.Image, page: dict, rect: dict, pad: int) -> Image.Image:
    zoom, x0, y0 = page_box(im, page["width"], page["height"])
    left = max(0, rect["x"] - pad)
    top = max(0, rect["y"] - pad)
    right = min(page["width"], rect["x"] + rect["w"] + pad)
    bottom = min(page["height"], rect["y"] + rect["h"] + pad)
    box = tuple(round(v) for v in (x0 + left * zoom, y0 + top * zoom, x0 + right * zoom, y0 + bottom * zoom))
    return im.crop(box).convert("RGB")


def fit(im: Image.Image, width: int, cap: int) -> Image.Image:
    """Resize to the given width, keeping the long side at or under cap."""
    w, h = im.size
    scale = min(width / w, cap / max(w, h))
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    return im.resize(size, Image.Resampling.LANCZOS) if size != im.size else im


def png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def preview_bytes(im: Image.Image) -> bytes:
    """A 256-colour palette PNG: a third of the RGB size, no visible banding on these pages."""
    return png_bytes(im.quantize(colors=256, method=Image.Quantize.MEDIANCUT))


def thumbnail(im: Image.Image) -> bytes:
    small = im.copy()
    small.thumbnail((THUMB_MAX, THUMB_MAX), Image.Resampling.LANCZOS)
    for colors in (256, 128, 64, 32):
        data = png_bytes(small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT))
        if len(data) <= THUMB_BYTES:
            return data
    raise SystemExit(f"thumbnail stays over {THUMB_BYTES} bytes even at 32 colours")


def embed(template: Path, png: bytes) -> None:
    """Set usermeta.information.previewImageBase64PNG without reformatting the file."""
    uri = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
    text = template.read_text(encoding="utf-8")
    before = json.loads(text)
    key = re.compile(r'("previewImageBase64PNG"\s*:\s*)"[^"]*"')
    if key.search(text):
        text = key.sub(lambda m: m.group(1) + json.dumps(uri), text, count=1)
    else:
        gen = re.compile(r'^(?P<indent>[ \t]*)"generated"\s*:\s*"[^"]*"', re.M)
        m = gen.search(text)
        if not m:
            raise SystemExit(f"{template}: no usermeta.information.generated line to anchor the thumbnail")
        insert = f',\n{m.group("indent")}"previewImageBase64PNG": {json.dumps(uri)}'
        text = text[:m.end()] + insert + text[m.end():]
    after = json.loads(text)
    before["usermeta"]["information"]["previewImageBase64PNG"] = uri
    if after != before:
        raise SystemExit(f"{template}: the thumbnail landed somewhere other than usermeta.information")
    template.write_text(text, encoding="utf-8", newline="\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("shots", type=Path, help="folder written by pbir desktop screenshot --all")
    ap.add_argument("--embed", action="store_true", help="also embed each thumbnail in its template")
    ap.add_argument("--only", nargs="+", metavar="SLUG",
                    help="process only these template slugs (or 'dashboard'), leaving the other files alone")
    args = ap.parse_args()

    if not CAPTURE_MAP.is_file():
        print(f"{CAPTURE_MAP.relative_to(REPO)} not found; run build_showcase.py first", file=sys.stderr)
        return 1
    pages = json.loads(CAPTURE_MAP.read_text(encoding="utf-8"))["pages"]
    if args.only:
        known = {"dashboard"} | {p["template"] for p in pages if p["kind"] == "template"}
        unknown = sorted(set(args.only) - known)
        if unknown:
            print(f"unknown slug(s): {', '.join(unknown)}", file=sys.stderr)
            return 1
        pages = [p for p in pages
                 if (p["kind"] == "dashboard" and "dashboard" in args.only)
                 or p.get("template") in args.only]
    missing = 0
    for page in pages:
        shot = args.shots / f"{page['displayName']}.png"
        if not shot.is_file():
            print(f"missing capture: {shot.name}", file=sys.stderr)
            missing += 1
            continue
        im = Image.open(shot)
        if page["kind"] == "dashboard":
            whole = crop(im, page, {"x": 0, "y": 0, "w": page["width"], "h": page["height"]}, 0)
            out = fit(whole, page["width"] * PREVIEW_SCALE, DASHBOARD_MAX)
            DASHBOARD_OUT.write_bytes(preview_bytes(out))
            print(f"{DASHBOARD_OUT.relative_to(REPO).as_posix()}  {out.size[0]}x{out.size[1]}  "
                  f"{DASHBOARD_OUT.stat().st_size // 1024} KB")
            continue
        folder = REPO / Path(page["templatePath"]).parent
        rect = page["rect"]
        preview = fit(crop(im, page, rect, PAD), (rect["w"] + 2 * PAD) * PREVIEW_SCALE, PREVIEW_MAX)
        (folder / "preview.png").write_bytes(preview_bytes(preview))
        # The thumbnail shows one instance, the first visual on the page. A wide table shrinks to
        # unreadable at 300 px, so it shows the top-left corner instead.
        first = page["visuals"][0]
        region = {"x": first["x"], "y": first["y"], "w": first["w"], "h": first["h"]}
        if region["w"] > WIDE:
            region["w"], region["h"] = CORNER[0], min(region["h"], CORNER[1])
        thumb = thumbnail(crop(im, page, region, 4))
        line = (f"{(folder / 'preview.png').relative_to(REPO).as_posix()}  {preview.size[0]}x{preview.size[1]}  "
                f"{(folder / 'preview.png').stat().st_size // 1024} KB; thumbnail {len(thumb) // 1024} KB")
        if args.embed:
            embed(REPO / page["templatePath"], thumb)
            line += ", embedded"
        print(line)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
