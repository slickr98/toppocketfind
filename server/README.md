# Quantity inventory and checkout

The static storefront has three individually sold Santa coins at CAD 54.95 each,
with shipping included within Canada. A shopping cart does not reserve stock.

The Flask server trusts product IDs and quantities only; price and titles come from
`api/coins.json`. Checkout reserves stock in a database transaction, and confirmed
payment reduces stock exactly once. Abandoned sessions release their reservation
only after Stripe confirms expiration. Remaining stock is shared across buyers via
`GET /inventory`; a server restart or repeated webhook does not reset it.

## Existing Render service

Deploy this repository using the existing `server/requirements.txt` and
`gunicorn app:app` start command from `server/`. The parent `api/coins.json` must be
included in the source checkout.

## Free hosting configuration

Keep the existing Render web service on Free and use a Neon Free Postgres project
for durable inventory. Use 0.25 CU compute and the Free plan's scale-to-zero
behavior. Do not upgrade either provider or add paid services automatically.
Render's sleeping server can take about a minute to wake; the cart allows a
90-second availability check, shares duplicate requests, and offers a retry.
There is no continuous stock polling that would keep free compute awake.

Set the following in Render's Environment page (or merge individual keys with
the Render connector). Never put actual connection strings or keys in Git.

| Setting | Sandbox | Live, only after approval/testing |
| --- | --- | --- |
| `STRIPE_MODE` | `test` | `live` |
| Database URL | `DATABASE_URL_TEST` | `DATABASE_URL` |
| Stripe key | `STRIPE_SECRET_KEY_TEST` (`sk_test_` / `rk_test_`) | `STRIPE_SECRET_KEY` (`sk_live_` / `rk_live_`) |
| Webhook signing secret | `STRIPE_WEBHOOK_SECRET_TEST` | `STRIPE_WEBHOOK_SECRET` |
| `CHECKOUT_ENABLED` | `1` when ready for sandbox tests; otherwise `0` | `1` only when ready for real orders |
| `LIVE_CHECKOUT_ENABLED` | `0` | Must also be `1` for real orders |

Use the provider's TLS-enabled Postgres connection string. Pooled Neon endpoints
are supported: schema selection and locks are transaction-local. Every operation
opens and closes its connection, so idle clients do not hold connections open.
Provision separate Neon branches and connection strings for sandbox and live.
Use the sandbox branch URL for `DATABASE_URL_TEST` and the main branch URL for
`DATABASE_URL`. The application also separates `tpf_test` and `tpf_live` schemas
as an additional safeguard. Sandbox purchases never share live storage.
Restart initialization inserts new catalog IDs only, never overwrites stock.

Create a webhook destination in the MATCHING Stripe account/environment at
`https://tpf-api.onrender.com/stripe-webhook` for `checkout.session.completed`,
`checkout.session.expired`, and `checkout.session.async_payment_succeeded`.
Store its signing secret in the mode-specific setting above. Events and retrieved
sessions must match the selected mode. Merely adding a live key cannot activate
live checkout. The cart clearly labels an enabled sandbox checkout as a test.

The old `INVENTORY_DB_PATH` SQLite backend remains available for local tests or a
paid host with a real persistent disk. Never use a Render Free local file for
inventory. Use distinct SQLite files if manually testing separate payment modes.
An existing SQLite production database needs an explicit reviewed migration;
do not silently point it at a newly seeded Postgres database.

Before live enable, verify Stripe eligibility, customer contact/policies, tax
handling, payment confirmation, expiry, duplicate webhook delivery and competing
buyers. Configure backups using Postgres-native exports; free-tier restore
history is limited. Monitor Free usage limits; do not assume unlimited capacity.

Missing setup leaves checkout disabled. Stock can be selected and added to the
cart while checkout is being prepared. The API ignores the old `SHIP_CENTS`
setting: shipping for these orders is included, and delivery addresses are
restricted to Canada. The remaining legacy game listing retains its CAD 45.99
server price and maximum stock of one.

An ambiguous Stripe creation timeout leaves inventory reserved rather than
risking a second sale. Reconcile these rare `creating` records against Stripe
using their `inventory_reservation_id` / idempotency key before releasing them.
Do not release them based only on local elapsed time. Refunds/returns do not
automatically restock a collectible; inspect it before manually returning stock.

## Contact form

The homepage sends enquiries to `POST /contact`. Set `CONTACT_RECIPIENT` privately
in Render and `CONTACT_ENABLED=1` to enable the fixed-recipient FormSubmit relay.
Do not put the destination email in frontend code. Sender-provided recipient,
CC, subject and provider options are ignored. The form includes a honeypot,
field limits, production-origin checks and best-effort per-worker rate limits;
FormSubmit also applies its own spam filters. No customer messages are stored
in this application's database or logs. FormSubmit retains submissions for 30 days.

The first submission sends the mailbox owner an activation link. The owner must
confirm it before email delivery is verified. Pending submissions are retained
by FormSubmit until confirmation. A successful API response means accepted for
delivery, not proof of inbox receipt. After activation, submit a real website
enquiry and have the owner confirm receipt and Reply-To. Do not automatically
retry ambiguous timeouts; the sender's form fields remain intact on failure.

Contact settings are separate from Stripe merchant sale alerts and manual
customer thank-you/shipping emails. No paid email plan is required.

## Checks

From the repository root, with server dependencies installed:

```sh
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/cart.test.cjs
# Real PostgreSQL integration tests (test-only dependency):
pip install pgserver
python tests/run_postgres_tests.py
```

The test runner starts a disposable local PostgreSQL server and runs the same
checkout suite against both SQLite and PostgreSQL, plus a 16-buyer concurrency
check and test/live isolation check. Each Postgres test creates and removes its
own local database. Signed webhook fixtures and Stripe transport are mocked; no
Stripe API or hosted database is contacted and no card is charged.
