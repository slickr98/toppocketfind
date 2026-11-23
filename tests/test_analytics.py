import hashlib
import json
import os
from pathlib import Path
import unittest
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo
from server import app as backend
from server import analytics


@unittest.skipUnless(os.getenv('TPF_TEST_POSTGRES_URL'), 'Disposable local PostgreSQL required')
class AnalyticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = os.environ['TPF_TEST_POSTGRES_URL']
        cls.dbname = 'analytics_test_' + uuid.uuid4().hex
        with psycopg.connect(cls.base, autocommit=True) as db:
            db.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(cls.dbname)))
        cls.url = make_conninfo(cls.base, dbname=cls.dbname)
        with psycopg.connect(cls.url) as db:
            db.execute(Path('server/migrations/001_anonymous_analytics.sql').read_text())

    @classmethod
    def tearDownClass(cls):
        with psycopg.connect(cls.base, autocommit=True) as db:
            db.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(cls.dbname)))

    def setUp(self):
        self.now = datetime(2026, 11, 23, 18, 30, tzinfo=timezone.utc)
        self.code = 'local_analytics_access_code_123456'
        self.origin = {'Origin': 'https://www.toppocketfind.ca'}
        self.config = patch.dict(backend.app.config, TESTING=True, TRACK_ENABLED='1',
            TRACK_DATABASE_URL=self.url, TRACK_ADMIN_HASH=hashlib.sha256(self.code.encode()).hexdigest(),
            TRACK_SIGNING_SECRET='local_signing_secret_for_tests_only_12345', TRACK_CLOCK=lambda: self.now)
        self.config.start()
        self.client = backend.app.test_client()
        analytics._login_attempts.clear()
        with psycopg.connect(self.url) as db:
            db.execute('TRUNCATE tpf_analytics.hourly_counts')
            db.execute("UPDATE tpf_analytics.metadata SET value=%s WHERE key='started_at'", ('2026-11-23T18:00:00+00:00',))

    def tearDown(self):
        self.config.stop()

    def login(self):
        response = self.client.post('/analytics/login', json={'code': self.code}, headers=self.origin)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('Set-Cookie', response.headers)
        return {'Authorization': 'Bearer ' + response.get_json()['token'], **self.origin}

    def collect(self, **values):
        event = dict(event='page_view', page='/', source='kijiji', campaign='coin-collection')
        event.update(values)
        return self.client.post('/analytics/collect', data=json.dumps(event), content_type='text/plain', headers={**self.origin, 'User-Agent': 'Mozilla/5.0'})

    def report(self, **query):
        return self.client.get('/analytics/report', query_string=query, headers=self.login())

    def count(self):
        with psycopg.connect(self.url) as db:
            return db.execute('SELECT COALESCE(sum(count),0) FROM tpf_analytics.hourly_counts').fetchone()[0]

    def test_private_reports_fail_closed_and_tokens_rotate(self):
        self.assertEqual(self.client.get('/analytics/report').status_code, 401)
        self.assertEqual(self.client.post('/analytics/login', json={'code': self.code}).status_code, 403)
        self.assertEqual(self.client.post('/analytics/login', json={'code': 'incorrect_code_123456'}, headers=self.origin).status_code, 401)
        auth = self.login()
        response = self.client.get('/analytics/report', headers=auth)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        with patch.dict(backend.app.config, TRACK_ADMIN_HASH='0' * 64):
            self.assertEqual(self.client.get('/analytics/report', headers=auth).status_code, 401)
        with patch.dict(backend.app.config, TRACK_SIGNING_SECRET=''):
            self.assertEqual(self.client.get('/analytics/report', headers=auth).status_code, 401)

    def test_atomic_counts_source_filter_and_product_interest(self):
        for _ in range(3): self.assertEqual(self.collect().status_code, 204)
        self.assertEqual(self.collect(event='product_click', page='/products/1982-regina-centennial-silver-dollar.html').status_code, 204)
        self.assertEqual(self.collect(page='/products/1982-regina-centennial-silver-dollar.html').status_code, 204)
        self.assertEqual(self.collect(source='direct', campaign='').status_code, 204)
        result = self.report(source='kijiji').get_json()
        self.assertEqual(sum(row['visits'] for row in result['buckets']), 4)
        self.assertEqual(sum(row['clicks'] for row in result['buckets']), 1)
        self.assertEqual(result['sources'][0]['count'], 4)
        self.assertEqual(result['products'][0]['views'], 1)
        self.assertEqual(result['products'][0]['count'], 1)
        self.assertEqual(self.count(), 6)

    def test_rejects_identifiers_raw_urls_and_extra_fields(self):
        self.assertEqual(self.collect(ip='192.0.2.1').status_code, 400)
        self.assertEqual(self.collect(page='/?email=private@example.com').status_code, 400)
        self.assertEqual(self.collect(event='product_click', page='/').status_code, 400)
        self.assertEqual(self.collect(source='private@example.com').status_code, 400)
        self.assertEqual(self.collect(campaign='private@example.com').status_code, 204)
        with psycopg.connect(self.url) as db:
            row = db.execute('SELECT campaign FROM tpf_analytics.hourly_counts').fetchone()
            self.assertEqual(row[0], '')
            columns = db.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='tpf_analytics' AND table_name='hourly_counts'").fetchall()
            self.assertEqual({c[0] for c in columns}, {'bucket','event','page','source','campaign','count'})

    def test_privacy_signals_bots_and_disabled_collection(self):
        body = json.dumps(dict(event='page_view',page='/',source='direct',campaign=''))
        for headers in [{'DNT':'1'},{'Sec-GPC':'1'},{'User-Agent':'Googlebot'},{'User-Agent':'HeadlessChrome'}]:
            response = self.client.post('/analytics/collect', data=body, content_type='text/plain', headers={**self.origin, **headers})
            self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.post('/analytics/collect', data=body, content_type='text/plain').status_code, 403)
        with patch.dict(backend.app.config, TRACK_ENABLED='0'):
            self.assertEqual(self.collect().status_code, 204)
        self.assertEqual(self.count(), 0)

    def test_atlantic_midnight_and_empty_report(self):
        self.now = datetime(2026, 11, 24, 3, 59, tzinfo=timezone.utc)
        self.collect()
        self.now = datetime(2026, 11, 24, 4, 1, tzinfo=timezone.utc)
        self.collect()
        today = self.report(period='today').get_json()
        self.assertEqual(today['start'], '2026-11-24')
        self.assertEqual(len(today['buckets']), 24)
        self.assertEqual(sum(row['visits'] for row in today['buckets']), 1)
        self.assertEqual(today['buckets'][0]['visits'], 1)
        week = self.report(period='7').get_json()
        self.assertEqual(sum(row['visits'] for row in week['buckets']), 2)
        empty = self.report(source='bing').get_json()
        self.assertEqual(sum(row['visits'] for row in empty['buckets']), 0)
        self.assertEqual(empty['products'], [])

    def test_invalid_reporting_filters_and_preflight(self):
        for query in [{'period':'9999'},{'source':'unknown'}]:
            self.assertEqual(self.report(**query).status_code, 400)
        response = self.client.options('/analytics/report', headers={**self.origin,
            'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization'})
        self.assertIn('authorization', response.headers.get('Access-Control-Allow-Headers','').lower())
