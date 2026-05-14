# Merchant resolver audit — real catalog products

Each row picks ONE in-stock offer from that merchant's actual catalog. The **Click URL** is exactly what Havlo would redirect through when a user clicks 'View at {Merchant}' on the PDP. The test query is the offer's real product title.

**`relay`** column: `Y` = stored URL is a Google Shopping relay (triggers SerpAPI resolution at click time); `N` = direct merchant URL (passthrough).

> **Targeted subset for the focused audit**: see `docs/merchant-resolver-audit-targets.json` (38 rows, ~28 SerpAPI credits).

## NG — 8 merchants

### 3C Hub `(threechub)`  · relay=N

**Product**: HONOR X5B Android Mobile Smart Phone With 64GB+4GB

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.3chub.com%2Fproducts%2Ffree-gift-or-1-000-airtime-honor-x5b-android-mobile-smart-phone-with-64gb-3gb-128gb-3gb-128gb-4gb&id=c0212c31-efcc-4cff-a410-7156d3d37e42&title=HONOR+X5B+Android+Mobile+Smart+Phone+With+64GB%2B4GB&store=threechub&storeName=3C+Hub
```

### Ajebomarket `(ajebomarket)`  · relay=N

**Product**: 1996 Nigeria Away Retro Jersey

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fajebomarket.com%2Fproducts%2F1996-nigeria-away-retro-jersey&id=baa75853-7669-4973-b39f-0ce01d04dc6f&title=1996+Nigeria+Away+Retro+Jersey&store=ajebomarket&storeName=Ajebomarket
```

### Bitmarte `(bitmarte)`  · relay=N

**Product**: White Air Force Nike

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fbitmarte.com%2Fcustomer%2Fproduct%2Fwhite-air-force-nike&id=679df63a-b13c-42c6-bdba-afaca7f036bd&title=White+Air+Force+Nike&store=bitmarte&storeName=Bitmarte
```

### HealthPlus `(healthplus)`  · relay=N

**Product**: Force Factor Anabolic Muscle Builder Capsules x150

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fhealthplusnigeria.com%2Fproducts%2Fforce-factor-anabolic-muscle-builder-capsules-x150&id=be7c0cc2-05e0-48e7-a0d3-41be47e24695&title=Force+Factor+Anabolic+Muscle+Builder+Capsules+x150&store=healthplus&storeName=HealthPlus
```

### Konga `(konga)`  · relay=N

**Product**: Tripod Stand For Camera- Phone With Wireless Remote

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.konga.com%2Fproduct%2F6982327%3Fcid%3D7681&id=0754d892-8fbd-482b-a455-3e64e8dd09d3&title=Tripod+Stand+For+Camera-+Phone+With+Wireless+Remote&store=konga&storeName=Konga
```

### MedPlus `(medplus)`  · relay=N

**Product**: N/A VITAMIN C 1000MG EF...

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fmedplusnig.com%2Fproduct%2Fna-vitamin-c-1000mg-effervescent-20tab-VJDJC7&id=bf7b2182-2404-4db7-8604-c29c1a4ad0e0&title=N%2FA+VITAMIN+C+1000MG+EF...&store=medplus&storeName=MedPlus
```

### Slot `(slot)`  · relay=N

**Product**: SLOT MINI BLUETOOTH SPEAKER BTS12 + SLOT TWS BLUETOOTH WITH ENC+ANC BH-T59-26% OFF

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.slot.ng%2Fslot-mini-bluetooth-speaker-bts12-slot-tws-bluetooth-with-encanc-bh-t59.html&id=fdae8cad-af80-4a93-a646-a6bb25bb80b7&title=SLOT+MINI+BLUETOOTH+SPEAKER+BTS12+%2B+SLOT+TWS+BLUETOOTH+WITH+ENC%2BANC+BH-T59-26%25+OFF&store=slot&storeName=Slot
```

### Supermart `(supermart)`  · relay=N

**Product**: 21st Century Magnesium 250 mg 110 Tablets

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.supermart.ng%2Fproducts%2F21st-century-magnesium-250-mg-110-tablets&id=705d8e20-29f6-45e9-a0e2-a9d2a41a815e&title=21st+Century+Magnesium+250+mg+110+Tablets&store=supermart&storeName=Supermart
```

## UK — 33 merchants

### Amazon UK `(amazon-uk)`  · relay=Y

**Product**: Flowflex Home Test Kit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3Dtest+deals%26prds%3Dcatalogid%3A3852150584790925334%2Cproductid%3A1417162661592542166%2CheadlineOfferDocid%3A15105362813138630894%2CimageDocid%3A13337506048911077074%2Crds%3APC_8739924291510651159%7CPROD_PC_8739924291510651159%2Cgpcid%3A8739924291510651159%2Cmid%3A576462901686749128%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=5fa203ca-298d-444e-9d93-34e04c9ed065&title=Flowflex+Home+Test+Kit&store=amazon-uk&storeName=Amazon+UK
```

### Amazon.co.uk - Amazon.co.uk-Seller `(amazon-co-uk-amazon-co-uk-seller)`  · relay=Y

**Product**: Sanyun SW208 3"" Active Bluetooth 5.0 Bookshelf Speakers – 60W Carbon Fiber

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A12805887935918700233%2Cproductid%3A11200971975317047917%2CheadlineOfferDocid%3A18102495032046890079%2CimageDocid%3A2612233695145643805%2Crds%3APC_5020542598850316437%7CPROD_PC_5020542598850316437%2Cgpcid%3A5020542598850316437%2Cmid%3A576462807868728240%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=9b5b0980-03c8-460c-9951-ae25bc1d94b9&title=Sanyun+SW208+3%22%22+Active+Bluetooth+5.0+Bookshelf+Speakers+%E2%80%93+60W+Carbon+Fiber&store=amazon-co-uk-amazon-co-uk-seller&storeName=Amazon.co.uk+-+Amazon.co.uk-Seller
```

### AO.com `(ao)`  · relay=Y

**Product**: Anker Soundcore Select 3 Portable Bluetooth Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A17280035893295534179%2Cproductid%3A6625100047047612516%2CheadlineOfferDocid%3A11779427557298221481%2CimageDocid%3A2991817545534205478%2Crds%3APC_3814509753713739125%7CPROD_PC_3814509753713739125%2Cgpcid%3A3814509753713739125%2Cmid%3A576462518797403149%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=b295dfa2-3ee9-482d-a77d-069a815cb044&title=Anker+Soundcore+Select+3+Portable+Bluetooth+Speaker&store=ao&storeName=AO.com
```

### Argos `(argos)`  · relay=Y

**Product**: Opti Magnetic Rowing Machine

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A15566233792986447714%2CheadlineOfferDocid%3A15566233792986447714%2CimageDocid%3A15442703560985455718%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=694c60bc-167a-4ff2-9adb-79294b34e865&title=Opti+Magnetic+Rowing+Machine&store=argos&storeName=Argos
```

### ASOS `(asos)`  · relay=N

**Product**: Miss Selfridge Petite spun halter maxi dress in polka dot

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.asos.com%2Fmiss-selfridge-petite%2Fmiss-selfridge-petite-spun-halter-maxi-dress-in-polka-dot%2Fprd%2F210037692%23colourWayId-210037698&id=14972aef-1278-454e-96d6-673d315d6ba2&title=Miss+Selfridge+Petite+spun+halter+maxi+dress+in+polka+dot&store=asos&storeName=ASOS
```

### B&Q `(b-q)`  · relay=Y

**Product**: Karcher K5 Classic Car & Home Corded Pressure Washer 19507050

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DB%26Q+Karcher+pressure+washer+deals%26prds%3Dcatalogid%3A17606664165251552410%2Cproductid%3A2641449112713034223%2CheadlineOfferDocid%3A1395167328211437927%2CimageDocid%3A13910229702484134204%2Crds%3APC_1726134269933170904%7CPROD_PC_1726134269933170904%2Cgpcid%3A1726134269933170904%2Cmid%3A576462550045774411%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=12505317-2af6-45d8-8ef5-be2e28ff383f&title=Karcher+K5+Classic+Car+%26+Home+Corded+Pressure+Washer+19507050&store=b-q&storeName=B%26Q
```

### Boots.com `(boots)`  · relay=Y

**Product**: Hello Sunday The Everyday Essentials Bestsellers Kit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A50895103782305355%2Cproductid%3A18154131074837278722%2CheadlineOfferDocid%3A16687813996647937145%2CimageDocid%3A2892339385164593872%2Crds%3APC_10232482995929808490%7CPROD_PC_10232482995929808490%2Cgpcid%3A10232482995929808490%2Cmid%3A576462857768320201%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=5c12e6a1-cd28-4e17-9b4d-c0460883cb93&title=Hello+Sunday+The+Everyday+Essentials+Bestsellers+Kit&store=boots&storeName=Boots.com
```

### Boozt.de `(boozt-de)`  · relay=Y

**Product**: Tommy Hilfiger Dw0dw20672 Jacket Women's

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A16068175976935517875%2CheadlineOfferDocid%3A10332837835476364869%2CimageDocid%3A2699454442545855879%2Crds%3APC_5034496371126227465%7CPROD_PC_5034496371126227465%2Cgpcid%3A5034496371126227465%2Cmid%3A576462813218507875%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=07cab23d-f400-4b53-8a4b-3492e322ed5f&title=Tommy+Hilfiger+Dw0dw20672+Jacket+Women%27s&store=boozt-de&storeName=Boozt.de
```

### Currys `(currys)`  · relay=Y

**Product**: JBL Live 770NC Wireless Over-Ear Headphones

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A2271093625528638548%2Cproductid%3A15907745402539930803%2CheadlineOfferDocid%3A11105913217137589482%2CimageDocid%3A12072921309506332144%2Crds%3APC_11490779504163228269%7CPROD_PC_11490779504163228269%2Cgpcid%3A11490779504163228269%2Cmid%3A576462808134737875%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=ef501579-aaed-4a75-9e35-fd3c7a75f723&title=JBL+Live+770NC+Wireless+Over-Ear+Headphones&store=currys&storeName=Currys
```

### Currys Business `(currys-business)`  · relay=Y

**Product**: ASUS ExpertCenter V400 23.8" All-in-One PC - Intel Core i5, 512 GB SSD, White

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A2028249556440794316%2Cproductid%3A12928615673219717051%2CheadlineOfferDocid%3A9227552626406908762%2CimageDocid%3A7405930904143991855%2Crds%3APC_7207778534755226572%7CPROD_PC_7207778534755226572%2Cgpcid%3A7207778534755226572%2Cmid%3A576462881231560361%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=477c9d39-ff05-481c-b6df-f6d74aeaafdc&title=ASUS+ExpertCenter+V400+23.8%22+All-in-One+PC+-+Intel+Core+i5%2C+512+GB+SSD%2C+White&store=currys-business&storeName=Currys+Business
```

### Debenhams `(debenhams)`  · relay=Y

**Product**: Oasis Women's Trapeze Boho Maxi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A16406564329490783224%2Cproductid%3A11385053948751832384%2CheadlineOfferDocid%3A4859294000736776832%2CimageDocid%3A1865596545862572139%2Cgpcid%3A6576913168087594241%2Cmid%3A576462878913279026%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=1905db4a-b85d-4f77-9f41-1472308528a7&title=Oasis+Women%27s+Trapeze+Boho+Maxi+Dress&store=debenhams&storeName=Debenhams
```

### Dunelm `(dunelm)`  · relay=Y

**Product**: Dunelm Rolled Memory Foam Open Coil Mattress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDunelm+memory+foam+mattress+deals%26prds%3Dcatalogid%3A17401655066492608706%2Cproductid%3A16683670882722747342%2CheadlineOfferDocid%3A3245035502063050770%2CimageDocid%3A6203372152964298515%2Crds%3APC_15017739294825248218%7CPROD_PC_15017739294825248218%2Cgpcid%3A15017739294825248218%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=f58e9523-cf9d-40b2-a132-860a84ddb9fc&title=Dunelm+Rolled+Memory+Foam+Open+Coil+Mattress&store=dunelm&storeName=Dunelm
```

### EveryMonday `(everymonday)`  · relay=Y

**Product**: ASUS ROG Zephyrus G16 16" Gaming Laptop Ultra 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A15365091365814507318%2Cproductid%3A2241334823865431122%2CheadlineOfferDocid%3A13381884616552884290%2CimageDocid%3A10144874492812070001%2Crds%3APC_8549831652340324929%7CPROD_PC_8549831652340324929%2Cgpcid%3A8549831652340324929%2Cmid%3A576462842495787429%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=46c27c69-3447-42af-9395-3998b41ae92e&title=ASUS+ROG+Zephyrus+G16+16%22+Gaming+Laptop+Ultra+9&store=everymonday&storeName=EveryMonday
```

### Halfords `(halfords)`  · relay=Y

**Product**: Halfords 420L Roof Box

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHalfords+roof+box+deals%26prds%3Dcatalogid%3A4670615970584742656%2Cproductid%3A10697104363837381225%2CheadlineOfferDocid%3A13386519356969673159%2CimageDocid%3A1829933269304376101%2Crds%3APC_5475533996525945195%7CPROD_PC_5475533996525945195%2Cgpcid%3A5475533996525945195%2Cmid%3A576462893170755571%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=c72aad2b-b004-4836-93a7-64a378a04345&title=Halfords+420L+Roof+Box&store=halfords&storeName=Halfords
```

### Iceland `(iceland)`  · relay=Y

**Product**: Lucozade Sport Drink Orange

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A13651501334509489530%2Cproductid%3A12176253177809784329%2CheadlineOfferDocid%3A15365083252639417139%2CimageDocid%3A15550759571236819048%2Crds%3APC_8523719583624695255%7CPROD_PC_8523719583624695255%2Cgpcid%3A8523719583624695255%2Cmid%3A576462629362276720%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=7355c53e-e672-44f4-8513-3992ed7b2d42&title=Lucozade+Sport+Drink+Orange&store=iceland&storeName=Iceland
```

### JD Sports `(jd-sports)`  · relay=Y

**Product**: New Balance Men's 740 Trainers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DJD+Sports+running+shoes+mens+deals%26prds%3Dcatalogid%3A16864705630294894436%2Cproductid%3A16139265600348267424%2CheadlineOfferDocid%3A15391137469989399562%2CimageDocid%3A4445261888925586543%2Cgpcid%3A8286231232182139119%2Cmid%3A576462873783264670%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=55e8400b-ee8f-424c-9672-84764513dc02&title=New+Balance+Men%27s+740+Trainers&store=jd-sports&storeName=JD+Sports
```

### JD Sports - Global `(jd-sports-global)`  · relay=Y

**Product**: Nike Tech Fleece Full Zip Hoodie - blue

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DJD+Sports+Nike+Tech+Fleece+deals%26prds%3Dproductid%3A1495029842854627519%2CheadlineOfferDocid%3A1495029842854627519%2CimageDocid%3A10531237057860082726%2Crds%3APC_14953714494085046784%7CPROD_PC_14953714494085046784%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=b6d60bf6-4e63-4aca-b8e4-94d6309ec566&title=Nike+Tech+Fleece+Full+Zip+Hoodie+-+blue&store=jd-sports-global&storeName=JD+Sports+-+Global
```

### John Lewis & Partners `(john-lewis-partners)`  · relay=Y

**Product**: Marshall Heston 60 Soundbar

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A823574836087488602%2Cproductid%3A17567145301646137716%2CheadlineOfferDocid%3A2233187338342107475%2CimageDocid%3A6674737543084326468%2Crds%3APC_4757172040779590691%7CPROD_PC_4757172040779590691%2Cgpcid%3A4757172040779590691%2Cmid%3A576462842986416294%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=35d7937e-f8e6-4fa0-a9fb-137fa01fdcb5&title=Marshall+Heston+60+Soundbar&store=john-lewis-partners&storeName=John+Lewis+%26+Partners
```

### Marks Electrical `(marks-electrical)`  · relay=Y

**Product**: Ninja 6-in-1 Dual Zone dz300uk Air Fryer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMarks+%26+Spencer+Ninja+Air+Fryer+deals%26prds%3Dcatalogid%3A1726382325711360942%2Cproductid%3A16257521266672060551%2CheadlineOfferDocid%3A15940877532281193437%2CimageDocid%3A2037756727317278314%2Crds%3APC_17184278498191419800%7CPROD_PC_17184278498191419800%2Cgpcid%3A17184278498191419800%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=634d9412-7057-47fb-8030-78df5d0149f5&title=Ninja+6-in-1+Dual+Zone+dz300uk+Air+Fryer&store=marks-electrical&storeName=Marks+Electrical
```

### Matalan `(matalan)`  · relay=Y

**Product**: Jersey Tie Midi Dress - Grey - Papaya

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A15177895374590323293%2CheadlineOfferDocid%3A15177895374590323293%2CimageDocid%3A6014796749966277350%2Crds%3ALO_15177895374590323293%7CPROD_LO_15177895374590323293%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=6ce38fba-49eb-41e1-99d0-9df86ea7a9b7&title=Jersey+Tie+Midi+Dress+-+Grey+-+Papaya&store=matalan&storeName=Matalan
```

### Michael Kors - UK `(michael-kors-uk)`  · relay=Y

**Product**: Michael Kors Heather Large Leather Shoulder Bag

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A13972173288629772142%2CheadlineOfferDocid%3A8325637672083687771%2CimageDocid%3A16214682733404081746%2Crds%3APC_8126233348149417716%7CPROD_PC_8126233348149417716%2Cgpcid%3A8126233348149417716%2Cmid%3A576462849160639407%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=90584fe1-d836-4630-a240-b3f324537953&title=Michael+Kors+Heather+Large+Leather+Shoulder+Bag&store=michael-kors-uk&storeName=Michael+Kors+-+UK
```

### Next `(next)`  · relay=Y

**Product**: Jolie Moi Women's Puff Long Sleeve Jersey Maxi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A17163548407375289025%2Cproductid%3A15449900688744163284%2CheadlineOfferDocid%3A16164150805605735700%2CimageDocid%3A850527050115492511%2Crds%3APC_14627890296342697632%7CPROD_PC_14627890296342697632%2Cgpcid%3A14627890296342697632%2Cmid%3A576462549082934944%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=3feeca29-b52f-485a-81e6-f62ba8f027a4&title=Jolie+Moi+Women%27s+Puff+Long+Sleeve+Jersey+Maxi+Dress&store=next&storeName=Next
```

### Ocado `(ocado)`  · relay=Y

**Product**: Together Health Mushroom 5 Organic 60 Capsules

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A15500711498194263966%2Cproductid%3A10023497694503809698%2CheadlineOfferDocid%3A16503677047727598066%2CimageDocid%3A15082237257426898550%2Crds%3APC_15851987338653871987%7CPROD_PC_15851987338653871987%2Cgpcid%3A15851987338653871987%2Cmid%3A576462758448527176%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=ce026de8-2365-4f42-bf6e-8cf5d0941e13&title=Together+Health+Mushroom+5+Organic+60+Capsules&store=ocado&storeName=Ocado
```

### QVC UK `(qvc-uk)`  · relay=Y

**Product**: Elemis Superfood Facial Oil Duo 15ml

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A12125989650929392760%2CheadlineOfferDocid%3A12125989650929392760%2CimageDocid%3A11433982795794941918%2Crds%3APC_4067412313398996018%7CPROD_PC_4067412313398996018%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=fae59357-77c2-4673-b34e-aaa2c4ce3cd9&title=Elemis+Superfood+Facial+Oil+Duo+15ml&store=qvc-uk&storeName=QVC+UK
```

### Screwfix.com `(screwfix)`  · relay=Y

**Product**: Karcher SC 2 EasyFix Steam Cleaner

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A10285217827259442482%2Cproductid%3A2708534092683137310%2CheadlineOfferDocid%3A6396737931361199771%2CimageDocid%3A439840005388162006%2Crds%3APC_9318520637298760498%7CPROD_PC_9318520637298760498%2Cgpcid%3A9318520637298760498%2Cmid%3A576462543504258956%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=1ff32742-f213-48a4-8895-e11ffa1d8c2b&title=Karcher+SC+2+EasyFix+Steam+Cleaner&store=screwfix&storeName=Screwfix.com
```

### Selfridges `(selfridges)`  · relay=Y

**Product**: Adidas Women's Samba OG Low-Top Trainers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSelfridges+Adidas+Samba%26prds%3Dcatalogid%3A3033552466281508178%2Cproductid%3A13966065220948152817%2CheadlineOfferDocid%3A9589008242975920141%2CimageDocid%3A1420210681110103374%2Crds%3APC_12502346331856798059%7CPROD_PC_12502346331856798059%2Cgpcid%3A12502346331856798059%2Cmid%3A576462870147397282%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=de94dab4-8774-4d81-b27f-94a954563c58&title=Adidas+Women%27s+Samba+OG+Low-Top+Trainers&store=selfridges&storeName=Selfridges
```

### smol `(smol)`  · relay=Y

**Product**: smol Essentials Bundle Eco-Friendly Household Cleaning Kit with Laundry Capsules, Dishwasher Tablets, Multi-Purpose Spray, and Foaming Handwash

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A5483821932226408885%2CheadlineOfferDocid%3A5483821932226408885%2CimageDocid%3A6962716957288544170%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=6b5438f5-2cfe-4034-80ff-d813234f6f0e&title=smol+Essentials+Bundle+Eco-Friendly+Household+Cleaning+Kit+with+Laundry+Capsules%2C+Dishwasher+Tablets%2C+Multi-Purpose+Spra&store=smol&storeName=smol
```

### Smyths Toys `(smyths-toys)`  · relay=Y

**Product**: Adjustable Inline Skates

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A2886298444151140337%2Cproductid%3A15139664616475635774%2CheadlineOfferDocid%3A18111602679592096941%2CimageDocid%3A17627042028808808348%2Crds%3APC_9577112815486760413%7CPROD_PC_9577112815486760413%2Cgpcid%3A9577112815486760413%2Cmid%3A576462877184676688%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=823bcbe2-f6df-4fda-8ac2-a54f51f2674d&title=Adjustable+Inline+Skates&store=smyths-toys&storeName=Smyths+Toys
```

### Sports Direct UK `(sports-direct-uk)`  · relay=Y

**Product**: Edifier M1360 2.1 Speaker System

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A1910160910834115142%2Cproductid%3A13255556568380563093%2CheadlineOfferDocid%3A7547512302947448487%2CimageDocid%3A14136054155647897483%2Crds%3APC_10534045688636456581%7CPROD_PC_10534045688636456581%2Cgpcid%3A10534045688636456581%2Cmid%3A576462633234259392%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=3c477e5f-c1ca-4c60-9e5c-56ed4e147daf&title=Edifier+M1360+2.1+Speaker+System&store=sports-direct-uk&storeName=Sports+Direct+UK
```

### The Range `(the-range)`  · relay=Y

**Product**: Kenwood KMix Stand Mixer 5L

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A15748687734194801054%2Cproductid%3A2523631754133558719%2CheadlineOfferDocid%3A14394114947238018706%2CimageDocid%3A14388906993717877275%2Crds%3APC_3517476263253613064%7CPROD_PC_3517476263253613064%2Cgpcid%3A17812203734773161560%2Cmid%3A576462408267199296%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=88b57e9e-4f27-45ef-a389-86647443ddda&title=Kenwood+KMix+Stand+Mixer+5L&store=the-range&storeName=The+Range
```

### Very `(very)`  · relay=Y

**Product**: CyberPowerPC Cyberpower Pc Gaming Desktop Bundle AMD Ryzen 5 7500F Geforce Rtx 5060 vv2441

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A17212618646485447462%2Cproductid%3A4825479402090317260%2CheadlineOfferDocid%3A355928377883929728%2CimageDocid%3A16835854759195045218%2Crds%3APC_13583317946671150337%7CPROD_PC_13583317946671150337%2Cgpcid%3A13583317946671150337%2Cmid%3A576462884563320391%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=7b5a11e8-8753-4358-851a-ef73704c6dbf&title=CyberPowerPC+Cyberpower+Pc+Gaming+Desktop+Bundle+AMD+Ryzen+5+7500F+Geforce+Rtx+5060+vv2441&store=very&storeName=Very
```

### Waitrose & Partners `(waitrose-partners)`  · relay=Y

**Product**: Plenty Kitchen Roll

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A9859182406639845503%2Cproductid%3A13741043232334239012%2CheadlineOfferDocid%3A8160360346595784626%2CimageDocid%3A11410828622848193005%2Crds%3APC_412113639597533454%7CPROD_PC_412113639597533454%2Cgpcid%3A412113639597533454%2Cmid%3A576462549878602638%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=bbe6e2d2-56f0-47f5-862a-da1599715811&title=Plenty+Kitchen+Roll&store=waitrose-partners&storeName=Waitrose+%26+Partners
```

### Wilko `(wilko)`  · relay=Y

**Product**: Vileda 2 in 1 Dustpan and Brush Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A11644611165950298218%2Cproductid%3A16684402178619249628%2CheadlineOfferDocid%3A2639935369884709528%2CimageDocid%3A15258001894075889623%2Crds%3APC_1675862641839498677%7CPROD_PC_1675862641839498677%2Cgpcid%3A1675862641839498677%2Cmid%3A576462717927418413%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=3830eda5-39b9-4292-8675-3932535f5f5b&title=Vileda+2+in+1+Dustpan+and+Brush+Set&store=wilko&storeName=Wilko
```

## US — 95 merchants

### adidas.co.in `(adidas)`  · relay=Y

**Product**: adidas Women's Galaxy 7 Running Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A17999013145333502457%2Cproductid%3A479695885230014993%2CheadlineOfferDocid%3A17166138396634005900%2CimageDocid%3A1978222918030422759%2Crds%3APC_16482313695981031853%7CPROD_PC_16482313695981031853%2Cgpcid%3A16482313695981031853%2Cmid%3A576462518306690790%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=a06e5528-dbb1-4bb3-89d4-14d815b56f81&title=adidas+Women%27s+Galaxy+7+Running+Shoes&store=adidas&storeName=adidas.co.in
```

### Best Buy `(best-buy)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoogle+Pixel+9+deals%26prds%3Dcatalogid%3A625513772960203147%2Cproductid%3A15373862464162455148%2CheadlineOfferDocid%3A4864733893873904692%2CimageDocid%3A1458535541928447144%2Crds%3APC_7289913198085316365%7CPROD_PC_7289913198085316365%2Cgpcid%3A7289913198085316365%2Cmid%3A576462491484046598%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=35a0d834-ea98-4bd0-9729-e3e121a35deb&title=Google+Pixel+9&store=best-buy&storeName=Best+Buy
```

### Dermstore.com `(dermstore)`  · relay=Y

**Product**: RMS Beauty SuperNatural Radiance Serum Broad Spectrum SPF 30 Sunscreen Duo - Rich Aura | Dermstore

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A13923827137575468664%2CheadlineOfferDocid%3A13923827137575468664%2CimageDocid%3A7782807057021417943%2Crds%3APC_16390715002454302984%7CPROD_PC_16390715002454302984%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7053e4bb-3311-4194-88bc-655e8ffedc66&title=RMS+Beauty+SuperNatural+Radiance+Serum+Broad+Spectrum+SPF+30+Sunscreen+Duo+-+Rich+Aura+%7C+Dermstore&store=dermstore&storeName=Dermstore.com
```

### DICK'S Sporting Goods `(dick-s-sporting-goods)`  · relay=Y

**Product**: CALIA Women's Inspire High Rise 7/8 Leggings

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A18216525042895023719%2Cproductid%3A14764142868486872580%2CheadlineOfferDocid%3A17382670390914476712%2CimageDocid%3A10321097556987328069%2Crds%3APC_2751083246222114273%7CPROD_PC_2751083246222114273%2Cgpcid%3A2751083246222114273%2Cmid%3A576462829858514908%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=f0757150-c043-46ad-885a-435d57645776&title=CALIA+Women%27s+Inspire+High+Rise+7%2F8+Leggings&store=dick-s-sporting-goods&storeName=DICK%27S+Sporting+Goods
```

### eBay `(ebay)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoogle+Pixel+9+deals%26prds%3Dproductid%3A15789709229400696495%2CheadlineOfferDocid%3A15789709229400696495%2CimageDocid%3A3900037481117021831%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=35ad846d-b1d5-4e40-883f-60bef3bc2789&title=Google+Pixel+9&store=ebay&storeName=eBay
```

### eBay - alice_smart_de `(ebay-alice-smart-de)`  · relay=Y

**Product**: SONY RX100 V + 64GB SD Card + Camera Bag

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A15188536916581473188%2Cproductid%3A14516359486714091050%2CheadlineOfferDocid%3A7111728463324787182%2CimageDocid%3A5865734202574927668%2Crds%3APC_9227089299472762073%7CPROD_PC_9227089299472762073%2Cgpcid%3A9227089299472762073%2Cmid%3A576462888080645987%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=4dd6fa3c-2705-493a-a420-a6646659370a&title=SONY+RX100+V+%2B+64GB+SD+Card+%2B+Camera+Bag&store=ebay-alice-smart-de&storeName=eBay+-+alice_smart_de
```

### eBay - breedproducts `(ebay-breedproducts)`  · relay=Y

**Product**: Apple iPhone 14

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A12298693760111617111%2Cproductid%3A1524271839318766912%2CheadlineOfferDocid%3A8590354871600619171%2CimageDocid%3A2036688852292677106%2Crds%3APC_8053804293482199477%7CPROD_PC_8053804293482199477%2Cgpcid%3A8053804293482199477%2Cmid%3A576462684717173784%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=279cc33f-ca86-434f-8a1e-46baa00ebc62&title=Apple+iPhone+14&store=ebay-breedproducts&storeName=eBay+-+breedproducts
```

### eBay - carousel-store `(ebay-carousel-store)`  · relay=Y

**Product**: Xiaomi Redmi Note 14 Pro, 12gb+256gb, 6.67 Inch Xiaomi Hyperos

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRedmi+Note+14+deals%26prds%3Dproductid%3A16955040871577431201%2CheadlineOfferDocid%3A16955040871577431201%2CimageDocid%3A13230981965415444331%2Crds%3APC_5306157049753495095%7CPROD_PC_5306157049753495095%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=82002dd1-33f4-4dbb-8968-e2489e6895ee&title=Xiaomi+Redmi+Note+14+Pro%2C+12gb%2B256gb%2C+6.67+Inch+Xiaomi+Hyperos&store=ebay-carousel-store&storeName=eBay+-+carousel-store
```

### eBay - clstj-0 `(ebay-clstj-0)`  · relay=Y

**Product**: Caring Mill by Aura Bask Infrared Full Body Heat Wrap

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A16069844521441526438%2Cproductid%3A6071078163206743754%2CheadlineOfferDocid%3A15878517673667622937%2CimageDocid%3A11714293081732689731%2Crds%3APC_18310740842383718309%7CPROD_PC_18310740842383718309%2Cgpcid%3A18310740842383718309%2Cmid%3A576462816063782176%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=f00a0a37-5207-45ac-8ba0-c8d5968eb4e8&title=Caring+Mill+by+Aura+Bask+Infrared+Full+Body+Heat+Wrap&store=ebay-clstj-0&storeName=eBay+-+clstj-0
```

### eBay - cm602_az `(ebay-cm602-az)`  · relay=Y

**Product**: Screen Protector Film For Apple Watch Series 10 46mm 42mm Soft TPU Hydrogel HD Clear Film for iWatch 10 42MM 46MM Accessories

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DApple+Watch+Series+10+deals%26prds%3Dproductid%3A477230685518601242%2CheadlineOfferDocid%3A477230685518601242%2CimageDocid%3A8335436688088423947%2Crds%3APC_11862135040694524091%7CPROD_PC_11862135040694524091%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=82736064-f123-4a46-9985-1d5db2fa487e&title=Screen+Protector+Film+For+Apple+Watch+Series+10+46mm+42mm+Soft+TPU+Hydrogel+HD+Clear+Film+for+iWatch+10+42MM+46MM+Access&store=ebay-cm602-az&storeName=eBay+-+cm602_az
```

### eBay - crazydeals93 `(ebay-crazydeals93)`  · relay=Y

**Product**: Tecno Spark 30c Blue (8gb+128gb) 48mp-global Version-no Usa Tariffs

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DTecno+Camon+30+deals%26prds%3Dproductid%3A10429254282179343016%2CheadlineOfferDocid%3A10429254282179343016%2CimageDocid%3A5464659520674357665%2Crds%3APC_9028951765858735451%7CPROD_PC_9028951765858735451%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1705f799-28d4-4e19-b7f3-c7786a79bbeb&title=Tecno+Spark+30c+Blue+%288gb%2B128gb%29+48mp-global+Version-no+Usa+Tariffs&store=ebay-crazydeals93&storeName=eBay+-+crazydeals93
```

### eBay - creo_cellular `(ebay-creo-cellular)`  · relay=Y

**Product**: Samsung Galaxy S22/S22+/S22 Ultra Unlocked Android Smartphone | 6.6 in | 20.0 MP or More | 5G | Purple | 128 GB | Samsung Galaxy S22 Ultra

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dproductid%3A7601343387924744861%2CheadlineOfferDocid%3A7601343387924744861%2CimageDocid%3A12565452691383882929%2Crds%3APC_7447541128572486649%7CPROD_PC_7447541128572486649%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7b2fe9df-729a-406d-b9dd-2df43052a7f1&title=Samsung+Galaxy+S22%2FS22%2B%2FS22+Ultra+Unlocked+Android+Smartphone+%7C+6.6+in+%7C+20.0+MP+or+More+%7C+5G+%7C+Purple+%7C+128+GB+%7C+Samsun&store=ebay-creo-cellular&storeName=eBay+-+creo_cellular
```

### eBay - designerconnection2012 `(ebay-designerconnection2012)`  · relay=Y

**Product**: Tarte Babassu Foundcealer Skincare Foundation

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A17722323302098892122%2Cproductid%3A1351316784052534358%2CheadlineOfferDocid%3A9084916609718605060%2CimageDocid%3A8311173681853258962%2Crds%3APC_7729733698727628268%7CPROD_PC_7729733698727628268%2Cgpcid%3A7729733698727628268%2Cmid%3A576462845903783665%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=2292a3f1-3bb4-4bec-862e-7e64d3691737&title=Tarte+Babassu+Foundcealer+Skincare+Foundation&store=ebay-designerconnection2012&storeName=eBay+-+designerconnection2012
```

### eBay - e-commercebusinessllc `(ebay-e-commercebusinessllc)`  · relay=Y

**Product**: Nokia C100 32gb

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A17598548404954024735%2Cproductid%3A890040852763053277%2CheadlineOfferDocid%3A14234413820044027573%2CimageDocid%3A15542818575473531319%2Crds%3APC_16181279974686442033%7CPROD_PC_16181279974686442033%2Cgpcid%3A16181279974686442033%2Cmid%3A576462499559725158%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c732678b-44d2-4054-89d6-c2a9f31fff59&title=Nokia+C100+32gb&store=ebay-e-commercebusinessllc&storeName=eBay+-+e-commercebusinessllc
```

### eBay - focuscamera `(ebay-focuscamera)`  · relay=Y

**Product**: JBL Charge 5 Portable Bluetooth Speaker Waterproof

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DJBL+Charge+5+deals%26prds%3Dproductid%3A12110656702319492083%2CheadlineOfferDocid%3A12110656702319492083%2CimageDocid%3A16313223020508392025%2Crds%3APC_11537432482986069177%7CPROD_PC_11537432482986069177%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=bbcd3689-3e6f-4be1-aa74-b2dd35c2dbc7&title=JBL+Charge+5+Portable+Bluetooth+Speaker+Waterproof&store=ebay-focuscamera&storeName=eBay+-+focuscamera
```

### eBay - her.current.obsessions `(ebay-her-current-obsessions)`  · relay=Y

**Product**: The Ordinary Niacinamide 5% Face and Body Emulsion

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DThe+Ordinary+Niacinamide+deals%26prds%3Dcatalogid%3A4581150765799580319%2Cproductid%3A2526886646868535599%2CheadlineOfferDocid%3A13651200074665646032%2CimageDocid%3A16893347892044170215%2Crds%3APC_4613236701650526898%7CPROD_PC_4613236701650526898%2Cgpcid%3A4613236701650526898%2Cmid%3A576462491360766773%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=0a5b40de-fb00-40e6-8142-73f8c2b048f6&title=The+Ordinary+Niacinamide+5%25+Face+and+Body+Emulsion&store=ebay-her-current-obsessions&storeName=eBay+-+her.current.obsessions
```

### eBay - holman-directshoeoutlet `(ebay-holman-directshoeoutlet)`  · relay=Y

**Product**: Adidas Women's X_PLRPATH Sportswear Shoes Variety

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A8515899162691251501%2CheadlineOfferDocid%3A8515899162691251501%2CimageDocid%3A13193400439338730075%2Crds%3APC_1431016653776246721%7CPROD_PC_1431016653776246721%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=3c0eec2a-0970-4cef-8fec-f118d39ffc79&title=Adidas+Women%27s+X_PLRPATH+Sportswear+Shoes+Variety&store=ebay-holman-directshoeoutlet&storeName=eBay+-+holman-directshoeoutlet
```

### eBay - jodiealison `(ebay-jodiealison)`  · relay=Y

**Product**: Maybelline Lash Sensational Luscious Waterproof Mascara

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMaybelline+Lash+Sensational+deals%26prds%3Dcatalogid%3A200467793290981211%2Cproductid%3A18146512783225272724%2CheadlineOfferDocid%3A1639755171020306525%2CimageDocid%3A2008823091140008004%2Crds%3APC_6552654637209147235%7CPROD_PC_6552654637209147235%2Cgpcid%3A6552654637209147235%2Cmid%3A576462872087578084%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=02d036ac-fa3b-486f-b03b-d635bd135d6d&title=Maybelline+Lash+Sensational+Luscious+Waterproof+Mascara&store=ebay-jodiealison&storeName=eBay+-+jodiealison
```

### eBay - keech-hospice-care `(ebay-keech-hospice-care)`  · relay=Y

**Product**: Stanley Quencher H2.0 Flowstate Tumbler 0.88l

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStanley+Quencher+40oz+deals%26prds%3Dproductid%3A12616050291066915103%2CheadlineOfferDocid%3A12616050291066915103%2CimageDocid%3A13167700034854606785%2Crds%3APC_11578049002999288913%7CPROD_PC_11578049002999288913%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=90081ace-8555-4c1e-9d95-a51ea2a3cd2c&title=Stanley+Quencher+H2.0+Flowstate+Tumbler+0.88l&store=ebay-keech-hospice-care&storeName=eBay+-+keech-hospice-care
```

### eBay - kg_kart `(ebay-kg-kart)`  · relay=Y

**Product**: Daily Greens

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A12070252020353110078%2Cproductid%3A1113690413373941695%2CheadlineOfferDocid%3A2246621224684490167%2CimageDocid%3A11025851958291511141%2Crds%3APC_301077408142014751%7CPROD_PC_301077408142014751%2Cgpcid%3A301077408142014751%2Cmid%3A576462770873767749%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1274eaef-6139-402e-a597-cbb2fbee3abe&title=Daily+Greens&store=ebay-kg-kart&storeName=eBay+-+kg_kart
```

### eBay - mera-dealz `(ebay-mera-dealz)`  · relay=Y

**Product**: Universal Headphone Headband Head beam Silicone Cover for Sony WH-1000XM5 Headset Headband Protectors with Zipper Cover

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSony+WH-1000XM5+deals%26prds%3Dproductid%3A13094997711817291966%2CheadlineOfferDocid%3A13094997711817291966%2CimageDocid%3A265567364706282673%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=3950e3de-3121-478b-b2e8-8285a18d27a6&title=Universal+Headphone+Headband+Head+beam+Silicone+Cover+for+Sony+WH-1000XM5+Headset+Headband+Protectors+with+Zipper+Cover&store=ebay-mera-dealz&storeName=eBay+-+mera-dealz
```

### eBay - mich_592413 `(ebay-mich-592413)`  · relay=Y

**Product**: HumanN SuperBeets Heart Chews

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A14513463759199691188%2Cproductid%3A14041830916092596851%2CheadlineOfferDocid%3A4638745653729793616%2CimageDocid%3A8495376357796246328%2Crds%3APC_1874296498300930611%7CPROD_PC_1874296498300930611%2Cgpcid%3A1874296498300930611%2Cmid%3A576462740738891905%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=2b26b610-255f-4b85-bfac-8295644e4eea&title=HumanN+SuperBeets+Heart+Chews&store=ebay-mich-592413&storeName=eBay+-+mich_592413
```

### eBay - missouri-liquidation `(ebay-missouri-liquidation)`  · relay=Y

**Product**: Beats Pill Portable Bluetooth Wireless Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A4459809154102837755%2Cproductid%3A5729150115798668506%2CheadlineOfferDocid%3A8501880125318351217%2CimageDocid%3A15905846994395570966%2Crds%3APC_1607575984603008886%7CPROD_PC_1607575984603008886%2Cgpcid%3A1607575984603008886%2Cmid%3A576462854772640833%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=bf2d98f0-44ca-4b69-af21-f3a9bea12a19&title=Beats+Pill+Portable+Bluetooth+Wireless+Speaker&store=ebay-missouri-liquidation&storeName=eBay+-+missouri-liquidation
```

### eBay - mobile-phone-king `(ebay-mobile-phone-king)`  · relay=Y

**Product**: Restored Apple iPhone 13 Mini

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A9605877161972811703%2Cproductid%3A17062421298967806788%2CheadlineOfferDocid%3A15225551321915349846%2CimageDocid%3A804178271233480097%2Crds%3APC_7247330322390165966%7CPROD_PC_7247330322390165966%2Cgpcid%3A7247330322390165966%2Cmid%3A576462836122922296%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c3892ec9-c1f4-4a77-abf0-19ecda7952a0&title=Restored+Apple+iPhone+13+Mini&store=ebay-mobile-phone-king&storeName=eBay+-+mobile-phone-king
```

### eBay - musiciansfriend `(ebay-musiciansfriend)`  · relay=Y

**Product**: Harbinger Vari V1112 12" Powered Speakers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A9667549220373608148%2CheadlineOfferDocid%3A12154957757144153409%2CimageDocid%3A17490373020670789109%2Crds%3APC_4574094048875631136%7CPROD_PC_4574094048875631136%2Cgpcid%3A4574094048875631136%2Cmid%3A576462828273119317%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b5e5986d-3309-4bd9-b172-93c27d8b221c&title=Harbinger+Vari+V1112+12%22+Powered+Speakers&store=ebay-musiciansfriend&storeName=eBay+-+musiciansfriend
```

### eBay - phone-fancy `(ebay-phone-fancy)`  · relay=Y

**Product**: Restored Samsung Galaxy S23 Ultra 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dproductid%3A1800744236478268743%2CheadlineOfferDocid%3A1800744236478268743%2CimageDocid%3A6799415721885641313%2Crds%3APC_1964985831339837001%7CPROD_PC_1964985831339837001%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c024b794-fa47-4f78-9339-5f6dc27da3a5&title=Restored+Samsung+Galaxy+S23+Ultra+5G&store=ebay-phone-fancy&storeName=eBay+-+phone-fancy
```

### eBay - pnpgames `(ebay-pnpgames)`  · relay=Y

**Product**: Super Mario Galaxy 1 + Super Mario Galaxy 2 (nintendo Switch) Brand

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dproductid%3A9102535575263076081%2CheadlineOfferDocid%3A9102535575263076081%2CimageDocid%3A9704783284925015935%2Crds%3APC_3513332669179498733%7CPROD_PC_3513332669179498733%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=42b6e78c-b2e7-41ec-9627-d31326491e4b&title=Super+Mario+Galaxy+1+%2B+Super+Mario+Galaxy+2+%28nintendo+Switch%29+Brand&store=ebay-pnpgames&storeName=eBay+-+pnpgames
```

### eBay - pro-distributing `(ebay-pro-distributing)`  · relay=Y

**Product**: Beats Studio Pro Noise Cancellation Headphones W/ Mightyskins Code -

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeats+Studio+Pro+deals%26prds%3Dproductid%3A7387106305211565599%2CheadlineOfferDocid%3A7387106305211565599%2CimageDocid%3A8514785057544155225%2Crds%3APC_7828364965549902649%7CPROD_PC_7828364965549902649%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1dc06c26-70cf-4199-9f83-dac819484922&title=Beats+Studio+Pro+Noise+Cancellation+Headphones+W%2F+Mightyskins+Code+-&store=ebay-pro-distributing&storeName=eBay+-+pro-distributing
```

### eBay - ravigu_51 `(ebay-ravigu-51)`  · relay=Y

**Product**: Maybelline York Liquid Foundation, Matte & Poreless, Full Coverage

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A12039655628137097443%2CheadlineOfferDocid%3A12039655628137097443%2CimageDocid%3A16653417113148200075%2Crds%3APC_6870175893233233427%7CPROD_PC_6870175893233233427%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=2991a9b4-a2d7-4533-b597-a64e149925ac&title=Maybelline+York+Liquid+Foundation%2C+Matte+%26+Poreless%2C+Full+Coverage&store=ebay-ravigu-51&storeName=eBay+-+ravigu_51
```

### eBay - sertitanke `(ebay-sertitanke)`  · relay=Y

**Product**: Beats Studio Pro Wireless Bluetooth Over-ear Headphones Sealed

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeats+Studio+Pro+deals%26prds%3Dproductid%3A4052142525609850137%2CheadlineOfferDocid%3A4052142525609850137%2CimageDocid%3A11154756329824097992%2Crds%3APC_7828364965549902649%7CPROD_PC_7828364965549902649%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=2057190f-3dc4-4e7c-a34f-426cfd4b802f&title=Beats+Studio+Pro+Wireless+Bluetooth+Over-ear+Headphones+Sealed&store=ebay-sertitanke&storeName=eBay+-+sertitanke
```

### eBay - sscjd5 `(ebay-sscjd5)`  · relay=Y

**Product**: Clinique Even Better Makeup SPF 15

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A1627256453194685149%2CheadlineOfferDocid%3A10852193061540515158%2CimageDocid%3A68075926074901053%2Crds%3APC_10409066698891336492%7CPROD_PC_10409066698891336492%2Cgpcid%3A10409066698891336492%2Cmid%3A576462224915897772%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=61fffc8a-a85e-415e-9067-034f9bcbd2dc&title=Clinique+Even+Better+Makeup+SPF+15&store=ebay-sscjd5&storeName=eBay+-+sscjd5
```

### eBay - trd_digital `(ebay-trd-digital)`  · relay=Y

**Product**: Apple MacBook Air M4

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A1434325277585982111%2Cproductid%3A4549856551604774223%2CheadlineOfferDocid%3A17962990873809386145%2CimageDocid%3A12040891885774477673%2Crds%3APC_1152338077854414841%7CPROD_PC_1152338077854414841%2Cgpcid%3A1152338077854414841%2Cmid%3A576462533926553188%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c1c627f8-5831-4831-a1b5-4549f68b8d70&title=Apple+MacBook+Air+M4&store=ebay-trd-digital&storeName=eBay+-+trd_digital
```

### Fashion Nova `(fashion-nova)`  · relay=Y

**Product**: Fashion Nova Pleated Short Sleeve Maxi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A18046201984569055782%2Cproductid%3A8537173328750063396%2CheadlineOfferDocid%3A6335080215554048339%2CimageDocid%3A640523802480223290%2Crds%3APC_5022691241007027052%7CPROD_PC_5022691241007027052%2Cgpcid%3A5022691241007027052%2Cmid%3A576462550040213180%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=1dfebbc3-9a71-4897-ab30-1d3602472cfb&title=Fashion+Nova+Pleated+Short+Sleeve+Maxi+Dress&store=fashion-nova&storeName=Fashion+Nova
```

### GameStop `(gamestop)`  · relay=Y

**Product**: Doom Eternal

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12334325570500557876%2Cproductid%3A6966350095559075648%2CheadlineOfferDocid%3A10990557184422477496%2CimageDocid%3A13913505900942807743%2Crds%3APC_16372692007345681725%7CPROD_PC_16372692007345681725%2Cgpcid%3A16372692007345681725%2Cmid%3A576462311165474926%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ffda71dc-edab-4867-88eb-65291c6fad75&title=Doom+Eternal&store=gamestop&storeName=GameStop
```

### Home Depot `(home-depot)`  · relay=Y

**Product**: JBL BAR-500-MK2 Soundbar

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A8458879764457719747%2Cproductid%3A6091213750288410570%2CheadlineOfferDocid%3A12818929279237739464%2CimageDocid%3A5991898643791699727%2Crds%3APC_13451718509195245745%7CPROD_PC_13451718509195245745%2Cgpcid%3A13451718509195245745%2Cmid%3A576462861098096391%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=0b82dadf-dca4-4041-9b9d-80b3c25a7828&title=JBL+BAR-500-MK2+Soundbar&store=home-depot&storeName=Home+Depot
```

### Kohl's `(kohl-s)`  · relay=Y

**Product**: Edifier R2000DB Powered Bluetooth Bookshelf Speakers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A3388307040346979865%2Cproductid%3A629566604904855963%2CheadlineOfferDocid%3A179479589073585906%2CimageDocid%3A1031699403079167925%2Crds%3APC_581656905074843190%7CPROD_PC_581656905074843190%2Cgpcid%3A581656905074843190%2Cmid%3A576462775816677156%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b5f3231a-2e71-4d6d-a441-454bc55738bb&title=Edifier+R2000DB+Powered+Bluetooth+Bookshelf+Speakers&store=kohl-s&storeName=Kohl%27s
```

### Lowe's `(lowe-s)`  · relay=Y

**Product**: Cafe French-Door Refrigerator CGE29DP2TS1

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A4418197401196477201%2Cproductid%3A4987133673055585106%2CheadlineOfferDocid%3A107891835459668482%2Crds%3APC_724204468193952261%7CPROD_PC_724204468193952261%2Cgpcid%3A724204468193952261%2Cmid%3A576462829393932812%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=f6182803-8e93-4965-984e-8ef2d7c48885&title=Cafe+French-Door+Refrigerator+CGE29DP2TS1&store=lowe-s&storeName=Lowe%27s
```

### LowestRate Shopping `(lowestrate-shopping)`  · relay=Y

**Product**: Acer 4 in 1 Wired Gaming Combo

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A18149312443291001590%2Cproductid%3A1320527418492391146%2CheadlineOfferDocid%3A3429214317774993053%2CimageDocid%3A15308648009266870810%2Cgpcid%3A9613528179670539329%2Cmid%3A576462834448394969%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=be7cbb2b-6cfb-4539-b302-94360bf64691&title=Acer+4+in+1+Wired+Gaming+Combo&store=lowestrate-shopping&storeName=LowestRate+Shopping
```

### Macy's `(macy-s)`  · relay=Y

**Product**: Macy's Lunar New Year Skin Care Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A12862855940262601507%2Cproductid%3A3178097094163786952%2CheadlineOfferDocid%3A5353935812110555864%2CimageDocid%3A11646642284372736094%2Cgpcid%3A17501837025200987571%2Cmid%3A576462875146287054%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=0c88a1ec-55ca-4f22-8f59-9f4043409efb&title=Macy%27s+Lunar+New+Year+Skin+Care+Set&store=macy-s&storeName=Macy%27s
```

### Mopani Pharmacy `(mopani-pharmacy)`  · relay=Y

**Product**: Elizabeth Arden Flawless Finish Sponge-On Cream Makeup

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A14793795824175555922%2Cproductid%3A4238691930210656005%2CheadlineOfferDocid%3A14442669563942121074%2CimageDocid%3A14227281097849678362%2Crds%3APC_16510465537345818715%7CPROD_PC_16510465537345818715%2Cgpcid%3A16510465537345818715%2Cmid%3A576462255496326534%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=19e2903a-c65d-4bab-b2bc-b0d1175129de&title=Elizabeth+Arden+Flawless+Finish+Sponge-On+Cream+Makeup&store=mopani-pharmacy&storeName=Mopani+Pharmacy
```

### Newegg.com `(newegg)`  · relay=Y

**Product**: Logitech Speaker System Z623

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A11459651646884740075%2Cproductid%3A3261697758993937602%2CheadlineOfferDocid%3A3521914573622027837%2Crds%3APC_3871828643942284537%7CPROD_PC_3871828643942284537%2Cgpcid%3A3871828643942284537%2Cmid%3A576460815407827060%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=a92ac02d-4fac-41cf-b8e8-31efa4df824d&title=Logitech+Speaker+System+Z623&store=newegg&storeName=Newegg.com
```

### Newegg.com - DemProductSales `(newegg-com-demproductsales)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoogle+Pixel+9+deals%26prds%3Dcatalogid%3A1474843770765318516%2Cproductid%3A13242374439244210006%2CheadlineOfferDocid%3A13115401002527952100%2CimageDocid%3A4731409781515400795%2Crds%3APC_3840436116648441576%7CPROD_PC_3840436116648441576%2Cgpcid%3A3840436116648441576%2Cmid%3A576462787803629646%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=099c6053-f67d-4e65-8d2a-99ae4df9c0c3&title=Google+Pixel+9&store=newegg-com-demproductsales&storeName=Newegg.com+-+DemProductSales
```

### Newegg.com - Minisforum Official `(newegg-com-minisforum-official)`  · relay=Y

**Product**: Mini PC with Ryzen 9 6900hx and Radeon 680m

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A13580549237410641305%2Cproductid%3A3924793509260922841%2CheadlineOfferDocid%3A16427607015678241963%2CimageDocid%3A2768032511235132007%2Crds%3APC_15722999540771616996%7CPROD_PC_15722999540771616996%2Cgpcid%3A15722999540771616996%2Cmid%3A576462832935177168%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=fbe8fcda-8979-4c78-a165-fbc806cc4c92&title=Mini+PC+with+Ryzen+9+6900hx+and+Radeon+680m&store=newegg-com-minisforum-official&storeName=Newegg.com+-+Minisforum+Official
```

### Newegg.com - Techsaurus LTD `(newegg-com-techsaurus-ltd)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A6257208846280739346%2Cproductid%3A3790794847210838625%2CheadlineOfferDocid%3A3487665050832623874%2CimageDocid%3A11800043330486829581%2Crds%3APC_13513445356997666411%7CPROD_PC_13513445356997666411%2Cgpcid%3A13513445356997666411%2Cmid%3A576462879131152684%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=376b7566-314e-4f39-9b18-a9e883abbe13&title=Google+Pixel+9&store=newegg-com-techsaurus-ltd&storeName=Newegg.com+-+Techsaurus+LTD
```

### Nike Official `(nike-official)`  · relay=Y

**Product**: Nike Winflo 11 Mens

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A17578382486001313404%2Cproductid%3A12238677617871858573%2CheadlineOfferDocid%3A4298236428498819880%2CimageDocid%3A12059481469056931484%2Crds%3APC_11974874653626964293%7CPROD_PC_11974874653626964293%2Cgpcid%3A11974874653626964293%2Cmid%3A576462821472626098%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=6645b7df-29f3-4ee8-b23b-0f473e39a181&title=Nike+Winflo+11+Mens&store=nike-official&storeName=Nike+Official
```

### Nike.ae `(nike-ae)`  · relay=Y

**Product**: Nike Alphafly 3

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A14143966191621647904%2CheadlineOfferDocid%3A14143966191621647904%2CimageDocid%3A9842862261982408136%2Crds%3APC_12397436498983798316%7CPROD_PC_12397436498983798316%2Cpvt%3Aa%26hl%3Den%26gl%3Dae%26udm%3D28&id=6da75d65-c638-4913-a6fe-bf0a58a98f65&title=Nike+Alphafly+3&store=nike-ae&storeName=Nike.ae
```

### nike.com `(nike)`  · relay=Y

**Product**: Nike Zoom Rival Sprint

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A6308653782115461330%2Cproductid%3A5199180525448188428%2CheadlineOfferDocid%3A6334248670929657211%2CimageDocid%3A9271122828872255350%2Crds%3APC_15070919456603123454%7CPROD_PC_15070919456603123454%2Cgpcid%3A15070919456603123454%2Cmid%3A576462856348775833%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=c0b55501-51c3-4473-bed5-a5283c459290&title=Nike+Zoom+Rival+Sprint&store=nike&storeName=nike.com
```

### Nordstrom `(nordstrom)`  · relay=Y

**Product**: Petal & Pup Women's Caroline Floral Halter Maxi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A542462965484437908%2Cproductid%3A11305318166581995515%2CheadlineOfferDocid%3A3494492343661895064%2CimageDocid%3A16094603417637516241%2Crds%3APC_13941221101104727250%7CPROD_PC_13941221101104727250%2Cgpcid%3A13941221101104727250%2Cmid%3A576462704634899510%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=65ed7e67-4502-449a-9a10-88d132d958b1&title=Petal+%26+Pup+Women%27s+Caroline+Floral+Halter+Maxi+Dress&store=nordstrom&storeName=Nordstrom
```

### Old Navy `(old-navy)`  · relay=Y

**Product**: Old Navy Women's Fit & Flare Asymmetrical Shoulder Mini Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A1921391366122423094%2Cproductid%3A13630615032593431239%2CheadlineOfferDocid%3A10474704155117183418%2CimageDocid%3A13388879416602255329%2Crds%3APC_15470246657945755394%7CPROD_PC_15470246657945755394%2Cgpcid%3A15470246657945755394%2Cmid%3A576462877680250111%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=033acff8-8d1a-4fb6-962e-add1e3194e10&title=Old+Navy+Women%27s+Fit+%26+Flare+Asymmetrical+Shoulder+Mini+Dress&store=old-navy&storeName=Old+Navy
```

### Sephora UAE `(sephora-uae)`  · relay=Y

**Product**: Lancome Teint Idole Ultra Wear Foundation

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A7839240157259291817%2CheadlineOfferDocid%3A12979083533509494401%2CimageDocid%3A9988442966420508030%2Crds%3APC_1928701574118995186%7CPROD_PC_1928701574118995186%2Cgpcid%3A1928701574118995186%2Cmid%3A576462852818363679%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=6ded0eab-c205-4eb0-85bc-1dd6659b55d5&title=Lancome+Teint+Idole+Ultra+Wear+Foundation&store=sephora-uae&storeName=Sephora+UAE
```

### Sephora.de `(sephora-de)`  · relay=Y

**Product**: Fenty Beauty Pro Filt'r Soft Matte Powder Foundation

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A14227629588358352848%2CheadlineOfferDocid%3A16032291047281137762%2CimageDocid%3A13423864364562435678%2Crds%3APC_8493370299799157019%7CPROD_PC_8493370299799157019%2Cgpcid%3A8493370299799157019%2Cmid%3A576462539239888693%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=94a4efb7-3305-44a8-bac0-c19fb4b77fff&title=Fenty+Beauty+Pro+Filt%27r+Soft+Matte+Powder+Foundation&store=sephora-de&storeName=Sephora.de
```

### Staples `(staples)`  · relay=Y

**Product**: Lenovo ThinkStation P3 Tiny Workstation Core @

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A12534678201274182071%2Cproductid%3A15763802156291410564%2CheadlineOfferDocid%3A15253779124947430430%2CimageDocid%3A6019215178234844377%2Crds%3APC_5730479771397544730%7CPROD_PC_5730479771397544730%2Cgpcid%3A5730479771397544730%2Cmid%3A576462549195928273%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7ca4d703-6726-4647-8b87-4207ce1a69a6&title=Lenovo+ThinkStation+P3+Tiny+Workstation+Core+%40&store=staples&storeName=Staples
```

### Target `(target)`  · relay=Y

**Product**: Star Wars Outlaws

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12845293900712336537%2Cproductid%3A17113873984941308649%2CheadlineOfferDocid%3A3033947175163906409%2CimageDocid%3A1260471501314885744%2Crds%3APC_3996767713613568860%7CPROD_PC_3996767713613568860%2Cgpcid%3A3996767713613568860%2Cmid%3A576462459783649424%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b33b1d4d-4724-4d38-a1d6-7733ac0d4710&title=Star+Wars+Outlaws&store=target&storeName=Target
```

### Tennis Warehouse `(tennis-warehouse)`  · relay=Y

**Product**: WILSON Women's Intrigue Pro Tennis Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A48398973208809932%2CheadlineOfferDocid%3A4695703364217797819%2CimageDocid%3A13502406009120761164%2Crds%3APC_13423404284195016459%7CPROD_PC_13423404284195016459%2Cgpcid%3A13423404284195016459%2Cmid%3A576462808840776901%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=ef3650eb-d117-44bc-acbb-cbfbe6e1ff84&title=WILSON+Women%27s+Intrigue+Pro+Tennis+Shoes&store=tennis-warehouse&storeName=Tennis+Warehouse
```

### Ulta Beauty `(ulta-beauty)`  · relay=Y

**Product**: MAC Lipglass High Shine Lip Gloss - Bittersweet Me

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A15028312224339682714%2CheadlineOfferDocid%3A15028312224339682714%2CimageDocid%3A14607119031916677377%2Crds%3APC_5372963249917282515%7CPROD_PC_5372963249917282515%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=33c9e0cb-e07c-4028-9d10-d9920daf1e0a&title=MAC+Lipglass+High+Shine+Lip+Gloss+-+Bittersweet+Me&store=ulta-beauty&storeName=Ulta+Beauty
```

### Walmart `(walmart)`  · relay=Y

**Product**: Ninja Foodi Possible Cooker 8.5qt Multi-Cooker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A10899610331055155845%2Cproductid%3A5675036913717717090%2CheadlineOfferDocid%3A13636455793880001222%2CimageDocid%3A15285334131275869040%2Crds%3APC_8719138027878942213%7CPROD_PC_8719138027878942213%2Cgpcid%3A8719138027878942213%2Cmid%3A576462803465012506%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=a0104bd3-f2c8-45b1-8ecf-6a5f08a66409&title=Ninja+Foodi+Possible+Cooker+8.5qt+Multi-Cooker&store=walmart&storeName=Walmart
```

### Walmart - Authorized Beauty Distribution `(walmart-authorized-beauty-distribution)`  · relay=Y

**Product**: NARS Natural Radiant Longwear Foundation

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A14987302304500607339%2Cproductid%3A11950920186927971494%2CheadlineOfferDocid%3A18128371304419826161%2CimageDocid%3A9361306164729819564%2Crds%3APC_11429907452978920944%7CPROD_PC_11429907452978920944%2Cgpcid%3A11429907452978920944%2Cmid%3A576462347384360190%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=6ebd668f-a951-4cf9-8998-1f88cd2a979d&title=NARS+Natural+Radiant+Longwear+Foundation&store=walmart-authorized-beauty-distribution&storeName=Walmart+-+Authorized+Beauty+Distribution
```

### Walmart - Bench Ventures Corp `(walmart-bench-ventures-corp)`  · relay=Y

**Product**: Xiaomi Redmi 14C 4G ROM RAM Dual SIM GSM Unlocked

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRedmi+Note+14+deals%26prds%3Dcatalogid%3A15133651058731716982%2Cproductid%3A17288269642948842678%2CheadlineOfferDocid%3A138129864652492804%2CimageDocid%3A17088626394382178275%2Crds%3APC_11504663859095761433%7CPROD_PC_11504663859095761433%2Cgpcid%3A11504663859095761433%2Cmid%3A576462789003323597%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=30a46aee-8f0e-4d46-b130-84036fbeddfb&title=Xiaomi+Redmi+14C+4G+ROM+RAM+Dual+SIM+GSM+Unlocked&store=walmart-bench-ventures-corp&storeName=Walmart+-+Bench+Ventures+Corp
```

### Walmart - BV Official Store `(walmart-bv-official-store)`  · relay=Y

**Product**: Blackview Shark 6 Unlocked Phones, 5G T-Mobile Phones, 6.88 inch 120Hz 12gb+128gb/2tb, Android 15 Phone 16mp+8mp AI Camera 5000mAh/18W Cell Phone,

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dproductid%3A17988184721353103666%2CheadlineOfferDocid%3A17988184721353103666%2CimageDocid%3A7617795764219067981%2Crds%3APC_16553946207883997079%7CPROD_PC_16553946207883997079%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=a17b3e38-a978-4e89-86c9-c3ac64f835c2&title=Blackview+Shark+6+Unlocked+Phones%2C+5G+T-Mobile+Phones%2C+6.88+inch+120Hz+12gb%2B128gb%2F2tb%2C+Android+15+Phone+16mp%2B8mp+AI+Came&store=walmart-bv-official-store&storeName=Walmart+-+BV+Official+Store
```

### Walmart - Carote Official `(walmart-carote-official)`  · relay=Y

**Product**: Carote 15 Pcs Ceramic Cookware Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A3615869244543263042%2Cproductid%3A4550239861101416212%2CheadlineOfferDocid%3A1718613778150905587%2CimageDocid%3A16952171072898392726%2Cgpcid%3A8122018568940313185%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b845c54b-243b-4daa-9f52-10cb06205728&title=Carote+15+Pcs+Ceramic+Cookware+Set&store=walmart-carote-official&storeName=Walmart+-+Carote+Official
```

### Walmart - CellphoneMAX `(walmart-cellphonemax)`  · relay=Y

**Product**: Samsung Galaxy S10+

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A14103379576481631344%2Cproductid%3A17940354246461203158%2CheadlineOfferDocid%3A10236864138671451616%2CimageDocid%3A429748098843524058%2Crds%3APC_2064156120049538632%7CPROD_PC_2064156120049538632%2Cgpcid%3A2064156120049538632%2Cmid%3A576462777793100451%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=f9bcb9a7-2254-428e-83e6-7a817ad4e817&title=Samsung+Galaxy+S10%2B&store=walmart-cellphonemax&storeName=Walmart+-+CellphoneMAX
```

### Walmart - CELLSTOREUSA `(walmart-cellstoreusa)`  · relay=Y

**Product**: Samsung Galaxy S21 Ultra 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A16528613607945220254%2Cproductid%3A16925373774194765045%2CheadlineOfferDocid%3A17679008650711132950%2CimageDocid%3A13241991857392893023%2Crds%3APC_4997178317016352874%7CPROD_PC_4997178317016352874%2Cgpcid%3A4997178317016352874%2Cmid%3A576462849730319523%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ec25ac65-c76e-411b-b4e5-5247c7085f2e&title=Samsung+Galaxy+S21+Ultra+5G&store=walmart-cellstoreusa&storeName=Walmart+-+CELLSTOREUSA
```

### Walmart - Chefman Direct `(walmart-chefman-direct)`  · relay=Y

**Product**: Chefman 1.1 Cu. Ft. Countertop Microwave Oven

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A10605389632867541934%2Cproductid%3A4292100944186192394%2CheadlineOfferDocid%3A5798298260020588268%2CimageDocid%3A13631897462129290488%2Crds%3APC_17499020485641368268%7CPROD_PC_17499020485641368268%2Cgpcid%3A17499020485641368268%2Cmid%3A576462874591188841%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ce53cbf3-a886-4203-805a-23df2a4e18a6&title=Chefman+1.1+Cu.+Ft.+Countertop+Microwave+Oven&store=walmart-chefman-direct&storeName=Walmart+-+Chefman+Direct
```

### Walmart - Cleamol Co.,Ltd `(walmart-cleamol-co-ltd)`  · relay=Y

**Product**: Nimo Gaming Laptop 17.3 inch Ryzen 9 8945hs,32gb Ram, 1TB Ssd, Radeon 780m Graphics, PD 100w Type-C 4.0, Ai&vr Ready Copilot+ PC, Backlit Keyboard

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dproductid%3A7470267328506919259%2CheadlineOfferDocid%3A7470267328506919259%2CimageDocid%3A18209123414605807044%2Crds%3APC_3101568325669613749%7CPROD_PC_3101568325669613749%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=f33362af-55d0-49d5-884f-912f7ca85f7a&title=Nimo+Gaming+Laptop+17.3+inch+Ryzen+9+8945hs%2C32gb+Ram%2C+1TB+Ssd%2C+Radeon+780m+Graphics%2C+PD+100w+Type-C+4.0%2C+Ai%26vr+Ready+Cop&store=walmart-cleamol-co-ltd&storeName=Walmart+-+Cleamol+Co.%2CLtd
```

### Walmart - Creo Distributions LLC `(walmart-creo-distributions-llc)`  · relay=Y

**Product**: Samsung Galaxy G998u S21 Ultra 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A7685229291185644084%2Cproductid%3A18400625230308003314%2CheadlineOfferDocid%3A5816355160754481684%2CimageDocid%3A2754659507713371662%2Crds%3APC_4997178317016352874%7CPROD_PC_4997178317016352874%2Cgpcid%3A4997178317016352874%2Cmid%3A576462849730319523%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=a75b3be0-1e8f-4f75-8828-61c18793c4fb&title=Samsung+Galaxy+G998u+S21+Ultra+5G&store=walmart-creo-distributions-llc&storeName=Walmart+-+Creo+Distributions+LLC
```

### Walmart - DAC Enterprises `(walmart-dac-enterprises)`  · relay=Y

**Product**: SAMSUNG Galaxy A07-A075F Android Mobile Smart Phone With 64GB+4GB & 128GB+4GB

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A10051770395354065258%2Cproductid%3A730045899772063865%2CheadlineOfferDocid%3A8895100289178404703%2CimageDocid%3A16304057956839307117%2Crds%3APC_7088925329219646031%7CPROD_PC_7088925329219646031%2Cgpcid%3A7088925329219646031%2Cmid%3A576462531726678359%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ef99a85b-140b-4f57-8784-411a6967e30c&title=SAMSUNG+Galaxy+A07-A075F+Android+Mobile+Smart+Phone+With+64GB%2B4GB+%26+128GB%2B4GB&store=walmart-dac-enterprises&storeName=Walmart+-+DAC+Enterprises
```

### Walmart - Darionindustries `(walmart-darionindustries)`  · relay=Y

**Product**: Marvel Spider-Man Miles Morales

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A11588730398413564824%2CheadlineOfferDocid%3A1547512200256720437%2CimageDocid%3A11840158183157474855%2Crds%3APC_10260054457689252703%7CPROD_PC_10260054457689252703%2Cgpcid%3A10260054457689252703%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7f4ede1b-9334-4839-b940-33c92d46efb5&title=Marvel+Spider-Man+Miles+Morales&store=walmart-darionindustries&storeName=Walmart+-+Darionindustries
```

### Walmart - DOOGEE Official `(walmart-doogee-official)`  · relay=Y

**Product**: Doogee Note56 Plus Cell Phone

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A14509333349225887060%2CheadlineOfferDocid%3A4918626410439304032%2CimageDocid%3A2058520846717625324%2Crds%3APC_1248076042199670746%7CPROD_PC_1248076042199670746%2Cgpcid%3A1248076042199670746%2Cmid%3A576462882308946704%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=cef52025-f4b3-4ea5-bae4-a6b250682b73&title=Doogee+Note56+Plus+Cell+Phone&store=walmart-doogee-official&storeName=Walmart+-+DOOGEE+Official
```

### Walmart - Dynamic - MUSICAL INSTRUMENTS ARTS AND CRAFTS `(walmart-dynamic-musical-instruments-arts-and-crafts)`  · relay=Y

**Product**: Super Mario Odyssey

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A11225209821541699145%2Cproductid%3A3797375442467910056%2CheadlineOfferDocid%3A4596753965323744579%2CimageDocid%3A5356289758496249176%2Crds%3APC_13259690953276484612%7CPROD_PC_13259690953276484612%2Cgpcid%3A13259690953276484612%2Cmid%3A576462232703946356%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ff999f5b-e530-47ae-8745-55055a6253f7&title=Super+Mario+Odyssey&store=walmart-dynamic-musical-instruments-arts-and-crafts&storeName=Walmart+-+Dynamic+-+MUSICAL+INSTRUMENTS+ARTS+AND+CRAFTS
```

### Walmart - Dyson, Inc. `(walmart-dyson-inc)`  · relay=Y

**Product**: Dyson V11 Complete Cordless Vacuum Cleaner | Iron | New | Floor Dok Included, Yellow

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDyson+V11+deals%26prds%3Dproductid%3A5029580342715480187%2CheadlineOfferDocid%3A5029580342715480187%2CimageDocid%3A12431800584183050582%2Crds%3APC_5743129508320285781%7CPROD_PC_5743129508320285781%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=89a7f164-534f-498d-94a4-6b846a638c7c&title=Dyson+V11+Complete+Cordless+Vacuum+Cleaner+%7C+Iron+%7C+New+%7C+Floor+Dok+Included%2C+Yellow&store=walmart-dyson-inc&storeName=Walmart+-+Dyson%2C+Inc.
```

### Walmart - GiPP Cookware `(walmart-gipp-cookware)`  · relay=Y

**Product**: Gipp 5pcs Pots and Pans Set Non Stick,Cookware Sets with Removable Handle, Oven & Dishwasher Safe,Induction Cookware,Kitchen Cooking set,Baby Blue

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A13852658308361194450%2CheadlineOfferDocid%3A13852658308361194450%2CimageDocid%3A5129459464871789213%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=00b04f1e-1619-4815-9ea4-163b6aad50e5&title=Gipp+5pcs+Pots+and+Pans+Set+Non+Stick%2CCookware+Sets+with+Removable+Handle%2C+Oven+%26+Dishwasher+Safe%2CInduction+Cookware%2CKit&store=walmart-gipp-cookware&storeName=Walmart+-+GiPP+Cookware
```

### Walmart - GMKtec-USA `(walmart-gmktec-usa)`  · relay=Y

**Product**: Gmktec Mini PC, Intel Alder Lake N95(Up to 3.4GHz), 16gb Ddr4 512gb Ssd, Mini Desktop Computer, Windows 11 Pro, NucBox G3S, Black

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dproductid%3A17014229107469216930%2CheadlineOfferDocid%3A17014229107469216930%2CimageDocid%3A6768573152038602769%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=345feed4-7aa5-4874-b702-ed0a09cfb6c0&title=Gmktec+Mini+PC%2C+Intel+Alder+Lake+N95%28Up+to+3.4GHz%29%2C+16gb+Ddr4+512gb+Ssd%2C+Mini+Desktop+Computer%2C+Windows+11+Pro%2C+NucBox+G&store=walmart-gmktec-usa&storeName=Walmart+-+GMKtec-USA
```

### Walmart - Gotham Cells `(walmart-gotham-cells)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoogle+Pixel+9+deals%26prds%3Dcatalogid%3A6257208846280739346%2Cproductid%3A3790794847210838625%2CheadlineOfferDocid%3A12306359786979124237%2CimageDocid%3A5958938966363937809%2Crds%3APC_13513445356997666411%7CPROD_PC_13513445356997666411%2Cgpcid%3A13513445356997666411%2Cmid%3A576462879131152684%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1b58bba2-c6b3-47f9-9607-ff3f5a43ac75&title=Google+Pixel+9&store=walmart-gotham-cells&storeName=Walmart+-+Gotham+Cells
```

### Walmart - Havato `(walmart-havato)`  · relay=Y

**Product**: HAVATO Ice Makers Countertop with Handle, 26.5 lbs / 24 H, 8 Cubes in 6 Mins, Portable Ice Machine with Self-Cleaning, Perfect for Home Kitchen (Green

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A17644084454855834097%2Cproductid%3A15353709503000678635%2CheadlineOfferDocid%3A8353433155280018705%2CimageDocid%3A13306807652897934382%2Crds%3ACID_17644084454855834097%7CPROD_CID_17644084454855834097%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=5880dad6-df8c-4c5c-8fb5-e2bb4ca8153d&title=HAVATO+Ice+Makers+Countertop+with+Handle%2C+26.5+lbs+%2F+24+H%2C+8+Cubes+in+6+Mins%2C+Portable+Ice+Machine+with+Self-Cleaning%2C+P&store=walmart-havato&storeName=Walmart+-+Havato
```

### Walmart - HotDeals `(walmart-hotdeals)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPixel+9+Pro+deals%26prds%3Dproductid%3A15473779991617999221%2CheadlineOfferDocid%3A15473779991617999221%2CimageDocid%3A15010620038007557425%2Crds%3APC_7289913198085316365%7CPROD_PC_7289913198085316365%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=126821ca-5802-4e3c-a3a2-31e0abd83437&title=Google+Pixel+9&store=walmart-hotdeals&storeName=Walmart+-+HotDeals
```

### Walmart - IMGlobal `(walmart-imglobal)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGoogle+Pixel+9+deals%26prds%3Dproductid%3A11830460707356570936%2CheadlineOfferDocid%3A11830460707356570936%2CimageDocid%3A4394244965712166992%2Crds%3APC_7289913198085316365%7CPROD_PC_7289913198085316365%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=858e1f3e-be95-4353-901f-671ead28aee9&title=Google+Pixel+9&store=walmart-imglobal&storeName=Walmart+-+IMGlobal
```

### Walmart - Kikcoin `(walmart-kikcoin)`  · relay=Y

**Product**: Kikcoin Acacia Wood Cutting Board, Cutting Board Set of 3 with Juice Groove, Wooden Chopping Boards for Kitchen, for Meat & Vegetables, Size: 16.14×

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A3095457699596961210%2CheadlineOfferDocid%3A3095457699596961210%2CimageDocid%3A16388516721914938869%2Crds%3APC_11035390447535847299%7CPROD_PC_11035390447535847299%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=da776df3-5284-44d6-9837-977d6ff696d9&title=Kikcoin+Acacia+Wood+Cutting+Board%2C+Cutting+Board+Set+of+3+with+Juice+Groove%2C+Wooden+Chopping+Boards+for+Kitchen%2C+for+Mea&store=walmart-kikcoin&storeName=Walmart+-+Kikcoin
```

### Walmart - Knoc Knoc Treasures `(walmart-knoc-knoc-treasures)`  · relay=Y

**Product**: Logitech G435 Lightspeed Wireless Gaming Headset

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A3718816681891766263%2CheadlineOfferDocid%3A8412272591664372480%2CimageDocid%3A10315286044630074697%2Crds%3APC_9151332283079311547%7CPROD_PC_9151332283079311547%2Cgpcid%3A9151332283079311547%2Cmid%3A576462829356253217%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=e3759568-75f2-469c-a9f9-e44531f6b0ec&title=Logitech+G435+Lightspeed+Wireless+Gaming+Headset&store=walmart-knoc-knoc-treasures&storeName=Walmart+-+Knoc+Knoc+Treasures
```

### Walmart - lang de sen `(walmart-lang-de-sen)`  · relay=Y

**Product**: 20 Piece Ceramic Pots and Pans Set Non Stick, Cookware Set with Detachable Handles, Oven Safe, Induction Ready, Stackable RV Kitchen Cooking Set,

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A3057357642142188976%2CheadlineOfferDocid%3A3057357642142188976%2CimageDocid%3A4194978384968855095%2Crds%3ALO_3057357642142188976%7CPROD_LO_3057357642142188976%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=9898b14e-29d3-4353-b167-8ed8482d5c77&title=20+Piece+Ceramic+Pots+and+Pans+Set+Non+Stick%2C+Cookware+Set+with+Detachable+Handles%2C+Oven+Safe%2C+Induction+Ready%2C+Stackabl&store=walmart-lang-de-sen&storeName=Walmart+-+lang+de+sen
```

### Walmart - Marvins Tech & More `(walmart-marvins-tech-more)`  · relay=Y

**Product**: Marvel's Spider-Man: Miles Morales Ultimate Edition

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A11588730398413564824%2Cproductid%3A7336952379371756186%2CheadlineOfferDocid%3A2106080725600033761%2CimageDocid%3A11840158183157474855%2Crds%3APC_10260054457689252703%7CPROD_PC_10260054457689252703%2Cgpcid%3A10260054457689252703%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=033fd44a-7b57-4a90-ac55-b9f8518fc151&title=Marvel%27s+Spider-Man%3A+Miles+Morales+Ultimate+Edition&store=walmart-marvins-tech-more&storeName=Walmart+-+Marvins+Tech+%26+More
```

### Walmart - Nothing Customer support `(walmart-nothing-customer-support)`  · relay=Y

**Product**: Nothing Phone

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A10446967053496013180%2Cproductid%3A1060641701203574361%2CheadlineOfferDocid%3A14926911916687955318%2CimageDocid%3A14621858906855540889%2Crds%3APC_16127829128511898291%7CPROD_PC_16127829128511898291%2Cgpcid%3A16127829128511898291%2Cmid%3A576462835053825743%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b4a94415-d024-4fa6-af40-f9c1148d22d9&title=Nothing+Phone&store=walmart-nothing-customer-support&storeName=Walmart+-+Nothing+Customer+support
```

### Walmart - PerfumesAmerica `(walmart-perfumesamerica)`  · relay=Y

**Product**: Eros Versace Eau De Toilette Spray Men

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A2216054862363593518%2Cproductid%3A13336133265405260176%2CheadlineOfferDocid%3A4356747418138097306%2CimageDocid%3A7662553399662019360%2Crds%3APC_8275937377626129355%7CPROD_PC_8275937377626129355%2Cgpcid%3A8275937377626129355%2Cmid%3A576462478110049856%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=21a7a0b2-d060-4dca-ac51-d4c28e991774&title=Eros+Versace+Eau+De+Toilette+Spray+Men&store=walmart-perfumesamerica&storeName=Walmart+-+PerfumesAmerica
```

### Walmart - Quality Brands Deals `(walmart-quality-brands-deals)`  · relay=Y

**Product**: Estee Lauder Double Wear Maximum Cover Camouflage Makeup

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A15883579292010201453%2Cproductid%3A91226274845008357%2CheadlineOfferDocid%3A15452868419513517563%2CimageDocid%3A11170230021264525240%2Crds%3APC_4320102902489293652%7CPROD_PC_4320102902489293652%2Cgpcid%3A4320102902489293652%2Cmid%3A576462224916975093%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7275557d-84ae-48ef-8ec3-a655c9887979&title=Estee+Lauder+Double+Wear+Maximum+Cover+Camouflage+Makeup&store=walmart-quality-brands-deals&storeName=Walmart+-+Quality+Brands+Deals
```

### Walmart - Random and BEYOND `(walmart-random-and-beyond)`  · relay=Y

**Product**: Motorola Moto G Play

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A2430458314848927778%2Cproductid%3A9856660685790588006%2CheadlineOfferDocid%3A875124363623637131%2CimageDocid%3A17263745423152649881%2Crds%3APC_5618553093737121452%7CPROD_PC_5618553093737121452%2Cgpcid%3A5618553093737121452%2Cmid%3A576462827440715268%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b86fae32-2be3-4978-94f7-0a63a616d260&title=Motorola+Moto+G+Play&store=walmart-random-and-beyond&storeName=Walmart+-+Random+and+BEYOND
```

### Walmart - Reliant Cellular `(walmart-reliant-cellular)`  · relay=Y

**Product**: Restored Samsung Galaxy Z Flip 4 5G F721u

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A15060130511629889937%2Cproductid%3A16190044022238050091%2CheadlineOfferDocid%3A37512410379956211%2CimageDocid%3A11997858884065120603%2Crds%3APC_6500942693023472972%7CPROD_PC_6500942693023472972%2Cgpcid%3A6500942693023472972%2Cmid%3A576462719354877161%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1e30b8fc-fb35-49bf-a883-25f0acec3d33&title=Restored+Samsung+Galaxy+Z+Flip+4+5G+F721u&store=walmart-reliant-cellular&storeName=Walmart+-+Reliant+Cellular
```

### Walmart - RNRUO `(walmart-rnruo)`  · relay=Y

**Product**: Rnruo 14 inch Laptop Computer, 32gb RAM 1TB SSD Intel 6500y with 2 Cores, 1080p Display, Dual 4K Output, Type-C PD WiFi5 Bt5.0, Office 2024 Windows 11

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dproductid%3A6674648185164747639%2CheadlineOfferDocid%3A6674648185164747639%2CimageDocid%3A730653977378001954%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=3cc2b8b1-428f-4379-be51-5844a86cf8aa&title=Rnruo+14+inch+Laptop+Computer%2C+32gb+RAM+1TB+SSD+Intel+6500y+with+2+Cores%2C+1080p+Display%2C+Dual+4K+Output%2C+Type-C+PD+WiFi5&store=walmart-rnruo&storeName=Walmart+-+RNRUO
```

### Walmart - Shopaudioxtc `(walmart-shopaudioxtc)`  · relay=Y

**Product**: JL Audio 12W6v3-D4 12" Subwoofer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A7815442802390575557%2Cproductid%3A177291430601810623%2CheadlineOfferDocid%3A10755759516896326162%2CimageDocid%3A7720880742281885350%2Crds%3APC_13080997347304487070%7CPROD_PC_13080997347304487070%2Cgpcid%3A13080997347304487070%2Cmid%3A576462492903069579%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=a7d4cf44-0087-4035-906d-29e675bf9e79&title=JL+Audio+12W6v3-D4+12%22+Subwoofer&store=walmart-shopaudioxtc&storeName=Walmart+-+Shopaudioxtc
```

### Walmart - Steals & Deals `(walmart-steals-deals)`  · relay=Y

**Product**: L.A. Colors Shimmer Eye Palette

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A4123072889315608762%2Cproductid%3A9295777597157497443%2CheadlineOfferDocid%3A102495068952694232%2CimageDocid%3A4469819469001027063%2Crds%3APC_13742029224578158325%7CPROD_PC_13742029224578158325%2Cgpcid%3A13742029224578158325%2Cmid%3A576462433852785515%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=379b1e13-14df-4bb1-9584-f05c2aaea107&title=L.A.+Colors+Shimmer+Eye+Palette&store=walmart-steals-deals&storeName=Walmart+-+Steals+%26+Deals
```

### Walmart - Techmate Intl. `(walmart-techmate-intl)`  · relay=Y

**Product**: Samsung Galaxy A17 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A640416926500033299%2CheadlineOfferDocid%3A2575176663869530263%2CimageDocid%3A6563782789133997696%2Crds%3APC_11045274306933644030%7CPROD_PC_11045274306933644030%2Cgpcid%3A11045274306933644030%2Cmid%3A576462841361701311%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ea829e6b-f85a-466a-a6e6-7e7ad210e676&title=Samsung+Galaxy+A17+5G&store=walmart-techmate-intl&storeName=Walmart+-+Techmate+Intl.
```

### Walmart - The Phone Guys `(walmart-the-phone-guys)`  · relay=Y

**Product**: Samsung Galaxy S25 FE

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A16454665874920281003%2Cproductid%3A2033275612633834778%2CheadlineOfferDocid%3A4123178833148489367%2CimageDocid%3A1440343357833488472%2Crds%3APC_5284187792860746827%7CPROD_PC_5284187792860746827%2Cgpcid%3A5284187792860746827%2Cmid%3A576462862864753816%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ef2d3865-04c9-4aea-a390-2d9803001238&title=Samsung+Galaxy+S25+FE&store=walmart-the-phone-guys&storeName=Walmart+-+The+Phone+Guys
```

### Walmart - Turtle Beach `(walmart-turtle-beach)`  · relay=Y

**Product**: Turtle Beach Burst II Air Wireless Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12210737637451064099%2Cproductid%3A13679941377458894010%2CheadlineOfferDocid%3A9365635749670578227%2CimageDocid%3A14476030594404985785%2Crds%3APC_962331459252036610%7CPROD_PC_962331459252036610%2Cgpcid%3A962331459252036610%2Cmid%3A576462852613482061%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=fb27a0f6-ac36-4186-a85b-c93b531b7339&title=Turtle+Beach+Burst+II+Air+Wireless+Gaming+Mouse&store=walmart-turtle-beach&storeName=Walmart+-+Turtle+Beach
```

### Walmart - Value Tech `(walmart-value-tech)`  · relay=Y

**Product**: Asus ROG Strix G16 Laptop

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A134410787128582895%2Cproductid%3A16275702033334869445%2CheadlineOfferDocid%3A4002002531301489302%2CimageDocid%3A11101041465365623123%2Crds%3APC_9628832459893515516%7CPROD_PC_9628832459893515516%2Cgpcid%3A11093413553602636258%2Cmid%3A576462549101650451%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=e4deadf9-2743-4ec7-b7a8-84c3d32d7957&title=Asus+ROG+Strix+G16+Laptop&store=walmart-value-tech&storeName=Walmart+-+Value+Tech
```

### Walmart - Wireless Source `(walmart-wireless-source)`  · relay=Y

**Product**: Apple Watch SE Aluminum

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A18086637417545149294%2Cproductid%3A14600709168038108589%2CheadlineOfferDocid%3A2784179210428810040%2CimageDocid%3A17443274741079284861%2Crds%3APC_8360109243546355642%7CPROD_PC_8360109243546355642%2Cgpcid%3A8360109243546355642%2Cmid%3A576462796319228210%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=26a316b3-daab-4e23-9374-deb23c9a79cb&title=Apple+Watch+SE+Aluminum&store=walmart-wireless-source&storeName=Walmart+-+Wireless+Source
```

### Walmart - WiseMinch MJ `(walmart-wiseminch-mj)`  · relay=Y

**Product**: Alliwise Astaxanthin Soft Gel Capsule Supplement Promotes Cardiovascular Health

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A9113028437590231373%2Cproductid%3A11977517688172520776%2CheadlineOfferDocid%3A16054762472442380482%2CimageDocid%3A13599127101515684802%2Crds%3APC_10472319817022876947%7CPROD_PC_10472319817022876947%2Cgpcid%3A10472319817022876947%2Cmid%3A576462549878881071%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ba5b759d-3f3e-498b-a967-4b3adc22f82f&title=Alliwise+Astaxanthin+Soft+Gel+Capsule+Supplement+Promotes+Cardiovascular+Health&store=walmart-wiseminch-mj&storeName=Walmart+-+WiseMinch+MJ
```

### Wayfair `(wayfair)`  · relay=Y

**Product**: De'Longhi Classic Espresso Machine

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A11437384526321196615%2Cproductid%3A6333426513739918533%2CheadlineOfferDocid%3A8640217311950025220%2CimageDocid%3A11402451702239575322%2Crds%3APC_12352953478504323292%7CPROD_PC_12352953478504323292%2Cgpcid%3A12352953478504323292%2Cmid%3A576462886513641118%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=0f125dc1-1825-4560-807d-a132284bbcd7&title=De%27Longhi+Classic+Espresso+Machine&store=wayfair&storeName=Wayfair
```

## DE — 9 merchants

### Amazon.de `(amazon-de)`  · relay=Y

**Product**: Philips, Trimmers + Hair Clippers, OneBlade 360 Face + Body

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A14255008105288603763%2Cproductid%3A8362088133895764678%2CheadlineOfferDocid%3A14875142881981419137%2CimageDocid%3A13299946966391483325%2Crds%3APC_708435959697412740%7CPROD_PC_708435959697412740%2Cgpcid%3A708435959697412740%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=6fe3d005-ee9a-4519-941d-cd4da3a7ea54&title=Philips%2C+Trimmers+%2B+Hair+Clippers%2C+OneBlade+360+Face+%2B+Body&store=amazon-de&storeName=Amazon.de
```

### Amazon.de - Amazon.de-Seller `(amazon-de-amazon-de-seller)`  · relay=Y

**Product**: FOSSiBOT F2400 Power Station Solar Panel

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A16692348369700918760%2Cproductid%3A15793192086423833749%2CheadlineOfferDocid%3A9740571341000762331%2CimageDocid%3A5958914072693925964%2Crds%3APC_7077896577495704468%7CPROD_PC_7077896577495704468%2Cgpcid%3A7077896577495704468%2Cmid%3A576462852881683476%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=fce39518-3b28-410a-8671-4f82984f99be&title=FOSSiBOT+F2400+Power+Station+Solar+Panel&store=amazon-de-amazon-de-seller&storeName=Amazon.de+-+Amazon.de-Seller
```

### Cotton On `(cotton-on)`  · relay=Y

**Product**: Women Cotton On Body Ultra Soft T-Bar Tank

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A12733000825140248975%2Cproductid%3A15683006347621730694%2CheadlineOfferDocid%3A4111624993924460911%2CimageDocid%3A10758747706846136287%2Crds%3APC_14455997577867149638%7CPROD_PC_14455997577867149638%2Cgpcid%3A14455997577867149638%2Cmid%3A576462879826824666%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=73ff8ff0-55ec-4caf-a90f-0fb64753a25d&title=Women+Cotton+On+Body+Ultra+Soft+T-Bar+Tank&store=cotton-on&storeName=Cotton+On
```

### en.zalando.de `(en-zalando-de)`  · relay=Y

**Product**: Under Armour Tech Textured Men's Short Sleeve T-Shirt

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A148995901026057455%2Cproductid%3A2627534915122438295%2CheadlineOfferDocid%3A16460846160947204151%2CimageDocid%3A14012535911374836302%2Crds%3APC_6499332343209505248%7CPROD_PC_6499332343209505248%2Cgpcid%3A6499332343209505248%2Cmid%3A576462823339680212%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=7298c0ff-34e7-4e9a-8879-fbf170ea349f&title=Under+Armour+Tech+Textured+Men%27s+Short+Sleeve+T-Shirt&store=en-zalando-de&storeName=en.zalando.de
```

### MediaMarkt DE `(mediamarkt-de)`  · relay=Y

**Product**: Nioh Collection PS5

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12186225703809163790%2Cproductid%3A1737415292246450890%2CheadlineOfferDocid%3A10865068320179728650%2CimageDocid%3A9467836008118838669%2Crds%3APC_18245659175207600533%7CPROD_PC_18245659175207600533%2Cgpcid%3A18245659175207600533%2Cmid%3A576462814261344111%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=94f33893-be53-446a-bc19-2a8dd2df782a&title=Nioh+Collection+PS5&store=mediamarkt-de&storeName=MediaMarkt+DE
```

### Mediamarkt Marketplace DE `(mediamarkt-marketplace-de)`  · relay=Y

**Product**: Samsung Galaxy A53 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A1270523182694937421%2Cproductid%3A4829778929275667784%2CheadlineOfferDocid%3A16107738804940397846%2CimageDocid%3A2992009452320070563%2Crds%3APC_928647197513735271%7CPROD_PC_928647197513735271%2Cgpcid%3A928647197513735271%2Cmid%3A576462669801332073%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=c2f497dd-9519-4bde-925c-b5c515122b45&title=Samsung+Galaxy+A53+5G&store=mediamarkt-marketplace-de&storeName=Mediamarkt+Marketplace+DE
```

### OTTO `(otto)`  · relay=Y

**Product**: SodaStream 2 Bottles 1 Litre Dishwasher Safe Plastic, Transparent

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A5212432796781160318%2Cproductid%3A16549172294776128284%2CheadlineOfferDocid%3A3233956605587629213%2CimageDocid%3A14357677315987528347%2Crds%3APC_5791708360311213211%7CPROD_PC_5791708360311213211%2Cgpcid%3A5791708360311213211%2Cmid%3A576462793872738055%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=96975b62-ebf6-43fe-880e-db09f57f071c&title=SodaStream+2+Bottles+1+Litre+Dishwasher+Safe+Plastic%2C+Transparent&store=otto&storeName=OTTO
```

### PcComponentes.de `(pccomponentes-de)`  · relay=Y

**Product**: Philips Dual Basket Airfryer NA353/10

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A13716454401260247232%2CheadlineOfferDocid%3A7009293846659474973%2CimageDocid%3A2826027391928395590%2Crds%3APC_16466565234985957090%7CPROD_PC_16466565234985957090%2Cgpcid%3A16466565234985957090%2Cmid%3A576462484469531941%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=9cdfffcd-479f-4f51-aeec-b52af4cd7033&title=Philips+Dual+Basket+Airfryer+NA353%2F10&store=pccomponentes-de&storeName=PcComponentes.de
```

### Scharferladen `(scharferladen)`  · relay=Y

**Product**: VICTORINOX SWISS CLASSIC Faltbares Gemüsemesser Wellenschliff

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A14000955230237547997%2CheadlineOfferDocid%3A14000955230237547997%2CimageDocid%3A11375908613170362324%2Crds%3APC_2141898526429110038%7CPROD_PC_2141898526429110038%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=119ad1a2-2365-4d9c-8754-56c76791c160&title=VICTORINOX+SWISS+CLASSIC+Faltbares+Gem%C3%BCsemesser+Wellenschliff&store=scharferladen&storeName=Scharferladen
```

## AE — 7 merchants

### Al Ramil Al Abyad `(al-ramil-al-abyad)`  · relay=Y

**Product**: Beko 60x60cm Freestanding Ceramic Electric Cooker fsm67320gxs

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A308995375849944975%2CheadlineOfferDocid%3A9583224210166048294%2CimageDocid%3A308472019927271910%2Crds%3APC_1686824392422526308%7CPROD_PC_1686824392422526308%2Cgpcid%3A1686824392422526308%2Cmid%3A576462369924530531%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=08298283-7107-472a-8a7a-454c609eb60b&title=Beko+60x60cm+Freestanding+Ceramic+Electric+Cooker+fsm67320gxs&store=al-ramil-al-abyad&storeName=Al+Ramil+Al+Abyad
```

### Amazon.ae - Retail `(amazon-ae-retail)`  · relay=Y

**Product**: Logitech G PRO X Superlight 2 Wireless Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A11055023561545325594%2Cproductid%3A17585749697127846891%2CheadlineOfferDocid%3A17324748948561561484%2CimageDocid%3A8157089761066855262%2Crds%3APC_2127972044662208544%7CPROD_PC_2127972044662208544%2Cgpcid%3A2127972044662208544%2Cmid%3A576462802352796891%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=c1d9fb4c-2de8-4abe-8f5f-21c70410bcf9&title=Logitech+G+PRO+X+Superlight+2+Wireless+Gaming+Mouse&store=amazon-ae-retail&storeName=Amazon.ae+-+Retail
```

### Amazon.ae - Seller `(amazon-ae-seller)`  · relay=Y

**Product**: Mini PC and GEEKOM A6 Ryzen 7 32GB 1TB

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A16410910843123619864%2Cproductid%3A4075913189961088254%2CheadlineOfferDocid%3A14956087673059396673%2CimageDocid%3A7604030269258817876%2Cgpcid%3A12687531903981795536%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=b4dd1045-a177-469e-ba7a-9c5c30aca41a&title=Mini+PC+and+GEEKOM+A6+Ryzen+7+32GB+1TB&store=amazon-ae-seller&storeName=Amazon.ae+-+Seller
```

### LuLu Hypermarket `(lulu-hypermarket)`  · relay=Y

**Product**: Black+Decker Sandwich & Grill Maker 650-780W Powe

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A1667141946077328357%2Cproductid%3A13134695864350232494%2CheadlineOfferDocid%3A8910311049664388294%2CimageDocid%3A11884630639762775984%2Crds%3APC_1527980850309161033%7CPROD_PC_1527980850309161033%2Cgpcid%3A1527980850309161033%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=f1eb7f46-e60c-41b1-a8f6-a69b803ed7ae&title=Black%2BDecker+Sandwich+%26+Grill+Maker+650-780W+Powe&store=lulu-hypermarket&storeName=LuLu+Hypermarket
```

### noon.com `(noon)`  · relay=Y

**Product**: Aftron 90x60 5 Burners Gas Cooker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A2789984845831440967%2Cproductid%3A15502890478959717667%2CheadlineOfferDocid%3A8204662958579193693%2CimageDocid%3A14106870990172139653%2Cgpcid%3A1198123573044718596%2Cmid%3A576462472102990568%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=79cc9a1b-40ea-497e-8172-fab1f6fe0276&title=Aftron+90x60+5+Burners+Gas+Cooker&store=noon&storeName=noon.com
```

### Ounass.ae `(ounass-ae)`  · relay=Y

**Product**: Nuxe Huile Prodigieuse Florale Dry Oil

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A6378278925876001116%2Cproductid%3A4536121920967632858%2CheadlineOfferDocid%3A11775769388324619988%2CimageDocid%3A14696347620628790536%2Crds%3APC_8277572414421597531%7CPROD_PC_8277572414421597531%2Cgpcid%3A8277572414421597531%2Cmid%3A576462536173889739%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=37352452-228e-4030-b8d2-912bc9352ad8&title=Nuxe+Huile+Prodigieuse+Florale+Dry+Oil&store=ounass-ae&storeName=Ounass.ae
```

### SharafDG.com `(sharafdg)`  · relay=Y

**Product**: Beko 90x60cm Free standing Combination Cooker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A8684083831607084642%2Cproductid%3A4284970269188406692%2CheadlineOfferDocid%3A11038868174791701208%2CimageDocid%3A4253603658657167324%2Cgpcid%3A15008813462079232904%2Cmid%3A576462857334207361%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=126f35ca-32a1-4879-b53c-ab35e00cd3b6&title=Beko+90x60cm+Free+standing+Combination+Cooker&store=sharafdg&storeName=SharafDG.com
```

## IN — 23 merchants

### ajio.com `(ajio)`  · relay=Y

**Product**: Pilgrim Glow BB Cream

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A17926741554048557420%2Cproductid%3A2954831560301993385%2CheadlineOfferDocid%3A10277532307672574643%2CimageDocid%3A8655730997209131846%2Crds%3APC_13514652282248800148%7CPROD_PC_13514652282248800148%2Cgpcid%3A13514652282248800148%2Cmid%3A576462764872360849%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=5f69ecd6-d38f-453f-ace6-fe058c4c1f70&title=Pilgrim+Glow+BB+Cream&store=ajio&storeName=ajio.com
```

### Amazon India `(amazon-india)`  · relay=Y

**Product**: Polk Audio Monitor XT20 Bookshelf Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A5300313327440812509%2Cproductid%3A13612863401087708974%2CheadlineOfferDocid%3A3184892880222907759%2CimageDocid%3A1870403364729869833%2Crds%3APC_18001839487012099099%7CPROD_PC_18001839487012099099%2Cgpcid%3A18001839487012099099%2Cmid%3A576462828350191741%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=4439b383-2ff3-47bd-a179-f52dd06309af&title=Polk+Audio+Monitor+XT20+Bookshelf+Speaker&store=amazon-india&storeName=Amazon+India
```

### Amazon.in `(amazon-in)`  · relay=Y

**Product**: Fosi Audio MC101 Stereo Amplifier

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A15515648690701633035%2Cproductid%3A18218612183213824440%2CheadlineOfferDocid%3A17703209882889636009%2CimageDocid%3A9941990072982909254%2Crds%3APC_1221420343858268349%7CPROD_PC_1221420343858268349%2Cgpcid%3A1221420343858268349%2Cmid%3A576462770941556825%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=5c0f9d30-291a-4e6f-a961-2b5b74ee53d3&title=Fosi+Audio+MC101+Stereo+Amplifier&store=amazon-in&storeName=Amazon.in
```

### Computech-Solutions `(computech-solutions)`  · relay=Y

**Product**: Lenovo V15 G4 IRU FHD

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A4421108335205995200%2CheadlineOfferDocid%3A12374034289384150705%2CimageDocid%3A17389354430802521425%2Crds%3APC_3995036034689964053%7CPROD_PC_3995036034689964053%2Cgpcid%3A3995036034689964053%2Cmid%3A576462846865021995%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=93bc8021-e9b8-4b68-b1a3-5622c051c58f&title=Lenovo+V15+G4+IRU+FHD&store=computech-solutions&storeName=Computech-Solutions
```

### croma.com `(croma)`  · relay=Y

**Product**: Wonderchef Royal Velvet Purple Cookware Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A8323809670286420823%2Cproductid%3A16520007879876108698%2CheadlineOfferDocid%3A8259479740509407582%2CimageDocid%3A782623374049433428%2Crds%3APC_11932082144845406300%7CPROD_PC_11932082144845406300%2Cgpcid%3A11932082144845406300%2Cmid%3A576462687514667501%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=30e90ee4-65fd-49bc-b3ef-6dbfc32d8a11&title=Wonderchef+Royal+Velvet+Purple+Cookware+Set&store=croma&storeName=croma.com
```

### Flipkart `(flipkart)`  · relay=Y

**Product**: Boat Stone 350 10W

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A15902407159421977359%2Cproductid%3A14871500708867751514%2CheadlineOfferDocid%3A1734105286267609979%2CimageDocid%3A6474892586368701226%2Crds%3APC_5804163133931556723%7CPROD_PC_5804163133931556723%2Cgpcid%3A5804163133931556723%2Cmid%3A576462756792018285%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=98361b6e-2cd7-45ad-8a79-9969f797462b&title=Boat+Stone+350+10W&store=flipkart&storeName=Flipkart
```

### Getit `(getit)`  · relay=Y

**Product**: Antec VX100M ARGB Micro-ATX Mini Tower Gaming Chassis

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A15977147884013140171%2CheadlineOfferDocid%3A12020967870500132267%2CimageDocid%3A2543941952946903207%2Crds%3APC_4334369139652124614%7CPROD_PC_4334369139652124614%2Cgpcid%3A4334369139652124614%2Cmid%3A576462822499505226%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=967ff2d0-965b-46ed-8d4b-4feedd26f747&title=Antec+VX100M+ARGB+Micro-ATX+Mini+Tower+Gaming+Chassis&store=getit&storeName=Getit
```

### Himkhand `(himkhand)`  · relay=Y

**Product**: Borosil Chef Delite Chopper BCH20DBB21

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A2397324873970352160%2CheadlineOfferDocid%3A5167166825368729314%2CimageDocid%3A14998482780676704306%2Crds%3APC_8361089275785847958%7CPROD_PC_8361089275785847958%2Cgpcid%3A8361089275785847958%2Cmid%3A576462375931757078%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=ab8bb1cd-8c74-4588-8313-4894743601d4&title=Borosil+Chef+Delite+Chopper+BCH20DBB21&store=himkhand&storeName=Himkhand
```

### Hitech Gamez `(hitech-gamez)`  · relay=Y

**Product**: Horizon Forbidden West

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A720243278837308459%2CheadlineOfferDocid%3A4321278665691861109%2CimageDocid%3A3651118493550756220%2Crds%3APC_4594583339997167697%7CPROD_PC_4594583339997167697%2Cgpcid%3A4594583339997167697%2Cmid%3A576462453585658284%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=e46cb201-9949-425f-bb8a-0a9df63629b9&title=Horizon+Forbidden+West&store=hitech-gamez&storeName=Hitech+Gamez
```

### JioMart Electronics `(jiomart-electronics)`  · relay=Y

**Product**: Greenchef Nexa 4 Burner Glass Top Gas Stove

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A5704181019632019825%2CheadlineOfferDocid%3A15061652405863529380%2CimageDocid%3A5768615277774872077%2Cgpcid%3A10952723848001220519%2Cmid%3A576462836231014756%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=5572d0ee-c629-49c6-9af9-86027e69222d&title=Greenchef+Nexa+4+Burner+Glass+Top+Gas+Stove&store=jiomart-electronics&storeName=JioMart+Electronics
```

### Mamaearth `(mamaearth)`  · relay=Y

**Product**: Mamaearth Face Wash

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A12844986983034566867%2CheadlineOfferDocid%3A17299219794038921691%2CimageDocid%3A14286322281321372960%2Crds%3APC_17585148660145001128%7CPROD_PC_17585148660145001128%2Cgpcid%3A17585148660145001128%2Cmid%3A576462802370762094%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=23607a7a-a9db-429a-98ed-d043b2ce0687&title=Mamaearth+Face+Wash&store=mamaearth&storeName=Mamaearth
```

### meesho.com `(meesho)`  · relay=Y

**Product**: Flicka Silk Touch 3-in-1 Moisturizer and Primer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A228977175255756593%2Cproductid%3A10662659947647057897%2CheadlineOfferDocid%3A15212877930259570515%2CimageDocid%3A12966862546822150831%2Crds%3APC_7060653615906541927%7CPROD_PC_7060653615906541927%2Cgpcid%3A7060653615906541927%2Cmid%3A576462498634846796%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=e6c9a2ba-c567-4178-b632-241e09a2f835&title=Flicka+Silk+Touch+3-in-1+Moisturizer+and+Primer&store=meesho&storeName=meesho.com
```

### Myntra - MNow `(myntra-mnow)`  · relay=Y

**Product**: Dot & Key Strawberry Dew Strobe Cream

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A7987790781146399019%2CheadlineOfferDocid%3A3708176633323996906%2CimageDocid%3A16724774505216792849%2Crds%3APC_12042255758457666873%7CPROD_PC_12042255758457666873%2Cgpcid%3A12042255758457666873%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=fc7e130b-d6b0-4cff-8a19-f83b65ab012f&title=Dot+%26+Key+Strawberry+Dew+Strobe+Cream&store=myntra-mnow&storeName=Myntra+-+MNow
```

### Nykaa `(nykaa)`  · relay=Y

**Product**: MuscleBlaze Fuel One Whey Protein

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A2730679821256863555%2Cproductid%3A6647088141928640569%2CheadlineOfferDocid%3A14279415880959416162%2CimageDocid%3A7401486273902914741%2Crds%3APC_7137819407027081598%7CPROD_PC_7137819407027081598%2Cgpcid%3A7137819407027081598%2Cmid%3A576462866021057003%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=390793cd-0b5c-4d2c-b692-26ddbeae633e&title=MuscleBlaze+Fuel+One+Whey+Protein&store=nykaa&storeName=Nykaa
```

### Nykaa Fashion `(nykaa-fashion)`  · relay=Y

**Product**: Twenty Dresses by Nykaa Fashion Black Floral Off-Shoulder Flared Midi Dress (XL) At Nykaa Fashion - Your Online Shopping Store

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A17318397609241620904%2CheadlineOfferDocid%3A17318397609241620904%2CimageDocid%3A2444981467472650337%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=0ea2f054-57c9-4578-9906-72d07697ad8c&title=Twenty+Dresses+by+Nykaa+Fashion+Black+Floral+Off-Shoulder+Flared+Midi+Dress+%28XL%29+At+Nykaa+Fashion+-+Your+Online+Shopping&store=nykaa-fashion&storeName=Nykaa+Fashion
```

### Nykaa Now `(nykaa-now)`  · relay=Y

**Product**: Estée Lauder Estee Lauder Advanced Night Repair Synchronized Multi-Recovery Complex Serum

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A13287034559974930823%2Cproductid%3A14218123237412327036%2CheadlineOfferDocid%3A3302803344580535669%2CimageDocid%3A6189658904227754224%2Crds%3APC_8879731069276404180%7CPROD_PC_8879731069276404180%2Cgpcid%3A8879731069276404180%2Cmid%3A576462863716097919%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=929914db-be92-49d5-bb1e-9fa440367fed&title=Est%C3%A9e+Lauder+Estee+Lauder+Advanced+Night+Repair+Synchronized+Multi-Recovery+Complex+Serum&store=nykaa-now&storeName=Nykaa+Now
```

### Reliance Digital `(reliance-digital)`  · relay=Y

**Product**: IFB 24 L Solo Microwave Oven 24PM2B

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A3030328726220765754%2Cproductid%3A13219939698686938697%2CheadlineOfferDocid%3A8026324586294903223%2CimageDocid%3A5974476876549061223%2Crds%3APC_1185206182549732468%7CPROD_PC_1185206182549732468%2Cgpcid%3A1185206182549732468%2Cmid%3A576462473445408024%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=3c4541ea-c51d-457e-a2c0-fbc59b6df21e&title=IFB+24+L+Solo+Microwave+Oven+24PM2B&store=reliance-digital&storeName=Reliance+Digital
```

### Shopsy By Flipkart `(shopsy-by-flipkart)`  · relay=Y

**Product**: Leader Ultima Men's 26T Multispeed Mountain Bike

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A1485353697326702595%2Cproductid%3A38717288325533619%2CheadlineOfferDocid%3A10451928315339844645%2CimageDocid%3A14013825753385251103%2Crds%3APC_11538583026115703112%7CPROD_PC_11538583026115703112%2Cgpcid%3A11538583026115703112%2Cmid%3A576462846596363003%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=bc4f1966-7c92-4463-88e9-7c4b89dd7e4b&title=Leader+Ultima+Men%27s+26T+Multispeed+Mountain+Bike&store=shopsy-by-flipkart&storeName=Shopsy+By+Flipkart
```

### Tata CLiQ Fashion `(tata-cliq-fashion)`  · relay=Y

**Product**: Adidas Men's ULTRABOOST 5 Blue Running Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A16632302128985389708%2CheadlineOfferDocid%3A16632302128985389708%2CimageDocid%3A1869046070811404558%2Crds%3APC_6393005904272854479%7CPROD_PC_6393005904272854479%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=19b31a18-8648-42d3-83bc-7b77d47e5876&title=Adidas+Men%27s+ULTRABOOST+5+Blue+Running+Shoes&store=tata-cliq-fashion&storeName=Tata+CLiQ+Fashion
```

### TATA CLiQ LUXURY `(tata-cliq-luxury)`  · relay=Y

**Product**: Estée Lauder Estee Lauder Advanced Night Repair Synchronized Multi-Recovery Complex Serum

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A13287034559974930823%2Cproductid%3A14218123237412327036%2CheadlineOfferDocid%3A15629314304002692844%2CimageDocid%3A7679717493211868877%2Crds%3APC_8879731069276404180%7CPROD_PC_8879731069276404180%2Cgpcid%3A8879731069276404180%2Cmid%3A576462863716097919%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=576f6a6a-5ef5-4e66-ad94-6a965d62713d&title=Est%C3%A9e+Lauder+Estee+Lauder+Advanced+Night+Repair+Synchronized+Multi-Recovery+Complex+Serum&store=tata-cliq-luxury&storeName=TATA+CLiQ+LUXURY
```

### tatacliq.com `(tatacliq)`  · relay=Y

**Product**: Decathlon First Ball Unisex Orange My

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A1841483114582222424%2Cproductid%3A5116741363109926712%2CheadlineOfferDocid%3A2278678978979121338%2CimageDocid%3A4161661939583612929%2Crds%3APC_9998657498226180809%7CPROD_PC_9998657498226180809%2Cgpcid%3A9998657498226180809%2Cmid%3A576462777529094652%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=914d4c54-707d-4e38-84e9-0740750def6e&title=Decathlon+First+Ball+Unisex+Orange+My&store=tatacliq&storeName=tatacliq.com
```

### Techd Out `(techd-out)`  · relay=Y

**Product**: ASUS ROG Strix G16 Gaming Laptop Ryzen 9 8940HX

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A7585194736547627887%2CheadlineOfferDocid%3A2010125085541103887%2CimageDocid%3A18274521398719176429%2Crds%3APC_9723242893622302837%7CPROD_PC_9723242893622302837%2Cgpcid%3A9723242893622302837%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=a3f13e5a-eb8c-41d1-bcd2-b15dea7c991e&title=ASUS+ROG+Strix+G16+Gaming+Laptop+Ryzen+9+8940HX&store=techd-out&storeName=Techd+Out
```

### Vijay Sales `(vijay-sales)`  · relay=Y

**Product**: Marshall Acton III Bluetooth Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A6038331857120641839%2Cproductid%3A2202962378523408296%2CheadlineOfferDocid%3A13034333414523719520%2CimageDocid%3A4699686035659749925%2Crds%3APC_9139019815168676470%7CPROD_PC_9139019815168676470%2Cgpcid%3A9139019815168676470%2Cmid%3A576462749090078117%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=0026e395-c452-40c6-8d05-553e960ccf8a&title=Marshall+Acton+III+Bluetooth+Speaker&store=vijay-sales&storeName=Vijay+Sales
```

## ZA — 8 merchants

### Cash Converters `(cash-converters)`  · relay=Y

**Product**: Samsung Galaxy A26 5g - 128gb Rom + 6gb Ram - 6.7" -

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A4715441049120606172%2CheadlineOfferDocid%3A5061695521996620667%2CimageDocid%3A12069540276020907049%2Crds%3APC_17525312830161686849%7CPROD_PC_17525312830161686849%2Cgpcid%3A17525312830161686849%2Cmid%3A576462819951395787%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=c1dcbf57-e0de-4fff-9f92-0e33b3e79899&title=Samsung+Galaxy+A26+5g+-+128gb+Rom+%2B+6gb+Ram+-+6.7%22+-&store=cash-converters&storeName=Cash+Converters
```

### Makro `(makro)`  · relay=Y

**Product**: Steelseries Rival 3 Wireless Gen 2

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A17640866760703428306%2Cproductid%3A623749897345405356%2CheadlineOfferDocid%3A17643963065813670117%2CimageDocid%3A9656717558051550274%2Crds%3APC_6183535469545441820%7CPROD_PC_6183535469545441820%2Cgpcid%3A6183535469545441820%2Cmid%3A576462536297240924%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=62e1f7b2-47b0-43b1-b488-a677aa803070&title=Steelseries+Rival+3+Wireless+Gen+2&store=makro&storeName=Makro
```

### Outdoorphoto `(outdoorphoto)`  · relay=Y

**Product**: Sony Alpha a7S III Mirrorless Camera

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A16793874706101031714%2CheadlineOfferDocid%3A6596119548232185130%2CimageDocid%3A10316374914710808242%2Crds%3APC_12311187475786240649%7CPROD_PC_12311187475786240649%2Cgpcid%3A12311187475786240649%2Cmid%3A576462810452991317%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=b6ca35ac-4bb9-4b5f-a9e9-ee3b386a58c3&title=Sony+Alpha+a7S+III+Mirrorless+Camera&store=outdoorphoto&storeName=Outdoorphoto
```

### Pick n Pay Hypermarket `(pick-n-pay-hypermarket)`  · relay=Y

**Product**: Bennett Read Titan 15

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A5227826333503466753%2CheadlineOfferDocid%3A9165927376115287054%2CimageDocid%3A8471784162482870903%2Crds%3APC_5411986906568521724%7CPROD_PC_5411986906568521724%2Cgpcid%3A5411986906568521724%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=449a8cde-c97c-44e0-9277-ad8ca32337bb&title=Bennett+Read+Titan+15&store=pick-n-pay-hypermarket&storeName=Pick+n+Pay+Hypermarket
```

### Sportsmans Warehouse `(sportsmans-warehouse)`  · relay=Y

**Product**: Nike One Classic Women's Dri-Fit Long-Sleeve Top

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A12221835702775997708%2CheadlineOfferDocid%3A7464389569346140113%2CimageDocid%3A12462015304781928167%2Crds%3APC_3946845177096449633%7CPROD_PC_3946845177096449633%2Cgpcid%3A3946845177096449633%2Cmid%3A576462770417223335%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=5947ac23-1c0e-4933-883c-3a9985bff20f&title=Nike+One+Classic+Women%27s+Dri-Fit+Long-Sleeve+Top&store=sportsmans-warehouse&storeName=Sportsmans+Warehouse
```

### Superbalist `(superbalist)`  · relay=Y

**Product**: Medicube PDRN Pink Collagen Gel Mask

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A9488313663828525011%2Cproductid%3A16356691713346005048%2CheadlineOfferDocid%3A10678617688476061067%2CimageDocid%3A7029769065510079926%2Crds%3APC_16463572459942238154%7CPROD_PC_16463572459942238154%2Cgpcid%3A16463572459942238154%2Cmid%3A576462782042345370%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=a3eb2e79-fead-456f-9133-e364ff4405d5&title=Medicube+PDRN+Pink+Collagen+Gel+Mask&store=superbalist&storeName=Superbalist
```

### takealot.com `(takealot)`  · relay=Y

**Product**: Hisense 6kg Grey Front Loader Washing Machine wfvc6010t

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A3526461501547210272%2Cproductid%3A17210723455072239240%2CheadlineOfferDocid%3A8120652385579287579%2CimageDocid%3A4949603286282736021%2Crds%3APC_10096863215109202809%7CPROD_PC_10096863215109202809%2Cgpcid%3A10096863215109202809%2Cmid%3A576462732067182677%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=7936a32d-b4bf-4ab5-97c0-01dc51a34a7a&title=Hisense+6kg+Grey+Front+Loader+Washing+Machine+wfvc6010t&store=takealot&storeName=takealot.com
```

### Yuppiechef `(yuppiechef)`  · relay=Y

**Product**: Philips 2000 Series Bagless Vacuum Cleaner XB2023/02

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A4573430929687675963%2Cproductid%3A3548877003630513694%2CheadlineOfferDocid%3A12567805313699785683%2CimageDocid%3A12364646574258280523%2Crds%3APC_18194339111130931132%7CPROD_PC_18194339111130931132%2Cgpcid%3A18194339111130931132%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=2df00cb0-31c8-45c6-a5be-c4db6ba4c08d&title=Philips+2000+Series+Bagless+Vacuum+Cleaner+XB2023%2F02&store=yuppiechef&storeName=Yuppiechef
```

## Cross-border — 603 merchants

### 32 Degrees `(32-degrees)`  · relay=Y

**Product**: 32 Degrees Women's Pants 32 Degrees s

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A10287418015632974532%2Cproductid%3A1667209272224198047%2CheadlineOfferDocid%3A13963929500870001782%2CimageDocid%3A5101793167652781202%2Crds%3APC_561510548594735406%7CPROD_PC_561510548594735406%2Cgpcid%3A561510548594735406%2Cmid%3A576462564764516114%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=38caf1e0-592d-4f96-a44b-d468391455fa&title=32+Degrees+Women%27s+Pants+32+Degrees+s&store=32-degrees&storeName=32+Degrees
```

### 4Home.co.za `(4home)`  · relay=Y

**Product**: Mellerware Clothes Dryer 23700A

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A15850618778653162954%2Cproductid%3A16702331471173717346%2CheadlineOfferDocid%3A12544885165161997457%2CimageDocid%3A15756565567193843487%2Crds%3APC_14982008572255672401%7CPROD_PC_14982008572255672401%2Cgpcid%3A14982008572255672401%2Cmid%3A576462348932188982%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=beaa827a-8554-4525-9522-171e667beaab&title=Mellerware+Clothes+Dryer+23700A&store=4home&storeName=4Home.co.za
```

### 6pm.com `(6pm)`  · relay=Y

**Product**: Crocs Classic Clog Clog Shoes Nightshade : Men's 4 - Women's 6 Medium

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCrocs+Classic+Clog+deals%26prds%3Dproductid%3A13529592141510680645%2CheadlineOfferDocid%3A13529592141510680645%2CimageDocid%3A6047642291194469519%2Crds%3APC_5803906498614987482%7CPROD_PC_5803906498614987482%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=e847ea18-5a1d-479d-a8c4-66b6daa3bcb4&title=Crocs+Classic+Clog+Clog+Shoes+Nightshade+%3A+Men%27s+4+-+Women%27s+6+Medium&store=6pm&storeName=6pm.com
```

### 93mobiles `(93mobiles)`  · relay=Y

**Product**: Oppo Reno14 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A13627511332714750024%2Cproductid%3A2692285625986056595%2CheadlineOfferDocid%3A367474675123681689%2CimageDocid%3A1897774085805033063%2Crds%3APC_4740669652361733114%7CPROD_PC_4740669652361733114%2Cgpcid%3A4740669652361733114%2Cmid%3A576462843069152218%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=ee273d2f-27ae-43dc-b834-0457c6264a23&title=Oppo+Reno14+5G&store=93mobiles&storeName=93mobiles
```

### A1 Tech Deals `(a1-tech-deals)`  · relay=Y

**Product**: JBL Charge 5 Portable Bluetooth Speaker Waterproof

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DJBL+Charge+5+deals%26prds%3Dcatalogid%3A9722994870415013740%2Cproductid%3A4367363379430204449%2CheadlineOfferDocid%3A691009892516253269%2CimageDocid%3A8403503670682588997%2Crds%3APC_11537432482986069177%7CPROD_PC_11537432482986069177%2Cgpcid%3A11537432482986069177%2Cmid%3A576462617578544008%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=2b1deee9-0463-43e3-a38e-67eb4c23ba0a&title=JBL+Charge+5+Portable+Bluetooth+Speaker+Waterproof&store=a1-tech-deals&storeName=A1+Tech+Deals
```

### Abercrombie & Fitch `(abercrombie-fitch)`  · relay=Y

**Product**: Abercrombie & Fitch Women's Sunday Off-The-Shoulder Top

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A423610119297365425%2Cproductid%3A8677842085500261488%2CheadlineOfferDocid%3A4485590306083770857%2CimageDocid%3A6629145144328379262%2Crds%3APC_14895576000281030253%7CPROD_PC_14895576000281030253%2Cgpcid%3A14895576000281030253%2Cmid%3A576462889943121102%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=2b107b99-906c-4221-a8bd-1729f764c1d0&title=Abercrombie+%26+Fitch+Women%27s+Sunday+Off-The-Shoulder+Top&store=abercrombie-fitch&storeName=Abercrombie+%26+Fitch
```

### ABOUT YOU `(about-you)`  · relay=Y

**Product**: Ragwear Yodis Zipup sweatshirt Women's

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A3088156435241321759%2Cproductid%3A4004803626942487230%2CheadlineOfferDocid%3A11517534396453048808%2CimageDocid%3A5754555850078851659%2Crds%3APC_14265546312344656411%7CPROD_PC_14265546312344656411%2Cgpcid%3A14265546312344656411%2Cmid%3A576462884833764635%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=25c6994d-0df7-4a36-954f-c82f78807b34&title=Ragwear+Yodis+Zipup+sweatshirt+Women%27s&store=about-you&storeName=ABOUT+YOU
```

### Academy Sports + Outdoors `(academy-sports-outdoors)`  · relay=Y

**Product**: adidas Women's Galaxy 7 Running Shoes White - Men's Running at Academy Sports

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A10990001884399095926%2CheadlineOfferDocid%3A10990001884399095926%2CimageDocid%3A14220021126914708919%2Crds%3APC_16482313695981031853%7CPROD_PC_16482313695981031853%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=0a73c31f-616c-4003-a55d-bc0637c95e1a&title=adidas+Women%27s+Galaxy+7+Running+Shoes+White+-+Men%27s+Running+at+Academy+Sports&store=academy-sports-outdoors&storeName=Academy+Sports+%2B+Outdoors
```

### Accessorize `(accessorize)`  · relay=Y

**Product**: Molten Stainless Steel Pendant Necklace

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A7370095766254917733%2Cproductid%3A4865886249240221878%2CheadlineOfferDocid%3A15613057093274328519%2CimageDocid%3A13068050017420698337%2Cgpcid%3A5982650030754535187%2Cmid%3A576462888268338881%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=0934e1c5-ef29-4af8-86c8-8aed376075cb&title=Molten+Stainless+Steel+Pendant+Necklace&store=accessorize&storeName=Accessorize
```

### Acer Store UK `(acer-store-uk)`  · relay=Y

**Product**: Acer Nitro V 16 AI 16′′ Gaming Laptop – AMD Ryzen 7

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A14839154450126812188%2Cproductid%3A14786275892306894176%2CheadlineOfferDocid%3A9063922944991425882%2CimageDocid%3A10665393160433688146%2Crds%3APC_7655555427952750056%7CPROD_PC_7655555427952750056%2Cgpcid%3A7655555427952750056%2Cmid%3A576462538095045109%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=6d969521-f9e5-48ed-9d08-b59e8a204fe9&title=Acer+Nitro+V+16+AI+16%E2%80%B2%E2%80%B2+Gaming+Laptop+%E2%80%93+AMD+Ryzen+7&store=acer-store-uk&storeName=Acer+Store+UK
```

### Acoustic Audio `(acoustic-audio)`  · relay=Y

**Product**: Alpine 2-Channel BBX-t600 BBX Series Class A/B Amplifier

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A15850823026475682422%2Cproductid%3A12630855753121036562%2CheadlineOfferDocid%3A6600076249650861494%2CimageDocid%3A1481330408563895630%2Crds%3APC_18290647887897751423%7CPROD_PC_18290647887897751423%2Cgpcid%3A18290647887897751423%2Cmid%3A576462681738478853%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=0fc44fad-d686-4868-9107-dd5fc3ad1feb&title=Alpine+2-Channel+BBX-t600+BBX+Series+Class+A%2FB+Amplifier&store=acoustic-audio&storeName=Acoustic+Audio
```

### addmecart `(addmecart)`  · relay=Y

**Product**: Motorola G85 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A11527692613255812279%2Cproductid%3A18031334160651450983%2CheadlineOfferDocid%3A4616725191093953802%2CimageDocid%3A393223290294501833%2Crds%3APC_4744101912857324683%7CPROD_PC_4744101912857324683%2Cgpcid%3A17004138255672030864%2Cmid%3A576462776468286483%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=bc4cc1ed-09dc-4767-95e2-37cdc8500dde&title=Motorola+G85+5G&store=addmecart&storeName=addmecart
```

### Adorama `(adorama)`  · relay=Y

**Product**: Bose QuietComfort Ultra Noise Wireless Cancelling Headphones

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBose+QuietComfort+Ultra+deals%26prds%3Dcatalogid%3A17107834626059385781%2Cproductid%3A8599227326442885371%2CheadlineOfferDocid%3A5395159487091352063%2CimageDocid%3A16427648686192093799%2Crds%3APC_5914059237801924898%7CPROD_PC_5914059237801924898%2Cgpcid%3A5914059237801924898%2Cmid%3A576462770299523973%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7c9dbaed-4815-4568-9dd4-4540d7c43a8b&title=Bose+QuietComfort+Ultra+Noise+Wireless+Cancelling+Headphones&store=adorama&storeName=Adorama
```

### ADS Store `(ads-store)`  · relay=Y

**Product**: Ant Esports RX550 Gaming Power Supply

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A13040505483519617506%2Cproductid%3A11326610318610448408%2CheadlineOfferDocid%3A16136089222608514739%2CimageDocid%3A18417484164586877771%2Cgpcid%3A10130237933579557976%2Cmid%3A576462851182687818%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=2553e6be-cbae-488a-9178-19f5ce7187ad&title=Ant+Esports+RX550+Gaming+Power+Supply&store=ads-store&storeName=ADS+Store
```

### Agamya Store `(agamya-store)`  · relay=Y

**Product**: 4 Burner Glass Gas Stove CT1040GTXLHFBBBL

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A9401104955975885553%2Cproductid%3A15946173318678318173%2CheadlineOfferDocid%3A14096305580477694326%2CimageDocid%3A5386730408603238808%2Cgpcid%3A4522948346283819790%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=c9a68070-3ffd-4296-b737-895d05e0de13&title=4+Burner+Glass+Gas+Stove+CT1040GTXLHFBBBL&store=agamya-store&storeName=Agamya+Store
```

### AHM Online `(ahm-online)`  · relay=Y

**Product**: Alva 3 Panel Gas Heater

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A8337882910647711482%2Cproductid%3A7485517034484199158%2CheadlineOfferDocid%3A12197317674148995722%2CimageDocid%3A3370807161464833393%2Crds%3APC_16263613619985335092%7CPROD_PC_16263613619985335092%2Cgpcid%3A16263613619985335092%2Cmid%3A576462840989188264%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=6803e18b-0fca-4fcd-a7c1-40d60fd0a6f1&title=Alva+3+Panel+Gas+Heater&store=ahm-online&storeName=AHM+Online
```

### AiO `(aio)`  · relay=Y

**Product**: Candy COT1S45EW hladilnik

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A12635737769780298170%2Cproductid%3A873543901375005764%2CheadlineOfferDocid%3A5238087376348637458%2CimageDocid%3A11214365452858658778%2Crds%3APC_7002251698673721485%7CPROD_PC_7002251698673721485%2Cgpcid%3A7002251698673721485%2Cmid%3A576462728253005886%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=36a134d6-6df4-4c32-83b4-4d69ac0eda1b&title=Candy+COT1S45EW+hladilnik&store=aio&storeName=AiO
```

### Al's Sporting Goods `(al-s-sporting-goods)`  · relay=Y

**Product**: TravisMathew Men's The Heater Polo

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A9862850981607912717%2Cproductid%3A16979222443882499796%2CheadlineOfferDocid%3A5127432220073098357%2CimageDocid%3A15802710304333166286%2Crds%3APC_12716605003857190511%7CPROD_PC_12716605003857190511%2Cgpcid%3A12716605003857190511%2Cmid%3A576462777364898653%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=b807be9d-a60f-444b-b3f1-cfefe7934837&title=TravisMathew+Men%27s+The+Heater+Polo&store=al-s-sporting-goods&storeName=Al%27s+Sporting+Goods
```

### Albert Lee `(albert-lee)`  · relay=Y

**Product**: KitchenAid 30" Stainless Steel Slide In Electric Convection Range kseb900ess

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A16890423851806215992%2Cproductid%3A8625324013338251035%2CheadlineOfferDocid%3A2576417652093594921%2CimageDocid%3A14090848771277923940%2Crds%3APC_5100985988427701795%7CPROD_PC_5100985988427701795%2Cgpcid%3A5100985988427701795%2Cmid%3A576462543660809092%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=4f350bf2-bfa0-44e6-8931-2c2072847534&title=KitchenAid+30%22+Stainless+Steel+Slide+In+Electric+Convection+Range+kseb900ess&store=albert-lee&storeName=Albert+Lee
```

### aldoshoes.co.uk `(aldoshoes)`  · relay=Y

**Product**: Aldo Women's Lothycan Satchel Bag

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A15700990103118355990%2Cproductid%3A10696100139666974065%2CheadlineOfferDocid%3A5999067309182243639%2CimageDocid%3A4218648206699229504%2Crds%3APC_14578106334830580386%7CPROD_PC_14578106334830580386%2Cgpcid%3A14578106334830580386%2Cmid%3A576462877349853750%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=02f3f1ae-1e71-4d1b-8db5-cefa8b74131b&title=Aldo+Women%27s+Lothycan+Satchel+Bag&store=aldoshoes&storeName=aldoshoes.co.uk
```

### alGadgets General Trading `(algadgets-general-trading)`  · relay=Y

**Product**: Sony PlayStation 5 Standard Console with Fortnite Bundle

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A11911727868387379589%2Cproductid%3A12114342903113981530%2CheadlineOfferDocid%3A12532904779921905762%2CimageDocid%3A489847592534644351%2Crds%3APC_10252959786065141094%7CPROD_PC_10252959786065141094%2Cgpcid%3A10252959786065141094%2Cmid%3A576462473330202839%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=bb2a5234-a46a-4f2e-9022-8baa1b0300bd&title=Sony+PlayStation+5+Standard+Console+with+Fortnite+Bundle&store=algadgets-general-trading&storeName=alGadgets+General+Trading
```

### alibaba.com `(alibaba)`  · relay=Y

**Product**: Good Quality Camon 30 Pro 5G Android 13 Smartphone Deca Core 7.3\

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DTecno+Camon+30+deals%26prds%3Dproductid%3A12498348830849991464%2CheadlineOfferDocid%3A12498348830849991464%2CimageDocid%3A4310376520830153800%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=6cb64ff8-6640-450a-b250-81cdcea26e1d&title=Good+Quality+Camon+30+Pro+5G+Android+13+Smartphone+Deca+Core+7.3%5C&store=alibaba&storeName=alibaba.com
```

### AliExpress `(aliexpress)`  · relay=N

**Product**: Patch Exercise Board Kit Welding  Electrical And Electronic Technology School Training Competition

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fs.click.aliexpress.com%2Fs%2FNdpwztbAIgDMmxGbP8fFks7yUFfsHjzlImSYmA68h7xlMRgzueFsRgokQ9f9hcpVKttxtQE2VzIoqkXJXrpOr6uR3zv7mP4CDO9CddoFf4t0QE5DXPy8Pgjhz4irfQSEjEGUmy5yF3A5gJ9h3NYjLMgqIMqa3zcpq5E2BC3W5EbV40Dm9buQxWpZzw1lbX8Zm2kZtNIa4KyDieNjsH7IU6Yv8StELKVvT9r4eFAaXPGhwHsgaDqdNcmY116r3GC2YvsOopeiiZPhJrV0cwgOQDSkW93v7gVKDqPkXyZF1oSWa6wSAOeznMFVlVZbxG9Pdnkktr9LFA5n3C4604RizQsuHeHfaUdnQlUOMd4N7af7v9v2c5FixYKTqQN2cvYC6MvC7xV0eoGQpduR28X742LC3CRCGP1om535LaOx89OFwsUrrN1StC1tJvotrzpuAH6vKkUvufw4UUpndIASu7Facf8Ztq3a1iny6xcZk9rjZ3Dtt0JF8EuoGN5pFKe1zvt7sVt84F4L3R7ilQRbdW5tyXLA0V4Gw2my6h3njD8XsfrW2Ri9gMoMM1sa9aWY6b0r6qU5nQIbOBUgBPYt8kvxsqrQoBOqOkSMnU2w1qxZR2ZTPInI8MfEZ0LUgTfpxgx2LAEjBVinoOM490ZJTfIHK6BKXWtNHJpAAIOUaIFvTBCIF2XOi4k9ZqLJ5VUthmjwfTeDOVZLI8HxZ5paH0RTFoAOr4dnoReYzd0PEpJTPQI3KUCGzV3Mao9Y41At4urvxq8x8ajRfLjd4ev6KDWT1TIl1WaLOpqsFH9pAQSknQxDWGpPro4ePiUd1xrr30SAIHdlC40NZUbXn8I0srPSj1Cfhs0hXGi6TYyfe2mGpy1vwrfCy856aFK50izJt9fsF6s8ePGEUd2aFqOaPox547G41yYGtUEvNrQDN2Mf5gZ1ToG7yuOruFSmyrWTA14oORoqNvZuNlzmYguJlTJsJtVKX5g0657M28wwPsxTz&id=48c87cce-cd02-4f82-ab02-1b44f419191a&title=Patch+Exercise+Board+Kit+Welding++Electrical+And+Electronic+Technology+School+Training+Competition&store=aliexpress&storeName=AliExpress
```

### allbeauty.com `(allbeauty)`  · relay=Y

**Product**: Benefit Game Set Bounce Mascara and Brow Stocking Filler Gift Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A7570491943400208416%2Cproductid%3A11104218405833353689%2CheadlineOfferDocid%3A1222554168748469016%2CimageDocid%3A3250820445369226497%2Crds%3APC_8067307139116333154%7CPROD_PC_8067307139116333154%2Cgpcid%3A8067307139116333154%2Cmid%3A576462841269826792%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=e4696bbb-8520-4bef-a92d-757be01d1f48&title=Benefit+Game+Set+Bounce+Mascara+and+Brow+Stocking+Filler+Gift+Set&store=allbeauty&storeName=allbeauty.com
```

### Alp It Solutions `(alp-it-solutions)`  · relay=Y

**Product**: Redragon K617 FIZZ 60% Wired RGB Gaming Keyboard

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A2914596089812720410%2CheadlineOfferDocid%3A17710524880879843233%2CimageDocid%3A612727799508779212%2Crds%3APC_5688575748631561834%7CPROD_PC_5688575748631561834%2Cgpcid%3A5688575748631561834%2Cmid%3A576462782189902904%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=5052bf8a-9525-43c6-bad6-9c6c04790f82&title=Redragon+K617+FIZZ+60%25+Wired+RGB+Gaming+Keyboard&store=alp-it-solutions&storeName=Alp+It+Solutions
```

### Amazon `(amazon)`  · relay=Y

**Product**: JVC - Drvn Dr Series 6 X 9 4-Way Speakers Pair - Black - CS-DR6941 - 046838079795

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A17215457792386606557%2Cproductid%3A3870616289487349889%2CheadlineOfferDocid%3A12716436692705937363%2CimageDocid%3A14211988495843327414%2Crds%3APC_9174921945884727921%7CPROD_PC_9174921945884727921%2Cgpcid%3A9174921945884727921%2Cmid%3A576462592223184874%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=0603ad01-8b17-4fdd-a12a-e0259f60ba7d&title=JVC+-+Drvn+Dr+Series+6+X+9+4-Way+Speakers+Pair+-+Black+-+CS-DR6941+-+046838079795&store=amazon&storeName=Amazon
```

### Amazon Germany `(amazon-germany)`  · relay=Y

**Product**: J.VER Männer Hemd Unifarben Stretch Langarm Männer Hemden Regular Fit Herrenhemden Freizeithemden Bügelleichtes Businesshemd Anzug Hemd

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A17806659735089413243%2Cproductid%3A1612489263310612227%2CheadlineOfferDocid%3A9497830632611822683%2CimageDocid%3A3050153226959239168%2Cgpcid%3A14577289213000362603%2Cmid%3A576462901756374089%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=469e80a7-ade0-40c0-a9d4-dd878fd889f0&title=J.VER+M%C3%A4nner+Hemd+Unifarben+Stretch+Langarm+M%C3%A4nner+Hemden+Regular+Fit+Herrenhemden+Freizeithemden+B%C3%BCgelleichtes+Business&store=amazon-germany&storeName=Amazon+Germany
```

### Amazon UAE `(amazon-uae)`  · relay=Y

**Product**: Karaoke Machine For Kids/Adults, Portable Bluetooth PA Speaker System With 2 Wireless Microphones For Home, Party, Metting, Dynamic LED Lights,

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A441084175085548934%2CheadlineOfferDocid%3A441084175085548934%2CimageDocid%3A1634630242427177270%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=8a6062fc-0af9-4e8d-8419-165ce3479026&title=Karaoke+Machine+For+Kids%2FAdults%2C+Portable+Bluetooth+PA+Speaker+System+With+2+Wireless+Microphones+For+Home%2C+Party%2C+Metti&store=amazon-uae&storeName=Amazon+UAE
```

### Amazon.co.za - Seller `(amazon-co-za-seller)`  · relay=Y

**Product**: Genius Solutions Wireless USB-C to 1080P HDMI Dongle

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A1559794688148059086%2Cproductid%3A8337230074724476285%2CheadlineOfferDocid%3A2688723127513440870%2CimageDocid%3A3724363086135115222%2Cgpcid%3A11437572266986722313%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=71ea8cbd-c9ea-472d-8702-5c904658a946&title=Genius+Solutions+Wireless+USB-C+to+1080P+HDMI+Dongle&store=amazon-co-za-seller&storeName=Amazon.co.za+-+Seller
```

### Ambrose Wilson `(ambrose-wilson)`  · relay=Y

**Product**: Fine Plisse Soft Shirt Blue Fine Plisse Soft Shirt

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A8453916471159189948%2CheadlineOfferDocid%3A8453916471159189948%2CimageDocid%3A11485938648147995192%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=dc187152-d16a-40e6-8299-ad21ec4b8a21&title=Fine+Plisse+Soft+Shirt+Blue+Fine+Plisse+Soft+Shirt&store=ambrose-wilson&storeName=Ambrose+Wilson
```

### American Eagle Outfitters `(american-eagle-outfitters)`  · relay=Y

**Product**: AE Lace-Up Sweater Women's

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A7413917049056799209%2Cproductid%3A1668216989095722539%2CheadlineOfferDocid%3A8563238441164335048%2CimageDocid%3A17662827681398050843%2Crds%3APC_15715611937651821821%7CPROD_PC_15715611937651821821%2Cgpcid%3A15715611937651821821%2Cmid%3A576462537647530782%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=3cea8702-0328-40d3-9f3c-059e938ca192&title=AE+Lace-Up+Sweater+Women%27s&store=american-eagle-outfitters&storeName=American+Eagle+Outfitters
```

### AND `(and)`  · relay=Y

**Product**: Myntra Aviva Short Wine Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A5950517492216066841%2Cproductid%3A12178027304911554539%2CheadlineOfferDocid%3A10051921951657565649%2CimageDocid%3A16966173331248100784%2Cgpcid%3A6378163839605486470%2Cmid%3A576462549870101322%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=4df02a59-a068-44f1-a54c-5c3b7ec2d60f&title=Myntra+Aviva+Short+Wine+Dress&store=and&storeName=AND
```

### Andertons Music Co `(andertons-music-co)`  · relay=Y

**Product**: Universal Audio Galaxy Tape Echo

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A1597607379860703305%2CheadlineOfferDocid%3A1597607379860703305%2CimageDocid%3A11267717301011930493%2Crds%3APC_9930302966965682925%7CPROD_PC_9930302966965682925%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=fada5554-3826-46b1-b8cd-71d5012d4d4d&title=Universal+Audio+Galaxy+Tape+Echo&store=andertons-music-co&storeName=Andertons+Music+Co
```

### Ant Esports `(ant-esports)`  · relay=Y

**Product**: Ant Esports KM500 Gaming Keyboard and Mouse Combo

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A17863879093021784892%2Cproductid%3A1173871449433363353%2CheadlineOfferDocid%3A9011323076992869079%2CimageDocid%3A9158650441709990598%2Cgpcid%3A1459753166210964920%2Cmid%3A576462737759709651%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=d1350d45-1bee-4c67-b960-9d5b11fd9804&title=Ant+Esports+KM500+Gaming+Keyboard+and+Mouse+Combo&store=ant-esports&storeName=Ant+Esports
```

### anthropologie.com `(anthropologie)`  · relay=Y

**Product**: Sony WF-1000XM5 Truly Wireless Noise Canceling Earbuds (Black)

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSony+WH-1000XM5+deals%26prds%3Dproductid%3A14487962145865142996%2CheadlineOfferDocid%3A14487962145865142996%2CimageDocid%3A8209429197925232003%2Crds%3APC_7907558882611966406%7CPROD_PC_7907558882611966406%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=dbb45aa8-a02c-4fee-9550-6a308a90ead0&title=Sony+WF-1000XM5+Truly+Wireless+Noise+Canceling+Earbuds+%28Black%29&store=anthropologie&storeName=anthropologie.com
```

### Apex Gaming PCs `(apex-gaming-pcs)`  · relay=Y

**Product**: Apex Render H

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A5116897636623700908%2Cproductid%3A1040245474844832825%2CheadlineOfferDocid%3A4377723646671479611%2CimageDocid%3A9491556801448969353%2Cgpcid%3A17699571933119755531%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=2e8e7cde-e1e0-4e7c-bd05-00898aa4bd08&title=Apex+Render+H&store=apex-gaming-pcs&storeName=Apex+Gaming+PCs
```

### Apollo247 `(apollo247)`  · relay=Y

**Product**: Wellbeing Nutrition Vegan Iron Supplement with Folic Acid

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A897424283195072827%2Cproductid%3A7833685805146383220%2CheadlineOfferDocid%3A2697403538329836703%2CimageDocid%3A13087263574730233713%2Crds%3APC_5529658099036807134%7CPROD_PC_5529658099036807134%2Cgpcid%3A5529658099036807134%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=60708912-2119-4bc9-b02e-e889991043fc&title=Wellbeing+Nutrition+Vegan+Iron+Supplement+with+Folic+Acid&store=apollo247&storeName=Apollo247
```

### Appliance City `(appliance-city)`  · relay=Y

**Product**: Samsung Series 7 SpaceMax Fridge Freezer RS70F66KCFEU

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A1976080201439034892%2Cproductid%3A5739513380700444681%2CheadlineOfferDocid%3A1047624815348331172%2CimageDocid%3A13023396477476324109%2Crds%3APC_4387966487359755240%7CPROD_PC_4387966487359755240%2Cgpcid%3A4387966487359755240%2Cmid%3A576462860644619828%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=56d562e2-d7c6-4efb-afcc-cb095638ecb0&title=Samsung+Series+7+SpaceMax+Fridge+Freezer+RS70F66KCFEU&store=appliance-city&storeName=Appliance+City
```

### Appliance Warehouse `(appliance-warehouse)`  · relay=Y

**Product**: Mellerware Kettle Corded Plastic 1.7L 2200W Tugela

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A16757224734656772415%2Cproductid%3A18024852738386172046%2CheadlineOfferDocid%3A12273568796394477039%2CimageDocid%3A9202827330065548014%2Cgpcid%3A2974051018486706488%2Cmid%3A576462842929814429%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=495d9544-f2af-4ddf-b872-0d977dfb1fd1&title=Mellerware+Kettle+Corded+Plastic+1.7L+2200W+Tugela&store=appliance-warehouse&storeName=Appliance+Warehouse
```

### Appliances Direct `(appliances-direct)`  · relay=Y

**Product**: BEKO GN14790PX Fridge Freezer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A10352230553488034447%2Cproductid%3A8110861293487614186%2CheadlineOfferDocid%3A7167212426586679697%2CimageDocid%3A15045393513463598804%2Crds%3APC_9806526519076166256%7CPROD_PC_9806526519076166256%2Cgpcid%3A9806526519076166256%2Cmid%3A576462762475970439%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=ff98d5e9-343a-415a-bf19-c62ca48262b4&title=BEKO+GN14790PX+Fridge+Freezer&store=appliances-direct&storeName=Appliances+Direct
```

### Apricot `(apricot)`  · relay=Y

**Product**: Apricot Women's Side Ruched Textured Jersey Top

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A3313733261631045145%2Cproductid%3A14241608236950913088%2CheadlineOfferDocid%3A16507221141518280333%2CimageDocid%3A13630968354117173571%2Cgpcid%3A17145961041501982065%2Cmid%3A576462531115007356%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=5e0bbfc7-404b-472e-a54c-5083f40b3489&title=Apricot+Women%27s+Side+Ruched+Textured+Jersey+Top&store=apricot&storeName=Apricot
```

### Art of Living UK `(art-of-living-uk)`  · relay=Y

**Product**: Le Creuset Signature Cast Iron Risotto Pan

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLe+Creuset+Dutch+Oven+deals%26prds%3Dcatalogid%3A9138828571410289496%2Cproductid%3A11498158787373085197%2CheadlineOfferDocid%3A9057284187728924438%2CimageDocid%3A17241269005749842286%2Crds%3APC_1229327192229240896%7CPROD_PC_1229327192229240896%2Cgpcid%3A1229327192229240896%2Cmid%3A576462551052989314%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=453a180c-3c44-4b44-acec-a2dc6f212ccf&title=Le+Creuset+Signature+Cast+Iron+Risotto+Pan&store=art-of-living-uk&storeName=Art+of+Living+UK
```

### Asda George `(asda-george)`  · relay=Y

**Product**: Ninja CREAMi nc300uk Ice Cream & Frozen Dessert Maker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A9119089174144761560%2Cproductid%3A816365238477251612%2CheadlineOfferDocid%3A9060114344196103094%2CimageDocid%3A6768316662650001615%2Crds%3APC_7426105398999959468%7CPROD_PC_7426105398999959468%2Cgpcid%3A7426105398999959468%2Cmid%3A576462660166080459%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=e80018db-91b4-44e3-9156-070c7b8c300b&title=Ninja+CREAMi+nc300uk+Ice+Cream+%26+Frozen+Dessert+Maker&store=asda-george&storeName=Asda+George
```

### Asda Groceries `(asda-groceries)`  · relay=Y

**Product**: Shark Lift Away Upright Vacuum Cleaner nv602uk

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A3599068838437004968%2Cproductid%3A16511465935205968217%2CheadlineOfferDocid%3A13004585601342362182%2CimageDocid%3A3666443314578435188%2Crds%3APC_14903560397102938026%7CPROD_PC_14903560397102938026%2Cgpcid%3A14903560397102938026%2Cmid%3A576462861839709433%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=c7d9a628-5c96-4168-84f8-4c9c0e110eaa&title=Shark+Lift+Away+Upright+Vacuum+Cleaner+nv602uk&store=asda-groceries&storeName=Asda+Groceries
```

### Asda mobile `(asda-mobile)`  · relay=Y

**Product**: Samsung-Z Fold7-Asda mobile

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dproductid%3A17793702458969503885%2CheadlineOfferDocid%3A17793702458969503885%2CimageDocid%3A7153803143424472039%2Crds%3APC_16337891081947337161%7CPROD_PC_16337891081947337161%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=84595e8e-700e-4342-be2c-c5e36b204c7a&title=Samsung-Z+Fold7-Asda+mobile&store=asda-mobile&storeName=Asda+mobile
```

### ASICS `(asics)`  · relay=Y

**Product**: ASICS Men's Netburner Ballistic FF MT 4 Volleyball Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A8695356117129347436%2Cproductid%3A6265804056417780866%2CheadlineOfferDocid%3A17368382497866288370%2CimageDocid%3A14893066894435154846%2Crds%3APC_3020014741274613695%7CPROD_PC_3020014741274613695%2Cgpcid%3A3020014741274613695%2Cmid%3A576462886509710491%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=2c1fa012-dc70-4fc2-93b7-b9c03ba01701&title=ASICS+Men%27s+Netburner+Ballistic+FF+MT+4+Volleyball+Shoes&store=asics&storeName=ASICS
```

### asomanutritions.in `(asomanutritions-in)`  · relay=Y

**Product**: MuscleBlaze Whey Performance Protein

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A12765841562282683788%2Cproductid%3A2968713530406446874%2CheadlineOfferDocid%3A2437150823401732000%2CimageDocid%3A4551619413787478064%2Crds%3APC_9665286849592835791%7CPROD_PC_9665286849592835791%2Cgpcid%3A9665286849592835791%2Cmid%3A576462807121734362%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=4739fd68-a8c5-4097-ba43-a7092aa37897&title=MuscleBlaze+Whey+Performance+Protein&store=asomanutritions-in&storeName=asomanutritions.in
```

### ASUS eshop IN `(asus-eshop-in)`  · relay=Y

**Product**: Asus ROG Strix G16 Gaming Laptop

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A4415669109015162300%2Cproductid%3A3639144219713322419%2CheadlineOfferDocid%3A12266093304343287794%2CimageDocid%3A18032327710023975013%2Cgpcid%3A9118040513480444362%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=2b63c013-430b-4b70-a150-f5a718dc6871&title=Asus+ROG+Strix+G16+Gaming+Laptop&store=asus-eshop-in&storeName=ASUS+eshop+IN
```

### ASUS Store UK `(asus-store-uk)`  · relay=Y

**Product**: ASUS TUF Gaming A16 FA607NUG-RL116W AMD Ryzen 7 7445HS 16GB 512GB SSD Laptop

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A6538633668328244816%2Cproductid%3A12867837178328869416%2CheadlineOfferDocid%3A8737344121109360437%2CimageDocid%3A2091962876026691614%2Crds%3APC_3461609241484929821%7CPROD_PC_3461609241484929821%2Cgpcid%3A7621554817767967565%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=00f37a8d-c7f4-4a7e-930b-e6a1b75f1d05&title=ASUS+TUF+Gaming+A16+FA607NUG-RL116W+AMD+Ryzen+7+7445HS+16GB+512GB+SSD+Laptop&store=asus-store-uk&storeName=ASUS+Store+UK
```

### Audico Online `(audico-online)`  · relay=Y

**Product**: Bowers Wilkins Pi6 True Wireless Ear Earbuds

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A6240589034040551966%2Cproductid%3A13662373366509659333%2CheadlineOfferDocid%3A8375742622605746701%2CimageDocid%3A18017546102850962392%2Crds%3APC_3289851067451575047%7CPROD_PC_3289851067451575047%2Cgpcid%3A3289851067451575047%2Cmid%3A576462788270478824%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=7ad8ca25-0b55-4cc9-8a1c-967cef4599a1&title=Bowers+Wilkins+Pi6+True+Wireless+Ear+Earbuds&store=audico-online&storeName=Audico+Online
```

### Audio Advice `(audio-advice)`  · relay=Y

**Product**: KEF Q1 Meta - HiFi Speaker - Compact High-end Bookshelf Speaker - Satin Black - Premium Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A3110122355644030167%2Cproductid%3A3228511454013285515%2CheadlineOfferDocid%3A12710413671807985030%2CimageDocid%3A9618729493646729626%2Crds%3APC_11036241274534560214%7CPROD_PC_11036241274534560214%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=eee9a644-d045-4bad-a871-287a027c9045&title=KEF+Q1+Meta+-+HiFi+Speaker+-+Compact+High-end+Bookshelf+Speaker+-+Satin+Black+-+Premium+Speaker&store=audio-advice&storeName=Audio+Advice
```

### Audio Shop `(audio-shop)`  · relay=Y

**Product**: JBL FLIP 6

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A10107006303504736565%2CheadlineOfferDocid%3A10107006303504736565%2CimageDocid%3A3807963689963815540%2Crds%3APC_6491925242212131740%7CPROD_PC_6491925242212131740%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=40d841bd-ca99-4288-83a3-fa2461f5608f&title=JBL+FLIP+6&store=audio-shop&storeName=Audio+Shop
```

### Audio Visual Kart `(audio-visual-kart)`  · relay=Y

**Product**: Polk Audio Signature Elite ES10

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A9320706509358308226%2Cproductid%3A18337652532276668410%2CheadlineOfferDocid%3A10049000186914346806%2CimageDocid%3A788663671287851340%2Crds%3APC_11910508730362568946%7CPROD_PC_11910508730362568946%2Cgpcid%3A11910508730362568946%2Cmid%3A576462602374365404%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=b031fa33-e108-4a86-ba92-517e200048d7&title=Polk+Audio+Signature+Elite+ES10&store=audio-visual-kart&storeName=Audio+Visual+Kart
```

### AudioDeluxe `(audiodeluxe)`  · relay=Y

**Product**: Antares Autotune Artist Vocal Tuning Plug-in

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A16865299514421460875%2Cproductid%3A3938530500623481328%2CheadlineOfferDocid%3A2848417615852499735%2CimageDocid%3A1899805943360898049%2Crds%3APC_5117190104135708360%7CPROD_PC_5117190104135708360%2Cgpcid%3A5117190104135708360%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=bd1879a7-45c4-412d-9a8d-b38c64ce4f5a&title=Antares+Autotune+Artist+Vocal+Tuning+Plug-in&store=audiodeluxe&storeName=AudioDeluxe
```

### Avo SuperShop `(avo-supershop)`  · relay=Y

**Product**: AirPods Pro 3 - Apple

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A2327420681279440941%2Cproductid%3A15969768374614330185%2CheadlineOfferDocid%3A8199593366616812807%2CimageDocid%3A2695162814807607906%2Crds%3APC_3323897376901893063%7CPROD_PC_3323897376901893063%2Cgpcid%3A3323897376901893063%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=a1a47f0c-e805-4a7b-af5b-c9fa5809e55c&title=AirPods+Pro+3+-+Apple&store=avo-supershop&storeName=Avo+SuperShop
```

### AWD-IT `(awd-it)`  · relay=Y

**Product**: ASUS ROG STRIX X870-A Gaming Wifi, AMD AM5 Motherboard CPU Bundle

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dproductid%3A9688535382668442716%2CheadlineOfferDocid%3A9688535382668442716%2CimageDocid%3A5202270630394161660%2Crds%3APC_17959073960376213697%7CPROD_PC_17959073960376213697%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=7fdf4e79-7041-4645-bd74-011df1514fe4&title=ASUS+ROG+STRIX+X870-A+Gaming+Wifi%2C+AMD+AM5+Motherboard+CPU+Bundle&store=awd-it&storeName=AWD-IT
```

### B&H Photo-Video-Audio `(b-h-photo-video-audio)`  · relay=Y

**Product**: CyberPowerPC Gamer Xtreme Gaming Desktop Computer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A602997782642818641%2Cproductid%3A15272757743666471798%2CheadlineOfferDocid%3A9919168607056973695%2CimageDocid%3A17927282882848316440%2Cgpcid%3A1199416201124771118%2Cmid%3A576462518064109372%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=2d91e130-dbf4-42bc-83bd-c4825a573129&title=CyberPowerPC+Gamer+Xtreme+Gaming+Desktop+Computer&store=b-h-photo-video-audio&storeName=B%26H+Photo-Video-Audio
```

### Bajaj Markets X ONDC `(bajaj-markets-x-ondc)`  · relay=Y

**Product**: GOVO GoSurround 220

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A10275594436172436602%2Cproductid%3A5675940320636963943%2CheadlineOfferDocid%3A8415935833134822540%2CimageDocid%3A4384013860458793662%2Cgpcid%3A12315260756025041119%2Cmid%3A576462865199024147%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=0522f59e-0365-4774-9318-42f34e71dab1&title=GOVO+GoSurround+220&store=bajaj-markets-x-ondc&storeName=Bajaj+Markets+X+ONDC
```

### Bargains `(bargains)`  · relay=Y

**Product**: Midea 175L Bottom Freezer Fridge

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A15744149152791176596%2Cproductid%3A17473878733214610738%2CheadlineOfferDocid%3A10183790330485986239%2CimageDocid%3A18412186107387491517%2Cgpcid%3A17998746596819794913%2Cmid%3A576462863845291602%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=a28e439e-522c-48da-9279-30271ecda06e&title=Midea+175L+Bottom+Freezer+Fridge&store=bargains&storeName=Bargains
```

### bartyspares `(bartyspares)`  · relay=Y

**Product**: for Dyson V11 Torque Drive Type Brush Bar Vacuum Cleaner BrushBar

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDyson+V11+deals%26prds%3Dproductid%3A14442974193206417900%2CheadlineOfferDocid%3A14442974193206417900%2CimageDocid%3A4855499972382606601%2Crds%3APC_10202795929622308698%7CPROD_PC_10202795929622308698%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=05a63790-ac33-497e-b24b-d65da3b5f342&title=for+Dyson+V11+Torque+Drive+Type+Brush+Bar+Vacuum+Cleaner+BrushBar&store=bartyspares&storeName=bartyspares
```

### Baseball Express `(baseball-express)`  · relay=Y

**Product**: Nike Women's Pro Shorts

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A5888310867868079544%2Cproductid%3A7402419208288278263%2CheadlineOfferDocid%3A10914346671699450594%2CimageDocid%3A13835003038352779061%2Crds%3APC_4141549837973387269%7CPROD_PC_4141549837973387269%2Cgpcid%3A4141549837973387269%2Cmid%3A576462841244920716%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=16bcf1e8-4fe2-4ebd-81d5-4cb5d2ea7a98&title=Nike+Women%27s+Pro+Shorts&store=baseball-express&storeName=Baseball+Express
```

### Bash `(bash)`  · relay=Y

**Product**: TS Women's Fitted Turtle Neck Black Vest XXL - Workout Top. TS - Sold by Totalsports

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A4185543450650767415%2CheadlineOfferDocid%3A4185543450650767415%2CimageDocid%3A10420409374928077654%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=9aeef07b-1bba-4a48-ab2f-05f94d998792&title=TS+Women%27s+Fitted+Turtle+Neck+Black+Vest+XXL+-+Workout+Top.+TS+-+Sold+by+Totalsports&store=bash&storeName=Bash
```

### Bass Pro Shops `(bass-pro-shops)`  · relay=Y

**Product**: Crocs Classic Clogs for Women - Bone

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCrocs+Classic+Clog+deals%26prds%3Dproductid%3A3576585609150683358%2CheadlineOfferDocid%3A3576585609150683358%2CimageDocid%3A10545673182123985770%2Crds%3APC_5803906498614987482%7CPROD_PC_5803906498614987482%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=919b1b7c-56bc-4d50-bdc2-3279e0c9b531&title=Crocs+Classic+Clogs+for+Women+-+Bone&store=bass-pro-shops&storeName=Bass+Pro+Shops
```

### Baur Versand `(baur-versand)`  · relay=Y

**Product**: Motorola Edge 70

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A13414535194542895171%2Cproductid%3A16532046056789001423%2CheadlineOfferDocid%3A1758259188685290778%2CimageDocid%3A11059540476653199555%2Crds%3APC_8749778257005578037%7CPROD_PC_8749778257005578037%2Cgpcid%3A8749778257005578037%2Cmid%3A576462872881856342%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=d8bec48d-52f2-4071-be3e-30839b5ead1a&title=Motorola+Edge+70&store=baur-versand&storeName=Baur+Versand
```

### Beauty Brands `(beauty-brands)`  · relay=Y

**Product**: Laura Geller Baked Blush-n-Brighten Marbleized Blush

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A15648777756029064676%2Cproductid%3A7888624702353953758%2CheadlineOfferDocid%3A4081858423739246497%2CimageDocid%3A16515537440174472125%2Crds%3APC_3233157570769305808%7CPROD_PC_3233157570769305808%2Cgpcid%3A3233157570769305808%2Cmid%3A576462741126124912%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=d127bb53-216f-4a2d-a3fa-7e2eec57e7d5&title=Laura+Geller+Baked+Blush-n-Brighten+Marbleized+Blush&store=beauty-brands&storeName=Beauty+Brands
```

### Beauty House `(beauty-house)`  · relay=Y

**Product**: Clinique Beyond Perfecting Foundation + Concealer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A4566134629617828088%2Cproductid%3A4310085609630377576%2CheadlineOfferDocid%3A9372076485720833417%2CimageDocid%3A11377785591320759999%2Crds%3APC_1969063170079553626%7CPROD_PC_1969063170079553626%2Cgpcid%3A1969063170079553626%2Cmid%3A576462224917024773%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b20a1577-0e7a-4d77-8fed-ad55fd883f36&title=Clinique+Beyond+Perfecting+Foundation+%2B+Concealer&store=beauty-house&storeName=Beauty+House
```

### BeautyOnline `(beautyonline)`  · relay=Y

**Product**: Lucid Freshener 100ml

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A15091312041824973513%2Cproductid%3A5442523055264170796%2CheadlineOfferDocid%3A10618558703501548234%2CimageDocid%3A7596887473958789860%2Cgpcid%3A9947827882352458147%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=d6c349e2-9443-4020-8faf-c0c74cdfc099&title=Lucid+Freshener+100ml&store=beautyonline&storeName=BeautyOnline
```

### beautywests.com `(beautywests)`  · relay=Y

**Product**: Nail Lacquer OPI

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A10019669332570149556%2Cproductid%3A3296804490611859805%2CheadlineOfferDocid%3A11036903233126082509%2CimageDocid%3A1246899406086980678%2Crds%3APC_2142239453820701778%7CPROD_PC_2142239453820701778%2Cgpcid%3A2142239453820701778%2Cmid%3A576462370835087240%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c7f2d584-77f6-4d7f-8cfc-83ea8078fa11&title=Nail+Lacquer+OPI&store=beautywests&storeName=beautywests.com
```

### Bed Bath & Beyond `(bed-bath-beyond)`  · relay=Y

**Product**: Hamilton Beach 4 7-Speed Stand Mixer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A1476419917435712504%2Cproductid%3A612652246369781686%2CheadlineOfferDocid%3A11046598900531398878%2CimageDocid%3A12005020677224031300%2Crds%3APC_11293174639507418368%7CPROD_PC_11293174639507418368%2Cgpcid%3A11293174639507418368%2Cmid%3A576462503441287692%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=66c80171-5387-4c27-b294-3d596471da79&title=Hamilton+Beach+4+7-Speed+Stand+Mixer&store=bed-bath-beyond&storeName=Bed+Bath+%26+Beyond
```

### Beelink `(beelink)`  · relay=Y

**Product**: Beelink EQi12 Intel Core 1235U/1220P Intel Core i5-1235U+Intel lris Xe Graphics eligible 1.20GHz DDR4 3200MHz + 500GB

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A1439761410623150376%2Cproductid%3A11964624339206823076%2CheadlineOfferDocid%3A11968239932704553393%2CimageDocid%3A3781158052531613246%2Crds%3APC_4137498807229001922%7CPROD_PC_4137498807229001922%2Cgpcid%3A4137498807229001922%2Cmid%3A576462888238415154%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=0b508e47-6599-4326-9d83-3a74f8a19f4e&title=Beelink+EQi12+Intel+Core+1235U%2F1220P+Intel+Core+i5-1235U%2BIntel+lris+Xe+Graphics+eligible+1.20GHz+DDR4+3200MHz+%2B+500GB&store=beelink&storeName=Beelink
```

### Benefit Cosmetics UK `(benefit-cosmetics-uk)`  · relay=Y

**Product**: Benefit I Spy Beauty Full Face Makeup Gift Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A8431272840729846426%2Cproductid%3A2218192831563952319%2CheadlineOfferDocid%3A14781317713699589000%2CimageDocid%3A11192448253859018597%2Crds%3APC_1722491244414450543%7CPROD_PC_1722491244414450543%2Cgpcid%3A1722491244414450543%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=c098643d-790f-453d-afbb-ae89b211c2cc&title=Benefit+I+Spy+Beauty+Full+Face+Makeup+Gift+Set&store=benefit-cosmetics-uk&storeName=Benefit+Cosmetics+UK
```

### Betron UK `(betron-uk)`  · relay=Y

**Product**: Betron Wired Gaming Headset with Microphone

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A3480615882579791561%2Cproductid%3A12792974391426164162%2CheadlineOfferDocid%3A11054260745038736818%2CimageDocid%3A9880252696042914508%2Crds%3APC_17581886264938360899%7CPROD_PC_17581886264938360899%2Cgpcid%3A17581886264938360899%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=77275e0d-496e-4f2a-ae16-f17b0bd245c9&title=Betron+Wired+Gaming+Headset+with+Microphone&store=betron-uk&storeName=Betron+UK
```

### beyerdynamic.com `(beyerdynamic)`  · relay=Y

**Product**: Beyerdynamic AVENTHO 300 Wireless Over-Ear Headphones

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A12106625753308278018%2Cproductid%3A6960217174423820807%2CheadlineOfferDocid%3A1489159865681352797%2CimageDocid%3A3813198503176102562%2Crds%3APC_769272824426065119%7CPROD_PC_769272824426065119%2Cgpcid%3A769272824426065119%2Cmid%3A576462803942646173%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=045dbdba-ac2a-4a4a-8346-12b69c285ffb&title=Beyerdynamic+AVENTHO+300+Wireless+Over-Ear+Headphones&store=beyerdynamic&storeName=beyerdynamic.com
```

### Big Apple Buddy `(big-apple-buddy)`  · relay=Y

**Product**: Garmin Venu 3S

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DApple+Watch+Series+10+deals%26prds%3Dcatalogid%3A17491280924438934437%2Cproductid%3A12641452087376167228%2CheadlineOfferDocid%3A12044824130780270520%2CimageDocid%3A16575491829903778680%2Crds%3APC_10565767112157870561%7CPROD_PC_10565767112157870561%2Cgpcid%3A10565767112157870561%2Cmid%3A576462758418714949%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=d3246108-adcf-46b7-bcea-1b2c9276875a&title=Garmin+Venu+3S&store=big-apple-buddy&storeName=Big+Apple+Buddy
```

### Big Sandy Superstore `(big-sandy-superstore)`  · relay=Y

**Product**: Samsung 4-Piece Kitchen Package with 29 cu. ft. 4-Door Flex French Door Refrigerator with Beverage Zone and Auto Open Doors

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A17479026959513758755%2CheadlineOfferDocid%3A17479026959513758755%2CimageDocid%3A10420176307419297164%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=4b221994-5724-4012-9b38-986c70362418&title=Samsung+4-Piece+Kitchen+Package+with+29+cu.+ft.+4-Door+Flex+French+Door+Refrigerator+with+Beverage+Zone+and+Auto+Open+Do&store=big-sandy-superstore&storeName=Big+Sandy+Superstore
```

### bigbasket.com `(bigbasket)`  · relay=Y

**Product**: Vivo T3 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A6758221328449212581%2Cproductid%3A5569527789885380517%2CheadlineOfferDocid%3A9142182930543220651%2Crds%3APC_6043900822336828683%7CPROD_PC_6043900822336828683%2Cgpcid%3A6043900822336828683%2Cmid%3A576462852265346877%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=4a5e7f75-1fd4-4d5b-8895-5c04d2d05c83&title=Vivo+T3+5G&store=bigbasket&storeName=bigbasket.com
```

### Bigme `(bigme)`  · relay=Y

**Product**: bigme B251 Color Monitor

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A12421024603054303435%2Cproductid%3A14968895596625354670%2CheadlineOfferDocid%3A9417249021326449681%2CimageDocid%3A3868037701814149688%2Crds%3APC_16389939324960909751%7CPROD_PC_16389939324960909751%2Cgpcid%3A16389939324960909751%2Cmid%3A576462849360796466%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=f50b4b10-9b27-4ed6-9e70-9baadac6ad40&title=bigme+B251+Color+Monitor&store=bigme&storeName=Bigme
```

### Bikeinn.com `(bikeinn)`  · relay=Y

**Product**: Huawei Watch Fit 4 Strap

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A18300029969314894757%2Cproductid%3A6518356418870957330%2CheadlineOfferDocid%3A14075745782201038998%2CimageDocid%3A13056999443080367919%2Crds%3APC_7363002840374335129%7CPROD_PC_7363002840374335129%2Cgpcid%3A7363002840374335129%2Cmid%3A576462826506290707%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=ce11e1da-84f5-44e0-913e-43448982f965&title=Huawei+Watch+Fit+4+Strap&store=bikeinn&storeName=Bikeinn.com
```

### bio-naturel.de `(bio-naturel-de)`  · relay=Y

**Product**: Madara The Icons Light Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A16630153870369100591%2Cproductid%3A18153129347148494284%2CheadlineOfferDocid%3A7759402862173217573%2CimageDocid%3A6805613035180836414%2Crds%3APC_13590802053890476392%7CPROD_PC_13590802053890476392%2Cgpcid%3A13590802053890476392%2Cmid%3A576462859588488165%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=c1c2564b-6212-4199-ab43-ad5800f39b5b&title=Madara+The+Icons+Light+Set&store=bio-naturel-de&storeName=bio-naturel.de
```

### BJ's Wholesale Club `(bj-s-wholesale-club)`  · relay=Y

**Product**: Altec Lansing SoundRover Pro 650 Party Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A5555956470099210041%2Cproductid%3A7639654961836218278%2CheadlineOfferDocid%3A4461675428177747771%2CimageDocid%3A15282095503879025715%2Crds%3APC_15031966734438928166%7CPROD_PC_15031966734438928166%2Cgpcid%3A15031966734438928166%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=6fc8a088-39cf-41d7-856a-37a48b266e8a&title=Altec+Lansing+SoundRover+Pro+650+Party+Speaker&store=bj-s-wholesale-club&storeName=BJ%27s+Wholesale+Club
```

### Black Girl Vitamins `(black-girl-vitamins)`  · relay=Y

**Product**: Meno-Chill Women's Daily Herbal Balance & Vitality Supplement

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A8849641175451478875%2Cproductid%3A6319438755719886213%2CheadlineOfferDocid%3A334892143303471258%2CimageDocid%3A16686789475030488933%2Crds%3APC_5334090661251251932%7CPROD_PC_5334090661251251932%2Cgpcid%3A5334090661251251932%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=94e1637b-f365-48a2-89cb-bc129f92015a&title=Meno-Chill+Women%27s+Daily+Herbal+Balance+%26+Vitality+Supplement&store=black-girl-vitamins&storeName=Black+Girl+Vitamins
```

### Blackmore IT `(blackmore-it)`  · relay=Y

**Product**: Dell OptiPlex 5070 Desktop Core

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A12340875987924184684%2Cproductid%3A13369347073178595162%2CheadlineOfferDocid%3A10985917470097801946%2CimageDocid%3A18048581171869509101%2Crds%3APC_4891785142541956381%7CPROD_PC_4891785142541956381%2Cgpcid%3A4891785142541956381%2Cmid%3A576462492992027584%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=ab1caca4-d580-4c0e-b90c-3c171d9ee95c&title=Dell+OptiPlex+5070+Desktop+Core&store=blackmore-it&storeName=Blackmore+IT
```

### Blackview Global Store `(blackview-global-store)`  · relay=Y

**Product**: Blackview XPLORE 2 Projector Rugged 5G AI Cellphone with 6.73" 3.2K AMOLED Display Dimensity 8300 20000mAh & Built-in Camping Light 12GB+256GB

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A10784973889010918057%2Cproductid%3A16429504676855693850%2CheadlineOfferDocid%3A10360342904455030284%2CimageDocid%3A7593363437186604629%2Crds%3APC_7100746460769616162%7CPROD_PC_7100746460769616162%2Cgpcid%3A7100746460769616162%2Cmid%3A576462843142242920%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=87268c65-5278-4be7-b0aa-ee43cffb6b2e&title=Blackview+XPLORE+2+Projector+Rugged+5G+AI+Cellphone+with+6.73%22+3.2K+AMOLED+Display+Dimensity+8300+20000mAh+%26+Built-in+Ca&store=blackview-global-store&storeName=Blackview+Global+Store
```

### Blain's Farm & Fleet `(blain-s-farm-fleet)`  · relay=Y

**Product**: Cuisinart 14 Cup Programmable Coffee Maker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A9479163313991489456%2Cproductid%3A11166604736110797769%2CheadlineOfferDocid%3A11836005491018707900%2CimageDocid%3A15202131355507150650%2Crds%3APC_9443815825111257531%7CPROD_PC_9443815825111257531%2Cgpcid%3A9443815825111257531%2Cmid%3A576462298274765458%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c210b3f6-570d-43e2-8dee-05ed0192d24c&title=Cuisinart+14+Cup+Programmable+Coffee+Maker&store=blain-s-farm-fleet&storeName=Blain%27s+Farm+%26+Fleet
```

### Bloom Nutrition `(bloom-nutrition)`  · relay=Y

**Product**: Bloom Nutrition Greens & Superfoods Powder

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A6742711880010712123%2Cproductid%3A8997611239863440264%2CheadlineOfferDocid%3A7995449654190048049%2CimageDocid%3A7387306192851724630%2Crds%3APC_9529737884630969303%7CPROD_PC_9529737884630969303%2Cgpcid%3A8587464762457588152%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=214035d0-b891-47aa-97c8-2bac7b0fa74d&title=Bloom+Nutrition+Greens+%26+Superfoods+Powder&store=bloom-nutrition&storeName=Bloom+Nutrition
```

### Bloomingdale's `(bloomingdale-s)`  · relay=Y

**Product**: Clinique Dramatically Different Moisturizing

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A8246857485543470781%2Cproductid%3A1997527496471008242%2CheadlineOfferDocid%3A16173895309438963560%2CimageDocid%3A14787365761874801150%2Crds%3APC_5873936506445281166%7CPROD_PC_5873936506445281166%2Cgpcid%3A5873936506445281166%2Cmid%3A576462224560525687%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=e04e18c5-8229-432a-87e1-6650d9c5a755&title=Clinique+Dramatically+Different+Moisturizing&store=bloomingdale-s&storeName=Bloomingdale%27s
```

### Blumaple `(blumaple)`  · relay=Y

**Product**: Freaks And Geeks Wired Controller for PS4

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dproductid%3A14825090117215599916%2CheadlineOfferDocid%3A14825090117215599916%2CimageDocid%3A10305205159506355283%2Crds%3APC_6311710322062528057%7CPROD_PC_6311710322062528057%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=4837b7ae-5695-428a-80fa-505897502ee1&title=Freaks+And+Geeks+Wired+Controller+for+PS4&store=blumaple&storeName=Blumaple
```

### boAt `(boat)`  · relay=Y

**Product**: boAt Rockerz Plus 550 Bluetooth Headphone with Mic

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A6266583124692365975%2Cproductid%3A1612301515267306768%2CheadlineOfferDocid%3A1445279740010630354%2CimageDocid%3A3862026993931628179%2Crds%3APC_15534221770955109474%7CPROD_PC_15534221770955109474%2Cgpcid%3A15534221770955109474%2Cmid%3A576462841726346952%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=8dae1eae-0864-4e15-ab8a-3f877cd3bf05&title=boAt+Rockerz+Plus+550+Bluetooth+Headphone+with+Mic&store=boat&storeName=boAt
```

### boohoo `(boohoo)`  · relay=Y

**Product**: Wallis Women's Faux Fur Collar Tab Cuff Coat

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A107182019993942312%2Cproductid%3A14849505872576304873%2CheadlineOfferDocid%3A1562437116918134623%2CimageDocid%3A10060199994707444532%2Crds%3APC_1429532466121030268%7CPROD_PC_1429532466121030268%2Cgpcid%3A1429532466121030268%2Cmid%3A576462870421719920%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=84153f61-ad54-4765-9306-ad548e827dfe&title=Wallis+Women%27s+Faux+Fur+Collar+Tab+Cuff+Coat&store=boohoo&storeName=boohoo
```

### boohoo USA `(boohoo-usa)`  · relay=Y

**Product**: Boohoo Women's Super Soft Long Sleeve Strap Top

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A2335626831159805762%2Cproductid%3A8375882584976570164%2CheadlineOfferDocid%3A6832728685299710476%2CimageDocid%3A3782155313461541437%2Cgpcid%3A10083339136623848123%2Cmid%3A576462888998190996%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=df1c143f-7a6d-48b0-9b7c-7163699a894c&title=Boohoo+Women%27s+Super+Soft+Long+Sleeve+Strap+Top&store=boohoo-usa&storeName=boohoo+USA
```

### Boscov's `(boscov-s)`  · relay=Y

**Product**: CeraVe Moisturizing Cream

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCeraVe+Moisturizing+Cream+deals%26prds%3Dcatalogid%3A10197095813347703899%2Cproductid%3A12746694740270507498%2CheadlineOfferDocid%3A3802880874810194667%2CimageDocid%3A863879161049186358%2Crds%3APC_16245040360969784676%7CPROD_PC_16245040360969784676%2Cgpcid%3A16245040360969784676%2Cmid%3A576462224906833105%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=623f0852-92cd-4a35-8206-e69fdbce006e&title=CeraVe+Moisturizing+Cream&store=boscov-s&storeName=Boscov%27s
```

### Bose `(bose)`  · relay=Y

**Product**: Bose SoundLink Home Bluetooth Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A2638165492400198395%2Cproductid%3A12421655237270612603%2CheadlineOfferDocid%3A2686897233365591209%2CimageDocid%3A39353382041333559%2Crds%3APC_15295619052973366120%7CPROD_PC_15295619052973366120%2Cgpcid%3A15295619052973366120%2Cmid%3A576462819645639497%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=6411e1bc-df1d-4e47-885d-d7c7fc9750e0&title=Bose+SoundLink+Home+Bluetooth+Speaker&store=bose&storeName=Bose
```

### Boston College Bookstore `(boston-college-bookstore)`  · relay=Y

**Product**: Maybelline Lash Sensational Sky High Tinted Mascara

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMaybelline+Lash+Sensational+deals%26prds%3Dcatalogid%3A129601509186252441%2Cproductid%3A18055499254893456688%2CheadlineOfferDocid%3A2548075626033845585%2CimageDocid%3A15290555200567971964%2Crds%3APC_4019099209806756286%7CPROD_PC_4019099209806756286%2Cgpcid%3A4019099209806756286%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=421965be-f03a-49da-a707-2c147c259f7c&title=Maybelline+Lash+Sensational+Sky+High+Tinted+Mascara&store=boston-college-bookstore&storeName=Boston+College+Bookstore
```

### Botanic Choice `(botanic-choice)`  · relay=Y

**Product**: Botanic Choice Start! Multi-Vitamin + Weight 60 Capsules

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A649405695274750664%2Cproductid%3A16030544008483934568%2CheadlineOfferDocid%3A1495059631125700851%2CimageDocid%3A12417637922347534735%2Crds%3APC_15670859757725426598%7CPROD_PC_15670859757725426598%2Cgpcid%3A15670859757725426598%2Cmid%3A576462806788381714%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=0c7438f4-1fab-4fc5-afb8-f7ed532d11d3&title=Botanic+Choice+Start%21+Multi-Vitamin+%2B+Weight+60+Capsules&store=botanic-choice&storeName=Botanic+Choice
```

### box.co.uk `(box)`  · relay=Y

**Product**: OPPO Reno13 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A9475890615750167774%2Cproductid%3A13961259327717225465%2CheadlineOfferDocid%3A16526761693519583104%2CimageDocid%3A10153084598953568743%2Crds%3APC_14927399937999975490%7CPROD_PC_14927399937999975490%2Cgpcid%3A14927399937999975490%2Cmid%3A576462858997191832%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=f010a714-122a-4f6c-b982-418d026f9f60&title=OPPO+Reno13+5G&store=box&storeName=box.co.uk
```

### Branded Lifestyles `(branded-lifestyles)`  · relay=Y

**Product**: Hisense Combi Refrigerator

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A5880383384279351388%2CheadlineOfferDocid%3A10172983251881674245%2CimageDocid%3A18088418030911277051%2Crds%3APC_1236167364143071941%7CPROD_PC_1236167364143071941%2Cgpcid%3A1236167364143071941%2Cmid%3A576462770266947843%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=51b9fc67-3990-452d-b596-85bd79b64b3e&title=Hisense+Combi+Refrigerator&store=branded-lifestyles&storeName=Branded+Lifestyles
```

### BrandsMart USA `(brandsmart-usa)`  · relay=Y

**Product**: Sony 2.0 Channel Soundbar with Bluetooth

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A11376618865481845667%2Cproductid%3A17017833774861237062%2CheadlineOfferDocid%3A5045487963671220401%2CimageDocid%3A7503985093889688000%2Crds%3APC_2029664414109455657%7CPROD_PC_2029664414109455657%2Cgpcid%3A2029664414109455657%2Cmid%3A576462348593698251%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=80064c6b-bcd1-4f7c-9bb7-2c0bbad86f67&title=Sony+2.0+Channel+Soundbar+with+Bluetooth&store=brandsmart-usa&storeName=BrandsMart+USA
```

### Brandzz.co.za `(brandzz)`  · relay=Y

**Product**: The North Face Simple Dome T-Shirt - White - S

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A17455130209522069268%2CheadlineOfferDocid%3A17455130209522069268%2CimageDocid%3A14127254533372149940%2Crds%3APC_6346547527624279408%7CPROD_PC_6346547527624279408%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=f9a18e15-0ab9-48f3-8561-7e8e1dff31ff&title=The+North+Face+Simple+Dome+T-Shirt+-+White+-+S&store=brandzz&storeName=Brandzz.co.za
```

### Brigette's Boutique `(brigette-s-boutique)`  · relay=Y

**Product**: Fenty Beauty Pro Filt'r Instant Retouch Concealer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A891220395052264375%2Cproductid%3A15272919841705753016%2CheadlineOfferDocid%3A149495583030937012%2CimageDocid%3A13955718021203706445%2Crds%3APC_7131277097647196088%7CPROD_PC_7131277097647196088%2Cgpcid%3A7131277097647196088%2Cmid%3A576462367258330923%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=9e494cb7-8042-4b8d-bc7a-233b622d6fff&title=Fenty+Beauty+Pro+Filt%27r+Instant+Retouch+Concealer&store=brigette-s-boutique&storeName=Brigette%27s+Boutique
```

### Brown Thomas `(brown-thomas)`  · relay=Y

**Product**: IT Cosmetics Bye Bye Under Eye Concealer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A1040172181366014175%2Cproductid%3A17294431871457309287%2CheadlineOfferDocid%3A16542776699730743008%2CimageDocid%3A1483686059084338179%2Crds%3APC_16233483731695574481%7CPROD_PC_16233483731695574481%2Cgpcid%3A16233483731695574481%2Cmid%3A576462224855262609%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=016469ab-5ae6-4393-9f59-4d341f867b80&title=IT+Cosmetics+Bye+Bye+Under+Eye+Concealer&store=brown-thomas&storeName=Brown+Thomas
```

### Builders `(builders)`  · relay=Y

**Product**: Goldair Built-In Electric Oven And Gas Hob Ggop 540

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A10330711365833919791%2Cproductid%3A3171641029179702348%2CheadlineOfferDocid%3A3863979423544073453%2CimageDocid%3A17487355495787011622%2Crds%3APC_3407095675632445578%7CPROD_PC_3407095675632445578%2Cgpcid%3A3407095675632445578%2Cmid%3A576462745938154559%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=8aa9b536-da3a-4186-b115-751ac7f197cc&title=Goldair+Built-In+Electric+Oven+And+Gas+Hob+Ggop+540&store=builders&storeName=Builders
```

### bumsonthesaddle.com `(bumsonthesaddle)`  · relay=Y

**Product**: Coros Pace 3 Watch

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A5928113959608721086%2Cproductid%3A5749012168259958054%2CheadlineOfferDocid%3A7750321268243034186%2CimageDocid%3A13798899040899500257%2Crds%3APC_3378125032119265178%7CPROD_PC_3378125032119265178%2Cgpcid%3A3378125032119265178%2Cmid%3A576462785113787905%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=2ad0e8ff-0f2d-42ea-9c4d-303ebe0c786a&title=Coros+Pace+3+Watch&store=bumsonthesaddle&storeName=bumsonthesaddle.com
```

### Calliste Fashion `(calliste-fashion)`  · relay=Y

**Product**: s.Oliver Overall Jumpsuit Women's

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A12563912106232362152%2Cproductid%3A16709610032809033752%2CheadlineOfferDocid%3A16404698210248105646%2CimageDocid%3A12084743989652476722%2Cgpcid%3A3634326845408527113%2Cmid%3A576462886413948601%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=cab93d0b-fa46-44aa-af97-074c4f697518&title=s.Oliver+Overall+Jumpsuit+Women%27s&store=calliste-fashion&storeName=Calliste+Fashion
```

### Calvin Klein `(calvin-klein)`  · relay=Y

**Product**: Calvin Klein Men's Icon Cotton Stretch 3-Pack Slim Boxer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCalvin+Klein+Boxers+deals%26prds%3Dcatalogid%3A7077341291955961621%2Cproductid%3A10740689324547456167%2CheadlineOfferDocid%3A9159027770564642867%2CimageDocid%3A10207318265736893351%2Crds%3APC_14420567524929666859%7CPROD_PC_14420567524929666859%2Cgpcid%3A14420567524929666859%2Cmid%3A576462550432222522%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=1f742498-ba67-450c-92d9-0a1bc471a2f5&title=Calvin+Klein+Men%27s+Icon+Cotton+Stretch+3-Pack+Slim+Boxer&store=calvin-klein&storeName=Calvin+Klein
```

### Calvin Klein UK `(calvin-klein-uk)`  · relay=Y

**Product**: Calvin Klein - Trunks - Icon Logo Graphic - Black - Black - Male - XS

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCalvin+Klein+Boxers+deals%26prds%3Dproductid%3A5136657696491121177%2CheadlineOfferDocid%3A5136657696491121177%2CimageDocid%3A12016901401345237711%2Crds%3APC_11770959671095013269%7CPROD_PC_11770959671095013269%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=4e39f58d-b47d-49d7-9200-11da4c886dd6&title=Calvin+Klein+-+Trunks+-+Icon+Logo+Graphic+-+Black+-+Black+-+Male+-+XS&store=calvin-klein-uk&storeName=Calvin+Klein+UK
```

### Canoly `(canoly)`  · relay=Y

**Product**: Canoly C16 Cold Press Juicer Machines Powerful 250W AC Brushless Motor, 6.0" Extra Wide Feed Chute Hands-Free Slow Juicer, Pearl White

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A7277629888528826494%2CheadlineOfferDocid%3A7277629888528826494%2CimageDocid%3A13054323049706788377%2Crds%3APC_955939555082087519%7CPROD_PC_955939555082087519%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=a3ab949d-3292-4bf4-836d-54e1fb54ed8b&title=Canoly+C16+Cold+Press+Juicer+Machines+Powerful+250W+AC+Brushless+Motor%2C+6.0%22+Extra+Wide+Feed+Chute+Hands-Free+Slow+Juice&store=canoly&storeName=Canoly
```

### Care to Beauty `(care-to-beauty)`  · relay=Y

**Product**: Hello Sunday the one for your hands Hand Cream SPF30 30ml

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A972323930276717985%2Cproductid%3A12192221870553559898%2CheadlineOfferDocid%3A15026275988280820792%2CimageDocid%3A13735707025025433580%2Crds%3APC_5570331347365307257%7CPROD_PC_5570331347365307257%2Cgpcid%3A5570331347365307257%2Cmid%3A576462446889532029%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=e08a08c3-195a-4de8-84e6-9f3367aa990b&title=Hello+Sunday+the+one+for+your+hands+Hand+Cream+SPF30+30ml&store=care-to-beauty&storeName=Care+to+Beauty
```

### Carrefour UAE `(carrefour-uae)`  · relay=Y

**Product**: Electrolux Built in 5 Burners Gas Hob KGG95375K

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A12155114946814645244%2Cproductid%3A3441444684506179515%2CheadlineOfferDocid%3A12880490652470498755%2CimageDocid%3A10528553360481934240%2Cgpcid%3A9549014216512880092%2Cmid%3A576462888395066842%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=45356646-7fd0-46ff-89fc-d3b678e457bb&title=Electrolux+Built+in+5+Burners+Gas+Hob+KGG95375K&store=carrefour-uae&storeName=Carrefour+UAE
```

### CDW `(cdw)`  · relay=Y

**Product**: Samsung Galaxy Z Flip7

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A3438579208120885046%2Cproductid%3A17014347934577633179%2CheadlineOfferDocid%3A2592859762384110573%2CimageDocid%3A9804818998833744075%2Crds%3APC_1806898280459141321%7CPROD_PC_1806898280459141321%2Cgpcid%3A1806898280459141321%2Cmid%3A576462863295556236%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=cfe34f37-2613-45c2-9576-795ed9bb62a2&title=Samsung+Galaxy+Z+Flip7&store=cdw&storeName=CDW
```

### Centurion Technology Support Services `(centurion-technology-support-services)`  · relay=Y

**Product**: Redragon RYLO S141 Membrane Gaming Keyboard and Mouse Wired Combo

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A6877639846847322836%2Cproductid%3A9506228766957667591%2CheadlineOfferDocid%3A14303347340630383097%2CimageDocid%3A10762326436659497154%2Crds%3APC_8987527858856634131%7CPROD_PC_8987527858856634131%2Cgpcid%3A8987527858856634131%2Cmid%3A576462857966469648%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=6e86df54-f83e-448e-a771-a2475d1324b8&title=Redragon+RYLO+S141+Membrane+Gaming+Keyboard+and+Mouse+Wired+Combo&store=centurion-technology-support-services&storeName=Centurion+Technology+Support+Services
```

### Champs Sports `(champs-sports)`  · relay=Y

**Product**: Nike Men's Club Fleece Basketball Hoodie

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A8535621458553685958%2Cproductid%3A7033160105416720990%2CheadlineOfferDocid%3A7756200167261445394%2CimageDocid%3A10390710929750952627%2Crds%3APC_12520183028531749908%7CPROD_PC_12520183028531749908%2Cgpcid%3A17930549094664052531%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=9569e244-61e4-4e5e-b9dc-c9d68ce42416&title=Nike+Men%27s+Club+Fleece+Basketball+Hoodie&store=champs-sports&storeName=Champs+Sports
```

### Check My Body Health `(check-my-body-health)`  · relay=Y

**Product**: Check My Body Health Body Intolerance Test

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A14192316713266604593%2Cproductid%3A17414376951292714847%2CheadlineOfferDocid%3A15671873991487415193%2CimageDocid%3A1089542500512338636%2Crds%3APC_15540904913401832739%7CPROD_PC_15540904913401832739%2Cgpcid%3A15540904913401832739%2Cmid%3A576462770500861036%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1a8555a3-aecf-475d-a06c-71d1086e681b&title=Check+My+Body+Health+Body+Intolerance+Test&store=check-my-body-health&storeName=Check+My+Body+Health
```

### Chemist4U `(chemist4u)`  · relay=Y

**Product**: Bio Oil Skincare Oil

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A3485278234951523266%2Cproductid%3A4974430539976262617%2CheadlineOfferDocid%3A4946739214933346605%2CimageDocid%3A12156983596144725949%2Crds%3APC_2283562041014559581%7CPROD_PC_2283562041014559581%2Cgpcid%3A2283562041014559581%2Cmid%3A576462846985605083%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=6ddf4017-bff3-416c-b9fd-2f37dc819ce3&title=Bio+Oil+Skincare+Oil&store=chemist4u&storeName=Chemist4U
```

### Cherry `(cherry)`  · relay=Y

**Product**: CHERRY MX 8.2 TKL Wireless

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A3074851917476312437%2CheadlineOfferDocid%3A11615647916404722432%2CimageDocid%3A11529095701507040748%2Crds%3APC_10811570922658462005%7CPROD_PC_10811570922658462005%2Cgpcid%3A10811570922658462005%2Cmid%3A576462755974888140%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=8830f509-ef41-4f4e-b368-b46de917200f&title=CHERRY+MX+8.2+TKL+Wireless&store=cherry&storeName=Cherry
```

### Chico's `(chico-s)`  · relay=Y

**Product**: Chico's Women's Travelers Classic Wrinkle-Free Pants

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A14773826225820137303%2Cproductid%3A7530098559078369123%2CheadlineOfferDocid%3A6317888949718270766%2CimageDocid%3A17285318854226977202%2Crds%3APC_12188288560848562469%7CPROD_PC_12188288560848562469%2Cgpcid%3A12188288560848562469%2Cmid%3A576462874185382734%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=3ef4d037-0fc4-45e6-b403-57669a476052&title=Chico%27s+Women%27s+Travelers+Classic+Wrinkle-Free+Pants&store=chico-s&storeName=Chico%27s
```

### Clicks `(clicks)`  · relay=Y

**Product**: Salex Saline Sinus Rinse SSR Kit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A17340165566402570996%2Cproductid%3A5793321873108558125%2CheadlineOfferDocid%3A4570797599275715783%2CimageDocid%3A10111366107515821711%2Cgpcid%3A18428955510101371728%2Cmid%3A576462869876577658%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=241a82c7-b89b-41df-b85c-6d4c5b73eff4&title=Salex+Saline+Sinus+Rinse+SSR+Kit&store=clicks&storeName=Clicks
```

### Clinique `(clinique)`  · relay=Y

**Product**: Clinique All About Shadow Quad

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A9598786405907917224%2Cproductid%3A14633585214378646915%2CheadlineOfferDocid%3A2881315649721586136%2CimageDocid%3A11026429726624476620%2Crds%3APC_6724299777315868684%7CPROD_PC_6724299777315868684%2Cgpcid%3A6724299777315868684%2Cmid%3A576462249607585487%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=434efcfc-5bb4-47b9-860d-16af3111289a&title=Clinique+All+About+Shadow+Quad&store=clinique&storeName=Clinique
```

### Clothing Junction `(clothing-junction)`  · relay=Y

**Product**: Wideleg Pants Stone / 7/8

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A3218135396108333674%2CheadlineOfferDocid%3A3218135396108333674%2CimageDocid%3A2409232764200187078%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=f775554b-5f2a-452d-b902-14c28899f6b0&title=Wideleg+Pants+Stone+%2F+7%2F8&store=clothing-junction&storeName=Clothing+Junction
```

### COACH `(coach)`  · relay=Y

**Product**: Coach Tabby Shoulder Bag

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A10922418214833134112%2Cproductid%3A8291357750711908681%2CheadlineOfferDocid%3A13963783060741409599%2CimageDocid%3A5912973704518149973%2Crds%3APC_670547604564428610%7CPROD_PC_670547604564428610%2Cgpcid%3A670547604564428610%2Cmid%3A576462899353755740%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=3c62552b-928a-497a-bff7-b9c94e2b3ba6&title=Coach+Tabby+Shoulder+Bag&store=coach&storeName=COACH
```

### Computech Store `(computech-store)`  · relay=Y

**Product**: Ant Esports H1100 Pro RGB Wired Gaming Headset

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A5189599238912893144%2Cproductid%3A16572165973314590437%2CheadlineOfferDocid%3A2502598591319922883%2CimageDocid%3A12586648630512717272%2Cgpcid%3A8163976272925656869%2Cmid%3A576462810937236295%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=b6d4ba61-d12d-458b-9880-6be285412cbd&title=Ant+Esports+H1100+Pro+RGB+Wired+Gaming+Headset&store=computech-store&storeName=Computech+Store
```

### Computer Mania `(computer-mania)`  · relay=Y

**Product**: Dell 24" Monitor SE2425HM

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A16890320630920333703%2CheadlineOfferDocid%3A4384665282864617884%2CimageDocid%3A4450818689887058532%2Crds%3APC_9332457554799819076%7CPROD_PC_9332457554799819076%2Cgpcid%3A9332457554799819076%2Cmid%3A576462847620201418%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=ae1a8c3d-ca05-4365-ae61-b42de42274a0&title=Dell+24%22+Monitor+SE2425HM&store=computer-mania&storeName=Computer+Mania
```

### Consumer Cellular `(consumer-cellular)`  · relay=Y

**Product**: Motorola Razr 2024

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A1386025002468438263%2Cproductid%3A773273628569962066%2CheadlineOfferDocid%3A17949633009012494933%2CimageDocid%3A9166873875951573837%2Crds%3APC_12108599778057196319%7CPROD_PC_12108599778057196319%2Cgpcid%3A12108599778057196319%2Cmid%3A576462517427930063%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=3865ae81-637a-481e-b755-97b18f6435ee&title=Motorola+Razr+2024&store=consumer-cellular&storeName=Consumer+Cellular
```

### Cosmetify `(cosmetify)`  · relay=Y

**Product**: Fenty Beauty Gloss Bomb Universal Lip Luminizer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A5781887429090767223%2Cproductid%3A7781656023368482269%2CheadlineOfferDocid%3A1788316658982933185%2CimageDocid%3A320044475214819496%2Crds%3APC_1478877050126496173%7CPROD_PC_1478877050126496173%2Cgpcid%3A1478877050126496173%2Cmid%3A576462333306229868%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=f027243a-70c7-42df-b8b8-f37ccae5e815&title=Fenty+Beauty+Gloss+Bomb+Universal+Lip+Luminizer&store=cosmetify&storeName=Cosmetify
```

### Craftbymerlin `(craftbymerlin)`  · relay=Y

**Product**: For Airpods Max Headphones, Silicone Cover for Apple Airpod Max Accessories Cases Silicone Case

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAirPods+Max%26prds%3Dproductid%3A9462570010789938021%2CheadlineOfferDocid%3A9462570010789938021%2CimageDocid%3A10324659759602954833%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=37e859db-9d1d-4280-b507-c24102a41e03&title=For+Airpods+Max+Headphones%2C+Silicone+Cover+for+Apple+Airpod+Max+Accessories+Cases+Silicone+Case&store=craftbymerlin&storeName=Craftbymerlin
```

### Crampton & Moore `(crampton-moore)`  · relay=Y

**Product**: Panasonic SC-PMX802E-S Premium Hi-Fi Audio System

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A7753223915065592976%2Cproductid%3A6766568478631236790%2CheadlineOfferDocid%3A3829894164459873440%2CimageDocid%3A9247369927499478181%2Crds%3APC_5770154752222502436%7CPROD_PC_5770154752222502436%2Cgpcid%3A5770154752222502436%2Cmid%3A576462587331714174%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=5a2c3026-e162-4ee8-9932-dc7c2bb1fce7&title=Panasonic+SC-PMX802E-S+Premium+Hi-Fi+Audio+System&store=crampton-moore&storeName=Crampton+%26+Moore
```

### Crate & Barrel `(crate-barrel)`  · relay=Y

**Product**: KitchenAid Fresh Prep Slicer/Shredder Attachment | Crate & Barrel

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A12379186852439621123%2CheadlineOfferDocid%3A12379186852439621123%2CimageDocid%3A8382204108502056449%2Crds%3APC_9722145463482495482%7CPROD_PC_9722145463482495482%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=0d40e7db-09cb-48bd-a412-346df2fb5321&title=KitchenAid+Fresh+Prep+Slicer%2FShredder+Attachment+%7C+Crate+%26+Barrel&store=crate-barrel&storeName=Crate+%26+Barrel
```

### crateandbarrel.com `(crateandbarrel)`  · relay=Y

**Product**: KitchenAid Artisan KSM195 Stand Mixer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A2916531701545596577%2Cproductid%3A11884740609574447209%2CheadlineOfferDocid%3A1029482423679726119%2CimageDocid%3A4806274741062535080%2Crds%3APC_44297843990613121%7CPROD_PC_44297843990613121%2Cgpcid%3A44297843990613121%2Cmid%3A576462881992250281%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=e9b01dbb-14dc-4bb0-892f-5f72366bf83f&title=KitchenAid+Artisan+KSM195+Stand+Mixer&store=crateandbarrel&storeName=crateandbarrel.com
```

### Creative Labs `(creative-labs)`  · relay=Y

**Product**: Creative Sound Blaster Z SE Gaming and Entertainment Sound Card and DAC

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A1479206943939999607%2Cproductid%3A2836561303615082194%2CheadlineOfferDocid%3A2962716601543923880%2CimageDocid%3A18122795057596419783%2Crds%3APC_11368330377756208467%7CPROD_PC_11368330377756208467%2Cgpcid%3A11368330377756208467%2Cmid%3A576462879083080854%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=88b32a91-ddf5-4a90-bb67-6451ee7ee7c7&title=Creative+Sound+Blaster+Z+SE+Gaming+and+Entertainment+Sound+Card+and+DAC&store=creative-labs&storeName=Creative+Labs
```

### Cricket Wireless `(cricket-wireless)`  · relay=Y

**Product**: Apple iPhone 17e

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A17933694113703965261%2Cproductid%3A14651588985570776420%2CheadlineOfferDocid%3A9999412624426118357%2CimageDocid%3A258767452008743350%2Crds%3APC_15096775703250617709%7CPROD_PC_15096775703250617709%2Cgpcid%3A15096775703250617709%2Cmid%3A576462883654484663%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7120cde8-ec56-48cc-8ac4-a53be5241c81&title=Apple+iPhone+17e&store=cricket-wireless&storeName=Cricket+Wireless
```

### crocs.com `(crocs)`  · relay=Y

**Product**: Crocs Adult Baya Clog

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A16377130850214280517%2Cproductid%3A2514847158878520018%2CheadlineOfferDocid%3A17132929878989308508%2CimageDocid%3A17617783034698141993%2Crds%3APC_5616369494053303732%7CPROD_PC_5616369494053303732%2Cgpcid%3A5616369494053303732%2Cmid%3A576462775159571712%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=638151d3-f4e0-4f88-9e0d-d63fd0e692a0&title=Crocs+Adult+Baya+Clog&store=crocs&storeName=crocs.com
```

### Crutchfield `(crutchfield)`  · relay=Y

**Product**: Denon AVR-S970H 7.2 Channel 8K Receiver

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A3622309273888155503%2Cproductid%3A1925240748165165249%2CheadlineOfferDocid%3A16193919769553432692%2CimageDocid%3A14509410856820413167%2Crds%3APC_13106964478176619635%7CPROD_PC_13106964478176619635%2Cgpcid%3A13106964478176619635%2Cmid%3A576462459262491711%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=f766ef28-7787-4be6-b182-c229fc22251a&title=Denon+AVR-S970H+7.2+Channel+8K+Receiver&store=crutchfield&storeName=Crutchfield
```

### Cult Beauty `(cult-beauty)`  · relay=Y

**Product**: Charlotte Tilbury Charlotte's Beautiful Skin Foundation

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A16181951725220129884%2Cproductid%3A6876664005092029796%2CheadlineOfferDocid%3A10153873251042391458%2CimageDocid%3A14269116911351320393%2Crds%3APC_13679902865771473393%7CPROD_PC_13679902865771473393%2Cgpcid%3A13679902865771473393%2Cmid%3A576462691163537471%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b97a5bd8-9845-4765-859e-59a6e2daa1e2&title=Charlotte+Tilbury+Charlotte%27s+Beautiful+Skin+Foundation&store=cult-beauty&storeName=Cult+Beauty
```

### Danish Endurance `(danish-endurance)`  · relay=Y

**Product**: DANISH ENDURANCE Long Distance Running Quarter Socks, Black/Grey | Blue/Yellow | Grey/Black Size 39-42

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A15067001741768107349%2CheadlineOfferDocid%3A15067001741768107349%2CimageDocid%3A9692975403863178744%2Crds%3APC_5193356258737433319%7CPROD_PC_5193356258737433319%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=86d67094-efd4-4257-9b7d-830fa26de0fc&title=DANISH+ENDURANCE+Long+Distance+Running+Quarter+Socks%2C+Black%2FGrey+%7C+Blue%2FYellow+%7C+Grey%2FBlack+Size+39-42&store=danish-endurance&storeName=Danish+Endurance
```

### Darling Retail `(darling-retail)`  · relay=Y

**Product**: Apple iPhone 16 Plus

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A6775999543702595892%2Cproductid%3A6041523418881858267%2CheadlineOfferDocid%3A15214118321954738843%2CimageDocid%3A12054085249769581629%2Crds%3APC_8897179128216049295%7CPROD_PC_8897179128216049295%2Cgpcid%3A8897179128216049295%2Cmid%3A576462819791058017%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=ef9ea831-aa5c-492b-9dd8-6130b981d790&title=Apple+iPhone+16+Plus&store=darling-retail&storeName=Darling+Retail
```

### DB Domestics `(db-domestics)`  · relay=Y

**Product**: Fridgemaster mtl55242e Tall Larder Fridge

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A18235722556128153512%2Cproductid%3A10853421369805842819%2CheadlineOfferDocid%3A8074387199810380346%2CimageDocid%3A7791441778531588713%2Crds%3APC_13044250864028026166%7CPROD_PC_13044250864028026166%2Cgpcid%3A13044250864028026166%2Cmid%3A576462755353289738%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=b06b4804-96d0-4def-94ab-866f019e3e95&title=Fridgemaster+mtl55242e+Tall+Larder+Fridge&store=db-domestics&storeName=DB+Domestics
```

### Decathlon South Africa `(decathlon-south-africa)`  · relay=Y

**Product**: Decathlon Reversible Captain's Armband Youth Orange Versatile for Soccer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A3234267875671081066%2CheadlineOfferDocid%3A1408069940944493290%2CimageDocid%3A1060127576716248130%2Crds%3APC_7595277952601790519%7CPROD_PC_7595277952601790519%2Cgpcid%3A7595277952601790519%2Cmid%3A576462869826341004%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=ad76afd2-5ba3-424c-8377-200dd500ef28&title=Decathlon+Reversible+Captain%27s+Armband+Youth+Orange+Versatile+for+Soccer&store=decathlon-south-africa&storeName=Decathlon+South+Africa
```

### Decathlon UK `(decathlon-uk)`  · relay=Y

**Product**: Phoenix Fitness Complete Weight Set 15kg

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A2286532027125499861%2Cproductid%3A2766828287025027440%2CheadlineOfferDocid%3A17846316928141073826%2CimageDocid%3A9348515266743319503%2Crds%3APC_11335333389349391867%7CPROD_PC_11335333389349391867%2Cgpcid%3A11335333389349391867%2Cmid%3A576462434408082605%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=470a4dfc-601d-4ee6-a50a-17fc275678b8&title=Phoenix+Fitness+Complete+Weight+Set+15kg&store=decathlon-uk&storeName=Decathlon+UK
```

### DeckUp `(deckup)`  · relay=Y

**Product**: DeckUp Reno Ladder Book Shelf: Stylish & Functional Storage" Dark Wenge

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A16106579059070385363%2CheadlineOfferDocid%3A16106579059070385363%2CimageDocid%3A16637431984457424256%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=9f894391-0452-4373-85d9-0c50126891d1&title=DeckUp+Reno+Ladder+Book+Shelf%3A+Stylish+%26+Functional+Storage%22+Dark+Wenge&store=deckup&storeName=DeckUp
```

### Decure.in `(decure-in)`  · relay=Y

**Product**: Faber Hob Experia Ht904 ALU AI FFD|Flame Failure Device

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A14098647778424072707%2Cproductid%3A9413099671137751363%2CheadlineOfferDocid%3A13260657226825630277%2CimageDocid%3A962345544141259457%2Cgpcid%3A16739419687958864993%2Cmid%3A576462796572578304%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=0ef2f573-c3fd-4564-9d7e-e6e003548ce1&title=Faber+Hob+Experia+Ht904+ALU+AI+FFD%7CFlame+Failure+Device&store=decure-in&storeName=Decure.in
```

### Dell `(dell)`  · relay=Y

**Product**: Dell Slim Desktop Ecs1250 Intel Core Ultra 7 265

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A3991862290397837840%2Cproductid%3A6618840892576879433%2CheadlineOfferDocid%3A2828110276105799062%2CimageDocid%3A16375091264236808317%2Crds%3APC_8557073315107204079%7CPROD_PC_8557073315107204079%2Cgpcid%3A8557073315107204079%2Cmid%3A576462866083993338%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=d37cbd22-ed0f-4bcb-ba96-cd60308ecf01&title=Dell+Slim+Desktop+Ecs1250+Intel+Core+Ultra+7+265&store=dell&storeName=Dell
```

### Dell South Africa `(dell-south-africa)`  · relay=Y

**Product**: Dell 24" Monitor SE2425HM

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A16890320630920333703%2Cproductid%3A6029476806912433823%2CheadlineOfferDocid%3A10208078348987386112%2CimageDocid%3A3200245885873597802%2Crds%3APC_9332457554799819076%7CPROD_PC_9332457554799819076%2Cgpcid%3A9332457554799819076%2Cmid%3A576462847620201418%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=da374096-c8e1-464b-9d8d-f109874b5ddd&title=Dell+24%22+Monitor+SE2425HM&store=dell-south-africa&storeName=Dell+South+Africa
```

### Dell UK `(dell-uk)`  · relay=Y

**Product**: Dell Pro Micro Plus Desktop - w/ Windows 11 Pro & Intel Core Ultra 7 - 16GB - 512GB SSD - AI Capable - BTS105_QBM1250_WER - Dell Optiplex

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dproductid%3A1170758570991395815%2CheadlineOfferDocid%3A1170758570991395815%2CimageDocid%3A17611202441492626901%2Crds%3APC_3369997569720555762%7CPROD_PC_3369997569720555762%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=1b553183-c1cf-41d9-8ef4-2187b4773740&title=Dell+Pro+Micro+Plus+Desktop+-+w%2F+Windows+11+Pro+%26+Intel+Core+Ultra+7+-+16GB+-+512GB+SSD+-+AI+Capable+-+BTS105_QBM1250_WE&store=dell-uk&storeName=Dell+UK
```

### desertcart.in `(desertcart-in)`  · relay=Y

**Product**: MB Quart Formula Series 6.5" Component Speaker System

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A13549733617685425188%2Cproductid%3A367066235860034980%2CheadlineOfferDocid%3A4823961986717229424%2CimageDocid%3A8822097201229596192%2Crds%3APC_669596655952663230%7CPROD_PC_669596655952663230%2Cgpcid%3A669596655952663230%2Cmid%3A576462783364185824%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=e3009136-3d38-4f3b-b327-9002696af86a&title=MB+Quart+Formula+Series+6.5%22+Component+Speaker+System&store=desertcart-in&storeName=desertcart.in
```

### Dhabi One ظبي ون `(dhabi-one)`  · relay=Y

**Product**: Dyson V15 Detect Absolute Cordless Vacuum Cleaner

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A14291408632655934750%2Cproductid%3A10532847186164974874%2CheadlineOfferDocid%3A2267260860215537382%2CimageDocid%3A3540224192603300411%2Crds%3APC_3179591074276238152%7CPROD_PC_3179591074276238152%2Cgpcid%3A3179591074276238152%2Cmid%3A576462852948626346%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=e91844e6-1253-48dc-92be-1d15f3613631&title=Dyson+V15+Detect+Absolute+Cordless+Vacuum+Cleaner&store=dhabi-one&storeName=Dhabi+One+%D8%B8%D8%A8%D9%8A+%D9%88%D9%86
```

### DHgate `(dhgate)`  · relay=N

**Product**: Original Earphones For Apple iPhone 14 Pro Max Lightning Headphones 13 12 11 Mini X XS XR SE 6 7 8 Plus Wired In-Ear Cal

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.dhgate.com%2Fproduct%2Foriginal-earphones-for-apple-iphone-14-pro%2F1095705226.html&id=8ff08cff-825d-4e58-a8b2-85db600cab0b&title=Original+Earphones+For+Apple+iPhone+14+Pro+Max+Lightning+Headphones+13+12+11+Mini+X+XS+XR+SE+6+7+8+Plus+Wired+In-Ear+Cal&store=dhgate&storeName=DHgate
```

### Didi Beauty `(didi-beauty)`  · relay=Y

**Product**: Try Everything Bundle I Didi Beauty Co Bundle 2

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A1036475385099819362%2CheadlineOfferDocid%3A1036475385099819362%2CimageDocid%3A8230537109235747283%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=12fdccc8-ce58-40db-a8a6-a86186aad0e9&title=Try+Everything+Bundle+I+Didi+Beauty+Co+Bundle+2&store=didi-beauty&storeName=Didi+Beauty
```

### Digital Arcade `(digital-arcade)`  · relay=Y

**Product**: Samsung Galaxy Z Fold7

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A15472136037518646121%2Cproductid%3A5309766529572017740%2CheadlineOfferDocid%3A12808527249783436141%2CimageDocid%3A2643338985907364884%2Crds%3APC_16337891081947337161%7CPROD_PC_16337891081947337161%2Cgpcid%3A16337891081947337161%2Cmid%3A576462833777183171%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=4f97acb8-e285-4ea4-99d6-179e9c231eb7&title=Samsung+Galaxy+Z+Fold7&store=digital-arcade&storeName=Digital+Arcade
```

### Dillard's `(dillard-s)`  · relay=Y

**Product**: Crystal Doll Ruffle Sleeve Fit & Flare Dress Womens Juniors

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A8913010265574999007%2Cproductid%3A5497656322509299369%2CheadlineOfferDocid%3A15422236346958618197%2CimageDocid%3A516954632794931887%2Crds%3APC_796452752195852555%7CPROD_PC_796452752195852555%2Cgpcid%3A796452752195852555%2Cmid%3A576462603609550268%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=aa3b5389-a5ce-4715-a1e2-e598cd9159dd&title=Crystal+Doll+Ruffle+Sleeve+Fit+%26+Flare+Dress+Womens+Juniors&store=dillard-s&storeName=Dillard%27s
```

### Direct Deals `(direct-deals)`  · relay=Y

**Product**: Bosch PKE611BA2E 60cm Ceran Hob

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A3368429109038365445%2Cproductid%3A11050811725430299222%2CheadlineOfferDocid%3A1498242458587685751%2CimageDocid%3A8242349184472365515%2Crds%3APC_6011681690797924506%7CPROD_PC_6011681690797924506%2Cgpcid%3A6011681690797924506%2Cmid%3A576462736051295621%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=1293c17d-5576-4bde-8014-be535b78fe06&title=Bosch+PKE611BA2E+60cm+Ceran+Hob&store=direct-deals&storeName=Direct+Deals
```

### Dis-Chem `(dis-chem)`  · relay=Y

**Product**: Portia M Marula Skin Day Cream 50ml

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A1095499269840317006%2Cproductid%3A12950549588443864821%2CheadlineOfferDocid%3A18123156914995923260%2CimageDocid%3A5839440352989971635%2Cgpcid%3A3724276467397433967%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=058248fd-156e-4984-b815-256a250c8cc8&title=Portia+M+Marula+Skin+Day+Cream+50ml&store=dis-chem&storeName=Dis-Chem
```

### distriscenes.com `(distriscenes)`  · relay=Y

**Product**: Yamaha Dzr10d Dante

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A12238969902971666938%2Cproductid%3A6643503727801341740%2CheadlineOfferDocid%3A10905180189040437939%2CimageDocid%3A3756622263432029150%2Cgpcid%3A7434819001607077392%2Cmid%3A576462900030525374%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=7e02dc51-109d-41a7-bd0d-cb959e771e32&title=Yamaha+Dzr10d+Dante&store=distriscenes&storeName=distriscenes.com
```

### Dock & Bay `(dock-bay)`  · relay=Y

**Product**: Dock & Bay Beauty Box Tiger Palm

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A3455916490586300749%2Cproductid%3A6103278422440995012%2CheadlineOfferDocid%3A8896471544450853213%2CimageDocid%3A2437478200308786143%2Crds%3APC_4885477757898594379%7CPROD_PC_4885477757898594379%2Cgpcid%3A4885477757898594379%2Cmid%3A576462836119825125%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=b2417c9e-e150-409d-b854-056aea99c98a&title=Dock+%26+Bay+Beauty+Box+Tiger+Palm&store=dock-bay&storeName=Dock+%26+Bay
```

### Dollar's Fashion `(dollar-s-fashion)`  · relay=Y

**Product**: Buy Women's Elegant Grey High Heel Sandals Online

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A10454309421480339956%2Cproductid%3A8352179616892256955%2CheadlineOfferDocid%3A8838508596279604815%2CimageDocid%3A17158187787660783296%2Cgpcid%3A10207547092810639542%2Cmid%3A576462866086622751%2Cpvt%3Aa%26hl%3Den%26gl%3Dae%26udm%3D28&id=5b7f3a88-5641-49d6-b18d-8df10da5a701&title=Buy+Women%27s+Elegant+Grey+High+Heel+Sandals+Online&store=dollar-s-fashion&storeName=Dollar%27s+Fashion
```

### Dorothy Perkins UK `(dorothy-perkins-uk)`  · relay=Y

**Product**: Boohoo Women's Tall Super Soft Rib Knitted Boyfriend Cardigan and Wide Leg Trouser Co-Ord

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A4646105730478259716%2Cproductid%3A4702924197511034767%2CheadlineOfferDocid%3A12425968564707502887%2CimageDocid%3A7819499064608829808%2Cgpcid%3A12010046585876650643%2Cmid%3A576462872833692473%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=cafe82f0-e043-458d-998f-d8c3064ef314&title=Boohoo+Women%27s+Tall+Super+Soft+Rib+Knitted+Boyfriend+Cardigan+and+Wide+Leg+Trouser+Co-Ord&store=dorothy-perkins-uk&storeName=Dorothy+Perkins+UK
```

### Dowinx `(dowinx)`  · relay=Y

**Product**: Dowinx Gaming Chair

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A14889811701087769009%2CheadlineOfferDocid%3A2495016007257372804%2CimageDocid%3A15033575583944078199%2Crds%3APC_3843957042117852837%7CPROD_PC_3843957042117852837%2Cgpcid%3A3843957042117852837%2Cmid%3A576462821139736917%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=15514b8a-88dd-452e-8d17-5a4347d58ed0&title=Dowinx+Gaming+Chair&store=dowinx&storeName=Dowinx
```

### Driffle `(driffle)`  · relay=Y

**Product**: Grand Theft Auto V Premium

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A8800179187521194522%2Cproductid%3A4902489712411597712%2CheadlineOfferDocid%3A9990458175875064984%2CimageDocid%3A18187133982713620016%2Crds%3APC_5209999734052668964%7CPROD_PC_5209999734052668964%2Cgpcid%3A15472166308351335856%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=896c5ade-531b-424a-9936-3baa531a42d6&title=Grand+Theft+Auto+V+Premium&store=driffle&storeName=Driffle
```

### DSW `(dsw)`  · relay=Y

**Product**: Crocs Classic Clog | Men | Women's | Atmosphere Light Grey | Size Men's 12 | Clogs | Slingback

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCrocs+Classic+Clog+deals%26prds%3Dproductid%3A2251737619378432246%2CheadlineOfferDocid%3A2251737619378432246%2CimageDocid%3A4766125004461713316%2Crds%3APC_5803906498614987482%7CPROD_PC_5803906498614987482%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=a0857f40-e300-4d4d-ac1b-f5dc28131bb3&title=Crocs+Classic+Clog+%7C+Men+%7C+Women%27s+%7C+Atmosphere+Light+Grey+%7C+Size+Men%27s+12+%7C+Clogs+%7C+Slingback&store=dsw&storeName=DSW
```

### DTLR `(dtlr)`  · relay=Y

**Product**: Nike Dunk Low Men's Reverse Panda 2.0

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike+Dunk+Low%26prds%3Dcatalogid%3A11592823289501530582%2Cproductid%3A8212822229741991203%2CheadlineOfferDocid%3A16953177609197101945%2CimageDocid%3A16545618208475128852%2Crds%3APC_18187982296061003056%7CPROD_PC_18187982296061003056%2Cgpcid%3A18187982296061003056%2Cmid%3A576462556058829627%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=e8e04ef8-d2ee-4492-8a7c-2f6f943aafb7&title=Nike+Dunk+Low+Men%27s+Reverse+Panda+2.0&store=dtlr&storeName=DTLR
```

### Dubai Audio `(dubai-audio)`  · relay=Y

**Product**: Klipsch GIG XL Portable Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A4274114218267846271%2Cproductid%3A1697804651258055618%2CheadlineOfferDocid%3A6912749193470269093%2CimageDocid%3A11422596732175652004%2Crds%3APC_8958684257284476926%7CPROD_PC_8958684257284476926%2Cgpcid%3A8958684257284476926%2Cmid%3A576462511257469350%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=2dbcce6e-08ff-498c-bf85-1ed7df4109df&title=Klipsch+GIG+XL+Portable+Speaker&store=dubai-audio&storeName=Dubai+Audio
```

### Dunns `(dunns)`  · relay=Y

**Product**: ISLA GEO DRAPE TOP

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A8094469452802957606%2Cproductid%3A17040838588302712561%2CheadlineOfferDocid%3A4943528149608109431%2CimageDocid%3A10881977989660159255%2Cgpcid%3A10125144181428174856%2Cmid%3A576462877665110609%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=b646c590-773c-4a1b-bfcc-ad7d759a4c53&title=ISLA+GEO+DRAPE+TOP&store=dunns&storeName=Dunns
```

### Dyson Official `(dyson-official)`  · relay=Y

**Product**: Dyson V11 Extra Cordless Vacuum Cleaner

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDyson+V11+deals%26prds%3Dcatalogid%3A11944531526556639329%2Cproductid%3A12072414516241783582%2CheadlineOfferDocid%3A11696926795806659833%2CimageDocid%3A12283172237660129516%2Crds%3APC_6636064211345318012%7CPROD_PC_6636064211345318012%2Cgpcid%3A6636064211345318012%2Cmid%3A576462813216089154%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=d48ae483-df50-4c64-ac43-7d2f571a2b0a&title=Dyson+V11+Extra+Cordless+Vacuum+Cleaner&store=dyson-official&storeName=Dyson+Official
```

### dyson.com `(dyson)`  · relay=Y

**Product**: Citi Card Off | Dyson V11 Absolute (Latest Technology) Cordless Stick Vacuum Cleaner

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDyson+V11+deals%26prds%3Dcatalogid%3A2634055726984767921%2Cproductid%3A11945361479363463425%2CheadlineOfferDocid%3A6357854444485811678%2CimageDocid%3A10955514143990677892%2Crds%3APC_2277066239532796587%7CPROD_PC_2277066239532796587%2Cgpcid%3A2277066239532796587%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c95221c5-25aa-462e-a6cc-2a7e05526a7b&title=Citi+Card+Off+%7C+Dyson+V11+Absolute+%28Latest+Technology%29+Cordless+Stick+Vacuum+Cleaner&store=dyson&storeName=dyson.com
```

### e2zSTORE `(e2zstore)`  · relay=Y

**Product**: Logitech G431 Gaming Headset

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A14716340243668209016%2Cproductid%3A2693505363648249877%2CheadlineOfferDocid%3A503960358237244030%2CimageDocid%3A245199741664258020%2Crds%3APC_4542330086233171279%7CPROD_PC_4542330086233171279%2Cgpcid%3A4542330086233171279%2Cmid%3A576462807281294415%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=53a5c203-b861-4338-9975-fba74df0808b&title=Logitech+G431+Gaming+Headset&store=e2zstore&storeName=e2zSTORE
```

### eCosmetics `(ecosmetics)`  · relay=Y

**Product**: Clinique Even Better Makeup SPF 15

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A15915632138624510106%2Cproductid%3A17084693786616773358%2CheadlineOfferDocid%3A4789462754096247921%2CimageDocid%3A184909118211717406%2Crds%3APC_10409066698891336492%7CPROD_PC_10409066698891336492%2Cgpcid%3A10409066698891336492%2Cmid%3A576462224915897772%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=be4566b1-e510-4a0d-95bd-41dfd9776180&title=Clinique+Even+Better+Makeup+SPF+15&store=ecosmetics&storeName=eCosmetics
```

### Edgars `(edgars)`  · relay=Y

**Product**: Xiaomi Redmi 15c 128GB 4G Dual Sim Cellphone - Black - Box Deal - Telkom / Dual Sim / No

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dproductid%3A14349012242960597026%2CheadlineOfferDocid%3A14349012242960597026%2CimageDocid%3A11921310767102376796%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=c378a727-be35-4691-8170-52f5c68aa7d1&title=Xiaomi+Redmi+15c+128GB+4G+Dual+Sim+Cellphone+-+Black+-+Box+Deal+-+Telkom+%2F+Dual+Sim+%2F+No&store=edgars&storeName=Edgars
```

### EdiSchoolMart `(edischoolmart)`  · relay=Y

**Product**: Nivia Europa Moulded Basketball

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A7836203528806891998%2CheadlineOfferDocid%3A7836203528806891998%2CimageDocid%3A9236253846432063556%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=452cc141-0f1e-460a-9b00-c2f419beb12c&title=Nivia+Europa+Moulded+Basketball&store=edischoolmart&storeName=EdiSchoolMart
```

### EE `(ee)`  · relay=Y

**Product**: Samsung Crystal UHD U8020F 4K Smart TV

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSamsung+55+inch+QLED+TV+deals%26prds%3Dproductid%3A4833017390659667074%2CheadlineOfferDocid%3A4833017390659667074%2CimageDocid%3A11985076369047579178%2Crds%3APC_4780694665193336166%7CPROD_PC_4780694665193336166%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=92f8af3f-5fb5-49b2-8bc2-6a0fde1f7a60&title=Samsung+Crystal+UHD+U8020F+4K+Smart+TV&store=ee&storeName=EE
```

### Electronic Express `(electronic-express)`  · relay=Y

**Product**: Frigidaire Gallery 4 Pc. Stainless Steel French Door Kitchen Package

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A17883223870918764759%2CheadlineOfferDocid%3A17883223870918764759%2CimageDocid%3A16238692008855209197%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=aeb88a89-280e-4f6c-a9bc-4cd1dcfcf472&title=Frigidaire+Gallery+4+Pc.+Stainless+Steel+French+Door+Kitchen+Package&store=electronic-express&storeName=Electronic+Express
```

### Electronic Paradise `(electronic-paradise)`  · relay=Y

**Product**: LG XBOOM RNC5 Party Bluetooth v5.2 Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A2129499185188610671%2Cproductid%3A1340622421072691601%2CheadlineOfferDocid%3A10138580977763325550%2CimageDocid%3A1650951728588688345%2Crds%3APC_6714872000360892062%7CPROD_PC_6714872000360892062%2Cgpcid%3A6714872000360892062%2Cmid%3A576462790276887740%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=9ec03597-7efd-4217-82a4-1562249e8afd&title=LG+XBOOM+RNC5+Party+Bluetooth+v5.2+Speaker&store=electronic-paradise&storeName=Electronic+Paradise
```

### Elys Wimbledon `(elys-wimbledon)`  · relay=Y

**Product**: Le Creuset Stoneware Butter Dish | Black - Elys Wimbledon

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A6893789182640371885%2CheadlineOfferDocid%3A6893789182640371885%2CimageDocid%3A4696849189510441860%2Crds%3APC_770426141031112616%7CPROD_PC_770426141031112616%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=7a36bd87-22ef-4cda-9f85-77a9c5603142&title=Le+Creuset+Stoneware+Butter+Dish+%7C+Black+-+Elys+Wimbledon&store=elys-wimbledon&storeName=Elys+Wimbledon
```

### Emax Electronics `(emax-electronics)`  · relay=Y

**Product**: Trands Bluetooth 2.4G Wireless Optical Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A15826902764169695583%2Cproductid%3A14158103257596644779%2CheadlineOfferDocid%3A6011862991426349824%2CimageDocid%3A16779612830309166466%2Cgpcid%3A11160248018732905596%2Cmid%3A576462715208810675%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=3b293ad2-4821-44fd-9fe0-884e0455f9c8&title=Trands+Bluetooth+2.4G+Wireless+Optical+Mouse&store=emax-electronics&storeName=Emax+Electronics
```

### EMI Snapmint `(emi-snapmint)`  · relay=Y

**Product**: Google Pixel 8a

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A8527858940626690507%2CheadlineOfferDocid%3A3598566946291130394%2CimageDocid%3A3618136499935983995%2Crds%3APC_11854671936836665392%7CPROD_PC_11854671936836665392%2Cgpcid%3A11854671936836665392%2Cmid%3A576462777896003990%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=e305f8a6-81ae-4be4-b228-bedfb8bbef5a&title=Google+Pixel+8a&store=emi-snapmint&storeName=EMI+Snapmint
```

### Eshtir.com `(eshtir)`  · relay=Y

**Product**: Beats Studio Buds + True Wireless Earbuds

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeats+Studio+Pro+deals%26prds%3Dcatalogid%3A9463385577158812808%2Cproductid%3A10189238899689274687%2CheadlineOfferDocid%3A15268999410034645523%2CimageDocid%3A14617620716410621568%2Crds%3APC_11765044586824879111%7CPROD_PC_11765044586824879111%2Cgpcid%3A11765044586824879111%2Cmid%3A576462826116478068%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=46df1d3e-4536-48a6-ba05-39ea4f886275&title=Beats+Studio+Buds+%2B+True+Wireless+Earbuds&store=eshtir&storeName=Eshtir.com
```

### Essenza `(essenza)`  · relay=N

**Product**: Black Up Fdt Creme Haute Couvrance

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.essenza.ng%2Fproducts%2Fblack-up-fdt-creme-haute-couvrance&id=ee0f2313-064b-438d-a255-683b79b9e34b&title=Black+Up+Fdt+Creme+Haute+Couvrance&store=essenza&storeName=Essenza
```

### Euronics Fischer `(euronics-fischer)`  · relay=Y

**Product**: Motorola moto g86 Smartphone cosmic sky gray

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dproductid%3A5639801399790451843%2CheadlineOfferDocid%3A5639801399790451843%2CimageDocid%3A14237426755915869508%2Crds%3APC_3738926150416260830%7CPROD_PC_3738926150416260830%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=c76da7ea-ff46-4c45-9af6-872fd7ad3593&title=Motorola+moto+g86+Smartphone+cosmic+sky+gray&store=euronics-fischer&storeName=Euronics+Fischer
```

### Evetech.co.za `(evetech)`  · relay=Y

**Product**: GAMDIAS Gaming RGB ATX Mid-Tower White Gaming PC Case, 3 Built-in 120mm Fixed RGB Fans, Tempered Glass Side Panel

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12843829702735425263%2CheadlineOfferDocid%3A2193167448177047307%2CimageDocid%3A6343386071416952917%2Crds%3APC_262713380867433340%7CPROD_PC_262713380867433340%2Cgpcid%3A262713380867433340%2Cmid%3A576462790049282647%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=d04feec0-b65c-4181-b146-71b57ed8fe9c&title=GAMDIAS+Gaming+RGB+ATX+Mid-Tower+White+Gaming+PC+Case%2C+3+Built-in+120mm+Fixed+RGB+Fans%2C+Tempered+Glass+Side+Panel&store=evetech&storeName=Evetech.co.za
```

### Express `(express)`  · relay=Y

**Product**: Express Women's Studio Stretch Twill Fold Over Strapless Tailored Top

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A13231976487259991754%2Cproductid%3A13645479435814418110%2CheadlineOfferDocid%3A1394840301512119719%2CimageDocid%3A8218516844718319566%2Crds%3APC_4195193122139468896%7CPROD_PC_4195193122139468896%2Cgpcid%3A4195193122139468896%2Cmid%3A576462870431427485%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=78d574d7-3223-4ad4-a4ac-5d7be8a790ed&title=Express+Women%27s+Studio+Stretch+Twill+Fold+Over+Strapless+Tailored+Top&store=express&storeName=Express
```

### Face the Future `(face-the-future)`  · relay=Y

**Product**: Gatineau Radiance Enhancing Vitamin C Serum 7ml

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A18047960660660940707%2CheadlineOfferDocid%3A18047960660660940707%2CimageDocid%3A14713385094265909828%2Crds%3APC_3592761657694012820%7CPROD_PC_3592761657694012820%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=6af88a07-7a21-4dd4-88e4-053eebf46080&title=Gatineau+Radiance+Enhancing+Vitamin+C+Serum+7ml&store=face-the-future&storeName=Face+the+Future
```

### Fashion World `(fashion-world)`  · relay=Y

**Product**: Plus Size - Fashion World Linen Mix Tapered Trousers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A5451024072437608217%2CheadlineOfferDocid%3A5451024072437608217%2CimageDocid%3A15681412341597426625%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=9f9bc871-28d2-4fa2-8274-f99cbc7f7564&title=Plus+Size+-+Fashion+World+Linen+Mix+Tapered+Trousers&store=fashion-world&storeName=Fashion+World
```

### Fastrak `(fastrak)`  · relay=Y

**Product**: Eclipse Class D Monoblock [EA-MB8200.1] - Monoblocks

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A6905972360364114179%2CheadlineOfferDocid%3A6905972360364114179%2CimageDocid%3A1791945537887310918%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=f70b59f0-b0ee-4d66-b523-171039a2472f&title=Eclipse+Class+D+Monoblock+%5BEA-MB8200.1%5D+-+Monoblocks&store=fastrak&storeName=Fastrak
```

### Feel `(feel)`  · relay=Y

**Product**: Feel Multivitamin 60 Capsules

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A191442317023163269%2Cproductid%3A5689168314444790283%2CheadlineOfferDocid%3A11452824364946439883%2CimageDocid%3A15983899401890244037%2Crds%3APC_4315849776650545459%7CPROD_PC_4315849776650545459%2Cgpcid%3A4315849776650545459%2Cmid%3A576462609556713727%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=68ce0fe5-aec8-4549-92c6-1ea3dd1c5859&title=Feel+Multivitamin+60+Capsules&store=feel&storeName=Feel
```

### Fenty Beauty `(fenty-beauty)`  · relay=Y

**Product**: Fenty Beauty Lil' Glossy Lil' Thicc Lip + Eye Duo

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFenty+Beauty+Gloss+Bomb+deals%26prds%3Dcatalogid%3A836120360866180875%2Cproductid%3A9166667993805734445%2CheadlineOfferDocid%3A15079189835024214984%2CimageDocid%3A11295625316817751950%2Crds%3APC_4155136463196198253%7CPROD_PC_4155136463196198253%2Cgpcid%3A4155136463196198253%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=edb6f360-d732-4150-af7d-663b3fd52e64&title=Fenty+Beauty+Lil%27+Glossy+Lil%27+Thicc+Lip+%2B+Eye+Duo&store=fenty-beauty&storeName=Fenty+Beauty
```

### Fenty Beauty EU `(fenty-beauty-eu)`  · relay=Y

**Product**: Fenty Beauty Pro Filt'r Soft Matte Longwear Foundation

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A16158323531827959845%2Cproductid%3A18438536184002291824%2CheadlineOfferDocid%3A979490266509026717%2CimageDocid%3A8133834817265298099%2Crds%3APC_16190591014885023720%7CPROD_PC_16190591014885023720%2Cgpcid%3A16190591014885023720%2Cmid%3A576462378635079142%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=3389a943-2939-44f1-bbc9-3b1e711d20c4&title=Fenty+Beauty+Pro+Filt%27r+Soft+Matte+Longwear+Foundation&store=fenty-beauty-eu&storeName=Fenty+Beauty+EU
```

### FiltersFast.com `(filtersfast)`  · relay=Y

**Product**: Whirlpool EveryDrop Refrigerator Water Filter 1 edr1rxd1

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A1727335238485844902%2Cproductid%3A11117071526741019553%2CheadlineOfferDocid%3A7948939831636294710%2Crds%3APC_15678252003310903825%7CPROD_PC_15678252003310903825%2Cgpcid%3A15678252003310903825%2Cmid%3A576462810173717866%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=573c41ff-0cb0-4a89-8083-4faa23261978&title=Whirlpool+EveryDrop+Refrigerator+Water+Filter+1+edr1rxd1&store=filtersfast&storeName=FiltersFast.com
```

### Finish Line `(finish-line)`  · relay=Y

**Product**: Nike Men's Shox Ride 2 Sneakers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A6201080455833026755%2Cproductid%3A12378420781262343850%2CheadlineOfferDocid%3A506160498068467176%2CimageDocid%3A10947005942828967369%2Crds%3APC_7039298701497499551%7CPROD_PC_7039298701497499551%2Cgpcid%3A7039298701497499551%2Cmid%3A576462833085465802%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=6a2fc3b9-eee4-41d4-8a6f-b35c45e50f75&title=Nike+Men%27s+Shox+Ride+2+Sneakers&store=finish-line&storeName=Finish+Line
```

### FirstShop.co.za `(firstshop)`  · relay=Y

**Product**: Pcbuilder Cube Intel I5-1235u 16gb Ddr4 1tb Windows 11 Pro Mini Pc

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A6761376352464167323%2Cproductid%3A1896852518329055324%2CheadlineOfferDocid%3A4829678978121767006%2CimageDocid%3A3292690680123076480%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=b4b916b8-0e9e-4635-a7fc-06e3317a5c33&title=Pcbuilder+Cube+Intel+I5-1235u+16gb+Ddr4+1tb+Windows+11+Pro+Mini+Pc&store=firstshop&storeName=FirstShop.co.za
```

### Fit2Run, The Runner's Superstore `(fit2run-the-runner-s-superstore)`  · relay=Y

**Product**: Nike Alphafly 3

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A4600749892006650705%2Cproductid%3A18412851562631163351%2CheadlineOfferDocid%3A763355172438800363%2CimageDocid%3A10503609057142380240%2Crds%3APC_809980204525877757%7CPROD_PC_809980204525877757%2Cgpcid%3A809980204525877757%2Cmid%3A576462777368448613%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=0ab76f24-6f37-44b7-9cbe-bbc640889b98&title=Nike+Alphafly+3&store=fit2run-the-runner-s-superstore&storeName=Fit2Run%2C+The+Runner%27s+Superstore
```

### Foot Locker `(foot-locker)`  · relay=Y

**Product**: Mens adidas Samba OG Wonder White Clear Sky Shadow Red

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAdidas+Samba+OG%26prds%3Dcatalogid%3A657428627532448061%2Cproductid%3A8772029552435028970%2CheadlineOfferDocid%3A63985551485498420%2CimageDocid%3A7827475561168003100%2Crds%3APC_5325937514595918466%7CPROD_PC_5325937514595918466%2Cgpcid%3A5325937514595918466%2Cmid%3A576462892981431960%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=d2502751-3b0a-4598-83b6-007b1e3d76ce&title=Mens+adidas+Samba+OG+Wonder+White+Clear+Sky+Shadow+Red&store=foot-locker&storeName=Foot+Locker
```

### Footasylum `(footasylum)`  · relay=Y

**Product**: Nike Dunk Men's Low

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike+Dunk+Low%26prds%3Dcatalogid%3A1230481535651725118%2Cproductid%3A1866846963421062575%2CheadlineOfferDocid%3A15640874207342366445%2CimageDocid%3A15474582893753271729%2Crds%3APC_1300979534851218978%7CPROD_PC_1300979534851218978%2Cgpcid%3A1300979534851218978%2Cmid%3A576462525212608904%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=fc215a09-0fd3-42d3-b746-07c6504e2472&title=Nike+Dunk+Men%27s+Low&store=footasylum&storeName=Footasylum
```

### Footlocker.co.uk `(footlocker)`  · relay=Y

**Product**: Los Angeles Lakers Nike Men's Icon Swingman Jersey

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A17116065776956959854%2Cproductid%3A10266281956207690451%2CheadlineOfferDocid%3A13933159032189953018%2CimageDocid%3A10190667819527530071%2Crds%3APC_4902590119917542126%7CPROD_PC_4902590119917542126%2Cgpcid%3A4902590119917542126%2Cmid%3A576462852176128397%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=bb9e85cc-226d-4cb3-83ef-850ec02bf2d0&title=Los+Angeles+Lakers+Nike+Men%27s+Icon+Swingman+Jersey&store=footlocker&storeName=Footlocker.co.uk
```

### Fragola Brand `(fragola-brand)`  · relay=Y

**Product**: Samsung Galaxy A55 5g RAM 8GB ROM 128GB 6.6inches Super AMOLED screen 120Hz 1480 50MP camera 5000mAh

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSamsung+Galaxy+A55%26prds%3Dproductid%3A17766525479509940763%2CheadlineOfferDocid%3A17766525479509940763%2CimageDocid%3A3553825159188612678%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=2afae77a-9019-4501-b198-40acb3a1e3e0&title=Samsung+Galaxy+A55+5g+RAM+8GB+ROM+128GB+6.6inches+Super+AMOLED+screen+120Hz+1480+50MP+camera+5000mAh&store=fragola-brand&storeName=Fragola+Brand
```

### Fragrance Market `(fragrance-market)`  · relay=Y

**Product**: Libre Yves Saint Laurent Eau De Parfum

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A14115184916095969424%2Cproductid%3A18420782806968238882%2CheadlineOfferDocid%3A2709899687166365432%2CimageDocid%3A5058040811753123130%2Crds%3APC_3095006201292915950%7CPROD_PC_3095006201292915950%2Cgpcid%3A3095006201292915950%2Cmid%3A576462693985688801%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=cd9d691a-e239-46c2-8629-a2fc34ee9f18&title=Libre+Yves+Saint+Laurent+Eau+De+Parfum&store=fragrance-market&storeName=Fragrance+Market
```

### FragranceNet.com `(fragrancenet)`  · relay=Y

**Product**: Color Wow Dream Coat Spray Anti-Frizz Treatment

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A16035387792464860004%2Cproductid%3A13238618260522170521%2CheadlineOfferDocid%3A17316853045493332697%2CimageDocid%3A13828923572150874036%2Crds%3APC_3508643268618396902%7CPROD_PC_3508643268618396902%2Cgpcid%3A3508643268618396902%2Cmid%3A576462531554048953%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=cd8f9609-1e3f-4dfe-8d5c-59b8e544479d&title=Color+Wow+Dream+Coat+Spray+Anti-Frizz+Treatment&store=fragrancenet&storeName=FragranceNet.com
```

### Francis & Gaye Jewellers `(francis-gaye-jewellers)`  · relay=Y

**Product**: Swarovski Constella Pendant Necklace

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A14626931462668687729%2Cproductid%3A11617830116671077919%2CheadlineOfferDocid%3A15448572794800842547%2CimageDocid%3A7776690077279432587%2Crds%3APC_2802452169722866596%7CPROD_PC_2802452169722866596%2Cgpcid%3A2802452169722866596%2Cmid%3A576462497990404892%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=5ed9c413-4b7b-4a9c-8cc8-7e48f654f74d&title=Swarovski+Constella+Pendant+Necklace&store=francis-gaye-jewellers&storeName=Francis+%26+Gaye+Jewellers
```

### Frasers `(frasers)`  · relay=Y

**Product**: Edifier S1000MKII Hi-Res 2.0 Bookshelf Speaker Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A12208614905797915338%2Cproductid%3A12645112783506276135%2CheadlineOfferDocid%3A4078057491778768466%2CimageDocid%3A14218632545254808005%2Crds%3APC_12460188708438378021%7CPROD_PC_12460188708438378021%2Cgpcid%3A12460188708438378021%2Cmid%3A576462660094237142%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=f766ffbd-54c7-4969-892b-00a2c8cce778&title=Edifier+S1000MKII+Hi-Res+2.0+Bookshelf+Speaker+Set&store=frasers&storeName=Frasers
```

### Freemans `(freemans)`  · relay=Y

**Product**: Saint Tropez MilaSZ Striped Buttons Slim Fit Cardigan - Ice f. scarlet stripe - Size XL

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A10391733668222843607%2CheadlineOfferDocid%3A10391733668222843607%2CimageDocid%3A3483165006891467944%2Crds%3APC_8267354334698871879%7CPROD_PC_8267354334698871879%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=2f18cb1a-0dc7-4f0c-935b-d357c464d426&title=Saint+Tropez+MilaSZ+Striped+Buttons+Slim+Fit+Cardigan+-+Ice+f.+scarlet+stripe+-+Size+XL&store=freemans&storeName=Freemans
```

### freepeople.com `(freepeople)`  · relay=Y

**Product**: Kanto ORA Powered Reference Desktop Speakers with Bluetooth - Pair (White)

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A11155823084512624091%2CheadlineOfferDocid%3A11155823084512624091%2CimageDocid%3A9085650522614855303%2Crds%3APC_9132221067850219898%7CPROD_PC_9132221067850219898%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=a237ae9f-7f7d-4e22-ad46-2e5f8baa8443&title=Kanto+ORA+Powered+Reference+Desktop+Speakers+with+Bluetooth+-+Pair+%28White%29&store=freepeople&storeName=freepeople.com
```

### Fulfillment Goods UK `(fulfillment-goods-uk)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPixel+9+Pro+deals%26prds%3Dproductid%3A12061624582972908019%2CheadlineOfferDocid%3A12061624582972908019%2CimageDocid%3A17381827019876523699%2Crds%3APC_13461510371567660278%7CPROD_PC_13461510371567660278%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=b7c76276-b3fb-4a5b-a391-398c656008d3&title=Google+Pixel+9&store=fulfillment-goods-uk&storeName=Fulfillment+Goods+UK
```

### Furnmart South Africa `(furnmart-south-africa)`  · relay=Y

**Product**: VolkanoX Paramount Series 8" Bluetooth Party Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A12982457039641689445%2CheadlineOfferDocid%3A3476192353881344037%2CimageDocid%3A9217899377785250335%2Cgpcid%3A11930812856821506463%2Cmid%3A576462874594085677%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=1f032622-86fc-4057-a83e-5ce485daada5&title=VolkanoX+Paramount+Series+8%22+Bluetooth+Party+Speaker&store=furnmart-south-africa&storeName=Furnmart+South+Africa
```

### G-Star.com `(g-star)`  · relay=Y

**Product**: Woman G-star 3d Biker Full Zip Sweater

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A1790494805345890389%2CheadlineOfferDocid%3A4404898796151630709%2CimageDocid%3A11686396653200863588%2Cgpcid%3A10977355585161049129%2Cmid%3A576462863778753919%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=4d2c9733-5857-48d8-a843-18508bd20f89&title=Woman+G-star+3d+Biker+Full+Zip+Sweater&store=g-star&storeName=G-Star.com
```

### Gadgets Now `(gadgets-now)`  · relay=Y

**Product**: Lenovo LOQ 15.6" 144Hz FHD Laptop Intel Core

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12541139558247767063%2Cproductid%3A11363313823657295753%2CheadlineOfferDocid%3A560388489967441593%2CimageDocid%3A12315707486235411243%2Crds%3APC_10767993562757794585%7CPROD_PC_10767993562757794585%2Cgpcid%3A1666948488239226607%2Cmid%3A576462782276662279%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=d95e9dbd-4352-4da4-9f14-0e27bccd4a47&title=Lenovo+LOQ+15.6%22+144Hz+FHD+Laptop+Intel+Core&store=gadgets-now&storeName=Gadgets+Now
```

### Gadxy `(gadxy)`  · relay=Y

**Product**: Ant Esports H1100 Pro RGB Wired Gaming Headset

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A5189599238912893144%2Cproductid%3A16572165973314590437%2CheadlineOfferDocid%3A12342784434767075909%2CimageDocid%3A16985590445384031633%2Cgpcid%3A8163976272925656869%2Cmid%3A576462810937236295%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=28901e3d-0af5-43d3-9377-2f19d9f8205f&title=Ant+Esports+H1100+Pro+RGB+Wired+Gaming+Headset&store=gadxy&storeName=Gadxy
```

### Galaxus `(galaxus)`  · relay=Y

**Product**: Sharkoon AK2 RGB Black ATX

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A16136230895985565781%2Cproductid%3A10914516591209016671%2CheadlineOfferDocid%3A7313535033091101753%2CimageDocid%3A15698805466173907797%2Cgpcid%3A216319085407819047%2Cmid%3A576462801277344370%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=aa91586e-2bdd-483d-b85e-ae4ee50fb623&title=Sharkoon+AK2+RGB+Black+ATX&store=galaxus&storeName=Galaxus
```

### GAME `(game)`  · relay=Y

**Product**: Logitech G213 Prodigy Gaming Keyboard

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A4588827281936535426%2Cproductid%3A10000230106484012506%2CheadlineOfferDocid%3A13143047862898063042%2CimageDocid%3A2515306008034508710%2Crds%3APC_9010399873377531875%7CPROD_PC_9010399873377531875%2Cgpcid%3A9010399873377531875%2Cmid%3A576462777711058847%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=f92758de-7781-4b37-bb06-ab5b1a89cc77&title=Logitech+G213+Prodigy+Gaming+Keyboard&store=game&storeName=GAME
```

### GAME 4U `(game-4u)`  · relay=Y

**Product**: Nintendo Joy-Con Pair

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A15112366349647405859%2Cproductid%3A1017326028267046859%2CheadlineOfferDocid%3A4879388978083995683%2CimageDocid%3A4436810714598765339%2Crds%3APC_3470793851362344745%7CPROD_PC_3470793851362344745%2Cgpcid%3A3470793851362344745%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=3b8bbf5b-21e5-4968-b2f0-2de37796fb63&title=Nintendo+Joy-Con+Pair&store=game-4u&storeName=GAME+4U
```

### GameLoot `(gameloot)`  · relay=Y

**Product**: Oneplus 12

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A3914794878959920905%2CheadlineOfferDocid%3A2435828659323565308%2CimageDocid%3A2464263132871712615%2Crds%3APC_12344949821154398180%7CPROD_PC_12344949821154398180%2Cgpcid%3A12344949821154398180%2Cmid%3A576462853135829503%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=0cca189b-82eb-4c50-bb46-7a9a1d87b654&title=Oneplus+12&store=gameloot&storeName=GameLoot
```

### GameSir Official Store `(gamesir-official-store)`  · relay=Y

**Product**: GameSir G7 SE Wired Xbox Controller

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A5044946447664054764%2Cproductid%3A3428374408287929599%2CheadlineOfferDocid%3A6092258340169140946%2CimageDocid%3A14541080428899126123%2Crds%3APC_5259503630876978729%7CPROD_PC_5259503630876978729%2Cgpcid%3A5259503630876978729%2Cmid%3A576462791295446720%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=cbd3b47b-dc23-457d-957a-7908bc0acc0c&title=GameSir+G7+SE+Wired+Xbox+Controller&store=gamesir-official-store&storeName=GameSir+Official+Store
```

### Gamesncomps `(gamesncomps)`  · relay=Y

**Product**: Elgato Wave XLR Digital Audio Mixer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A17445574343624825952%2CheadlineOfferDocid%3A8282759651912916104%2CimageDocid%3A12344401240139261642%2Crds%3APC_12509550308132565796%7CPROD_PC_12509550308132565796%2Cgpcid%3A12509550308132565796%2Cmid%3A576462668242170364%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=ef741dd2-6f53-4206-9b4e-b9c7b926ec0d&title=Elgato+Wave+XLR+Digital+Audio+Mixer&store=gamesncomps&storeName=Gamesncomps
```

### Gamex Computers `(gamex-computers)`  · relay=Y

**Product**: Logitech G502 X Plus Wireless Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A889000353536570915%2Cproductid%3A9742529588177598788%2CheadlineOfferDocid%3A2488901326304218964%2CimageDocid%3A5742929738767027701%2Crds%3APC_21872130931376366%7CPROD_PC_21872130931376366%2Cgpcid%3A21872130931376366%2Cmid%3A576462502917228402%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=c1d08960-a492-44ae-b276-13609bb76a13&title=Logitech+G502+X+Plus+Wireless+Gaming+Mouse&store=gamex-computers&storeName=Gamex+Computers
```

### Gauryog `(gauryog)`  · relay=Y

**Product**: Prestige Fame 3 Burner Gas Stove

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A13893151265611688204%2Cproductid%3A17551925204337112518%2CheadlineOfferDocid%3A13538646466249560472%2CimageDocid%3A6310365096696628057%2Cgpcid%3A444385187924445492%2Cmid%3A576462737977095095%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=cbb8fdb9-1948-4e03-9881-1097cee916e7&title=Prestige+Fame+3+Burner+Gas+Stove&store=gauryog&storeName=Gauryog
```

### Gazelle Sports `(gazelle-sports)`  · relay=Y

**Product**: Saucony Women's Triumph 23

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A8939661179336737036%2Cproductid%3A3655939789748346707%2CheadlineOfferDocid%3A2636898976649775536%2CimageDocid%3A2830214199460978367%2Crds%3APC_15999510186295101255%7CPROD_PC_15999510186295101255%2Cgpcid%3A15999510186295101255%2Cmid%3A576462863447384629%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=5d1a4b60-630b-4ae3-924d-098613ad378a&title=Saucony+Women%27s+Triumph+23&store=gazelle-sports&storeName=Gazelle+Sports
```

### Gear Change `(gear-change)`  · relay=Y

**Product**: Lake MX238-X Wide - MTB Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A9851620502056618628%2Cproductid%3A9268248399993453674%2CheadlineOfferDocid%3A10433849671659943911%2CimageDocid%3A8657950471473673893%2Crds%3APC_3891697034165818754%7CPROD_PC_3891697034165818754%2Cgpcid%3A3891697034165818754%2Cmid%3A576462847619325598%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=d7f14cf2-73ae-4569-9b11-edffbb07dae2&title=Lake+MX238-X+Wide+-+MTB+Shoes&store=gear-change&storeName=Gear+Change
```

### Gear4music.com `(gear4music)`  · relay=Y

**Product**: Antares Vocal De-Esser

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A10066557403909933070%2CheadlineOfferDocid%3A10066557403909933070%2CimageDocid%3A4242561007051573950%2Crds%3APC_2849770149481412476%7CPROD_PC_2849770149481412476%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=01dcbf1b-8e5c-4869-8e11-47fba0e7a845&title=Antares+Vocal+De-Esser&store=gear4music&storeName=Gear4music.com
```

### geekom.co.uk `(geekom)`  · relay=Y

**Product**: GEEKOM Air12 Tiny Computer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A17641026314705691090%2Cproductid%3A13437793914685384336%2CheadlineOfferDocid%3A2354230992964759002%2CimageDocid%3A16465557169174784422%2Crds%3APC_17562886208309472307%7CPROD_PC_17562886208309472307%2Cgpcid%3A17562886208309472307%2Cmid%3A576462887235876965%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=9845414e-18d4-464b-9279-d445888573f7&title=GEEKOM+Air12+Tiny+Computer&store=geekom&storeName=geekom.co.uk
```

### geekompc.com `(geekompc)`  · relay=Y

**Product**: GEEKOM AMD NUC A6 Mini PC

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A17950806791623987772%2Cproductid%3A18341541692111137755%2CheadlineOfferDocid%3A4153056799616006695%2CimageDocid%3A5695653677416168549%2Crds%3APC_8563882087348050827%7CPROD_PC_8563882087348050827%2Cgpcid%3A8563882087348050827%2Cmid%3A576462883854657006%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=e9e5fb60-2ef3-461e-91f9-76ac9ad2a82a&title=GEEKOM+AMD+NUC+A6+Mini+PC&store=geekompc&storeName=geekompc.com
```

### GeeWiz `(geewiz)`  · relay=Y

**Product**: Astrum SP150 Bluetooth Waterproof IP6 Speaker 12W Led

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A2905932834379794616%2Cproductid%3A18087858113306746236%2CheadlineOfferDocid%3A2397053113086190961%2CimageDocid%3A15827945847551380603%2Cgpcid%3A15970228412780264912%2Cmid%3A576462836040912275%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=cc73eee8-db70-4b36-98fe-cd1e975f4275&title=Astrum+SP150+Bluetooth+Waterproof+IP6+Speaker+12W+Led&store=geewiz&storeName=GeeWiz
```

### Gilt.com `(gilt)`  · relay=Y

**Product**: Clinique 0.35Oz #04 Matte Honey Superpowder Double Face Makeup

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A2137053968568875434%2CheadlineOfferDocid%3A2137053968568875434%2CimageDocid%3A3488544104746824822%2Crds%3APC_17494555866119306401%7CPROD_PC_17494555866119306401%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=f44de56a-06ed-4cef-8aa9-ffae03363ffa&title=Clinique+0.35Oz+%2304+Matte+Honey+Superpowder+Double+Face+Makeup&store=gilt&storeName=Gilt.com
```

### Givenchy Beauty `(givenchy-beauty)`  · relay=Y

**Product**: Givenchy L'Interdit Eau de Parfum Rouge

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A2307042448953461293%2Cproductid%3A11284247583767035107%2CheadlineOfferDocid%3A9284983498210992782%2CimageDocid%3A14483524952217089700%2Crds%3APC_891134488027977938%7CPROD_PC_891134488027977938%2Cgpcid%3A891134488027977938%2Cmid%3A576462854772657499%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=40526eeb-5ae0-42d4-8f75-ab1549e41b85&title=Givenchy+L%27Interdit+Eau+de+Parfum+Rouge&store=givenchy-beauty&storeName=Givenchy+Beauty
```

### Glams Secret `(glams-secret)`  · relay=Y

**Product**: Aquilea OnBalance Smile 60 Gomas

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A15319873007764290114%2Cproductid%3A8214709338096233898%2CheadlineOfferDocid%3A14692636393533709841%2CimageDocid%3A12332718286735593659%2Crds%3APC_17722281193280494631%7CPROD_PC_17722281193280494631%2Cgpcid%3A17722281193280494631%2Cmid%3A576462809807970592%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=531a84b4-b8d4-48a9-92af-1cd44dc777f3&title=Aquilea+OnBalance+Smile+60+Gomas&store=glams-secret&storeName=Glams+Secret
```

### GlenIndia `(glenindia)`  · relay=Y

**Product**: Wall Mounted Ductfree Kitchen Chimney Plug CH6052DFMSBFBL60

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A16028078598606127936%2Cproductid%3A2658140604683204890%2CheadlineOfferDocid%3A9472997457722620000%2CimageDocid%3A17591051206531470244%2Cgpcid%3A14649481226410123748%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=35fdf2e4-f74e-4c98-b653-a8b334410744&title=Wall+Mounted+Ductfree+Kitchen+Chimney+Plug+CH6052DFMSBFBL60&store=glenindia&storeName=GlenIndia
```

### gog.com `(gog)`  · relay=Y

**Product**: Afterdream & DISTRAINT Series Bundle

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dproductid%3A5325434770156849985%2CheadlineOfferDocid%3A5325434770156849985%2CimageDocid%3A2009801087927627811%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=5e6a6ceb-ab60-4220-87b4-94b9af3e2846&title=Afterdream+%26+DISTRAINT+Series+Bundle&store=gog&storeName=gog.com
```

### Going Going Gone `(going-going-gone)`  · relay=Y

**Product**: Carhartt Men's Midweight Sleeve Logo Sweatshirt

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A1938701463020449287%2Cproductid%3A17489406532574037572%2CheadlineOfferDocid%3A137736873713074856%2CimageDocid%3A15081451532048522249%2Crds%3APC_9961706689743855870%7CPROD_PC_9961706689743855870%2Cgpcid%3A9961706689743855870%2Cmid%3A576462842503966998%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=e842e7a8-80e7-4a37-9a3e-ba0d2b1fb7b4&title=Carhartt+Men%27s+Midweight+Sleeve+Logo+Sweatshirt&store=going-going-gone&storeName=Going+Going+Gone
```

### Golf Galaxy `(golf-galaxy)`  · relay=Y

**Product**: CALIA Women's Everyday Rib Tank

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A1411664541398011696%2Cproductid%3A10534525657989801086%2CheadlineOfferDocid%3A10108447794693470569%2CimageDocid%3A16169910300416419888%2Crds%3APC_9943781725347562223%7CPROD_PC_9943781725347562223%2Cgpcid%3A9943781725347562223%2Cmid%3A576462807120545762%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=a2b17659-b9fc-4e5a-b288-311dce463872&title=CALIA+Women%27s+Everyday+Rib+Tank&store=golf-galaxy&storeName=Golf+Galaxy
```

### Good Monk `(good-monk)`  · relay=Y

**Product**: Good Monk Healthy 50+ Nutrition Mix Supplement

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A11173011463707151959%2Cproductid%3A15397342084204156599%2CheadlineOfferDocid%3A13238727153419133200%2CimageDocid%3A15021238847832003004%2Crds%3APC_8811481394779242669%7CPROD_PC_8811481394779242669%2Cgpcid%3A8811481394779242669%2Cmid%3A576462823164197336%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=334a2343-68b9-4da7-8258-2c431cd1b808&title=Good+Monk+Healthy+50%2B+Nutrition+Mix+Supplement&store=good-monk&storeName=Good+Monk
```

### Google Store `(google-store)`  · relay=Y

**Product**: Google Pixel Buds 2a Wireless Bluetooth Earbuds

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A13104500212507902402%2Cproductid%3A5544840549911166616%2CheadlineOfferDocid%3A8514914446308776550%2CimageDocid%3A17782872620523712296%2Crds%3APC_3786700060287745713%7CPROD_PC_3786700060287745713%2Cgpcid%3A3786700060287745713%2Cmid%3A576462840112286788%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=24d37823-6667-4203-9a78-4cc3d346c3ed&title=Google+Pixel+Buds+2a+Wireless+Bluetooth+Earbuds&store=google-store&storeName=Google+Store
```

### Grab Your Gadget `(grab-your-gadget)`  · relay=Y

**Product**: Logitech G Pro Wireless Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A9911068714130039952%2CheadlineOfferDocid%3A17656823000871623279%2CimageDocid%3A10841286191975354839%2Crds%3APC_3523892803018952278%7CPROD_PC_3523892803018952278%2Cgpcid%3A3523892803018952278%2Cmid%3A576462827345318928%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=07c4c1eb-116e-4b06-adc5-c81e075f1235&title=Logitech+G+Pro+Wireless+Gaming+Mouse&store=grab-your-gadget&storeName=Grab+Your+Gadget
```

### Green Man Gaming `(green-man-gaming)`  · relay=Y

**Product**: Red Dead Redemption 2 - epicgames Key - Green Man Gaming

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dproductid%3A7714808006361786020%2CheadlineOfferDocid%3A7714808006361786020%2CimageDocid%3A14446364668151923909%2Crds%3APC_13911474957773474502%7CPROD_PC_13911474957773474502%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=3e34c7cf-5c03-41a0-8c47-a6f9ab2b9bca&title=Red+Dead+Redemption+2+-+epicgames+Key+-+Green+Man+Gaming&store=green-man-gaming&storeName=Green+Man+Gaming
```

### Greentoe - TV's & Home Theater `(greentoe-tv-s-home-theater)`  · relay=Y

**Product**: Samsung HW-Q990F 11.1.4 Channel Soundbar

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A13907695293798510281%2Cproductid%3A8343248642494390343%2CheadlineOfferDocid%3A17858142640603202556%2CimageDocid%3A8260738050421928533%2Crds%3APC_17085515789078117682%7CPROD_PC_17085515789078117682%2Cgpcid%3A17085515789078117682%2Cmid%3A576462832881349244%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=86d95765-e209-4038-8efc-86c132566aef&title=Samsung+HW-Q990F+11.1.4+Channel+Soundbar&store=greentoe-tv-s-home-theater&storeName=Greentoe+-+TV%27s+%26+Home+Theater
```

### Grove Collaborative `(grove-collaborative)`  · relay=Y

**Product**: RMS Beauty Luminizer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A17522701443985234698%2Cproductid%3A4500041880464080614%2CheadlineOfferDocid%3A16148429602682447602%2CimageDocid%3A2480728061071226436%2Crds%3APC_10702244351722785622%7CPROD_PC_10702244351722785622%2Cgpcid%3A10702244351722785622%2Cmid%3A576462476250575872%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=336648ce-ca2d-466e-a6b7-b8d9e17caed8&title=RMS+Beauty+Luminizer&store=grove-collaborative&storeName=Grove+Collaborative
```

### Grüns `(gr-ns)`  · relay=Y

**Product**: Gruns Adult Super Greens Gummies

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A17476139491465373270%2Cproductid%3A4658132972175266415%2CheadlineOfferDocid%3A4758465495099153560%2CimageDocid%3A14560690072174396294%2Crds%3APC_979766114521367753%7CPROD_PC_979766114521367753%2Cgpcid%3A979766114521367753%2Cmid%3A576462864827137579%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=4de7088a-a64b-4a2f-98a2-5e51114c785c&title=Gruns+Adult+Super+Greens+Gummies&store=gr-ns&storeName=Gr%C3%BCns
```

### Guitar Center `(guitar-center)`  · relay=Y

**Product**: Slate Digital Virtual Preamp Collection Plugin

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A13592052425349198644%2CheadlineOfferDocid%3A13592052425349198644%2CimageDocid%3A8910421815836060199%2Crds%3APC_1648230060217686526%7CPROD_PC_1648230060217686526%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=57fc64c2-8ce1-4338-8b4d-3c88b4a78bba&title=Slate+Digital+Virtual+Preamp+Collection+Plugin&store=guitar-center&storeName=Guitar+Center
```

### Guitar Center Local Stores `(guitar-center-local-stores)`  · relay=Y

**Product**: Electro-Voice ZLX-12P G2 12" 2-Way Powered Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A8993731657125014798%2Cproductid%3A656482260338264575%2CheadlineOfferDocid%3A7982293964252798295%2CimageDocid%3A16824440312662120512%2Crds%3APC_16605167478240277101%7CPROD_PC_16605167478240277101%2Cgpcid%3A16605167478240277101%2Cmid%3A576462875000578810%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c8d46d7b-22d5-4817-b8c3-610ba2998e51&title=Electro-Voice+ZLX-12P+G2+12%22+2-Way+Powered+Speaker&store=guitar-center-local-stores&storeName=Guitar+Center+Local+Stores
```

### Gymshark `(gymshark)`  · relay=Y

**Product**: Gymshark Sport Synthetic Pants

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A16851238165154522331%2Cproductid%3A15649859857894571247%2CheadlineOfferDocid%3A5068249108474989776%2CimageDocid%3A10686868195869733757%2Cgpcid%3A18088806662048435639%2Cmid%3A576462518804978744%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=5a65a101-b0c6-4b51-8ef1-59bc48965b0c&title=Gymshark+Sport+Synthetic+Pants&store=gymshark&storeName=Gymshark
```

### H Samuel `(h-samuel)`  · relay=Y

**Product**: Sekonda Men's Watch

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A5443545691075044716%2Cproductid%3A4112680125509837157%2CheadlineOfferDocid%3A7555872660314840835%2CimageDocid%3A674489613899467378%2Crds%3APC_5152861120349700756%7CPROD_PC_5152861120349700756%2Cgpcid%3A5152861120349700756%2Cmid%3A576462402395188685%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=6425f1bc-2df0-4685-8f3c-fbc9f1cf1674&title=Sekonda+Men%27s+Watch&store=h-samuel&storeName=H+Samuel
```

### H&M `(h-m)`  · relay=Y

**Product**: H&M Ladies Scarf-Detail Top

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A17397973591982992192%2Cproductid%3A3656932655887405204%2CheadlineOfferDocid%3A6038529281007271634%2CimageDocid%3A1143121274672379349%2Crds%3APC_4773538799851198486%7CPROD_PC_4773538799851198486%2Cgpcid%3A4773538799851198486%2Cmid%3A576462868016416098%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=74454cfd-8803-4a08-830a-5a51930c54f7&title=H%26M+Ladies+Scarf-Detail+Top&store=h-m&storeName=H%26M
```

### Haier UK `(haier-uk)`  · relay=Y

**Product**: HAIER HFR5719EWMP Fridge Freezer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A11884219721303074842%2Cproductid%3A1340213309091909399%2CheadlineOfferDocid%3A11134623009181292133%2CimageDocid%3A11969870262580513640%2Crds%3APC_9380494375853229241%7CPROD_PC_9380494375853229241%2Cgpcid%3A9380494375853229241%2Cmid%3A576462687233260104%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=112aae5e-7377-4455-960e-ab49eb9562ea&title=HAIER+HFR5719EWMP+Fridge+Freezer&store=haier-uk&storeName=Haier+UK
```

### Hamilton Beach UK `(hamilton-beach-uk)`  · relay=Y

**Product**: Hamilton Beach Stealth Jug Kettle with 2-Slice Toaster and Solo Microwave

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A1205879041446667802%2Cproductid%3A13523482701334310180%2CheadlineOfferDocid%3A16988931848009465370%2CimageDocid%3A13642659904558216450%2Cgpcid%3A5859783798989062601%2Cmid%3A576462531124793025%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=80a1b070-7bc9-47f4-99d9-1916893feafb&title=Hamilton+Beach+Stealth+Jug+Kettle+with+2-Slice+Toaster+and+Solo+Microwave&store=hamilton-beach-uk&storeName=Hamilton+Beach+UK
```

### Hardloop `(hardloop)`  · relay=Y

**Product**: Crocs Classic Clog

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCrocs+Classic+Clog+deals%26prds%3Dcatalogid%3A11918196672160402745%2Cproductid%3A1675035028576529926%2CheadlineOfferDocid%3A7301669546077146966%2CimageDocid%3A13019770655945926091%2Crds%3APC_5803906498614987482%7CPROD_PC_5803906498614987482%2Cgpcid%3A5803906498614987482%2Cmid%3A576462765217755908%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=50ecc17a-b28c-493b-8b62-ed1e795756bd&title=Crocs+Classic+Clog&store=hardloop&storeName=Hardloop
```

### HarmanAudio `(harmanaudio)`  · relay=Y

**Product**: JBL BAR-500-MK2 Soundbar

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A16688229636920438015%2Cproductid%3A3539199568908723326%2CheadlineOfferDocid%3A15993229026857549310%2CimageDocid%3A8467172350621030038%2Crds%3APC_12733121626813322317%7CPROD_PC_12733121626813322317%2Cgpcid%3A12733121626813322317%2Cmid%3A576462900622547361%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=0493f867-e60f-4d84-97ae-02b24ee16a7f&title=JBL+BAR-500-MK2+Soundbar&store=harmanaudio&storeName=HarmanAudio
```

### Harrison Consoles `(harrison-consoles)`  · relay=Y

**Product**: Multi-Band Compressor

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A3375072879173685846%2CheadlineOfferDocid%3A3375072879173685846%2CimageDocid%3A8790657548363806149%2Crds%3APC_5389674645585181152%7CPROD_PC_5389674645585181152%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=734da89e-8db1-4f5b-aa27-ee2a7f0802ae&title=Multi-Band+Compressor&store=harrison-consoles&storeName=Harrison+Consoles
```

### Harrods `(harrods)`  · relay=Y

**Product**: OUAI Leave In Conditioner

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A5250464345043137304%2Cproductid%3A13434894420964229851%2CheadlineOfferDocid%3A8957882317082121638%2CimageDocid%3A1088309839867678700%2Crds%3APC_1969786217230679286%7CPROD_PC_1969786217230679286%2Cgpcid%3A1969786217230679286%2Cmid%3A576462354298692248%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=8cb2bf1e-542d-466d-a6f1-2ed222044bc8&title=OUAI+Leave+In+Conditioner&store=harrods&storeName=Harrods
```

### Harvey Norman `(harvey-norman)`  · relay=Y

**Product**: JLab Go Air Pop True Wireless Earbuds

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A8372463217625314514%2Cproductid%3A3064082877739580741%2CheadlineOfferDocid%3A4641710985736884907%2CimageDocid%3A1558990514429830892%2Crds%3APC_9146411353573113826%7CPROD_PC_9146411353573113826%2Cgpcid%3A9146411353573113826%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=08208614-e7d0-485c-a8b9-f9efb6145b7a&title=JLab+Go+Air+Pop+True+Wireless+Earbuds&store=harvey-norman&storeName=Harvey+Norman
```

### Hawkins `(hawkins)`  · relay=Y

**Product**: Hawkins Futura Dual Hob Induction Cooktop FIC2A1

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A10555293523695480599%2Cproductid%3A12867335179478815022%2CheadlineOfferDocid%3A957466953304469919%2CimageDocid%3A4803104849716570167%2Cgpcid%3A7994269389856987153%2Cmid%3A576462845561031862%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=39ab11e2-5820-477d-92b1-7f2423dea738&title=Hawkins+Futura+Dual+Hob+Induction+Cooktop+FIC2A1&store=hawkins&storeName=Hawkins
```

### HBPS Beauty `(hbps-beauty)`  · relay=Y

**Product**: Medicube AGE-R Booster Pro

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A2244998268780064384%2Cproductid%3A17505923134162457220%2CheadlineOfferDocid%3A755048465841553761%2CimageDocid%3A18247145227042473443%2Crds%3APC_14931813724247594274%7CPROD_PC_14931813724247594274%2Cgpcid%3A14931813724247594274%2Cmid%3A576462804288536324%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=bdd43d81-aadc-4a11-8852-93315efc160d&title=Medicube+AGE-R+Booster+Pro&store=hbps-beauty&storeName=HBPS+Beauty
```

### Health N Wellness Shop `(health-n-wellness-shop)`  · relay=Y

**Product**: Aritha Powder Just Jaivik

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A7533378722743330806%2Cproductid%3A967131694697605310%2CheadlineOfferDocid%3A3730240617930728963%2CimageDocid%3A9568374944381708576%2Crds%3APC_9085629401162180842%7CPROD_PC_9085629401162180842%2Cgpcid%3A9085629401162180842%2Cmid%3A576462890359334515%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=4d46fe0c-9475-40bd-8013-48ffcfde4115&title=Aritha+Powder+Just+Jaivik&store=health-n-wellness-shop&storeName=Health+N+Wellness+Shop
```

### HealthKart Official `(healthkart-official)`  · relay=Y

**Product**: HK Vitals Hyaluronic Acid Effervescent

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A5203928700410899235%2Cproductid%3A12209868405802918578%2CheadlineOfferDocid%3A11560186377271958466%2CimageDocid%3A3228808370239382228%2Crds%3APC_3250478661800299670%7CPROD_PC_3250478661800299670%2Cgpcid%3A3250478661800299670%2Cmid%3A576462847851635436%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=47d6ebbb-d32e-4a17-b8fb-12d1e58b95fd&title=HK+Vitals+Hyaluronic+Acid+Effervescent&store=healthkart-official&storeName=HealthKart+Official
```

### Healthmug.com `(healthmug)`  · relay=Y

**Product**: Krishna's She Care Juice

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A9175861584024491091%2Cproductid%3A9921918516280308729%2CheadlineOfferDocid%3A2210554301698923652%2CimageDocid%3A1655369513626908471%2Crds%3APC_4846879964640334155%7CPROD_PC_4846879964640334155%2Cgpcid%3A4846879964640334155%2Cmid%3A576462517562686120%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=48312148-d3be-4a23-a17c-0dcaecc87a79&title=Krishna%27s+She+Care+Juice&store=healthmug&storeName=Healthmug.com
```

### HealthProductsForYou.com `(healthproductsforyou)`  · relay=Y

**Product**: Abbott Ensure Original Ready-to-Drink Nutrition Shake | Strawberry, 8fl oz (237ml), Bottle | 6/Pack | 57234

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dproductid%3A15920226548884767548%2CheadlineOfferDocid%3A15920226548884767548%2CimageDocid%3A468115772260178139%2Crds%3APC_4425929885789174928%7CPROD_PC_4425929885789174928%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=3e1292eb-5857-45bf-881c-f59ad16ddcb6&title=Abbott+Ensure+Original+Ready-to-Drink+Nutrition+Shake+%7C+Strawberry%2C+8fl+oz+%28237ml%29%2C+Bottle+%7C+6%2FPack+%7C+57234&store=healthproductsforyou&storeName=HealthProductsForYou.com
```

### HealthyHey Nutrition `(healthyhey-nutrition)`  · relay=Y

**Product**: Healthyhey Women's ODO Vaginal Probiotics

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A1914129219365567472%2Cproductid%3A5136401210039451181%2CheadlineOfferDocid%3A14731141378038284624%2CimageDocid%3A3120535848097887351%2Cgpcid%3A1538509732472567726%2Cmid%3A576462517562711113%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=65fcd5a3-0b2a-4bb2-aebb-144ed964a4a5&title=Healthyhey+Women%27s+ODO+Vaginal+Probiotics&store=healthyhey-nutrition&storeName=HealthyHey+Nutrition
```

### HiFi Corp `(hifi-corp)`  · relay=Y

**Product**: Russell Hobbs Stainless Steel Pack

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A9407948964152005884%2Cproductid%3A15807654369766119798%2CheadlineOfferDocid%3A15181732145986325682%2CimageDocid%3A13696793913276429362%2Crds%3APC_11508313056178325995%7CPROD_PC_11508313056178325995%2Cgpcid%3A11508313056178325995%2Cmid%3A576462808135464550%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=26b14855-5115-4c2e-af99-8ab2a1ec20d4&title=Russell+Hobbs+Stainless+Steel+Pack&store=hifi-corp&storeName=HiFi+Corp
```

### HiFiMART.com `(hifimart)`  · relay=Y

**Product**: Marantz Horizon Wireless Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A12930248519179669956%2Cproductid%3A12740031946842928216%2CheadlineOfferDocid%3A5669112761996568009%2CimageDocid%3A12987184417911313052%2Crds%3APC_1673565092258405811%7CPROD_PC_1673565092258405811%2Cgpcid%3A1673565092258405811%2Cmid%3A576462834223903257%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=5ef28b02-4900-43ec-b7e7-2338c26c69fc&title=Marantz+Horizon+Wireless+Speaker&store=hifimart&storeName=HiFiMART.com
```

### High Country Outfitters `(high-country-outfitters)`  · relay=Y

**Product**: On Women's Cloud X 4

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A6980969083832686071%2Cproductid%3A18181956653882920290%2CheadlineOfferDocid%3A1536513817038090423%2CimageDocid%3A15446717120214156867%2Crds%3APC_8524686098284206344%7CPROD_PC_8524686098284206344%2Cgpcid%3A8524686098284206344%2Cmid%3A576462832645388483%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=faa7d87b-d3a8-4115-9069-ab6e1fa3557c&title=On+Women%27s+Cloud+X+4&store=high-country-outfitters&storeName=High+Country+Outfitters
```

### Holland & Barrett `(holland-barrett)`  · relay=Y

**Product**: Applied Nutrition ABE Pre Workout

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A7370722886149094016%2Cproductid%3A18080505507226449746%2CheadlineOfferDocid%3A3385680193683417100%2CimageDocid%3A8789733656125706039%2Crds%3APC_2611433676891672333%7CPROD_PC_2611433676891672333%2Cgpcid%3A2611433676891672333%2Cmid%3A576462801468192383%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=e44194a3-ac2b-445c-8ece-09e285837d4f&title=Applied+Nutrition+ABE+Pre+Workout&store=holland-barrett&storeName=Holland+%26+Barrett
```

### Homafy `(homafy)`  · relay=Y

**Product**: Classic Retro Video Game Gift

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A6397848638509526966%2Cproductid%3A10858924933277096112%2CheadlineOfferDocid%3A15182292850872648079%2CimageDocid%3A9131210681935146542%2Cgpcid%3A2878401823210512522%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=ffa3f6f3-448e-4f17-86f4-9c2c974178aa&title=Classic+Retro+Video+Game+Gift&store=homafy&storeName=Homafy
```

### Home Centre `(home-centre)`  · relay=Y

**Product**: Wonderchef 28L Oven Toaster Griller

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A1993477864138425393%2Cproductid%3A12531730800956586315%2CheadlineOfferDocid%3A10591782340683554744%2CimageDocid%3A7067711390760329967%2Crds%3APC_17383306146147264653%7CPROD_PC_17383306146147264653%2Cgpcid%3A17383306146147264653%2Cmid%3A576462319618973140%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=255e5ca6-a664-4a8e-88d4-0176f2676434&title=Wonderchef+28L+Oven+Toaster+Griller&store=home-centre&storeName=Home+Centre
```

### Home Outlet Direct `(home-outlet-direct)`  · relay=Y

**Product**: Kucht 3-Piece Appliance Package - 48-Inch Natural Gas Range with 6.7 Cu. Ft. Oven, 36-Inch Refrigerator & Dishwasher in Stainless Steel

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A11183492829025445606%2CheadlineOfferDocid%3A11183492829025445606%2CimageDocid%3A4595403046945920521%2Crds%3APC_11803385326721241172%7CPROD_PC_11803385326721241172%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c1304935-e157-4a0f-9a42-140a73c31411&title=Kucht+3-Piece+Appliance+Package+-+48-Inch+Natural+Gas+Range+with+6.7+Cu.+Ft.+Oven%2C+36-Inch+Refrigerator+%26+Dishwasher+in+&store=home-outlet-direct&storeName=Home+Outlet+Direct
```

### Hood.de - Hood Feed `(hood-de-hood-feed)`  · relay=Y

**Product**: LG UltraGear 27G411A-B Monitor

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A2139881993755389329%2Cproductid%3A17839480029694712886%2CheadlineOfferDocid%3A322418552268527055%2CimageDocid%3A12063083745573115022%2Crds%3APC_3370352043015216367%7CPROD_PC_3370352043015216367%2Cgpcid%3A3370352043015216367%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=c9c5351b-3889-432d-85e7-780880281e52&title=LG+UltraGear+27G411A-B+Monitor&store=hood-de-hood-feed&storeName=Hood.de+-+Hood+Feed
```

### HP `(hp)`  · relay=Y

**Product**: HP OmniBook 5 16" AMD Ryzen AI 7 Laptop

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A2345195854262754124%2Cproductid%3A3223759210890393563%2CheadlineOfferDocid%3A16264065149728712675%2CimageDocid%3A12265896615824337360%2Crds%3APC_17235082703764719636%7CPROD_PC_17235082703764719636%2Cgpcid%3A17235082703764719636%2Cmid%3A576462876031715384%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1c2cf503-befd-456d-9520-9a8e4b87a658&title=HP+OmniBook+5+16%22+AMD+Ryzen+AI+7+Laptop&store=hp&storeName=HP
```

### HP Store `(hp-store)`  · relay=Y

**Product**: HP All-in-One PC 24-Cr0046na

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A4879016253036031356%2Cproductid%3A16133313764958269248%2CheadlineOfferDocid%3A6470146371021701093%2CimageDocid%3A8435515732067416048%2Crds%3APC_2369091634135398658%7CPROD_PC_2369091634135398658%2Cgpcid%3A2369091634135398658%2Cmid%3A576462841243102722%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=47c51c86-c559-49f5-a9b6-a086b4005e0a&title=HP+All-in-One+PC+24-Cr0046na&store=hp-store&storeName=HP+Store
```

### HQHair `(hqhair)`  · relay=Y

**Product**: Stila Custom Correcting Palette

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A17094237703138775382%2Cproductid%3A959668327930567369%2CheadlineOfferDocid%3A18423502400899913777%2CimageDocid%3A13610935174855824275%2Crds%3APC_9204312663168698250%7CPROD_PC_9204312663168698250%2Cgpcid%3A9204312663168698250%2Cmid%3A576462251332985478%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=f456f54c-f5cb-4844-b810-169096962fad&title=Stila+Custom+Correcting+Palette&store=hqhair&storeName=HQHair
```

### HSN `(hsn)`  · relay=Y

**Product**: Motorola Moto G 64GB Tracfone w/1500 Talk/Text/Data 1 Year Plan w/Accessories - Hyper Floral

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dproductid%3A7896662458278670048%2CheadlineOfferDocid%3A7896662458278670048%2CimageDocid%3A17599174825779415892%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=cccecc21-e911-4978-99a1-f6460cd90425&title=Motorola+Moto+G+64GB+Tracfone+w%2F1500+Talk%2FText%2FData+1+Year+Plan+w%2FAccessories+-+Hyper+Floral&store=hsn&storeName=HSN
```

### Hughes `(hughes)`  · relay=Y

**Product**: Hisense 4K QLED Smart TV

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHisense+50+inch+TV+deals%26prds%3Dcatalogid%3A8601222244804472676%2Cproductid%3A15808940732489536882%2CheadlineOfferDocid%3A6738754305068208708%2CimageDocid%3A11780615660712746812%2Crds%3APC_8056695329710168264%7CPROD_PC_8056695329710168264%2Cgpcid%3A8056695329710168264%2Cmid%3A576462886931840488%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=c849cab1-619e-4a8d-8ed0-83fb95d83ff6&title=Hisense+4K+QLED+Smart+TV&store=hughes&storeName=Hughes
```

### Hyper Microsystems `(hyper-microsystems)`  · relay=Y

**Product**: Metroid Prime 4 Nintendo Switch

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNintendo+Switch+OLED+deals%26prds%3Dcatalogid%3A5236332939307748434%2Cproductid%3A14194666446568981217%2CheadlineOfferDocid%3A1330046933837410957%2CimageDocid%3A3076803311582254135%2Crds%3APC_14321017547197880682%7CPROD_PC_14321017547197880682%2Cgpcid%3A14321017547197880682%2Cmid%3A576462875092089665%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=fb5eab1c-a870-49a6-b624-c90ef7d75917&title=Metroid+Prime+4+Nintendo+Switch&store=hyper-microsystems&storeName=Hyper+Microsystems
```

### Hyugalife `(hyugalife)`  · relay=Y

**Product**: MuscleBlaze Pre Workout WrathX with CreapureÂ ï ̧ , Nitroblaze & BioPerine (Cola Frost, 340 g, 20 Servings)

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A15646334384101710242%2CheadlineOfferDocid%3A15646334384101710242%2CimageDocid%3A8527800975866048149%2Crds%3APC_15892763815527881073%7CPROD_PC_15892763815527881073%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=b85c7478-a6f3-4931-b3a6-7ba7edad0861&title=MuscleBlaze+Pre+Workout+WrathX+with+Creapure%C3%82+%C3%AF+%CC%A7+%2C+Nitroblaze+%26+BioPerine+%28Cola+Frost%2C+340+g%2C+20+Servings%29&store=hyugalife&storeName=Hyugalife
```

### iCrescent Apple Authorised Store `(icrescent-apple-authorised-store)`  · relay=Y

**Product**: Apple Mac mini with M4 Pro chip

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A8377528990347347144%2Cproductid%3A12202957319670176321%2CheadlineOfferDocid%3A2942930050107728584%2CimageDocid%3A11943665298519245273%2Crds%3APC_2888277432229933649%7CPROD_PC_2888277432229933649%2Cgpcid%3A4800872767779270366%2Cmid%3A576462878929381446%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=06ed1aa9-3a0c-4675-8323-f1525f7ac0c6&title=Apple+Mac+mini+with+M4+Pro+chip&store=icrescent-apple-authorised-store&storeName=iCrescent+Apple+Authorised+Store
```

### iHerb `(iherb)`  · relay=Y

**Product**: ETUDE Fixing Tint

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A17681858277894950484%2Cproductid%3A12564677507428511730%2CheadlineOfferDocid%3A922876299373678846%2CimageDocid%3A10832482550511560328%2Crds%3APC_862846632287579306%7CPROD_PC_862846632287579306%2Cgpcid%3A862846632287579306%2Cmid%3A576462778143540656%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=2930a8ad-9305-4e80-be74-290a692a1c39&title=ETUDE+Fixing+Tint&store=iherb&storeName=iHerb
```

### ILIA Beauty `(ilia-beauty)`  · relay=Y

**Product**: Ilia The Beauty of Clean Makeup Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A8447540800895570929%2Cproductid%3A11709002229433342037%2CheadlineOfferDocid%3A16274327968358681179%2CimageDocid%3A16711606739826559242%2Crds%3APC_2665766424081066165%7CPROD_PC_2665766424081066165%2Cgpcid%3A2665766424081066165%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ec0da3a8-99a3-4eea-a032-6ff62241eba1&title=Ilia+The+Beauty+of+Clean+Makeup+Set&store=ilia-beauty&storeName=ILIA+Beauty
```

### Import It All `(import-it-all)`  · relay=Y

**Product**: CyberPowerPC Gamer Xtreme Gaming Desktop Computer, Intel Core I5-13400F 2.5GHz, 16GB RAM, 500GB SSD, NVIDIA GeForce RTX 3050 8GB, Windows 11 Home, Bla

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A5212097143320538830%2Cproductid%3A5424238028180709038%2CheadlineOfferDocid%3A2247213138914246885%2CimageDocid%3A17583322634407392114%2Crds%3APC_10116914212957893781%7CPROD_PC_10116914212957893781%2Cgpcid%3A10116914212957893781%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=ee620b64-bafa-4de5-839d-66c6bc75cafb&title=CyberPowerPC+Gamer+Xtreme+Gaming+Desktop+Computer%2C+Intel+Core+I5-13400F+2.5GHz%2C+16GB+RAM%2C+500GB+SSD%2C+NVIDIA+GeForce+RTX+&store=import-it-all&storeName=Import+It+All
```

### Incredible `(incredible)`  · relay=Y

**Product**: Klipsch Flexus Sub 100 Wireless Subwoofer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A14056918246345912425%2Cproductid%3A11291169692258165964%2CheadlineOfferDocid%3A17121799542020016197%2CimageDocid%3A5749014759114221005%2Crds%3APC_10310229902791387322%7CPROD_PC_10310229902791387322%2Cgpcid%3A10310229902791387322%2Cmid%3A576462782486339301%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=c6381184-8cc0-4151-914a-7d8c3bb2c3a5&title=Klipsch+Flexus+Sub+100+Wireless+Subwoofer&store=incredible&storeName=Incredible
```

### Infinity Flux `(infinity-flux)`  · relay=Y

**Product**: Nintendo Switch OLED Legend of Zelda: Tears of The Kingdom Edition

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNintendo+Switch+OLED+deals%26prds%3Dcatalogid%3A17046050523569207286%2Cproductid%3A8968590260331240708%2CheadlineOfferDocid%3A280857496537993389%2CimageDocid%3A11069358248185619320%2Crds%3APC_16833291093980419144%7CPROD_PC_16833291093980419144%2Cgpcid%3A16833291093980419144%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=5d32bcc9-293c-4a0b-94db-c0c399cbf5b2&title=Nintendo+Switch+OLED+Legend+of+Zelda%3A+Tears+of+The+Kingdom+Edition&store=infinity-flux&storeName=Infinity+Flux
```

### Instacart `(instacart)`  · relay=Y

**Product**: Ninja 10-in-1 Double Oven with FlexDoor DCT400

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A9745319812687926538%2Cproductid%3A1770398892364519833%2CheadlineOfferDocid%3A2111459618067214346%2CimageDocid%3A4258790770276940471%2Crds%3APC_12377901558959371735%7CPROD_PC_12377901558959371735%2Cgpcid%3A12377901558959371735%2Cmid%3A576462459275882782%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b4b8c562-330a-4b47-8c16-44501eaa1f7c&title=Ninja+10-in-1+Double+Oven+with+FlexDoor+DCT400&store=instacart&storeName=Instacart
```

### Instant Pot `(instant-pot)`  · relay=Y

**Product**: Instant Pot 6qt 9-in-1 Pressure Cooker Bundle

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DInstant+Pot+Duo+6QT+deals%26prds%3Dcatalogid%3A15420169283101981710%2Cproductid%3A1829475232359603925%2CheadlineOfferDocid%3A3951154821039563473%2CimageDocid%3A10621585788327858762%2Crds%3APC_14114737788605914116%7CPROD_PC_14114737788605914116%2Cgpcid%3A14114737788605914116%2Cmid%3A576462796250247464%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=673a28a8-3c03-438a-8dce-b7356c6d675e&title=Instant+Pot+6qt+9-in-1+Pressure+Cooker+Bundle&store=instant-pot&storeName=Instant+Pot
```

### instant-gaming.com `(instant-gaming)`  · relay=Y

**Product**: Crimson Desert (2026) PC (STEAM) - Instant download

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dproductid%3A12238379812056125994%2CheadlineOfferDocid%3A12238379812056125994%2CimageDocid%3A16744910736823430979%2Crds%3APC_13912403595559343890%7CPROD_PC_13912403595559343890%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=d399796d-067f-49f2-a22d-6a94afe2af6e&title=Crimson+Desert+%282026%29+PC+%28STEAM%29+-+Instant+download&store=instant-gaming&storeName=instant-gaming.com
```

### Intelligent Computing Enterprise `(intelligent-computing-enterprise)`  · relay=Y

**Product**: Dell PowerEdge R720 Server

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dproductid%3A13060353373674562928%2CheadlineOfferDocid%3A13060353373674562928%2CimageDocid%3A11471854733167199370%2Crds%3APC_8170086441818342145%7CPROD_PC_8170086441818342145%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=203a65dd-3183-46b6-9829-05bc37eefd6b&title=Dell+PowerEdge+R720+Server&store=intelligent-computing-enterprise&storeName=Intelligent+Computing+Enterprise
```

### IT NET `(it-net)`  · relay=Y

**Product**: Microsoft Xbox Series S

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A6848973438681244674%2CheadlineOfferDocid%3A13559251451537000109%2CimageDocid%3A9252908786828393556%2Crds%3APC_3338220088030108590%7CPROD_PC_3338220088030108590%2Cgpcid%3A3338220088030108590%2Cmid%3A576462751498650066%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=7d9d8e4a-9a56-40b7-947c-d96f0ca3fdd8&title=Microsoft+Xbox+Series+S&store=it-net&storeName=IT+NET
```

### itprice `(itprice)`  · relay=Y

**Product**: HP External USB DVD-RW Drive

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A1473874306321364963%2Cproductid%3A4337017281707623248%2CheadlineOfferDocid%3A3164813075147648414%2CimageDocid%3A8469074773915555468%2Crds%3APC_7000669007450251939%7CPROD_PC_7000669007450251939%2Cgpcid%3A7000669007450251939%2Cmid%3A576462881476426917%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=05d295de-dd79-4732-95ef-be3f5164c38f&title=HP+External+USB+DVD-RW+Drive&store=itprice&storeName=itprice
```

### Jacamo `(jacamo)`  · relay=Y

**Product**: Levi's 501 Original Straight Fit Jean - Size 34L - Dark Indigo - 100% Cotton - Men's Jeans

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLevi%27s+501+Original+deals%26prds%3Dproductid%3A7771161426345606645%2CheadlineOfferDocid%3A7771161426345606645%2CimageDocid%3A8345308651748605930%2Crds%3APC_9170949368630816963%7CPROD_PC_9170949368630816963%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=129844a9-18de-402a-9139-704742ff7398&title=Levi%27s+501+Original+Straight+Fit+Jean+-+Size+34L+-+Dark+Indigo+-+100%25+Cotton+-+Men%27s+Jeans&store=jacamo&storeName=Jacamo
```

### JBL India `(jbl-india)`  · relay=Y

**Product**: JBL PartyBox Encore Essential 2 100W Portable Bluetooth Party Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A12796064779373447293%2Cproductid%3A13835351947749931445%2CheadlineOfferDocid%3A14530689532696366512%2CimageDocid%3A7123237460049714256%2Crds%3APC_5386214243610362800%7CPROD_PC_5386214243610362800%2Cgpcid%3A5386214243610362800%2Cmid%3A576462834021066048%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=f2f39023-b040-4762-aafe-5b754bd1b17d&title=JBL+PartyBox+Encore+Essential+2+100W+Portable+Bluetooth+Party+Speaker&store=jbl-india&storeName=JBL+India
```

### JCPenney `(jcpenney)`  · relay=Y

**Product**: adidas X_PLR Path Women's Running Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A1960634821899053813%2Cproductid%3A3290804036103768546%2CheadlineOfferDocid%3A9030147304739110818%2CimageDocid%3A13946304026613556225%2Crds%3APC_15497387408271996887%7CPROD_PC_15497387408271996887%2Cgpcid%3A15497387408271996887%2Cmid%3A576462867112145581%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=9978368e-18dd-4a7d-af48-9a4a30df2afc&title=adidas+X_PLR+Path+Women%27s+Running+Shoes&store=jcpenney&storeName=JCPenney
```

### JD Williams `(jd-williams)`  · relay=Y

**Product**: JD Williams Fine Plisse Soft Shirt

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A16717623889470649089%2Cproductid%3A290884407285974061%2CheadlineOfferDocid%3A3916427822500415456%2CimageDocid%3A11485938648147995192%2Cgpcid%3A3639692875783785162%2Cmid%3A576462849677347888%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=abe42aab-9160-4f10-8c9b-c6bfc9aae982&title=JD+Williams+Fine+Plisse+Soft+Shirt&store=jd-williams&storeName=JD+Williams
```

### Jerome's Furniture & Mattress Store `(jerome-s-furniture-mattress-store)`  · relay=Y

**Product**: Avocado Green Mattress Firm Queen Mattress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dproductid%3A3950504369334706961%2CheadlineOfferDocid%3A3950504369334706961%2CimageDocid%3A9877953676875867305%2Crds%3APC_3141362330666978124%7CPROD_PC_3141362330666978124%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ccb68893-a2cc-4cc2-876e-17769fd4416d&title=Avocado+Green+Mattress+Firm+Queen+Mattress&store=jerome-s-furniture-mattress-store&storeName=Jerome%27s+Furniture+%26+Mattress+Store
```

### JLab `(jlab)`  · relay=Y

**Product**: JLab Go Air Pop+ Tones True Wireless Earbuds

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A13648124057174724472%2Cproductid%3A10747089472578127771%2CheadlineOfferDocid%3A7933827800870252650%2CimageDocid%3A16576711824282149447%2Crds%3APC_17954325544060936592%7CPROD_PC_17954325544060936592%2Cgpcid%3A17954325544060936592%2Cmid%3A576462810923939203%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=d52ca3f9-cc03-48d0-9ba5-cef7c3ac6ecb&title=JLab+Go+Air+Pop%2B+Tones+True+Wireless+Earbuds&store=jlab&storeName=JLab
```

### Jomashop.com `(jomashop)`  · relay=Y

**Product**: Clinique Even Better Makeup SPF 15

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A18374003122783748767%2Cproductid%3A8843456952427994118%2CheadlineOfferDocid%3A10986610766144950516%2CimageDocid%3A9981690955144369103%2Crds%3APC_10409066698891336492%7CPROD_PC_10409066698891336492%2Cgpcid%3A10409066698891336492%2Cmid%3A576462224915897772%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c996c1ac-cb1d-4f1a-8e83-bf47cc394d6d&title=Clinique+Even+Better+Makeup+SPF+15&store=jomashop&storeName=Jomashop.com
```

### JSHealth Vitamins US `(jshealth-vitamins-us)`  · relay=Y

**Product**: Ultimate Health Bundle

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A17934779703072899530%2Cproductid%3A17168748924146838665%2CheadlineOfferDocid%3A3198673347523439465%2CimageDocid%3A17225450522704441158%2Cgpcid%3A3212646436129316259%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=8f2d27db-0f43-410f-acd3-4507bfbb8edf&title=Ultimate+Health+Bundle&store=jshealth-vitamins-us&storeName=JSHealth+Vitamins+US
```

### Jumbo.ae `(jumbo-ae)`  · relay=Y

**Product**: HP Victus Gaming Laptop 6GB NVIDIA GeForce RTX 3050 Graphics / 13th Gen / Intel Core i7-13620H / 15.6inch FHD / 512GB SSD / 16GB RAM

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A236663256938558690%2Cproductid%3A17013219929550490667%2CheadlineOfferDocid%3A15560682256813713054%2CimageDocid%3A14166774215133366165%2Cgpcid%3A6755679152000593630%2Cmid%3A576462887712216069%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=946f142a-f97b-4a78-9e92-d13a81d5ff22&title=HP+Victus+Gaming+Laptop+6GB+NVIDIA+GeForce+RTX+3050+Graphics+%2F+13th+Gen+%2F+Intel+Core+i7-13620H+%2F+15.6inch+FHD+%2F+512GB+SS&store=jumbo-ae&storeName=Jumbo.ae
```

### Just Cruizin Clothing `(just-cruizin-clothing)`  · relay=Y

**Product**: Gina Spanish Viscose Mini Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A12279047952244163644%2Cproductid%3A154616498450189790%2CheadlineOfferDocid%3A8303928154797715651%2CimageDocid%3A9106661463387609703%2Cgpcid%3A11387825892351185869%2Cmid%3A576462874586153368%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=5effe6be-2918-4459-b45c-a5aec855df6b&title=Gina+Spanish+Viscose+Mini+Dress&store=just-cruizin-clothing&storeName=Just+Cruizin+Clothing
```

### Just Press Play `(just-press-play)`  · relay=Y

**Product**: Starfield (Xbox Series X)

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DXbox+Series+X%26prds%3Dcatalogid%3A11023890943140800275%2Cproductid%3A3010543576242852554%2CheadlineOfferDocid%3A15485513318302051187%2CimageDocid%3A14326102987469545990%2Crds%3APC_3459109278123562680%7CPROD_PC_3459109278123562680%2Cgpcid%3A3459109278123562680%2Cmid%3A576462370783296778%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=12d13822-9d21-4a16-b3d1-e97bca18e647&title=Starfield+%28Xbox+Series+X%29&store=just-press-play&storeName=Just+Press+Play
```

### Justmylook `(justmylook)`  · relay=Y

**Product**: Elemis Superfood Facial Oil 15ml

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A4186629620979305536%2Cproductid%3A453642714540755578%2CheadlineOfferDocid%3A14152590146628535565%2CimageDocid%3A16765780316042296134%2Crds%3APC_6780196391757063005%7CPROD_PC_6780196391757063005%2Cgpcid%3A6780196391757063005%2Cmid%3A576462735889524845%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=f0499e8e-8b32-48f6-aeab-c153d8e299a1&title=Elemis+Superfood+Facial+Oil+15ml&store=justmylook&storeName=Justmylook
```

### JustNatural.co.uk `(justnatural)`  · relay=Y

**Product**: Rheal Superfoods Clean Greens Sachets

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A13091539493726886941%2Cproductid%3A10702472973802208492%2CheadlineOfferDocid%3A12917434485666051594%2CimageDocid%3A42446470670440462%2Crds%3APC_4796578656962694542%7CPROD_PC_4796578656962694542%2Cgpcid%3A4796578656962694542%2Cmid%3A576462882021051219%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=ab7a5002-8162-4636-8d61-eab91a68ad62&title=Rheal+Superfoods+Clean+Greens+Sachets&store=justnatural&storeName=JustNatural.co.uk
```

### Juvia's Place `(juvia-s-place)`  · relay=Y

**Product**: Juvia's Place Blushed Duo Blush

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A7199734175117082847%2Cproductid%3A13236570323411481427%2CheadlineOfferDocid%3A14364843955766961329%2CimageDocid%3A402868721060242729%2Crds%3APC_13206438645299771068%7CPROD_PC_13206438645299771068%2Cgpcid%3A13206438645299771068%2Cmid%3A576462656295890046%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=9ac8025e-cc84-4218-b458-17209f8b4fe6&title=Juvia%27s+Place+Blushed+Duo+Blush&store=juvia-s-place&storeName=Juvia%27s+Place
```

### Kamal Imaging `(kamal-imaging)`  · relay=Y

**Product**: SAMSUNG Galaxy A36-A366B Android Mobile Smart Phone With 128GB+8GB & 256GB+8GB

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A14628870851149331852%2CheadlineOfferDocid%3A885095684296006061%2CimageDocid%3A10658376484618040663%2Crds%3APC_2094322970772669367%7CPROD_PC_2094322970772669367%2Cgpcid%3A2094322970772669367%2Cmid%3A576462542884163174%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=20660147-e34d-4762-b214-ea8104682b1b&title=SAMSUNG+Galaxy+A36-A366B+Android+Mobile+Smart+Phone+With+128GB%2B8GB+%26+256GB%2B8GB&store=kamal-imaging&storeName=Kamal+Imaging
```

### kccomputers.co.in `(kccomputers)`  · relay=Y

**Product**: Cosmic Byte Ares Pro Tri-Mode Wireless Controller

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A4183961060765156970%2Cproductid%3A16959066793707469993%2CheadlineOfferDocid%3A6819741889103983202%2CimageDocid%3A3909176016826344561%2Cgpcid%3A17979444436383868172%2Cmid%3A576462839507868592%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=42277779-5992-4730-8d94-f93d7883e743&title=Cosmic+Byte+Ares+Pro+Tri-Mode+Wireless+Controller&store=kccomputers&storeName=kccomputers.co.in
```

### Kennel Bookstore `(kennel-bookstore)`  · relay=Y

**Product**: DREAM The Good Patch

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A953212248470975770%2Cproductid%3A5067584220807259031%2CheadlineOfferDocid%3A14109915752561427812%2CimageDocid%3A8023031583437815791%2Crds%3APC_16210051936185334649%7CPROD_PC_16210051936185334649%2Cgpcid%3A16210051936185334649%2Cmid%3A576462308646541891%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=46396d05-3e91-48e4-91b4-a63493cea2bc&title=DREAM+The+Good+Patch&store=kennel-bookstore&storeName=Kennel+Bookstore
```

### KIABI `(kiabi)`  · relay=Y

**Product**: Kiabi Tailored jacket

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A12020545633996353444%2Cproductid%3A7091368065232834198%2CheadlineOfferDocid%3A8272063908735393755%2CimageDocid%3A17635394388487604724%2Crds%3APC_13509549870243350945%7CPROD_PC_13509549870243350945%2Cgpcid%3A13509549870243350945%2Cmid%3A576462872819598237%2Cpvt%3Aa%26hl%3Den%26gl%3Dae%26udm%3D28&id=6dab95d1-1157-4a08-8cc2-01bf32aa5f35&title=Kiabi+Tailored+jacket&store=kiabi&storeName=KIABI
```

### King Arthur Baking `(king-arthur-baking)`  · relay=Y

**Product**: Cuisinart 14 Cup Food Processor

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A1949481816336231669%2Cproductid%3A12679455346822862466%2CheadlineOfferDocid%3A15911705226719508801%2CimageDocid%3A9327336057385566969%2Crds%3APC_5971375660276786371%7CPROD_PC_5971375660276786371%2Cgpcid%3A5971375660276786371%2Cmid%3A576460815505247514%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=a793f08f-dc8b-4609-8db2-7601ac3492c7&title=Cuisinart+14+Cup+Food+Processor&store=king-arthur-baking&storeName=King+Arthur+Baking
```

### King of Hobby Deals `(king-of-hobby-deals)`  · relay=Y

**Product**: Sony PlayStation 5 Standard Console with Fortnite Bundle

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPlayStation+5%26prds%3Dcatalogid%3A8039622388823297908%2Cproductid%3A2168478264439240845%2CheadlineOfferDocid%3A12541261268303929786%2CimageDocid%3A16556286488327522262%2Crds%3APC_10252959786065141094%7CPROD_PC_10252959786065141094%2Cgpcid%3A10252959786065141094%2Cmid%3A576462473330202839%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=4b7588b5-0f3c-4121-973d-86a3358547cf&title=Sony+PlayStation+5+Standard+Console+with+Fortnite+Bundle&store=king-of-hobby-deals&storeName=King+of+Hobby+Deals
```

### KitchenAid `(kitchenaid)`  · relay=Y

**Product**: Kitchenaid 4.5 Quart Deluxe Tilt-Head Stand Mixer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A14783695378201499037%2Cproductid%3A4748649269314132245%2CheadlineOfferDocid%3A7828002151389158791%2CimageDocid%3A8464692153690495987%2Crds%3APC_4297200489607820550%7CPROD_PC_4297200489607820550%2Cgpcid%3A4297200489607820550%2Cmid%3A576462787745401894%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=3f7913bd-1272-4007-9271-a52555cced35&title=Kitchenaid+4.5+Quart+Deluxe+Tilt-Head+Stand+Mixer&store=kitchenaid&storeName=KitchenAid
```

### KitchenAid United Kingdom `(kitchenaid-united-kingdom)`  · relay=Y

**Product**: KitchenAid Classic Stand Mixer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A7610279055133945026%2Cproductid%3A1950434973742751590%2CheadlineOfferDocid%3A8691674884378519097%2CimageDocid%3A15231703129085515205%2Crds%3APC_2280768807321478589%7CPROD_PC_2280768807321478589%2Cgpcid%3A2280768807321478589%2Cmid%3A576462846940007960%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=14bd909b-475e-485d-8461-c1fc630d8365&title=KitchenAid+Classic+Stand+Mixer&store=kitchenaid-united-kingdom&storeName=KitchenAid+United+Kingdom
```

### Kitlocker `(kitlocker)`  · relay=Y

**Product**: Puma Orbita Cup Premier League Brilliance Football

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A3492412899252834884%2Cproductid%3A4044199564096157768%2CheadlineOfferDocid%3A3859493128023858684%2CimageDocid%3A9488995222245568173%2Crds%3APC_15261784212606589057%7CPROD_PC_15261784212606589057%2Cgpcid%3A15261784212606589057%2Cmid%3A576462836085828195%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=dcd6cd23-1bb8-470a-8bc0-c8c6732cf2e2&title=Puma+Orbita+Cup+Premier+League+Brilliance+Football&store=kitlocker&storeName=Kitlocker
```

### Kloppers `(kloppers)`  · relay=Y

**Product**: Nikon Z5 Mirrorless Digital Camera

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A9514337972151770661%2Cproductid%3A12440100116993531034%2CheadlineOfferDocid%3A11472582916351192206%2CimageDocid%3A1430568768195895725%2Crds%3APC_18348655736602578317%7CPROD_PC_18348655736602578317%2Cgpcid%3A18348655736602578317%2Cmid%3A576462421744123487%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=00d4002e-72d3-4980-bd4d-b351620e977e&title=Nikon+Z5+Mirrorless+Digital+Camera&store=kloppers&storeName=Kloppers
```

### Known Nutrition `(known-nutrition)`  · relay=Y

**Product**: PCOS Support Gummies

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A15967058774034014282%2Cproductid%3A12238527166465294986%2CheadlineOfferDocid%3A8563169028756327193%2CimageDocid%3A15317656460098945008%2Cgpcid%3A14732888767747811769%2Cmid%3A576462882310984604%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=b2e11984-9c89-429a-96b7-8dc6ad8aa42d&title=PCOS+Support+Gummies&store=known-nutrition&storeName=Known+Nutrition
```

### Korean Skincare B.V. `(korean-skincare-b-v)`  · relay=Y

**Product**: Medicube AGE-R Booster Pro

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A2596862865616075617%2Cproductid%3A13936302324265160009%2CheadlineOfferDocid%3A15442616819393714867%2CimageDocid%3A12566299052720366469%2Crds%3APC_14931813724247594274%7CPROD_PC_14931813724247594274%2Cgpcid%3A14931813724247594274%2Cmid%3A576462804288536324%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=2ec8bea3-704b-4c9e-98b3-78658a3b02db&title=Medicube+AGE-R+Booster+Pro&store=korean-skincare-b-v&storeName=Korean+Skincare+B.V.
```

### Laptop Mechanic `(laptop-mechanic)`  · relay=Y

**Product**: AMD Ryzen 5 5500 6-Core 3.6 GHz AM4 CPU

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A11014790934219036926%2Cproductid%3A17998790843522914986%2CheadlineOfferDocid%3A8769121993826749039%2CimageDocid%3A14759496329094589797%2Crds%3APC_7206357340401329705%7CPROD_PC_7206357340401329705%2Cgpcid%3A7206357340401329705%2Cmid%3A576462768726020686%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=36c157b2-83af-4f5d-859e-40260c978b3f&title=AMD+Ryzen+5+5500+6-Core+3.6+GHz+AM4+CPU&store=laptop-mechanic&storeName=Laptop+Mechanic
```

### Laptop Outlet `(laptop-outlet)`  · relay=Y

**Product**: Lenovo LOQ Tower 17IAX10 Intel Core Ultra 7 255HX

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A17654717718506084625%2Cproductid%3A16693783119574438347%2CheadlineOfferDocid%3A13146009575614167269%2CimageDocid%3A10410695300529002008%2Crds%3APC_1868785803660971430%7CPROD_PC_1868785803660971430%2Cgpcid%3A1868785803660971430%2Cmid%3A576462860725627530%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=c8a9f90b-b4dc-4ae6-9a63-f02c2485f701&title=Lenovo+LOQ+Tower+17IAX10+Intel+Core+Ultra+7+255HX&store=laptop-outlet&storeName=Laptop+Outlet
```

### Laptops Direct `(laptops-direct)`  · relay=Y

**Product**: Lenovo LOQ 15AHP10 AMD Ryzen Laptop 39.6 cm

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A7470700666404569468%2Cproductid%3A10679549287939303803%2CheadlineOfferDocid%3A12686831913105883248%2CimageDocid%3A2166745521574119980%2Crds%3APC_1548544363008190288%7CPROD_PC_1548544363008190288%2Cgpcid%3A1548544363008190288%2Cmid%3A576462531113099381%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=f130593c-0594-4991-8b60-a295ffe190ae&title=Lenovo+LOQ+15AHP10+AMD+Ryzen+Laptop+39.6+cm&store=laptops-direct&storeName=Laptops+Direct
```

### Lategan & Van Biljoens `(lategan-van-biljoens)`  · relay=Y

**Product**: Kenwood Air Fryer kHealthy Fry 7L

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A13211912472671549380%2Cproductid%3A1602315866002514740%2CheadlineOfferDocid%3A11711870849288772257%2CimageDocid%3A13375559377835680829%2Crds%3APC_3483418255969078736%7CPROD_PC_3483418255969078736%2Cgpcid%3A3483418255969078736%2Cmid%3A576462881461825616%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=61573e4c-350d-47c3-8966-d204ff41e4ef&title=Kenwood+Air+Fryer+kHealthy+Fry+7L&store=lategan-van-biljoens&storeName=Lategan+%26+Van+Biljoens
```

### Laura Geller `(laura-geller)`  · relay=Y

**Product**: Laura Geller Beauty Light and Full Coverage Foundation Kit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A3624210302526740854%2CheadlineOfferDocid%3A7629567955754652023%2CimageDocid%3A9342966660722396214%2Crds%3APC_2796073169773471978%7CPROD_PC_2796073169773471978%2Cgpcid%3A2796073169773471978%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=625dba6c-b065-4765-84e3-032f9c5bd63c&title=Laura+Geller+Beauty+Light+and+Full+Coverage+Foundation+Kit&store=laura-geller&storeName=Laura+Geller
```

### League Outfitters `(league-outfitters)`  · relay=Y

**Product**: Alleson Athletic Men's Blank Reversible Game Jersey a105ba

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A12049991386045789061%2Cproductid%3A7385001695703644711%2CheadlineOfferDocid%3A17515157410812514082%2CimageDocid%3A13742046213296190380%2Crds%3APC_9163040243157738865%7CPROD_PC_9163040243157738865%2Cgpcid%3A9163040243157738865%2Cmid%3A576462476189992341%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=c0c7c1c1-f97c-426c-9c7a-307ce184aa44&title=Alleson+Athletic+Men%27s+Blank+Reversible+Game+Jersey+a105ba&store=league-outfitters&storeName=League+Outfitters
```

### Lenovo `(lenovo)`  · relay=Y

**Product**: Lenovo Legion Tower 5 Gaming Tower

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A17491892206569163517%2Cproductid%3A11811618165562752894%2CheadlineOfferDocid%3A11017044615546763567%2CimageDocid%3A9337793228978557317%2Crds%3APC_935850382494135936%7CPROD_PC_935850382494135936%2Cgpcid%3A935850382494135936%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=876ce281-4657-47b2-94c0-c5b2b29c802e&title=Lenovo+Legion+Tower+5+Gaming+Tower&store=lenovo&storeName=Lenovo
```

### Levi's `(levi-s)`  · relay=Y

**Product**: Levi's Men's 501 Original Fit Regular-Fit Jeans

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLevi%27s+501+Original+deals%26prds%3Dcatalogid%3A16014011360923139705%2Cproductid%3A10122423291611253898%2CheadlineOfferDocid%3A1919666220001635474%2CimageDocid%3A2203352857856303589%2Crds%3APC_13449902344854510490%7CPROD_PC_13449902344854510490%2Cgpcid%3A13449902344854510490%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=29671cd7-b2f5-4de8-ae6c-30188d75b66d&title=Levi%27s+Men%27s+501+Original+Fit+Regular-Fit+Jeans&store=levi-s&storeName=Levi%27s
```

### LG `(lg)`  · relay=Y

**Product**: LG OLED evo AI G5 4K Smart TV

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLG+OLED+55+deals%26prds%3Dcatalogid%3A16716928608002094280%2Cproductid%3A17523780631347924709%2CheadlineOfferDocid%3A116395076393693494%2CimageDocid%3A17081717766841626793%2Crds%3APC_16229247365340076850%7CPROD_PC_16229247365340076850%2Cgpcid%3A16229247365340076850%2Cmid%3A576462511549404572%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ba8112f5-5130-417d-8cc2-a127c9c94309&title=LG+OLED+evo+AI+G5+4K+Smart+TV&store=lg&storeName=LG
```

### Limango DE `(limango-de)`  · relay=Y

**Product**: Reisenthel carrybag Shopping Basket

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A8905268531283399553%2Cproductid%3A14728612158896060373%2CheadlineOfferDocid%3A17559108969932748693%2CimageDocid%3A342605410105566588%2Crds%3APC_15091429553608597407%7CPROD_PC_15091429553608597407%2Cgpcid%3A15091429553608597407%2Cmid%3A576462807472099145%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=20d53e6f-8846-4461-870e-44f110246348&title=Reisenthel+carrybag+Shopping+Basket&store=limango-de&storeName=Limango+DE
```

### ListenUp `(listenup)`  · relay=Y

**Product**: NAD C 338 Hybrid Digital Integrated Amplifier

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A8122132237166564155%2Cproductid%3A16884351923616673510%2CheadlineOfferDocid%3A15699085025442492901%2CimageDocid%3A16989462672650918633%2Crds%3APC_4867979212726407732%7CPROD_PC_4867979212726407732%2Cgpcid%3A4867979212726407732%2Cmid%3A576462682845591115%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=180bac9d-0541-4434-b228-350b9429e6c6&title=NAD+C+338+Hybrid+Digital+Integrated+Amplifier&store=listenup&storeName=ListenUp
```

### Littlewoods `(littlewoods)`  · relay=Y

**Product**: MSI Summit A16 AI+ A3HMTG-027UK AMD Ryzen AI 9 365 Hybrid

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A14929343096074061905%2Cproductid%3A1411080338650916596%2CheadlineOfferDocid%3A13426792965149732689%2CimageDocid%3A4751525977648102745%2Crds%3APC_9802555996076276208%7CPROD_PC_9802555996076276208%2Cgpcid%3A9802555996076276208%2Cmid%3A576462803391662786%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=d7b5c6a3-e1f0-4a82-aefe-8c067e06b6f3&title=MSI+Summit+A16+AI%2B+A3HMTG-027UK+AMD+Ryzen+AI+9+365+Hybrid&store=littlewoods&storeName=Littlewoods
```

### Loaded `(loaded)`  · relay=Y

**Product**: The Park PC

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A13474514898637793906%2Cproductid%3A13144724558167473570%2CheadlineOfferDocid%3A6256452749231480066%2CimageDocid%3A12088554333118354718%2Cgpcid%3A5744777100144710174%2Cmid%3A576462881043904506%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=463a2ab0-6832-4f50-b111-05f4085efb11&title=The+Park+PC&store=loaded&storeName=Loaded
```

### LOFT `(loft)`  · relay=Y

**Product**: Women's Loft Ribbed Button Trim Midi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A17029985291435709744%2Cproductid%3A11453706433034473318%2CheadlineOfferDocid%3A10173403665265823987%2CimageDocid%3A9180225116024481745%2Crds%3APC_7772735895385416286%7CPROD_PC_7772735895385416286%2Cgpcid%3A7772735895385416286%2Cmid%3A576462461327303828%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=a72a9bce-8e46-4d33-8faf-6f6fa9e8f7c6&title=Women%27s+Loft+Ribbed+Button+Trim+Midi+Dress&store=loft&storeName=LOFT
```

### Logitech G `(logitech-g)`  · relay=Y

**Product**: Logitech G920 Driving Force Racing Wheel and Xbox

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A14300372967119417079%2Cproductid%3A16509512123338366206%2CheadlineOfferDocid%3A12327577319120979619%2Crds%3APC_9205581173706866294%7CPROD_PC_9205581173706866294%2Cgpcid%3A9205581173706866294%2Cmid%3A576462204876475025%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b0b916bb-b594-4596-a296-8fc2a9823120&title=Logitech+G920+Driving+Force+Racing+Wheel+and+Xbox&store=logitech-g&storeName=Logitech+G
```

### LOOKFANTASTIC `(lookfantastic)`  · relay=Y

**Product**: NYX Professional Makeup Dewy Finish Setting Spray

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A5612917313384615260%2Cproductid%3A9165578879693949101%2CheadlineOfferDocid%3A18064929196087654171%2CimageDocid%3A10016333336446915009%2Crds%3APC_12671627958504791651%7CPROD_PC_12671627958504791651%2Cgpcid%3A12671627958504791651%2Cmid%3A576462851626557825%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=afb1df34-702e-4467-98f8-288a92e43eff&title=NYX+Professional+Makeup+Dewy+Finish+Setting+Spray&store=lookfantastic&storeName=LOOKFANTASTIC
```

### Lucky Brand `(lucky-brand)`  · relay=Y

**Product**: Lucky Brand Women's Sandwash Dolman T-Shirt

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A5755879969909437282%2Cproductid%3A2197799452617876450%2CheadlineOfferDocid%3A13446217062050129641%2CimageDocid%3A379825239213187491%2Crds%3APC_13708812009465371413%7CPROD_PC_13708812009465371413%2Cgpcid%3A13708812009465371413%2Cmid%3A576462774893773680%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=257534ad-9c0f-4c24-bc31-49e36f977923&title=Lucky+Brand+Women%27s+Sandwash+Dolman+T-Shirt&store=lucky-brand&storeName=Lucky+Brand
```

### Luckys Discount Centre `(luckys-discount-centre)`  · relay=Y

**Product**: Midea - Combi Fridge 262L - HD-359RWEN

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A7234538443176507422%2CheadlineOfferDocid%3A7234538443176507422%2CimageDocid%3A18424764136496274973%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=c14a4518-6259-4537-b502-22bea7281fd4&title=Midea+-+Combi+Fridge+262L+-+HD-359RWEN&store=luckys-discount-centre&storeName=Luckys+Discount+Centre
```

### Lyst `(lyst)`  · relay=Y

**Product**: Crocs Unisex Classic Belt Bag

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A6150960711795346259%2Cproductid%3A9917186701855600166%2CheadlineOfferDocid%3A14477848173379264168%2CimageDocid%3A5492065976654968920%2Crds%3APC_7334847999502760883%7CPROD_PC_7334847999502760883%2Cgpcid%3A7334847999502760883%2Cmid%3A576462834746625628%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=48cd545b-743f-45ae-bc80-247a152428bd&title=Crocs+Unisex+Classic+Belt+Bag&store=lyst&storeName=Lyst
```

### M&S `(m-s)`  · relay=Y

**Product**: Calvin Klein Men's Ultra Soft Modal Trunks

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCalvin+Klein+Boxers+deals%26prds%3Dcatalogid%3A4809456423711545284%2Cproductid%3A7099880811009972764%2CheadlineOfferDocid%3A7986646877829126363%2CimageDocid%3A1927754299635541720%2Crds%3APC_2173115594113058309%7CPROD_PC_2173115594113058309%2Cgpcid%3A2173115594113058309%2Cmid%3A576462555854742033%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=1092b41c-1724-4002-9f24-9c3248ec6ef7&title=Calvin+Klein+Men%27s+Ultra+Soft+Modal+Trunks&store=m-s&storeName=M%26S
```

### MAC Cosmetics `(mac-cosmetics)`  · relay=Y

**Product**: MAC Macximal Silky Matte Lipstick

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A11746914890460159779%2Cproductid%3A18438527902524664324%2CheadlineOfferDocid%3A5202265738913442339%2CimageDocid%3A10379691426517766280%2Crds%3APC_3398413625037472827%7CPROD_PC_3398413625037472827%2Cgpcid%3A3398413625037472827%2Cmid%3A576462775284874446%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=0837dea2-1175-444e-afbc-31a6decf7f4e&title=MAC+Macximal+Silky+Matte+Lipstick&store=mac-cosmetics&storeName=MAC+Cosmetics
```

### Mac Star Computers `(mac-star-computers)`  · relay=Y

**Product**: iPhone 15 Pro Max Ronaldo Football Phone Case

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DiPhone+15+Pro+Max%26prds%3Dproductid%3A5552238620469080975%2CheadlineOfferDocid%3A5552238620469080975%2CimageDocid%3A15792405922577069729%2Crds%3APC_6285855430991265102%7CPROD_PC_6285855430991265102%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=d29f9860-62fe-4b4c-8495-dad85d4b8ca9&title=iPhone+15+Pro+Max+Ronaldo+Football+Phone+Case&store=mac-star-computers&storeName=Mac+Star+Computers
```

### MacPro-LA `(macpro-la)`  · relay=Y

**Product**: Apple MacBook Pro 16 Inch With M4 Chip Core GPU 48GB SSD Space Black

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMacBook+Pro+M4%26prds%3Dcatalogid%3A1825310330728039490%2Cproductid%3A14154431786075649070%2CheadlineOfferDocid%3A15557374080140454209%2CimageDocid%3A4327625143729922006%2Crds%3APC_13774091289949219340%7CPROD_PC_13774091289949219340%2Cgpcid%3A13774091289949219340%2Cmid%3A576462892983122978%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c1144e0f-5d45-40d5-8773-35de034235b3&title=Apple+MacBook+Pro+16+Inch+With+M4+Chip+Core+GPU+48GB+SSD+Space+Black&store=macpro-la&storeName=MacPro-LA
```

### maehwa `(maehwa)`  · relay=Y

**Product**: Beauty of Joseon Relief Sun Rice + Probiotics

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A11301255399694985620%2Cproductid%3A9587258215701922690%2CheadlineOfferDocid%3A6512274332406253453%2CimageDocid%3A13939131648145849188%2Crds%3APC_7713082082189799591%7CPROD_PC_7713082082189799591%2Cgpcid%3A7713082082189799591%2Cmid%3A576462525322032311%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=e077cf07-ea08-436e-8d94-6fd76c3c68fa&title=Beauty+of+Joseon+Relief+Sun+Rice+%2B+Probiotics&store=maehwa&storeName=maehwa
```

### Mainstreet Marketplace `(mainstreet-marketplace)`  · relay=Y

**Product**: adidas FIFA World Cup 26 Trionda Training Ball

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A12620061968156728722%2Cproductid%3A11042230546253441984%2CheadlineOfferDocid%3A18190317439007007376%2CimageDocid%3A16162641953851614146%2Crds%3APC_14364511837637016592%7CPROD_PC_14364511837637016592%2Cgpcid%3A14364511837637016592%2Cmid%3A576462884641620392%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=39224ce7-5a08-4c3d-b36c-10f4918d888b&title=adidas+FIFA+World+Cup+26+Trionda+Training+Ball&store=mainstreet-marketplace&storeName=Mainstreet+Marketplace
```

### Makeup `(makeup)`  · relay=Y

**Product**: Benefit Benetint Cheek & Lip Stain

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A8621292039398993%2Cproductid%3A12680399553741897319%2CheadlineOfferDocid%3A4141613533373061639%2CimageDocid%3A16327529837952402135%2Crds%3APC_15436652598280913195%7CPROD_PC_15436652598280913195%2Cgpcid%3A15436652598280913195%2Cmid%3A576462400366156515%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=5e5e8145-7bd6-4459-b953-a42eed6573cc&title=Benefit+Benetint+Cheek+%26+Lip+Stain&store=makeup&storeName=Makeup
```

### Manage At Home `(manage-at-home)`  · relay=Y

**Product**: Doro Leva E10 Mobile Phone

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A7877751772073747556%2Cproductid%3A12014553895724626385%2CheadlineOfferDocid%3A10878703946675902727%2CimageDocid%3A8117699013094468600%2Crds%3APC_7072663571474391406%7CPROD_PC_7072663571474391406%2Cgpcid%3A7072663571474391406%2Cmid%3A576462518446212131%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=188df281-d70d-454c-ab5b-2c34142a0e6c&title=Doro+Leva+E10+Mobile+Phone&store=manage-at-home&storeName=Manage+At+Home
```

### MandM `(mandm)`  · relay=Y

**Product**: adidas Ekstraklasa Training Football

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A7345037598298857752%2Cproductid%3A5368838578016721690%2CheadlineOfferDocid%3A16735757032065894373%2CimageDocid%3A3899811415730576182%2Crds%3APC_13345154854026958094%7CPROD_PC_13345154854026958094%2Cgpcid%3A13345154854026958094%2Cmid%3A576462783970373094%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=ed0ed594-9902-4806-a784-e42ad2a97a36&title=adidas+Ekstraklasa+Training+Football&store=mandm&storeName=MandM
```

### MANGO UK `(mango-uk)`  · relay=Y

**Product**: Mango Women's Contrast-Bodice Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A9520362880248488916%2Cproductid%3A9508743395025078005%2CheadlineOfferDocid%3A13963364757154829554%2CimageDocid%3A15466326953023621181%2Cgpcid%3A14070889787181267207%2Cmid%3A576462884839950291%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=b145608f-4276-4216-823d-2f1d0dd0d212&title=Mango+Women%27s+Contrast-Bodice+Dress&store=mango-uk&storeName=MANGO+UK
```

### Mani Ram Balwant Rai `(mani-ram-balwant-rai)`  · relay=Y

**Product**: Estée Lauder Estee Lauder Advanced Night Repair Synchronized Multi-Recovery Complex Serum

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A14596846374411572398%2Cproductid%3A14372642892071196016%2CheadlineOfferDocid%3A5165445135980873230%2CimageDocid%3A9935935698912585943%2Crds%3APC_8879731069276404180%7CPROD_PC_8879731069276404180%2Cgpcid%3A8879731069276404180%2Cmid%3A576462863716097919%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=1bebc570-143a-4396-9544-e7365dfe2547&title=Est%C3%A9e+Lauder+Estee+Lauder+Advanced+Night+Repair+Synchronized+Multi-Recovery+Complex+Serum&store=mani-ram-balwant-rai&storeName=Mani+Ram+Balwant+Rai
```

### Marathon Sports `(marathon-sports)`  · relay=Y

**Product**: ASICS Men's Novablast 5

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A1396086584666558619%2Cproductid%3A5250616067987484669%2CheadlineOfferDocid%3A13863768658043149575%2CimageDocid%3A14166463954626290215%2Crds%3APC_1340101364570861215%7CPROD_PC_1340101364570861215%2Cgpcid%3A1340101364570861215%2Cmid%3A576462803464945279%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=395531ca-5819-4864-8682-d93ae16f3fcd&title=ASICS+Men%27s+Novablast+5&store=marathon-sports&storeName=Marathon+Sports
```

### Maskura Store `(maskura-store)`  · relay=Y

**Product**: Insulated Straw Tumbler - 40oz Stanley Quencher H2.0 Tumbler Bottle 40 OZ (1.2L) / Pink

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStanley+Quencher+40oz+deals%26prds%3Dproductid%3A199157212289318768%2CheadlineOfferDocid%3A199157212289318768%2CimageDocid%3A9853880544951416854%2Crds%3ALO_199157212289318768%7CPROD_LO_199157212289318768%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=f12bdb80-0834-474c-a4b6-9d0de7aecc99&title=Insulated+Straw+Tumbler+-+40oz+Stanley+Quencher+H2.0+Tumbler+Bottle+40+OZ+%281.2L%29+%2F+Pink&store=maskura-store&storeName=Maskura+Store
```

### Masons `(masons)`  · relay=Y

**Product**: Bowers & Wilkins Pi7 S2 In-Ear True Wireless Earbuds

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A10649918557085580937%2Cproductid%3A17926255139907947561%2CheadlineOfferDocid%3A16727909143517982387%2CimageDocid%3A9610477324259073178%2Crds%3APC_12453689993920138412%7CPROD_PC_12453689993920138412%2Cgpcid%3A12453689993920138412%2Cmid%3A576462694276970746%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=ec6fe5be-194e-4d86-82c4-1b6aa330f3fb&title=Bowers+%26+Wilkins+Pi7+S2+In-Ear+True+Wireless+Earbuds&store=masons&storeName=Masons
```

### Masters Wholesale `(masters-wholesale)`  · relay=Y

**Product**: GE Profile Opal 2.0 Nugget Ice Maker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A13961870421746762581%2Cproductid%3A12359235110470515667%2CheadlineOfferDocid%3A11507574277291697092%2CimageDocid%3A8594226330678880857%2Crds%3APC_9756374822266580281%7CPROD_PC_9756374822266580281%2Cgpcid%3A9756374822266580281%2Cmid%3A576462809829427451%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=41cfd014-b64b-43a8-a55e-4d8b0c1d62dc&title=GE+Profile+Opal+2.0+Nugget+Ice+Maker&store=masters-wholesale&storeName=Masters+Wholesale
```

### Maurices `(maurices)`  · relay=Y

**Product**: maurices Women's Floral Button Front Flutter Sleeve Blouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A16073470265307138714%2Cproductid%3A15438880372462338818%2CheadlineOfferDocid%3A14667727657796799541%2CimageDocid%3A7517223783792782858%2Crds%3APC_8137012018518335017%7CPROD_PC_8137012018518335017%2Cgpcid%3A8137012018518335017%2Cmid%3A576462878423766996%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=40627ab2-d75a-4fb6-a6a2-dd742421c7be&title=maurices+Women%27s+Floral+Button+Front+Flutter+Sleeve+Blouse&store=maurices&storeName=Maurices
```

### MaxAroma.com `(maxaroma)`  · relay=Y

**Product**: SK-II Pitera First Experience Kit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A5512188693805913239%2Cproductid%3A5758355673058504829%2CheadlineOfferDocid%3A13612970878505544519%2CimageDocid%3A626901026101199219%2Crds%3APC_7083241931366935241%7CPROD_PC_7083241931366935241%2Cgpcid%3A7083241931366935241%2Cmid%3A576462859076541685%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=4b2f3c3b-090f-4bc3-ac94-e658446ec141&title=SK-II+Pitera+First+Experience+Kit&store=maxaroma&storeName=MaxAroma.com
```

### MaxFashion `(maxfashion)`  · relay=Y

**Product**: Panelled Sports Shoes with Lace-Up Closure

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A6418252470861438794%2CheadlineOfferDocid%3A6418252470861438794%2CimageDocid%3A13555192592376840962%2Cpvt%3Aa%26hl%3Den%26gl%3Dae%26udm%3D28&id=948aab18-55d0-4363-b2bb-92822197d5e1&title=Panelled+Sports+Shoes+with+Lace-Up+Closure&store=maxfashion&storeName=MaxFashion
```

### McGrocer `(mcgrocer)`  · relay=Y

**Product**: MasterClass Burnished Brass Effect Kitchen Knife Set with Wooden Storage Block 6 per pack

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A11712621084557970729%2CheadlineOfferDocid%3A11712621084557970729%2CimageDocid%3A13306379706430177976%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=09558fb5-ac65-4fbc-8edd-081d48838e10&title=MasterClass+Burnished+Brass+Effect+Kitchen+Knife+Set+with+Wooden+Storage+Block+6+per+pack&store=mcgrocer&storeName=McGrocer
```

### McKeeverSports.com `(mckeeversports)`  · relay=Y

**Product**: Puma Orbita Cup Premier League Lights Football

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A16656424840706137354%2Cproductid%3A1969418489902845557%2CheadlineOfferDocid%3A3544277271812910507%2CimageDocid%3A17895079619387452355%2Crds%3APC_16479429909210192341%7CPROD_PC_16479429909210192341%2Cgpcid%3A16479429909210192341%2Cmid%3A576462523549103724%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=16c2479b-59a0-420a-b328-a69af40a4bad&title=Puma+Orbita+Cup+Premier+League+Lights+Football&store=mckeeversports&storeName=McKeeverSports.com
```

### mdcomputers.in `(mdcomputers-in)`  · relay=Y

**Product**: Ant Esports GM340 Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A2336104115557992745%2Cproductid%3A15938598763121548553%2CheadlineOfferDocid%3A13947264661360711146%2CimageDocid%3A4409644300946510155%2Cgpcid%3A2592831237380088668%2Cmid%3A576462784447976543%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=19ffea7a-be52-45c8-8c0c-4d417871c7f0&title=Ant+Esports+GM340+Gaming+Mouse&store=mdcomputers-in&storeName=mdcomputers.in
```

### medicube.us `(medicube-us)`  · relay=Y

**Product**: Affordable Glass Glow 7-Day Skincare Set Collagen Jelly Cream

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A18110955599318622956%2CheadlineOfferDocid%3A18110955599318622956%2CimageDocid%3A17888476049499413892%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=3073fc79-e240-4430-8162-d2ebf1c23be4&title=Affordable+Glass+Glow+7-Day+Skincare+Set+Collagen+Jelly+Cream&store=medicube-us&storeName=medicube.us
```

### Meijer `(meijer)`  · relay=Y

**Product**: Total Wireless Motorola Moto G 5G 2024 128Gb - Prepaid Smartphone [Locked To Total Wireless]

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dproductid%3A5962748106392155359%2CheadlineOfferDocid%3A5962748106392155359%2CimageDocid%3A6126305950372419041%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=e8b91024-1eb9-4c43-824f-a6b5bba81e1a&title=Total+Wireless+Motorola+Moto+G+5G+2024+128Gb+-+Prepaid+Smartphone+%5BLocked+To+Total+Wireless%5D&store=meijer&storeName=Meijer
```

### Mercari `(mercari)`  · relay=Y

**Product**: Apple Airpods Pro 2 Wireless Earbuds- Active Noise C

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAirPods+Pro+2%26prds%3Dproductid%3A3171637822116426535%2CheadlineOfferDocid%3A3171637822116426535%2CimageDocid%3A3003966087305196960%2Crds%3APC_3896066944466806859%7CPROD_PC_3896066944466806859%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=d551f78c-2fc5-4163-aee2-91ea4235b2ad&title=Apple+Airpods+Pro+2+Wireless+Earbuds-+Active+Noise+C&store=mercari&storeName=Mercari
```

### Merlin's TV & Appliance `(merlin-s-tv-appliance)`  · relay=Y

**Product**: Sony Bravia 8 QD-OLED 4K HDR Google TV

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSony+Bravia+55+deals%26prds%3Dcatalogid%3A15702538968395067703%2Cproductid%3A14213123010829447659%2CheadlineOfferDocid%3A9967027489193466016%2CimageDocid%3A12001342204033724411%2Crds%3APC_17525851747008935944%7CPROD_PC_17525851747008935944%2Cgpcid%3A17525851747008935944%2Cmid%3A576462516948847209%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=dc803345-05d9-41ca-a11e-ba29f3b2aadf&title=Sony+Bravia+8+QD-OLED+4K+HDR+Google+TV&store=merlin-s-tv-appliance&storeName=Merlin%27s+TV+%26+Appliance
```

### Mesh Computers `(mesh-computers)`  · relay=Y

**Product**: Mesh Next Day Work PC

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A16231321746271179087%2Cproductid%3A411100891051927847%2CheadlineOfferDocid%3A7286524883156396540%2CimageDocid%3A5566270362827872186%2Cgpcid%3A5314421490194286266%2Cmid%3A576462827612876644%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=3ca51011-2256-4023-8b40-914cd9089afe&title=Mesh+Next+Day+Work+PC&store=mesh-computers&storeName=Mesh+Computers
```

### MHC World `(mhc-world)`  · relay=Y

**Product**: Defy 7.6L Digital Air Fryer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A3683690390511102408%2CheadlineOfferDocid%3A3163035100339315668%2CimageDocid%3A13601623491124104881%2Cgpcid%3A3861330265077135989%2Cmid%3A576462870424530910%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=3e52c0bb-c43a-4f41-800b-36b06917f22f&title=Defy+7.6L+Digital+Air+Fryer&store=mhc-world&storeName=MHC+World
```

### mi.com/uk `(mi-com-uk)`  · relay=Y

**Product**: Xiaomi 14T 5G Dual SIM Titan

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRedmi+Note+14+deals%26prds%3Dcatalogid%3A14382803504954268363%2Cproductid%3A16636459515984895383%2CheadlineOfferDocid%3A16630343314864327198%2CimageDocid%3A15472326926187211238%2Crds%3APC_5372701451250625558%7CPROD_PC_5372701451250625558%2Cgpcid%3A5372701451250625558%2Cmid%3A576462497493656567%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=c1406858-722d-42fb-a65a-2d09ba0cf099&title=Xiaomi+14T+5G+Dual+SIM+Titan&store=mi-com-uk&storeName=mi.com%2Fuk
```

### Michael Kors `(michael-kors)`  · relay=Y

**Product**: Michael Kors Jet Set Large Signature Logo Shoulder Bag

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A15203609342726173671%2Cproductid%3A5039945555279270181%2CheadlineOfferDocid%3A16153256885757604979%2CimageDocid%3A15669479877692747281%2Crds%3APC_3052189860790329309%7CPROD_PC_3052189860790329309%2Cgpcid%3A3052189860790329309%2Cmid%3A576462828283651195%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=dd1f8485-5360-4a4f-bc99-73cd4f8d0cc3&title=Michael+Kors+Jet+Set+Large+Signature+Logo+Shoulder+Bag&store=michael-kors&storeName=Michael+Kors
```

### Micro Center `(micro-center)`  · relay=Y

**Product**: SteelSeries Aerox 5 Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A7431383953268940028%2Cproductid%3A1207313719841563897%2CheadlineOfferDocid%3A8202339645960871143%2CimageDocid%3A8434052700625900999%2Crds%3APC_16668940448049876138%7CPROD_PC_16668940448049876138%2Cgpcid%3A16668940448049876138%2Cmid%3A576462501879788344%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=a177f26e-ac39-43c0-b4a9-0fd3b29074b2&title=SteelSeries+Aerox+5+Gaming+Mouse&store=micro-center&storeName=Micro+Center
```

### Microsoft Store `(microsoft-store)`  · relay=Y

**Product**: Microsoft 15" Surface Laptop Copilot+ PC

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A10238920554091086080%2Cproductid%3A2799453630505065167%2CheadlineOfferDocid%3A8899723747654781317%2CimageDocid%3A5497129670731920936%2Crds%3APC_499684602044739103%7CPROD_PC_499684602044739103%2Cgpcid%3A499684602044739103%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=bb2efe9b-f50d-4c91-b8fc-4deda73a4a6f&title=Microsoft+15%22+Surface+Laptop+Copilot%2B+PC&store=microsoft-store&storeName=Microsoft+Store
```

### Midwest Racquet Sports `(midwest-racquet-sports)`  · relay=Y

**Product**: WILSON Men's Rush Pro 4.5 Tennis Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A7057587403755960921%2Cproductid%3A10044603034634067167%2CheadlineOfferDocid%3A12996583696508341769%2CimageDocid%3A12822357080050689100%2Crds%3APC_4602584598597284787%7CPROD_PC_4602584598597284787%2Cgpcid%3A4602584598597284787%2Cmid%3A576462794355235701%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=64ac50a5-9a85-4c59-af7a-737ffd3a7dbd&title=WILSON+Men%27s+Rush+Pro+4.5+Tennis+Shoes&store=midwest-racquet-sports&storeName=Midwest+Racquet+Sports
```

### Mirenesse `(mirenesse)`  · relay=Y

**Product**: Diamond Velvet Lip Plumpers Collection 4 Full Size Gift Lip Kit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A11695102848916194708%2Cproductid%3A3492861217978303175%2CheadlineOfferDocid%3A18343218024750562454%2CimageDocid%3A17566283075255223666%2Cgpcid%3A3511967952664188435%2Cmid%3A576462447219821994%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=647952e4-93a4-4c74-9465-7e309fdf1ebd&title=Diamond+Velvet+Lip+Plumpers+Collection+4+Full+Size+Gift+Lip+Kit&store=mirenesse&storeName=Mirenesse
```

### MisterTennis.com `(mistertennis)`  · relay=Y

**Product**: Lacoste Sport Tennis Tracksuit Men's Hooded Tracksuit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A3159489171438534182%2Cproductid%3A12409766489083444453%2CheadlineOfferDocid%3A398448445560036005%2CimageDocid%3A2706361884008478396%2Crds%3APC_16310362733337076652%7CPROD_PC_16310362733337076652%2Cgpcid%3A16310362733337076652%2Cmid%3A576462871730662984%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=b628365b-4be6-4e65-a1dc-4cdea7c15a7a&title=Lacoste+Sport+Tennis+Tracksuit+Men%27s+Hooded+Tracksuit&store=mistertennis&storeName=MisterTennis.com
```

### Mkpbr `(mkpbr)`  · relay=Y

**Product**: BodyAction Magnesium & Inositol Powder for Restful Sleep

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A7573833526062973718%2Cproductid%3A13484643087579566489%2CheadlineOfferDocid%3A18210792358693169514%2CimageDocid%3A12368795702560727117%2Crds%3APC_8770657827825789936%7CPROD_PC_8770657827825789936%2Cgpcid%3A8770657827825789936%2Cmid%3A576462901309744883%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=7fd90613-ac9a-4fa9-ae89-1355858d2044&title=BodyAction+Magnesium+%26+Inositol+Powder+for+Restful+Sleep&store=mkpbr&storeName=Mkpbr
```

### Mkproteinstar `(mkproteinstar)`  · relay=Y

**Product**: MuscleBlaze Biozyme Whey Protein PR

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A17238464763908693346%2Cproductid%3A9412806771082020108%2CheadlineOfferDocid%3A17986289935217064082%2CimageDocid%3A15213753799344066526%2Crds%3APC_11287284915461488005%7CPROD_PC_11287284915461488005%2Cgpcid%3A11287284915461488005%2Cmid%3A576462893189160945%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=3980d0d8-18e5-4f31-ab2d-4b8a7a54fc92&title=MuscleBlaze+Biozyme+Whey+Protein+PR&store=mkproteinstar&storeName=Mkproteinstar
```

### MOB Beauty `(mob-beauty)`  · relay=Y

**Product**: MOB Beauty Eyeshadow

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A4375474282635104505%2Cproductid%3A1216027626310541313%2CheadlineOfferDocid%3A12414728400770821937%2CimageDocid%3A3559186884342487285%2Crds%3APC_9681841119231993676%7CPROD_PC_9681841119231993676%2Cgpcid%3A9681841119231993676%2Cmid%3A576462869875837275%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=eea939aa-9860-4879-b9c4-09808d7561e4&title=MOB+Beauty+Eyeshadow&store=mob-beauty&storeName=MOB+Beauty
```

### Mobile Express `(mobile-express)`  · relay=Y

**Product**: Oppo Reno15 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A490953835043197084%2Cproductid%3A12735876835858445469%2CheadlineOfferDocid%3A1600616591824830208%2CimageDocid%3A15885571766860599604%2Crds%3APC_14499913919177247152%7CPROD_PC_14499913919177247152%2Cgpcid%3A14499913919177247152%2Cmid%3A576462876189582346%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=59f9ef8c-9934-4c3f-a5d0-77322219ab18&title=Oppo+Reno15+5G&store=mobile-express&storeName=Mobile+Express
```

### Mobilegoo Shop `(mobilegoo-shop)`  · relay=Y

**Product**: Apple iPhone 17

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A14658515877207651442%2CheadlineOfferDocid%3A15371670674406699449%2CimageDocid%3A14333392585322521998%2Crds%3APC_4728907421224624008%7CPROD_PC_4728907421224624008%2Cgpcid%3A4728907421224624008%2Cmid%3A576462889007083148%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=2621930f-6f94-4242-b753-f485cfc5d6d8&title=Apple+iPhone+17&store=mobilegoo-shop&storeName=Mobilegoo+Shop
```

### Modern Living `(modern-living)`  · relay=Y

**Product**: Siemens iQ500 60cm Black S/Steel Freestanding Fridge ks36vaxep

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronics+deals%26prds%3Dcatalogid%3A7446170888791549311%2Cproductid%3A6242079316762278399%2CheadlineOfferDocid%3A6683755016701587630%2CimageDocid%3A8447880731879601093%2Crds%3APC_5735038117746027371%7CPROD_PC_5735038117746027371%2Cgpcid%3A5735038117746027371%2Cmid%3A576462745572506529%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=4f814044-9fd8-467d-bd6b-1f6ff3172f0e&title=Siemens+iQ500+60cm+Black+S%2FSteel+Freestanding+Fridge+ks36vaxep&store=modern-living&storeName=Modern+Living
```

### MOIDA `(moida)`  · relay=Y

**Product**: House of Hur Moist Ampoule Blusher

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A15385841924802248805%2Cproductid%3A13956805422213265411%2CheadlineOfferDocid%3A16981304185657014485%2CimageDocid%3A10486398556878160843%2Crds%3APC_14896299124713079449%7CPROD_PC_14896299124713079449%2Cgpcid%3A14896299124713079449%2Cmid%3A576462749614030216%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=6bd0ab38-d48f-45fb-bb31-ef20922cdd0d&title=House+of+Hur+Moist+Ampoule+Blusher&store=moida&storeName=MOIDA
```

### Motiv8 `(motiv8)`  · relay=Y

**Product**: Shokz OpenFit Air True Wireless Open-Ear Headphones

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A588100817925523841%2Cproductid%3A3912826198908397186%2CheadlineOfferDocid%3A8197034508419237296%2CimageDocid%3A13758147237326146614%2Crds%3APC_17825433771499426774%7CPROD_PC_17825433771499426774%2Cgpcid%3A17825433771499426774%2Cmid%3A576462783692410598%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=4474c4fc-f845-47fc-9600-741033fd5da2&title=Shokz+OpenFit+Air+True+Wireless+Open-Ear+Headphones&store=motiv8&storeName=Motiv8
```

### Motorola - United Kingdom `(motorola-united-kingdom)`  · relay=Y

**Product**: Motorola Signature 5G Smartphone

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A10244080718135311774%2Cproductid%3A1270601515649144520%2CheadlineOfferDocid%3A14670645708202179501%2CimageDocid%3A13972689320064390654%2Crds%3APC_11333479691341384192%7CPROD_PC_11333479691341384192%2Cgpcid%3A11333479691341384192%2Cmid%3A576462893513348321%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=e7952cab-4f66-498a-a429-2525e238f664&title=Motorola+Signature+5G+Smartphone&store=motorola-united-kingdom&storeName=Motorola+-+United+Kingdom
```

### Motorola - United States `(motorola-united-states)`  · relay=Y

**Product**: Motorola Moto G Power 2024 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A16768952130088763242%2Cproductid%3A15054909857579886781%2CheadlineOfferDocid%3A12440755384690353616%2CimageDocid%3A1690060239128844379%2Crds%3APC_9131605894125381693%7CPROD_PC_9131605894125381693%2Cgpcid%3A9131605894125381693%2Cmid%3A576462808137735980%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=9d40461b-61a5-4a5c-960b-3bc0ac6b3875&title=Motorola+Moto+G+Power+2024+5G&store=motorola-united-states&storeName=Motorola+-+United+States
```

### Motorola India `(motorola-india)`  · relay=Y

**Product**: Motorola Edge 60 Pro

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A9021660796855228026%2CheadlineOfferDocid%3A13993747379401687518%2CimageDocid%3A12805603047902488752%2Crds%3APC_10360787057128524745%7CPROD_PC_10360787057128524745%2Cgpcid%3A10360787057128524745%2Cmid%3A576462821304904296%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=9b5515ad-2ca9-4525-a012-7b6a362aba46&title=Motorola+Edge+60+Pro&store=motorola-india&storeName=Motorola+India
```

### Mr D `(mr-d)`  · relay=Y

**Product**: SteelSeries Aerox 5 Wireless Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A7820816562760960813%2Cproductid%3A8500328981030167992%2CheadlineOfferDocid%3A3402432891952620384%2CimageDocid%3A8083142709291413870%2Crds%3APC_16668940448049876138%7CPROD_PC_16668940448049876138%2Cgpcid%3A16668940448049876138%2Cmid%3A576462501879788344%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=8b5a07d6-f89c-44f8-8863-717d7a560c2c&title=SteelSeries+Aerox+5+Wireless+Gaming+Mouse&store=mr-d&storeName=Mr+D
```

### MR PORTER `(mr-porter)`  · relay=Y

**Product**: Nike Men's Air Force 1 '07 Sneakers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike+Air+Force+1+deals%26prds%3Dcatalogid%3A12089037392020954686%2Cproductid%3A14658524225463286364%2CheadlineOfferDocid%3A16288667337565520468%2CimageDocid%3A13861116295781041198%2Cgpcid%3A8769336853691399737%2Cmid%3A576462778500332766%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=6c58dc19-3dbc-4191-b2d3-a3cb8ac80ec7&title=Nike+Men%27s+Air+Force+1+%2707+Sneakers&store=mr-porter&storeName=MR+PORTER
```

### MSI Online Store `(msi-online-store)`  · relay=Y

**Product**: MSI MAG 271QPX QD-OLED Gaming Monitor

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A183863037300936414%2Cproductid%3A2962742166019136466%2CheadlineOfferDocid%3A11480872159882901253%2CimageDocid%3A10812006007498315391%2Crds%3APC_13715716845224915977%7CPROD_PC_13715716845224915977%2Cgpcid%3A13715716845224915977%2Cmid%3A576462544592709844%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=07b87dca-ac20-4ba6-a698-e75fdf67acba&title=MSI+MAG+271QPX+QD-OLED+Gaming+Monitor&store=msi-online-store&storeName=MSI+Online+Store
```

### MT Audio `(mt-audio)`  · relay=Y

**Product**: GAS Audio CMP S3-24D1 - 24" (62cm) Subwoofer 8500 Watt RMS bei MT Audio

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A1020993683971436533%2CheadlineOfferDocid%3A1020993683971436533%2CimageDocid%3A17690150916740198793%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=b812a3a6-e4e4-4bd1-8fbf-19729c953791&title=GAS+Audio+CMP+S3-24D1+-+24%22+%2862cm%29+Subwoofer+8500+Watt+RMS+bei+MT+Audio&store=mt-audio&storeName=MT+Audio
```

### Muscle & Strength `(muscle-strength)`  · relay=Y

**Product**: One of One Greens + Gut Health

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A16219139087627378883%2Cproductid%3A18012648752644174263%2CheadlineOfferDocid%3A10026600282972640198%2CimageDocid%3A2481249193854240787%2Crds%3APC_17746659053028681931%7CPROD_PC_17746659053028681931%2Cgpcid%3A17746659053028681931%2Cmid%3A576462816794022989%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=154ff8dd-b72d-45f8-9035-e8ed194ef1ca&title=One+of+One+Greens+%2B+Gut+Health&store=muscle-strength&storeName=Muscle+%26+Strength
```

### MuscleBlaze Official `(muscleblaze-official)`  · relay=Y

**Product**: MuscleBlaze Biozyme Performance Whey Protein

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A5596761974034292557%2Cproductid%3A4904821756443653589%2CheadlineOfferDocid%3A7652140016753146401%2CimageDocid%3A15577873933988606505%2Crds%3APC_5503364279149741799%7CPROD_PC_5503364279149741799%2Cgpcid%3A5503364279149741799%2Cmid%3A576462447221092963%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=34496725-4a8d-43f8-8ad6-fe8b6f497974&title=MuscleBlaze+Biozyme+Performance+Whey+Protein&store=muscleblaze-official&storeName=MuscleBlaze+Official
```

### Musicmajlis `(musicmajlis)`  · relay=Y

**Product**: Tolaye KOL3001 Microphone and Phone Stand

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A17171193464277641088%2CheadlineOfferDocid%3A17171193464277641088%2CimageDocid%3A5333815795082750259%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=0e710da4-a9da-4158-9f08-c2e2c65f6a6f&title=Tolaye+KOL3001+Microphone+and+Phone+Stand&store=musicmajlis&storeName=Musicmajlis
```

### Myprotein India `(myprotein-india)`  · relay=Y

**Product**: Myprotein Impact Whey Protein

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A7088806534074753640%2Cproductid%3A4857769698279516720%2CheadlineOfferDocid%3A16683172429843752388%2CimageDocid%3A17460716119721516264%2Crds%3APC_6277648588219211785%7CPROD_PC_6277648588219211785%2Cgpcid%3A6277648588219211785%2Cmid%3A576462853406942037%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=09231949-4ae4-4a8a-9af2-c3c61ac68368&title=Myprotein+Impact+Whey+Protein&store=myprotein-india&storeName=Myprotein+India
```

### MyWorldPhone.com `(myworldphone)`  · relay=Y

**Product**: Xiaomi Redmi Note 14 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRedmi+Note+14+deals%26prds%3Dproductid%3A16251098411179447374%2CheadlineOfferDocid%3A16251098411179447374%2CimageDocid%3A13390406467665770532%2Crds%3APC_3125157951435424517%7CPROD_PC_3125157951435424517%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7525aa7f-e5fe-4ae4-8002-374a2339f801&title=Xiaomi+Redmi+Note+14+5G&store=myworldphone&storeName=MyWorldPhone.com
```

### naaptol.com `(naaptol)`  · relay=Y

**Product**: 10 Pcs Stainless Steel Colored Handi Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A15509174312039509529%2CheadlineOfferDocid%3A15509174312039509529%2CimageDocid%3A2420046529550772957%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=17a71302-bf0e-4684-822c-859b836782d5&title=10+Pcs+Stainless+Steel+Colored+Handi+Set&store=naaptol&storeName=naaptol.com
```

### National Mobile `(national-mobile)`  · relay=Y

**Product**: Apple iPhone 14

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A6206513715603526770%2CheadlineOfferDocid%3A16460930655268703699%2CimageDocid%3A9861416832717327778%2Crds%3APC_8053804293482199477%7CPROD_PC_8053804293482199477%2Cgpcid%3A8053804293482199477%2Cmid%3A576462684717173784%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=73e253d9-f7b7-453e-aeaf-fc0a587899eb&title=Apple+iPhone+14&store=national-mobile&storeName=National+Mobile
```

### NBA Store India `(nba-store-india)`  · relay=Y

**Product**: Nba Team Tribute Outdoor Basketball Memphis Grizzlies 'Light Blue'

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A2229664331144410118%2CheadlineOfferDocid%3A2229664331144410118%2CimageDocid%3A2588467867335017934%2Crds%3APC_12323435941276979646%7CPROD_PC_12323435941276979646%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=46362f98-97ba-4aaa-924d-76ce81c02672&title=Nba+Team+Tribute+Outdoor+Basketball+Memphis+Grizzlies+%27Light+Blue%27&store=nba-store-india&storeName=NBA+Store+India
```

### NET-A-PORTER `(net-a-porter)`  · relay=Y

**Product**: Zimmermann Hypnotic Gathered Paneled Jersey Maxi Dress - Women - Cream Dresses - XS

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A15208337569000737103%2CheadlineOfferDocid%3A15208337569000737103%2CimageDocid%3A13293877816912014056%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=10810730-6d43-4320-9316-f1a04d7705fd&title=Zimmermann+Hypnotic+Gathered+Paneled+Jersey+Maxi+Dress+-+Women+-+Cream+Dresses+-+XS&store=net-a-porter&storeName=NET-A-PORTER
```

### Neuherbs `(neuherbs)`  · relay=Y

**Product**: Neuherbs True Magnesium Tablets

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A13877998115315273021%2Cproductid%3A3937424876925443429%2CheadlineOfferDocid%3A7163312435111407682%2CimageDocid%3A10737909069339150737%2Crds%3APC_12191295966326916399%7CPROD_PC_12191295966326916399%2Cgpcid%3A12191295966326916399%2Cmid%3A576462461287387871%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=a9fd33fa-d40d-436e-ae46-4345fbd2a2fe&title=Neuherbs+True+Magnesium+Tablets&store=neuherbs&storeName=Neuherbs
```

### Neural System `(neural-system)`  · relay=Y

**Product**: HP Omen 25L Gaming Desktop PC

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A2094769125680537636%2CheadlineOfferDocid%3A16614451263021858447%2CimageDocid%3A2627904144702625963%2Cgpcid%3A17448194843751263410%2Cmid%3A576462789296961139%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=a65204b8-5ea1-4dae-a3b9-a5cd8316d749&title=HP+Omen+25L+Gaming+Desktop+PC&store=neural-system&storeName=Neural+System
```

### New Era EU `(new-era-eu)`  · relay=Y

**Product**: Adult New Era Retro Sports Mesh Jersey

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A3582726796520732441%2Cproductid%3A13709686915276810258%2CheadlineOfferDocid%3A10395654919251600628%2CimageDocid%3A10314598148293121053%2Crds%3APC_14803495850174989758%7CPROD_PC_14803495850174989758%2Cgpcid%3A14803495850174989758%2Cmid%3A576462882140489068%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=bf3e71c5-0135-4282-8098-9b81bddf365d&title=Adult+New+Era+Retro+Sports+Mesh+Jersey&store=new-era-eu&storeName=New+Era+EU
```

### NEWME `(newme)`  · relay=Y

**Product**: NEWME Women's Elegant Embellished Off Shoulder Maxi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A11535231123925506181%2Cproductid%3A8360444597425638633%2CheadlineOfferDocid%3A13548634491474147322%2CimageDocid%3A11684763607696620356%2Cgpcid%3A13893250838940448118%2Cmid%3A576462863442098075%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=9e951464-10a5-407a-bb51-7ecfaf4a3d33&title=NEWME+Women%27s+Elegant+Embellished+Off+Shoulder+Maxi+Dress&store=newme&storeName=NEWME
```

### NFM `(nfm)`  · relay=Y

**Product**: Amazon Echo Dot Max Smart Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A11118686520139764110%2Cproductid%3A18205451089413743675%2CheadlineOfferDocid%3A16886645104432758844%2CimageDocid%3A9591245941413743851%2Crds%3APC_12001944536332060675%7CPROD_PC_12001944536332060675%2Cgpcid%3A12001944536332060675%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=29310c5b-08bb-4406-8f83-0b15ba3b6d69&title=Amazon+Echo+Dot+Max+Smart+Speaker&store=nfm&storeName=NFM
```

### Niche-Beauty.com `(niche-beauty)`  · relay=Y

**Product**: IT Cosmetics Your Skin But Better CC+ Cream Foundation SPF50+

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A15340114658939338587%2Cproductid%3A1573246385096108001%2CheadlineOfferDocid%3A14408093492413331468%2CimageDocid%3A3476100426581316948%2Crds%3APC_6103478585744067530%7CPROD_PC_6103478585744067530%2Cgpcid%3A6103478585744067530%2Cmid%3A576462224855696289%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=02835901-1bab-41e1-aaa1-a22a037e0d27&title=IT+Cosmetics+Your+Skin+But+Better+CC%2B+Cream+Foundation+SPF50%2B&store=niche-beauty&storeName=Niche-Beauty.com
```

### Ninja Kitchen Germany `(ninja-kitchen-germany)`  · relay=Y

**Product**: Ninja Crispi fn101eu fryer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A3497365726714512255%2Cproductid%3A5745692949474291124%2CheadlineOfferDocid%3A5137026020121107705%2CimageDocid%3A8074522976744645002%2Crds%3APC_600149305793653484%7CPROD_PC_600149305793653484%2Cgpcid%3A600149305793653484%2Cmid%3A576462819754285506%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=d09357b0-e81a-4d77-adf2-e2d43509fada&title=Ninja+Crispi+fn101eu+fryer&store=ninja-kitchen-germany&storeName=Ninja+Kitchen+Germany
```

### Nintendo `(nintendo)`  · relay=Y

**Product**: Nintendo Switch Oled

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A9523055721821997837%2Cproductid%3A7388414011539146519%2CheadlineOfferDocid%3A8835758214750679762%2Crds%3APC_2981021657367291201%7CPROD_PC_2981021657367291201%2Cgpcid%3A2981021657367291201%2Cmid%3A576462371481002434%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b78cd33f-5c3a-4304-ace2-d15fcc877865&title=Nintendo+Switch+Oled&store=nintendo&storeName=Nintendo
```

### No7 Beauty `(no7-beauty)`  · relay=Y

**Product**: No7 Restore & Renew Serum Foundation

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A4625538396697488306%2Cproductid%3A10313209828457566673%2CheadlineOfferDocid%3A4807328796553579116%2CimageDocid%3A8910331172210278392%2Crds%3APC_14564377089069297112%7CPROD_PC_14564377089069297112%2Cgpcid%3A14564377089069297112%2Cmid%3A576462876041155096%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=61554f66-f983-4e3e-8ed5-58753ddea521&title=No7+Restore+%26+Renew+Serum+Foundation&store=no7-beauty&storeName=No7+Beauty
```

### Noli `(noli)`  · relay=Y

**Product**: CeraVe Moisturizing Cream Refill

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCeraVe+Moisturizing+Cream+deals%26prds%3Dcatalogid%3A437806135968334273%2Cproductid%3A6942563221270622113%2CheadlineOfferDocid%3A10240946733459791314%2CimageDocid%3A6877936158932891953%2Crds%3APC_9768538740537213337%7CPROD_PC_9768538740537213337%2Cgpcid%3A9768538740537213337%2Cmid%3A576462826162195564%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=2868f1ba-9d39-4d3f-8979-73d33d72beff&title=CeraVe+Moisturizing+Cream+Refill&store=noli&storeName=Noli
```

### Notino.co.uk `(notino)`  · relay=Y

**Product**: IT Cosmetics Bye Bye Under Eye Concealer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A7449247674500106663%2Cproductid%3A2183294114717355372%2CheadlineOfferDocid%3A12045969441065781314%2CimageDocid%3A9862796481616340447%2Crds%3APC_16233483731695574481%7CPROD_PC_16233483731695574481%2Cgpcid%3A16233483731695574481%2Cmid%3A576462224855262609%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=6662227e-7bb5-4650-aa9f-39e9e2f41cdd&title=IT+Cosmetics+Bye+Bye+Under+Eye+Concealer&store=notino&storeName=Notino.co.uk
```

### Novelty Computech `(novelty-computech)`  · relay=Y

**Product**: Logitech G733 Lightspeed Wireless Gaming Headset RGB

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A14326932814983296802%2Cproductid%3A2902380626670620306%2CheadlineOfferDocid%3A3330479608744890983%2CimageDocid%3A9579744135777276787%2Crds%3APC_5325945396057349350%7CPROD_PC_5325945396057349350%2Cgpcid%3A5325945396057349350%2Cmid%3A576462387163677667%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=3a54a793-c0c9-4150-b589-33ebfb5dc2c2&title=Logitech+G733+Lightspeed+Wireless+Gaming+Headset+RGB&store=novelty-computech&storeName=Novelty+Computech
```

### Nuevo Gadgets `(nuevo-gadgets)`  · relay=Y

**Product**: Edifier Mp230 Portable Bluetooth Speaker, Wireless Speaker With Stereo Sound For Outdoor Travel, 9-Hour Playtime, Supports Usb Soundcard/Micro Sd, 20W

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A8212648836207305002%2CheadlineOfferDocid%3A8212648836207305002%2CimageDocid%3A7541899285003012626%2Crds%3APC_18113373825859479523%7CPROD_PC_18113373825859479523%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=d7e500ce-3b65-482e-a3cc-29394ddd1ebd&title=Edifier+Mp230+Portable+Bluetooth+Speaker%2C+Wireless+Speaker+With+Stereo+Sound+For+Outdoor+Travel%2C+9-Hour+Playtime%2C+Suppor&store=nuevo-gadgets&storeName=Nuevo+Gadgets
```

### Nutmeg Sporting Goods `(nutmeg-sporting-goods)`  · relay=Y

**Product**: Easton Typhoon USA Baseball Bat

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A18254525846125843743%2Cproductid%3A14639483167431922743%2CheadlineOfferDocid%3A13101392223183555738%2CimageDocid%3A1979550601361450656%2Crds%3APC_16532178218030483197%7CPROD_PC_16532178218030483197%2Cgpcid%3A16532178218030483197%2Cmid%3A576462727987677571%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=7c37955c-95c9-402a-a07e-4599b8906be0&title=Easton+Typhoon+USA+Baseball+Bat&store=nutmeg-sporting-goods&storeName=Nutmeg+Sporting+Goods
```

### Nutrigize `(nutrigize)`  · relay=Y

**Product**: MuscleBlaze Whey Protein

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A15389899245073863397%2Cproductid%3A10937917667611117353%2CheadlineOfferDocid%3A3858180330003541058%2CimageDocid%3A1135340380339953958%2Crds%3APC_782975520888756101%7CPROD_PC_782975520888756101%2Cgpcid%3A782975520888756101%2Cmid%3A576462547131805625%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=b3d08bfb-1977-4a6b-a763-c59750bb9e82&title=MuscleBlaze+Whey+Protein&store=nutrigize&storeName=Nutrigize
```

### NUU `(nuu)`  · relay=Y

**Product**: NUU N10 Basic Cell Phone

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A8110570365315480273%2Cproductid%3A12142821702719529566%2CheadlineOfferDocid%3A16982861345927294499%2CimageDocid%3A4845893977452138104%2Cgpcid%3A9436200513735184890%2Cmid%3A576462803571762110%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=69c51e20-66f2-4d05-9f5b-bcfe7c5aa044&title=NUU+N10+Basic+Cell+Phone&store=nuu&storeName=NUU
```

### NVSX Computers `(nvsx-computers)`  · relay=Y

**Product**: Logitech G335 Wired Gaming Headset

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12701220440782287094%2Cproductid%3A13030746244061454358%2CheadlineOfferDocid%3A13106565883140709580%2CimageDocid%3A17329904859542804640%2Crds%3APC_6025811390285357319%7CPROD_PC_6025811390285357319%2Cgpcid%3A6025811390285357319%2Cmid%3A576462852652199639%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=98c2eca5-a2fd-4a5c-9695-a05990bfe184&title=Logitech+G335+Wired+Gaming+Headset&store=nvsx-computers&storeName=NVSX+Computers
```

### Office Depot `(office-depot)`  · relay=Y

**Product**: HP OmniDesk Desktop PC AMD Ryzen 5 8500G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A18150527402235914604%2Cproductid%3A15694383728527223947%2CheadlineOfferDocid%3A11461834439530920496%2CimageDocid%3A4658315576660559429%2Crds%3APC_18019495347693478860%7CPROD_PC_18019495347693478860%2Cgpcid%3A18019495347693478860%2Cmid%3A576462556208894692%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b964bd1a-5278-4d26-854b-a309561f241f&title=HP+OmniDesk+Desktop+PC+AMD+Ryzen+5+8500G&store=office-depot&storeName=Office+Depot
```

### Office Shoes `(office-shoes)`  · relay=Y

**Product**: Crocs Womens Classic Clogs Mint Tint Green, 7

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCrocs+Classic+Clog+deals%26prds%3Dproductid%3A577240076052772960%2CheadlineOfferDocid%3A577240076052772960%2CimageDocid%3A14683399176403982033%2Crds%3APC_5803906498614987482%7CPROD_PC_5803906498614987482%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=91c5e020-98c6-4ca9-8461-e57008b664b2&title=Crocs+Womens+Classic+Clogs+Mint+Tint+Green%2C+7&store=office-shoes&storeName=Office+Shoes
```

### Offspring `(offspring)`  · relay=Y

**Product**: men Nike Dunk Low Retro Premium Black

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike+Dunk+Low%26prds%3Dcatalogid%3A17908885814991611537%2Cproductid%3A6658007913024809164%2CheadlineOfferDocid%3A3734795217935797646%2CimageDocid%3A17106216869043271095%2Crds%3APC_3698445366197832299%7CPROD_PC_3698445366197832299%2Cgpcid%3A3698445366197832299%2Cmid%3A576462530075225996%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=f040885e-49ec-457c-86d8-c8fa3775cd0b&title=men+Nike+Dunk+Low+Retro+Premium+Black&store=offspring&storeName=Offspring
```

### Old Khaki `(old-khaki)`  · relay=Y

**Product**: Men's Jordy Straight Fit Denim

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A18266883246577314801%2Cproductid%3A15097271633850469450%2CheadlineOfferDocid%3A8293566496054341553%2CimageDocid%3A12836295404533256662%2Cgpcid%3A15408471969289178628%2Cmid%3A576462874188591012%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=aee26595-3055-4b5a-b7c7-5699b9a30bba&title=Men%27s+Jordy+Straight+Fit+Denim&store=old-khaki&storeName=Old+Khaki
```

### Olive Young Global `(olive-young-global)`  · relay=Y

**Product**: Beauty of Joseon Hanbang Serum Discovery Kit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A12919322627292115638%2Cproductid%3A9136851459462464971%2CheadlineOfferDocid%3A17582330182656989131%2CimageDocid%3A6991454397181134377%2Crds%3APC_3701432571409027897%7CPROD_PC_3701432571409027897%2Cgpcid%3A3701432571409027897%2Cmid%3A576462862119691731%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=fea7d0a0-f602-4cc1-9de1-a79f2c53f818&title=Beauty+of+Joseon+Hanbang+Serum+Discovery+Kit&store=olive-young-global&storeName=Olive+Young+Global
```

### Oliver Bonas `(oliver-bonas)`  · relay=Y

**Product**: Sleep Heroes Essentials Beauty Gift Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A17555163712558456748%2Cproductid%3A16988147790935597837%2CheadlineOfferDocid%3A749872066357490722%2CimageDocid%3A16343870980244459948%2Crds%3APC_10445027269838350595%7CPROD_PC_10445027269838350595%2Cgpcid%3A10445027269838350595%2Cmid%3A576462859249520509%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=cafa2eac-dd5d-471b-a9f4-a1c0d26decc9&title=Sleep+Heroes+Essentials+Beauty+Gift+Set&store=oliver-bonas&storeName=Oliver+Bonas
```

### OnBuy.com `(onbuy)`  · relay=Y

**Product**: OnBuy Computek Gaming PC

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A2085632376583872878%2Cproductid%3A16035900216408515701%2CheadlineOfferDocid%3A12544231483192155719%2CimageDocid%3A12763757811976145499%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=e372fe1a-0bb3-46bc-83c2-1a97babf8d08&title=OnBuy+Computek+Gaming+PC&store=onbuy&storeName=OnBuy.com
```

### OneDayOnly.co.za `(onedayonly)`  · relay=Y

**Product**: Russell Hobbs Air Fryer and Griller

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A10250268279753624089%2Cproductid%3A16491302875294026756%2CheadlineOfferDocid%3A2531032197634467986%2CimageDocid%3A1716037734425632267%2Cgpcid%3A1303558310905054473%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=3b02f17e-74df-4ad2-a9d7-834a0f4d7a14&title=Russell+Hobbs+Air+Fryer+and+Griller&store=onedayonly&storeName=OneDayOnly.co.za
```

### OPPO Official Store `(oppo-official-store)`  · relay=Y

**Product**: Oppo Reno14 Pro 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A11871687592277099331%2Cproductid%3A15729298363699074093%2CheadlineOfferDocid%3A7020609676089591223%2CimageDocid%3A3827118727865069688%2Crds%3APC_8983409194972031253%7CPROD_PC_8983409194972031253%2Cgpcid%3A8983409194972031253%2Cmid%3A576462861015738445%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=43a4262c-9963-44cc-9761-77b53c9941a9&title=Oppo+Reno14+Pro+5G&store=oppo-official-store&storeName=OPPO+Official+Store
```

### optimaindia.in `(optimaindia-in)`  · relay=Y

**Product**: Logitech G213 Prodigy RGB Gaming Keyboard

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A2260150730005869163%2Cproductid%3A16961121619920734307%2CheadlineOfferDocid%3A7536519856157813515%2CimageDocid%3A15072401314949134124%2Crds%3APC_9010399873377531875%7CPROD_PC_9010399873377531875%2Cgpcid%3A9010399873377531875%2Cmid%3A576462777711058847%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=b1a4ad05-8e53-4ede-b1b1-4648bcdc98f0&title=Logitech+G213+Prodigy+RGB+Gaming+Keyboard&store=optimaindia-in&storeName=optimaindia.in
```

### Orzly `(orzly)`  · relay=Y

**Product**: Nintendo Switch & Switch OLED Poke Bundle Essential Accessories Kit for Pokémon Fans by Orzly

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNintendo+Switch+OLED+deals%26prds%3Dcatalogid%3A4820998473691412951%2Cproductid%3A14508223113301301974%2CheadlineOfferDocid%3A14149596408768712462%2CimageDocid%3A2047598638351666938%2Cgpcid%3A10608335516119507527%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=6daf8092-42a4-4359-a2bb-3a6c0804c62b&title=Nintendo+Switch+%26+Switch+OLED+Poke+Bundle+Essential+Accessories+Kit+for+Pok%C3%A9mon+Fans+by+Orzly&store=orzly&storeName=Orzly
```

### oukitel.com `(oukitel)`  · relay=Y

**Product**: Oukitel C36 6.56-inch 5150mAh Battery 9.18mm Ultra-thin Body SmartPhone

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A13564768648155557237%2CheadlineOfferDocid%3A2803725061925907904%2CimageDocid%3A9963809965629109998%2Crds%3APC_12136939168078023468%7CPROD_PC_12136939168078023468%2Cgpcid%3A12136939168078023468%2Cmid%3A576462759214058458%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=75502b02-35c3-416e-9ddc-8b68623262e9&title=Oukitel+C36+6.56-inch+5150mAh+Battery+9.18mm+Ultra-thin+Body+SmartPhone&store=oukitel&storeName=oukitel.com
```

### OurShopee.com `(ourshopee)`  · relay=Y

**Product**: Platinum Karaoke rover Boombox Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A17032294134147963822%2Cproductid%3A113643609516514370%2CheadlineOfferDocid%3A8495709278354979354%2CimageDocid%3A7902991265734172044%2Cgpcid%3A2598586688329744351%2Cmid%3A576462893437871182%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=543af243-e396-4234-a98c-5bbfb98107d7&title=Platinum+Karaoke+rover+Boombox+Speaker&store=ourshopee&storeName=OurShopee.com
```

### Overstock `(overstock)`  · relay=Y

**Product**: RESPAWN 900 Gaming Chair

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A2187400660516739326%2Cproductid%3A6729953904898389690%2CheadlineOfferDocid%3A3650402516883054339%2CimageDocid%3A6557289164669561449%2Crds%3APC_6548629891200848552%7CPROD_PC_6548629891200848552%2Cgpcid%3A6548629891200848552%2Cmid%3A576462373747906371%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b7e1bc76-9563-4372-9ac7-2cd08287608f&title=RESPAWN+900+Gaming+Chair&store=overstock&storeName=Overstock
```

### Pantaloons `(pantaloons)`  · relay=Y

**Product**: Rangmanch Women's Floral Embroidered Kurta Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A547702160707899688%2Cproductid%3A7756109897085099310%2CheadlineOfferDocid%3A8832551955429596864%2CimageDocid%3A3044655194309397791%2Cgpcid%3A1508104151580867114%2Cmid%3A576462556071345538%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=6f6132f8-a7c9-4f79-88b1-84769d7c1f16&title=Rangmanch+Women%27s+Floral+Embroidered+Kurta+Set&store=pantaloons&storeName=Pantaloons
```

### Paris Lunetier `(paris-lunetier)`  · relay=Y

**Product**: Ray Ban Wayfarer Sunglasses

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRay-Ban+Wayfarer+deals%26prds%3Dcatalogid%3A8083131980696868154%2Cproductid%3A17359057298347881509%2CheadlineOfferDocid%3A13005993865985113376%2CimageDocid%3A17198842011027109317%2Crds%3APC_13867067894913498202%7CPROD_PC_13867067894913498202%2Cgpcid%3A13867067894913498202%2Cmid%3A13308814%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=a13dc762-4980-40ca-96a9-5a7aad8e8bee&title=Ray+Ban+Wayfarer+Sunglasses&store=paris-lunetier&storeName=Paris+Lunetier
```

### PC International `(pc-international)`  · relay=Y

**Product**: ASRock B650M PG Lightning WiFi AM5 mATX Motherboard

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A11778011139429249292%2Cproductid%3A14399395758827192959%2CheadlineOfferDocid%3A16214216986799158014%2CimageDocid%3A5544398799831516578%2Crds%3APC_7046640767287268588%7CPROD_PC_7046640767287268588%2Cgpcid%3A7046640767287268588%2Cmid%3A576462883959554458%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=429ad101-40c0-4ec6-b287-15215e14832d&title=ASRock+B650M+PG+Lightning+WiFi+AM5+mATX+Motherboard&store=pc-international&storeName=PC+International
```

### PC Richard `(pc-richard)`  · relay=Y

**Product**: Razer Gaming Mouse Wireless Viper V3 Pro

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A2810535126310355616%2Cproductid%3A8057243062707043905%2CheadlineOfferDocid%3A1407684264625640779%2CimageDocid%3A3368967039864940689%2Crds%3APC_2056036107799987631%7CPROD_PC_2056036107799987631%2Cgpcid%3A2056036107799987631%2Cmid%3A576462783696602924%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=8c074f1e-cb7f-4ca4-9511-b1df002684b6&title=Razer+Gaming+Mouse+Wireless+Viper+V3+Pro&store=pc-richard&storeName=PC+Richard
```

### PC Richard & Son `(pc-richard-son)`  · relay=Y

**Product**: HP OmniDesk Desktop Intel 8GB 256GB SSD

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A9988889457578955711%2Cproductid%3A5067741279809741038%2CheadlineOfferDocid%3A4380254983903418880%2CimageDocid%3A7078173987869135938%2Crds%3APC_102942354133736142%7CPROD_PC_102942354133736142%2Cgpcid%3A102942354133736142%2Cmid%3A576462893447147355%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c8fda7de-d349-4af4-969d-711a933c7017&title=HP+OmniDesk+Desktop+Intel+8GB+256GB+SSD&store=pc-richard-son&storeName=PC+Richard+%26+Son
```

### pcstudio.in `(pcstudio-in)`  · relay=Y

**Product**: Logitech G502 Hero Wired Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A3974535998264476336%2Cproductid%3A3654949432331677466%2CheadlineOfferDocid%3A12336500466008193776%2CimageDocid%3A9188239621152442246%2Crds%3APC_8322134897535547181%7CPROD_PC_8322134897535547181%2Cgpcid%3A8322134897535547181%2Cmid%3A576462791241587903%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=a4651396-38cd-4098-a64c-af2dbda966c2&title=Logitech+G502+Hero+Wired+Gaming+Mouse&store=pcstudio-in&storeName=pcstudio.in
```

### peacocks.co.uk `(peacocks)`  · relay=Y

**Product**: Peacocks Women's Ditsy Flutter Sleeve Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A6069359714095702862%2Cproductid%3A1222829391148179559%2CheadlineOfferDocid%3A10018602143471071294%2CimageDocid%3A8492254408176798941%2Cgpcid%3A13556338290090181043%2Cmid%3A576462877546284089%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=7ffc00c7-324b-4925-9fc2-3435eca8ad0d&title=Peacocks+Women%27s+Ditsy+Flutter+Sleeve+Dress&store=peacocks&storeName=peacocks.co.uk
```

### Perigold `(perigold)`  · relay=Y

**Product**: KitchenAid Artisan Series 5 Quart Tilt-Head Stand Mixer w/ Premium Accessory Pack ksm195pser

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A8607822168592771501%2Cproductid%3A5897935826523241754%2CheadlineOfferDocid%3A11342975159245655588%2CimageDocid%3A7356276148402284486%2Crds%3APC_44297843990613121%7CPROD_PC_44297843990613121%2Cgpcid%3A16183334376114470820%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7a2fefcf-88f7-4618-9265-fd7f9ee222dd&title=KitchenAid+Artisan+Series+5+Quart+Tilt-Head+Stand+Mixer+w%2F+Premium+Accessory+Pack+ksm195pser&store=perigold&storeName=Perigold
```

### Peter Tyson `(peter-tyson)`  · relay=Y

**Product**: Bang & Olufsen Beosound A1 3rd Generation Portable Bluetooth Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A14253610032228404177%2Cproductid%3A9195541560762547071%2CheadlineOfferDocid%3A14024567951295297346%2CimageDocid%3A2318895460690699405%2Crds%3APC_15276925748664718553%7CPROD_PC_15276925748664718553%2Cgpcid%3A15276925748664718553%2Cmid%3A576462826597054599%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=833cb410-bd19-44b6-a029-d363ec5f7c04&title=Bang+%26+Olufsen+Beosound+A1+3rd+Generation+Portable+Bluetooth+Speaker&store=peter-tyson&storeName=Peter+Tyson
```

### Pittappillil Agencies `(pittappillil-agencies)`  · relay=Y

**Product**: Sujata MG03 Black 1000W Mixer Grinder with 3 Steel Jars & 1 Glass Jar | Pittappillil Agencies

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A3520794715546974200%2CheadlineOfferDocid%3A3520794715546974200%2CimageDocid%3A15829751293199118778%2Crds%3APC_3072617371472074968%7CPROD_PC_3072617371472074968%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=d8594d16-1ec6-4d2f-8cad-5dcafaf408b0&title=Sujata+MG03+Black+1000W+Mixer+Grinder+with+3+Steel+Jars+%26+1+Glass+Jar+%7C+Pittappillil+Agencies&store=pittappillil-agencies&storeName=Pittappillil+Agencies
```

### Planet Beauty `(planet-beauty)`  · relay=Y

**Product**: Vacation Super Spritz SPF 50 Face Mist

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A6928614096371651036%2Cproductid%3A6011103354950444862%2CheadlineOfferDocid%3A12956865512944667599%2CimageDocid%3A116366229561074971%2Crds%3APC_2344067962874044213%7CPROD_PC_2344067962874044213%2Cgpcid%3A2344067962874044213%2Cmid%3A576462749297607213%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=3cb97a9d-5b68-48f1-b916-382c39d0bb69&title=Vacation+Super+Spritz+SPF+50+Face+Mist&store=planet-beauty&storeName=Planet+Beauty
```

### Play-Asia.com `(play-asia)`  · relay=Y

**Product**: Nintendo Switch Sports

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A6643814825291690632%2Cproductid%3A17685309974475121757%2CheadlineOfferDocid%3A9358833329756472622%2CimageDocid%3A15266060105005285002%2Crds%3APC_13127076585223337253%7CPROD_PC_13127076585223337253%2Cgpcid%3A13127076585223337253%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=850361aa-8636-4845-a31d-273018f23fb2&title=Nintendo+Switch+Sports&store=play-asia&storeName=Play-Asia.com
```

### PlayStation Store `(playstation-store)`  · relay=Y

**Product**: Jeu Vidéo PlayStation 4 Microids Gold Edition Construction Simulator (FR)

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12194523174920497202%2Cproductid%3A11407250937927051806%2CheadlineOfferDocid%3A8795557925490986051%2CimageDocid%3A3774048769792512818%2Crds%3APC_15214945449654109725%7CPROD_PC_15214945449654109725%2Cgpcid%3A15214945449654109725%2Cmid%3A576462851595215241%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=cb8324e3-155b-4f63-90cb-fe8ac2a77415&title=Jeu+Vid%C3%A9o+PlayStation+4+Microids+Gold+Edition+Construction+Simulator+%28FR%29&store=playstation-store&storeName=PlayStation+Store
```

### pluginboutique.com `(pluginboutique)`  · relay=Y

**Product**: Galaxy Tape Echo

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A7953083500501606206%2CheadlineOfferDocid%3A7953083500501606206%2CimageDocid%3A12853300498023578586%2Crds%3APC_9930302966965682925%7CPROD_PC_9930302966965682925%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=2e23e7e8-f78a-45f6-bdf4-99b3d644018e&title=Galaxy+Tape+Echo&store=pluginboutique&storeName=pluginboutique.com
```

### Plum `(plum)`  · relay=Y

**Product**: Plum 10% Niacinamide Face Serum Rice Water

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A6900484915632943142%2Cproductid%3A15586223097992902672%2CheadlineOfferDocid%3A4982616586136622837%2CimageDocid%3A3535258756633006686%2Crds%3APC_16385667940888013692%7CPROD_PC_16385667940888013692%2Cgpcid%3A16385667940888013692%2Cmid%3A576462531131472457%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=b62c3504-8aa2-4aa9-bca9-cbc474b04a4e&title=Plum+10%25+Niacinamide+Face+Serum+Rice+Water&store=plum&storeName=Plum
```

### Poshmark `(poshmark)`  · relay=Y

**Product**: Apple Watch S10

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DApple+Watch+Series+10+deals%26prds%3Dproductid%3A2842372379126485471%2CheadlineOfferDocid%3A2842372379126485471%2CimageDocid%3A5738808581140261118%2Crds%3APC_13994267818567300230%7CPROD_PC_13994267818567300230%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=967e3989-08fb-4c4f-b144-3e2edd8e177e&title=Apple+Watch+S10&store=poshmark&storeName=Poshmark
```

### Positive Grid - US `(positive-grid-us)`  · relay=Y

**Product**: Positive Grid Spark LINK XLR Wireless Audio System

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A17173538339478392736%2Cproductid%3A12543209850773258707%2CheadlineOfferDocid%3A15314630977136557694%2CimageDocid%3A8826234623098585028%2Crds%3APC_8760529579760266338%7CPROD_PC_8760529579760266338%2Cgpcid%3A8760529579760266338%2Cmid%3A576462542887079159%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=77ad3f64-2a1a-4360-a83c-d962a69d177e&title=Positive+Grid+Spark+LINK+XLR+Wireless+Audio+System&store=positive-grid-us&storeName=Positive+Grid+-+US
```

### Powerimp Electronics `(powerimp-electronics)`  · relay=Y

**Product**: Apple MacBook Air 13.6 M3 A3113 | Ultra Light

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMacBook+Air+M3%26prds%3Dproductid%3A1526910965432996133%2CheadlineOfferDocid%3A1526910965432996133%2CimageDocid%3A834790316840192075%2Crds%3APC_3376471390132192456%7CPROD_PC_3376471390132192456%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=05775035-b0ae-446d-931f-1256f07924e3&title=Apple+MacBook+Air+13.6+M3+A3113+%7C+Ultra+Light&store=powerimp-electronics&storeName=Powerimp+Electronics
```

### Premium Sound `(premium-sound)`  · relay=Y

**Product**: Focal Hadenys Open Back Headphones

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A146516404525090566%2Cproductid%3A7692393978472659163%2CheadlineOfferDocid%3A2441650550117449020%2CimageDocid%3A6952651403125612414%2Crds%3APC_12525994227300671887%7CPROD_PC_12525994227300671887%2Cgpcid%3A12525994227300671887%2Cmid%3A576462781726223161%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=43df36c5-d230-4f5b-8b68-a4a79af36566&title=Focal+Hadenys+Open+Back+Headphones&store=premium-sound&storeName=Premium+Sound
```

### PrettyLittleThing `(prettylittlething)`  · relay=Y

**Product**: Women's Slinky Twisted Strap Ruched Seam Bodycon Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A218380662565957422%2Cproductid%3A2916012515299722469%2CheadlineOfferDocid%3A2516419035822430535%2CimageDocid%3A8447475022879379693%2Cgpcid%3A13747677835958733747%2Cmid%3A576462883584400908%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=ec2e4a1a-fc1d-4194-973d-81073e00c529&title=Women%27s+Slinky+Twisted+Strap+Ruched+Seam+Bodycon+Dress&store=prettylittlething&storeName=PrettyLittleThing
```

### Pro:Direct Soccer `(pro-direct-soccer)`  · relay=Y

**Product**: Nike Dri-FIT Park III Woven Shorts

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A14622370386400424834%2Cproductid%3A13535127130625970666%2CheadlineOfferDocid%3A9031823837688071961%2CimageDocid%3A7110006986543413368%2Crds%3APC_76877803925066850%7CPROD_PC_76877803925066850%2Cgpcid%3A76877803925066850%2Cmid%3A576462852042355733%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=3053e56d-f079-4d8a-89f1-e7b4f1d42614&title=Nike+Dri-FIT+Park+III+Woven+Shorts&store=pro-direct-soccer&storeName=Pro%3ADirect+Soccer
```

### ProCook `(procook)`  · relay=Y

**Product**: ProCook Gourmet Kiru Knives

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A14192312650009189033%2CheadlineOfferDocid%3A7643427895227703735%2CimageDocid%3A10427318551155251548%2Crds%3APC_4160371542708054266%7CPROD_PC_4160371542708054266%2Cgpcid%3A4160371542708054266%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=e4df5493-c322-45c1-b021-1530d4b0abb4&title=ProCook+Gourmet+Kiru+Knives&store=procook&storeName=ProCook
```

### Provantage `(provantage)`  · relay=Y

**Product**: Asus ROG Strix 25" Class Full HD Gaming LED Monitor

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A10393775931528281715%2Cproductid%3A7793070904484753584%2CheadlineOfferDocid%3A11536423632671728057%2CimageDocid%3A9843746465878656328%2Crds%3APC_2043715510895104606%7CPROD_PC_2043715510895104606%2Cgpcid%3A2043715510895104606%2Cmid%3A576462866234531359%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b1bbf8fc-eb67-4bed-b7f9-4f16a75360cd&title=Asus+ROG+Strix+25%22+Class+Full+HD+Gaming+LED+Monitor&store=provantage&storeName=Provantage
```

### Public Lands `(public-lands)`  · relay=Y

**Product**: Owala 24 oz. FreeSip Stainless Steel Water Bottle, Lemon Meringue

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dproductid%3A7743547059156789200%2CheadlineOfferDocid%3A7743547059156789200%2CimageDocid%3A10919561891521253716%2Crds%3APC_12972611088827030245%7CPROD_PC_12972611088827030245%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=24cc73af-0e8d-4dcf-86ec-066ed5ee8079&title=Owala+24+oz.+FreeSip+Stainless+Steel+Water+Bottle%2C+Lemon+Meringue&store=public-lands&storeName=Public+Lands
```

### PUMA.com `(puma)`  · relay=Y

**Product**: Puma ESS ELEVATED Hoodie Women

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A11236759381150065681%2CheadlineOfferDocid%3A379611625195935432%2CimageDocid%3A10251814209458864315%2Crds%3APC_18330619475840317890%7CPROD_PC_18330619475840317890%2Cgpcid%3A18330619475840317890%2Cmid%3A576462859074110062%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=da980b6b-c583-4633-86dc-4252746f3862&title=Puma+ESS+ELEVATED+Hoodie+Women&store=puma&storeName=PUMA.com
```

### Purplle.com - Beauty Online `(purplle-com-beauty-online)`  · relay=Y

**Product**: Minimalist Alpha Arbutin Face Serum

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A3306984345234740895%2Cproductid%3A16577774202277901439%2CheadlineOfferDocid%3A8772997773206617430%2CimageDocid%3A14909885862182461468%2Crds%3APC_18205422405278276092%7CPROD_PC_18205422405278276092%2Cgpcid%3A18205422405278276092%2Cmid%3A576462839718268990%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=299d858c-05fe-446a-b059-36971a41d55c&title=Minimalist+Alpha+Arbutin+Face+Serum&store=purplle-com-beauty-online&storeName=Purplle.com+-+Beauty+Online
```

### Purplle.com - Beauty Shop `(purplle-com-beauty-shop)`  · relay=Y

**Product**: Nivea Women Deodorant Roll On Pearl & Beauty

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A7577822855685053209%2Cproductid%3A18031191137351153358%2CheadlineOfferDocid%3A1881437733805750393%2CimageDocid%3A3867699659518139759%2Crds%3APC_5388857838618808437%7CPROD_PC_5388857838618808437%2Cgpcid%3A5388857838618808437%2Cmid%3A576462755405207797%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=c12e94be-e22c-4949-b55b-23ef6db6d205&title=Nivea+Women+Deodorant+Roll+On+Pearl+%26+Beauty&store=purplle-com-beauty-shop&storeName=Purplle.com+-+Beauty+Shop
```

### Purplle.com - Purplle Beauty `(purplle-com-purplle-beauty)`  · relay=Y

**Product**: Swiss Beauty High Performance Foundation | Water-Resistant | Medium to Buildable Coverage | Lightweight | Easy to Blend | With Vitamin C & Niacinamide

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A7524144886337162762%2CheadlineOfferDocid%3A7524144886337162762%2CimageDocid%3A6988183223823428930%2Crds%3APC_5124514451647287047%7CPROD_PC_5124514451647287047%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=d7437184-32c9-4e68-8b4b-4992fe03ab5c&title=Swiss+Beauty+High+Performance+Foundation+%7C+Water-Resistant+%7C+Medium+to+Buildable+Coverage+%7C+Lightweight+%7C+Easy+to+Blend+&store=purplle-com-purplle-beauty&storeName=Purplle.com+-+Purplle+Beauty
```

### Purplle.com - Purplle Shop `(purplle-com-purplle-shop)`  · relay=Y

**Product**: Maybelline 903 Midnight Date Lipstick - Creamy, Hydrating Formula, Matte Finish 3.9 gm for Women | lightest lipstick shades swiss beauty lip balm

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A4404639394722512334%2CheadlineOfferDocid%3A4404639394722512334%2CimageDocid%3A11848245926833196585%2Crds%3APC_2455058161756035788%7CPROD_PC_2455058161756035788%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=c13796c8-dee9-4b3c-bcaa-38366bffa1f3&title=Maybelline+903+Midnight+Date+Lipstick+-+Creamy%2C+Hydrating+Formula%2C+Matte+Finish+3.9+gm+for+Women+%7C+lightest+lipstick+sha&store=purplle-com-purplle-shop&storeName=Purplle.com+-+Purplle+Shop
```

### QuickVit `(quickvit)`  · relay=Y

**Product**: Floradix Sage Organic Herbal Tea 15 Bags

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A10168781760243980063%2Cproductid%3A7000257902119120605%2CheadlineOfferDocid%3A13376246632962750739%2CimageDocid%3A3789022270544099157%2Crds%3APC_9164024996748306238%7CPROD_PC_9164024996748306238%2Cgpcid%3A9164024996748306238%2Cmid%3A576462700128798148%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=54530b49-2df7-462c-944b-2fbd078b51c3&title=Floradix+Sage+Organic+Herbal+Tea+15+Bags&store=quickvit&storeName=QuickVit
```

### QVC `(qvc)`  · relay=Y

**Product**: bareMinerals Complexion Rescue Tinted Moisturizer Duo,CEDAR 11

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A1408645958925755850%2CheadlineOfferDocid%3A1408645958925755850%2CimageDocid%3A14265205970668182730%2Crds%3APC_17509274141271932310%7CPROD_PC_17509274141271932310%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=79573e34-f345-4fc3-91ec-27eaf367c16e&title=bareMinerals+Complexion+Rescue+Tinted+Moisturizer+Duo%2CCEDAR+11&store=qvc&storeName=QVC
```

### ramas.co.za `(ramas)`  · relay=Y

**Product**: Bosch 60cm Black Touch Control Ceramic Hob

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A3368429109038365445%2Cproductid%3A11050811725430299222%2CheadlineOfferDocid%3A10404560710663111190%2CimageDocid%3A2365651848783509087%2Crds%3APC_6011681690797924506%7CPROD_PC_6011681690797924506%2Cgpcid%3A6011681690797924506%2Cmid%3A576462736051295621%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=bb58425c-65b0-476b-8654-815dac072aeb&title=Bosch+60cm+Black+Touch+Control+Ceramic+Hob&store=ramas&storeName=ramas.co.za
```

### rareism.com `(rareism)`  · relay=Y

**Product**: Rareism Women's Cowl Neck Abstract Print Regular Fit Top

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A11699732587106083537%2Cproductid%3A2424437891750725709%2CheadlineOfferDocid%3A10112539628301802037%2CimageDocid%3A2454758633142784692%2Cgpcid%3A2638376375632147112%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=c1ba5e2e-fd95-4e47-ac5a-64d9d5dfeaa7&title=Rareism+Women%27s+Cowl+Neck+Abstract+Print+Regular+Fit+Top&store=rareism&storeName=rareism.com
```

### Ray-Ban `(ray-ban)`  · relay=Y

**Product**: Ray-Ban Unisex Sunglasses

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRay-Ban+Wayfarer+deals%26prds%3Dcatalogid%3A10415569046878753987%2Cproductid%3A5441029637653356851%2CheadlineOfferDocid%3A18307197084872170099%2CimageDocid%3A10191158439264291078%2Crds%3APC_2443468426740871134%7CPROD_PC_2443468426740871134%2Cgpcid%3A2443468426740871134%2Cmid%3A576462483196394082%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=d5a0aae1-6b77-441c-8ee4-a00b3bcdedc4&title=Ray-Ban+Unisex+Sunglasses&store=ray-ban&storeName=Ray-Ban
```

### Razer.com `(razer)`  · relay=Y

**Product**: Razer Basilisk V3 Pro 35K Wireless Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A16670903945590342747%2Cproductid%3A12396753102568270168%2CheadlineOfferDocid%3A7061053288179339203%2CimageDocid%3A11844843928252377075%2Crds%3APC_3606980593326365055%7CPROD_PC_3606980593326365055%2Cgpcid%3A3606980593326365055%2Cmid%3A576462555546515931%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=de35210a-b1d0-4576-bda5-543c532f0820&title=Razer+Basilisk+V3+Pro+35K+Wireless+Gaming+Mouse&store=razer&storeName=Razer.com
```

### Rebel `(rebel)`  · relay=Y

**Product**: Beautiful 6 Qt Programmable Slow Cooker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A2786259573337649275%2Cproductid%3A5317966017683234635%2CheadlineOfferDocid%3A3161820016327560164%2CimageDocid%3A7378452594748044290%2Crds%3APC_12660115157626971814%7CPROD_PC_12660115157626971814%2Cgpcid%3A12660115157626971814%2Cmid%3A576462732537267754%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=2ebb6a22-6970-4cda-b816-fcbc3502c093&title=Beautiful+6+Qt+Programmable+Slow+Cooker&store=rebel&storeName=Rebel
```

### Rebel Gaming `(rebel-gaming)`  · relay=Y

**Product**: SteelSeries Aerox 3 Wireless Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12287621400343861729%2CheadlineOfferDocid%3A8277990738784070982%2CimageDocid%3A5704145371380519743%2Crds%3APC_2367198758432492942%7CPROD_PC_2367198758432492942%2Cgpcid%3A2367198758432492942%2Cmid%3A576462759097149621%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=58868c27-4939-479a-b975-1e41de32a2e4&title=SteelSeries+Aerox+3+Wireless+Gaming+Mouse&store=rebel-gaming&storeName=Rebel+Gaming
```

### Reiss `(reiss)`  · relay=Y

**Product**: Womens Reiss Kenzie Asymmetric Draped Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A6014243151928888150%2Cproductid%3A11751583017458169205%2CheadlineOfferDocid%3A3401200202688885968%2CimageDocid%3A5444858180809835553%2Crds%3APC_5788889279233061070%7CPROD_PC_5788889279233061070%2Cgpcid%3A5788889279233061070%2Cmid%3A576462835361481290%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=ec69ee99-8ed4-44d1-b7f0-2a8e99ee2180&title=Womens+Reiss+Kenzie+Asymmetric+Draped+Dress&store=reiss&storeName=Reiss
```

### retailbox.co.za `(retailbox)`  · relay=Y

**Product**: Optiphi Active Ageless Activegel

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A15321737948804347054%2Cproductid%3A5272798277435901636%2CheadlineOfferDocid%3A3518149040033491653%2CimageDocid%3A8639289700862572787%2Crds%3APC_7443053962458899514%7CPROD_PC_7443053962458899514%2Cgpcid%3A7443053962458899514%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=5a44196a-6494-4531-9280-25422a027589&title=Optiphi+Active+Ageless+Activegel&store=retailbox&storeName=retailbox.co.za
```

### Richer Sounds `(richer-sounds)`  · relay=Y

**Product**: Monitor Audio Silver FX 7g Surround Speakers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A14617223694879424354%2Cproductid%3A2281885009413767560%2CheadlineOfferDocid%3A13755921025916268801%2CimageDocid%3A13673323587841980848%2Crds%3APC_11390699392755079607%7CPROD_PC_11390699392755079607%2Cgpcid%3A11390699392755079607%2Cmid%3A576462461662735998%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=19bb422a-af21-4fda-872d-a4ed7e084ffa&title=Monitor+Audio+Silver+FX+7g+Surround+Speakers&store=richer-sounds&storeName=Richer+Sounds
```

### Rihoas `(rihoas)`  · relay=Y

**Product**: Rihoas French-Style Ditsy Floral Midi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A7507256687511833782%2CheadlineOfferDocid%3A4785548221727009799%2CimageDocid%3A1964436761334242275%2Crds%3APC_11763674124441540224%7CPROD_PC_11763674124441540224%2Cgpcid%3A11763674124441540224%2Cmid%3A576462740728044281%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=7599f2e7-8c13-4b8a-92b4-d39f68965693&title=Rihoas+French-Style+Ditsy+Floral+Midi+Dress&store=rihoas&storeName=Rihoas
```

### RjMobile01 `(rjmobile01)`  · relay=Y

**Product**: R36S Handheld Game Console

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A11292086058711279958%2Cproductid%3A5396314920332473992%2CheadlineOfferDocid%3A14223568768576196061%2CimageDocid%3A11748486338404311055%2Crds%3APC_5948013081841316151%7CPROD_PC_5948013081841316151%2Cgpcid%3A18190742663989736951%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=ff5ac01e-07ce-4904-8132-ff41365d1191&title=R36S+Handheld+Game+Console&store=rjmobile01&storeName=RjMobile01
```

### Rockford Fosgate `(rockford-fosgate)`  · relay=Y

**Product**: Rockford Fosgate R165-S Prime 6.5" 2-Way Component Speaker System

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A12720420546107378749%2Cproductid%3A15749374789131614317%2CheadlineOfferDocid%3A17207014441067777051%2CimageDocid%3A9207054012283543956%2Crds%3APC_9147654655892262128%7CPROD_PC_9147654655892262128%2Cgpcid%3A9147654655892262128%2Cmid%3A576462870946758350%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=88b1d90d-8f8b-43a8-ba34-e101006abd7d&title=Rockford+Fosgate+R165-S+Prime+6.5%22+2-Way+Component+Speaker+System&store=rockford-fosgate&storeName=Rockford+Fosgate
```

### Roseland Furniture `(roseland-furniture)`  · relay=Y

**Product**: Roseland Furniture Farro Kitchen Larder Unit Grey

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A835517742184283720%2Cproductid%3A6892131640502884949%2CheadlineOfferDocid%3A13081098359313072369%2CimageDocid%3A5754076583901459943%2Crds%3APC_6264275103306377368%7CPROD_PC_6264275103306377368%2Cgpcid%3A6264275103306377368%2Cmid%3A576462860416879749%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=54c3fb42-9bb7-44bc-bd3e-4a169c422f4f&title=Roseland+Furniture+Farro+Kitchen+Larder+Unit+Grey&store=roseland-furniture&storeName=Roseland+Furniture
```

### runners.ae `(runners-ae)`  · relay=Y

**Product**: ASICS Gel-Nimbus 27 ATC Men's Running Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A2370984013391726459%2Cproductid%3A1354187052617914055%2CheadlineOfferDocid%3A2294070450962698796%2CimageDocid%3A7740386197544094064%2Crds%3APC_17256848143791419023%7CPROD_PC_17256848143791419023%2Cgpcid%3A17256848143791419023%2Cpvt%3Aa%26hl%3Den%26gl%3Dae%26udm%3D28&id=f0652d84-c33d-4987-bccd-15d4cb38d2b7&title=ASICS+Gel-Nimbus+27+ATC+Men%27s+Running+Shoes&store=runners-ae&storeName=runners.ae
```

### S.P.C.C. Official `(s-p-c-c-official)`  · relay=Y

**Product**: MDS Taskforce Tee

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A12035599047362828882%2Cproductid%3A2390572833881545278%2CheadlineOfferDocid%3A15976986167754104211%2CimageDocid%3A12316751484286746303%2Cgpcid%3A13812247672853160035%2Cmid%3A576462899417808599%2Cpvt%3Aa%26hl%3Den%26gl%3Dza%26udm%3D28&id=86eb89aa-7732-4e4e-9a6d-ce22743a2f2f&title=MDS+Taskforce+Tee&store=s-p-c-c-official&storeName=S.P.C.C.+Official
```

### Sacramento State Bookstore `(sacramento-state-bookstore)`  · relay=Y

**Product**: JBL Tune 670NC Noise Cancelling Wireless On-Ear Headphones

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A3333131619137253218%2CheadlineOfferDocid%3A14104771037860271429%2CimageDocid%3A16895232638146432393%2Crds%3APC_10307120160428463139%7CPROD_PC_10307120160428463139%2Cgpcid%3A10307120160428463139%2Cmid%3A576462461014892404%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=0a954ca3-6f08-4c96-87ec-e668522a18c5&title=JBL+Tune+670NC+Noise+Cancelling+Wireless+On-Ear+Headphones&store=sacramento-state-bookstore&storeName=Sacramento+State+Bookstore
```

### Safe and Sound `(safe-and-sound)`  · relay=Y

**Product**: Kanto ORA Bluetooth Powered Reference Desktop Speakers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A16377676183305733494%2Cproductid%3A2966363846133438361%2CheadlineOfferDocid%3A3866369766426770855%2CimageDocid%3A6824212730601415275%2Crds%3APC_9132221067850219898%7CPROD_PC_9132221067850219898%2Cgpcid%3A9132221067850219898%2Cmid%3A576462852107862007%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=4cbe1616-2273-4143-843b-9e9c928bc229&title=Kanto+ORA+Bluetooth+Powered+Reference+Desktop+Speakers&store=safe-and-sound&storeName=Safe+and+Sound
```

### Sally Beauty `(sally-beauty)`  · relay=Y

**Product**: Olaplex No.5 Bond Maintenance Conditioner

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A2940232918919205459%2Cproductid%3A8804745326575298802%2CheadlineOfferDocid%3A2233749962855046515%2CimageDocid%3A12491448382061043589%2Crds%3APC_10988662744331824042%7CPROD_PC_10988662744331824042%2Cgpcid%3A10988662744331824042%2Cmid%3A576462807942259943%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=73b7d82f-f4ac-48c2-988a-c513f05c07d1&title=Olaplex+No.5+Bond+Maintenance+Conditioner&store=sally-beauty&storeName=Sally+Beauty
```

### saloosonline.com `(saloosonline)`  · relay=Y

**Product**: Ruched Sleeve Print Dress with Necklace

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A16502328704655088197%2Cproductid%3A3505463617466496791%2CheadlineOfferDocid%3A14148050652760367930%2CimageDocid%3A6091741988391956343%2Cgpcid%3A16293731818211701767%2Cmid%3A576462512321942984%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=c4ac6498-fefa-4fc8-badb-1d2f163039ed&title=Ruched+Sleeve+Print+Dress+with+Necklace&store=saloosonline&storeName=saloosonline.com
```

### SamsBeauty `(samsbeauty)`  · relay=Y

**Product**: Beauty Creations Flawless Stay Powder Foundation

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A6292041670652567481%2Cproductid%3A4433616262950704197%2CheadlineOfferDocid%3A16951894161627076305%2CimageDocid%3A14960820293152277067%2Crds%3APC_17597549805185507613%7CPROD_PC_17597549805185507613%2Cgpcid%3A17597549805185507613%2Cmid%3A576462782842526076%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=e16e69f2-4812-41e3-b412-f5f1c2f153d5&title=Beauty+Creations+Flawless+Stay+Powder+Foundation&store=samsbeauty&storeName=SamsBeauty
```

### Samsung Official Store `(samsung-official-store)`  · relay=Y

**Product**: Samsung Galaxy A16 4G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A4491409569674095135%2Cproductid%3A2420117528500822397%2CheadlineOfferDocid%3A5439619719484378251%2CimageDocid%3A4128293660709829805%2Crds%3APC_16814340506323572961%7CPROD_PC_16814340506323572961%2Cgpcid%3A16814340506323572961%2Cmid%3A576462887546003820%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=45e9a77c-fb36-4aa9-bde8-653ee3390916&title=Samsung+Galaxy+A16+4G&store=samsung-official-store&storeName=Samsung+Official+Store
```

### Samsung UK `(samsung-uk)`  · relay=Y

**Product**: Samsung Galaxy Z Flip7

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A632379696689999729%2Cproductid%3A12852459538070340169%2CheadlineOfferDocid%3A13037112073354115497%2CimageDocid%3A1823312690718954193%2Crds%3APC_10192101424008708893%7CPROD_PC_10192101424008708893%2Cgpcid%3A10192101424008708893%2Cmid%3A576462863844915666%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=fe104e56-4d91-4384-9986-4bd649343e44&title=Samsung+Galaxy+Z+Flip7&store=samsung-uk&storeName=Samsung+UK
```

### Samsung.com `(samsung)`  · relay=Y

**Product**: Samsung Galaxy Z Fold7

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A17947345931038640737%2Cproductid%3A16741698140778291326%2CheadlineOfferDocid%3A7144840308885151020%2CimageDocid%3A17973709407924954107%2Crds%3APC_16337891081947337161%7CPROD_PC_16337891081947337161%2Cgpcid%3A16337891081947337161%2Cmid%3A576462833777183171%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=9aad5d5d-ad12-497e-b1d3-0fef3a9f11e5&title=Samsung+Galaxy+Z+Fold7&store=samsung&storeName=Samsung.com
```

### Sangeetha Mobiles `(sangeetha-mobiles)`  · relay=Y

**Product**: SAMSUNG Galaxy A06-A065F Android Mobile Smart Phone With 64GB+4GB & 128GB+4GB

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A1181051388362067119%2CheadlineOfferDocid%3A2993065188096948228%2CimageDocid%3A7544981033918339463%2Crds%3APC_5148135625556976272%7CPROD_PC_5148135625556976272%2Cgpcid%3A5148135625556976272%2Cmid%3A576462823129635666%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=26b2169e-d34c-41cc-a279-676baade30fa&title=SAMSUNG+Galaxy+A06-A065F+Android+Mobile+Smart+Phone+With+64GB%2B4GB+%26+128GB%2B4GB&store=sangeetha-mobiles&storeName=Sangeetha+Mobiles
```

### SaumyasStore `(saumyasstore)`  · relay=Y

**Product**: HP Intel Core i5 13th Gen Laptop

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A3659529219078886685%2Cproductid%3A421680744876957436%2CheadlineOfferDocid%3A15108011813765370268%2CimageDocid%3A11146950461758676296%2Cgpcid%3A11780989250736198264%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=218ec248-974b-45ce-b092-fd03437cb0b2&title=HP+Intel+Core+i5+13th+Gen+Laptop&store=saumyasstore&storeName=SaumyasStore
```

### SB-Traders-SB `(sb-traders-sb)`  · relay=Y

**Product**: Krome 330L Double Door Top Mounted Refrigerator |KR-RFF330SM

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A2050096259813832423%2Cproductid%3A7441092845314577073%2CheadlineOfferDocid%3A12523869161459173418%2CimageDocid%3A3536466106567339302%2Crds%3APC_2071006984567190061%7CPROD_PC_2071006984567190061%2Cgpcid%3A2071006984567190061%2Cmid%3A576462859071202806%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=514205f1-af0d-4b34-9668-c0449d0027c3&title=Krome+330L+Double+Door+Top+Mounted+Refrigerator+%7CKR-RFF330SM&store=sb-traders-sb&storeName=SB-Traders-SB
```

### Scan.co.uk `(scan)`  · relay=Y

**Product**: MSI Stealth A16 AI+ 16" Gaming Laptop AMD Ryzen AI 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A7147537551073345979%2Cproductid%3A1845372179776209242%2CheadlineOfferDocid%3A10541367359824948258%2CimageDocid%3A1709755438261273596%2Crds%3APC_4921029500011085040%7CPROD_PC_4921029500011085040%2Cgpcid%3A4921029500011085040%2Cmid%3A576462816711767317%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=6ad5cf53-5364-4325-930f-52c071b1e3bb&title=MSI+Stealth+A16+AI%2B+16%22+Gaming+Laptop+AMD+Ryzen+AI+9&store=scan&storeName=Scan.co.uk
```

### Scheels `(scheels)`  · relay=Y

**Product**: Nike Academy Soccer Ball

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A3541322005793593965%2Cproductid%3A3457400228917342516%2CheadlineOfferDocid%3A7431613320970806946%2CimageDocid%3A11914059928512814045%2Crds%3APC_16252903819094502794%7CPROD_PC_16252903819094502794%2Cgpcid%3A16252903819094502794%2Cmid%3A576462847531569049%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=e6795d55-7692-48ff-b929-8656c3cc4554&title=Nike+Academy+Soccer+Ball&store=scheels&storeName=Scheels
```

### schuh `(schuh)`  · relay=Y

**Product**: Nike Dunk Women's Low

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike+Dunk+Low%26prds%3Dcatalogid%3A434013966211572332%2Cproductid%3A5581209109814278457%2CheadlineOfferDocid%3A3681361514575871012%2CimageDocid%3A16652949259742727414%2Crds%3APC_16535421970869836870%7CPROD_PC_16535421970869836870%2Cgpcid%3A16535421970869836870%2Cmid%3A576462900332636647%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=e1123e66-6b0f-4b19-9365-4e5521c956b6&title=Nike+Dunk+Women%27s+Low&store=schuh&storeName=schuh
```

### Sears - Entrotek `(sears-entrotek)`  · relay=Y

**Product**: Nioh Collection PS5

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPlayStation+5%26prds%3Dcatalogid%3A3103071313309107538%2Cproductid%3A17778179081399493254%2CheadlineOfferDocid%3A16290406621268936543%2CimageDocid%3A1606235108077078899%2Crds%3APC_18165183931033253759%7CPROD_PC_18165183931033253759%2Cgpcid%3A18165183931033253759%2Cmid%3A576462888395011883%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c8d4818a-4e3e-4c84-b1ac-1ef780b542e0&title=Nioh+Collection+PS5&store=sears-entrotek&storeName=Sears+-+Entrotek
```

### Sedeta `(sedeta)`  · relay=Y

**Product**: SEDETA 96 Inch L Shaped Gaming Desk

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A4979325115557635792%2Cproductid%3A2585479291137889432%2CheadlineOfferDocid%3A6251286992948812831%2CimageDocid%3A15583422618009857607%2Crds%3APC_16466942769932673966%7CPROD_PC_16466942769932673966%2Cgpcid%3A16466942769932673966%2Cmid%3A576462864722989295%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ff8eb0bd-a96f-4f44-b996-6109b9fa7033&title=SEDETA+96+Inch+L+Shaped+Gaming+Desk&store=sedeta&storeName=Sedeta
```

### Sevenoaks Sound and Vision `(sevenoaks-sound-and-vision)`  · relay=Y

**Product**: Focal Azurys Headphones

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A5091302944972731019%2Cproductid%3A18001948999268159784%2CheadlineOfferDocid%3A11468770996221710574%2CimageDocid%3A10723408581495246107%2Crds%3APC_1160552656969695289%7CPROD_PC_1160552656969695289%2Cgpcid%3A1160552656969695289%2Cmid%3A576462498634071617%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=93294da1-324b-40c2-a9b4-03c6fc37b61d&title=Focal+Azurys+Headphones&store=sevenoaks-sound-and-vision&storeName=Sevenoaks+Sound+and+Vision
```

### SHANY `(shany)`  · relay=Y

**Product**: SHANY Professional All in One Makeup Kit Beauty Cliche

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A13564479752312570227%2Cproductid%3A10711096986765363152%2CheadlineOfferDocid%3A3441401789541820582%2CimageDocid%3A17336585913641670341%2Crds%3APC_8576946443124923909%7CPROD_PC_8576946443124923909%2Cgpcid%3A8576946443124923909%2Cmid%3A576462899417630462%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=673d5b4a-0d8f-46e0-a293-f944bd1310d0&title=SHANY+Professional+All+in+One+Makeup+Kit+Beauty+Cliche&store=shany&storeName=SHANY
```

### Sharp Imaging `(sharp-imaging)`  · relay=Y

**Product**: Edifier MF3 Portable Voice Amplifier

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A6663050948587915544%2Cproductid%3A9685576742259485310%2CheadlineOfferDocid%3A2673628160183837905%2CimageDocid%3A18096424646507797747%2Crds%3APC_7693335021035588412%7CPROD_PC_7693335021035588412%2Cgpcid%3A7693335021035588412%2Cmid%3A576462869043427683%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=22a8a615-dc78-4fc4-91da-07fcd1ba9fd9&title=Edifier+MF3+Portable+Voice+Amplifier&store=sharp-imaging&storeName=Sharp+Imaging
```

### Sheenu Game Center `(sheenu-game-center)`  · relay=Y

**Product**: Assassin's Creed Mirage

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A12596648881872640808%2Cproductid%3A11733580809885788827%2CheadlineOfferDocid%3A14816934778444475123%2CimageDocid%3A6293859492410803082%2Crds%3APC_10063477193120073682%7CPROD_PC_10063477193120073682%2Cgpcid%3A10063477193120073682%2Cmid%3A576462685015976564%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=6e421960-8da2-4d84-a022-8a57526b26f7&title=Assassin%27s+Creed+Mirage&store=sheenu-game-center&storeName=Sheenu+Game+Center
```

### sheglam.com `(sheglam)`  · relay=Y

**Product**: Dew & Done Skin Tint With SPF20

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A17602590121409111915%2CheadlineOfferDocid%3A16626498280005069349%2CimageDocid%3A6421152947479416528%2Crds%3APC_8181254223935556224%7CPROD_PC_8181254223935556224%2Cgpcid%3A8181254223935556224%2Cmid%3A576462829167219562%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=9707afe8-c48d-49aa-b6f7-c3a571e83f8a&title=Dew+%26+Done+Skin+Tint+With+SPF20&store=sheglam&storeName=sheglam.com
```

### Shein `(shein)`  · relay=Y

**Product**: The Ordinary Niacinamida al 10% + Zinc al 1% 1oz/30ml,

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DThe+Ordinary+Niacinamide+deals%26prds%3Dproductid%3A15214873975894137177%2CheadlineOfferDocid%3A15214873975894137177%2CimageDocid%3A3573961208450209768%2Crds%3APC_9928065431670610974%7CPROD_PC_9928065431670610974%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=42de841e-fc74-4d61-b9ff-f90068593d96&title=The+Ordinary+Niacinamida+al+10%25+%2B+Zinc+al+1%25+1oz%2F30ml%2C&store=shein&storeName=Shein
```

### Shinrai Knives `(shinrai-knives)`  · relay=Y

**Product**: Shinrai Knives - Damascus Print Epoxy Sapphire 3-Piece Knife Set - Chef's Knife + Nakiri + Paring Knife

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A14274449271481308667%2Cproductid%3A11883901012420868282%2CheadlineOfferDocid%3A11862492565283157431%2CimageDocid%3A4670288120193493431%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=2c33e28e-d0b5-4060-9aab-9e6c3799aaf6&title=Shinrai+Knives+-+Damascus+Print+Epoxy+Sapphire+3-Piece+Knife+Set+-+Chef%27s+Knife+%2B+Nakiri+%2B+Paring+Knife&store=shinrai-knives&storeName=Shinrai+Knives
```

### SHOES-n-FEET `(shoes-n-feet)`  · relay=Y

**Product**: BROOKS GHOST 17 MEN'S BLACK/WHITE / 10 / D

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dproductid%3A11768520258980182153%2CheadlineOfferDocid%3A11768520258980182153%2CimageDocid%3A3583666098996260075%2Crds%3APC_9218840342059386745%7CPROD_PC_9218840342059386745%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=72bd1c60-3756-45bb-a2f2-96ef74f5025d&title=BROOKS+GHOST+17+MEN%27S+BLACK%2FWHITE+%2F+10+%2F+D&store=shoes-n-feet&storeName=SHOES-n-FEET
```

### SHOP APOTHEKE `(shop-apotheke)`  · relay=Y

**Product**: Clinique Moisture Surge Hydrator

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A2559517157367643365%2Cproductid%3A1159540485871530320%2CheadlineOfferDocid%3A14402165598159533429%2CimageDocid%3A9052476340412248419%2Crds%3APC_343546397917715592%7CPROD_PC_343546397917715592%2Cgpcid%3A343546397917715592%2Cmid%3A576462401381189639%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=9915ec9b-db26-4614-9a6d-98f8dc4ef389&title=Clinique+Moisture+Surge+Hydrator&store=shop-apotheke&storeName=SHOP+APOTHEKE
```

### shop.preethi.in `(shop-preethi-in)`  · relay=Y

**Product**: Preethi Zodiac Mixer Grinder 750 Watt 5 Jars

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A5692574410664544391%2Cproductid%3A1374283277177533405%2CheadlineOfferDocid%3A10164766112485818419%2CimageDocid%3A14528954757150954754%2Cgpcid%3A513786784497888337%2Cmid%3A576462839955423294%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=f017da27-8e79-4f80-966b-95dda5379876&title=Preethi+Zodiac+Mixer+Grinder+750+Watt+5+Jars&store=shop-preethi-in&storeName=shop.preethi.in
```

### ShopatSC `(shopatsc)`  · relay=Y

**Product**: Sony WH-CH520 Wireless Headphones

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A13972574244139192575%2Cproductid%3A6458010975006847717%2CheadlineOfferDocid%3A18134498744036235195%2CimageDocid%3A9470233801695627283%2Crds%3APC_7451359503992031879%7CPROD_PC_7451359503992031879%2Cgpcid%3A7451359503992031879%2Cmid%3A576462446266797930%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=8ff7f50f-c672-43d5-8089-e6f7019d45e7&title=Sony+WH-CH520+Wireless+Headphones&store=shopatsc&storeName=ShopatSC
```

### Shoppers Stop `(shoppers-stop)`  · relay=Y

**Product**: Puma Conduct Pro Running Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A9262090127541835523%2Cproductid%3A10967558626441345014%2CheadlineOfferDocid%3A10197215656672239829%2CimageDocid%3A16006793909230314148%2Crds%3APC_17240495369444362020%7CPROD_PC_17240495369444362020%2Cgpcid%3A10176349259738842355%2Cmid%3A576462884629511637%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=6fa24ca6-4e77-4383-bd28-a6c6fe549918&title=Puma+Conduct+Pro+Running+Shoes&store=shoppers-stop&storeName=Shoppers+Stop
```

### ShopSimon `(shopsimon)`  · relay=Y

**Product**: Vince Camuto Women's Satin V-Neck Long Sleeve Wrap Front Maxi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A13108013712514841568%2Cproductid%3A13846884845653090719%2CheadlineOfferDocid%3A859371215043885053%2CimageDocid%3A6909834083567364472%2Crds%3APC_5383160936682039550%7CPROD_PC_5383160936682039550%2Cgpcid%3A5383160936682039550%2Cmid%3A576462874972072779%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=b548b7e2-0fd7-42c8-bbd5-ad38e835f60a&title=Vince+Camuto+Women%27s+Satin+V-Neck+Long+Sleeve+Wrap+Front+Maxi+Dress&store=shopsimon&storeName=ShopSimon
```

### ShopWSS `(shopwss)`  · relay=Y

**Product**: Mens adidas F50 League FG Soccer Cleats

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A12659917383687719220%2Cproductid%3A14319552126670438113%2CheadlineOfferDocid%3A11584448149839932926%2CimageDocid%3A15594570701055356548%2Crds%3APC_18204786238605029055%7CPROD_PC_18204786238605029055%2Cgpcid%3A18204786238605029055%2Cmid%3A576462884947830198%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=97850a39-87d3-4ad7-b1e7-a9711b8e4a82&title=Mens+adidas+F50+League+FG+Soccer+Cleats&store=shopwss&storeName=ShopWSS
```

### Sigma Sports `(sigma-sports)`  · relay=Y

**Product**: Science in Sport SIS GO Hydro Tablets

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A3049816351644256484%2Cproductid%3A5093242632739347597%2CheadlineOfferDocid%3A1807082512216490109%2CimageDocid%3A11039901493081435084%2Crds%3APC_9185851606476689940%7CPROD_PC_9185851606476689940%2Cgpcid%3A9185851606476689940%2Cmid%3A576462705252474226%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=4f901949-55db-4625-8993-e400b1465566&title=Science+in+Sport+SIS+GO+Hydro+Tablets&store=sigma-sports&storeName=Sigma+Sports
```

### Silver Lining Herbs `(silver-lining-herbs)`  · relay=Y

**Product**: Healthy Living Bundle For Humans

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dproductid%3A13120600488066060435%2CheadlineOfferDocid%3A13120600488066060435%2CimageDocid%3A14812231695710621848%2Crds%3ALO_13120600488066060435%7CPROD_LO_13120600488066060435%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=6f11028b-34f9-49ec-8b38-f9908a5375de&title=Healthy+Living+Bundle+For+Humans&store=silver-lining-herbs&storeName=Silver+Lining+Herbs
```

### Simply Be `(simply-be)`  · relay=Y

**Product**: Simply BE Plus Size Tapered Trousers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A13415242370169957095%2Cproductid%3A472649811359251248%2CheadlineOfferDocid%3A5867146714088130919%2CimageDocid%3A14806301162833491785%2Cgpcid%3A8655711505569817009%2Cmid%3A576462516981585521%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=2e943b26-f871-45ef-b0f8-69d0ab44e06e&title=Simply+BE+Plus+Size+Tapered+Trousers&store=simply-be&storeName=Simply+Be
```

### Simply Sound & Lighting `(simply-sound-lighting)`  · relay=Y

**Product**: RCF Art 915-A 15" Active Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A746521855258650278%2Cproductid%3A18286742160877923196%2CheadlineOfferDocid%3A9424517052703830103%2CimageDocid%3A4449573871408694120%2Crds%3APC_10610451904543666972%7CPROD_PC_10610451904543666972%2Cgpcid%3A10610451904543666972%2Cmid%3A576462816532845412%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=b97f60ab-0af9-446e-bcc3-5b4fd1d751db&title=RCF+Art+915-A+15%22+Active+Speaker&store=simply-sound-lighting&storeName=Simply+Sound+%26+Lighting
```

### Slam City Skates UK `(slam-city-skates-uk)`  · relay=Y

**Product**: Nike SB Dunk Low Pro Electric Skate Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DNike+Dunk+Low%26prds%3Dcatalogid%3A14623650992969076625%2Cproductid%3A15956050994600420464%2CheadlineOfferDocid%3A1856485903044068379%2CimageDocid%3A8068394944465885000%2Crds%3APC_174013844997822561%7CPROD_PC_174013844997822561%2Cgpcid%3A174013844997822561%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=0ecf32a1-62c4-441e-9866-9bbb7c2e81cf&title=Nike+SB+Dunk+Low+Pro+Electric+Skate+Shoes&store=slam-city-skates-uk&storeName=Slam+City+Skates+UK
```

### Slikk Club `(slikk-club)`  · relay=Y

**Product**: Sassafras Women's Rib Contrast Button Maxi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A12021587531887241070%2Cproductid%3A1231049866971159275%2CheadlineOfferDocid%3A7248024818423266969%2CimageDocid%3A4883093157274148510%2Cgpcid%3A653846878982498954%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=948594ef-692f-4756-960b-447047723ac7&title=Sassafras+Women%27s+Rib+Contrast+Button+Maxi+Dress&store=slikk-club&storeName=Slikk+Club
```

### Smallable `(smallable)`  · relay=Y

**Product**: Kreafunk Glowie multi-function Bluetooth speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A12708885596864743994%2Cproductid%3A4597234551297674625%2CheadlineOfferDocid%3A14913034484318503680%2CimageDocid%3A870343265077510599%2Cgpcid%3A4236395247207379079%2Cmid%3A576462801161137846%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=a5103e71-8cf4-409d-9cde-137e660f1b0f&title=Kreafunk+Glowie+multi-function+Bluetooth+speaker&store=smallable&storeName=Smallable
```

### Smart Home Sounds `(smart-home-sounds)`  · relay=Y

**Product**: Sony SA-SW3 Wireless Subwoofer

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A3106114730891495261%2Cproductid%3A15252366205916703455%2CheadlineOfferDocid%3A2122832735591080640%2CimageDocid%3A9957568051592665023%2Crds%3APC_15115998773034451280%7CPROD_PC_15115998773034451280%2Cgpcid%3A15115998773034451280%2Cmid%3A576462778202523916%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=0cd77018-6e4f-4100-aee4-2252b3031bb9&title=Sony+SA-SW3+Wireless+Subwoofer&store=smart-home-sounds&storeName=Smart+Home+Sounds
```

### Smiths TV `(smiths-tv)`  · relay=Y

**Product**: Hisense HDCEC5C10B 50cm Electric Ceramic Cooker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A17009384928911844054%2Cproductid%3A944895524983788883%2CheadlineOfferDocid%3A6059323454736352447%2CimageDocid%3A14877470379408167428%2Crds%3APC_7193869426560204506%7CPROD_PC_7193869426560204506%2Cgpcid%3A7193869426560204506%2Cmid%3A576462858665373334%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=80c60578-2f84-49f7-bbf2-1776d46395f1&title=Hisense+HDCEC5C10B+50cm+Electric+Ceramic+Cooker&store=smiths-tv&storeName=Smiths+TV
```

### Smytten `(smytten)`  · relay=Y

**Product**: Swiss Beauty Dual Passport Matte Shimmer Eyeshadow Palette

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A2425144245917343847%2CheadlineOfferDocid%3A10682323835633988065%2CimageDocid%3A15879651603208700687%2Crds%3APC_2622854713065127994%7CPROD_PC_2622854713065127994%2Cgpcid%3A2622854713065127994%2Cmid%3A576462886073562670%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=7586de70-c70a-4b5f-8547-8760607a41aa&title=Swiss+Beauty+Dual+Passport+Matte+Shimmer+Eyeshadow+Palette&store=smytten&storeName=Smytten
```

### Snapklik AE `(snapklik-ae)`  · relay=Y

**Product**: Avantree Harmony 2 Wireless Stereo Speaker System For Multiroom And Parties, 1 Transmitter With 3 Bluetooth Speakers, Individual Volume, Expandable Up

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A11141307169840924437%2Cproductid%3A16508932453684826361%2CheadlineOfferDocid%3A12409714816698540379%2CimageDocid%3A5270185802197269494%2Crds%3APC_9781270899062303843%7CPROD_PC_9781270899062303843%2Cgpcid%3A9781270899062303843%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=d0735dcf-0b31-4877-ac5c-4a0a77901a41&title=Avantree+Harmony+2+Wireless+Stereo+Speaker+System+For+Multiroom+And+Parties%2C+1+Transmitter+With+3+Bluetooth+Speakers%2C+In&store=snapklik-ae&storeName=Snapklik+AE
```

### Snapklik.com `(snapklik)`  · relay=Y

**Product**: GEEKOM A5 2025 Edition Mini PC

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A6106089906005471768%2Cproductid%3A742705237576567072%2CheadlineOfferDocid%3A15532763492498414592%2CimageDocid%3A9328877666366800003%2Crds%3APC_7405495371161668687%7CPROD_PC_7405495371161668687%2Cgpcid%3A7405495371161668687%2Cmid%3A576462885360388255%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=4fbac4c4-d1f8-4954-bf0d-ca4e2baca942&title=GEEKOM+A5+2025+Edition+Mini+PC&store=snapklik&storeName=Snapklik.com
```

### SNIPES USA `(snipes-usa)`  · relay=Y

**Product**: Air Jordan 1 Mid SE Women's Basketball Sneakers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAir+Jordan+1+Mid%26prds%3Dcatalogid%3A1113688663035857254%2Cproductid%3A8232866410067629652%2CheadlineOfferDocid%3A6712926844303959902%2CimageDocid%3A1357967116917588779%2Crds%3APC_9510287633069563646%7CPROD_PC_9510287633069563646%2Cgpcid%3A9510287633069563646%2Cmid%3A576462834992979708%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=bd8ae904-b930-468a-8518-1c08ff773ec4&title=Air+Jordan+1+Mid+SE+Women%27s+Basketball+Sneakers&store=snipes-usa&storeName=SNIPES+USA
```

### Solid State Logic `(solid-state-logic)`  · relay=Y

**Product**: SSL Native Bus Compressor 2

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A13489214168950540350%2Cproductid%3A8766613900694899211%2CheadlineOfferDocid%3A6263329926431885357%2CimageDocid%3A8462558223713951846%2Crds%3APC_6562602911956842124%7CPROD_PC_6562602911956842124%2Cgpcid%3A6562602911956842124%2Cmid%3A576462702751466764%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=7525ae99-04e4-46d8-a2e9-18945ca4f573&title=SSL+Native+Bus+Compressor+2&store=solid-state-logic&storeName=Solid+State+Logic
```

### Sotrue `(sotrue)`  · relay=Y

**Product**: Sotrue Strobe Cream

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A1154071362285916616%2Cproductid%3A1116283513083544652%2CheadlineOfferDocid%3A13810051924481759939%2CimageDocid%3A11548622524093016370%2Crds%3APC_6169604997794134693%7CPROD_PC_6169604997794134693%2Cgpcid%3A6169604997794134693%2Cmid%3A576462886179979709%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=bdac67be-a44c-45c1-a5e5-2fd3055bcb3f&title=Sotrue+Strobe+Cream&store=sotrue&storeName=Sotrue
```

### Sound Town Electronics `(sound-town-electronics)`  · relay=Y

**Product**: RCF HDL 50-A 4K Active Three-Way Line Array Module

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A4081552644390700760%2Cproductid%3A14370533558872636026%2CheadlineOfferDocid%3A6647458377326431797%2CimageDocid%3A9780107948663760096%2Cgpcid%3A4758845792637772657%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=7200a0c5-194b-4ca4-85b4-357c699b7a22&title=RCF+HDL+50-A+4K+Active+Three-Way+Line+Array+Module&store=sound-town-electronics&storeName=Sound+Town+Electronics
```

### Spade & Co `(spade-co)`  · relay=Y

**Product**: Health Smartwatch 4

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A18175031695041695837%2Cproductid%3A2688477159514935990%2CheadlineOfferDocid%3A8142238767942318240%2CimageDocid%3A2358028669958815333%2Cgpcid%3A13880721179835136161%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=81d88ec2-9ccd-4d56-8afe-0c0a40cf773e&title=Health+Smartwatch+4&store=spade-co&storeName=Spade+%26+Co
```

### Spicewalla `(spicewalla)`  · relay=Y

**Product**: Kitchen Essentials Collection

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A7766569463933219107%2Cproductid%3A13540617471289802238%2CheadlineOfferDocid%3A10800758763517577377%2CimageDocid%3A12281978280166341013%2Cgpcid%3A3881701498660979411%2Cmid%3A576462402532038581%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=456387ce-b5c2-4c03-b5ac-45cd271635fc&title=Kitchen+Essentials+Collection&store=spicewalla&storeName=Spicewalla
```

### sports palace `(sports-palace)`  · relay=Y

**Product**: Nivia Football Air Strike Yellow

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A6376930247902072565%2Cproductid%3A17992158685766506315%2CheadlineOfferDocid%3A6896341835976976554%2CimageDocid%3A445544064471189897%2Cgpcid%3A12278102990892581206%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=25dcd08c-fdf2-4e3c-8ea4-a475e770fbd8&title=Nivia+Football+Air+Strike+Yellow&store=sports-palace&storeName=sports+palace
```

### Sportsman's Warehouse `(sportsman-s-warehouse)`  · relay=Y

**Product**: Crocs Men's Classic Clogs - Blue Bolt M6/W8 by Sportsman's Warehouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCrocs+Classic+Clog+deals%26prds%3Dproductid%3A15314441501657389908%2CheadlineOfferDocid%3A15314441501657389908%2CimageDocid%3A4005902888954747725%2Crds%3APC_5803906498614987482%7CPROD_PC_5803906498614987482%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=3ccc9240-6e22-45d1-a2ae-37306d0e6ce7&title=Crocs+Men%27s+Classic+Clogs+-+Blue+Bolt+M6%2FW8+by+Sportsman%27s+Warehouse&store=sportsman-s-warehouse&storeName=Sportsman%27s+Warehouse
```

### ssense.com `(ssense)`  · relay=Y

**Product**: U Beauty The Super Tinted Hydrator

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A17194344498562914128%2Cproductid%3A14157452700310676871%2CheadlineOfferDocid%3A10584281930112072974%2CimageDocid%3A5080572965754098071%2Crds%3APC_794627029862070417%7CPROD_PC_794627029862070417%2Cgpcid%3A794627029862070417%2Cmid%3A576462472880648207%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7d42bf3d-6b1e-4824-bd30-75c10e71dcdb&title=U+Beauty+The+Super+Tinted+Hydrator&store=ssense&storeName=ssense.com
```

### Stanley 1913 `(stanley-1913)`  · relay=Y

**Product**: Stanley Quencher H2.0 Flowstate Tumbler

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStanley+Quencher+40oz+deals%26prds%3Dcatalogid%3A5042568513118027921%2Cproductid%3A7327281918900528121%2CheadlineOfferDocid%3A7977185030999407817%2CimageDocid%3A2270414432730870028%2Crds%3APC_45692462763145774%7CPROD_PC_45692462763145774%2Cgpcid%3A45692462763145774%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1232fe43-99ba-4fa5-8a60-6f0107143807&title=Stanley+Quencher+H2.0+Flowstate+Tumbler&store=stanley-1913&storeName=Stanley+1913
```

### Stanley 1913 UK `(stanley-1913-uk)`  · relay=Y

**Product**: Stanley Quencher H2.0 FlowState Tumbler

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStanley+Quencher+40oz+deals%26prds%3Dcatalogid%3A1216752629219121919%2Cproductid%3A6912595410068400143%2CheadlineOfferDocid%3A18137987040509193133%2CimageDocid%3A7228176192705370078%2Crds%3APC_11578049002999288913%7CPROD_PC_11578049002999288913%2Cgpcid%3A11578049002999288913%2Cmid%3A576462530289088770%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=25c19748-4317-4bca-9436-287a1a9542e2&title=Stanley+Quencher+H2.0+FlowState+Tumbler&store=stanley-1913-uk&storeName=Stanley+1913+UK
```

### Stellar `(stellar)`  · relay=Y

**Product**: Stellar 1000 5-Piece Saucepan Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A5111279992789530042%2Cproductid%3A5285152547691775806%2CheadlineOfferDocid%3A3069231482864807433%2CimageDocid%3A12117510463509243607%2Crds%3APC_12014669925637015294%7CPROD_PC_12014669925637015294%2Cgpcid%3A12014669925637015294%2Cmid%3A576462728263495910%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=cfd96830-0d99-4aad-adc3-aa8b8ec1a583&title=Stellar+1000+5-Piece+Saucepan+Set&store=stellar&storeName=Stellar
```

### StockX `(stockx)`  · relay=Y

**Product**: Stanley Flowstate Quencher H2.0 40oz Tumbler Resort Floral

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DStanley+Quencher+40oz+deals%26prds%3Dproductid%3A12082098580517274841%2CheadlineOfferDocid%3A12082098580517274841%2CimageDocid%3A1665120302077417028%2Crds%3APC_14172773746327309989%7CPROD_PC_14172773746327309989%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=faaa9755-ec25-4b42-92a0-5542fb9be0e5&title=Stanley+Flowstate+Quencher+H2.0+40oz+Tumbler+Resort+Floral&store=stockx&storeName=StockX
```

### Studio `(studio)`  · relay=Y

**Product**: Mens adidas F50 League FG Soccer Cleats

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A14513581043812032220%2Cproductid%3A231310418760446891%2CheadlineOfferDocid%3A11082941965339869116%2CimageDocid%3A3008759224420420165%2Crds%3APC_7699550143619594168%7CPROD_PC_7699550143619594168%2Cgpcid%3A7699550143619594168%2Cmid%3A576462870952144553%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=565fc432-3306-4ca4-9a04-b8b4db3300f7&title=Mens+adidas+F50+League+FG+Soccer+Cleats&store=studio&storeName=Studio
```

### Style Union `(style-union)`  · relay=Y

**Product**: Style Union Sleeveless Maxi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A7916960216277458750%2Cproductid%3A3554880754784129519%2CheadlineOfferDocid%3A7627181226826408303%2CimageDocid%3A2882627110262532184%2Cgpcid%3A842158145680897264%2Cmid%3A576462867057811860%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=4374b13b-cdd1-43d4-bea0-28406739b0dc&title=Style+Union+Sleeveless+Maxi+Dress&store=style-union&storeName=Style+Union
```

### Stylevana `(stylevana)`  · relay=Y

**Product**: SK-II - Facial Treatment Clear Lotion - 30ml by Stylevana

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A18273115117953662428%2CheadlineOfferDocid%3A18273115117953662428%2CimageDocid%3A5537589235654251970%2Crds%3APC_13427822593374587659%7CPROD_PC_13427822593374587659%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c8ff54ed-711d-4734-a85a-89b0c9e3ce1b&title=SK-II+-+Facial+Treatment+Clear+Lotion+-+30ml+by+Stylevana&store=stylevana&storeName=Stylevana
```

### Sun & Sand Sports UAE `(sun-sand-sports-uae)`  · relay=Y

**Product**: Nike Men's FC Barcelona 25/26 Home Jersey

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A7383741497665405664%2Cproductid%3A12668585141228167372%2CheadlineOfferDocid%3A7947848737668510293%2CimageDocid%3A11806162646669970885%2Crds%3APC_18421100230852705515%7CPROD_PC_18421100230852705515%2Cgpcid%3A18421100230852705515%2Cmid%3A576462835356625720%2Cpvt%3Aa%26hl%3Den%26gl%3Dae%26udm%3D28&id=14895810-8bfe-4fb7-8d21-836827851ae9&title=Nike+Men%27s+FC+Barcelona+25%2F26+Home+Jersey&store=sun-sand-sports-uae&storeName=Sun+%26+Sand+Sports+UAE
```

### Superdrug.com `(superdrug)`  · relay=Y

**Product**: Bio Oil Skincare Oil

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A3485278234951523266%2Cproductid%3A4974430539976262617%2CheadlineOfferDocid%3A8384295197578883973%2CimageDocid%3A4832972657051491159%2Crds%3APC_2283562041014559581%7CPROD_PC_2283562041014559581%2Cgpcid%3A2283562041014559581%2Cmid%3A576462846985605083%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=eac4131d-f04f-4e65-a2e5-db409baecf25&title=Bio+Oil+Skincare+Oil&store=superdrug&storeName=Superdrug.com
```

### Swarovski UK `(swarovski-uk)`  · relay=Y

**Product**: Swarovski One Heart Bracelet

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A16384753029632103741%2Cproductid%3A11003449604943207762%2CheadlineOfferDocid%3A14143388061715484062%2CimageDocid%3A14144847220664600529%2Crds%3APC_16821158207454086030%7CPROD_PC_16821158207454086030%2Cgpcid%3A16821158207454086030%2Cmid%3A576462686957918326%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=aadea723-8cb8-457f-bc42-4832f397d01e&title=Swarovski+One+Heart+Bracelet&store=swarovski-uk&storeName=Swarovski+UK
```

### SweetCare `(sweetcare)`  · relay=Y

**Product**: CeraVe Moisturizing Lotion Refill

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DCeraVe+Moisturizing+Cream+deals%26prds%3Dcatalogid%3A14070594023783063952%2Cproductid%3A7570839698976932826%2CheadlineOfferDocid%3A13110220368182401703%2CimageDocid%3A18248678283160404200%2Crds%3APC_15980022921005720874%7CPROD_PC_15980022921005720874%2Cgpcid%3A15980022921005720874%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b25e0e08-9aed-4d1a-8707-76a5878b41a3&title=CeraVe+Moisturizing+Lotion+Refill&store=sweetcare&storeName=SweetCare
```

### Sweetwater `(sweetwater)`  · relay=Y

**Product**: Klipsch The Three Plus Wireless Smart Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A2072618660411388077%2Cproductid%3A10529022800136448586%2CheadlineOfferDocid%3A7615421232309247015%2CimageDocid%3A13905028633699204094%2Crds%3APC_18411985460865675266%7CPROD_PC_18411985460865675266%2Cgpcid%3A18411985460865675266%2Cmid%3A576462758672139875%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=888279c1-291e-43d7-92f1-d1a41385b2f8&title=Klipsch+The+Three+Plus+Wireless+Smart+Speaker&store=sweetwater&storeName=Sweetwater
```

### Swiss Beauty `(swiss-beauty)`  · relay=Y

**Product**: Swiss Beauty Bae Town Matte Shimmer Eyeshadow Palette

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A1309279978472491214%2CheadlineOfferDocid%3A18003442240682517213%2CimageDocid%3A14462400546927493918%2Crds%3APC_12545504860817794860%7CPROD_PC_12545504860817794860%2Cgpcid%3A12545504860817794860%2Cmid%3A576462862600765140%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=72ba0e8a-6947-4644-a988-52ff1fd669e8&title=Swiss+Beauty+Bae+Town+Matte+Shimmer+Eyeshadow+Palette&store=swiss-beauty&storeName=Swiss+Beauty
```

### Swisse `(swisse)`  · relay=Y

**Product**: Swisse Women's Multivitamin Tablets

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A1880338872940359472%2Cproductid%3A12590949782543390171%2CheadlineOfferDocid%3A15404487701858886391%2CimageDocid%3A2164463090284153255%2Crds%3APC_15524687315632829200%7CPROD_PC_15524687315632829200%2Cgpcid%3A15524687315632829200%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=52af1d41-6c45-4904-91fb-9bf730cdcd68&title=Swisse+Women%27s+Multivitamin+Tablets&store=swisse&storeName=Swisse
```

### Syga India `(syga-india)`  · relay=Y

**Product**: HP Victus Gaming Laptop

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A3708048934263085785%2Cproductid%3A15954023033061614795%2CheadlineOfferDocid%3A8519031273498536480%2CimageDocid%3A9659884448745239657%2Crds%3APC_4909020454252952272%7CPROD_PC_4909020454252952272%2Cgpcid%3A4909020454252952272%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=68bc99bf-3e8d-45a1-bfb2-d3269aa51003&title=HP+Victus+Gaming+Laptop&store=syga-india&storeName=Syga+India
```

### TalkShopLive `(talkshoplive)`  · relay=Y

**Product**: Screen Protector Film For Apple Watch Series 10 46mm 42mm Soft TPU Hydrogel HD Clear Film for iWatch 10 42MM 46MM Accessories

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DApple+Watch+Series+10+deals%26prds%3Dproductid%3A872208317507259493%2CheadlineOfferDocid%3A872208317507259493%2CimageDocid%3A8932948098211007689%2Crds%3APC_11862135040694524091%7CPROD_PC_11862135040694524091%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=6b3834c6-cd39-4b0d-977f-f7b3de10d138&title=Screen+Protector+Film+For+Apple+Watch+Series+10+46mm+42mm+Soft+TPU+Hydrogel+HD+Clear+Film+for+iWatch+10+42MM+46MM+Access&store=talkshoplive&storeName=TalkShopLive
```

### Tattahome `(tattahome)`  · relay=Y

**Product**: Le Creuset Cocotte Round Evolution 24

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLe+Creuset+Dutch+Oven+deals%26prds%3Dcatalogid%3A10006484166494173094%2Cproductid%3A11350616988561327443%2CheadlineOfferDocid%3A12213928421457741440%2CimageDocid%3A3716473957729315704%2Crds%3APC_10806686404093689144%7CPROD_PC_10806686404093689144%2Cgpcid%3A10806686404093689144%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1bc7ae83-1c9d-4acc-a084-57bc02a08a70&title=Le+Creuset+Cocotte+Round+Evolution+24&store=tattahome&storeName=Tattahome
```

### Techable `(techable)`  · relay=Y

**Product**: Apple Watch Hermès Series 10 – 46mm GPS + 5G – Titanium | Techable Midnight / Good

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DApple+Watch+Series+10+deals%26prds%3Dproductid%3A16801358801327277703%2CheadlineOfferDocid%3A16801358801327277703%2CimageDocid%3A17016398767261758421%2Crds%3APC_11862135040694524091%7CPROD_PC_11862135040694524091%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=8fa20744-900b-41fc-96a8-34e18105bfcf&title=Apple+Watch+Herm%C3%A8s+Series+10+%E2%80%93+46mm+GPS+%2B+5G+%E2%80%93+Titanium+%7C+Techable+Midnight+%2F+Good&store=techable&storeName=Techable
```

### Techinn.com `(techinn)`  · relay=Y

**Product**: Razer BlackShark V2 X Wired Gaming Headset

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A16887646662964450457%2Cproductid%3A6655630385380354220%2CheadlineOfferDocid%3A10528690927500428439%2CimageDocid%3A4798119929761681406%2Crds%3APC_15266292039849992860%7CPROD_PC_15266292039849992860%2Cgpcid%3A15266292039849992860%2Cmid%3A576462492324472067%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=2e9481b2-fd46-48c9-beb8-963c89d6853d&title=Razer+BlackShark+V2+X+Wired+Gaming+Headset&store=techinn&storeName=Techinn.com
```

### Technivision FZE `(technivision-fze)`  · relay=Y

**Product**: Samsung Essential Monitor S3 S30GD 100Hz Full HD

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dcatalogid%3A13949570861944785173%2Cproductid%3A5441955883853711255%2CheadlineOfferDocid%3A15606470218375893708%2CimageDocid%3A10880825698550414413%2Crds%3APC_7307031416603464122%7CPROD_PC_7307031416603464122%2Cgpcid%3A7307031416603464122%2Cmid%3A576462525009923949%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=1f5a1fe1-ce32-41e5-8933-1cf7cf64dbe6&title=Samsung+Essential+Monitor+S3+S30GD+100Hz+Full+HD&store=technivision-fze&storeName=Technivision+FZE
```

### Tello.com `(tello)`  · relay=Y

**Product**: Samsung Galaxy A15 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A17391334099700043836%2Cproductid%3A9980583210447620787%2CheadlineOfferDocid%3A3907941353602314383%2CimageDocid%3A11118856457236560042%2Crds%3APC_12513728665287263249%7CPROD_PC_12513728665287263249%2Cgpcid%3A12513728665287263249%2Cmid%3A576462820638235984%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=33bdb616-598a-4f79-a4dd-f50f4564d4a8&title=Samsung+Galaxy+A15+5G&store=tello&storeName=Tello.com
```

### Tennis-Point.co.uk `(tennis-point)`  · relay=Y

**Product**: Under Armour Tech Twist V-Neck Short Sleeve Womens

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A9074365981541233881%2Cproductid%3A13377902214495755422%2CheadlineOfferDocid%3A588439773602548846%2CimageDocid%3A15668370595066983401%2Crds%3APC_2156936883112597169%7CPROD_PC_2156936883112597169%2Cgpcid%3A2156936883112597169%2Cmid%3A576462847756842175%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=79d0229e-63f3-4d95-bd95-006efb1a2564&title=Under+Armour+Tech+Twist+V-Neck+Short+Sleeve+Womens&store=tennis-point&storeName=Tennis-Point.co.uk
```

### The Bank of Electronics `(the-bank-of-electronics)`  · relay=Y

**Product**: Samsung Galaxy Z Fold7

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A10746832296537379603%2Cproductid%3A5365838447234202786%2CheadlineOfferDocid%3A17514682219355038832%2CimageDocid%3A8423210530152743512%2Crds%3APC_16337891081947337161%7CPROD_PC_16337891081947337161%2Cgpcid%3A16337891081947337161%2Cmid%3A576462833777183171%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=e6051fc7-b9f2-41e3-813a-407a56f57b85&title=Samsung+Galaxy+Z+Fold7&store=the-bank-of-electronics&storeName=The+Bank+of+Electronics
```

### The Children's Place `(the-children-s-place)`  · relay=Y

**Product**: The Children's Place Boys Short Sleeve Layering T-Shirt

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A3709644609787977832%2Cproductid%3A9028925477730106888%2CheadlineOfferDocid%3A9622315012469440839%2CimageDocid%3A10757578913561917115%2Crds%3APC_10898158416021519630%7CPROD_PC_10898158416021519630%2Cgpcid%3A10898158416021519630%2Cmid%3A576462777665886425%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=1d4d2df7-2498-43dd-8e67-bfcae2cc6080&title=The+Children%27s+Place+Boys+Short+Sleeve+Layering+T-Shirt&store=the-children-s-place&storeName=The+Children%27s+Place
```

### The Cornell Store `(the-cornell-store)`  · relay=Y

**Product**: For Airpods Max Headphones, Silicone Cover for Apple Airpod Max Accessories Cases Silicone Case

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAirPods+Max%26prds%3Dproductid%3A18371984236341814678%2CheadlineOfferDocid%3A18371984236341814678%2CimageDocid%3A5409641685608446354%2Crds%3APC_7707716887929943500%7CPROD_PC_7707716887929943500%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=359c3811-3d6c-4434-a94e-087285e148af&title=For+Airpods+Max+Headphones%2C+Silicone+Cover+for+Apple+Airpod+Max+Accessories+Cases+Silicone+Case&store=the-cornell-store&storeName=The+Cornell+Store
```

### The Detox Market `(the-detox-market)`  · relay=Y

**Product**: HUM Nutrition Flatter Me

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A14768028572880975491%2Cproductid%3A10481552299473201761%2CheadlineOfferDocid%3A13450285580960719740%2CimageDocid%3A8398487781819306716%2Crds%3APC_3268106737040458070%7CPROD_PC_3268106737040458070%2Cgpcid%3A3268106737040458070%2Cmid%3A576462789292540016%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=341103dc-f62b-47a4-95e4-536a73e83245&title=HUM+Nutrition+Flatter+Me&store=the-detox-market&storeName=The+Detox+Market
```

### The Device Depot `(the-device-depot)`  · relay=Y

**Product**: Samsung Galaxy S24 Ultra 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSamsung+Galaxy+S24+Ultra%26prds%3Dproductid%3A1701303586230813898%2CheadlineOfferDocid%3A1701303586230813898%2CimageDocid%3A13656483544433331532%2Crds%3APC_17817985598720773820%7CPROD_PC_17817985598720773820%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=135a4463-54d9-492a-aa6a-97e3da9a5696&title=Samsung+Galaxy+S24+Ultra+5G&store=the-device-depot&storeName=The+Device+Depot
```

### The Digital Experience `(the-digital-experience)`  · relay=Y

**Product**: Monitor Audio Silver 7G AMS Dolby Atmos Speakers - Satin White

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A16797980833480169167%2CheadlineOfferDocid%3A16797980833480169167%2CimageDocid%3A2992363429523173703%2Crds%3APC_16811642324549606317%7CPROD_PC_16811642324549606317%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=d4b4f26c-17b5-4135-8a35-59f2b72af90a&title=Monitor+Audio+Silver+7G+AMS+Dolby+Atmos+Speakers+-+Satin+White&store=the-digital-experience&storeName=The+Digital+Experience
```

### The Edinburgh Remakery `(the-edinburgh-remakery)`  · relay=Y

**Product**: Dell XPS 13 Laptop

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DDell+XPS+13+deals%26prds%3Dcatalogid%3A15383356548410614337%2Cproductid%3A6315163406927089241%2CheadlineOfferDocid%3A4006804380105707562%2CimageDocid%3A13160638790774897779%2Crds%3APC_805218950902855700%7CPROD_PC_805218950902855700%2Cgpcid%3A805218950902855700%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=cadf9298-d645-4589-ac35-4ba796c96ff9&title=Dell+XPS+13+Laptop&store=the-edinburgh-remakery&storeName=The+Edinburgh+Remakery
```

### The Entertainer `(the-entertainer)`  · relay=Y

**Product**: EA Sports FC 26

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A14779872484755949502%2Cproductid%3A4167727379510807383%2CheadlineOfferDocid%3A10143009340685205966%2CimageDocid%3A1826865588279890780%2Crds%3APC_15827848701314346873%7CPROD_PC_15827848701314346873%2Cgpcid%3A15827848701314346873%2Cmid%3A576462836115130128%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=a076813f-dbff-4958-89ed-565020015b32&title=EA+Sports+FC+26&store=the-entertainer&storeName=The+Entertainer
```

### The Feed `(the-feed)`  · relay=Y

**Product**: Gel SiS Beta Fuel

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A14067989657802044474%2Cproductid%3A14421049247868461714%2CheadlineOfferDocid%3A14552257404131100189%2CimageDocid%3A10804794285167886583%2Crds%3APC_8833745259534278%7CPROD_PC_8833745259534278%2Cgpcid%3A8833745259534278%2Cmid%3A576462790064267205%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=bb6cf57e-9014-4c7e-b794-2d08ef1fdd15&title=Gel+SiS+Beta+Fuel&store=the-feed&storeName=The+Feed
```

### The Fragrance Shop `(the-fragrance-shop)`  · relay=Y

**Product**: Dior Sauvage Eau de Parfum

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A13976916227066610710%2Cproductid%3A5332983233570515867%2CheadlineOfferDocid%3A15895147304217153648%2CimageDocid%3A17560200146796645592%2Crds%3APC_11003802460562087876%7CPROD_PC_11003802460562087876%2Cgpcid%3A11003802460562087876%2Cmid%3A576462828411672202%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=28a1c1eb-61e5-431b-a69b-941c66d4411f&title=Dior+Sauvage+Eau+de+Parfum&store=the-fragrance-shop&storeName=The+Fragrance+Shop
```

### The Natural Wash `(the-natural-wash)`  · relay=Y

**Product**: TNW The Natural Wash De-Tan Face Pack

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A5457204229339974004%2Cproductid%3A6443372593976053161%2CheadlineOfferDocid%3A16602613866394408393%2CimageDocid%3A8620718094751352831%2Crds%3APC_2293209074518171088%7CPROD_PC_2293209074518171088%2Cgpcid%3A2293209074518171088%2Cmid%3A576462850745778150%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=1ccd7bcc-bdaa-4dae-9821-3f2ee272d297&title=TNW+The+Natural+Wash+De-Tan+Face+Pack&store=the-natural-wash&storeName=The+Natural+Wash
```

### The Perfume Shop `(the-perfume-shop)`  · relay=Y

**Product**: Ghost The Fragrance Eau de Toilette

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A1631608055474729054%2Cproductid%3A3502063652226430878%2CheadlineOfferDocid%3A4339002001389042652%2CimageDocid%3A6203154434326569609%2Crds%3APC_7107165393536497788%7CPROD_PC_7107165393536497788%2Cgpcid%3A7107165393536497788%2Cmid%3A576462304399680942%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=36b23f29-5bbc-411f-bc08-ecde61246770&title=Ghost+The+Fragrance+Eau+de+Toilette&store=the-perfume-shop&storeName=The+Perfume+Shop
```

### The Reliable Store `(the-reliable-store)`  · relay=Y

**Product**: Edifier MP85 Portable Bluetooth Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A6853444643442007409%2Cproductid%3A8191892588125921823%2CheadlineOfferDocid%3A3126085985157641067%2CimageDocid%3A1610392201263785520%2Crds%3APC_601951325488290782%7CPROD_PC_601951325488290782%2Cgpcid%3A601951325488290782%2Cmid%3A576462762266916730%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=97d33666-fdca-4395-aa56-dbf53ba66e61&title=Edifier+MP85+Portable+Bluetooth+Speaker&store=the-reliable-store&storeName=The+Reliable+Store
```

### The Revolver Club `(the-revolver-club)`  · relay=Y

**Product**: Edifier D12 Integrated 2.1 Stereo Bluetooth Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A2004975672854397574%2Cproductid%3A13406904026131609970%2CheadlineOfferDocid%3A16046646441736746304%2CimageDocid%3A6654124448798157889%2Crds%3APC_10002036813765838270%7CPROD_PC_10002036813765838270%2Cgpcid%3A10002036813765838270%2Cmid%3A576462864820151802%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=495ca60f-601e-4d3f-9e4c-96041e246a78&title=Edifier+D12+Integrated+2.1+Stereo+Bluetooth+Speaker&store=the-revolver-club&storeName=The+Revolver+Club
```

### The Sound Factor `(the-sound-factor)`  · relay=Y

**Product**: Edifier R2000DB Bookshelf Speakers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A3388307040346979865%2Cproductid%3A16770572106496569494%2CheadlineOfferDocid%3A17326737196705091201%2CimageDocid%3A7452608323267899703%2Crds%3APC_581656905074843190%7CPROD_PC_581656905074843190%2Cgpcid%3A581656905074843190%2Cmid%3A576462775816677156%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=0c4b9046-3092-435f-93d9-41adda36572e&title=Edifier+R2000DB+Bookshelf+Speakers&store=the-sound-factor&storeName=The+Sound+Factor
```

### The Vitamin Shoppe `(the-vitamin-shoppe)`  · relay=Y

**Product**: OxyShred Thermogenic Fat Burner

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A13767838326555524433%2Cproductid%3A2134581189505106998%2CheadlineOfferDocid%3A7791957034187465227%2CimageDocid%3A11240151238665636486%2Crds%3APC_11538884376367756761%7CPROD_PC_11538884376367756761%2Cgpcid%3A11538884376367756761%2Cmid%3A576462445471280544%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=ee985df0-edb7-4d6b-97c7-43c1ae200505&title=OxyShred+Thermogenic+Fat+Burner&store=the-vitamin-shoppe&storeName=The+Vitamin+Shoppe
```

### thomann.co.uk `(thomann)`  · relay=Y

**Product**: Antares AutoTune Vocal EQ Download

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A11341075662326570826%2CheadlineOfferDocid%3A11341075662326570826%2CimageDocid%3A9934358991952841351%2Crds%3APC_6218258831336907856%7CPROD_PC_6218258831336907856%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=9c7eb45c-ce63-4378-b2ee-c53731dc64b5&title=Antares+AutoTune+Vocal+EQ+Download&store=thomann&storeName=thomann.co.uk
```

### thomann.de `(thomann-de)`  · relay=Y

**Product**: Antares Metamorph Download

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A13459207151510304959%2CheadlineOfferDocid%3A13459207151510304959%2CimageDocid%3A2343186309970149330%2Crds%3APC_14880843869422180966%7CPROD_PC_14880843869422180966%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=fd054efc-692a-4c60-8a0d-f56e1dd869b2&title=Antares+Metamorph+Download&store=thomann-de&storeName=thomann.de
```

### Thrive Market `(thrive-market)`  · relay=Y

**Product**: REDMOND Re-Lyte Hydration

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A18174196610377571912%2Cproductid%3A1936987973995536519%2CheadlineOfferDocid%3A13731165940780629427%2CimageDocid%3A8411258660629338531%2Crds%3APC_14238601324842439202%7CPROD_PC_14238601324842439202%2Cgpcid%3A14238601324842439202%2Cmid%3A576462873782060652%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=8f5b0c1e-0150-4851-83ea-4b7f0b565b02&title=REDMOND+Re-Lyte+Hydration&store=thrive-market&storeName=Thrive+Market
```

### Tillys `(tillys)`  · relay=Y

**Product**: Vans Super Lowpro Womens Shoes - Mint - Size: 8.5

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dproductid%3A15983155101186156687%2CheadlineOfferDocid%3A15983155101186156687%2CimageDocid%3A9625147138253803363%2Crds%3APC_6053089577149956493%7CPROD_PC_6053089577149956493%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=e86bc57b-23e2-4c74-bbc5-7628dff2f283&title=Vans+Super+Lowpro+Womens+Shoes+-+Mint+-+Size%3A+8.5&store=tillys&storeName=Tillys
```

### tink.de `(tink-de)`  · relay=Y

**Product**: TP-Link Tapo P110M - WLAN Steckdose mit Matter - 2er-Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A12099681429963102551%2CheadlineOfferDocid%3A12099681429963102551%2CimageDocid%3A7757058380430121266%2Crds%3APC_1199270120280547366%7CPROD_PC_1199270120280547366%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=9c6fe022-02bb-4744-a774-1f123a957a74&title=TP-Link+Tapo+P110M+-+WLAN+Steckdose+mit+Matter+-+2er-Set&store=tink-de&storeName=tink.de
```

### Torrid `(torrid)`  · relay=Y

**Product**: Women's Torrid Cotton Crew Babydoll Top

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A12397862869994955185%2Cproductid%3A2175978824558194424%2CheadlineOfferDocid%3A11159380114889256227%2CimageDocid%3A10808399025873537905%2Crds%3APC_14810867201781856944%7CPROD_PC_14810867201781856944%2Cgpcid%3A14810867201781856944%2Cmid%3A576462512315285461%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=302509ad-343d-45bb-a9cd-7e58ab8095cc&title=Women%27s+Torrid+Cotton+Crew+Babydoll+Top&store=torrid&storeName=Torrid
```

### TougheesTelecom `(tougheestelecom)`  · relay=Y

**Product**: Samsung Galaxy A34 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones+deals%26prds%3Dcatalogid%3A15551150721634402683%2Cproductid%3A1906377367984657809%2CheadlineOfferDocid%3A6447166544958731755%2CimageDocid%3A468094148286709666%2Crds%3APC_330364151035137927%7CPROD_PC_330364151035137927%2Cgpcid%3A330364151035137927%2Cmid%3A576462702033091410%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=b4bc5617-ccfc-4932-9034-7b2645094ae5&title=Samsung+Galaxy+A34+5G&store=tougheestelecom&storeName=TougheesTelecom
```

### Tower Housewares `(tower-housewares)`  · relay=Y

**Product**: Tower Smart Start Classic Cookware Set

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A4886922962953970280%2Cproductid%3A8062272659262522077%2CheadlineOfferDocid%3A8984386806664146309%2CimageDocid%3A10125952030595731179%2Crds%3APC_13447015693970709396%7CPROD_PC_13447015693970709396%2Cgpcid%3A13447015693970709396%2Cmid%3A576462772204164688%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=41375717-fc74-43cb-8c60-d6c2c35b3fae&title=Tower+Smart+Start+Classic+Cookware+Set&store=tower-housewares&storeName=Tower+Housewares
```

### Tractor Supply Company `(tractor-supply-company)`  · relay=Y

**Product**: Molly Yeh Women's Puff-Sleeve Fleece Sweater

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A7881180098414596347%2Cproductid%3A7741938548210258552%2CheadlineOfferDocid%3A8602934259278697563%2CimageDocid%3A6174817313471745528%2Crds%3APC_16978915188562405994%7CPROD_PC_16978915188562405994%2Cgpcid%3A16978915188562405994%2Cmid%3A576462842494315978%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=ee1f8481-e45a-4d4e-b592-794259c8f9c5&title=Molly+Yeh+Women%27s+Puff-Sleeve+Fleece+Sweater&store=tractor-supply-company&storeName=Tractor+Supply+Company
```

### Tradeindia.com `(tradeindia)`  · relay=Y

**Product**: Logitech G29 Driving Force Racing Wheel

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A436483344396723981%2Cproductid%3A4004613266995012548%2CheadlineOfferDocid%3A15128284968048289641%2Crds%3APC_5396273300619810870%7CPROD_PC_5396273300619810870%2Cgpcid%3A5396273300619810870%2Cmid%3A576462251632908567%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=77a15b2d-814b-43fb-8cb4-5d378d053456&title=Logitech+G29+Driving+Force+Racing+Wheel&store=tradeindia&storeName=Tradeindia.com
```

### Trendyol `(trendyol)`  · relay=Y

**Product**: Juniors Printed Tops With Long Sleeves - Set Of 3 - Multicolour Cotton

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A13569488320377535733%2Cproductid%3A567896436550776570%2CheadlineOfferDocid%3A2586194435097375438%2CimageDocid%3A5271242139659706518%2Cgpcid%3A18350484640019769550%2Cmid%3A576462848478710383%2Cpvt%3Aa%26hl%3Den%26gl%3Dae%26udm%3D28&id=897fa13f-ee61-49fc-aab1-9ba114350daf&title=Juniors+Printed+Tops+With+Long+Sleeves+-+Set+Of+3+-+Multicolour+Cotton&store=trendyol&storeName=Trendyol
```

### triQUIP Sports Tech `(triquip-sports-tech)`  · relay=Y

**Product**: SG RSD Spark Kashmir Willow Cricket Bat

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A14238574080691048778%2Cproductid%3A15362038016315529189%2CheadlineOfferDocid%3A2390050847584818529%2CimageDocid%3A8822120309039446091%2Cgpcid%3A8298208543459560341%2Cmid%3A576462883531192244%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=d540df65-5a4e-488e-a473-206e13bb8ca9&title=SG+RSD+Spark+Kashmir+Willow+Cricket+Bat&store=triquip-sports-tech&storeName=triQUIP+Sports+Tech
```

### TTK PrestigeLimited `(ttk-prestigelimited)`  · relay=Y

**Product**: Prestige Apex Blendo 500 Watt Mixer Grinder with 4 Jars

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A1492827119788081647%2Cproductid%3A10259361298099557622%2CheadlineOfferDocid%3A3406734137676237563%2CimageDocid%3A17580026706529197903%2Cgpcid%3A4522211208357287158%2Cmid%3A576462834961282931%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=bcc535a4-7c7b-4ce4-918b-ce82079f816a&title=Prestige+Apex+Blendo+500+Watt+Mixer+Grinder+with+4+Jars&store=ttk-prestigelimited&storeName=TTK+PrestigeLimited
```

### Turntable Lab `(turntable-lab)`  · relay=Y

**Product**: KEF Q1 Meta Bookshelf Speakers

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A6820281491179884886%2Cproductid%3A1383134685601139230%2CheadlineOfferDocid%3A9096746188731842104%2CimageDocid%3A14356093336589087477%2Crds%3APC_13753677202990270345%7CPROD_PC_13753677202990270345%2Cgpcid%3A13753677202990270345%2Cmid%3A576462794353330520%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=bbf3afaa-bdba-49b4-a0a0-78731a2a61fb&title=KEF+Q1+Meta+Bookshelf+Speakers&store=turntable-lab&storeName=Turntable+Lab
```

### Ubisoft Store `(ubisoft-store)`  · relay=Y

**Product**: Assassin's Creed Odyssey

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A4991231175735202281%2Cproductid%3A10007068065564563397%2CheadlineOfferDocid%3A1011162252756838095%2CimageDocid%3A2264620287094620212%2Crds%3APC_6992055039206402830%7CPROD_PC_6992055039206402830%2Cgpcid%3A6992055039206402830%2Cmid%3A576462306510863310%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=12aa5c89-241f-4a99-aae9-98aa9ae79429&title=Assassin%27s+Creed+Odyssey&store=ubisoft-store&storeName=Ubisoft+Store
```

### Ubisoft Store UK `(ubisoft-store-uk)`  · relay=Y

**Product**: Assassin's Creed Odyssey - Gold Edition - PC (Ubisoft Connect)

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dproductid%3A16759193880148467120%2CheadlineOfferDocid%3A16759193880148467120%2CimageDocid%3A1498162782944432385%2Crds%3APC_8639326803174323850%7CPROD_PC_8639326803174323850%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=7d5aa53e-77dc-40f2-94bb-9bd0b9e8c7b9&title=Assassin%27s+Creed+Odyssey+-+Gold+Edition+-+PC+%28Ubisoft+Connect%29&store=ubisoft-store-uk&storeName=Ubisoft+Store+UK
```

### Ubuy `(ubuy)`  · relay=Y

**Product**: HP ProDesk 400 G9 Business Desktop Computer, SFF Small Form Factor, 12th Gen Intel Core

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing+deals%26prds%3Dproductid%3A10052689643947557640%2CheadlineOfferDocid%3A10052689643947557640%2CimageDocid%3A10612010647556456851%2Crds%3APC_7909054549333806086%7CPROD_PC_7909054549333806086%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=fd84f429-9c5f-4445-94d4-d9f694a1de5d&title=HP+ProDesk+400+G9+Business+Desktop+Computer%2C+SFF+Small+Form+Factor%2C+12th+Gen+Intel+Core&store=ubuy&storeName=Ubuy
```

### uk.healf.com `(uk-healf)`  · relay=Y

**Product**: BodyBio E-Lyte Electrolyte Concentrate

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A17746618038390136156%2Cproductid%3A9340516751694580166%2CheadlineOfferDocid%3A6563895690208008966%2CimageDocid%3A9905763426475006441%2Crds%3APC_5880951057667410621%7CPROD_PC_5880951057667410621%2Cgpcid%3A5880951057667410621%2Cmid%3A576462693049681466%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=20cd34ae-ad75-41e9-9e8d-e108e3710b52&title=BodyBio+E-Lyte+Electrolyte+Concentrate&store=uk-healf&storeName=uk.healf.com
```

### UMKC Bookstore `(umkc-bookstore)`  · relay=Y

**Product**: Apple MacBook Air 15" M4 Chip with 10-CPU

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DMacBook+Air+M3%26prds%3Dcatalogid%3A17160853478104500621%2Cproductid%3A13870100533227159081%2CheadlineOfferDocid%3A8071009098835179882%2CimageDocid%3A17737012756596781264%2Crds%3APC_16366108998644221033%7CPROD_PC_16366108998644221033%2Cgpcid%3A16366108998644221033%2Cmid%3A576462781479953300%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=b4528fd9-689e-4e9a-a5fb-e12e0543e4bb&title=Apple+MacBook+Air+15%22+M4+Chip+with+10-CPU&store=umkc-bookstore&storeName=UMKC+Bookstore
```

### Unboxify `(unboxify)`  · relay=Y

**Product**: Logitech G PRO X Superlight 2 Wireless Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A13961814729458893212%2Cproductid%3A1024422853440126637%2CheadlineOfferDocid%3A1124036292273153889%2CimageDocid%3A10771816710962831766%2Crds%3APC_2127972044662208544%7CPROD_PC_2127972044662208544%2Cgpcid%3A2127972044662208544%2Cmid%3A576462802352796891%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=4e91589a-07ab-4710-87c4-84b8357a2e01&title=Logitech+G+PRO+X+Superlight+2+Wireless+Gaming+Mouse&store=unboxify&storeName=Unboxify
```

### Undiscovered Realm `(undiscovered-realm)`  · relay=Y

**Product**: Kombo Klash Board Game

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A17366953292304401055%2CheadlineOfferDocid%3A13235006722413402423%2CimageDocid%3A10894564207786434329%2Crds%3APC_7397265537062814646%7CPROD_PC_7397265537062814646%2Cgpcid%3A7397265537062814646%2Cmid%3A576462759102351855%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=8864be48-30b4-40c5-a8c1-b8e1d2fea82f&title=Kombo+Klash+Board+Game&store=undiscovered-realm&storeName=Undiscovered+Realm
```

### UpCircle Beauty `(upcircle-beauty)`  · relay=Y

**Product**: UpCircle The Pamper Kit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A8596268823840158202%2Cproductid%3A10397213170522434476%2CheadlineOfferDocid%3A6486376719477839401%2CimageDocid%3A9336245414699996933%2Crds%3APC_17068484540133029181%7CPROD_PC_17068484540133029181%2Cgpcid%3A17068484540133029181%2Cmid%3A576462415520888727%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=4d9ed727-7a36-41b8-a0b8-8058660648cd&title=UpCircle+The+Pamper+Kit&store=upcircle-beauty&storeName=UpCircle+Beauty
```

### Vedant Computers `(vedant-computers)`  · relay=Y

**Product**: Logitech G402 Hyperion Fury Gaming Mouse

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A17875674848854456001%2Cproductid%3A3938847360613310759%2CheadlineOfferDocid%3A647468597938663184%2Crds%3APC_11811376192648942678%7CPROD_PC_11811376192648942678%2Cgpcid%3A11811376192648942678%2Cmid%3A576462201777723403%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=5d610df2-35b2-4a72-b080-e2ba9ce97e83&title=Logitech+G402+Hyperion+Fury+Gaming+Mouse&store=vedant-computers&storeName=Vedant+Computers
```

### Velan Store `(velan-store)`  · relay=Y

**Product**: Nilkamal Multirack 04

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A2087311364147822938%2Cproductid%3A8521750355134365033%2CheadlineOfferDocid%3A10977736102647904354%2CimageDocid%3A2217939609395829227%2Cgpcid%3A14934625852951393566%2Cmid%3A576462877182557355%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=fd1581dd-e283-48a5-acf1-eeea2f859217&title=Nilkamal+Multirack+04&store=velan-store&storeName=Velan+Store
```

### vevor.de `(vevor-de)`  · relay=Y

**Product**: VEVOR Electric Crepe Maker 16-Inch Commercial Crepe Machine 3000W Flat Plate Crepe Griddle Nonstick Stainless Steel Pancake Making Machine Desktop

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances+deals%26prds%3Dcatalogid%3A1498478127520941617%2Cproductid%3A14572955026157126698%2CheadlineOfferDocid%3A11218692253018458280%2CimageDocid%3A12879230409720416036%2Crds%3APC_18440342212308623173%7CPROD_PC_18440342212308623173%2Cgpcid%3A18440342212308623173%2Cmid%3A576462869678338615%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=7964481d-2c18-4971-b5f1-7669395a1d09&title=VEVOR+Electric+Crepe+Maker+16-Inch+Commercial+Crepe+Machine+3000W+Flat+Plate+Crepe+Griddle+Nonstick+Stainless+Steel+Panc&store=vevor-de&storeName=vevor.de
```

### VHG Depot `(vhg-depot)`  · relay=Y

**Product**: MuscleBlaze Whey Protein

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A15389899245073863397%2Cproductid%3A10937917667611117353%2CheadlineOfferDocid%3A14879899684827210069%2CimageDocid%3A7859470321809335746%2Crds%3APC_782975520888756101%7CPROD_PC_782975520888756101%2Cgpcid%3A782975520888756101%2Cmid%3A576462547131805625%2Cpvt%3Aa%26hl%3Den%26gl%3Din%26udm%3D28&id=bee31be3-07e7-4f44-a082-346cf24c674b&title=MuscleBlaze+Whey+Protein&store=vhg-depot&storeName=VHG+Depot
```

### Vibrant Health `(vibrant-health)`  · relay=Y

**Product**: Vibrant Health Green Vibrance

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A12005236390688930290%2Cproductid%3A17059041157374729265%2CheadlineOfferDocid%3A1805871107660387010%2CimageDocid%3A17242538380317866802%2Crds%3APC_17734711889073105343%7CPROD_PC_17734711889073105343%2Cgpcid%3A17734711889073105343%2Cmid%3A576462862109871542%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7525743f-2d7f-4e3b-bc04-351b8b0f85ca&title=Vibrant+Health+Green+Vibrance&store=vibrant-health&storeName=Vibrant+Health
```

### Victoria Health `(victoria-health)`  · relay=Y

**Product**: NEOM Wellbeing Discovery Collection

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A2995041844082714092%2Cproductid%3A1157743138754917517%2CheadlineOfferDocid%3A12355227608441611308%2CimageDocid%3A12216065244572896680%2Crds%3APC_10779626686570245301%7CPROD_PC_10779626686570245301%2Cgpcid%3A10779626686570245301%2Cmid%3A576462866444252470%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=e3b9f225-c184-4977-9d35-6e5299cdf24b&title=NEOM+Wellbeing+Discovery+Collection&store=victoria-health&storeName=Victoria+Health
```

### Virgin Megastore `(virgin-megastore)`  · relay=Y

**Product**: Logitech - G 910-005292 G305 LIGHTSPEED Wireless Gaming Mouse White

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dproductid%3A552663720157552051%2CheadlineOfferDocid%3A552663720157552051%2CimageDocid%3A1186179790032370890%26hl%3Den%26gl%3Dae%26udm%3D28&id=875e4c4a-b154-4a32-89b3-cb8bcb214465&title=Logitech+-+G+910-005292+G305+LIGHTSPEED+Wireless+Gaming+Mouse+White&store=virgin-megastore&storeName=Virgin+Megastore
```

### vlebazaar.in `(vlebazaar-in)`  · relay=Y

**Product**: Razer BlackShark V2 X Wired Gaming Headset

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A14735872107795826900%2Cproductid%3A11233892800257173807%2CheadlineOfferDocid%3A6885938078362569697%2CimageDocid%3A8453087170640607871%2Crds%3APC_15266292039849992860%7CPROD_PC_15266292039849992860%2Cgpcid%3A15266292039849992860%2Cmid%3A576462492324472067%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=a72c3af5-9f2c-4dc9-a8d9-0d36942cdd7d&title=Razer+BlackShark+V2+X+Wired+Gaming+Headset&store=vlebazaar-in&storeName=vlebazaar.in
```

### vplak.com `(vplak)`  · relay=Y

**Product**: Edifier R1080BT Bookshelf Speaker

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A7942100855026761642%2Cproductid%3A16767584672536436820%2CheadlineOfferDocid%3A13441990056244573105%2CimageDocid%3A12696821303347341880%2Crds%3APC_1622728339305838895%7CPROD_PC_1622728339305838895%2Cgpcid%3A1622728339305838895%2Cmid%3A576462375740993535%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=b476a0cd-5cae-406b-b6f9-445b6ec5d97a&title=Edifier+R1080BT+Bookshelf+Speaker&store=vplak&storeName=vplak.com
```

### Walgreens.com `(walgreens)`  · relay=Y

**Product**: C4 Sport Pre-Workout

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A1996298187960404984%2CheadlineOfferDocid%3A17816841175902349735%2CimageDocid%3A12103760661394132493%2Crds%3APC_2236620701941878207%7CPROD_PC_2236620701941878207%2Cgpcid%3A2236620701941878207%2Cmid%3A576462853137745159%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=d8ddaf6c-381f-446c-b347-efef28db133e&title=C4+Sport+Pre-Workout&store=walgreens&storeName=Walgreens.com
```

### Wallis UK `(wallis-uk)`  · relay=Y

**Product**: Warehouse Women's Tony Chiffon Cowl Button Wrap Midi Slip Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A8166704337486681493%2Cproductid%3A12565787532276093623%2CheadlineOfferDocid%3A137659872876191067%2CimageDocid%3A10113426023232890406%2Cgpcid%3A3692228439542805171%2Cmid%3A576462848416825003%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=25631289-f8e3-4db7-82be-f2dd97087b86&title=Warehouse+Women%27s+Tony+Chiffon+Cowl+Button+Wrap+Midi+Slip+Dress&store=wallis-uk&storeName=Wallis+UK
```

### Walts TV `(walts-tv)`  · relay=Y

**Product**: LG Class C4 Series OLED evo 4K Smart TV

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLG+OLED+55+deals%26prds%3Dcatalogid%3A15285391031948836255%2Cproductid%3A18219781071430356252%2CheadlineOfferDocid%3A2624641835277335181%2CimageDocid%3A2434967787014146419%2Crds%3APC_3935247127141754119%7CPROD_PC_3935247127141754119%2Cgpcid%3A3935247127141754119%2Cmid%3A576462846914702725%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1753b37c-ba87-44ad-a598-c080e6d7543a&title=LG+Class+C4+Series+OLED+evo+4K+Smart+TV&store=walts-tv&storeName=Walts+TV
```

### Warehouse Fashion `(warehouse-fashion)`  · relay=Y

**Product**: Warehouse Women's Printed Ruffle Detail Belted Maxi Dress

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A5364460045466837316%2Cproductid%3A8868593988722906468%2CheadlineOfferDocid%3A12629241689087170975%2CimageDocid%3A16678564901208301431%2Cgpcid%3A9645992332502472645%2Cmid%3A576462883182431655%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=b37d33fd-4d74-4c93-ab5c-f0fa29519b51&title=Warehouse+Women%27s+Printed+Ruffle+Detail+Belted+Maxi+Dress&store=warehouse-fashion&storeName=Warehouse+Fashion
```

### Watsons UAE `(watsons-uae)`  · relay=Y

**Product**: Armaf Beaute Parfaite Fix Compact Powder

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A15117887430928734821%2Cproductid%3A17507473152089873155%2CheadlineOfferDocid%3A7847845999157756182%2CimageDocid%3A15062037004152713627%2Cgpcid%3A17910030236658833391%2Cmid%3A576462775994861616%2Cpvt%3Ahg%26hl%3Den%26gl%3Dae%26udm%3D28&id=cd57cc6f-3896-4348-bbef-9e978a8d59bc&title=Armaf+Beaute+Parfaite+Fix+Compact+Powder&store=watsons-uae&storeName=Watsons+UAE
```

### Wellbeing Nutrition `(wellbeing-nutrition)`  · relay=Y

**Product**: Essential Vitamins | Wellbeing Nutrition

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dproductid%3A10877137180401801256%2CheadlineOfferDocid%3A10877137180401801256%2CimageDocid%3A9001863559580186111%2Crds%3APC_5494590746724671214%7CPROD_PC_5494590746724671214%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=b29aa1f7-7724-4bf1-b9cd-f7cc3d9fcaf4&title=Essential+Vitamins+%7C+Wellbeing+Nutrition&store=wellbeing-nutrition&storeName=Wellbeing+Nutrition
```

### Wellness Warehouse `(wellness-warehouse)`  · relay=Y

**Product**: Nutriburst GreenVita Gummies

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth+%26+Wellness+deals%26prds%3Dcatalogid%3A2742064933974173701%2Cproductid%3A12225183433472390974%2CheadlineOfferDocid%3A805965238028183629%2CimageDocid%3A2811493488181652985%2Crds%3APC_1982441854429512573%7CPROD_PC_1982441854429512573%2Cgpcid%3A1982441854429512573%2Cmid%3A576462772214228125%2Cpvt%3Ahg%26hl%3Den%26gl%3Dza%26udm%3D28&id=8c5156e7-d041-4125-ac88-ab6289483406&title=Nutriburst+GreenVita+Gummies&store=wellness-warehouse&storeName=Wellness+Warehouse
```

### westwing.co.uk `(westwing)`  · relay=Y

**Product**: Le Creuset Cast Iron Signature Round Casserole

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLe+Creuset+Dutch+Oven+deals%26prds%3Dcatalogid%3A2371114436415998687%2Cproductid%3A245532087686898797%2CheadlineOfferDocid%3A1098954949760167135%2CimageDocid%3A8020402740979832005%2Crds%3APC_16321604771448613767%7CPROD_PC_16321604771448613767%2Cgpcid%3A16321604771448613767%2Cmid%3A576462857384948781%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=6dc911f9-b09a-4cdc-a5f9-4947cf1d857c&title=Le+Creuset+Cast+Iron+Signature+Round+Casserole&store=westwing&storeName=westwing.co.uk
```

### Wetsuit Outlet DE `(wetsuit-outlet-de)`  · relay=Y

**Product**: 2026 Zhik Womens Performance Unisuit

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A9740838184219705806%2Cproductid%3A15668062299586601308%2CheadlineOfferDocid%3A11949543752324681368%2CimageDocid%3A1998510324197421108%2Cgpcid%3A14402042685998898170%2Cmid%3A576462511258321764%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=843fdd30-42b4-472e-9b1e-ba2476069bee&title=2026+Zhik+Womens+Performance+Unisuit&store=wetsuit-outlet-de&storeName=Wetsuit+Outlet+DE
```

### Williams-Sonoma `(williams-sonoma)`  · relay=Y

**Product**: KitchenAid Artisan Stand Mixer, White/Silver

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A17848090607584230034%2CheadlineOfferDocid%3A17848090607584230034%2CimageDocid%3A918103193066513522%2Crds%3APC_44297843990613121%7CPROD_PC_44297843990613121%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=9285fa6f-1d8c-4d04-975e-b07673b28ffd&title=KitchenAid+Artisan+Stand+Mixer%2C+White%2FSilver&store=williams-sonoma&storeName=Williams-Sonoma
```

### Wilson EMEA - United Kingdom `(wilson-emea-united-kingdom)`  · relay=Y

**Product**: Basketball Wilson NBA Team Tribute

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A12708485757844465087%2Cproductid%3A9070269494273612386%2CheadlineOfferDocid%3A5673828791927629526%2CimageDocid%3A3706866651780158325%2Crds%3APC_12323435941276979646%7CPROD_PC_12323435941276979646%2Cgpcid%3A12323435941276979646%2Cmid%3A576462471911574845%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=bd778786-d4d5-4d61-88c1-806d69f7ece9&title=Basketball+Wilson+NBA+Team+Tribute&store=wilson-emea-united-kingdom&storeName=Wilson+EMEA+-+United+Kingdom
```

### Wireless Place `(wireless-place)`  · relay=Y

**Product**: Xiaomi Redmi Note 14 5G

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DRedmi+Note+14+deals%26prds%3Dcatalogid%3A9944052762543411233%2Cproductid%3A3171798627941559446%2CheadlineOfferDocid%3A5899436346022726792%2CimageDocid%3A12354358794882333857%2Crds%3APC_5097346086465045637%7CPROD_PC_5097346086465045637%2Cgpcid%3A5097346086465045637%2Cmid%3A576462859071458075%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=7ba0f97e-dacd-4299-8e7e-40e589d94806&title=Xiaomi+Redmi+Note+14+5G&store=wireless-place&storeName=Wireless+Place
```

### wmf.com/de `(wmf-com-de)`  · relay=Y

**Product**: WMF Gewürzmühle unbefüllt Trend

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A7312326099274180959%2Cproductid%3A15798253932546434840%2CheadlineOfferDocid%3A8259532553225748673%2CimageDocid%3A121795648904058989%2Crds%3APC_16333181257260642572%7CPROD_PC_16333181257260642572%2Cgpcid%3A16333181257260642572%2Cmid%3A576462569835041847%2Cpvt%3Ahg%26hl%3Den%26gl%3Dde%26udm%3D28&id=eb16f91b-4e43-4384-b820-ac30591c06d8&title=WMF+Gew%C3%BCrzm%C3%BChle+unbef%C3%BCllt+Trend&store=wmf-com-de&storeName=wmf.com%2Fde
```

### Wonderprice UK `(wonderprice-uk)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPixel+9+Pro+deals%26prds%3Dcatalogid%3A9751887620211534567%2Cproductid%3A11521029214368081601%2CheadlineOfferDocid%3A4338838580030669416%2CimageDocid%3A9793232124224600494%2Crds%3APC_7289913198085316365%7CPROD_PC_7289913198085316365%2Cgpcid%3A7289913198085316365%2Cmid%3A576462491484046598%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=a7035432-f453-4ecb-9f5e-65ebd360e26a&title=Google+Pixel+9&store=wonderprice-uk&storeName=Wonderprice+UK
```

### xbox.com `(xbox)`  · relay=Y

**Product**: Need for Speed Heat

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A13604377435714353462%2Cproductid%3A12401511828350709809%2CheadlineOfferDocid%3A1004334121974468737%2CimageDocid%3A6011603719810949613%2Crds%3APC_6747337638306802913%7CPROD_PC_6747337638306802913%2Cgpcid%3A6747337638306802913%2Cmid%3A576462400360437741%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=5fd21460-74c8-4175-8627-cc213710a24e&title=Need+for+Speed+Heat&store=xbox&storeName=xbox.com
```

### Xdeal.co.uk `(xdeal)`  · relay=Y

**Product**: Google Pixel 9

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPixel+9+Pro+deals%26prds%3Dcatalogid%3A1223894968358361811%2Cproductid%3A3169493622304101373%2CheadlineOfferDocid%3A11916620515354655522%2CimageDocid%3A16866156205424243605%2Crds%3APC_13461510371567660278%7CPROD_PC_13461510371567660278%2Cgpcid%3A13461510371567660278%2Cmid%3A576462517157938750%2Cpvt%3Ahg%26hl%3Den%26gl%3Duk%26udm%3D28&id=6a5726ee-51d4-45ef-b50f-741873f7dfbe&title=Google+Pixel+9&store=xdeal&storeName=Xdeal.co.uk
```

### Yami `(yami)`  · relay=Y

**Product**: UFORU Kitchen Gadget 6-Piece Set【White】Fruit Peeler Melon Scraper Scissors Fruit Knife Bottle Opener Whisk Storage

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dproductid%3A3449228298318614553%2CheadlineOfferDocid%3A3449228298318614553%2CimageDocid%3A1277563429242507282%2Crds%3APC_8572994899605645948%7CPROD_PC_8572994899605645948%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=e1f04779-f92e-4af7-933b-368168a48a71&title=UFORU+Kitchen+Gadget+6-Piece+Set%E3%80%90White%E3%80%91Fruit+Peeler+Melon+Scraper+Scissors+Fruit+Knife+Bottle+Opener+Whisk+Storage&store=yami&storeName=Yami
```

### YesStyle.com `(yesstyle)`  · relay=Y

**Product**: HOLIKA HOLIKA My Fave Piece Shadow #14 Wisteria Bundle Set 2 Pcs

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dproductid%3A15270927258169438601%2CheadlineOfferDocid%3A15270927258169438601%2CimageDocid%3A2295542524722265553%2Crds%3APC_3580877137911550738%7CPROD_PC_3580877137911550738%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=2147a1bb-ed72-4b3f-94d5-683134b035c2&title=HOLIKA+HOLIKA+My+Fave+Piece+Shadow+%2314+Wisteria+Bundle+Set+2+Pcs&store=yesstyle&storeName=YesStyle.com
```

### YSL Beauty US `(ysl-beauty-us)`  · relay=Y

**Product**: Saint Laurent Loveshine Plumping Lip Oil Gloss

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty+deals%26prds%3Dcatalogid%3A10393326736074206275%2Cproductid%3A9458231197128565135%2CheadlineOfferDocid%3A1476694501512035571%2CimageDocid%3A4002142453154122833%2Crds%3APC_11779342948258063644%7CPROD_PC_11779342948258063644%2Cgpcid%3A11779342948258063644%2Cmid%3A576462839581803249%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=c6b8544c-90f5-4f90-9e48-449fe5110218&title=Saint+Laurent+Loveshine+Plumping+Lip+Oil+Gloss&store=ysl-beauty-us&storeName=YSL+Beauty+US
```

### Zappos.com `(zappos)`  · relay=Y

**Product**: Under Armour Women's Charged Surge 4 Running Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A15068731272891220597%2Cproductid%3A8879758772473163221%2CheadlineOfferDocid%3A7520584869231853475%2CimageDocid%3A12256463682074717824%2Crds%3APC_6985948704958240977%7CPROD_PC_6985948704958240977%2Cgpcid%3A6985948704958240977%2Cmid%3A576462770256932538%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=0e8416b5-4bf8-43ca-95fe-25af64e7a504&title=Under+Armour+Women%27s+Charged+Surge+4+Running+Shoes&store=zappos&storeName=Zappos.com
```

### Zara UK `(zara-uk)`  · relay=Y

**Product**: LILO & STITCH DISNEY SWEATSHIRT AND TROUSERS SET

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion+deals%26prds%3Dcatalogid%3A603455105907330484%2Cproductid%3A3267820376291713917%2CheadlineOfferDocid%3A12696187806132388966%2CimageDocid%3A11686831845171461297%2Cgpcid%3A16111484504376603652%2Cpvt%3Aa%26hl%3Den%26gl%3Duk%26udm%3D28&id=9937b20d-2317-499c-a8c8-22c82af36daa&title=LILO+%26+STITCH+DISNEY+SWEATSHIRT+AND+TROUSERS+SET&store=zara-uk&storeName=Zara+UK
```

### Zebrs `(zebrs)`  · relay=Y

**Product**: Auto Clean Curved Glass Filter-less Kitchen Chimney Motion Sensor control with Digital Display 1500 m3/h

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome+%26+Kitchen+deals%26prds%3Dcatalogid%3A17369069808861934679%2Cproductid%3A15833648315622721275%2CheadlineOfferDocid%3A13812406042535636337%2CimageDocid%3A11350465590546627269%2Cgpcid%3A5195487056818537304%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=c6013731-a846-4512-b19e-b4d6d84f4094&title=Auto+Clean+Curved+Glass+Filter-less+Kitchen+Chimney+Motion+Sensor+control+with+Digital+Display+1500+m3%2Fh&store=zebrs&storeName=Zebrs
```

### Zepto `(zepto)`  · relay=Y

**Product**: Sony PlayStation 5 Standard Console with Fortnite Bundle

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming+deals%26prds%3Dcatalogid%3A17067729750822706019%2Cproductid%3A13407301332087714741%2CheadlineOfferDocid%3A18171291052714937669%2CimageDocid%3A10789715233745871436%2Cgpcid%3A8093197763702024621%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=2d981acc-fc34-46c4-ac7b-61d04a84a350&title=Sony+PlayStation+5+Standard+Console+with+Fortnite+Bundle&store=zepto&storeName=Zepto
```

### Zoot Sports Europe `(zoot-sports-europe)`  · relay=Y

**Product**: Mens Zoot Sports LTD Cycle Bib

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports+deals%26prds%3Dcatalogid%3A8911312911430211268%2Cproductid%3A4211009137016896731%2CheadlineOfferDocid%3A7644917778709056973%2CimageDocid%3A11019545990030043969%2Cgpcid%3A17506138444287522692%2Cmid%3A576462821609384617%2Cpvt%3Aa%26hl%3Den%26gl%3Dde%26udm%3D28&id=1fc45281-8b3c-4148-90b1-589296279753&title=Mens+Zoot+Sports+LTD+Cycle+Bib&store=zoot-sports-europe&storeName=Zoot+Sports+Europe
```

### Zop `(zop)`  · relay=Y

**Product**: Get Tecsox Stone 351 Bluetooth Speaker with 6 Hour Paytime, Blue

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dproductid%3A11647258696223834114%2CheadlineOfferDocid%3A11647258696223834114%2CimageDocid%3A5485136867370675838%2Cpvt%3Ahg%26hl%3Den%26gl%3Din%26udm%3D28&id=4dee9f6e-421d-42a0-a6a1-e0f7db905ce2&title=Get+Tecsox+Stone+351+Bluetooth+Speaker+with+6+Hour+Paytime%2C+Blue&store=zop&storeName=Zop
```

### Zumiez `(zumiez)`  · relay=Y

**Product**: adidas Samba OG Core Black & Wonder White Shoes

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAdidas+Samba+OG%26prds%3Dproductid%3A1299156392041451994%2CheadlineOfferDocid%3A1299156392041451994%2CimageDocid%3A935550198379486340%2Crds%3APC_3975930094037604267%7CPROD_PC_3975930094037604267%2Cpvt%3Aa%26hl%3Den%26gl%3Dus%26udm%3D28&id=910b402b-4f06-447d-ae0e-9ce6a15fbaf7&title=adidas+Samba+OG+Core+Black+%26+Wonder+White+Shoes&store=zumiez&storeName=Zumiez
```

### zZounds `(zzounds)`  · relay=Y

**Product**: Focal Bathys Wireless Noise Cancelling Headphones

**Click URL**:

```
https://havlo.io/api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio+deals%26prds%3Dcatalogid%3A16743184905559977506%2Cproductid%3A9932493469861266051%2CheadlineOfferDocid%3A5676821469734454643%2CimageDocid%3A13559422316058840793%2Crds%3APC_839733203454993266%7CPROD_PC_839733203454993266%2Cgpcid%3A839733203454993266%2Cmid%3A576462758971089285%2Cpvt%3Ahg%26hl%3Den%26gl%3Dus%26udm%3D28&id=1265055d-8f71-4ec0-9d02-561ec20b2b19&title=Focal+Bathys+Wireless+Noise+Cancelling+Headphones&store=zzounds&storeName=zZounds
```


---

# Geo-mismatch flags (informational, not resolver bugs)

Stores whose `stores.country` tag doesn't match the dominant country indicator in their offer URLs / display name. These are **data-cleanup candidates**, not resolver bugs — the resolver itself still works correctly for these rows. The audit agent should still test them but record a `geo-mismatch` note in the verdict so we can backfill the country tag in a separate pass.

# Geo-mismatch candidates

Stores whose `stores.country` tag doesn't match the dominant country indicator in their offer URLs / display name. The resolver still works for these — the country tag is a separate /deals-filtering concern.

| storeId | storeName | tagged | inferred | sample URL |
|---|---|---|---|---|
| `essenza` | Essenza | Cross-border | NG | https://www.essenza.ng/products/black-up-fdt-creme-haute-couvrance |
| `vlebazaar-in` | vlebazaar.in | Cross-border | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming%20d |
| `desertcart-in` | desertcart.in | Cross-border | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPhones%20d |
| `tink-de` | tink.de | Cross-border | DE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DElectronic |
| `evetech` | Evetech.co.za | Cross-border | ZA | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming%20d |
| `box` | box.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming%20d |
| `mdcomputers-in` | mdcomputers.in | Cross-border | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming%20d |
| `adidas` | adidas.co.in | US | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports%20d |
| `shop-preethi-in` | shop.preethi.in | Cross-border | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome%20%26 |
| `onedayonly` | OneDayOnly.co.za | Cross-border | ZA | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome%20%26 |
| `decure-in` | Decure.in | Cross-border | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome%20%26 |
| `geekom` | geekom.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing% |
| `jumbo-ae` | Jumbo.ae | Cross-border | AE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming%20d |
| `hood-de-hood-feed` | Hood.de - Hood Feed | Cross-border | DE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming%20d |
| `vevor-de` | vevor.de | Cross-border | DE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome%20%26 |
| `scan` | Scan.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing% |
| `notino` | Notino.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty%20d |
| `thomann-de` | thomann.de | Cross-border | DE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio%20de |
| `justnatural` | JustNatural.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHealth%20% |
| `boozt-de` | Boozt.de | UK | DE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion%20 |
| `asomanutritions-in` | asomanutritions.in | Cross-border | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports%20d |
| `amazon-co-za-seller` | Amazon.co.za - Seller | Cross-border | ZA | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome%20%26 |
| `4home` | 4Home.co.za | Cross-border | ZA | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DHome%20%26 |
| `xdeal` | Xdeal.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DPixel%209% |
| `kccomputers` | kccomputers.co.in | Cross-border | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming%20d |
| `optimaindia-in` | optimaindia.in | Cross-border | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming%20d |
| `peacocks` | peacocks.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion%20 |
| `sephora-de` | Sephora.de | US | DE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty%20d |
| `aldoshoes` | aldoshoes.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion%20 |
| `westwing` | westwing.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DLe%20Creus |
| `pcstudio-in` | pcstudio.in | Cross-border | IN | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DGaming%20d |
| `brandzz` | Brandzz.co.za | Cross-border | ZA | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion%20 |
| `runners-ae` | runners.ae | Cross-border | AE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports%20d |
| `nike-ae` | Nike.ae | US | AE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports%20d |
| `firstshop` | FirstShop.co.za | Cross-border | ZA | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DComputing% |
| `thomann` | thomann.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAudio%20de |
| `tennis-point` | Tennis-Point.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DFashion%20 |
| `ramas` | ramas.co.za | Cross-border | ZA | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DAppliances |
| `footlocker` | Footlocker.co.uk | Cross-border | UK | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DSports%20d |
| `retailbox` | retailbox.co.za | Cross-border | ZA | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty%20d |
| `bio-naturel-de` | bio-naturel.de | Cross-border | DE | /api/go?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fibp%3Doshop%26q%3DBeauty%20d |

---

# Verification agent prompt

> Paste the section below into Claude in Chrome (or any
> browser-capable AI agent). Use the focused subset from
> `docs/merchant-resolver-audit-targets.json` to limit SerpAPI
> credit burn — 38 rows, ~28 credits. Going beyond that to the
> full 160 merchants would cost ~120 SerpAPI credits.

## Agent prompt (copy from here)

You are a QA agent verifying Havlo's outbound resolver end-to-end.
Each row in `docs/merchant-resolver-audit-targets.json` carries a
real product the merchant actually sells and the exact `/api/go`
URL Havlo redirects through when a user clicks "View at {Merchant}"
on the PDP. Your job is to click each URL and record where the
redirect chain actually lands.

### What this audits — priorities

1. **Best outcome (`pdp-ok`)** — the click lands on the merchant's
   real product detail page for the SAME product in the row's
   `title` field. URL bar shows `/products/<slug>` or `/dp/<asin>`
   etc., page shows the product image and price.

2. **Acceptable fallback (`search-ok`)** — for relay=Y rows,
   when SerpAPI can't resolve to a direct PDP, Havlo redirects
   to the merchant's search page with the title pre-filled. If
   the search returns plausible results for the product, that's
   `search-ok`.

3. **Anything else is a bug**. Detailed verdict list below.

### Procedure

Load `docs/merchant-resolver-audit-targets.json`. The `targets`
array has 38 rows. For each row:

1. Open `target.clickUrl` in a fresh browser tab. Real Chrome
   window, NOT headless — most merchants run Cloudflare or Akamai
   bot defences.

2. Wait 5-10s for the redirect chain to settle. The chain may go
   `havlo.io/api/go → google.com/search → merchant.com/product/...`
   (for relay=Y rows) or simply `havlo.io/api/go → merchant.com/...`
   (for relay=N rows).

3. Classify the final destination:

   - **`pdp-ok`** — Right merchant's PDP for the exact product
     in the row. Best outcome.
   - **`pdp-different-product`** — Right merchant's PDP but
     different product. Notes: actual product title.
   - **`pdp-wrong-merchant`** — Wrong merchant entirely. Notes:
     actual merchant. This is the most serious bug class.
   - **`search-ok`** — Right merchant's search page with
     relevant results for the title.
   - **`search-empty`** — Right merchant's search page, 0
     results.
   - **`search-irrelevant`** — Right merchant's search page,
     unrelated results.
   - **`homepage`** — Merchant homepage, no search performed.
   - **`havlo-recovery`** — Bounced back to a Havlo `/compare`
     or `/deals` page.
   - **`404`** / **`wrong-domain`** — Stale or broken URL.
   - **`cloudflare-block`** / **`other-block`** — Anti-bot
     interstitial. URL might be correct; this audit context
     can't verify.

4. **Geo-mismatch note**: if this storeId appears in the
   "Geo-mismatch flags" section above, add `geo-mismatch:
   tagged-X-but-actually-Y` to the Notes column. The verdict
   itself isn't affected — the resolver still tested correctly.
   This note feeds a separate data-cleanup pass.

### Report format

A single markdown table:

```
| Country | Store ID | Verdict | Final URL | Notes |
```

Then a summary section listing:
- Verdict counts (pdp-ok, search-ok, the bad ones, blocks)
- Top 3 failure patterns observed (e.g. "5 of 10 UK relay=Y
  rows returned `pdp-wrong-merchant`")
- All `geo-mismatch` rows grouped together

### Constraints

- Stay in incognito / private mode.
- No login, no cart, no personal info entered.
- relay=Y rows trigger SerpAPI lookups (1 credit each, already
  budgeted) — be patient with the redirect chain.
- If you have access to Havlo's `click_resolutions` telemetry
  table (Supabase), record the `resolution_step` and
  `resolved_url` for each click alongside your browser
  observation. The combination tells us EXACTLY which fallback
  branch fired plus where the user ended up.

### What to report back

The table above, plus answer these three questions:

1. **PDP-ok rate**: what percent of clicks landed on the correct
   PDP for the exact product?
2. **Wrong-merchant rate** (`pdp-wrong-merchant`): how often did
   the resolver pick the wrong merchant on a relay=Y row?
3. **Fallback quality**: when SerpAPI failed (no PDP returned),
   did the `merchant_search` fallback at least land on the right
   merchant's search page?

---

# After the audit — engineering follow-up

For every failed click I'll:
1. Pull the row from `click_resolutions` keyed on `offer_id` (in
   the `&id=` param of each Click URL) to see which resolution
   step fired.
2. Group failures by pattern: `pdp-wrong-merchant` for relay=Y →
   tighten the hostname-verify guard. `search-empty` → fix the
   merchant's search URL pattern in
   `src/lib/merchant-search-urls.ts`. `homepage` → URL pattern is
   broken at the path level.
3. Ship the fixes in a batched edit to
   `src/lib/merchant-search-urls.ts` + the SerpAPI hostname
   verification logic.

For the geo-mismatched rows (separate concern):
4. Backfill `stores.country` via a service-role SQL UPDATE.
