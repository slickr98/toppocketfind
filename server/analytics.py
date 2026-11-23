"""Cookie-free aggregate counters and authenticated, read-only reports.

Never store request IPs, raw URLs, referrers, user agents, event histories or IDs.
New campaigns must be explicitly registered in api/tracking-campaigns.json.
"""
from collections import deque
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import threading
import time
from zoneinfo import ZoneInfo

from flask import Blueprint, current_app, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
import psycopg
from psycopg.rows import dict_row

analytics_routes = Blueprint('analytics', __name__)
ROOT = Path(__file__).resolve().parent.parent
COINS = json.loads((ROOT / 'api/coins.json').read_text())['products']
PRODUCTS = {'/' + row['url']: row for row in COINS}
PAGES = {'/', '/cart/cart.html', '/cart/success.html', '/games.html'} | set(PRODUCTS)
CAMPAIGNS = json.loads((ROOT / 'api/tracking-campaigns.json').read_text())['campaigns']
CAMPAIGN_MAP = {(row['source'], row['id']): row['name'] for row in CAMPAIGNS}
SOURCES = {'direct', 'kijiji', 'facebook', 'google', 'bing', 'other'}
ORIGINS = {'https://www.toppocketfind.ca', 'https://toppocketfind.ca'}
ATLANTIC = ZoneInfo('America/Moncton')
BOT = re.compile(r'bot\b|crawler|spider|headless|preview|lighthouse|monitor|curl|wget', re.I)
_login_attempts = deque()
_login_lock = threading.Lock()


def setting(name, default=None):
    value = current_app.config.get(name)
    return os.getenv(name, default) if value is None else value


def clock():
    provider = current_app.config.get('TRACK_CLOCK')
    return provider() if provider else datetime.now(timezone.utc)


def database_url():
    return setting('TRACK_DATABASE_URL') or setting('DATABASE_URL')


def enabled():
    return str(setting('TRACK_ENABLED', '0')) == '1' and bool(database_url())


def connect():
    db = psycopg.connect(database_url(), row_factory=dict_row, connect_timeout=10)
    db.execute("SET LOCAL statement_timeout = '10s'")
    db.execute("SET LOCAL lock_timeout = '5s'")
    return db


def origin_allowed():
    allowed = set(ORIGINS)
    if current_app.testing:
        allowed |= {'http://localhost:8000', 'http://127.0.0.1:4173'}
    return request.headers.get('Origin') in allowed


def admin_configured():
    digest = setting('TRACK_ADMIN_HASH', '')
    secret = setting('TRACK_SIGNING_SECRET', '')
    return bool(re.fullmatch(r'[a-f0-9]{64}', digest) and len(secret) >= 32)


def serializer():
    return URLSafeTimedSerializer(setting('TRACK_SIGNING_SECRET'), salt='tpf-track-' + setting('TRACK_ADMIN_HASH'))


def authorized():
    if not admin_configured():
        return False
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer ') or len(header) > 1200:
        return False
    try:
        data = serializer().loads(header[7:], max_age=12 * 60 * 60)
        return data == {'scope': 'analytics-read'}
    except (BadSignature, SignatureExpired):
        return False


def login_limited():
    # No IP-based profiling. A high-entropy access code plus a per-worker cap.
    now = time.monotonic()
    with _login_lock:
        while _login_attempts and _login_attempts[0] < now - 60:
            _login_attempts.popleft()
        if len(_login_attempts) >= 12:
            return True
        _login_attempts.append(now)
    return False


@analytics_routes.after_request
def private_headers(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Robots-Tag'] = 'noindex, nofollow'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@analytics_routes.get('/analytics/status')
def status():
    return jsonify(enabled=enabled(), loginConfigured=admin_configured(), timezone='America/Moncton')


@analytics_routes.post('/analytics/login')
def login():
    if not origin_allowed():
        return jsonify(error='This sign-in must come from the store dashboard.'), 403
    if not enabled() or not admin_configured():
        return jsonify(error='Private reporting is not configured yet.'), 503
    if login_limited():
        return jsonify(error='Too many attempts. Wait a minute and try again.'), 429
    data = request.get_json(silent=True)
    code = data.get('code') if isinstance(data, dict) else None
    if not isinstance(code, str) or not 16 <= len(code) <= 200:
        return jsonify(error='The access code is incorrect.'), 401
    digest = hashlib.sha256(code.encode()).hexdigest()
    if not hmac.compare_digest(digest, setting('TRACK_ADMIN_HASH')):
        return jsonify(error='The access code is incorrect.'), 401
    return jsonify(token=serializer().dumps({'scope': 'analytics-read'}), expiresIn=43200)


def validated_event(data):
    if not isinstance(data, dict) or set(data) != {'event', 'page', 'source', 'campaign'}:
        raise ValueError('Invalid counter fields.')
    if any(not isinstance(value, str) for value in data.values()):
        raise ValueError('Invalid counter values.')
    event, page, source, campaign = (data[key] for key in ('event', 'page', 'source', 'campaign'))
    if event not in {'page_view', 'product_click'} or page not in PAGES:
        raise ValueError('Unknown page or event.')
    if event == 'product_click' and page not in PRODUCTS:
        raise ValueError('Inventory clicks require a product listing.')
    if source not in SOURCES or len(campaign) > 64:
        raise ValueError('Unknown source.')
    # Never persist arbitrary query text, which could contain private information.
    campaign = campaign if (source, campaign) in CAMPAIGN_MAP else ''
    return event, page, source, campaign


@analytics_routes.post('/analytics/collect')
def collect():
    if not origin_allowed():
        return '', 403
    if not enabled() or request.headers.get('Sec-GPC') == '1' or request.headers.get('DNT') == '1':
        return '', 204
    if BOT.search(request.headers.get('User-Agent', '')):
        return '', 204
    if request.content_length is None or request.content_length > 600:
        return '', 400
    try:
        event, page, source, campaign = validated_event(json.loads(request.get_data()))
    except (ValueError, TypeError, UnicodeDecodeError):
        return '', 400
    bucket = clock().astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    try:
        with connect() as db:
            db.execute('''INSERT INTO tpf_analytics.hourly_counts
                (bucket, event, page, source, campaign, count) VALUES (%s,%s,%s,%s,%s,1)
                ON CONFLICT (bucket,event,page,source,campaign)
                DO UPDATE SET count = hourly_counts.count + 1''',
                (bucket, event, page, source, campaign))
        return '', 204
    except psycopg.Error:
        # Do not log request data or retry ambiguously accepted counters.
        current_app.logger.warning('Anonymous counter storage unavailable')
        return '', 503


def report_range(started):
    today = clock().astimezone(ATLANTIC).date()
    period = request.args.get('period', '7')
    if period == 'today':
        start = today
    elif period in {'7', '28'}:
        start = today - timedelta(days=int(period) - 1)
    elif period == 'all':
        start = started.astimezone(ATLANTIC).date()
    else:
        raise ValueError('Choose a supported reporting period.')
    if (today - start).days > 366 * 10:
        raise ValueError('Reporting range is too large.')
    return period, start, today


@analytics_routes.get('/analytics/report')
def report():
    if not authorized():
        return jsonify(error='Sign in to view store statistics.'), 401
    if not enabled():
        return jsonify(error='Tracking is not enabled.'), 503
    source = request.args.get('source', 'all')
    if source != 'all' and source not in SOURCES:
        return jsonify(error='Choose a supported source.'), 400
    try:
        with connect() as db:
            row = db.execute("SELECT value FROM tpf_analytics.metadata WHERE key='started_at'").fetchone()
            started = datetime.fromisoformat(row['value'])
            period, start, today = report_range(started)
            begin = datetime.combine(start, datetime.min.time(), ATLANTIC)
            end = datetime.combine(today + timedelta(days=1), datetime.min.time(), ATLANTIC)
            rows = db.execute('''SELECT bucket, event, page, source, campaign, count
                FROM tpf_analytics.hourly_counts WHERE bucket >= %s AND bucket < %s
                AND (%s = 'all' OR source = %s) ORDER BY bucket''', (begin, end, source, source)).fetchall()
        # Collapse product/source dimensions before returning time series.
        hourly = period == 'today'
        series = {}
        if hourly:
            for hour in range(24):
                key = f'{hour:02}:00'
                series[key] = {'key': key, 'label': key, 'visits': 0, 'clicks': 0}
        else:
            for offset in range((today - start).days + 1):
                key = (start + timedelta(days=offset)).isoformat()
                series[key] = {'key': key, 'label': key, 'visits': 0, 'clicks': 0}
        sources, inventory = {}, {}
        for row in rows:
            local = row['bucket'].astimezone(ATLANTIC)
            key = local.strftime('%H:00') if hourly else local.date().isoformat()
            count = int(row['count'])
            series[key]['visits' if row['event'] == 'page_view' else 'clicks'] += count
            if row['event'] == 'page_view':
                campaign_key = (row['source'], row['campaign'])
                item = sources.setdefault(campaign_key, {'id': row['source'] + ':' + row['campaign'],
                    'source': row['source'], 'name': CAMPAIGN_MAP.get(campaign_key, {
                        'direct': 'Direct / unknown', 'kijiji': 'Kijiji', 'facebook': 'Facebook',
                        'google': 'Google', 'bing': 'Bing', 'other': 'Other referral'}[row['source']]),
                    'count': 0})
                item['count'] += count
            if row['page'] in PRODUCTS:
                coin = PRODUCTS[row['page']]
                item = inventory.setdefault(coin['id'], {'id': coin['id'], 'title': coin['title'], 'views': 0, 'count': 0})
                item['views' if row['event'] == 'page_view' else 'count'] += count
        return jsonify(start=start.isoformat(), end=today.isoformat(), startedAt=started.isoformat(),
            timezone='America/Moncton', hourly=hourly, buckets=list(series.values()),
            sources=sorted(sources.values(), key=lambda item: -item['count']),
            products=sorted(inventory.values(), key=lambda item: (-item['count'], -item['views'])),
            generatedAt=clock().isoformat())
    except ValueError as error:
        return jsonify(error=str(error)), 400
    except (psycopg.Error, TypeError, KeyError):
        current_app.logger.warning('Private aggregate report unavailable')
        return jsonify(error='Reporting is temporarily unavailable. Please try again.'), 503
