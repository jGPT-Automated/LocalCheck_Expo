# Measures spacing and alignment from a screenshot (ui-done skill, section 3).
# usage: python3 scripts/visual-qa/measure.py <png> <titleTop> <titleBottom> [<stripTop> <stripBottom>]
# Prints the ink bands down the title block (the gaps above and below the name
# must match) and, per strip cell, the ink bands (values and labels must start
# on the same rows in every cell). Coordinates are image pixels (2x).
import sys
from PIL import Image
def bands(img, x0, x1, y0, y1, thr=95):
    g = img.convert('L'); px = g.load(); rows = []
    for y in range(y0, y1):
        rows.append(any(px[x, y] > thr for x in range(x0, x1, 1)))
    out = []; start = None
    for i, r in enumerate(rows):
        if r and start is None: start = i
        if not r and start is not None: out.append((y0 + start, y0 + i)); start = None
    if start is not None: out.append((y0 + start, y1))
    return [b for b in out if b[1] - b[0] > 2]
img = Image.open(sys.argv[1]); W, H = img.size
y0, y1 = int(sys.argv[2]), int(sys.argv[3])
# Title block: left column, away from the art and the live number.
tb = bands(img, 30, int(W * 0.55), y0, y1)
print('title bands (top,bottom):', tb)
if len(tb) >= 3:
    print('gap sport->name:', tb[1][0] - tb[0][1], ' gap name->place:', tb[2][0] - tb[1][1])
if len(sys.argv) > 5:
    s0, s1 = int(sys.argv[4]), int(sys.argv[5])
    for c in range(3):
        cx0 = int(W * c / 3) + 20; cx1 = int(W * (c + 1) / 3) - 20
        print('strip cell', c, bands(img, cx0, cx1, s0, s1, 120))
