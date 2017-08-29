mocha.setup('tdd');

var expect = chai.expect;

// Tests for some methods in Measure.js.
suite('Measure.js', function() {
  setup(function() {});

  test('parseFile()', function() {
    var urls = parseFile('foo.com\nbar.com\nbaz.org\n\n\nrobots');
    expect(urls).to.be.an('array');
    expect(urls).to.have.length(4);  // Empty ones removed.
    expect(urls[0]).to.equal('foo.com');
  });
  test('parseFile() 0 URLs', function() {
    var urls = parseFile('');
    expect(urls).to.be.an('array');
    expect(urls).to.be.empty;
  });

  test('chunkURLs() evenly divisible', function() {
    var urls = ['foo.com', 'bar.com', 'baz.org', 'robots.awesome'];
    var numChunks = 2;
    var chunks = chunkURLs(urls, numChunks);

    expect(chunks).to.be.an('array');
    expect(chunks[0]).to.be.an('array');
    expect(chunks).to.have.length(numChunks);
    expect(chunks).all.have.length(urls.length/numChunks);
  });

  test('chunkURLs() not evenly divisible', function() {
    var urls = ['foo.com', 'bar.com', 'baz.org', 'robots.awesome', 'party.spoiler'];
    var numChunks = 2;
    var chunks = chunkURLs(urls, numChunks);

    expect(chunks).to.be.an('array');
    expect(chunks[0]).to.be.an('array');
    expect(chunks).to.have.length(numChunks);
    expect(chunks[0]).to.have.length(3);
    expect(chunks[1]).to.have.length(2);
  });

  test('chunkURLs() 1 URL', function() {
    var urls = ['foo.com'];
    var numChunks = 5; // Despite many chunks, 1 URL = 1 chunk
    var chunks = chunkURLs(urls, numChunks);

    expect(chunks).to.be.an('array');
    expect(chunks[0]).to.be.an('array');
    expect(chunks).to.have.length(1); // Only 1 URL.
    expect(chunks[0]).to.have.length(1);
  });

  test('chunkURLs() 0 URLs', function() {
    var urls = [];
    var numChunks = 5; // Despite many chunks, 0 URLs = 0 chunks
    var chunks = chunkURLs(urls, numChunks);

    expect(chunks).to.be.an('array');
    expect(chunks).to.be.empty;
  });
});


// mocha.checkLeaks();
mocha.globals(['jQuery']);
mocha.run();
