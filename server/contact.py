"""Fixed-recipient contact delivery; no customer messages are stored locally."""
import hashlib
import json
import os
import re
import threading
import time
from collections import defaultdict, deque
from urllib.parse import quote
from urllib.request import Request, urlopen

from flask import Blueprint, current_app, jsonify, request


contact_routes = Blueprint('contact', __name__)
FORM_URL = 'https://www.toppocketfind.ca/'
ALLOWED_ORIGINS = {'https://www.toppocketfind.ca', 'https://toppocketfind.ca'}
EMAIL = re.compile(r'[^\s@]+@[^\s@]+\.[^\s@]+\Z')
_lock = threading.Lock()
_recent = defaultdict(deque)
_all_recent = deque()


def setting(name):
    value = current_app.config.get(name)
    return os.getenv(name) if value is None else value


def limited(email):
    """Best-effort per-worker limits, in addition to the relay's spam filters."""
    now = time.monotonic()
    key = hashlib.sha256(email.casefold().encode()).hexdigest()
    with _lock:
        while _all_recent and _all_recent[0] <= now - 60:
            _all_recent.popleft()
        for old_key in list(_recent):
            while _recent[old_key] and _recent[old_key][0] <= now - 600:
                _recent[old_key].popleft()
            if not _recent[old_key]:
                del _recent[old_key]
        if len(_all_recent) >= 20 or len(_recent[key]) >= 3:
            return True
        _recent[key].append(now)
        _all_recent.append(now)
    return False


def submit_to_relay(recipient, name, email, message):
    payload = {'name': name, 'email': email, 'message': message,
               '_replyto': email, '_subject': 'Top Pocket Find — website enquiry',
               '_template': 'table', '_url': FORM_URL}
    outgoing = Request('https://formsubmit.co/ajax/' + quote(recipient, safe='@.'),
                       data=json.dumps(payload).encode(), method='POST',
                       headers={'Content-Type': 'application/json', 'Accept': 'application/json',
                                'Referer': FORM_URL, 'Origin': FORM_URL.rstrip('/'),
                                'User-Agent': 'TopPocketFind-Contact/1.0'})
    with urlopen(outgoing, timeout=18) as response:
        result = json.loads(response.read(16384))
    return isinstance(result, dict) and result.get('success') in (True, 'true')


@contact_routes.post('/contact')
def contact():
    recipient = setting('CONTACT_RECIPIENT') or ''
    if setting('CONTACT_ENABLED') != '1' or not EMAIL.fullmatch(recipient):
        return jsonify(error='The contact form is temporarily unavailable. Please try again later.'), 503
    if request.headers.get('Origin') not in ALLOWED_ORIGINS:
        return jsonify(error='Please send your message from the Top Pocket Find website.'), 403
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error='Please check your message and try again.'), 400
    values = {}
    for key, maximum in (('name', 100), ('email', 254), ('message', 4000), ('website', 200)):
        value = data.get(key, '')
        if not isinstance(value, str) or len(value) > maximum:
            return jsonify(error='Please check the length of your contact details and message.'), 400
        values[key] = value.strip()
    if values['website']:
        return jsonify(submitted=True), 202  # Honeypot: never contact the relay.
    name, email, message = (values[key] for key in ('name', 'email', 'message'))
    if (not name or not message or not EMAIL.fullmatch(email)
            or any(c in name + email for c in '\r\n\x00')):
        return jsonify(error='Please add your name, a valid email address and a message.'), 400
    if limited(email):
        response = jsonify(error='Too many messages. Please wait a few minutes before trying again.')
        response.headers['Retry-After'] = '600'
        return response, 429
    try:
        if not submit_to_relay(recipient, name, email, message):
            raise ValueError('Relay did not accept submission')
    except Exception:
        # Do not put the recipient, visitor details, provider URL or body into logs.
        current_app.logger.warning('Contact submission could not be confirmed by the email relay')
        return jsonify(error='We couldn’t confirm submission. Your message is still here; please try again later.'), 502
    return jsonify(submitted=True), 202
