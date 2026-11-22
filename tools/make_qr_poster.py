"""Put a vector QR code for the site into the empty frame of the A2 poster.

Usage: python -I tools/make_qr_poster.py <poster.pdf> <out_dir>
Writes: <out_dir>/Shik_Shak_Shok_A2_Print_QR.pdf, <out_dir>/qr/qr.svg, <out_dir>/qr/qr.png,
        <out_dir>/qr/poster_preview.jpg (for a visual check) and verifies the code decodes.
"""
import io
import os
import sys

import cv2
import numpy as np
import pypdf
from PIL import Image, ImageDraw
from reportlab.graphics.barcode.qrencoder import QRCode, QRErrorCorrectLevel
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

URL = 'https://youssefabbes.github.io/StandsSite-chik-chak-chok/'
DARK, CREAM = '#1a0405', '#fff6e6'
# Inside of the poster's empty frame, in pixels of the 4961x7016 artwork (300 dpi).
FRAME_CENTER = (3608, 5981)
CARD_PX = 700          # cream card side (~5.9 cm)
QUIET_MODULES = 2      # white margin around the code, in modules


def qr_matrix(url):
    qr = QRCode(None, QRErrorCorrectLevel.M)
    qr.addData(url)
    qr.make()
    n = qr.getModuleCount()
    return [[bool(qr.isDark(r, c)) for c in range(n)] for r in range(n)]


def write_svg(matrix, path):
    n = len(matrix) + 2 * QUIET_MODULES
    rects = ''.join(
        f'<rect x="{c + QUIET_MODULES}" y="{r + QUIET_MODULES}" width="1" height="1"/>'
        for r, row in enumerate(matrix) for c, dark in enumerate(row) if dark
    )
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
           f'<rect width="{n}" height="{n}" rx="1.2" fill="{CREAM}"/><g fill="{DARK}">{rects}</g></svg>')
    open(path, 'w', encoding='utf8').write(svg)


def render_png(matrix, size_px):
    n = len(matrix) + 2 * QUIET_MODULES
    scale = size_px / n
    img = Image.new('RGB', (size_px, size_px), CREAM)
    d = ImageDraw.Draw(img)
    for r, row in enumerate(matrix):
        for c, dark in enumerate(row):
            if dark:
                x, y = (c + QUIET_MODULES) * scale, (r + QUIET_MODULES) * scale
                d.rectangle([round(x), round(y), round(x + scale) - 1, round(y + scale) - 1], fill=DARK)
    return img


def overlay_pdf(matrix, page_w, page_h, img_w, img_h):
    """One-page PDF (same size as the poster) with the card + modules as vectors."""
    k = page_w / img_w  # points per artwork pixel
    side = CARD_PX * k
    cx, cy = FRAME_CENTER[0] * k, (img_h - FRAME_CENTER[1]) * k
    x0, y0 = cx - side / 2, cy - side / 2
    n = len(matrix) + 2 * QUIET_MODULES
    m = side / n
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))
    c.setFillColor(HexColor(CREAM))
    c.roundRect(x0, y0, side, side, m * 1.2, stroke=0, fill=1)
    c.setFillColor(HexColor(DARK))
    for r, row in enumerate(matrix):
        for col, dark in enumerate(row):
            if dark:
                # tiny overlap avoids hairline gaps between modules in some viewers
                c.rect(x0 + (col + QUIET_MODULES) * m, y0 + side - (r + QUIET_MODULES + 1) * m,
                       m + 0.05, m + 0.05, stroke=0, fill=1)
    c.save()
    return pypdf.PdfReader(buf).pages[0]


def main():
    poster, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.join(out_dir, 'qr'), exist_ok=True)
    matrix = qr_matrix(URL)

    write_svg(matrix, os.path.join(out_dir, 'qr', 'qr.svg'))
    png = render_png(matrix, 2000)
    png_path = os.path.join(out_dir, 'qr', 'qr.png')
    png.save(png_path)

    reader = pypdf.PdfReader(poster)
    page = reader.pages[0]
    art = page.images[0]
    art_img = cv2.imdecode(np.frombuffer(art.data, np.uint8), cv2.IMREAD_COLOR)
    img_h, img_w = art_img.shape[:2]
    page_w, page_h = float(page.mediabox.width), float(page.mediabox.height)
    page.merge_page(overlay_pdf(matrix, page_w, page_h, img_w, img_h))
    writer = pypdf.PdfWriter()
    writer.add_page(page)
    out_pdf = os.path.join(out_dir, 'Shik_Shak_Shok_A2_Print_QR.pdf')
    with open(out_pdf, 'wb') as fh:
        writer.write(fh)

    # Preview: same placement drawn onto the artwork, then decode it like a phone would.
    card = cv2.cvtColor(np.array(render_png(matrix, CARD_PX)), cv2.COLOR_RGB2BGR)
    x0, y0 = FRAME_CENTER[0] - CARD_PX // 2, FRAME_CENTER[1] - CARD_PX // 2
    preview = art_img.copy()
    preview[y0:y0 + CARD_PX, x0:x0 + CARD_PX] = card
    cv2.imwrite(os.path.join(out_dir, 'qr', 'poster_preview.jpg'),
                cv2.resize(preview, (img_w // 4, img_h // 4)), [cv2.IMWRITE_JPEG_QUALITY, 88])

    det = cv2.QRCodeDetector()
    for name, im in [('png', cv2.imread(png_path)),
                     ('poster', cv2.resize(preview[y0 - 200:y0 + CARD_PX + 200, x0 - 200:x0 + CARD_PX + 200], None, fx=0.5, fy=0.5))]:
        text, _, _ = det.detectAndDecode(im)
        status = 'OK' if text == URL else 'FAIL'
        print(f'decode {name}: {status} -> {text!r}')
        if text != URL:
            sys.exit(1)
    mm = CARD_PX / img_w * 420
    print(f'QR card: {mm:.0f} mm wide, {len(matrix)}x{len(matrix)} modules; wrote {out_pdf}')


if __name__ == '__main__':
    main()
