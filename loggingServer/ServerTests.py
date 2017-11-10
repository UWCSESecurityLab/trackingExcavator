#!./venv/bin/python

import requests
import unittest
import uuid
import json
import random
import asyncio
import websockets

class TestLoggingServer(unittest.TestCase):
    # def test_alive(self):
    #     r = requests.get('http://localhost:4004/alive')
    #     d = r.json()
    #     self.assertEqual(d['status'], 'ok')

    def test_insert_unique_run(self):
        payload = {'run_name': str(uuid.uuid4()), 'start_time': '2015-05-26'}
        self.hitEndpoint('logRunStart', payload, 'ok')

    def test_insert_duplicate_run(self):
        run_name = str(uuid.uuid4())
        payload = {'run_name': run_name, 'start_time': '2015-05-26'}
        self.hitEndpoint('logRunStart', payload, 'ok')
        self.hitEndpoint('logRunStart', payload, 'failed')

    def test_forget_to_provide_end_time_for_run_end(self):
        run_name = str(uuid.uuid4())
        payload = {'run_name': run_name}
        self.hitEndpoint('logRunStart', payload, 'ok')
        self.hitEndpoint('logRunEnd', payload, 'failed')  # Forgot end time, fails.

    def test_log_event_start(self):
        run_name = str(uuid.uuid4())
        payload = {'run_name': run_name}
        self.hitEndpoint('logRunStart', payload, 'ok')

        payload = {'run_name': run_name, 
                   'request_id': random.randrange(2**32), 
                   'type': 'request'}
        self.hitEndpoint('logRequestEventStart', payload, 'ok')

    def test_log_event_with_no_run_name(self):
        run_name = str(uuid.uuid4())
        payload = {'run_name': run_name}
        self.hitEndpoint('logRunStart', payload, 'ok')

        payload = {'type': 'request', 'request_id': random.randrange(2**32)}
        self.hitEndpoint('logRequestEventStart', payload, 'failed')

    def test_log_event_with_no_request_id(self):
        run_name = str(uuid.uuid4())
        payload = {'run_name': run_name}
        self.hitEndpoint('logRunStart', payload, 'ok')

        payload = {'type': 'request'}
        self.hitEndpoint('logRequestEventStart', payload, 'failed')

    def test_log_run_end(self):
        run_name = str(uuid.uuid4())
        payload = {'run_name': run_name}
        self.hitEndpoint('logRunStart', payload, 'ok')

        payload = {'run_name': run_name, 'end_time': '12:15'}
        self.hitEndpoint('logRunEnd', payload, 'ok')


    def test_log_event_end(self):
        run_name = str(uuid.uuid4())
        payload = {'run_name': run_name}
        self.hitEndpoint('logRunStart', payload, 'ok')

        request_id = random.randrange(2**32)
        payload = {'run_name': run_name, 'request_id': request_id}
        self.hitEndpoint('logRequestEventStart', payload, 'ok')

        payload = {'run_name': run_name, 'request_id': request_id,
                   'response_code': 200,
                   'response_time': '123938235',
                   'response_headers': 'foo bar headers',
                   'response_content': None}

        self.hitEndpoint('logRequestEventEnd', payload, 'ok')

    def test_log_event_end_before_start(self):
        run_name = str(uuid.uuid4())
        payload = {'run_name': run_name}
        self.hitEndpoint('logRunStart', payload, 'ok')

        request_id = random.randrange(2**32)
        payload = {'run_name': run_name, 'request_id': request_id,
                   'response_code': 200,
                   'response_time': '123938235',
                   'response_headers': 'foo bar headers',
                   'response_content': None}        
        
        self.hitEndpoint('logRequestEventEnd', payload, 'ok')

        payload = {'run_name': run_name, 'request_id': request_id}

        self.hitEndpoint('logRequestEventStart', payload, 'ok')

    def test_log_navigation_completed(self):
        run_name = str(uuid.uuid4())

        payload = {
            'run_name': run_name,
            'pass': 1,
            'type': 'navigationCompleted',
            'tabId': 100,
            'url': 'http://example.com',
            'processId': 200,
            'frameId': 300,
            'timestamp': 2000000
        }
        self.hitEndpoint('logNavigationCompletedEvent', payload, 'ok')

    def test_log_navigation_error(self):
        run_name = str(uuid.uuid4())

        payload = {
            'run_name': run_name,
            'pass': 1,
            'type': 'navigationError',
            'tabId': 100,
            'url': 'http://example.com',
            'processId': 200,
            'frameId': 300,
            'timestamp': 2000000,
            'error': 'This is an error, a description of an error, this is not the error, the error was in the machine.',
        }
        self.hitEndpoint('logNavigationErrorEvent', payload, 'ok')

    def test_log_request_error(self):
        run_name = str(uuid.uuid4())
        request_id = random.randrange(2**32)

        payload = {
            'run_name': run_name,
            'request_id': request_id,
            'error_details': 'This error can be any object.',
        }
        self.hitEndpoint('logRequestErrorEvent', payload, 'ok')

    def test_log_request_error_update(self):
        run_name = str(uuid.uuid4())
        request_id = random.randrange(2**32)

        payload = {'run_name': run_name, 
                   'request_id': request_id,
                   'type': 'request'}
        self.hitEndpoint('logRequestEventStart', payload, 'ok')

        payload = {
            'run_name': run_name,
            'request_id': request_id,
            'error': 'This error can be any object.',
        }
        self.hitEndpoint('logRequestErrorEvent', payload, 'ok')

    def test_log_dom_content(self):
        run_name = str(uuid.uuid4())
        html = 'a'
        payload = { 'run_name': run_name, 
                    'top_url': 'http://www.example.com',
                    'type': 'DOMContent',
                    'dom_html': html,
        }
        self.hitEndpoint('logDomContentEvent', payload, 'ok')
        payload['dom_html'] = 'A' * 5 * 1024 * 1024
        self.hitEndpoint('logDomContentEvent', payload, 'ok')

    def test_log_fingerprint_api(self):
        run_name = str(uuid.uuid4())
        payload = { 
            'run_name': run_name, 
            'type': 'fingerprintApiEvent',
            'top_url': 'http://www.example.com',
            'setting_script_url': 'http://www.example.com/script.js',
            'api_name': 'navigator.testEvent.foo',
            'timestamp': 2000000,
            'pass': 1,
        }
        self.hitEndpoint('logFingerprintApiEvent', payload, 'ok')

    def hitEndpoint(self, endpoint, payload, expectedStatus):
        r = asyncio.get_event_loop().run_until_complete(self.sendMessage(
            json.dumps({'messageType': endpoint, 
                        'content': payload })
        ))
        d = json.loads(r)
        errmsg = ""
        if 'error_string' in d:
            errmsg = d['error_string']
        self.assertEqual(d['status'], expectedStatus, msg=d)


    @asyncio.coroutine
    def sendMessage(self, message):
        websocket = yield from websockets.connect('ws://localhost:4004/')
        yield from websocket.send(message)
        response = yield from websocket.recv()
        return response


if __name__ == '__main__':
    unittest.main()
