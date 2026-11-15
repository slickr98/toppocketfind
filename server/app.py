import json
import os
from pathlib import Path
from functools import lru_cache

from flask import Flask, request, jsonify
from flask_cors import CORS
import stripe

try:
    from .inventory import Inventory, OutOfStock
    from .postgres_inventory import PostgresInventory
except ImportError:  # Existing Render start command: gunicorn app:app, root directory server.
    from inventory import Inventory, OutOfStock
    from postgres_inventory import PostgresInventory

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024
ROOT = Path(__file__).resolve().parent.parent
CATALOG = {item['id']: item for item in json.loads((ROOT / 'api/coins.json').read_text())['products']}
# Preserve the remaining original game listing with a server-trusted price.
CATALOG['220025'] = {'id': '220025', 'title': "PS2 - Baldur's Gate Dark Alliance II (Used)",
                     'priceCents': 4599, 'quantityAvailable': 1, 'purchasable': True}
# Explicit opt-in to live mode; merely adding a live key never enables payments.
PAYMENT_MODE = os.getenv('STRIPE_MODE', 'test')
if PAYMENT_MODE not in ('test', 'live'):
    raise ValueError('STRIPE_MODE must be test or live')
stripe.api_key = os.getenv('STRIPE_SECRET_KEY_TEST' if PAYMENT_MODE == 'test' else 'STRIPE_SECRET_KEY')
CORS(app, resources={r'/*': {'origins': [
    'https://toppocketfind.ca', 'https://www.toppocketfind.ca',
    'http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:8080'
]}}, methods=['GET', 'POST', 'OPTIONS'], allow_headers=['Content-Type'])


def payment_mode():
    return app.config.get('STRIPE_MODE', PAYMENT_MODE)


def setting(name):
    return app.config.get(name) or os.getenv(name)


@lru_cache(maxsize=4)
def postgres_store(url, mode):
    return PostgresInventory(url, CATALOG, mode)


def inventory_configured():
    key = 'DATABASE_URL' if payment_mode() == 'live' else 'DATABASE_URL_TEST'
    return bool(setting(key) or setting('INVENTORY_DB_PATH'))


def webhook_secret():
    return setting('STRIPE_WEBHOOK_SECRET' if payment_mode() == 'live' else 'STRIPE_WEBHOOK_SECRET_TEST')


def inventory():
    mode = payment_mode()
    url = setting('DATABASE_URL' if mode == 'live' else 'DATABASE_URL_TEST')
    if url:
        return postgres_store(url, mode)
    # No ephemeral fallback: losing this file must not silently restock sold coins.
    path = setting('INVENTORY_DB_PATH')
    if not path:
        return None
    return Inventory(path, CATALOG, mode)


def checkout_ready():
    mode = payment_mode()
    prefix = ('sk_live_', 'rk_live_') if mode == 'live' else ('sk_test_', 'rk_test_')
    return bool((app.config.get('CHECKOUT_ENABLED') or os.getenv('CHECKOUT_ENABLED') == '1')
                and mode in ('test', 'live')
                and (mode == 'test' or setting('LIVE_CHECKOUT_ENABLED') == '1')
                and stripe.api_key and stripe.api_key.startswith(prefix)
                and webhook_secret() and inventory_configured())


def reconcile(store):
    # Never release by a local timer: Stripe may have accepted payment just before expiry.
    for session_id in store.stale_sessions():
        try:
            store.settle(stripe.checkout.Session.retrieve(session_id))
        except Exception:
            app.logger.exception('Unable to reconcile a checkout reservation')


@app.get('/')
def health():
    return 'ok'


@app.get('/inventory')
def stock():
    try:
        store = inventory()
        if store and stripe.api_key:
            reconcile(store)
        quantities = store.quantities() if store else {key: item['quantityAvailable'] for key, item in CATALOG.items()}
        response = jsonify(products=[{'id': key, 'quantityAvailable': qty} for key, qty in quantities.items()],
                           checkoutReady=checkout_ready(), paymentMode=payment_mode())
        response.headers['Cache-Control'] = 'no-store'
        return response
    except Exception:
        app.logger.exception('Inventory unavailable')
        return jsonify(error='Stock information is temporarily unavailable.'), 503


def validated_lines(data):
    if not isinstance(data, dict):
        raise ValueError('Invalid cart.')
    items = data.get('items')
    if not isinstance(items, list) or not 1 <= len(items) <= 25:
        raise ValueError('Your cart is empty or invalid.')
    merged = {}
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('Invalid item.')
        item_id, qty = item.get('id'), item.get('qty')
        if not isinstance(item_id, str) or item_id not in CATALOG or not CATALOG[item_id].get('purchasable'):
            raise ValueError('An item in your cart is not available to purchase.')
        if type(qty) is not int or not 1 <= qty <= CATALOG[item_id]['quantityAvailable']:
            raise ValueError('Choose a valid whole-number quantity.')
        merged[item_id] = merged.get(item_id, 0) + qty
        if merged[item_id] > CATALOG[item_id]['quantityAvailable']:
            raise ValueError('Requested quantity exceeds stock.')
    return [{'id': key, 'qty': qty} for key, qty in sorted(merged.items())]


@app.route('/create-checkout-session', methods=['POST', 'OPTIONS'])
def create_checkout_session():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        lines = validated_lines(request.get_json(silent=True))
    except ValueError as error:
        return jsonify(error=str(error)), 400
    if not checkout_ready():
        return jsonify(error='Checkout is being prepared. Your items can stay in your cart.'), 503
    token = None
    try:
        store = inventory()
        reconcile(store)
        token, expires_at = store.reserve(lines)
        line_items = [{'price_data': {'currency': 'cad', 'product_data': {'name': CATALOG[line['id']]['title']},
                                     'unit_amount': CATALOG[line['id']]['priceCents']},
                       'quantity': line['qty']} for line in lines]
        session = stripe.checkout.Session.create(
            mode='payment', payment_method_types=['card'], line_items=line_items,
            shipping_address_collection={'allowed_countries': ['CA']},
            shipping_options=[{'shipping_rate_data': {'type': 'fixed_amount',
                'fixed_amount': {'amount': 0, 'currency': 'cad'}, 'display_name': 'Shipping included within Canada'}}],
            success_url='https://toppocketfind.ca/cart/success.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url='https://toppocketfind.ca/cart/cart.html',
            metadata={'inventory_reservation_id': token}, client_reference_id=token,
            expires_at=expires_at, idempotency_key='tpf-checkout-' + token,
        )
        store.attach(token, session.id)
        return jsonify(url=session.url)
    except OutOfStock as error:
        return jsonify(error=str(error)), 409
    except stripe.error.InvalidRequestError:
        # Stripe definitively rejected creation; this reservation can be released.
        if token:
            store.fail(token)
        app.logger.exception('Stripe rejected checkout creation')
        return jsonify(error='Unable to start checkout. Please try again later.'), 502
    except Exception:
        # A timeout may mean Stripe created the session. Keep stock held, never oversell.
        app.logger.exception('Unable to start checkout; any ambiguous reservation remains held')
        return jsonify(error='Unable to start checkout. Please try again later.'), 503


@app.post('/stripe-webhook')
def stripe_webhook():
    secret = webhook_secret()
    if not secret or not inventory():
        return jsonify(error='Webhook is not configured.'), 503
    try:
        event = stripe.Webhook.construct_event(request.get_data(), request.headers.get('Stripe-Signature', ''), secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        return jsonify(error='Invalid webhook signature.'), 400
    if event.get('livemode') is not (payment_mode() == 'live'):
        return jsonify(error='Webhook belongs to a different payment mode.'), 400
    if event['type'] in ('checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'):
        try:
            incoming = event['data']['object']
            if not incoming.get('metadata', {}).get('inventory_reservation_id'):
                return jsonify(received=True)
            # Verify current payment state with Stripe; redirects and browser data never change stock.
            session = stripe.checkout.Session.retrieve(incoming['id'])
            inventory().settle(session)
        except Exception:
            app.logger.exception('Unable to settle checkout; Stripe should retry')
            return jsonify(error='Unable to update stock.'), 500
    return jsonify(received=True)


@app.get('/checkout-status')
def checkout_status():
    session_id = request.args.get('session_id', '')
    if not session_id.startswith('cs_') or len(session_id) > 255:
        return jsonify(error='Invalid checkout reference.'), 400
    try:
        store = inventory()
        if not store or not stripe.api_key:
            return jsonify(error='Order confirmation is temporarily unavailable.'), 503
        session = stripe.checkout.Session.retrieve(session_id)
        paid = store.settle(session)
        token = session.get('metadata', {}).get('inventory_reservation_id')
        reservation = store.get(token) if token else None
        response = jsonify(paid=paid, items=json.loads(reservation['lines']) if paid and reservation else [])
        response.headers['Cache-Control'] = 'no-store'
        return response
    except Exception:
        app.logger.exception('Unable to confirm checkout')
        return jsonify(error='Order confirmation is temporarily unavailable.'), 503
