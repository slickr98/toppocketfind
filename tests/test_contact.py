import json
import unittest
from unittest.mock import MagicMock, patch

from server.app import app
from server import contact


class ContactTests(unittest.TestCase):
    def setUp(self):
        self.saved_config = app.config.copy()
        app.config.update(TESTING=True, CONTACT_ENABLED='1', CONTACT_RECIPIENT='owner@example.com')
        self.client = app.test_client()
        self.headers = {'Origin': 'https://www.toppocketfind.ca'}
        self.message = dict(name='A collector', email='buyer@example.com', message='Is the coin available?', website='')
        contact._recent.clear()
        contact._all_recent.clear()
        self.relay = patch.object(contact, 'submit_to_relay', return_value=True)
        self.send = self.relay.start()

    def tearDown(self):
        self.relay.stop()
        app.config.clear()
        app.config.update(self.saved_config)

    def post(self, **changes):
        return self.client.post('/contact', json=self.message | changes, headers=self.headers)

    def test_success_uses_only_the_configured_recipient(self):
        response = self.post(recipient='attacker@example.com', _cc='attacker@example.com', name=' A collector ')
        self.assertEqual(response.status_code, 202)
        self.assertTrue(response.get_json()['submitted'])
        self.send.assert_called_once_with('owner@example.com', 'A collector', 'buyer@example.com', 'Is the coin available?')
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], self.headers['Origin'])

    def test_invalid_fields_never_reach_the_relay(self):
        for changes in ({'email': 'invalid'}, {'name': ' '}, {'message': ''}, {'name': 'x' * 101},
                        {'email': 'x' * 255}, {'message': 'x' * 4001}, {'email': 'buyer@example.com\r\nBcc:a@b.com'},
                        {'name': 'a\nb'}, {'name': True}, {'message': []}):
            self.assertEqual(self.post(**changes).status_code, 400, changes)
        self.assertEqual(self.client.post('/contact', json=[], headers=self.headers).status_code, 400)
        self.send.assert_not_called()

    def test_foreign_or_missing_origin_rejected(self):
        for headers in ({}, {'Origin': 'https://other.example'}):
            self.assertEqual(self.client.post('/contact', json=self.message, headers=headers).status_code, 403)
        self.send.assert_not_called()

    def test_disabled_and_unconfigured(self):
        for value in ('0', None):
            app.config['CONTACT_ENABLED'] = value
            self.assertEqual(self.post().status_code, 503)
        app.config.update(CONTACT_ENABLED='1', CONTACT_RECIPIENT='')
        self.assertEqual(self.post().status_code, 503)
        self.send.assert_not_called()

    def test_honeypot_does_not_send_email(self):
        self.assertEqual(self.post(website='spam.example').status_code, 202)
        self.send.assert_not_called()

    def test_failures_never_report_success(self):
        for outcome in (False, TimeoutError('network failure')):
            self.send.return_value = outcome
            self.send.side_effect = outcome if isinstance(outcome, Exception) else None
            response = self.post()
            self.assertEqual(response.status_code, 502)
            self.assertNotIn('submitted', response.get_json())
            self.assertNotIn('owner@example.com', response.get_data(as_text=True))

    def test_rate_limit_and_recovery(self):
        with patch.object(contact.time, 'monotonic', return_value=1000):
            for _ in range(3):
                self.assertEqual(self.post().status_code, 202)
            response = self.post()
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.headers['Retry-After'], '600')
        with patch.object(contact.time, 'monotonic', return_value=1601):
            self.assertEqual(self.post().status_code, 202)

    def test_relay_request_contains_reply_address_and_fixed_site(self):
        self.relay.stop()
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"success":"true"}'
        with patch.object(contact, 'urlopen', return_value=response) as transport:
            self.assertTrue(contact.submit_to_relay('owner@example.com', 'Collector', 'buyer@example.com', 'Question'))
            outgoing = transport.call_args.args[0]
            payload = json.loads(outgoing.data)
            self.assertEqual(outgoing.full_url, 'https://formsubmit.co/ajax/owner@example.com')
            self.assertEqual(payload['_replyto'], 'buyer@example.com')
            self.assertEqual(payload['_url'], 'https://www.toppocketfind.ca/')
            self.assertNotIn('_cc', payload)
            self.assertEqual(transport.call_args.kwargs['timeout'], 18)
        self.relay.start()


if __name__ == '__main__':
    unittest.main()
