from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests, os, urllib3


# Отключаем предупреждения про verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()


load_dotenv()

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

host = os.getenv("MT_HOST")
user = os.getenv("MT_USER")
password = os.getenv("MT_PASS")


def get_rules():
    response = requests.get(
        f"https://{host}/rest/routing/rule",
        auth=(user, password),
        verify=False,
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def toggle_rule(rule_id, enable):
    action = "enable" if enable else "disable"
    response = requests.post(
        f"https://{host}/rest/routing/rule/{action}",
        auth=(user, password),
        verify=False,
        json={"numbers": rule_id},
        timeout=10
    )
    return response.status_code


# ── ROUTES ──────────────────────────────────────

@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/api/rules", methods=["POST"])
def api_rules():
    try:
        rules = get_rules()
        return jsonify({"rules": rules})
    except Exception as e:
        return jsonify({"error": str(e), "rules": []}), 500



@app.route("/api/rule/toggle", methods=["POST"])
def api_toggle():
    try:
        data    = request.get_json()
        rule_id = data.get("id")
        enable  = data.get("enable", True)
        status  = toggle_rule(rule_id, enable)
        ok = status in (200, 204)
        return jsonify({"ok": ok, "status": status})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ── START ────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
