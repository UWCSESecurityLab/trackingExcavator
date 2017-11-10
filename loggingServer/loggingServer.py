#!./venv/bin/python
"""Hammer event logging server.

Usage:
  loggingServer.py [-p PORT] [--mongoport PORT] [--testing]
  loggingServer.py (-h | --help)
  loggingServer.py --version

Options:
  -h --help         Show this screen.
  --version         Show version.
  -p --port PORT    Set port to listen on.
  --testing         Set server to testing mode.
  --mongoport PORT  Set mongo port.
"""

from docopt import docopt
import flask
from flask import Flask, Response, request, jsonify
import logging
import SetupLogging
import pymongo
import gridfs
import atexit
import asyncio
import websockets
import json
import sys

app = Flask(__name__)
FLASK_DEBUG = True
version = '0.0.1'
SetupLogging.setupLogging()
mongo = None
port = 8765
db = None
fs = None

###############################
########## Endpoints ##########
###############################
@asyncio.coroutine
def receiveMessage(websocket, path):
  while True:
    message = yield from websocket.recv()
    logging.debug('raw message: ' + str(message))
    try:
      content = json.loads(message)
      if 'messageType' not in content:
        response = {'status': 'failed', 
                    'messageType': None,
                    'error_string': 'Message must have messageType'}
        
      elif content['messageType'] == 'alive':
        response = alive()
      elif 'content' not in content:
        response = {'status': 'failed',
                    'messageType': content['messageType'],
                    'error_string': 'Message must have content'}
      elif content['messageType'] == 'logRunStart':
        response = logRunStart(content['content'])
      elif content['messageType'] == 'logRunEnd':
        response = logRunEnd(content['content'])
      elif content['messageType'] == 'logRequestEventStart':
        response = logRequestEventStart(content['content'])
      elif content['messageType'] == 'logRequestEventEnd':
        response = logRequestEventEnd(content['content'])
      elif content['messageType'] == 'logProgrammaticCookieSetEvent':
        response = logProgrammaticCookieSetEvent(content['content'])
      elif content['messageType'] == 'logFingerprintApiEvent':
        response = logFingerprintApiEvent(content['content'])
      elif content['messageType'] == 'logNavigationCompletedEvent':
        response = logNavigationCompletedEvent(content['content'])
      elif content['messageType'] == 'logNavigationErrorEvent':
        response = logNavigationErrorEvent(content['content'])
      elif content['messageType'] == 'logRequestErrorEvent':
        response = logRequestErrorEvent(content['content'])
      elif content['messageType'] == 'logDomContentEvent':
        response = logDomContentEvent(content['content'])
      elif content['messageType'] == 'consoleLog':
        response = consoleLog(content['content'])
      else:
        response = {'status': 'failed', 
                    'messageType': content['messageType'],
                    'error_string': 'messageType %s not recognized.' % (content['messageType'])}
    except Exception as error:
      logging.exception(error)
      response = {'status': 'failed', 
                  'messageType': None,
                  'error_string': 'Message could not be parsed.'}
      
    logging.debug('sending back ' + json.dumps(response))
    yield from websocket.send(json.dumps(response))


def logRunStart(content):
  if 'run_name' not in content:
    return {'status': 'failed', 
            'messageType': 'logRunStart',
            'error_string': 'Must specify run_name of run.'}
  try: 
    mongo[db].run.insert_one(content)
    logging.debug('Run <%s> start' % content['run_name'])
    return {'status': 'ok', 
            'messageType': 'logRunStart'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'logRunStart',
            'error_string': str(error)}

def logRunEnd(content):
  if 'run_name' not in content:
    return {'status': 'failed', 
            'messageType': 'logRunEnd',
            'error_string': 'Must specify run_name of event.'}
  elif 'end_time' not in content:
    return {'status': 'failed', 
            'messageType': 'logRunEnd',
            'error_string': 'Must specify end time of run.'}
  try:
    query = {'run_name': content['run_name']}
    updateParam = {'$set': content}
    
    mongo[db].run.update_one(query, updateParam)
    logging.debug('Run <%s> end' % content['run_name'])
    return {'status': 'ok', 
            'messageType': 'logRunEnd'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'logRunEnd',
            'error_string': str(error)}

def logRequestEventStart(content):
  if 'run_name' not in content:
    return {'status': 'failed', 
            'messageType': 'logRequestEventStart',
            'error_string': 'Event must be associated with a run_name.'}
  try: 
    query = {'run_name': content['run_name'], 
             'request_id': content['request_id']}
    updateParam = {'$set': content}
    mongo[db].requestEvent.update_one(query, updateParam, upsert=True)
    return {'status': 'ok', 'messageType': 'logRequestEventStart'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'logRequestEventStart',
            'error_string': str(error)}

def logRequestEventEnd(content):
  try:
    query = {'run_name': content['run_name'], 
             'request_id': content['request_id']}
    updateParam = {'$set': content}

    mongo[db].requestEvent.update_one(query, updateParam, upsert=True)
    return {'status': 'ok', 'messageType': 'logRequestEventEnd'}
  except Exception as error:
    return {'status': 'failed',
            'messageType': 'logRequestEventEnd', 
            'error_string': str(error)}

def logProgrammaticCookieSetEvent(content):
  try:
    mongo[db].programmaticCookieSetEvent.insert_one(content)
    return {'status': 'ok', 'messageType': 'logProgrammaticCookieSetEvent'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'logProgrammaticCookieSetEvent', 
            'error_string': str(error)}

def logFingerprintApiEvent(content):
  try:
    mongo[db].fingerprintApiEvent.insert_one(content)
    return {'status': 'ok', 'messageType': 'logFingerprintApiEvent'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'logFingerprintApiEvent', 
            'error_string': str(error)}

'''Content is the entire details object from webNavigation.onCompleted, 
   plus run_name and pass and type.'''
def logNavigationCompletedEvent(content):
  try:
    mongo[db].navigationCompletedEvent.insert_one(content)
    return {'status': 'ok', 'messageType': 'logNavigationCompletedEvent'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'logNavigationCompletedEvent', 
            'error_string': str(error)}

'''Content is the entire details object from webNavigation.onErrorOccurred,
   plus run_name and pass and type.'''
def logNavigationErrorEvent(content):
  try:
    mongo[db].navigationErrorEvent.insert_one(content)
    return {'status': 'ok', 'messageType': 'logNavigationErrorOccurredEvent'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'logNavigationErrorOccurredEvent', 
            'error_string': str(error)}

'''requestErrorEvents look like request events with only their run_name, request_id,
   and error fields set.'''
def logRequestErrorEvent(content):
  try:
    query = {'run_name': content['run_name'], 
             'request_id': content['request_id']}
    updateParam = {'$set': content}
    mongo[db].requestEvent.update_one(query, updateParam, upsert=True)
    return {'status': 'ok', 'messageType': 'logRequestErrorEvent'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'logRequestErrorEvent', 
            'error_string': str(error)}

def logDomContentEvent(content):
  try:
    htmlFileID = fs.put(content['dom_html'], encoding='utf-8')
    pointer = content
    pointer['dom_html_file_id'] = htmlFileID
    del pointer['dom_html'] 
    mongo[db].domContent.insert_one(pointer)
    return {'status': 'ok', 'messageType': 'logDomContentEvent'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'logDomContentEvent', 
            'error_string': str(error)}

def consoleLog(content):
  try:
    print(content['consoleMessage'])
    sys.stdout.flush();
    return {'status': 'ok', 'messageType': 'consoleLog'}
  except Exception as error:
    return {'status': 'failed', 
            'messageType': 'consoleLog', 
            'error_string': str(error)}


def alive():
  try: 
    mongo.test.abcd.insert({})
    return {'status': 'ok', 'messageType': 'alive'}
  except Exception as error:
    return {'status': 'failed',
            'messageType': 'alive', 
            'error_string': str(error)}


# We register this as an at-exit handler in order to clean up the test environment
# after testing. If we didn't do this, we could have erroneous results if
# subsequent tests depended on the state of the database. We could also just have
# space taken up by test stuff.
def dropTestDB():
  logging.info('Dropping "test" database at end of testing operation.')
  mongo.drop_database('test')


###########################
########## MAIN ###########
###########################
if __name__ == '__main__':
  arguments = docopt(__doc__, version=version)
  logging.debug('Logging server run with the following arguments: \n%s' % (arguments))
  if arguments['--port'] != None:
    port = int(arguments['--port'])
    logging.debug('Using provided port %d ' % port)
  else: 
    logging.debug('No port given, using default of %d' % port)

  if arguments['--testing']:
    db = 'test'
    atexit.register(dropTestDB)
  else:
    db = 'hammer'

  if arguments['--mongoport']:
    mongoport = int(arguments['--mongoport'])
  else:
    mongoport = 27017
    
  # Assume localhost & standard port.
  mongo = pymongo.MongoClient(socketKeepAlive=True, port=mongoport)

  # Ensure there's a unique constraint on run_name.
  # It's okay to create this multiple times -- it's a no-op if it already exists.
  print('Creating/ensuring indexes. This can take a long time...')
  print('Index: run_name on run collection...')
  mongo[db].run.create_index('run_name', unique=True)
  print('Index: run_name/request_id on requestEvent collection...')
  mongo[db].requestEvent.create_index([('run_name', pymongo.ASCENDING),
                                       ('request_id', pymongo.ASCENDING)],
                                      unique=True)
  print('Index: run_name/tabId on requestEvent collection...')
  mongo[db].requestEvent.create_index([('run_name', pymongo.ASCENDING),
                                       ('tabId', pymongo.ASCENDING)])
  print('Index: run_name on programmaticCookieSetEvent collection...')
  mongo[db].programmaticCookieSetEvent.create_index([('run_name', pymongo.ASCENDING)])
  print('Index: run_name on navigationCompletedEvent collection...')
  mongo[db].navigationErrorEvent.create_index([('run_name', pymongo.ASCENDING)])
  print('Index: run_name on navigationCompletedEvent collection...')
  mongo[db].navigationCompletedEvent.create_index([('run_name', pymongo.ASCENDING), ('tabId', pymongo.ASCENDING)])
  print('Index: run_name/tabId on navigationCompletedEvent collection...')
  mongo[db].navigationCompletedEvent.create_index([('run_name', pymongo.ASCENDING)])
  print('Index: run_name/error_details on requestEvent collection...')
  mongo[db].requestEvent.create_index([('run_name', pymongo.ASCENDING),
                                       ('error_details', pymongo.ASCENDING)])
  print('Index: run_name/response_time/request_time on requestEvent collection...')
  mongo[db].requestEvent.create_index([('run_name', pymongo.ASCENDING), 
                                       ('response_time', pymongo.ASCENDING),
                                       ('request_time', pymongo.ASCENDING)])
  print('Index: run_name/window_type on requestEvent collection...')
  mongo[db].requestEvent.create_index([('run_name', pymongo.ASCENDING),
                                       ('window_type', pymongo.ASCENDING)])
  print('Index: run_name/input_site on requestEvent collection...')
  mongo[db].requestEvent.create_index([('run_name', pymongo.ASCENDING),
                                       ('input_site', pymongo.ASCENDING)])
  print('Index: run_name/resource_type on requestEvent collection...')
  mongo.hammer.requestEvent.create_index([('run_name', pymongo.ASCENDING),
                                        ('resource_type', pymongo.ASCENDING)])
  print('Done with indexes.')
  print('Starting server on port %d' % port)

  fs = gridfs.GridFS(mongo[db])

  class LargeMaxSizeProto(websockets.server.WebSocketServerProtocol):
      def __init__(self, *args, **kwargs):
          kwargs['max_size'] = 2 ** 32
          super().__init__(*args, **kwargs)

  start_server = websockets.serve(receiveMessage, 'localhost', port, klass=LargeMaxSizeProto)

  asyncio.get_event_loop().run_until_complete(start_server)
  asyncio.get_event_loop().run_forever()

  # Start server.
  app.run(port=port, debug=FLASK_DEBUG)

