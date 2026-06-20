/* One-off: NULL the image_url of Kara products whose image_url is the Kara
   product PAGE URL (https://kara.com.ng/<slug>), not a real image file.

   Background: kara.com.ng now returns HTTP 403 to every non-browser request, so
   /api/img-proxy can no longer fetch the page and resolve a fresh og:image (the
   #28 design). Those ~22 products therefore render a BROKEN image. NULLing the
   bad URL makes the card fall back to Havlo's clean empty-state instead.

   Leaves the ~77 Kara products already self-hosted to Supabase Storage untouched
   (their image_url is a supabase.co/storage URL, not a kara.com.ng page URL).

   Idempotent. Safe to re-run.
   Run:  npx tsx scripts/maint/null-broken-kara-images.ts
*/
try { process.loadEnvFile?.(".env.local"); } catch { /* env may be set externally */ }
import { getSupabaseAdmin } from "../../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("Missing Supabase env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }

  const { data, error } = await supa
    .from("products")
    .update({ image_url: null })
    .like("image_url", "https://kara.com.ng/%")
    .select("id");

  if (error) {
    console.error("Update failed:", error.message);
    process.exit(1);
  }
  console.log(`Done. Nulled ${data?.length ?? 0} broken Kara page-URL images (now render the empty-state).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
