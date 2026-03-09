import os
import logging
import urllib3
import requests
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Отключаем предупреждения про verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

# Конфигурация
HOST = os.getenv("MT_HOST")
USER = os.getenv("MT_USER")
PASS = os.getenv("MT_PASS")
# По умолчанию False для удобства работы с локальными сертификатами Mikrotik
VERIFY_SSL = os.getenv("MT_VERIFY_SSL", "False").lower() == "true"

# Проверка обязательных переменных
if not all([HOST, USER, PASS]):
    logger.error("Missing required environment variables: MT_HOST, MT_USER, or MT_PASS")

# Используем Session для оптимизации соединений (Keep-Alive)
session = requests.Session()
session.auth = (USER, PASS)
session.verify = VERIFY_SSL

def get_rules():
    url = f"https://{HOST}/rest/routing/rule"
    response = session.get(url, timeout=10)
    response.raise_for_status()
    return response.json()

def toggle_rule(rule_id, enable):
    action = "enable" if enable else "disable"
    url = f"https://{HOST}/rest/routing/rule/{action}"
    response = session.post(url, json={"numbers": rule_id}, timeout=10)
    return response.status_code

# ── ROUTES ──────────────────────────────────────

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/api/rules", methods=["GET", "POST"]) # Поддержка обоих методов для гибкости
def api_rules():
    try:
        rules = get_rules()
        return jsonify({"rules": rules})
    except requests.exceptions.RequestException as e:
        logger.error(f"Mikrotik API error: {e}")
        return jsonify({"error": "Failed to connect to Mikrotik", "details": str(e)}), 502
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/rule/toggle", methods=["POST"])
def api_toggle():
    try:
        data = request.get_json()
        rule_id = data.get("id")
        if not rule_id:
            return jsonify({"ok": False, "error": "Missing rule ID"}), 400
            
        enable = data.get("enable", True)
        status = toggle_rule(rule_id, enable)
        
        ok = status in (200, 204)
        return jsonify({"ok": ok, "status": status})
    except Exception as e:
        logger.error(f"Toggle error: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    # В продакшене рекомендуется использовать Gunicorn или Waitress
    port = int(os.getenv("PORT", 8080))
    logger.info(f"Starting app on port {port}")
    app.run(host="0.0.0.0", port=port)
