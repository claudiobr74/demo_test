"""Dev gateway — same-origin proxy so o browser não precisa alcançar :8000 direto.

Uso (com API em :8000 e Flutter web-server em :8080):
  python3 scripts/dev_gateway.py

Abra: http://127.0.0.1:3000
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

FLUTTER = "http://127.0.0.1:8080"
API = "http://127.0.0.1:8000"
HOST = "0.0.0.0"
PORT = 3000


class Gateway(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        print(f"[gateway] {self.address_string()} {fmt % args}")

    def _proxy(self, target_base: str) -> None:
        url = f"{target_base}{self.path}"
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else None
        headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower() not in {"host", "content-length", "connection"}
        }
        req = Request(url, data=body, headers=headers, method=self.command)
        try:
            with urlopen(req, timeout=60) as resp:
                data = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() in {"transfer-encoding", "connection", "content-encoding"}:
                        continue
                    self.send_header(k, v)
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
        except HTTPError as exc:
            data = exc.read()
            self.send_response(exc.code)
            self.send_header("Content-Type", exc.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except URLError as exc:
            msg = f'{{"code":"GATEWAY_UPSTREAM","message":"Upstream indisponível: {exc.reason}"}}'.encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/api") or self.path.startswith("/health") or self.path.startswith("/docs"):
            self._proxy(API)
        else:
            self._proxy(FLUTTER)

    def do_POST(self) -> None:  # noqa: N802
        self._proxy(API if self.path.startswith("/api") else FLUTTER)

    def do_PUT(self) -> None:  # noqa: N802
        self._proxy(API if self.path.startswith("/api") else FLUTTER)

    def do_PATCH(self) -> None:  # noqa: N802
        self._proxy(API if self.path.startswith("/api") else FLUTTER)

    def do_DELETE(self) -> None:  # noqa: N802
        self._proxy(API if self.path.startswith("/api") else FLUTTER)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._proxy(API if self.path.startswith("/api") else FLUTTER)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Gateway)
    print(f"SerenaPsi gateway em http://127.0.0.1:{PORT}")
    print(f"  app  -> {FLUTTER}")
    print(f"  api  -> {API}")
    server.serve_forever()
