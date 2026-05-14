# Merchant resolver audit — real catalog products

Each row picks ONE in-stock offer from that merchant's actual catalog. The `/api/go URL` is exactly what Havlo would redirect through when a user clicks 'View at {Merchant}' on the PDP. The test query is the offer's real product title, not a generic placeholder.

**`relay`** column: `Y` = stored URL is a Google Shopping relay (will trigger SerpAPI resolution); `N` = direct merchant URL (will passthrough straight to the merchant).


## NG — 7 merchants

| Store ID | Store name | relay | Product title | Click URL |
|---|---|---|---|---|
| `threechub` | 3C Hub | N | HONOR X5B Android Mobile Smart Phone With 64GB+4GB | https://havlo.io/api/go?url=https%3A%2F%2Fwww.3chub.com%2Fproducts%2Ffree-gift-or-1-000-ai... |
| `ajebomarket` | Ajebomarket | N | 1996 Nigeria Away Retro Jersey | https://havlo.io/api/go?url=https%3A%2F%2Fajebomarket.com%2Fproducts%2F1996-nigeria-away-r... |
| `bitmarte` | Bitmarte | N | White Air Force Nike | https://havlo.io/api/go?url=https%3A%2F%2Fbitmarte.com%2Fcustomer%2Fproduct%2Fwhite-air-fo... |
| `healthplus` | HealthPlus | N | Force Factor Anabolic Muscle Builder Capsules x150 | https://havlo.io/api/go?url=https%3A%2F%2Fhealthplusnigeria.com%2Fproducts%2Fforce-factor-... |
| `konga` | Konga | N | Tripod Stand For Camera- Phone With Wireless Remote | https://havlo.io/api/go?url=https%3A%2F%2Fwww.konga.com%2Fproduct%2F6982327%3Fcid%3D7681&i... |
| `medplus` | MedPlus | N | N/A VITAMIN C 1000MG EF... | https://havlo.io/api/go?url=https%3A%2F%2Fmedplusnig.com%2Fproduct%2Fna-vitamin-c-1000mg-e... |
| `supermart` | Supermart | N | Addmie Seasoning Powder Beef 8 g | https://havlo.io/api/go?url=https%3A%2F%2Fwww.supermart.ng%2Fproducts%2Faddmie-seasoning-p... |

## UK — 22 merchants

| Store ID | Store name | relay | Product title | Click URL |
|---|---|---|---|---|
| `amazon-co-uk-amazon-co-uk-seller` | Amazon.co.uk - Amazon.co.uk-Se | Y | STGsivir All-in-One PC Desktop Computer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `argos` | Argos | Y | Apple MacBook Pro 14" M5 CPU GPU | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `asos` | ASOS | N | Miss Selfridge Petite spun halter maxi dress in polka dot | https://havlo.io/api/go?url=https%3A%2F%2Fwww.asos.com%2Fmiss-selfridge-petite%2Fmiss-self... |
| `boots` | Boots.com | Y | Drunk Elephant Littles 7.0 Skincare Gift Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `boozt-de` | Boozt.de | Y | Tommy Hilfiger Dw0dw20672 Jacket Women's | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `currys` | Currys | Y | JBL Live 770NC Wireless Over-Ear Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `currys-business` | Currys Business | Y | Sony WF-1000XM5 Truly Wireless Noise Canceling Earbuds (Blac | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `dunelm` | Dunelm | Y | Dunelm Sports Water Bottle 1L | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDune... |
| `everymonday` | EveryMonday | Y | ASUS ROG Zephyrus G16 16" Gaming Laptop Ultra 9 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `iceland` | Iceland | Y | Lucozade Sport Drink Orange | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `jd-sports-global` | JD Sports - Global | Y | On Men's Cloudswift 4 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DJD+S... |
| `marks-electrical` | Marks Electrical | Y | Hotpoint HDE6VDB1 Electric Double Oven Cooker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMark... |
| `matalan` | Matalan | Y | Yumi Women's Fitted Midi Dress With Flute Sleeves | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `michael-kors-uk` | Michael Kors - UK | Y | Michael Kors Heather Large Leather Shoulder Bag | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `next` | Next | Y | Jolie Moi Women's Puff Long Sleeve Jersey Maxi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `ocado` | Ocado | Y | Sistema Klip It Plus Storage Containers 1Ltr (3 Pack) | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `qvc-uk` | QVC UK | Y | Kuhn Rikon Set of 2 Ratchet Grinders in Gift Boxes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `screwfix` | Screwfix.com | Y | Karcher SC 2 EasyFix Steam Cleaner | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `smol` | smol | Y | smol Essentials Bundle Eco-Friendly Household Cleaning Kit w | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `the-range` | The Range | Y | Trust GXT433K Pylo Multi platform Gaming Headset Camo - Grey | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `waitrose-partners` | Waitrose & Partners | Y | Plenty Kitchen Roll | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `wilko` | Wilko | Y | Vileda 2 in 1 Dustpan and Brush Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |

## US — 82 merchants

| Store ID | Store name | relay | Product title | Click URL |
|---|---|---|---|---|
| `adidas` | adidas.co.in | Y | X_PLR Path Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `best-buy` | Best Buy | Y | Motorola Moto G Stylus 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoog... |
| `dermstore` | Dermstore.com | Y | RMS Beauty SuperNatural Radiance Serum Broad Spectrum SPF 30 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `dick-s-sporting-goods` | DICK'S Sporting Goods | Y | Mens adidas F50 League FG Soccer Cleats | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `ebay` | eBay | Y | Restored Apple iPhone 16 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoog... |
| `ebay-breedproducts` | eBay - breedproducts | Y | Apple iPhone 14 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `ebay-carousel-store` | eBay - carousel-store | Y | Xiaomi Redmi Note 14 Pro, 12gb+256gb, 6.67 Inch Xiaomi Hyper | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRedm... |
| `ebay-cm602-az` | eBay - cm602_az | Y | Screen Protector Film For Apple Watch Series 10 46mm 42mm So | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `ebay-crazydeals93` | eBay - crazydeals93 | Y | Tecno Spark 30c Blue (8gb+128gb) 48mp-global Version-no Usa  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DTecn... |
| `ebay-creo-cellular` | eBay - creo_cellular | Y | Samsung Galaxy S22/S22+/S22 Ultra Unlocked Android Smartphon | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `ebay-designerconnection2012` | eBay - designerconnection2012 | Y | Tarte Babassu Foundcealer Skincare Foundation | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `ebay-focuscamera` | eBay - focuscamera | Y | JBL Charge 5 Portable Bluetooth Speaker Waterproof | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DJBL+... |
| `ebay-her-current-obsessions` | eBay - her.current.obsessions | Y | The Ordinary Niacinamide 5% Face and Body Emulsion | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DThe+... |
| `ebay-holman-directshoeoutlet` | eBay - holman-directshoeoutlet | Y | Adidas Women's X_PLRPATH Sportswear Shoes Variety | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `ebay-jodiealison` | eBay - jodiealison | Y | Maybelline Lash Sensational Luscious Waterproof Mascara | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMayb... |
| `ebay-keech-hospice-care` | eBay - keech-hospice-care | Y | Stanley Quencher H2.0 Flowstate Tumbler 0.88l | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStan... |
| `ebay-mera-dealz` | eBay - mera-dealz | Y | Universal Headphone Headband Head beam Silicone Cover for So | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSony... |
| `ebay-missouri-liquidation` | eBay - missouri-liquidation | Y | Beats Pill Portable Bluetooth Wireless Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `ebay-musiciansfriend` | eBay - musiciansfriend | Y | Harbinger Vari V1112 12" Powered Speakers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `ebay-pnpgames` | eBay - pnpgames | Y | Super Mario Galaxy 1 + Super Mario Galaxy 2 (nintendo Switch | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `ebay-pro-distributing` | eBay - pro-distributing | Y | Beats Studio Pro Noise Cancellation Headphones W/ Mightyskin | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeat... |
| `ebay-ravigu-51` | eBay - ravigu_51 | Y | Maybelline York Liquid Foundation, Matte & Poreless, Full Co | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `ebay-sertitanke` | eBay - sertitanke | Y | Beats Studio Pro Wireless Bluetooth Over-ear Headphones Seal | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeat... |
| `ebay-sscjd5` | eBay - sscjd5 | Y | Clinique Even Better Makeup SPF 15 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `ebay-trd-digital` | eBay - trd_digital | Y | Apple MacBook Air M4 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `home-depot` | Home Depot | Y | Ninja Mega Kitchen System Blender | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `kohl-s` | Kohl's | Y | Women's Croft & Barrow Long Sleeve Collared Blouse, Size: Me | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `lowe-s` | Lowe's | Y | Cafe French-Door Refrigerator CGE29DP2TS1 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `lowestrate-shopping` | LowestRate Shopping | Y | Sony INZONE H3 MDR-G300 Wired Gaming Headset | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `macy-s` | Macy's | Y | Calvin Klein Women's Smocked Floral Maxi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `mopani-pharmacy` | Mopani Pharmacy | Y | Elizabeth Arden Flawless Finish Sponge-On Cream Makeup | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `newegg-com-demproductsales` | Newegg.com - DemProductSales | Y | Google Pixel 9 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoog... |
| `newegg-com-minisforum-official` | Newegg.com - Minisforum Offici | Y | Mini PC with Ryzen 9 6900hx and Radeon 680m | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `newegg-com-techsaurus-ltd` | Newegg.com - Techsaurus LTD | Y | Google Pixel 9 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `nike-official` | Nike Official | Y | Nike Men's Court Vision Low Trainers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `nike-ae` | Nike.ae | Y | Nike Alphafly 3 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `nike` | nike.com | Y | Nike Men's DNA Dri-FIT Basketball Shorts | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `nordstrom` | Nordstrom | Y | Petal & Pup Women's Amora Strapless Maxi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `sephora-uae` | Sephora UAE | Y | Shiseido Synchro Skin Self-Refreshing Custom Finish Powder F | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `sephora-de` | Sephora.de | Y | Fenty Beauty Pro Filt'r Soft Matte Powder Foundation | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `staples` | Staples | Y | Asus ROG Strix G18 18" FHD+ 144Hz Gaming Laptop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `target` | Target | Y | Tracfone TCL Go Flip | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `tennis-warehouse` | Tennis Warehouse | Y | WILSON Women's Intrigue Pro Tennis Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `ulta-beauty` | Ulta Beauty | Y | Subtl. Beauty 5-in-1 Full Face Makeup Stack | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `walgreens` | Walgreens.com | Y | C4 Sport Pre-Workout | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `walmart` | Walmart | Y | Motorola Moto G Power 2024 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `walmart-authorized-beauty-distribution` | Walmart - Authorized Beauty Di | Y | NARS Natural Radiant Longwear Foundation | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `walmart-bench-ventures-corp` | Walmart - Bench Ventures Corp | Y | Xiaomi Redmi 14C 4G ROM RAM Dual SIM GSM Unlocked | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRedm... |
| `walmart-bv-official-store` | Walmart - BV Official Store | Y | Blackview Shark 6 Unlocked Phones, 5G T-Mobile Phones, 6.88  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-carote-official` | Walmart - Carote Official | Y | Carote 18pcs Pots and Pans Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `walmart-cellphonemax` | Walmart - CellphoneMAX | Y | Samsung Galaxy S21+ Plus 5G G996u 128gb | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-cellstoreusa` | Walmart - CELLSTOREUSA | Y | Samsung Galaxy S21 Ultra 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-chefman-direct` | Walmart - Chefman Direct | Y | Chefman 1.1 Cu. Ft. Countertop Microwave Oven | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `walmart-cleamol-co-ltd` | Walmart - Cleamol Co.,Ltd | Y | Nimo Gaming Laptop 17.3 inch Ryzen 9 8945hs,32gb Ram, 1TB Ss | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `walmart-creo-distributions-llc` | Walmart - Creo Distributions L | Y | Samsung Galaxy G998u S21 Ultra 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-dac-enterprises` | Walmart - DAC Enterprises | Y | SAMSUNG Galaxy A07-A075F Android Mobile Smart Phone With 64G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-darionindustries` | Walmart - Darionindustries | Y | Marvel Spider-Man Miles Morales | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `walmart-doogee-official` | Walmart - DOOGEE Official | Y | Doogee Note56 Plus Cell Phone | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-dynamic-musical-instruments-arts-and-crafts` | Walmart - Dynamic - MUSICAL IN | Y | Super Mario Odyssey | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `walmart-dyson-inc` | Walmart - Dyson, Inc. | Y | Dyson V11 Complete Cordless Vacuum Cleaner \| Iron \| New \| | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDyso... |
| `walmart-gipp-cookware` | Walmart - GiPP Cookware | Y | Gipp 5pcs Pots and Pans Set Non Stick,Cookware Sets with Rem | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `walmart-gmktec-usa` | Walmart - GMKtec-USA | Y | Gmktec Mini PC, Intel Alder Lake N95(Up to 3.4GHz), 16gb Ddr | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `walmart-gotham-cells` | Walmart - Gotham Cells | Y | Google Pixel 9 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoog... |
| `walmart-havato` | Walmart - Havato | Y | HAVATO Ice Makers Countertop with Handle, 26.5 lbs / 24 H, 8 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `walmart-hotdeals` | Walmart - HotDeals | Y | Samsung Galaxy S25 FE | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPixe... |
| `walmart-imglobal` | Walmart - IMGlobal | Y | Google Pixel 9 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoog... |
| `walmart-kikcoin` | Walmart - Kikcoin | Y | Kikcoin Acacia Wood Cutting Board, Cutting Board Set of 3 wi | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `walmart-knoc-knoc-treasures` | Walmart - Knoc Knoc Treasures | Y | Logitech G435 Lightspeed Wireless Gaming Headset | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `walmart-lang-de-sen` | Walmart - lang de sen | Y | 20 Piece Ceramic Pots and Pans Set Non Stick, Cookware Set w | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `walmart-marvins-tech-more` | Walmart - Marvins Tech & More | Y | Marvel's Spider-Man: Miles Morales Ultimate Edition | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `walmart-nothing-customer-support` | Walmart - Nothing Customer sup | Y | Nothing Phone | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-perfumesamerica` | Walmart - PerfumesAmerica | Y | Eros Versace Eau De Toilette Spray Men | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `walmart-quality-brands-deals` | Walmart - Quality Brands Deals | Y | Estee Lauder Double Wear Maximum Cover Camouflage Makeup | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `walmart-random-and-beyond` | Walmart - Random and BEYOND | Y | Motorola Moto G Play | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-reliant-cellular` | Walmart - Reliant Cellular | Y | Restored Samsung Galaxy Z Flip 4 5G F721u | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-rnruo` | Walmart - RNRUO | Y | Rnruo 15.6 inch Laptop Computer, 12gb Ddr5 256g Ssd, Intel N | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `walmart-shopaudioxtc` | Walmart - Shopaudioxtc | Y | JL Audio 12W6v3-D4 12" Subwoofer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `walmart-steals-deals` | Walmart - Steals & Deals | Y | L.A. Colors Shimmer Eye Palette | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `walmart-techmate-intl` | Walmart - Techmate Intl. | Y | SAMSUNG Galaxy A56-A566B Android Mobile Smart Phone With 128 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-the-phone-guys` | Walmart - The Phone Guys | Y | Samsung Galaxy S25 FE | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `walmart-turtle-beach` | Walmart - Turtle Beach | Y | Turtle Beach Burst II Air Wireless Gaming Mouse | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `walmart-value-tech` | Walmart - Value Tech | Y | Asus ROG Strix G16 Laptop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |

## DE — 9 merchants

| Store ID | Store name | relay | Product title | Click URL |
|---|---|---|---|---|
| `amazon-de` | Amazon.de | Y | Midea Standgeschirrspüler Serie 5 SF 5.45NW10C 10 Maßgedecke | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `amazon-de-amazon-de-seller` | Amazon.de - Amazon.de-Seller | Y | Lenovo IdeaPad Slim 5 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `cotton-on` | Cotton On | Y | Cotton On Women All Day Tube Top | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `en-zalando-de` | en.zalando.de | Y | Men's Endurance Athletic Shoes 'Masako' male | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `mediamarkt-de` | MediaMarkt DE | Y | Amazon ECHO Dot Max | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `mediamarkt-marketplace-de` | Mediamarkt Marketplace DE | Y | Samsung Galaxy A53 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `otto` | OTTO | Y | SodaStream 2 Bottles 1 Litre Dishwasher Safe Plastic, Transp | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `pccomponentes-de` | PcComponentes.de | Y | Philips Dual Basket Airfryer NA353/10 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `scharferladen` | Scharferladen | Y | VICTORINOX SWISS CLASSIC Faltbares Gemüsemesser Wellenschlif | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |

## AE — 6 merchants

| Store ID | Store name | relay | Product title | Click URL |
|---|---|---|---|---|
| `al-ramil-al-abyad` | Al Ramil Al Abyad | Y | Beko 60x60cm Freestanding Ceramic Electric Cooker fsm67320gx | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `amazon-ae-retail` | Amazon.ae - Retail | Y | Wilson Aluminum forged wok with marble coating Soft touch ha | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `amazon-ae-seller` | Amazon.ae - Seller | Y | LPONJAR Soccer Shin Guards for Kids Youth Adults - Shin Pads | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `lulu-hypermarket` | LuLu Hypermarket | Y | BLACK+DECKER Digital Microwave Oven 25L 900W 6 Auto Programs | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `ounass-ae` | Ounass.ae | Y | NUXE - Huile Prodigieuse Shimmering Florale Multi Purpose Dr | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `sharafdg` | SharafDG.com | Y | Nikai Refrigerator Double Door NRF280DN4S | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |

## IN — 20 merchants

| Store ID | Store name | relay | Product title | Click URL |
|---|---|---|---|---|
| `ajio` | ajio.com | Y | Domyos Skipping Rope Unisex Red Regular | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `amazon-in` | Amazon.in | Y | Swiss Beauty Select High On Glow Fixer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `computech-solutions` | Computech-Solutions | Y | Lenovo V15 G4 IRU FHD | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `croma` | croma.com | Y | Wonderchef Royal Velvet Purple Cookware Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `flipkart` | Flipkart | Y | Boat Bassheads 103 Wired Earphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `getit` | Getit | Y | Antec VX100M ARGB Micro-ATX Mini Tower Gaming Chassis | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `himkhand` | Himkhand | Y | Borosil Chef Delite Chopper BCH20DBB21 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `hitech-gamez` | Hitech Gamez | Y | Horizon Forbidden West | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `jiomart-electronics` | JioMart Electronics | Y | Greenchef Nexa 4 Burner Glass Top Gas Stove | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `mamaearth` | Mamaearth | Y | Mamaearth Face Wash | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `meesho` | meesho.com | Y | Flicka Silk Touch 3-in-1 Moisturizer and Primer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `myntra-mnow` | Myntra - MNow | Y | Nivia Pro Carbonite 7.0 Football Shoes for Men | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `nykaa` | Nykaa | Y | Minimalist Glow & Nourish Combo At Nykaa, Best Beauty Produc | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `nykaa-now` | Nykaa Now | Y | Morphe Flickering Sands Eyeshadow Palette | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `reliance-digital` | Reliance Digital | Y | Amazon Echo Dot 5th Gen Smart Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `shopsy-by-flipkart` | Shopsy By Flipkart | Y | Lenovo LOQ 13th Gen Gaming Laptop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `tata-cliq-fashion` | Tata CLiQ Fashion | Y | The Face Shop Rice Ceramide Moisturizing Emulsion | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `tata-cliq-luxury` | TATA CLiQ LUXURY | Y | Estée Lauder Estee Lauder Advanced Night Repair Synchronized | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `tatacliq` | tatacliq.com | Y | Decathlon FLX Synthetic Cricket Ball | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `techd-out` | Techd Out | Y | ASUS ROG Strix G16 Gaming Laptop Ryzen 9 8940HX | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |

## ZA — 8 merchants

| Store ID | Store name | relay | Product title | Click URL |
|---|---|---|---|---|
| `cash-converters` | Cash Converters | Y | Samsung Galaxy A26 5g - 128gb Rom + 6gb Ram - 6.7" - | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `makro` | Makro | Y | Philips 1000 Series 6.2L Analog Airfryer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `outdoorphoto` | Outdoorphoto | Y | Sony Alpha a7S III Mirrorless Camera | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `pick-n-pay-hypermarket` | Pick n Pay Hypermarket | Y | Goldair Air Fryer Silver/Aluminium gaf7861 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `sportsmans-warehouse` | Sportsmans Warehouse | Y | Nike One Classic Women's Dri-Fit Long-Sleeve Top | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `superbalist` | Superbalist | Y | Rimmel Thrill Seeker Lip Latex | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `takealot` | takealot.com | Y | Consol Lisbon Rectangular Roaster | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `yuppiechef` | Yuppiechef | Y | Philips 2000 Series Bagless Vacuum Cleaner XB2023/02 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |

## Cross-border — 518 merchants

| Store ID | Store name | relay | Product title | Click URL |
|---|---|---|---|---|
| `4home` | 4Home.co.za | Y | Mellerware Clothes Dryer 23700A | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `6pm` | 6pm.com | Y | Crocs Classic Clog Clog Shoes Nightshade : Men's 4 - Women's | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCroc... |
| `a1-tech-deals` | A1 Tech Deals | Y | JBL Charge 5 Portable Bluetooth Speaker Waterproof | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DJBL+... |
| `abercrombie-fitch` | Abercrombie & Fitch | Y | Abercrombie & Fitch Women's Ava Top | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `about-you` | ABOUT YOU | Y | ONLY Bundfaltenhose 'Poptrash' Damen Größe 42 graumeliert | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `academy-sports-outdoors` | Academy Sports + Outdoors | Y | Brooks Men's Ghost 17 Running Shoes White/Green - Men's Runn | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `accessorize` | Accessorize | Y | Amore Shopper Bag | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `acer-store-uk` | Acer Store UK | Y | Acer Nitro N50-660 Gaming Desktop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `acoustic-audio` | Acoustic Audio | Y | Alpine 2-Channel BBX-t600 BBX Series Class A/B Amplifier | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `addmecart` | addmecart | Y | Glen 6060 BL AC 60cm 1200 M3/H Filterless Kitchen Chimney | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `adorama` | Adorama | Y | Jamo S 803 Bookshelf | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBose... |
| `agamya-store` | Agamya Store | Y | 4 Burner Glass Gas Stove CT1040GTXLHFBBBL | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `ahm-online` | AHM Online | Y | Alva 3 Panel Gas Heater | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `aio` | AiO | Y | Candy COT1S45EW hladilnik | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `al-s-sporting-goods` | Al's Sporting Goods | Y | Nike Mercurial Superfly 10 Academy | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `albert-lee` | Albert Lee | Y | KitchenAid 30" Stainless Steel Slide In Electric Convection  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `aldoshoes` | aldoshoes.co.uk | Y | Aldo Women's Lothycan Satchel Bag | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `alibaba` | alibaba.com | Y | Good Quality Camon 30 Pro 5G Android 13 Smartphone Deca Core | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DTecn... |
| `aliexpress` | AliExpress | N | Patch Exercise Board Kit Welding  Electrical And Electronic  | https://havlo.io/api/go?url=https%3A%2F%2Fs.click.aliexpress.com%2Fs%2FNdpwztbAIgDMmxGbP8f... |
| `allbeauty` | allbeauty.com | Y | Benefit Game Set Bounce Mascara and Brow Stocking Filler Gif | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `alp-it-solutions` | Alp It Solutions | Y | Redragon K617 FIZZ 60% Wired RGB Gaming Keyboard | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `amazon` | Amazon | Y | Bose QuietComfort Ultra Wireless Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `amazon-uae` | Amazon UAE | Y | Yeoreo Eddiy 31.5" Straight Leggings | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `amazon-co-za-seller` | Amazon.co.za - Seller | Y | Chef's Choice 7-in-1 Digital Air Fryer 6L with Touch Screen  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `ambrose-wilson` | Ambrose Wilson | Y | Fine Plisse Soft Shirt Blue Fine Plisse Soft Shirt | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `american-eagle-outfitters` | American Eagle Outfitters | Y | AE Lace-Up Sweater Women's | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `andertons-music-co` | Andertons Music Co | Y | Universal Audio Galaxy Tape Echo | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `ant-esports` | Ant Esports | Y | Ant Esports KM500 Gaming Keyboard and Mouse Combo | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `anthropologie` | anthropologie.com | Y | Sony WF-1000XM5 Truly Wireless Noise Canceling Earbuds (Blac | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSony... |
| `apex-gaming-pcs` | Apex Gaming PCs | Y | Apex AI SM | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `appliance-city` | Appliance City | Y | Samsung Series 7 SpaceMax Fridge Freezer RS70F66KCFEU | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `appliance-warehouse` | Appliance Warehouse | Y | Mellerware Kettle Corded Plastic 1.7L 2200W Tugela | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `apricot` | Apricot | Y | Apricot Women's Side Ruched Textured Jersey Top | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `art-of-living-uk` | Art of Living UK | Y | Le Creuset Signature Cast Iron Risotto Pan | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLe+C... |
| `asda-george` | Asda George | Y | Ninja 7.6L Double Stack 2-Drawer Air Fryer sl300uk | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `asda-groceries` | Asda Groceries | Y | Shark Lift Away Upright Vacuum Cleaner nv602uk | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `asda-mobile` | Asda mobile | Y | Samsung-Z Fold7-Asda mobile | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `asics` | ASICS | Y | ASICS Men's Netburner Ballistic FF MT 4 Volleyball Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `asomanutritions-in` | asomanutritions.in | Y | MuscleBlaze Whey Performance Protein | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `asus-eshop-in` | ASUS eshop IN | Y | ASUS V16 Intel Core Laptop WUXGA 16 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `asus-store-uk` | ASUS Store UK | Y | Asus TUF Gaming A16 Laptop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `audico-online` | Audico Online | Y | Bowers Wilkins Pi6 True Wireless Ear Earbuds | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `audio-advice` | Audio Advice | Y | Klipsch Reference Premiere RP-8000F II Floorstanding Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `audio-shop` | Audio Shop | Y | JBL FLIP 6 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `audio-visual-kart` | Audio Visual Kart | Y | Polk Audio Signature Elite ES10 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `audiodeluxe` | AudioDeluxe | Y | Antares Autotune Artist Vocal Tuning Plug-in | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `avo-supershop` | Avo SuperShop | Y | AirPods Pro 3 - Apple | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `awd-it` | AWD-IT | Y | ASUS ROG STRIX X870-A Gaming Wifi, AMD AM5 Motherboard CPU B | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `bajaj-markets-x-ondc` | Bajaj Markets X ONDC | Y | GOVO GoSurround 220 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `bargains` | Bargains | Y | Midea 175L Bottom Freezer Fridge | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `bartyspares` | bartyspares | Y | for Dyson V11 Torque Drive Type Brush Bar Vacuum Cleaner Bru | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDyso... |
| `baseball-express` | Baseball Express | Y | Nike Women's Pro Shorts | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `bass-pro-shops` | Bass Pro Shops | Y | Crocs Classic Clogs for Women - Bone | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCroc... |
| `beauty-brands` | Beauty Brands | Y | Laura Geller Baked Blush-n-Brighten Marbleized Blush | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `beauty-house` | Beauty House | Y | Clinique Moisture Surge 100H Auto-Replenishing Hydrator | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `beautyonline` | BeautyOnline | Y | Annique Hydrafine Perfect Balance Night Cream | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `beautywests` | beautywests.com | Y | Nail Lacquer OPI | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `bed-bath-beyond` | Bed Bath & Beyond | Y | Hamilton Beach 4 Qt. 7-Speed Stand Mixer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `beelink` | Beelink | Y | Beelink SER8 Mini PC | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `benefit-cosmetics-uk` | Benefit Cosmetics UK | Y | Benefit I Spy Beauty Full Face Makeup Gift Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `betron-uk` | Betron UK | Y | Betron Wired Gaming Headset with Microphone | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `beyerdynamic` | beyerdynamic.com | Y | Beyerdynamic Aventho 300 Wireless Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `big-apple-buddy` | Big Apple Buddy | Y | Garmin Approach S44 GPS Golf Watch | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `big-sandy-superstore` | Big Sandy Superstore | Y | LG 4 Piece Kitchen Package with a 27 cu. ft. Counter-Depth M | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `bigme` | Bigme | Y | bigme B251 Color Monitor | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `bikeinn` | Bikeinn.com | Y | Huawei Watch Fit 4 Strap | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `bio-naturel-de` | bio-naturel.de | Y | Madara The Icons Light Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `bj-s-wholesale-club` | BJ's Wholesale Club | Y | Microsoft Wireless Controller Xbox | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `blackmore-it` | Blackmore IT | Y | Dell OptiPlex 5070 Desktop Core | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `blackview-global-store` | Blackview Global Store | Y | Blackview BL6000 Pro 5G Rugged Smartphone | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `blain-s-farm-fleet` | Blain's Farm & Fleet | Y | KitchenAid Fresh Prep Slicer/Shredder Attachment in White | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `bloomingdale-s` | Bloomingdale's | Y | Stanley Quencher Boot Straw Cover Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `blumaple` | Blumaple | Y | Freaks And Geeks Wired Controller for PS4 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `boat` | boAt | Y | BoAt Aavante Prime 5.1ch 500W Dolby Audio | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `boohoo` | boohoo | Y | DSGN Studio Women's Stripe Straight Leg Trouser | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `boohoo-usa` | boohoo USA | Y | Boohoo Women's Super Soft Long Sleeve Strap Top | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `boscov-s` | Boscov's | Y | CeraVe Moisturizing Cream | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCera... |
| `bose` | Bose | Y | Bose SoundLink Home Bluetooth Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `boston-college-bookstore` | Boston College Bookstore | Y | Maybelline Lash Sensational Sky High Tinted Mascara | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMayb... |
| `box` | box.co.uk | Y | HP Victus Gaming Laptop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `branded-lifestyles` | Branded Lifestyles | Y | Hisense Combi Refrigerator | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `brandsmart-usa` | BrandsMart USA | Y | Google Pixel 9a 128GB | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `brandzz` | Brandzz.co.za | Y | The North Face Simple Dome T-Shirt - White - S | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `brigette-s-boutique` | Brigette's Boutique | Y | IT Cosmetics Bye Bye Dark Spots Concealer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `brown-thomas` | Brown Thomas | Y | Reiss Found Straight Leg Trousers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `builders` | Builders | Y | Goldair Built-In Electric Oven And Gas Hob Ggop 540 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `bumsonthesaddle` | bumsonthesaddle.com | Y | Coros Pace 3 Watch | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `calliste-fashion` | Calliste Fashion | Y | s.Oliver Overall Jumpsuit Women's | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `calvin-klein` | Calvin Klein | Y | Calvin Klein Men's Ultra Soft Modal 3-Pack Slim Boxers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCalv... |
| `calvin-klein-uk` | Calvin Klein UK | Y | Calvin Klein - Trunks - Icon Logo Graphic - Black - Black -  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCalv... |
| `canoly` | Canoly | Y | Canoly C16 Cold Press Juicer Machine, 6.0" Extra Wide Feed C | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `care-to-beauty` | Care to Beauty | Y | Eveline Cosmetics Wonder Match Face Contouring Palette | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `carrefour-uae` | Carrefour UAE | Y | Samsung T Style French Door Refrigerator with 21.5" Family H | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `cdw` | CDW | Y | Apple MacBook Pro 14" M5 CPU GPU | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `centurion-technology-support-services` | Centurion Technology Support S | Y | Redragon RYLO S141 Membrane Gaming Keyboard and Mouse Wired  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `champs-sports` | Champs Sports | Y | Nike Men's Sportswear Club Washed Fleece Hoodie | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `chemist4u` | Chemist4U | Y | Bio Oil Skincare Oil | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `cherry` | Cherry | Y | CHERRY MX 8.2 TKL Wireless | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `chico-s` | Chico's | Y | Chico's Women's Ribbed Button Crewneck Tee | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `clinique` | Clinique | Y | Clinique All About Shadow Quad | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `clothing-junction` | Clothing Junction | Y | Wideleg Pants Stone / 7/8 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `coach` | COACH | Y | Coach Tabby Shoulder Bag | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `computech-store` | Computech Store | Y | Apple iMac | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `computer-mania` | Computer Mania | Y | Dell 24" Monitor SE2425HM | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `consumer-cellular` | Consumer Cellular | Y | Motorola Razr 2024 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `cosmetify` | Cosmetify | Y | Fenty Beauty Gloss Bomb Universal Lip Luminizer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `craftbymerlin` | Craftbymerlin | Y | For Airpods Max Headphones, Silicone Cover for Apple Airpod  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAirP... |
| `crampton-moore` | Crampton & Moore | Y | Panasonic SC-PMX802E-S Premium Hi-Fi Audio System | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `crate-barrel` | Crate & Barrel | Y | KitchenAid Fresh Prep Slicer/Shredder Attachment \| Crate &  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `crateandbarrel` | crateandbarrel.com | Y | KitchenAid Artisan Mini 3.5 Quart Tilt-Head Stand Mixer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `creative-labs` | Creative Labs | Y | Creative Sound Blaster Z SE Gaming and Entertainment Sound C | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `cricket-wireless` | Cricket Wireless | Y | Apple iPhone 17e | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `crocs` | crocs.com | Y | Crocs Classic Lined Clog | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `crutchfield` | Crutchfield | Y | KEF Q1 Meta Bookshelf Speakers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `cult-beauty` | Cult Beauty | Y | Milk Makeup Milk Lip + Cheek Cream Blush Stick | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `danish-endurance` | Danish Endurance | Y | DANISH ENDURANCE Long Distance Running Quarter Socks, Black/ | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `db-domestics` | DB Domestics | Y | Fridgemaster mtl55242e Tall Larder Fridge | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `decathlon-south-africa` | Decathlon South Africa | Y | Speed Hurdles 3 Heights | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `decathlon-uk` | Decathlon UK | Y | Mitre Ultimatch One Football | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `deckup` | DeckUp | Y | DeckUp Reno Ladder Book Shelf: Stylish & Functional Storage" | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `decure-in` | Decure.in | Y | Faber Hob Experia Ht904 ALU AI FFD\|Flame Failure Device | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `dell-south-africa` | Dell South Africa | Y | Dell 24" Monitor SE2425HM | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `dell-uk` | Dell UK | Y | Dell Pro Slim Desktop - w/ Windows 11 Pro & Intel Core Ultra | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `dhabi-one` | Dhabi One ظبي ون | Y | Siemens HK9K9V850M 90cm Cooker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `didi-beauty` | Didi Beauty | Y | Try Everything Bundle I Didi Beauty Co Bundle 2 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `dillard-s` | Dillard's | Y | Crystal Doll Ruffle Sleeve Fit & Flare Dress Womens Juniors | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `direct-deals` | Direct Deals | Y | Bosch PKE611BA2E 60cm Ceran Hob | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `dis-chem` | Dis-Chem | Y | Portia M Marula Skin Day Cream 50ml | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `distriscenes` | distriscenes.com | Y | Yamaha Dzr10d Dante | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `dock-bay` | Dock & Bay | Y | Dock & Bay Beauty Box Tiger Palm | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `dollar-s-fashion` | Dollar's Fashion | Y | Buy Women's Nora Iconic-fit Grey High Heel Sandals Online | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `dorothy-perkins-uk` | Dorothy Perkins UK | Y | Animal Print Short Puff Sleeve Maxi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `driffle` | Driffle | Y | Grand Theft Auto V Premium | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `dsw` | DSW | Y | Crocs Classic Clog \| Men \| Women's \| Atmosphere Light Gre | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCroc... |
| `dtlr` | DTLR | Y | Kid's Air Jordan 1 Mid | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike... |
| `dubai-audio` | Dubai Audio | Y | Klipsch GIG XL Portable Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `dunns` | Dunns | Y | IRIS GEO PLEATED SKIRT | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `dyson-official` | Dyson Official | Y | Dyson V11 Extra Cordless Vacuum Cleaner | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDyso... |
| `dyson` | dyson.com | Y | Citi Card Off \| Dyson V11 Absolute (Latest Technology) Cord | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDyso... |
| `e2zstore` | e2zSTORE | Y | Logitech G431 Gaming Headset | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `ecosmetics` | eCosmetics | Y | Giorgio Armani My Way Parfum | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `edischoolmart` | EdiSchoolMart | Y | Nivia Europa Moulded Basketball | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `ee` | EE | Y | Hisense A6Q 4K Ultra UHD HDR LED Smart TV | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSams... |
| `electronic-express` | Electronic Express | Y | Klipsch RP-500M II Bookshelf Speakers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `electronic-paradise` | Electronic Paradise | Y | LG XBOOM RNC5 Party Bluetooth v5.2 Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `elys-wimbledon` | Elys Wimbledon | Y | Le Creuset Stoneware Butter Dish \| Black - Elys Wimbledon | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `emi-snapmint` | EMI Snapmint | Y | Google Pixel 8a | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `eshtir` | Eshtir.com | Y | Beats Studio Buds + True Wireless Earbuds | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeat... |
| `essenza` | Essenza | N | Black Up Fdt Creme Haute Couvrance | https://havlo.io/api/go?url=https%3A%2F%2Fwww.essenza.ng%2Fproducts%2Fblack-up-fdt-creme-h... |
| `express` | Express | Y | Express Women's Signature Ponte Curved Sweetheart Neckline C | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `face-the-future` | Face the Future | Y | Gatineau Radiance Enhancing Vitamin C Serum 7ml | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `fashion-world` | Fashion World | Y | Skinny Jegging | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `fastrak` | Fastrak | Y | Active Line Array Speaker System [FTS-XT-218S] | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `fenty-beauty` | Fenty Beauty | Y | Fenty Beauty Lil' Gloss Bomb Trio Mini Lip Gloss Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFent... |
| `fenty-beauty-eu` | Fenty Beauty EU | Y | Fenty Beauty Pro Filt'r Soft Matte Longwear Foundation | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `finish-line` | Finish Line | Y | Nike Kids' Air Force 1 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `firstshop` | FirstShop.co.za | Y | Pcbuilder Cube Intel I5-1235u 16gb Ddr4 1tb Windows 11 Pro M | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `fit2run-the-runner-s-superstore` | Fit2Run, The Runner's Supersto | Y | Nike Alphafly 3 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `foot-locker` | Foot Locker | Y | adidas Women's Originals Samba Long Tongue Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAdid... |
| `footasylum` | Footasylum | Y | adidas Samba Women's OG | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike... |
| `footlocker` | Footlocker.co.uk | Y | Los Angeles Lakers Nike Men's Icon Swingman Jersey | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `fragola-brand` | Fragola Brand | Y | Samsung Galaxy A55 5g RAM 8GB ROM 128GB 6.6inches Super AMOL | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSams... |
| `fragrance-market` | Fragrance Market | Y | Cool Water Davidoff Eau De Toilette Spray Men | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `fragrancenet` | FragranceNet.com | Y | It's A 10 Miracle Leave-In Product | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `francis-gaye-jewellers` | Francis & Gaye Jewellers | Y | Swarovski Constella Pendant Necklace | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `frasers` | Frasers | Y | MEDION Erazer Bandit P20 Gaming PC | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `freemans` | Freemans | Y | Saint Tropez MilaSZ Striped Buttons Slim Fit Cardigan - Ice  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `freepeople` | freepeople.com | Y | Kanto ORA Powered Reference Desktop Speakers with Bluetooth  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `fulfillment-goods-uk` | Fulfillment Goods UK | Y | Google Pixel 9 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPixe... |
| `furnmart-south-africa` | Furnmart South Africa | Y | VolkanoX Paramount Series 8" Bluetooth Party Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `g-star` | G-Star.com | Y | Woman G-star 3d Biker Full Zip Sweater | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `gadxy` | Gadxy | Y | Ant Esports H1100 Pro RGB Wired Gaming Headset | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `galaxus` | Galaxus | Y | Sharkoon AK2 RGB Black ATX | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `game-4u` | GAME 4U | Y | Pulse Elite Wireless Headset | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `gamesncomps` | Gamesncomps | Y | Elgato Wave XLR Digital Audio Mixer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `gamex-computers` | Gamex Computers | Y | Logitech G502 X Plus Wireless Gaming Mouse | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `gauryog` | Gauryog | Y | Prestige Fame 3 Burner Gas Stove | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `gazelle-sports` | Gazelle Sports | Y | Men's Saucony Triumph 23 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `gear-change` | Gear Change | Y | Lake MX238-X Wide - MTB Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `gear4music` | Gear4music.com | Y | Antares Vocal De-Esser | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `geekom` | geekom.co.uk | Y | GEEKOM Air12 Tiny Computer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `geekompc` | geekompc.com | Y | GEEKOM NUC A5 Mini PC Gaming Computer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `geewiz` | GeeWiz | Y | Astrum SP150 Bluetooth Waterproof IP6 Speaker 12W Led | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `gilt` | Gilt.com | Y | bareMinerals Gen Nude Powder Blush | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `givenchy-beauty` | Givenchy Beauty | Y | Givenchy L'Interdit Eau de Parfum Rouge | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `glenindia` | GlenIndia | Y | Wall Mounted Ductfree Kitchen Chimney Plug CH6052DFMSBFBL60 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `gog` | gog.com | Y | Battletech Mercenary Collection Instant Activation | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `golf-galaxy` | Golf Galaxy | Y | CALIA Women's Everyday Rib Tank | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `google-store` | Google Store | Y | Google Pixel 10 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `grab-your-gadget` | Grab Your Gadget | Y | Logitech G Pro Wireless Gaming Mouse | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `greentoe-tv-s-home-theater` | Greentoe - TV's & Home Theater | Y | Samsung HW-Q990F 11.1.4 Channel Soundbar | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `grove-collaborative` | Grove Collaborative | Y | Lip2Cheek RMS Beauty | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `guitar-center` | Guitar Center | Y | Universal Audio Paradise Guitar Studio Plug-in (Software Dow | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `guitar-center-local-stores` | Guitar Center Local Stores | Y | Harbinger VARI V3412 12" Powered | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `gymshark` | Gymshark | Y | Gymshark Sport Synthetic Pants | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `h-samuel` | H Samuel | Y | Men's Casio Watch | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `h-m` | H&M | Y | H&M Ladies Floral Plissé Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `haier-uk` | Haier UK | Y | HAIER HFR5719EWMP Fridge Freezer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `hamilton-beach-uk` | Hamilton Beach UK | Y | Hamilton Beach Stealth Jug Kettle with 2-Slice Toaster and S | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `hardloop` | Hardloop | Y | Crocs Classic Clog | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCroc... |
| `harmanaudio` | HarmanAudio | Y | JBL PartyBox Encore Essential 2 100W Portable Bluetooth Part | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `harrison-consoles` | Harrison Consoles | Y | Multi-Band Compressor | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `harrods` | Harrods | Y | OUAI Leave In Conditioner | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `hawkins` | Hawkins | Y | Hawkins Futura Dual Hob Induction Cooktop FIC2A1 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `hbps-beauty` | HBPS Beauty | Y | Medicube AGE-R Booster Pro | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `hifi-corp` | HiFi Corp | Y | Russell Hobbs Stainless Steel Pack | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `hifimart` | HiFiMART.com | Y | Marantz Grand Horizon Wireless Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `high-country-outfitters` | High Country Outfitters | Y | On Women's Cloud X 4 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `holland-barrett` | Holland & Barrett | Y | Applied Nutrition ABE Pre Workout | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `homafy` | Homafy | Y | Sup Game Box Portable Retro Game Console | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `home-centre` | Home Centre | Y | Wonderchef 60L 2000W Oven Toaster Griller | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `home-outlet-direct` | Home Outlet Direct | Y | Thor Kitchen 6-Piece Appliance Package - 30-Inch Gas Range,  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `hood-de-hood-feed` | Hood.de - Hood Feed | Y | LG UltraGear 27G411A-B Monitor | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `hp` | HP | Y | HP OmniBook 5 16" AMD Ryzen AI 7 Laptop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `hp-store` | HP Store | Y | HP OmniDesk Slim Desktop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `hqhair` | HQHair | Y | Stila Custom Correcting Palette | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `hsn` | HSN | Y | Motorola Moto G 128GB Tracfone w/1500 Talk/Text/Data 1 Year  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `hughes` | Hughes | Y | Samsung Neo QLED 4K QN70F AI Smart TV | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHise... |
| `hyper-microsystems` | Hyper Microsystems | Y | Metroid Prime 4 Nintendo Switch | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNint... |
| `hyugalife` | Hyugalife | Y | Optimum Nutrition Gold Standard 100% Whey Protein | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `icrescent-apple-authorised-store` | iCrescent Apple Authorised Sto | Y | Apple Mac mini with M4 Pro chip | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `iherb` | iHerb | Y | Advanced Clinicals Dark Spot | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `ilia-beauty` | ILIA Beauty | Y | Ilia The Beauty of Clean Makeup Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `import-it-all` | Import It All | Y | CyberPowerPC Gamer Xtreme Gaming Desktop Computer, Intel Cor | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `incredible` | Incredible | Y | Russell Hobbs Stainless Steel Pack | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `infinity-flux` | Infinity Flux | Y | Nintendo Switch OLED Legend of Zelda: Tears of The Kingdom E | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNint... |
| `instacart` | Instacart | Y | Beautiful 3 Qt Air Fryer with TurboCrisp Technology | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `instant-pot` | Instant Pot | Y | Instant Pot 6qt 9-in-1 Pressure Cooker Bundle | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DInst... |
| `instant-gaming` | instant-gaming.com | Y | Battlefield 2042 (2021) (MICROSOFT STORE) - Instant download | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `intelligent-computing-enterprise` | Intelligent Computing Enterpri | Y | Dell PowerEdge R720 Server | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `it-net` | IT NET | Y | Microsoft Xbox Series S | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `itprice` | itprice | Y | HP External USB DVD-RW Drive | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `jacamo` | Jacamo | Y | Levi's 501 Original Straight Fit Jean - Size 34L - Dark Indi | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLevi... |
| `jbl-india` | JBL India | Y | JBL Tune 510BT On Ear Wireless Headphones with Mic | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `jcpenney` | JCPenney | Y | Vanity Fair Beauty Back Full-Figure Smoothing Comfort Wirele | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `jd-williams` | JD Williams | Y | FIG Regatta Roxienne Coat | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `jomashop` | Jomashop.com | Y | Clinique Even Better Makeup SPF 15 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `jumbo-ae` | Jumbo.ae | Y | HP Victus Gaming Laptop – 13th Gen / Intel Core i7-13620H /  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `just-cruizin-clothing` | Just Cruizin Clothing | Y | Gina Spanish Viscose Mini Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `just-press-play` | Just Press Play | Y | Starfield (Xbox Series X) | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DXbox... |
| `justmylook` | Justmylook | Y | L'Oréal Paris L'Oreal Paris True Match Liquid Foundation | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `juvia-s-place` | Juvia's Place | Y | Juvia's Place Blushed Duo Blush | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `kamal-imaging` | Kamal Imaging | Y | SAMSUNG Galaxy A36-A366B Android Mobile Smart Phone With 128 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `kccomputers` | kccomputers.co.in | Y | Cosmic Byte Ares Pro Tri-Mode Wireless Controller | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `kiabi` | KIABI | Y | Kiabi Tailored jacket | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `king-arthur-baking` | King Arthur Baking | Y | Cuisinart 14 Cup Food Processor | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `king-of-hobby-deals` | King of Hobby Deals | Y | Sony PlayStation 5 Standard Console with Fortnite Bundle | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPlay... |
| `kitchenaid` | KitchenAid | Y | Kitchenaid 4.5 Quart Deluxe Tilt-Head Stand Mixer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `kitchenaid-united-kingdom` | KitchenAid United Kingdom | Y | KitchenAid Classic Stand Mixer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `kitlocker` | Kitlocker | Y | Puma Orbita Cup Premier League Brilliance Football | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `kloppers` | Kloppers | Y | Bennett Read Air Fryer Oven | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `korean-skincare-b-v` | Korean Skincare B.V. | Y | Medicube AGE-R Booster Pro | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `laptop-mechanic` | Laptop Mechanic | Y | AMD Ryzen 5 5500 6-Core 3.6 GHz AM4 CPU | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `laptop-outlet` | Laptop Outlet | Y | Lenovo LOQ Tower 17IAX10 Intel Core Ultra 7 255HX | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `laptops-direct` | Laptops Direct | Y | Lenovo LOQ 15AHP10 AMD Ryzen Laptop 39.6 cm | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `lategan-van-biljoens` | Lategan & Van Biljoens | Y | Kenwood Air Fryer kHealthy Fry 7L | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `laura-geller` | Laura Geller | Y | Laura Geller Beauty Light and Full Coverage Foundation Kit | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `league-outfitters` | League Outfitters | Y | Champro Youth Triple Crown Open Bottom Baseball Pants | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `levi-s` | Levi's | Y | Levi's 501 Original Shrink-to-Fit Men's Jeans - Dark Wash 30 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLevi... |
| `lg` | LG | Y | LG UA77 LED AI 4K UHD Smart webOS TV | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLG+O... |
| `limango-de` | Limango DE | Y | Reisenthel carrybag Shopping Basket | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `listenup` | ListenUp | Y | Universal Headphone Headband Head beam Silicone Cover for So | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `littlewoods` | Littlewoods | Y | MSI Summit A16 AI+ A3HMTG-027UK AMD Ryzen AI 9 365 Hybrid | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `loaded` | Loaded | Y | The Park PC | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `loft` | LOFT | Y | Loft Women's Petite Ribbed Shoulder Button Midi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `lookfantastic` | LOOKFANTASTIC | Y | Erborian Super BB | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `lucky-brand` | Lucky Brand | Y | Lucky Brand Women's Sandwash Dolman T-Shirt | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `luckys-discount-centre` | Luckys Discount Centre | Y | Midea - Combi Fridge 262L - HD-359RWEN | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `lyst` | Lyst | Y | Crocs Unisex Classic Belt Bag | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `m-s` | M&S | Y | Brooks Men's Adrenaline GTS 25 Running Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCalv... |
| `mac-cosmetics` | MAC Cosmetics | Y | MAC Macximal Silky Matte Lipstick | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `mac-star-computers` | Mac Star Computers | Y | iPhone 15 Pro Max Ronaldo Football Phone Case | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DiPho... |
| `macpro-la` | MacPro-LA | Y | Apple MacBook Air 15" M4 Chip with 10-CPU | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMacB... |
| `maehwa` | maehwa | Y | Beauty of Joseon Relief Sun Rice + Probiotics | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `mainstreet-marketplace` | Mainstreet Marketplace | Y | Adidas FIFA World Cup 26 Trionda Training Ball | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `makeup` | Makeup | Y | Benefit Benetint Cheek & Lip Stain | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `manage-at-home` | Manage At Home | Y | Doro Leva E10 Mobile Phone | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `mandm` | MandM | Y | Puma Mens Run Favorite 1/4 Zip Running Top | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `mango-uk` | MANGO UK | Y | Mango Women's Contrast-Bodice Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `mani-ram-balwant-rai` | Mani Ram Balwant Rai | Y | Estée Lauder Estee Lauder Advanced Night Repair Synchronized | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `marathon-sports` | Marathon Sports | Y | ASICS Men's Novablast 5 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `maskura-store` | Maskura Store | Y | Insulated Straw Tumbler - 40oz Stanley Quencher H2.0 Tumbler | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStan... |
| `masons` | Masons | Y | Samsung Bespoke AI Side By Side 594L Family Hub Screen rs90f | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `masters-wholesale` | Masters Wholesale | Y | GE Profile Opal 2.0 Nugget Ice Maker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `maxaroma` | MaxAroma.com | Y | SK-II Pitera First Experience Kit | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `maxfashion` | MaxFashion | Y | Satin Kaftan Dress with Embellished Buttons | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `mcgrocer` | McGrocer | Y | MasterClass Burnished Brass Effect Kitchen Knife Set with Wo | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `mckeeversports` | McKeeverSports.com | Y | Puma Orbita Cup Premier League Lights Football | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `mdcomputers-in` | mdcomputers.in | Y | Logitech G733 Lightspeed Wireless Gaming Headset RGB | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `medicube-us` | medicube.us | Y | Affordable Glass Glow 7-Day Skincare Set Collagen Jelly Crea | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `meijer` | Meijer | Y | Samsung Galaxy A15 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `merlin-s-tv-appliance` | Merlin's TV & Appliance | Y | Sony Bravia 8 QD-OLED 4K HDR Google TV | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSony... |
| `mesh-computers` | Mesh Computers | Y | Mesh Next Day Work PC | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `mhc-world` | MHC World | Y | Defy 7.6L Digital Air Fryer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `michael-kors` | Michael Kors | Y | Michael Kors Women's Jet Set Large East West Crossbody Handb | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `micro-center` | Micro Center | Y | Sony WH-CH520 Wireless Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `microsoft-store` | Microsoft Store | Y | Microsoft 15" Surface Laptop Copilot+ PC | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `midwest-racquet-sports` | Midwest Racquet Sports | Y | WILSON Men's Rush Pro 4.5 Tennis Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `mirenesse` | Mirenesse | Y | Diamond Velvet Lip Plumpers Collection 4 Full Size Gift Lip  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `mistertennis` | MisterTennis.com | Y | Nox Pro Sports Bra Grey L Woman | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `mkproteinstar` | Mkproteinstar | Y | MuscleBlaze Biozyme Whey Protein PR | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `mob-beauty` | MOB Beauty | Y | MOB Beauty Eyeshadow | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `mobile-express` | Mobile Express | Y | Oppo Reno15 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `modern-living` | Modern Living | Y | Siemens iQ500 60cm Black S/Steel Freestanding Fridge ks36vax | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElec... |
| `moida` | MOIDA | Y | House of Hur Moist Ampoule Blusher | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `motiv8` | Motiv8 | Y | Shokz OpenFit Air True Wireless Open-Ear Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `motorola-united-kingdom` | Motorola - United Kingdom | Y | Motorola edge 60 neo | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `motorola-united-states` | Motorola - United States | Y | Motorola Razr Ultra 2025 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `mr-d` | Mr D | Y | SteelSeries Aerox 5 Wireless Gaming Mouse | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `mr-porter` | MR PORTER | Y | Nike Air Force 1 Leather and Suede Sneakers - Men - White Sn | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike... |
| `msi-online-store` | MSI Online Store | Y | MSI Pro AP272 All-in-One Computer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `mt-audio` | MT Audio | Y | GAS Audio CMP S3-24D1 - 24" (62cm) Subwoofer 8500 Watt RMS b | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `muscleblaze-official` | MuscleBlaze Official | Y | MuscleBlaze Biozyme Gold 100% Whey Protein | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `musicmajlis` | Musicmajlis | Y | Tolaye Dual Handheld Wireless Mic VHF VIH2500 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `myprotein-india` | Myprotein India | Y | Myprotein Impact Whey Protein | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `myworldphone` | MyWorldPhone.com | Y | Xiaomi Redmi Note 14 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRedm... |
| `naaptol` | naaptol.com | Y | 10 Pcs Stainless Steel Colored Handi Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `national-mobile` | National Mobile | Y | Apple iPhone 14 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `nba-store-india` | NBA Store India | Y | Nba Team Tribute Outdoor Basketball Memphis Grizzlies 'Light | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `net-a-porter` | NET-A-PORTER | Y | adidas Originals Samba OG Suede-trimmed Leather Sneakers - W | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `neural-system` | Neural System | Y | HP Omen 25L Gaming Desktop PC | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `new-era-eu` | New Era EU | Y | Adult New Era Retro Sports Mesh Jersey | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `newme` | NEWME | Y | NEWME Women's Fit And Flare Mock Neck Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `nfm` | NFM | Y | Beats Studio Pro Wireless Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `niche-beauty` | Niche-Beauty.com | Y | IT Cosmetics Your Skin But Better CC+ Cream Foundation SPF50 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `ninja-kitchen-germany` | Ninja Kitchen Germany | Y | Ninja Crispi fn101eu fryer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `nintendo` | Nintendo | Y | Nintendo Switch Oled | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `no7-beauty` | No7 Beauty | Y | No7 Restore & Renew Serum Foundation | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `noli` | Noli | Y | CeraVe Moisturizing Cream Refill | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCera... |
| `notino` | Notino.co.uk | Y | NARS Radiant Creamy Concealer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `novelty-computech` | Novelty Computech | Y | Logitech G733 Lightspeed Wireless Gaming Headset RGB | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `nutmeg-sporting-goods` | Nutmeg Sporting Goods | Y | Easton Typhoon USA Baseball Bat | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `nutrigize` | Nutrigize | Y | MuscleBlaze Whey Protein | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `nuu` | NUU | Y | NUU N10 Basic Cell Phone | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `nvsx-computers` | NVSX Computers | Y | Logitech G335 Wired Gaming Headset | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `office-shoes` | Office Shoes | Y | Nike Air Force Men's 1 '07 Trainer | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCroc... |
| `offspring` | Offspring | Y | men Nike Dunk Low Retro Premium Black | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike... |
| `old-khaki` | Old Khaki | Y | Men's Tiger Wide Leg Pants | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `olive-young-global` | Olive Young Global | Y | Beauty of Joseon Hanbang Serum Discovery Kit | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `oliver-bonas` | Oliver Bonas | Y | Sleep Heroes Essentials Beauty Gift Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `onbuy` | OnBuy.com | Y | Samsung Galaxy S24 Ultra 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `onedayonly` | OneDayOnly.co.za | Y | Russell Hobbs Air Fryer and Griller | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `oppo-official-store` | OPPO Official Store | Y | Oppo Reno14 Pro 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `optimaindia-in` | optimaindia.in | Y | Logitech G213 Prodigy RGB Gaming Keyboard | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `orzly` | Orzly | Y | Nintendo Switch & Switch OLED Poke Bundle Essential Accessor | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNint... |
| `oukitel` | oukitel.com | Y | Oukitel C36 128GB 4GB RAM Gsm Unlocked Phone Unisoc T606 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `ourshopee` | OurShopee.com | Y | Kenwood Khh 326 Wh One Size | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `overstock` | Overstock | Y | RESPAWN 900 Gaming Chair | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `pantaloons` | Pantaloons | Y | People Olive Solid Casual Full Sleeves Mandarin Collar Men S | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `paris-lunetier` | Paris Lunetier | Y | Ray Ban Wayfarer Sunglasses | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRay-... |
| `pc-richard` | PC Richard | Y | Razer Gaming Mouse Wireless Viper V3 Pro | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `pc-richard-son` | PC Richard & Son | Y | HP OmniDesk S03-0010 Desktop Intel 300 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `pcstudio-in` | pcstudio.in | Y | Logitech G502 Hero Wired Gaming Mouse | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `peacocks` | peacocks.co.uk | Y | Peacocks Women's Ditsy Flutter Sleeve Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `perigold` | Perigold | Y | Le Creuset Signature Oval Dutch Oven | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `peter-tyson` | Peter Tyson | Y | Bang & Olufsen Beosound A1 3rd Generation Portable Bluetooth | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `pittappillil-agencies` | Pittappillil Agencies | Y | Sujata MG03 Black 1000W Mixer Grinder with 3 Steel Jars & 1  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `planet-beauty` | Planet Beauty | Y | Vacation Super Spritz SPF 50 Face Mist | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `play-asia` | Play-Asia.com | Y | Uncharted Legacy of Thieves Collection | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `playstation-store` | PlayStation Store | Y | Jeu Vidéo PlayStation 4 Microids Gold Edition Construction S | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `pluginboutique` | pluginboutique.com | Y | Lexicon 224 Digital Reverb | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `plum` | Plum | Y | Plum 10% Niacinamide Face Serum Rice Water | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `poshmark` | Poshmark | Y | Apple Airpods Pro 2 Wireless Earbuds- Active Noise C | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `positive-grid-us` | Positive Grid - US | Y | Positive Grid Spark LINK XLR Wireless Audio System | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `powerimp-electronics` | Powerimp Electronics | Y | Apple MacBook Air 13.6 M3 A3113 \| Ultra Light | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMacB... |
| `premium-sound` | Premium Sound | Y | Focal Azurys Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `prettylittlething` | PrettyLittleThing | Y | Nasty Gal Women's Croc Bandeau Lace Up Maxi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `pro-direct-soccer` | Pro:Direct Soccer | Y | Nike Academy Football | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `procook` | ProCook | Y | ProCook Gourmet Kiru Knives | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `provantage` | Provantage | Y | Asus ROG Strix 25" Class Full HD Gaming LED Monitor | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `puma` | PUMA.com | Y | Puma ESS ELEVATED Hoodie Women | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `purplle-com-beauty-online` | Purplle.com - Beauty Online | Y | Minimalist Alpha Arbutin Face Serum | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `purplle-com-beauty-shop` | Purplle.com - Beauty Shop | Y | Nivea Women Deodorant Roll On Pearl & Beauty | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `purplle-com-purplle-beauty` | Purplle.com - Purplle Beauty | Y | Swiss Beauty High Performance Foundation \| Water-Resistant  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `purplle-com-purplle-shop` | Purplle.com - Purplle Shop | Y | Maybelline 903 Midnight Date Lipstick - Creamy, Hydrating Fo | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `qvc` | QVC | Y | Tracfone Moto G 2025 64GB Storage w/ 4.5GB Data Trcfne motog | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `ramas` | ramas.co.za | Y | Defy 614l Side By Side Fridge dff663 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `rareism` | rareism.com | Y | Rareism Women's Cowl Neck Abstract Print Regular Fit Top | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `ray-ban` | Ray-Ban | Y | Ray-Ban Junior New Wayfarer Sunglasses | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRay-... |
| `razer` | Razer.com | Y | Razer Viper V3 HyperSpeed Wireless Gaming Mouse | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `rebel` | Rebel | Y | Beautiful 10 in 1 6 Qt Electric Multi-Cooker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `rebel-gaming` | Rebel Gaming | Y | SteelSeries Aerox 3 Wireless Gaming Mouse | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `reiss` | Reiss | Y | Womens Reiss Kenzie Asymmetric Draped Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `retailbox` | retailbox.co.za | Y | Optiphi Active Ageless Activegel | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `richer-sounds` | Richer Sounds | Y | LG USC9S 3.1.3ch Soundbar | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `rihoas` | Rihoas | Y | Rihoas V Neck Pleated Midi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `rockford-fosgate` | Rockford Fosgate | Y | Rockford Fosgate R165-S Prime 6.5" 2-Way Component Speaker S | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `roseland-furniture` | Roseland Furniture | Y | Roseland Furniture Farro Kitchen Larder Unit Grey | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `runners-ae` | runners.ae | Y | ASICS Gel-Nimbus 27 ATC Men's Running Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `s-p-c-c-official` | S.P.C.C. Official | Y | MDS Taskforce Tee | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `sacramento-state-bookstore` | Sacramento State Bookstore | Y | JBL Tune 670NC Noise Cancelling Wireless On-Ear Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `safe-and-sound` | Safe and Sound | Y | Polk Audio Signature Elite ES55 Floorstanding Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `sally-beauty` | Sally Beauty | Y | Andreia Professional Lab Hydro Calcium Nail Treatment | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `saloosonline` | saloosonline.com | Y | Ruched Sleeve Print Dress with Necklace | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `samsbeauty` | SamsBeauty | Y | Beauty Creations Flawless Stay Powder Foundation | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `samsung-official-store` | Samsung Official Store | Y | Samsung Galaxy A16 4G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `samsung-uk` | Samsung UK | Y | Samsung Galaxy Z Flip7 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `saumyasstore` | SaumyasStore | Y | HP Core i5 13th Gen Laptop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `sb-traders-sb` | SB-Traders-SB | Y | Krome 330L Double Door Top Mounted Refrigerator \|KR-RFF330S | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `scan` | Scan.co.uk | Y | MSI Stealth A16 AI+ 16" Gaming Laptop AMD Ryzen AI 9 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `scheels` | Scheels | Y | Women's Nike Dunk Low Next Nature | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `schuh` | schuh | Y | Nike Dunk Women's Low | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike... |
| `sears-entrotek` | Sears - Entrotek | Y | Nioh Collection PS5 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPlay... |
| `sedeta` | Sedeta | Y | SEDETA 96 Inch L Shaped Gaming Desk | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `sevenoaks-sound-and-vision` | Sevenoaks Sound and Vision | Y | Focal Azurys Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `shany` | SHANY | Y | SHANY Carry All Trunk Makeup Gift Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `sharp-imaging` | Sharp Imaging | Y | Edifier MF3 Portable Voice Amplifier | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `sheenu-game-center` | Sheenu Game Center | Y | Assassin's Creed Mirage | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `sheglam` | sheglam.com | Y | Dew & Done Skin Tint | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `shein` | Shein | Y | The Ordinary Niacinamida al 10% + Zinc al 1% 1oz/30ml, | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DThe+... |
| `shinrai-knives` | Shinrai Knives | Y | Shinrai Knives - Damascus Print Epoxy Sapphire 3-Piece Knife | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `shoes-n-feet` | SHOES-n-FEET | Y | BROOKS GHOST 17 MEN'S BLACK/WHITE / 10 / D | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `shop-apotheke` | SHOP APOTHEKE | Y | Clinique Moisture Surge Hydrator | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `shop-preethi-in` | shop.preethi.in | Y | Preethi Zodiac Mixer Grinder 750 Watt 5 Jars | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `shopatsc` | ShopatSC | Y | Sony WH-CH520 Wireless Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `shoppers-stop` | Shoppers Stop | Y | AND Women's Ruffled Spaghetti Strap Maxi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `shopsimon` | ShopSimon | Y | Henckels Modernist 14-pc Self-Sharpening Knife Block Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `shopwss` | ShopWSS | Y | Mens adidas F50 League FG Soccer Cleats | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `sigma-sports` | Sigma Sports | Y | Science in Sport SIS GO Isotonic Energy Gel Variety Pack | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `simply-be` | Simply Be | Y | Outlet - Size 7 - Skechers Skech Cloud Trainers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `simply-sound-lighting` | Simply Sound & Lighting | Y | RCF Art 915-A 15" Active Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `slam-city-skates-uk` | Slam City Skates UK | Y | Nike SB Dunk Low Pro Electric Skate Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike... |
| `slikk-club` | Slikk Club | Y | Buy Slikk x Revolte Solid Fit And Flare Dress women | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `smallable` | Smallable | Y | Kreafunk Glowie multi-function Bluetooth speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `smart-home-sounds` | Smart Home Sounds | Y | Bowers & Wilkins 607 S3 Bookshelf Speakers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `smiths-tv` | Smiths TV | Y | Hisense HDCEC5C10B 50cm Electric Ceramic Cooker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `smytten` | Smytten | Y | Iba Must Have Glam Look Makeup Box 114 g | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `snapklik-ae` | Snapklik AE | Y | Microsoft Surface Laptop 7 13.8" | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `snapklik` | Snapklik.com | Y | KOOFORWAY Triple Screen Laptop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `snipes-usa` | SNIPES USA | Y | Air Jordan 1 Mid SE Women's Basketball Sneakers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAir+... |
| `solid-state-logic` | Solid State Logic | Y | SSL Native Bus Compressor 2 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `sotrue` | Sotrue | Y | Sotrue Strobe Cream | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `sound-town-electronics` | Sound Town Electronics | Y | RCF HDL 50-A 4K Active Three-Way Line Array Module | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `spicewalla` | Spicewalla | Y | Kitchen Essentials Collection | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `sports-palace` | sports palace | Y | Nivia Air Strike Football | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `sportsman-s-warehouse` | Sportsman's Warehouse | Y | Crocs Men's Classic Clogs - Blue Bolt M6/W8 by Sportsman's W | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCroc... |
| `ssense` | ssense.com | Y | Resurfacing Compound U Beauty | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `stanley-1913` | Stanley 1913 | Y | Stanley Quencher Luxe Flowstate Tumbler | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStan... |
| `stanley-1913-uk` | Stanley 1913 UK | Y | Stanley Quencher H2.0 FlowState Tumbler | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStan... |
| `stellar` | Stellar | Y | Stellar 1000 5-Piece Saucepan Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `stockx` | StockX | Y | Nintendo Switch OLED | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStan... |
| `studio` | Studio | Y | Edifier G1500 RGB & Bluetooth Gaming 2.0 Speakers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `style-union` | Style Union | Y | Style Union Sleeveless Maxi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `stylevana` | Stylevana | Y | [Deal] The Ordinary - Niacinamide 10% + Zinc 1% - 30ml by St | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `sun-sand-sports-uae` | Sun & Sand Sports UAE | Y | New Era Men's MLB New York Yankees Joggers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `superdrug` | Superdrug.com | Y | Optimum Peptide Day Cream SPF 50 50ml | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `swarovski-uk` | Swarovski UK | Y | Swarovski Imber Tennis Bracelet | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `sweetcare` | SweetCare | Y | Clarins Skin Illusion Full Coverage | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCera... |
| `sweetwater` | Sweetwater | Y | Baby Audio Parallel Aggressor Compression and Saturation Plu | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `swiss-beauty` | Swiss Beauty | Y | Select Light Em Up Face Palette Twilight | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `syga-india` | Syga India | Y | ASUS AIO A3202,21.45",12th Gen Intel Core i3-1215U | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `talkshoplive` | TalkShopLive | Y | Screen Protector Film For Apple Watch Series 10 46mm 42mm So | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `tattahome` | Tattahome | Y | Le Creuset Cocotte Round Evolution 24 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLe+C... |
| `techable` | Techable | Y | Apple Watch Hermès Series 10 – 46mm GPS + 5G – Titanium \| T | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `techinn` | Techinn.com | Y | AMD Ryzen 7 7700 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `technivision-fze` | Technivision FZE | Y | Samsung Essential Monitor S3 S30GD 100Hz Full HD | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `tello` | Tello.com | Y | Samsung Galaxy A15 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `tennis-point` | Tennis-Point.co.uk | Y | Under Armour Tech Twist V-Neck Short Sleeve Womens | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `the-bank-of-electronics` | The Bank of Electronics | Y | OnePlus 13 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhon... |
| `the-children-s-place` | The Children's Place | Y | The Children's Place Boys Short Sleeve Layering T-Shirt | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `the-cornell-store` | The Cornell Store | Y | For Airpods Max Headphones, Silicone Cover for Apple Airpod  | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAirP... |
| `the-device-depot` | The Device Depot | Y | Samsung Galaxy S24 Ultra 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSams... |
| `the-digital-experience` | The Digital Experience | Y | JBL BAR 1000MK2 7.1.4 Channel Soundbar with Detachable Speak | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `the-edinburgh-remakery` | The Edinburgh Remakery | Y | Dell XPS 13 Laptop | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDell... |
| `the-entertainer` | The Entertainer | Y | Marvel's Spider-Man: Miles Morales Ultimate Edition | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `the-feed` | The Feed | Y | Gel SiS Beta Fuel | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `the-fragrance-shop` | The Fragrance Shop | Y | Dior Sauvage Eau de Parfum | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `the-natural-wash` | The Natural Wash | Y | TNW The Natural Wash De-Tan Face Pack | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `the-perfume-shop` | The Perfume Shop | Y | Calvin Klein CK One Eau de Toilette | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `the-reliable-store` | The Reliable Store | Y | Edifier P12 Passive Bookshelf Speakers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `the-revolver-club` | The Revolver Club | Y | Edifier D12 Desktop Stereo Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `the-sound-factor` | The Sound Factor | Y | Edifier R2000DB Bookshelf Speakers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `thomann` | thomann.co.uk | Y | Antares AutoTune Vocal EQ Download | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `thomann-de` | thomann.de | Y | Blue Cat Audio Blue Cat's MB-7 Mixer Download | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `tillys` | Tillys | Y | Vans Super Lowpro Womens Shoes - Mint - Size: 8.5 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `torrid` | Torrid | Y | Women's Torrid Cotton Crew Babydoll Top | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `tower-housewares` | Tower Housewares | Y | Tower Cerasure 2 Piece Frying Pan Set | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `tractor-supply-company` | Tractor Supply Company | Y | Molly Yeh Women's Puff-Sleeve Fleece Sweater | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `tradeindia` | Tradeindia.com | Y | Steam Deck OLED | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `trendyol` | Trendyol | Y | MusclePharm Select BCAA | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `triquip-sports-tech` | triQUIP Sports Tech | Y | SG RSD Spark Kashmir Willow Cricket Bat | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `ttk-prestigelimited` | TTK PrestigeLimited | Y | Prestige Apex Blendo 500 Watt Mixer Grinder with 4 Jars | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `turntable-lab` | Turntable Lab | Y | KEF Q1 Meta Bookshelf Speakers | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `ubisoft-store` | Ubisoft Store | Y | Assassin's Creed Odyssey | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `ubisoft-store-uk` | Ubisoft Store UK | Y | Assassin's Creed Odyssey - Gold Edition - PC (Ubisoft Connec | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `ubuy` | Ubuy | Y | Giantex 41" Kitchen Pantry Cabinet | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComp... |
| `umkc-bookstore` | UMKC Bookstore | Y | Apple MacBook Air 15" M4 Chip with 10-CPU | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMacB... |
| `undiscovered-realm` | Undiscovered Realm | Y | Kombo Klash Board Game | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `upcircle-beauty` | UpCircle Beauty | Y | UpCircle The Pamper Kit | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `vedant-computers` | Vedant Computers | Y | Logitech G402 Hyperion Fury Gaming Mouse | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `velan-store` | Velan Store | Y | Nilkamal Multirack 04 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `vevor-de` | vevor.de | Y | VEVOR Farmhouse Kitchen Sink 304 Stainless Steel Drop-in Sin | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppl... |
| `vhg-depot` | VHG Depot | Y | MuscleBlaze Whey Protein | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `virgin-megastore` | Virgin Megastore | Y | Edifier R990BT Bluetooth Active Bookshelf Speakers 2.0 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `vplak` | vplak.com | Y | Edifier R1080BT Bookshelf Speaker | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `walts-tv` | Walts TV | Y | LG Class C4 Series OLED evo 4K Smart TV | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLG+O... |
| `warehouse-fashion` | Warehouse Fashion | Y | Coast Women's Cap Sleeve Floral Chiffon Midi Dress | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `watsons-uae` | Watsons UAE | Y | Armaf Beaute Parfaite Fix Compact Powder | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `westwing` | westwing.co.uk | Y | Le Creuset Cast Iron Signature Round Casserole | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLe+C... |
| `wetsuit-outlet-de` | Wetsuit Outlet DE | Y | Zhik Damen Performance Unisuit | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `williams-sonoma` | Williams-Sonoma | Y | Instant Pot Duo Crisp with Ultimate Lid Multi-Cooker & Air F | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `wilson-emea-united-kingdom` | Wilson EMEA - United Kingdom | Y | Wilson NFL Stride Pro Eco Football | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `wireless-place` | Wireless Place | Y | Xiaomi Redmi Note 14 5G | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRedm... |
| `wmf-com-de` | wmf.com/de | Y | WMF Gewürzmühle unbefüllt Trend | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `wonderprice-uk` | Wonderprice UK | Y | Google Pixel 9 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPixe... |
| `xbox` | xbox.com | Y | Grand Theft Auto The Trilogy | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `xdeal` | Xdeal.co.uk | Y | Google Pixel 9 | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPixe... |
| `yami` | Yami | Y | UFORU Kitchen Gadget 6-Piece Set【White】Fruit Peeler Melon Sc | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `yesstyle` | YesStyle.com | Y | House of Hur Moist Ampoule Blusher | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `ysl-beauty-us` | YSL Beauty US | Y | Saint Laurent Loveshine Plumping Lip Oil Gloss | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeau... |
| `zappos` | Zappos.com | Y | Under Armour Women's Charged Surge 4 Running Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `zara-uk` | Zara UK | Y | LILO & STITCH DISNEY SWEATSHIRT AND TROUSERS SET | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFash... |
| `zebrs` | Zebrs | Y | Auto Clean Curved Glass Filter-less Kitchen Chimney Motion S | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome... |
| `zepto` | Zepto | Y | Sony PlayStation 5 Standard Console with Fortnite Bundle | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGami... |
| `zoot-sports-europe` | Zoot Sports Europe | Y | Mens Zoot Sports LTD Cycle Exos Bib | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSpor... |
| `zop` | Zop | Y | Satin Crepe Collar Buttoned Down Shirt Dress with Belt | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |
| `zumiez` | Zumiez | Y | adidas Samba OG Cloud White & Mauve Shoes | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAdid... |
| `zzounds` | zZounds | Y | Focal Bathys Wireless Noise Cancelling Headphones | https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudi... |

---

**Total merchants with real catalog products: 672**


---

# Verification agent prompt

> Paste the section below into Claude in Chrome (or any
> browser-capable AI agent) to walk every row in the table above
> and record where the `/api/go` URL actually lands.

## What this audit tests

Each row's **Click URL** is the exact URL Havlo generates when a
user clicks "View at {Merchant}" on the PDP for the **real product
listed in that row's Product title**. The agent's job: click each
URL, follow the redirect chain, and record the final destination
plus how well it matches the expected merchant PDP.

This is end-to-end resolver verification — NOT a URL-pattern
sanity check. We're testing whether each merchant's catalog
offers actually get the user to a real PDP for the product they
clicked on.

## How to read the `relay` column

- **`relay = N`** — the stored `offer.url` is already a direct
  merchant URL (e.g. `https://www.konga.com/product/6982327`).
  Havlo's `/api/go` resolver does a simple passthrough — adds
  the affiliate tag if any, then redirects. Expected landing:
  the merchant's PDP for that exact product. Failure here means
  the URL is dead / 404 / wrong-product.

- **`relay = Y`** — the stored URL is a Google Shopping relay
  (`google.com/search?ibp=oshop&prds=...`). Havlo has to resolve
  it via SerpAPI's `google_product` endpoint at click time.
  Expected landing depends on the resolver path:
    - Best: SerpAPI returns the merchant's direct PDP for the
      product → user lands on real product page.
    - Acceptable fallback: SerpAPI returns nothing usable →
      Havlo's `merchant_search` fallback redirects to the
      merchant's search page with the product title prefilled.
    - Bad: SerpAPI returns a DIFFERENT merchant's seller link
      (e.g. Walmart for a Fashion-Nova-tagged relay) → user
      lands on the wrong merchant. The hostname-verify guard
      I added in May 2026 should reject this, but worth
      confirming live.

## Procedure

For each row in the table above:

1. **Open the Click URL** in a fresh browser tab. Use a real
   Chrome / Firefox window (NOT headless — many merchants run
   Cloudflare / Akamai bot defences that block automation).

2. **Wait for ALL redirects to settle**. The `/api/go` route
   issues a 307 redirect; the merchant may then issue further
   redirects of its own (CDN, country detection, etc.). Give it
   5-10 seconds.

3. **Classify the final destination** as exactly one of:

   - **`pdp-ok`** — Landed on the merchant's product detail page
     for the EXACT product in the Product title column. URL bar
     shows a path like `/products/<slug>` or `/dp/<asin>` etc.
     Page has product image, price, "Add to cart" / "Buy now"
     CTA visible. This is the BEST outcome.

   - **`pdp-different-product`** — Landed on the merchant's PDP
     but for a DIFFERENT product than expected. The merchant is
     right but the product is wrong. Note the actual product
     title in your report.

   - **`pdp-wrong-merchant`** — Landed on a PDP at a DIFFERENT
     MERCHANT than the row's storeId. This is the worst case —
     user clicked "View at {X}" and ended up at merchant Y. May
     2026 user report: "View at Fashion Nova ends up at Walmart."
     Note the actual merchant in your report.

   - **`search-ok`** — Landed on the right merchant's search
     results page with the product title in the search box AND
     the first result is plausibly the same product. The
     `merchant_search` fallback fired and produced something
     usable.

   - **`search-empty`** — Right merchant's search page but zero
     results for the query. The URL pattern works but the
     merchant doesn't carry this product (or doesn't index it
     by this title).

   - **`search-irrelevant`** — Right merchant's search page but
     the results don't match the product the user clicked on
     (e.g. searched "Drunk Elephant Skincare Gift Set" and got
     200 unrelated cosmetics). Fallback fired but the merchant's
     search is poor.

   - **`homepage`** — Landed on the merchant's homepage, no
     search performed. Resolution failed and even the fallback
     URL pattern didn't take.

   - **`havlo-recovery`** — Landed back on a Havlo page
     (`/compare` or `/deals`). All resolver fallbacks failed.

   - **`404`** — Page returned an HTTP 404 or "Product not
     found".

   - **`cloudflare-block`** / **`other-block`** — Anti-bot
     interstitial blocked the browser. URL might be fine but
     this audit context can't verify.

   - **`wrong-domain`** — Landed on a completely different
     domain than expected (URL was stale, merchant rebranded /
     was acquired).

4. **Record the result** in a markdown table:

```
| Country | Store ID | Verdict | Final URL | Actual title (if pdp-*) | Notes |
```

## Report format

After all rows, summarise:

- Total `pdp-ok` (the goal — these are wins)
- Total `pdp-different-product` + `pdp-wrong-merchant` (resolver
  bugs — fix priority HIGH)
- Total `search-ok` + `search-empty` + `search-irrelevant` (the
  fallback fired — `search-ok` is acceptable, others are
  fallback-pattern bugs to fix)
- Total `homepage` + `havlo-recovery` + `404` + `wrong-domain`
  (resolver completely failed)
- Total `cloudflare-block` + `other-block` (unverifiable from
  this context — engineering checks separately)

Then list the top 5 patterns:
- e.g. "8 of 22 UK merchants returned `pdp-wrong-merchant` for
  Google-relay offers — SerpAPI is picking the wrong seller"
- e.g. "All 7 NG merchants returned `pdp-ok` — direct-URL
  passthrough works as designed"

## Constraints

- Stay in incognito / private mode.
- Don't log in, don't add to cart, don't enter personal info.
- For `relay = Y` rows, expect SerpAPI to take 2-3 extra seconds.
  Be patient with the redirect chain.
- If the agent has access to the Havlo telemetry table
  (`click_resolutions`), cross-reference each click with the
  row it generated to capture which fallback step fired. The
  `resolution_step` column tells you EXACTLY what the resolver
  did. If you don't have DB access, the engineering team can
  pull this after the audit by matching on offer_id (in the
  row's Click URL `&id=` param).

---

# Why some merchants have `relay = Y` and others have `relay = N`

Two ingest paths:

- **Playwright scrapers** (`scripts/scrapers/*.ts`) — visit
  each merchant's site directly, extract product details + URL.
  Output: direct merchant URLs. NG retailers (Konga, Jumia, 3C
  Hub, HealthPlus, etc.) are scraped this way. → `relay = N`.

- **SerpAPI ingest** (`scripts/ingest-providers.ts` + Provider
  SerpAPI Shopping) — query Google Shopping for deals across
  international markets. SerpAPI's response in the deal
  `link` field is **the Google Shopping relay URL**, not the
  merchant's direct PDP. Most UK / US / DE / AE / IN merchants
  surface this way. → `relay = Y`.

For `relay = Y` offers, the merchant's direct PDP URL is hidden
behind the Google relay. At click time `/api/go` calls SerpAPI's
`google_product` endpoint to extract the direct seller link from
the relay's embedded product ID. This works but:

  - Costs 1 SerpAPI credit per cold click
  - Can fail (product ID expired / removed from Google Shopping)
  - Can return the wrong merchant (Google relay is multi-seller;
    SerpAPI returns the first seller, which isn't always the
    one tagged in our DB row)

**Future improvement (out of scope for this audit):** resolve
Google relays at INGEST time rather than at click time. Cache
the resolved direct PDP URL in `offer.url` so every click is a
fast passthrough with no SerpAPI lookup. Trade-off: spends a
SerpAPI credit per offer at ingest (~3000 credits per cron) but
eliminates the per-click resolver risk entirely.
