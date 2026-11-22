"""Cut the gold calligraphy title out of the poster artwork into a transparent WebP.
Usage: python -I tools/cut_title.py <poster.pdf> <out.webp> [x0 y0 x1 y1 as fractions]"""
import sys
import numpy as np, cv2
from PIL import Image
import pypdf

pdf, out = sys.argv[1], sys.argv[2]
box = [float(v) for v in sys.argv[3:7]] or [0.135, 0.226, 0.872, 0.43]
# thin lines of the poster's arch that reach into the top corners (crop-relative triangles)
ERASE = [[(0, 0), (0.13, 0), (0, 0.5)], [(0.88, 0), (1, 0), (1, 0.16)]]
img = pypdf.PdfReader(pdf).pages[0].images[0]
a = cv2.imdecode(np.frombuffer(img.data, np.uint8), cv2.IMREAD_COLOR)
h, w = a.shape[:2]
x0, y0, x1, y1 = int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
crop = a[y0:y1, x0:x1].astype(np.float32)
b, g, r = cv2.split(crop)
# Gold has a strong green channel; the red velvet/smoke background does not.
alpha = np.clip((g - 70) / 110, 0, 1)
alpha = cv2.GaussianBlur(alpha, (0, 0), 1.2)
ch, cw = alpha.shape
for tri in ERASE:
    cv2.fillPoly(alpha, [np.int32([(x * cw, y * ch) for x, y in tri])], 0)
rgba = np.dstack([r, g, b, alpha * 255]).astype(np.uint8)
im = Image.fromarray(rgba, 'RGBA')
bbox = im.getbbox()
im = im.crop(bbox)
im.thumbnail((1200, 1200), Image.LANCZOS)
im.save(out, 'WEBP', quality=88, method=6)
print(out, im.size)
