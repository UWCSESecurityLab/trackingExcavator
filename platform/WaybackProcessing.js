function isWaybackResource(url) {
    var parser = document.createElement('a');
    parser.href = url;

    return parser.hostname === 'web.archive.org' && 
           parser.pathname.startsWith('/web/')   &&
           /\/web\/\d+\//.exec(parser.pathname) != null;
}

function getWaybackResource(url) {
  if (!isWaybackResource(url)) {
    return null;
  }

  var parser = document.createElement('a');
  parser.href = url;
  var archivedResource = /http.*/.exec(parser.pathname);
  return archivedResource;
}
