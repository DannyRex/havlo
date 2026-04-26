import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/* ──────────────────────────────────────────────────────────────────
   Realistic pool of 60+ queries Nigerians actually search for —
   spanning phones, audio, computing, gaming, fashion, home, beauty,
   wearables. Curated to feel believable; expand any time.
   The renderer draws ~14 at random per 5-min bucket, with believable
   power-law-distributed trend percentages (most modest, few viral).
   ────────────────────────────────────────────────────────────────── */

const SEARCH_POOL = [
  // Phones
  "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 14", "iPhone 13", "iPhone 12",
  "Galaxy S24 Ultra", "Galaxy S24", "Galaxy A15", "Galaxy A06", "Galaxy Z Flip 5",
  "Tecno Spark 30", "Tecno Camon 30", "Infinix Hot 50", "Infinix Note 40",
  "Pixel 8", "Pixel 9", "OnePlus 12", "Redmi Note 13",

  // Audio
  "AirPods Pro 2", "AirPods Max", "Beats Solo 4", "Sony WH-1000XM5", "Bose QC Ultra",
  "JBL Charge 5", "JBL Flip 6", "Marshall Stanmore", "Galaxy Buds 3 Pro", "Soundcore Q45",

  // Computing
  "MacBook Air M3", "MacBook Pro M3", "Dell XPS 15", "HP Pavilion", "Lenovo ThinkPad",
  "iPad Pro M4", "iPad Air", "Surface Pro 11",

  // Gaming
  "PS5 Slim", "Xbox Series X", "Nintendo Switch OLED", "Steam Deck", "DualSense controller",
  "Logitech G Pro", "Razer Blackwidow",

  // TV / Display
  "55 inch OLED TV", "Hisense U7N", "Samsung QN90D", "LG C4 TV", "65 inch QLED TV",

  // Fashion / Sneakers
  "Adidas Samba", "Nike Dunk Low", "Air Jordan 1", "Yeezy Boost 350", "New Balance 530",
  "Air Force 1", "Vans Old Skool", "Asics Gel-Kayano",

  // Home / Kitchen
  "Dyson V15", "Ninja Foodi air fryer", "Smeg kettle", "Philips espresso machine",
  "Bosch washing machine",

  // Beauty
  "Drunk Elephant Bronzing Drops", "CeraVe moisturiser", "La Roche-Posay sunscreen",

  // Wearables / misc
  "Apple Watch Series 10", "Garmin Forerunner 265", "Kindle Paperwhite", "Ray-Ban Wayfarer",
];

/* ── 5-min seeded PRNG (mulberry32) ──────────────────────────────── */
const ROTATION_MS = 5 * 60 * 1000;

function freshnessSeed(): number {
  const bucket = Math.floor(Date.now() / ROTATION_MS).toString();
  let h = 2166136261;
  for (let i = 0; i < bucket.length; i++) {
    h ^= bucket.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* Power-law trend %:
   - 70% modest:  5-49%
   - 25% strong:  50-149%
   - 5% viral:    150-299% */
function realisticTrend(rng: () => number): number {
  const r = rng();
  if (r < 0.70) return Math.floor(rng() * 45) + 5;
  if (r < 0.95) return Math.floor(rng() * 100) + 50;
  return Math.floor(rng() * 150) + 150;
}

const VISIBLE_COUNT = 14;

export default function TrendingSearches() {
  const rng = makeRng(freshnessSeed());
  const shuffled = seededShuffle(SEARCH_POOL, rng).slice(0, VISIBLE_COUNT);
  const items = shuffled.map((q) => ({ q, trend: realisticTrend(rng) }));

  return (
    <section className="py-12 sm:py-16 bg-surface-2/50 border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-end justify-between mb-5 sm:mb-6 gap-4">
          <div>
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.12em] mb-1.5">
              Popular this week
            </p>
            <h2 className="text-[22px] sm:text-2xl font-bold text-ink tracking-[-0.02em] leading-tight">
              What people are searching for
            </h2>
          </div>
        </div>

        {/* Chip rail — full-bleed scroll on mobile, wrap on desktop */}
        <div className="-mx-4 sm:mx-0">
          <div className="flex gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar px-4 sm:px-0 sm:flex-wrap">
            {items.map(({ q, trend }) => (
              <Link
                key={q}
                href={`/compare?q=${encodeURIComponent(q)}&mode=similar`}
                className="group inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-bg border border-border hover:border-border-strong hover:shadow-card transition-all whitespace-nowrap shrink-0 active:scale-95"
              >
                <span className="text-[13px] sm:text-sm font-medium text-ink">{q}</span>
                <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-success tabular-nums">
                  <ArrowUpRight size={11} strokeWidth={2.5} />
                  {trend}%
                </span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
