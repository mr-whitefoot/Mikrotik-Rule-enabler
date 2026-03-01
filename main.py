from dotenv import load_dotenv
import requests, os


load_dotenv()

host = os.getenv("MT_HOST")
user = os.getenv("MT_USER")
password = os.getenv("MT_PASS")


def get_rules():
    response = requests.get(
        f"https://{host}/rest/routing/rule",
        auth=(user, password),
        verify=False
    )
    return response.json()


def toggle_rule(rule_id, enable):
    action = "enable" if enable else "disable"
    response = requests.post(
        f"https://{host}/rest/routing/rule/{action}",
        auth=(user, password),
        verify=False,
        json={"numbers": rule_id}
    )
    return response.status_code

def print_rules(rules):
    print("\n📋 Список правил маршрутизации:")
    print("-" * 50)
    for i, rule in enumerate(rules):
        status = "✅ включено" if rule.get("disabled") != "true" else "❌ выключено"
        comment = rule.get("comment", "без комментария")
        src = rule.get("src-address","")
        dst = rule.get("dst-address", "")
        table = rule.get("table", "")
        print(f"{i + 1}. [{status}] {comment} | src: {src} | dst: {dst} | table: {table}")
    print("-" * 50)

# Основной цикл
while True:
    rules = get_rules()
    print_rules(rules)

    print("\nВведите номер правила (или 'q' для выхода):")
    choice = input("> ").strip()

    if choice.lower() == "q":
        print("Выход...")
        break

    if not choice.isdigit() or int(choice) < 1 or int(choice) > len(rules):
        print("❌ Неверный номер, попробуй снова")
        continue

    rule = rules[int(choice) - 1]
    rule_id = rule.get(".id")
    is_disabled = rule.get("disabled") == "true"

    print(f"\nПравило: {rule.get('comment', rule_id)}")
    print(f"Текущий статус: {'❌ выключено' if is_disabled else '✅ включено'}")
    print("Что сделать? (1 - включить, 2 - выключить, Enter - отмена):")
    action = input("> ").strip()

    if action == "1":
        status = toggle_rule(rule_id, enable=True)
        print(f"✅ Включено (код ответа: {status})")
    elif action == "2":
        status = toggle_rule(rule_id, enable=False)
        print(f"❌ Выключено (код ответа: {status})")
    else:
        print("Отмена")
