"""Run against a disposable LOCAL Postgres server, never a customer database.

Set TPF_TEST_POSTGRES_URL to a local admin connection. Each test creates and
drops its own database; the inherited suite also runs on the SQLite fallback.
"""
import os
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

import test_inventory
from server import app as backend
from server.inventory import OutOfStock
from server.postgres_inventory import PostgresInventory


ADMIN = os.getenv('TPF_TEST_POSTGRES_URL')


@unittest.skipUnless(ADMIN, 'Set TPF_TEST_POSTGRES_URL for real Postgres tests')
class PostgresCheckoutTests(test_inventory.CheckoutTests):
    def setUp(self):
        # Do not let this destructive fixture target any hosted database.
        if conninfo_to_dict(ADMIN).get('host') not in ('127.0.0.1', 'localhost', '::1'):
            raise ValueError('Postgres tests require a local disposable server')
        super().setUp()
        self.database = 'tpf_test_' + uuid.uuid4().hex
        with psycopg.connect(ADMIN, autocommit=True) as db:
            db.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(self.database)))
        self.url = make_conninfo(ADMIN, dbname=self.database)
        backend.app.config['DATABASE_URL_TEST'] = self.url

    def tearDown(self):
        backend.postgres_store.cache_clear()
        backend.app.config['DATABASE_URL_TEST'] = None
        with psycopg.connect(ADMIN, autocommit=True) as db:
            db.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(self.database)))
        super().tearDown()

    def new_store(self):
        return PostgresInventory(self.url, backend.CATALOG, 'test')

    def test_many_buyers_cannot_oversell_three_coins(self):
        backend.inventory()  # Initialize before simulating independent workers.
        def attempt(_):
            try:
                self.new_store().reserve([{'id': 'coin-001', 'qty': 1}])
                return 1
            except OutOfStock:
                return 0
        with ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(sum(pool.map(attempt, range(16))), 3)
        self.assertEqual(self.quantity(), 0)

    def test_sandbox_sales_do_not_touch_live_stock_on_same_database(self):
        self.checkout(3)
        self.sessions['cs_test_1'].update(status='complete', payment_status='paid')
        self.webhook()
        self.assertEqual(self.quantity(), 0)
        live = PostgresInventory(self.url, backend.CATALOG, 'live')
        self.assertEqual(live.quantities()['coin-001'], 3)
        # Recreating the sandbox store (a restart) must preserve sold-out stock.
        self.assertEqual(self.new_store().quantities()['coin-001'], 0)
