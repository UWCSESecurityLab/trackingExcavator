#!/bin/bash

./loggingServer.py -p 4004 --testing &
sleep 2   # Wait for server to finish booting up...
./ServerTests.py
kill $!
