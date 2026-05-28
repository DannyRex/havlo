"""
Plainspoken Modernism — real-data Instagram posts.

Reads outputs/havlo-instagram/real-data.json (built by
scripts/_generate-ig-content-data.ts), composites each candidate
into a 1080x1080 Instagram square with the real product image and
real store/price data, and writes one PNG per candidate.

Layout: product photo dominant, two store rows below with cheapest
highlighted via a green pill. Country chip top-left, havlo wordmark
top-right, single tagline + url at bottom.
"""

from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
import json

FONTS_DIR = Path("/Users/admin/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/e94b7b67-a20e-4fbb-b354-371655122708/77b20486-865b-45b9-b529-baf10f72c2fe/skills/canvas-design/canvas-fonts")
OUT_DIR = Path("/Users/admin/Havlo/outputs/havlo-instagram")
MANIFEST = OUT_DIR / "real-data.json"

SS = 2
W = 1080 * SS
H = 1080 * SS

# Havlo palette
BG_WHITE   = (255, 255, 255)
BG_OFFWHITE = (247, 248, 250)
INK        = (15, 23, 42)
INK2       = (71, 85, 105)
INK3       = (148, 163, 184)
BRAND_BLUE = (0, 87, 255)
SUCCESS    = (16, 185, 129)
SUCCESS_BG = (236, 253, 245)
BORDER     = (226, 232, 240)

def load(name, size):
    return ImageFont.truetype(str(FONTS_DIR / name), size * SS)

def load_system(path, size):
    return ImageFont.truetype(path, size * SS)

# Price + tagline fonts use SFNS (San Francisco) because it has the
# naira glyph (₦, U+20A6) and rupee (₹, U+20B9) which Instrument
# Sans doesn't include. Everything else stays on the brand stack.
SFNS = "/System/Library/Fonts/SFNS.ttf"

F_PRICE_XL = load_system(SFNS, 56)
F_PRICE_L  = load_system(SFNS, 42)
F_TAGLINE  = load_system(SFNS, 36)
F_BRAND    = load("InstrumentSans-Bold.ttf", 26)
F_TITLE    = load("InstrumentSans-Regular.ttf", 22)
F_STORE    = load("InstrumentSans-Bold.ttf", 22)
F_LABEL    = load("InstrumentSans-Bold.ttf", 18)
F_WORDMARK = load("InstrumentSans-Bold.ttf", 26)
F_FOOT     = load("InstrumentSans-Regular.ttf", 22)
F_MONO_S   = load("GeistMono-Regular.ttf", 16)

def text_w(d, t, f):
    bb = d.textbbox((0, 0), t, font=f); return bb[2] - bb[0]
def text_h(d, t, f):
    bb = d.textbbox((0, 0), t, font=f); return bb[3] - bb[1]

def chip(d, label, x, y, bg, fg, pad_h=14, pad_v=8, font=F_LABEL):
    """Draw a rounded pill chip with text. Returns (x_end, y_end)."""
    cph = pad_h * SS; cpv = pad_v * SS
    w = text_w(d, label, font); h = text_h(d, label, font)
    rect = [x, y, x + w + cph * 2, y + h + cpv * 2]
    r = (rect[3] - rect[1]) // 2
    d.rounded_rectangle(rect, radius=r, fill=bg)
    d.text((x + cph, y + cpv - h // 8), label, fill=fg, font=font)
    return rect[2], rect[3]

def fit_product_image(img_path: Path, target_w: int, target_h: int) -> Image.Image:
    """Open product image, EXIF-orient, fit into target box, return RGBA
       with transparent letterboxing. Many retailer images are square
       white-bg PNGs; this preserves them. Non-square images get padded
       (never cropped) so we don't accidentally crop out the product."""
    try:
        im = Image.open(img_path)
        im = ImageOps.exif_transpose(im)
        if im.mode != "RGBA":
            im = im.convert("RGBA")
    except Exception as e:
        print(f"  ! failed to open {img_path}: {e}")
        return Image.new("RGBA", (target_w, target_h), (255, 255, 255, 0))

    # Fit into target box preserving aspect ratio
    iw, ih = im.size
    ratio = min(target_w / iw, target_h / ih)
    new_w = max(1, int(iw * ratio))
    new_h = max(1, int(ih * ratio))
    im = im.resize((new_w, new_h), Image.LANCZOS)

    # Center on transparent canvas
    canvas = Image.new("RGBA", (target_w, target_h), (255, 255, 255, 0))
    canvas.paste(im, ((target_w - new_w) // 2, (target_h - new_h) // 2), im)
    return canvas

def render_post(entry: dict, index: int):
    img = Image.new("RGB", (W, H), BG_WHITE)
    d = ImageDraw.Draw(img)

    pad = 64 * SS

    # ── Header — country chip left, havlo wordmark right ──────────
    country = entry["country"].upper()
    country_label = country  # plain ISO code, no emoji
    chip(d, country_label, pad, pad, bg=BRAND_BLUE, fg=BG_WHITE)

    wm_w = text_w(d, "havlo", F_WORDMARK)
    d.text((W - pad - wm_w, pad + 4 * SS), "havlo", fill=INK, font=F_WORDMARK)

    # ── Product image — center, ~33% of canvas (was 42% — caused
    #    the bottom tagline + footer to overlap) ─────────────────
    img_box_top = int(H * 0.13)
    img_box_h = int(H * 0.34)
    img_box_w = int(W * 0.66)
    img_x = (W - img_box_w) // 2

    product_img = fit_product_image(Path(entry["image_local"]), img_box_w, img_box_h)
    img.paste(product_img, (img_x, img_box_top), product_img)

    # ── Brand label + truncated title ─────────────────────────────
    info_y = img_box_top + img_box_h + 16 * SS

    brand_label = entry["brand"].upper()
    bw = text_w(d, brand_label, F_BRAND)
    d.text(((W - bw) // 2, info_y), brand_label, fill=INK3, font=F_BRAND)

    # Truncate title to first 60 chars at word boundary
    title = entry["title"]
    if len(title) > 60:
        cut = title[:60].rsplit(" ", 1)[0]
        title = cut + "..."
    tw = text_w(d, title, F_TITLE)
    if tw > W - pad * 2:
        # Hard truncate further
        while tw > W - pad * 2 and len(title) > 20:
            title = title[:-4] + "..."
            tw = text_w(d, title, F_TITLE)
    d.text(((W - tw) // 2, info_y + 44 * SS), title, fill=INK2, font=F_TITLE)

    # ── Store rows — side-by-side, cheapest left with green pill ──
    rows_y = info_y + 110 * SS
    row_w = (W - pad * 2 - 30 * SS) // 2  # gap of 30 px between
    row_h = 130 * SS

    # Left (cheaper)
    cheap = entry["cheap"]
    dear  = entry["dear"]

    left_rect = [pad, rows_y, pad + row_w, rows_y + row_h]
    d.rounded_rectangle(left_rect, radius=14 * SS, fill=SUCCESS_BG, outline=SUCCESS, width=2 * SS)

    # CHEAPEST chip top of left row
    chip_text = "CHEAPEST"
    cw = text_w(d, chip_text, F_MONO_S)
    ch = text_h(d, chip_text, F_MONO_S)
    chip_pad = 10 * SS
    chip_x = pad + 16 * SS
    chip_y = rows_y - 14 * SS
    d.rounded_rectangle([chip_x, chip_y, chip_x + cw + chip_pad * 2, chip_y + ch + chip_pad],
                        radius=(ch + chip_pad) // 2, fill=SUCCESS)
    d.text((chip_x + chip_pad, chip_y + chip_pad // 2 - 2 * SS), chip_text, fill=BG_WHITE, font=F_MONO_S)

    # Store name (centered) + price below
    sn = cheap["store_name"]
    snw = text_w(d, sn, F_STORE)
    d.text((pad + (row_w - snw) // 2, rows_y + 24 * SS), sn, fill=INK, font=F_STORE)
    pd_text = cheap["display"]
    pdw = text_w(d, pd_text, F_PRICE_L)
    d.text((pad + (row_w - pdw) // 2, rows_y + 60 * SS), pd_text, fill=INK, font=F_PRICE_L)

    # Right (dearer)
    right_x = pad + row_w + 30 * SS
    right_rect = [right_x, rows_y, right_x + row_w, rows_y + row_h]
    d.rounded_rectangle(right_rect, radius=14 * SS, fill=BG_OFFWHITE, outline=BORDER, width=1 * SS)

    sn2 = dear["store_name"]
    sn2w = text_w(d, sn2, F_STORE)
    d.text((right_x + (row_w - sn2w) // 2, rows_y + 24 * SS), sn2, fill=INK2, font=F_STORE)
    pd2 = dear["display"]
    pd2w = text_w(d, pd2, F_PRICE_L)
    d.text((right_x + (row_w - pd2w) // 2, rows_y + 60 * SS), pd2, fill=INK3, font=F_PRICE_L)

    # ── Tagline ───────────────────────────────────────────────────
    tag_y = rows_y + row_h + 50 * SS
    savings_pct = entry["saving_pct"]
    saving_disp = entry["saving_display"]
    line1 = "Same product."
    line2 = f"{saving_disp} cheaper at {cheap['store_name']}."

    l1w = text_w(d, line1, F_TAGLINE)
    l2w = text_w(d, line2, F_TAGLINE)
    # Fit line 2 — if too wide, abbreviate
    if l2w > W - pad * 2:
        line2 = f"{saving_disp} difference."
        l2w = text_w(d, line2, F_TAGLINE)

    d.text(((W - l1w) // 2, tag_y), line1, fill=INK, font=F_TAGLINE)
    d.text(((W - l2w) // 2, tag_y + 60 * SS), line2, fill=INK, font=F_TAGLINE)

    # ── Footer ────────────────────────────────────────────────────
    foot = "Shop smart  ·  havlo.io"
    fw = text_w(d, foot, F_FOOT)
    d.text(((W - fw) // 2, H - pad - text_h(d, foot, F_FOOT)), foot, fill=INK3, font=F_FOOT)

    # ── Output ───────────────────────────────────────────────────
    out = img.resize((1080, 1080), Image.LANCZOS)
    brand_safe = entry["brand"].lower().replace(" ", "-")[:12]
    out_path = OUT_DIR / f"real-{index+1:02d}-{country.lower()}-{brand_safe}.png"
    out.save(out_path, "PNG", optimize=True)
    return out_path

def main():
    with open(MANIFEST) as f:
        entries = json.load(f)
    print(f"Rendering {len(entries)} real-data posts...")
    for i, e in enumerate(entries):
        p = render_post(e, i)
        print(f"  ✓ {p.name}  [{e['country']} · {e['brand']} · {e['cheap']['store_name']} {e['cheap']['display']} vs {e['dear']['store_name']} {e['dear']['display']}]")
    print(f"\nAll posts saved to {OUT_DIR}")

main()
