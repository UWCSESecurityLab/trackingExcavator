#!./venv/bin/python3
"""Utility that starts a headless hammer run.

Use this utility from the Measure directory.

Usage: dorun.py [options] <inputFile> 

-p PARALLELISM --parallelism PARALLELISM    Number of parallel tabs [default: 4].
-t TIMEONPAGE --timeOnPage TIMEONPAGE       Seconds to spend on each page [default: 40].
-m MODE --mode MODE                         Mode 'wayback' or 'normal' [default: normal].
-n NOTES --notes NOTES                      Notes field [default: ].
-l LINKS --linksToVisit LINKS               Number of links to visit per page [default: 0].
-s SERVERURL --server SERVERURL             URL of the logging server [default: ws://localhost:8765].
-r REPEATS --repeats REPEATS                Number of times to repeat [default: 0].
--waybackTime WAYBACKTIME                   Wayback mode timestamp (e.g. 20050901000000).
--platformLocation PLATFORMFOLDER           Location of the platform extension's unpacked folder.
--measureLocation MEASUREFOLDER             Location of the measure extension's unpacked folder.
--noSecondPass                              Don't do a second pass. [default: false]

dorun.py (-h | --help)
dorun.py --version

Options:
  -h --help         Show this screen.
  --version         Show version.
"""

from docopt import docopt
import json
import sys
import os
import subprocess


if __name__ == '__main__':
    arguments = docopt(__doc__, version='0.1')
    print(arguments)

    mode = arguments['--mode']
    notes = arguments['--notes']
    parallelism = arguments['--parallelism']
    timeOnPage = arguments['--timeOnPage']
    repeats = arguments['--repeats']
    loggingServer = arguments['--server']
    linksToVisit = arguments['--linksToVisit']
    waybackTime = arguments['--waybackTime']
    platformLocation = arguments['--platformLocation']
    measureLocation = arguments['--measureLocation']
    secondPass = not arguments['--noSecondPass']
    
    inputFile = arguments['<inputFile>']

    # Validate arguments.
    if mode not in ('normal', 'wayback'):
        print('Mode must be either wayback or normal.')
        sys.exit(-1)
    if mode == 'wayback' and waybackTime == None:
        print('Wayback mode requires waybackTime. The past is a big place!')
        sys.exit(-1)

    try:
        parallelism = int(parallelism)
        timeOnPage = int(timeOnPage)
        repeats = int(repeats)
        linksToVisit = int(linksToVisit)
    except ValueError as e:
        print('Needed an integer value for -p/-t/-r/-l: %s' % e)
        sys.exit(-1)

    # inputFile must be a file that exists. Read in its lines.
    if not os.path.exists(inputFile):
        print('Input file %s does not exist.' % inputFile)
        sys.exit(-1)
    
    with open(inputFile, 'r') as f:
        urls = f.readlines()
        urls = [url.strip() for url in urls]
        urls = json.dumps(urls, indent=4)


    # Create Config.js and UrlList.js files.
    configJSON = json.dumps({
        'secondPass': secondPass,
        'urls': [],
        'loggingServerName': loggingServer,
        'waybackMode': mode == 'wayback',
        'notes': notes,
        'toId': 'obheeflpdipmaefcoefhimnaihmhpkao',
        'numChunks': parallelism,
        'add_date_to_run_name': True,
        'waybackTime': waybackTime,
        'clearData': True,
        'repeatRuns': repeats,
        'loadtime': timeOnPage,
        'links': linksToVisit,
        'run_name': 'run'
    }, indent=4)

    urlListJS = 'cfg.urls = %s' % urls  # \n required because Unix.
    configJS = 'var cfg = %s' % configJSON

    with open('../Measure/UrlList.js', 'w') as f:
        f.write(urlListJS)
    with open('../Measure/Config.js', 'w') as f:
        f.write(configJS)


    # Execute google-chrome.
    cmd = ['google-chrome-stable',
           '--disable-popup-blocking',
           '--disable-nacl',
           '--disable-gpu-sandbox',
           '--disable-gpu',
           '--use-pure-views',
           '--load-extension=%s,%s' % (platformLocation, measureLocation), 
           'redirect.html']
    print(cmd)
    subprocess.call(cmd)
    



