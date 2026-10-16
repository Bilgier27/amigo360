import os
import sys
import json
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Asegurar codificacion UTF-8 en consola Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

PORT = int(os.environ.get("PORT", 8000))
DATA_FILE = os.path.join(os.path.dirname(__file__), "data.json")

CURRENT_DATA = None

def load_data():
    global CURRENT_DATA
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                CURRENT_DATA = json.load(f)
                return CURRENT_DATA
        except Exception:
            pass
    return None

def save_data(data):
    global CURRENT_DATA
    CURRENT_DATA = data
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error al guardar data.json:", e)

class AmigoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        directory = os.path.dirname(os.path.abspath(__file__))
        super().__init__(*args, directory=directory, **kwargs)

    def do_GET(self):
        if self.path == "/api/db":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            data = CURRENT_DATA or load_data() or {}
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
            return

        if self.path == "/favicon.ico":
            fav_path = os.path.join(os.path.dirname(__file__), "favicon.ico")
            if os.path.exists(fav_path):
                self.send_response(200)
                self.send_header("Content-Type", "image/x-icon")
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                with open(fav_path, "rb") as f:
                    self.wfile.write(f.read())
                return
            self.send_response(204)
            self.end_headers()
            return

        if self.path == "/" or self.path == "":
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self):
        if self.path == "/api/db":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                save_data(data)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "version": data.get("version")}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode("utf-8"))
            return

        super().do_POST()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        # Silenciar logs ruidosos de polling de manera segura
        try:
            msg = format % args
            if "/api/db" in msg:
                return
            super().log_message(format, *args)
        except Exception:
            pass

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def run_server():
    load_data()
    ip = get_local_ip()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), AmigoHandler)
    print("=" * 60)
    print("SERVIDOR AMIGO 360 INICIADO CON EXITO")
    print(f"• En tu computador:   http://localhost:{PORT}")
    print(f"• Desde tu celular:   http://{ip}:{PORT}")
    print("=" * 60)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")

if __name__ == "__main__":
    run_server()
