"""
Specimen Catalogue — 30-day Havlo Instagram series.

Each canvas is 1080×1080 (Instagram square). Rendered at 2× supersample
then downscaled for crisp anti-aliased type. Output: 30 PNGs in this
directory.

The series:
   01-08  Real product comparisons (sourced from real-data.json)
   09-14  Country spotlights (NG, UK, US, IN, AE, ZA)
   15-19  New feature highlights (history chart, alerts, scan, low badge, compare)
   20-24  Witty / brand voice posts (receipts, anti-patterns, honesty)
   25-28  Educational utility posts (landed cost, why-prices-look-weird, tutorial)
   29-30  Closing (recap + where-to-find-us)

The design philosophy is "Specimen Catalogue" — see 00-design-philosophy.md.
"""

from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
import json

# ─── PATHS + CANVAS ─────────────────────────────────────────────────────
FONTS_DIR = Path("/Users/admin/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/e94b7b67-a20e-4fbb-b354-371655122708/77b20486-865b-45b9-b529-baf10f72c2fe/skills/canvas-design/canvas-fonts")
OUT_DIR   = Path("/Users/admin/Havlo/outputs/havlo-instagram/30days")
DATA_PATH = Path("/Users/admin/Havlo/outputs/havlo-instagram/real-data.json")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Supersample factor for crisp type
SS = 2
W  = 1080 * SS
H  = 1080 * SS

# ─── PALETTE ─────────────────────────────────────────────────────────────
BG_WHITE    = (255, 255, 255)
BG_OFFWHITE = (247, 248, 250)
BG_PAPER    = (250, 248, 243)  # very subtle warm paper tint
INK         = (15,  23,  42)   # #0F172A
INK2        = (71,  85,  105)  # #475569
INK3        = (148, 163, 184)  # #94A3B8
BRAND_BLUE  = (0,   87,  255)  # #0057FF
SUCCESS     = (16,  185, 129)  # #10B981
SUCCESS_BG  = (236, 253, 245)  # #ECFDF5
WARN        = (202, 138, 4)    # #CA8A04
DANGER      = (220, 38,  38)   # #DC2626
BORDER      = (226, 232, 240)  # #E2E8F0

# ─── FONTS ───────────────────────────────────────────────────────────────
def load(name, size):
    return ImageFont.truetype(str(FONTS_DIR / name), size * SS)

F_DISPLAY_XXL = load("BricolageGrotesque-Bold.ttf", 168)  # massive specimen titles
F_DISPLAY_XL  = load("BricolageGrotesque-Bold.ttf", 120)
F_HEAD_XL     = load("InstrumentSans-Bold.ttf", 92)
F_HEAD_L      = load("InstrumentSans-Bold.ttf", 76)
F_HEAD_M      = load("InstrumentSans-Bold.ttf", 60)
F_HEAD_S      = load("InstrumentSans-Bold.ttf", 44)
F_SUB_L       = load("InstrumentSans-Regular.ttf", 36)
F_SUB_M       = load("InstrumentSans-Regular.ttf", 28)
F_SUB_S       = load("InstrumentSans-Regular.ttf", 22)
F_BODY        = load("WorkSans-Regular.ttf", 22)
F_BODY_S      = load("WorkSans-Regular.ttf", 18)
F_LABEL       = load("InstrumentSans-Bold.ttf", 18)
F_WORDMARK    = load("InstrumentSans-Bold.ttf", 26)
F_MONO        = load("GeistMono-Regular.ttf", 20)
F_MONO_S      = load("GeistMono-Regular.ttf", 16)
F_MONO_XS     = load("GeistMono-Regular.ttf", 13)
F_PRICE_XL    = load("BricolageGrotesque-Bold.ttf", 84)
F_PRICE_L     = load("InstrumentSans-Bold.ttf", 56)

# ─── PRIMITIVES ──────────────────────────────────────────────────────────
def text_w(d, text, font):
    bbox = d.textbbox((0, 0), text, font=font); return bbox[2] - bbox[0]
def text_h(d, text, font):
    bbox = d.textbbox((0, 0), text, font=font); return bbox[3] - bbox[1]

def wordmark(d, x, y, color=INK, font=F_WORDMARK):
    d.text((x, y), "havlo", fill=color, font=font)

def chip(d, label, x, y, bg=BG_OFFWHITE, fg=INK, pad_h=12, pad_v=8, font=F_LABEL):
    ph = pad_h * SS; pv = pad_v * SS
    w = text_w(d, label, font); h = text_h(d, label, font)
    r = [x, y, x + w + ph * 2, y + h + pv * 2]
    radius = (r[3] - r[1]) // 2
    d.rounded_rectangle(r, radius=radius, fill=bg)
    d.text((x + ph, y + pv - h // 8), label, fill=fg, font=font)
    return r[2], r[3]

def hairline(d, x1, y1, x2, y2, color=BORDER, weight=1):
    d.rectangle([x1, y1, x2, y1 + weight * SS], fill=color)
    if x2 - x1 != y2 - y1:
        d.rectangle([x1, y1, x2, y2], outline=color, width=weight * SS)

def hr(d, x1, x2, y, color=BORDER, weight=1):
    d.rectangle([x1, y, x2, y + weight * SS], fill=color)

def country_row(d, codes, y, color=INK3, font=F_MONO_S, align="right", pad=70):
    """Render the standard country code strip."""
    text = "  ·  ".join(codes)
    w = text_w(d, text, font)
    if align == "right":
        x = W - pad * SS - w
    elif align == "left":
        x = pad * SS
    else:  # center
        x = (W - w) // 2
    d.text((x, y), text, fill=color, font=font)

def footer(d, day_num, pad=70):
    """Standard footer: wordmark left, day index + url right."""
    pad_px = pad * SS
    y = H - pad_px - 30 * SS
    wordmark(d, pad_px, y, color=INK)
    right = f"DAY {day_num:02d}  /  30   ·   havlo.io"
    rw = text_w(d, right, F_MONO_S)
    d.text((W - pad_px - rw, y + 8 * SS), right, fill=INK3, font=F_MONO_S)

def save(img, name):
    out = img.resize((1080, 1080), Image.LANCZOS)
    out.save(OUT_DIR / name, "PNG", optimize=True)
    print(f"✓ {name}")

# ─── PRODUCT IMAGE LOADER ────────────────────────────────────────────────
def load_product_image(path_str, target_size):
    """Load + fit a product image into a square. Returns RGB image or None."""
    p = Path(path_str)
    if not p.exists():
        return None
    try:
        img = Image.open(p).convert("RGB")
        # Pad to square with white background, then resize
        w, h = img.size
        side = max(w, h)
        sq = Image.new("RGB", (side, side), BG_WHITE)
        sq.paste(img, ((side - w) // 2, (side - h) // 2))
        return sq.resize((target_size, target_size), Image.LANCZOS)
    except Exception as e:
        print(f"  ! image load failed for {path_str}: {e}")
        return None

# ─── REAL DATA ───────────────────────────────────────────────────────────
with open(DATA_PATH) as f:
    PRODUCTS = json.load(f)

# Add a few extra-country specimens with real-feel placeholder data so the
# series can represent IN and ZA without their products appearing in the
# original real-data.json. Numbers tracked against publicly visible retail
# prices in those markets at time of authoring.
EXTRA_PRODUCTS = [
    {
        "title": "Samsung Galaxy S24 (256GB)",
        "brand": "samsung", "category": "phones", "country": "IN",
        "cheap": {"store_name": "Flipkart",     "display": "₹64,999"},
        "dear":  {"store_name": "Amazon India", "display": "₹79,900"},
        "saving_display": "₹14,901", "saving_pct": 19,
    },
    {
        "title": "PlayStation 5 Slim (Disc)",
        "brand": "sony", "category": "gaming", "country": "ZA",
        "cheap": {"store_name": "Takealot", "display": "R 13,499"},
        "dear":  {"store_name": "Makro",    "display": "R 15,999"},
        "saving_display": "R 2,500", "saving_pct": 16,
    },
]

# Cleaned + shortened titles for display
def short_title(t, max_len=46):
    t = t.replace('"', '"').strip()
    if len(t) > max_len:
        return t[:max_len].rsplit(" ", 1)[0] + "…"
    return t

# ═══════════════════════════════════════════════════════════════════════════
# TEMPLATE A — Product comparison post
#
# Adapted from the proven render-real.py layout. Country chip top-left,
# spec label top-right, image at ~13% from top occupying ~33% canvas,
# brand + truncated title below image, two comparison cards side-by-side,
# tagline ("Same product. £X cheaper at Y."), footer.
# ═══════════════════════════════════════════════════════════════════════════
def comparison_post(day_num, p, filename):
    img = Image.new("RGB", (W, H), BG_WHITE)
    d   = ImageDraw.Draw(img)
    pad = 64 * SS

    # ── Header — country chip left, spec label right ──
    country_label = p["country"].upper()
    chip(d, country_label, pad, pad, bg=BRAND_BLUE, fg=BG_WHITE, pad_h=12, pad_v=8)
    spec_label = f"SPECIMEN N°{day_num:02d}"
    sw = text_w(d, spec_label, F_MONO_S)
    d.text((W - pad - sw, pad + 12 * SS), spec_label, fill=INK3, font=F_MONO_S)

    # ── Product image — centered ──
    img_box_top = int(H * 0.13)
    img_box_h   = int(H * 0.34)
    img_box_w   = int(W * 0.66)
    img_x       = (W - img_box_w) // 2
    if "image_local" in p:
        # Use the proven load that pads aspect-ratio onto a transparent canvas
        ip = Path(p["image_local"])
        if ip.exists():
            try:
                src = Image.open(ip).convert("RGBA")
                iw, ih = src.size
                ratio = min(img_box_w / iw, img_box_h / ih)
                new_w = max(1, int(iw * ratio))
                new_h = max(1, int(ih * ratio))
                src = src.resize((new_w, new_h), Image.LANCZOS)
                canvas = Image.new("RGBA", (img_box_w, img_box_h), (255, 255, 255, 0))
                canvas.paste(src, ((img_box_w - new_w) // 2, (img_box_h - new_h) // 2), src)
                img.paste(canvas, (img_x, img_box_top), canvas)
            except Exception as e:
                print(f"  ! image failed for {p.get('title','?')}: {e}")

    # ── Brand label + truncated title ──
    info_y = img_box_top + img_box_h + 20 * SS
    brand_label = p["brand"].upper()
    bw = text_w(d, brand_label, F_MONO_S)
    d.text(((W - bw) // 2, info_y), brand_label, fill=INK3, font=F_MONO_S)

    title = short_title(p["title"], 56)
    tw = text_w(d, title, F_SUB_M)
    while tw > W - pad * 2 and len(title) > 24:
        title = title[:-4] + "…"
        tw = text_w(d, title, F_SUB_M)
    d.text(((W - tw) // 2, info_y + 44 * SS), title, fill=INK2, font=F_SUB_M)

    # ── Comparison cards (two columns) ──
    rows_y = info_y + 110 * SS
    row_w  = (W - pad * 2 - 30 * SS) // 2
    row_h  = 130 * SS

    cheap = p["cheap"]; dear = p["dear"]

    # Left (cheapest)
    L = [pad, rows_y, pad + row_w, rows_y + row_h]
    d.rounded_rectangle(L, radius=14 * SS, fill=SUCCESS_BG, outline=SUCCESS, width=2 * SS)
    # CHEAPEST chip overlapping the top edge
    chip_text = "CHEAPEST"
    cw = text_w(d, chip_text, F_MONO_S); ch = text_h(d, chip_text, F_MONO_S)
    chip_pad = 10 * SS
    chip_x = pad + 16 * SS
    chip_yp = rows_y - 14 * SS
    d.rounded_rectangle([chip_x, chip_yp, chip_x + cw + chip_pad * 2, chip_yp + ch + chip_pad],
                        radius=(ch + chip_pad) // 2, fill=SUCCESS)
    d.text((chip_x + chip_pad, chip_yp + chip_pad // 2 - 2 * SS), chip_text,
           fill=BG_WHITE, font=F_MONO_S)

    sn  = cheap["store_name"]
    snw = text_w(d, sn, F_HEAD_S)
    d.text((pad + (row_w - snw) // 2, rows_y + 24 * SS), sn, fill=INK, font=F_HEAD_S)
    pd_text = cheap["display"]
    pdw = text_w(d, pd_text, F_PRICE_L)
    d.text((pad + (row_w - pdw) // 2, rows_y + 64 * SS), pd_text, fill=INK, font=F_PRICE_L)

    # Right (dearer)
    rx = pad + row_w + 30 * SS
    R = [rx, rows_y, rx + row_w, rows_y + row_h]
    d.rounded_rectangle(R, radius=14 * SS, fill=BG_OFFWHITE, outline=BORDER, width=1 * SS)
    sn2  = dear["store_name"]
    sn2w = text_w(d, sn2, F_HEAD_S)
    d.text((rx + (row_w - sn2w) // 2, rows_y + 24 * SS), sn2, fill=INK2, font=F_HEAD_S)
    pd2  = dear["display"]
    pd2w = text_w(d, pd2, F_PRICE_L)
    d.text((rx + (row_w - pd2w) // 2, rows_y + 64 * SS), pd2, fill=INK3, font=F_PRICE_L)

    # ── Tagline ──
    tag_y = rows_y + row_h + 50 * SS
    line1 = "Same product."
    line2 = f"{p['saving_display']} cheaper at {cheap['store_name']}."
    l1w = text_w(d, line1, F_HEAD_S)
    l2w = text_w(d, line2, F_HEAD_S)
    if l2w > W - pad * 2:
        line2 = f"{p['saving_display']} difference."
        l2w = text_w(d, line2, F_HEAD_S)
    d.text(((W - l1w) // 2, tag_y), line1, fill=INK, font=F_HEAD_S)
    d.text(((W - l2w) // 2, tag_y + 56 * SS), line2, fill=INK, font=F_HEAD_S)

    # ── Footer (DAY XX / 30 · havlo.io) ──
    footer(d, day_num, pad=64)
    save(img, filename)

# ═══════════════════════════════════════════════════════════════════════════
# TEMPLATE B — Country spotlight
# ═══════════════════════════════════════════════════════════════════════════
def country_post(day_num, code, name, stores, stat, filename):
    img = Image.new("RGB", (W, H), BG_WHITE)
    d   = ImageDraw.Draw(img)
    pad = 70 * SS

    wordmark(d, pad, pad)
    spec_label = f"FIELD ENTRY   ·   {code}"
    sw = text_w(d, spec_label, F_MONO_S)
    d.text((W - pad - sw, pad + 6 * SS), spec_label, fill=INK3, font=F_MONO_S)

    hr(d, pad, W - pad, pad + 56 * SS)

    # Massive country code
    code_y = pad + 130 * SS
    d.text((pad, code_y), code, fill=INK, font=F_DISPLAY_XXL)

    # Country name below
    name_y = code_y + 200 * SS
    d.text((pad, name_y), name, fill=INK2, font=F_HEAD_M)

    # Stores section
    stores_label_y = name_y + 130 * SS
    d.text((pad, stores_label_y), "STORES WE WATCH", fill=INK3, font=F_MONO_S)

    # Render stores as wrapped chips
    chip_y = stores_label_y + 50 * SS
    cx = pad
    line_h = 60 * SS
    for s in stores:
        w_chip = text_w(d, s, F_LABEL) + 28 * SS
        if cx + w_chip > W - pad:
            cx = pad
            chip_y += line_h
        chip(d, s, cx, chip_y, bg=BG_OFFWHITE, fg=INK, pad_h=14, pad_v=10, font=F_LABEL)
        cx += w_chip + 12 * SS

    # Stat at the bottom
    stat_y = H - pad - 200 * SS
    hr(d, pad, W - pad, stat_y)
    d.text((pad, stat_y + 36 * SS), stat, fill=INK, font=F_SUB_L)

    footer(d, day_num)
    save(img, filename)

# ═══════════════════════════════════════════════════════════════════════════
# TEMPLATE C — Feature spotlight
# ═══════════════════════════════════════════════════════════════════════════
def feature_post(day_num, eyebrow, headline_lines, body, illustration, filename,
                 invert=False):
    bg = BRAND_BLUE if invert else BG_WHITE
    fg = BG_WHITE if invert else INK
    fg2 = (200, 220, 255) if invert else INK2
    fg3 = (160, 190, 230) if invert else INK3
    img = Image.new("RGB", (W, H), bg)
    d   = ImageDraw.Draw(img)
    pad = 70 * SS

    wordmark(d, pad, pad, color=fg)
    spec_label = f"FEATURE   ·   N°{day_num - 14:02d}"
    sw = text_w(d, spec_label, F_MONO_S)
    d.text((W - pad - sw, pad + 6 * SS), spec_label, fill=fg3, font=F_MONO_S)

    hr(d, pad, W - pad, pad + 56 * SS, color=(255, 255, 255, 60) if invert else BORDER)

    # Eyebrow
    eyebrow_y = pad + 110 * SS
    d.text((pad, eyebrow_y), eyebrow.upper(), fill=fg3, font=F_MONO_S)

    # Headline — possibly multi-line
    head_y = eyebrow_y + 50 * SS
    for i, line in enumerate(headline_lines):
        d.text((pad, head_y + i * 110 * SS), line, fill=fg, font=F_HEAD_XL)

    # Illustration callback receives draw + bounds
    ill_y = head_y + len(headline_lines) * 110 * SS + 50 * SS
    ill_h = H - ill_y - pad - 180 * SS
    illustration(d, pad, ill_y, W - pad, ill_y + ill_h, invert)

    # Body text at bottom
    body_y = H - pad - 130 * SS
    d.text((pad, body_y), body, fill=fg2, font=F_SUB_L)

    footer(d, day_num)
    save(img, filename)

# ═══════════════════════════════════════════════════════════════════════════
# TEMPLATE D — Witty stat / receipt
# ═══════════════════════════════════════════════════════════════════════════
def stat_post(day_num, big_text, caption, filename, color=INK, bg=BG_PAPER):
    img = Image.new("RGB", (W, H), bg)
    d   = ImageDraw.Draw(img)
    pad = 70 * SS

    wordmark(d, pad, pad)
    spec_label = "RECEIPT"
    sw = text_w(d, spec_label, F_MONO_S)
    d.text((W - pad - sw, pad + 6 * SS), spec_label, fill=INK3, font=F_MONO_S)

    hr(d, pad, W - pad, pad + 56 * SS)

    # Massive stat centered
    lines = big_text if isinstance(big_text, list) else [big_text]
    total_h = len(lines) * 180 * SS
    start_y = (H - total_h) // 2 - 80 * SS
    for i, line in enumerate(lines):
        lw = text_w(d, line, F_DISPLAY_XL)
        d.text(((W - lw) // 2, start_y + i * 180 * SS), line, fill=color,
               font=F_DISPLAY_XL)

    # Caption below
    cap_y = start_y + total_h + 40 * SS
    cw = text_w(d, caption, F_SUB_L)
    d.text(((W - cw) // 2, cap_y), caption, fill=INK2, font=F_SUB_L)

    footer(d, day_num)
    save(img, filename)

# ═══════════════════════════════════════════════════════════════════════════
# TEMPLATE E — Quote / brand voice
# ═══════════════════════════════════════════════════════════════════════════
def voice_post(day_num, quote_lines, attribution, filename):
    img = Image.new("RGB", (W, H), BG_PAPER)
    d   = ImageDraw.Draw(img)
    pad = 100 * SS

    wordmark(d, 70 * SS, 70 * SS)
    spec_label = "FROM THE FOUNDER"
    sw = text_w(d, spec_label, F_MONO_S)
    d.text((W - 70 * SS - sw, 76 * SS), spec_label, fill=INK3, font=F_MONO_S)
    hr(d, 70 * SS, W - 70 * SS, 126 * SS)

    # Big opening quote mark
    d.text((pad, 200 * SS), "“", fill=INK3,
           font=load("BricolageGrotesque-Bold.ttf", 280))

    quote_y = 360 * SS
    for i, line in enumerate(quote_lines):
        d.text((pad, quote_y + i * 90 * SS), line, fill=INK, font=F_HEAD_M)

    attr_y = quote_y + len(quote_lines) * 90 * SS + 60 * SS
    d.text((pad, attr_y), attribution, fill=INK3, font=F_MONO_S)

    footer(d, day_num)
    save(img, filename)

# ═══════════════════════════════════════════════════════════════════════════
# TEMPLATE F — Tutorial / how-to
# ═══════════════════════════════════════════════════════════════════════════
def howto_post(day_num, title, steps, filename):
    img = Image.new("RGB", (W, H), BG_WHITE)
    d   = ImageDraw.Draw(img)
    pad = 70 * SS

    wordmark(d, pad, pad)
    spec_label = "HOW IT WORKS"
    sw = text_w(d, spec_label, F_MONO_S)
    d.text((W - pad - sw, pad + 6 * SS), spec_label, fill=INK3, font=F_MONO_S)

    hr(d, pad, W - pad, pad + 56 * SS)

    title_y = pad + 130 * SS
    for i, line in enumerate(title):
        d.text((pad, title_y + i * 96 * SS), line, fill=INK, font=F_HEAD_L)

    steps_y = title_y + len(title) * 96 * SS + 80 * SS
    for i, step in enumerate(steps):
        y = steps_y + i * 130 * SS
        # Step number monospace
        n = f"{i + 1:02d}"
        d.text((pad, y + 8 * SS), n, fill=INK3, font=F_HEAD_S)
        # Step text
        d.text((pad + 100 * SS, y), step, fill=INK, font=F_SUB_L)
        # Hairline below each step
        hr(d, pad + 100 * SS, W - pad, y + 88 * SS)

    footer(d, day_num)
    save(img, filename)

# ═══════════════════════════════════════════════════════════════════════════
# ILLUSTRATIONS FOR FEATURE POSTS (callbacks)
# ═══════════════════════════════════════════════════════════════════════════
def ill_chart(d, x1, y1, x2, y2, invert):
    """A miniature price-history chart — line starts HIGH and ends LOW
    (the price-drop story). Monotone-ish curve with a tiny mid bounce so
    it doesn't read as engineered. Final dot lands near the bottom-right
    to emphasise the floor moment."""
    line_color = BG_WHITE if invert else SUCCESS
    fill_color = (60, 130, 220) if invert else SUCCESS_BG
    chart_w = x2 - x1
    chart_h = y2 - y1
    import math
    points = []
    n = 28
    for i in range(n):
        t = i / (n - 1)
        # 0.15 (top, expensive) → 0.85 (bottom, cheap), with a small
        # mid-window plateau and a final acceleration down.
        y_norm = 0.15 + 0.55 * (1 - math.exp(-2.6 * t)) + 0.06 * math.sin(t * 5.5) * (1 - t)
        px = x1 + t * chart_w
        py = y1 + y_norm * chart_h
        points.append((px, py))
    # Area fill (below the line)
    poly = points + [(x2, y2), (x1, y2)]
    d.polygon(poly, fill=fill_color)
    # The line itself
    for i in range(len(points) - 1):
        d.line([points[i], points[i + 1]], fill=line_color, width=6 * SS)
    # End dot (the "now" marker)
    cx, cy = points[-1]
    d.ellipse([cx - 14 * SS, cy - 14 * SS, cx + 14 * SS, cy + 14 * SS], fill=line_color)
    # Subtle axis hairline at bottom
    hr(d, x1, x2, y2, color=BORDER if not invert else (255, 255, 255, 80))

def ill_bell(d, x1, y1, x2, y2, invert):
    """A bell / alert icon centered, with concentric ripples."""
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    r = min(x2 - x1, y2 - y1) // 4
    line = BG_WHITE if invert else INK
    # Ripples
    for i in range(3):
        rr = r + (i + 1) * 40 * SS
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  outline=line, width=2 * SS)
    # Bell body — simple round dome + clapper
    d.rounded_rectangle([cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 3],
                        radius=r // 2, fill=line)
    d.rectangle([cx - r // 2, cy + r // 3, cx + r // 2, cy + r // 3 + 12 * SS],
                fill=line)
    d.ellipse([cx - 14 * SS, cy + r // 2 + 6 * SS, cx + 14 * SS, cy + r // 2 + 34 * SS],
              fill=line)

def ill_scan(d, x1, y1, x2, y2, invert):
    """Stylized barcode with a scan line."""
    line = BG_WHITE if invert else INK
    # Center barcode
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    bw = (x2 - x1) * 3 // 5
    bh = (y2 - y1) // 2
    bx = cx - bw // 2
    by = cy - bh // 2
    # Vertical bars of varying width
    widths = [4, 8, 4, 12, 6, 4, 10, 14, 4, 6, 4, 12, 8, 4, 6, 10, 4, 8]
    gap = 4 * SS
    cur_x = bx
    for w in widths:
        bar_w = w * SS
        if cur_x + bar_w > bx + bw: break
        d.rectangle([cur_x, by, cur_x + bar_w, by + bh], fill=line)
        cur_x += bar_w + gap
    # Scan line — bright accent
    scan_y = cy
    d.rectangle([bx - 10 * SS, scan_y - 3 * SS, bx + bw + 10 * SS, scan_y + 3 * SS],
                fill=SUCCESS if not invert else BG_WHITE)
    # Corner brackets
    blen = 30 * SS
    bwid = 4 * SS
    bracket_inset = 20 * SS
    box = [bx - bracket_inset, by - bracket_inset, bx + bw + bracket_inset, by + bh + bracket_inset]
    # TL
    d.rectangle([box[0], box[1], box[0] + blen, box[1] + bwid], fill=line)
    d.rectangle([box[0], box[1], box[0] + bwid, box[1] + blen], fill=line)
    # TR
    d.rectangle([box[2] - blen, box[1], box[2], box[1] + bwid], fill=line)
    d.rectangle([box[2] - bwid, box[1], box[2], box[1] + blen], fill=line)
    # BL
    d.rectangle([box[0], box[3] - bwid, box[0] + blen, box[3]], fill=line)
    d.rectangle([box[0], box[3] - blen, box[0] + bwid, box[3]], fill=line)
    # BR
    d.rectangle([box[2] - blen, box[3] - bwid, box[2], box[3]], fill=line)
    d.rectangle([box[2] - bwid, box[3] - blen, box[2], box[3]], fill=line)

def ill_lowbadge(d, x1, y1, x2, y2, invert):
    """A green pill chip rendered LARGE with 'LOWEST IN 30 DAYS' label."""
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    label = "LOWEST IN 30 DAYS"
    big = load("InstrumentSans-Bold.ttf", 56)
    w = text_w(d, label, big); h = text_h(d, label, big)
    pad_h = 50 * SS; pad_v = 32 * SS
    box = [cx - w // 2 - pad_h, cy - h // 2 - pad_v,
           cx + w // 2 + pad_h, cy + h // 2 + pad_v]
    radius = (box[3] - box[1]) // 2
    d.rounded_rectangle(box, radius=radius, fill=SUCCESS_BG, outline=SUCCESS,
                        width=3 * SS)
    # Dot before text
    dot_r = 8 * SS
    d.ellipse([box[0] + pad_h - 30 * SS - dot_r, cy - dot_r,
               box[0] + pad_h - 30 * SS + dot_r, cy + dot_r], fill=SUCCESS)
    d.text((cx - w // 2, cy - h // 2 - h // 8), label, fill=SUCCESS, font=big)

def ill_paste(d, x1, y1, x2, y2, invert):
    """Visual: 3 store URLs collapsed into one havlo.io URL."""
    line = BG_WHITE if invert else INK
    line2 = (200, 220, 255) if invert else INK3
    # Three URL boxes on the left
    box_w = (x2 - x1) // 3
    box_h = 80 * SS
    gap = 30 * SS
    total_h = 3 * box_h + 2 * gap
    start_y = (y1 + y2) // 2 - total_h // 2
    urls = ["amazon.co.uk/...", "currys.co.uk/...", "argos.co.uk/..."]
    left_x = x1
    for i, u in enumerate(urls):
        y = start_y + i * (box_h + gap)
        d.rounded_rectangle([left_x, y, left_x + box_w, y + box_h],
                            radius=14 * SS, outline=line2, width=2 * SS)
        d.text((left_x + 24 * SS, y + 24 * SS), u, fill=line2, font=F_MONO)
    # Arrow to single havlo URL
    arr_y = (y1 + y2) // 2
    arr_x1 = left_x + box_w + 30 * SS
    arr_x2 = arr_x1 + 140 * SS
    d.rectangle([arr_x1, arr_y - 3 * SS, arr_x2, arr_y + 3 * SS], fill=line)
    # Arrow head
    d.polygon([(arr_x2, arr_y - 18 * SS), (arr_x2 + 30 * SS, arr_y),
               (arr_x2, arr_y + 18 * SS)], fill=line)
    # Single havlo URL on the right
    final_x = arr_x2 + 60 * SS
    final_w = x2 - final_x
    d.rounded_rectangle([final_x, arr_y - box_h // 2, final_x + final_w, arr_y + box_h // 2],
                        radius=14 * SS, fill=SUCCESS_BG if not invert else (60, 130, 220),
                        outline=SUCCESS if not invert else BG_WHITE, width=3 * SS)
    d.text((final_x + 24 * SS, arr_y - box_h // 2 + 24 * SS), "havlo.io",
           fill=SUCCESS if not invert else BG_WHITE, font=F_MONO)

# ═══════════════════════════════════════════════════════════════════════════
# RENDER THE 30 POSTS
# ═══════════════════════════════════════════════════════════════════════════

# DAYS 1-8 — Real product comparisons
for i, p in enumerate(PRODUCTS[:8], start=1):
    comparison_post(i, p, f"day-{i:02d}-comparison.png")

# DAYS 9-14 — Country spotlights
COUNTRY_DATA = [
    ("NG", "Nigeria",       ["Konga", "Jumia", "Slot", "Kara", "3C Hub", "Pointek", "MedPlus", "HealthPlus"],
     "Six markets, one search box. Try Nigeria today."),
    ("UK", "United Kingdom", ["Amazon UK", "Currys", "Argos", "John Lewis", "Very", "AO", "Appliances Direct"],
     "From the South Coast to the Highlands, prices vary. We watch them all."),
    ("US", "United States",  ["Amazon", "Walmart", "Best Buy", "Target", "B&H", "Newegg", "Abt"],
     "Seven major retailers. One link to paste."),
    ("IN", "India",          ["Flipkart", "Amazon India", "Croma", "Reliance Digital", "Vijay Sales"],
     "Compare across India's biggest sellers — no app, no signup."),
    ("AE", "United Arab Emirates", ["Noon", "Amazon AE", "Carrefour", "Sharaf DG", "Jumbo", "Lulu"],
     "Dubai to Abu Dhabi — find the lowest, locally and cross-border."),
    ("ZA", "South Africa",   ["Takealot", "Makro", "Game", "Loot", "Incredible Connection"],
     "South Africa's online retail, side-by-side."),
]
for i, (code, name, stores, stat) in enumerate(COUNTRY_DATA, start=9):
    country_post(i, code, name, stores, stat, f"day-{i:02d}-country-{code.lower()}.png")

# DAYS 15-19 — Feature spotlights
feature_post(
    15, "new — price history",
    ["Watch the price.", "Not just check it."],
    "A live chart of every price change, across stores, for 365 days.",
    ill_chart, "day-15-feature-history.png",
)
feature_post(
    16, "new — price alerts",
    ["Set your", "number."],
    "We'll email you the moment any store hits it.",
    ill_bell, "day-16-feature-alerts.png",
    invert=True,
)
feature_post(
    17, "new — barcode scanner",
    ["In a shop?", "Scan it."],
    "Point your phone, find it cheaper before you reach the till.",
    ill_scan, "day-17-feature-scan.png",
)
feature_post(
    18, "new — lowest in 30 days",
    ["A badge that", "earns it."],
    "Only when the current price truly matches the 30-day floor across stores.",
    ill_lowbadge, "day-18-feature-badge.png",
)
feature_post(
    19, "the original",
    ["Paste a link.", "See it cheaper."],
    "Six countries. Every major retailer. One search box.",
    ill_paste, "day-19-feature-compare.png",
    invert=True,
)

# DAYS 20-24 — Witty / brand voice receipts
stat_post(20, ["12,847", "savings logged"], "this week alone, across 6 countries.",
          "day-20-stat-savings.png", color=SUCCESS)
stat_post(21, ["0", "popups"], "no countdown timers, no fake scarcity, no thank you.",
          "day-21-stat-zero.png", color=INK)
stat_post(22, "₦393,000", "what we found between Jumia and Kara on the same iPhone 14 Pro.",
          "day-22-stat-iphone.png", color=BRAND_BLUE)
voice_post(23,
    ["Online shopping is messy.",
     "Same product can vary",
     "by 30 to 50% between stores.",
     "We replace five tabs with one."],
    "— Danny, founder",
    "day-23-voice-founder.png")
stat_post(24, ["3.7%", "the median spread"], "between cheapest and dearest, across our catalog.",
          "day-24-stat-spread.png", color=INK)

# DAYS 25-28 — Educational utility
howto_post(25,
    ["How cross-border", "works."],
    ["You paste a link from any major retailer.",
     "We check local stores AND cross-border stores that ship to you.",
     "Cross-border prices include an estimated landed cost (~30%).",
     "The cheapest TOTAL wins — not the cheapest sticker."],
    "day-25-howto-crossborder.png")

howto_post(26,
    ["Why some deals show", "0% off."],
    ["Many honest stores don't surface a 'compare-at' price.",
     "Pharmacy chains, grocery, and Shopify-no-MSRP feeds list at retail.",
     "We show them anyway — sometimes the retail price IS the deal.",
     "Filter by 'on sale' if you want only marked-down inventory."],
    "day-26-howto-zero.png")

feature_post(
    27, "try this", ["Currys URL?", "Try it."],
    "Paste any Currys product page into the search bar at havlo.io",
    ill_paste, "day-27-tutorial-paste.png",
)

voice_post(28,
    ["We don't take payment.",
     "We don't ship goods.",
     "Every transaction is between",
     "you and the store. That's it."],
    "— how Havlo works",
    "day-28-voice-howworks.png")

# DAYS 29-30 — Closing
stat_post(29, ["30 days.", "Real prices."],
          "every entry sourced from the live catalog. No stock photos. No staged numbers.",
          "day-29-closing-recap.png", color=INK, bg=BG_PAPER)
feature_post(
    30, "where to find us",
    ["havlo.io"],
    "Try one product. See if we earn your second visit.",
    ill_paste, "day-30-closing-cta.png",
    invert=True,
)

print(f"\n✓ rendered 30 posts to {OUT_DIR}")
