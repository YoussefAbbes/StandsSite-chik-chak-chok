"""Cut the gold calligraphy title out of the poster artwork into a transparent WebP.
Usage: python -I tools/cut_title.py <poster.pdf> <out.webp> [x0 y0 x1 y1 as fractions]"""
import sys
import numpy as np, cv2
from PIL import Image
import pypdf

pdf, out = sys.argv[1], sys.argv[2]
box = [float(v) for v in sys.argv[3:7]] or [0.17, 0.225, 0.89, 0.425]
img = pypdf.PdfReader(pdf).pages[0].images[0]
a = cv2.imdecode(np.frombuffer(img.data, np.uint8), cv2.IMREAD_COLOR)
h, w = a.shape[:2]
x0, y0, x1, y1 = int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
crop = a[y0:y1, x0:x1].astype(np.float32)
b, g, r = cv2.split(crop)
# Gold has a strong green channel; the red velvet/smoke background does not.
alpha = np.clip((g - 70) / 110, 0, 1)
alpha = cv2.GaussianBlur(alpha, (0, 0), 1.2)
rgba = np.dstack([r, g, b, alpha * 255]).astype(np.uint8)
im = Image.fromarray(rgba, 'RGBA')
bbox = im.getbbox()
im = im.crop(bbox)
im.thumbnail((1200, 1200), Image.LANCZOS)
im.save(out, 'WEBP', quality=88, method=6)
print(out, im.size)
