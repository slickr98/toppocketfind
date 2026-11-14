"""Transactional stock and checkout reservations. Put the database on persistent storage."""
import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path


class OutOfStock(ValueError):
    pass


class Inventory:
    def __init__(self, path, catalog):
        self.path = path
        self.catalog = catalog
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS stock (
                    id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity >= 0));
                CREATE TABLE IF NOT EXISTS reservations (
                    id TEXT PRIMARY KEY, session_id TEXT UNIQUE,
                    status TEXT NOT NULL, lines TEXT NOT NULL,
                    amount INTEGER NOT NULL, expires_at INTEGER NOT NULL,
                    created_at INTEGER NOT NULL);
            ''')
            for item in catalog.values():
                db.execute('INSERT OR IGNORE INTO stock VALUES (?, ?)',
                           (item['id'], item['quantityAvailable']))

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def available(db):
        stock = {row['id']: row['quantity'] for row in db.execute('SELECT * FROM stock')}
        for row in db.execute("SELECT lines FROM reservations WHERE status IN ('creating', 'open')"):
            for line in json.loads(row['lines']):
                stock[line['id']] -= line['qty']
        return stock

    def quantities(self):
        with self.connection() as db:
            return self.available(db)

    def reserve(self, lines):
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            available = self.available(db)
            for line in lines:
                if line['qty'] > available.get(line['id'], 0):
                    raise OutOfStock('Some items are no longer available in that quantity. Please update your bag.')
            token = uuid.uuid4().hex
            now = int(time.time())
            # A little over Stripe's 30-minute minimum to allow for network latency.
            expires_at = now + 35 * 60
            amount = sum(self.catalog[line['id']]['priceCents'] * line['qty'] for line in lines)
            db.execute('INSERT INTO reservations VALUES (?, NULL, ?, ?, ?, ?, ?)',
                       (token, 'creating', json.dumps(lines), amount, expires_at, now))
            return token, expires_at

    def attach(self, token, session_id):
        with self.connection() as db:
            db.execute("UPDATE reservations SET session_id=?, status='open' WHERE id=? AND status='creating'",
                       (session_id, token))

    def fail(self, token):
        with self.connection() as db:
            db.execute("UPDATE reservations SET status='failed' WHERE id=? AND status='creating'", (token,))

    def get(self, token):
        with self.connection() as db:
            row = db.execute('SELECT * FROM reservations WHERE id=?', (token,)).fetchone()
            return dict(row) if row else None

    def stale_sessions(self):
        with self.connection() as db:
            return [row['session_id'] for row in db.execute(
                "SELECT session_id FROM reservations WHERE status='open' AND expires_at < ? AND session_id IS NOT NULL",
                (int(time.time()),))]

    def settle(self, session):
        token = session.get('metadata', {}).get('inventory_reservation_id')
        if not token:
            return False  # Unrelated Stripe checkout.
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM reservations WHERE id=?', (token,)).fetchone()
            if not row:
                raise ValueError('Unknown stock reservation')
            if row['session_id'] and row['session_id'] != session['id']:
                raise ValueError('Checkout session mismatch')
            if row['status'] in ('paid', 'expired', 'failed'):
                return row['status'] == 'paid'
            if session.get('payment_status') == 'paid':
                shipping = session.get('shipping_details') or session.get('collected_information', {}).get('shipping_details') or {}
                if (session.get('currency') != 'cad' or session.get('amount_total') != row['amount']
                        or shipping.get('address', {}).get('country') != 'CA'):
                    raise ValueError('Paid checkout does not match reserved order')
                for line in json.loads(row['lines']):
                    changed = db.execute('UPDATE stock SET quantity=quantity-? WHERE id=? AND quantity>=?',
                                         (line['qty'], line['id'], line['qty'])).rowcount
                    if changed != 1:
                        raise ValueError('Unable to commit paid stock')
                db.execute("UPDATE reservations SET session_id=?, status='paid' WHERE id=?", (session['id'], token))
                return True
            if session.get('status') == 'expired':
                db.execute("UPDATE reservations SET session_id=?, status='expired' WHERE id=?", (session['id'], token))
            return False
