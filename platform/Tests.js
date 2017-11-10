mocha.setup('tdd');

var expect = chai.expect;

// Tests for some methods in Measure.js.
suite('Platform Background.js', function() {
  toolbarURLs = [
    'https://web.archive.org/static/js/disclaim-element.js',
    'https://web.archive.org/static/js/analytics.js',
    'https://web.archive.org/static/js/graph-calc.js',
    'https://web.archive.org/static/jflot/jquery.min.js',
    'https://web.archive.org/static/images/toolbar/wayback-toolbar-logo.png',
    'https://web.archive.org/static/images/toolbar/wm_tb_prv_on.png',
    'https://web.archive.org/static/images/toolbar/wm_tb_nxt_on.png',
    'https://web.archive.org/static/images/toolbar/wm_tb_close.png',
    'https://web.archive.org/static/images/toolbar/wm_tb_help.png',
    'https://analytics.archive.org/0.gif?version=2&service=wb&server_name=wwwb-app8.us.archive.org&server_ms=4410&loadtime=970&timediff=-7&locale=en-US&referrer=https%3A%2F%2Fweb.archive.org%2Fweb%2F20150623172749%2Fhttp%3A%2F%2Fwww.cnn.com%2F%3Frefresh%3D1&count=9',
    'https://web.archive.org/web/jsp/graph.jsp?graphdata=500_27_1996:-1:000000000000_1997:-1:000000000000_1998:-1:000000000000_1999:-1:000000000000_2000:-1:000000000000_2001:-1:000000000000_2002:-1:000000111010_2003:-1:011100000000_2004:-1:000000000000_2005:-1:000000253678_2006:-1:860614453125_2007:-1:556775777986_2008:-1:111245537667_2009:-1:676666654426_2010:-1:545666697788_2011:-1:99a9999879ab_2012:-1:bccabccbbabb_2013:-1:cbcddcbbaadd_2014:-1:edededdeefee_2015:5:edeeed000000',
  ];

  nonToolbarURLs = [
    'http://google.com',  'https://google.com',
    'http://cnn.com',     'https://cnn.com',
    'http://archive.org', 'https://archive.org',
    'archive.org',        'archive.org',
    'cnn.com',            'cnn.com',
    '',
    'awiefjaoweijfoij23',
    '2394028394823',
    '20150304001529',
    'web.archive.org',
    'http://web.archive.org/web/20150324001529/http://www.google.com/',
    'https://web.archive.org/web/20150324001529/http://www.google.com/',
    'web.archive.org/web/20150324001529/http://www.google.com/',
    'http://web.archive.org', 'https://web.archive.org',
    'http://web.archive.org/web/http://www.google.com/',  // No date specified.
    'https://example.com/static/js/disclaim-element.js',
    'https://example.com/static/js/analytics.js',
    'https://example.com/static/js/graph-calc.js',
    'https://example.com/static/jflot/jquery.min.js',
    'https://example.com/static/images/toolbar/wayback-toolbar-logo.png',
    'https://example.com/static/images/toolbar/wm_tb_prv_on.png',
    'https://example.com/static/images/toolbar/wm_tb_nxt_on.png',
    'https://example.com/static/images/toolbar/wm_tb_close.png',
    'https://example.com/static/images/toolbar/wm_tb_help.png',
    'https://analytics.example.org/0.gif?version=2&service=wb&server_name=wwwb-app8.us.archive.org&server_ms=4410&loadtime=970&timediff=-7&locale=en-US&referrer=https%3A%2F%2Fweb.archive.org%2Fweb%2F20150623172749%2Fhttp%3A%2F%2Fwww.cnn.com%2F%3Frefresh%3D1&count=9',
  ];

  shouldEscapeBubbleURLs = [
    'http://google.com',  'https://google.com',
    'http://cnn.com',     'https://cnn.com',
    'http://archive.org', 'https://archive.org',
    'archive.org',        'archive.org',
    'cnn.com',            'cnn.com',
    '',
    null,
    undefined,
    'awiefjaoweijfoij23',
    '2394028394823',
    '20150304001529',
    'web.archive.org',
    'http://web.archive.org', 'https://web.archive.org',
    'http://web.archive.org/web/http://www.google.com/',  // No date specified.
  ];

  shouldNotEscapeBubbleURLs = [
    'http://web.archive.org/web/20150324001529/http://www.google.com/',
    'http://web.archive.org/web/20150324001529/http://www.cnn.com/',
    'https://web.archive.org/web/20150324001529/http://www.google.com/',
    'web.archive.org/web/20150324001529/http://www.google.com/',
  ];

  toArchiveURLs = [
    'http://archive.org',
    'https://archive.org',
    'archive.org',
    'www.archive.org',
    'http://web.archive.org/web/20150324001529/http://www.google.com/',
    'http://web.archive.org/web/20150324001529/http://www.cnn.com/',
    'https://web.archive.org/web/20150324001529/http://www.google.com/',
    'web.archive.org/web/20150324001529/http://www.google.com/',
  ];

  notToArchiveURLs = [
    'http://example.org',
    'https://example.org',
    'example.org',
    'www.example.org',
    'http://web.example.org/web/20150324001529/http://www.google.com/',
    'http://web.example.org/web/20150324001529/http://www.cnn.com/',
    'https://web.example.org/web/20150324001529/http://www.archive.org/',
    'web.example.org/web/20150324001529/http://www.archive.com/',
    'archive',
    'archive.com',
    'chive.org',
  ];

  setup(function() {});

  test('Escapes Bubble Tests', function() {
    shouldEscapeBubbleURLs.forEach(function(url) {
      expect(escapesBubble({url: url}), 'Should escape: ' + url).to.be.true;
    });

    shouldNotEscapeBubbleURLs.forEach(function(url) {
      expect(escapesBubble({url: url}), 'Should not escape: ' + url).to.be.false;
    });
  });

  test('Is to archive.org?', function() {
    toArchiveURLs.forEach(function(url) {
      expect(isToArchiveDotOrg({url: url}), 'To archive: ' + url).to.be.true;
    });

    notToArchiveURLs.forEach(function(url) {
      expect(isToArchiveDotOrg({url: url}), 'Not to archive: ' + url).to.be.false;
    });
  });

  test('Part of Wayback Toolbar?', function() {
    toolbarURLs.forEach(function(url) {
      expect(isPartOfWaybackToolbar({url: url}), 
             'Is part of toolbar (https): ' + url).to.be.true;

       url = url.replace('https', 'http');
       expect(isPartOfWaybackToolbar({url: url}), 
              'Is part of toolbar (http): ' + url).to.be.true;

       url = url.replace('http://', '');
       expect(isPartOfWaybackToolbar({url: url}), 
              'Is part of toolbar (no scheme): ' + url).to.be.true;
    });

    nonToolbarURLs.forEach(function(url) {
      expect(isPartOfWaybackToolbar({url: url}), 
             'Is not part of toolbar (https): ' + url).to.be.false;
    });

  });

  test('Get hostname from URL', function() {
    expect(getHostnameFromUrl('http://example.com')).to.equal('example.com');
    expect(getHostnameFromUrl('https://example.com')).to.equal('example.com');
    expect(getHostnameFromUrl('https://www.example.com')).to.equal('www.example.com');
    expect(getHostnameFromUrl('example.com')).to.equal('example.com');
    expect(getHostnameFromUrl('example.org')).to.equal('example.org');
    expect(getHostnameFromUrl('example-example.org')).to.equal('example-example.org');
    expect(getHostnameFromUrl('www.example-example.org')).to.equal('www.example-example.org');
    expect(getHostnameFromUrl('www.blah.example.com')).to.equal('www.blah.example.com');
    expect(getHostnameFromUrl('www.blah.example.com')).to.equal('www.blah.example.com');
    expect(getHostnameFromUrl('www.blah.example.co.uk')).to.equal('www.blah.example.co.uk');
    expect(getHostnameFromUrl('www.blah.example.com/http://google.com')).to.equal('www.blah.example.com');
    expect(getHostnameFromUrl('http://www.blah.example.com/http://google.com')).to.equal('www.blah.example.com');
    expect(getHostnameFromUrl('https://www.blah.example.com/http://google.com')).to.equal('www.blah.example.com');
    expect(getHostnameFromUrl('ws://localhost:8765')).to.equal('localhost');
    expect(getHostnameFromUrl('ws://localhost')).to.equal('localhost');
    expect(getHostnameFromUrl('localhost')).to.equal('localhost');
  });

  test('Has scheme?', function() {
    expect(hasScheme('www.example.com')).to.be.false;
    expect(hasScheme('www.example.com/withapath')).to.be.false;
    expect(hasScheme('www.example.com/withapathwithascheme/http://foo.com')).to.be.false;
    expect(hasScheme('localhost')).to.be.false;
    expect(hasScheme('localhost:8765')).to.be.false;
    expect(hasScheme('localhost:8765/withapath')).to.be.false;

    expect(hasScheme('http://www.example.com')).to.be.true;
    expect(hasScheme('http://www.example.com')).to.be.true;
    expect(hasScheme('ws://localhost:8765')).to.be.true;
    expect(hasScheme('ws://localhost')).to.be.true;
  });

  test('runNameAndLoggingServerSet', function() {
    expect(runNameAndLoggingServerSet()).to.be.false;

    run_name = 'something';
    logging_server = 'something';

    expect(runNameAndLoggingServerSet()).to.be.true;

    run_name = null;
    logging_server = 'something';

    expect(runNameAndLoggingServerSet()).to.be.false;

    run_name = 'something';
    logging_server = undefined;

    expect(runNameAndLoggingServerSet()).to.be.false;

    run_name = '';
    logging_server = undefined;
  });

  test('Should block request', function() {
    var blockedRequest = {
      'url': 'www.example.com',
    };
    var nonBlockedRequest = {
      'url': 'https://web.archive.org/web/20150824125730/http://www.att.com/',
    };
    var toolbarRequest = {
      'url': 'https://web.archive.org/static/js/disclaim-element.js',
    };

    
    // If wayback mode is false, we never block. So:
    waybackMode = false;
    expect(shouldBlock(nonBlockedRequest)).to.be.false;
    expect(shouldBlock(blockedRequest)).to.be.false;
    expect(shouldBlock(toolbarRequest)).to.be.false;

    // But when it's true...
    waybackMode = true;
    expect(shouldBlock(blockedRequest)).to.be.true;
    expect(shouldBlock(nonBlockedRequest)).to.be.false;
    expect(shouldBlock(toolbarRequest)).to.be.false;

  });

  test('Is Geolocation Function?', function() {
    var geolocationFunctions = [
      'navigator.geolocation.getCurrentPosition',
      'navigator.geolocation.watchPosition'
    ];
    var notGeolocationFunctions = [
      'navigator.geolocation.somethingElse',
      'navigator.geolocation.watchPositions',
      'garbage',
      '',
      null,
      undefined,
      0,
      true,
      false,
    ];

    geolocationFunctions.forEach(function(fn) {
      expect(isGeolocationFunction(fn)).to.be.true;
    });
    notGeolocationFunctions.forEach(function(fn) {
      expect(isGeolocationFunction(fn)).to.be.false;
    });
  });

  test('It should get values from dict arrays.', function() {
    var dictArray = [
      { name: 'foo', value: 'bar' },
      { name: 'dupekey', value: 'value1' },
      { name: 'dupekey', value: 'value2' },
      { doesnotfollowconvention: 'ohnoes', value: 'thisisbad' },
    ];

    expect(getValueFromDictionaryArray(dictArray, 'foo')).to.equal('bar');
    expect(getValueFromDictionaryArray(dictArray, 'dupekey')).to.equal('value1');

    expect(getValueFromDictionaryArray(dictArray, 'nokey')).to.be.null;
    expect(getValueFromDictionaryArray(dictArray, null)).to.be.null;
    expect(getValueFromDictionaryArray(dictArray, undefined)).to.be.null;
    expect(getValueFromDictionaryArray(dictArray, 0)).to.be.null;
    expect(getValueFromDictionaryArray(dictArray, 'doesnotfollowconvention')).to.be.null;
  });

  test('It should report the number of event failures so far.', function() {
    run_name = 'test_run_name';
    pass = 1;
    runEventCounts[run_name] = [];
    // First pass.
    runEventCounts[run_name][1] = { 'request_starts': 0,
                                    'request_ends': 0,
                                    'request_start_failures': 0,
                                    'request_end_failures': 0,
                                    'api': 0,
                                    'api_failures': 0,
                                    'cookie_sets': 0, 
                                    'cookie_set_failures': 0 };
    // Second pass.
    runEventCounts[run_name][2] = { 'request_starts': 0,
                                    'request_ends': 0,
                                    'request_start_failures': 0,
                                    'request_end_failures': 0,
                                    'api': 0,
                                    'api_failures': 0,
                                    'cookie_sets': 0, 
                                    'cookie_set_failures': 0 };

    expect(eventFailuresSoFarThisRunAndPass()).to.equal(0);

    runEventCounts[run_name][pass].request_start_failures++;
    expect(eventFailuresSoFarThisRunAndPass()).to.equal(1);

    runEventCounts[run_name][pass].request_start_failures += 10;
    expect(eventFailuresSoFarThisRunAndPass()).to.equal(11);

    runEventCounts[run_name][pass].request_end_failures += 200;
    runEventCounts[run_name][pass].cookie_set_failures += 3000;
    expect(eventFailuresSoFarThisRunAndPass()).to.equal(3211);
  });



});


// mocha.checkLeaks();
mocha.globals(['jQuery']);
mocha.run();
