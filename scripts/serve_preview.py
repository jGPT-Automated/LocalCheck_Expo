#!/usr/bin/env python3
"""Serve an Expo web export for local QA without stale bundles or route 404s."""

from __future__ import annotations

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        # Expo export currently emits a stable bundle filename in development
        # mode. Browsers can otherwise reuse the previous build after a restart.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        route_path = urlsplit(self.path).path
        requested = Path(self.translate_path(route_path))
        accepts_html = "text/html" in self.headers.get("Accept", "")
        is_client_route = not Path(route_path).suffix
        if not requested.exists() and (accepts_html or is_client_route):
            # Expo Router owns client routes. A direct /schedule or /court/:id
            # request should load the app shell instead of Python's 404 page.
            original_path = self.path
            self.path = "/index.html"
            try:
                return super().send_head()
            finally:
                self.path = original_path
        return super().send_head()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8081)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()

    handler = lambda *handler_args, **handler_kwargs: PreviewHandler(
        *handler_args,
        directory=args.directory,
        **handler_kwargs,
    )
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f"Serving HTTP on {args.bind} port {args.port} (no cache, SPA fallback)", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
