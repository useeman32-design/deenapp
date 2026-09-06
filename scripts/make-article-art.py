#!/usr/bin/env python3
"""Generate the six article thumbnails that src/data/learn.ts requires.

These files were referenced by `require('../../assets/img/articles/*.jpg')` but
never committed, so a clean clone could not build (Metro fails the whole export
on a missing asset). They are drawn procedurally — brand gradients plus an
eight-point-star lattice, the house style — so the repo stays self-contained and
nothing has to be downloaded to build. 384x384 @ q82 keeps them ~20-35 KB each.
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "img", "articles")
os.makedirs(OUT, exist_ok=True)

# name: (top colour, bottom colour, lattice colour, glow colour)
CARDS = {
    "quran-daily":   ((7, 34, 26),   (16, 76, 58),   (212, 175, 55),  (74, 227, 143)),
    "sleep-sunnah":  ((11, 16, 32),  (28, 36, 74),   (168, 186, 255), (120, 150, 255)),
    "duas-daily":    ((10, 28, 30),  (18, 74, 72),   (232, 206, 130), (90, 214, 200)),
    "night-prayer":  ((6, 10, 22),   (24, 22, 56),   (190, 170, 255), (150, 120, 255)),
    "five-pillars":  ((28, 20, 8),   (96, 62, 16),   (240, 200, 120), (243, 156, 18)),
    "kindness":      ((26, 10, 18),  (86, 30, 48),   (255, 178, 196), (255, 120, 150)),
}

S = 384


def gradient(top, bottom):
    img = Image.new("RGB", (S, S))
    px = img.load()
    for y in range(S):
        t = y / (S - 1)
        px_row = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(S):
            px[x, y] = px_row
    return img


def star(draw, cx, cy, r, colour, width):
    """Eight-point star: two squares, one rotated 45 degrees."""
    for ang in (0.0, math.pi / 4):
        pts = []
        for k in range(4):
            a = ang + k * math.pi / 2 + math.pi / 4
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        draw.polygon(pts, outline=colour, width=width)


def lattice(colour):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    step = 96
    r = 40
    for row in range(-1, S // step + 2):
        for col in range(-1, S // step + 2):
            cx = col * step + (step / 2 if row % 2 else 0)
            cy = row * step
            star(d, cx, cy, r, colour + (26,), 2)
            d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], outline=colour + (34,), width=2)
    return layer.filter(ImageFilter.GaussianBlur(0.4))


def glow(colour, cx, cy, radius, alpha):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=colour + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.45))


def vignette():
    layer = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(layer)
    d.ellipse([-S * 0.35, -S * 0.35, S * 1.35, S * 1.35], fill=255)
    layer = layer.filter(ImageFilter.GaussianBlur(S * 0.22))
    return layer


for name, (top, bottom, line, shine) in CARDS.items():
    random.seed(name)
    base = gradient(top, bottom).convert("RGBA")
    base.alpha_composite(lattice(line))
    base.alpha_composite(glow(shine, int(S * 0.72), int(S * 0.26), 120, 74))
    base.alpha_composite(glow(shine, int(S * 0.2), int(S * 0.82), 96, 44))
    # a soft crescent arc reads as the DeenLink mark without any typography
    ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.arc([S * 0.3, S * 0.34, S * 0.78, S * 0.82], start=210, end=30, fill=shine + (58,), width=3)
    base.alpha_composite(ring.filter(ImageFilter.GaussianBlur(1.2)))
    # vignette darkens the corners so the 92x92 crop in the UI stays legible
    vig = vignette()
    dark = Image.new("RGBA", (S, S), (0, 0, 0, 150))
    base = Image.composite(dark, base, vig.point(lambda v: 255 - v))
    base.convert("RGB").save(os.path.join(OUT, f"{name}.jpg"), quality=82, optimize=True)
    print("wrote", name, os.path.getsize(os.path.join(OUT, f"{name}.jpg")), "bytes")
