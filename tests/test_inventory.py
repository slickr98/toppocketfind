import hashlib
import hmac
import json
import os
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

from server import app as backend
from server.inventory import Inventory, OutOfStock


class CheckoutTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'STRIPE_WEBHOOK_SECRET_TEST': 'whsec_local_test_only'})
        self.env.start()
        backend.stripe.api_key = 'sk_test_local_only'
        backend.app.config.update(TESTING=True, STRIPE_MODE='test', DATABASE_URL_TEST=None,
                                  DATABASE_URL=None, INVENTORY_DB_PATH=self.temp.name + '/stock.sqlite3', CHECKOUT_ENABLED=True)
        self.client = backend.app.test_client()
        self.serial = 0
        self.sessions = {}
        self.create_patch = patch.object(backend.stripe.checkout.Session, 'create', side_effect=self.create_session)
        self.retrieve_patch = patch.object(backend.stripe.checkout.Session, 'retrieve', side_effect=lambda key: self.sessions[key])
        self.create_mock = self.create_patch.start()
        self.retrieve_patch.start()

    def tearDown(self):
        self.create_patch.stop()
        self.retrieve_patch.stop()
        self.env.stop()
        self.temp.cleanup()

    def create_session(self, **kwargs):
        self.serial += 1
        key = 'cs_test_' + str(self.serial)
        self.sessions[key] = dict(id=key, livemode=False, status='open', payment_status='unpaid', currency='cad',
                                 amount_total=sum(row['price_data']['unit_amount'] * row['quantity'] for row in kwargs['line_items']),
                                 metadata=kwargs['metadata'], shipping_details={'address': {'country': 'CA'}})
        return SimpleNamespace(id=key, url='https://checkout.stripe.com/c/pay/' + key)

    def checkout(self, qty=1, **extra):
        return self.client.post('/create-checkout-session', json={'items': [dict(id='coin-001', qty=qty, **extra)]})

    def quantity(self):
        data = self.client.get('/inventory').get_json()
        return next(item['quantityAvailable'] for item in data['products'] if item['id'] == 'coin-001')

    def new_store(self):
        return Inventory(backend.app.config['INVENTORY_DB_PATH'], backend.CATALOG)

    def webhook(self, key='cs_test_1', kind='checkout.session.completed', event_id='evt_local'):
        payload = json.dumps({'id': event_id, 'object': 'event', 'livemode': False, 'type': kind, 'data': {'object': self.sessions[key]}}).encode()
        timestamp = str(int(time.time()))
        signature = hmac.new(b'whsec_local_test_only', timestamp.encode() + b'.' + payload, hashlib.sha256).hexdigest()
        return self.client.post('/stripe-webhook', data=payload, headers={'Stripe-Signature': f't={timestamp},v1={signature}', 'Content-Type': 'application/json'})

    def test_initial_stock_and_cors(self):
        self.assertEqual(self.quantity(), 3)
        response = self.client.get('/inventory', headers={'Origin': 'https://www.toppocketfind.ca'})
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'https://www.toppocketfind.ca')
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_server_price_and_canada_shipping(self):
        self.assertEqual(self.checkout(2, priceCents=1, title='Fake').status_code, 200)
        params = self.create_mock.call_args.kwargs
        self.assertEqual(params['line_items'][0]['price_data']['unit_amount'], 5495)
        self.assertEqual(params['shipping_address_collection']['allowed_countries'], ['CA'])
        self.assertEqual(params['shipping_options'][0]['shipping_rate_data']['fixed_amount']['amount'], 0)
        self.assertEqual(self.quantity(), 1)

    def test_invalid_quantities_and_ids(self):
        for qty in (0, -1, 4, 1.5, '2', True, None):
            self.assertEqual(self.checkout(qty).status_code, 400, qty)
        for data in (None, [], {'items': []}, {'items': [None]}, {'items': [{'id': 'unknown', 'qty': 1}]}):
            self.assertEqual(self.client.post('/create-checkout-session', json=data).status_code, 400)
        self.assertEqual(self.client.post('/create-checkout-session', json={'items': [{'id':'coin-001','qty':2}]*2}).status_code, 400)
        self.assertEqual(self.quantity(), 3)

    def test_coming_soon_coin_cannot_start_checkout(self):
        self.assertEqual(backend.CATALOG['coin-007']['quantityAvailable'], 0)
        response = self.client.post('/create-checkout-session', json={'items': [{'id': 'coin-007', 'qty': 1}]})
        self.assertEqual(response.status_code, 400)
        self.assertIn('not available to purchase', response.get_json()['error'])
        self.create_mock.assert_not_called()

    def test_competing_buyers_cannot_oversell(self):
        self.assertEqual(self.checkout(2).status_code, 200)
        self.assertEqual(self.checkout(2).status_code, 409)
        self.assertEqual(self.checkout(1).status_code, 200)
        self.assertEqual(self.quantity(), 0)

    def test_paid_webhook_is_idempotent_across_events_and_restart(self):
        self.checkout(1)
        self.sessions['cs_test_1'].update(payment_status='paid', status='complete')
        self.assertEqual(self.webhook().status_code, 200)
        self.assertEqual(self.webhook(event_id='evt_retry').status_code, 200)
        self.assertEqual(self.quantity(), 2)
        store = self.new_store()
        self.assertEqual(store.quantities()['coin-001'], 2)
        self.assertEqual(self.client.get('/checkout-status?session_id=cs_test_1').get_json()['items'], [{'id':'coin-001','qty':1}])
        self.assertEqual(self.quantity(), 2)

    def test_expiration_restores_reservation_once(self):
        self.checkout(3)
        self.assertEqual(self.quantity(), 0)
        self.sessions['cs_test_1']['status'] = 'expired'
        self.assertEqual(self.webhook(kind='checkout.session.expired').status_code, 200)
        self.webhook(kind='checkout.session.expired')
        self.assertEqual(self.quantity(), 3)

    def test_unpaid_completion_does_not_reduce_stock(self):
        self.checkout()
        self.sessions['cs_test_1']['status'] = 'complete'
        self.webhook()
        store = backend.inventory()
        self.assertEqual(store.get(self.sessions['cs_test_1']['metadata']['inventory_reservation_id'])['status'], 'open')
        self.sessions['cs_test_1'].update(status='expired')
        self.webhook(kind='checkout.session.expired')
        self.assertEqual(self.quantity(), 3)

    def test_bad_signature_cannot_change_stock(self):
        self.checkout()
        response = self.client.post('/stripe-webhook', data='{}', headers={'Stripe-Signature':'invalid'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.quantity(), 2)

    def test_all_three_sold_and_not_reset(self):
        self.checkout(3)
        self.sessions['cs_test_1'].update(status='complete', payment_status='paid')
        self.webhook()
        self.assertEqual(self.quantity(), 0)
        self.assertEqual(self.checkout().status_code, 409)

    def test_unconfigured_checkout_is_closed(self):
        backend.app.config['CHECKOUT_ENABLED'] = False
        self.assertEqual(self.checkout().status_code, 503)
        self.assertFalse(self.client.get('/inventory').get_json()['checkoutReady'])

    def test_timeouts_keep_stock_held(self):
        self.create_mock.side_effect = TimeoutError('Simulated transport failure')
        with self.assertLogs(backend.app.logger, level='ERROR'):
            self.assertEqual(self.checkout(2).status_code, 503)
        self.assertEqual(self.quantity(), 1)

    def test_transactions_across_workers(self):
        store = backend.inventory()
        def attempt(_):
            try:
                self.new_store().reserve([{'id':'coin-001','qty':2}])
                return True
            except OutOfStock:
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sum(pool.map(attempt, range(2))), 1)
        self.assertEqual(self.quantity(), 1)

    def test_wrong_paid_total_does_not_fulfill(self):
        self.checkout()
        self.sessions['cs_test_1'].update(payment_status='paid', amount_total=1)
        with self.assertLogs(backend.app.logger, level='ERROR'):
            self.assertEqual(self.webhook().status_code, 500)
        self.assertEqual(backend.inventory().get(self.sessions['cs_test_1']['metadata']['inventory_reservation_id'])['status'], 'open')

    def test_live_key_is_rejected_in_test_mode(self):
        backend.stripe.api_key = 'sk_live_local_only'
        self.assertFalse(self.client.get('/inventory').get_json()['checkoutReady'])
        self.assertEqual(self.checkout().status_code, 503)

    def test_test_session_cannot_settle_live_payment(self):
        self.checkout()
        session = dict(self.sessions['cs_test_1'], payment_status='paid', livemode=True)
        with self.assertRaises(ValueError):
            backend.inventory().settle(session)
        self.assertEqual(self.quantity(), 2)  # Reservation stays held, not fulfilled.


if __name__ == '__main__':
    unittest.main()
