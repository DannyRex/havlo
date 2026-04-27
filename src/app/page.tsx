/* Root redirect — sends users to /{their-country}/.
   Reads the cookie if set; otherwise lands on the NG default. */

import { redirect } from "next/navigation";
import { getServerCountry } from "@/lib/country-server";

export default function RootIndex() {
  const country = getServerCountry();
  redirect(`/${country.code}`);
}
