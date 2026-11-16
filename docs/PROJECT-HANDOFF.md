# Top Pocket Find — project handoff
Updated 2026-11-16. Read this before continuing work. This handoff preserves decisions from the product-listing chat; confirm current source and stock before future edits.

## Current position
Six reviewed coin listings are published at https://www.toppocketfind.ca/.
GitHub: slickr98/toppocketfind, main. GitHub Pages frontend; Flask backend on Render at https://tpf-api.onrender.com. Preserve existing hosting and design.

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
- Traffic dashboard (possible /Maggie private view), weekly/quarterly comparisons and goals discussed, explicitly ON HOLD; products take priority. Do not implement yet.
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
