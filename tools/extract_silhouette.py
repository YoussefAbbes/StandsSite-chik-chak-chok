"""Extract the dancing silhouette from the LED screen in the "سنتين Shik Shak Shok" video.

The screen shows a black dancer in front of a red halo. In one steady DJ-booth shot
(frames 640-691) the screen is nearly frontal. For each frame we:
  1. track camera shake against a reference frame (phase correlation on edges),
  2. straighten the tilted screen with a perspective warp,
  3. cut the figure by *contrast* (darker than the halo right behind it) so that
     strobe frames where the whole screen goes pale still work,
  4. smooth over time, then pack the frames into a WebP sprite sheet.

Usage: python -I tools/extract_silhouette.py <video.mp4 | videos_dir> <out_dir> [preview_dir]
(with a directory, the video whose name contains 'Shik Shak Shok' and 'زمان' is used)
Writes <out_dir>/silhouette.webp and <out_dir>/silhouette.json.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

FIRST, LAST, REF = 640, 691, 656
ROI = (300, 0, 760, 560)  # x0, y0, x1, y1 in the 1280x720 frame
# Inner corners of the bulb frame in the reference frame (TL, TR, BR, BL), full-frame px.
QUAD = np.float32([[492, 52], [725, 85], [738, 375], [440, 330]])
W, H = 240, 300  # straightened screen size
FPS = 12
_yy, _xx = np.mgrid[0:H, 0:W]
_d = ((_xx - W / 2) / (W * 0.42)) ** 2 + ((_yy - H * 0.45) / (H * 0.6)) ** 2
OVAL = np.clip((0.98 - _d) / 0.14, 0, 1).astype(np.float32)


def edges(gray):
    g = cv2.GaussianBlur(gray, (0, 0), 2)
    return np.abs(cv2.Laplacian(g.astype(np.float32), cv2.CV_32F))


def figure_alpha(screen_bgr):
    v = cv2.cvtColor(screen_bgr, cv2.COLOR_BGR2HSV)[..., 2].astype(np.float32)
    # Background = the halo with the dark figure "closed over" by bright surroundings.
    bg = cv2.morphologyEx(v, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (95, 95)))
    bg = cv2.GaussianBlur(bg, (0, 0), 10)
    ratio = v / (bg + 1)
    a = np.clip((0.72 - ratio) / 0.22, 0, 1) * np.clip((bg - 45) / 45, 0, 1)
    # keep the main body: largest blob that crosses the centre column
    m = (a > 0.5).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        return np.zeros_like(a)
    centre = lab[: int(H * 0.6), W // 2 - 20: W // 2 + 20]
    ids, counts = np.unique(centre[centre > 0], return_counts=True)
    keep = ids[np.argmax(counts)] if len(ids) else 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    body = cv2.dilate((lab == keep).astype(np.uint8), np.ones((5, 5), np.uint8))
    return a * body


def main():
    video, out_dir = sys.argv[1], sys.argv[2]
    if os.path.isdir(video):
        video = next(os.path.join(video, n) for n in sorted(os.listdir(video))
                     if n.endswith('.mp4') and 'Shik Shak Shok' in n and 'زمان' in n)
    preview = sys.argv[3] if len(sys.argv) > 3 else None
    cap = cv2.VideoCapture(video)
    cap.set(cv2.CAP_PROP_POS_FRAMES, FIRST)
    x0, y0, x1, y1 = ROI
    frames = {}
    for i in range(FIRST, LAST + 1):
        ok, fr = cap.read()
        if not ok:
            break
        frames[i] = fr
    ref = edges(cv2.cvtColor(frames[REF][y0:y1, x0:x1], cv2.COLOR_BGR2GRAY))
    win = cv2.createHanningWindow(ref.shape[::-1], cv2.CV_32F)
    dst = np.float32([[0, 0], [W, 0], [W, H], [0, H]])

    alphas = []
    for i, fr in frames.items():
        cur = edges(cv2.cvtColor(fr[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY))
        (dx, dy), resp = cv2.phaseCorrelate(ref, cur, win)
        if resp < 0.04 or abs(dx) > 60 or abs(dy) > 60:
            continue  # tracking lost (cut, heavy motion blur)
        M = cv2.getPerspectiveTransform(QUAD + np.float32([dx, dy]), dst)
        screen = cv2.warpPerspective(fr, M, (W, H), flags=cv2.INTER_CUBIC)
        a = figure_alpha(screen)
        if a.sum() < 2500:  # figure lost in a full white strobe
            continue
        alphas.append((i, a))
    # drop frames whose shape disagrees with the typical pose (half-strobed, glitched)
    binary = np.stack([a > 0.5 for _, a in alphas])
    typical = np.median(binary, axis=0) > 0.5
    def iou(m):
        return (m & typical).sum() / max(1, (m | typical).sum())
    alphas = [fa for fa, m in zip(alphas, binary) if iou(m) > 0.72]
    print('usable frames:', [i for i, _ in alphas])

    # temporal median over 3 frames kills strobe flicker; then smooth the edge
    stack = np.stack([a for _, a in alphas])
    smooth = []
    for k in range(len(stack)):
        lo, hi = max(0, k - 1), min(len(stack), k + 2)
        m = np.median(stack[lo:hi], axis=0)
        m = cv2.GaussianBlur(m, (0, 0), 1.4)
        m = np.clip((m - 0.35) / 0.3, 0, 1)
        # fade the legs out like the LED artwork does under the calligraphy
        fade = np.clip((H * 0.96 - np.arange(H)) / (H * 0.25), 0, 1)[:, None]
        m = m * fade * OVAL  # oval around the dancer drops the screen's corner wedges
        # keep only the dancer: the blob crossing the centre column (drops frame corners)
        n, lab, _, _ = cv2.connectedComponentsWithStats((m > 0.05).astype(np.uint8))
        centre = lab[: int(H * 0.6), W // 2 - 15: W // 2 + 15]
        ids, counts = np.unique(centre[centre > 0], return_counts=True)
        if len(ids):
            m = m * (lab == ids[np.argmax(counts)])
        smooth.append(m)

    # ping-pong so the loop has no jump, then resample to FPS
    seq = smooth + smooth[-2:0:-1]
    src_fps = 25 * len(smooth) / max(1, (alphas[-1][0] - alphas[0][0] + 1))
    step = max(1, round(src_fps / FPS))
    seq = seq[::step]
    cols = 8
    rows = -(-len(seq) // cols)
    sheet = np.zeros((rows * H, cols * W, 4), np.uint8)
    for k, a in enumerate(seq):
        r, c = divmod(k, cols)
        tile = sheet[r * H:(r + 1) * H, c * W:(c + 1) * W]
        tile[..., :3] = 8  # near-black figure
        tile[..., 3] = (a * 255).astype(np.uint8)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, 'silhouette.webp')
    Image.fromarray(sheet, 'RGBA').save(path, 'WEBP', quality=80, method=6)
    meta = {'frames': len(seq), 'cols': cols, 'w': W, 'h': H, 'fps': FPS}
    json.dump(meta, open(os.path.join(out_dir, 'silhouette.json'), 'w'))
    print(meta, os.path.getsize(path), 'bytes')

    if preview:
        prev = np.full((rows * H, cols * W, 3), (30, 30, 200), np.uint8)
        alpha = sheet[..., 3:4] / 255.0
        prev = (prev * (1 - alpha) + 8 * alpha).astype(np.uint8)
        cv2.imwrite(os.path.join(preview, 'sheet_preview.jpg'), cv2.resize(prev, (cols * W // 2, rows * H // 2)))


if __name__ == '__main__':
    main()
