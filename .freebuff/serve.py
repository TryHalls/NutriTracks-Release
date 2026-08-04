#!/usr/bin/env python3
"""Dev static server for NutriTracks-Release preview.

Serves the www/ directory with Cache-Control: no-store so ES modules and
assets are never served stale during development (python3 -m http.server
sends no cache headers, which makes Chrome heuristic-cache modules).
"""
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'www')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


if __name__ == '__main__':
    handler = lambda *a, **kw: NoCacheHandler(*a, directory=ROOT, **kw)
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler).serve_forever()
