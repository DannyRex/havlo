"""
Plainspoken Modernism — render the 5 Havlo Instagram posts.

Each canvas is 1080x1080. Rendered at 2x supersample then downscaled
for crisp anti-aliased type. Output: PNG files in this directory.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

FONTS_DIR = Path("/Users/admin/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/e94b7b67-a20e-4fbb-b354-371655122708/77b20486-865b-45b9-b529-baf10f72c2fe/skills/canvas-design/canvas-fonts")
OUT_DIR = Path("/Users/admin/Havlo/outputs/havlo-instagram")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Supersample factor for crisp type
SS = 2
W = 1080 * SS
H = 1080 * SS

# Brand palette (Havlo)
BG_WHITE   = (255, 255, 255)
BG_OFFWHITE = (247, 248, 250)
INK        = (15, 23, 42)         # #0F172A
INK2       = (71, 85, 105)        # #475569
INK3       = (148, 163, 184)      # #94A3B8
BRAND_BLUE = (0, 87, 255)         # #0057FF
SUCCESS    = (16, 185, 129)       # #10B981
SUCCESS_BG = (236, 253, 245)      # #ECFDF5
BORDER     = (226, 232, 240)      # #E2E8F0

# Fonts
def load(name, size):
    return ImageFont.truetype(str(FONTS_DIR / name), size * SS)

# Primary: InstrumentSans (geometric modern sans) — for headlines + body
# Secondary: WorkSans for slightly warmer body
F_HEAD_XL  = load("InstrumentSans-Bold.ttf", 92)   # huge brand-intro headlines
F_HEAD_L   = load("InstrumentSans-Bold.ttf", 76)
F_HEAD_M   = load("InstrumentSans-Bold.ttf", 60)
F_HEAD_S   = load("InstrumentSans-Bold.ttf", 44)
F_SUB_L    = load("InstrumentSans-Regular.ttf", 36)
F_SUB_M    = load("InstrumentSans-Regular.ttf", 28)
F_BODY     = load("WorkSans-Regular.ttf", 22)
F_BODY_S   = load("WorkSans-Regular.ttf", 18)
F_LABEL    = load("InstrumentSans-Bold.ttf", 18)
F_WORDMARK = load("InstrumentSans-Bold.ttf", 26)
F_MONO     = load("GeistMono-Regular.ttf", 20)
F_MONO_S   = load("GeistMono-Regular.ttf", 16)

def text_w(draw, text, font):
    """Width of text in pixels."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]

def text_h(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[3] - bbox[1]

def text_metrics(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1], bbox

def draw_centered_text(draw, text, font, y, color, x_offset=0):
    """Draw text horizontally centered on the canvas at vertical y."""
    w = text_w(draw, text, font)
    draw.text(((W - w) // 2 + x_offset, y), text, fill=color, font=font)

def draw_havlo_wordmark(draw, x, y, color=INK, size_font=F_WORDMARK):
    """The lowercase 'havlo' wordmark."""
    draw.text((x, y), "havlo", fill=color, font=size_font)

def draw_country_chip(draw, label, x, y, bg=BG_OFFWHITE, fg=INK, pad_h=12, pad_v=8):
    """Pill chip with text. Returns (x_end, y_end, height)."""
    chip_pad_h = pad_h * SS
    chip_pad_v = pad_v * SS
    w = text_w(draw, label, F_LABEL)
    h = text_h(draw, label, F_LABEL)
    rect = [x, y, x + w + chip_pad_h * 2, y + h + chip_pad_v * 2]
    # Rounded rectangle
    radius = (rect[3] - rect[1]) // 2
    draw.rounded_rectangle(rect, radius=radius, fill=bg)
    draw.text((x + chip_pad_h, y + chip_pad_v - h // 8), label, fill=fg, font=F_LABEL)
    return rect[2], rect[3], rect[3] - rect[1]

def hairline_rect(draw, x1, y1, x2, y2, color=BORDER, width=2):
    draw.rectangle([x1, y1, x2, y2], outline=color, width=width * SS)

# ── POST 1 — Brand intro / pinned ─────────────────────────────────
def post_1():
    img = Image.new("RGB", (W, H), BG_WHITE)
    d = ImageDraw.Draw(img)

    # Top — wordmark + country flag strip
    pad = 64 * SS
    draw_havlo_wordmark(d, pad, pad)

    flags = "NG  ·  UK  ·  US  ·  DE  ·  AE  ·  IN  ·  ZA"
    fw = text_w(d, flags, F_MONO_S)
    d.text((W - pad - fw, pad + 6 * SS), flags, fill=INK3, font=F_MONO_S)

    # Center headline — 3 lines, big, tightly led
    headline_top = int(H * 0.32)
    line_h = 110 * SS

    line1 = "Find similar"
    line2 = "products for less."
    # Headlines centered
    for i, line in enumerate([line1, line2]):
        w = text_w(d, line, F_HEAD_XL)
        d.text(((W - w) // 2, headline_top + i * line_h), line, fill=INK, font=F_HEAD_XL)

    # Sub-headline
    sub_y = headline_top + 2 * line_h + 50 * SS
    sub = "Across the stores you already know."
    sw = text_w(d, sub, F_SUB_L)
    d.text(((W - sw) // 2, sub_y), sub, fill=INK2, font=F_SUB_L)

    # Bottom — free + url
    bottom_y = H - pad - text_h(d, "havlo.io", F_BODY)
    foot = "Free, no signup."
    fw2 = text_w(d, foot, F_BODY)
    url = "havlo.io"
    uw = text_w(d, url, F_BODY)
    d.text((pad, bottom_y), foot, fill=INK3, font=F_BODY)
    d.text((W - pad - uw, bottom_y), url, fill=INK, font=F_BODY)

    out = img.resize((1080, 1080), Image.LANCZOS)
    out.save(OUT_DIR / "01-brand-intro.png", "PNG", optimize=True)
    print(f"✓ wrote 01-brand-intro.png")

# ── POST 2 — Your favourite store isn't always cheapest ──────────
def post_2():
    img = Image.new("RGB", (W, H), INK)  # dark slate ground
    d = ImageDraw.Draw(img)

    pad = 70 * SS
    # Headline anchored slightly above center for poster feel
    line1 = "Your favourite store"
    line2 = "isn't always"
    line3 = "cheapest."

    head_top = int(H * 0.18)
    line_h = 115 * SS

    for i, line in enumerate([line1, line2, line3]):
        d.text((pad, head_top + i * line_h), line, fill=BG_WHITE, font=F_HEAD_L)

    # Quiet sub line, muted gray
    sub_y = head_top + 3 * line_h + 60 * SS
    d.text((pad, sub_y), "It's not personal.", fill=INK3, font=F_SUB_L)

    # Bottom-right — small wordmark + url
    wm = "havlo"
    url = "havlo.io"
    wm_w = text_w(d, wm, F_WORDMARK)
    url_w = text_w(d, url, F_BODY_S)
    bottom_y = H - pad
    d.text((W - pad - wm_w, bottom_y - 60 * SS), wm, fill=BG_WHITE, font=F_WORDMARK)
    d.text((W - pad - url_w, bottom_y - 22 * SS), url, fill=INK3, font=F_BODY_S)

    out = img.resize((1080, 1080), Image.LANCZOS)
    out.save(OUT_DIR / "02-favorite-store.png", "PNG", optimize=True)
    print(f"✓ wrote 02-favorite-store.png")

# ── POST 3 — Paste any product link (3-step) ─────────────────────
def post_3():
    img = Image.new("RGB", (W, H), BG_WHITE)
    d = ImageDraw.Draw(img)

    pad = 64 * SS
    draw_havlo_wordmark(d, pad, pad)

    # Three phone mocks in a horizontal row
    section_top = int(H * 0.20)
    section_h = int(H * 0.45)

    phones_y = section_top
    phone_w = 220 * SS
    phone_h = 380 * SS
    phone_radius = 30 * SS
    total_phones_w = phone_w * 3 + 80 * SS * 2  # phones + gaps
    start_x = (W - total_phones_w) // 2

    # Numbered step labels above each
    steps = [
        ("01", "Copy"),
        ("02", "Paste"),
        ("03", "Compare"),
    ]

    for i, (num, label) in enumerate(steps):
        x = start_x + i * (phone_w + 80 * SS)
        # Step number
        d.text((x, phones_y - 80 * SS), num, fill=BRAND_BLUE, font=F_MONO)
        # Step label
        d.text((x + 60 * SS, phones_y - 80 * SS), label, fill=INK, font=F_LABEL)

        # Phone outline
        d.rounded_rectangle([x, phones_y, x + phone_w, phones_y + phone_h],
                            radius=phone_radius, outline=INK, width=4 * SS, fill=BG_OFFWHITE)

        # Phone notch (subtle)
        notch_w = 60 * SS
        notch_h = 8 * SS
        d.rounded_rectangle([x + (phone_w - notch_w) // 2, phones_y + 14 * SS,
                             x + (phone_w + notch_w) // 2, phones_y + 14 * SS + notch_h],
                            radius=4 * SS, fill=INK)

        # Per-step content inside the phone
        inner_x = x + 18 * SS
        inner_y = phones_y + 70 * SS
        inner_w = phone_w - 36 * SS

        if i == 0:
            # Copy: URL bar mock
            d.rounded_rectangle([inner_x, inner_y, inner_x + inner_w, inner_y + 36 * SS],
                                radius=8 * SS, fill=BG_WHITE, outline=BORDER, width=1 * SS)
            d.text((inner_x + 10 * SS, inner_y + 8 * SS), "amazon.com/dp/...", fill=INK2, font=F_MONO_S)
            # Faux "COPY" floating tag
            tag_y = inner_y + 60 * SS
            tag_text = "COPY"
            tw = text_w(d, tag_text, F_LABEL)
            d.rounded_rectangle([inner_x + (inner_w - tw - 24 * SS) // 2, tag_y,
                                 inner_x + (inner_w + tw + 24 * SS) // 2, tag_y + 36 * SS],
                                radius=20 * SS, fill=INK)
            d.text((inner_x + (inner_w - tw) // 2, tag_y + 8 * SS), tag_text, fill=BG_WHITE, font=F_LABEL)

        elif i == 1:
            # Paste into havlo search
            d.text((inner_x, inner_y), "havlo.io", fill=INK, font=F_LABEL)
            d.rounded_rectangle([inner_x, inner_y + 40 * SS, inner_x + inner_w, inner_y + 40 * SS + 56 * SS],
                                radius=10 * SS, fill=BG_WHITE, outline=BRAND_BLUE, width=2 * SS)
            d.text((inner_x + 10 * SS, inner_y + 56 * SS), "amazon.com/dp/...", fill=INK, font=F_MONO_S)
            # Compare button
            btn_y = inner_y + 130 * SS
            btn_text = "Compare"
            bw = text_w(d, btn_text, F_LABEL)
            d.rounded_rectangle([inner_x, btn_y, inner_x + inner_w, btn_y + 44 * SS],
                                radius=22 * SS, fill=BRAND_BLUE)
            d.text((inner_x + (inner_w - bw) // 2, btn_y + 12 * SS), btn_text, fill=BG_WHITE, font=F_LABEL)

        else:
            # Compare result with green CHEAPER pill
            d.text((inner_x, inner_y), "3 stores", fill=INK2, font=F_BODY_S)

            rows = [
                ("Store A", "$189", True),
                ("Store B", "$249", False),
                ("Store C", "$259", False),
            ]
            row_y = inner_y + 36 * SS
            for store, price, is_cheap in rows:
                d.rounded_rectangle([inner_x, row_y, inner_x + inner_w, row_y + 48 * SS],
                                    radius=8 * SS, fill=SUCCESS_BG if is_cheap else BG_WHITE,
                                    outline=SUCCESS if is_cheap else BORDER, width=2 * SS if is_cheap else 1 * SS)
                d.text((inner_x + 10 * SS, row_y + 12 * SS), store, fill=INK, font=F_BODY_S)
                price_w = text_w(d, price, F_LABEL)
                d.text((inner_x + inner_w - price_w - 12 * SS, row_y + 12 * SS), price, fill=INK, font=F_LABEL)
                row_y += 60 * SS

            # Tiny "CHEAPER" tag on first row
            tag_y = inner_y + 32 * SS
            tag_text = "CHEAPER"
            tw = text_w(d, tag_text, F_MONO_S)
            d.rounded_rectangle([inner_x + inner_w - tw - 20 * SS, tag_y,
                                 inner_x + inner_w, tag_y + 20 * SS],
                                radius=10 * SS, fill=SUCCESS)
            d.text((inner_x + inner_w - tw - 10 * SS, tag_y + 2 * SS), tag_text, fill=BG_WHITE, font=F_MONO_S)

    # Bottom headline
    head_y = phones_y + phone_h + 100 * SS
    line1 = "Paste any link."
    line2 = "We find it cheaper."
    h1 = text_w(d, line1, F_HEAD_M)
    h2 = text_w(d, line2, F_HEAD_M)
    d.text(((W - h1) // 2, head_y), line1, fill=INK, font=F_HEAD_M)
    d.text(((W - h2) // 2, head_y + 80 * SS), line2, fill=INK2, font=F_HEAD_M)

    # Footer URL
    url = "havlo.io"
    uw = text_w(d, url, F_BODY)
    d.text(((W - uw) // 2, H - pad - text_h(d, url, F_BODY)), url, fill=INK3, font=F_BODY)

    out = img.resize((1080, 1080), Image.LANCZOS)
    out.save(OUT_DIR / "03-paste-any-link.png", "PNG", optimize=True)
    print(f"✓ wrote 03-paste-any-link.png")

# ── POST 4 — Comparison post TEMPLATE ─────────────────────────────
def post_4():
    img = Image.new("RGB", (W, H), BG_WHITE)
    d = ImageDraw.Draw(img)

    pad = 64 * SS

    # Country chip with dotted border ("swap me")
    chip_text = "UK"
    chip_pad_h = 16 * SS
    chip_pad_v = 10 * SS
    cw = text_w(d, chip_text, F_LABEL)
    ch = text_h(d, chip_text, F_LABEL)
    chip_x = pad
    chip_y = pad
    chip_rect = [chip_x, chip_y, chip_x + cw + chip_pad_h * 2, chip_y + ch + chip_pad_v * 2]
    radius = (chip_rect[3] - chip_rect[1]) // 2
    d.rounded_rectangle(chip_rect, radius=radius, fill=BRAND_BLUE)
    d.text((chip_x + chip_pad_h, chip_y + chip_pad_v - ch // 8), chip_text, fill=BG_WHITE, font=F_LABEL)

    # "← swap" hint next to chip
    d.text((chip_rect[2] + 14 * SS, chip_y + chip_pad_v + 4 * SS), "swap per market", fill=INK3, font=F_MONO_S)

    # Wordmark right
    wm_w = text_w(d, "havlo", F_WORDMARK)
    d.text((W - pad - wm_w, pad), "havlo", fill=INK, font=F_WORDMARK)

    # Two side-by-side product zones
    split_top = int(H * 0.20)
    split_h = 460 * SS
    gap = 30 * SS
    side_w = (W - pad * 2 - gap) // 2

    # Left (cheaper)
    left_x = pad
    left_rect = [left_x, split_top, left_x + side_w, split_top + 320 * SS]
    # Dashed-bordered placeholder
    dash_color = INK3
    dash_len = 16 * SS
    gap_len = 8 * SS
    def dashed_rect(draw, x1, y1, x2, y2, color, w=2):
        w = w * SS
        # top
        x = x1
        while x < x2:
            draw.line([(x, y1), (min(x + dash_len, x2), y1)], fill=color, width=w)
            x += dash_len + gap_len
        # bottom
        x = x1
        while x < x2:
            draw.line([(x, y2), (min(x + dash_len, x2), y2)], fill=color, width=w)
            x += dash_len + gap_len
        # left
        y = y1
        while y < y2:
            draw.line([(x1, y), (x1, min(y + dash_len, y2))], fill=color, width=w)
            y += dash_len + gap_len
        # right
        y = y1
        while y < y2:
            draw.line([(x2, y), (x2, min(y + dash_len, y2))], fill=color, width=w)
            y += dash_len + gap_len

    dashed_rect(d, left_rect[0], left_rect[1], left_rect[2], left_rect[3], dash_color)
    label_text = "PRODUCT PHOTO"
    lw = text_w(d, label_text, F_LABEL)
    lh = text_h(d, label_text, F_LABEL)
    d.text((left_rect[0] + (side_w - lw) // 2, (left_rect[1] + left_rect[3]) // 2 - lh // 2),
           label_text, fill=INK3, font=F_LABEL)

    # Cheaper green chip top-right of left placeholder
    chip_label = "£50 SAVED"
    cw2 = text_w(d, chip_label, F_LABEL)
    ch2 = text_h(d, chip_label, F_LABEL)
    chip_pad_h2 = 14 * SS
    chip_pad_v2 = 8 * SS
    chip2 = [left_rect[2] - cw2 - chip_pad_h2 * 2 - 14 * SS,
             left_rect[1] + 14 * SS,
             left_rect[2] - 14 * SS,
             left_rect[1] + 14 * SS + ch2 + chip_pad_v2 * 2]
    d.rounded_rectangle(chip2, radius=(chip2[3] - chip2[1]) // 2, fill=SUCCESS)
    d.text((chip2[0] + chip_pad_h2, chip2[1] + chip_pad_v2 - ch2 // 8), chip_label, fill=BG_WHITE, font=F_LABEL)

    # Price under left
    price_y = left_rect[3] + 30 * SS
    d.text((left_rect[0], price_y), "£329", fill=INK, font=F_HEAD_L)
    d.text((left_rect[0], price_y + 100 * SS), "at Currys", fill=INK2, font=F_SUB_M)

    # Right (more expensive)
    right_x = pad + side_w + gap
    right_rect = [right_x, split_top, right_x + side_w, split_top + 320 * SS]
    dashed_rect(d, right_rect[0], right_rect[1], right_rect[2], right_rect[3], dash_color)
    d.text((right_rect[0] + (side_w - lw) // 2, (right_rect[1] + right_rect[3]) // 2 - lh // 2),
           label_text, fill=INK3, font=F_LABEL)

    # Price under right (slightly muted)
    d.text((right_rect[0], price_y), "£379", fill=INK3, font=F_HEAD_L)
    d.text((right_rect[0], price_y + 100 * SS), "at John Lewis", fill=INK2, font=F_SUB_M)

    # Bottom headline
    head_y = price_y + 180 * SS
    head_text = "Same product. Different prices."
    hw = text_w(d, head_text, F_HEAD_S)
    d.text(((W - hw) // 2, head_y), head_text, fill=INK, font=F_HEAD_S)

    # Footer
    footer = "Shop smart with Havlo  ·  havlo.io"
    fw = text_w(d, footer, F_BODY)
    d.text(((W - fw) // 2, H - pad - text_h(d, footer, F_BODY)), footer, fill=INK2, font=F_BODY)

    out = img.resize((1080, 1080), Image.LANCZOS)
    out.save(OUT_DIR / "04-comparison-template.png", "PNG", optimize=True)
    print(f"✓ wrote 04-comparison-template.png")

# ── POST 5 — Free. No signup. 7 countries. ────────────────────────
def post_5():
    img = Image.new("RGB", (W, H), BRAND_BLUE)
    d = ImageDraw.Draw(img)

    pad = 70 * SS

    # Wordmark top-left, white on blue
    d.text((pad, pad), "havlo", fill=BG_WHITE, font=F_WORDMARK)

    # Three bold stacked words in the upper-middle
    head_top = int(H * 0.24)
    line_h = 132 * SS

    lines = ["Free.", "No signup.", "7 countries."]
    for i, line in enumerate(lines):
        d.text((pad, head_top + i * line_h), line, fill=BG_WHITE, font=F_HEAD_XL)

    # Sub
    sub_y = head_top + 3 * line_h + 50 * SS
    sub = "Compare prices across the stores"
    sub2 = "you already know."
    d.text((pad, sub_y), sub, fill=BG_WHITE, font=F_SUB_L)
    d.text((pad, sub_y + 50 * SS), sub2, fill=BG_WHITE, font=F_SUB_L)

    # Bottom — country flags row + URL
    flags = "NG  ·  UK  ·  US  ·  DE  ·  AE  ·  IN  ·  ZA"
    fw = text_w(d, flags, F_MONO)
    url = "havlo.io"
    uw = text_w(d, url, F_BODY)
    d.text((pad, H - pad - 60 * SS), flags, fill=BG_WHITE, font=F_MONO)
    d.text((W - pad - uw, H - pad - 60 * SS), url, fill=BG_WHITE, font=F_BODY)

    out = img.resize((1080, 1080), Image.LANCZOS)
    out.save(OUT_DIR / "05-free-no-signup.png", "PNG", optimize=True)
    print(f"✓ wrote 05-free-no-signup.png")

# Run all
post_1()
post_2()
post_3()
post_4()
post_5()
print("\nAll 5 posts rendered to:", OUT_DIR)
