"""Durable inventory on external Postgres, including Neon's Free plan."""
from contextlib import contextmanager

import psycopg
from psycopg import sql
from psycopg.rows import dict_row

try:
    from .inventory import Inventory
except ImportError:
    from inventory import Inventory


class Connection:
    """Adapt the inventory's fixed, parameterized SQL to Psycopg placeholders."""
    def __init__(self, connection):
        self.connection = connection

    def execute(self, statement, parameters=None):
        # Only application-authored SQL goes through here; values remain bound.
        return self.connection.execute(statement.replace('?', '%s'), parameters)


class PostgresInventory(Inventory):
    def __init__(self, url, catalog, mode='test'):
        if mode not in ('test', 'live'):
            raise ValueError('Unknown payment mode')
        self.url = url
        self.catalog = catalog
        self.livemode = mode == 'live'
        self.schema = 'tpf_live' if self.livemode else 'tpf_test'
        # An app restart seeds NEW products only. It never resets existing stock.
        with self.connection(initialize=True) as db:
            self.initialize(db)

    @contextmanager
    def connection(self, initialize=False):
        # Do not retain idle connections: both Render and Neon can sleep.
        with psycopg.connect(self.url, row_factory=dict_row, connect_timeout=10,
                             options='-c statement_timeout=15000 -c lock_timeout=10000') as connection:
            if initialize:
                # Serialize first-time DDL when multiple Gunicorn workers start.
                connection.execute('SELECT pg_advisory_xact_lock(%s)',
                                   (74670601 if self.livemode else 74670600,))
                connection.execute(sql.SQL('CREATE SCHEMA IF NOT EXISTS {}').format(sql.Identifier(self.schema)))
            connection.execute(sql.SQL('SET LOCAL search_path TO {}').format(sql.Identifier(self.schema)))
            yield Connection(connection)

    @staticmethod
    def begin_write(db):
        # Every reservation/settlement locks stock in the same order. A second
        # buyer waits, then sees the first buyer's committed reservation/payment.
        db.execute('SELECT id FROM stock ORDER BY id FOR UPDATE').fetchall()
