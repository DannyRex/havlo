import { search } from "../src/lib/search/index.js";

const queries = ["phone", "iphone 15", "tecno spark", "samsung a06", "tv", "hisense 50", "playstation 5", "macbook"];

for (const q of queries) {
  const r = search(q);
  console.log(`\n── "${q}" → mode=${r.mode}`);
  if (r.mode === "single") {
    console.log(`   product: ${r.group.title}`);
    console.log(`   ${r.group.storeCount} stores, ₦${r.group.bestPrice.toLocaleString()}…₦${r.group.worstPrice.toLocaleString()}`);
    console.log(`   stores: ${r.group.offers.map((o) => `${o.storeName}=₦${o.price.toLocaleString()}`).join(", ")}`);
    console.log(`   ${r.alternatives.length} alternatives`);
  } else if (r.mode === "list") {
    console.log(`   ${r.total} groups, top 5:`);
    r.groups.slice(0, 5).forEach((g) => console.log(`     • ${g.title.slice(0, 70)} (${g.storeCount} stores, from ₦${g.bestPrice.toLocaleString()})`));
  } else {
    console.log("   no matches");
  }
}
