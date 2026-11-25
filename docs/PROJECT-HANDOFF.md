# Top Pocket Find — project handoff
Updated 2026-11-25. Read this before continuing work. This handoff preserves decisions from the product-listing chat; confirm current source and stock before future edits.

## Regina photographs and packaging (2026-11-25)
- Rick approved replacing the generated previews with his original photographs and removing AI/edited-preview/black-and-white labels. Both gallery images now show actual photographed detail, with only case-corner straightening/cropping using bicubic interpolation. Rick subsequently preferred both sides in black and white; the reverse now uses his own earlier greyscale upload (151356), not generated artwork. No generative imagery is used on this listing or homepage card.
- The portrait supplied by Rick is already greyscale; do not invent colour for it. Both sides now use Rick’s original greyscale photographs. Keep the simple photo wording; do not add black-and-white or AI labels. The older colour reverse and its untouched source remain in the repository as alternatives.
- Current assets: assets/product-007/01-regina-reverse-bw-photo.png (560×560) and 02-elizabeth-portrait-photo.png (400×400). Untouched uploads are retained as source-reverse-bw-original.png, source-reverse-original.png and source-portrait-original.png in the same directory. Gallery, thumbnails, zoom, homepage and catalog use the processed photographs. Obsolete generated preview assets are removed.
- Photo wording: “Photos show both sides of the coin in its protective case.” No condition grade or condition claim is inferred from the photographs.
- Rick decided to leave the outer sleeve out of the offer because one is missing. The Regina listing promises one coin in its protective case; no sleeve is promised or pictured. The other nine upcoming listings have not been edited in this change.
- Regina remains coming-soon, price null, quantity 0 and purchasable false. Final price/condition/finish review and explicit stock activation remain outstanding.

## Coming-soon coin listings (2026-11-23)
- Rick authorized ten upcoming single silver-dollar listings: 1982–1988, 1992, 1993, 1996. Rick reviewed and approved the 1982 layout, then authorized completing the remaining nine together. All ten stay unavailable to purchase pending final photo, condition and price review.
- `coin-007`, `products/1982-regina-centennial-silver-dollar.html`: 1982 Regina Centennial. Quantity 0, status `coming-soon`, `purchasable: false`, price not set (`null`). Protective case included; no outer sleeve promised and no condition grade. Original photographs are published; detailed condition and price review remain outstanding before activation.
- The Royal Canadian Mint archive currently shows this issue at a mismatched historical URL (`$1---sterling-silver-coin-international-year-of-older-persons-1999`), product number 1210. The actual rendered title is Regina Centennial (1982). No product photo is available there; Rick initially approved a text placeholder, now replaced by his own photographs. Never label a placeholder as a Mint image or an actual-item photo.
- The Mint archive's weight field appears inconsistent (36.07 g); omit weight and diameter until checked against packaging or reliable corroboration. Proof issue specifications are provisional until the actual coin is reviewed.
- Future activation requires reviewing photos, condition, finish, price, then updating catalog status/purchasable/quantity and explicitly setting production stock. A backend stock value alone cannot make coming-soon products purchasable.
- Production stock read before this change: coin-001/002/003/005 = 3 each; coin-004/006 = 1 each; legacy 220025 = 0. Do not reset these quantities.

## Remaining nine previews (2026-11-23)
All use the approved 1982 layout: quantity 0, `coming-soon`, `purchasable: false`, price `null`, unopened with original sleeve, no numerical grade. The nine Mint archive pages were checked and provide no usable product image; use the approved text placeholders. Replace them with actual-item photos when available. Do not silently substitute dealer photos or artwork.

| ID | Issue | Composition | Proof issue mintage | Source |
|---|---|---|---:|---|
| coin-008 | 1983 World University Games | 50% silver, 50% copper | 340,068 | [Mint archive](https://www.mint.ca/en/shop/coins/pre-2010/$1---world-university-games-1983) |
| coin-009 | 1984 Toronto 150th Anniversary | 50% silver, 50% copper | 571,563 | [Mint archive](https://www.mint.ca/en/shop/coins/pre-2010/$1---silver-coin-toronto-sesquicentennial-1984) |
| coin-010 | 1985 National Parks Centennial | 50% silver, 50% copper | 537,297 | [Mint archive](https://www.mint.ca/en/shop/coins/pre-2010/$1---silver-coin-henry-kelsey-tricentennial-1990) |
| coin-011 | 1986 Vancouver Centennial | 50% silver, 50% copper | 496,418 | [Mint archive](https://www.mint.ca/en/shop/coins/pre-2010/$1---silver-coin-vancouver-centennial-1986) |
| coin-012 | 1987 John Davis | 50% silver, 50% copper | 405,688 | [Mint archive](https://www.mint.ca/en-us/shopping/archives/pre-2010/$1---silver-coin-national-parks-centennial-1985) |
| coin-013 | 1988 Saint-Maurice Ironworks | 50% silver, 50% copper | 259,230 | [Mint archive](https://www.mint.ca/en-us/shopping/archives/pre-2010/$1---silver-coin-saint-maurice-ironworks-1988) |
| coin-014 | 1992 Kingston to York Stagecoach | 92.5% silver, 7.5% copper | 187,612 | [Mint archive](https://www.mint.ca/en/shop/coins/pre-2010/$1---sterling-silver-coin-kingston-to-york-stagecoach-1992) |
| coin-015 | 1993 Stanley Cup Centennial | 92.5% silver, 7.5% copper | 294,314 | [Mint archive](https://www.mint.ca/en/shop/coins/pre-2010/$1---sterling-silver-coin-100th-anniversary-of-the-stanley-cup-1993) |
| coin-016 | 1996 John McIntosh | 92.5% silver, 7.5% copper | 133,779 | [Mint archive](https://www.mint.ca/en/shop/coins/pre-2010/$1---sterling-silver-coin-the-200th-anniversary-of-john-mcintosh-1996) |

Specifications describe the Mint's proof issues; verify the actual items' finishes before activation. Omit weight and diameter because the Mint archives repeat an inconsistent weight field. The 1985 and 1987 URLs have unrelated historical slugs: their rendered titles and product numbers were checked (National Parks Centennial, 1201; John Davis, 1200). The 1988 source misspells one engraver's name; list confirmed designer R.R. Carmichael only for now.
The original six entries and their live quantities were preserved. The 1982 listing remains unchanged.

## Current position
Six reviewed coin listings and ten coming-soon silver-dollar previews are published at https://www.toppocketfind.ca/.
GitHub: slickr98/toppocketfind, main. GitHub Pages frontend; Flask backend on Render at https://tpf-api.onrender.com. Preserve existing hosting and design.

## Anonymous traffic reporting (2026-11-23)
- Rick approved connecting the YouTube-inspired `/track/` dashboard to real anonymous aggregate counts, with no tracking cookies, identifiers or fingerprinting. See [ANALYTICS.md](ANALYTICS.md) for counting rules, configuration, campaign links and reporting queries.
- Dashboard is private through server-verified access codes/tokens. The public static shell contains no statistics. All synthetic figures were removed. Page views include reloads; do not call them unique visitors or sessions.
- Counts: page views, listing clicks, per-product views and approved ad labels. The optional own-browser exclusion is remembered as a boolean preference. Signing in excludes that browser by default. Reports use Atlantic time and refresh manually/on filters.
- Anonymous counters use a separate `tpf_analytics` schema in the existing production database. Inventory, reservations, checkout, Stripe configuration and plans are unchanged. Use production records when Rick asks for daily/weekly totals; never fabricate missing past history.
- The access code is private and was supplied directly to Rick; no credential is stored in source/docs. Only its hash and token-signing secret are configured in Render. Rotate through a scoped Render environment merge if necessary.
- Anne of Green Gables free-coin promo is still an idea pending a stock count. No promotion or ad was posted. Coin photos, final listing review/prices and activation remain outstanding.

## Inventory snapshot (verified source and production database 2026-11-16)
Prices CAD; shipping included within Canada.
| ID | Product | Price | Purchasable units available |
|---|---|---:|---:|
| coin-001 | 2013 Santa | 54.95 | 3 single coins |
| coin-002 | 2013 Iceberg and Whale | 54.95 | 3 single coins |
| coin-003 | 2013 Hockey | 54.95 | 3 single coins |
| coin-004 | 2011 Maple Leaf, unopened packaging | 54.95 | 1 single coin |
| coin-005 | 2012 Magical Reindeer | 54.95 | 3 single coins |
| coin-006 | 2011 Canoe, seller-assembled lot of three | 149.95 | 1 complete lot |

Canoe is THREE coins sold together, with ONE shared presentation folder. It is not an official Mint set. Never set stock to 3; one unit means the complete lot. All four original images retained. Cover is the landscape presentation-folder artwork; visible Presentation Card tag on collection card.
Reindeer cover now shows the FULL landscape presentation-card artwork, including sleigh and holiday greeting, rather than cropped coin portion. Original photo/scan pixels preserved.
Maple Leaf: only one physical coin; keep package sealed; outer packaging wear disclosed, hidden surfaces not inspected.
Do not promise separate Mint paperwork/invoices; Rick requested removing that promise.

## Next priorities and decisions
- Rick is seeking more coins from his parents, aiming toward 20–25 coin listings.
- Next collection: 20 comics, aiming for items with plausible selling prices of CAD30+. Review actual condition and recent sold comparisons; do not promise a grade/value from inadequate photos.
- Work out comic packing and shipping before deciding to include shipping as with coins.
- Hold promotion on Facebook, Kijiji and other marketplaces until inventory is fuller. Quiet sales before promotion are not a useful demand test.
- Games and old toys discussed but not selected as next collection.
- Traffic reporting was approved on 2026-11-23 and is documented above; the old dashboard hold no longer applies.
- Keep listing work in small bounded stages/checkpoints; repeated long sessions previously timed out.
- Rick values creativity, enjoyable sustainable work, clearing collection space and future original products. Revenue is useful feedback, not the sole goal.

## Contact and policies
FormSubmit activation failed repeatedly. Replaced with mailto contact; retain working email button. Footer Contact us does the same thing. Public contact address is in existing site source; user approved it.
Contact layout: question heading and Contact us button together; adjacent gold outlined five-star SERVICE PROMISE, not customer reviews:
“We want you to have a five-star experience.”
“Have a question about a collectible or an order? We’re happy to help.”
Do not describe stars as a rating or invent testimonials.
Shipping/returns text approved: Canada; dispatch within 3 business days; shipping included where listing says; 14-day change-of-mind returns with buyer return postage; seller covers wrong/damaged/misdescribed return postage; refund to original method after received/checked; statutory rights preserved. Read current source for exact complete policy.
Privacy describes email, Stripe and cart local storage; obsolete preview/FormSubmit text removed.

## Implementation notes
Catalog api/coins.json; product HTML in products/; assets/product-001 through product-006; index.html collection cards; shared js/shop.js and js/product.js.
Catalog quantityAvailable seeds NEW ids only. Live stock for existing ids must be changed explicitly in production database, not only JSON.
Neon project frosty-heart-57316651, production branch br-divine-field-bb4gydl1, schema tpf_live, table stock(id,quantity). Separate sandbox exists: preserve it. Read current stock before changing it. Legacy id 220025 has zero stock; do not activate it.
Production stock snapshot is not an instruction to reset future stock after sales.
SVG galleries require clipPath rect in main-photo/lightbox; thumbnails carry full source, viewbox, dimensions and transform. Update catalog, collection cover, product main photo, captions, thumbnails and lightbox consistently when changing covers. Do not alter coin details with generated imagery.
Checkout uses Stripe, manual payouts. Do not make real purchases for testing without explicit authorization. Prior backend verification timed out at times; report specific verification limits.
Existing cart checks: node --test tests/cart.test.cjs. Use targeted checks for actual changes.
Repo-backed source/docs are durable; do not duplicate entire repositories in ChatGPT Library.

## Other outstanding thread context
DTC is a separate VINVOX project: requested v4 based on original v2 Table Repair workbook after v3 Excel repair warning (calcChain.xml formulas removed); clear the inappropriate Severity/Confirmed entries indicated in screenshot and remove B18B5-2A completely. This handoff does NOT claim DTC v4 was completed. Locate originals and process instructions in Drive before proceeding; preserve original and verify xlsx integrity.

## Resume
Start with this file, current catalog and live stock. Products 1–6 are reviewed/live, not pending approval. Next likely work is more coin intake or the 20-comic collection. Ask for a new handoff/current-status read if source has changed.

## Denomination title wording (2026-11-23)
Rick approved spelling out “Twenty Dollar” in the six $20 coin listing titles. Homepage cards, product headings/page titles/breadcrumbs and catalog/cart names use that wording. Numeric face values remain $20 CAD per coin in specifications. Silver-dollar listings retain “Silver Dollar.” Prices, quantities and product URLs are unchanged.
