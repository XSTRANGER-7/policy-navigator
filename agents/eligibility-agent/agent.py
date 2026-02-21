from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, time, json

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5002))

config = AgentConfig(
    name="Eligibility Agent",
    description="Evaluates citizen eligibility for all schemes using a multi-criteria rule engine",
    capabilities={
        "services": ["eligibility_check"],
        "ai": ["rule_engine"],
        "protocols": ["http"]
    },
    mode="webhook",
    webhook_host="0.0.0.0",
    webhook_port=port,
    registry_url="https://registry.zynd.ai",
    api_key=os.environ.get("ZYND_API_KEY")
)

agent = ZyndAIAgent(config)
print(f"[Eligibility Agent] Running on port {port} | ID: {agent.agent_id}")


def check_scheme_eligibility(citizen: dict, scheme: dict) -> dict:
    """Apply rule engine to check if citizen is eligible for a scheme."""
    rules = scheme.get("rules", {})

    age = int(citizen.get("age", 0))
    income = int(citizen.get("income", 0))
    category = str(citizen.get("category", "general")).lower()

    reasons_pass, reasons_fail = [], []

    # Category check
    allowed = [c.lower() for c in rules.get("categories", ["general"])]
    if category in allowed or "general" in allowed:
        reasons_pass.append(f"Category '{category}' matches scheme")
    else:
        reasons_fail.append(f"Category '{category}' not in {allowed}")

    # Age check
    age_min = rules.get("age_min", 0)
    age_max = rules.get("age_max", 120)
    if age_min <= age <= age_max:
        reasons_pass.append(f"Age {age} within allowed range {age_min}-{age_max}")
    else:
        reasons_fail.append(f"Age {age} outside allowed range {age_min}-{age_max}")

    # Income check
    income_max = rules.get("income_max", 10000000)
    if income <= income_max:
        reasons_pass.append(f"Income Rs.{income:,} within limit Rs.{income_max:,}")
    else:
        reasons_fail.append(f"Income Rs.{income:,} exceeds limit Rs.{income_max:,}")

    eligible = len(reasons_fail) == 0
    total = len(reasons_pass) + len(reasons_fail)
    score = round((len(reasons_pass) / total) * 100) if total > 0 else 0

    return {
        "scheme_id": scheme.get("id"),
        "name": scheme.get("name"),
        "category": scheme.get("category"),
        "eligible": eligible,
        "match_score": score,
        "reasons_pass": reasons_pass,
        "reasons_fail": reasons_fail,
        "description": scheme.get("description"),
        "benefits": scheme.get("benefits"),
        "eligibility_text": scheme.get("eligibility_text"),
    }


def extract_data(content):
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            return {}, []
    data = content.get("metadata", content)
    return data.get("citizen", data), data.get("schemes", [])


def message_handler(message: AgentMessage, topic: str):
    print("[Eligibility Agent] Evaluating eligibility")
    citizen, schemes = extract_data(message.content)
    data_raw = message.content
    if isinstance(data_raw, str):
        try: data_raw = json.loads(data_raw)
        except: pass
    if isinstance(data_raw, dict):
        data_raw = data_raw.get("metadata", data_raw)
    return_all = data_raw.get("return_all", False) if isinstance(data_raw, dict) else False

    if not schemes:
        agent.set_response(message.message_id, json.dumps([]))
        return

    results = [check_scheme_eligibility(citizen, s) for s in schemes]
    eligible = [r for r in results if r["eligible"]]
    print(f"[Eligibility Agent] {len(eligible)}/{len(results)} eligible")

    if return_all:
        agent.set_response(message.message_id, json.dumps(results))
    else:
        agent.set_response(message.message_id, json.dumps(eligible))


agent.add_message_handler(message_handler)

while True:
    time.sleep(60)
