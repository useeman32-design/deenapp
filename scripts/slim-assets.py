#!/usr/bin/env python3
"""
slim-assets.py — DeenLink image diet.

Recompresses bundled assets in place (same filename/extension kept unless a
file is listed in CONVERT_TO_JPG, which also rewrites require() paths).
Run from the repo root:  python3 scripts/slim-assets.py [--dry]

Rules:
  • JPG  → quality 80 (heroes 82), optimize, progressive, max width 1200
           (scholar avatars max 640).
  • PNG  → palette-quantized (adaptive), optimize; decorative patterns also
           downscaled to 1000px. Keeps alpha.
  • CONVERT_TO_JPG — photographic PNGs become .jpg (requires updated in code).
Prints a before/after table. Idempotent: skips files already under budget.
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = '--dry' in sys.argv

# max bytes per group — files already below are untouched
JPG_BUDGET = 150 * 1024
PNG_BUDGET = 250 * 1024
ICON_BUDGET = 220 * 1024

CONVERT_TO_JPG = {  # old png → new jpg (code requires must be updated)
    'assets/img/onboard-book.png': 'assets/img/onboard-book.jpg',
    'assets/img/onboard-mosque.png': 'assets/img/onboard-mosque.jpg',
}

HEROES = {'assets/img/mecca.jpg'}            # keep a notch higher quality
AVATARS_640 = {f'assets/img/scholar-{i}.jpg' for i in (1, 2, 3)}
PATTERNS = {'assets/img/pattern-dark.png', 'assets/img/pattern-light.png'}
ICON = 'assets/images/icon.png'
GLOW = 'assets/images/logo-glow.png'


def kb(n: float) -> str:
    return f'{n / 1024:.0f}K'


def save_jpg(im: Image.Image, path: str, q: int) -> None:
    im.convert('RGB').save(path, 'JPEG', quality=q, optimize=True, progressive=True)


def shrink_jpg(path: str) -> tuple[int, int]:
    before = os.path.getsize(path)
    if before <= JPG_BUDGET and path not in AVATARS_640:
        return before, before
    im = Image.open(path)
    maxw = 640 if path in AVATARS_640 else 1200
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    q = 82 if path in HEROES else 80
    tmp = path + '.tmp'
    save_jpg(im, tmp, q)
    after = os.path.getsize(tmp)
    if after < before * 0.93:  # only accept meaningful wins
        if not DRY:
            os.replace(tmp, path)
        return before, after
    os.remove(tmp)
    return before, before


def shrink_png(path: str) -> tuple[int, int]:
    before = os.path.getsize(path)
    if before <= PNG_BUDGET:
        return before, before
    im = Image.open(path)
    budget, colors = ICON_BUDGET, 256
    if path in PATTERNS:
        if im.width > 1000:
            im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
        colors = 160
    elif path == GLOW:
        if im.width > 420:
            im = im.resize((420, round(im.height * 420 / im.width)), Image.LANCZOS)
        colors = 128
    tmp = path + '.tmp'
    method = Image.FASTOCTREE if im.mode == 'RGBA' else Image.MEDIANCUT
    im.quantize(colors=colors, method=method, dither=Image.FLOYDSTEINBERG).save(tmp, 'PNG', optimize=True)
    after = os.path.getsize(tmp)
    if after < before * 0.93:
        if not DRY:
            os.replace(tmp, path)
        return before, after
    os.remove(tmp)
    return before, before


def convert(path: str, dest: str) -> tuple[int, int]:
    before = os.path.getsize(path)
    im = Image.open(path)
    if im.width > 1100:
        im = im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS)
    if not DRY:
        save_jpg(im, dest, 80)
        os.remove(path)
    return before, os.path.getsize(dest) if not DRY else before


def main() -> None:
    targets: list[str] = []
    for base in ('assets/img', 'assets/images'):
        for f in sorted(os.listdir(os.path.join(ROOT, base))):
            p = os.path.join(base, f)
            if os.path.isfile(os.path.join(ROOT, p)) and p not in CONVERT_TO_JPG:
                targets.append(p)
    total_b = total_a = 0
    for p in targets:
        full = os.path.join(ROOT, p)
        b, a = (shrink_png if p.endswith('.png') else shrink_jpg)(p)
        total_b += b
        total_a += a
        flag = '↓' if a < b * 0.93 else '='
        print(f'{flag} {p:46s} {kb(b):>7s} → {kb(a):>7s}')
    for src, dst in CONVERT_TO_JPG.items():
        if os.path.exists(os.path.join(ROOT, src)):
            b, a = convert(src, dst)
            total_b += b
            total_a += a
            print(f'↓ {src:46s} {kb(b):>7s} → {kb(os.path.getsize(os.path.join(ROOT, dst))):>7s}  (png→jpg)')
    print(f'  {"TOTAL":46s} {kb(total_b):>7s} → {kb(total_a):>7s}   ({100 - total_a * 100 // max(total_b, 1)}% saved)')


if __name__ == '__main__':
    main()
