"""
Havlo — 30-post Instagram series · v2
7-style rotation produced via canvas-design + ui-ux-pro-max intelligence.

Outputs 30 unique 1080x1080 PNGs to ./
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import json, math, random

# ─── PATHS ───────────────────────────────────────────────────────────────
FONTS_DIR = Path("/Users/admin/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/e94b7b67-a20e-4fbb-b354-371655122708/77b20486-865b-45b9-b529-baf10f72c2fe/skills/canvas-design/canvas-fonts")
OUT_DIR   = Path("/Users/admin/Havlo/outputs/havlo-instagram/30days/v2")
DATA_PATH = Path("/Users/admin/Havlo/outputs/havlo-instagram/real-data.json")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── CANVAS ──────────────────────────────────────────────────────────────
SS = 2
W  = 1080 * SS
H  = 1080 * SS

# ─── PALETTES ────────────────────────────────────────────────────────────
# Havlo core
INK   = (15, 23, 42)
INK2  = (71, 85, 105)
INK3  = (148, 163, 184)
BLUE  = (0, 87, 255)
GREEN = (16, 185, 129)
GREEN_BG = (236, 253, 245)
WHITE = (255, 255, 255)
OFFWHITE = (247, 248, 250)
PAPER = (250, 248, 243)
BORDER = (226, 232, 240)

# Neo-Brutalism (S2)
NB_CREAM  = (255, 253, 245)
NB_RED    = (255, 107, 107)
NB_YELLOW = (255, 217, 61)
NB_VIOLET = (191, 138, 240)
NB_BLACK  = (15, 23, 42)

# Vibrant Block (S7) – brand-blue inversions
VB_BLUE   = (0, 87, 255)
VB_YELLOW = (255, 217, 61)

# ─── FONTS ───────────────────────────────────────────────────────────────
def load(name, size):
    return ImageFont.truetype(str(FONTS_DIR / name), size * SS)

# Brand stack (S1, S6, S7)
F_BG_BOLD     = lambda s: load("BricolageGrotesque-Bold.ttf", s)
F_BG_REG      = lambda s: load("BricolageGrotesque-Regular.ttf", s)
F_IS_BOLD     = lambda s: load("InstrumentSans-Bold.ttf", s)
F_IS_REG      = lambda s: load("InstrumentSans-Regular.ttf", s)
F_IS_BOLDIT   = lambda s: load("InstrumentSans-BoldItalic.ttf", s)
F_WS_REG      = lambda s: load("WorkSans-Regular.ttf", s)
F_WS_BOLD     = lambda s: load("WorkSans-Bold.ttf", s)
F_GEIST       = lambda s: load("GeistMono-Regular.ttf", s)
F_GEIST_BOLD  = lambda s: load("GeistMono-Bold.ttf", s)

# Neo-Brutalism stack (S2) - Outfit Bold + BigShoulders for impact
F_OUTFIT_BOLD = lambda s: load("Outfit-Bold.ttf", s)
F_BS_BOLD     = lambda s: load("BigShoulders-Bold.ttf", s)
F_BS_REG      = lambda s: load("BigShoulders-Regular.ttf", s)

# Monochrome Editorial stack (S3) - Boldonse + CrimsonPro + JetBrainsMono
F_BOLDONSE    = lambda s: load("Boldonse-Regular.ttf", s)
F_GLOOCK      = lambda s: load("Gloock-Regular.ttf", s)
F_CRIMSON_REG = lambda s: load("CrimsonPro-Regular.ttf", s)
F_CRIMSON_BOLD= lambda s: load("CrimsonPro-Bold.ttf", s)
F_CRIMSON_IT  = lambda s: load("CrimsonPro-Italic.ttf", s)
F_JB_REG      = lambda s: load("JetBrainsMono-Regular.ttf", s)
F_JB_BOLD     = lambda s: load("JetBrainsMono-Bold.ttf", s)

# Classic Serif stack (S4)
F_LB_REG      = lambda s: load("LibreBaskerville-Regular.ttf", s)
F_INST_SERIF_IT = lambda s: load("InstrumentSerif-Italic.ttf", s)
F_INST_SERIF_REG = lambda s: load("InstrumentSerif-Regular.ttf", s)

# Magazine stack (S5) - Gloock as Bodoni-like + WorkSans as Public Sans
# (already loaded above)

# ─── PRIMITIVES ──────────────────────────────────────────────────────────
def text_w(d, text, font):
    b = d.textbbox((0, 0), text, font=font); return b[2] - b[0]

def text_h(d, text, font):
    b = d.textbbox((0, 0), text, font=font); return b[3] - b[1]

def text_size(d, text, font):
    b = d.textbbox((0, 0), text, font=font); return b[2] - b[0], b[3] - b[1]

def wordmark(d, x, y, color=INK, size=26):
    d.text((x, y), "havlo", fill=color, font=F_IS_BOLD(size))

def chip(d, label, x, y, bg=OFFWHITE, fg=INK, pad_h=14, pad_v=8, font=None):
    if font is None: font = F_GEIST(16)
    ph = pad_h * SS; pv = pad_v * SS
    w = text_w(d, label, font); h = text_h(d, label, font)
    r = [x, y, x + w + ph * 2, y + h + pv * 2]
    radius = (r[3] - r[1]) // 2
    d.rounded_rectangle(r, radius=radius, fill=bg)
    d.text((x + ph, y + pv - h // 8), label, fill=fg, font=font)
    return r[2], r[3]

def hr(d, x1, x2, y, color=BORDER, weight=1):
    d.rectangle([x1, y, x2, y + weight * SS], fill=color)

def save_canvas(img, name):
    out = img.resize((1080, 1080), Image.LANCZOS)
    out.save(OUT_DIR / name, "PNG", optimize=True)
    print(f"✓ {name}")

# Paper-noise texture
def add_paper_noise(img, opacity=0.03):
    """Subtle paper noise overlay. opacity is alpha 0..1."""
    nx, ny = img.size
    noise = Image.new("L", (nx, ny))
    px = noise.load()
    rng = random.Random(42)
    for y in range(0, ny, 3):
        for x in range(0, nx, 3):
            v = rng.randint(0, 255)
            px[x, y] = v
    noise = noise.filter(ImageFilter.GaussianBlur(radius=1))
    overlay = Image.new("RGB", (nx, ny), (0, 0, 0))
    alpha = noise.point(lambda p: int(p * opacity))
    img.paste(overlay, (0, 0), alpha)

# Hard offset shadow (neo-brutalism)
def hard_shadow_rect(d, rect, offset=6, shadow_color=NB_BLACK):
    """Draw a hard offset shadow rectangle (no blur). rect = [x1,y1,x2,y2]."""
    off = offset * SS
    sr = [rect[0] + off, rect[1] + off, rect[2] + off, rect[3] + off]
    d.rectangle(sr, fill=shadow_color)

# Rotate-and-paste helper
def paste_rotated(canvas, content, x, y, angle):
    """Paste a content image onto canvas with rotation around its center."""
    rotated = content.rotate(angle, expand=True, resample=Image.BICUBIC)
    rx, ry = rotated.size
    canvas.paste(rotated, (x - rx // 2, y - ry // 2), rotated if rotated.mode == "RGBA" else None)

# Load + fit product image
def fit_product(path_str, target_w, target_h, bg_color=None):
    p = Path(path_str)
    if not p.exists():
        return Image.new("RGBA", (target_w, target_h), (255, 255, 255, 0))
    try:
        im = Image.open(p).convert("RGBA")
    except Exception:
        return Image.new("RGBA", (target_w, target_h), (255, 255, 255, 0))
    iw, ih = im.size
    ratio = min(target_w / iw, target_h / ih)
    nw = max(1, int(iw * ratio)); nh = max(1, int(ih * ratio))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas_bg = bg_color if bg_color else (255, 255, 255, 0)
    canvas = Image.new("RGBA", (target_w, target_h), canvas_bg)
    canvas.paste(im, ((target_w - nw) // 2, (target_h - nh) // 2), im)
    return canvas

# ═══════════════════════════════════════════════════════════════════════
# REAL DATA
# ═══════════════════════════════════════════════════════════════════════
with open(DATA_PATH) as f:
    PRODUCTS = json.load(f)

EXTRA = [
    {
        "title": "Samsung Galaxy S24 (256GB)",
        "brand": "samsung", "category": "phones", "country": "IN",
        "image_local": None,
        "cheap": {"store_name": "Flipkart", "display": "₹64,999"},
        "dear":  {"store_name": "Amazon India", "display": "₹79,900"},
        "saving_display": "₹14,901", "saving_pct": 19,
    },
    {
        "title": "PlayStation 5 Slim (Disc)",
        "brand": "sony", "category": "gaming", "country": "ZA",
        "image_local": None,
        "cheap": {"store_name": "Takealot", "display": "R 13,499"},
        "dear":  {"store_name": "Makro",    "display": "R 15,999"},
        "saving_display": "R 2,500", "saving_pct": 16,
    },
]

ALL_PRODUCTS = PRODUCTS[:8] + EXTRA

def short_title(t, max_len=46):
    t = t.replace('"', '"').strip()
    if len(t) > max_len:
        return t[:max_len].rsplit(" ", 1)[0] + "…"
    return t

# ═══════════════════════════════════════════════════════════════════════
# S1 — SWISS MODERNISM (Posts 1, 3, 4, 7, 10)
# ═══════════════════════════════════════════════════════════════════════
def render_s1_swiss(p, filename):
    """Strict 12-col grid · Inter-feel · single green accent · WCAG AAA."""
    img = Image.new("RGB", (W, H), OFFWHITE)
    d   = ImageDraw.Draw(img)
    pad = 64 * SS

    # Header
    chip(d, p["country"], pad, pad, bg=BLUE, fg=WHITE, font=F_GEIST_BOLD(14))
    wordmark(d, W - pad - text_w(d, "havlo", F_IS_BOLD(26)), pad + 6 * SS, color=INK, size=26)

    # Top hairline (12-col grid feel)
    hr(d, pad, W - pad, pad + 64 * SS, color=BORDER)

    # Product hero (tighter)
    img_size = 420 * SS
    img_x = (W - img_size) // 2
    img_y = pad + 90 * SS
    if p.get("image_local") and Path(p["image_local"]).exists():
        prod = fit_product(p["image_local"], img_size, img_size)
        img.paste(prod, (img_x, img_y), prod)

    # Brand + title (centered, compact)
    title_y = img_y + img_size + 24 * SS
    brand = p["brand"].upper()
    bw = text_w(d, brand, F_GEIST(14))
    d.text(((W - bw) // 2, title_y), brand, fill=INK3, font=F_GEIST(14))

    title = short_title(p["title"], 44)
    tw = text_w(d, title, F_IS_BOLD(26))
    while tw > W - pad * 2 and len(title) > 16:
        title = title[:-4] + "…"
        tw = text_w(d, title, F_IS_BOLD(26))
    d.text(((W - tw) // 2, title_y + 32 * SS), title, fill=INK2, font=F_IS_BOLD(26))

    # Comparison rows
    row_y = title_y + 90 * SS
    col_w = (W - pad * 2 - 24 * SS) // 2
    row_h = 130 * SS

    # Left (cheapest)
    L = [pad, row_y, pad + col_w, row_y + row_h]
    d.rounded_rectangle(L, radius=14 * SS, fill=GREEN_BG, outline=GREEN, width=2 * SS)
    # CHEAPEST chip overlapping
    cw = text_w(d, "CHEAPEST", F_GEIST_BOLD(13))
    ch = text_h(d, "CHEAPEST", F_GEIST_BOLD(13))
    cpx = pad + 18 * SS; cpy = row_y - 14 * SS
    d.rounded_rectangle([cpx, cpy, cpx + cw + 24 * SS, cpy + ch + 14 * SS],
                        radius=(ch + 14 * SS) // 2, fill=GREEN)
    d.text((cpx + 12 * SS, cpy + 6 * SS), "CHEAPEST", fill=WHITE, font=F_GEIST_BOLD(13))

    # Store + price
    sn = p["cheap"]["store_name"]
    snw = text_w(d, sn, F_IS_BOLD(22))
    d.text((L[0] + (col_w - snw) // 2, row_y + 22 * SS), sn, fill=INK, font=F_IS_BOLD(22))
    pr = p["cheap"]["display"]
    prw = text_w(d, pr, F_BG_BOLD(44))
    d.text((L[0] + (col_w - prw) // 2, row_y + 60 * SS), pr, fill=INK, font=F_BG_BOLD(44))

    # Right (dearer)
    R = [W - pad - col_w, row_y, W - pad, row_y + row_h]
    d.rounded_rectangle(R, radius=14 * SS, fill=WHITE, outline=BORDER, width=1 * SS)
    sn2 = p["dear"]["store_name"]
    sn2w = text_w(d, sn2, F_IS_BOLD(22))
    d.text((R[0] + (col_w - sn2w) // 2, row_y + 22 * SS), sn2, fill=INK2, font=F_IS_BOLD(22))
    pr2 = p["dear"]["display"]
    pr2w = text_w(d, pr2, F_BG_BOLD(44))
    d.text((R[0] + (col_w - pr2w) // 2, row_y + 60 * SS), pr2, fill=INK3, font=F_BG_BOLD(44))

    # Tagline
    tag_y = row_y + row_h + 36 * SS
    line1 = "Same product."
    line2 = f"{p['saving_display']} cheaper at {p['cheap']['store_name']}."
    l1w = text_w(d, line1, F_IS_BOLD(28))
    l2w = text_w(d, line2, F_IS_BOLD(28))
    if l2w > W - pad * 2:
        line2 = f"{p['saving_display']} difference."
        l2w = text_w(d, line2, F_IS_BOLD(28))
    d.text(((W - l1w) // 2, tag_y), line1, fill=INK, font=F_IS_BOLD(28))
    d.text(((W - l2w) // 2, tag_y + 38 * SS), line2, fill=INK, font=F_IS_BOLD(28))

    # Footer havlo.io (no hairline — keeps composition cleaner)
    fu = "havlo.io"
    fuw = text_w(d, fu, F_GEIST(15))
    d.text((W - pad - fuw, H - pad - 28 * SS), fu, fill=INK3, font=F_GEIST(15))

    save_canvas(img, filename)

# ═══════════════════════════════════════════════════════════════════════
# S2 — NEO-BRUTALISM (Posts 11, 12, 13, 14, 17)
# ═══════════════════════════════════════════════════════════════════════
def render_s2_brutalism(spec, filename):
    """Cream + hot red + vivid yellow · 4px black borders · hard offset shadows."""
    img = Image.new("RGB", (W, H), NB_CREAM)
    d   = ImageDraw.Draw(img)
    pad = 70 * SS

    # Header (simple)
    wordmark(d, pad, pad, color=NB_BLACK, size=26)
    spec_label = spec.get("eyebrow", "RECEIPT")
    sw = text_w(d, spec_label, F_GEIST(14))
    d.text((W - pad - sw, pad + 6 * SS), spec_label, fill=NB_BLACK, font=F_GEIST(14))

    # Title lines (massive Outfit Bold, slight rotation per line)
    lines = spec["lines"]
    line_sizes = spec.get("line_sizes", [None] * len(lines))
    line_rotations = spec.get("rotations", [-1, 1, -1, 1])
    line_highlights = spec.get("highlights", [None] * len(lines))

    start_y = int(H * 0.30)
    cur_y = start_y
    for i, line in enumerate(lines):
        sz = line_sizes[i] or 120
        font = F_OUTFIT_BOLD(sz)
        # Render line on transparent canvas, rotate, paste
        tw, th = text_size(d, line, font)
        line_img = Image.new("RGBA", (tw + 60 * SS, th + 60 * SS), (0, 0, 0, 0))
        line_d = ImageDraw.Draw(line_img)
        # Highlight box behind certain words if specified
        hl = line_highlights[i]
        if hl:
            highlight_word, hl_color = hl
            if highlight_word in line:
                idx = line.index(highlight_word)
                pre = line[:idx]
                pre_w = text_w(line_d, pre, font)
                hl_w = text_w(line_d, highlight_word, font)
                line_d.rectangle([30 * SS + pre_w - 4 * SS, 30 * SS,
                                  30 * SS + pre_w + hl_w + 4 * SS, 30 * SS + th + 4 * SS],
                                  fill=hl_color)
        line_d.text((30 * SS, 30 * SS), line, fill=NB_BLACK, font=font)
        ang = line_rotations[i % len(line_rotations)]
        rotated = line_img.rotate(ang, expand=True, resample=Image.BICUBIC)
        rx, ry = rotated.size
        img.paste(rotated, ((W - rx) // 2, cur_y), rotated)
        cur_y += int(sz * SS * 1.05)

    # Optional illustration callback
    if "illustration" in spec:
        spec["illustration"](img, d, pad)

    # Footer
    wordmark(d, pad, H - pad - 30 * SS, color=NB_BLACK, size=26)
    fu = "havlo.io"
    fuw = text_w(d, fu, F_GEIST(16))
    d.text((W - pad - fuw, H - pad - 24 * SS), fu, fill=NB_BLACK, font=F_GEIST(16))

    save_canvas(img, filename)

def ill_closed_tabs(canvas, d, pad):
    """5 tab silhouettes, 4 with red slashes, 1 yellow upright with price."""
    cy = int(H * 0.16)
    tab_w = 130 * SS; tab_h = 80 * SS
    gap = 22 * SS
    total = 5 * tab_w + 4 * gap
    start_x = (W - total) // 2
    for i in range(5):
        x = start_x + i * (tab_w + gap)
        if i == 2:  # center tab — winner
            # Hard offset shadow
            d.rectangle([x + 6 * SS, cy + 6 * SS, x + tab_w + 6 * SS, cy + tab_h + 6 * SS], fill=NB_BLACK)
            d.rectangle([x, cy, x + tab_w, cy + tab_h], fill=NB_YELLOW, outline=NB_BLACK, width=4 * SS)
            # Price bookmark
            d.rectangle([x + 30 * SS, cy - 18 * SS, x + tab_w - 30 * SS, cy + 4 * SS],
                        fill=NB_BLACK)
            d.text((x + 36 * SS, cy - 14 * SS), "£2,419", fill=NB_CREAM, font=F_GEIST_BOLD(14))
        else:
            d.rectangle([x + 4 * SS, cy + 4 * SS, x + tab_w + 4 * SS, cy + tab_h + 4 * SS], fill=NB_BLACK)
            d.rectangle([x, cy, x + tab_w, cy + tab_h], fill=NB_CREAM, outline=NB_BLACK, width=4 * SS)
            # Diagonal red slash
            d.line([(x + 10 * SS, cy + tab_h - 10 * SS), (x + tab_w - 10 * SS, cy + 10 * SS)],
                   fill=NB_RED, width=8 * SS)

def ill_scan(canvas, d, pad):
    """Stylized barcode with corner brackets + yellow offset shadow."""
    cx = W // 2
    cy = int(H * 0.50)
    bw = 360 * SS; bh = 220 * SS
    bx = cx - bw // 2; by = cy - bh // 2
    # Yellow hard offset shadow behind everything
    d.rectangle([bx + 8 * SS, by + 8 * SS, bx + bw + 8 * SS, by + bh + 8 * SS], fill=NB_YELLOW)
    # White background panel with 4px black border
    d.rectangle([bx, by, bx + bw, by + bh], fill=NB_CREAM, outline=NB_BLACK, width=4 * SS)
    # Barcode bars
    widths = [4, 8, 4, 12, 6, 4, 10, 14, 4, 6, 4, 12, 8, 4, 6, 10, 4, 8, 6, 4]
    gap = 3 * SS
    cur_x = bx + 30 * SS
    bar_y1 = by + 30 * SS; bar_y2 = by + bh - 30 * SS
    for w in widths:
        bw_px = w * SS
        if cur_x + bw_px > bx + bw - 30 * SS: break
        d.rectangle([cur_x, bar_y1, cur_x + bw_px, bar_y2], fill=NB_BLACK)
        cur_x += bw_px + gap
    # Red corner brackets
    blen = 32 * SS; bwid = 6 * SS
    inset = 16 * SS
    # TL
    d.rectangle([bx - inset, by - inset, bx - inset + blen, by - inset + bwid], fill=NB_RED)
    d.rectangle([bx - inset, by - inset, bx - inset + bwid, by - inset + blen], fill=NB_RED)
    # TR
    d.rectangle([bx + bw + inset - blen, by - inset, bx + bw + inset, by - inset + bwid], fill=NB_RED)
    d.rectangle([bx + bw + inset - bwid, by - inset, bx + bw + inset, by - inset + blen], fill=NB_RED)
    # BL
    d.rectangle([bx - inset, by + bh + inset - bwid, bx - inset + blen, by + bh + inset], fill=NB_RED)
    d.rectangle([bx - inset, by + bh + inset - blen, bx - inset + bwid, by + bh + inset], fill=NB_RED)
    # BR
    d.rectangle([bx + bw + inset - blen, by + bh + inset - bwid, bx + bw + inset, by + bh + inset], fill=NB_RED)
    d.rectangle([bx + bw + inset - bwid, by + bh + inset - blen, bx + bw + inset, by + bh + inset], fill=NB_RED)
    # Green scan line
    d.rectangle([bx - 10 * SS, cy - 3 * SS, bx + bw + 10 * SS, cy + 3 * SS], fill=GREEN)

def ill_stopwatch(canvas, d, pad):
    """A red stop-watch shape reading 'TAKE YOUR TIME' on its dial."""
    cx = W // 2
    cy = int(H * 0.20) + 90 * SS
    r = 110 * SS
    # Yellow hard shadow
    d.ellipse([cx - r + 6 * SS, cy - r + 6 * SS, cx + r + 6 * SS, cy + r + 6 * SS], fill=NB_YELLOW)
    # Red stop-watch body
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=NB_RED, outline=NB_BLACK, width=4 * SS)
    # Crown on top
    d.rectangle([cx - 20 * SS, cy - r - 20 * SS, cx + 20 * SS, cy - r + 4 * SS], fill=NB_RED, outline=NB_BLACK, width=4 * SS)
    # Dial text instead of numbers
    msg = "TAKE YOUR TIME"
    msg_w = text_w(d, msg, F_OUTFIT_BOLD(18))
    d.text((cx - msg_w // 2, cy - 8 * SS), msg, fill=NB_CREAM, font=F_OUTFIT_BOLD(18))

def ill_split_diagonal(canvas, d, pad):
    """A canvas-spanning diagonal split. Yellow triangle TL, red triangle BR."""
    # Already done in main body for post 13 — placeholder
    pass

# ═══════════════════════════════════════════════════════════════════════
# S3 — MINIMALIST MONOCHROME EDITORIAL (Posts 20, 21, 22, 24, 26, 29)
# ═══════════════════════════════════════════════════════════════════════
def render_s3_mono(spec, filename):
    """Pure B&W · paper noise · Boldonse hero + CrimsonPro body + JetBrainsMono."""
    img = Image.new("RGB", (W, H), WHITE)
    d   = ImageDraw.Draw(img)
    pad = 90 * SS

    # Subtle paper noise (apply after typography)
    # Header
    wordmark(d, pad, pad, color=INK, size=24)
    rl = spec.get("right_label", "RECEIPT")
    rw = text_w(d, rl, F_JB_REG(13))
    d.text((W - pad - rw, pad + 8 * SS), rl, fill=INK3, font=F_JB_REG(13))

    # Hero number / word
    hero = spec["hero"]
    hero_size = spec.get("hero_size", 280)
    hero_font = F_BOLDONSE(hero_size)
    hw, hh = text_size(d, hero, hero_font)
    if hw > W - pad * 2:
        # Scale down
        for s in range(hero_size, 80, -10):
            hero_font = F_BOLDONSE(s)
            hw, hh = text_size(d, hero, hero_font)
            if hw <= W - pad * 2:
                hero_size = s; break
    hero_y = int(H * 0.20)
    d.text(((W - hw) // 2, hero_y), hero, fill=INK, font=hero_font)

    # Optional sub-hero (smaller word). Wider gap above so descender on the
    # hero doesn't kiss the ascender on the sub-hero (Boldonse has dramatic
    # extents top + bottom).
    cur_y = hero_y + hh + 70 * SS
    if "sub_hero" in spec:
        sub = spec["sub_hero"]
        sub_size = spec.get("sub_hero_size", 80)
        sub_font = F_BOLDONSE(sub_size)
        sw_, sh_ = text_size(d, sub, sub_font)
        d.text(((W - sw_) // 2, cur_y), sub, fill=INK, font=sub_font)
        cur_y += sh_ + 50 * SS
    else:
        cur_y += 30 * SS

    # 4px full-bleed black divider
    d.rectangle([0, cur_y, W, cur_y + 4 * SS], fill=INK)
    cur_y += 50 * SS

    # Body line(s)
    body = spec.get("body", "")
    if body:
        body_lines = body.split("\n")
        body_font = F_CRIMSON_REG(28)
        for line in body_lines:
            lw = text_w(d, line, body_font)
            d.text(((W - lw) // 2, cur_y), line, fill=INK, font=body_font)
            cur_y += 42 * SS

    # Italic caption
    if "italic" in spec:
        cur_y += 16 * SS
        it = spec["italic"]
        it_font = F_CRIMSON_IT(22)
        lw = text_w(d, it, it_font)
        d.text(((W - lw) // 2, cur_y), it, fill=INK2, font=it_font)
        cur_y += 36 * SS

    # Mono caps caption (tracking-widest)
    if "mono_caps" in spec:
        cur_y += 30 * SS
        mc = spec["mono_caps"]
        # Add spacing between chars (tracked-widest)
        spaced = " · ".join(mc.split())
        mc_font = F_JB_REG(12)
        lw = text_w(d, spaced, mc_font)
        d.text(((W - lw) // 2, cur_y), spaced, fill=INK3, font=mc_font)

    # Bottom havlo.io
    fu = "havlo.io"
    fuw = text_w(d, fu, F_JB_REG(13))
    d.text((W - pad - fuw, H - pad - 24 * SS), fu, fill=INK3, font=F_JB_REG(13))

    add_paper_noise(img, opacity=0.025)
    save_canvas(img, filename)

# ═══════════════════════════════════════════════════════════════════════
# S4 — EDITORIAL CLASSIC SERIF (Posts 23, 28)
# ═══════════════════════════════════════════════════════════════════════
def render_s4_classic(spec, filename):
    """Cormorant-like + Libre Baskerville. Quote pull-out style."""
    img = Image.new("RGB", (W, H), PAPER)
    d   = ImageDraw.Draw(img)
    pad = 100 * SS

    # Small header
    wordmark(d, 70 * SS, 70 * SS, color=INK2, size=22)
    rl = spec.get("right_label", "FROM THE FOUNDER")
    rw = text_w(d, rl, F_LB_REG(12))
    d.text((W - 70 * SS - rw, 76 * SS), rl.upper(), fill=INK3, font=F_LB_REG(12))

    # Giant ghost quote mark (top-left)
    if spec.get("show_quote_mark", True):
        ghost_font = F_INST_SERIF_REG(420)
        d.text((pad - 40 * SS, pad - 80 * SS), '"', fill=(225, 225, 230), font=ghost_font)

    # Quote lines (Instrument Serif Italic)
    lines = spec["lines"]
    start_y = int(H * 0.32)
    line_h = 80 * SS
    for i, line in enumerate(lines):
        size = spec.get("line_size", 60)
        # First (n-1) lines italic, last line regular
        if i == len(lines) - 1 and spec.get("last_regular"):
            font = F_INST_SERIF_REG(size)
        else:
            font = F_INST_SERIF_IT(size)
        d.text((pad, start_y + i * line_h), line, fill=INK, font=font)

    # Attribution
    attr_y = start_y + len(lines) * line_h + 40 * SS
    attr = spec["attribution"]
    # Tracking-widest small caps
    attr_spaced = " ".join(attr.upper().split())
    d.text((pad, attr_y), attr_spaced, fill=INK3, font=F_LB_REG(15))

    # Bottom havlo.io
    fu = "havlo.io"
    fuw = text_w(d, fu, F_LB_REG(14))
    d.text((W - 70 * SS - fuw, H - 70 * SS - 28 * SS), fu, fill=INK3, font=F_LB_REG(14))

    save_canvas(img, filename)

# ═══════════════════════════════════════════════════════════════════════
# S5 — MAGAZINE STYLE (Posts 5, 8, 15, 18, 25)
# ═══════════════════════════════════════════════════════════════════════
def render_s5_magazine(spec, filename):
    """Gloock (Bodoni-like) headline + WorkSans body · drop cap · asymmetric grid."""
    img = Image.new("RGB", (W, H), OFFWHITE)
    d   = ImageDraw.Draw(img)
    pad = 80 * SS

    # Header
    wordmark(d, pad, pad, color=INK, size=24)
    rl = spec.get("right_label", "FEATURE")
    rw = text_w(d, rl, F_GEIST(13))
    d.text((W - pad - rw, pad + 8 * SS), rl.upper(), fill=INK3, font=F_GEIST(13))

    # Subtle column-rule hairlines (asymmetric grid feel)
    hr(d, pad, W - pad, pad + 60 * SS)

    # Eyebrow
    eyebrow = spec.get("eyebrow", "").upper()
    eyebrow_y = pad + 100 * SS
    if eyebrow:
        d.text((pad, eyebrow_y), eyebrow, fill=INK3, font=F_GEIST(15))
        eyebrow_y += 36 * SS

    # Magazine headline (Gloock for Bodoni feel)
    headlines = spec["headline"]
    hl_size = spec.get("headline_size", 140)
    head_y = eyebrow_y + 20 * SS
    for i, h in enumerate(headlines):
        hl_font = F_GLOOCK(hl_size)
        hw, hh = text_size(d, h, hl_font)
        # Scale down if too wide
        while hw > W - pad * 2 and hl_size > 50:
            hl_size -= 10
            hl_font = F_GLOOCK(hl_size)
            hw, hh = text_size(d, h, hl_font)
        d.text((pad, head_y + i * int(hl_size * SS * 0.95)), h, fill=INK, font=hl_font)

    head_end = head_y + len(headlines) * int(hl_size * SS * 0.95) + 60 * SS

    # Content illustration callback if provided
    if "illustration" in spec:
        spec["illustration"](img, d, pad, head_end)

    # Body text (Public Sans / WorkSans)
    if "body" in spec:
        body_y = H - pad - 180 * SS
        body_font = F_WS_REG(22)
        body_lines = spec["body"].split("\n")
        for i, b in enumerate(body_lines):
            d.text((pad, body_y + i * 36 * SS), b, fill=INK2, font=body_font)

    # Footer
    fu = "havlo.io"
    fuw = text_w(d, fu, F_GEIST(14))
    d.text((W - pad - fuw, H - pad - 28 * SS), fu, fill=INK3, font=F_GEIST(14))

    save_canvas(img, filename)

def ill_price_chart(canvas, d, pad, start_y):
    """A downward-curving price chart in success green."""
    chart_x1 = pad
    chart_x2 = W - pad
    chart_y1 = start_y
    chart_y2 = min(start_y + 380 * SS, H - 280 * SS)
    chart_w = chart_x2 - chart_x1
    chart_h = chart_y2 - chart_y1

    # Curve points — DECLINING
    n = 32
    points = []
    for i in range(n):
        t = i / (n - 1)
        # Start high, slow descent, accelerating
        y_norm = 0.20 + 0.55 * (1 - math.exp(-2.4 * t)) + 0.05 * math.sin(t * 5) * (1 - t)
        px = chart_x1 + t * chart_w
        py = chart_y1 + y_norm * chart_h
        points.append((px, py))

    # Area fill
    poly = points + [(chart_x2, chart_y2), (chart_x1, chart_y2)]
    d.polygon(poly, fill=GREEN_BG)
    # Line
    for i in range(len(points) - 1):
        d.line([points[i], points[i + 1]], fill=GREEN, width=8 * SS)
    # End dot
    cx, cy = points[-1]
    d.ellipse([cx - 16 * SS, cy - 16 * SS, cx + 16 * SS, cy + 16 * SS], fill=GREEN)
    # Hairline x-axis
    hr(d, chart_x1, chart_x2, chart_y2)
    # Date ticks (3)
    dates = ["Mar 23", "Apr 12", "May 28"]
    for i, dt in enumerate(dates):
        x = chart_x1 + (chart_w * i // 2)
        dt_w = text_w(d, dt, F_GEIST(13))
        anc_x = x if i == 1 else (x if i == 0 else x - dt_w)
        d.text((anc_x, chart_y2 + 14 * SS), dt, fill=INK3, font=F_GEIST(13))

def ill_lowest_badge(canvas, d, pad, start_y):
    """The 'LOWEST IN 30 DAYS' chip as the hero."""
    cy = start_y + 100 * SS
    label = "LOWEST IN 30 DAYS"
    font = F_IS_BOLD(48)
    lw, lh = text_size(d, label, font)
    pad_h = 50 * SS; pad_v = 28 * SS
    cx = W // 2
    rect = [cx - lw // 2 - pad_h - 30 * SS, cy - lh // 2 - pad_v,
            cx + lw // 2 + pad_h, cy + lh // 2 + pad_v]
    rad = (rect[3] - rect[1]) // 2
    d.rounded_rectangle(rect, radius=rad, fill=GREEN_BG, outline=GREEN, width=4 * SS)
    # Dot
    dot_x = rect[0] + 28 * SS
    d.ellipse([dot_x, cy - 10 * SS, dot_x + 20 * SS, cy + 10 * SS], fill=GREEN)
    d.text((cx - lw // 2 + 8 * SS, cy - lh // 2 - lh // 12), label, fill=GREEN, font=font)

def ill_crossborder(canvas, d, pad, start_y):
    """3 chips in a row with arrows — sticker price → +30% landed → TOTAL."""
    cy = start_y + 80 * SS
    chip_h = 110 * SS
    chip_pad_h = 24 * SS
    chips = [
        ("Sticker price",                    WHITE, BORDER, INK),
        ("+ ~30% landed",                    PAPER, BORDER, INK2),
        ("TOTAL · winning store",            GREEN_BG, GREEN, GREEN),
    ]
    # Calculate widths
    widths = []
    for label, _, _, _ in chips:
        font = F_IS_BOLD(20)
        widths.append(text_w(d, label, font) + chip_pad_h * 2)
    arrow_w = 50 * SS
    total_w = sum(widths) + arrow_w * 2
    start_x = (W - total_w) // 2
    cur_x = start_x
    for i, (label, bg, outline, color) in enumerate(chips):
        cw = widths[i]
        rect = [cur_x, cy, cur_x + cw, cy + chip_h]
        radius = chip_h // 2
        d.rounded_rectangle(rect, radius=radius, fill=bg, outline=outline, width=2 * SS)
        font = F_IS_BOLD(20)
        lw, lh = text_size(d, label, font)
        d.text((cur_x + (cw - lw) // 2, cy + (chip_h - lh) // 2 - lh // 8), label,
               fill=color, font=font)
        cur_x += cw
        if i < 2:
            # Arrow
            ay = cy + chip_h // 2
            d.rectangle([cur_x + 12 * SS, ay - 2 * SS, cur_x + arrow_w - 16 * SS, ay + 2 * SS], fill=INK3)
            # Arrow head
            ax = cur_x + arrow_w - 8 * SS
            d.polygon([(ax, ay - 10 * SS), (ax + 14 * SS, ay), (ax, ay + 10 * SS)], fill=INK3)
            cur_x += arrow_w

# ═══════════════════════════════════════════════════════════════════════
# S6 — LIQUID GLASS / PREMIUM (Posts 2, 6, 9)
# ═══════════════════════════════════════════════════════════════════════
def render_s6_premium(p, filename):
    """Translucent depth · soft gradients · premium product photography."""
    # Subtle radial-ish background using a soft top-to-bottom blend
    img = Image.new("RGB", (W, H), PAPER)
    # Add a soft top highlight via overlay (subtle)
    d = ImageDraw.Draw(img, "RGBA")
    # Translucent gradient feel: gentle blue tint at top, paper at bottom
    for i in range(H // 3):
        alpha = int(20 * (1 - i / (H // 3)))
        d.rectangle([0, i, W, i + 1], fill=(220, 230, 250, alpha))
    pad = 80 * SS

    # Header — frosted chip
    chip_label = p["country"]
    cw = text_w(d, chip_label, F_GEIST_BOLD(14))
    ch_h = 44 * SS
    chip_rect = [pad, pad, pad + cw + 36 * SS, pad + ch_h]
    radius = ch_h // 2
    d.rounded_rectangle(chip_rect, radius=radius, fill=(255, 255, 255, 200), outline=BORDER, width=1 * SS)
    d.text((pad + 18 * SS, pad + 12 * SS), chip_label, fill=INK, font=F_GEIST_BOLD(14))
    wordmark(d, W - pad - text_w(d, "havlo", F_IS_BOLD(26)), pad + 6 * SS, color=INK, size=26)

    # Hero product (tighter for S6 so headline + chips fit)
    img_size = 460 * SS
    img_x = (W - img_size) // 2
    img_y = pad + 80 * SS
    if p.get("image_local") and Path(p["image_local"]).exists():
        prod = fit_product(p["image_local"], img_size, img_size)
        img.paste(prod, (img_x, img_y), prod)

    # Two translucent glass chips
    chip_y = img_y + img_size + 30 * SS
    chip_h = 110 * SS
    chip_gap = 36 * SS
    avail_w = W - pad * 2 - chip_gap
    chip_w = avail_w // 2

    # Left — winning chip (iridescent green tint)
    L = [pad, chip_y, pad + chip_w, chip_y + chip_h]
    d.rounded_rectangle(L, radius=24 * SS, fill=(200, 240, 220, 230), outline=GREEN, width=2 * SS)
    # Dot
    d.ellipse([L[0] + 26 * SS, chip_y + chip_h // 2 - 8 * SS, L[0] + 42 * SS, chip_y + chip_h // 2 + 8 * SS], fill=GREEN)
    # Store
    sn = p["cheap"]["store_name"]
    d.text((L[0] + 56 * SS, chip_y + 26 * SS), sn, fill=INK, font=F_IS_BOLD(26))
    # Price
    pr = p["cheap"]["display"]
    d.text((L[0] + 56 * SS, chip_y + 64 * SS), pr, fill=INK, font=F_BG_BOLD(44))

    # Right — neutral translucent
    R = [W - pad - chip_w, chip_y, W - pad, chip_y + chip_h]
    d.rounded_rectangle(R, radius=24 * SS, fill=(255, 255, 255, 200), outline=BORDER, width=1 * SS)
    sn2 = p["dear"]["store_name"]
    d.text((R[0] + 36 * SS, chip_y + 26 * SS), sn2, fill=INK2, font=F_IS_BOLD(26))
    pr2 = p["dear"]["display"]
    d.text((R[0] + 36 * SS, chip_y + 64 * SS), pr2, fill=INK3, font=F_BG_BOLD(44))

    # Headline below
    head_y = chip_y + chip_h + 36 * SS
    head1 = "Same product. Same week."
    head2 = f"{p['saving_display']} between them."
    fnt = F_IS_BOLD(28)
    h1w = text_w(d, head1, fnt); h2w = text_w(d, head2, fnt)
    d.text(((W - h1w) // 2, head_y), head1, fill=INK, font=fnt)
    d.text(((W - h2w) // 2, head_y + 40 * SS), head2, fill=INK, font=fnt)

    # Footer
    fu = "havlo.io"
    fuw = text_w(d, fu, F_GEIST(15))
    d.text((W - pad - fuw, H - pad - 30 * SS), fu, fill=INK3, font=F_GEIST(15))

    save_canvas(img, filename)

# ═══════════════════════════════════════════════════════════════════════
# S7 — VIBRANT BLOCK-BASED (Posts 16, 19, 27, 30)
# ═══════════════════════════════════════════════════════════════════════
def render_s7_vibrant(spec, filename):
    """Brand blue inversion · vivid yellow block accent · 32px+ type · 7:1 contrast."""
    img = Image.new("RGB", (W, H), VB_BLUE)
    d   = ImageDraw.Draw(img)
    pad = 80 * SS

    # Header — wordmark white
    wordmark(d, pad, pad, color=WHITE, size=26)
    rl = spec.get("right_label", "")
    rw = text_w(d, rl, F_GEIST(13))
    d.text((W - pad - rw, pad + 8 * SS), rl, fill=(220, 230, 255), font=F_GEIST(13))

    # Headline lines
    headlines = spec["headlines"]
    head_size = spec.get("head_size", 130)
    head_y = int(H * 0.16)
    for i, h in enumerate(headlines):
        font = F_BG_BOLD(head_size if i == 0 else int(head_size * 0.75))
        hw = text_w(d, h, font)
        # Scale
        cur_size = head_size if i == 0 else int(head_size * 0.75)
        while hw > W - pad * 2 and cur_size > 50:
            cur_size -= 10
            font = F_BG_BOLD(cur_size)
            hw = text_w(d, h, font)
        d.text((pad, head_y), h, fill=WHITE, font=font)
        head_y += int(cur_size * SS * 1.0)

    # Optional callback for diagram / illustration
    if "illustration" in spec:
        spec["illustration"](img, d, pad, head_y)

    # Body text
    if spec.get("body"):
        body_y = H - pad - 200 * SS
        body_font = F_WS_REG(28)
        body_lines = spec["body"].split("\n")
        for i, b in enumerate(body_lines):
            d.text((pad, body_y + i * 46 * SS), b, fill=(220, 230, 255), font=body_font)

    # Footer
    fu = "havlo.io"
    fuw = text_w(d, fu, F_GEIST(15))
    d.text((W - pad - fuw, H - pad - 30 * SS), fu, fill=(220, 230, 255), font=F_GEIST(15))

    save_canvas(img, filename)

def ill_bell(canvas, d, pad, start_y):
    """Yellow block with a bell illustration."""
    block_w = W - pad * 2
    block_h = 360 * SS
    # Place block in the lower-middle region, well below the headlines
    block_y = max(start_y + 60 * SS, H - pad - 80 * SS - block_h - 240 * SS)
    # Yellow block with 4px black border
    d.rectangle([pad, block_y, pad + block_w, block_y + block_h], fill=VB_YELLOW, outline=NB_BLACK, width=4 * SS)
    # Bell illustration centered in block
    cx = W // 2; cy = block_y + block_h // 2
    r = 60 * SS
    # Concentric ripples (3)
    for i in range(3):
        rr = r + (i + 1) * 35 * SS
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=NB_BLACK, width=3 * SS)
    # Bell body (rounded top, flat bottom)
    d.rounded_rectangle([cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 3],
                        radius=r // 2, fill=NB_BLACK)
    d.rectangle([cx - r // 2, cy + r // 3, cx + r // 2, cy + r // 3 + 12 * SS], fill=NB_BLACK)
    d.ellipse([cx - 12 * SS, cy + r // 2 + 8 * SS, cx + 12 * SS, cy + r // 2 + 32 * SS], fill=NB_BLACK)
    # Caption inside block
    cap = "NEW · PRICE ALERTS"
    cw = text_w(d, cap, F_GEIST_BOLD(14))
    d.text((cx - cw // 2, block_y + block_h - 36 * SS), cap, fill=NB_BLACK, font=F_GEIST_BOLD(14))

def ill_paste_diagram(canvas, d, pad, start_y):
    """3 URL stack on left, arrow, havlo.io on right."""
    diagram_y = start_y + 60 * SS
    avail_h = H - diagram_y - 300 * SS
    box_h = 90 * SS
    gap = 28 * SS
    total_left_h = 3 * box_h + 2 * gap
    left_box_w = (W - pad * 2) * 4 // 10
    arrow_w = 100 * SS
    right_box_w = (W - pad * 2) - left_box_w - arrow_w - 40 * SS

    start_y2 = diagram_y + (avail_h - total_left_h) // 2
    left_x = pad
    urls = ["amazon.co.uk/...", "currys.co.uk/...", "argos.co.uk/..."]
    for i, u in enumerate(urls):
        y = start_y2 + i * (box_h + gap)
        rect = [left_x, y, left_x + left_box_w, y + box_h]
        d.rounded_rectangle(rect, radius=18 * SS, fill=(0, 0, 0, 0), outline=(220, 230, 255), width=3 * SS)
        d.text((left_x + 28 * SS, y + 30 * SS), u, fill=(220, 230, 255), font=F_GEIST(18))

    # Arrow
    ay = start_y2 + total_left_h // 2
    ax1 = left_x + left_box_w + 30 * SS
    ax2 = ax1 + arrow_w - 30 * SS
    d.rectangle([ax1, ay - 3 * SS, ax2, ay + 3 * SS], fill=WHITE)
    d.polygon([(ax2, ay - 18 * SS), (ax2 + 24 * SS, ay), (ax2, ay + 18 * SS)], fill=WHITE)

    # Right block (yellow)
    rx = ax2 + 40 * SS
    rect = [rx, ay - box_h // 2, rx + right_box_w, ay + box_h // 2]
    d.rounded_rectangle(rect, radius=18 * SS, fill=VB_YELLOW, outline=NB_BLACK, width=4 * SS)
    label = "havlo.io"
    lw = text_w(d, label, F_GEIST_BOLD(28))
    d.text((rx + (right_box_w - lw) // 2, ay - 14 * SS), label, fill=NB_BLACK, font=F_GEIST_BOLD(28))

def ill_input_field(canvas, d, pad, start_y):
    """A floating input field with placeholder + cursor."""
    field_w = W - pad * 2 - 100 * SS
    field_h = 100 * SS
    field_y = start_y + 80 * SS
    field_x = (W - field_w) // 2
    # Outlined input
    d.rounded_rectangle([field_x, field_y, field_x + field_w, field_y + field_h],
                        radius=18 * SS, fill=(0, 0, 0, 0), outline=WHITE, width=3 * SS)
    # Placeholder
    placeholder = "currys.co.uk/products/..."
    d.text((field_x + 32 * SS, field_y + 36 * SS), placeholder, fill=(180, 200, 255), font=F_GEIST(22))
    # Green cursor dot
    d.ellipse([field_x + 14 * SS, field_y + 38 * SS, field_x + 22 * SS, field_y + 46 * SS], fill=GREEN)

def ill_underline_link(canvas, d, pad, start_y):
    """A horizontal underline rule with 'havlo.io' floating above it."""
    cy = start_y + 200 * SS
    rule_w = 360 * SS
    rule_x = (W - rule_w) // 2
    label = "havlo.io"
    lw, lh = text_size(d, label, F_BG_BOLD(80))
    d.text(((W - lw) // 2, cy - lh - 14 * SS), label, fill=WHITE, font=F_BG_BOLD(80))
    d.rectangle([rule_x, cy + 8 * SS, rule_x + rule_w, cy + 12 * SS], fill=WHITE)
    # Caption
    cap = "(the underline is the link.)"
    cw = text_w(d, cap, F_GEIST(16))
    d.text(((W - cw) // 2, cy + 36 * SS), cap, fill=(220, 230, 255), font=F_GEIST(16))

# ═══════════════════════════════════════════════════════════════════════
# RENDER 30 POSTS
# ═══════════════════════════════════════════════════════════════════════
print("Rendering Havlo 30-post series v2 …\n")

# Build a country → product lookup for the 10 product posts
PRODUCT_BY_KEY = {
    1: PRODUCTS[0],   # LG OLED UK
    2: PRODUCTS[1],   # MBP AE
    3: PRODUCTS[2],   # Soundbar US
    4: PRODUCTS[3],   # Omen UK
    5: PRODUCTS[4],   # ROG US
    6: PRODUCTS[5],   # iPhone NG
    7: PRODUCTS[6],   # Victus AE
    8: PRODUCTS[7],   # Hisense NG
    9: EXTRA[0],      # S24 IN
    10: EXTRA[1],     # PS5 ZA
}

# S1 — Posts 1, 3, 4, 7, 10
render_s1_swiss(PRODUCT_BY_KEY[1],  "havlo-lg-oled-uk.png")
render_s1_swiss(PRODUCT_BY_KEY[3],  "havlo-soundbar-us.png")
render_s1_swiss(PRODUCT_BY_KEY[4],  "havlo-omen-uk.png")
render_s1_swiss(PRODUCT_BY_KEY[7],  "havlo-victus-ae.png")
render_s1_swiss(PRODUCT_BY_KEY[10], "havlo-ps5-za.png")

# S6 — Posts 2, 6, 9 (premium)
render_s6_premium(PRODUCT_BY_KEY[2], "havlo-mbp-m4-ae.png")
render_s6_premium(PRODUCT_BY_KEY[6], "havlo-iphone-ng.png")
render_s6_premium(PRODUCT_BY_KEY[9], "havlo-s24-in.png")

# S5 — Posts 5, 8 (product comparisons in magazine style)
def render_magazine_product(p, filename, eyebrow):
    """A simpler magazine-style product comparison."""
    img = Image.new("RGB", (W, H), OFFWHITE)
    d   = ImageDraw.Draw(img)
    pad = 80 * SS

    wordmark(d, pad, pad, color=INK, size=24)
    rl = f"FEATURE · {p['country']}"
    rw = text_w(d, rl, F_GEIST(13))
    d.text((W - pad - rw, pad + 8 * SS), rl, fill=INK3, font=F_GEIST(13))
    hr(d, pad, W - pad, pad + 60 * SS)

    # Eyebrow
    eyebrow_text = eyebrow.upper()
    d.text((pad, pad + 100 * SS), eyebrow_text, fill=INK3, font=F_GEIST(15))

    # Magazine headline (massive Gloock)
    head_text = "TWO STORES. ONE WINNER."
    hsize = 80
    hf = F_GLOOCK(hsize)
    hw = text_w(d, head_text, hf)
    while hw > W - pad * 2 and hsize > 40:
        hsize -= 5
        hf = F_GLOOCK(hsize)
        hw = text_w(d, head_text, hf)
    d.text((pad, pad + 150 * SS), head_text, fill=INK, font=hf)

    # Product hero (right-aligned)
    img_size = 440 * SS
    img_x = (W - img_size) // 2
    img_y = pad + 280 * SS
    if p.get("image_local") and Path(p["image_local"]).exists():
        prod = fit_product(p["image_local"], img_size, img_size)
        img.paste(prod, (img_x, img_y), prod)

    # Stacked prices, magazine-style
    info_y = img_y + img_size + 30 * SS
    # Cheap
    sn = p["cheap"]["store_name"]
    sn_font = F_GLOOCK(56)
    d.ellipse([pad, info_y + 24 * SS, pad + 20 * SS, info_y + 44 * SS], fill=GREEN)
    d.text((pad + 36 * SS, info_y), sn, fill=INK, font=sn_font)
    pr = p["cheap"]["display"]
    prw = text_w(d, pr, F_WS_BOLD(50))
    d.text((W - pad - prw, info_y + 8 * SS), pr, fill=INK, font=F_WS_BOLD(50))

    # Dear
    info_y2 = info_y + 80 * SS
    sn2 = p["dear"]["store_name"]
    d.text((pad + 36 * SS, info_y2), sn2, fill=INK3, font=F_GLOOCK(40))
    pr2 = p["dear"]["display"]
    pr2w = text_w(d, pr2, F_WS_BOLD(38))
    d.text((W - pad - pr2w, info_y2 + 8 * SS), pr2, fill=INK3, font=F_WS_BOLD(38))

    # Body line at very bottom
    body = f"Same week. Same SKU. {p['saving_display']} between them."
    bw_ = text_w(d, body, F_WS_REG(22))
    if bw_ > W - pad * 2:
        body = f"{p['saving_display']} between them."
        bw_ = text_w(d, body, F_WS_REG(22))
    d.text((pad, H - pad - 80 * SS), body, fill=INK2, font=F_WS_REG(22))

    # Footer
    fu = "havlo.io"
    fuw = text_w(d, fu, F_GEIST(14))
    d.text((W - pad - fuw, H - pad - 28 * SS), fu, fill=INK3, font=F_GEIST(14))

    save_canvas(img, filename)

render_magazine_product(PRODUCT_BY_KEY[5], "havlo-rog-us.png", "us · gaming")
render_magazine_product(PRODUCT_BY_KEY[8], "havlo-hisense-ng.png", "lagos · electronics · deal of the week")

# S2 — Posts 11, 12, 13, 14, 17 (neo-brutalism)
render_s2_brutalism({
    "eyebrow": "PSYCHOLOGY · 01",
    "lines": ["YOU CLOSED 4 TABS.", "WE KEPT 1 OPEN.", "THE CHEAPEST ONE."],
    "line_sizes": [80, 80, 80],
    "rotations": [-1, 1, -1],
    "highlights": [None, None, ("CHEAPEST", NB_YELLOW)],
    "illustration": ill_closed_tabs,
}, "havlo-closed-tabs.png")

render_s2_brutalism({
    "eyebrow": "VINDICATED",
    "lines": ["YOU WERE", "RIGHT.", "The other store", "was overcharging."],
    "line_sizes": [140, 180, 60, 60],
    "rotations": [-2, 1, -1, 1],
    "highlights": [None, ("RIGHT.", NB_YELLOW), None, None],
}, "havlo-vindication.png")

# Post 13 — split diagonal (custom layout)
def render_post_13():
    img = Image.new("RGB", (W, H), NB_CREAM)
    d = ImageDraw.Draw(img)
    pad = 70 * SS
    # Header
    wordmark(d, pad, pad, color=NB_BLACK, size=26)
    d.text((W - pad - text_w(d, "PLOT TWIST", F_GEIST(14)), pad + 6 * SS), "PLOT TWIST", fill=NB_BLACK, font=F_GEIST(14))

    # Diagonal split — yellow TL triangle, red BR triangle, black 6px diagonal line
    # Yellow triangle: top-right corner pulled in
    d.polygon([(0, 0), (W, 0), (0, H)], fill=NB_YELLOW)
    d.polygon([(W, 0), (W, H), (0, H)], fill=NB_RED)
    # Diagonal line
    d.line([(W, 0), (0, H)], fill=NB_BLACK, width=6 * SS)

    # Left side text — "WHAT IT KNEW"  + £89 stacked
    label_l = "WHAT IT KNEW"
    d.text((pad + 60 * SS, int(H * 0.30)), label_l, fill=NB_BLACK, font=F_GEIST_BOLD(20))
    price_l = "£89"
    d.text((pad + 60 * SS, int(H * 0.34)), price_l, fill=NB_BLACK, font=F_OUTFIT_BOLD(180))

    # Right side text — "WHAT YOU PAID" + £127 PAID (white on red)
    label_r = "WHAT YOU PAID"
    rw = text_w(d, label_r, F_GEIST_BOLD(20))
    d.text((W - pad - 60 * SS - rw, int(H * 0.62)), label_r, fill=NB_CREAM, font=F_GEIST_BOLD(20))
    price_r = "£127"
    prw = text_w(d, price_r, F_OUTFIT_BOLD(180))
    d.text((W - pad - 60 * SS - prw, int(H * 0.66)), price_r, fill=NB_CREAM, font=F_OUTFIT_BOLD(180))

    # Bottom centered line
    bottom = "This never has to happen again."
    bw_ = text_w(d, bottom, F_OUTFIT_BOLD(40))
    # Draw with white background pill so it pops over the diagonal
    pill_w = bw_ + 60 * SS
    pill_h = 80 * SS
    pill_x = (W - pill_w) // 2
    pill_y = H - 200 * SS
    d.rectangle([pill_x + 6 * SS, pill_y + 6 * SS, pill_x + pill_w + 6 * SS, pill_y + pill_h + 6 * SS], fill=NB_BLACK)
    d.rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], fill=NB_CREAM, outline=NB_BLACK, width=4 * SS)
    d.text((pill_x + 30 * SS, pill_y + 14 * SS), bottom, fill=NB_BLACK, font=F_OUTFIT_BOLD(40))

    # Footer
    wordmark(d, pad, H - pad - 30 * SS, color=NB_BLACK, size=22)
    fu = "havlo.io"
    fuw = text_w(d, fu, F_GEIST(15))
    d.text((W - pad - fuw, H - pad - 24 * SS), fu, fill=NB_BLACK, font=F_GEIST(15))

    save_canvas(img, "havlo-other-tab.png")

render_post_13()

render_s2_brutalism({
    "eyebrow": "ANTI-URGENCY",
    "lines": ["DON'T", "ACT NOW.", "Take your time.", "We'll watch the price."],
    "line_sizes": [120, 160, 56, 56],
    "rotations": [-1, 1, -1, 1],
    "highlights": [None, ("ACT", NB_YELLOW), None, None],
    "illustration": ill_stopwatch,
}, "havlo-anti-urgency.png")

render_s2_brutalism({
    "eyebrow": "NEW · SCAN",
    "lines": ["IN A SHOP?", "SCAN IT."],
    "line_sizes": [120, 160],
    "rotations": [-1, 1],
    "highlights": [None, ("SCAN", NB_YELLOW)],
    "illustration": ill_scan,
}, "havlo-scan.png")

# S5 — Post 15 (price history)
render_s5_magazine({
    "eyebrow": "new · price history",
    "headline": ["Watch the price.", "Not just check it."],
    "headline_size": 100,
    "body": "A live chart of every price change, across stores, for 365 days.",
    "right_label": "FEATURE · 01",
    "illustration": ill_price_chart,
}, "havlo-history.png")

# S7 — Post 16 (alerts)
render_s7_vibrant({
    "headlines": ["Set your number.", "Walk away."],
    "head_size": 140,
    "body": "We'll email you the moment any store hits it.",
    "right_label": "FEATURE · 02",
    "illustration": ill_bell,
}, "havlo-alerts.png")

# S5 — Post 18 (lowest badge)
render_s5_magazine({
    "eyebrow": "new · badge",
    "headline": ["A badge", "that earns it."],
    "headline_size": 100,
    "body": "Only when the current price genuinely matches the 30-day floor across stores.\nNot marketing. Math.",
    "right_label": "FEATURE · 04",
    "illustration": ill_lowest_badge,
}, "havlo-badge.png")

# S7 — Post 19 (compare paste)
render_s7_vibrant({
    "headlines": ["Paste a link.", "See it cheaper."],
    "head_size": 130,
    "body": "Six countries. Every major retailer. One search box.",
    "right_label": "THE ORIGINAL FEATURE",
    "illustration": ill_paste_diagram,
}, "havlo-compare.png")

# S3 — Posts 20, 21, 22, 24, 26, 29 (monochrome editorial)
render_s3_mono({
    "hero": "12,847",
    "hero_size": 260,
    "body": "savings logged this week.",
    "italic": "across 6 countries.",
    "mono_caps": "RECEIPT · ACROSS · THOUSANDS · OF · PRODUCTS",
    "right_label": "RECEIPT · 01/30",
}, "havlo-savings.png")

render_s3_mono({
    "hero": "0",
    "hero_size": 380,
    "sub_hero": "popups",
    "sub_hero_size": 100,
    "italic": "No countdown timers. No fake scarcity. No thank you.",
    "mono_caps": "THE · ONLY · UI · TAX · WE · PAY · IS · HONESTY",
    "right_label": "RECEIPT · 02/30",
}, "havlo-zero-popups.png")

render_s3_mono({
    "hero": "₦393,000",
    "hero_size": 220,
    "body": "the gap between Jumia and Kara\non the same iPhone 14 Pro this week.",
    "italic": "Not a percentage. A receipt.",
    "right_label": "RECEIPT · 03/30 · NG",
}, "havlo-iphone-spread.png")

# Post 24 — median spread (custom — needs small distribution chart)
def render_post_24():
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    pad = 90 * SS

    wordmark(d, pad, pad, color=INK, size=24)
    rl = "RECEIPT · 04/30"
    rw = text_w(d, rl, F_JB_REG(13))
    d.text((W - pad - rw, pad + 8 * SS), rl, fill=INK3, font=F_JB_REG(13))

    # Massive percentage
    hero = "3.7%"
    hf = F_BOLDONSE(280)
    hw, hh = text_size(d, hero, hf)
    hero_y = int(H * 0.18)
    d.text(((W - hw) // 2, hero_y), hero, fill=INK, font=hf)

    # Divider
    div_y = hero_y + hh + 30 * SS
    d.rectangle([0, div_y, W, div_y + 4 * SS], fill=INK)

    # Small bell curve (line stroke only)
    curve_y = div_y + 80 * SS
    curve_h = 200 * SS
    curve_w = 600 * SS
    cx_start = (W - curve_w) // 2
    pts = []
    n = 80
    for i in range(n):
        t = i / (n - 1)
        # Gaussian
        y_norm = math.exp(-((t - 0.5) ** 2) * 24) * 0.85
        px = cx_start + t * curve_w
        py = curve_y + curve_h - y_norm * curve_h
        pts.append((px, py))
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=INK, width=2 * SS)
    # X axis
    hr(d, cx_start, cx_start + curve_w, curve_y + curve_h, color=INK)
    # Long-tail dot at ~75% along
    tail_t = 0.78
    tail_idx = int(tail_t * (n - 1))
    tx, ty = pts[tail_idx]
    d.ellipse([tx - 8 * SS, ty - 8 * SS, tx + 8 * SS, ty + 8 * SS], fill=INK)
    # Annotation
    ann = "the interesting items"
    ann_font = F_CRIMSON_IT(20)
    aw = text_w(d, ann, ann_font)
    d.text((tx + 16 * SS, ty - 10 * SS), ann, fill=INK, font=ann_font)

    # Body
    body = "the median spread between cheapest and dearest"
    body2 = "across our catalog."
    bf = F_CRIMSON_REG(28)
    bw_ = text_w(d, body, bf)
    b2w = text_w(d, body2, bf)
    body_y = curve_y + curve_h + 80 * SS
    d.text(((W - bw_) // 2, body_y), body, fill=INK, font=bf)
    d.text(((W - b2w) // 2, body_y + 44 * SS), body2, fill=INK, font=bf)

    fu = "havlo.io"
    fuw = text_w(d, fu, F_JB_REG(13))
    d.text((W - pad - fuw, H - pad - 24 * SS), fu, fill=INK3, font=F_JB_REG(13))
    add_paper_noise(img, 0.025)
    save_canvas(img, "havlo-median.png")

render_post_24()

# Post 26 (some things aren't on sale)
render_s3_mono({
    "hero": "Not on sale.",
    "hero_size": 130,
    "sub_hero": "Listed anyway.",
    "sub_hero_size": 100,
    "italic": "Pharmacies. Grocers. Honest stores without a compare-at price.",
    "mono_caps": "RECEIPT · NOT · EVERY · SHELF · IS · A · DEAL",
    "right_label": "RECEIPT · 05/30",
}, "havlo-not-on-sale.png")

# Post 29 (recap)
render_s3_mono({
    "hero": "Real prices.",
    "hero_size": 130,
    "sub_hero": "Real stores.",
    "sub_hero_size": 110,
    "italic": "No staged numbers. Sourced from the live catalog.",
    "mono_caps": "RECEIPT · THANK · YOU · FOR · READING · THE · RECEIPTS",
    "right_label": "RECEIPT · 30/30",
}, "havlo-recap.png")

# S4 — Posts 23, 28 (founder voice)
render_s4_classic({
    "lines": [
        "Online shopping",
        "is messy. The same",
        "product can vary by",
        "30 to 50% between stores.",
        "We replace five tabs with one.",
    ],
    "line_size": 56,
    "last_regular": True,
    "attribution": "— Danny, founder",
    "right_label": "FROM THE FOUNDER",
}, "havlo-founder.png")

render_s4_classic({
    "lines": [
        "We don't take payment.",
        "We don't ship goods.",
        "We don't hold inventory.",
        "We're a discovery layer.",
        "That's it.",
    ],
    "line_size": 56,
    "last_regular": True,
    "attribution": "— how Havlo works",
    "right_label": "HOW WE WORK",
    "show_quote_mark": False,
}, "havlo-what-we-dont.png")

# S5 — Post 25 (cross-border explainer)
render_s5_magazine({
    "eyebrow": "explainer · cross-border",
    "headline": ["Cross-border", "pricing."],
    "headline_size": 130,
    "body": "Cheapest TOTAL wins.\nNot the cheapest sticker.",
    "right_label": "EXPLAINER",
    "illustration": ill_crossborder,
}, "havlo-crossborder.png")

# S7 — Post 27 (try this Currys URL)
render_s7_vibrant({
    "headlines": ["Try this.", "Paste any Currys URL."],
    "head_size": 130,
    "body": "into havlo.io. We do the rest.",
    "right_label": "TRY",
    "illustration": ill_input_field,
}, "havlo-paste-currys.png")

# S7 — Post 30 (closing CTA)
render_s7_vibrant({
    "headlines": ["Try one product.", "See if we earn", "your second visit."],
    "head_size": 100,
    "body": None,
    "right_label": "CLOSING",
    "illustration": ill_underline_link,
}, "havlo-second-visit.png")

print(f"\n✓ Rendered 30 posts to {OUT_DIR}")
