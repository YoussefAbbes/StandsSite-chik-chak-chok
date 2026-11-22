"""Put a party-styled vector QR code for the site into the empty frame of the A2 poster.

Style: soft rounded-square burgundy dots on cream, rounded finder "eyes", gold double border with
sparkles, and a gold medallion with the dancing silhouette in the centre. The centre
is allowed to cover modules: it hides ~4% of the code, well within error-correction level Q (25%).
(Q instead of H keeps the longer repo URL at 41x41 modules, so each dot stays big enough to scan from afar.)

Usage: python -I tools/make_qr_poster.py <poster.pdf> <out_dir> [silhouette.webp]
Writes: <out_dir>/Shik_Shak_Shok_A2_Print_QR.pdf, <out_dir>/qr/qr.svg, <out_dir>/qr/qr.png,
        <out_dir>/qr/poster_preview.jpg, and verifies the code decodes at several sizes.
"""
import base64
import io
import math
import os
import sys

import cv2
import numpy as np
import pypdf
from PIL import Image, ImageDraw
from reportlab.graphics.barcode.qrencoder import QRCode, QRErrorCorrectLevel
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

URL = 'https://youssefabbes.github.io/students_committee_chikchakchok/'
DARK, CREAM, GOLD, GOLD_LIGHT, RED = '#2a0306', '#fff6e6', '#c8902e', '#f2c15b', '#c41e17'
FRAME_CENTER = (3608, 5981)  # inside of the poster's empty frame (4961x7016 artwork px)
CARD_PX = 700                # card side on the artwork (~5.9 cm)
MARGIN = 4                   # card margin around the code, in modules (quiet zone + border)
DOT_R = 0.46                 # half-size of a data dot, in modules
DOT_ROUND = 0.25             # corner radius of a data dot (soft square; pure circles scanned worse)
LOGO_R = 4.4                 # centre medallion radius, in modules (blanks ~6% of the code)


def qr_matrix(url):
    qr = QRCode(None, QRErrorCorrectLevel.Q)
    qr.addData(url)
    qr.make()
    n = qr.getModuleCount()
    return [[bool(qr.isDark(r, c)) for c in range(n)] for r in range(n)]


def star(cx, cy, r):
    """4-point sparkle polygon."""
    pts = []
    for k in range(8):
        a = math.pi / 4 * k - math.pi / 2
        rr = r if k % 2 == 0 else r * 0.28
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def shapes(matrix):
    """All drawing in module units, origin top-left of the card. Rendered to PNG/SVG/PDF."""
    n = len(matrix)
    N = n + 2 * MARGIN
    c = N / 2
    out = [('rrect', 0, 0, N, N, 2.4, CREAM, None, 0),
           ('rrect', 0.7, 0.7, N - 1.4, N - 1.4, 1.9, None, GOLD, 0.22),
           ('rrect', 1.15, 1.15, N - 2.3, N - 2.3, 1.6, None, GOLD_LIGHT, 0.07)]
    for sx, sy in [(1.9, 1.9), (N - 1.9, 1.9), (1.9, N - 1.9), (N - 1.9, N - 1.9)]:
        out.append(('poly', star(sx, sy, 0.95), GOLD))
    out += [('poly', star(c, 0.95, 0.55), GOLD), ('poly', star(c, N - 0.95, 0.55), GOLD),
            ('poly', star(0.95, c, 0.55), GOLD), ('poly', star(N - 0.95, c, 0.55), GOLD)]

    finders = [(0, 0), (n - 7, 0), (0, n - 7)]
    in_finder = lambda r, col: any(fx <= col < fx + 7 and fy <= r < fy + 7 for fx, fy in finders)
    for r, row in enumerate(matrix):
        for col, dark in enumerate(row):
            if not dark or in_finder(r, col):
                continue
            x, y = MARGIN + col + 0.5, MARGIN + r + 0.5
            if math.hypot(x - c, y - c) < LOGO_R + 0.6:
                continue  # under the medallion (recovered by error correction)
            out.append(('rrect', x - DOT_R, y - DOT_R, 2 * DOT_R, 2 * DOT_R, DOT_ROUND, DARK, None, 0))
    for fx, fy in finders:
        x, y = MARGIN + fx, MARGIN + fy
        # softly rounded eyes: fully round ones break stricter scanners (tested with OpenCV)
        out += [('rrect', x, y, 7, 7, 0.7, DARK, None, 0),
                ('rrect', x + 1, y + 1, 5, 5, 0.46, CREAM, None, 0),
                ('rrect', x + 2, y + 2, 3, 3, 0.35, DARK, None, 0)]
    out += [('circle', c, c, LOGO_R, GOLD), ('circle', c, c, LOGO_R - 0.35, GOLD_LIGHT),
            ('circle', c, c, LOGO_R - 0.7, RED), ('dancer', c, c, LOGO_R - 0.9)]
    return N, out


def dancer_image(sheet_path):
    sheet = Image.open(sheet_path).convert('RGBA')
    tile = sheet.crop((0, 0, 240, 300))
    return tile.crop(tile.getbbox())


def render_png(N, items, size_px, dancer, ss=3):
    s = size_px * ss / N
    img = Image.new('RGBA', (size_px * ss, size_px * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for it in items:
        kind = it[0]
        if kind == 'rrect':
            _, x, y, w, h, rad, fill, stroke, sw = it
            d.rounded_rectangle([x * s, y * s, (x + w) * s, (y + h) * s], radius=rad * s,
                                fill=fill, outline=stroke, width=max(1, round(sw * s)) if stroke else 0)
        elif kind == 'circle':
            _, x, y, r, fill = it
            d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=fill)
        elif kind == 'poly':
            d.polygon([(px * s, py * s) for px, py in it[1]], fill=it[2])
        elif kind == 'dancer':
            _, x, y, r = it
            # a soft glow behind the dancer, then the silhouette fitted inside the circle
            glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
            ImageDraw.Draw(glow).ellipse([(x - r * 0.55) * s, (y - r * 0.75) * s, (x + r * 0.55) * s, (y + r * 0.1) * s], fill=(255, 210, 120, 150))
            img.alpha_composite(glow.filter(__import__('PIL.ImageFilter', fromlist=['GaussianBlur']).GaussianBlur(r * s * 0.25)))
            h = 2 * r * 0.92 * s
            dw = round(dancer.width * h / dancer.height)
            fig = dancer.resize((dw, round(h)), Image.LANCZOS)
            mask = Image.new('L', img.size, 0)
            ImageDraw.Draw(mask).ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=255)
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            layer.alpha_composite(fig, (round(x * s - dw / 2), round((y - r * 0.82) * s)))
            layer.putalpha(Image.fromarray(np.minimum(np.array(layer.getchannel('A')), np.array(mask))))
            img.alpha_composite(layer)
    return img.resize((size_px, size_px), Image.LANCZOS)


def write_svg(N, items, path, dancer_png):
    parts = []
    for it in items:
        kind = it[0]
        if kind == 'rrect':
            _, x, y, w, h, rad, fill, stroke, sw = it
            style = f'fill="{fill}"' if fill else 'fill="none"'
            if stroke:
                style += f' stroke="{stroke}" stroke-width="{sw}"'
            parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rad}" {style}/>')
        elif kind == 'circle':
            _, x, y, r, fill = it
            parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="{fill}"/>')
        elif kind == 'poly':
            pts = ' '.join(f'{px:.3f},{py:.3f}' for px, py in it[1])
            parts.append(f'<polygon points="{pts}" fill="{it[2]}"/>')
        elif kind == 'dancer':
            _, x, y, r = it
            b64 = base64.b64encode(dancer_png).decode()
            parts.append(f'<clipPath id="m"><circle cx="{x}" cy="{y}" r="{r}"/></clipPath>'
                         f'<image clip-path="url(#m)" href="data:image/png;base64,{b64}" x="{x - r}" y="{y - r}" width="{2 * r}" height="{2 * r}"/>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}">{"".join(parts)}</svg>'
    open(path, 'w', encoding='utf8').write(svg)


def overlay_pdf(N, items, page_w, page_h, img_w, img_h, dancer_png):
    k = page_w / img_w
    side = CARD_PX * k
    cx, cy = FRAME_CENTER[0] * k, (img_h - FRAME_CENTER[1]) * k
    x0, top = cx - side / 2, cy + side / 2
    u = side / N
    X = lambda x: x0 + x * u
    Y = lambda y: top - y * u  # PDF y grows upward
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))
    for it in items:
        kind = it[0]
        if kind == 'rrect':
            _, x, y, w, h, rad, fill, stroke, sw = it
            if fill:
                c.setFillColor(HexColor(fill))
            if stroke:
                c.setStrokeColor(HexColor(stroke))
                c.setLineWidth(sw * u)
            c.roundRect(X(x), Y(y + h), w * u, h * u, rad * u, stroke=1 if stroke else 0, fill=1 if fill else 0)
        elif kind == 'circle':
            _, x, y, r, fill = it
            c.setFillColor(HexColor(fill))
            c.circle(X(x), Y(y), r * u, stroke=0, fill=1)
        elif kind == 'poly':
            c.setFillColor(HexColor(it[2]))
            p = c.beginPath()
            pts = it[1]
            p.moveTo(X(pts[0][0]), Y(pts[0][1]))
            for px, py in pts[1:]:
                p.lineTo(X(px), Y(py))
            p.close()
            c.drawPath(p, stroke=0, fill=1)
        elif kind == 'dancer':
            _, x, y, r = it
            c.drawImage(ImageReader(io.BytesIO(dancer_png)), X(x - r), Y(y + r), 2 * r * u, 2 * r * u, mask='auto')
    c.save()
    return pypdf.PdfReader(buf).pages[0]


def medallion_png(N, items, dancer):
    """The centre (red disc + dancer) as its own transparent PNG for SVG/PDF embedding."""
    r_disc = LOGO_R - 0.7
    c = N / 2
    sub = [('circle', c, c, r_disc, RED)] + [it for it in items if it[0] == 'dancer']
    full = render_png(N, sub, 1600, dancer)
    px = 1600 / N
    box = [round((c - r_disc) * px), round((c - r_disc) * px), round((c + r_disc) * px), round((c + r_disc) * px)]
    out = io.BytesIO()
    full.crop(box).save(out, 'PNG')
    return out.getvalue()


def decode(img_bgr):
    text, _, _ = cv2.QRCodeDetector().detectAndDecode(img_bgr)
    return text


def main():
    poster, out_dir = sys.argv[1], sys.argv[2]
    sheet = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'silhouette.webp')
    os.makedirs(os.path.join(out_dir, 'qr'), exist_ok=True)
    dancer = dancer_image(sheet)
    matrix = qr_matrix(URL)
    N, items = shapes(matrix)
    med = medallion_png(N, items, dancer)
    # SVG/PDF draw the red disc + dancer from the medallion PNG
    vec_items = [it for it in items if not (it[0] == 'circle' and it[4] == RED) and it[0] != 'dancer']
    vec_items.append(('dancer', N / 2, N / 2, LOGO_R - 0.7))

    write_svg(N, vec_items, os.path.join(out_dir, 'qr', 'qr.svg'), med)
    png = render_png(N, items, 2000, dancer)
    png_path = os.path.join(out_dir, 'qr', 'qr.png')
    png.save(png_path)

    reader = pypdf.PdfReader(poster)
    page = reader.pages[0]
    art = cv2.imdecode(np.frombuffer(page.images[0].data, np.uint8), cv2.IMREAD_COLOR)
    img_h, img_w = art.shape[:2]
    page.merge_page(overlay_pdf(N, vec_items, float(page.mediabox.width), float(page.mediabox.height), img_w, img_h, med))
    writer = pypdf.PdfWriter()
    writer.add_page(page)
    out_pdf = os.path.join(out_dir, 'Shik_Shak_Shok_A2_Print_QR.pdf')
    with open(out_pdf, 'wb') as fh:
        writer.write(fh)

    # Preview on the artwork + scan checks at several sizes, like phones at different distances.
    card = render_png(N, items, CARD_PX, dancer)
    x0, y0 = FRAME_CENTER[0] - CARD_PX // 2, FRAME_CENTER[1] - CARD_PX // 2
    prev = Image.fromarray(cv2.cvtColor(art, cv2.COLOR_BGR2RGB)).convert('RGBA')
    prev.alpha_composite(card, (x0, y0))
    prev = cv2.cvtColor(np.array(prev.convert('RGB')), cv2.COLOR_RGB2BGR)
    cv2.imwrite(os.path.join(out_dir, 'qr', 'poster_preview.jpg'), cv2.resize(prev, (img_w // 4, img_h // 4)), [cv2.IMWRITE_JPEG_QUALITY, 88])

    region = prev[y0 - 150:y0 + CARD_PX + 150, x0 - 150:x0 + CARD_PX + 150]
    failures = 0
    on_white = Image.new('RGBA', png.size, 'white')
    on_white.alpha_composite(png)
    h_, w_ = region.shape[:2]
    rot = cv2.warpAffine(region, cv2.getRotationMatrix2D((w_ / 2, h_ / 2), 12, 0.6), (w_, h_), borderValue=(20, 4, 5))
    src = np.float32([[0, 0], [w_, 0], [w_, h_], [0, h_]])
    dst = np.float32([[w_ * .08, h_ * .05], [w_ * .92, 0], [w_, h_], [0, h_ * .95]])
    tilt = cv2.resize(cv2.warpPerspective(region, cv2.getPerspectiveTransform(src, dst), (w_, h_)), None, fx=.5, fy=.5)
    for label, im in [('png 2000px', cv2.cvtColor(np.array(on_white.convert('RGB')), cv2.COLOR_RGB2BGR)),
                      ('poster rotated 12deg', rot), ('poster perspective', tilt)] + [
        (f'poster @{int(f * 100)}%', cv2.resize(region, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)) for f in (1.0, 0.5, 0.3, 0.2)
    ] + [('poster blurred', cv2.GaussianBlur(cv2.resize(region, None, fx=0.4, fy=0.4), (0, 0), 1.2))]:
        ok = decode(im) == URL
        failures += not ok
        print(f'decode {label}: {"OK" if ok else "FAIL"}')
    print(f'QR card {CARD_PX / img_w * 420:.0f} mm, {len(matrix)}x{len(matrix)} modules (level Q); wrote {out_pdf}')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
