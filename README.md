# TrackingExcavator

This is the measurement infrastructure for the paper "Rewriting History:
Changing the Archived Web from the Present", appearing CCS 2017. It is also the
release of the TrackingExcavator system from "Internet Jones and the Raiders of
the Lost Trackers: An Archaeological Study of Web Tracking from 1996 to 2016.",
which appeared in USENIX 2016. 

You can find the websites for the two papers at:

Internet Jones: https://trackingexcavator.cs.washington.edu
Rewriting History: https://rewritinghistory.cs.washington.edu

The system consists of several components which fit together in a way
quite reminiscent of a research prototype. The components are:

* The platform, a Chrome extension which automatically browses websites and
  snapshots, collecting data to be stored in the database.
* The Measure addon, which allows runs to be started with specified inputs,
  either through the browser or headlessly from the command line.
* The dorun scripts, which start headless runs.
* The loggingServer, which acts as an intermediary between the browser and the
  database, since browser extensions can't talk directly to MongoDB. 
* The databse, a MongoDB instance you must set up separately, which the
  loggingServer talks to.

We recommend performing all measurements in a VM. For example, we performed our
measurements for Rewriting History using Amazon EC2. Our procedure for using 
these tools was:

1. Set up a MongoDB instance on the measurement host.
2. Start the logging server.
3. Create a virtual frame buffer, something like `Xvfb :0 -screen 0 1024x768x24`.
   Chrome will need a place to render itself in the headless context, so we provide
   it with a virtual frame buffer.
4. In a separate terminal on your measurement host, configure your environment
   to use the virtual frame buffer, something like `export DISPLAY=:0`.
5. Use the dorun scripts to start Chrome. run.sh and testrun.sh provide
   examples of command lines we used in collecting measurements for our paper,
   and dorun.py documents all of its command-line options very well through
   docopt. You will need to configure it to take input from a list of domains,
   and to load the platform and Measure extensions from the place where they are
   on your host.

If you have trouble using the system, feel free to post in the Issues of this
Github project. Happy explorations!
