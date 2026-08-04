# NutriTracks-Release — Run Doc

This is a Capacitor web app whose frontend is a **fully static site** in `www/`.
There is no build step, no bundler, and no runtime dependencies to install —
the app loads its ES modules and CSS directly from disk. `node_modules`
(@capacitor/*) is only used for Android packaging, not for serving the web app.

## 1. Reproduce artifacts

Nothing to reproduce — there is no build output, no lockfile install step, and
no env/secret files (the app stores any user API keys in the browser's
localStorage at runtime, never in files).

- The served root is `www/` (contains `index.html`, `manifest.json`, `sw.js`,
  `css/`, `js/`, `icons/`).
- If `www/` is missing or stale, copy it from the main checkout
  (`rsync -a --delete /path/to/NutriTracks-Release/www/ ./www/`).

## 2. Run the server

A plain static file server is all that is required (ES modules are blocked on
`file://`, so serving over HTTP is mandatory). Python 3 is available system-wide.

**Use `.freebuff/serve.py`** (NOT bare `python3 -m http.server`): it serves the
`www/` directory with `Cache-Control: no-store`, which prevents the browser
from heuristically caching ES modules and serving stale `js/modules/*.js`
after a code change (this caused the charts to appear missing in previews).

```bash
nohup python3 .freebuff/serve.py 8000 \
  > .freebuff/preview-<thread-id>.log 2>&1 < /dev/null &
```

- Default port: **8000** (project default — the app itself defines none).
- Verify: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/` → `200`.
- Note: the app calls external APIs (Open Food Facts, Google Gemini) and
  registers a service worker (`sw.js`) — all fine over plain HTTP on localhost.
