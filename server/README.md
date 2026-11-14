# Quantity inventory and checkout

The static storefront has three individually sold Santa coins at CAD 54.95 each,
with shipping included within Canada. A shopping bag does not reserve stock.

The Flask server trusts product IDs and quantities only; price and titles come from
`api/coins.json`. Checkout reserves stock in a SQLite transaction, and confirmed
payment reduces stock exactly once. Abandoned sessions release their reservation
only after Stripe confirms expiration. Remaining stock is shared across buyers via
`GET /inventory`; a server restart or repeated webhook does not reset it.

## Existing Render service

Deploy this repository using the existing `server/requirements.txt` and
`gunicorn app:app` start command from `server/`. The parent `api/coins.json` must be
included in the source checkout.

Before enabling checkout:

1. Place `INVENTORY_DB_PATH` on an actual persistent disk (for example,
   `/var/data/tpf-inventory.sqlite3`). Do not point this at Render's ephemeral
   filesystem. Preserve/back up this file when changing hosting or restoring data.
   A new empty database initializes stock from the catalog; never replace an
   existing production database with an empty file.
2. Keep the existing Stripe API key (`STRIPE_SECRET_KEY_TEST` for testing or
   `STRIPE_SECRET_KEY` for live). The test key takes precedence if both exist.
   Use **separate database files for test and live mode** so testing never consumes
   real stock.
3. In the matching Stripe mode, configure a webhook destination at
   `https://tpf-api.onrender.com/stripe-webhook` for
   `checkout.session.completed`, `checkout.session.expired`, and
   `checkout.session.async_payment_succeeded`. Set its signing secret as
   `STRIPE_WEBHOOK_SECRET` on Render. Never commit keys or webhook secrets.
4. Set `CHECKOUT_ENABLED=1` in the test environment and verify a test payment,
   duplicate delivery, cancellation/expiration, and a second browser's stock.
   Finish the customer policies before enabling live orders.

Missing setup leaves checkout disabled. Stock can be selected and added to the
bag while checkout is being prepared. The API ignores the old `SHIP_CENTS`
setting: shipping for these orders is included, and delivery addresses are
restricted to Canada. The remaining legacy game listing retains its CAD 45.99
server price and maximum stock of one.

An ambiguous Stripe creation timeout leaves inventory reserved rather than
risking a second sale. Reconcile these rare `creating` records against Stripe
using their `inventory_reservation_id` / idempotency key before releasing them.
Do not release them based only on local elapsed time. Refunds/returns do not
automatically restock a collectible; inspect it before manually returning stock.

## Checks

From the repository root, with server dependencies installed:

```sh
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/cart.test.cjs
```

The automated backend tests use a temporary database, signed mock webhook events,
and a mocked Stripe transport. They do not contact Stripe or charge a card.
