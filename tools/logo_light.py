"""Recolour the black parts of the ESPRIT Student Committee logo to cream for a dark background.
Usage: python -I tools/logo_light.py <logo-removebg.png> <out.png>"""
import sys
import numpy as np
from PIL import Image

im = np.array(Image.open(sys.argv[1]).convert('RGBA')).astype(np.int16)
r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
red = (r > 120) & (r - g > 60)
dark = ~red & (a > 0)
lum = (r + g + b) / 3
# dark ink -> cream; grey "COMMITTEE"/"it" -> light gold-grey, keep their relative tone
im[..., 0] = np.where(dark, 245 - (lum * 0.25), r)
im[..., 1] = np.where(dark, 239 - (lum * 0.3), g)
im[..., 2] = np.where(dark, 230 - (lum * 0.4), b)
out = Image.fromarray(im.clip(0, 255).astype(np.uint8), 'RGBA')
out = out.crop(out.getbbox())
out.save(sys.argv[2], optimize=True)
print(sys.argv[2], out.size)
