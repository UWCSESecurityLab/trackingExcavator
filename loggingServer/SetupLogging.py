#!./venv/bin/python

import logging

def setupLogging():
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG) #possible levels: DEBUG, INFO, WARNING, CRITICAL

    formatter = logging.Formatter('%(levelname)s [%(asctime)s]: %(message)s')

    fh = logging.FileHandler('server.log')
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(formatter)
    logger.addHandler(fh)

   # ch = logging.StreamHandler()
   # ch.setLevel(logging.DEBUG)
   # ch.setFormatter(formatter)
   # logger.addHandler(ch)
