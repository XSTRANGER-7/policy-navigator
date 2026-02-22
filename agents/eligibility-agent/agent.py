from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, time, json

try:
    from openai import OpenAI as _OpenAI
    _openai_available = True
except ImportError:
    _openai_available = False

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5002))
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
_llm = _OpenAI(api_key=OPENAI_API_KEY) if (_openai_available and OPENAI_API_KEY) else None


def llm_explain_eligibility(citizen: dict, eligible: list, ineligible: list) -> dict:
    """Generate a personalized natural-language explanation of the eligibility result."""
    if not _llm:
        return {}
    try:
        scheme_names_ok  = [s["name"] for s in eligible[:5]]
        scheme_names_fail = [s["name"] for s in ineligible[:3]]
        fail_reasons     = [r for s in ineligible[:3] for r in s.get("reasons_fail", [])[:1]]
        prompt = (
            f"A citizen in India has the following profile:\n"
            f"  Age: {citizen.get('age')}, Income: Rs.{citizen.get('income'):,}/year, "
            f"Category: {citizen.get('category')}, State: {citizen.get('state', 'India')}\n\n"
            f"They ARE eligible for: {', '.join(scheme_names_ok) if scheme_names_ok else 'no schemes'}\n"
            f"They are NOT eligible for: {', '.join(scheme_names_fail) if scheme_names_fail else 'none checked'}\n"
            f"Key reasons for ineligibility: {'; '.join(fail_reasons) if fail_reasons else 'N/A'}\n\n"
            f"Write TWO things in JSON:\n"
            f"1. \"summary\": 2-3 sentence plain-English explanation of their eligibility result.\n"
            f"2. \"advice\": 1-2 actionable sentences on what they can do to qualify for more schemes "
            f"(e.g. document to get, category to register under, age/income boundary tips).\n"
            f"Return ONLY valid JSON: {{\"summary\": \"...\", \"advice\": \"...\"}}"
        )
        resp = _llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.4,
        )
        raw = resp.choices[0].message.content.strip()
        return json.loads(raw)
    except Exception as e:
        print(f"[Eligibility Agent][LLM] {e}")
        return {}

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
    ineligible = [r for r in results if not r["eligible"]]
    print(f"[Eligibility Agent] {len(eligible)}/{len(results)} eligible")

    # ── LLM: personalized explanation ────────────────────────────────────────
    llm_insight = llm_explain_eligibility(citizen, eligible, ineligible)
    if llm_insight:
        print(f"[Eligibility Agent] LLM insight generated")

    if return_all:
        payload = {
            "all_evaluated": results,
            "llm_summary":   llm_insight.get("summary", ""),
            "llm_advice":    llm_insight.get("advice", ""),
        }
        agent.set_response(message.message_id, json.dumps(payload))
    else:
        payload = {
            "eligible":    eligible,
            "llm_summary": llm_insight.get("summary", ""),
            "llm_advice":  llm_insight.get("advice", ""),
        }
        agent.set_response(message.message_id, json.dumps(payload))


agent.add_message_handler(message_handler)

while True:
    time.sleep(60)
